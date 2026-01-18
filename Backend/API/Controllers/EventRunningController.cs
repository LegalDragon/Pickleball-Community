using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Services;
using System.Security.Claims;

namespace Pickleball.Community.API.Controllers;

/// <summary>
/// Controller for managing running events (Tournament Director dashboard and Player dashboard)
/// </summary>
[ApiController]
[Route("event-running")]
[Authorize]
public class EventRunningController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly INotificationService _notificationService;
    private readonly ILogger<EventRunningController> _logger;

    public EventRunningController(
        ApplicationDbContext context,
        INotificationService notificationService,
        ILogger<EventRunningController> logger)
    {
        _context = context;
        _notificationService = notificationService;
        _logger = logger;
    }

    private int? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int userId))
            return userId;
        return null;
    }

    private async Task<bool> IsEventOrganizerAsync(int eventId, int userId)
    {
        var evt = await _context.Events.FindAsync(eventId);
        return evt != null && evt.OrganizedByUserId == userId;
    }

    private async Task<bool> IsAdminAsync()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return false;
        var user = await _context.Users.FindAsync(userId.Value);
        return user?.Role == "Admin";
    }

    // ==========================================
    // Player Endpoints - Check for Running Events
    // ==========================================

    /// <summary>
    /// Get running events for the current user (for auto pop-up at login)
    /// </summary>
    [HttpGet("my-running-events")]
    public async Task<IActionResult> GetMyRunningEvents()
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        // Get events where user is registered and event is Running
        var runningEvents = await _context.EventUnitMembers
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Event)
                    .ThenInclude(e => e!.EventType)
            .Where(m => m.UserId == userId.Value
                && m.InviteStatus == "Accepted"
                && m.Unit!.Status != "Cancelled"
                && m.Unit.Event!.TournamentStatus == "Running"
                && m.Unit.Event.IsActive)
            .Select(m => new RunningEventDto
            {
                EventId = m.Unit!.EventId,
                EventName = m.Unit.Event!.Name,
                EventTypeName = m.Unit.Event.EventType!.Name,
                EventTypeIcon = m.Unit.Event.EventType.Icon,
                VenueName = m.Unit.Event.VenueName,
                StartDate = m.Unit.Event.StartDate,
                DivisionId = m.Unit.DivisionId,
                DivisionName = m.Unit.Division!.Name,
                UnitId = m.Unit.Id,
                UnitName = m.Unit.Name,
                IsCheckedIn = m.IsCheckedIn,
                IsOrganizer = m.Unit.Event.OrganizedByUserId == userId.Value
            })
            .ToListAsync();

        return Ok(new { success = true, data = runningEvents });
    }

    /// <summary>
    /// Get player's event dashboard data
    /// </summary>
    [HttpGet("player/{eventId}")]
    public async Task<IActionResult> GetPlayerDashboard(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var evt = await _context.Events
            .Include(e => e.EventType)
            .FirstOrDefaultAsync(e => e.Id == eventId && e.IsActive);

        if (evt == null)
            return NotFound(new { success = false, message = "Event not found" });

        // Get user's units in this event
        var myUnits = await _context.EventUnitMembers
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Division)
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Members)
                    .ThenInclude(mem => mem.User)
            .Where(m => m.UserId == userId.Value
                && m.Unit!.EventId == eventId
                && m.InviteStatus == "Accepted"
                && m.Unit.Status != "Cancelled")
            .Select(m => m.Unit!)
            .ToListAsync();

        if (!myUnits.Any())
            return NotFound(new { success = false, message = "You are not registered for this event" });

        // Get all matches for user's units
        var unitIds = myUnits.Select(u => u.Id).ToList();
        var matches = await _context.EventMatches
            .Include(m => m.Unit1).ThenInclude(u => u!.Members).ThenInclude(mem => mem.User)
            .Include(m => m.Unit2).ThenInclude(u => u!.Members).ThenInclude(mem => mem.User)
            .Include(m => m.Division)
            .Include(m => m.TournamentCourt)
            .Include(m => m.Matches).ThenInclude(match => match.Games).ThenInclude(g => g.TournamentCourt)
            .Where(m => m.EventId == eventId &&
                (unitIds.Contains(m.Unit1Id ?? 0) || unitIds.Contains(m.Unit2Id ?? 0)))
            .OrderBy(m => m.ScheduledTime ?? m.CreatedAt)
            .ToListAsync();

        // Get notifications for this event
        var notifications = await _context.Notifications
            .Where(n => n.UserId == userId.Value
                && n.ReferenceType == "Event"
                && n.ReferenceId == eventId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(20)
            .ToListAsync();

        // Get courts
        var courts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ToListAsync();

        var dashboard = new PlayerEventDashboardDto
        {
            EventId = evt.Id,
            EventName = evt.Name,
            EventTypeName = evt.EventType?.Name,
            TournamentStatus = evt.TournamentStatus,
            StartDate = evt.StartDate,
            VenueName = evt.VenueName,
            MyUnits = myUnits.Select(u => new PlayerUnitDto
            {
                Id = u.Id,
                Name = u.Name,
                DivisionId = u.DivisionId,
                DivisionName = u.Division?.Name ?? "",
                Status = u.Status,
                MatchesPlayed = u.MatchesPlayed,
                MatchesWon = u.MatchesWon,
                MatchesLost = u.MatchesLost,
                Members = u.Members
                    .Where(m => m.InviteStatus == "Accepted")
                    .Select(m => new PlayerMemberDto
                    {
                        UserId = m.UserId,
                        Name = Utility.FormatName(m.User?.LastName, m.User?.FirstName),
                        ProfileImageUrl = m.User?.ProfileImageUrl,
                        IsCheckedIn = m.IsCheckedIn,
                        IsMe = m.UserId == userId.Value
                    }).ToList()
            }).ToList(),
            Schedule = matches.Select(m => MapToMatchDto(m, unitIds)).ToList(),
            Courts = courts.Select(c => new CourtStatusDto
            {
                Id = c.Id,
                Label = c.CourtLabel,
                Status = c.Status,
                CurrentGameId = c.CurrentGameId
            }).ToList(),
            Notifications = notifications.Select(n => new EventNotificationDto
            {
                Id = n.Id,
                Type = n.Type,
                Title = n.Title,
                Message = n.Message,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            }).ToList()
        };

        return Ok(new { success = true, data = dashboard });
    }

    /// <summary>
    /// Check in player for event
    /// </summary>
    [HttpPost("player/{eventId}/check-in")]
    public async Task<IActionResult> CheckInPlayer(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var members = await _context.EventUnitMembers
            .Include(m => m.Unit)
            .Where(m => m.UserId == userId.Value
                && m.Unit!.EventId == eventId
                && m.InviteStatus == "Accepted"
                && m.Unit.Status != "Cancelled")
            .ToListAsync();

        if (!members.Any())
            return NotFound(new { success = false, message = "You are not registered for this event" });

        var now = DateTime.Now;
        foreach (var member in members)
        {
            member.IsCheckedIn = true;
            member.CheckedInAt = now;
        }

        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Checked in successfully" });
    }

    /// <summary>
    /// Check in unit as captain (checks in all team members)
    /// </summary>
    [HttpPost("player/{eventId}/unit/{unitId}/check-in")]
    public async Task<IActionResult> CheckInUnitAsCaptain(int eventId, int unitId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var unit = await _context.EventUnits
            .Include(u => u.Members)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId && u.Status != "Cancelled");

        if (unit == null)
            return NotFound(new { success = false, message = "Unit not found" });

        // Verify user is the captain of this unit
        if (unit.CaptainUserId != userId.Value)
        {
            return Forbid();
        }

        var now = DateTime.Now;

        // Check in all accepted members
        foreach (var member in unit.Members.Where(m => m.InviteStatus == "Accepted"))
        {
            member.IsCheckedIn = true;
            member.CheckedInAt = now;
        }

        // Update unit status to CheckedIn
        unit.Status = "CheckedIn";
        unit.UpdatedAt = now;

        await _context.SaveChangesAsync();

        return Ok(new {
            success = true,
            message = "Team checked in successfully",
            checkedInCount = unit.Members.Count(m => m.InviteStatus == "Accepted")
        });
    }

    /// <summary>
    /// Get check-in status for a unit
    /// </summary>
    [HttpGet("player/{eventId}/unit/{unitId}/check-in-status")]
    public async Task<IActionResult> GetUnitCheckInStatus(int eventId, int unitId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var unit = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return NotFound(new { success = false, message = "Unit not found" });

        // Verify user is a member of this unit
        var isMember = unit.Members.Any(m => m.UserId == userId.Value && m.InviteStatus == "Accepted");
        if (!isMember)
            return Forbid();

        var members = unit.Members
            .Where(m => m.InviteStatus == "Accepted")
            .Select(m => new
            {
                UserId = m.UserId,
                Name = Utility.FormatName(m.User?.LastName, m.User?.FirstName),
                ProfileImageUrl = m.User?.ProfileImageUrl,
                IsCheckedIn = m.IsCheckedIn,
                CheckedInAt = m.CheckedInAt
            }).ToList();

        return Ok(new
        {
            success = true,
            data = new
            {
                UnitId = unit.Id,
                UnitName = unit.Name,
                UnitStatus = unit.Status,
                IsCaptain = unit.CaptainUserId == userId.Value,
                Members = members,
                AllCheckedIn = members.All(m => m.IsCheckedIn),
                CheckedInCount = members.Count(m => m.IsCheckedIn),
                TotalMembers = members.Count
            }
        });
    }

    /// <summary>
    /// Submit or verify game score (player)
    /// </summary>
    [HttpPost("player/games/{gameId}/score")]
    public async Task<IActionResult> SubmitPlayerScore(int gameId, [FromBody] PlayerScoreSubmitDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var game = await _context.EventGames
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Unit1)
                        .ThenInclude(u => u!.Members)
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Unit2)
                        .ThenInclude(u => u!.Members)
            .FirstOrDefaultAsync(g => g.Id == gameId);

        if (game == null)
            return NotFound(new { success = false, message = "Game not found" });

        // Check if user is a player in this game
        var encounter = game.EncounterMatch!.Encounter!;
        var unit1Members = encounter.Unit1?.Members?.Select(m => m.UserId).ToList() ?? new List<int>();
        var unit2Members = encounter.Unit2?.Members?.Select(m => m.UserId).ToList() ?? new List<int>();

        int? userUnitId = null;
        if (unit1Members.Contains(userId.Value))
            userUnitId = encounter.Unit1Id;
        else if (unit2Members.Contains(userId.Value))
            userUnitId = encounter.Unit2Id;

        if (!userUnitId.HasValue)
            return Forbid();

        var now = DateTime.Now;

        // If this is a score submission
        if (!game.ScoreSubmittedByUnitId.HasValue)
        {
            var prevUnit1Score = game.Unit1Score;
            var prevUnit2Score = game.Unit2Score;

            game.Unit1Score = dto.Unit1Score;
            game.Unit2Score = dto.Unit2Score;
            game.ScoreSubmittedByUnitId = userUnitId;
            game.ScoreSubmittedAt = now;
            game.UpdatedAt = now;

            await _context.SaveChangesAsync();

            // Log score submission to audit trail
            await LogScoreChangeAsync(
                game.Id,
                ScoreChangeType.ScoreSubmitted,
                dto.Unit1Score,
                dto.Unit2Score,
                prevUnit1Score,
                prevUnit2Score,
                userId.Value,
                userUnitId);

            // Notify the other team to verify
            var otherUnitId = userUnitId == encounter.Unit1Id ? encounter.Unit2Id : encounter.Unit1Id;
            if (otherUnitId.HasValue)
            {
                var otherMembers = await _context.EventUnitMembers
                    .Where(m => m.UnitId == otherUnitId.Value && m.InviteStatus == "Accepted")
                    .Select(m => m.UserId)
                    .ToListAsync();

                await _notificationService.CreateAndSendToUsersAsync(
                    otherMembers,
                    "GameReady",
                    "Score Submitted - Please Verify",
                    $"Your opponent submitted score: {dto.Unit1Score}-{dto.Unit2Score}. Please verify.",
                    $"/event-dashboard/{encounter.EventId}",
                    "Game",
                    game.Id
                );
            }

            return Ok(new { success = true, message = "Score submitted. Waiting for opponent verification." });
        }
        // If this is a score verification (from the other team)
        else if (game.ScoreSubmittedByUnitId != userUnitId)
        {
            if (dto.Confirm == true)
            {
                game.ScoreConfirmedByUnitId = userUnitId;
                game.ScoreConfirmedAt = now;
                game.Status = "Finished";
                game.FinishedAt = now;
                game.WinnerUnitId = game.Unit1Score > game.Unit2Score ? encounter.Unit1Id : encounter.Unit2Id;
                game.UpdatedAt = now;

                // Update match if needed
                await UpdateMatchAfterGameComplete(game);

                await _context.SaveChangesAsync();

                // Log score confirmation to audit trail
                await LogScoreChangeAsync(
                    game.Id,
                    ScoreChangeType.ScoreConfirmed,
                    game.Unit1Score,
                    game.Unit2Score,
                    null,
                    null,
                    userId.Value,
                    userUnitId);

                return Ok(new { success = true, message = "Score confirmed. Game completed." });
            }
            else
            {
                game.ScoreDisputedAt = now;
                game.ScoreDisputeReason = dto.DisputeReason;
                game.UpdatedAt = now;

                await _context.SaveChangesAsync();

                // Log score dispute to audit trail
                await LogScoreChangeAsync(
                    game.Id,
                    ScoreChangeType.ScoreDisputed,
                    game.Unit1Score,
                    game.Unit2Score,
                    null,
                    null,
                    userId.Value,
                    userUnitId,
                    dto.DisputeReason);

                // Notify TD about dispute
                var evt = await _context.Events.FindAsync(encounter.EventId);
                if (evt != null)
                {
                    await _notificationService.CreateAndSendAsync(
                        evt.OrganizedByUserId,
                        "EventUpdate",
                        "Score Dispute",
                        $"Game score disputed. Reason: {dto.DisputeReason}",
                        $"/event-running/{encounter.EventId}/admin",
                        "Game",
                        game.Id
                    );
                }

                return Ok(new { success = true, message = "Score disputed. TD has been notified." });
            }
        }

        return BadRequest(new { success = false, message = "You have already submitted a score for this game." });
    }

    // ==========================================
    // Admin/TD Endpoints
    // ==========================================

    /// <summary>
    /// Get admin dashboard overview for a running event
    /// </summary>
    [HttpGet("{eventId}/admin")]
    public async Task<IActionResult> GetAdminDashboard(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var evt = await _context.Events
            .Include(e => e.EventType)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new { success = false, message = "Event not found" });

        var isOrganizer = evt.OrganizedByUserId == userId.Value;
        var isAdmin = await IsAdminAsync();

        if (!isOrganizer && !isAdmin)
            return Forbid();

        // Get divisions with units
        var divisions = await _context.EventDivisions
            .Include(d => d.TeamUnit)
            .Include(d => d.Units)
                .ThenInclude(u => u.Members)
                    .ThenInclude(m => m.User)
            .Where(d => d.EventId == eventId && d.IsActive)
            .OrderBy(d => d.SortOrder)
            .ToListAsync();

        // Get all matches
        var matches = await _context.EventMatches
            .Include(m => m.Unit1).ThenInclude(u => u!.Members).ThenInclude(mem => mem.User)
            .Include(m => m.Unit2).ThenInclude(u => u!.Members).ThenInclude(mem => mem.User)
            .Include(m => m.Division)
            .Include(m => m.TournamentCourt)
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .Where(m => m.EventId == eventId)
            .OrderBy(m => m.ScheduledTime ?? m.CreatedAt)
            .ToListAsync();

        // Get courts
        var courts = await _context.TournamentCourts
            .Include(c => c.CurrentGame)
                .ThenInclude(g => g!.EncounterMatch)
                    .ThenInclude(m => m!.Encounter)
            .Where(c => c.EventId == eventId && c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ToListAsync();

        // Calculate stats
        var totalPlayers = divisions.SelectMany(d => d.Units)
            .Where(u => u.Status != "Cancelled")
            .SelectMany(u => u.Members.Where(m => m.InviteStatus == "Accepted"))
            .Count();
        var checkedInPlayers = divisions.SelectMany(d => d.Units)
            .Where(u => u.Status != "Cancelled")
            .SelectMany(u => u.Members.Where(m => m.InviteStatus == "Accepted" && m.IsCheckedIn))
            .Count();

        var dashboard = new AdminEventDashboardDto
        {
            EventId = evt.Id,
            EventName = evt.Name,
            EventTypeName = evt.EventType?.Name,
            TournamentStatus = evt.TournamentStatus,
            StartDate = evt.StartDate,
            VenueName = evt.VenueName,
            Stats = new EventStatsDto
            {
                TotalUnits = divisions.Sum(d => d.Units.Count(u => u.Status != "Cancelled")),
                TotalPlayers = totalPlayers,
                CheckedInPlayers = checkedInPlayers,
                TotalCourts = courts.Count,
                ActiveCourts = courts.Count(c => c.Status == "InUse"),
                TotalMatches = matches.Count,
                CompletedMatches = matches.Count(m => m.Status == "Completed"),
                InProgressMatches = matches.Count(m => m.Status == "InProgress"),
                QueuedMatches = matches.Count(m => m.Status == "Queued" || m.Status == "Ready"),
                DisputedGames = matches.SelectMany(m => m.Matches.SelectMany(em => em.Games))
                    .Count(g => g.ScoreDisputedAt.HasValue && g.Status != "Finished")
            },
            Divisions = divisions.Select(d => new AdminDivisionDto
            {
                Id = d.Id,
                Name = d.Name,
                TeamSize = d.TeamUnit?.TotalPlayers ?? d.TeamSize,
                Units = d.Units
                    .Where(u => u.Status != "Cancelled")
                    .OrderBy(u => u.Name)
                    .Select(u => new AdminUnitDto
                    {
                        Id = u.Id,
                        Name = u.Name,
                        Status = u.Status,
                        PoolNumber = u.PoolNumber,
                        PoolName = u.PoolName,
                        Seed = u.Seed,
                        MatchesPlayed = u.MatchesPlayed,
                        MatchesWon = u.MatchesWon,
                        MatchesLost = u.MatchesLost,
                        GamesWon = u.GamesWon,
                        GamesLost = u.GamesLost,
                        Members = u.Members
                            .Where(m => m.InviteStatus == "Accepted")
                            .Select(m => new AdminPlayerDto
                            {
                                UserId = m.UserId,
                                Name = Utility.FormatName(m.User?.LastName, m.User?.FirstName),
                                ProfileImageUrl = m.User?.ProfileImageUrl,
                                IsCheckedIn = m.IsCheckedIn,
                                CheckedInAt = m.CheckedInAt
                            }).ToList()
                    }).ToList()
            }).ToList(),
            Courts = courts.Select(c => new AdminCourtDto
            {
                Id = c.Id,
                Label = c.CourtLabel,
                Status = c.Status,
                CurrentGameId = c.CurrentGameId,
                CurrentMatch = c.CurrentGame?.EncounterMatch?.Encounter != null ? new AdminMatchSummaryDto
                {
                    Id = c.CurrentGame.EncounterMatch!.Encounter!.Id,
                    Unit1Name = c.CurrentGame.EncounterMatch.Encounter.Unit1?.Name ?? "TBD",
                    Unit2Name = c.CurrentGame.EncounterMatch.Encounter.Unit2?.Name ?? "TBD",
                    Status = c.CurrentGame.EncounterMatch.Encounter.Status
                } : null
            }).ToList(),
            Matches = matches.Select(m => MapToAdminMatchDto(m)).ToList(),
            MatchQueue = matches
                .Where(m => m.Status == "Ready" || m.Status == "Queued")
                .OrderBy(m => m.Status == "Queued" ? 0 : 1)
                .ThenBy(m => m.CreatedAt)
                .Select(m => MapToAdminMatchDto(m))
                .ToList()
        };

        return Ok(new { success = true, data = dashboard });
    }

    /// <summary>
    /// Update event tournament status (e.g., start running, complete)
    /// </summary>
    [HttpPut("{eventId}/status")]
    public async Task<IActionResult> UpdateEventStatus(int eventId, [FromBody] UpdateEventStatusDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new { success = false, message = "Event not found" });

        if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
            return Forbid();

        var oldStatus = evt.TournamentStatus;
        evt.TournamentStatus = dto.Status;
        evt.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        // Notify all registered players about status change
        if (oldStatus != dto.Status)
        {
            var playerIds = await _context.EventUnitMembers
                .Where(m => m.Unit!.EventId == eventId && m.InviteStatus == "Accepted")
                .Select(m => m.UserId)
                .Distinct()
                .ToListAsync();

            string message = dto.Status switch
            {
                "Running" => "The event has started! Check your schedule.",
                "Completed" => "The event has completed. Thanks for participating!",
                "Cancelled" => "The event has been cancelled.",
                _ => $"Event status changed to {dto.Status}"
            };

            await _notificationService.CreateAndSendToUsersAsync(
                playerIds,
                "EventUpdate",
                $"Event Update: {evt.Name}",
                message,
                $"/event-dashboard/{eventId}",
                "Event",
                eventId
            );
        }

        return Ok(new { success = true });
    }

    /// <summary>
    /// Queue a match (add to court queue)
    /// </summary>
    [HttpPost("{eventId}/queue-match")]
    public async Task<IActionResult> QueueMatch(int eventId, [FromBody] QueueMatchDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        if (!await IsEventOrganizerAsync(eventId, userId.Value) && !await IsAdminAsync())
            return Forbid();

        var match = await _context.EventMatches
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .Include(m => m.Unit1).ThenInclude(u => u!.Members)
            .Include(m => m.Unit2).ThenInclude(u => u!.Members)
            .FirstOrDefaultAsync(m => m.Id == dto.MatchId && m.EventId == eventId);

        if (match == null)
            return NotFound(new { success = false, message = "Match not found" });

        TournamentCourt? court = null;
        if (dto.CourtId.HasValue)
        {
            court = await _context.TournamentCourts.FindAsync(dto.CourtId.Value);
            if (court == null || court.EventId != eventId)
                return BadRequest(new { success = false, message = "Invalid court" });
        }

        match.TournamentCourtId = dto.CourtId;
        match.Status = dto.CourtId.HasValue ? "Queued" : "Ready";
        match.UpdatedAt = DateTime.Now;

        // Update first unfinished game
        var currentGame = match.Matches.SelectMany(m => m.Games).OrderBy(g => g.GameNumber).FirstOrDefault(g => g.Status != "Finished");
        if (currentGame != null)
        {
            currentGame.TournamentCourtId = dto.CourtId;
            currentGame.Status = dto.CourtId.HasValue ? "Queued" : "Ready";
            currentGame.QueuedAt = DateTime.Now;
            currentGame.UpdatedAt = DateTime.Now;
        }

        await _context.SaveChangesAsync();

        // Notify players about court assignment
        if (dto.CourtId.HasValue)
        {
            var playerIds = new List<int>();
            playerIds.AddRange(match.Unit1?.Members?.Select(m => m.UserId) ?? new List<int>());
            playerIds.AddRange(match.Unit2?.Members?.Select(m => m.UserId) ?? new List<int>());

            await _notificationService.CreateAndSendToUsersAsync(
                playerIds.Distinct(),
                "GameReady",
                "Match Assigned to Court",
                $"Your match is queued on {court?.CourtLabel}. Please proceed to the court.",
                $"/event-dashboard/{eventId}",
                "Game",
                currentGame?.Id ?? match.Id
            );
        }

        return Ok(new { success = true });
    }

    /// <summary>
    /// Assign court to a match
    /// </summary>
    [HttpPut("{eventId}/matches/{matchId}/court")]
    public async Task<IActionResult> AssignCourt(int eventId, int matchId, [FromBody] AssignCourtToMatchDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        if (!await IsEventOrganizerAsync(eventId, userId.Value) && !await IsAdminAsync())
            return Forbid();

        var match = await _context.EventMatches
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .Include(m => m.TournamentCourt)
            .Include(m => m.Unit1).ThenInclude(u => u!.Members)
            .Include(m => m.Unit2).ThenInclude(u => u!.Members)
            .FirstOrDefaultAsync(m => m.Id == matchId && m.EventId == eventId);

        if (match == null)
            return NotFound(new { success = false, message = "Match not found" });

        // Free previous court if any
        if (match.TournamentCourt != null)
        {
            match.TournamentCourt.Status = "Available";
            match.TournamentCourt.CurrentGameId = null;
        }

        TournamentCourt? newCourt = null;
        if (dto.CourtId.HasValue)
        {
            newCourt = await _context.TournamentCourts.FindAsync(dto.CourtId.Value);
            if (newCourt == null || newCourt.EventId != eventId)
                return BadRequest(new { success = false, message = "Invalid court" });
        }

        match.TournamentCourtId = dto.CourtId;
        match.UpdatedAt = DateTime.Now;

        var currentGame = match.Matches.SelectMany(m => m.Games).OrderBy(g => g.GameNumber).FirstOrDefault(g => g.Status != "Finished");
        if (currentGame != null)
        {
            currentGame.TournamentCourtId = dto.CourtId;
            currentGame.UpdatedAt = DateTime.Now;
        }

        await _context.SaveChangesAsync();

        // Notify players about court change
        if (dto.CourtId.HasValue && dto.NotifyPlayers != false)
        {
            var playerIds = new List<int>();
            playerIds.AddRange(match.Unit1?.Members?.Select(m => m.UserId) ?? new List<int>());
            playerIds.AddRange(match.Unit2?.Members?.Select(m => m.UserId) ?? new List<int>());

            await _notificationService.CreateAndSendToUsersAsync(
                playerIds.Distinct(),
                "EventUpdate",
                "Court Assignment Updated",
                $"Your match has been assigned to {newCourt?.CourtLabel}.",
                $"/event-dashboard/{eventId}",
                "Event",
                eventId
            );
        }

        return Ok(new { success = true });
    }

    /// <summary>
    /// Start a match
    /// </summary>
    [HttpPost("{eventId}/matches/{matchId}/start")]
    public async Task<IActionResult> StartMatch(int eventId, int matchId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        if (!await IsEventOrganizerAsync(eventId, userId.Value) && !await IsAdminAsync())
            return Forbid();

        var match = await _context.EventMatches
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .Include(m => m.TournamentCourt)
            .Include(m => m.Unit1).ThenInclude(u => u!.Members)
            .Include(m => m.Unit2).ThenInclude(u => u!.Members)
            .FirstOrDefaultAsync(m => m.Id == matchId && m.EventId == eventId);

        if (match == null)
            return NotFound(new { success = false, message = "Match not found" });

        var now = DateTime.Now;
        match.Status = "InProgress";
        match.StartedAt = now;
        match.UpdatedAt = now;

        // Update current game and court
        var currentGame = match.Matches.SelectMany(m => m.Games).OrderBy(g => g.GameNumber).FirstOrDefault(g => g.Status != "Finished");
        if (currentGame != null)
        {
            currentGame.Status = "Playing";
            currentGame.StartedAt = now;
            currentGame.UpdatedAt = now;

            if (match.TournamentCourt != null)
            {
                match.TournamentCourt.Status = "InUse";
                match.TournamentCourt.CurrentGameId = currentGame.Id;
            }
        }

        await _context.SaveChangesAsync();

        // Notify players
        var playerIds = new List<int>();
        playerIds.AddRange(match.Unit1?.Members?.Select(m => m.UserId) ?? new List<int>());
        playerIds.AddRange(match.Unit2?.Members?.Select(m => m.UserId) ?? new List<int>());

        await _notificationService.CreateAndSendToUsersAsync(
            playerIds.Distinct(),
            "GameReady",
            "Match Started",
            $"Your match has started on {match.TournamentCourt?.CourtLabel ?? "your assigned court"}!",
            $"/event-dashboard/{eventId}",
            "Game",
            currentGame?.Id ?? match.Id
        );

        return Ok(new { success = true });
    }

    /// <summary>
    /// Edit game score (admin override)
    /// </summary>
    [HttpPut("{eventId}/games/{gameId}/score")]
    public async Task<IActionResult> EditGameScore(int eventId, int gameId, [FromBody] AdminEditScoreDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        if (!await IsEventOrganizerAsync(eventId, userId.Value) && !await IsAdminAsync())
            return Forbid();

        var game = await _context.EventGames
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Unit1).ThenInclude(u => u!.Members)
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Unit2).ThenInclude(u => u!.Members)
            .FirstOrDefaultAsync(g => g.Id == gameId && g.EncounterMatch!.Encounter!.EventId == eventId);

        if (game == null)
            return NotFound(new { success = false, message = "Game not found" });

        var encounter = game.EncounterMatch!.Encounter!;
        var now = DateTime.Now;
        var prevUnit1Score = game.Unit1Score;
        var prevUnit2Score = game.Unit2Score;

        game.Unit1Score = dto.Unit1Score;
        game.Unit2Score = dto.Unit2Score;
        game.UpdatedAt = now;
        game.Notes = $"{game.Notes ?? ""}\n[TD Edit {now:g}] Score changed to {dto.Unit1Score}-{dto.Unit2Score}".Trim();

        if (dto.IsFinished == true)
        {
            game.Status = "Finished";
            game.FinishedAt = now;
            game.WinnerUnitId = dto.Unit1Score > dto.Unit2Score ? encounter.Unit1Id : encounter.Unit2Id;

            // Clear any dispute
            game.ScoreDisputedAt = null;
            game.ScoreDisputeReason = null;
            game.ScoreConfirmedByUnitId = null; // TD override doesn't need confirmation
            game.ScoreConfirmedAt = now;

            await UpdateMatchAfterGameComplete(game);
        }

        await _context.SaveChangesAsync();

        // Log score edit to audit trail
        await LogScoreChangeAsync(
            game.Id,
            dto.IsFinished == true ? ScoreChangeType.AdminOverride : ScoreChangeType.ScoreEdited,
            dto.Unit1Score,
            dto.Unit2Score,
            prevUnit1Score,
            prevUnit2Score,
            userId.Value,
            null,
            "TD override",
            true);

        // Notify players about score edit
        if (dto.NotifyPlayers != false)
        {
            var playerIds = new List<int>();
            playerIds.AddRange(encounter.Unit1?.Members?.Select(m => m.UserId) ?? new List<int>());
            playerIds.AddRange(encounter.Unit2?.Members?.Select(m => m.UserId) ?? new List<int>());

            await _notificationService.CreateAndSendToUsersAsync(
                playerIds.Distinct(),
                "EventUpdate",
                "Score Updated by TD",
                $"The tournament director has updated the score to {dto.Unit1Score}-{dto.Unit2Score}.",
                $"/event-dashboard/{eventId}",
                "Game",
                game.Id
            );
        }

        return Ok(new { success = true });
    }

    /// <summary>
    /// Get score history for a game (admin only)
    /// </summary>
    [HttpGet("{eventId}/games/{gameId}/history")]
    public async Task<IActionResult> GetGameScoreHistory(int eventId, int gameId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        if (!await IsEventOrganizerAsync(eventId, userId.Value) && !await IsAdminAsync())
            return Forbid();

        var game = await _context.EventGames
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
            .FirstOrDefaultAsync(g => g.Id == gameId && g.EncounterMatch!.Encounter!.EventId == eventId);

        if (game == null)
            return NotFound(new { success = false, message = "Game not found" });

        var history = await _context.EventGameScoreHistories
            .Include(h => h.ChangedByUser)
            .Where(h => h.GameId == gameId)
            .OrderByDescending(h => h.CreatedAt)
            .Select(h => new ScoreHistoryDto
            {
                Id = h.Id,
                ChangeType = h.ChangeType,
                Unit1Score = h.Unit1Score,
                Unit2Score = h.Unit2Score,
                PreviousUnit1Score = h.PreviousUnit1Score,
                PreviousUnit2Score = h.PreviousUnit2Score,
                ChangedByUserId = h.ChangedByUserId,
                ChangedByName = Utility.FormatName(h.ChangedByUser!.LastName, h.ChangedByUser.FirstName),
                ChangedByUnitId = h.ChangedByUnitId,
                Reason = h.Reason,
                IsAdminOverride = h.IsAdminOverride,
                CreatedAt = h.CreatedAt
            })
            .ToListAsync();

        return Ok(new { success = true, data = history });
    }

    /// <summary>
    /// Update player status (check-in, withdraw, etc.)
    /// </summary>
    [HttpPut("{eventId}/players/{playerId}/status")]
    public async Task<IActionResult> UpdatePlayerStatus(int eventId, int playerId, [FromBody] UpdatePlayerStatusDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        if (!await IsEventOrganizerAsync(eventId, userId.Value) && !await IsAdminAsync())
            return Forbid();

        var members = await _context.EventUnitMembers
            .Include(m => m.Unit)
            .Where(m => m.UserId == playerId
                && m.Unit!.EventId == eventId
                && m.InviteStatus == "Accepted")
            .ToListAsync();

        if (!members.Any())
            return NotFound(new { success = false, message = "Player not found in this event" });

        var now = DateTime.Now;
        foreach (var member in members)
        {
            if (dto.IsCheckedIn.HasValue)
            {
                member.IsCheckedIn = dto.IsCheckedIn.Value;
                member.CheckedInAt = dto.IsCheckedIn.Value ? now : null;
            }

            if (!string.IsNullOrEmpty(dto.UnitStatus) && member.Unit != null)
            {
                member.Unit.Status = dto.UnitStatus;
            }
        }

        await _context.SaveChangesAsync();

        // Notify player about status change
        if (dto.NotifyPlayer != false)
        {
            string message = dto.UnitStatus switch
            {
                "Withdrawn" => "You have been withdrawn from the event.",
                "CheckedIn" => "You have been checked in to the event.",
                _ => "Your status has been updated by the tournament director."
            };

            await _notificationService.CreateAndSendAsync(
                playerId,
                "EventUpdate",
                "Status Update",
                message,
                $"/event-dashboard/{eventId}",
                "Event",
                eventId
            );
        }

        return Ok(new { success = true });
    }

    /// <summary>
    /// Send direct message to player
    /// </summary>
    [HttpPost("{eventId}/message-player")]
    public async Task<IActionResult> MessagePlayer(int eventId, [FromBody] MessagePlayerDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        if (!await IsEventOrganizerAsync(eventId, userId.Value) && !await IsAdminAsync())
            return Forbid();

        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new { success = false, message = "Event not found" });

        // Send notification to player
        await _notificationService.CreateAndSendAsync(
            dto.PlayerId,
            "Message",
            $"Message from TD: {evt.Name}",
            dto.Message,
            $"/event-dashboard/{eventId}",
            "Event",
            eventId
        );

        return Ok(new { success = true, message = "Message sent" });
    }

    /// <summary>
    /// Broadcast message to all players in event
    /// </summary>
    [HttpPost("{eventId}/broadcast")]
    public async Task<IActionResult> BroadcastMessage(int eventId, [FromBody] BroadcastMessageDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        if (!await IsEventOrganizerAsync(eventId, userId.Value) && !await IsAdminAsync())
            return Forbid();

        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new { success = false, message = "Event not found" });

        // Get all players
        var playerIds = await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.InviteStatus == "Accepted")
            .Select(m => m.UserId)
            .Distinct()
            .ToListAsync();

        await _notificationService.CreateAndSendToUsersAsync(
            playerIds,
            "EventUpdate",
            dto.Title ?? $"Announcement: {evt.Name}",
            dto.Message,
            $"/event-dashboard/{eventId}",
            "Event",
            eventId
        );

        return Ok(new { success = true, message = $"Message sent to {playerIds.Count} players" });
    }

    // ==========================================
    // Helper Methods
    // ==========================================

    /// <summary>
    /// Log a score change to the audit trail
    /// </summary>
    private async Task LogScoreChangeAsync(
        int gameId,
        string changeType,
        int unit1Score,
        int unit2Score,
        int? previousUnit1Score,
        int? previousUnit2Score,
        int changedByUserId,
        int? changedByUnitId = null,
        string? reason = null,
        bool isAdminOverride = false)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        var history = new EventGameScoreHistory
        {
            GameId = gameId,
            ChangeType = changeType,
            Unit1Score = unit1Score,
            Unit2Score = unit2Score,
            PreviousUnit1Score = previousUnit1Score,
            PreviousUnit2Score = previousUnit2Score,
            ChangedByUserId = changedByUserId,
            ChangedByUnitId = changedByUnitId,
            Reason = reason,
            IsAdminOverride = isAdminOverride,
            IpAddress = ipAddress,
            CreatedAt = DateTime.Now
        };

        _context.EventGameScoreHistories.Add(history);
        await _context.SaveChangesAsync();
    }

    private async Task UpdateMatchAfterGameComplete(EventGame game)
    {
        var encounterId = game.EncounterMatch?.EncounterId ?? 0;
        var encounter = await _context.EventMatches
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .Include(m => m.TournamentCourt)
            .Include(m => m.Unit1)
            .Include(m => m.Unit2)
            .FirstOrDefaultAsync(m => m.Id == encounterId);

        if (encounter == null) return;

        var allGames = encounter.Matches.SelectMany(m => m.Games);
        var unit1Wins = allGames.Count(g => g.WinnerUnitId == encounter.Unit1Id);
        var unit2Wins = allGames.Count(g => g.WinnerUnitId == encounter.Unit2Id);
        var winsNeeded = (encounter.BestOf / 2) + 1;

        if (unit1Wins >= winsNeeded || unit2Wins >= winsNeeded)
        {
            encounter.Status = "Completed";
            encounter.WinnerUnitId = unit1Wins >= winsNeeded ? encounter.Unit1Id : encounter.Unit2Id;
            encounter.CompletedAt = DateTime.Now;
            encounter.UpdatedAt = DateTime.Now;

            // Free up the court
            if (encounter.TournamentCourt != null)
            {
                encounter.TournamentCourt.Status = "Available";
                encounter.TournamentCourt.CurrentGameId = null;
            }

            // Update unit stats
            if (encounter.Unit1 != null && encounter.Unit2 != null)
            {
                encounter.Unit1.MatchesPlayed++;
                encounter.Unit2.MatchesPlayed++;

                if (encounter.WinnerUnitId == encounter.Unit1Id)
                {
                    encounter.Unit1.MatchesWon++;
                    encounter.Unit2.MatchesLost++;
                }
                else
                {
                    encounter.Unit2.MatchesWon++;
                    encounter.Unit1.MatchesLost++;
                }

                encounter.Unit1.GamesWon += unit1Wins;
                encounter.Unit1.GamesLost += unit2Wins;
                encounter.Unit2.GamesWon += unit2Wins;
                encounter.Unit2.GamesLost += unit1Wins;
            }
        }
    }

    private PlayerMatchDto MapToMatchDto(EventEncounter m, List<int> myUnitIds)
    {
        var allGames = m.Matches?.SelectMany(match => match.Games).ToList() ?? new List<EventGame>();
        var currentGame = allGames.OrderBy(g => g.GameNumber).FirstOrDefault(g => g.Status != "Finished")
            ?? allGames.OrderByDescending(g => g.GameNumber).FirstOrDefault();

        var isMyMatch = myUnitIds.Contains(m.Unit1Id ?? 0) || myUnitIds.Contains(m.Unit2Id ?? 0);
        var myUnitId = myUnitIds.Contains(m.Unit1Id ?? 0) ? m.Unit1Id : m.Unit2Id;

        return new PlayerMatchDto
        {
            Id = m.Id,
            DivisionName = m.Division?.Name ?? "",
            RoundType = m.RoundType,
            RoundName = m.RoundName,
            MatchNumber = m.MatchNumber,
            Unit1Name = m.Unit1?.Name ?? "TBD",
            Unit2Name = m.Unit2?.Name ?? "TBD",
            Unit1Id = m.Unit1Id,
            Unit2Id = m.Unit2Id,
            MyUnitId = myUnitId,
            CourtLabel = currentGame?.TournamentCourt?.CourtLabel ?? m.TournamentCourt?.CourtLabel,
            ScheduledTime = m.ScheduledTime,
            Status = currentGame?.Status ?? m.Status,
            BestOf = m.BestOf,
            CurrentGameNumber = currentGame?.GameNumber ?? 1,
            Unit1Score = currentGame?.Unit1Score ?? 0,
            Unit2Score = currentGame?.Unit2Score ?? 0,
            Unit1Wins = allGames.Count(g => g.WinnerUnitId == m.Unit1Id),
            Unit2Wins = allGames.Count(g => g.WinnerUnitId == m.Unit2Id),
            WinnerUnitId = m.WinnerUnitId,
            NeedsScoreVerification = currentGame != null
                && currentGame.ScoreSubmittedByUnitId.HasValue
                && currentGame.ScoreSubmittedByUnitId != myUnitId
                && !currentGame.ScoreConfirmedByUnitId.HasValue,
            IsDisputed = currentGame?.ScoreDisputedAt.HasValue ?? false,
            Games = allGames.OrderBy(g => g.GameNumber).Select(g => new PlayerGameDto
            {
                Id = g.Id,
                GameNumber = g.GameNumber,
                Unit1Score = g.Unit1Score,
                Unit2Score = g.Unit2Score,
                Status = g.Status,
                WinnerUnitId = g.WinnerUnitId
            }).ToList()
        };
    }

    private AdminMatchDto MapToAdminMatchDto(EventEncounter m)
    {
        var allGames = m.Matches?.SelectMany(match => match.Games).ToList() ?? new List<EventGame>();
        var currentGame = allGames.OrderBy(g => g.GameNumber).FirstOrDefault(g => g.Status != "Finished")
            ?? allGames.OrderByDescending(g => g.GameNumber).FirstOrDefault();

        return new AdminMatchDto
        {
            Id = m.Id,
            DivisionId = m.DivisionId,
            DivisionName = m.Division?.Name ?? "",
            RoundType = m.RoundType,
            RoundName = m.RoundName,
            MatchNumber = m.MatchNumber,
            Unit1 = m.Unit1 != null ? new AdminMatchUnitDto
            {
                Id = m.Unit1.Id,
                Name = m.Unit1.Name,
                Members = m.Unit1.Members?
                    .Where(mem => mem.InviteStatus == "Accepted")
                    .Select(mem => new AdminPlayerDto
                    {
                        UserId = mem.UserId,
                        Name = Utility.FormatName(mem.User?.LastName, mem.User?.FirstName),
                        ProfileImageUrl = mem.User?.ProfileImageUrl,
                        IsCheckedIn = mem.IsCheckedIn
                    }).ToList() ?? new List<AdminPlayerDto>()
            } : null,
            Unit2 = m.Unit2 != null ? new AdminMatchUnitDto
            {
                Id = m.Unit2.Id,
                Name = m.Unit2.Name,
                Members = m.Unit2.Members?
                    .Where(mem => mem.InviteStatus == "Accepted")
                    .Select(mem => new AdminPlayerDto
                    {
                        UserId = mem.UserId,
                        Name = Utility.FormatName(mem.User?.LastName, mem.User?.FirstName),
                        ProfileImageUrl = mem.User?.ProfileImageUrl,
                        IsCheckedIn = mem.IsCheckedIn
                    }).ToList() ?? new List<AdminPlayerDto>()
            } : null,
            CourtId = m.TournamentCourtId,
            CourtLabel = m.TournamentCourt?.CourtLabel,
            ScheduledTime = m.ScheduledTime,
            StartedAt = m.StartedAt,
            Status = m.Status,
            BestOf = m.BestOf,
            CurrentGameNumber = currentGame?.GameNumber ?? 1,
            Unit1Score = currentGame?.Unit1Score ?? 0,
            Unit2Score = currentGame?.Unit2Score ?? 0,
            Unit1Wins = allGames.Count(g => g.WinnerUnitId == m.Unit1Id),
            Unit2Wins = allGames.Count(g => g.WinnerUnitId == m.Unit2Id),
            WinnerUnitId = m.WinnerUnitId,
            IsDisputed = currentGame?.ScoreDisputedAt.HasValue ?? false,
            DisputeReason = currentGame?.ScoreDisputeReason,
            Games = allGames.OrderBy(g => g.GameNumber).Select(g => new AdminGameDto
            {
                Id = g.Id,
                GameNumber = g.GameNumber,
                Unit1Score = g.Unit1Score,
                Unit2Score = g.Unit2Score,
                Status = g.Status,
                WinnerUnitId = g.WinnerUnitId,
                ScoreSubmittedByUnitId = g.ScoreSubmittedByUnitId,
                ScoreConfirmedByUnitId = g.ScoreConfirmedByUnitId,
                IsDisputed = g.ScoreDisputedAt.HasValue
            }).ToList()
        };
    }
}

