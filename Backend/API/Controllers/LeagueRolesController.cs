using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class LeagueRolesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<LeagueRolesController> _logger;

    public LeagueRolesController(ApplicationDbContext context, ILogger<LeagueRolesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: /leagueroles - Get all roles (public - for dropdowns)
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<LeagueRoleDto>>>> GetRoles([FromQuery] bool includeInactive = false)
    {
        try
        {
            var query = _context.LeagueRoles.AsQueryable();

            if (!includeInactive)
            {
                query = query.Where(r => r.IsActive);
            }

            var roles = await query
                .OrderBy(r => r.SortOrder)
                .ThenBy(r => r.Name)
                .Select(r => new LeagueRoleDto
                {
                    Id = r.Id,
                    Name = r.Name,
                    Description = r.Description,
                    Color = r.Color,
                    Icon = r.Icon,
                    SortOrder = r.SortOrder,
                    IsSystemRole = r.IsSystemRole,
                    CanManageLeague = r.CanManageLeague,
                    CanManageMembers = r.CanManageMembers,
                    CanManageClubs = r.CanManageClubs,
                    CanManageDocuments = r.CanManageDocuments,
                    CanApproveRequests = r.CanApproveRequests,
                    IsActive = r.IsActive
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<LeagueRoleDto>> { Success = true, Data = roles });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching league roles");
            return StatusCode(500, new ApiResponse<List<LeagueRoleDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /leagueroles/{id} - Get single role
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<LeagueRoleDto>>> GetRole(int id)
    {
        try
        {
            var role = await _context.LeagueRoles.FindAsync(id);
            if (role == null)
                return NotFound(new ApiResponse<LeagueRoleDto> { Success = false, Message = "Role not found" });

            var dto = new LeagueRoleDto
            {
                Id = role.Id,
                Name = role.Name,
                Description = role.Description,
                Color = role.Color,
                Icon = role.Icon,
                SortOrder = role.SortOrder,
                IsSystemRole = role.IsSystemRole,
                CanManageLeague = role.CanManageLeague,
                CanManageMembers = role.CanManageMembers,
                CanManageClubs = role.CanManageClubs,
                CanManageDocuments = role.CanManageDocuments,
                CanApproveRequests = role.CanApproveRequests,
                IsActive = role.IsActive
            };

            return Ok(new ApiResponse<LeagueRoleDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching league role {Id}", id);
            return StatusCode(500, new ApiResponse<LeagueRoleDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /leagueroles - Create new role (Admin only)
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<LeagueRoleDto>>> CreateRole([FromBody] CreateLeagueRoleDto dto)
    {
        try
        {
            // Check for duplicate name
            var exists = await _context.LeagueRoles.AnyAsync(r => r.Name.ToLower() == dto.Name.ToLower());
            if (exists)
                return BadRequest(new ApiResponse<LeagueRoleDto> { Success = false, Message = "A role with this name already exists" });

            var role = new LeagueRole
            {
                Name = dto.Name,
                Description = dto.Description,
                Color = dto.Color,
                Icon = dto.Icon,
                SortOrder = dto.SortOrder,
                IsSystemRole = false, // New roles are never system roles
                CanManageLeague = dto.CanManageLeague,
                CanManageMembers = dto.CanManageMembers,
                CanManageClubs = dto.CanManageClubs,
                CanManageDocuments = dto.CanManageDocuments,
                CanApproveRequests = dto.CanApproveRequests,
                IsActive = dto.IsActive
            };

            _context.LeagueRoles.Add(role);
            await _context.SaveChangesAsync();

            var result = new LeagueRoleDto
            {
                Id = role.Id,
                Name = role.Name,
                Description = role.Description,
                Color = role.Color,
                Icon = role.Icon,
                SortOrder = role.SortOrder,
                IsSystemRole = role.IsSystemRole,
                CanManageLeague = role.CanManageLeague,
                CanManageMembers = role.CanManageMembers,
                CanManageClubs = role.CanManageClubs,
                CanManageDocuments = role.CanManageDocuments,
                CanApproveRequests = role.CanApproveRequests,
                IsActive = role.IsActive
            };

            return Ok(new ApiResponse<LeagueRoleDto> { Success = true, Data = result, Message = "Role created" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating league role");
            return StatusCode(500, new ApiResponse<LeagueRoleDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /leagueroles/{id} - Update role (Admin only)
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<LeagueRoleDto>>> UpdateRole(int id, [FromBody] UpdateLeagueRoleDto dto)
    {
        try
        {
            var role = await _context.LeagueRoles.FindAsync(id);
            if (role == null)
                return NotFound(new ApiResponse<LeagueRoleDto> { Success = false, Message = "Role not found" });

            // Check for duplicate name if changing
            if (dto.Name.ToLower() != role.Name.ToLower())
            {
                var exists = await _context.LeagueRoles.AnyAsync(r => r.Name.ToLower() == dto.Name.ToLower() && r.Id != id);
                if (exists)
                    return BadRequest(new ApiResponse<LeagueRoleDto> { Success = false, Message = "A role with this name already exists" });

                // Cannot rename system roles
                if (role.IsSystemRole)
                    return BadRequest(new ApiResponse<LeagueRoleDto> { Success = false, Message = "Cannot rename system roles" });
            }

            if (!role.IsSystemRole)
            {
                role.Name = dto.Name;
            }
            role.Description = dto.Description;
            role.Color = dto.Color;
            role.Icon = dto.Icon;
            role.SortOrder = dto.SortOrder;
            role.CanManageLeague = dto.CanManageLeague;
            role.CanManageMembers = dto.CanManageMembers;
            role.CanManageClubs = dto.CanManageClubs;
            role.CanManageDocuments = dto.CanManageDocuments;
            role.CanApproveRequests = dto.CanApproveRequests;
            role.IsActive = dto.IsActive;
            role.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            var result = new LeagueRoleDto
            {
                Id = role.Id,
                Name = role.Name,
                Description = role.Description,
                Color = role.Color,
                Icon = role.Icon,
                SortOrder = role.SortOrder,
                IsSystemRole = role.IsSystemRole,
                CanManageLeague = role.CanManageLeague,
                CanManageMembers = role.CanManageMembers,
                CanManageClubs = role.CanManageClubs,
                CanManageDocuments = role.CanManageDocuments,
                CanApproveRequests = role.CanApproveRequests,
                IsActive = role.IsActive
            };

            return Ok(new ApiResponse<LeagueRoleDto> { Success = true, Data = result, Message = "Role updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating league role {Id}", id);
            return StatusCode(500, new ApiResponse<LeagueRoleDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /leagueroles/{id} - Delete role (Admin only)
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteRole(int id)
    {
        try
        {
            var role = await _context.LeagueRoles.FindAsync(id);
            if (role == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Role not found" });

            // Cannot delete system roles
            if (role.IsSystemRole)
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot delete system roles" });

            // Check if role is in use
            var inUse = await _context.LeagueManagers.AnyAsync(m => m.Role == role.Name);
            if (inUse)
            {
                // Soft delete - just mark as inactive
                role.IsActive = false;
                role.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Role deactivated (in use by managers)" });
            }

            // Hard delete if not in use
            _context.LeagueRoles.Remove(role);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Role deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting league role {Id}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /leagueroles/{id}/restore - Restore deleted role (Admin only)
    [HttpPost("{id}/restore")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<LeagueRoleDto>>> RestoreRole(int id)
    {
        try
        {
            var role = await _context.LeagueRoles.FindAsync(id);
            if (role == null)
                return NotFound(new ApiResponse<LeagueRoleDto> { Success = false, Message = "Role not found" });

            role.IsActive = true;
            role.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var result = new LeagueRoleDto
            {
                Id = role.Id,
                Name = role.Name,
                Description = role.Description,
                Color = role.Color,
                Icon = role.Icon,
                SortOrder = role.SortOrder,
                IsSystemRole = role.IsSystemRole,
                CanManageLeague = role.CanManageLeague,
                CanManageMembers = role.CanManageMembers,
                CanManageClubs = role.CanManageClubs,
                CanManageDocuments = role.CanManageDocuments,
                CanApproveRequests = role.CanApproveRequests,
                IsActive = role.IsActive
            };

            return Ok(new ApiResponse<LeagueRoleDto> { Success = true, Data = result, Message = "Role restored" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring league role {Id}", id);
            return StatusCode(500, new ApiResponse<LeagueRoleDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /leagueroles/reorder - Reorder roles (Admin only)
    [HttpPut("reorder")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> ReorderRoles([FromBody] List<int> orderedIds)
    {
        try
        {
            for (int i = 0; i < orderedIds.Count; i++)
            {
                var role = await _context.LeagueRoles.FindAsync(orderedIds[i]);
                if (role != null)
                {
                    role.SortOrder = (i + 1) * 10;
                    role.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Roles reordered" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reordering league roles");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }
}
