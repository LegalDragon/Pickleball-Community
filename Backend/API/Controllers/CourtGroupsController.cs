using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Controllers.Base;

namespace Pickleball.Community.Controllers;

/// <summary>
/// Manages court groups for tournament scheduling.
/// Court groups allow TDs to assign related matches to nearby courts.
/// </summary>
[ApiController]
[Route("[controller]")]
public class CourtGroupsController : EventControllerBase
{
    private readonly ILogger<CourtGroupsController> _logger;

    public CourtGroupsController(ApplicationDbContext context, ILogger<CourtGroupsController> logger)
        : base(context)
    {
        _logger = logger;
    }

    /// <summary>
    /// Get all court groups for an event
    /// </summary>
    [HttpGet("event/{eventId}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetCourtGroups(int eventId)
    {
        var groups = await _context.CourtGroups
            .Where(g => g.EventId == eventId && g.IsActive)
            .OrderBy(g => g.SortOrder)
            .Select(g => new
            {
                g.Id,
                g.EventId,
                g.GroupName,
                g.GroupCode,
                g.Description,
                g.LocationArea,
                g.CourtCount,
                g.Priority,
                g.SortOrder,
                Courts = g.Courts.Where(c => c.IsActive).OrderBy(c => c.SortOrder).Select(c => new
                {
                    c.Id,
                    c.CourtLabel,
                    c.Status,
                    c.LocationDescription
                })
            })
            .ToListAsync();

        return Ok(new { success = true, data = groups });
    }

    /// <summary>
    /// Get a single court group with details
    /// </summary>
    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetCourtGroup(int id)
    {
        var group = await _context.CourtGroups
            .Include(g => g.Courts)
            .Include(g => g.DivisionAssignments)
                .ThenInclude(a => a.Division)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null)
            return NotFound(new { success = false, message = "Court group not found" });

        return Ok(new
        {
            success = true,
            data = new
            {
                group.Id,
                group.EventId,
                group.GroupName,
                group.GroupCode,
                group.Description,
                group.LocationArea,
                group.CourtCount,
                group.Priority,
                group.SortOrder,
                group.IsActive,
                Courts = group.Courts.OrderBy(c => c.SortOrder).Select(c => new
                {
                    c.Id,
                    c.CourtLabel,
                    c.Status,
                    c.LocationDescription,
                    c.SortOrder,
                    c.IsActive
                }),
                Assignments = group.DivisionAssignments.Select(a => new
                {
                    a.Id,
                    a.DivisionId,
                    DivisionName = a.Division != null ? a.Division.Name : null,
                    a.PhaseId,
                    a.Priority,
                    a.ValidFromTime,
                    a.ValidToTime
                })
            }
        });
    }

    /// <summary>
    /// Create a new court group
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreateCourtGroup([FromBody] CreateCourtGroupRequest request)
    {
        var eventEntity = await _context.Events.FindAsync(request.EventId);
        if (eventEntity == null)
            return NotFound(new { success = false, message = "Event not found" });

        if (!await CanManageEventAsync(request.EventId))
            return Forbid();

        var maxOrder = await _context.CourtGroups
            .Where(g => g.EventId == request.EventId)
            .MaxAsync(g => (int?)g.SortOrder) ?? 0;

        var group = new CourtGroup
        {
            EventId = request.EventId,
            GroupName = request.GroupName,
            GroupCode = request.GroupCode,
            Description = request.Description,
            LocationArea = request.LocationArea,
            Priority = request.Priority ?? 0,
            SortOrder = request.SortOrder ?? (maxOrder + 1)
        };

        _context.CourtGroups.Add(group);
        await _context.SaveChangesAsync();

        // Assign courts if provided
        if (request.CourtIds?.Any() == true)
        {
            var courts = await _context.TournamentCourts
                .Where(c => request.CourtIds.Contains(c.Id) && c.EventId == request.EventId)
                .ToListAsync();

            foreach (var court in courts)
            {
                court.CourtGroupId = group.Id;
            }
            group.CourtCount = courts.Count;
            await _context.SaveChangesAsync();
        }

        _logger.LogInformation("Created court group {GroupId} for event {EventId}", group.Id, request.EventId);

        return Ok(new { success = true, data = new { group.Id, group.GroupName } });
    }

    /// <summary>
    /// Update a court group
    /// </summary>
    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateCourtGroup(int id, [FromBody] UpdateCourtGroupRequest request)
    {
        var group = await _context.CourtGroups.FindAsync(id);
        if (group == null)
            return NotFound(new { success = false, message = "Court group not found" });

        if (!await CanManageEventAsync(group.EventId))
            return Forbid();

        if (!string.IsNullOrEmpty(request.GroupName)) group.GroupName = request.GroupName;
        if (request.GroupCode != null) group.GroupCode = request.GroupCode;
        if (request.Description != null) group.Description = request.Description;
        if (request.LocationArea != null) group.LocationArea = request.LocationArea;
        if (request.Priority.HasValue) group.Priority = request.Priority.Value;
        if (request.SortOrder.HasValue) group.SortOrder = request.SortOrder.Value;
        if (request.IsActive.HasValue) group.IsActive = request.IsActive.Value;

        group.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Court group updated" });
    }

    /// <summary>
    /// Delete a court group
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> DeleteCourtGroup(int id)
    {
        var group = await _context.CourtGroups
            .Include(g => g.Courts)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null)
            return NotFound(new { success = false, message = "Court group not found" });

        if (!await CanManageEventAsync(group.EventId))
            return Forbid();

        // Unassign courts
        foreach (var court in group.Courts)
        {
            court.CourtGroupId = null;
        }

        _context.CourtGroups.Remove(group);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Court group deleted" });
    }

