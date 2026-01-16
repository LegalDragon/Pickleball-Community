using Amazon.S3;
using Amazon.S3.Transfer;

namespace Pickleball.Community.Services;

public class AwsS3StorageService : IFileStorageService
{
    private readonly IAmazonS3 _s3Client;
    private readonly string _bucketName;

    public AwsS3StorageService(IConfiguration configuration)
    {
        var awsConfig = configuration.GetSection("AWS");
        _bucketName = awsConfig["BucketName"] ?? "pickleball-Community";
        
        // In production, use IAM roles. For development, use credentials:
        _s3Client = new AmazonS3Client(
            awsConfig["AccessKey"],
            awsConfig["SecretKey"],
            Amazon.RegionEndpoint.GetBySystemName(awsConfig["Region"] ?? "us-east-1")
        );
    }

    public async Task<string> UploadFileAsync(IFormFile file, string containerName)
    {
        var key = $"{containerName}/{Guid.NewGuid()}-{file.FileName}";

        using var stream = file.OpenReadStream();
        var uploadRequest = new TransferUtilityUploadRequest
        {
            InputStream = stream,
            Key = key,
            BucketName = _bucketName,
            ContentType = file.ContentType,
            CannedACL = S3CannedACL.PublicRead
        };

        var transferUtility = new TransferUtility(_s3Client);
        await transferUtility.UploadAsync(uploadRequest);

        return $"https://{_bucketName}.s3.amazonaws.com/{key}";
    }

    public async Task<string> UploadBytesAsync(byte[] data, string fileName, string contentType, string containerName)
    {
        var key = $"{containerName}/{Guid.NewGuid()}-{fileName}";

        using var stream = new MemoryStream(data);
        var uploadRequest = new TransferUtilityUploadRequest
        {
            InputStream = stream,
            Key = key,
            BucketName = _bucketName,
            ContentType = contentType,
            CannedACL = S3CannedACL.PublicRead
        };

        var transferUtility = new TransferUtility(_s3Client);
        await transferUtility.UploadAsync(uploadRequest);

        return $"https://{_bucketName}.s3.amazonaws.com/{key}";
    }

    public async Task DeleteFileAsync(string fileUrl)
    {
        var key = fileUrl.Split('/').Last();
        await _s3Client.DeleteObjectAsync(_bucketName, key);
    }
}
