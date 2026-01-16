using System.Net.Http.Headers;

namespace Pickleball.Community.Services;

public interface ISharedAssetService
{
    Task<string?> UploadFileAsync(byte[] fileData, string fileName, string contentType, string assetType, string category);
}

/// <summary>
/// Service for uploading assets to Funtime-Shared centralized asset management
/// </summary>
public class SharedAssetService : ISharedAssetService
{
    private readonly HttpClient _httpClient;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<SharedAssetService> _logger;
    private readonly string _siteKey;

    public SharedAssetService(
        IHttpClientFactory httpClientFactory,
        IHttpContextAccessor httpContextAccessor,
        IConfiguration configuration,
        ILogger<SharedAssetService> logger)
    {
        _httpClient = httpClientFactory.CreateClient("SharedAuth");
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
        _siteKey = configuration["SharedAuth:SiteCode"] ?? "community";
    }

    /// <summary>
    /// Upload a file to Funtime-Shared asset service
    /// </summary>
    /// <param name="fileData">File bytes</param>
    /// <param name="fileName">Original filename</param>
    /// <param name="contentType">MIME type (e.g., "image/png", "application/pdf")</param>
    /// <param name="assetType">Asset type: "image", "document", "video", "audio"</param>
    /// <param name="category">Category for organization: "waiver-signatures", "signed-waivers", etc.</param>
    /// <returns>Asset URL (relative path like /asset/123) or null if failed</returns>
    public async Task<string?> UploadFileAsync(byte[] fileData, string fileName, string contentType, string assetType, string category)
    {
        try
        {
            // Get the current user's auth token from the request
            var authHeader = _httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
            if (!string.IsNullOrEmpty(authHeader))
            {
                _httpClient.DefaultRequestHeaders.Authorization =
                    AuthenticationHeaderValue.Parse(authHeader);
            }

            using var content = new MultipartFormDataContent();
            var fileContent = new ByteArrayContent(fileData);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            content.Add(fileContent, "file", fileName);

            var queryParams = $"assetType={Uri.EscapeDataString(assetType)}&category={Uri.EscapeDataString(category)}&siteKey={Uri.EscapeDataString(_siteKey)}&isPublic=true";
            // Note: Don't use leading slash - HttpClient would resolve it from domain root, bypassing /api base path
            var response = await _httpClient.PostAsync($"asset/upload?{queryParams}", content);

            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<SharedAssetUploadResponse>();
                if (result?.Success == true && !string.IsNullOrEmpty(result.Url))
                {
                    _logger.LogInformation("Uploaded asset {FileName} to shared service: {Url}", fileName, result.Url);
                    return result.Url;
                }
            }

            var errorContent = await response.Content.ReadAsStringAsync();
            _logger.LogWarning("Failed to upload asset {FileName}: {StatusCode} - {Error}",
                fileName, response.StatusCode, errorContent);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception uploading asset {FileName} to shared service", fileName);
            return null;
        }
    }
}

public class SharedAssetUploadResponse
{
    public bool Success { get; set; }
    public string? Url { get; set; }
    public int? AssetId { get; set; }
    public string? Message { get; set; }
}