// ==========================================
// DTOs
// ==========================================

public class RunningEventDto
{
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public string? EventTypeName { get; set; }
    public string? EventTypeIcon { get; set; }
    public string? VenueName { get; set; }
    public DateTime StartDate { get; set; }
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public bool IsCheckedIn { get; set; }
    public bool IsOrganizer { get; set; }
}

public class PlayerEventDashboardDto
{
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public string? EventTypeName { get; set; }
    public string TournamentStatus { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public string? VenueName { get; set; }
    public List<PlayerUnitDto> MyUnits { get; set; } = new();
    public List<PlayerMatchDto> Schedule { get; set; } = new();
    public List<CourtStatusDto> Courts { get; set; } = new();
    public List<EventNotificationDto> Notifications { get; set; } = new();
}

public class PlayerUnitDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int MatchesPlayed { get; set; }
    public int MatchesWon { get; set; }
    public int MatchesLost { get; set; }
    public List<PlayerMemberDto> Members { get; set; } = new();
}

public class PlayerMemberDto
{
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public bool IsCheckedIn { get; set; }
    public bool IsMe { get; set; }
}

public class PlayerMatchDto
{
    public int Id { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public string RoundType { get; set; } = string.Empty;
    public string? RoundName { get; set; }
    public int MatchNumber { get; set; }
    public string Unit1Name { get; set; } = string.Empty;
    public string Unit2Name { get; set; } = string.Empty;
    public int? Unit1Id { get; set; }
    public int? Unit2Id { get; set; }
    public int? MyUnitId { get; set; }
    public string? CourtLabel { get; set; }
    public DateTime? ScheduledTime { get; set; }
    public string Status { get; set; } = string.Empty;
    public int BestOf { get; set; }
    public int CurrentGameNumber { get; set; }
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public int Unit1Wins { get; set; }
    public int Unit2Wins { get; set; }
    public int? WinnerUnitId { get; set; }
    public bool NeedsScoreVerification { get; set; }
    public bool IsDisputed { get; set; }
    public List<PlayerGameDto> Games { get; set; } = new();
}

public class PlayerGameDto
{
    public int Id { get; set; }
    public int GameNumber { get; set; }
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? WinnerUnitId { get; set; }
}

public class CourtStatusDto
{
    public int Id { get; set; }
    public string Label { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int? CurrentGameId { get; set; }
}

public class EventNotificationDto
{
    public int Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Message { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AdminEventDashboardDto
{
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public string? EventTypeName { get; set; }
    public string TournamentStatus { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public string? VenueName { get; set; }
    public EventStatsDto Stats { get; set; } = new();
    public List<AdminDivisionDto> Divisions { get; set; } = new();
    public List<AdminCourtDto> Courts { get; set; } = new();
    public List<AdminMatchDto> Matches { get; set; } = new();
    public List<AdminMatchDto> MatchQueue { get; set; } = new();
}

public class EventStatsDto
{
    public int TotalUnits { get; set; }
    public int TotalPlayers { get; set; }
    public int CheckedInPlayers { get; set; }
    public int TotalCourts { get; set; }
    public int ActiveCourts { get; set; }
    public int TotalMatches { get; set; }
    public int CompletedMatches { get; set; }
    public int InProgressMatches { get; set; }
    public int QueuedMatches { get; set; }
    public int DisputedGames { get; set; }
}

public class AdminDivisionDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int TeamSize { get; set; }
    public List<AdminUnitDto> Units { get; set; } = new();
}

public class AdminUnitDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int? PoolNumber { get; set; }
    public string? PoolName { get; set; }
    public int? Seed { get; set; }
    public int MatchesPlayed { get; set; }
    public int MatchesWon { get; set; }
    public int MatchesLost { get; set; }
    public int GamesWon { get; set; }
    public int GamesLost { get; set; }
    public List<AdminPlayerDto> Members { get; set; } = new();
}

public class AdminPlayerDto
{
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public bool IsCheckedIn { get; set; }
    public DateTime? CheckedInAt { get; set; }
}

public class AdminCourtDto
{
    public int Id { get; set; }
    public string Label { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int? CurrentGameId { get; set; }
    public AdminMatchSummaryDto? CurrentMatch { get; set; }
}

public class AdminMatchSummaryDto
{
    public int Id { get; set; }
    public string Unit1Name { get; set; } = string.Empty;
    public string Unit2Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

public class AdminMatchDto
{
    public int Id { get; set; }
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public string RoundType { get; set; } = string.Empty;
    public string? RoundName { get; set; }
    public int MatchNumber { get; set; }
    public AdminMatchUnitDto? Unit1 { get; set; }
    public AdminMatchUnitDto? Unit2 { get; set; }
    public int? CourtId { get; set; }
    public string? CourtLabel { get; set; }
    public DateTime? ScheduledTime { get; set; }
    public DateTime? StartedAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public int BestOf { get; set; }
    public int CurrentGameNumber { get; set; }
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public int Unit1Wins { get; set; }
    public int Unit2Wins { get; set; }
    public int? WinnerUnitId { get; set; }
    public bool IsDisputed { get; set; }
    public string? DisputeReason { get; set; }
    public List<AdminGameDto> Games { get; set; } = new();
}

public class AdminMatchUnitDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public List<AdminPlayerDto> Members { get; set; } = new();
}

public class AdminGameDto
{
    public int Id { get; set; }
    public int GameNumber { get; set; }
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? WinnerUnitId { get; set; }
    public int? ScoreSubmittedByUnitId { get; set; }
    public int? ScoreConfirmedByUnitId { get; set; }
    public bool IsDisputed { get; set; }
}

// Request DTOs
public class PlayerScoreSubmitDto
{
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public bool? Confirm { get; set; }
    public string? DisputeReason { get; set; }
}

public class UpdateEventStatusDto
{
    public string Status { get; set; } = string.Empty;
}

public class QueueMatchDto
{
    public int MatchId { get; set; }
    public int? CourtId { get; set; }
}

public class AssignCourtToMatchDto
{
    public int? CourtId { get; set; }
    public bool? NotifyPlayers { get; set; }
}

public class AdminEditScoreDto
{
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public bool? IsFinished { get; set; }
    public bool? NotifyPlayers { get; set; }
}

public class UpdatePlayerStatusDto
{
    public bool? IsCheckedIn { get; set; }
    public string? UnitStatus { get; set; } // Registered, CheckedIn, Withdrawn, etc.
    public bool? NotifyPlayer { get; set; }
}

public class MessagePlayerDto
{
    public int PlayerId { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class BroadcastMessageDto
{
    public string? Title { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class ScoreHistoryDto
{
    public int Id { get; set; }
    public string ChangeType { get; set; } = string.Empty;
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public int? PreviousUnit1Score { get; set; }
    public int? PreviousUnit2Score { get; set; }
    public int ChangedByUserId { get; set; }
    public string ChangedByName { get; set; } = string.Empty;
    public int? ChangedByUnitId { get; set; }
    public string? Reason { get; set; }
    public bool IsAdminOverride { get; set; }
    public DateTime CreatedAt { get; set; }
}
