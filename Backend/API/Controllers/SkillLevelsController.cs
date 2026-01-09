using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using System.Security.Claims;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("skill-levels")]
public class SkillLevelsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<SkillLevelsController> _logger;

    public SkillLevelsController(ApplicationDbContext context, ILogger<SkillLevelsController> logger)
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

    // GET: /skilllevels - Get all active skill levels
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<SkillLevelDto>>>> GetSkillLevels()
    {
        try
        {
            var levels = await _context.SkillLevels
                .Where(l => l.IsActive)
                .OrderBy(l => l.SortOrder)
                .Select(l => new SkillLevelDto
                {
                    Id = l.Id,
                    Name = l.Name,
                    Description = l.Description,
                    Value = l.Value,
                    Icon = l.Icon,
                    Color = l.Color,
                    SortOrder = l.SortOrder,
                    IsActive = l.IsActive
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<SkillLevelDto>> { Success = true, Data = levels });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching skill levels");
            return StatusCode(500, new ApiResponse<List<SkillLevelDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /skilllevels/all - Get all skill levels including inactive (admin only)
    [HttpGet("all")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<SkillLevelDto>>>> GetAllSkillLevels()
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var levels = await _context.SkillLevels
                .OrderBy(l => l.SortOrder)
                .Select(l => new SkillLevelDto
                {
                    Id = l.Id,
                    Name = l.Name,
                    Description = l.Description,
                    Value = l.Value,
                    Icon = l.Icon,
                    Color = l.Color,
                    SortOrder = l.SortOrder,
                    IsActive = l.IsActive
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<SkillLevelDto>> { Success = true, Data = levels });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching all skill levels");
            return StatusCode(500, new ApiResponse<List<SkillLevelDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /skilllevels/{id} - Get a specific skill level
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<SkillLevelDto>>> GetSkillLevel(int id)
    {
        try
        {
            var level = await _context.SkillLevels.FindAsync(id);
            if (level == null)
                return NotFound(new ApiResponse<SkillLevelDto> { Success = false, Message = "Skill level not found" });

            return Ok(new ApiResponse<SkillLevelDto>
            {
                Success = true,
                Data = new SkillLevelDto
                {
                    Id = level.Id,
                    Name = level.Name,
                    Description = level.Description,
                    Value = level.Value,
                    Icon = level.Icon,
                    Color = level.Color,
                    SortOrder = level.SortOrder,
                    IsActive = level.IsActive
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching skill level {Id}", id);
            return StatusCode(500, new ApiResponse<SkillLevelDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /skilllevels - Create a new skill level (admin only)
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ApiResponse<SkillLevelDto>>> CreateSkillLevel([FromBody] CreateSkillLevelDto dto)
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var level = new SkillLevel
            {
                Name = dto.Name,
                Description = dto.Description,
                Value = dto.Value,
                Icon = dto.Icon,
                Color = dto.Color,
                SortOrder = dto.SortOrder
            };

            _context.SkillLevels.Add(level);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<SkillLevelDto>
            {
                Success = true,
                Data = new SkillLevelDto
                {
                    Id = level.Id,
                    Name = level.Name,
                    Description = level.Description,
                    Value = level.Value,
                    Icon = level.Icon,
                    Color = level.Color,
                    SortOrder = level.SortOrder,
                    IsActive = level.IsActive
                },
                Message = "Skill level created successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating skill level");
            return StatusCode(500, new ApiResponse<SkillLevelDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /skilllevels/{id} - Update a skill level (admin only)
    [HttpPut("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<SkillLevelDto>>> UpdateSkillLevel(int id, [FromBody] UpdateSkillLevelDto dto)
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var level = await _context.SkillLevels.FindAsync(id);
            if (level == null)
                return NotFound(new ApiResponse<SkillLevelDto> { Success = false, Message = "Skill level not found" });

            level.Name = dto.Name;
            level.Description = dto.Description;
            level.Value = dto.Value;
            level.Icon = dto.Icon;
            level.Color = dto.Color;
            level.SortOrder = dto.SortOrder;
            level.IsActive = dto.IsActive;
            level.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<SkillLevelDto>
            {
                Success = true,
                Data = new SkillLevelDto
                {
                    Id = level.Id,
                    Name = level.Name,
                    Description = level.Description,
                    Value = level.Value,
                    Icon = level.Icon,
                    Color = level.Color,
                    SortOrder = level.SortOrder,
                    IsActive = level.IsActive
                },
                Message = "Skill level updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating skill level {Id}", id);
            return StatusCode(500, new ApiResponse<SkillLevelDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /skilllevels/{id} - Delete a skill level (admin only)
    [HttpDelete("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteSkillLevel(int id)
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var level = await _context.SkillLevels.FindAsync(id);
            if (level == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Skill level not found" });

            // Soft delete
            level.IsActive = false;
            level.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Skill level deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting skill level {Id}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }
}
