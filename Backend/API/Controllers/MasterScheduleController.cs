using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pickleball.Community.Controllers.Base;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Services;

namespace Pickleball.Community.API.Controllers;

/// <summary>
/// Master Schedule Controller for managing event-wide schedule blocks.
/// Enables TDs to create a master schedule showing which divisions run
/// on which courts at what times, with dependency/handoff support.
/// </summary>
[ApiController]
[Route("tournament")]
public class MasterScheduleController : EventControllerBase
{
    private readonly ILogger<MasterScheduleController> _logger;
    private readonly IMasterScheduleService _masterScheduleService;

    public MasterScheduleController(
        ApplicationDbContext context,
        ILogger<MasterScheduleController> logger,
        IMasterScheduleService masterScheduleService)
        : base(context)
    {
        _logger = logger;
        _masterScheduleService = masterScheduleService;
    }

    // ============================================
    // Schedule Block CRUD Operations
    // ============================================

    /// <summary>
    /// Get all schedule blocks for an event
    /// </summary>
    [HttpGet("master-schedule/{eventId}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<EventCourtScheduleBlockDto>>>> GetScheduleBlocks(int eventId)
    {
        try
        {
            var blocks = await _masterScheduleService.GetScheduleBlocksAsync(eventId);
            return Ok(new ApiResponse<List<EventCourtScheduleBlockDto>>
            {
                Success = true,
                Data = blocks
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting schedule blocks for event {EventId}", eventId);
            return BadRequest(new ApiResponse<List<EventCourtScheduleBlockDto>>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    /// <summary>
    /// Create a new schedule block
    /// </summary>
    [Authorize]
    [HttpPost("master-schedule/{eventId}/blocks")]
    public async Task<ActionResult<ApiResponse<EventCourtScheduleBlockDto>>> CreateScheduleBlock(
        int eventId,
        [FromBody] CreateScheduleBlockRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<EventCourtScheduleBlockDto> { Success = false, Message = "Unauthorized" });

        if (!await CanManageEventAsync(eventId))
            return Forbid();

        try
        {
            var block = await _masterScheduleService.CreateScheduleBlockAsync(eventId, request, userId.Value);
            return Ok(new ApiResponse<EventCourtScheduleBlockDto>
            {
                Success = true,
                Data = block,
                Message = "Schedule block created successfully"
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse<EventCourtScheduleBlockDto>
            {
                Success = false,
                Message = ex.Message
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating schedule block for event {EventId}", eventId);
            return BadRequest(new ApiResponse<EventCourtScheduleBlockDto>
            {
                Success = false,
                Message = "An error occurred while creating the schedule block"
            });
        }
    }

    /// <summary>
    /// Update an existing schedule block
    /// </summary>
    [Authorize]
    [HttpPut("master-schedule/blocks/{blockId}")]
    public async Task<ActionResult<ApiResponse<EventCourtScheduleBlockDto>>> UpdateScheduleBlock(
        int blockId,
        [FromBody] UpdateScheduleBlockRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<EventCourtScheduleBlockDto> { Success = false, Message = "Unauthorized" });

        // Get the block to verify event ownership
        var existingBlock = await _masterScheduleService.GetScheduleBlockAsync(blockId);
        if (existingBlock == null)
            return NotFound(new ApiResponse<EventCourtScheduleBlockDto> { Success = false, Message = "Schedule block not found" });

        if (!await CanManageEventAsync(existingBlock.EventId))
            return Forbid();

        try
        {
            var block = await _masterScheduleService.UpdateScheduleBlockAsync(blockId, request, userId.Value);
            if (block == null)
                return NotFound(new ApiResponse<EventCourtScheduleBlockDto> { Success = false, Message = "Schedule block not found" });

            return Ok(new ApiResponse<EventCourtScheduleBlockDto>
            {
                Success = true,
                Data = block,
                Message = "Schedule block updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating schedule block {BlockId}", blockId);
            return BadRequest(new ApiResponse<EventCourtScheduleBlockDto>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    /// <summary>
    /// Delete a schedule block
    /// </summary>
    [Authorize]
    [HttpDelete("master-schedule/blocks/{blockId}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteScheduleBlock(int blockId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        // Get the block to verify event ownership
        var existingBlock = await _masterScheduleService.GetScheduleBlockAsync(blockId);
        if (existingBlock == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Schedule block not found" });

        if (!await CanManageEventAsync(existingBlock.EventId))
            return Forbid();

        try
        {
            var result = await _masterScheduleService.DeleteScheduleBlockAsync(blockId);
            if (!result)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Schedule block not found" });

            return Ok(new ApiResponse<bool>
            {
                Success = true,
                Data = true,
                Message = "Schedule block deleted successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting schedule block {BlockId}", blockId);
            return BadRequest(new ApiResponse<bool>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    // ============================================
    // Timeline & Auto-Schedule
    // ============================================

    /// <summary>
    /// Get timeline view data for master schedule visualization
    /// </summary>
    [HttpGet("master-schedule/{eventId}/timeline")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<MasterScheduleTimelineDto>>> GetTimeline(int eventId)
    {
        try
        {
            var timeline = await _masterScheduleService.GetTimelineAsync(eventId);
            return Ok(new ApiResponse<MasterScheduleTimelineDto>
            {
                Success = true,
                Data = timeline
            });
        }
        catch (ArgumentException ex)
        {
            return NotFound(new ApiResponse<MasterScheduleTimelineDto>
            {
                Success = false,
                Message = ex.Message
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting timeline for event {EventId}", eventId);
            return BadRequest(new ApiResponse<MasterScheduleTimelineDto>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    /// <summary>
    /// Run auto-scheduler for all blocks in an event.
    /// Schedules encounters within each block's time window and assigned courts.
    /// Respects block dependencies for handoff scheduling.
    /// </summary>
    [Authorize]
    [HttpPost("master-schedule/{eventId}/auto-schedule")]
    public async Task<ActionResult<ApiResponse<AutoScheduleResult>>> AutoSchedule(
        int eventId,
        [FromBody] AutoScheduleRequest? request = null)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<AutoScheduleResult> { Success = false, Message = "Unauthorized" });

        if (!await CanManageEventAsync(eventId))
            return Forbid();

        try
        {
            var result = await _masterScheduleService.AutoScheduleEventAsync(eventId, request ?? new AutoScheduleRequest());
            return Ok(new ApiResponse<AutoScheduleResult>
            {
                Success = result.Success,
                Data = result,
                Message = result.Message
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error running auto-schedule for event {EventId}", eventId);
            return BadRequest(new ApiResponse<AutoScheduleResult>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    /// <summary>
    /// Validate schedule blocks for conflicts (court overlaps, dependency violations)
    /// </summary>
    [HttpGet("master-schedule/{eventId}/validate")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<ScheduleBlockConflictDto>>>> ValidateSchedule(int eventId)
    {
        try
        {
            var conflicts = await _masterScheduleService.ValidateScheduleBlocksAsync(eventId);
            return Ok(new ApiResponse<List<ScheduleBlockConflictDto>>
            {
                Success = true,
                Data = conflicts,
                Message = conflicts.Count == 0 ? "No conflicts found" : $"{conflicts.Count} conflicts detected"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating schedule for event {EventId}", eventId);
            return BadRequest(new ApiResponse<List<ScheduleBlockConflictDto>>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    // ============================================
    // Player Schedule
    // ============================================

    /// <summary>
    /// Get authenticated player's personal schedule for an event.
    /// Returns all matches with times, courts, opponents, and status.
    /// </summary>
    [Authorize]
    [HttpGet("events/{eventId}/my-schedule")]
    public async Task<ActionResult<ApiResponse<PlayerScheduleDto>>> GetMySchedule(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<PlayerScheduleDto> { Success = false, Message = "Unauthorized" });

        try
        {
            var schedule = await _masterScheduleService.GetPlayerScheduleAsync(eventId, userId.Value);
            if (schedule == null)
                return NotFound(new ApiResponse<PlayerScheduleDto> { Success = false, Message = "Event not found" });

            return Ok(new ApiResponse<PlayerScheduleDto>
            {
                Success = true,
                Data = schedule
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting player schedule for user {UserId} in event {EventId}", userId, eventId);
            return BadRequest(new ApiResponse<PlayerScheduleDto>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    /// <summary>
    /// Get any player's schedule for an event (admin/TD only)
    /// </summary>
    [Authorize]
    [HttpGet("events/{eventId}/player-schedule/{playerId}")]
    public async Task<ActionResult<ApiResponse<PlayerScheduleDto>>> GetPlayerSchedule(int eventId, int playerId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<PlayerScheduleDto> { Success = false, Message = "Unauthorized" });

        // Only allow event managers to view other players' schedules
        if (playerId != userId.Value && !await CanManageEventAsync(eventId))
            return Forbid();

        try
        {
            var schedule = await _masterScheduleService.GetPlayerScheduleAsync(eventId, playerId);
            if (schedule == null)
                return NotFound(new ApiResponse<PlayerScheduleDto> { Success = false, Message = "Event or player not found" });

            return Ok(new ApiResponse<PlayerScheduleDto>
            {
                Success = true,
                Data = schedule
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting player schedule for player {PlayerId} in event {EventId}", playerId, eventId);
            return BadRequest(new ApiResponse<PlayerScheduleDto>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    // ============================================
    // Court Availability
    // ============================================

    /// <summary>
    /// Get all court availability for an event (defaults + overrides)
    /// </summary>
    [HttpGet("{eventId}/court-availability")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<CourtAvailabilitySummaryDto>>> GetCourtAvailability(int eventId)
    {
        try
        {
            var availability = await _masterScheduleService.GetCourtAvailabilityAsync(eventId);
            return Ok(new ApiResponse<CourtAvailabilitySummaryDto>
            {
                Success = true,
                Data = availability
            });
        }
        catch (ArgumentException ex)
        {
            return NotFound(new ApiResponse<CourtAvailabilitySummaryDto>
            {
                Success = false,
                Message = ex.Message
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting court availability for event {EventId}", eventId);
            return BadRequest(new ApiResponse<CourtAvailabilitySummaryDto>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    /// <summary>
    /// Set event-level default availability for a day.
    /// Applies to all courts unless they have a specific override.
    /// </summary>
    [Authorize]
    [HttpPost("{eventId}/court-availability")]
    public async Task<ActionResult<ApiResponse<CourtAvailabilityDto>>> SetEventDefaultAvailability(
        int eventId,
        [FromBody] SetEventDefaultAvailabilityRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<CourtAvailabilityDto> { Success = false, Message = "Unauthorized" });

        if (!await CanManageEventAsync(eventId))
            return Forbid();

        try
        {
            var result = await _masterScheduleService.SetEventDefaultAvailabilityAsync(eventId, request, userId.Value);
            return Ok(new ApiResponse<CourtAvailabilityDto>
            {
                Success = true,
                Data = result,
                Message = $"Set default availability for day {request.DayNumber}: {request.AvailableFrom} - {request.AvailableTo}"
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse<CourtAvailabilityDto>
            {
                Success = false,
                Message = ex.Message
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error setting default availability for event {EventId}", eventId);
            return BadRequest(new ApiResponse<CourtAvailabilityDto>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    /// <summary>
    /// Set court-specific availability override.
    /// Overrides the event default for this specific court.
    /// </summary>
    [Authorize]
    [HttpPut("courts/{courtId}/availability")]
    public async Task<ActionResult<ApiResponse<CourtAvailabilityDto>>> SetCourtAvailability(
        int courtId,
        [FromBody] SetCourtAvailabilityRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<CourtAvailabilityDto> { Success = false, Message = "Unauthorized" });

        // Get court to check event ownership
        var court = await _context.TournamentCourts.FindAsync(courtId);
        if (court == null)
            return NotFound(new ApiResponse<CourtAvailabilityDto> { Success = false, Message = "Court not found" });

        if (!await CanManageEventAsync(court.EventId))
            return Forbid();

        try
        {
            var result = await _masterScheduleService.SetCourtAvailabilityAsync(courtId, request, userId.Value);
            return Ok(new ApiResponse<CourtAvailabilityDto>
            {
                Success = true,
                Data = result,
                Message = $"Set availability override for court: {request.AvailableFrom} - {request.AvailableTo}"
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse<CourtAvailabilityDto>
            {
                Success = false,
                Message = ex.Message
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error setting court availability for court {CourtId}", courtId);
            return BadRequest(new ApiResponse<CourtAvailabilityDto>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    /// <summary>
    /// Remove court-specific availability override (falls back to event default)
    /// </summary>
    [Authorize]
    [HttpDelete("courts/{courtId}/availability")]
    public async Task<ActionResult<ApiResponse<bool>>> RemoveCourtAvailabilityOverride(
        int courtId,
        [FromQuery] int dayNumber = 1)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        // Get court to check event ownership
        var court = await _context.TournamentCourts.FindAsync(courtId);
        if (court == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Court not found" });

        if (!await CanManageEventAsync(court.EventId))
            return Forbid();

        try
        {
            var result = await _masterScheduleService.RemoveCourtAvailabilityOverrideAsync(courtId, dayNumber);
            if (!result)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "No override found for this court and day" });

            return Ok(new ApiResponse<bool>
            {
                Success = true,
                Data = true,
                Message = "Court availability override removed"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing court availability for court {CourtId}", courtId);
            return BadRequest(new ApiResponse<bool>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    /// <summary>
    /// Validate scheduled matches against court availability windows.
    /// Returns list of matches that fall outside their court's availability.
    /// </summary>
    [HttpGet("master-schedule/{eventId}/validate-availability")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<AvailabilityViolationDto>>>> ValidateAvailability(int eventId)
    {
        try
        {
            var violations = await _masterScheduleService.ValidateAvailabilityAsync(eventId);
            return Ok(new ApiResponse<List<AvailabilityViolationDto>>
            {
                Success = true,
                Data = violations,
                Message = violations.Count == 0 
                    ? "All matches are within court availability windows" 
                    : $"{violations.Count} matches are outside court availability"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating availability for event {EventId}", eventId);
            return BadRequest(new ApiResponse<List<AvailabilityViolationDto>>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }
}
