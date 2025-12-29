using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Pickleball.College.Database;
using Pickleball.College.Models.Entities;
using Pickleball.College.Models.DTOs;
using Pickleball.College.Services;

namespace Pickleball.College.API.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class AssetsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAssetService _assetService;
    private readonly ILogger<AssetsController> _logger;

    public AssetsController(
        ApplicationDbContext context,
        IAssetService assetService,
        ILogger<AssetsController> logger)
    {
        _context = context;
        _assetService = assetService;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    /// <summary>
    /// Get an asset by its ID (serves the file with Range request support for video streaming)
    /// </summary>
    /// <param name="fileId">The unique file ID</param>
    [AllowAnonymous]
    [HttpGet("{fileId:int}")]
    public async Task<IActionResult> GetAsset(int fileId)
    {
        try
        {
            if (fileId <= 0)
            {
                return BadRequest("Valid file ID is required");
            }

            var (stream, contentType, fileName) = await _assetService.GetAssetStreamAsync(fileId);

            if (stream == null)
            {
                return NotFound("Asset not found");
            }

            // Enable range requests for video streaming (seeking support)
            var isVideo = contentType?.StartsWith("video/") == true;
            if (isVideo)
            {
                // Return file with EnableRangeProcessing for video seeking support
                return File(stream, contentType!, fileName, enableRangeProcessing: true);
            }

            // Return the file with appropriate content type
            return File(stream, contentType ?? "application/octet-stream", fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving asset: {FileId}", fileId);
            return StatusCode(500, "An error occurred while retrieving the asset");
        }
    }

    /// <summary>
    /// Upload a single file
    /// </summary>
    /// <param name="file">The file to upload</param>
    /// <param name="folder">Folder: avatars, videos, theme, materials, or custom folder name</param>
    /// <param name="objectType">Optional: The type of object this asset is associated with (e.g., "User", "Material")</param>
    /// <param name="objectId">Optional: The ID of the object this asset is associated with</param>
    [HttpPost("upload")]
    public async Task<ActionResult<ApiResponse<AssetUploadResponse>>> UploadFile(
        IFormFile file,
        [FromQuery] string folder = "image",
        [FromQuery] string? objectType = null,
        [FromQuery] int? objectId = null)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<AssetUploadResponse>
                {
                    Success = false,
                    Message = "User not authenticated"
                });
            }

            var result = await _assetService.UploadFileAsync(file, folder, userId, objectType, objectId);

            if (!result.Success)
            {
                return BadRequest(new ApiResponse<AssetUploadResponse>
                {
                    Success = false,
                    Message = result.ErrorMessage ?? "Upload failed"
                });
            }

            // Log activity
            var log = new ActivityLog
            {
                UserId = userId.Value,
                ActivityType = "AssetUploaded",
                Description = $"Uploaded {folder} file: {file.FileName}"
            };
            _context.ActivityLogs.Add(log);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<AssetUploadResponse>
            {
                Success = true,
                Message = "File uploaded successfully",
                Data = new AssetUploadResponse
                {
                    FileId = result.FileId!.Value,
                    Url = result.Url!,
                    FileName = result.FileName!,
                    OriginalFileName = result.OriginalFileName!,
                    FileSize = result.FileSize,
                    ContentType = result.ContentType!,
                    Folder = result.Folder!
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading file");
            return StatusCode(500, new ApiResponse<AssetUploadResponse>
            {
                Success = false,
                Message = "An error occurred while uploading file"
            });
        }
    }

    /// <summary>
    /// Upload multiple files
    /// </summary>
    /// <param name="files">The files to upload</param>
    /// <param name="folder">Folder: avatars, videos, theme, materials, or custom folder name</param>
    /// <param name="objectType">Optional: The type of object these assets are associated with</param>
    /// <param name="objectId">Optional: The ID of the object these assets are associated with</param>
    [HttpPost("upload-multiple")]
    public async Task<ActionResult<ApiResponse<List<AssetUploadResponse>>>> UploadMultipleFiles(
        List<IFormFile> files,
        [FromQuery] string folder = "image",
        [FromQuery] string? objectType = null,
        [FromQuery] int? objectId = null)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<List<AssetUploadResponse>>
                {
                    Success = false,
                    Message = "User not authenticated"
                });
            }

            if (files == null || files.Count == 0)
            {
                return BadRequest(new ApiResponse<List<AssetUploadResponse>>
                {
                    Success = false,
                    Message = "No files provided"
                });
            }

            if (files.Count > 10)
            {
                return BadRequest(new ApiResponse<List<AssetUploadResponse>>
                {
                    Success = false,
                    Message = "Maximum 10 files can be uploaded at once"
                });
            }

            var uploadedFiles = new List<AssetUploadResponse>();
            var errors = new List<string>();

            foreach (var file in files)
            {
                var result = await _assetService.UploadFileAsync(file, folder, userId, objectType, objectId);

                if (result.Success)
                {
                    uploadedFiles.Add(new AssetUploadResponse
                    {
                        FileId = result.FileId!.Value,
                        Url = result.Url!,
                        FileName = result.FileName!,
                        OriginalFileName = result.OriginalFileName!,
                        FileSize = result.FileSize,
                        ContentType = result.ContentType!,
                        Folder = result.Folder!
                    });
                }
                else
                {
                    errors.Add($"{file.FileName}: {result.ErrorMessage}");
                }
            }

            // Log activity
            var log = new ActivityLog
            {
                UserId = userId.Value,
                ActivityType = "MultipleAssetsUploaded",
                Description = $"Uploaded {uploadedFiles.Count} files"
            };
            _context.ActivityLogs.Add(log);
            await _context.SaveChangesAsync();

            var message = uploadedFiles.Count > 0
                ? $"Successfully uploaded {uploadedFiles.Count} file(s)"
                : "No files were uploaded";

            if (errors.Count > 0)
            {
                message += $". Errors: {string.Join("; ", errors)}";
            }

            return Ok(new ApiResponse<List<AssetUploadResponse>>
            {
                Success = uploadedFiles.Count > 0,
                Message = message,
                Data = uploadedFiles
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading multiple files");
            return StatusCode(500, new ApiResponse<List<AssetUploadResponse>>
            {
                Success = false,
                Message = "An error occurred while uploading files"
            });
        }
    }

    /// <summary>
    /// Delete a file by URL
    /// </summary>
    [HttpDelete]
    public async Task<ActionResult<ApiResponse<object>>> DeleteFile([FromQuery] string url)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<object>
                {
                    Success = false,
                    Message = "User not authenticated"
                });
            }

            if (string.IsNullOrEmpty(url))
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Message = "URL is required"
                });
            }

            var deleted = await _assetService.DeleteFileAsync(url);

            if (!deleted)
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = "File not found or could not be deleted"
                });
            }

            // Log activity
            var log = new ActivityLog
            {
                UserId = userId.Value,
                ActivityType = "AssetDeleted",
                Description = $"Deleted asset: {url}"
            };
            _context.ActivityLogs.Add(log);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "File deleted successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting file");
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Message = "An error occurred while deleting file"
            });
        }
    }

    /// <summary>
    /// Get allowed file types by folder
    /// </summary>
    [AllowAnonymous]
    [HttpGet("allowed-types")]
    public ActionResult<ApiResponse<Dictionary<string, AllowedFileTypeInfo>>> GetAllowedTypes()
    {
        var folders = new[] { "avatars", "videos", "theme", "materials" };
        var result = new Dictionary<string, AllowedFileTypeInfo>();

        foreach (var folder in folders)
        {
            var options = _assetService.GetCategoryOptions(folder);
            if (options != null)
            {
                result[folder] = new AllowedFileTypeInfo
                {
                    Extensions = options.AllowedExtensions.ToList(),
                    MaxSizeBytes = options.MaxSizeBytes,
                    MaxSizeMB = options.MaxSizeMB
                };
            }
        }

        return Ok(new ApiResponse<Dictionary<string, AllowedFileTypeInfo>>
        {
            Success = true,
            Data = result
        });
    }
}
