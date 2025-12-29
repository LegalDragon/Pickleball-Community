using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Services;

public class TagService : ITagService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TagService> _logger;

    public TagService(ApplicationDbContext context, ILogger<TagService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<ObjectTagDto>> GetObjectTagsAsync(string objectType, int objectId)
    {
        var tags = await _context.ObjectTags
            .Include(ot => ot.Tag)
            .Where(ot => ot.ObjectType == objectType && ot.ObjectId == objectId)
            .OrderBy(ot => ot.Tag.Name)
            .Select(ot => new ObjectTagDto
            {
                Id = ot.Id,
                TagId = ot.TagId,
                TagName = ot.Tag.Name,
                ObjectType = ot.ObjectType,
                ObjectId = ot.ObjectId,
                UserId = ot.CreatedByUserId,
                CreatedAt = ot.CreatedAt
            })
            .ToListAsync();

        return tags;
    }

    public async Task<ObjectTagDto> AddTagAsync(int userId, AddTagRequest request)
    {
        // Normalize tag name (lowercase, trimmed)
        var normalizedTagName = request.TagName.Trim().ToLowerInvariant();

        // Find or create the tag definition
        var tagDefinition = await _context.TagDefinitions
            .FirstOrDefaultAsync(t => t.Name == normalizedTagName);

        if (tagDefinition == null)
        {
            tagDefinition = new TagDefinition
            {
                Name = normalizedTagName,
                CreatedAt = DateTime.UtcNow
            };
            _context.TagDefinitions.Add(tagDefinition);
            await _context.SaveChangesAsync();
        }

        // Check if THIS USER has already applied this tag to this object
        var existingUserTag = await _context.ObjectTags
            .FirstOrDefaultAsync(ot =>
                ot.TagId == tagDefinition.Id &&
                ot.ObjectType == request.ObjectType &&
                ot.ObjectId == request.ObjectId &&
                ot.CreatedByUserId == userId);

        if (existingUserTag != null)
        {
            // Update the date and return existing tag
            existingUserTag.CreatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Tag '{TagName}' updated for {ObjectType} {ObjectId} by user {UserId}",
                normalizedTagName, request.ObjectType, request.ObjectId, userId);

            return new ObjectTagDto
            {
                Id = existingUserTag.Id,
                TagId = existingUserTag.TagId,
                TagName = tagDefinition.Name,
                ObjectType = existingUserTag.ObjectType,
                ObjectId = existingUserTag.ObjectId,
                UserId = existingUserTag.CreatedByUserId,
                CreatedAt = existingUserTag.CreatedAt
            };
        }

        // Create the object tag
        var objectTag = new ObjectTag
        {
            TagId = tagDefinition.Id,
            ObjectType = request.ObjectType,
            ObjectId = request.ObjectId,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        _context.ObjectTags.Add(objectTag);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Tag '{TagName}' added to {ObjectType} {ObjectId} by user {UserId}",
            normalizedTagName, request.ObjectType, request.ObjectId, userId);

        return new ObjectTagDto
        {
            Id = objectTag.Id,
            TagId = objectTag.TagId,
            TagName = tagDefinition.Name,
            ObjectType = objectTag.ObjectType,
            ObjectId = objectTag.ObjectId,
            UserId = objectTag.CreatedByUserId,
            CreatedAt = objectTag.CreatedAt
        };
    }

    public async Task<bool> RemoveTagAsync(int userId, string objectType, int objectId, int tagId)
    {
        // Find the tag link created by this user
        var objectTag = await _context.ObjectTags
            .FirstOrDefaultAsync(ot =>
                ot.ObjectType == objectType &&
                ot.ObjectId == objectId &&
                ot.TagId == tagId &&
                ot.CreatedByUserId == userId);

        if (objectTag == null)
        {
            // User doesn't own this tag link
            return false;
        }

        _context.ObjectTags.Remove(objectTag);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Tag {TagId} removed from {ObjectType} {ObjectId} by user {UserId}",
            tagId, objectType, objectId, userId);

        return true;
    }

    public async Task<List<CommonTagDto>> GetCommonTagsAsync(string objectType, int objectId, int limit = 10)
    {
        var commonTags = new List<CommonTagDto>();

        try
        {
            // Use the stored procedure to get common tags
            var objectTypeParam = new SqlParameter("@ObjectType", objectType);
            var objectIdParam = new SqlParameter("@ObjectId", objectId);
            var limitParam = new SqlParameter("@Limit", limit);

            commonTags = await _context.Database
                .SqlQueryRaw<CommonTagDto>(
                    "EXEC GetCommonTags @ObjectType, @ObjectId, @Limit",
                    objectTypeParam, objectIdParam, limitParam)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to execute GetCommonTags stored procedure, falling back to EF query");

            // Fallback: use EF query if stored procedure fails
            // Get tags already on this object
            var existingTagIds = await _context.ObjectTags
                .Where(ot => ot.ObjectType == objectType && ot.ObjectId == objectId)
                .Select(ot => ot.TagId)
                .ToListAsync();

            // Get most common tags for this object type, excluding already applied
            commonTags = await _context.ObjectTags
                .Where(ot => ot.ObjectType == objectType && !existingTagIds.Contains(ot.TagId))
                .GroupBy(ot => new { ot.TagId, ot.Tag.Name })
                .Select(g => new CommonTagDto
                {
                    TagId = g.Key.TagId,
                    TagName = g.Key.Name,
                    UsageCount = g.Count()
                })
                .OrderByDescending(t => t.UsageCount)
                .Take(limit)
                .ToListAsync();
        }

        return commonTags;
    }

    public async Task<List<TagDto>> SearchTagsAsync(string query, int limit = 10)
    {
        var normalizedQuery = query.Trim().ToLowerInvariant();

        var tags = await _context.TagDefinitions
            .Where(t => t.Name.Contains(normalizedQuery))
            .OrderBy(t => t.Name)
            .Take(limit)
            .Select(t => new TagDto
            {
                Id = t.Id,
                Name = t.Name
            })
            .ToListAsync();

        return tags;
    }
}
