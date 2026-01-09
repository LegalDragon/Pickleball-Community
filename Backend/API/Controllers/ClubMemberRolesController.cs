using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class ClubMemberRolesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ClubMemberRolesController> _logger;

    public ClubMemberRolesController(ApplicationDbContext context, ILogger<ClubMemberRolesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: /clubmemberroles - Get all roles (public - for dropdowns)
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ClubMemberRoleDto>>>> GetRoles([FromQuery] bool includeInactive = false)
    {
        try
        {
            var query = _context.ClubMemberRoles.AsQueryable();

            if (!includeInactive)
            {
                query = query.Where(r => r.IsActive);
            }

            var roles = await query
                .OrderBy(r => r.SortOrder)
                .ThenBy(r => r.Name)
                .Select(r => new ClubMemberRoleDto
                {
                    Id = r.Id,
                    Name = r.Name,
                    Description = r.Description,
                    Color = r.Color,
                    Icon = r.Icon,
                    SortOrder = r.SortOrder,
                    IsSystemRole = r.IsSystemRole,
                    CanManageMembers = r.CanManageMembers,
                    CanManageClub = r.CanManageClub,
                    CanPostAnnouncements = r.CanPostAnnouncements,
                    IsActive = r.IsActive
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<ClubMemberRoleDto>> { Success = true, Data = roles });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching club member roles");
            return StatusCode(500, new ApiResponse<List<ClubMemberRoleDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /clubmemberroles/{id} - Get single role
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<ClubMemberRoleDto>>> GetRole(int id)
    {
        try
        {
            var role = await _context.ClubMemberRoles.FindAsync(id);
            if (role == null)
                return NotFound(new ApiResponse<ClubMemberRoleDto> { Success = false, Message = "Role not found" });

            var dto = new ClubMemberRoleDto
            {
                Id = role.Id,
                Name = role.Name,
                Description = role.Description,
                Color = role.Color,
                Icon = role.Icon,
                SortOrder = role.SortOrder,
                IsSystemRole = role.IsSystemRole,
                CanManageMembers = role.CanManageMembers,
                CanManageClub = role.CanManageClub,
                CanPostAnnouncements = role.CanPostAnnouncements,
                IsActive = role.IsActive
            };

            return Ok(new ApiResponse<ClubMemberRoleDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching club member role {Id}", id);
            return StatusCode(500, new ApiResponse<ClubMemberRoleDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubmemberroles - Create new role (Admin only)
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<ClubMemberRoleDto>>> CreateRole([FromBody] CreateClubMemberRoleDto dto)
    {
        try
        {
            // Check for duplicate name
            var exists = await _context.ClubMemberRoles.AnyAsync(r => r.Name.ToLower() == dto.Name.ToLower());
            if (exists)
                return BadRequest(new ApiResponse<ClubMemberRoleDto> { Success = false, Message = "A role with this name already exists" });

            var role = new ClubMemberRole
            {
                Name = dto.Name,
                Description = dto.Description,
                Color = dto.Color,
                Icon = dto.Icon,
                SortOrder = dto.SortOrder,
                IsSystemRole = false, // New roles are never system roles
                CanManageMembers = dto.CanManageMembers,
                CanManageClub = dto.CanManageClub,
                CanPostAnnouncements = dto.CanPostAnnouncements,
                IsActive = dto.IsActive
            };

            _context.ClubMemberRoles.Add(role);
            await _context.SaveChangesAsync();

            var result = new ClubMemberRoleDto
            {
                Id = role.Id,
                Name = role.Name,
                Description = role.Description,
                Color = role.Color,
                Icon = role.Icon,
                SortOrder = role.SortOrder,
                IsSystemRole = role.IsSystemRole,
                CanManageMembers = role.CanManageMembers,
                CanManageClub = role.CanManageClub,
                CanPostAnnouncements = role.CanPostAnnouncements,
                IsActive = role.IsActive
            };

            return Ok(new ApiResponse<ClubMemberRoleDto> { Success = true, Data = result, Message = "Role created" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating club member role");
            return StatusCode(500, new ApiResponse<ClubMemberRoleDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /clubmemberroles/{id} - Update role (Admin only)
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<ClubMemberRoleDto>>> UpdateRole(int id, [FromBody] UpdateClubMemberRoleDto dto)
    {
        try
        {
            var role = await _context.ClubMemberRoles.FindAsync(id);
            if (role == null)
                return NotFound(new ApiResponse<ClubMemberRoleDto> { Success = false, Message = "Role not found" });

            // Check for duplicate name if changing
            if (dto.Name != null && dto.Name.ToLower() != role.Name.ToLower())
            {
                var exists = await _context.ClubMemberRoles.AnyAsync(r => r.Name.ToLower() == dto.Name.ToLower() && r.Id != id);
                if (exists)
                    return BadRequest(new ApiResponse<ClubMemberRoleDto> { Success = false, Message = "A role with this name already exists" });

                // Cannot rename system roles
                if (role.IsSystemRole)
                    return BadRequest(new ApiResponse<ClubMemberRoleDto> { Success = false, Message = "Cannot rename system roles" });
            }

            role.Name = dto.Name ?? role.Name;
            role.Description = dto.Description ?? role.Description;
            role.Color = dto.Color ?? role.Color;
            role.Icon = dto.Icon ?? role.Icon;
            role.SortOrder = dto.SortOrder ?? role.SortOrder;
            role.CanManageMembers = dto.CanManageMembers ?? role.CanManageMembers;
            role.CanManageClub = dto.CanManageClub ?? role.CanManageClub;
            role.CanPostAnnouncements = dto.CanPostAnnouncements ?? role.CanPostAnnouncements;
            role.IsActive = dto.IsActive ?? role.IsActive;
            role.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            var result = new ClubMemberRoleDto
            {
                Id = role.Id,
                Name = role.Name,
                Description = role.Description,
                Color = role.Color,
                Icon = role.Icon,
                SortOrder = role.SortOrder,
                IsSystemRole = role.IsSystemRole,
                CanManageMembers = role.CanManageMembers,
                CanManageClub = role.CanManageClub,
                CanPostAnnouncements = role.CanPostAnnouncements,
                IsActive = role.IsActive
            };

            return Ok(new ApiResponse<ClubMemberRoleDto> { Success = true, Data = result, Message = "Role updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating club member role {Id}", id);
            return StatusCode(500, new ApiResponse<ClubMemberRoleDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /clubmemberroles/{id} - Delete role (Admin only)
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteRole(int id)
    {
        try
        {
            var role = await _context.ClubMemberRoles.FindAsync(id);
            if (role == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Role not found" });

            // Cannot delete system roles
            if (role.IsSystemRole)
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot delete system roles (Admin, Member)" });

            // Check if role is in use
            var inUse = await _context.ClubMembers.AnyAsync(m => m.Role == role.Name);
            if (inUse)
            {
                // Soft delete - just mark as inactive
                role.IsActive = false;
                role.UpdatedAt = DateTime.Now;
                await _context.SaveChangesAsync();
                return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Role deactivated (in use by members)" });
            }

            // Hard delete if not in use
            _context.ClubMemberRoles.Remove(role);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Role deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting club member role {Id}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubmemberroles/{id}/restore - Restore deleted role (Admin only)
    [HttpPost("{id}/restore")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<ClubMemberRoleDto>>> RestoreRole(int id)
    {
        try
        {
            var role = await _context.ClubMemberRoles.FindAsync(id);
            if (role == null)
                return NotFound(new ApiResponse<ClubMemberRoleDto> { Success = false, Message = "Role not found" });

            role.IsActive = true;
            role.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            var result = new ClubMemberRoleDto
            {
                Id = role.Id,
                Name = role.Name,
                Description = role.Description,
                Color = role.Color,
                Icon = role.Icon,
                SortOrder = role.SortOrder,
                IsSystemRole = role.IsSystemRole,
                CanManageMembers = role.CanManageMembers,
                CanManageClub = role.CanManageClub,
                CanPostAnnouncements = role.CanPostAnnouncements,
                IsActive = role.IsActive
            };

            return Ok(new ApiResponse<ClubMemberRoleDto> { Success = true, Data = result, Message = "Role restored" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring club member role {Id}", id);
            return StatusCode(500, new ApiResponse<ClubMemberRoleDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /clubmemberroles/reorder - Reorder roles (Admin only)
    [HttpPut("reorder")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> ReorderRoles([FromBody] List<int> orderedIds)
    {
        try
        {
            for (int i = 0; i < orderedIds.Count; i++)
            {
                var role = await _context.ClubMemberRoles.FindAsync(orderedIds[i]);
                if (role != null)
                {
                    role.SortOrder = i;
                    role.UpdatedAt = DateTime.Now;
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Roles reordered" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reordering club member roles");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }
}
