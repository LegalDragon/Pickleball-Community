using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;
using System.Security.Claims;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class ScoreFormatsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ScoreFormatsController> _logger;

    public ScoreFormatsController(ApplicationDbContext context, ILogger<ScoreFormatsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                          ?? User.FindFirst("sub")?.Value
                          ?? User.FindFirst("userId")?.Value;

        if (int.TryParse(userIdClaim, out int userId))
        {
            return userId;
        }
        return null;
    }

    private async Task<bool> IsAdminAsync()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return false;

        var user = await _context.Users.FindAsync(userId.Value);
        return user?.Role == "Admin";
    }

    private static string GenerateShortDisplay(ScoreFormat format, string? scoreMethodName)
    {
        var parts = new List<string>();

        // Scoring type
        parts.Add(scoreMethodName ?? format.ScoringType);

        // Play to and win by
        parts.Add($"{format.MaxPoints}-{format.WinByMargin}");

        // Cap
        if (format.CapAfter > 0)
        {
            var capAt = format.MaxPoints + format.CapAfter;
            parts.Add($"cap {capAt}");
        }

        // Change ends
        if (format.SwitchEndsAtMidpoint)
        {
            var midpoint = format.MidpointScore ?? format.MaxPoints / 2;
            parts.Add($"switch@{midpoint}");
        }

        // Time limit
        if (format.TimeLimitMinutes.HasValue)
        {
            parts.Add($"{format.TimeLimitMinutes}min");
        }

        return string.Join(" ", parts);
    }

    private static string GenerateAutoName(ScoreFormat format, string? scoreMethodName)
    {
        var type = scoreMethodName ?? format.ScoringType;
        var capStr = format.CapAfter > 0 ? $" Cap {format.MaxPoints + format.CapAfter}" : "";
        var switchStr = format.SwitchEndsAtMidpoint ? " Switch" : "";
        return $"{type} {format.MaxPoints}-{format.WinByMargin}{capStr}{switchStr}";
    }

    private ScoreFormatDto MapToDto(ScoreFormat format)
    {
        return new ScoreFormatDto
        {
            Id = format.Id,
            Name = format.Name,
            Description = format.Description,
            ScoreMethodId = format.ScoreMethodId,
            ScoreMethodName = format.ScoreMethod?.Name,
            ScoringType = format.ScoringType,
            MaxPoints = format.MaxPoints,
            WinByMargin = format.WinByMargin,
            CapAfter = format.CapAfter,
            SwitchEndsAtMidpoint = format.SwitchEndsAtMidpoint,
            MidpointScore = format.MidpointScore,
            TimeLimitMinutes = format.TimeLimitMinutes,
            IsTiebreaker = format.IsTiebreaker,
            IsDefault = format.IsDefault,
            IsPreset = format.IsPreset,
            IsActive = format.IsActive,
            SortOrder = format.SortOrder,
            EventId = format.EventId,
            ShortDisplay = GenerateShortDisplay(format, format.ScoreMethod?.Name)
        };
    }

    // GET: /scoreformats - Get all score formats (presets by default)
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ScoreFormatDto>>>> GetAll(
        [FromQuery] bool includeInactive = false,
        [FromQuery] bool presetsOnly = true,
        [FromQuery] int? eventId = null)
    {
        try
        {
            var query = _context.ScoreFormats
                .Include(s => s.ScoreMethod)
                .AsQueryable();

            if (!includeInactive)
            {
                query = query.Where(s => s.IsActive);
            }

            if (presetsOnly)
            {
                query = query.Where(s => s.IsPreset);
            }
            else if (eventId.HasValue)
            {
                // Get presets plus event-specific formats
                query = query.Where(s => s.IsPreset || s.EventId == eventId.Value);
            }

            var formats = await query
                .OrderBy(s => s.SortOrder)
                .ThenBy(s => s.Name)
                .ToListAsync();

            return Ok(new ApiResponse<List<ScoreFormatDto>>
            {
                Success = true,
                Data = formats.Select(MapToDto).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching score formats");
            return StatusCode(500, new ApiResponse<List<ScoreFormatDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /scoreformats/{id} - Get single score format
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<ScoreFormatDto>>> GetById(int id)
    {
        try
        {
            var format = await _context.ScoreFormats
                .Include(s => s.ScoreMethod)
                .FirstOrDefaultAsync(s => s.Id == id);

            if (format == null)
                return NotFound(new ApiResponse<ScoreFormatDto> { Success = false, Message = "Score format not found" });

            return Ok(new ApiResponse<ScoreFormatDto>
            {
                Success = true,
                Data = MapToDto(format)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching score format {Id}", id);
            return StatusCode(500, new ApiResponse<ScoreFormatDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /scoreformats - Create new score format (Admin only for presets)
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ScoreFormatDto>>> Create([FromBody] CreateScoreFormatRequest dto)
    {
        try
        {
            // Non-admins can only create event-specific formats
            var isAdmin = await IsAdminAsync();
            var isPreset = dto.IsPreset ?? true;

            if (isPreset && !isAdmin)
                return Forbid();

            // If this is set as default, unset other defaults
            if (dto.IsTiebreaker == false && isPreset)
            {
                // Only manage defaults for presets
            }

            // Get score method for auto-naming if needed
            string? scoreMethodName = null;
            if (dto.ScoreMethodId.HasValue)
            {
                var scoreMethod = await _context.ScoreMethods.FindAsync(dto.ScoreMethodId.Value);
                scoreMethodName = scoreMethod?.Name;
            }

            var format = new ScoreFormat
            {
                Name = !string.IsNullOrWhiteSpace(dto.Name) ? dto.Name : "",
                Description = dto.Description,
                ScoreMethodId = dto.ScoreMethodId,
                ScoringType = dto.ScoringType ?? "Rally",
                MaxPoints = dto.MaxPoints ?? 11,
                WinByMargin = dto.WinByMargin ?? 2,
                CapAfter = dto.CapAfter ?? 0,
                SwitchEndsAtMidpoint = dto.SwitchEndsAtMidpoint ?? false,
                MidpointScore = dto.MidpointScore,
                TimeLimitMinutes = dto.TimeLimitMinutes,
                IsTiebreaker = dto.IsTiebreaker ?? false,
                IsPreset = isPreset,
                EventId = dto.EventId,
                SortOrder = dto.SortOrder ?? 0,
                IsActive = true,
                IsDefault = false
            };

            // Auto-generate name if not provided
            if (string.IsNullOrWhiteSpace(format.Name))
            {
                format.Name = GenerateAutoName(format, scoreMethodName);
            }

            _context.ScoreFormats.Add(format);
            await _context.SaveChangesAsync();

            // Reload with score method for DTO
            await _context.Entry(format).Reference(f => f.ScoreMethod).LoadAsync();

            return Ok(new ApiResponse<ScoreFormatDto>
            {
                Success = true,
                Data = MapToDto(format),
                Message = "Score format created successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating score format");
            return StatusCode(500, new ApiResponse<ScoreFormatDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /scoreformats/{id} - Update score format (Admin only for presets)
    [HttpPut("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ScoreFormatDto>>> Update(int id, [FromBody] UpdateScoreFormatRequest dto)
    {
        try
        {
            var format = await _context.ScoreFormats
                .Include(s => s.ScoreMethod)
                .FirstOrDefaultAsync(s => s.Id == id);

            if (format == null)
                return NotFound(new ApiResponse<ScoreFormatDto> { Success = false, Message = "Score format not found" });

            // Only admins can edit presets
            if (format.IsPreset && !await IsAdminAsync())
                return Forbid();

            // If this is set as default, unset other defaults
            if (dto.IsDefault == true && !format.IsDefault)
            {
                var existingDefaults = await _context.ScoreFormats
                    .Where(s => s.IsDefault && s.Id != id && s.IsPreset)
                    .ToListAsync();
                foreach (var existing in existingDefaults)
                {
                    existing.IsDefault = false;
                }
            }

            if (!string.IsNullOrEmpty(dto.Name))
                format.Name = dto.Name;

            if (dto.Description != null)
                format.Description = dto.Description;

            if (dto.ScoreMethodId.HasValue)
                format.ScoreMethodId = dto.ScoreMethodId.Value;

            if (!string.IsNullOrEmpty(dto.ScoringType))
                format.ScoringType = dto.ScoringType;

            if (dto.MaxPoints.HasValue)
                format.MaxPoints = dto.MaxPoints.Value;

            if (dto.WinByMargin.HasValue)
                format.WinByMargin = dto.WinByMargin.Value;

            if (dto.CapAfter.HasValue)
                format.CapAfter = dto.CapAfter.Value;

            if (dto.SwitchEndsAtMidpoint.HasValue)
                format.SwitchEndsAtMidpoint = dto.SwitchEndsAtMidpoint.Value;

            if (dto.MidpointScore.HasValue)
                format.MidpointScore = dto.MidpointScore.Value;

            if (dto.TimeLimitMinutes.HasValue)
                format.TimeLimitMinutes = dto.TimeLimitMinutes.Value;

            if (dto.IsTiebreaker.HasValue)
                format.IsTiebreaker = dto.IsTiebreaker.Value;

            if (dto.IsActive.HasValue)
                format.IsActive = dto.IsActive.Value;

            if (dto.IsDefault.HasValue)
                format.IsDefault = dto.IsDefault.Value;

            if (dto.SortOrder.HasValue)
                format.SortOrder = dto.SortOrder.Value;

            format.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            // Reload score method
            await _context.Entry(format).Reference(f => f.ScoreMethod).LoadAsync();

            return Ok(new ApiResponse<ScoreFormatDto>
            {
                Success = true,
                Data = MapToDto(format),
                Message = "Score format updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating score format {Id}", id);
            return StatusCode(500, new ApiResponse<ScoreFormatDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /scoreformats/{id} - Delete score format (Admin only for presets)
    [HttpDelete("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
    {
        try
        {
            var format = await _context.ScoreFormats.FindAsync(id);
            if (format == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Score format not found" });

            // Only admins can delete presets
            if (format.IsPreset && !await IsAdminAsync())
                return Forbid();

            // Check if in use by any games, matches, or divisions
            var inUseByGames = await _context.EventGames.AnyAsync(g => g.ScoreFormatId == id);
            var inUseByMatches = await _context.EventEncounters.AnyAsync(m => m.ScoreFormatId == id);
            var inUseByDivisions = await _context.Set<EventDivision>().AnyAsync(d => d.DefaultScoreFormatId == id);

            if (inUseByGames || inUseByMatches || inUseByDivisions)
            {
                // Soft delete by deactivating
                format.IsActive = false;
                format.UpdatedAt = DateTime.Now;
                await _context.SaveChangesAsync();
                return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Score format deactivated (in use)" });
            }

            _context.ScoreFormats.Remove(format);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Score format deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting score format {Id}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /scoreformats/find-or-create - Find existing format or create new one
    [HttpPost("find-or-create")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ScoreFormatDto>>> FindOrCreate([FromBody] FindOrCreateScoreFormatRequest dto)
    {
        try
        {
            // First, try to find an existing format with matching parameters
            var existingFormat = await _context.ScoreFormats
                .Include(s => s.ScoreMethod)
                .Where(s => s.IsActive)
                .Where(s => s.MaxPoints == dto.MaxPoints)
                .Where(s => s.WinByMargin == dto.WinByMargin)
                .Where(s => s.CapAfter == dto.CapAfter)
                .Where(s => s.SwitchEndsAtMidpoint == dto.SwitchEndsAtMidpoint)
                .Where(s => s.IsTiebreaker == dto.IsTiebreaker)
                .Where(s => dto.ScoreMethodId == null || s.ScoreMethodId == dto.ScoreMethodId)
                .Where(s => dto.TimeLimitMinutes == null || s.TimeLimitMinutes == dto.TimeLimitMinutes)
                .Where(s => dto.MidpointScore == null || s.MidpointScore == dto.MidpointScore)
                // Prefer presets over event-specific formats
                .OrderByDescending(s => s.IsPreset)
                .ThenBy(s => s.SortOrder)
                .FirstOrDefaultAsync();

            if (existingFormat != null)
            {
                return Ok(new ApiResponse<ScoreFormatDto>
                {
                    Success = true,
                    Data = MapToDto(existingFormat),
                    Message = "Found existing format"
                });
            }

            // No existing format found - create a new one
            // Get score method for auto-naming
            string? scoreMethodName = null;
            if (dto.ScoreMethodId.HasValue)
            {
                var scoreMethod = await _context.ScoreMethods.FindAsync(dto.ScoreMethodId.Value);
                scoreMethodName = scoreMethod?.Name;
            }

            var newFormat = new ScoreFormat
            {
                ScoreMethodId = dto.ScoreMethodId,
                ScoringType = scoreMethodName != null && scoreMethodName.Contains("Classic") ? "Classic" : "Rally",
                MaxPoints = dto.MaxPoints,
                WinByMargin = dto.WinByMargin,
                CapAfter = dto.CapAfter,
                SwitchEndsAtMidpoint = dto.SwitchEndsAtMidpoint,
                MidpointScore = dto.MidpointScore,
                TimeLimitMinutes = dto.TimeLimitMinutes,
                IsTiebreaker = dto.IsTiebreaker,
                IsPreset = dto.EventId == null, // Global if no event specified
                EventId = dto.EventId,
                SortOrder = 100, // Put custom formats after presets
                IsActive = true,
                IsDefault = false
            };

            // Auto-generate name
            newFormat.Name = GenerateAutoName(newFormat, scoreMethodName);

            _context.ScoreFormats.Add(newFormat);
            await _context.SaveChangesAsync();

            // Reload with score method for DTO
            await _context.Entry(newFormat).Reference(f => f.ScoreMethod).LoadAsync();

            return Ok(new ApiResponse<ScoreFormatDto>
            {
                Success = true,
                Data = MapToDto(newFormat),
                Message = "Created new format"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in find-or-create score format");
            return StatusCode(500, new ApiResponse<ScoreFormatDto> { Success = false, Message = "An error occurred" });
        }
    }
}