    /// <summary>
    /// Assign courts to a group
    /// </summary>
    [HttpPost("{id}/courts")]
    [Authorize]
    public async Task<IActionResult> AssignCourts(int id, [FromBody] AssignCourtsRequest request)
    {
        var group = await _context.CourtGroups.FindAsync(id);
        if (group == null)
            return NotFound(new { success = false, message = "Court group not found" });

        if (!await CanManageEventAsync(group.EventId))
            return Forbid();

        // Remove existing courts from this group
        var existingCourts = await _context.TournamentCourts
            .Where(c => c.CourtGroupId == id)
            .ToListAsync();

        foreach (var court in existingCourts)
        {
            court.CourtGroupId = null;
        }

        // Assign new courts
        if (request.CourtIds?.Any() == true)
        {
            var courts = await _context.TournamentCourts
                .Where(c => request.CourtIds.Contains(c.Id) && c.EventId == group.EventId)
                .ToListAsync();

            foreach (var court in courts)
            {
                court.CourtGroupId = id;
            }
            group.CourtCount = courts.Count;
        }
        else
        {
            group.CourtCount = 0;
        }

        group.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = $"{group.CourtCount} courts assigned to group" });
    }

    /// <summary>
    /// Auto-create court groups based on existing courts
    /// Groups courts by location or creates one group with all courts
    /// </summary>
    [HttpPost("event/{eventId}/auto-create")]
    [Authorize]
    public async Task<IActionResult> AutoCreateGroups(int eventId, [FromQuery] int groupSize = 4)
    {
        if (!await CanManageEventAsync(eventId))
            return Forbid();

        var courts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive && c.CourtGroupId == null)
            .OrderBy(c => c.SortOrder)
            .ToListAsync();

        if (!courts.Any())
            return BadRequest(new { success = false, message = "No unassigned courts found" });

        int groupsCreated = 0;
        var currentGroup = new List<TournamentCourt>();
        int groupNumber = 1;

        foreach (var court in courts)
        {
            currentGroup.Add(court);

            if (currentGroup.Count >= groupSize)
            {
                var group = new CourtGroup
                {
                    EventId = eventId,
                    GroupName = $"Courts {currentGroup.First().CourtLabel}-{currentGroup.Last().CourtLabel}",
                    GroupCode = ((char)('A' + groupNumber - 1)).ToString(),
                    CourtCount = currentGroup.Count,
                    SortOrder = groupNumber
                };
                _context.CourtGroups.Add(group);
                await _context.SaveChangesAsync();

                foreach (var c in currentGroup)
                {
                    c.CourtGroupId = group.Id;
                }

                currentGroup.Clear();
                groupNumber++;
                groupsCreated++;
            }
        }

        // Handle remaining courts
        if (currentGroup.Any())
        {
            var group = new CourtGroup
            {
                EventId = eventId,
                GroupName = currentGroup.Count == 1
                    ? $"Court {currentGroup.First().CourtLabel}"
                    : $"Courts {currentGroup.First().CourtLabel}-{currentGroup.Last().CourtLabel}",
                GroupCode = ((char)('A' + groupNumber - 1)).ToString(),
                CourtCount = currentGroup.Count,
                SortOrder = groupNumber
            };
            _context.CourtGroups.Add(group);
            await _context.SaveChangesAsync();

            foreach (var c in currentGroup)
            {
                c.CourtGroupId = group.Id;
            }
            groupsCreated++;
        }

        await _context.SaveChangesAsync();

        return Ok(new { success = true, data = new { groupsCreated } });
    }
}

#region Request Models

public class CreateCourtGroupRequest
{
    public int EventId { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public string? GroupCode { get; set; }
    public string? Description { get; set; }
    public string? LocationArea { get; set; }
    public int? Priority { get; set; }
    public int? SortOrder { get; set; }
    public List<int>? CourtIds { get; set; }
}

public class UpdateCourtGroupRequest
{
    public string? GroupName { get; set; }
    public string? GroupCode { get; set; }
    public string? Description { get; set; }
    public string? LocationArea { get; set; }
    public int? Priority { get; set; }
    public int? SortOrder { get; set; }
    public bool? IsActive { get; set; }
}

public class AssignCourtsRequest
{
    public List<int>? CourtIds { get; set; }
}

#endregion
