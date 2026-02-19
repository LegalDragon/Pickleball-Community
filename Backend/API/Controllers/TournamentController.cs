using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Constants;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Hubs;
using Pickleball.Community.Services;
using Pickleball.Community.Controllers.Base;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class TournamentController : EventControllerBase
{
    private readonly ILogger<TournamentController> _logger;
    private readonly IDrawingBroadcaster _drawingBroadcaster;
    private readonly INotificationService _notificationService;
    private readonly IBracketProgressionService _bracketProgressionService;
    private readonly IScoreBroadcaster _scoreBroadcaster;
    private readonly ICourtAssignmentService _courtAssignmentService;
    private readonly IEmailNotificationService _emailService;
    private readonly ITournamentRegistrationService _registrationService;
    private readonly ITournamentPaymentService _paymentService;
    private readonly ITournamentDrawingService _drawingService;
    private readonly ITournamentFeeService _feeService;
    private readonly ITournamentManagementService _managementService;

    public TournamentController(
        ApplicationDbContext context,
        ILogger<TournamentController> logger,
        IDrawingBroadcaster drawingBroadcaster,
        INotificationService notificationService,
        IBracketProgressionService bracketProgressionService,
        IScoreBroadcaster scoreBroadcaster,
        ICourtAssignmentService courtAssignmentService,
        IEmailNotificationService emailService,
        ITournamentRegistrationService registrationService,
        ITournamentPaymentService paymentService,
        ITournamentDrawingService drawingService,
        ITournamentFeeService feeService,
        ITournamentManagementService managementService)
        : base(context)
    {
        _logger = logger;
        _drawingBroadcaster = drawingBroadcaster;
        _notificationService = notificationService;
        _bracketProgressionService = bracketProgressionService;
        _scoreBroadcaster = scoreBroadcaster;
        _courtAssignmentService = courtAssignmentService;
        _emailService = emailService;
        _registrationService = registrationService;
        _paymentService = paymentService;
        _drawingService = drawingService;
        _feeService = feeService;
        _managementService = managementService;
    }

    // ============================================
    // Score Formats
    // ============================================

    [HttpGet("score-formats")]
    public async Task<ActionResult<ApiResponse<List<ScoreFormatDto>>>> GetScoreFormats()
    {
        var formats = await _context.ScoreFormats
            .Where(f => f.IsActive)
            .OrderBy(f => f.SortOrder)
            .Select(f => new ScoreFormatDto
            {
                Id = f.Id,
                Name = f.Name,
                Description = f.Description,
                ScoringType = f.ScoringType,
                MaxPoints = f.MaxPoints,
                WinByMargin = f.WinByMargin,
                SwitchEndsAtMidpoint = f.SwitchEndsAtMidpoint,
                MidpointScore = f.MidpointScore,
                TimeLimitMinutes = f.TimeLimitMinutes,
                IsTiebreaker = f.IsTiebreaker,
                IsDefault = f.IsDefault
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<ScoreFormatDto>> { Success = true, Data = formats });
    }

    [HttpGet("score-methods")]
    public async Task<ActionResult<ApiResponse<List<ScoreMethodDto>>>> GetScoreMethods()
    {
        var methods = await _context.ScoreMethods
            .Where(m => m.IsActive)
            .OrderBy(m => m.SortOrder)
            .Select(m => new ScoreMethodDto
            {
                Id = m.Id,
                Name = m.Name,
                Description = m.Description,
                BaseType = m.BaseType,
                SortOrder = m.SortOrder,
                IsActive = m.IsActive,
                IsDefault = m.IsDefault
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<ScoreMethodDto>> { Success = true, Data = methods });
    }

    [Authorize]
    [HttpPost("score-formats")]
    public async Task<ActionResult<ApiResponse<ScoreFormatDto>>> CreateScoreFormat([FromBody] CreateScoreFormatRequest request)
    {
        var format = new ScoreFormat
        {
            Name = request.Name,
            Description = request.Description,
            ScoreMethodId = request.ScoreMethodId,
            ScoringType = request.ScoringType ?? "Rally",
            MaxPoints = request.MaxPoints ?? 11,
            WinByMargin = request.WinByMargin ?? 2,
            CapAfter = request.CapAfter ?? 0,
            SwitchEndsAtMidpoint = request.SwitchEndsAtMidpoint ?? false,
            MidpointScore = request.MidpointScore,
            TimeLimitMinutes = request.TimeLimitMinutes,
            IsTiebreaker = request.IsTiebreaker ?? false,
            IsDefault = false,
            IsActive = true,
            SortOrder = 100,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _context.ScoreFormats.Add(format);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<ScoreFormatDto>
        {
            Success = true,
            Data = new ScoreFormatDto
            {
                Id = format.Id,
                Name = format.Name,
                Description = format.Description,
                ScoreMethodId = format.ScoreMethodId,
                ScoringType = format.ScoringType,
                MaxPoints = format.MaxPoints,
                WinByMargin = format.WinByMargin,
                CapAfter = format.CapAfter,
                SwitchEndsAtMidpoint = format.SwitchEndsAtMidpoint,
                MidpointScore = format.MidpointScore,
                TimeLimitMinutes = format.TimeLimitMinutes,
                IsTiebreaker = format.IsTiebreaker,
                IsDefault = format.IsDefault
            }
        });
    }


    // ============================================
    // Tournament Courts
    // ============================================

    [HttpGet("events/{eventId}/courts")]
    public async Task<ActionResult<ApiResponse<List<TournamentCourtDto>>>> GetTournamentCourts(int eventId)
    {
        var courts = await _context.TournamentCourts
            .Include(c => c.Venue)
            .Include(c => c.CurrentGame)
                .ThenInclude(g => g!.EncounterMatch)
                    .ThenInclude(m => m!.Encounter)
            .Where(c => c.EventId == eventId && c.IsActive)
            .OrderBy(c => c.SortOrder)
            .Select(c => new TournamentCourtDto
            {
                Id = c.Id,
                EventId = c.EventId,
                VenueId = c.VenueId,
                VenueName = c.Venue != null ? c.Venue.Name : null,
                CourtLabel = c.CourtLabel,
                Status = c.Status,
                CurrentGameId = c.CurrentGameId,
                LocationDescription = c.LocationDescription,
                SortOrder = c.SortOrder
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<TournamentCourtDto>> { Success = true, Data = courts });
    }

    [Authorize]
    [HttpPost("events/{eventId}/courts")]
    public async Task<ActionResult<ApiResponse<TournamentCourtDto>>> CreateTournamentCourt(int eventId, [FromBody] CreateTournamentCourtRequest request)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<TournamentCourtDto> { Success = false, Message = "Event not found" });

        var court = new TournamentCourt
        {
            EventId = eventId,
            VenueId = request.VenueId,
            CourtLabel = request.CourtLabel,
            LocationDescription = request.LocationDescription,
            SortOrder = request.SortOrder,
            Status = "Available",
            IsActive = true
        };

        _context.TournamentCourts.Add(court);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<TournamentCourtDto>
        {
            Success = true,
            Data = new TournamentCourtDto
            {
                Id = court.Id,
                EventId = court.EventId,
                VenueId = court.VenueId,
                CourtLabel = court.CourtLabel,
                Status = court.Status,
                LocationDescription = court.LocationDescription,
                SortOrder = court.SortOrder
            }
        });
    }

    /// <summary>
    /// Bulk create multiple courts at once
    /// </summary>
    [Authorize]
    [HttpPost("events/{eventId}/courts/bulk")]
    public async Task<ActionResult<ApiResponse<List<TournamentCourtDto>>>> BulkCreateCourts(int eventId, [FromBody] BulkCreateCourtsRequest request)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<List<TournamentCourtDto>> { Success = false, Message = "Event not found" });

        if (request.NumberOfCourts <= 0 || request.NumberOfCourts > 100)
            return BadRequest(new ApiResponse<List<TournamentCourtDto>> { Success = false, Message = "Number of courts must be between 1 and 100" });

        // Get the current max sort order
        var maxSortOrder = await _context.TournamentCourts
            .Where(c => c.EventId == eventId)
            .MaxAsync(c => (int?)c.SortOrder) ?? 0;

        var prefix = string.IsNullOrWhiteSpace(request.LabelPrefix) ? "Court" : request.LabelPrefix.Trim();
        var courts = new List<TournamentCourt>();

        for (int i = 0; i < request.NumberOfCourts; i++)
        {
            var courtNumber = request.StartingNumber + i;
            var court = new TournamentCourt
            {
                EventId = eventId,
                CourtLabel = $"{prefix} {courtNumber}",
                SortOrder = maxSortOrder + i + 1,
                Status = "Available",
                IsActive = true
            };
            courts.Add(court);
            _context.TournamentCourts.Add(court);
        }

        await _context.SaveChangesAsync();

        var result = courts.Select(c => new TournamentCourtDto
        {
            Id = c.Id,
            EventId = c.EventId,
            CourtLabel = c.CourtLabel,
            Status = c.Status,
            SortOrder = c.SortOrder
        }).ToList();

        return Ok(new ApiResponse<List<TournamentCourtDto>>
        {
            Success = true,
            Data = result,
            Message = $"Created {courts.Count} court{(courts.Count > 1 ? "s" : "")}"
        });
    }


    // ============================================
    // Match Scheduling
    // ============================================

    [Authorize]
    [HttpPost("divisions/{divisionId}/generate-schedule")]
    public async Task<ActionResult<ApiResponse<List<EventMatchDto>>>> GenerateSchedule(int divisionId, [FromBody] CreateMatchScheduleRequest request)
    {
        try
        {
        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .Include(d => d.TeamUnit)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<List<EventMatchDto>> { Success = false, Message = "Division not found" });

        var evt = division.Event;
        if (evt == null)
            return NotFound(new ApiResponse<List<EventMatchDto>> { Success = false, Message = "Event not found" });

        // Validation: Check if registration is closed (unless using placeholder units)
        var now = DateTime.Now;
        var isRegistrationOpen = evt.TournamentStatus == "RegistrationOpen" ||
            (evt.RegistrationOpenDate <= now && (evt.RegistrationCloseDate == null || evt.RegistrationCloseDate > now));

        // Allow schedule generation with placeholders even during registration
        // But warn if actual units are being assigned while registration is open
        if (isRegistrationOpen && request.TargetUnits == null)
        {
            return BadRequest(new ApiResponse<List<EventMatchDto>>
            {
                Success = false,
                Message = "Cannot generate final schedule while registration is still open. Either close registration first, or use TargetUnits to generate a template schedule."
            });
        }

        var units = await _context.EventUnits
            .Include(u => u.Members)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .OrderBy(u => u.Seed ?? 999)
            .ThenBy(u => u.Id)
            .ToListAsync();

        // Validation: Check if all units are complete (have required members)
        if (request.TargetUnits == null && units.Any())
        {
            var requiredMembers = division.TeamUnit?.TotalPlayers ?? division.TeamSize;
            var incompleteUnits = units.Where(u =>
                u.Members.Count(m => m.InviteStatus == "Accepted") < requiredMembers).ToList();

            if (incompleteUnits.Any())
            {
                var unitNames = string.Join(", ", incompleteUnits.Take(5).Select(u => u.Name));
                var message = incompleteUnits.Count > 5
                    ? $"Units not complete: {unitNames} and {incompleteUnits.Count - 5} more"
                    : $"Units not complete: {unitNames}";
                return BadRequest(new ApiResponse<List<EventMatchDto>>
                {
                    Success = false,
                    Message = $"Cannot generate schedule. {message}. Each unit needs {requiredMembers} accepted member(s)."
                });
            }
        }

        // Use targetUnits if provided, otherwise use actual unit count
        var targetUnitCount = request.TargetUnits ?? units.Count;

        if (targetUnitCount < 2)
            return BadRequest(new ApiResponse<List<EventMatchDto>> { Success = false, Message = "Need at least 2 units/placeholders to generate schedule" });

        // Clear existing matches and games for this division
        var existingMatches = await _context.EventEncounters
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .Where(m => m.DivisionId == divisionId)
            .ToListAsync();

        if (existingMatches.Any())
        {
            // Clear TournamentCourt references to games in this division first
            // Using a subquery approach to avoid OPENJSON issues with List.Contains()
            var courtsWithGames = await _context.TournamentCourts
                .Where(c => c.CurrentGameId != null &&
                    _context.EventGames.Any(g => g.Id == c.CurrentGameId &&
                        _context.EncounterMatches.Any(em => em.Id == g.EncounterMatchId &&
                            _context.EventEncounters.Any(m => m.Id == em.EncounterId && m.DivisionId == divisionId))))
                .ToListAsync();

            foreach (var court in courtsWithGames)
            {
                court.CurrentGameId = null;
                court.Status = "Available";
            }

            // Get all game IDs for this division to delete score history first
            var gameIds = existingMatches
                .SelectMany(e => e.Matches)
                .SelectMany(m => m.Games)
                .Select(g => g.Id)
                .ToList();

            // Delete score history for these games (must be done before deleting games due to FK constraint)
            if (gameIds.Any())
            {
                try
                {
                    var scoreHistories = await _context.EventGameScoreHistories
                        .Where(h => gameIds.Contains(h.GameId))
                        .ToListAsync();
                    if (scoreHistories.Any())
                    {
                        _context.EventGameScoreHistories.RemoveRange(scoreHistories);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Could not delete score histories for division {DivisionId} - table may not exist", divisionId);
                }
            }

            // Delete games first, then matches
            foreach (var encounter in existingMatches)
            {
                var allGames = encounter.Matches.SelectMany(m => m.Games).ToList();
                _context.EventGames.RemoveRange(allGames);
                _context.EncounterMatches.RemoveRange(encounter.Matches);
            }
            _context.EventEncounters.RemoveRange(existingMatches);
            await _context.SaveChangesAsync();
        }

        // Also clear unit number assignments since schedule is being regenerated
        foreach (var unit in units)
        {
            unit.UnitNumber = null;
            unit.PoolNumber = null;
            unit.PoolName = null;
        }

        var matches = new List<EventEncounter>();

        if (request.ScheduleType == "RoundRobin" || request.ScheduleType == "Hybrid")
        {
            matches.AddRange(GenerateRoundRobinMatchesForTarget(division, targetUnitCount, request));
        }
        else if (request.ScheduleType == "RoundRobinPlayoff")
        {
            // Generate pool play matches
            matches.AddRange(GenerateRoundRobinMatchesForTarget(division, targetUnitCount, request));

            // Generate playoff bracket matches
            var playoffUnits = (request.PlayoffFromPools ?? 2) * (request.PoolCount ?? 1);
            var playoffMatches = GeneratePlayoffMatchesForTarget(division, playoffUnits, request);
            matches.AddRange(playoffMatches);
        }
        else if (request.ScheduleType == "SingleElimination")
        {
            matches.AddRange(GenerateSingleEliminationMatchesForTarget(division, targetUnitCount, request));
        }
        else if (request.ScheduleType == "DoubleElimination")
        {
            matches.AddRange(GenerateDoubleEliminationMatchesForTarget(division, targetUnitCount, request));
        }

        _context.EventEncounters.AddRange(matches);
        await _context.SaveChangesAsync();

        // Determine phase-specific configurations
        var poolGamesPerMatch = request.PoolGamesPerMatch ?? request.BestOf;
        var playoffGamesPerMatch = request.PlayoffGamesPerMatch ?? request.BestOf;
        var poolScoreFormatId = request.PoolScoreFormatId ?? request.ScoreFormatId;
        var playoffScoreFormatId = request.PlayoffScoreFormatId ?? request.ScoreFormatId;

        // Update division settings
        division.PoolCount = request.PoolCount;
        division.BracketType = request.ScheduleType;
        division.PlayoffFromPools = request.PlayoffFromPools;
        division.GamesPerMatch = request.BestOf;
        division.DefaultScoreFormatId = request.ScoreFormatId;
        division.TargetUnitCount = targetUnitCount;
        await _context.SaveChangesAsync();

        // Create EncounterMatch and games for each encounter based on phase
        foreach (var encounter in matches)
        {
            // Determine if this is a pool match or playoff match
            var isPoolMatch = encounter.RoundType == "Pool";
            var gamesPerMatch = isPoolMatch ? poolGamesPerMatch : playoffGamesPerMatch;
            var scoreFormatId = isPoolMatch ? poolScoreFormatId : playoffScoreFormatId;

            // Update encounter with correct games per match
            encounter.BestOf = gamesPerMatch;
            encounter.ScoreFormatId = scoreFormatId;

            // Create default EncounterMatch for simple divisions (MatchesPerEncounter=1)
            var encounterMatch = new EncounterMatch
            {
                EncounterId = encounter.Id,
                MatchOrder = 1,
                Status = "Scheduled",
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            _context.EncounterMatches.Add(encounterMatch);
        }
        await _context.SaveChangesAsync();

        // Now create games for each EncounterMatch
        foreach (var encounter in matches)
        {
            var isPoolMatch = encounter.RoundType == "Pool";
            var gamesPerMatch = isPoolMatch ? poolGamesPerMatch : playoffGamesPerMatch;
            var scoreFormatId = isPoolMatch ? poolScoreFormatId : playoffScoreFormatId;

            // Get the EncounterMatch we just created
            var encounterMatch = await _context.EncounterMatches
                .FirstOrDefaultAsync(m => m.EncounterId == encounter.Id);

            if (encounterMatch != null)
            {
                for (int g = 1; g <= gamesPerMatch; g++)
                {
                    var game = new EventGame
                    {
                        EncounterMatchId = encounterMatch.Id,
                        GameNumber = g,
                        ScoreFormatId = scoreFormatId,
                        Status = "New",
                        CreatedAt = DateTime.Now,
                        UpdatedAt = DateTime.Now
                    };
                    _context.EventGames.Add(game);
                }
            }
        }
        await _context.SaveChangesAsync();

        // Assign sequential DivisionMatchNumber to all encounters in the division
        await _context.Database.ExecuteSqlRawAsync(
            "EXEC sp_AssignDivisionMatchNumbers @DivisionId = {0}",
            divisionId);

        // Reload with games
        var result = await _context.EventEncounters
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .Where(m => m.DivisionId == divisionId)
            .OrderBy(m => m.RoundNumber)
            .ThenBy(m => m.EncounterNumber)
            .ToListAsync();

        return Ok(new ApiResponse<List<EventMatchDto>>
        {
            Success = true,
            Data = result.Select(m => MapToMatchDto(m)).ToList()
        });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating schedule for division {DivisionId}", divisionId);
            var innerMessage = ex.InnerException?.Message ?? "";
            var fullMessage = string.IsNullOrEmpty(innerMessage)
                ? ex.Message
                : $"{ex.Message} Inner: {innerMessage}";
            return StatusCode(500, new ApiResponse<List<EventMatchDto>>
            {
                Success = false,
                Message = $"Error generating schedule: {fullMessage}",
                Data = null
            });
        }
    }

    [Authorize]
    [HttpPost("divisions/{divisionId}/assign-unit-numbers")]
    public async Task<ActionResult<ApiResponse<List<EventUnitDto>>>> AssignUnitNumbers(int divisionId, [FromBody] AssignUnitNumbersRequest? request = null)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .Include(d => d.TeamUnit)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<List<EventUnitDto>> { Success = false, Message = "Division not found" });

        var evt = division.Event;
        if (evt == null)
            return NotFound(new ApiResponse<List<EventUnitDto>> { Success = false, Message = "Event not found" });

        // Validation: Check if registration is closed before drawing
        var now = DateTime.Now;
        var isRegistrationOpen = evt.TournamentStatus == "RegistrationOpen" ||
            (evt.RegistrationOpenDate <= now && (evt.RegistrationCloseDate == null || evt.RegistrationCloseDate > now));

        if (isRegistrationOpen)
        {
            return BadRequest(new ApiResponse<List<EventUnitDto>>
            {
                Success = false,
                Message = "Cannot assign unit numbers while registration is still open. Close registration first."
            });
        }

        // Concurrency check: Verify schedule status to prevent race conditions
        if (division.ScheduleStatus == "Finalized")
        {
            return BadRequest(new ApiResponse<List<EventUnitDto>>
            {
                Success = false,
                Message = "Schedule is already finalized. Clear the schedule first if you need to redraw."
            });
        }

        var units = await _context.EventUnits
            .Include(u => u.Members)
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .ToListAsync();

        if (!units.Any())
            return BadRequest(new ApiResponse<List<EventUnitDto>> { Success = false, Message = "No units to assign" });

        // Validation: Check if all units are complete
        var requiredMembers = division.TeamUnit?.TotalPlayers ?? division.TeamSize;
        var incompleteUnits = units.Where(u =>
            u.Members.Count(m => m.InviteStatus == "Accepted") < requiredMembers).ToList();

        if (incompleteUnits.Any())
        {
            var unitNames = string.Join(", ", incompleteUnits.Take(5).Select(u => u.Name));
            var message = incompleteUnits.Count > 5
                ? $"Units not complete: {unitNames} and {incompleteUnits.Count - 5} more"
                : $"Units not complete: {unitNames}";
            return BadRequest(new ApiResponse<List<EventUnitDto>>
            {
                Success = false,
                Message = $"Cannot draw units. {message}. Each unit needs {requiredMembers} accepted member(s)."
            });
        }

        // If specific assignments provided (from drawing), use them
        if (request?.Assignments != null && request.Assignments.Any())
        {
            foreach (var assignment in request.Assignments)
            {
                var unit = units.FirstOrDefault(u => u.Id == assignment.UnitId);
                if (unit != null)
                {
                    unit.UnitNumber = assignment.UnitNumber;
                    unit.UpdatedAt = DateTime.Now;
                }
            }
        }
        else
        {
            // Fallback to random assignment
            var random = new Random();
            var shuffled = units.OrderBy(x => random.Next()).ToList();

            for (int i = 0; i < shuffled.Count; i++)
            {
                shuffled[i].UnitNumber = i + 1;
                shuffled[i].UpdatedAt = DateTime.Now;
            }
        }

        // Update matches with actual unit IDs based on assigned numbers
        var matches = await _context.EventEncounters
            .Where(m => m.DivisionId == divisionId)
            .ToListAsync();

        foreach (var match in matches)
        {
            // Find unit by their assigned number
            match.Unit1Id = units.FirstOrDefault(u => u.UnitNumber == match.Unit1Number)?.Id;
            match.Unit2Id = units.FirstOrDefault(u => u.UnitNumber == match.Unit2Number)?.Id;
            match.UpdatedAt = DateTime.Now;

            // Handle byes - if one unit is null (empty slot), mark match appropriately
            if (match.Unit1Id == null && match.Unit2Id != null)
            {
                // Unit 2 gets a bye - auto-advance
                match.WinnerUnitId = match.Unit2Id;
                match.Status = "Bye";
            }
            else if (match.Unit2Id == null && match.Unit1Id != null)
            {
                // Unit 1 gets a bye - auto-advance
                match.WinnerUnitId = match.Unit1Id;
                match.Status = "Bye";
            }
        }

        // Update division schedule status to reflect units have been assigned
        division.ScheduleStatus = "UnitsAssigned";
        division.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        var result = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled")
            .OrderBy(u => u.UnitNumber)
            .ToListAsync();

        return Ok(new ApiResponse<List<EventUnitDto>>
        {
            Success = true,
            Data = result.Select(MapToUnitDto).ToList()
        });
    }

    /// <summary>
    /// Get match statistics for a division including total encounters, matches, and games
    /// </summary>
    [HttpGet("divisions/{divisionId}/match-stats")]
    public async Task<ActionResult<ApiResponse<DivisionMatchStatsDto>>> GetDivisionMatchStats(int divisionId)
    {
        var division = await _context.EventDivisions
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<DivisionMatchStatsDto> { Success = false, Message = "Division not found" });

        var encounters = await _context.EventEncounters
            .Where(e => e.DivisionId == divisionId)
            .Select(e => new
            {
                e.Id,
                e.Status,
                MatchCount = e.Matches.Count,
                CompletedMatchCount = e.Matches.Count(m => m.Status == "Completed"),
                GameCount = e.Matches.SelectMany(m => m.Games).Count(),
                CompletedGameCount = e.Matches.SelectMany(m => m.Games).Count(g => g.Status == "Completed")
            })
            .ToListAsync();

        var stats = new DivisionMatchStatsDto
        {
            DivisionId = divisionId,
            DivisionName = division.Name,
            TotalEncounters = encounters.Count,
            TotalMatches = encounters.Sum(e => e.MatchCount),
            TotalGames = encounters.Sum(e => e.GameCount),
            CompletedEncounters = encounters.Count(e => e.Status == "Completed"),
            CompletedMatches = encounters.Sum(e => e.CompletedMatchCount),
            CompletedGames = encounters.Sum(e => e.CompletedGameCount),
            InProgressEncounters = encounters.Count(e => e.Status == "InProgress"),
            ScheduledEncounters = encounters.Count(e => e.Status == "Scheduled")
        };

        return Ok(new ApiResponse<DivisionMatchStatsDto>
        {
            Success = true,
            Data = stats
        });
    }

    [HttpGet("divisions/{divisionId}/schedule")]
    public async Task<ActionResult<ApiResponse<ScheduleExportDto>>> GetSchedule(int divisionId)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Event).ThenInclude(e => e!.DefaultScoreFormat)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<ScheduleExportDto> { Success = false, Message = "Division not found" });

        var matches = await _context.EventEncounters
            .Include(m => m.Unit1)
            .Include(m => m.Unit2)
            .Include(m => m.Winner)
            .Include(m => m.TournamentCourt)
            .Include(m => m.Matches).ThenInclude(match => match.Games).ThenInclude(game => game.TournamentCourt)
            .Where(m => m.DivisionId == divisionId)
            .OrderBy(m => m.RoundType)
            .ThenBy(m => m.RoundNumber)
            .ThenBy(m => m.EncounterNumber)
            .ToListAsync();

        // Get pool count from division settings or infer from encounters
        var poolEncounters = matches.Where(m => m.RoundType == "Pool").ToList();
        var poolCount = poolEncounters.Any()
            ? poolEncounters.Max(m => m.RoundNumber)
            : division.PoolCount ?? 2; // Default to 2 pools if not specified

        // Extract pool assignments from pool encounters as fallback (for units without UnitNumber)
        var unitPoolAssignmentsFromEncounters = new Dictionary<int, (int PoolNumber, string PoolName)>();
        foreach (var enc in poolEncounters)
        {
            var poolNum = enc.RoundNumber;
            var poolName = enc.RoundName ?? $"Pool {(char)('A' + poolNum - 1)}";

            if (enc.Unit1Id.HasValue && !unitPoolAssignmentsFromEncounters.ContainsKey(enc.Unit1Id.Value))
                unitPoolAssignmentsFromEncounters[enc.Unit1Id.Value] = (poolNum, poolName);
            if (enc.Unit2Id.HasValue && !unitPoolAssignmentsFromEncounters.ContainsKey(enc.Unit2Id.Value))
                unitPoolAssignmentsFromEncounters[enc.Unit2Id.Value] = (poolNum, poolName);
        }

        // Include members to show team composition
        // Order: pool number, then by matches won (for standings after games), then by point differential, then by unit number (for drawing results)
        var units = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled")
            .OrderBy(u => u.PoolNumber)
            .ThenByDescending(u => u.MatchesWon)
            .ThenByDescending(u => u.PointsScored - u.PointsAgainst)
            .ThenBy(u => u.UnitNumber)
            .ToListAsync();

        // Apply pool assignments to units (for display purposes)
        // Priority: 1) Calculate from UnitNumber (deterministic), 2) From encounters (fallback)
        foreach (var unit in units)
        {
            if (!unit.PoolNumber.HasValue || unit.PoolNumber == 0)
            {
                // Calculate pool from UnitNumber if available (most reliable)
                // Pool assignment: odd UnitNumbers to Pool 1, even to Pool 2 (for 2 pools)
                // General formula: ((UnitNumber - 1) % poolCount) + 1
                if (unit.UnitNumber.HasValue && unit.UnitNumber > 0 && poolCount > 0)
                {
                    var calculatedPool = ((unit.UnitNumber.Value - 1) % poolCount) + 1;
                    unit.PoolNumber = calculatedPool;
                    unit.PoolName = $"Pool {(char)('A' + calculatedPool - 1)}";
                }
                // Fallback to encounter-derived pool info
                else if (unitPoolAssignmentsFromEncounters.TryGetValue(unit.Id, out var poolInfo))
                {
                    unit.PoolNumber = poolInfo.PoolNumber;
                    unit.PoolName = poolInfo.PoolName;
                }
            }
        }

        // Re-sort units after applying pool assignments
        units = units
            .OrderBy(u => u.PoolNumber ?? 99)
            .ThenByDescending(u => u.MatchesWon)
            .ThenByDescending(u => u.PointsScored - u.PointsAgainst)
            .ThenBy(u => u.UnitNumber)
            .ToList();

        // Build lookup for unit pool/rank info (for playoff seed descriptions)
        var unitPoolInfo = new Dictionary<int, (string PoolName, int Rank)>();
        var poolGroups = units.GroupBy(u => u.PoolNumber ?? 0).OrderBy(g => g.Key);
        foreach (var poolGroup in poolGroups)
        {
            var poolName = poolGroup.First().PoolName ?? $"Pool {poolGroup.Key}";
            int rank = 1;
            foreach (var unit in poolGroup)
            {
                if (unit.Id > 0)
                    unitPoolInfo[unit.Id] = (poolName, rank);
                rank++;
            }
        }

        // Build lookup for unit display names (FirstName1 + FirstName2 for pairs)
        var unitDisplayNames = units.ToDictionary(
            u => u.Id,
            u => Utility.FormatUnitDisplayName(u.Members, u.Name)
        );

        // Helper to get display name for a unit
        string? GetUnitDisplayName(int? unitId)
        {
            if (!unitId.HasValue || !unitDisplayNames.ContainsKey(unitId.Value))
                return null;
            return unitDisplayNames[unitId.Value];
        }

        // Helper to get seed info for a unit in playoff matches
        string? GetSeedInfo(int? unitId)
        {
            if (!unitId.HasValue || !unitPoolInfo.ContainsKey(unitId.Value))
                return null;
            var info = unitPoolInfo[unitId.Value];
            return $"{info.PoolName} #{info.Rank}";
        }

        // Build court lookup for games - load all courts for this event to avoid EF Core CTE issue with Contains()
        var courts = await _context.TournamentCourts
            .Where(c => c.EventId == division.EventId)
            .ToDictionaryAsync(c => c.Id, c => c.CourtLabel);

        // Helper to get court label for an encounter
        // Priority: 1) Encounter-level TournamentCourtId (from planning), 2) Game-level TournamentCourtId
        string? GetCourtLabel(EventEncounter encounter)
        {
            // Check encounter-level court assignment first (set by court planning)
            if (encounter.TournamentCourtId.HasValue && courts.TryGetValue(encounter.TournamentCourtId.Value, out var encounterLabel))
                return encounterLabel;

            // Fallback to game-level court assignment
            var game = encounter.Matches
                .SelectMany(em => em.Games)
                .FirstOrDefault(g => g.TournamentCourtId.HasValue);
            if (game?.TournamentCourtId != null && courts.TryGetValue(game.TournamentCourtId.Value, out var gameLabel))
                return gameLabel;
            return null;
        }

        var schedule = new ScheduleExportDto
        {
            DivisionId = divisionId,
            DivisionName = division.Name,
            EventName = division.Event?.Name ?? "",
            ScheduleType = division.ScheduleType,
            PlayoffFromPools = division.PlayoffFromPools,
            MatchesPerEncounter = division.MatchesPerEncounter,
            GamesPerMatch = division.GamesPerMatch,
            DefaultScoreFormat = division.Event?.DefaultScoreFormat?.Name,
            ExportedAt = DateTime.Now,
            Rounds = matches
                // Include all matches - show position numbers before drawing, team names after
                .GroupBy(m => new { m.RoundType, m.RoundNumber, m.RoundName })
                .OrderBy(g => g.Key.RoundType == "Pool" ? 0 : (g.Key.RoundType == "Bracket" || g.Key.RoundType == RoundType.ThirdPlace) ? 1 : 2)
                .ThenBy(g => g.Key.RoundNumber)
                .Select(g => new ScheduleRoundDto
                {
                    RoundType = g.Key.RoundType,
                    RoundNumber = g.Key.RoundNumber,
                    RoundName = g.Key.RoundName,
                    Matches = g.Select(m => new ScheduleMatchDto
                    {
                        EncounterId = m.Id,
                        MatchNumber = m.MatchNumber,
                        DivisionMatchNumber = m.DivisionMatchNumber,
                        Unit1Number = m.Unit1Number,
                        Unit2Number = m.Unit2Number,
                        Unit1Name = GetUnitDisplayName(m.Unit1Id) ?? m.Unit1?.Name,
                        Unit2Name = GetUnitDisplayName(m.Unit2Id) ?? m.Unit2?.Name,
                        // Add seed info for playoff (Bracket) and bronze medal (ThirdPlace) matches
                        // Use stored seed label if unit not assigned yet, otherwise calculate from pool position
                        Unit1SeedInfo = (g.Key.RoundType == "Bracket" || g.Key.RoundType == RoundType.ThirdPlace)
                            ? (m.Unit1Id == null ? m.Unit1SeedLabel : GetSeedInfo(m.Unit1Id))
                            : null,
                        Unit2SeedInfo = (g.Key.RoundType == "Bracket" || g.Key.RoundType == RoundType.ThirdPlace)
                            ? (m.Unit2Id == null ? m.Unit2SeedLabel : GetSeedInfo(m.Unit2Id))
                            : null,
                        IsBye = (m.Unit1Id == null) != (m.Unit2Id == null), // One but not both is null
                        CourtId = m.TournamentCourtId,
                        CourtLabel = GetCourtLabel(m),
                        ScheduledTime = m.ScheduledTime,
                        StartedAt = m.StartedAt,
                        CompletedAt = m.CompletedAt,
                        Status = m.Status,
                        Score = GetMatchScore(m),
                        WinnerName = GetUnitDisplayName(m.WinnerUnitId) ?? m.Winner?.Name,
                        Games = m.Matches.SelectMany(match => match.Games).OrderBy(game => game.GameNumber).Select(game => new ScheduleGameDto
                        {
                            GameId = game.Id,
                            GameNumber = game.GameNumber,
                            Unit1Score = game.Unit1Score,
                            Unit2Score = game.Unit2Score,
                            TournamentCourtId = game.TournamentCourtId,
                            CourtLabel = game.TournamentCourtId.HasValue && courts.TryGetValue(game.TournamentCourtId.Value, out var courtLabel) ? courtLabel : null,
                            Status = game.Status,
                            StartedAt = game.StartedAt,
                            CompletedAt = game.FinishedAt
                        }).ToList()
                    }).ToList()
                }).ToList(),
            // Group by PoolName first (if set), then by PoolNumber as fallback
            // This handles cases where PoolName is set but PoolNumber is null
            PoolStandings = units.GroupBy(u => u.PoolName ?? $"Pool {u.PoolNumber ?? 0}")
                .OrderBy(g => g.First().PoolNumber ?? 0)
                .ThenBy(g => g.Key)
                .Select(g => new PoolStandingsDto
                {
                    PoolNumber = g.First().PoolNumber ?? 0,
                    PoolName = g.Key,
                    Standings = g.Select((u, idx) => new PoolStandingEntryDto
                    {
                        Rank = idx + 1,
                        PoolNumber = u.PoolNumber ?? 0,
                        PoolName = u.PoolName ?? $"Pool {u.PoolNumber ?? 0}",
                        UnitId = u.Id,
                        UnitNumber = u.UnitNumber,
                        UnitName = Utility.FormatUnitDisplayName(u.Members, u.Name),
                        Members = u.Members
                            .Where(m => m.User != null)
                            .Select(m => new TeamMemberInfoDto
                            {
                                UserId = m.UserId,
                                FirstName = m.User!.FirstName,
                                LastName = m.User.LastName,
                                ProfileImageUrl = m.User.ProfileImageUrl
                            })
                            .ToList(),
                        MatchesPlayed = u.MatchesPlayed,
                        MatchesWon = u.MatchesWon,
                        MatchesLost = u.MatchesLost,
                        GamesWon = u.GamesWon,
                        GamesLost = u.GamesLost,
                        PointsFor = u.PointsScored,
                        PointsAgainst = u.PointsAgainst,
                        PointDifferential = u.PointsScored - u.PointsAgainst
                    }).ToList()
                }).ToList()
        };

        return Ok(new ApiResponse<ScheduleExportDto> { Success = true, Data = schedule });
    }

    [HttpGet("divisions/{divisionId}/scoresheet")]
    public async Task<IActionResult> DownloadScoresheet(int divisionId)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Division not found" });

        var encounters = await _context.EventEncounters
            .Include(m => m.Unit1).ThenInclude(u => u!.Members).ThenInclude(m => m.User)
            .Include(m => m.Unit2).ThenInclude(u => u!.Members).ThenInclude(m => m.User)
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .Where(m => m.DivisionId == divisionId)
            .OrderBy(m => m.RoundType)
            .ThenBy(m => m.RoundNumber)
            .ThenBy(m => m.EncounterNumber)
            .ToListAsync();

        var units = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled")
            .OrderBy(u => u.UnitNumber)
            .ToListAsync();

        // Generate Excel file using ClosedXML
        using var workbook = new ClosedXML.Excel.XLWorkbook();

        // Sheet 1: Drawing Results
        var drawingSheet = workbook.Worksheets.Add("Drawing Results");
        drawingSheet.Cell(1, 1).Value = division.Event?.Name ?? "Event";
        drawingSheet.Cell(1, 1).Style.Font.Bold = true;
        drawingSheet.Cell(1, 1).Style.Font.FontSize = 16;
        drawingSheet.Cell(2, 1).Value = division.Name;
        drawingSheet.Cell(2, 1).Style.Font.Bold = true;
        drawingSheet.Cell(2, 1).Style.Font.FontSize = 14;
        drawingSheet.Cell(3, 1).Value = $"Generated: {DateTime.Now:g}";

        // Drawing results table
        drawingSheet.Cell(5, 1).Value = "#";
        drawingSheet.Cell(5, 2).Value = "Team Name";
        drawingSheet.Cell(5, 3).Value = "Players";
        drawingSheet.Range(5, 1, 5, 3).Style.Font.Bold = true;
        drawingSheet.Range(5, 1, 5, 3).Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;

        int row = 6;
        foreach (var unit in units)
        {
            drawingSheet.Cell(row, 1).Value = unit.UnitNumber ?? 0;
            drawingSheet.Cell(row, 2).Value = unit.Name;
            drawingSheet.Cell(row, 3).Value = string.Join(", ", unit.Members.Select(m =>
                $"{m.User?.FirstName} {m.User?.LastName}".Trim()));
            row++;
        }
        drawingSheet.Columns().AdjustToContents();

        // Sheet 2: Match Schedule with scoresheet
        var scheduleSheet = workbook.Worksheets.Add("Scoresheet");
        scheduleSheet.Cell(1, 1).Value = division.Event?.Name ?? "Event";
        scheduleSheet.Cell(1, 1).Style.Font.Bold = true;
        scheduleSheet.Cell(2, 1).Value = $"{division.Name} - Scoresheet";
        scheduleSheet.Cell(2, 1).Style.Font.Bold = true;

        // Scoresheet headers
        scheduleSheet.Cell(4, 1).Value = "Match #";
        scheduleSheet.Cell(4, 2).Value = "Round";
        scheduleSheet.Cell(4, 3).Value = "Team 1";
        scheduleSheet.Cell(4, 4).Value = "Team 2";
        scheduleSheet.Cell(4, 5).Value = "Game 1";
        scheduleSheet.Cell(4, 6).Value = "Game 2";
        scheduleSheet.Cell(4, 7).Value = "Game 3";
        scheduleSheet.Cell(4, 8).Value = "Winner";
        scheduleSheet.Range(4, 1, 4, 8).Style.Font.Bold = true;
        scheduleSheet.Range(4, 1, 4, 8).Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;

        row = 5;
        foreach (var encounter in encounters)
        {
            var unit1Name = encounter.Unit1?.Name ?? $"Position {encounter.Unit1Number}";
            var unit2Name = encounter.Unit2?.Name ?? $"Position {encounter.Unit2Number}";
            var roundLabel = encounter.RoundName ?? $"{encounter.RoundType} R{encounter.RoundNumber}";

            scheduleSheet.Cell(row, 1).Value = encounter.MatchNumber;
            scheduleSheet.Cell(row, 2).Value = roundLabel;
            scheduleSheet.Cell(row, 3).Value = $"[{encounter.Unit1Number}] {unit1Name}";
            scheduleSheet.Cell(row, 4).Value = $"[{encounter.Unit2Number}] {unit2Name}";

            // Add borders for score entry cells
            for (int col = 5; col <= 7; col++)
            {
                scheduleSheet.Cell(row, col).Style.Border.OutsideBorder = ClosedXML.Excel.XLBorderStyleValues.Thin;
                scheduleSheet.Cell(row, col).Value = "__ - __";
                scheduleSheet.Cell(row, col).Style.Alignment.Horizontal = ClosedXML.Excel.XLAlignmentHorizontalValues.Center;
            }
            scheduleSheet.Cell(row, 8).Style.Border.OutsideBorder = ClosedXML.Excel.XLBorderStyleValues.Thin;

            row++;
        }
        scheduleSheet.Columns().AdjustToContents();

        // Return as file download
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;

        var fileName = $"{division.Name.Replace(" ", "_")}_Scoresheet.xlsx";
        return File(stream.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            fileName);
    }

    /// <summary>
    /// Export all registrations with payment status to Excel
    /// </summary>
    [HttpGet("events/{eventId}/registrations/export")]
    [Authorize]
    public async Task<IActionResult> ExportRegistrations(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        if (!await CanManageEventAsync(eventId)) return Forbid();

        var evt = await _context.Events
            .Include(e => e.Divisions)
            .FirstOrDefaultAsync(e => e.Id == eventId);
        if (evt == null) return NotFound();

        var units = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Include(u => u.Division)
            .Where(u => u.EventId == eventId && u.Status != "Cancelled")
            .OrderBy(u => u.Division != null ? u.Division.Name : "")
            .ThenBy(u => u.Name)
            .ToListAsync();

        using var workbook = new ClosedXML.Excel.XLWorkbook();

        // Summary sheet
        var summarySheet = workbook.Worksheets.Add("Summary");
        summarySheet.Cell(1, 1).Value = evt.Name;
        summarySheet.Cell(1, 1).Style.Font.Bold = true;
        summarySheet.Cell(1, 1).Style.Font.FontSize = 14;
        summarySheet.Cell(2, 1).Value = $"Exported: {DateTime.Now:yyyy-MM-dd HH:mm}";
        summarySheet.Cell(3, 1).Value = $"Total Registrations: {units.Count}";

        // Per-division summary
        var row = 5;
        summarySheet.Cell(row, 1).Value = "Division";
        summarySheet.Cell(row, 2).Value = "Registrations";
        summarySheet.Cell(row, 3).Value = "Fully Paid";
        summarySheet.Cell(row, 4).Value = "Partial/Pending";
        summarySheet.Cell(row, 5).Value = "Total Collected";
        summarySheet.Cell(row, 6).Value = "Total Expected";
        summarySheet.Range(row, 1, row, 6).Style.Font.Bold = true;
        summarySheet.Range(row, 1, row, 6).Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;

        foreach (var division in evt.Divisions.OrderBy(d => d.Name))
        {
            row++;
            var divUnits = units.Where(u => u.DivisionId == division.Id).ToList();
            var feePerUnit = evt.RegistrationFee + (division.DivisionFee ?? 0m);
            summarySheet.Cell(row, 1).Value = division.Name;
            summarySheet.Cell(row, 2).Value = divUnits.Count;
            summarySheet.Cell(row, 3).Value = divUnits.Count(u => u.PaymentStatus == "Paid");
            summarySheet.Cell(row, 4).Value = divUnits.Count(u => u.PaymentStatus != "Paid");
            summarySheet.Cell(row, 5).Value = divUnits.Sum(u => u.AmountPaid);
            summarySheet.Cell(row, 5).Style.NumberFormat.Format = "$#,##0.00";
            summarySheet.Cell(row, 6).Value = divUnits.Count * feePerUnit;
            summarySheet.Cell(row, 6).Style.NumberFormat.Format = "$#,##0.00";
        }
        summarySheet.Columns().AdjustToContents();

        // All registrations sheet
        var regSheet = workbook.Worksheets.Add("All Registrations");
        var headers = new[] { "Division", "Team/Unit Name", "Player Name", "Email", "Phone", "Payment Status", "Amount Paid", "Amount Due", "Payment Method", "Payment Reference", "Payment Proof", "Paid Date", "Registration Date" };
        for (int i = 0; i < headers.Length; i++)
        {
            regSheet.Cell(1, i + 1).Value = headers[i];
        }
        regSheet.Range(1, 1, 1, headers.Length).Style.Font.Bold = true;
        regSheet.Range(1, 1, 1, headers.Length).Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;

        row = 2;
        foreach (var unit in units)
        {
            var feePerUnit = evt.RegistrationFee + (unit.Division?.DivisionFee ?? 0m);
            var acceptedMembers = unit.Members.Where(m => m.InviteStatus == "Accepted").ToList();

            if (acceptedMembers.Count == 0)
            {
                // Unit with no accepted members - still show the unit
                regSheet.Cell(row, 1).Value = unit.Division?.Name ?? "";
                regSheet.Cell(row, 2).Value = unit.Name ?? "";
                regSheet.Cell(row, 3).Value = "(No accepted members)";
                regSheet.Cell(row, 6).Value = unit.PaymentStatus ?? "Pending";
                regSheet.Cell(row, 7).Value = unit.AmountPaid;
                regSheet.Cell(row, 7).Style.NumberFormat.Format = "$#,##0.00";
                regSheet.Cell(row, 8).Value = feePerUnit;
                regSheet.Cell(row, 8).Style.NumberFormat.Format = "$#,##0.00";
                row++;
            }
            else
            {
                foreach (var member in acceptedMembers)
                {
                    regSheet.Cell(row, 1).Value = unit.Division?.Name ?? "";
                    regSheet.Cell(row, 2).Value = unit.Name ?? "";
                    regSheet.Cell(row, 3).Value = $"{member.User?.FirstName} {member.User?.LastName}".Trim();
                    regSheet.Cell(row, 4).Value = member.User?.Email ?? "";
                    regSheet.Cell(row, 5).Value = member.User?.Phone ?? "";
                    regSheet.Cell(row, 6).Value = member.HasPaid ? "Paid" : (string.IsNullOrEmpty(member.PaymentProofUrl) ? "Unpaid" : "Proof Submitted");
                    regSheet.Cell(row, 7).Value = member.AmountPaid;
                    regSheet.Cell(row, 7).Style.NumberFormat.Format = "$#,##0.00";
                    // Split fee evenly among accepted members
                    regSheet.Cell(row, 8).Value = feePerUnit / Math.Max(1, acceptedMembers.Count);
                    regSheet.Cell(row, 8).Style.NumberFormat.Format = "$#,##0.00";
                    regSheet.Cell(row, 9).Value = member.PaymentMethod ?? "";
                    regSheet.Cell(row, 10).Value = member.PaymentReference ?? "";
                    regSheet.Cell(row, 11).Value = string.IsNullOrEmpty(member.PaymentProofUrl) ? "No" : "Yes";
                    regSheet.Cell(row, 12).Value = member.PaidAt?.ToString("yyyy-MM-dd HH:mm") ?? "";
                    regSheet.Cell(row, 13).Value = member.CreatedAt.ToString("yyyy-MM-dd HH:mm");
                    row++;
                }
            }
        }
        regSheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;

        var fileName = $"{evt.Name.Replace(" ", "_")}_Registrations_{DateTime.Now:yyyyMMdd}.xlsx";
        return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }


    // ============================================
    // Game Management
    // ============================================

    [Authorize]
    [HttpPost("games/assign-court")]
    public async Task<ActionResult<ApiResponse<EventGameDto>>> AssignGameToCourt([FromBody] AssignGameToCourtRequest request)
    {
        var game = await _context.EventGames
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(e => e!.Unit1).ThenInclude(u => u!.Members)
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(e => e!.Unit2).ThenInclude(u => u!.Members)
            .FirstOrDefaultAsync(g => g.Id == request.GameId);

        if (game == null)
            return NotFound(new ApiResponse<EventGameDto> { Success = false, Message = "Game not found" });

        var court = await _context.TournamentCourts.FindAsync(request.TournamentCourtId);
        if (court == null)
            return NotFound(new ApiResponse<EventGameDto> { Success = false, Message = "Court not found" });

        if (court.Status == "InUse" && court.CurrentGameId != request.GameId)
            return BadRequest(new ApiResponse<EventGameDto> { Success = false, Message = "Court is in use" });

        var oldStatus = game.Status;
        game.TournamentCourtId = request.TournamentCourtId;
        game.Status = "Queued";
        game.QueuedAt = DateTime.Now;
        game.UpdatedAt = DateTime.Now;

        court.CurrentGameId = game.Id;
        court.Status = "InUse";

        await _context.SaveChangesAsync();

        // Call stored procedure for notifications
        await CallGameStatusChangeSP(game.Id, oldStatus, "Queued");

        // Send real-time notifications to players in this game
        var encounter = game.EncounterMatch?.Encounter;
        if (encounter != null)
        {
            var playerIds = new List<int>();
            if (encounter.Unit1?.Members != null)
                playerIds.AddRange(encounter.Unit1.Members.Where(m => m.InviteStatus == "Accepted").Select(m => m.UserId));
            if (encounter.Unit2?.Members != null)
                playerIds.AddRange(encounter.Unit2.Members.Where(m => m.InviteStatus == "Accepted").Select(m => m.UserId));

            if (playerIds.Count > 0)
            {
                var unit1Name = encounter.Unit1?.Name ?? "Team 1";
                var unit2Name = encounter.Unit2?.Name ?? "Team 2";
                var actionUrl = $"/event/{encounter.EventId}/gameday";

                foreach (var playerId in playerIds.Distinct())
                {
                    await _notificationService.CreateAndSendAsync(
                        playerId,
                        "GameUpdate",
                        "Your game is ready!",
                        $"{unit1Name} vs {unit2Name} - Court: {court.CourtLabel}",
                        actionUrl,
                        "Game",
                        game.Id);
                }
            }

            // Also broadcast to event group for admin dashboard refresh
            await _notificationService.SendToEventAsync(encounter.EventId, new NotificationPayload
            {
                Type = "GameUpdate",
                Title = "Game Queued",
                Message = $"Game assigned to {court.CourtLabel}",
                ReferenceType = "Game",
                ReferenceId = game.Id,
                CreatedAt = DateTime.Now
            });
        }

        return Ok(new ApiResponse<EventGameDto>
        {
            Success = true,
            Data = MapToGameDto(game)
        });
    }

    /// <summary>
    /// Pre-assign a court to an encounter (schedule planning, not starting the game)
    /// </summary>
    [Authorize]
    [HttpPost("encounters/pre-assign-court")]
    public async Task<ActionResult<ApiResponse<object>>> PreAssignCourtToEncounter([FromBody] PreAssignCourtRequest request)
    {
        var encounter = await _context.EventEncounters
            .Include(e => e.Event)
            .FirstOrDefaultAsync(e => e.Id == request.EncounterId);

        if (encounter == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Encounter not found" });

        // Verify user is organizer or admin
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        if (!await IsAdminAsync() && !await IsEventOrganizerAsync(encounter.EventId, userId.Value))
            return Forbid();

        if (request.TournamentCourtId.HasValue)
        {
            var court = await _context.TournamentCourts.FindAsync(request.TournamentCourtId.Value);
            if (court == null || court.EventId != encounter.EventId)
                return NotFound(new ApiResponse<object> { Success = false, Message = "Court not found" });
        }

        encounter.TournamentCourtId = request.TournamentCourtId;
        encounter.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = request.TournamentCourtId.HasValue ? "Court pre-assigned" : "Court assignment removed"
        });
    }

    /// <summary>
    /// Bulk pre-assign courts to multiple encounters (schedule planning)
    /// </summary>
    [Authorize]
    [HttpPost("encounters/bulk-pre-assign-courts")]
    public async Task<ActionResult<ApiResponse<object>>> BulkPreAssignCourts([FromBody] BulkPreAssignCourtsRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        if (!await IsAdminAsync() && !await IsEventOrganizerAsync(request.EventId, userId.Value))
            return Forbid();

        if (request.Assignments == null || request.Assignments.Count == 0)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "No assignments provided" });

        var encounterIds = request.Assignments.Select(a => a.EncounterId).ToList();
        var encounters = await _context.EventEncounters
            .Where(e => encounterIds.Contains(e.Id) && e.EventId == request.EventId)
            .ToListAsync();

        if (encounters.Count != encounterIds.Count)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Some encounters not found or don't belong to this event" });

        // Validate all courts exist for this event
        var courtIds = request.Assignments
            .Where(a => a.TournamentCourtId.HasValue)
            .Select(a => a.TournamentCourtId!.Value)
            .Distinct()
            .ToList();

        if (courtIds.Count > 0)
        {
            var validCourts = await _context.TournamentCourts
                .Where(c => courtIds.Contains(c.Id) && c.EventId == request.EventId)
                .Select(c => c.Id)
                .ToListAsync();

            if (validCourts.Count != courtIds.Count)
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Some courts not found or don't belong to this event" });
        }

        // Apply assignments
        var now = DateTime.Now;
        foreach (var assignment in request.Assignments)
        {
            var encounter = encounters.First(e => e.Id == assignment.EncounterId);
            encounter.TournamentCourtId = assignment.TournamentCourtId;
            encounter.UpdatedAt = now;
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = $"{request.Assignments.Count} court assignments updated"
        });
    }


    [HttpPost("games/update-status")]
    public async Task<ActionResult<ApiResponse<EventGameDto>>> UpdateGameStatus([FromBody] UpdateGameStatusRequest request)
    {
        var game = await _context.EventGames
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(e => e!.Unit1).ThenInclude(u => u!.Members)
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(e => e!.Unit2).ThenInclude(u => u!.Members)
            .Include(g => g.TournamentCourt)
            .FirstOrDefaultAsync(g => g.Id == request.GameId);

        if (game == null)
            return NotFound(new ApiResponse<EventGameDto> { Success = false, Message = "Game not found" });

        var oldStatus = game.Status;
        game.Status = request.Status;
        game.UpdatedAt = DateTime.Now;

        var finishedCourtId = (int?)null;
        if (request.Status == "Started" || request.Status == "Playing")
        {
            game.StartedAt ??= DateTime.Now;
        }
        else if (request.Status == "Finished" || request.Status == "Completed")
        {
            game.FinishedAt = DateTime.Now;

            // Save court ID before freeing it (for auto-starting next game)
            finishedCourtId = game.TournamentCourtId;

            // Free up the court
            if (game.TournamentCourt != null)
            {
                game.TournamentCourt.Status = "Available";
                game.TournamentCourt.CurrentGameId = null;
            }
        }

        await _context.SaveChangesAsync();

        // Call stored procedure for notifications
        await CallGameStatusChangeSP(game.Id, oldStatus, request.Status);

        // Send real-time notifications to players if status changed significantly
        var encounter = game.EncounterMatch?.Encounter;
        var notifyStatuses = new[] { "Queued", "Ready", "InProgress", "Started", "Playing" };
        if (encounter != null && notifyStatuses.Contains(request.Status) && oldStatus != request.Status)
        {
            var playerIds = new List<int>();
            if (encounter.Unit1?.Members != null)
                playerIds.AddRange(encounter.Unit1.Members.Where(m => m.InviteStatus == "Accepted").Select(m => m.UserId));
            if (encounter.Unit2?.Members != null)
                playerIds.AddRange(encounter.Unit2.Members.Where(m => m.InviteStatus == "Accepted").Select(m => m.UserId));

            if (playerIds.Count > 0)
            {
                var unit1Name = encounter.Unit1?.Name ?? "Team 1";
                var unit2Name = encounter.Unit2?.Name ?? "Team 2";
                var courtName = game.TournamentCourt?.CourtLabel ?? "assigned court";
                var actionUrl = $"/event/{encounter.EventId}/gameday";

                // Customize message based on status
                var title = request.Status switch
                {
                    "Queued" => "Game Queued!",
                    "Ready" => "Get Ready!",
                    "InProgress" or "Playing" or "Started" => "Game Starting!",
                    _ => "Game Update"
                };

                foreach (var playerId in playerIds.Distinct())
                {
                    await _notificationService.CreateAndSendAsync(
                        playerId,
                        "GameUpdate",
                        title,
                        $"{unit1Name} vs {unit2Name} - {courtName}",
                        actionUrl,
                        "Game",
                        game.Id);
                }
            }
        }

        // Broadcast to event group for admin dashboard refresh
        if (encounter != null)
        {
            await _notificationService.SendToEventAsync(encounter.EventId, new NotificationPayload
            {
                Type = "GameUpdate",
                Title = $"Game {request.Status}",
                Message = $"Game status updated to {request.Status}",
                ReferenceType = "Game",
                ReferenceId = game.Id,
                CreatedAt = DateTime.Now
            });

            // Auto-start next queued game on the same court if game finished
            if (finishedCourtId.HasValue && (request.Status == "Finished" || request.Status == "Completed"))
            {
                await StartNextQueuedGameOnCourt(finishedCourtId.Value, encounter.EventId);
            }
        }

        return Ok(new ApiResponse<EventGameDto>
        {
            Success = true,
            Data = MapToGameDto(game)
        });
    }

    [Authorize]
    [HttpPost("games/submit-score")]
    public async Task<ActionResult<ApiResponse<EventGameDto>>> SubmitScore([FromBody] SubmitScoreRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<EventGameDto> { Success = false, Message = "Unauthorized" });

        var game = await _context.EventGames
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(m => m!.Unit1)
                    .ThenInclude(u => u!.Members)
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(m => m!.Unit2)
                    .ThenInclude(u => u!.Members)
            .FirstOrDefaultAsync(g => g.Id == request.GameId);

        if (game == null)
            return NotFound(new ApiResponse<EventGameDto> { Success = false, Message = "Game not found" });

        // Check if user is in one of the units
        var encounter = game.EncounterMatch?.Encounter;
        var userUnit = encounter?.Unit1?.Members.Any(m => m.UserId == userId) == true ? encounter.Unit1 :
                       encounter?.Unit2?.Members.Any(m => m.UserId == userId) == true ? encounter.Unit2 : null;

        if (userUnit == null)
            return Forbid();

        game.Unit1Score = request.Unit1Score;
        game.Unit2Score = request.Unit2Score;
        game.ScoreSubmittedByUnitId = userUnit.Id;
        game.ScoreSubmittedAt = DateTime.Now;
        game.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<EventGameDto>
        {
            Success = true,
            Data = MapToGameDto(game)
        });
    }

    /// <summary>
    /// Admin endpoint to update game scores without being a participant
    /// </summary>
    [Authorize]
    [HttpPost("games/admin-update-score")]
    public async Task<ActionResult<ApiResponse<EventGameDto>>> AdminUpdateScore([FromBody] AdminUpdateScoreRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<EventGameDto> { Success = false, Message = "Unauthorized" });

        // Check if user is admin
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
        if (user?.Role != "Admin")
            return Forbid();

        var game = await _context.EventGames
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
            .Include(g => g.ScoreFormat)
            .FirstOrDefaultAsync(g => g.Id == request.GameId);

        if (game == null)
            return NotFound(new ApiResponse<EventGameDto> { Success = false, Message = "Game not found" });

        var encounter = game.EncounterMatch?.Encounter;
        var wasAlreadyFinished = game.Status == "Finished";
        var oldUnit1Score = game.Unit1Score;
        var oldUnit2Score = game.Unit2Score;
        var oldWinnerId = game.WinnerUnitId;

        game.Unit1Score = request.Unit1Score;
        game.Unit2Score = request.Unit2Score;
        game.UpdatedAt = DateTime.Now;

        // If marking as finished (first time)
        if (request.MarkAsFinished && !wasAlreadyFinished)
        {
            game.Status = "Finished";
            game.FinishedAt = DateTime.Now;

            var finishedCourtId = game.TournamentCourtId;

            if (encounter != null)
            {
                game.WinnerUnitId = game.Unit1Score > game.Unit2Score ? encounter.Unit1Id : encounter.Unit2Id;

                // Update unit stats (games won/lost, points scored/against)
                await UpdateUnitStats(game);

                // Free up court
                if (game.TournamentCourtId.HasValue)
                {
                    var court = await _context.TournamentCourts.FindAsync(game.TournamentCourtId);
                    if (court != null)
                    {
                        court.Status = "Available";
                        court.CurrentGameId = null;
                    }
                }

                // Broadcast game score update via SignalR
                var winnerUnit = game.WinnerUnitId == encounter.Unit1Id ? encounter.Unit1 : encounter.Unit2;
                await _scoreBroadcaster.BroadcastGameScoreUpdated(encounter.EventId, encounter.DivisionId, new GameScoreUpdateDto
                {
                    GameId = game.Id,
                    EncounterId = encounter.Id,
                    DivisionId = encounter.DivisionId,
                    GameNumber = game.GameNumber,
                    Unit1Score = game.Unit1Score,
                    Unit2Score = game.Unit2Score,
                    WinnerUnitId = game.WinnerUnitId,
                    WinnerName = winnerUnit?.Name,
                    Status = game.Status ?? "Finished",
                    UpdatedAt = DateTime.Now
                });

                // Check if match is complete (for best-of series) - this also handles bracket progression
                await CheckMatchComplete(encounter.Id);

                // Save changes before starting next game
                await _context.SaveChangesAsync();

                // Auto-start next queued game on the same court
                if (finishedCourtId.HasValue)
                {
                    await StartNextQueuedGameOnCourt(finishedCourtId.Value, encounter.EventId);
                }

                return Ok(new ApiResponse<EventGameDto>
                {
                    Success = true,
                    Data = MapToGameDto(game)
                });
            }
        }
        // If already finished and score changed, update stats with delta
        else if (wasAlreadyFinished && encounter != null &&
                 (oldUnit1Score != request.Unit1Score || oldUnit2Score != request.Unit2Score))
        {
            // Update winner based on new scores
            game.WinnerUnitId = game.Unit1Score > game.Unit2Score ? encounter.Unit1Id : encounter.Unit2Id;

            // Adjust unit stats (subtract old, add new)
            await AdjustUnitStats(encounter, oldUnit1Score, oldUnit2Score, oldWinnerId,
                                  game.Unit1Score, game.Unit2Score, game.WinnerUnitId);

            // Broadcast score change
            var winnerUnit = game.WinnerUnitId == encounter.Unit1Id ? encounter.Unit1 : encounter.Unit2;
            await _scoreBroadcaster.BroadcastGameScoreUpdated(encounter.EventId, encounter.DivisionId, new GameScoreUpdateDto
            {
                GameId = game.Id,
                EncounterId = encounter.Id,
                DivisionId = encounter.DivisionId,
                GameNumber = game.GameNumber,
                Unit1Score = game.Unit1Score,
                Unit2Score = game.Unit2Score,
                WinnerUnitId = game.WinnerUnitId,
                WinnerName = winnerUnit?.Name,
                Status = game.Status ?? "Finished",
                UpdatedAt = DateTime.Now
            });

            // Re-check match completion in case winner changed
            await CheckMatchComplete(encounter.Id);
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<EventGameDto>
        {
            Success = true,
            Data = MapToGameDto(game)
        });
    }

    [Authorize]
    [HttpPost("games/confirm-score")]
    public async Task<ActionResult<ApiResponse<EventGameDto>>> ConfirmScore([FromBody] ConfirmScoreRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<EventGameDto> { Success = false, Message = "Unauthorized" });

        var game = await _context.EventGames
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(m => m!.Unit1)
                    .ThenInclude(u => u!.Members)
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(m => m!.Unit2)
                    .ThenInclude(u => u!.Members)
            .Include(g => g.ScoreFormat)
            .FirstOrDefaultAsync(g => g.Id == request.GameId);

        if (game == null)
            return NotFound(new ApiResponse<EventGameDto> { Success = false, Message = "Game not found" });

        // Check if user is in the OTHER unit (not the one that submitted)
        var encounter = game.EncounterMatch?.Encounter;
        var userUnit = encounter?.Unit1?.Members.Any(m => m.UserId == userId) == true ? encounter.Unit1 :
                       encounter?.Unit2?.Members.Any(m => m.UserId == userId) == true ? encounter.Unit2 : null;

        if (userUnit == null || userUnit.Id == game.ScoreSubmittedByUnitId)
            return Forbid();

        if (request.Confirm)
        {
            game.ScoreConfirmedByUnitId = userUnit.Id;
            game.ScoreConfirmedAt = DateTime.Now;
            game.Status = "Finished";
            game.FinishedAt = DateTime.Now;

            var finishedCourtId = game.TournamentCourtId;

            // Determine winner
            var unit1Id = encounter!.Unit1Id;
            var unit2Id = encounter!.Unit2Id;
            game.WinnerUnitId = game.Unit1Score > game.Unit2Score ? unit1Id : unit2Id;

            // Update unit stats
            await UpdateUnitStats(game);

            // Free up court
            if (game.TournamentCourtId.HasValue)
            {
                var court = await _context.TournamentCourts.FindAsync(game.TournamentCourtId);
                if (court != null)
                {
                    court.Status = "Available";
                    court.CurrentGameId = null;
                }
            }

            // Check if match is complete
            await CheckMatchComplete(game.EncounterMatch!.EncounterId);

            game.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            // Auto-start next queued game on the same court
            if (finishedCourtId.HasValue)
            {
                await StartNextQueuedGameOnCourt(finishedCourtId.Value, encounter.EventId);
            }

            return Ok(new ApiResponse<EventGameDto>
            {
                Success = true,
                Data = MapToGameDto(game)
            });
        }
        else
        {
            game.ScoreDisputedAt = DateTime.Now;
            game.ScoreDisputeReason = request.DisputeReason;
        }

        game.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<EventGameDto>
        {
            Success = true,
            Data = MapToGameDto(game)
        });
    }

    /// <summary>
    /// Admin endpoint to update encounter units (teams)
    /// </summary>
    [Authorize]
    [HttpPost("encounters/update-units")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateEncounterUnits([FromBody] UpdateEncounterUnitsRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        // Check if user is admin
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
        if (user?.Role != "Admin")
            return Forbid();

        var encounter = await _context.EventEncounters
            .Include(e => e.Division)
            .FirstOrDefaultAsync(e => e.Id == request.EncounterId);

        if (encounter == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Encounter not found" });

        // Validate units belong to same division
        if (request.Unit1Id.HasValue)
        {
            var unit1 = await _context.EventUnits.FirstOrDefaultAsync(u => u.Id == request.Unit1Id.Value);
            if (unit1 == null || unit1.DivisionId != encounter.DivisionId)
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Unit 1 not found or not in same division" });
        }

        if (request.Unit2Id.HasValue)
        {
            var unit2 = await _context.EventUnits.FirstOrDefaultAsync(u => u.Id == request.Unit2Id.Value);
            if (unit2 == null || unit2.DivisionId != encounter.DivisionId)
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Unit 2 not found or not in same division" });
        }

        // Update encounter units
        encounter.Unit1Id = request.Unit1Id;
        encounter.Unit2Id = request.Unit2Id;
        encounter.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Encounter units updated successfully"
        });
    }

    /// <summary>
    /// Get all units in a division
    /// </summary>
    [Authorize]
    [HttpGet("divisions/{divisionId}/units")]
    public async Task<ActionResult<ApiResponse<List<EventUnitDto>>>> GetDivisionUnits(int divisionId)
    {
        var units = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Where(u => u.DivisionId == divisionId)
            .OrderBy(u => u.UnitNumber)
            .Select(u => new EventUnitDto
            {
                Id = u.Id,
                Name = u.Name,
                UnitNumber = u.UnitNumber,
                Status = u.Status,
                Members = u.Members!.Where(m => m.InviteStatus == "Accepted").Select(m => new EventUnitMemberDto
                {
                    UserId = m.UserId,
                    FirstName = m.User!.FirstName,
                    LastName = m.User.LastName,
                    ProfileImageUrl = m.User.ProfileImageUrl
                }).ToList()
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<EventUnitDto>>
        {
            Success = true,
            Data = units
        });
    }


    // ============================================
    // Check-in
    // ============================================

    [Authorize]
    [HttpPost("events/{eventId}/check-in")]
    public async Task<ActionResult<ApiResponse<CheckInStatusDto>>> CheckIn(int eventId, [FromBody] CheckInRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<CheckInStatusDto> { Success = false, Message = "Unauthorized" });

        var members = await _context.EventUnitMembers
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Division)
            .Where(m => m.UserId == userId.Value &&
                        m.Unit!.EventId == eventId &&
                        m.InviteStatus == "Accepted" &&
                        (request.DivisionId == null || m.Unit.DivisionId == request.DivisionId))
            .ToListAsync();

        foreach (var member in members)
        {
            member.IsCheckedIn = true;
            member.CheckedInAt = DateTime.Now;

            // Check if all members of unit are checked in
            var allCheckedIn = await _context.EventUnitMembers
                .Where(m => m.UnitId == member.UnitId && m.InviteStatus == "Accepted")
                .AllAsync(m => m.IsCheckedIn);

            if (allCheckedIn && member.Unit != null)
            {
                member.Unit.Status = "CheckedIn";
                member.Unit.UpdatedAt = DateTime.Now;
            }
        }

        await _context.SaveChangesAsync();

        return await GetCheckInStatus(eventId);
    }

    [HttpGet("events/{eventId}/check-in-status")]
    public async Task<ActionResult<ApiResponse<List<CheckInStatusDto>>>> GetAllCheckInStatus(int eventId)
    {
        var members = await _context.EventUnitMembers
            .Include(m => m.User)
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Division)
            .Where(m => m.Unit!.EventId == eventId && m.InviteStatus == "Accepted")
            .ToListAsync();

        var grouped = members.GroupBy(m => m.UserId);

        var result = grouped.Select(g => new CheckInStatusDto
        {
            EventId = eventId,
            UserId = g.Key,
            UserName = Utility.FormatName(g.First().User?.LastName, g.First().User?.FirstName),
            ProfileImageUrl = g.First().User?.ProfileImageUrl,
            IsCheckedIn = g.All(m => m.IsCheckedIn),
            CheckedInAt = g.Where(m => m.IsCheckedIn).Min(m => m.CheckedInAt),
            Divisions = g.Select(m => new DivisionCheckInDto
            {
                DivisionId = m.Unit!.DivisionId,
                DivisionName = m.Unit.Division?.Name ?? "",
                UnitId = m.UnitId,
                UnitName = m.Unit.Name,
                IsCheckedIn = m.IsCheckedIn,
                CheckedInAt = m.CheckedInAt
            }).ToList()
        }).ToList();

        return Ok(new ApiResponse<List<CheckInStatusDto>> { Success = true, Data = result });
    }


    // ============================================
    // Tournament Dashboard
    // ============================================

    [HttpGet("events/{eventId}/dashboard")]
    public async Task<ActionResult<ApiResponse<TournamentDashboardDto>>> GetTournamentDashboard(int eventId)
    {
        var evt = await _context.Events
            .Include(e => e.Divisions).ThenInclude(d => d.TeamUnit)
            .Include(e => e.Divisions).ThenInclude(d => d.SkillLevel)
            .Include(e => e.Divisions).ThenInclude(d => d.AgeGroupEntity)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new ApiResponse<TournamentDashboardDto> { Success = false, Message = "Event not found" });

        var units = await _context.EventUnits
            .Include(u => u.Members)
            .Where(u => u.EventId == eventId)
            .ToListAsync();

        var matches = await _context.EventEncounters
            .Where(m => m.EventId == eventId)
            .ToListAsync();

        var games = await _context.EventGames
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter).ThenInclude(e => e!.Unit1).ThenInclude(u => u!.Members).ThenInclude(m => m.User)
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter).ThenInclude(e => e!.Unit2).ThenInclude(u => u!.Members).ThenInclude(m => m.User)
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter).ThenInclude(e => e!.Division)
            .Include(g => g.TournamentCourt)
            .Where(g => g.EncounterMatch!.Encounter!.EventId == eventId)
            .ToListAsync();

        var courts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive)
            .ToListAsync();

        // Helper to get player names from unit members
        string GetPlayerNames(EventUnit? unit)
        {
            if (unit?.Members == null || !unit.Members.Any()) return unit?.Name ?? "TBD";
            return string.Join(" / ", unit.Members.Where(m => m.User != null).Select(m => m.User!.FirstName));
        }

        // Helper to build game info DTO
        CourtGameInfoDto? BuildGameInfo(EventGame? game)
        {
            if (game == null) return null;
            var encounter = game.EncounterMatch?.Encounter;
            return new CourtGameInfoDto
            {
                GameId = game.Id,
                EncounterId = encounter?.Id,
                Unit1Name = encounter?.Unit1?.Name,
                Unit2Name = encounter?.Unit2?.Name,
                Unit1Players = GetPlayerNames(encounter?.Unit1),
                Unit2Players = GetPlayerNames(encounter?.Unit2),
                Unit1Score = game.Unit1Score,
                Unit2Score = game.Unit2Score,
                Status = game.Status,
                StartedAt = game.StartedAt,
                QueuedAt = game.QueuedAt,
                DivisionName = encounter?.Division?.Name,
                RoundName = encounter?.RoundName,
                GameNumber = game.GameNumber
            };
        }

        // Calculate payment stats
        var activeUnits = units.Where(u => u.Status != "Cancelled").ToList();
        var paymentsSubmitted = activeUnits.Count(u => !string.IsNullOrEmpty(u.PaymentProofUrl) || !string.IsNullOrEmpty(u.PaymentReference));
        var paymentsPaid = activeUnits.Count(u => u.PaymentStatus == "Paid");
        var paymentsPending = activeUnits.Count(u => u.PaymentStatus == "Pending" || u.PaymentStatus == "PendingVerification" || u.PaymentStatus == "Partial");

        // Count pending join requests for this event
        var pendingJoinRequestCount = await _context.EventUnitJoinRequests
            .Include(r => r.Unit)
            .CountAsync(r => r.Unit != null && r.Unit.EventId == eventId && r.Status == "Pending");

        var dashboard = new TournamentDashboardDto
        {
            EventId = eventId,
            EventName = evt.Name,
            TournamentStatus = evt.TournamentStatus,
            Stats = new TournamentStatsDto
            {
                TotalRegistrations = activeUnits.Count,
                CheckedInPlayers = units.SelectMany(u => u.Members).Count(m => m.IsCheckedIn),
                TotalMatches = matches.Count,
                CompletedMatches = matches.Count(m => m.Status == "Completed"),
                InProgressGames = games.Count(g => g.Status == "Playing" || g.Status == "Started"),
                AvailableCourts = courts.Count(c => c.Status == "Available"),
                InUseCourts = courts.Count(c => c.Status == "InUse"),
                // Payment stats
                PaymentsSubmitted = paymentsSubmitted,
                PaymentsPaid = paymentsPaid,
                PaymentsPending = paymentsPending,
                TotalAmountDue = activeUnits.Sum(u => evt.RegistrationFee + (evt.Divisions.FirstOrDefault(d => d.Id == u.DivisionId)?.DivisionFee ?? 0m)),
                TotalAmountPaid = activeUnits.Sum(u => u.AmountPaid),
                // Join request stats
                PendingJoinRequests = pendingJoinRequestCount
            },
            Divisions = evt.Divisions.OrderBy(d => d.SortOrder).Select(d => new DivisionStatusDto
            {
                Id = d.Id,
                Name = d.Name,
                Description = d.Description,
                TeamUnitId = d.TeamUnitId,
                TeamUnitName = d.TeamUnit?.Name,
                SkillLevelId = d.SkillLevelId,
                SkillLevelName = d.SkillLevel?.Name,
                AgeGroupId = d.AgeGroupId,
                AgeGroupName = d.AgeGroupEntity?.Name,
                MaxUnits = d.MaxUnits ?? 0,
                MaxPlayers = d.MaxPlayers,
                DivisionFee = d.DivisionFee,
                IsActive = d.IsActive,
                RegisteredUnits = units.Count(u => u.DivisionId == d.Id && u.Status != "Cancelled"),
                WaitlistedUnits = units.Count(u => u.DivisionId == d.Id && u.Status == "Waitlisted"),
                CheckedInUnits = units.Count(u => u.DivisionId == d.Id && u.Status == "CheckedIn"),
                TotalMatches = matches.Count(m => m.DivisionId == d.Id),
                CompletedMatches = matches.Count(m => m.DivisionId == d.Id && m.Status == "Completed"),
                InProgressMatches = matches.Count(m => m.DivisionId == d.Id && m.Status == "InProgress"),
                TotalGames = games.Count(g => g.EncounterMatch?.Encounter?.DivisionId == d.Id),
                ScheduleReady = matches.Any(m => m.DivisionId == d.Id),
                UnitsAssigned = units.Where(u => u.DivisionId == d.Id).All(u => u.UnitNumber.HasValue)
            }).ToList(),
            Courts = courts.Select(c => {
                // Find current game (playing/started on this court)
                var currentGame = games.FirstOrDefault(g =>
                    g.TournamentCourtId == c.Id &&
                    (g.Status == "Playing" || g.Status == "Started" || g.Status == "InProgress"));

                // Find next game (queued for this court, ordered by queued time)
                var nextGame = games
                    .Where(g => g.TournamentCourtId == c.Id && g.Status == "Queued")
                    .OrderBy(g => g.QueuedAt ?? DateTime.MaxValue)
                    .FirstOrDefault();

                return new TournamentCourtDto
                {
                    Id = c.Id,
                    EventId = c.EventId,
                    CourtLabel = c.CourtLabel,
                    Status = c.Status,
                    CurrentGameId = c.CurrentGameId,
                    CurrentGame = BuildGameInfo(currentGame),
                    NextGame = BuildGameInfo(nextGame),
                    SortOrder = c.SortOrder
                };
            }).ToList()
        };

        return Ok(new ApiResponse<TournamentDashboardDto> { Success = true, Data = dashboard });
    }

    [Authorize]
    [HttpPut("events/{eventId}/status")]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateTournamentStatus(int eventId, [FromQuery] string status)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

        var validStatuses = new[] { "Draft", "RegistrationOpen", "RegistrationClosed", "ScheduleReady", "Drawing", "Running", "Completed", "Cancelled" };
        if (!validStatuses.Contains(status))
            return BadRequest(new ApiResponse<bool> { Success = false, Message = "Invalid status" });

        evt.TournamentStatus = status;
        evt.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true });
    }


    // ============================================
    // Helper Methods
    // ============================================

    private EventUnitDto MapToUnitDto(EventUnit u)
    {
        var teamSize = u.Division?.TeamUnit?.TotalPlayers ?? 1;
        var acceptedMembers = u.Members.Where(m => m.InviteStatus == "Accepted").ToList();
        var isComplete = acceptedMembers.Count >= teamSize;

        // Get pending join requests
        var pendingJoinRequests = (u.JoinRequests ?? new List<EventUnitJoinRequest>())
            .Where(jr => jr.Status == "Pending")
            .ToList();
        var pendingJoinRequestUserIds = pendingJoinRequests.Select(jr => jr.UserId).ToHashSet();

        // Compute registration status
        string registrationStatus;
        if (isComplete)
        {
            registrationStatus = "Team Complete";
        }
        else if (u.Members.Any(m => m.InviteStatus == "Pending") || pendingJoinRequests.Any())
        {
            // Has pending invites or join requests awaiting captain response
            registrationStatus = "Waiting for Captain Accept";
        }
        else
        {
            registrationStatus = "Looking for Partner";
        }

        return new EventUnitDto
        {
            Id = u.Id,
            EventId = u.EventId,
            EventName = u.Event?.Name,
            DivisionId = u.DivisionId,
            DivisionName = u.Division?.Name,
            Name = u.Name,
            DisplayName = Utility.GetUnitDisplayName(u, teamSize),
            HasCustomName = u.HasCustomName,
            UnitNumber = u.UnitNumber,
            PoolNumber = u.PoolNumber,
            PoolName = u.PoolName,
            Seed = u.Seed,
            Status = u.Status,
            WaitlistPosition = u.WaitlistPosition,
            CaptainUserId = u.CaptainUserId,
            // Name format: "Last, First"
            CaptainName = u.Captain != null ? FormatName(u.Captain.LastName, u.Captain.FirstName) : null,
            CaptainProfileImageUrl = u.Captain?.ProfileImageUrl,
            RegistrationStatus = registrationStatus,
            JoinMethod = u.JoinMethod ?? "Approval",
            JoinCode = u.JoinCode,
            AutoAcceptMembers = u.AutoAcceptMembers,
            MatchesPlayed = u.MatchesPlayed,
            MatchesWon = u.MatchesWon,
            MatchesLost = u.MatchesLost,
            GamesWon = u.GamesWon,
            GamesLost = u.GamesLost,
            PointsScored = u.PointsScored,
            PointsAgainst = u.PointsAgainst,
            TeamUnitId = u.Division?.TeamUnitId,
            RequiredPlayers = teamSize,
            IsComplete = isComplete,
            AllCheckedIn = acceptedMembers.All(m => m.IsCheckedIn),
            // Payment info
            PaymentStatus = u.PaymentStatus ?? "Pending",
            AmountPaid = u.AmountPaid,
            AmountDue = (u.Event?.RegistrationFee ?? 0m) + (u.Division?.DivisionFee ?? 0m),
            PaymentProofUrl = u.PaymentProofUrl,
            PaymentReference = u.PaymentReference,
            ReferenceId = u.ReferenceId,
            PaidAt = u.PaidAt,
            CreatedAt = u.CreatedAt,
            // Combine members with pending join requests into single Members list
            // Exclude members with PendingJoinRequest status to avoid duplicates (they appear in JoinRequests)
            Members = u.Members
                .Where(m => m.InviteStatus != "PendingJoinRequest" || !pendingJoinRequestUserIds.Contains(m.UserId))
                .Select(m => new EventUnitMemberDto
                {
                    Id = m.Id,
                    UserId = m.UserId,
                    FirstName = m.User?.FirstName,
                    LastName = m.User?.LastName,
                    ProfileImageUrl = m.User?.ProfileImageUrl,
                    Role = m.Role,
                    InviteStatus = m.InviteStatus,
                    IsCheckedIn = m.IsCheckedIn,
                    CheckedInAt = m.CheckedInAt,
                    JoinRequestId = null,
                    // Waiver status
                    WaiverSigned = m.WaiverSignedAt.HasValue,
                    WaiverSignedAt = m.WaiverSignedAt,
                    // Member-level payment info
                    HasPaid = m.HasPaid,
                    PaidAt = m.PaidAt,
                    AmountPaid = m.AmountPaid,
                    PaymentProofUrl = m.PaymentProofUrl,
                    PaymentReference = m.PaymentReference,
                    PaymentMethod = m.PaymentMethod,
                    ReferenceId = m.ReferenceId
                }).Concat(
                    pendingJoinRequests.Select(jr => new EventUnitMemberDto
                    {
                        Id = 0, // No member ID for join requests
                        UserId = jr.UserId,
                        FirstName = jr.User?.FirstName,
                        LastName = jr.User?.LastName,
                        ProfileImageUrl = jr.User?.ProfileImageUrl,
                        Role = "Player",
                        InviteStatus = "Requested", // Special status for join requests
                        IsCheckedIn = false,
                        CheckedInAt = null,
                        JoinRequestId = jr.Id // Store join request ID for accept/reject actions
                    })
                ).ToList()
        };
    }


    /// <summary>
    /// Format name as "Last, First" when both are available
    /// </summary>
    private static string FormatName(string? lastName, string? firstName)
    {
        if (!string.IsNullOrWhiteSpace(lastName) && !string.IsNullOrWhiteSpace(firstName))
            return $"{lastName}, {firstName}";
        if (!string.IsNullOrWhiteSpace(lastName))
            return lastName;
        if (!string.IsNullOrWhiteSpace(firstName))
            return firstName;
        return "Unknown";
    }


    private EventMatchDto MapToMatchDto(EventEncounter m)
    {
        return new EventMatchDto
        {
            Id = m.Id,
            EventId = m.EventId,
            DivisionId = m.DivisionId,
            RoundType = m.RoundType,
            RoundNumber = m.RoundNumber,
            RoundName = m.RoundName,
            MatchNumber = m.MatchNumber,
            DivisionMatchNumber = m.DivisionMatchNumber,
            BracketPosition = m.BracketPosition,
            Unit1Number = m.Unit1Number,
            Unit2Number = m.Unit2Number,
            Unit1Id = m.Unit1Id,
            Unit2Id = m.Unit2Id,
            BestOf = m.BestOf,
            WinnerUnitId = m.WinnerUnitId,
            Status = m.Status,
            ScheduledTime = m.ScheduledTime,
            StartedAt = m.StartedAt,
            CompletedAt = m.CompletedAt,
            TournamentCourtId = m.TournamentCourtId,
            ScoreFormatId = m.ScoreFormatId,
            Games = m.Matches.SelectMany(match => match.Games).OrderBy(g => g.GameNumber).Select(MapToGameDto).ToList(),
            Unit1GamesWon = m.Matches.SelectMany(match => match.Games).Count(g => g.WinnerUnitId == m.Unit1Id),
            Unit2GamesWon = m.Matches.SelectMany(match => match.Games).Count(g => g.WinnerUnitId == m.Unit2Id)
        };
    }

    private EventGameDto MapToGameDto(EventGame g)
    {
        return new EventGameDto
        {
            Id = g.Id,
            EncounterMatchId = g.EncounterMatchId,
            GameNumber = g.GameNumber,
            ScoreFormatId = g.ScoreFormatId,
            Unit1Score = g.Unit1Score,
            Unit2Score = g.Unit2Score,
            WinnerUnitId = g.WinnerUnitId,
            Status = g.Status,
            TournamentCourtId = g.TournamentCourtId,
            QueuedAt = g.QueuedAt,
            StartedAt = g.StartedAt,
            FinishedAt = g.FinishedAt,
            ScoreSubmittedByUnitId = g.ScoreSubmittedByUnitId,
            ScoreSubmittedAt = g.ScoreSubmittedAt,
            ScoreConfirmedByUnitId = g.ScoreConfirmedByUnitId,
            ScoreConfirmedAt = g.ScoreConfirmedAt
        };
    }


    private List<EventEncounter> GenerateRoundRobinMatches(EventDivision division, List<EventUnit> units, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventEncounter>();
        var poolCount = request.PoolCount ?? 1;

        // Distribute units to pools
        for (int i = 0; i < units.Count; i++)
        {
            units[i].PoolNumber = (i % poolCount) + 1;
            units[i].PoolName = $"Pool {(char)('A' + (i % poolCount))}";
        }

        // Generate round robin within each pool
        for (int pool = 1; pool <= poolCount; pool++)
        {
            var poolUnits = units.Where(u => u.PoolNumber == pool).ToList();
            var matchNum = 1;

            for (int i = 0; i < poolUnits.Count; i++)
            {
                for (int j = i + 1; j < poolUnits.Count; j++)
                {
                    matches.Add(new EventEncounter
                    {
                        EventId = division.EventId,
                        DivisionId = division.Id,
                        RoundType = "Pool",
                        RoundNumber = pool,
                        RoundName = $"Pool {(char)('A' + pool - 1)}",
                        MatchNumber = matchNum++,
                        Unit1Number = poolUnits[i].UnitNumber ?? i + 1,
                        Unit2Number = poolUnits[j].UnitNumber ?? j + 1,
                        BestOf = request.BestOf,
                        ScoreFormatId = request.ScoreFormatId,
                        Status = "Scheduled",
                        CreatedAt = DateTime.Now,
                        UpdatedAt = DateTime.Now
                    });
                }
            }
        }

        return matches;
    }

    private List<EventEncounter> GenerateSingleEliminationMatches(EventDivision division, List<EventUnit> units, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventEncounter>();
        var unitCount = units.Count;

        // Find next power of 2
        var bracketSize = 1;
        while (bracketSize < unitCount) bracketSize *= 2;

        var rounds = (int)Math.Log2(bracketSize);
        var matchNum = 1;

        for (int round = 1; round <= rounds; round++)
        {
            var matchesInRound = bracketSize / (int)Math.Pow(2, round);
            var roundName = round == rounds ? "Final" :
                           round == rounds - 1 ? "Semifinal" :
                           round == rounds - 2 ? "Quarterfinal" :
                           $"Round {round}";

            for (int m = 1; m <= matchesInRound; m++)
            {
                matches.Add(new EventEncounter
                {
                    EventId = division.EventId,
                    DivisionId = division.Id,
                    RoundType = "Bracket",
                    RoundNumber = round,
                    RoundName = roundName,
                    MatchNumber = matchNum++,
                    BracketPosition = m,
                    BestOf = request.BestOf,
                    ScoreFormatId = request.ScoreFormatId,
                    Status = "Scheduled",
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                });
            }
        }

        // Assign first round matchups
        var firstRoundMatches = matches.Where(m => m.RoundNumber == 1).OrderBy(m => m.BracketPosition).ToList();
        var byes = bracketSize - unitCount;

        for (int i = 0; i < firstRoundMatches.Count; i++)
        {
            var unit1Idx = i * 2;
            var unit2Idx = i * 2 + 1;

            if (unit1Idx < units.Count)
                firstRoundMatches[i].Unit1Number = unit1Idx + 1;
            if (unit2Idx < units.Count)
                firstRoundMatches[i].Unit2Number = unit2Idx + 1;
        }

        return matches;
    }

    // New methods for generating schedules based on target unit count (with placeholders)
    private List<EventEncounter> GenerateRoundRobinMatchesForTarget(EventDivision division, int targetUnitCount, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventEncounter>();
        var poolCount = request.PoolCount ?? 1;

        // Generate round robin within each pool using placeholder numbers
        for (int pool = 1; pool <= poolCount; pool++)
        {
            // Determine which unit numbers belong to this pool
            // Seed evenly: unit 1 to pool 1, unit 2 to pool 2, unit 3 to pool 3, then unit 4 to pool 1, etc.
            var poolUnitNumbers = new List<int>();
            for (int i = 0; i < targetUnitCount; i++)
            {
                if ((i % poolCount) + 1 == pool)
                {
                    poolUnitNumbers.Add(i + 1);
                }
            }

            // Use circle method for balanced round-robin scheduling
            // This ensures each unit gets roughly equal wait time between matches
            var roundRobinMatches = GenerateCircleMethodSchedule(poolUnitNumbers);

            var matchNum = 1;
            foreach (var (unit1, unit2, roundNum) in roundRobinMatches)
            {
                matches.Add(new EventEncounter
                {
                    EventId = division.EventId,
                    DivisionId = division.Id,
                    RoundType = "Pool",
                    RoundNumber = pool,
                    RoundName = $"Pool {(char)('A' + pool - 1)}",
                    MatchNumber = matchNum++,
                    EncounterNumber = roundNum, // Use encounter number to track round within pool
                    Unit1Number = unit1,
                    Unit2Number = unit2,
                    BestOf = request.BestOf,
                    ScoreFormatId = request.ScoreFormatId,
                    Status = "Scheduled",
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                });
            }
        }

        return matches;
    }

    /// <summary>
    /// Generate round-robin matches using the circle method (polygon method)
    /// This ensures balanced wait times - each unit plays once per round
    /// </summary>
    private List<(int unit1, int unit2, int round)> GenerateCircleMethodSchedule(List<int> unitNumbers)
    {
        var matches = new List<(int unit1, int unit2, int round)>();
        var n = unitNumbers.Count;

        if (n < 2) return matches;

        // For odd number of units, add a dummy (BYE) position
        var units = new List<int>(unitNumbers);
        bool hasBye = (n % 2 == 1);
        if (hasBye)
        {
            units.Add(-1); // -1 represents BYE (will be filtered out)
            n++;
        }

        // Number of rounds = n-1 for even, n for odd (but we added dummy, so still n-1)
        var rounds = n - 1;

        // Circle method: fix position 0, rotate others
        for (int round = 0; round < rounds; round++)
        {
            // In each round, pair units[i] with units[n-1-i]
            for (int i = 0; i < n / 2; i++)
            {
                int pos1 = i;
                int pos2 = n - 1 - i;

                // Get actual indices after rotation
                int idx1 = (pos1 == 0) ? 0 : ((pos1 + round - 1) % (n - 1)) + 1;
                int idx2 = (pos2 == 0) ? 0 : ((pos2 + round - 1) % (n - 1)) + 1;

                var unit1 = units[idx1];
                var unit2 = units[idx2];

                // Skip matches involving the BYE
                if (unit1 == -1 || unit2 == -1) continue;

                // Ensure lower unit number is always unit1 for consistency
                if (unit1 > unit2)
                {
                    (unit1, unit2) = (unit2, unit1);
                }

                matches.Add((unit1, unit2, round + 1));
            }
        }

        return matches;
    }

    private List<EventEncounter> GeneratePlayoffMatchesForTarget(EventDivision division, int playoffUnits, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventEncounter>();

        // Find next power of 2 for bracket size
        var bracketSize = 1;
        while (bracketSize < playoffUnits) bracketSize *= 2;

        var rounds = (int)Math.Log2(bracketSize);
        var matchNum = 1;

        // Get pool configuration
        var poolCount = request.PoolCount ?? 1;
        var playoffFromPools = request.PlayoffFromPools ?? 2;

        // Generate seed labels for playoff positions
        // Standard cross-pool seeding: Pool A #1 vs Pool B #2, Pool B #1 vs Pool A #2, etc.
        var seedLabels = GeneratePlayoffSeedLabels(poolCount, playoffFromPools, bracketSize);

        // Get seeded bracket positions for first round
        var seedPositions = GetSeededBracketPositions(bracketSize);

        for (int round = 1; round <= rounds; round++)
        {
            var matchesInRound = bracketSize / (int)Math.Pow(2, round);
            var roundName = round == rounds ? "Playoff Final" :
                           round == rounds - 1 ? "Playoff Semifinal" :
                           round == rounds - 2 ? "Playoff Quarterfinal" :
                           $"Playoff Round {round}";
            var roundAbbr = round == rounds ? "F" :
                           round == rounds - 1 ? "SF" :
                           round == rounds - 2 ? "QF" :
                           $"R{round}";

            for (int m = 1; m <= matchesInRound; m++)
            {
                var matchIdx = matchNum;
                string? unit1Label = null;
                string? unit2Label = null;

                if (round == 1)
                {
                    // First round: use pool-based seed labels
                    var matchup = seedPositions[m - 1];
                    var seed1 = matchup.Item1;
                    var seed2 = matchup.Item2;

                    unit1Label = seed1 <= playoffUnits && seedLabels.ContainsKey(seed1) ? seedLabels[seed1] : null;
                    unit2Label = seed2 <= playoffUnits && seedLabels.ContainsKey(seed2) ? seedLabels[seed2] : null;

                    // Handle byes
                    if (seed1 > playoffUnits) unit1Label = "BYE";
                    if (seed2 > playoffUnits) unit2Label = "BYE";
                }
                else
                {
                    // Later rounds: reference winners from previous round
                    // Calculate which matches from previous round feed into this one
                    var prevRoundMatchBase = 0;
                    for (int r = 1; r < round; r++)
                    {
                        prevRoundMatchBase += bracketSize / (int)Math.Pow(2, r);
                    }
                    var prevRoundMatchCount = bracketSize / (int)Math.Pow(2, round - 1);
                    var prevRoundAbbr = round - 1 == rounds - 1 ? "SF" :
                                        round - 1 == rounds - 2 ? "QF" :
                                        $"R{round - 1}";

                    // Match m in this round comes from matches (m*2-1) and (m*2) in previous round
                    var prevMatch1 = prevRoundMatchBase - prevRoundMatchCount + (m * 2 - 1);
                    var prevMatch2 = prevRoundMatchBase - prevRoundMatchCount + (m * 2);

                    unit1Label = $"W {prevRoundAbbr}{m * 2 - 1}";
                    unit2Label = $"W {prevRoundAbbr}{m * 2}";
                }

                matches.Add(new EventEncounter
                {
                    EventId = division.EventId,
                    DivisionId = division.Id,
                    RoundType = "Bracket",
                    RoundNumber = round,
                    RoundName = roundName,
                    MatchNumber = matchNum++,
                    BracketPosition = m,
                    BestOf = request.PlayoffGamesPerMatch ?? request.BestOf,
                    ScoreFormatId = request.PlayoffScoreFormatId ?? request.ScoreFormatId,
                    Unit1SeedLabel = unit1Label,
                    Unit2SeedLabel = unit2Label,
                    Status = "Scheduled",
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                });
            }
        }

        // Add bronze medal match (3rd place) - between losers of semi-finals
        // Only add if there are at least 2 rounds (meaning there are semi-finals)
        if (rounds >= 2)
        {
            matches.Add(new EventEncounter
            {
                EventId = division.EventId,
                DivisionId = division.Id,
                RoundType = RoundType.ThirdPlace,
                RoundNumber = rounds, // Same round as finals
                RoundName = "Bronze Medal",
                MatchNumber = matchNum++,
                BracketPosition = 1,
                Unit1SeedLabel = "L SF1", // Loser of Playoff Semi-final 1
                Unit2SeedLabel = "L SF2", // Loser of Playoff Semi-final 2
                BestOf = request.PlayoffGamesPerMatch ?? request.BestOf,
                ScoreFormatId = request.PlayoffScoreFormatId ?? request.ScoreFormatId,
                Status = "Scheduled",
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            });
        }

        return matches;
    }

    /// <summary>
    /// Generate seed labels for playoff positions based on pool configuration.
    /// Cross-pool seeding ensures pool winners face lower seeds from other pools.
    /// </summary>
    private Dictionary<int, string> GeneratePlayoffSeedLabels(int poolCount, int playoffFromPools, int bracketSize)
    {
        var labels = new Dictionary<int, string>();

        // Pool names: A, B, C, D, etc.
        var poolNames = Enumerable.Range(0, poolCount).Select(i => (char)('A' + i)).ToArray();

        // Generate seeds by alternating pools for each rank position
        // Seed 1: Pool A #1, Seed 2: Pool B #1, Seed 3: Pool C #1, ...
        // Seed N+1: Pool A #2, Seed N+2: Pool B #2, ...
        var seed = 1;
        for (int rank = 1; rank <= playoffFromPools && seed <= bracketSize; rank++)
        {
            for (int pool = 0; pool < poolCount && seed <= bracketSize; pool++)
            {
                labels[seed] = $"Pool {poolNames[pool]} #{rank}";
                seed++;
            }
        }

        return labels;
    }

    private List<EventEncounter> GenerateSingleEliminationMatchesForTarget(EventDivision division, int targetUnitCount, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventEncounter>();

        // Find next power of 2
        var bracketSize = 1;
        while (bracketSize < targetUnitCount) bracketSize *= 2;

        var rounds = (int)Math.Log2(bracketSize);
        var matchNum = 1;

        for (int round = 1; round <= rounds; round++)
        {
            var matchesInRound = bracketSize / (int)Math.Pow(2, round);
            var roundName = round == rounds ? "Final" :
                           round == rounds - 1 ? "Semifinal" :
                           round == rounds - 2 ? "Quarterfinal" :
                           $"Round {round}";

            for (int m = 1; m <= matchesInRound; m++)
            {
                matches.Add(new EventEncounter
                {
                    EventId = division.EventId,
                    DivisionId = division.Id,
                    RoundType = "Bracket",
                    RoundNumber = round,
                    RoundName = roundName,
                    MatchNumber = matchNum++,
                    BracketPosition = m,
                    BestOf = request.BestOf,
                    ScoreFormatId = request.ScoreFormatId,
                    Status = "Scheduled",
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                });
            }
        }

        // Assign first round matchups using seeded bracket positions
        var firstRoundMatches = matches.Where(m => m.RoundNumber == 1).OrderBy(m => m.BracketPosition).ToList();
        var seedPositions = GetSeededBracketPositions(bracketSize);

        for (int i = 0; i < firstRoundMatches.Count; i++)
        {
            var matchup = seedPositions[i];
            var seed1 = matchup.Item1;
            var seed2 = matchup.Item2;

            // Only assign if within target unit count (handle byes for non-power-of-2)
            if (seed1 <= targetUnitCount)
                firstRoundMatches[i].Unit1Number = seed1;
            if (seed2 <= targetUnitCount)
                firstRoundMatches[i].Unit2Number = seed2;
        }

        // Add bronze medal match (3rd place) - between losers of semi-finals
        // Only add if there are at least 4 units (meaning there are semi-finals)
        if (rounds >= 2)
        {
            matches.Add(new EventEncounter
            {
                EventId = division.EventId,
                DivisionId = division.Id,
                RoundType = RoundType.ThirdPlace,
                RoundNumber = rounds, // Same round as finals
                RoundName = "Bronze Medal",
                MatchNumber = matchNum++,
                BracketPosition = 1,
                Unit1SeedLabel = "L SF1", // Loser of Semi-final 1
                Unit2SeedLabel = "L SF2", // Loser of Semi-final 2
                BestOf = request.BestOf,
                ScoreFormatId = request.ScoreFormatId,
                Status = "Scheduled",
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            });
        }

        return matches;
    }

    /// <summary>
    /// Generate seeded bracket positions for standard tournament seeding.
    /// This ensures top seeds are placed to meet as late as possible.
    /// E.g., for 8 teams: (1,8), (4,5), (3,6), (2,7) so that 1 vs 2 can only happen in finals.
    /// </summary>
    private List<(int, int)> GetSeededBracketPositions(int bracketSize)
    {
        // Standard seeding algorithm:
        // Start with [1] and recursively split for each round
        // Round 1: [1]
        // Round 2: [1, 2] -> matches: 1 vs 2
        // Round 3: [1, 4, 3, 2] -> matches: 1 vs 4, 3 vs 2
        // Round 4: [1, 8, 5, 4, 3, 6, 7, 2] -> matches: 1 vs 8, 5 vs 4, 3 vs 6, 7 vs 2

        var seeds = new List<int> { 1 };

        while (seeds.Count < bracketSize)
        {
            var nextSeeds = new List<int>();
            var sum = seeds.Count * 2 + 1;

            foreach (var seed in seeds)
            {
                nextSeeds.Add(seed);
                nextSeeds.Add(sum - seed);
            }
            seeds = nextSeeds;
        }

        // Convert to matchups (pairs)
        var matchups = new List<(int, int)>();
        for (int i = 0; i < seeds.Count; i += 2)
        {
            matchups.Add((seeds[i], seeds[i + 1]));
        }

        return matchups;
    }

    private List<EventEncounter> GenerateDoubleEliminationMatchesForTarget(EventDivision division, int targetUnitCount, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventEncounter>();

        // Find next power of 2
        var bracketSize = 1;
        while (bracketSize < targetUnitCount) bracketSize *= 2;

        var winnersRounds = (int)Math.Log2(bracketSize);
        var matchNum = 1;

        // Winners bracket
        for (int round = 1; round <= winnersRounds; round++)
        {
            var matchesInRound = bracketSize / (int)Math.Pow(2, round);
            var roundName = round == winnersRounds ? "Winners Final" :
                           round == winnersRounds - 1 ? "Winners Semifinal" :
                           $"Winners Round {round}";

            for (int m = 1; m <= matchesInRound; m++)
            {
                matches.Add(new EventEncounter
                {
                    EventId = division.EventId,
                    DivisionId = division.Id,
                    RoundType = "Winners",
                    RoundNumber = round,
                    RoundName = roundName,
                    MatchNumber = matchNum++,
                    BracketPosition = m,
                    BestOf = request.BestOf,
                    ScoreFormatId = request.ScoreFormatId,
                    Status = "Scheduled",
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                });
            }
        }

        // Losers bracket (simplified)
        var losersRounds = (winnersRounds - 1) * 2;
        for (int round = 1; round <= losersRounds; round++)
        {
            var matchesInRound = bracketSize / (int)Math.Pow(2, (round + 1) / 2 + 1);
            if (matchesInRound < 1) matchesInRound = 1;

            var roundName = round == losersRounds ? "Losers Final" : $"Losers Round {round}";

            for (int m = 1; m <= matchesInRound; m++)
            {
                matches.Add(new EventEncounter
                {
                    EventId = division.EventId,
                    DivisionId = division.Id,
                    RoundType = "Losers",
                    RoundNumber = round,
                    RoundName = roundName,
                    MatchNumber = matchNum++,
                    BracketPosition = m,
                    BestOf = request.BestOf,
                    ScoreFormatId = request.ScoreFormatId,
                    Status = "Scheduled",
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                });
            }
        }

        // Grand Final
        matches.Add(new EventEncounter
        {
            EventId = division.EventId,
            DivisionId = division.Id,
            RoundType = "GrandFinal",
            RoundNumber = 1,
            RoundName = "Grand Final",
            MatchNumber = matchNum++,
            BracketPosition = 1,
            BestOf = request.BestOf,
            ScoreFormatId = request.ScoreFormatId,
            Status = "Scheduled",
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        });

        // Assign first round matchups using seeded bracket positions
        var firstRoundMatches = matches.Where(m => m.RoundType == "Winners" && m.RoundNumber == 1).OrderBy(m => m.BracketPosition).ToList();
        var seedPositions = GetSeededBracketPositions(bracketSize);

        for (int i = 0; i < firstRoundMatches.Count; i++)
        {
            var matchup = seedPositions[i];
            var seed1 = matchup.Item1;
            var seed2 = matchup.Item2;

            // Only assign if within target unit count (handle byes for non-power-of-2)
            if (seed1 <= targetUnitCount)
                firstRoundMatches[i].Unit1Number = seed1;
            if (seed2 <= targetUnitCount)
                firstRoundMatches[i].Unit2Number = seed2;
        }

        return matches;
    }

    private string? GetMatchScore(EventEncounter match)

    {
        var allGames = match.Matches.SelectMany(m => m.Games);
        // Show scores for any game that has been scored (has non-zero scores or is finished/completed)
        var scoredGames = allGames
            .Where(g => g.Status == "Finished" || g.Status == "Completed" ||
                        g.Unit1Score > 0 || g.Unit2Score > 0)
            .OrderBy(g => g.GameNumber)
            .ToList();

        if (!scoredGames.Any()) return null;

        return string.Join(", ", scoredGames.Select(g => $"{g.Unit1Score}-{g.Unit2Score}"));
    }

    private async Task UpdateUnitStats(EventGame game)
    {
        var encounter = game.EncounterMatch?.Encounter;
        if (encounter == null) return;

        var unit1 = await _context.EventUnits.FindAsync(encounter.Unit1Id);
        var unit2 = await _context.EventUnits.FindAsync(encounter.Unit2Id);

        if (unit1 != null)
        {
            if (game.WinnerUnitId == unit1.Id)
                unit1.GamesWon++;
            else
                unit1.GamesLost++;

            unit1.PointsScored += game.Unit1Score;
            unit1.PointsAgainst += game.Unit2Score;
            unit1.UpdatedAt = DateTime.Now;
        }

        if (unit2 != null)
        {
            if (game.WinnerUnitId == unit2.Id)
                unit2.GamesWon++;
            else
                unit2.GamesLost++;

            unit2.PointsScored += game.Unit2Score;
            unit2.PointsAgainst += game.Unit1Score;
            unit2.UpdatedAt = DateTime.Now;
        }
    }

    /// <summary>
    /// Adjusts unit stats when an already-finished game's score is changed.
    /// Subtracts old values and adds new values.
    /// </summary>
    private async Task AdjustUnitStats(EventEncounter encounter,
        int oldUnit1Score, int oldUnit2Score, int? oldWinnerId,
        int newUnit1Score, int newUnit2Score, int? newWinnerId)
    {
        var unit1 = await _context.EventUnits.FindAsync(encounter.Unit1Id);
        var unit2 = await _context.EventUnits.FindAsync(encounter.Unit2Id);

        if (unit1 != null)
        {
            // Adjust games won/lost if winner changed
            if (oldWinnerId != newWinnerId)
            {
                if (oldWinnerId == unit1.Id)
                {
                    unit1.GamesWon--;
                    unit1.GamesLost++;
                }
                else if (newWinnerId == unit1.Id)
                {
                    unit1.GamesWon++;
                    unit1.GamesLost--;
                }
            }

            // Adjust points (subtract old, add new)
            unit1.PointsScored = unit1.PointsScored - oldUnit1Score + newUnit1Score;
            unit1.PointsAgainst = unit1.PointsAgainst - oldUnit2Score + newUnit2Score;
            unit1.UpdatedAt = DateTime.Now;
        }

        if (unit2 != null)
        {
            // Adjust games won/lost if winner changed
            if (oldWinnerId != newWinnerId)
            {
                if (oldWinnerId == unit2.Id)
                {
                    unit2.GamesWon--;
                    unit2.GamesLost++;
                }
                else if (newWinnerId == unit2.Id)
                {
                    unit2.GamesWon++;
                    unit2.GamesLost--;
                }
            }

            // Adjust points (subtract old, add new)
            unit2.PointsScored = unit2.PointsScored - oldUnit2Score + newUnit2Score;
            unit2.PointsAgainst = unit2.PointsAgainst - oldUnit1Score + newUnit1Score;
            unit2.UpdatedAt = DateTime.Now;
        }
    }

    /// <summary>
    /// When a game finishes and frees up a court, check if there's another game queued
    /// on that court and automatically start it.
    /// </summary>
    private async Task StartNextQueuedGameOnCourt(int courtId, int eventId)
    {
        // Find the next queued game on this court
        var nextGame = await _context.EventGames
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(e => e!.Unit1).ThenInclude(u => u!.Members)
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(e => e!.Unit2).ThenInclude(u => u!.Members)
            .Include(g => g.TournamentCourt)
            .Where(g => g.TournamentCourtId == courtId
                && g.Status == "Queued"
                && g.EncounterMatch!.Encounter!.EventId == eventId)
            .OrderBy(g => g.QueuedAt)
            .FirstOrDefaultAsync();

        if (nextGame == null) return;

        // Start the next game
        nextGame.Status = "InProgress";
        nextGame.StartedAt = DateTime.Now;
        nextGame.UpdatedAt = DateTime.Now;

        // Update the court status
        var court = await _context.TournamentCourts.FindAsync(courtId);
        if (court != null)
        {
            court.Status = "InUse";
            court.CurrentGameId = nextGame.Id;
        }

        await _context.SaveChangesAsync();

        // Send notifications to players
        var encounter = nextGame.EncounterMatch?.Encounter;
        if (encounter != null)
        {
            var playerIds = new List<int>();
            if (encounter.Unit1?.Members != null)
                playerIds.AddRange(encounter.Unit1.Members.Where(m => m.InviteStatus == "Accepted").Select(m => m.UserId));
            if (encounter.Unit2?.Members != null)
                playerIds.AddRange(encounter.Unit2.Members.Where(m => m.InviteStatus == "Accepted").Select(m => m.UserId));

            if (playerIds.Count > 0)
            {
                var unit1Name = encounter.Unit1?.Name ?? "Team 1";
                var unit2Name = encounter.Unit2?.Name ?? "Team 2";
                var courtName = nextGame.TournamentCourt?.CourtLabel ?? "assigned court";
                var actionUrl = $"/event/{encounter.EventId}/gameday";

                foreach (var playerId in playerIds.Distinct())
                {
                    await _notificationService.CreateAndSendAsync(
                        playerId,
                        "GameUpdate",
                        "Game Starting!",
                        $"{unit1Name} vs {unit2Name} - {courtName}",
                        actionUrl,
                        "Game",
                        nextGame.Id);
                }
            }

            // Broadcast to event group for admin dashboard refresh
            await _notificationService.SendToEventAsync(encounter.EventId, new NotificationPayload
            {
                Type = "GameUpdate",
                Title = "Game Started",
                Message = $"Next game auto-started on {court?.CourtLabel}",
                ReferenceType = "Game",
                ReferenceId = nextGame.Id,
                CreatedAt = DateTime.Now
            });
        }
    }

    private async Task CheckMatchComplete(int matchId)
    {
        var match = await _context.EventEncounters
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .Include(m => m.Unit1)
            .Include(m => m.Unit2)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null) return;

        var allGames = match.Matches.SelectMany(m => m.Games);
        var gamesNeeded = (match.BestOf / 2) + 1;
        var unit1Wins = allGames.Count(g => g.WinnerUnitId == match.Unit1Id);
        var unit2Wins = allGames.Count(g => g.WinnerUnitId == match.Unit2Id);

        if (unit1Wins >= gamesNeeded || unit2Wins >= gamesNeeded)
        {
            match.WinnerUnitId = unit1Wins >= gamesNeeded ? match.Unit1Id : match.Unit2Id;
            match.Status = "Completed";
            match.CompletedAt = DateTime.Now;
            match.UpdatedAt = DateTime.Now;

            // Update match stats
            var winner = await _context.EventUnits.FindAsync(match.WinnerUnitId);
            var loserId = match.WinnerUnitId == match.Unit1Id ? match.Unit2Id : match.Unit1Id;
            var loser = await _context.EventUnits.FindAsync(loserId);

            if (winner != null)
            {
                winner.MatchesPlayed++;
                winner.MatchesWon++;
                winner.UpdatedAt = DateTime.Now;
            }

            if (loser != null)
            {
                loser.MatchesPlayed++;
                loser.MatchesLost++;
                loser.UpdatedAt = DateTime.Now;
            }

            await _context.SaveChangesAsync();

            // Broadcast match completion
            await _scoreBroadcaster.BroadcastMatchCompleted(match.EventId, match.DivisionId, new MatchCompletedDto
            {
                EncounterId = match.Id,
                DivisionId = match.DivisionId,
                RoundType = match.RoundType ?? "",
                RoundName = match.RoundName ?? "",
                Unit1Id = match.Unit1Id,
                Unit1Name = match.Unit1?.Name,
                Unit2Id = match.Unit2Id,
                Unit2Name = match.Unit2?.Name,
                WinnerUnitId = match.WinnerUnitId,
                WinnerName = winner?.Name,
                Score = $"{unit1Wins} - {unit2Wins}",
                CompletedAt = match.CompletedAt ?? DateTime.Now
            });

            // Check for bracket progression (playoff matches only)
            if (match.RoundType == "Bracket" || match.RoundType == "Final" || match.RoundType == "ThirdPlace")
            {
                var progressionResult = await _bracketProgressionService.CheckAndAdvanceAsync(matchId);

                if (progressionResult.WinnerAdvanced && progressionResult.NextMatchId.HasValue)
                {
                    // Broadcast bracket progression
                    await _scoreBroadcaster.BroadcastBracketProgression(match.EventId, match.DivisionId, new BracketProgressionDto
                    {
                        FromEncounterId = match.Id,
                        ToEncounterId = progressionResult.NextMatchId.Value,
                        DivisionId = match.DivisionId,
                        WinnerUnitId = match.WinnerUnitId ?? 0,
                        WinnerName = winner?.Name ?? "",
                        FromRoundName = match.RoundName ?? "",
                        NextRoundName = progressionResult.NextMatchRoundName ?? "",
                        SlotPosition = (match.BracketPosition ?? 0) % 2 == 1 ? 1 : 2,
                        AdvancedAt = DateTime.Now
                    });

                    _logger.LogInformation(
                        "Bracket progression: {WinnerName} advanced from {FromRound} to {NextRound} (Match {FromMatch} -> {ToMatch})",
                        winner?.Name, match.RoundName, progressionResult.NextMatchRoundName,
                        match.Id, progressionResult.NextMatchId);
                }
            }
        }
    }

    private async Task CallGameStatusChangeSP(int gameId, string oldStatus, string newStatus)
    {
        try
        {
            // Call the stored procedure for notifications
            await _context.Database.ExecuteSqlRawAsync(
                "EXEC sp_OnGameStatusChange @p0, @p1, @p2",
                gameId, oldStatus, newStatus);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to call sp_OnGameStatusChange for game {GameId}", gameId);
        }
    }

    private async Task<ActionResult<ApiResponse<CheckInStatusDto>>> GetCheckInStatus(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<CheckInStatusDto> { Success = false, Message = "Unauthorized" });

        var members = await _context.EventUnitMembers
            .Include(m => m.User)
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Division)
            .Where(m => m.UserId == userId.Value && m.Unit!.EventId == eventId && m.InviteStatus == "Accepted")
            .ToListAsync();

        var user = members.FirstOrDefault()?.User;

        var status = new CheckInStatusDto
        {
            EventId = eventId,
            UserId = userId.Value,
            UserName = user != null ? Utility.FormatName(user.LastName, user.FirstName) : null,
            ProfileImageUrl = user?.ProfileImageUrl,
            IsCheckedIn = members.All(m => m.IsCheckedIn),
            CheckedInAt = members.Where(m => m.IsCheckedIn).Min(m => m.CheckedInAt),
            Divisions = members.Select(m => new DivisionCheckInDto
            {
                DivisionId = m.Unit!.DivisionId,
                DivisionName = m.Unit.Division?.Name ?? "",
                UnitId = m.UnitId,
                UnitName = m.Unit.Name,
                IsCheckedIn = m.IsCheckedIn,
                CheckedInAt = m.CheckedInAt
            }).ToList()
        };

        return Ok(new ApiResponse<CheckInStatusDto> { Success = true, Data = status });
    }


    // ============================================
    // Live Drawing
    // ============================================

    /// <summary>
    /// Get the current drawing state for a division
    /// </summary>
    [HttpGet("divisions/{divisionId}/drawing")]
    public async Task<ActionResult<ApiResponse<DrawingStateDto>>> GetDrawingState(int divisionId)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<DrawingStateDto> { Success = false, Message = "Division not found" });

        if (!division.DrawingInProgress)
            return Ok(new ApiResponse<DrawingStateDto> { Success = true, Data = null, Message = "No drawing in progress" });

        var units = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .ToListAsync();

        var drawnUnits = units
            .Where(u => u.UnitNumber.HasValue)
            .OrderBy(u => u.UnitNumber)
            .Select(u => new DrawnUnitDto
            {
                UnitId = u.Id,
                UnitNumber = u.UnitNumber!.Value,
                UnitName = u.Name,
                MemberNames = u.Members.Where(m => m.InviteStatus == "Accepted" && m.User != null)
                    .Select(m => Utility.FormatName(m.User!.LastName, m.User.FirstName)).ToList(),
                DrawnAt = u.UpdatedAt
            }).ToList();

        var remainingUnitNames = units
            .Where(u => !u.UnitNumber.HasValue)
            .Select(u => u.Name)
            .ToList();

        var startedBy = division.DrawingByUserId.HasValue
            ? await _context.Users.FindAsync(division.DrawingByUserId.Value)
            : null;

        var state = new DrawingStateDto
        {
            DivisionId = division.Id,
            DivisionName = division.Name,
            EventId = division.EventId,
            EventName = division.Event?.Name ?? "",
            TotalUnits = units.Count,
            DrawnCount = drawnUnits.Count,
            DrawnUnits = drawnUnits,
            RemainingUnitNames = remainingUnitNames,
            StartedAt = division.DrawingStartedAt ?? DateTime.Now,
            StartedByName = startedBy != null ? Utility.FormatName(startedBy.LastName, startedBy.FirstName) : null
        };

        return Ok(new ApiResponse<DrawingStateDto> { Success = true, Data = state });
    }

    /// <summary>
    /// Start a live drawing session for a division
    /// </summary>
    [Authorize]
    [HttpPost("divisions/{divisionId}/drawing/start")]
    public async Task<ActionResult<ApiResponse<DrawingStateDto>>> StartDrawing(int divisionId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<DrawingStateDto> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<DrawingStateDto> { Success = false, Message = "Division not found" });

        var evt = division.Event;
        if (evt == null)
            return NotFound(new ApiResponse<DrawingStateDto> { Success = false, Message = "Event not found" });

        // Check if user is organizer or admin
        if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
            return Forbid();

        // Check if drawing is already in progress
        if (division.DrawingInProgress)
            return BadRequest(new ApiResponse<DrawingStateDto> { Success = false, Message = "Drawing is already in progress" });

        // Check registration is closed
        var now = DateTime.Now;
        var isRegistrationOpen = evt.TournamentStatus == "RegistrationOpen" ||
            (evt.RegistrationOpenDate <= now && (evt.RegistrationCloseDate == null || evt.RegistrationCloseDate > now));

        if (isRegistrationOpen)
            return BadRequest(new ApiResponse<DrawingStateDto> { Success = false, Message = "Cannot start drawing while registration is still open" });

        // Check schedule status
        if (division.ScheduleStatus == "Finalized")
            return BadRequest(new ApiResponse<DrawingStateDto> { Success = false, Message = "Schedule is already finalized. Clear the schedule first if you need to redraw." });

        // Get and validate units
        var units = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .ToListAsync();

        if (!units.Any())
            return BadRequest(new ApiResponse<DrawingStateDto> { Success = false, Message = "No units to draw" });

        // Note: Team completion check removed - admin can draw even with incomplete teams for testing

        // Clear any existing unit numbers
        foreach (var unit in units)
        {
            unit.UnitNumber = null;
            unit.PoolNumber = null;
            unit.PoolName = null;
        }

        // Start the drawing
        division.DrawingInProgress = true;
        division.DrawingStartedAt = DateTime.Now;
        division.DrawingByUserId = userId.Value;
        division.DrawingSequence = 0;
        division.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        var startedBy = await _context.Users.FindAsync(userId.Value);
        var state = new DrawingStateDto
        {
            DivisionId = division.Id,
            DivisionName = division.Name,
            EventId = division.EventId,
            EventName = evt.Name,
            TotalUnits = units.Count,
            DrawnCount = 0,
            DrawnUnits = new List<DrawnUnitDto>(),
            RemainingUnitNames = units.Select(u => u.Name).ToList(),
            StartedAt = division.DrawingStartedAt.Value,
            StartedByName = startedBy != null ? Utility.FormatName(startedBy.LastName, startedBy.FirstName) : null
        };

        // Broadcast to connected viewers (both division and event level)
        await _drawingBroadcaster.BroadcastDrawingStarted(divisionId, state);
        await _drawingBroadcaster.BroadcastEventDrawingStarted(division.EventId, divisionId, state);

        return Ok(new ApiResponse<DrawingStateDto> { Success = true, Data = state });
    }

    /// <summary>
    /// Draw the next unit (randomly selects from remaining units)
    /// </summary>
    [Authorize]
    [HttpPost("divisions/{divisionId}/drawing/next")]
    public async Task<ActionResult<ApiResponse<DrawnUnitDto>>> DrawNextUnit(int divisionId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<DrawnUnitDto> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<DrawnUnitDto> { Success = false, Message = "Division not found" });

        var evt = division.Event;
        if (evt == null)
            return NotFound(new ApiResponse<DrawnUnitDto> { Success = false, Message = "Event not found" });

        // Check if user is organizer or admin
        if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
            return Forbid();

        // Use stored procedure for atomic drawing to prevent race conditions
        var drawnUnitIdParam = new Microsoft.Data.SqlClient.SqlParameter("@DrawnUnitId", System.Data.SqlDbType.Int)
        {
            Direction = System.Data.ParameterDirection.Output
        };
        var assignedNumberParam = new Microsoft.Data.SqlClient.SqlParameter("@AssignedNumber", System.Data.SqlDbType.Int)
        {
            Direction = System.Data.ParameterDirection.Output
        };

        try
        {
            await _context.Database.ExecuteSqlRawAsync(
                "EXEC sp_DrawNextUnit @DivisionId, @DrawnUnitId OUTPUT, @AssignedNumber OUTPUT",
                new Microsoft.Data.SqlClient.SqlParameter("@DivisionId", divisionId),
                drawnUnitIdParam,
                assignedNumberParam
            );
        }
        catch (Microsoft.Data.SqlClient.SqlException ex)
        {
            // Map stored procedure errors to appropriate HTTP responses
            if (ex.Message.Contains("Division not found"))
                return NotFound(new ApiResponse<DrawnUnitDto> { Success = false, Message = "Division not found" });
            if (ex.Message.Contains("No drawing in progress"))
                return BadRequest(new ApiResponse<DrawnUnitDto> { Success = false, Message = "No drawing in progress. Start a drawing first." });
            if (ex.Message.Contains("No units remaining"))
                return BadRequest(new ApiResponse<DrawnUnitDto> { Success = false, Message = "All units have been drawn. Complete the drawing." });
            throw;
        }

        var drawnUnitId = (int)drawnUnitIdParam.Value;
        var assignedNumber = (int)assignedNumberParam.Value;

        // Fetch the drawn unit with member details for the response
        var selectedUnit = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(u => u.Id == drawnUnitId);

        if (selectedUnit == null)
            return StatusCode(500, new ApiResponse<DrawnUnitDto> { Success = false, Message = "Failed to retrieve drawn unit" });

        var drawnUnit = new DrawnUnitDto
        {
            UnitId = selectedUnit.Id,
            UnitNumber = assignedNumber,
            UnitName = selectedUnit.Name,
            MemberNames = selectedUnit.Members.Where(m => m.InviteStatus == "Accepted" && m.User != null)
                .Select(m => Utility.FormatName(m.User!.LastName, m.User.FirstName)).ToList(),
            DrawnAt = DateTime.Now
        };

        // Broadcast to connected viewers (both division and event level)
        await _drawingBroadcaster.BroadcastUnitDrawn(divisionId, drawnUnit);
        await _drawingBroadcaster.BroadcastEventUnitDrawn(division.EventId, divisionId, drawnUnit);

        return Ok(new ApiResponse<DrawnUnitDto> { Success = true, Data = drawnUnit });
    }

    /// <summary>
    /// Complete the drawing and finalize unit assignments
    /// </summary>
    [Authorize]
    [HttpPost("divisions/{divisionId}/drawing/complete")]
    public async Task<ActionResult<ApiResponse<DrawingCompletedDto>>> CompleteDrawing(int divisionId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<DrawingCompletedDto> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<DrawingCompletedDto> { Success = false, Message = "Division not found" });

        var evt = division.Event;
        if (evt == null)
            return NotFound(new ApiResponse<DrawingCompletedDto> { Success = false, Message = "Event not found" });

        // Check if user is organizer or admin
        if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
            return Forbid();

        // Check if drawing is in progress
        if (!division.DrawingInProgress)
            return BadRequest(new ApiResponse<DrawingCompletedDto> { Success = false, Message = "No drawing in progress" });

        // Check all units are drawn
        var undrawnUnits = await _context.EventUnits
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted" && u.UnitNumber == null)
            .CountAsync();

        if (undrawnUnits > 0)
            return BadRequest(new ApiResponse<DrawingCompletedDto> { Success = false, Message = $"{undrawnUnits} units have not been drawn yet" });

        // Update matches with actual unit IDs based on assigned numbers
        var units = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .ToListAsync();

        var matches = await _context.EventEncounters
            .Where(m => m.DivisionId == divisionId)
            .ToListAsync();

        foreach (var match in matches)
        {
            match.Unit1Id = units.FirstOrDefault(u => u.UnitNumber == match.Unit1Number)?.Id;
            match.Unit2Id = units.FirstOrDefault(u => u.UnitNumber == match.Unit2Number)?.Id;
            match.UpdatedAt = DateTime.Now;

            // Handle byes
            if (match.Unit1Id == null && match.Unit2Id != null)
            {
                match.WinnerUnitId = match.Unit2Id;
                match.Status = "Bye";
            }
            else if (match.Unit2Id == null && match.Unit1Id != null)
            {
                match.WinnerUnitId = match.Unit1Id;
                match.Status = "Bye";
            }
        }

        // End the drawing session
        division.DrawingInProgress = false;
        division.ScheduleStatus = "UnitsAssigned";
        division.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        var finalOrder = units
            .OrderBy(u => u.UnitNumber)
            .Select(u => new DrawnUnitDto
            {
                UnitId = u.Id,
                UnitNumber = u.UnitNumber ?? 0,
                UnitName = u.Name,
                MemberNames = u.Members.Where(m => m.InviteStatus == "Accepted" && m.User != null)
                    .Select(m => Utility.FormatName(m.User!.LastName, m.User.FirstName)).ToList(),
                DrawnAt = u.UpdatedAt
            }).ToList();

        var result = new DrawingCompletedDto
        {
            DivisionId = divisionId,
            FinalOrder = finalOrder,
            CompletedAt = DateTime.Now
        };

        // Broadcast completion to connected viewers (both division and event level)
        await _drawingBroadcaster.BroadcastDrawingCompleted(divisionId, result);
        await _drawingBroadcaster.BroadcastEventDrawingCompleted(division.EventId, divisionId, result);

        return Ok(new ApiResponse<DrawingCompletedDto> { Success = true, Data = result });
    }

    /// <summary>
    /// Cancel an in-progress drawing
    /// </summary>
    [Authorize]
    [HttpPost("divisions/{divisionId}/drawing/cancel")]
    public async Task<ActionResult<ApiResponse<bool>>> CancelDrawing(int divisionId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Division not found" });

        var evt = division.Event;
        if (evt == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

        // Check if user is organizer or admin
        if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
            return Forbid();

        // Allow cancelling both in-progress drawings and completed drawings (for redraw)
        // Check if there's anything to reset (either drawing in progress or units already assigned)
        var hasUnitsAssigned = await _context.EventUnits
            .AnyAsync(u => u.DivisionId == divisionId
                && u.Status != "Cancelled" && u.Status != "Waitlisted"
                && u.UnitNumber != null);

        if (!division.DrawingInProgress && !hasUnitsAssigned)
        {
            // Nothing to reset in database - but still broadcast to ensure UI state is synced
            await _drawingBroadcaster.BroadcastDrawingCancelled(divisionId);
            await _drawingBroadcaster.BroadcastEventDrawingCancelled(division.EventId, divisionId);
            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Already reset" });
        }

        // Clear unit numbers assigned during this drawing
        var units = await _context.EventUnits
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .ToListAsync();

        foreach (var unit in units)
        {
            unit.UnitNumber = null;
            unit.PoolNumber = null;
            unit.PoolName = null;
        }

        // Clear Unit1Id/Unit2Id from pool encounters to prevent stale pool assignments
        // This ensures GetSchedule derives pools correctly after a new drawing
        var poolEncounters = await _context.EventEncounters
            .Where(m => m.DivisionId == divisionId && m.RoundType == "Pool")
            .ToListAsync();

        foreach (var encounter in poolEncounters)
        {
            encounter.Unit1Id = null;
            encounter.Unit2Id = null;
            encounter.WinnerUnitId = null;
            encounter.Status = "Scheduled";
            encounter.UpdatedAt = DateTime.Now;
        }

        // End the drawing session and reset status
        division.DrawingInProgress = false;
        division.DrawingStartedAt = null;
        division.DrawingByUserId = null;
        division.DrawingSequence = 0;
        division.ScheduleStatus = "NotGenerated"; // Reset so drawing can start again
        division.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        // Broadcast cancellation to connected viewers (both division and event level)
        await _drawingBroadcaster.BroadcastDrawingCancelled(divisionId);
        await _drawingBroadcaster.BroadcastEventDrawingCancelled(division.EventId, divisionId);

        return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Drawing cancelled" });
    }


    // ============================================
    // Event-Level Drawing State (for Drawing Monitor)
    // ============================================

    /// <summary>
    /// Get the complete drawing state for an event (all divisions)
    /// Used by the drawing monitor page to show all divisions' drawing states
    /// </summary>
    [HttpGet("events/{eventId}/drawing")]
    public async Task<ActionResult<ApiResponse<EventDrawingStateDto>>> GetEventDrawingState(int eventId)
    {
        var evt = await _context.Events
            .Include(e => e.Divisions)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new ApiResponse<EventDrawingStateDto> { Success = false, Message = "Event not found" });

        var divisions = await _context.EventDivisions
            .Include(d => d.TeamUnit)
            .Where(d => d.EventId == eventId)
            .OrderBy(d => d.Name)
            .ToListAsync();

        var divisionStates = new List<DivisionDrawingStateDto>();

        foreach (var division in divisions)
        {
            var units = await _context.EventUnits
                .Include(u => u.Members)
                    .ThenInclude(m => m.User)
                .Where(u => u.DivisionId == division.Id && u.Status != "Cancelled" && u.Status != "Waitlisted")
                .ToListAsync();

            var drawnUnits = units
                .Where(u => u.UnitNumber.HasValue)
                .OrderBy(u => u.UnitNumber)
                .Select(u => new DrawnUnitDto
                {
                    UnitId = u.Id,
                    UnitNumber = u.UnitNumber!.Value,
                    UnitName = u.Name,
                    MemberNames = u.Members.Where(m => m.InviteStatus == "Accepted" && m.User != null)
                        .Select(m => Utility.FormatName(m.User!.LastName, m.User.FirstName)).ToList(),
                    DrawnAt = u.UpdatedAt
                }).ToList();

            var remainingUnitNames = units
                .Where(u => !u.UnitNumber.HasValue)
                .Select(u => u.Name)
                .ToList();

            User? startedBy = null;
            if (division.DrawingByUserId.HasValue)
            {
                startedBy = await _context.Users.FindAsync(division.DrawingByUserId.Value);
            }

            // Build units list with member info for display
            var unitsWithMembers = units.Select(u => new DrawingUnitDto
            {
                UnitId = u.Id,
                UnitName = u.Name,
                UnitNumber = u.UnitNumber,
                Members = u.Members
                    .Where(m => m.InviteStatus == "Accepted" && m.User != null)
                    .Select(m => new DrawingMemberDto
                    {
                        UserId = m.UserId,
                        Name = Utility.FormatName(m.User!.LastName, m.User.FirstName) ?? "",
                        AvatarUrl = m.User.ProfileImageUrl
                    }).ToList()
            }).ToList();

            divisionStates.Add(new DivisionDrawingStateDto
            {
                DivisionId = division.Id,
                DivisionName = division.Name,
                TeamSize = division.TeamUnit?.TotalPlayers ?? division.TeamSize,
                ScheduleStatus = division.ScheduleStatus ?? "NotGenerated",
                DrawingInProgress = division.DrawingInProgress,
                DrawingStartedAt = division.DrawingStartedAt,
                DrawingByName = startedBy != null ? Utility.FormatName(startedBy.LastName, startedBy.FirstName) : null,
                TotalUnits = units.Count,
                DrawnCount = drawnUnits.Count,
                DrawnUnits = drawnUnits,
                RemainingUnitNames = remainingUnitNames,
                Units = unitsWithMembers
            });
        }

        // Get current viewers
        var viewers = DrawingHub.GetEventViewers(eventId);

        // Check if current user can manage event
        var isOrganizer = await CanManageEventAsync(eventId);

        var state = new EventDrawingStateDto
        {
            EventId = evt.Id,
            EventName = evt.Name,
            TournamentStatus = evt.TournamentStatus ?? "Draft",
            IsOrganizer = isOrganizer,
            Divisions = divisionStates,
            Viewers = viewers,
            ViewerCount = viewers.Count
        };

        return Ok(new ApiResponse<EventDrawingStateDto> { Success = true, Data = state });
    }

    /// <summary>
    /// Set event tournament status to Drawing mode
    /// </summary>
    [Authorize]
    [HttpPost("events/{eventId}/drawing/start-mode")]
    public async Task<ActionResult<ApiResponse<bool>>> StartDrawingMode(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

        // Check if user is organizer or admin
        if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
            return Forbid();

        // Set to Drawing status
        evt.TournamentStatus = "Drawing";
        evt.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Event is now in Drawing mode" });
    }

    /// <summary>
    /// End drawing mode and transition to next status
    /// </summary>
    [Authorize]
    [HttpPost("events/{eventId}/drawing/end-mode")]
    public async Task<ActionResult<ApiResponse<bool>>> EndDrawingMode(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

        // Check if user is organizer or admin
        if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
            return Forbid();

        // Check if all divisions have completed drawing
        var divisions = await _context.EventDivisions
            .Where(d => d.EventId == eventId)
            .ToListAsync();

        var anyDrawingInProgress = divisions.Any(d => d.DrawingInProgress);
        if (anyDrawingInProgress)
            return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot end drawing mode while a division drawing is in progress" });

        // Set to Running status (or ScheduleReady if you prefer)
        evt.TournamentStatus = "Running";
        evt.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Drawing mode ended, event is now Running" });
    }


    // ============================================
    // Tournament Reset (for Testing/Dry Run)
    // ============================================

    /// <summary>
    /// Reset all tournament data for an event (drawings, scores, court assignments) except schedule structure.
    /// This is useful for testing and dry runs.
    /// </summary>
    [Authorize]
    [HttpPost("reset-tournament/{eventId}")]
    public async Task<ActionResult<ApiResponse<object>>> ResetTournament(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        // Check if user is admin or event organizer
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Event not found" });

        if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
            return Forbid();

        try
        {
            // Reset all units' drawing and stats data
            var units = await _context.EventUnits.Where(u => u.EventId == eventId).ToListAsync();
            foreach (var unit in units)
            {
                unit.UnitNumber = null;
                unit.PoolNumber = null;
                unit.PoolName = null;
                unit.Seed = null;
                unit.MatchesPlayed = 0;
                unit.MatchesWon = 0;
                unit.MatchesLost = 0;
                unit.GamesWon = 0;
                unit.GamesLost = 0;
                unit.PointsScored = 0;
                unit.PointsAgainst = 0;
                unit.PoolRank = null;
                unit.OverallRank = null;
                unit.AdvancedToPlayoff = false;
                unit.ManuallyAdvanced = false;
                unit.FinalPlacement = null;
                unit.UpdatedAt = DateTime.Now;
            }

            // Reset all encounters (keep structure, reset results and unit assignments for playoff rounds)
            var encounters = await _context.EventEncounters
                .Where(e => e.EventId == eventId)
                .ToListAsync();
            foreach (var encounter in encounters)
            {
                encounter.WinnerUnitId = null;
                encounter.Status = "Scheduled";
                encounter.StartedAt = null;
                encounter.CompletedAt = null;
                // Reset court planning assignments
                encounter.TournamentCourtId = null;
                encounter.ScheduledTime = null;
                encounter.EstimatedStartTime = null;
                encounter.UpdatedAt = DateTime.Now;

                // For playoff rounds (bracket), reset unit assignments since they depend on pool rankings
                if (encounter.RoundType != "Pool")
                {
                    // Keep Unit1Number and Unit2Number (bracket position), but reset actual unit IDs
                    encounter.Unit1Id = null;
                    encounter.Unit2Id = null;
                }
            }

            // Reset all encounter matches
            var encounterMatches = await _context.EncounterMatches
                .Where(m => m.Encounter!.EventId == eventId)
                .ToListAsync();
            foreach (var match in encounterMatches)
            {
                match.Unit1Score = 0;
                match.Unit2Score = 0;
                match.WinnerUnitId = null;
            }

            // Reset all games
            var games = await _context.EventGames
                .Where(g => g.EncounterMatch!.Encounter!.EventId == eventId)
                .ToListAsync();
            foreach (var game in games)
            {
                game.Unit1Score = 0;
                game.Unit2Score = 0;
                game.WinnerUnitId = null;
                game.Status = "Scheduled";
                game.TournamentCourtId = null;
                game.QueuedAt = null;
                game.StartedAt = null;
                game.FinishedAt = null;
                game.ScoreSubmittedByUnitId = null;
                game.ScoreSubmittedAt = null;
                game.ScoreConfirmedByUnitId = null;
                game.ScoreConfirmedAt = null;
                game.UpdatedAt = DateTime.Now;
            }

            // Reset all courts
            var courts = await _context.TournamentCourts.Where(c => c.EventId == eventId).ToListAsync();
            foreach (var court in courts)
            {
                court.CurrentGameId = null;
                court.Status = "Available";
            }

            // Delete all score history using raw SQL to avoid EF Core query generation issues
            try
            {
                await _context.Database.ExecuteSqlRawAsync(@"
                    DELETE h FROM EventGameScoreHistories h
                    INNER JOIN EventGames g ON h.GameId = g.Id
                    INNER JOIN EncounterMatches m ON g.EncounterMatchId = m.Id
                    INNER JOIN EventEncounters e ON m.EncounterId = e.Id
                    WHERE e.EventId = {0}", eventId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not delete score histories for event {EventId} - table may not exist", eventId);
            }

            // Delete game-related notifications for this event using raw SQL
            // This avoids EF Core SQL generation issues with Contains() on lists
            await _context.Database.ExecuteSqlRawAsync(@"
                DELETE FROM Notifications
                WHERE (ReferenceType = 'Event' AND ReferenceId = {0})
                OR (ReferenceType = 'Game' AND ReferenceId IN (
                    SELECT g.Id FROM EventGames g
                    INNER JOIN EncounterMatches m ON g.EncounterMatchId = m.Id
                    INNER JOIN EventEncounters e ON m.EncounterId = e.Id
                    WHERE e.EventId = {0}
                ))", eventId);

            // Reset division drawing state
            var divisions = await _context.EventDivisions.Where(d => d.EventId == eventId).ToListAsync();
            foreach (var division in divisions)
            {
                division.DrawingInProgress = false;
                division.DrawingSequence = 0;
                division.DrawingStartedAt = null;
                division.DrawingByUserId = null;
                // Keep ScheduleStatus unchanged since we want to preserve the schedule structure
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Tournament {EventId} reset by user {UserId}", eventId, userId.Value);

            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Tournament data has been reset. Drawing results, game scores, and court assignments have been cleared. Schedule structure is preserved."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resetting tournament {EventId}", eventId);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Message = "Failed to reset tournament: " + ex.Message
            });
        }
    }

}
