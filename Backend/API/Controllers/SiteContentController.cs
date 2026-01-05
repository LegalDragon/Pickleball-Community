using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Services;
using System.Security.Claims;

namespace Pickleball.Community.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SiteContentController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<SiteContentController> _logger;

    public SiteContentController(ApplicationDbContext context, ILogger<SiteContentController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var id) ? id : null;
    }

    private async Task<bool> IsAdmin()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return false;

        var user = await _context.Users.FindAsync(userId.Value);
        return user?.Role == "Admin";
    }

    /// <summary>
    /// Get content by key (public)
    /// </summary>
    [HttpGet("{key}")]
    public async Task<IActionResult> GetContent(string key)
    {
        var content = await _context.SiteContents
            .Include(c => c.LastUpdatedByUser)
            .FirstOrDefaultAsync(c => c.ContentKey == key.ToLower());

        if (content == null)
        {
            return NotFound(new { success = false, message = "Content not found" });
        }

        var dto = new SiteContentDto
        {
            Id = content.Id,
            ContentKey = content.ContentKey,
            Title = content.Title,
            Content = content.Content,
            LastUpdatedByUserName = content.LastUpdatedByUser != null
                ? $"{content.LastUpdatedByUser.FirstName} {content.LastUpdatedByUser.LastName}".Trim()
                : null,
            CreatedAt = content.CreatedAt,
            UpdatedAt = content.UpdatedAt
        };

        return Ok(new { success = true, data = dto });
    }

    /// <summary>
    /// Get all content pages (admin only)
    /// </summary>
    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetAllContent()
    {
        if (!await IsAdmin())
        {
            return Forbid();
        }

        var contents = await _context.SiteContents
            .Include(c => c.LastUpdatedByUser)
            .OrderBy(c => c.ContentKey)
            .Select(c => new SiteContentDto
            {
                Id = c.Id,
                ContentKey = c.ContentKey,
                Title = c.Title,
                Content = c.Content,
                LastUpdatedByUserName = c.LastUpdatedByUser != null
                    ? (c.LastUpdatedByUser.FirstName + " " + c.LastUpdatedByUser.LastName).Trim()
                    : null,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt
            })
            .ToListAsync();

        return Ok(new { success = true, data = contents });
    }

    /// <summary>
    /// Update content (admin only)
    /// </summary>
    [HttpPut("{key}")]
    [Authorize]
    public async Task<IActionResult> UpdateContent(string key, [FromBody] UpdateSiteContentRequest request)
    {
        if (!await IsAdmin())
        {
            return Forbid();
        }

        var content = await _context.SiteContents
            .FirstOrDefaultAsync(c => c.ContentKey == key.ToLower());

        if (content == null)
        {
            return NotFound(new { success = false, message = "Content not found" });
        }

        if (!string.IsNullOrWhiteSpace(request.Title))
        {
            content.Title = request.Title;
        }

        if (request.Content != null)
        {
            content.Content = request.Content;
        }

        content.LastUpdatedByUserId = GetUserId();
        content.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Site content '{Key}' updated by user {UserId}", key, GetUserId());

        return Ok(new { success = true, message = "Content updated successfully" });
    }

    /// <summary>
    /// Create new content page (admin only)
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreateContent([FromBody] CreateSiteContentRequest request)
    {
        if (!await IsAdmin())
        {
            return Forbid();
        }

        var key = request.ContentKey?.ToLower().Trim();
        if (string.IsNullOrWhiteSpace(key))
        {
            return BadRequest(new { success = false, message = "Content key is required" });
        }

        var existing = await _context.SiteContents.AnyAsync(c => c.ContentKey == key);
        if (existing)
        {
            return BadRequest(new { success = false, message = "Content with this key already exists" });
        }

        var content = new SiteContent
        {
            ContentKey = key,
            Title = request.Title ?? key,
            Content = request.Content ?? "",
            LastUpdatedByUserId = GetUserId(),
            CreatedAt = DateTime.UtcNow
        };

        _context.SiteContents.Add(content);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, data = new { id = content.Id } });
    }
}

public class CreateSiteContentRequest
{
    public string? ContentKey { get; set; }
    public string? Title { get; set; }
    public string? Content { get; set; }
}
