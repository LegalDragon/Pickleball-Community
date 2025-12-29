namespace Pickleball.College.Models.Configuration;

public class FileStorageOptions
{
    public const string SectionName = "FileStorage";

    public string Provider { get; set; } = "local";
    public string BasePath { get; set; } = "wwwroot";
    public string AssetBaseUrl { get; set; } = string.Empty;
    public string UploadsFolder { get; set; } = "uploads";
    public string[] AllowedImageExtensions { get; set; } = { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg" };
    public string[] AllowedVideoExtensions { get; set; } = { ".mp4", ".webm", ".mov", ".avi" };
    public string[] AllowedDocumentExtensions { get; set; } = { ".pdf", ".doc", ".docx", ".txt", ".xlsx", ".xls", ".pptx", ".ppt" };
    public int MaxImageSizeMB { get; set; } = 10;
    public int MaxVideoSizeMB { get; set; } = 100;
    public int MaxDocumentSizeMB { get; set; } = 25;
    public Dictionary<string, CategoryOptions> Categories { get; set; } = new();

    public string GetUploadsPath(IWebHostEnvironment? environment = null)
    {
        var basePath = environment?.WebRootPath ?? BasePath;
        return Path.Combine(basePath, UploadsFolder);
    }

    public CategoryOptions? GetCategory(string categoryName)
    {
        return Categories.TryGetValue(categoryName.ToLowerInvariant(), out var category) ? category : null;
    }
}

public class CategoryOptions
{
    public string Folder { get; set; } = string.Empty;
    public int MaxSizeMB { get; set; } = 10;
    public string[] AllowedExtensions { get; set; } = Array.Empty<string>();

    public long MaxSizeBytes => MaxSizeMB * 1024L * 1024L;
}
