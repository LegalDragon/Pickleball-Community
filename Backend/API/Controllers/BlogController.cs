using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Pickleball.College.Services;
using Pickleball.College.API.Models.DTOs;

namespace Pickleball.College.API.Controllers;

[ApiController]
[Route("[controller]")]
public class BlogController : ControllerBase
{
    private readonly IBlogService _blogService;

    public BlogController(IBlogService blogService)
    {
        _blogService = blogService;
    }

    // GET /blog - Get all published blog posts (public)
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<List<BlogPostListDto>>> GetPublishedPosts(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? category = null)
    {
        var posts = await _blogService.GetPublishedPostsAsync(page, pageSize, category);
        return Ok(posts);
    }

    // GET /blog/categories - Get all categories
    [HttpGet("categories")]
    [AllowAnonymous]
    public async Task<ActionResult<List<string>>> GetCategories()
    {
        var categories = await _blogService.GetCategoriesAsync();
        return Ok(categories);
    }

    // GET /blog/{id} - Get blog post by ID
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<ActionResult<BlogPostDetailDto>> GetPostById(int id)
    {
        var post = await _blogService.GetPostByIdAsync(id);
        if (post == null)
        {
            return NotFound();
        }

        // If post is not published, only author can view
        if (!post.IsPublished)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId) || userId != post.Author.Id)
            {
                return NotFound();
            }
        }

        // Increment view count
        await _blogService.IncrementViewCountAsync(id);

        return Ok(post);
    }

    // GET /blog/slug/{slug} - Get blog post by slug
    [HttpGet("slug/{slug}")]
    [AllowAnonymous]
    public async Task<ActionResult<BlogPostDetailDto>> GetPostBySlug(string slug)
    {
        var post = await _blogService.GetPostBySlugAsync(slug);
        if (post == null)
        {
            return NotFound();
        }

        // If post is not published, only author can view
        if (!post.IsPublished)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId) || userId != post.Author.Id)
            {
                return NotFound();
            }
        }

        return Ok(post);
    }

    // GET /blog/coach/{coachId} - Get all posts by a coach (public - only published)
    [HttpGet("coach/{coachId:int}")]
    [AllowAnonymous]
    public async Task<ActionResult<List<BlogPostListDto>>> GetCoachPosts(int coachId)
    {
        var posts = await _blogService.GetCoachPostsAsync(coachId, includeUnpublished: false);
        return Ok(posts);
    }

    // GET /blog/my-posts - Get current coach's posts (including drafts)
    [HttpGet("my-posts")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult<List<BlogPostListDto>>> GetMyPosts()
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        var posts = await _blogService.GetCoachPostsAsync(userId, includeUnpublished: true);
        return Ok(posts);
    }

    // POST /blog - Create a new blog post (coach only)
    [HttpPost]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult<BlogPostDetailDto>> CreatePost([FromBody] CreateBlogPostDto dto)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        try
        {
            var post = await _blogService.CreatePostAsync(userId, dto);
            return Ok(post);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // PUT /blog/{id} - Update a blog post (author only)
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult<BlogPostDetailDto>> UpdatePost(int id, [FromBody] UpdateBlogPostDto dto)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        try
        {
            var post = await _blogService.UpdatePostAsync(id, userId, dto);
            if (post == null)
            {
                return NotFound(new { message = "Blog post not found or you don't have permission to edit it" });
            }
            return Ok(post);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // DELETE /blog/{id} - Delete a blog post (author only)
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> DeletePost(int id)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        var result = await _blogService.DeletePostAsync(id, userId);
        if (!result)
        {
            return NotFound(new { message = "Blog post not found or you don't have permission to delete it" });
        }

        return Ok(new { message = "Blog post deleted successfully" });
    }

    // POST /blog/{id}/toggle-publish - Toggle publish status (author only)
    [HttpPost("{id:int}/toggle-publish")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> TogglePublish(int id)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        var result = await _blogService.TogglePublishAsync(id, userId);
        if (!result)
        {
            return NotFound(new { message = "Blog post not found or you don't have permission to modify it" });
        }

        return Ok(new { message = "Publish status toggled successfully" });
    }
}
