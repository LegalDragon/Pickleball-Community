using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Services;
using Pickleball.Community.Controllers.Base;

namespace Pickleball.Community.API.Controllers;

/// <summary>
/// Server-side tournament scheduling with constraint solving.
/// Handles court assignment, time allocation, and conflict detection.
/// </summary>
[ApiController]
[Route("[controller]")]
[Authorize]
public class SchedulingController : EventControllerBase
{
    private readonly ISchedulingService _schedulingService;
    private readonly ILogger<SchedulingController> _logger;

    public SchedulingController(
        ApplicationDbContext context,
        ISchedulingService schedulingService,
        ILogger<SchedulingController> logger)
        : base(context)
    {
        _schedulingService = schedulingService;
        _logger = logger;
    }

    /// <summary>
    /// Generate a complete schedule for encounters in an event, division, or phase.
    /// Assigns courts and estimated start times respecting all constraints:
    /// player overlap, rest times, court groups, round dependencies.
    /// </summary>
    [HttpPost("generate")]
    public async Task<ActionResult<ApiResponse<ScheduleResult>>> GenerateSchedule([FromBody] ScheduleRequest request)
    {
        if (!await CanManageEventAsync(request.EventId))
            return Forbid();

        var result = await _schedulingService.GenerateScheduleAsync(request);

        if (!result.Success)
            return BadRequest(new ApiResponse<ScheduleResult> { Success = false, Message = result.Message, Data = result });

        return Ok(new ApiResponse<ScheduleResult>
        {
            Success = true,
            Message = result.Message,
            Data = result
        });
    }

    /// <summary>
    /// Validate a schedule for conflicts (player overlap, court double-booking, insufficient rest, round dependency).
    /// </summary>
    [HttpGet("validate/{eventId}")]
    public async Task<ActionResult<ApiResponse<ScheduleValidationResultNew>>> ValidateSchedule(
        int eventId, [FromQuery] int? divisionId = null)
    {
        if (!await CanManageEventAsync(eventId))
            return Forbid();

        var result = await _schedulingService.ValidateScheduleAsync(eventId, divisionId);

        return Ok(new ApiResponse<ScheduleValidationResultNew>
        {
            Success = true,
            Data = result
        });
    }

