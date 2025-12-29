using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pickleball.College.Models.DTOs;
using Pickleball.College.Services;
using System.Security.Claims;

namespace Pickleball.College.Controllers;

[ApiController]
[Route("[controller]")]
public class TagsController : ControllerBase
{
    private readonly ITagService _tagService;

    public TagsController(ITagService tagService)
    {
        _tagService = tagService;
    }

    /// <summary>
    /// Get all tags for an object
    /// </summary>
    [HttpGet("{objectType}/{objectId}")]
    public async Task<ActionResult<List<ObjectTagDto>>> GetObjectTags(string objectType, int objectId)
    {
        var tags = await _tagService.GetObjectTagsAsync(objectType, objectId);
        return Ok(tags);
    }

    /// <summary>
    /// Add a tag to an object
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ObjectTagDto>> AddTag([FromBody] AddTagRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var tag = await _tagService.AddTagAsync(userId.Value, request);
            return Ok(tag);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Remove a tag from an object (only if user created it)
    /// </summary>
    [HttpDelete("{objectType}/{objectId}/{tagId}")]
    [Authorize]
    public async Task<ActionResult> RemoveTag(string objectType, int objectId, int tagId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var removed = await _tagService.RemoveTagAsync(userId.Value, objectType, objectId, tagId);
        if (!removed) return NotFound(new { message = "Tag not found or you don't have permission to remove it" });

        return NoContent();
    }

    /// <summary>
    /// Get common/suggested tags for an object type
    /// </summary>
    [HttpGet("{objectType}/{objectId}/common")]
    public async Task<ActionResult<List<CommonTagDto>>> GetCommonTags(
        string objectType,
        int objectId,
        [FromQuery] int limit = 10)
    {
        var tags = await _tagService.GetCommonTagsAsync(objectType, objectId, limit);
        return Ok(tags);
    }

    /// <summary>
    /// Search tags by name
    /// </summary>
    [HttpGet("search")]
    public async Task<ActionResult<List<TagDto>>> SearchTags(
        [FromQuery] string query,
        [FromQuery] int limit = 10)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return Ok(new List<TagDto>());
        }

        var tags = await _tagService.SearchTagsAsync(query, limit);
        return Ok(tags);
    }

    private int? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? User.FindFirst("sub")?.Value
                       ?? User.FindFirst("userId")?.Value;

        if (int.TryParse(userIdClaim, out var userId))
            return userId;

        return null;
    }
}
