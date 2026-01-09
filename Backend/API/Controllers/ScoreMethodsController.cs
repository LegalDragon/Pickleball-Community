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
public class ScoreMethodsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ScoreMethodsController> _logger;

    public ScoreMethodsController(ApplicationDbContext context, ILogger<ScoreMethodsController> logger)
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

    // GET: /scoremethods - Get all score methods
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ScoreMethodDto>>>> GetAll([FromQuery] bool includeInactive = false)
    {
        try
        {
            var query = _context.ScoreMethods.AsQueryable();

            if (!includeInactive)
            {
                query = query.Where(s => s.IsActive);
            }

            var methods = await query
                .OrderBy(s => s.SortOrder)
                .ThenBy(s => s.Name)
                .Select(s => new ScoreMethodDto
                {
                    Id = s.Id,
                    Name = s.Name,
                    Description = s.Description,
                    BaseType = s.BaseType,
                    SortOrder = s.SortOrder,
                    IsActive = s.IsActive,
                    IsDefault = s.IsDefault
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<ScoreMethodDto>> { Success = true, Data = methods });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching score methods");
            return StatusCode(500, new ApiResponse<List<ScoreMethodDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /scoremethods/{id} - Get single score method
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<ScoreMethodDto>>> GetById(int id)
    {
        try
        {
            var method = await _context.ScoreMethods.FindAsync(id);
            if (method == null)
                return NotFound(new ApiResponse<ScoreMethodDto> { Success = false, Message = "Score method not found" });

            return Ok(new ApiResponse<ScoreMethodDto>
            {
                Success = true,
                Data = new ScoreMethodDto
                {
                    Id = method.Id,
                    Name = method.Name,
                    Description = method.Description,
                    BaseType = method.BaseType,
                    SortOrder = method.SortOrder,
                    IsActive = method.IsActive,
                    IsDefault = method.IsDefault
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching score method {Id}", id);
            return StatusCode(500, new ApiResponse<ScoreMethodDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /scoremethods - Create new score method (Admin only)
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ScoreMethodDto>>> Create([FromBody] CreateScoreMethodDto dto)
    {
        try
        {
            if (!await IsAdminAsync())
                return Forbid();

            // Validate BaseType
            var validBaseTypes = new[] { "Classic", "Rally" };
            if (!validBaseTypes.Contains(dto.BaseType))
                return BadRequest(new ApiResponse<ScoreMethodDto> { Success = false, Message = "BaseType must be 'Classic' or 'Rally'" });

            // If this is set as default, unset other defaults
            if (dto.IsDefault)
            {
                var existingDefaults = await _context.ScoreMethods.Where(s => s.IsDefault).ToListAsync();
                foreach (var existing in existingDefaults)
                {
                    existing.IsDefault = false;
                }
            }

            var method = new ScoreMethod
            {
                Name = dto.Name,
                Description = dto.Description,
                BaseType = dto.BaseType,
                SortOrder = dto.SortOrder,
                IsActive = dto.IsActive,
                IsDefault = dto.IsDefault
            };

            _context.ScoreMethods.Add(method);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<ScoreMethodDto>
            {
                Success = true,
                Data = new ScoreMethodDto
                {
                    Id = method.Id,
                    Name = method.Name,
                    Description = method.Description,
                    BaseType = method.BaseType,
                    SortOrder = method.SortOrder,
                    IsActive = method.IsActive,
                    IsDefault = method.IsDefault
                },
                Message = "Score method created successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating score method");
            return StatusCode(500, new ApiResponse<ScoreMethodDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /scoremethods/{id} - Update score method (Admin only)
    [HttpPut("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ScoreMethodDto>>> Update(int id, [FromBody] UpdateScoreMethodDto dto)
    {
        try
        {
            if (!await IsAdminAsync())
                return Forbid();

            var method = await _context.ScoreMethods.FindAsync(id);
            if (method == null)
                return NotFound(new ApiResponse<ScoreMethodDto> { Success = false, Message = "Score method not found" });

            // Validate BaseType if provided
            if (!string.IsNullOrEmpty(dto.BaseType))
            {
                var validBaseTypes = new[] { "Classic", "Rally" };
                if (!validBaseTypes.Contains(dto.BaseType))
                    return BadRequest(new ApiResponse<ScoreMethodDto> { Success = false, Message = "BaseType must be 'Classic' or 'Rally'" });
                method.BaseType = dto.BaseType;
            }

            // If this is set as default, unset other defaults
            if (dto.IsDefault == true && !method.IsDefault)
            {
                var existingDefaults = await _context.ScoreMethods
                    .Where(s => s.IsDefault && s.Id != id)
                    .ToListAsync();
                foreach (var existing in existingDefaults)
                {
                    existing.IsDefault = false;
                }
            }

            if (!string.IsNullOrEmpty(dto.Name))
                method.Name = dto.Name;

            if (dto.Description != null)
                method.Description = dto.Description;

            if (dto.SortOrder.HasValue)
                method.SortOrder = dto.SortOrder.Value;

            if (dto.IsActive.HasValue)
                method.IsActive = dto.IsActive.Value;

            if (dto.IsDefault.HasValue)
                method.IsDefault = dto.IsDefault.Value;

            method.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<ScoreMethodDto>
            {
                Success = true,
                Data = new ScoreMethodDto
                {
                    Id = method.Id,
                    Name = method.Name,
                    Description = method.Description,
                    BaseType = method.BaseType,
                    SortOrder = method.SortOrder,
                    IsActive = method.IsActive,
                    IsDefault = method.IsDefault
                },
                Message = "Score method updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating score method {Id}", id);
            return StatusCode(500, new ApiResponse<ScoreMethodDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /scoremethods/{id} - Delete score method (Admin only)
    [HttpDelete("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
    {
        try
        {
            if (!await IsAdminAsync())
                return Forbid();

            var method = await _context.ScoreMethods.FindAsync(id);
            if (method == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Score method not found" });

            // Check if in use by any score formats
            var inUse = await _context.ScoreFormats.AnyAsync(s => s.ScoreMethodId == id);
            if (inUse)
            {
                // Soft delete by deactivating
                method.IsActive = false;
                method.UpdatedAt = DateTime.Now;
                await _context.SaveChangesAsync();
                return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Score method deactivated (in use by score formats)" });
            }

            _context.ScoreMethods.Remove(method);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Score method deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting score method {Id}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }
}
