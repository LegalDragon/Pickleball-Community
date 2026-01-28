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
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<SharedAssetService> _logger;
    private readonly string _siteKey;
    private readonly string? _apiKey;

    public SharedAssetService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<SharedAssetService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _siteKey = configuration["SharedAuth:SiteCode"] ?? "community";
        _apiKey = configuration["SharedAuth:ApiKey"];
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
            var httpClient = _httpClientFactory.CreateClient("SharedAuth");

            using var content = new MultipartFormDataContent();
            var fileContent = new ByteArrayContent(fileData);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            content.Add(fileContent, "file", fileName);

            var queryParams = $"assetType={Uri.EscapeDataString(assetType)}&category={Uri.EscapeDataString(category)}&siteKey={Uri.EscapeDataString(_siteKey)}&isPublic=true";

            // Create request with API key header (consistent with AssetsController.UploadSharedAsset)
            var request = new HttpRequestMessage(HttpMethod.Post, $"asset/upload?{queryParams}");
            request.Content = content;

            if (!string.IsNullOrEmpty(_apiKey))
            {
                request.Headers.Add("X-Api-Key", _apiKey);
            }

            var response = await httpClient.SendAsync(request);

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
