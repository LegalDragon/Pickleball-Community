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
public class TeamUnitsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TeamUnitsController> _logger;

    public TeamUnitsController(ApplicationDbContext context, ILogger<TeamUnitsController> logger)
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
        return user?.Role == UserRole.Admin;
    }

    // GET: /teamunits - Get all active team units
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<TeamUnitDto>>>> GetTeamUnits()
    {
        try
        {
            var units = await _context.TeamUnits
                .Where(u => u.IsActive)
                .OrderBy(u => u.SortOrder)
                .Select(u => new TeamUnitDto
                {
                    Id = u.Id,
                    Name = u.Name,
                    Description = u.Description,
                    MaleCount = u.MaleCount,
                    FemaleCount = u.FemaleCount,
                    UnisexCount = u.UnisexCount,
                    TotalPlayers = u.MaleCount + u.FemaleCount + u.UnisexCount,
                    Icon = u.Icon,
                    Color = u.Color,
                    SortOrder = u.SortOrder,
                    IsActive = u.IsActive
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<TeamUnitDto>> { Success = true, Data = units });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching team units");
            return StatusCode(500, new ApiResponse<List<TeamUnitDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /teamunits/all - Get all team units including inactive (admin only)
    [HttpGet("all")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<TeamUnitDto>>>> GetAllTeamUnits()
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var units = await _context.TeamUnits
                .OrderBy(u => u.SortOrder)
                .Select(u => new TeamUnitDto
                {
                    Id = u.Id,
                    Name = u.Name,
                    Description = u.Description,
                    MaleCount = u.MaleCount,
                    FemaleCount = u.FemaleCount,
                    UnisexCount = u.UnisexCount,
                    TotalPlayers = u.MaleCount + u.FemaleCount + u.UnisexCount,
                    Icon = u.Icon,
                    Color = u.Color,
                    SortOrder = u.SortOrder,
                    IsActive = u.IsActive
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<TeamUnitDto>> { Success = true, Data = units });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching all team units");
            return StatusCode(500, new ApiResponse<List<TeamUnitDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /teamunits/{id} - Get a specific team unit
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<TeamUnitDto>>> GetTeamUnit(int id)
    {
        try
        {
            var unit = await _context.TeamUnits.FindAsync(id);
            if (unit == null)
                return NotFound(new ApiResponse<TeamUnitDto> { Success = false, Message = "Team unit not found" });

            return Ok(new ApiResponse<TeamUnitDto>
            {
                Success = true,
                Data = new TeamUnitDto
                {
                    Id = unit.Id,
                    Name = unit.Name,
                    Description = unit.Description,
                    MaleCount = unit.MaleCount,
                    FemaleCount = unit.FemaleCount,
                    UnisexCount = unit.UnisexCount,
                    TotalPlayers = unit.MaleCount + unit.FemaleCount + unit.UnisexCount,
                    Icon = unit.Icon,
                    Color = unit.Color,
                    SortOrder = unit.SortOrder,
                    IsActive = unit.IsActive
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching team unit {Id}", id);
            return StatusCode(500, new ApiResponse<TeamUnitDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /teamunits - Create a new team unit (admin only)
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ApiResponse<TeamUnitDto>>> CreateTeamUnit([FromBody] CreateTeamUnitDto dto)
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var unit = new TeamUnit
            {
                Name = dto.Name,
                Description = dto.Description,
                MaleCount = dto.MaleCount,
                FemaleCount = dto.FemaleCount,
                UnisexCount = dto.UnisexCount,
                Icon = dto.Icon,
                Color = dto.Color,
                SortOrder = dto.SortOrder
            };

            _context.TeamUnits.Add(unit);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<TeamUnitDto>
            {
                Success = true,
                Data = new TeamUnitDto
                {
                    Id = unit.Id,
                    Name = unit.Name,
                    Description = unit.Description,
                    MaleCount = unit.MaleCount,
                    FemaleCount = unit.FemaleCount,
                    UnisexCount = unit.UnisexCount,
                    TotalPlayers = unit.MaleCount + unit.FemaleCount + unit.UnisexCount,
                    Icon = unit.Icon,
                    Color = unit.Color,
                    SortOrder = unit.SortOrder,
                    IsActive = unit.IsActive
                },
                Message = "Team unit created successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating team unit");
            return StatusCode(500, new ApiResponse<TeamUnitDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /teamunits/{id} - Update a team unit (admin only)
    [HttpPut("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<TeamUnitDto>>> UpdateTeamUnit(int id, [FromBody] UpdateTeamUnitDto dto)
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var unit = await _context.TeamUnits.FindAsync(id);
            if (unit == null)
                return NotFound(new ApiResponse<TeamUnitDto> { Success = false, Message = "Team unit not found" });

            unit.Name = dto.Name;
            unit.Description = dto.Description;
            unit.MaleCount = dto.MaleCount;
            unit.FemaleCount = dto.FemaleCount;
            unit.UnisexCount = dto.UnisexCount;
            unit.Icon = dto.Icon;
            unit.Color = dto.Color;
            unit.SortOrder = dto.SortOrder;
            unit.IsActive = dto.IsActive;
            unit.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<TeamUnitDto>
            {
                Success = true,
                Data = new TeamUnitDto
                {
                    Id = unit.Id,
                    Name = unit.Name,
                    Description = unit.Description,
                    MaleCount = unit.MaleCount,
                    FemaleCount = unit.FemaleCount,
                    UnisexCount = unit.UnisexCount,
                    TotalPlayers = unit.MaleCount + unit.FemaleCount + unit.UnisexCount,
                    Icon = unit.Icon,
                    Color = unit.Color,
                    SortOrder = unit.SortOrder,
                    IsActive = unit.IsActive
                },
                Message = "Team unit updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating team unit {Id}", id);
            return StatusCode(500, new ApiResponse<TeamUnitDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /teamunits/{id} - Delete a team unit (admin only)
    [HttpDelete("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteTeamUnit(int id)
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var unit = await _context.TeamUnits.FindAsync(id);
            if (unit == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Team unit not found" });

            // Soft delete
            unit.IsActive = false;
            unit.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Team unit deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting team unit {Id}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }
}
