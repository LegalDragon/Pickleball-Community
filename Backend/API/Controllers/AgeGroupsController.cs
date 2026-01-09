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
public class AgeGroupsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AgeGroupsController> _logger;

    public AgeGroupsController(ApplicationDbContext context, ILogger<AgeGroupsController> logger)
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

    // GET: /agegroups - Get all active age groups
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<AgeGroupDto>>>> GetAgeGroups()
    {
        try
        {
            var groups = await _context.AgeGroups
                .Where(a => a.IsActive)
                .OrderBy(a => a.SortOrder)
                .Select(a => new AgeGroupDto
                {
                    Id = a.Id,
                    Name = a.Name,
                    Description = a.Description,
                    MinAge = a.MinAge,
                    MaxAge = a.MaxAge,
                    Icon = a.Icon,
                    Color = a.Color,
                    SortOrder = a.SortOrder,
                    IsActive = a.IsActive
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<AgeGroupDto>> { Success = true, Data = groups });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching age groups");
            return StatusCode(500, new ApiResponse<List<AgeGroupDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /agegroups/all - Get all age groups including inactive (admin only)
    [HttpGet("all")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<AgeGroupDto>>>> GetAllAgeGroups()
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var groups = await _context.AgeGroups
                .OrderBy(a => a.SortOrder)
                .Select(a => new AgeGroupDto
                {
                    Id = a.Id,
                    Name = a.Name,
                    Description = a.Description,
                    MinAge = a.MinAge,
                    MaxAge = a.MaxAge,
                    Icon = a.Icon,
                    Color = a.Color,
                    SortOrder = a.SortOrder,
                    IsActive = a.IsActive
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<AgeGroupDto>> { Success = true, Data = groups });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching all age groups");
            return StatusCode(500, new ApiResponse<List<AgeGroupDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /agegroups/{id} - Get a specific age group
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<AgeGroupDto>>> GetAgeGroup(int id)
    {
        try
        {
            var group = await _context.AgeGroups.FindAsync(id);
            if (group == null)
                return NotFound(new ApiResponse<AgeGroupDto> { Success = false, Message = "Age group not found" });

            return Ok(new ApiResponse<AgeGroupDto>
            {
                Success = true,
                Data = new AgeGroupDto
                {
                    Id = group.Id,
                    Name = group.Name,
                    Description = group.Description,
                    MinAge = group.MinAge,
                    MaxAge = group.MaxAge,
                    Icon = group.Icon,
                    Color = group.Color,
                    SortOrder = group.SortOrder,
                    IsActive = group.IsActive
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching age group {Id}", id);
            return StatusCode(500, new ApiResponse<AgeGroupDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /agegroups - Create a new age group (admin only)
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ApiResponse<AgeGroupDto>>> CreateAgeGroup([FromBody] CreateAgeGroupDto dto)
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var group = new AgeGroup
            {
                Name = dto.Name,
                Description = dto.Description,
                MinAge = dto.MinAge,
                MaxAge = dto.MaxAge,
                Icon = dto.Icon,
                Color = dto.Color,
                SortOrder = dto.SortOrder
            };

            _context.AgeGroups.Add(group);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<AgeGroupDto>
            {
                Success = true,
                Data = new AgeGroupDto
                {
                    Id = group.Id,
                    Name = group.Name,
                    Description = group.Description,
                    MinAge = group.MinAge,
                    MaxAge = group.MaxAge,
                    Icon = group.Icon,
                    Color = group.Color,
                    SortOrder = group.SortOrder,
                    IsActive = group.IsActive
                },
                Message = "Age group created successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating age group");
            return StatusCode(500, new ApiResponse<AgeGroupDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /agegroups/{id} - Update an age group (admin only)
    [HttpPut("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<AgeGroupDto>>> UpdateAgeGroup(int id, [FromBody] UpdateAgeGroupDto dto)
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var group = await _context.AgeGroups.FindAsync(id);
            if (group == null)
                return NotFound(new ApiResponse<AgeGroupDto> { Success = false, Message = "Age group not found" });

            group.Name = dto.Name;
            group.Description = dto.Description;
            group.MinAge = dto.MinAge;
            group.MaxAge = dto.MaxAge;
            group.Icon = dto.Icon;
            group.Color = dto.Color;
            group.SortOrder = dto.SortOrder;
            group.IsActive = dto.IsActive;
            group.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<AgeGroupDto>
            {
                Success = true,
                Data = new AgeGroupDto
                {
                    Id = group.Id,
                    Name = group.Name,
                    Description = group.Description,
                    MinAge = group.MinAge,
                    MaxAge = group.MaxAge,
                    Icon = group.Icon,
                    Color = group.Color,
                    SortOrder = group.SortOrder,
                    IsActive = group.IsActive
                },
                Message = "Age group updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating age group {Id}", id);
            return StatusCode(500, new ApiResponse<AgeGroupDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /agegroups/{id} - Delete an age group (admin only)
    [HttpDelete("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteAgeGroup(int id)
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var group = await _context.AgeGroups.FindAsync(id);
            if (group == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Age group not found" });

            // Soft delete
            group.IsActive = false;
            group.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Age group deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting age group {Id}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }
}
