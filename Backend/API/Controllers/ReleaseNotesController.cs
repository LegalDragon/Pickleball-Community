using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using System.Security.Claims;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class ReleaseNotesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ReleaseNotesController> _logger;

    public ReleaseNotesController(ApplicationDbContext context, ILogger<ReleaseNotesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private async Task<bool> IsUserAdmin()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return false;
        var user = await _context.Users.FindAsync(userId.Value);
        return user?.Role == "Admin";
    }

    #region Public/User Endpoints

    // GET: /releasenotes - Get all active release notes (public)
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ReleaseNoteDto>>>> GetReleaseNotes()
    {
        try
        {
            var releases = await _context.ReleaseNotes
                .Where(r => r.IsActive)
                .OrderByDescending(r => r.ReleaseDate)
                .Select(r => new ReleaseNoteDto
                {
                    Id = r.Id,
                    Version = r.Version,
                    Title = r.Title,
                    Content = r.Content,
                    ReleaseDate = r.ReleaseDate,
                    IsActive = r.IsActive,
                    IsMajor = r.IsMajor,
                    CreatedAt = r.CreatedAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<ReleaseNoteDto>> { Success = true, Data = releases });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching release notes");
            return StatusCode(500, new ApiResponse<List<ReleaseNoteDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /releasenotes/latest - Get latest release note (public)
    [HttpGet("latest")]
    public async Task<ActionResult<ApiResponse<ReleaseNoteDto>>> GetLatestRelease()
    {
        try
        {
            var latest = await _context.ReleaseNotes
                .Where(r => r.IsActive)
                .OrderByDescending(r => r.ReleaseDate)
                .Select(r => new ReleaseNoteDto
                {
                    Id = r.Id,
                    Version = r.Version,
                    Title = r.Title,
                    Content = r.Content,
                    ReleaseDate = r.ReleaseDate,
                    IsActive = r.IsActive,
                    IsMajor = r.IsMajor,
                    CreatedAt = r.CreatedAt
                })
                .FirstOrDefaultAsync();

            if (latest == null)
                return NotFound(new ApiResponse<ReleaseNoteDto> { Success = false, Message = "No release notes found" });

            return Ok(new ApiResponse<ReleaseNoteDto> { Success = true, Data = latest });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching latest release");
            return StatusCode(500, new ApiResponse<ReleaseNoteDto> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /releasenotes/unread - Get unread release notes for current user
    [HttpGet("unread")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<UserReleaseNoteDto>>>> GetUnreadReleases()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<UserReleaseNoteDto>> { Success = false, Message = "Not authenticated" });

            // Check if user is admin (can see test releases)
            var isAdmin = await IsUserAdmin();

            // Use left join to find unread releases (avoids Contains() issue with EF Core)
            var query = from r in _context.ReleaseNotes
                        join d in _context.UserDismissedReleases.Where(x => x.UserId == userId.Value)
                            on r.Id equals d.ReleaseNoteId into dismissed
                        from d in dismissed.DefaultIfEmpty()
                        where r.IsActive && d == null && (isAdmin || !r.IsTest)
                        orderby r.ReleaseDate descending
                        select new UserReleaseNoteDto
                        {
                            Id = r.Id,
                            Version = r.Version,
                            Title = r.Title,
                            Content = r.Content,
                            ReleaseDate = r.ReleaseDate,
                            IsMajor = r.IsMajor,
                            IsTest = r.IsTest,
                            IsDismissed = false
                        };

            var unread = await query.ToListAsync();

            return Ok(new ApiResponse<List<UserReleaseNoteDto>> { Success = true, Data = unread });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching unread releases");
            return StatusCode(500, new ApiResponse<List<UserReleaseNoteDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /releasenotes/{id}/dismiss - Dismiss a release note (never show again)
    [HttpPost("{id}/dismiss")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DismissRelease(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Not authenticated" });

            var release = await _context.ReleaseNotes.FindAsync(id);
            if (release == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Release not found" });

            // Check if already dismissed
            var existing = await _context.UserDismissedReleases
                .FirstOrDefaultAsync(d => d.UserId == userId.Value && d.ReleaseNoteId == id);

            if (existing != null)
                return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Already dismissed" });

            // Create dismissal record
            var dismissal = new UserDismissedRelease
            {
                UserId = userId.Value,
                ReleaseNoteId = id,
                DismissedAt = DateTime.UtcNow
            };

            _context.UserDismissedReleases.Add(dismissal);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Release dismissed" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error dismissing release {ReleaseId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /releasenotes/dismiss-all - Dismiss all current release notes
    [HttpPost("dismiss-all")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<int>>> DismissAllReleases()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<int> { Success = false, Message = "Not authenticated" });

            // Get all active release IDs
            var activeReleaseIds = await _context.ReleaseNotes
                .Where(r => r.IsActive)
                .Select(r => r.Id)
                .ToListAsync();

            // Get already dismissed IDs
            var dismissedIds = await _context.UserDismissedReleases
                .Where(d => d.UserId == userId.Value)
                .Select(d => d.ReleaseNoteId)
                .ToListAsync();

            // Find releases to dismiss
            var toDismiss = activeReleaseIds.Except(dismissedIds).ToList();

            foreach (var releaseId in toDismiss)
            {
                _context.UserDismissedReleases.Add(new UserDismissedRelease
                {
                    UserId = userId.Value,
                    ReleaseNoteId = releaseId,
                    DismissedAt = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<int> { Success = true, Data = toDismiss.Count, Message = $"Dismissed {toDismiss.Count} releases" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error dismissing all releases");
            return StatusCode(500, new ApiResponse<int> { Success = false, Message = "An error occurred" });
        }
    }

    #endregion

    #region Admin Endpoints

    // GET: /releasenotes/admin - Get all release notes including inactive (admin only)
    [HttpGet("admin")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<ReleaseNoteDto>>>> GetAllReleaseNotes()
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var releases = await _context.ReleaseNotes
                .OrderByDescending(r => r.ReleaseDate)
                .Include(r => r.CreatedBy)
                .Include(r => r.UpdatedBy)
                .Select(r => new ReleaseNoteDto
                {
                    Id = r.Id,
                    Version = r.Version,
                    Title = r.Title,
                    Content = r.Content,
                    ReleaseDate = r.ReleaseDate,
                    IsActive = r.IsActive,
                    IsMajor = r.IsMajor,
                    IsTest = r.IsTest,
                    CreatedAt = r.CreatedAt,
                    CreatedByName = r.CreatedBy != null ? $"{r.CreatedBy.FirstName} {r.CreatedBy.LastName}" : null,
                    UpdatedAt = r.UpdatedAt,
                    UpdatedByName = r.UpdatedBy != null ? $"{r.UpdatedBy.FirstName} {r.UpdatedBy.LastName}" : null
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<ReleaseNoteDto>> { Success = true, Data = releases });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching all release notes");
            return StatusCode(500, new ApiResponse<List<ReleaseNoteDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /releasenotes - Create a new release note (admin only)
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ReleaseNoteDto>>> CreateReleaseNote([FromBody] CreateReleaseNoteDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ReleaseNoteDto> { Success = false, Message = "Not authenticated" });

            if (!await IsUserAdmin())
                return Forbid();

            if (string.IsNullOrWhiteSpace(dto.Version) || string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Content))
                return BadRequest(new ApiResponse<ReleaseNoteDto> { Success = false, Message = "Version, title, and content are required" });

            var release = new ReleaseNote
            {
                Version = dto.Version.Trim(),
                Title = dto.Title.Trim(),
                Content = dto.Content.Trim(),
                ReleaseDate = dto.ReleaseDate ?? DateTime.UtcNow,
                IsMajor = dto.IsMajor,
                IsTest = dto.IsTest,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = userId.Value
            };

            _context.ReleaseNotes.Add(release);
            await _context.SaveChangesAsync();

            var user = await _context.Users.FindAsync(userId.Value);

            return Ok(new ApiResponse<ReleaseNoteDto>
            {
                Success = true,
                Data = new ReleaseNoteDto
                {
                    Id = release.Id,
                    Version = release.Version,
                    Title = release.Title,
                    Content = release.Content,
                    ReleaseDate = release.ReleaseDate,
                    IsActive = release.IsActive,
                    IsMajor = release.IsMajor,
                    IsTest = release.IsTest,
                    CreatedAt = release.CreatedAt,
                    CreatedByName = user != null ? $"{user.FirstName} {user.LastName}" : null
                },
                Message = "Release note created successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating release note");
            return StatusCode(500, new ApiResponse<ReleaseNoteDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /releasenotes/{id} - Update a release note (admin only)
    [HttpPut("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ReleaseNoteDto>>> UpdateReleaseNote(int id, [FromBody] UpdateReleaseNoteDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ReleaseNoteDto> { Success = false, Message = "Not authenticated" });

            if (!await IsUserAdmin())
                return Forbid();

            var release = await _context.ReleaseNotes
                .Include(r => r.CreatedBy)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (release == null)
                return NotFound(new ApiResponse<ReleaseNoteDto> { Success = false, Message = "Release note not found" });

            // Update fields if provided
            if (!string.IsNullOrWhiteSpace(dto.Version)) release.Version = dto.Version.Trim();
            if (!string.IsNullOrWhiteSpace(dto.Title)) release.Title = dto.Title.Trim();
            if (!string.IsNullOrWhiteSpace(dto.Content)) release.Content = dto.Content.Trim();
            if (dto.ReleaseDate.HasValue) release.ReleaseDate = dto.ReleaseDate.Value;
            if (dto.IsActive.HasValue) release.IsActive = dto.IsActive.Value;
            if (dto.IsMajor.HasValue) release.IsMajor = dto.IsMajor.Value;
            if (dto.IsTest.HasValue) release.IsTest = dto.IsTest.Value;

            release.UpdatedAt = DateTime.UtcNow;
            release.UpdatedByUserId = userId.Value;

            await _context.SaveChangesAsync();

            var updatedBy = await _context.Users.FindAsync(userId.Value);

            return Ok(new ApiResponse<ReleaseNoteDto>
            {
                Success = true,
                Data = new ReleaseNoteDto
                {
                    Id = release.Id,
                    Version = release.Version,
                    Title = release.Title,
                    Content = release.Content,
                    ReleaseDate = release.ReleaseDate,
                    IsActive = release.IsActive,
                    IsMajor = release.IsMajor,
                    IsTest = release.IsTest,
                    CreatedAt = release.CreatedAt,
                    CreatedByName = release.CreatedBy != null ? $"{release.CreatedBy.FirstName} {release.CreatedBy.LastName}" : null,
                    UpdatedAt = release.UpdatedAt,
                    UpdatedByName = updatedBy != null ? $"{updatedBy.FirstName} {updatedBy.LastName}" : null
                },
                Message = "Release note updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating release note {ReleaseId}", id);
            return StatusCode(500, new ApiResponse<ReleaseNoteDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /releasenotes/{id} - Delete a release note (admin only)
    [HttpDelete("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteReleaseNote(int id)
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var release = await _context.ReleaseNotes.FindAsync(id);
            if (release == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Release note not found" });

            // Also delete any dismissal records
            var dismissals = await _context.UserDismissedReleases
                .Where(d => d.ReleaseNoteId == id)
                .ToListAsync();
            _context.UserDismissedReleases.RemoveRange(dismissals);

            _context.ReleaseNotes.Remove(release);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Release note deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting release note {ReleaseId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    #endregion
}
