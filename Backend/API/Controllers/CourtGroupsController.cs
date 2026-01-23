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
/// Courts can belong to multiple groups (many-to-many).
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
                Courts = g.CourtGroupCourts
                    .Where(cgc => cgc.Court != null && cgc.Court.IsActive)
                    .OrderBy(cgc => cgc.SortOrder)
                    .Select(cgc => new
                    {
                        cgc.Court!.Id,
                        cgc.Court.CourtLabel,
                        cgc.Court.Status,
                        cgc.Court.LocationDescription
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
            .Include(g => g.CourtGroupCourts)
                .ThenInclude(cgc => cgc.Court)
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
                Courts = group.CourtGroupCourts
                    .Where(cgc => cgc.Court != null)
                    .OrderBy(cgc => cgc.SortOrder)
                    .Select(cgc => new
                    {
                        cgc.Court!.Id,
                        cgc.Court.CourtLabel,
                        cgc.Court.Status,
                        cgc.Court.LocationDescription,
                        cgc.Court.SortOrder,
                        cgc.Court.IsActive
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

        // Assign courts if provided (many-to-many)
        if (request.CourtIds?.Any() == true)
        {
            var courts = await _context.TournamentCourts
                .Where(c => request.CourtIds.Contains(c.Id) && c.EventId == request.EventId)
                .ToListAsync();

            int sortOrder = 0;
            foreach (var court in courts)
            {
                _context.CourtGroupCourts.Add(new CourtGroupCourt
                {
                    CourtGroupId = group.Id,
                    TournamentCourtId = court.Id,
                    SortOrder = sortOrder++
                });
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
            .Include(g => g.CourtGroupCourts)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null)
            return NotFound(new { success = false, message = "Court group not found" });

        if (!await CanManageEventAsync(group.EventId))
            return Forbid();

        // Manually delete junction table entries (no cascade due to SQL Server limitation)
        if (group.CourtGroupCourts?.Any() == true)
        {
            _context.CourtGroupCourts.RemoveRange(group.CourtGroupCourts);
        }

        _context.CourtGroups.Remove(group);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Court group deleted" });
    }

    /// <summary>
    /// Assign courts to a group (additive - courts can belong to multiple groups)
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

        // Get existing court IDs in this group
        var existingCourtIds = await _context.CourtGroupCourts
            .Where(cgc => cgc.CourtGroupId == id)
            .Select(cgc => cgc.TournamentCourtId)
            .ToListAsync();

        var requestedCourtIds = request.CourtIds ?? new List<int>();
        var existingSet = new HashSet<int>(existingCourtIds);
        var requestedSet = new HashSet<int>(requestedCourtIds);

        // Remove courts that are no longer in the list
        var courtsToRemove = existingCourtIds.Where(cId => !requestedSet.Contains(cId)).ToList();
        if (courtsToRemove.Any())
        {
            var removeEntries = await _context.CourtGroupCourts
                .Where(cgc => cgc.CourtGroupId == id && courtsToRemove.Contains(cgc.TournamentCourtId))
                .ToListAsync();
            _context.CourtGroupCourts.RemoveRange(removeEntries);
        }

        // Add new courts
        var courtsToAdd = requestedCourtIds.Where(cId => !existingSet.Contains(cId)).ToList();
        if (courtsToAdd.Any())
        {
            // Validate courts exist and belong to this event
            var validCourtIds = await _context.TournamentCourts
                .Where(c => c.EventId == group.EventId && courtsToAdd.Contains(c.Id))
                .Select(c => c.Id)
                .ToListAsync();

            int sortOrder = existingCourtIds.Count;
            foreach (var courtId in validCourtIds)
            {
                _context.CourtGroupCourts.Add(new CourtGroupCourt
                {
                    CourtGroupId = id,
                    TournamentCourtId = courtId,
                    SortOrder = sortOrder++
                });
            }
        }

        group.CourtCount = requestedCourtIds.Count;
        group.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = $"{group.CourtCount} courts assigned to group" });
    }

    /// <summary>
    /// Add a single court to a group (court can already be in other groups)
    /// </summary>
    [HttpPost("{id}/courts/{courtId}")]
    [Authorize]
    public async Task<IActionResult> AddCourtToGroup(int id, int courtId)
    {
        var group = await _context.CourtGroups.FindAsync(id);
        if (group == null)
            return NotFound(new { success = false, message = "Court group not found" });

        if (!await CanManageEventAsync(group.EventId))
            return Forbid();

        var court = await _context.TournamentCourts.FindAsync(courtId);
        if (court == null || court.EventId != group.EventId)
            return NotFound(new { success = false, message = "Court not found" });

        // Check if already in group
        var exists = await _context.CourtGroupCourts
            .AnyAsync(cgc => cgc.CourtGroupId == id && cgc.TournamentCourtId == courtId);

        if (exists)
            return Ok(new { success = true, message = "Court already in group" });

        var maxSortOrder = await _context.CourtGroupCourts
            .Where(cgc => cgc.CourtGroupId == id)
            .MaxAsync(cgc => (int?)cgc.SortOrder) ?? -1;

        _context.CourtGroupCourts.Add(new CourtGroupCourt
        {
            CourtGroupId = id,
            TournamentCourtId = courtId,
            SortOrder = maxSortOrder + 1
        });

        group.CourtCount++;
        group.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Court added to group" });
    }

    /// <summary>
    /// Remove a single court from a group
    /// </summary>
    [HttpDelete("{id}/courts/{courtId}")]
    [Authorize]
    public async Task<IActionResult> RemoveCourtFromGroup(int id, int courtId)
    {
        var group = await _context.CourtGroups.FindAsync(id);
        if (group == null)
            return NotFound(new { success = false, message = "Court group not found" });

        if (!await CanManageEventAsync(group.EventId))
            return Forbid();

        var entry = await _context.CourtGroupCourts
            .FirstOrDefaultAsync(cgc => cgc.CourtGroupId == id && cgc.TournamentCourtId == courtId);

        if (entry == null)
            return Ok(new { success = true, message = "Court not in group" });

        _context.CourtGroupCourts.Remove(entry);
        group.CourtCount = Math.Max(0, group.CourtCount - 1);
        group.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Court removed from group" });
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

        // Get courts not in any group
        var courtsInGroups = await _context.CourtGroupCourts
            .Where(cgc => cgc.Court != null && cgc.Court.EventId == eventId)
            .Select(cgc => cgc.TournamentCourtId)
            .Distinct()
            .ToListAsync();

        var courtsInGroupsSet = new HashSet<int>(courtsInGroups);

        var courts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ToListAsync();

        var unassignedCourts = courts.Where(c => !courtsInGroupsSet.Contains(c.Id)).ToList();

        if (!unassignedCourts.Any())
            return BadRequest(new { success = false, message = "No unassigned courts found" });

        int groupsCreated = 0;
        var currentGroup = new List<TournamentCourt>();
        int groupNumber = 1;

        foreach (var court in unassignedCourts)
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

                int sortOrder = 0;
                foreach (var c in currentGroup)
                {
                    _context.CourtGroupCourts.Add(new CourtGroupCourt
                    {
                        CourtGroupId = group.Id,
                        TournamentCourtId = c.Id,
                        SortOrder = sortOrder++
                    });
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

            int sortOrder = 0;
            foreach (var c in currentGroup)
            {
                _context.CourtGroupCourts.Add(new CourtGroupCourt
                {
                    CourtGroupId = group.Id,
                    TournamentCourtId = c.Id,
                    SortOrder = sortOrder++
                });
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
