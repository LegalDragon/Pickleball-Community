using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class EventTypesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<EventTypesController> _logger;

    public EventTypesController(ApplicationDbContext context, ILogger<EventTypesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: /eventtypes - Get all event types (public - for dropdowns)
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<EventTypeDto>>>> GetEventTypes([FromQuery] bool includeInactive = false)
    {
        try
        {
            var query = _context.EventTypes.AsQueryable();

            if (!includeInactive)
            {
                query = query.Where(et => et.IsActive);
            }

            var eventTypes = await query
                .OrderBy(et => et.SortOrder)
                .ThenBy(et => et.Name)
                .Select(et => new EventTypeDto
                {
                    Id = et.Id,
                    Name = et.Name,
                    Description = et.Description,
                    Icon = et.Icon,
                    Color = et.Color,
                    AllowMultipleDivisions = et.AllowMultipleDivisions,
                    SortOrder = et.SortOrder,
                    IsActive = et.IsActive
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<EventTypeDto>> { Success = true, Data = eventTypes });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching event types");
            return StatusCode(500, new ApiResponse<List<EventTypeDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /eventtypes/{id} - Get single event type
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<EventTypeDto>>> GetEventType(int id)
    {
        try
        {
            var eventType = await _context.EventTypes.FindAsync(id);
            if (eventType == null)
                return NotFound(new ApiResponse<EventTypeDto> { Success = false, Message = "Event type not found" });

            var dto = new EventTypeDto
            {
                Id = eventType.Id,
                Name = eventType.Name,
                Description = eventType.Description,
                Icon = eventType.Icon,
                Color = eventType.Color,
                AllowMultipleDivisions = eventType.AllowMultipleDivisions,
                SortOrder = eventType.SortOrder,
                IsActive = eventType.IsActive
            };

            return Ok(new ApiResponse<EventTypeDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching event type {Id}", id);
            return StatusCode(500, new ApiResponse<EventTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /eventtypes - Create new event type (Admin only)
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<EventTypeDto>>> CreateEventType([FromBody] CreateEventTypeDto dto)
    {
        try
        {
            // Check for duplicate name
            var exists = await _context.EventTypes.AnyAsync(et => et.Name.ToLower() == dto.Name.ToLower());
            if (exists)
                return BadRequest(new ApiResponse<EventTypeDto> { Success = false, Message = "An event type with this name already exists" });

            var eventType = new EventType
            {
                Name = dto.Name,
                Description = dto.Description,
                Icon = dto.Icon,
                Color = dto.Color,
                AllowMultipleDivisions = dto.AllowMultipleDivisions,
                SortOrder = dto.SortOrder,
                IsActive = dto.IsActive
            };

            _context.EventTypes.Add(eventType);
            await _context.SaveChangesAsync();

            var result = new EventTypeDto
            {
                Id = eventType.Id,
                Name = eventType.Name,
                Description = eventType.Description,
                Icon = eventType.Icon,
                Color = eventType.Color,
                AllowMultipleDivisions = eventType.AllowMultipleDivisions,
                SortOrder = eventType.SortOrder,
                IsActive = eventType.IsActive
            };

            return Ok(new ApiResponse<EventTypeDto> { Success = true, Data = result, Message = "Event type created" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating event type");
            return StatusCode(500, new ApiResponse<EventTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /eventtypes/{id} - Update event type (Admin only)
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<EventTypeDto>>> UpdateEventType(int id, [FromBody] UpdateEventTypeDto dto)
    {
        try
        {
            var eventType = await _context.EventTypes.FindAsync(id);
            if (eventType == null)
                return NotFound(new ApiResponse<EventTypeDto> { Success = false, Message = "Event type not found" });

            // Check for duplicate name if changing
            if (dto.Name != null && dto.Name.ToLower() != eventType.Name.ToLower())
            {
                var exists = await _context.EventTypes.AnyAsync(et => et.Name.ToLower() == dto.Name.ToLower() && et.Id != id);
                if (exists)
                    return BadRequest(new ApiResponse<EventTypeDto> { Success = false, Message = "An event type with this name already exists" });
            }

            eventType.Name = dto.Name ?? eventType.Name;
            eventType.Description = dto.Description ?? eventType.Description;
            eventType.Icon = dto.Icon ?? eventType.Icon;
            eventType.Color = dto.Color ?? eventType.Color;
            eventType.AllowMultipleDivisions = dto.AllowMultipleDivisions ?? eventType.AllowMultipleDivisions;
            eventType.SortOrder = dto.SortOrder ?? eventType.SortOrder;
            eventType.IsActive = dto.IsActive ?? eventType.IsActive;
            eventType.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            var result = new EventTypeDto
            {
                Id = eventType.Id,
                Name = eventType.Name,
                Description = eventType.Description,
                Icon = eventType.Icon,
                Color = eventType.Color,
                AllowMultipleDivisions = eventType.AllowMultipleDivisions,
                SortOrder = eventType.SortOrder,
                IsActive = eventType.IsActive
            };

            return Ok(new ApiResponse<EventTypeDto> { Success = true, Data = result, Message = "Event type updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating event type {Id}", id);
            return StatusCode(500, new ApiResponse<EventTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /eventtypes/{id} - Delete event type (Admin only)
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteEventType(int id)
    {
        try
        {
            var eventType = await _context.EventTypes.FindAsync(id);
            if (eventType == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Event type not found" });

            // Soft delete - just mark as inactive
            eventType.IsActive = false;
            eventType.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Event type deactivated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting event type {Id}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /eventtypes/{id}/restore - Restore deleted event type (Admin only)
    [HttpPost("{id}/restore")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<EventTypeDto>>> RestoreEventType(int id)
    {
        try
        {
            var eventType = await _context.EventTypes.FindAsync(id);
            if (eventType == null)
                return NotFound(new ApiResponse<EventTypeDto> { Success = false, Message = "Event type not found" });

            eventType.IsActive = true;
            eventType.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            var result = new EventTypeDto
            {
                Id = eventType.Id,
                Name = eventType.Name,
                Description = eventType.Description,
                Icon = eventType.Icon,
                Color = eventType.Color,
                AllowMultipleDivisions = eventType.AllowMultipleDivisions,
                SortOrder = eventType.SortOrder,
                IsActive = eventType.IsActive
            };

            return Ok(new ApiResponse<EventTypeDto> { Success = true, Data = result, Message = "Event type restored" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring event type {Id}", id);
            return StatusCode(500, new ApiResponse<EventTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /eventtypes/reorder - Reorder event types (Admin only)
    [HttpPut("reorder")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> ReorderEventTypes([FromBody] List<int> orderedIds)
    {
        try
        {
            for (int i = 0; i < orderedIds.Count; i++)
            {
                var eventType = await _context.EventTypes.FindAsync(orderedIds[i]);
                if (eventType != null)
                {
                    eventType.SortOrder = i;
                    eventType.UpdatedAt = DateTime.Now;
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Event types reordered" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reordering event types");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }
}
