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
    private readonly INotificationService _notificationService;
    private readonly ILogger<TournamentGameDayController> _logger;

    public TournamentGameDayController(
        ApplicationDbContext context,
        INotificationService notificationService,
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
                .ThenInclude(g => g!.EncounterMatch)
                    .ThenInclude(m => m!.Encounter)
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
            .Where(g => g.EncounterMatch!.Encounter!.EventId == eventId)
            .GroupBy(g => g.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        // Get ready games with details
        var readyGames = await GetReadyGamesInternal(eventId, null);

        // Get in-progress games
        var inProgressGames = await _context.EventGames
            .Where(g => g.EncounterMatch!.Encounter!.EventId == eventId && (g.Status == "Queued" || g.Status == "Started" || g.Status == "Playing"))
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Unit1)
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Unit2)
            .Include(g => g.TournamentCourt)
            .OrderBy(g => g.QueuedAt)
            .Select(g => new GameQueueItemDto
            {
                GameId = g.Id,
                GameNumber = g.GameNumber,
                Status = g.Status,
                Unit1Score = g.Unit1Score,
                Unit2Score = g.Unit2Score,
                MatchId = g.EncounterMatch!.EncounterId,
                RoundType = g.EncounterMatch!.Encounter!.RoundType,
                RoundName = g.EncounterMatch.Encounter.RoundName,
                DivisionId = g.EncounterMatch.Encounter.DivisionId,
                Unit1Id = g.EncounterMatch.Encounter.Unit1Id,
                Unit1Name = g.EncounterMatch.Encounter.Unit1!.Name,
                Unit2Id = g.EncounterMatch.Encounter.Unit2Id,
                Unit2Name = g.EncounterMatch.Encounter.Unit2!.Name,
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

        // Get player's unit IDs for game lookup
        var unitIds = units.Select(u => u.UnitId).ToList();
        var myGames = new List<PlayerGameInfoDto>();

        if (unitIds.Any())
        {
            // Get games from encounters where player's unit is participating
            // This is essential for simple tournaments where EventGamePlayers isn't populated
            var allGames = await _context.EventGames
                .Include(g => g.EncounterMatch)
                    .ThenInclude(m => m!.Encounter)
                        .ThenInclude(e => e!.Unit1)
                .Include(g => g.EncounterMatch)
                    .ThenInclude(m => m!.Encounter)
                        .ThenInclude(e => e!.Unit2)
                .Include(g => g.EncounterMatch)
                    .ThenInclude(m => m!.Encounter)
                        .ThenInclude(e => e!.Division)
                .Include(g => g.TournamentCourt)
                .Where(g => g.EncounterMatch!.Encounter!.EventId == eventId)
                .ToListAsync();

            // Filter for player's units and project to DTO client-side
            myGames = allGames
                .Where(g => unitIds.Contains(g.EncounterMatch!.Encounter!.Unit1Id ?? 0) ||
                            unitIds.Contains(g.EncounterMatch!.Encounter!.Unit2Id ?? 0))
                .OrderBy(g => g.EncounterMatch!.Encounter!.RoundNumber)
                .ThenBy(g => g.EncounterMatch!.Encounter!.EncounterNumber)
                .ThenBy(g => g.GameNumber)
                .Select(g => {
                    var encounter = g.EncounterMatch!.Encounter!;
                    var myUnitId = unitIds.Contains(encounter.Unit1Id ?? 0) ? encounter.Unit1Id : encounter.Unit2Id;
                    return new PlayerGameInfoDto
                    {
                        GameId = g.Id,
                        GameNumber = g.GameNumber,
                        Status = g.Status,
                        Unit1Score = g.Unit1Score,
                        Unit2Score = g.Unit2Score,
                        MatchId = g.EncounterMatch.EncounterId,
                        RoundType = encounter.RoundType,
                        RoundName = encounter.RoundName,
                        DivisionName = encounter.Division?.Name ?? "",
                        MyUnitId = myUnitId ?? 0,
                        Unit1Id = encounter.Unit1Id,
                        Unit1Name = encounter.Unit1?.Name,
                        Unit2Id = encounter.Unit2Id,
                        Unit2Name = encounter.Unit2?.Name,
                        CourtName = g.TournamentCourt?.CourtLabel,
                        CourtNumber = g.TournamentCourt?.SortOrder,
                        ScheduledTime = encounter.ScheduledTime,
                        QueuedAt = g.QueuedAt,
                        StartedAt = g.StartedAt,
                        FinishedAt = g.FinishedAt,
                        CanSubmitScore = g.Status == "Playing" && g.ScoreSubmittedByUnitId != myUnitId,
                        NeedsConfirmation = g.ScoreSubmittedByUnitId != null && g.ScoreSubmittedByUnitId != myUnitId && g.ScoreConfirmedByUnitId == null
                    };
                })
                .ToList();
        }

        var firstUnit = units.FirstOrDefault();

        // Get all event divisions for "Others" tab
        var allDivisions = await _context.EventDivisions
            .Where(d => d.EventId == eventId)
            .OrderBy(d => d.SortOrder)
            .Select(d => new EventDivisionBriefDto
            {
                Id = d.Id,
                Name = d.Name
            })
            .ToListAsync();

        // Get scheduled matches for player's units (for Future Games section)
        // unitIds already defined above
        var scheduledMatches = new List<ScheduledMatchDto>();

        if (unitIds.Any())
        {
            // Fetch all non-completed matches for event, then filter client-side
            // This avoids EF Core SQL generation issues with Contains() + OR in WHERE clause
            var allEventMatches = await _context.EventMatches
                .Include(m => m.Unit1)
                .Include(m => m.Unit2)
                .Include(m => m.Division)
                .Where(m => m.EventId == eventId &&
                    m.Status != "Completed" && m.Status != "Finished")
                .ToListAsync();

            // Filter for player's units client-side
            var rawMatches = allEventMatches
                .Where(m => unitIds.Contains(m.Unit1Id ?? 0) || unitIds.Contains(m.Unit2Id ?? 0))
                .ToList();

            // Sort and project to DTO client-side to avoid EF Core translation issues
            scheduledMatches = rawMatches
                .OrderBy(m => m.RoundType == "Pool" ? 0 : 1)
                .ThenBy(m => m.RoundNumber)
                .ThenBy(m => m.EncounterNumber)
                .Select(m => new ScheduledMatchDto
            {
                EncounterId = m.Id,
                DivisionId = m.DivisionId,
                DivisionName = m.Division?.Name ?? "",
                RoundType = m.RoundType,
                RoundName = m.RoundName,
                MatchNumber = m.EncounterNumber,
                MyUnitId = unitIds.Contains(m.Unit1Id ?? 0) ? m.Unit1Id : m.Unit2Id,
                Unit1Id = m.Unit1Id,
                Unit1Name = m.Unit1?.Name,
                Unit2Id = m.Unit2Id,
                Unit2Name = m.Unit2?.Name,
                Status = m.Status,
                ScheduledTime = m.ScheduledTime
            }).ToList();
        }

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
                HasPaid = firstUnit?.HasPaid ?? false,
                MyDivisions = units.Select(u => new PlayerDivisionDto
                {
                    DivisionId = u.Unit!.DivisionId,
                    DivisionName = u.Unit.Division?.Name ?? "",
                    UnitId = u.UnitId,
                    UnitName = u.Unit.Name,
                    HasPaid = u.HasPaid
                }).ToList(),
                AllDivisions = allDivisions,
                MyGames = myGames,
                ScheduledMatches = scheduledMatches,
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
            .Where(g => g.EncounterMatch!.Encounter!.EventId == eventId && g.Status == "Ready" && g.EncounterMatch.Encounter.Unit1Id != null && g.EncounterMatch.Encounter.Unit2Id != null);

        if (divisionId.HasValue)
            query = query.Where(g => g.EncounterMatch!.Encounter!.DivisionId == divisionId.Value);

        return await query
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Division)
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Unit1)
                        .ThenInclude(u => u!.Members)
                            .ThenInclude(m => m.User)
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Unit2)
                        .ThenInclude(u => u!.Members)
                            .ThenInclude(m => m.User)
            .OrderBy(g => g.EncounterMatch!.Encounter!.RoundNumber)
            .ThenBy(g => g.EncounterMatch!.Encounter!.EncounterNumber)
            .Select(g => new ReadyGameDto
            {
                GameId = g.Id,
                GameNumber = g.GameNumber,
                MatchId = g.EncounterMatch!.EncounterId,
                DivisionId = g.EncounterMatch!.Encounter!.DivisionId,
                DivisionName = g.EncounterMatch.Encounter.Division!.Name,
                RoundType = g.EncounterMatch.Encounter.RoundType,
                RoundNumber = g.EncounterMatch.Encounter.RoundNumber,
                RoundName = g.EncounterMatch.Encounter.RoundName,
                Unit1Id = g.EncounterMatch.Encounter.Unit1Id!.Value,
                Unit1Name = g.EncounterMatch.Encounter.Unit1!.Name,
                Unit1Players = g.EncounterMatch.Encounter.Unit1.Members
                    .Where(m => m.InviteStatus == "Accepted")
                    .Select(m => new PlayerBriefDto
                    {
                        UserId = m.UserId,
                        Name = m.User!.FirstName + " " + m.User.LastName,
                        IsCheckedIn = m.IsCheckedIn
                    }).ToList(),
                Unit2Id = g.EncounterMatch.Encounter.Unit2Id!.Value,
                Unit2Name = g.EncounterMatch.Encounter.Unit2!.Name,
                Unit2Players = g.EncounterMatch.Encounter.Unit2.Members
                    .Where(m => m.InviteStatus == "Accepted")
                    .Select(m => new PlayerBriefDto
                    {
                        UserId = m.UserId,
                        Name = m.User!.FirstName + " " + m.User.LastName,
                        IsCheckedIn = m.IsCheckedIn
                    }).ToList(),
                AllPlayersCheckedIn = g.EncounterMatch.Encounter.Unit1.Members.All(m => m.InviteStatus != "Accepted" || m.IsCheckedIn)
                    && g.EncounterMatch.Encounter.Unit2.Members.All(m => m.InviteStatus != "Accepted" || m.IsCheckedIn)
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
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
            .FirstOrDefaultAsync(g => g.Id == request.GameId);

        if (game == null)
            return NotFound(new ApiResponse<GameQueueItemDto> { Success = false, Message = "Game not found" });

        var encounter = game.EncounterMatch?.Encounter;
        if (encounter == null)
            return NotFound(new ApiResponse<GameQueueItemDto> { Success = false, Message = "Game encounter not found" });

        if (!await IsEventOrganizer(encounter.EventId, userId))
            return Forbid();

        if (game.Status != "Ready")
            return BadRequest(new ApiResponse<GameQueueItemDto> { Success = false, Message = "Game is not ready to be queued" });

        var court = await _context.TournamentCourts.FindAsync(request.CourtId);
        if (court == null || court.EventId != encounter.EventId)
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
            EventId = encounter.EventId,
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
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
            .Include(g => g.TournamentCourt)
            .FirstOrDefaultAsync(g => g.Id == gameId);

        if (game == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Game not found" });

        var encounter = game.EncounterMatch?.Encounter;
        if (encounter == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Game encounter not found" });

        if (!await IsEventOrganizer(encounter.EventId, userId))
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
    public async Task<ActionResult<ApiResponse<object>>> SubmitScore(int gameId, [FromBody] GameDaySubmitScoreRequest request)
    {
        var userId = GetUserId();

        var game = await _context.EventGames
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Unit1)
                        .ThenInclude(u => u!.Members)
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Unit2)
                        .ThenInclude(u => u!.Members)
            .Include(g => g.TournamentCourt)
            .FirstOrDefaultAsync(g => g.Id == gameId);

        if (game == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Game not found" });

        var encounter = game.EncounterMatch?.Encounter;
        if (encounter == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Game encounter not found" });

        var isOrganizer = await IsEventOrganizer(encounter.EventId, userId);
        var isUnit1Player = encounter.Unit1?.Members?.Any(m => m.UserId == userId && m.InviteStatus == "Accepted") ?? false;
        var isUnit2Player = encounter.Unit2?.Members?.Any(m => m.UserId == userId && m.InviteStatus == "Accepted") ?? false;
        var playerUnitId = isUnit1Player ? encounter.Unit1Id : (isUnit2Player ? encounter.Unit2Id : null);

        if (!isOrganizer && !isUnit1Player && !isUnit2Player)
            return Forbid();

        var previousUnit1Score = game.Unit1Score;
        var previousUnit2Score = game.Unit2Score;

        game.Unit1Score = request.Unit1Score;
        game.Unit2Score = request.Unit2Score;
        game.UpdatedAt = DateTime.Now;

        // Determine winner if applicable
        if (request.Unit1Score > request.Unit2Score)
            game.WinnerUnitId = encounter.Unit1Id;
        else if (request.Unit2Score > request.Unit1Score)
            game.WinnerUnitId = encounter.Unit2Id;

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
            await CheckMatchCompletion(game.EncounterMatch!.EncounterId);
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
    /// Calculate and assign pool rankings based on current statistics
    /// </summary>
    [HttpPost("calculate-pool-rankings/{eventId}/{divisionId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<PoolStandingsResultDto>>>> CalculatePoolRankings(int eventId, int divisionId)
    {
        var userId = GetUserId();
        if (!await IsEventOrganizer(eventId, userId))
            return Forbid();

        var division = await _context.EventDivisions
            .FirstOrDefaultAsync(d => d.Id == divisionId && d.EventId == eventId);

        if (division == null)
            return NotFound(new ApiResponse<List<PoolStandingsResultDto>> { Success = false, Message = "Division not found" });

        // Get all units in this division grouped by pool
        var units = await _context.EventUnits
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled")
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .ToListAsync();

        // Get head-to-head results for tiebreakers
        var poolMatches = await _context.EventMatches
            .Where(m => m.DivisionId == divisionId && m.RoundType == "Pool" && m.Status == "Completed")
            .ToListAsync();

        var poolStandings = new List<PoolStandingsResultDto>();

        // Group by pool and calculate rankings
        var pools = units.GroupBy(u => u.PoolNumber ?? 0).OrderBy(g => g.Key);

        foreach (var pool in pools)
        {
            var poolUnits = pool.ToList();

            // Sort by: Matches Won, then Game Diff, then Point Diff, then Head-to-Head
            var rankedUnits = poolUnits
                .OrderByDescending(u => u.MatchesWon)
                .ThenByDescending(u => u.GamesWon - u.GamesLost)
                .ThenByDescending(u => u.PointsScored - u.PointsAgainst)
                .ToList();

            // Handle tiebreakers with head-to-head
            rankedUnits = ApplyHeadToHeadTiebreaker(rankedUnits, poolMatches);

            // Assign pool ranks
            for (int i = 0; i < rankedUnits.Count; i++)
            {
                rankedUnits[i].PoolRank = i + 1;
                rankedUnits[i].UpdatedAt = DateTime.Now;
            }

            poolStandings.Add(new PoolStandingsResultDto
            {
                PoolNumber = pool.Key,
                PoolName = poolUnits.FirstOrDefault()?.PoolName ?? $"Pool {pool.Key}",
                Units = rankedUnits.Select(u => new PoolUnitRankDto
                {
                    UnitId = u.Id,
                    UnitName = u.Name,
                    PoolRank = u.PoolRank ?? 0,
                    MatchesWon = u.MatchesWon,
                    MatchesLost = u.MatchesLost,
                    GamesWon = u.GamesWon,
                    GamesLost = u.GamesLost,
                    GameDiff = u.GamesWon - u.GamesLost,
                    PointsFor = u.PointsScored,
                    PointsAgainst = u.PointsAgainst,
                    PointDiff = u.PointsScored - u.PointsAgainst,
                    Players = u.Members
                        .Where(m => m.InviteStatus == "Accepted")
                        .Select(m => Utility.FormatName(m.User?.LastName, m.User?.FirstName) ?? "")
                        .ToList()
                }).ToList()
            });
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<List<PoolStandingsResultDto>>
        {
            Success = true,
            Data = poolStandings,
            Message = "Pool rankings calculated"
        });
    }

    /// <summary>
    /// Finalize pool play and advance teams to playoffs
    /// </summary>
    [HttpPost("finalize-pools/{eventId}/{divisionId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<AdvancementResultDto>>> FinalizePools(int eventId, int divisionId, [FromBody] FinalizePoolsRequest? request = null)
    {
        var userId = GetUserId();
        if (!await IsEventOrganizer(eventId, userId))
            return Forbid();

        var division = await _context.EventDivisions
            .FirstOrDefaultAsync(d => d.Id == divisionId && d.EventId == eventId);

        if (division == null)
            return NotFound(new ApiResponse<AdvancementResultDto> { Success = false, Message = "Division not found" });

        // Check if pools already finalized
        if (division.ScheduleStatus == "PoolsFinalized")
            return BadRequest(new ApiResponse<AdvancementResultDto> { Success = false, Message = "Pools have already been finalized" });

        var advanceCount = request?.AdvancePerPool ?? division.PlayoffFromPools ?? 2;

        // Get units with their current pool rankings
        var units = await _context.EventUnits
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled")
            .OrderBy(u => u.PoolNumber)
            .ThenBy(u => u.PoolRank)
            .ToListAsync();

        // Group by pool and select top N from each
        var pools = units.GroupBy(u => u.PoolNumber ?? 0).OrderBy(g => g.Key).ToList();
        var advancingUnits = new List<EventUnit>();

        foreach (var pool in pools)
        {
            var poolUnits = pool.OrderBy(u => u.PoolRank ?? 999).Take(advanceCount).ToList();
            foreach (var unit in poolUnits)
            {
                unit.AdvancedToPlayoff = true;
                advancingUnits.Add(unit);
            }
        }

        // Assign overall rankings for seeding (Pool A #1, Pool B #1, Pool A #2, Pool B #2, etc.)
        var overallRank = 1;
        for (int rank = 1; rank <= advanceCount; rank++)
        {
            foreach (var pool in pools)
            {
                var unit = pool.FirstOrDefault(u => u.PoolRank == rank);
                if (unit != null && unit.AdvancedToPlayoff)
                {
                    unit.OverallRank = overallRank++;
                }
            }
        }

        // Update division status
        division.ScheduleStatus = "PoolsFinalized";

        // Get playoff matches and assign units based on seeding
        var playoffMatches = await _context.EventMatches
            .Where(m => m.DivisionId == divisionId && m.RoundType == "Bracket" && m.RoundNumber == 1)
            .OrderBy(m => m.BracketPosition)
            .ToListAsync();

        var assignedMatches = new List<PlayoffMatchAssignmentDto>();

        if (playoffMatches.Any())
        {
            // Standard seeding: 1v8, 4v5, 3v6, 2v7 for 8 teams
            var bracketSize = playoffMatches.Count * 2;
            var seedPositions = GetSeededBracketPositions(bracketSize);

            for (int i = 0; i < playoffMatches.Count && i < seedPositions.Count; i++)
            {
                var match = playoffMatches[i];
                var (seed1, seed2) = seedPositions[i];

                var unit1 = advancingUnits.FirstOrDefault(u => u.OverallRank == seed1);
                var unit2 = advancingUnits.FirstOrDefault(u => u.OverallRank == seed2);

                if (unit1 != null)
                {
                    match.Unit1Id = unit1.Id;
                    match.Unit1Number = seed1;
                }
                if (unit2 != null)
                {
                    match.Unit2Id = unit2.Id;
                    match.Unit2Number = seed2;
                }

                match.UpdatedAt = DateTime.Now;

                assignedMatches.Add(new PlayoffMatchAssignmentDto
                {
                    MatchId = match.Id,
                    BracketPosition = match.BracketPosition ?? 0,
                    Unit1Seed = seed1,
                    Unit1Name = unit1?.Name,
                    Unit2Seed = seed2,
                    Unit2Name = unit2?.Name
                });
            }
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("TD {UserId} finalized pools for division {DivisionId}, {Count} teams advancing",
            userId, divisionId, advancingUnits.Count);

        return Ok(new ApiResponse<AdvancementResultDto>
        {
            Success = true,
            Data = new AdvancementResultDto
            {
                AdvancedCount = advancingUnits.Count,
                AdvancedUnits = advancingUnits.Select(u => new AdvancedUnitDto
                {
                    UnitId = u.Id,
                    UnitName = u.Name,
                    PoolNumber = u.PoolNumber ?? 0,
                    PoolRank = u.PoolRank ?? 0,
                    OverallSeed = u.OverallRank ?? 0
                }).OrderBy(u => u.OverallSeed).ToList(),
                PlayoffMatches = assignedMatches
            },
            Message = $"{advancingUnits.Count} teams advanced to playoffs"
        });
    }

    /// <summary>
    /// Reset pool finalization (allows re-editing of pool rankings)
    /// </summary>
    [HttpPost("reset-pools/{eventId}/{divisionId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> ResetPools(int eventId, int divisionId)
    {
        var userId = GetUserId();
        if (!await IsEventOrganizer(eventId, userId))
            return Forbid();

        var division = await _context.EventDivisions
            .FirstOrDefaultAsync(d => d.Id == divisionId && d.EventId == eventId);

        if (division == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Division not found" });

        // Check if any playoff matches have been played
        var playedPlayoffMatches = await _context.EventMatches
            .AnyAsync(m => m.DivisionId == divisionId && m.RoundType == "Bracket" && m.Status == "Completed");

        if (playedPlayoffMatches)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Cannot reset pools after playoff matches have been played" });

        // Reset units
        var units = await _context.EventUnits
            .Where(u => u.DivisionId == divisionId)
            .ToListAsync();

        foreach (var unit in units)
        {
            unit.AdvancedToPlayoff = false;
            unit.ManuallyAdvanced = false;
            unit.OverallRank = null;
            unit.UpdatedAt = DateTime.Now;
        }

        // Clear playoff match assignments
        var playoffMatches = await _context.EventMatches
            .Where(m => m.DivisionId == divisionId && m.RoundType == "Bracket" && m.RoundNumber == 1)
            .ToListAsync();

        foreach (var match in playoffMatches)
        {
            match.Unit1Id = null;
            match.Unit2Id = null;
            match.UpdatedAt = DateTime.Now;
        }

        // Reset division status
        division.ScheduleStatus = "UnitsAssigned";

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object> { Success = true, Message = "Pool finalization reset" });
    }

    private List<EventUnit> ApplyHeadToHeadTiebreaker(List<EventUnit> units, List<EventEncounter> matches)
    {
        // Simple implementation: when two teams are tied, check head-to-head
        var result = new List<EventUnit>();
        var remaining = units.ToList();

        while (remaining.Any())
        {
            var current = remaining.First();
            remaining.RemoveAt(0);

            // Find teams tied with current
            var tied = remaining.Where(u =>
                u.MatchesWon == current.MatchesWon &&
                (u.GamesWon - u.GamesLost) == (current.GamesWon - current.GamesLost) &&
                (u.PointsScored - u.PointsAgainst) == (current.PointsScored - current.PointsAgainst)
            ).ToList();

            if (tied.Any())
            {
                // Check head-to-head between tied teams
                var tiedGroup = new List<EventUnit> { current };
                tiedGroup.AddRange(tied);
                remaining = remaining.Except(tied).ToList();

                // Sort tied group by head-to-head wins against each other
                var sortedTied = tiedGroup.OrderByDescending(u =>
                {
                    var h2hWins = 0;
                    foreach (var opponent in tiedGroup.Where(o => o.Id != u.Id))
                    {
                        var h2hMatch = matches.FirstOrDefault(m =>
                            (m.Unit1Id == u.Id && m.Unit2Id == opponent.Id) ||
                            (m.Unit2Id == u.Id && m.Unit1Id == opponent.Id));
                        if (h2hMatch?.WinnerUnitId == u.Id)
                            h2hWins++;
                    }
                    return h2hWins;
                }).ToList();

                result.AddRange(sortedTied);
            }
            else
            {
                result.Add(current);
            }
        }

        return result;
    }

    private List<(int, int)> GetSeededBracketPositions(int bracketSize)
    {
        // Standard tournament seeding positions
        // For 8 teams: (1,8), (4,5), (3,6), (2,7)
        // For 4 teams: (1,4), (2,3)
        var positions = new List<(int, int)>();

        if (bracketSize == 2)
        {
            positions.Add((1, 2));
        }
        else if (bracketSize == 4)
        {
            positions.Add((1, 4));
            positions.Add((2, 3));
        }
        else if (bracketSize == 8)
        {
            positions.Add((1, 8));
            positions.Add((4, 5));
            positions.Add((3, 6));
            positions.Add((2, 7));
        }
        else if (bracketSize == 16)
        {
            positions.Add((1, 16));
            positions.Add((8, 9));
            positions.Add((4, 13));
            positions.Add((5, 12));
            positions.Add((3, 14));
            positions.Add((6, 11));
            positions.Add((7, 10));
            positions.Add((2, 15));
        }
        else
        {
            // Generic fallback for other sizes
            for (int i = 0; i < bracketSize / 2; i++)
            {
                positions.Add((i + 1, bracketSize - i));
            }
        }

        return positions;
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
        var encounterId = game.EncounterMatch?.EncounterId ?? 0;
        var encounter = await _context.EventMatches
            .Include(m => m.Unit1)
                .ThenInclude(u => u!.Members)
            .Include(m => m.Unit2)
                .ThenInclude(u => u!.Members)
            .FirstOrDefaultAsync(m => m.Id == encounterId);

        if (encounter == null) return;
        if (encounter.Unit1?.Members == null || encounter.Unit2?.Members == null) return;

        var playerIds = encounter.Unit1.Members
            .Concat(encounter.Unit2.Members)
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
                $"/events/{encounter.EventId}/gameday",
                "Game",
                game.Id
            );
        }
    }

    private async Task NotifyPlayersGameStarted(EventGame game)
    {
        var encounterId = game.EncounterMatch?.EncounterId ?? 0;
        var encounter = await _context.EventMatches
            .Include(m => m.Unit1)
                .ThenInclude(u => u!.Members)
            .Include(m => m.Unit2)
                .ThenInclude(u => u!.Members)
            .FirstOrDefaultAsync(m => m.Id == encounterId);

        if (encounter == null) return;
        if (encounter.Unit1?.Members == null || encounter.Unit2?.Members == null) return;

        var playerIds = encounter.Unit1.Members
            .Concat(encounter.Unit2.Members)
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
                $"/events/{encounter.EventId}/gameday",
                "Game",
                game.Id
            );
        }
    }

    private async Task NotifyScoreUpdate(EventGame game)
    {
        var encounter = game.EncounterMatch?.Encounter;
        if (encounter == null) return;

        // Broadcast to event group for admin dashboard refresh
        await _notificationService.SendToEventAsync(encounter.EventId, new NotificationPayload
        {
            Type = "ScoreUpdate",
            Title = "Score Updated",
            Message = $"Score: {game.Unit1Score} - {game.Unit2Score}",
            ReferenceType = "Game",
            ReferenceId = game.Id,
            CreatedAt = DateTime.Now
        });

        // Notify spectators subscribed to this game/players
        var subscriptions = await _context.SpectatorSubscriptions
            .Where(s => s.EventId == encounter.EventId && s.IsActive && s.NotifyOnScoreUpdate)
            .Where(s =>
                s.SubscriptionType == SubscriptionTypes.Event ||
                (s.SubscriptionType == SubscriptionTypes.Game && s.TargetId == game.Id) ||
                (s.SubscriptionType == SubscriptionTypes.Division && s.TargetId == encounter.DivisionId) ||
                (s.SubscriptionType == SubscriptionTypes.Unit && (s.TargetId == encounter.Unit1Id || s.TargetId == encounter.Unit2Id)))
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
                $"/events/{encounter.EventId}/scoreboard",
                "Game",
                game.Id
            );
        }
    }

    private async Task UpdateStatsAfterGameFinish(EventGame game)
    {
        var encounter = game.EncounterMatch?.Encounter;
        if (encounter == null) return;

        var unit1 = await _context.EventUnits.FindAsync(encounter.Unit1Id);
        var unit2 = await _context.EventUnits.FindAsync(encounter.Unit2Id);

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
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .Include(m => m.Unit1)
            .Include(m => m.Unit2)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null) return;

        var allGames = match.Matches.SelectMany(m => m.Games).ToList();
        var finishedGames = allGames.Where(g => g.Status == "Finished").ToList();
        var unit1Wins = finishedGames.Count(g => g.WinnerUnitId == match.Unit1Id);
        var unit2Wins = finishedGames.Count(g => g.WinnerUnitId == match.Unit2Id);
        var winsNeeded = (match.BestOf / 2) + 1;

        if (unit1Wins >= winsNeeded || unit2Wins >= winsNeeded || finishedGames.Count == allGames.Count)
        {
            match.Status = "Completed";
            match.CompletedAt = DateTime.Now;
            match.WinnerUnitId = unit1Wins > unit2Wins ? match.Unit1Id : match.Unit2Id;

            // Update match stats
            var unit1 = match.Unit1;
            var unit2 = match.Unit2;
            if (unit1 == null || unit2 == null) return;

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
    public bool HasPaid { get; set; }
    public List<PlayerDivisionDto> MyDivisions { get; set; } = new();
    public List<EventDivisionBriefDto> AllDivisions { get; set; } = new();
    public List<PlayerGameInfoDto> MyGames { get; set; } = new();
    public List<ScheduledMatchDto> ScheduledMatches { get; set; } = new();
    public PlayerGameInfoDto? UpcomingGame { get; set; }
    public PlayerGameInfoDto? NextGame { get; set; }
}

public class EventDivisionBriefDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class ScheduledMatchDto
{
    public int EncounterId { get; set; }
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public string RoundType { get; set; } = string.Empty;
    public string? RoundName { get; set; }
    public int MatchNumber { get; set; }
    public int? MyUnitId { get; set; }
    public int? Unit1Id { get; set; }
    public string? Unit1Name { get; set; }
    public int? Unit2Id { get; set; }
    public string? Unit2Name { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? ScheduledTime { get; set; }
}

public class PlayerDivisionDto
{
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public bool HasPaid { get; set; }
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

public class GameDaySubmitScoreRequest
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

// Pool Standings DTOs
public class PoolStandingsResultDto
{
    public int PoolNumber { get; set; }
    public string PoolName { get; set; } = string.Empty;
    public List<PoolUnitRankDto> Units { get; set; } = new();
}

public class PoolUnitRankDto
{
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public int PoolRank { get; set; }
    public int MatchesWon { get; set; }
    public int MatchesLost { get; set; }
    public int GamesWon { get; set; }
    public int GamesLost { get; set; }
    public int GameDiff { get; set; }
    public int PointsFor { get; set; }
    public int PointsAgainst { get; set; }
    public int PointDiff { get; set; }
    public List<string> Players { get; set; } = new();
}

public class FinalizePoolsRequest
{
    public int? AdvancePerPool { get; set; }
}

public class AdvancementResultDto
{
    public int AdvancedCount { get; set; }
    public List<AdvancedUnitDto> AdvancedUnits { get; set; } = new();
    public List<PlayoffMatchAssignmentDto> PlayoffMatches { get; set; } = new();
}

public class AdvancedUnitDto
{
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public int PoolNumber { get; set; }
    public int PoolRank { get; set; }
    public int OverallSeed { get; set; }
}

public class PlayoffMatchAssignmentDto
{
    public int MatchId { get; set; }
    public int BracketPosition { get; set; }
    public int Unit1Seed { get; set; }
    public string? Unit1Name { get; set; }
    public int Unit2Seed { get; set; }
    public string? Unit2Name { get; set; }
}
