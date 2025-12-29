using Pickleball.College.Models.DTOs;

namespace Pickleball.College.Services;

public interface ITagService
{
    // Get all tags for an object
    Task<List<ObjectTagDto>> GetObjectTagsAsync(string objectType, int objectId);

    // Add a tag to an object
    Task<ObjectTagDto> AddTagAsync(int userId, AddTagRequest request);

    // Remove a tag from an object (only if user created it)
    Task<bool> RemoveTagAsync(int userId, string objectType, int objectId, int tagId);

    // Get common/suggested tags for an object type
    Task<List<CommonTagDto>> GetCommonTagsAsync(string objectType, int objectId, int limit = 10);

    // Search tags by name
    Task<List<TagDto>> SearchTagsAsync(string query, int limit = 10);
}
