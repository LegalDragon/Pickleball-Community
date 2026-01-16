namespace Pickleball.Community.Services;

public interface IFileStorageService
{
    Task<string> UploadFileAsync(IFormFile file, string containerName);
    Task<string> UploadBytesAsync(byte[] data, string fileName, string contentType, string containerName);
    Task DeleteFileAsync(string fileUrl);
}
