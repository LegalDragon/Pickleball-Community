using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Services;
using System.Security.Claims;

namespace Pickleball.Community.Controllers;

[Route("tournament-gameday")]
[ApiController]
public class TournamentGameDayController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly NotificationService _notificationService;
    private readonly ILogger<TournamentGameDayController> _logger;

    public TournamentGameDayController(
        ApplicationDbContext context,
        NotificationService notificationService,
        ILogger<TournamentGameDayController> logger)
    {
        _context = context;
        _notificationService = notificationService;
        _logger = logger;
    }

    private int GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
        return int.TryParse(userIdClaim, out var id) ? id : 0;
    }

    private async Task<bool> IsEventOrganizer(int eventId, int userId)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null) return false;
        var user = await _context.Users.FindAsync(userId);
        return evt.OrganizedByUserId == userId || user?.Role == "Admin";
    }

    /// <summary>
    /// Get TD dashboard data for an event
    /// </summary>
    [HttpGet("td/{eventId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<TDDashboardDto>>> GetTDDashboard(int eventId)
    {
        var userId = GetUserId();
        if (!await IsEventOrganizer(eventId, userId))
            return Forbid();

        var evt = await _context.Events
            .Include(e => e.Divisions)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new ApiResponse<TDDashboardDto> { Success = false, Message = "Event not found" });

        // Get courts
        var courts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive)
            .Include(c => c.CurrentGame)
                .ThenInclude(g => g!.Match)
            .OrderBy(c => c.SortOrder)
            .ToListAsync();

        // Get check-in stats
        var allMembers = await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.InviteStatus == "Accepted")
            .Select(m => new { m.UserId, m.IsCheckedIn, m.WaiverSignedAt })
            .ToListAsync();

        var uniqueUsers = allMembers.GroupBy(m => m.UserId).Select(g => g.First()).ToList();

        // Get games by status
        var games = await _context.EventGames
            .Where(g => g.Match!.EventId == eventId)
            .GroupBy(g => g.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        // Get ready games with details
        var readyGames = await GetReadyGamesInternal(eventId, null);

        // Get in-progress games
        var inProgressGames = await _context.EventGames
            .Where(g => g.Match!.EventId == eventId && (g.Status == "Queued" || g.Status == "Started" || g.Status == "Playing"))
            .Include(g => g.Match)
                .ThenInclude(m => m!.Unit1)
            .Include(g => g.Match)
                .ThenInclude(m => m!.Unit2)
            .Include(g => g.TournamentCourt)
            .OrderBy(g => g.QueuedAt)
            .Select(g => new GameQueueItemDto
            {
                GameId = g.Id,
                GameNumber = g.GameNumber,
                Status = g.Status,
                Unit1Score = g.Unit1Score,
                Unit2Score = g.Unit2Score,
                MatchId = g.MatchId,
                RoundType = g.Match!.RoundType,
                RoundName = g.Match.RoundName,
                DivisionId = g.Match.DivisionId,
                Unit1Id = g.Match.Unit1Id,
                Unit1Name = g.Match.Unit1!.Name,
                Unit2Id = g.Match.Unit2Id,
                Unit2Name = g.Match.Unit2!.Name,
                CourtId = g.TournamentCourtId,
                CourtName = g.TournamentCourt != null ? g.TournamentCourt.CourtLabel : null,
                CourtNumber = g.TournamentCourt != null ? g.TournamentCourt.SortOrder : null,
                QueuedAt = g.QueuedAt,
                StartedAt = g.StartedAt
            })
            .ToListAsync();

        return Ok(new ApiResponse<TDDashboardDto>
        {
            Success = true,
            Data = new TDDashboardDto
            {
                EventId = eventId,
                EventName = evt.Name,
                EventStatus = evt.TournamentStatus,
                TotalPlayers = uniqueUsers.Count,
                CheckedInPlayers = uniqueUsers.Count(u => u.IsCheckedIn),
                WaiverSignedPlayers = uniqueUsers.Count(u => u.WaiverSignedAt != null),
                TotalGames = games.Sum(g => g.Count),
                GamesNew = games.FirstOrDefault(g => g.Status == "New")?.Count ?? 0,
                GamesReady = games.FirstOrDefault(g => g.Status == "Ready")?.Count ?? 0,
                GamesInProgress = games.Where(g => g.Status == "Queued" || g.Status == "Started" || g.Status == "Playing").Sum(g => g.Count),
                GamesCompleted = games.FirstOrDefault(g => g.Status == "Finished")?.Count ?? 0,
                Courts = courts.Select(c => new TDCourtStatusDto
                {
                    CourtId = c.Id,
                    Name = c.CourtLabel,
                    CourtNumber = c.SortOrder,
                    Status = c.Status,
                    CurrentGameId = c.CurrentGameId,
                    CurrentGameStatus = c.CurrentGame?.Status
                }).ToList(),
                ReadyGames = readyGames,
                InProgressGames = inProgressGames
            }
        });
    }

    /// <summary>
    /// Get player's game day view
    /// </summary>
    [HttpGet("player/{eventId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PlayerGameDayDto>>> GetPlayerGameDay(int eventId)
    {
        var userId = GetUserId();
        if (userId == 0) return Unauthorized();

        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<PlayerGameDayDto> { Success = false, Message = "Event not found" });

        // Get player's units
        var units = await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.UserId == userId && m.InviteStatus == "Accepted")
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Division)
            .ToListAsync();

        // Get player's games
        var myGames = await _context.EventGamePlayers
            .Where(p => p.UserId == userId && p.Game!.Match!.EventId == eventId)
            .Include(p => p.Game)
                .ThenInclude(g => g!.Match)
                    .ThenInclude(m => m!.Unit1)
            .Include(p => p.Game)
                .ThenInclude(g => g!.Match)
                    .ThenInclude(m => m!.Unit2)
            .Include(p => p.Game)
                .ThenInclude(g => g!.Match)
                    .ThenInclude(m => m!.Division)
            .Include(p => p.Game)
                .ThenInclude(g => g!.TournamentCourt)
            .OrderBy(p => p.Game!.Match!.RoundNumber)
            .ThenBy(p => p.Game!.Match!.MatchNumber)
            .Select(p => new PlayerGameInfoDto
            {
                GameId = p.GameId,
                GameNumber = p.Game!.GameNumber,
                Status = p.Game.Status,
                Unit1Score = p.Game.Unit1Score,
                Unit2Score = p.Game.Unit2Score,
                MatchId = p.Game.MatchId,
                RoundType = p.Game.Match!.RoundType,
                RoundName = p.Game.Match.RoundName,
                DivisionName = p.Game.Match.Division!.Name,
                MyUnitId = p.UnitId,
                Unit1Id = p.Game.Match.Unit1Id,
                Unit1Name = p.Game.Match.Unit1!.Name,
                Unit2Id = p.Game.Match.Unit2Id,
                Unit2Name = p.Game.Match.Unit2!.Name,
                CourtName = p.Game.TournamentCourt != null ? p.Game.TournamentCourt.CourtLabel : null,
                CourtNumber = p.Game.TournamentCourt != null ? p.Game.TournamentCourt.SortOrder : null,
                ScheduledTime = p.Game.Match.ScheduledTime,
                QueuedAt = p.Game.QueuedAt,
                StartedAt = p.Game.StartedAt,
                FinishedAt = p.Game.FinishedAt,
                CanSubmitScore = p.Game.Status == "Playing" && p.Game.ScoreSubmittedByUnitId != p.UnitId,
                NeedsConfirmation = p.Game.ScoreSubmittedByUnitId != null && p.Game.ScoreSubmittedByUnitId != p.UnitId && p.Game.ScoreConfirmedByUnitId == null
            })
            .ToListAsync();

        var firstUnit = units.FirstOrDefault();

        return Ok(new ApiResponse<PlayerGameDayDto>
        {
            Success = true,
            Data = new PlayerGameDayDto
            {
                EventId = eventId,
                EventName = evt.Name,
                IsCheckedIn = firstUnit?.IsCheckedIn ?? false,
                CheckedInAt = firstUnit?.CheckedInAt,
                WaiverSigned = firstUnit?.WaiverSignedAt != null,
                MyDivisions = units.Select(u => new PlayerDivisionDto
                {
                    DivisionId = u.Unit!.DivisionId,
                    DivisionName = u.Unit.Division?.Name ?? "",
                    UnitId = u.UnitId,
                    UnitName = u.Unit.Name
                }).ToList(),
                MyGames = myGames,
                UpcomingGame = myGames.FirstOrDefault(g => g.Status == "Queued" || g.Status == "Playing"),
                NextGame = myGames.FirstOrDefault(g => g.Status == "Ready" || g.Status == "New")
            }
        });
    }

    /// <summary>
    /// Get games that are ready to be queued
    /// </summary>
    [HttpGet("ready-games/{eventId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<ReadyGameDto>>>> GetReadyGames(int eventId, [FromQuery] int? divisionId = null)
    {
        var userId = GetUserId();
        if (!await IsEventOrganizer(eventId, userId))
            return Forbid();

        var games = await GetReadyGamesInternal(eventId, divisionId);
        return Ok(new ApiResponse<List<ReadyGameDto>> { Success = true, Data = games });
    }

    private async Task<List<ReadyGameDto>> GetReadyGamesInternal(int eventId, int? divisionId)
    {
        var query = _context.EventGames
            .Where(g => g.Match!.EventId == eventId && g.Status == "Ready" && g.Match.Unit1Id != null && g.Match.Unit2Id != null);

        if (divisionId.HasValue)
            query = query.Where(g => g.Match!.DivisionId == divisionId.Value);

        return await query
            .Include(g => g.Match)
                .ThenInclude(m => m!.Division)
            .Include(g => g.Match)
                .ThenInclude(m => m!.Unit1)
                    .ThenInclude(u => u!.Members)
                        .ThenInclude(m => m.User)
            .Include(g => g.Match)
                .ThenInclude(m => m!.Unit2)
                    .ThenInclude(u => u!.Members)
                        .ThenInclude(m => m.User)
            .OrderBy(g => g.Match!.RoundNumber)
            .ThenBy(g => g.Match!.MatchNumber)
            .Select(g => new ReadyGameDto
            {
                GameId = g.Id,
                GameNumber = g.GameNumber,
                MatchId = g.MatchId,
                DivisionId = g.Match!.DivisionId,
                DivisionName = g.Match.Division!.Name,
                RoundType = g.Match.RoundType,
                RoundNumber = g.Match.RoundNumber,
                RoundName = g.Match.RoundName,
                Unit1Id = g.Match.Unit1Id!.Value,
                Unit1Name = g.Match.Unit1!.Name,
                Unit1Players = g.Match.Unit1.Members
                    .Where(m => m.InviteStatus == "Accepted")
                    .Select(m => new PlayerBriefDto
                    {
                        UserId = m.UserId,
                        Name = m.User!.FirstName + " " + m.User.LastName,
                        IsCheckedIn = m.IsCheckedIn
                    }).ToList(),
                Unit2Id = g.Match.Unit2Id!.Value,
                Unit2Name = g.Match.Unit2!.Name,
                Unit2Players = g.Match.Unit2.Members
                    .Where(m => m.InviteStatus == "Accepted")
                    .Select(m => new PlayerBriefDto
                    {
                        UserId = m.UserId,
                        Name = m.User!.FirstName + " " + m.User.LastName,
                        IsCheckedIn = m.IsCheckedIn
                    }).ToList(),
                AllPlayersCheckedIn = g.Match.Unit1.Members.All(m => m.InviteStatus != "Accepted" || m.IsCheckedIn)
                    && g.Match.Unit2.Members.All(m => m.InviteStatus != "Accepted" || m.IsCheckedIn)
            })
            .ToListAsync();
    }

    /// <summary>
    /// Assign a game to a court (queue it)
    /// </summary>
    [HttpPost("queue-game")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<GameQueueItemDto>>> QueueGame([FromBody] QueueGameRequest request)
    {
        var userId = GetUserId();

        var game = await _context.EventGames
            .Include(g => g.Match)
            .FirstOrDefaultAsync(g => g.Id == request.GameId);

        if (game == null)
            return NotFound(new ApiResponse<GameQueueItemDto> { Success = false, Message = "Game not found" });

        if (!await IsEventOrganizer(game.Match!.EventId, userId))
            return Forbid();

        if (game.Status != "Ready")
            return BadRequest(new ApiResponse<GameQueueItemDto> { Success = false, Message = "Game is not ready to be queued" });

        var court = await _context.TournamentCourts.FindAsync(request.CourtId);
        if (court == null || court.EventId != game.Match.EventId)
            return BadRequest(new ApiResponse<GameQueueItemDto> { Success = false, Message = "Invalid court" });

        // Update game
        game.Status = "Queued";
        game.TournamentCourtId = request.CourtId;
        game.QueuedAt = DateTime.Now;
        game.UpdatedAt = DateTime.Now;

        // Update court if no current game
        if (court.CurrentGameId == null)
        {
            court.CurrentGameId = game.Id;
            court.Status = "InUse";
        }

        // Create queue entry
        var queuePosition = await _context.GameQueues
            .Where(q => q.TournamentCourtId == request.CourtId && q.Status == "Queued")
            .CountAsync();

        var queueEntry = new GameQueue
        {
            EventId = game.Match.EventId,
            TournamentCourtId = request.CourtId,
            GameId = game.Id,
            QueuePosition = queuePosition,
            QueuedByUserId = userId
        };
        _context.GameQueues.Add(queueEntry);

        await _context.SaveChangesAsync();

        // Send notifications to players
        await NotifyPlayersGameQueued(game, court);

        _logger.LogInformation("Game {GameId} queued to court {CourtId} by user {UserId}", game.Id, request.CourtId, userId);

        return Ok(new ApiResponse<GameQueueItemDto>
        {
            Success = true,
            Data = new GameQueueItemDto
            {
                GameId = game.Id,
                Status = game.Status,
                CourtId = request.CourtId,
                CourtName = court.CourtLabel,
                CourtNumber = court.SortOrder,
                QueuedAt = game.QueuedAt
            }
        });
    }

    /// <summary>
    /// Start a game
    /// </summary>
    [HttpPost("start-game/{gameId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> StartGame(int gameId)
    {
        var userId = GetUserId();

        var game = await _context.EventGames
            .Include(g => g.Match)
            .Include(g => g.TournamentCourt)
            .FirstOrDefaultAsync(g => g.Id == gameId);

        if (game == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Game not found" });

        if (!await IsEventOrganizer(game.Match!.EventId, userId))
            return Forbid();

        if (game.Status != "Queued")
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Game must be queued to start" });

        game.Status = "Playing";
        game.StartedAt = DateTime.Now;
        game.UpdatedAt = DateTime.Now;

        // Update queue entry
        var queueEntry = await _context.GameQueues
            .FirstOrDefaultAsync(q => q.GameId == gameId && q.Status == "Queued");
        if (queueEntry != null)
        {
            queueEntry.Status = "Current";
            queueEntry.StartedAt = DateTime.Now;
        }

        await _context.SaveChangesAsync();

        // Notify players
        await NotifyPlayersGameStarted(game);

        return Ok(new ApiResponse<object> { Success = true, Message = "Game started" });
    }

    /// <summary>
    /// Submit or update game score
    /// </summary>
    [HttpPost("score/{gameId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> SubmitScore(int gameId, [FromBody] SubmitScoreRequest request)
    {
        var userId = GetUserId();

        var game = await _context.EventGames
            .Include(g => g.Match)
                .ThenInclude(m => m!.Unit1)
                    .ThenInclude(u => u!.Members)
            .Include(g => g.Match)
                .ThenInclude(m => m!.Unit2)
                    .ThenInclude(u => u!.Members)
            .Include(g => g.TournamentCourt)
            .FirstOrDefaultAsync(g => g.Id == gameId);

        if (game == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Game not found" });

        var isOrganizer = await IsEventOrganizer(game.Match!.EventId, userId);
        var isUnit1Player = game.Match.Unit1!.Members.Any(m => m.UserId == userId && m.InviteStatus == "Accepted");
        var isUnit2Player = game.Match.Unit2!.Members.Any(m => m.UserId == userId && m.InviteStatus == "Accepted");
        var playerUnitId = isUnit1Player ? game.Match.Unit1Id : (isUnit2Player ? game.Match.Unit2Id : null);

        if (!isOrganizer && !isUnit1Player && !isUnit2Player)
            return Forbid();

        var previousUnit1Score = game.Unit1Score;
        var previousUnit2Score = game.Unit2Score;

        game.Unit1Score = request.Unit1Score;
        game.Unit2Score = request.Unit2Score;
        game.UpdatedAt = DateTime.Now;

        // Determine winner if applicable
        if (request.Unit1Score > request.Unit2Score)
            game.WinnerUnitId = game.Match.Unit1Id;
        else if (request.Unit2Score > request.Unit1Score)
            game.WinnerUnitId = game.Match.Unit2Id;

        // If player submitted score
        if (!isOrganizer && playerUnitId.HasValue)
        {
            if (game.ScoreSubmittedByUnitId == null)
            {
                game.ScoreSubmittedByUnitId = playerUnitId;
                game.ScoreSubmittedAt = DateTime.Now;
            }
            else if (game.ScoreSubmittedByUnitId != playerUnitId)
            {
                // Other unit is confirming
                game.ScoreConfirmedByUnitId = playerUnitId;
                game.ScoreConfirmedAt = DateTime.Now;
                game.Status = "Finished";
                game.FinishedAt = DateTime.Now;
            }
        }
        else if (isOrganizer)
        {
            // TD can finalize immediately
            if (request.Finalize)
            {
                game.Status = "Finished";
                game.FinishedAt = DateTime.Now;
            }
        }

        // Create score history record
        var history = new EventGameScoreHistory
        {
            GameId = gameId,
            ChangeType = isOrganizer ? "AdminOverride" : (game.ScoreConfirmedByUnitId != null ? "ScoreConfirmed" : "ScoreSubmitted"),
            Unit1Score = request.Unit1Score,
            Unit2Score = request.Unit2Score,
            PreviousUnit1Score = previousUnit1Score,
            PreviousUnit2Score = previousUnit2Score,
            ChangedByUserId = userId,
            ChangedByUnitId = playerUnitId,
            IsAdminOverride = isOrganizer,
            Reason = request.Reason,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        };
        _context.EventGameScoreHistories.Add(history);

        await _context.SaveChangesAsync();

        // If game finished, update stats and check for match completion
        if (game.Status == "Finished")
        {
            await UpdateStatsAfterGameFinish(game);
            await CheckMatchCompletion(game.MatchId);
            await AdvanceCourtQueue(game);
        }

        // Notify spectators of score update
        await NotifyScoreUpdate(game);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = game.Status == "Finished" ? "Game completed" : "Score updated"
        });
    }

    /// <summary>
    /// Get pool/round standings for a division
    /// </summary>
    [HttpGet("standings/{eventId}/{divisionId}")]
    public async Task<ActionResult<ApiResponse<List<StandingsDto>>>> GetStandings(int eventId, int divisionId)
    {
        var units = await _context.EventUnits
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled")
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .OrderBy(u => u.PoolNumber)
            .ThenByDescending(u => u.MatchesWon)
            .ThenByDescending(u => u.GamesWon - u.GamesLost)
            .ThenByDescending(u => u.PointsScored - u.PointsAgainst)
            .Select(u => new StandingsDto
            {
                UnitId = u.Id,
                UnitName = u.Name,
                PoolNumber = u.PoolNumber,
                PoolName = u.PoolName,
                PoolRank = u.PoolRank,
                OverallRank = u.OverallRank,
                MatchesPlayed = u.MatchesPlayed,
                MatchesWon = u.MatchesWon,
                MatchesLost = u.MatchesLost,
                GamesWon = u.GamesWon,
                GamesLost = u.GamesLost,
                PointsFor = u.PointsScored,
                PointsAgainst = u.PointsAgainst,
                PointDiff = u.PointsScored - u.PointsAgainst,
                AdvancedToPlayoff = u.AdvancedToPlayoff,
                ManuallyAdvanced = u.ManuallyAdvanced,
                FinalPlacement = u.FinalPlacement,
                Players = u.Members
                    .Where(m => m.InviteStatus == "Accepted")
                    .Select(m => m.User!.FirstName + " " + m.User.LastName)
                    .ToList()
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<StandingsDto>> { Success = true, Data = units });
    }

    /// <summary>
    /// Override a unit's rank or advancement status (TD only)
    /// </summary>
    [HttpPost("override-rank/{unitId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> OverrideRank(int unitId, [FromBody] OverrideRankRequest request)
    {
        var userId = GetUserId();

        var unit = await _context.EventUnits
            .Include(u => u.Event)
            .FirstOrDefaultAsync(u => u.Id == unitId);

        if (unit == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Unit not found" });

        if (!await IsEventOrganizer(unit.EventId, userId))
            return Forbid();

        if (request.PoolRank.HasValue)
            unit.PoolRank = request.PoolRank.Value;

        if (request.OverallRank.HasValue)
            unit.OverallRank = request.OverallRank.Value;

        if (request.AdvancedToPlayoff.HasValue)
        {
            unit.AdvancedToPlayoff = request.AdvancedToPlayoff.Value;
            unit.ManuallyAdvanced = true;
        }

        if (request.FinalPlacement.HasValue)
            unit.FinalPlacement = request.FinalPlacement.Value;

        unit.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        _logger.LogInformation("TD {UserId} overrode rank for unit {UnitId}", userId, unitId);

        return Ok(new ApiResponse<object> { Success = true, Message = "Rank updated" });
    }

    /// <summary>
    /// Send notification to players in event
    /// </summary>
    [HttpPost("notify/{eventId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> SendNotification(int eventId, [FromBody] SendNotificationRequest request)
    {
        var userId = GetUserId();
        if (!await IsEventOrganizer(eventId, userId))
            return Forbid();

        var userIds = new List<int>();

        if (request.TargetType == "All")
        {
            userIds = await _context.EventUnitMembers
                .Where(m => m.Unit!.EventId == eventId && m.InviteStatus == "Accepted")
                .Select(m => m.UserId)
                .Distinct()
                .ToListAsync();
        }
        else if (request.TargetType == "Division" && request.TargetId.HasValue)
        {
            userIds = await _context.EventUnitMembers
                .Where(m => m.Unit!.DivisionId == request.TargetId.Value && m.InviteStatus == "Accepted")
                .Select(m => m.UserId)
                .Distinct()
                .ToListAsync();
        }
        else if (request.TargetType == "Unit" && request.TargetId.HasValue)
        {
            userIds = await _context.EventUnitMembers
                .Where(m => m.UnitId == request.TargetId.Value && m.InviteStatus == "Accepted")
                .Select(m => m.UserId)
                .Distinct()
                .ToListAsync();
        }
        else if (request.TargetType == "NotCheckedIn")
        {
            userIds = await _context.EventUnitMembers
                .Where(m => m.Unit!.EventId == eventId && m.InviteStatus == "Accepted" && !m.IsCheckedIn)
                .Select(m => m.UserId)
                .Distinct()
                .ToListAsync();
        }

        foreach (var targetUserId in userIds)
        {
            await _notificationService.CreateAndSendAsync(
                targetUserId,
                "EventUpdate",
                request.Title,
                request.Message,
                $"/events/{eventId}/gameday",
                "Event",
                eventId
            );
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = $"Notification sent to {userIds.Count} players"
        });
    }

    // Helper methods
    private async Task NotifyPlayersGameQueued(EventGame game, TournamentCourt court)
    {
        var match = await _context.EventMatches
            .Include(m => m.Unit1)
                .ThenInclude(u => u!.Members)
            .Include(m => m.Unit2)
                .ThenInclude(u => u!.Members)
            .FirstOrDefaultAsync(m => m.Id == game.MatchId);

        if (match == null) return;

        var playerIds = match.Unit1!.Members
            .Concat(match.Unit2!.Members)
            .Where(m => m.InviteStatus == "Accepted")
            .Select(m => m.UserId)
            .Distinct();

        foreach (var playerId in playerIds)
        {
            await _notificationService.CreateAndSendAsync(
                playerId,
                "GameReady",
                "Game Queued",
                $"Your game is queued on {court.CourtLabel}. Please proceed to the court.",
                $"/events/{match.EventId}/gameday",
                "Game",
                game.Id
            );
        }
    }

    private async Task NotifyPlayersGameStarted(EventGame game)
    {
        var match = await _context.EventMatches
            .Include(m => m.Unit1)
                .ThenInclude(u => u!.Members)
            .Include(m => m.Unit2)
                .ThenInclude(u => u!.Members)
            .FirstOrDefaultAsync(m => m.Id == game.MatchId);

        if (match == null) return;

        var playerIds = match.Unit1!.Members
            .Concat(match.Unit2!.Members)
            .Where(m => m.InviteStatus == "Accepted")
            .Select(m => m.UserId)
            .Distinct();

        foreach (var playerId in playerIds)
        {
            await _notificationService.CreateAndSendAsync(
                playerId,
                "GameReady",
                "Game Started",
                "Your game has started. Good luck!",
                $"/events/{match.EventId}/gameday",
                "Game",
                game.Id
            );
        }
    }

    private async Task NotifyScoreUpdate(EventGame game)
    {
        // Notify spectators subscribed to this game/players
        var subscriptions = await _context.SpectatorSubscriptions
            .Where(s => s.EventId == game.Match!.EventId && s.IsActive && s.NotifyOnScoreUpdate)
            .Where(s =>
                s.SubscriptionType == SubscriptionTypes.Event ||
                (s.SubscriptionType == SubscriptionTypes.Game && s.TargetId == game.Id) ||
                (s.SubscriptionType == SubscriptionTypes.Division && s.TargetId == game.Match.DivisionId) ||
                (s.SubscriptionType == SubscriptionTypes.Unit && (s.TargetId == game.Match.Unit1Id || s.TargetId == game.Match.Unit2Id)))
            .Select(s => s.UserId)
            .Distinct()
            .ToListAsync();

        foreach (var spectatorId in subscriptions)
        {
            await _notificationService.CreateAndSendAsync(
                spectatorId,
                "EventUpdate",
                "Score Update",
                $"Score: {game.Unit1Score} - {game.Unit2Score}",
                $"/events/{game.Match!.EventId}/scoreboard",
                "Game",
                game.Id
            );
        }
    }

    private async Task UpdateStatsAfterGameFinish(EventGame game)
    {
        var match = game.Match!;
        var unit1 = await _context.EventUnits.FindAsync(match.Unit1Id);
        var unit2 = await _context.EventUnits.FindAsync(match.Unit2Id);

        if (unit1 == null || unit2 == null) return;

        // Update game stats
        unit1.PointsScored += game.Unit1Score;
        unit1.PointsAgainst += game.Unit2Score;
        unit2.PointsScored += game.Unit2Score;
        unit2.PointsAgainst += game.Unit1Score;

        if (game.WinnerUnitId == unit1.Id)
        {
            unit1.GamesWon++;
            unit2.GamesLost++;
        }
        else if (game.WinnerUnitId == unit2.Id)
        {
            unit2.GamesWon++;
            unit1.GamesLost++;
        }

        await _context.SaveChangesAsync();
    }

    private async Task CheckMatchCompletion(int matchId)
    {
        var match = await _context.EventMatches
            .Include(m => m.Games)
            .Include(m => m.Unit1)
            .Include(m => m.Unit2)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null) return;

        var finishedGames = match.Games.Where(g => g.Status == "Finished").ToList();
        var unit1Wins = finishedGames.Count(g => g.WinnerUnitId == match.Unit1Id);
        var unit2Wins = finishedGames.Count(g => g.WinnerUnitId == match.Unit2Id);
        var winsNeeded = (match.BestOf / 2) + 1;

        if (unit1Wins >= winsNeeded || unit2Wins >= winsNeeded || finishedGames.Count == match.Games.Count)
        {
            match.Status = "Completed";
            match.CompletedAt = DateTime.Now;
            match.WinnerUnitId = unit1Wins > unit2Wins ? match.Unit1Id : match.Unit2Id;

            // Update match stats
            var unit1 = match.Unit1!;
            var unit2 = match.Unit2!;
            unit1.MatchesPlayed++;
            unit2.MatchesPlayed++;

            if (match.WinnerUnitId == unit1.Id)
            {
                unit1.MatchesWon++;
                unit2.MatchesLost++;
            }
            else
            {
                unit2.MatchesWon++;
                unit1.MatchesLost++;
            }

            await _context.SaveChangesAsync();
        }
    }

    private async Task AdvanceCourtQueue(EventGame game)
    {
        if (game.TournamentCourtId == null) return;

        var court = await _context.TournamentCourts.FindAsync(game.TournamentCourtId);
        if (court == null) return;

        // Update current queue entry
        var currentQueueEntry = await _context.GameQueues
            .FirstOrDefaultAsync(q => q.GameId == game.Id && q.Status == "Current");
        if (currentQueueEntry != null)
        {
            currentQueueEntry.Status = "Completed";
            currentQueueEntry.CompletedAt = DateTime.Now;
        }

        // Find next game in queue
        var nextInQueue = await _context.GameQueues
            .Where(q => q.TournamentCourtId == game.TournamentCourtId && q.Status == "Queued")
            .OrderBy(q => q.QueuePosition)
            .FirstOrDefaultAsync();

        if (nextInQueue != null)
        {
            court.CurrentGameId = nextInQueue.GameId;
        }
        else
        {
            court.CurrentGameId = null;
            court.Status = "Available";
        }

        await _context.SaveChangesAsync();
    }
}

// DTOs for Tournament Game Day
public class TDDashboardDto
{
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public string EventStatus { get; set; } = string.Empty;
    public int TotalPlayers { get; set; }
    public int CheckedInPlayers { get; set; }
    public int WaiverSignedPlayers { get; set; }
    public int TotalGames { get; set; }
    public int GamesNew { get; set; }
    public int GamesReady { get; set; }
    public int GamesInProgress { get; set; }
    public int GamesCompleted { get; set; }
    public List<TDCourtStatusDto> Courts { get; set; } = new();
    public List<ReadyGameDto> ReadyGames { get; set; } = new();
    public List<GameQueueItemDto> InProgressGames { get; set; } = new();
}

public class TDCourtStatusDto
{
    public int CourtId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int CourtNumber { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? CurrentGameId { get; set; }
    public string? CurrentGameStatus { get; set; }
}

public class ReadyGameDto
{
    public int GameId { get; set; }
    public int GameNumber { get; set; }
    public int MatchId { get; set; }
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public string RoundType { get; set; } = string.Empty;
    public int RoundNumber { get; set; }
    public string? RoundName { get; set; }
    public int Unit1Id { get; set; }
    public string Unit1Name { get; set; } = string.Empty;
    public List<PlayerBriefDto> Unit1Players { get; set; } = new();
    public int Unit2Id { get; set; }
    public string Unit2Name { get; set; } = string.Empty;
    public List<PlayerBriefDto> Unit2Players { get; set; } = new();
    public bool AllPlayersCheckedIn { get; set; }
}

public class PlayerBriefDto
{
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsCheckedIn { get; set; }
}

public class GameQueueItemDto
{
    public int GameId { get; set; }
    public int GameNumber { get; set; }
    public string Status { get; set; } = string.Empty;
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public int MatchId { get; set; }
    public string? RoundType { get; set; }
    public string? RoundName { get; set; }
    public int DivisionId { get; set; }
    public int? Unit1Id { get; set; }
    public string? Unit1Name { get; set; }
    public int? Unit2Id { get; set; }
    public string? Unit2Name { get; set; }
    public int? CourtId { get; set; }
    public string? CourtName { get; set; }
    public int? CourtNumber { get; set; }
    public DateTime? QueuedAt { get; set; }
    public DateTime? StartedAt { get; set; }
}

public class PlayerGameDayDto
{
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public bool IsCheckedIn { get; set; }
    public DateTime? CheckedInAt { get; set; }
    public bool WaiverSigned { get; set; }
    public List<PlayerDivisionDto> MyDivisions { get; set; } = new();
    public List<PlayerGameInfoDto> MyGames { get; set; } = new();
    public PlayerGameInfoDto? UpcomingGame { get; set; }
    public PlayerGameInfoDto? NextGame { get; set; }
}

public class PlayerDivisionDto
{
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
}

public class PlayerGameInfoDto
{
    public int GameId { get; set; }
    public int GameNumber { get; set; }
    public string Status { get; set; } = string.Empty;
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public int MatchId { get; set; }
    public string RoundType { get; set; } = string.Empty;
    public string? RoundName { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public int MyUnitId { get; set; }
    public int? Unit1Id { get; set; }
    public string? Unit1Name { get; set; }
    public int? Unit2Id { get; set; }
    public string? Unit2Name { get; set; }
    public string? CourtName { get; set; }
    public int? CourtNumber { get; set; }
    public DateTime? ScheduledTime { get; set; }
    public DateTime? QueuedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public bool CanSubmitScore { get; set; }
    public bool NeedsConfirmation { get; set; }
}

public class QueueGameRequest
{
    public int GameId { get; set; }
    public int CourtId { get; set; }
}

public class SubmitScoreRequest
{
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public bool Finalize { get; set; }
    public string? Reason { get; set; }
}

public class StandingsDto
{
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public int? PoolNumber { get; set; }
    public string? PoolName { get; set; }
    public int? PoolRank { get; set; }
    public int? OverallRank { get; set; }
    public int MatchesPlayed { get; set; }
    public int MatchesWon { get; set; }
    public int MatchesLost { get; set; }
    public int GamesWon { get; set; }
    public int GamesLost { get; set; }
    public int PointsFor { get; set; }
    public int PointsAgainst { get; set; }
    public int PointDiff { get; set; }
    public bool AdvancedToPlayoff { get; set; }
    public bool ManuallyAdvanced { get; set; }
    public int? FinalPlacement { get; set; }
    public List<string> Players { get; set; } = new();
}

public class OverrideRankRequest
{
    public int? PoolRank { get; set; }
    public int? OverallRank { get; set; }
    public bool? AdvancedToPlayoff { get; set; }
    public int? FinalPlacement { get; set; }
}

public class SendNotificationRequest
{
    public string TargetType { get; set; } = "All"; // All, Division, Unit, NotCheckedIn
    public int? TargetId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
