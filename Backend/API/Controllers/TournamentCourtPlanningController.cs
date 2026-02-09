using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Services;
using Pickleball.Community.Controllers.Base;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("tournament")]
public class TournamentCourtPlanningController : EventControllerBase
{
    private readonly ILogger<TournamentCourtPlanningController> _logger;
    private readonly ICourtAssignmentService _courtAssignmentService;

    public TournamentCourtPlanningController(
        ApplicationDbContext context,
        ILogger<TournamentCourtPlanningController> logger,
        ICourtAssignmentService courtAssignmentService)
        : base(context)
    {
        _logger = logger;
        _courtAssignmentService = courtAssignmentService;
    }

    // ============================================
    // Court Planning (Dedicated Court Pre-Assignment)
    // ============================================

    /// <summary>
    /// Get complete court planning data for an event
    /// Includes all divisions, encounters, courts, and court groups
    /// </summary>
    [Authorize]
    [HttpGet("court-planning/{eventId}")]
    public async Task<ActionResult<ApiResponse<CourtPlanningDto>>> GetCourtPlanningData(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<CourtPlanningDto> { Success = false, Message = "Unauthorized" });

        if (!await IsAdminAsync() && !await IsEventOrganizerAsync(eventId, userId.Value))
            return Forbid();

        var evt = await _context.Events
            .Include(e => e.Divisions)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new ApiResponse<CourtPlanningDto> { Success = false, Message = "Event not found" });

        // Get court groups with their courts (via junction table)
        var courtGroups = await _context.CourtGroups
            .Where(g => g.EventId == eventId && g.IsActive)
            .OrderBy(g => g.SortOrder)
            .Select(g => new CourtGroupPlanningDto
            {
                Id = g.Id,
                GroupName = g.GroupName,
                GroupCode = g.GroupCode,
                LocationArea = g.LocationArea,
                CourtCount = g.CourtCount,
                Priority = g.Priority,
                SortOrder = g.SortOrder,
                Courts = g.CourtGroupCourts
                    .Where(cgc => cgc.Court != null && cgc.Court.IsActive)
                    .OrderBy(cgc => cgc.SortOrder)
                    .Select(cgc => new CourtPlanningItemDto
                    {
                        Id = cgc.Court!.Id,
                        CourtLabel = cgc.Court.CourtLabel,
                        Status = cgc.Court.Status,
                        LocationDescription = cgc.Court.LocationDescription,
                        SortOrder = cgc.Court.SortOrder
                    }).ToList()
            })
            .ToListAsync();

        // Get unassigned courts (not in any court group via junction table)
        var unassignedCourts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive && !c.CourtGroupCourts.Any())
            .OrderBy(c => c.SortOrder)
            .Select(c => new CourtPlanningItemDto
            {
                Id = c.Id,
                CourtLabel = c.CourtLabel,
                Status = c.Status,
                LocationDescription = c.LocationDescription,
                SortOrder = c.SortOrder
            })
            .ToListAsync();

        // Get divisions with their court assignments and phases
        var divisions = await _context.EventDivisions
            .Where(d => d.EventId == eventId)
            .OrderBy(d => d.SortOrder)
            .Select(d => new DivisionPlanningDto
            {
                Id = d.Id,
                Name = d.Name,
                BracketType = d.BracketType,
                UnitCount = d.Units.Count(u => u.Status != "Cancelled"),
                EncounterCount = _context.EventEncounters.Count(e => e.DivisionId == d.Id),
                EstimatedMatchDurationMinutes = d.EstimatedMatchDurationMinutes,
                MatchesPerEncounter = d.MatchesPerEncounter,
                SchedulePublishedAt = d.SchedulePublishedAt,
                AssignedCourtGroups = _context.DivisionCourtAssignments
                    .Where(a => a.DivisionId == d.Id && a.IsActive)
                    .OrderBy(a => a.Priority)
                    .Select(a => new DivisionCourtGroupAssignmentDto
                    {
                        Id = a.Id,
                        CourtGroupId = a.CourtGroupId,
                        CourtGroupName = a.CourtGroup!.GroupName,
                        Priority = a.Priority,
                        ValidFromTime = a.ValidFromTime,
                        ValidToTime = a.ValidToTime,
                        AssignmentMode = a.AssignmentMode,
                        PoolName = a.PoolName,
                        MatchFormatId = a.MatchFormatId,
                        MatchFormatName = a.MatchFormat != null ? a.MatchFormat.Name : null
                    }).ToList(),
                Phases = _context.DivisionPhases
                    .Where(p => p.DivisionId == d.Id)
                    .OrderBy(p => p.PhaseOrder)
                    .Select(p => new DivisionPhasePlanningDto
                    {
                        Id = p.Id,
                        Name = p.Name,
                        PhaseType = p.PhaseType,
                        SortOrder = p.PhaseOrder,
                        EncounterCount = _context.EventEncounters.Count(e => e.PhaseId == p.Id),
                        EstimatedStartTime = p.StartTime,
                        EstimatedEndTime = p.EstimatedEndTime
                    }).ToList()
            })
            .ToListAsync();

        // Get all encounters grouped by division
        var encounters = await _context.EventEncounters
            .Where(e => e.EventId == eventId)
            .OrderBy(e => e.DivisionId)
            .ThenBy(e => e.ScheduledTime ?? e.EstimatedStartTime ?? DateTime.MaxValue)
            .ThenBy(e => e.RoundNumber)
            .ThenBy(e => e.EncounterNumber)
            .Select(e => new EncounterPlanningDto
            {
                Id = e.Id,
                DivisionId = e.DivisionId,
                DivisionName = e.Division!.Name,
                PhaseId = e.PhaseId,
                PhaseName = e.Phase != null ? e.Phase.Name : null,
                RoundType = e.RoundType,
                RoundNumber = e.RoundNumber,
                RoundName = e.RoundName,
                EncounterNumber = e.EncounterNumber,
                EncounterLabel = e.EncounterLabel,
                Unit1Id = e.Unit1Id,
                Unit1Name = e.Unit1 != null ? e.Unit1.Name : e.Unit1SeedLabel,
                Unit2Id = e.Unit2Id,
                Unit2Name = e.Unit2 != null ? e.Unit2.Name : e.Unit2SeedLabel,
                Status = e.Status,
                CourtId = e.TournamentCourtId,
                CourtLabel = e.TournamentCourt != null ? e.TournamentCourt.CourtLabel : null,
                CourtGroupId = e.TournamentCourt != null && e.TournamentCourt.CourtGroupCourts.Any() ? e.TournamentCourt.CourtGroupCourts.First().CourtGroupId : (int?)null,
                ScheduledTime = e.ScheduledTime,
                EstimatedStartTime = e.EstimatedStartTime,
                EstimatedEndTime = e.EstimatedEndTime,
                EstimatedDurationMinutes = e.EstimatedDurationMinutes ?? e.Division!.EstimatedMatchDurationMinutes,
                IsBye = e.Status == "Bye" || (e.Unit1Id == null && e.Unit2Id == null && e.Unit1SeedLabel == "BYE")
            })
            .ToListAsync();

        return Ok(new ApiResponse<CourtPlanningDto>
        {
            Success = true,
            Data = new CourtPlanningDto
            {
                EventId = eventId,
                EventName = evt.Name,
                EventStartDate = evt.StartDate,
                EventEndDate = evt.EndDate,
                SchedulePublishedAt = evt.SchedulePublishedAt,
                ScheduleConflictCount = evt.ScheduleConflictCount,
                ScheduleValidatedAt = evt.ScheduleValidatedAt,
                CourtGroups = courtGroups,
                UnassignedCourts = unassignedCourts,
                Divisions = divisions,
                Encounters = encounters
            }
        });
    }

    /// <summary>
    /// Bulk update court and time assignments for encounters
    /// </summary>
    [Authorize]
    [HttpPost("court-planning/bulk-assign")]
    public async Task<ActionResult<ApiResponse<object>>> BulkAssignCourtsAndTimes([FromBody] BulkCourtTimeAssignmentRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        if (!await IsAdminAsync() && !await IsEventOrganizerAsync(request.EventId, userId.Value))
            return Forbid();

        if (request.Assignments == null || request.Assignments.Count == 0)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "No assignments provided" });

        // Use raw SQL to avoid EF Core Contains() CTE syntax issues
        var now = DateTime.Now;
        var updatedCount = 0;

        foreach (var assignment in request.Assignments)
        {
            // Update each encounter individually using raw SQL to avoid EF Core query generation issues
            var sql = @"UPDATE EventEncounters
                        SET TournamentCourtId = @CourtId,
                            ScheduledTime = COALESCE(@ScheduledTime, ScheduledTime),
                            EstimatedStartTime = COALESCE(@EstimatedStartTime, EstimatedStartTime),
                            UpdatedAt = @UpdatedAt
                        WHERE Id = @EncounterId AND EventId = @EventId";

            var result = await _context.Database.ExecuteSqlRawAsync(sql,
                new SqlParameter("@CourtId", (object?)assignment.CourtId ?? DBNull.Value),
                new SqlParameter("@ScheduledTime", (object?)assignment.ScheduledTime ?? DBNull.Value),
                new SqlParameter("@EstimatedStartTime", (object?)assignment.EstimatedStartTime ?? DBNull.Value),
                new SqlParameter("@UpdatedAt", now),
                new SqlParameter("@EncounterId", assignment.EncounterId),
                new SqlParameter("@EventId", request.EventId));

            updatedCount += result;
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = $"{updatedCount} encounters updated"
        });
    }

    /// <summary>
    /// Assign court groups to a division
    /// </summary>
    [Authorize]
    [HttpPost("court-planning/division-courts")]
    public async Task<ActionResult<ApiResponse<object>>> AssignCourtGroupsToDivision([FromBody] DivisionCourtGroupsRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == request.DivisionId);

        if (division == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Division not found" });

        if (!await IsAdminAsync() && !await IsEventOrganizerAsync(division.EventId, userId.Value))
            return Forbid();

        // Remove existing division-level court assignments (not phase-level)
        var existingAssignments = await _context.DivisionCourtAssignments
            .Where(a => a.DivisionId == request.DivisionId && a.PhaseId == null)
            .ToListAsync();
        _context.DivisionCourtAssignments.RemoveRange(existingAssignments);

        // Add new assignments
        if (request.CourtGroupIds?.Any() == true)
        {
            var validGroups = await _context.CourtGroups
                .Where(g => request.CourtGroupIds.Contains(g.Id) && g.EventId == division.EventId)
                .Select(g => g.Id)
                .ToListAsync();

            int priority = 0;
            foreach (var groupId in request.CourtGroupIds.Where(id => validGroups.Contains(id)))
            {
                _context.DivisionCourtAssignments.Add(new DivisionCourtAssignment
                {
                    DivisionId = request.DivisionId,
                    CourtGroupId = groupId,
                    Priority = priority++,
                    ValidFromTime = request.ValidFromTime,
                    ValidToTime = request.ValidToTime,
                    AssignmentMode = request.AssignmentMode,
                    PoolName = request.PoolName,
                    MatchFormatId = request.MatchFormatId
                });
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Court groups assigned to division"
        });
    }

    /// <summary>
    /// Auto-assign courts and calculate times for a division
    /// Uses division's assigned court groups
    /// </summary>
    [Authorize]
    [HttpPost("court-planning/auto-assign/{divisionId}")]
    public async Task<ActionResult<ApiResponse<object>>> AutoAssignDivisionCourts(int divisionId, [FromBody] AutoAssignRequest? request = null)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Division not found" });

        if (!await IsAdminAsync() && !await IsEventOrganizerAsync(division.EventId, userId.Value))
            return Forbid();

        var options = new CourtAssignmentOptions
        {
            StartTime = request?.StartTime,
            MatchDurationMinutes = request?.MatchDurationMinutes,
            ClearExisting = request?.ClearExisting ?? true
        };

        var result = await _courtAssignmentService.AutoAssignDivisionAsync(divisionId, options);

        if (!result.Success)
            return BadRequest(new ApiResponse<object> { Success = false, Message = result.Message });

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Data = new
            {
                Assigned = result.AssignedCount,
                CourtsUsed = result.CourtsUsed,
                StartTime = result.StartTime,
                EstimatedEndTime = result.EstimatedEndTime
            },
            Message = result.Message
        });
    }

    /// <summary>
    /// Clear all court/time assignments for a division
    /// </summary>
    [Authorize]
    [HttpPost("court-planning/clear/{divisionId}")]
    public async Task<ActionResult<ApiResponse<object>>> ClearDivisionCourtAssignments(int divisionId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Division not found" });

        if (!await IsAdminAsync() && !await IsEventOrganizerAsync(division.EventId, userId.Value))
            return Forbid();

        var cleared = await _courtAssignmentService.ClearDivisionAssignmentsAsync(divisionId);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = $"Cleared court/time assignments for {cleared} encounters"
        });
    }

    /// <summary>
    /// Validate schedule for conflicts before publishing
    /// </summary>
    [Authorize]
    [HttpGet("court-planning/validate/{eventId}")]
    public async Task<ActionResult<ApiResponse<ScheduleValidationResult>>> ValidateSchedule(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<ScheduleValidationResult> { Success = false, Message = "Unauthorized" });

        if (!await CanManageEventAsync(eventId))
            return Forbid();

        var result = await ValidateEventScheduleAsync(eventId);

        // Update event with validation results
        var evt = await _context.Events.FindAsync(eventId);
        if (evt != null)
        {
            evt.ScheduleValidatedAt = DateTime.Now;
            evt.ScheduleConflictCount = result.ConflictCount;
            await _context.SaveChangesAsync();
        }

        return Ok(new ApiResponse<ScheduleValidationResult>
        {
            Success = true,
            Data = result
        });
    }

    /// <summary>
    /// Publish the event schedule for players/spectators to view
    /// </summary>
    [Authorize]
    [HttpPost("court-planning/publish/{eventId}")]
    public async Task<ActionResult<ApiResponse<object>>> PublishSchedule(int eventId, [FromBody] SchedulePublishRequest? request = null)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        if (!await CanManageEventAsync(eventId))
            return Forbid();

        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Event not found" });

        // Validate first if requested
        if (request?.ValidateFirst != false)
        {
            var validation = await ValidateEventScheduleAsync(eventId);
            if (!validation.IsValid)
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Message = $"Cannot publish: {validation.ConflictCount} conflicts found",
                    Data = validation
                });
            }
        }

        // Mark event as published
        evt.SchedulePublishedAt = DateTime.Now;
        evt.SchedulePublishedByUserId = userId.Value;
        evt.UpdatedAt = DateTime.Now;

        // Also mark all divisions as published
        var divisions = await _context.EventDivisions
            .Where(d => d.EventId == eventId && d.IsActive)
            .ToListAsync();

        foreach (var division in divisions)
        {
            division.SchedulePublishedAt = DateTime.Now;
            division.SchedulePublishedByUserId = userId.Value;
            division.UpdatedAt = DateTime.Now;
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Schedule published for event {EventId} by user {UserId}", eventId, userId.Value);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Schedule published successfully",
            Data = new { PublishedAt = evt.SchedulePublishedAt }
        });
    }

    /// <summary>
    /// Unpublish the event schedule
    /// </summary>
    [Authorize]
    [HttpPost("court-planning/unpublish/{eventId}")]
    public async Task<ActionResult<ApiResponse<object>>> UnpublishSchedule(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        if (!await CanManageEventAsync(eventId))
            return Forbid();

        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Event not found" });

        evt.SchedulePublishedAt = null;
        evt.SchedulePublishedByUserId = null;
        evt.UpdatedAt = DateTime.Now;

        // Also unpublish all divisions
        var divisions = await _context.EventDivisions
            .Where(d => d.EventId == eventId && d.IsActive)
            .ToListAsync();

        foreach (var division in divisions)
        {
            division.SchedulePublishedAt = null;
            division.SchedulePublishedByUserId = null;
            division.UpdatedAt = DateTime.Now;
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Schedule unpublished"
        });
    }

    /// <summary>
    /// Get timeline data for visualizing court schedules
    /// </summary>
    [HttpGet("court-planning/timeline/{eventId}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<TimelineDataDto>>> GetTimelineData(int eventId)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<TimelineDataDto> { Success = false, Message = "Event not found" });

        var isPublished = evt.SchedulePublishedAt.HasValue;

        // Get court data with grouped encounters
        var courts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive)
            .OrderBy(c => c.SortOrder)
            .Select(c => new TimelineCourtDto
            {
                Id = c.Id,
                CourtLabel = c.CourtLabel,
                CourtGroupId = c.CourtGroupCourts.Any() ? c.CourtGroupCourts.First().CourtGroupId : (int?)null,
                CourtGroupName = c.CourtGroupCourts.Any() ? c.CourtGroupCourts.First().CourtGroup!.GroupName : null,
                LocationArea = c.CourtGroupCourts.Any() ? c.CourtGroupCourts.First().CourtGroup!.LocationArea : null,
                SortOrder = c.SortOrder,
                Blocks = new List<TimelineBlockDto>()
            })
            .ToListAsync();

        // Get encounters with time assignments
        var encounters = await _context.EventEncounters
            .Where(e => e.EventId == eventId && e.TournamentCourtId != null && e.EstimatedStartTime != null)
            .Include(e => e.Division)
            .Include(e => e.Phase)
            .Include(e => e.Unit1)
            .Include(e => e.Unit2)
            .Include(e => e.TournamentCourt)
            .ToListAsync();

        // Build timeline blocks for each court
        foreach (var court in courts)
        {
            var courtEncounters = encounters
                .Where(e => e.TournamentCourtId == court.Id)
                .OrderBy(e => e.EstimatedStartTime)
                .ToList();

            foreach (var enc in courtEncounters)
            {
                var duration = enc.EstimatedDurationMinutes ?? enc.Division?.EstimatedMatchDurationMinutes ?? 20;
                var endTime = enc.EstimatedEndTime ?? enc.EstimatedStartTime!.Value.AddMinutes(duration);

                court.Blocks.Add(new TimelineBlockDto
                {
                    EncounterId = enc.Id,
                    DivisionId = enc.DivisionId,
                    DivisionName = enc.Division?.Name ?? "",
                    DivisionColor = GetDivisionColor(enc.DivisionId),
                    PhaseId = enc.PhaseId,
                    PhaseName = enc.Phase?.Name,
                    RoundName = enc.RoundName,
                    EncounterLabel = enc.EncounterLabel ?? $"Match {enc.EncounterNumber}",
                    Unit1Name = enc.Unit1?.Name ?? enc.Unit1SeedLabel,
                    Unit2Name = enc.Unit2?.Name ?? enc.Unit2SeedLabel,
                    StartTime = enc.EstimatedStartTime!.Value,
                    EndTime = endTime,
                    DurationMinutes = duration,
                    Status = enc.Status,
                    HasConflict = false // Will be populated by validation
                });
            }
        }

        // Check for conflicts
        foreach (var court in courts)
        {
            for (int i = 0; i < court.Blocks.Count - 1; i++)
            {
                var current = court.Blocks[i];
                var next = court.Blocks[i + 1];
                if (current.EndTime > next.StartTime)
                {
                    current.HasConflict = true;
                    next.HasConflict = true;
                }
            }
        }

        // Get division summary
        var divisionSummary = await _context.EventDivisions
            .Where(d => d.EventId == eventId && d.IsActive)
            .Select(d => new TimelineDivisionDto
            {
                Id = d.Id,
                Name = d.Name,
                Color = null, // Will be assigned
                EncounterCount = d.Encounters.Count,
                AssignedCount = d.Encounters.Count(e => e.TournamentCourtId != null && e.EstimatedStartTime != null),
                FirstEncounterTime = d.Encounters
                    .Where(e => e.EstimatedStartTime != null)
                    .Min(e => e.EstimatedStartTime),
                LastEncounterTime = d.Encounters
                    .Where(e => e.EstimatedStartTime != null)
                    .Max(e => e.EstimatedStartTime)
            })
            .ToListAsync();

        // Assign colors to divisions
        for (int i = 0; i < divisionSummary.Count; i++)
        {
            divisionSummary[i].Color = GetDivisionColor(divisionSummary[i].Id);
        }

        return Ok(new ApiResponse<TimelineDataDto>
        {
            Success = true,
            Data = new TimelineDataDto
            {
                EventId = eventId,
                EventStartDate = evt.StartDate,
                EventEndDate = evt.EndDate,
                IsSchedulePublished = isPublished,
                Courts = courts,
                Divisions = divisionSummary
            }
        });
    }

    /// <summary>
    /// Add or update a court group assignment for a division
    /// </summary>
    [Authorize]
    [HttpPost("court-planning/division-assignment")]
    public async Task<ActionResult<ApiResponse<object>>> AddDivisionCourtAssignment([FromBody] DivisionCourtAssignmentRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions.FindAsync(request.DivisionId);
        if (division == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Division not found" });

        if (!await CanManageEventAsync(division.EventId))
            return Forbid();

        var courtGroup = await _context.CourtGroups.FindAsync(request.CourtGroupId);
        if (courtGroup == null || courtGroup.EventId != division.EventId)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Invalid court group" });

        // Create or update assignment
        var existing = await _context.DivisionCourtAssignments
            .FirstOrDefaultAsync(a =>
                a.DivisionId == request.DivisionId &&
                a.CourtGroupId == request.CourtGroupId &&
                a.PhaseId == request.PhaseId &&
                a.AssignmentMode == request.AssignmentMode &&
                a.PoolName == request.PoolName &&
                a.MatchFormatId == request.MatchFormatId);

        if (existing != null)
        {
            existing.Priority = request.Priority;
            existing.ValidFromTime = request.ValidFromTime;
            existing.ValidToTime = request.ValidToTime;
        }
        else
        {
            _context.DivisionCourtAssignments.Add(new DivisionCourtAssignment
            {
                DivisionId = request.DivisionId,
                CourtGroupId = request.CourtGroupId,
                PhaseId = request.PhaseId,
                AssignmentMode = request.AssignmentMode,
                PoolName = request.PoolName,
                MatchFormatId = request.MatchFormatId,
                Priority = request.Priority,
                ValidFromTime = request.ValidFromTime,
                ValidToTime = request.ValidToTime
            });
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Court assignment saved"
        });
    }

    /// <summary>
    /// Delete a court group assignment
    /// </summary>
    [Authorize]
    [HttpDelete("court-planning/division-assignment/{assignmentId}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteDivisionCourtAssignment(int assignmentId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        var assignment = await _context.DivisionCourtAssignments
            .Include(a => a.Division)
            .FirstOrDefaultAsync(a => a.Id == assignmentId);

        if (assignment == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Assignment not found" });

        if (!await CanManageEventAsync(assignment.Division!.EventId))
            return Forbid();

        _context.DivisionCourtAssignments.Remove(assignment);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Assignment deleted"
        });
    }

    // Helper method to validate event schedule
    private async Task<ScheduleValidationResult> ValidateEventScheduleAsync(int eventId)
    {
        var result = new ScheduleValidationResult { IsValid = true };

        // Get all encounters with court assignments
        var encounters = await _context.EventEncounters
            .Where(e => e.EventId == eventId && e.Status != "Cancelled" && e.Status != "Bye")
            .Include(e => e.Division)
            .Include(e => e.TournamentCourt)
            .ToListAsync();

        // Check for unassigned encounters
        var unassigned = encounters.Where(e => e.TournamentCourtId == null || e.EstimatedStartTime == null).ToList();
        result.UnassignedEncounters = unassigned.Count;
        if (unassigned.Count > 0)
        {
            result.Warnings.Add($"{unassigned.Count} encounters without court/time assignments");
        }

        // Get assigned encounters grouped by court
        var assignedByCourtId = encounters
            .Where(e => e.TournamentCourtId.HasValue && e.EstimatedStartTime.HasValue)
            .GroupBy(e => e.TournamentCourtId!.Value)
            .ToList();

        // Check for time overlaps on each court
        foreach (var courtGroup in assignedByCourtId)
        {
            var courtEncounters = courtGroup
                .OrderBy(e => e.EstimatedStartTime)
                .ToList();

            for (int i = 0; i < courtEncounters.Count - 1; i++)
            {
                var current = courtEncounters[i];
                var next = courtEncounters[i + 1];

                var duration = current.EstimatedDurationMinutes ?? current.Division?.EstimatedMatchDurationMinutes ?? 20;
                var currentEnd = current.EstimatedEndTime ?? current.EstimatedStartTime!.Value.AddMinutes(duration);

                if (currentEnd > next.EstimatedStartTime)
                {
                    result.Conflicts.Add(new ScheduleConflictDto
                    {
                        ConflictType = "CourtOverlap",
                        CourtId = courtGroup.Key,
                        CourtLabel = current.TournamentCourt?.CourtLabel ?? $"Court {courtGroup.Key}",
                        Encounter1Id = current.Id,
                        Encounter2Id = next.Id,
                        Encounter1Label = current.EncounterLabel ?? $"{current.Division?.Name} Match {current.EncounterNumber}",
                        Encounter2Label = next.EncounterLabel ?? $"{next.Division?.Name} Match {next.EncounterNumber}",
                        ConflictStartTime = next.EstimatedStartTime,
                        ConflictEndTime = currentEnd,
                        Message = $"Overlapping matches on {current.TournamentCourt?.CourtLabel}: {current.Division?.Name} ends at {currentEnd:HH:mm} but {next.Division?.Name} starts at {next.EstimatedStartTime:HH:mm}"
                    });
                }
            }
        }

        // Check for same unit playing at overlapping times
        var unitEncounters = encounters
            .Where(e => e.EstimatedStartTime.HasValue && (e.Unit1Id.HasValue || e.Unit2Id.HasValue))
            .SelectMany(e => new[]
            {
                e.Unit1Id.HasValue ? new { UnitId = e.Unit1Id.Value, Encounter = e } : null,
                e.Unit2Id.HasValue ? new { UnitId = e.Unit2Id.Value, Encounter = e } : null
            })
            .Where(x => x != null)
            .GroupBy(x => x!.UnitId)
            .ToList();

        foreach (var unitGroup in unitEncounters)
        {
            var unitMatches = unitGroup
                .OrderBy(x => x.Encounter.EstimatedStartTime)
                .ToList();

            for (int i = 0; i < unitMatches.Count - 1; i++)
            {
                var current = unitMatches[i].Encounter;
                var next = unitMatches[i + 1].Encounter;

                var duration = current.EstimatedDurationMinutes ?? current.Division?.EstimatedMatchDurationMinutes ?? 20;
                var currentEnd = current.EstimatedEndTime ?? current.EstimatedStartTime!.Value.AddMinutes(duration);

                if (currentEnd > next.EstimatedStartTime)
                {
                    // Only add if not already in conflicts
                    if (!result.Conflicts.Any(c =>
                        c.ConflictType == "UnitOverlap" &&
                        ((c.Encounter1Id == current.Id && c.Encounter2Id == next.Id) ||
                         (c.Encounter1Id == next.Id && c.Encounter2Id == current.Id))))
                    {
                        result.Conflicts.Add(new ScheduleConflictDto
                        {
                            ConflictType = "UnitOverlap",
                            CourtId = current.TournamentCourtId ?? 0,
                            CourtLabel = current.TournamentCourt?.CourtLabel ?? "",
                            Encounter1Id = current.Id,
                            Encounter2Id = next.Id,
                            Encounter1Label = current.EncounterLabel ?? $"{current.Division?.Name} Match {current.EncounterNumber}",
                            Encounter2Label = next.EncounterLabel ?? $"{next.Division?.Name} Match {next.EncounterNumber}",
                            ConflictStartTime = next.EstimatedStartTime,
                            ConflictEndTime = currentEnd,
                            Message = $"Team has overlapping matches"
                        });
                    }
                }
            }
        }

        // Check divisions without court assignments
        var divisionsWithoutCourts = await _context.EventDivisions
            .Where(d => d.EventId == eventId && d.IsActive)
            .Where(d => !_context.DivisionCourtAssignments.Any(a => a.DivisionId == d.Id))
            .CountAsync();

        result.DivisionsWithoutCourts = divisionsWithoutCourts;
        if (divisionsWithoutCourts > 0)
        {
            result.Warnings.Add($"{divisionsWithoutCourts} divisions without court group assignments");
        }

        result.ConflictCount = result.Conflicts.Count;
        result.IsValid = result.ConflictCount == 0 && result.UnassignedEncounters == 0;

        return result;
    }

    // Helper to assign colors to divisions for timeline visualization
    private static string GetDivisionColor(int divisionId)
    {
        var colors = new[]
        {
            "#3b82f6", // blue
            "#10b981", // emerald
            "#f97316", // orange
            "#8b5cf6", // violet
            "#ef4444", // red
            "#06b6d4", // cyan
            "#f59e0b", // amber
            "#ec4899", // pink
            "#6366f1", // indigo
            "#84cc16"  // lime
        };
        return colors[divisionId % colors.Length];
    }

    [Authorize]

    // ============================================
    // Division Court Blocks (Court Pre-allocation)
    // ============================================

    /// <summary>
    /// Get court blocks for a division (pre-allocated courts with priority)
    /// </summary>
    [HttpGet("division/{divisionId}/court-blocks")]
    public async Task<ActionResult<ApiResponse<List<DivisionCourtBlockDto>>>> GetDivisionCourtBlocks(int divisionId)
    {
        var blocks = await _context.DivisionCourtBlocks
            .Include(b => b.TournamentCourt)
            .Include(b => b.Division)
            .Where(b => b.DivisionId == divisionId && b.IsActive)
            .OrderBy(b => b.Priority)
            .Select(b => new DivisionCourtBlockDto
            {
                Id = b.Id,
                DivisionId = b.DivisionId,
                DivisionName = b.Division != null ? b.Division.Name : null,
                TournamentCourtId = b.TournamentCourtId,
                CourtLabel = b.TournamentCourt != null ? b.TournamentCourt.CourtLabel : null,
                Priority = b.Priority,
                IntendedStartTime = b.IntendedStartTime,
                IntendedEndTime = b.IntendedEndTime,
                Notes = b.Notes,
                IsActive = b.IsActive,
                CreatedAt = b.CreatedAt
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<DivisionCourtBlockDto>> { Success = true, Data = blocks });
    }

    /// <summary>
    /// Add a court block to a division
    /// </summary>
    [Authorize]
    [HttpPost("division/{divisionId}/court-blocks")]
    public async Task<ActionResult<ApiResponse<DivisionCourtBlockDto>>> CreateDivisionCourtBlock(
        int divisionId,
        [FromBody] CreateDivisionCourtBlockDto dto)
    {
        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return NotFound(new ApiResponse<DivisionCourtBlockDto> { Success = false, Message = "Division not found" });

        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<DivisionCourtBlockDto> { Success = false, Message = "User not authenticated" });

        // Check permission
        var evt = await _context.Events.FindAsync(division.EventId);
        if (evt == null || (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync()))
            return Forbid();

        // Check if court exists and belongs to the same event
        var court = await _context.TournamentCourts.FindAsync(dto.TournamentCourtId);
        if (court == null || court.EventId != division.EventId)
            return BadRequest(new ApiResponse<DivisionCourtBlockDto> { Success = false, Message = "Invalid court" });

        // Check if already assigned
        var existing = await _context.DivisionCourtBlocks
            .FirstOrDefaultAsync(b => b.DivisionId == divisionId && b.TournamentCourtId == dto.TournamentCourtId);
        if (existing != null)
            return BadRequest(new ApiResponse<DivisionCourtBlockDto> { Success = false, Message = "Court is already assigned to this division" });

        var block = new DivisionCourtBlock
        {
            DivisionId = divisionId,
            TournamentCourtId = dto.TournamentCourtId,
            Priority = dto.Priority,
            IntendedStartTime = dto.IntendedStartTime,
            IntendedEndTime = dto.IntendedEndTime,
            Notes = dto.Notes
        };

        _context.DivisionCourtBlocks.Add(block);
        await _context.SaveChangesAsync();

        await _context.Entry(block).Reference(b => b.TournamentCourt).LoadAsync();
        await _context.Entry(block).Reference(b => b.Division).LoadAsync();

        var result = new DivisionCourtBlockDto
        {
            Id = block.Id,
            DivisionId = block.DivisionId,
            DivisionName = block.Division?.Name,
            TournamentCourtId = block.TournamentCourtId,
            CourtLabel = block.TournamentCourt?.CourtLabel,
            Priority = block.Priority,
            IntendedStartTime = block.IntendedStartTime,
            IntendedEndTime = block.IntendedEndTime,
            Notes = block.Notes,
            IsActive = block.IsActive,
            CreatedAt = block.CreatedAt
        };

        return Ok(new ApiResponse<DivisionCourtBlockDto> { Success = true, Data = result });
    }

    /// <summary>
    /// Update a court block
    /// </summary>
    [Authorize]
    [HttpPut("division/{divisionId}/court-blocks/{blockId}")]
    public async Task<ActionResult<ApiResponse<DivisionCourtBlockDto>>> UpdateDivisionCourtBlock(
        int divisionId,
        int blockId,
        [FromBody] UpdateDivisionCourtBlockDto dto)
    {
        var block = await _context.DivisionCourtBlocks
            .Include(b => b.Division)
            .Include(b => b.TournamentCourt)
            .FirstOrDefaultAsync(b => b.Id == blockId && b.DivisionId == divisionId);

        if (block == null)
            return NotFound(new ApiResponse<DivisionCourtBlockDto> { Success = false, Message = "Court block not found" });

        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<DivisionCourtBlockDto> { Success = false, Message = "User not authenticated" });

        // Check permission
        var evt = await _context.Events.FindAsync(block.Division!.EventId);
        if (evt == null || (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync()))
            return Forbid();

        // Update fields
        if (dto.Priority.HasValue)
            block.Priority = dto.Priority.Value;
        if (dto.IntendedStartTime.HasValue)
            block.IntendedStartTime = dto.IntendedStartTime;
        if (dto.IntendedEndTime.HasValue)
            block.IntendedEndTime = dto.IntendedEndTime;
        if (dto.Notes != null)
            block.Notes = dto.Notes;
        if (dto.IsActive.HasValue)
            block.IsActive = dto.IsActive.Value;

        block.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        var result = new DivisionCourtBlockDto
        {
            Id = block.Id,
            DivisionId = block.DivisionId,
            DivisionName = block.Division?.Name,
            TournamentCourtId = block.TournamentCourtId,
            CourtLabel = block.TournamentCourt?.CourtLabel,
            Priority = block.Priority,
            IntendedStartTime = block.IntendedStartTime,
            IntendedEndTime = block.IntendedEndTime,
            Notes = block.Notes,
            IsActive = block.IsActive,
            CreatedAt = block.CreatedAt
        };

        return Ok(new ApiResponse<DivisionCourtBlockDto> { Success = true, Data = result });
    }

    /// <summary>
    /// Delete a court block
    /// </summary>
    [Authorize]
    [HttpDelete("division/{divisionId}/court-blocks/{blockId}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteDivisionCourtBlock(int divisionId, int blockId)
    {
        var block = await _context.DivisionCourtBlocks
            .Include(b => b.Division)
            .FirstOrDefaultAsync(b => b.Id == blockId && b.DivisionId == divisionId);

        if (block == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Court block not found" });

        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

        // Check permission
        var evt = await _context.Events.FindAsync(block.Division!.EventId);
        if (evt == null || (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync()))
            return Forbid();

        _context.DivisionCourtBlocks.Remove(block);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true });
    }

    /// <summary>
    /// Bulk update court blocks for a division (replaces all blocks)
    /// </summary>
    [Authorize]
    [HttpPut("division/{divisionId}/court-blocks")]
    public async Task<ActionResult<ApiResponse<List<DivisionCourtBlockDto>>>> BulkUpdateDivisionCourtBlocks(
        int divisionId,
        [FromBody] BulkUpdateDivisionCourtBlocksDto dto)
    {
        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return NotFound(new ApiResponse<List<DivisionCourtBlockDto>> { Success = false, Message = "Division not found" });

        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<List<DivisionCourtBlockDto>> { Success = false, Message = "User not authenticated" });

        // Check permission
        var evt = await _context.Events.FindAsync(division.EventId);
        if (evt == null || (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync()))
            return Forbid();

        // Validate all courts
        var courtIds = dto.CourtBlocks.Select(b => b.TournamentCourtId).ToList();
        var validCourts = await _context.TournamentCourts
            .Where(c => courtIds.Contains(c.Id) && c.EventId == division.EventId)
            .Select(c => c.Id)
            .ToListAsync();

        var invalidCourts = courtIds.Except(validCourts).ToList();
        if (invalidCourts.Any())
            return BadRequest(new ApiResponse<List<DivisionCourtBlockDto>> { Success = false, Message = $"Invalid court IDs: {string.Join(", ", invalidCourts)}" });

        // Remove existing blocks
        var existingBlocks = await _context.DivisionCourtBlocks
            .Where(b => b.DivisionId == divisionId)
            .ToListAsync();
        _context.DivisionCourtBlocks.RemoveRange(existingBlocks);

        // Add new blocks
        var newBlocks = dto.CourtBlocks.Select(b => new DivisionCourtBlock
        {
            DivisionId = divisionId,
            TournamentCourtId = b.TournamentCourtId,
            Priority = b.Priority,
            IntendedStartTime = b.IntendedStartTime,
            IntendedEndTime = b.IntendedEndTime,
            Notes = b.Notes
        }).ToList();

        _context.DivisionCourtBlocks.AddRange(newBlocks);
        await _context.SaveChangesAsync();

        // Load and return results
        var blocks = await _context.DivisionCourtBlocks
            .Include(b => b.TournamentCourt)
            .Include(b => b.Division)
            .Where(b => b.DivisionId == divisionId)
            .OrderBy(b => b.Priority)
            .Select(b => new DivisionCourtBlockDto
            {
                Id = b.Id,
                DivisionId = b.DivisionId,
                DivisionName = b.Division != null ? b.Division.Name : null,
                TournamentCourtId = b.TournamentCourtId,
                CourtLabel = b.TournamentCourt != null ? b.TournamentCourt.CourtLabel : null,
                Priority = b.Priority,
                IntendedStartTime = b.IntendedStartTime,
                IntendedEndTime = b.IntendedEndTime,
                Notes = b.Notes,
                IsActive = b.IsActive,
                CreatedAt = b.CreatedAt
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<DivisionCourtBlockDto>> { Success = true, Data = blocks });
    }

    // ============================================
    // Game-Level Scheduling
    // ============================================

    /// <summary>
    /// Get all games for scheduling (court time assignment)
    /// Returns games grouped by division/phase with scheduling info
    /// </summary>
    [Authorize]
    [HttpGet("court-planning/{eventId}/games")]
    public async Task<ActionResult<ApiResponse<List<GameSchedulingDto>>>> GetGamesForScheduling(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<List<GameSchedulingDto>> { Success = false, Message = "Unauthorized" });

        if (!await IsAdminAsync() && !await IsEventOrganizerAsync(eventId, userId.Value))
            return Forbid();

        var games = await _context.EventGames
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Division)
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Phase)
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Unit1)
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Unit2)
            .Include(g => g.TournamentCourt)
            .Where(g => g.EncounterMatch!.Encounter!.EventId == eventId)
            .OrderBy(g => g.EncounterMatch!.Encounter!.DivisionId)
            .ThenBy(g => g.EncounterMatch!.Encounter!.PhaseId)
            .ThenBy(g => g.EncounterMatch!.Encounter!.RoundNumber)
            .ThenBy(g => g.EncounterMatch!.Encounter!.EncounterNumber)
            .ThenBy(g => g.EncounterMatch!.SortOrder)
            .ThenBy(g => g.GameNumber)
            .Select(g => new GameSchedulingDto
            {
                Id = g.Id,
                MatchId = g.EncounterMatchId,
                EncounterId = g.EncounterMatch!.EncounterId,
                DivisionId = g.EncounterMatch.Encounter!.DivisionId,
                DivisionName = g.EncounterMatch.Encounter.Division!.Name,
                PhaseId = g.EncounterMatch.Encounter.PhaseId,
                PhaseName = g.EncounterMatch.Encounter.Phase != null ? g.EncounterMatch.Encounter.Phase.Name : null,
                GameNumber = g.GameNumber,
                TotalGamesInMatch = g.EncounterMatch.BestOf,
                MatchLabel = g.EncounterMatch.Encounter.EncounterLabel,
                Unit1Name = g.EncounterMatch.Encounter.Unit1 != null ? g.EncounterMatch.Encounter.Unit1.Name : g.EncounterMatch.Encounter.Unit1SeedLabel,
                Unit2Name = g.EncounterMatch.Encounter.Unit2 != null ? g.EncounterMatch.Encounter.Unit2.Name : g.EncounterMatch.Encounter.Unit2SeedLabel,
                Unit1Id = g.EncounterMatch.Encounter.Unit1Id,
                Unit2Id = g.EncounterMatch.Encounter.Unit2Id,
                TournamentCourtId = g.TournamentCourtId,
                CourtLabel = g.TournamentCourt != null ? g.TournamentCourt.CourtLabel : null,
                ScheduledStartTime = g.ScheduledStartTime,
                ScheduledEndTime = g.ScheduledEndTime,
                EstimatedDurationMinutes = g.EstimatedDurationMinutes ?? g.EncounterMatch.Encounter.Division!.EstimatedMatchDurationMinutes ?? 30,
                Status = g.Status
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<GameSchedulingDto>>
        {
            Success = true,
            Data = games
        });
    }

    /// <summary>
    /// Bulk update court and time assignments for games
    /// </summary>
    [Authorize]
    [HttpPost("court-planning/games/bulk-assign")]
    public async Task<ActionResult<ApiResponse<object>>> BulkAssignGames([FromBody] BulkGameAssignmentRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        if (!await IsAdminAsync() && !await IsEventOrganizerAsync(request.EventId, userId.Value))
            return Forbid();

        if (request.Assignments == null || request.Assignments.Count == 0)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "No assignments provided" });

        var now = DateTime.Now;
        var gameIds = request.Assignments.Select(a => a.GameId).ToList();

        // Load games to update
        var games = await _context.EventGames
            .Where(g => gameIds.Contains(g.Id))
            .ToListAsync();

        foreach (var assignment in request.Assignments)
        {
            var game = games.FirstOrDefault(g => g.Id == assignment.GameId);
            if (game == null) continue;

            if (assignment.CourtId.HasValue)
                game.TournamentCourtId = assignment.CourtId.Value;
            else if (assignment.CourtId == null)
                game.TournamentCourtId = null;

            if (assignment.ScheduledStartTime.HasValue)
                game.ScheduledStartTime = assignment.ScheduledStartTime;

            if (assignment.ScheduledEndTime.HasValue)
                game.ScheduledEndTime = assignment.ScheduledEndTime;

            game.UpdatedAt = now;
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = $"{games.Count} games updated"
        });
    }

}

/// <summary>
/// Request for bulk game court/time assignment
/// </summary>
public class BulkGameAssignmentRequest
{
    public int EventId { get; set; }
    public List<GameScheduleAssignmentDto> Assignments { get; set; } = new();
}
