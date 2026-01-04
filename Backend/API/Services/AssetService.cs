using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Configuration;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Services;

public interface IAssetService
{
    Task<AssetUploadResult> UploadFileAsync(IFormFile file, string folder, int? uploadedBy = null, string? objectType = null, int? objectId = null);
    Task<bool> DeleteFileAsync(string assetUrl);
    Task<Asset?> GetAssetByIdAsync(int fileId);
    Task<List<Asset>> GetAssetsByObjectAsync(string objectType, int objectId);
    Task<(Stream? stream, string? contentType, string? fileName)> GetAssetStreamAsync(int fileId);
    string GetUploadPath(string folder);
    string GetAssetUrl(int fileId);
    ValidationResult ValidateFile(IFormFile file, string folder);
    CategoryOptions? GetCategoryOptions(string folder);
}

public class AssetUploadResult
{
    public bool Success { get; set; }
    public int? FileId { get; set; }
    public string? Url { get; set; }
    public string? FileName { get; set; }
    public string? OriginalFileName { get; set; }
    public long FileSize { get; set; }
    public string? ContentType { get; set; }
    public string? Folder { get; set; }
    public string? ErrorMessage { get; set; }
}

public class ValidationResult
{
    public bool IsValid { get; set; }
    public string? ErrorMessage { get; set; }

    public static ValidationResult Valid() => new() { IsValid = true };
    public static ValidationResult Invalid(string message) => new() { IsValid = false, ErrorMessage = message };
}

public class AssetService : IAssetService
{
    private readonly ApplicationDbContext _context;
    private readonly FileStorageOptions _options;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<AssetService> _logger;

    public AssetService(
        ApplicationDbContext context,
        IOptions<FileStorageOptions> options,
        IWebHostEnvironment environment,
        ILogger<AssetService> logger)
    {
        _context = context;
        _options = options.Value;
        _environment = environment;
        _logger = logger;
    }

    public async Task<AssetUploadResult> UploadFileAsync(IFormFile file, string folder, int? uploadedBy = null, string? objectType = null, int? objectId = null)
    {
        try
        {
            // Validate the file
            var validation = ValidateFile(file, folder);
            if (!validation.IsValid)
            {
                return new AssetUploadResult
                {
                    Success = false,
                    ErrorMessage = validation.ErrorMessage
                };
            }

            // Get upload path
            var uploadPath = GetUploadPath(folder);
            Directory.CreateDirectory(uploadPath);

            // Generate unique filename using GUID for storage
            var uniqueId = Guid.NewGuid().ToString("N");
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            var fileName = $"{uniqueId}{extension}";

            // Store relative path only (folder/filename)
            var relativePath = $"{folder}/{fileName}";
            var fullPath = Path.Combine(uploadPath, fileName);

            // Save the file
            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Create asset record in database (FileId is auto-generated)
            // Store only relative path for portability
            var asset = new Asset
            {
                FileName = fileName,
                OriginalFileName = file.FileName,
                ContentType = file.ContentType,
                FileSize = file.Length,
                StorageProvider = _options.Provider,
                StoragePath = relativePath,
                Folder = folder,
                ObjectType = objectType,
                ObjectId = objectId,
                UploadedBy = uploadedBy,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };

            _context.Assets.Add(asset);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Asset created successfully: FileId={FileId}, FileName={FileName}, ObjectType={ObjectType}, ObjectId={ObjectId}",
                asset.FileId, asset.FileName, objectType ?? "null", objectId?.ToString() ?? "null");

            // Return the asset URL as /api/assets/{id}
            return new AssetUploadResult
            {
                Success = true,
                FileId = asset.FileId,
                Url = GetAssetUrl(asset.FileId),
                FileName = asset.FileName,
                OriginalFileName = asset.OriginalFileName,
                FileSize = asset.FileSize,
                ContentType = asset.ContentType,
                Folder = folder
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading file for folder {Folder}", folder);
            return new AssetUploadResult
            {
                Success = false,
                ErrorMessage = "An error occurred while uploading the file"
            };
        }
    }

    public async Task<List<Asset>> GetAssetsByObjectAsync(string objectType, int objectId)
    {
        return await _context.Assets
            .Where(a => a.ObjectType == objectType && a.ObjectId == objectId && !a.IsDeleted)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();
    }