    /// <summary>
    /// Clear all schedule assignments (court + time) for a division or phase.
    /// Does not affect completed or in-progress encounters.
    /// </summary>
    [HttpPost("clear/{divisionId}")]
    public async Task<ActionResult<ApiResponse<object>>> ClearSchedule(
        int divisionId, [FromQuery] int? phaseId = null)
    {
        // Look up the division to get eventId for auth check
        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Division not found" });

        if (!await CanManageEventAsync(division.EventId))
            return Forbid();

        var cleared = await _schedulingService.ClearScheduleAsync(divisionId, phaseId);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = $"Cleared schedule for {cleared} encounters",
            Data = new { ClearedCount = cleared }
        });
    }

    /// <summary>
    /// Auto-assign a single encounter to the best available court and time.
    /// Used during game day for on-the-fly scheduling.
    /// </summary>
    [HttpPost("assign-single/{encounterId}")]
    public async Task<ActionResult<ApiResponse<ScheduleResult>>> AssignSingleEncounter(int encounterId)
    {
        var encounter = await _context.EventEncounters.FindAsync(encounterId);
        if (encounter == null)
            return NotFound(new ApiResponse<ScheduleResult> { Success = false, Message = "Encounter not found" });

        if (!await CanManageEventAsync(encounter.EventId))
            return Forbid();

        var result = await _schedulingService.AssignSingleEncounterAsync(encounterId);

        if (!result.Success)
            return BadRequest(new ApiResponse<ScheduleResult> { Success = false, Message = result.Message, Data = result });

        return Ok(new ApiResponse<ScheduleResult>
        {
            Success = true,
            Message = result.Message,
            Data = result
        });
    }

    /// <summary>
    /// Get available courts for a division/phase based on court group assignments.
    /// </summary>
    [HttpGet("available-courts/{divisionId}")]
    public async Task<ActionResult<ApiResponse<object>>> GetAvailableCourts(
        int divisionId, [FromQuery] int? phaseId = null)
    {
        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Division not found" });

        if (!await CanManageEventAsync(division.EventId))
            return Forbid();

        var courts = await _schedulingService.GetAvailableCourtsAsync(divisionId, phaseId);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Data = courts.Select(c => new
            {
                c.Id,
                c.CourtLabel,
                c.Status,
                c.SortOrder,
                c.IsActive
            })
        });
    }

    // =====================================================
    // Auto-Allocation Endpoints
    // =====================================================

    /// <summary>
    /// Auto-allocate matches across time blocks.
    /// TD assigns court+time blocks to each division+phase, then the system
    /// auto-schedules all matches within those constraints.
    /// </summary>
    [HttpPost("auto-allocate")]
    public async Task<ActionResult<ApiResponse<AutoAllocateResult>>> AutoAllocate([FromBody] AutoAllocateRequest request)
    {
        if (!await CanManageEventAsync(request.EventId))
            return Forbid();

        var result = await _schedulingService.AutoAllocateAsync(request);

        if (!result.Success)
            return BadRequest(new ApiResponse<AutoAllocateResult> { Success = false, Message = result.Message, Data = result });

        return Ok(new ApiResponse<AutoAllocateResult>
        {
            Success = true,
            Message = result.Message,
            Data = result
        });
    }

    /// <summary>
    /// Move a single encounter to a new court and/or time.
    /// Used for drag-drop editing in the visual schedule grid.
    /// Validates for conflicts before applying.
    /// </summary>
    [HttpPut("move-encounter/{encounterId}")]
    public async Task<ActionResult<ApiResponse<MoveEncounterResult>>> MoveEncounter(
        int encounterId, [FromBody] MoveEncounterRequest request)
    {
        var encounter = await _context.EventEncounters
            .Include(e => e.Division)
            .FirstOrDefaultAsync(e => e.Id == encounterId);

        if (encounter == null)
            return NotFound(new ApiResponse<MoveEncounterResult> { Success = false, Message = "Encounter not found" });

        if (!await CanManageEventAsync(encounter.EventId))
            return Forbid();

        if (encounter.Status == "Completed" || encounter.Status == "InProgress")
            return BadRequest(new ApiResponse<MoveEncounterResult>
            {
                Success = false,
                Message = "Cannot move a completed or in-progress encounter"
            });

        var duration = encounter.EstimatedDurationMinutes
            ?? encounter.Division?.EstimatedMatchDurationMinutes
            ?? 20;

        encounter.TournamentCourtId = request.CourtId;
        encounter.EstimatedStartTime = request.StartTime;
        encounter.EstimatedEndTime = request.StartTime.AddMinutes(duration);
        encounter.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        // Validate for conflicts after the move
        var validation = await _schedulingService.ValidateScheduleAsync(encounter.EventId, encounter.DivisionId);

        var conflicts = validation.Conflicts
            .Where(c => c.EncounterId1 == encounterId || c.EncounterId2 == encounterId)
            .ToList();

        return Ok(new ApiResponse<MoveEncounterResult>
        {
            Success = true,
            Message = conflicts.Any()
                ? $"Encounter moved but has {conflicts.Count} conflict(s)"
                : "Encounter moved successfully",
            Data = new MoveEncounterResult
            {
                EncounterId = encounterId,
                CourtId = request.CourtId,
                StartTime = request.StartTime,
                EndTime = request.StartTime.AddMinutes(duration),
                HasConflicts = conflicts.Any(),
                Conflicts = conflicts
            }
        });
    }

    /// <summary>
    /// Get the full schedule grid data for the visual scheduler.
    /// Returns all encounters with court/time assignments, grouped for grid display.
    /// </summary>
    [HttpGet("grid/{eventId}")]
    public async Task<ActionResult<ApiResponse<ScheduleGridData>>> GetScheduleGrid(int eventId)
    {
        if (!await CanManageEventAsync(eventId))
            return Forbid();

        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<ScheduleGridData> { Success = false, Message = "Event not found" });

        // Load all courts
        var courts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive)
            .OrderBy(c => c.SortOrder)
            .Select(c => new ScheduleGridCourt
            {
                Id = c.Id,
                Label = c.CourtLabel,
                SortOrder = c.SortOrder
            })
            .ToListAsync();

        // Load all divisions with phases
        var divisions = await _context.EventDivisions
            .Where(d => d.EventId == eventId && d.IsActive)
            .OrderBy(d => d.SortOrder)
            .Select(d => new ScheduleGridDivision
            {
                Id = d.Id,
                Name = d.Name,
                EstimatedMatchDurationMinutes = d.EstimatedMatchDurationMinutes ?? 20,
                MinRestTimeMinutes = d.MinRestTimeMinutes ?? 15,
                Phases = d.Phases.OrderBy(p => p.PhaseOrder).Select(p => new ScheduleGridPhase
                {
                    Id = p.Id,
                    Name = p.Name,
                    PhaseType = p.PhaseType,
                    PhaseOrder = p.PhaseOrder,
                    StartTime = p.StartTime,
                    EstimatedEndTime = p.EstimatedEndTime
                }).ToList()
            })
            .ToListAsync();

        // Load all encounters with assignments
        var encounters = await _context.EventEncounters
            .Include(e => e.Unit1)
            .Include(e => e.Unit2)
            .Include(e => e.TournamentCourt)
            .Include(e => e.Phase)
            .Where(e => e.EventId == eventId && e.Status != "Cancelled" && e.Status != "Bye")
            .OrderBy(e => e.EstimatedStartTime ?? DateTime.MaxValue)
            .Select(e => new ScheduleGridEncounter
            {
                Id = e.Id,
                DivisionId = e.DivisionId,
                PhaseId = e.PhaseId,
                RoundType = e.RoundType,
                RoundNumber = e.RoundNumber,
                RoundName = e.RoundName,
                EncounterNumber = e.EncounterNumber,
                EncounterLabel = e.EncounterLabel,
                Unit1Name = e.Unit1 != null ? e.Unit1.Name : e.Unit1SeedLabel,
                Unit2Name = e.Unit2 != null ? e.Unit2.Name : e.Unit2SeedLabel,
                CourtId = e.TournamentCourtId,
                CourtLabel = e.TournamentCourt != null ? e.TournamentCourt.CourtLabel : null,
                StartTime = e.EstimatedStartTime,
                EndTime = e.EstimatedEndTime,
                DurationMinutes = e.EstimatedDurationMinutes,
                Status = e.Status,
                PhaseName = e.Phase != null ? e.Phase.Name : null
            })
            .ToListAsync();

        // Load court group assignments (time blocks)
        var blockAssignments = await _context.DivisionCourtAssignments
            .Include(a => a.CourtGroup)
                .ThenInclude(g => g!.CourtGroupCourts)
            .Include(a => a.Division)
            .Include(a => a.Phase)
            .Where(a => a.Division!.EventId == eventId && a.IsActive)
            .OrderBy(a => a.Priority)
            .ToListAsync();

        var blocks = blockAssignments.Select(a => new ScheduleGridBlock
        {
            Id = a.Id,
            DivisionId = a.DivisionId,
            DivisionName = a.Division?.Name ?? "",
            PhaseId = a.PhaseId,
            PhaseName = a.Phase?.Name,
            CourtGroupId = a.CourtGroupId,
            CourtGroupName = a.CourtGroup?.GroupName ?? "",
            CourtIds = a.CourtGroup?.CourtGroupCourts?.Select(c => c.TournamentCourtId).ToList() ?? new List<int>(),
            ValidFromTime = a.ValidFromTime?.ToString(@"hh\:mm"),
            ValidToTime = a.ValidToTime?.ToString(@"hh\:mm")
        }).ToList();

        // Determine event time range
        var eventDate = evt.StartDate.Date;
        var scheduledTimes = encounters.Where(e => e.StartTime.HasValue).Select(e => e.StartTime!.Value).ToList();
        var gridStartTime = scheduledTimes.Any()
            ? scheduledTimes.Min().Date.AddHours(scheduledTimes.Min().Hour)
            : eventDate.AddHours(8);
        var gridEndTime = scheduledTimes.Any()
            ? scheduledTimes.Max().Date.AddHours(scheduledTimes.Max().Hour + 2)
            : eventDate.AddHours(18);

        var gridData = new ScheduleGridData
        {
            EventId = eventId,
            EventName = evt.Name,
            EventDate = eventDate,
            GridStartTime = gridStartTime,
            GridEndTime = gridEndTime,
            Courts = courts,
            Divisions = divisions,
            Encounters = encounters,
            Blocks = blocks,
            TotalEncounters = encounters.Count,
            ScheduledEncounters = encounters.Count(e => e.CourtId.HasValue && e.StartTime.HasValue),
            UnscheduledEncounters = encounters.Count(e => !e.CourtId.HasValue || !e.StartTime.HasValue)
        };

        return Ok(new ApiResponse<ScheduleGridData>
        {
            Success = true,
            Data = gridData
        });
    }

    /// <summary>
    /// Save time block allocations (court group + time window per division/phase).
    /// Updates DivisionCourtAssignments with ValidFromTime/ValidToTime.
    /// </summary>
    [HttpPost("blocks/{eventId}")]
    public async Task<ActionResult<ApiResponse<object>>> SaveBlocks(
        int eventId, [FromBody] SaveBlocksRequest request)
    {
        if (!await CanManageEventAsync(eventId))
            return Forbid();

        // For each block allocation, create or update DivisionCourtAssignment
        foreach (var block in request.Blocks)
        {
            // Find existing assignment
            var existing = await _context.DivisionCourtAssignments
                .FirstOrDefaultAsync(a =>
                    a.DivisionId == block.DivisionId &&
                    a.CourtGroupId == block.CourtGroupId &&
                    a.PhaseId == block.PhaseId &&
                    a.IsActive);

            if (existing != null)
            {
                existing.ValidFromTime = block.StartTime.HasValue
                    ? TimeSpan.FromMinutes(block.StartTime.Value.Hour * 60 + block.StartTime.Value.Minute)
                    : null;
                existing.ValidToTime = block.EndTime.HasValue
                    ? TimeSpan.FromMinutes(block.EndTime.Value.Hour * 60 + block.EndTime.Value.Minute)
                    : null;
            }
            else
            {
                var assignment = new DivisionCourtAssignment
                {
                    DivisionId = block.DivisionId,
                    PhaseId = block.PhaseId,
                    CourtGroupId = block.CourtGroupId,
                    Priority = block.Priority ?? 0,
                    ValidFromTime = block.StartTime.HasValue
                        ? TimeSpan.FromMinutes(block.StartTime.Value.Hour * 60 + block.StartTime.Value.Minute)
                        : null,
                    ValidToTime = block.EndTime.HasValue
                        ? TimeSpan.FromMinutes(block.EndTime.Value.Hour * 60 + block.EndTime.Value.Minute)
                        : null,
                    IsActive = true
                };
                _context.DivisionCourtAssignments.Add(assignment);
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = $"Saved {request.Blocks.Count} block allocation(s)"
        });
    }
}
