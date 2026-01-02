using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class VenueTypesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<VenueTypesController> _logger;

    public VenueTypesController(ApplicationDbContext context, ILogger<VenueTypesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: /venuetypes - Get all venue types (public - for dropdowns)
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<VenueTypeDto>>>> GetVenueTypes([FromQuery] bool includeInactive = false)
    {
        try
        {
            var query = _context.VenueTypes.AsQueryable();

            if (!includeInactive)
            {
                query = query.Where(vt => vt.IsActive);
            }

            var venueTypes = await query
                .OrderBy(vt => vt.SortOrder)
                .ThenBy(vt => vt.Name)
                .Select(vt => new VenueTypeDto
                {
                    Id = vt.Id,
                    Name = vt.Name,
                    Description = vt.Description,
                    Icon = vt.Icon,
                    Color = vt.Color,
                    SortOrder = vt.SortOrder,
                    IsActive = vt.IsActive
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<VenueTypeDto>> { Success = true, Data = venueTypes });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching venue types");
            return StatusCode(500, new ApiResponse<List<VenueTypeDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /venuetypes/{id} - Get single venue type
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<VenueTypeDto>>> GetVenueType(int id)
    {
        try
        {
            var venueType = await _context.VenueTypes.FindAsync(id);
            if (venueType == null)
                return NotFound(new ApiResponse<VenueTypeDto> { Success = false, Message = "Venue type not found" });

            var dto = new VenueTypeDto
            {
                Id = venueType.Id,
                Name = venueType.Name,
                Description = venueType.Description,
                Icon = venueType.Icon,
                Color = venueType.Color,
                SortOrder = venueType.SortOrder,
                IsActive = venueType.IsActive
            };

            return Ok(new ApiResponse<VenueTypeDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching venue type {Id}", id);
            return StatusCode(500, new ApiResponse<VenueTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /venuetypes - Create new venue type (Admin only)
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<VenueTypeDto>>> CreateVenueType([FromBody] CreateVenueTypeDto dto)
    {
        try
        {
            // Check for duplicate name
            var exists = await _context.VenueTypes.AnyAsync(vt => vt.Name.ToLower() == dto.Name.ToLower());
            if (exists)
                return BadRequest(new ApiResponse<VenueTypeDto> { Success = false, Message = "A venue type with this name already exists" });

            var venueType = new VenueType
            {
                Name = dto.Name,
                Description = dto.Description,
                Icon = dto.Icon,
                Color = dto.Color,
                SortOrder = dto.SortOrder,
                IsActive = dto.IsActive
            };

            _context.VenueTypes.Add(venueType);
            await _context.SaveChangesAsync();

            var result = new VenueTypeDto
            {
                Id = venueType.Id,
                Name = venueType.Name,
                Description = venueType.Description,
                Icon = venueType.Icon,
                Color = venueType.Color,
                SortOrder = venueType.SortOrder,
                IsActive = venueType.IsActive
            };

            return Ok(new ApiResponse<VenueTypeDto> { Success = true, Data = result, Message = "Venue type created" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating venue type");
            return StatusCode(500, new ApiResponse<VenueTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /venuetypes/{id} - Update venue type (Admin only)
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<VenueTypeDto>>> UpdateVenueType(int id, [FromBody] UpdateVenueTypeDto dto)
    {
        try
        {
            var venueType = await _context.VenueTypes.FindAsync(id);
            if (venueType == null)
                return NotFound(new ApiResponse<VenueTypeDto> { Success = false, Message = "Venue type not found" });

            // Check for duplicate name if changing
            if (dto.Name != null && dto.Name.ToLower() != venueType.Name.ToLower())
            {
                var exists = await _context.VenueTypes.AnyAsync(vt => vt.Name.ToLower() == dto.Name.ToLower() && vt.Id != id);
                if (exists)
                    return BadRequest(new ApiResponse<VenueTypeDto> { Success = false, Message = "A venue type with this name already exists" });
            }

            venueType.Name = dto.Name ?? venueType.Name;
            venueType.Description = dto.Description ?? venueType.Description;
            venueType.Icon = dto.Icon ?? venueType.Icon;
            venueType.Color = dto.Color ?? venueType.Color;
            venueType.SortOrder = dto.SortOrder ?? venueType.SortOrder;
            venueType.IsActive = dto.IsActive ?? venueType.IsActive;
            venueType.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            var result = new VenueTypeDto
            {
                Id = venueType.Id,
                Name = venueType.Name,
                Description = venueType.Description,
                Icon = venueType.Icon,
                Color = venueType.Color,
                SortOrder = venueType.SortOrder,
                IsActive = venueType.IsActive
            };

            return Ok(new ApiResponse<VenueTypeDto> { Success = true, Data = result, Message = "Venue type updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating venue type {Id}", id);
            return StatusCode(500, new ApiResponse<VenueTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /venuetypes/{id} - Delete venue type (Admin only)
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteVenueType(int id)
    {
        try
        {
            var venueType = await _context.VenueTypes.FindAsync(id);
            if (venueType == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Venue type not found" });

            // Soft delete - just mark as inactive
            venueType.IsActive = false;
            venueType.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Venue type deactivated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting venue type {Id}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /venuetypes/{id}/restore - Restore deleted venue type (Admin only)
    [HttpPost("{id}/restore")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<VenueTypeDto>>> RestoreVenueType(int id)
    {
        try
        {
            var venueType = await _context.VenueTypes.FindAsync(id);
            if (venueType == null)
                return NotFound(new ApiResponse<VenueTypeDto> { Success = false, Message = "Venue type not found" });

            venueType.IsActive = true;
            venueType.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var result = new VenueTypeDto
            {
                Id = venueType.Id,
                Name = venueType.Name,
                Description = venueType.Description,
                Icon = venueType.Icon,
                Color = venueType.Color,
                SortOrder = venueType.SortOrder,
                IsActive = venueType.IsActive
            };

            return Ok(new ApiResponse<VenueTypeDto> { Success = true, Data = result, Message = "Venue type restored" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring venue type {Id}", id);
            return StatusCode(500, new ApiResponse<VenueTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /venuetypes/reorder - Reorder venue types (Admin only)
    [HttpPut("reorder")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> ReorderVenueTypes([FromBody] List<int> orderedIds)
    {
        try
        {
            for (int i = 0; i < orderedIds.Count; i++)
            {
                var venueType = await _context.VenueTypes.FindAsync(orderedIds[i]);
                if (venueType != null)
                {
                    venueType.SortOrder = i;
                    venueType.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Venue types reordered" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reordering venue types");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }
}