    public async Task<bool> DeleteFileAsync(string assetUrl)
    {
        try
        {
            if (string.IsNullOrEmpty(assetUrl))
                return false;

            // Extract file ID from URL
            var fileId = ExtractFileIdFromUrl(assetUrl);
            if (fileId == null)
            {
                _logger.LogWarning("Could not extract file ID from URL: {Url}", assetUrl);
                return false;
            }

            // Find asset in database
            var asset = await _context.Assets.FirstOrDefaultAsync(a => a.FileId == fileId.Value && !a.IsDeleted);
            if (asset == null)
            {
                _logger.LogWarning("Asset not found: {FileId}", fileId);
                return false;
            }

            // Delete physical file (construct full path from relative path)
            var fullPath = GetFullPath(asset.StoragePath);
            if (File.Exists(fullPath))
            {
                File.Delete(fullPath);
            }

            // Mark as deleted in database (soft delete)
            asset.IsDeleted = true;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Asset deleted: {FileId}", fileId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting asset: {Url}", assetUrl);
            return false;
        }
    }

    public async Task<Asset?> GetAssetByIdAsync(int fileId)
    {
        return await _context.Assets.FirstOrDefaultAsync(a => a.FileId == fileId && !a.IsDeleted);
    }

    public async Task<(Stream? stream, string? contentType, string? fileName)> GetAssetStreamAsync(int fileId)
    {
        var asset = await GetAssetByIdAsync(fileId);
        if (asset == null)
            return (null, null, null);

        // Construct full path from relative path
        var fullPath = GetFullPath(asset.StoragePath);
        if (!File.Exists(fullPath))
        {
            _logger.LogWarning("Asset file not found on disk: {FullPath} (relative: {StoragePath})", fullPath, asset.StoragePath);
            return (null, null, null);
        }

        var stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return (stream, asset.ContentType, asset.OriginalFileName ?? asset.FileName);
    }

    /// <summary>
    /// Constructs full file path from relative storage path
    /// </summary>
    private string GetFullPath(string relativePath)
    {
        var basePath = !string.IsNullOrEmpty(_options.BasePath) ? _options.BasePath : _environment.WebRootPath ?? "wwwroot";
        return Path.Combine(basePath, _options.UploadsFolder, relativePath.Replace('/', Path.DirectorySeparatorChar));
    }

    public string GetUploadPath(string folder)
    {
        // Use configured BasePath as primary storage location
        var basePath = !string.IsNullOrEmpty(_options.BasePath) ? _options.BasePath : _environment.WebRootPath ?? "wwwroot";
        var categoryOptions = _options.GetCategory(folder);
        var folderName = categoryOptions?.Folder ?? folder;
        return Path.Combine(basePath, _options.UploadsFolder, folderName);
    }

    public string GetAssetUrl(int fileId)
    {
        // Return API endpoint URL for serving assets
        if (!string.IsNullOrEmpty(_options.AssetBaseUrl))
        {
            return $"{_options.AssetBaseUrl.TrimEnd('/')}/api/assets/{fileId}";
        }
        return $"/api/assets/{fileId}";
    }

    private int? ExtractFileIdFromUrl(string url)
    {
        if (string.IsNullOrEmpty(url))
            return null;

        // Handle both full URLs and relative paths
        // Format: /api/assets/{fileId} or https://assets.example.com/api/assets/{fileId}
        var pattern = "/api/assets/";
        var index = url.LastIndexOf(pattern, StringComparison.OrdinalIgnoreCase);
        if (index >= 0)
        {
            var idString = url.Substring(index + pattern.Length);
            // Remove any query string or trailing slash
            var queryIndex = idString.IndexOf('?');
            if (queryIndex >= 0)
                idString = idString.Substring(0, queryIndex);
            idString = idString.TrimEnd('/');

            if (int.TryParse(idString, out var fileId))
                return fileId;
        }

        return null;
    }

    public ValidationResult ValidateFile(IFormFile file, string folder)
    {
        if (file == null || file.Length == 0)
        {
            return ValidationResult.Invalid("No file provided");
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var categoryOptions = _options.GetCategory(folder);

        if (categoryOptions != null)
        {
            // Use category-specific settings
            if (!categoryOptions.AllowedExtensions.Contains(extension))
            {
                return ValidationResult.Invalid(
                    $"Invalid file type. Allowed types for {folder}: {string.Join(", ", categoryOptions.AllowedExtensions)}");
            }

            if (file.Length > categoryOptions.MaxSizeBytes)
            {
                return ValidationResult.Invalid(
                    $"File size exceeds maximum allowed ({categoryOptions.MaxSizeMB}MB)");
            }
        }
        else
        {
            // Use general settings based on file type
            var allAllowedExtensions = _options.AllowedImageExtensions
                .Concat(_options.AllowedVideoExtensions)
                .Concat(_options.AllowedDocumentExtensions)
                .ToArray();

            if (!allAllowedExtensions.Contains(extension))
            {
                return ValidationResult.Invalid(
                    $"Invalid file type. Extension {extension} is not allowed.");
            }

            // Determine max size based on file type
            long maxSize;
            if (_options.AllowedVideoExtensions.Contains(extension))
            {
                maxSize = _options.MaxVideoSizeMB * 1024L * 1024L;
            }
            else if (_options.AllowedDocumentExtensions.Contains(extension))
            {
                maxSize = _options.MaxDocumentSizeMB * 1024L * 1024L;
            }
            else
            {
                maxSize = _options.MaxImageSizeMB * 1024L * 1024L;
            }

            if (file.Length > maxSize)
            {
                return ValidationResult.Invalid(
                    $"File size exceeds maximum allowed ({maxSize / (1024 * 1024)}MB)");
            }
        }

        return ValidationResult.Valid();
    }

    public CategoryOptions? GetCategoryOptions(string folder)
    {
        return _options.GetCategory(folder);
    }
}
