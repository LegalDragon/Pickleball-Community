using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using System.Security.Claims;

namespace Pickleball.Community.API.Controllers;

/// <summary>
/// Controller for managing Game Day events (non-tournament casual play sessions)
/// </summary>
[ApiController]
[Route("gameday")]
[Authorize]
public class GameDayController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<GameDayController> _logger;

    public GameDayController(ApplicationDbContext context, ILogger<GameDayController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int userId))
        {
            return userId;
        }
        return null;
    }

    private async Task<bool> IsEventOrganizer(int eventId, int userId)
    {
        var evt = await _context.Events.FindAsync(eventId);
        return evt != null && evt.OrganizedByUserId == userId;
    }

    // ==========================================
    // Event Overview
    // ==========================================

    /// <summary>
    /// Get game day overview for an event
    /// </summary>
    [HttpGet("events/{eventId}")]
    public async Task<IActionResult> GetGameDayOverview(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var evt = await _context.Events
            .Include(e => e.EventType)
            .Include(e => e.Divisions)
                .ThenInclude(d => d.TeamUnit)
            .Include(e => e.Divisions)
                .ThenInclude(d => d.DefaultScoreFormat)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new { success = false, message = "Event not found" });

        var isOrganizer = evt.OrganizedByUserId == userId.Value;

        // Get all units with their members
        var units = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
            .Where(u => u.EventId == eventId && u.Status != "Cancelled")
            .ToListAsync();

        // Get courts
        var courts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ToListAsync();

        // Get all games (via matches)
        var matches = await _context.EventMatches
            .Include(m => m.Unit1)
                .ThenInclude(u => u.Members)
                    .ThenInclude(mem => mem.User)
            .Include(m => m.Unit2)
                .ThenInclude(u => u.Members)
                    .ThenInclude(mem => mem.User)
            .Include(m => m.Division)
            .Include(m => m.TournamentCourt)
            .Include(m => m.Games)
            .Where(m => m.EventId == eventId)
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync();

        // Get score formats
        var scoreFormats = await _context.ScoreFormats
            .Include(s => s.ScoreMethod)
            .Where(s => s.IsActive)
            .OrderBy(s => s.SortOrder)
            .ToListAsync();

        var overview = new GameDayOverviewDto
        {
            EventId = evt.Id,
            EventName = evt.Name,
            EventTypeName = evt.EventType?.Name,
            StartDate = evt.StartDate,
            IsOrganizer = isOrganizer,
            Divisions = evt.Divisions.Select(d => new GameDayDivisionDto
            {
                Id = d.Id,
                Name = d.Name,
                TeamSize = d.TeamUnit?.TotalPlayers ?? d.TeamSize,
                DefaultScoreFormatId = d.DefaultScoreFormatId,
                Units = units.Where(u => u.DivisionId == d.Id).Select(u => new GameDayUnitDto
                {
                    Id = u.Id,
                    Name = u.Name,
                    Status = u.Status,
                    Members = u.Members.Where(m => m.InviteStatus == "Accepted").Select(m => new GameDayPlayerDto
                    {
                        UserId = m.UserId,
                        Name = Utility.FormatName(m.User?.LastName, m.User?.FirstName),
                        ProfileImageUrl = m.User?.ProfileImageUrl,
                        IsCheckedIn = m.IsCheckedIn
                    }).ToList()
                }).ToList()
            }).ToList(),
            Courts = courts.Select(c => new GameDayCourtDto
            {
                Id = c.Id,
                Label = c.CourtLabel,
                Status = c.Status,
                CurrentGameId = c.CurrentGameId
            }).ToList(),
            Games = matches.Select(m => MapToGameDto(m)).ToList(),
            ScoreFormats = scoreFormats.Select(s => new GameDayScoreFormatDto
            {
                Id = s.Id,
                Name = s.Name,
                ScoreMethodId = s.ScoreMethodId,
                ScoreMethodName = s.ScoreMethod?.Name,
                ScoringType = s.ScoringType,
                MaxPoints = s.MaxPoints,
                WinByMargin = s.WinByMargin,
                CapAfter = s.CapAfter,
                SwitchEndsAtMidpoint = s.SwitchEndsAtMidpoint,
                MidpointScore = s.MidpointScore,
                IsDefault = s.IsDefault
            }).ToList(),
            Stats = new GameDayStatsDto
            {
                TotalUnits = units.Count,
                TotalPlayers = units.SelectMany(u => u.Members.Where(m => m.InviteStatus == "Accepted")).Count(),
                CheckedInPlayers = units.SelectMany(u => u.Members.Where(m => m.InviteStatus == "Accepted" && m.IsCheckedIn)).Count(),
                TotalCourts = courts.Count,
                ActiveCourts = courts.Count(c => c.Status == "InUse"),
                TotalGames = matches.Count,
                CompletedGames = matches.Count(m => m.Status == "Completed"),
                InProgressGames = matches.Count(m => m.Status == "InProgress")
            }
        };

        return Ok(new { success = true, data = overview });
    }

    // ==========================================
    // Court Management
    // ==========================================

    /// <summary>
    /// Add a court to the event
    /// </summary>
    [HttpPost("events/{eventId}/courts")]
    public async Task<IActionResult> AddCourt(int eventId, [FromBody] AddCourtDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        if (!await IsEventOrganizer(eventId, userId.Value))
            return Forbid();

        var maxSort = await _context.TournamentCourts
            .Where(c => c.EventId == eventId)
            .MaxAsync(c => (int?)c.SortOrder) ?? 0;

        var court = new TournamentCourt
        {
            EventId = eventId,
            CourtLabel = dto.Label ?? $"Court {maxSort + 1}",
            Status = "Available",
            SortOrder = maxSort + 1,
            IsActive = true
        };

        _context.TournamentCourts.Add(court);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, data = new GameDayCourtDto
        {
            Id = court.Id,
            Label = court.CourtLabel,
            Status = court.Status,
            CurrentGameId = null
        }});
    }

    /// <summary>
    /// Update court status
    /// </summary>
    [HttpPut("courts/{courtId}")]
    public async Task<IActionResult> UpdateCourt(int courtId, [FromBody] UpdateCourtDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var court = await _context.TournamentCourts.FindAsync(courtId);
        if (court == null)
            return NotFound(new { success = false, message = "Court not found" });

        if (!await IsEventOrganizer(court.EventId, userId.Value))
            return Forbid();

        if (dto.Label != null)
            court.CourtLabel = dto.Label;
        if (dto.Status != null)
            court.Status = dto.Status;
        if (dto.IsActive.HasValue)
            court.IsActive = dto.IsActive.Value;

        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }

    /// <summary>
    /// Delete a court
    /// </summary>
    [HttpDelete("courts/{courtId}")]
    public async Task<IActionResult> DeleteCourt(int courtId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var court = await _context.TournamentCourts.FindAsync(courtId);
        if (court == null)
            return NotFound(new { success = false, message = "Court not found" });

        if (!await IsEventOrganizer(court.EventId, userId.Value))
            return Forbid();

        // Check if court has active games
        var hasActiveGames = await _context.EventGames
            .AnyAsync(g => g.TournamentCourtId == courtId && g.Status != "Finished");

        if (hasActiveGames)
            return BadRequest(new { success = false, message = "Cannot delete court with active games" });

        _context.TournamentCourts.Remove(court);
        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }

    // ==========================================
    // Game Scheduling
    // ==========================================

    /// <summary>
    /// Create a new game (schedule two units to play)
    /// </summary>
    [HttpPost("events/{eventId}/games")]
    public async Task<IActionResult> CreateGame(int eventId, [FromBody] CreateGameDayGameDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        if (!await IsEventOrganizer(eventId, userId.Value))
            return Forbid();

        // Validate units
        var unit1 = await _context.EventUnits
            .Include(u => u.Division)
            .FirstOrDefaultAsync(u => u.Id == dto.Unit1Id && u.EventId == eventId);
        var unit2 = await _context.EventUnits
            .Include(u => u.Division)
            .FirstOrDefaultAsync(u => u.Id == dto.Unit2Id && u.EventId == eventId);

        if (unit1 == null || unit2 == null)
            return BadRequest(new { success = false, message = "Invalid units" });

        if (unit1.DivisionId != unit2.DivisionId)
            return BadRequest(new { success = false, message = "Units must be in the same division" });

        // Validate court if specified
        TournamentCourt? court = null;
        if (dto.CourtId.HasValue)
        {
            court = await _context.TournamentCourts.FindAsync(dto.CourtId.Value);
            if (court == null || court.EventId != eventId)
                return BadRequest(new { success = false, message = "Invalid court" });
        }

        // Create match
        var match = new EventMatch
        {
            EventId = eventId,
            DivisionId = unit1.DivisionId,
            Unit1Id = unit1.Id,
            Unit2Id = unit2.Id,
            TournamentCourtId = dto.CourtId,
            Status = dto.CourtId.HasValue ? "Queued" : "Pending",
            BestOf = dto.BestOf ?? 1,
            ScoreFormatId = dto.ScoreFormatId ?? unit1.Division?.DefaultScoreFormatId,
            RoundType = "GameDay",
            RoundNumber = 1,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _context.EventMatches.Add(match);
        await _context.SaveChangesAsync();

        // Create game(s) based on BestOf
        for (int i = 1; i <= match.BestOf; i++)
        {
            var game = new EventGame
            {
                MatchId = match.Id,
                GameNumber = i,
                ScoreFormatId = match.ScoreFormatId,
                TournamentCourtId = i == 1 ? dto.CourtId : null, // Only first game gets court
                Status = i == 1 && dto.CourtId.HasValue ? "Queued" : "New",
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            _context.EventGames.Add(game);
        }

        // Update court status if assigned
        if (court != null)
        {
            court.Status = "InUse";
        }

        await _context.SaveChangesAsync();

        // Reload match with all relations
        match = await _context.EventMatches
            .Include(m => m.Unit1).ThenInclude(u => u.Members).ThenInclude(mem => mem.User)
            .Include(m => m.Unit2).ThenInclude(u => u.Members).ThenInclude(mem => mem.User)
            .Include(m => m.Division)
            .Include(m => m.TournamentCourt)
            .Include(m => m.Games)
            .FirstOrDefaultAsync(m => m.Id == match.Id);

        return Ok(new { success = true, data = MapToGameDto(match!) });
    }

    /// <summary>
    /// Update game status (start, pause, finish)
    /// </summary>
    [HttpPut("games/{matchId}/status")]
    public async Task<IActionResult> UpdateGameStatus(int matchId, [FromBody] UpdateGameStatusDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var match = await _context.EventMatches
            .Include(m => m.Games)
            .Include(m => m.TournamentCourt)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null)
            return NotFound(new { success = false, message = "Game not found" });

        if (!await IsEventOrganizer(match.EventId, userId.Value))
            return Forbid();

        var now = DateTime.Now;
        match.Status = dto.Status;
        match.UpdatedAt = now;

        // Update current game status
        var currentGame = match.Games.OrderBy(g => g.GameNumber).FirstOrDefault(g => g.Status != "Finished");
        if (currentGame != null)
        {
            if (dto.Status == "InProgress")
            {
                currentGame.Status = "Playing";
                currentGame.StartedAt ??= now;
            }
            else if (dto.Status == "Completed")
            {
                currentGame.Status = "Finished";
                currentGame.FinishedAt = now;
            }
            currentGame.UpdatedAt = now;
        }

        // Update court status
        if (match.TournamentCourt != null)
        {
            if (dto.Status == "InProgress")
            {
                match.TournamentCourt.Status = "InUse";
                match.TournamentCourt.CurrentGameId = currentGame?.Id;
            }
            else if (dto.Status == "Completed")
            {
                match.TournamentCourt.Status = "Available";
                match.TournamentCourt.CurrentGameId = null;
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }

    /// <summary>
    /// Update game score
    /// </summary>
    [HttpPut("games/{matchId}/score")]
    public async Task<IActionResult> UpdateScore(int matchId, [FromBody] UpdateScoreDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var match = await _context.EventMatches
            .Include(m => m.Games)
            .Include(m => m.TournamentCourt)
            .Include(m => m.Unit1)
            .Include(m => m.Unit2)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null)
            return NotFound(new { success = false, message = "Game not found" });

        if (!await IsEventOrganizer(match.EventId, userId.Value))
            return Forbid();

        var game = match.Games.FirstOrDefault(g => g.GameNumber == (dto.GameNumber ?? 1));
        if (game == null)
            return BadRequest(new { success = false, message = "Invalid game number" });

        var now = DateTime.Now;
        game.Unit1Score = dto.Unit1Score;
        game.Unit2Score = dto.Unit2Score;
        game.UpdatedAt = now;

        // Determine winner if game is finished
        if (dto.IsFinished == true)
        {
            game.Status = "Finished";
            game.FinishedAt = now;

            if (dto.Unit1Score > dto.Unit2Score)
                game.WinnerUnitId = match.Unit1Id;
            else if (dto.Unit2Score > dto.Unit1Score)
                game.WinnerUnitId = match.Unit2Id;

            // Check if match is complete (for best of X)
            var unit1Wins = match.Games.Count(g => g.WinnerUnitId == match.Unit1Id);
            var unit2Wins = match.Games.Count(g => g.WinnerUnitId == match.Unit2Id);
            var winsNeeded = (match.BestOf / 2) + 1;

            if (unit1Wins >= winsNeeded || unit2Wins >= winsNeeded)
            {
                match.Status = "Completed";
                match.WinnerUnitId = unit1Wins >= winsNeeded ? match.Unit1Id : match.Unit2Id;
                match.CompletedAt = now;

                // Free up the court
                if (match.TournamentCourt != null)
                {
                    match.TournamentCourt.Status = "Available";
                    match.TournamentCourt.CurrentGameId = null;
                }

                // Update unit stats
                if (match.Unit1 != null && match.Unit2 != null)
                {
                    match.Unit1.MatchesPlayed++;
                    match.Unit2.MatchesPlayed++;

                    if (match.WinnerUnitId == match.Unit1Id)
                    {
                        match.Unit1.MatchesWon++;
                        match.Unit2.MatchesLost++;
                    }
                    else
                    {
                        match.Unit2.MatchesWon++;
                        match.Unit1.MatchesLost++;
                    }

                    match.Unit1.GamesWon += unit1Wins;
                    match.Unit1.GamesLost += unit2Wins;
                    match.Unit2.GamesWon += unit2Wins;
                    match.Unit2.GamesLost += unit1Wins;
                }
            }
        }

        match.UpdatedAt = now;
        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }

    /// <summary>
    /// Assign a game to a court
    /// </summary>
    [HttpPut("games/{matchId}/court")]
    public async Task<IActionResult> AssignCourt(int matchId, [FromBody] AssignCourtDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var match = await _context.EventMatches
            .Include(m => m.Games)
            .Include(m => m.TournamentCourt)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null)
            return NotFound(new { success = false, message = "Game not found" });

        if (!await IsEventOrganizer(match.EventId, userId.Value))
            return Forbid();

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
            if (newCourt == null || newCourt.EventId != match.EventId)
                return BadRequest(new { success = false, message = "Invalid court" });

            newCourt.Status = "InUse";
        }

        match.TournamentCourtId = dto.CourtId;
        match.Status = dto.CourtId.HasValue ? "Queued" : "Pending";
        match.UpdatedAt = DateTime.Now;

        // Update current game
        var currentGame = match.Games.OrderBy(g => g.GameNumber).FirstOrDefault(g => g.Status != "Finished");
        if (currentGame != null)
        {
            currentGame.TournamentCourtId = dto.CourtId;
            currentGame.Status = dto.CourtId.HasValue ? "Queued" : "New";
            currentGame.UpdatedAt = DateTime.Now;
        }

        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }

    /// <summary>
    /// Delete a game
    /// </summary>
    [HttpDelete("games/{matchId}")]
    public async Task<IActionResult> DeleteGame(int matchId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var match = await _context.EventMatches
            .Include(m => m.Games)
            .Include(m => m.TournamentCourt)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null)
            return NotFound(new { success = false, message = "Game not found" });

        if (!await IsEventOrganizer(match.EventId, userId.Value))
            return Forbid();

        // Free court if assigned
        if (match.TournamentCourt != null)
        {
            match.TournamentCourt.Status = "Available";
            match.TournamentCourt.CurrentGameId = null;
        }

        // Delete games first
        _context.EventGames.RemoveRange(match.Games);
        _context.EventMatches.Remove(match);
        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }

    // ==========================================
    // Score Format Management
    // ==========================================

    /// <summary>
    /// Create or update an event-specific score format
    /// </summary>
    [HttpPost("events/{eventId}/score-formats")]
    public async Task<IActionResult> CreateScoreFormat(int eventId, [FromBody] CreateScoreFormatDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        if (!await IsEventOrganizer(eventId, userId.Value))
            return Forbid();

        var format = new ScoreFormat
        {
            Name = dto.Name,
            Description = dto.Description,
            ScoreMethodId = dto.ScoreMethodId,
            ScoringType = dto.ScoringType ?? "Rally",
            MaxPoints = dto.MaxPoints ?? 11,
            WinByMargin = dto.WinByMargin ?? 2,
            CapAfter = dto.CapAfter ?? 0,
            SwitchEndsAtMidpoint = dto.SwitchEndsAtMidpoint ?? false,
            MidpointScore = dto.MidpointScore,
            TimeLimitMinutes = dto.TimeLimitMinutes,
            IsActive = true,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _context.ScoreFormats.Add(format);
        await _context.SaveChangesAsync();

        // Load the score method name if set
        string? scoreMethodName = null;
        if (format.ScoreMethodId.HasValue)
        {
            var method = await _context.ScoreMethods.FindAsync(format.ScoreMethodId.Value);
            scoreMethodName = method?.Name;
        }

        return Ok(new { success = true, data = new GameDayScoreFormatDto
        {
            Id = format.Id,
            Name = format.Name,
            ScoreMethodId = format.ScoreMethodId,
            ScoreMethodName = scoreMethodName,
            ScoringType = format.ScoringType,
            MaxPoints = format.MaxPoints,
            WinByMargin = format.WinByMargin,
            CapAfter = format.CapAfter,
            SwitchEndsAtMidpoint = format.SwitchEndsAtMidpoint,
            MidpointScore = format.MidpointScore
        }});
    }

    /// <summary>
    /// Set default score format for a division
    /// </summary>
    [HttpPut("divisions/{divisionId}/score-format")]
    public async Task<IActionResult> SetDivisionScoreFormat(int divisionId, [FromBody] SetScoreFormatDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new { success = false, message = "Division not found" });

        if (division.Event == null || !await IsEventOrganizer(division.Event.Id, userId.Value))
            return Forbid();

        division.DefaultScoreFormatId = dto.ScoreFormatId;
        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }

    // ==========================================
    // Automated Scheduling (Popcorn/Gauntlet)
    // ==========================================

    /// <summary>
    /// Generate a round of games using popcorn (random) or gauntlet (winners stay) scheduling
    /// </summary>
    [HttpPost("events/{eventId}/generate-round")]
    public async Task<IActionResult> GenerateRound(int eventId, [FromBody] GenerateRoundDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        if (!await IsEventOrganizer(eventId, userId.Value))
            return Forbid();

        var evt = await _context.Events
            .Include(e => e.Divisions)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new { success = false, message = "Event not found" });

        // Get available players (checked-in members from specified division or all divisions)
        var unitsQuery = _context.EventUnits
            .AsNoTracking()
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Where(u => u.EventId == eventId && u.Status != "Cancelled" && !u.IsTemporary);

        if (dto.DivisionId.HasValue)
        {
            unitsQuery = unitsQuery.Where(u => u.DivisionId == dto.DivisionId.Value);
        }

        var units = await unitsQuery.ToListAsync();

        // Get all players from units (for individual player scheduling)
        var allPlayers = units
            .SelectMany(u => u.Members.Where(m => m.InviteStatus == "Accepted"))
            .Select(m => new { m.UserId, m.User, UnitId = m.UnitId })
            .ToList();

        // Filter to only checked-in players if required
        if (dto.CheckedInOnly)
        {
            var checkedInUserIds = (await _context.EventUnitMembers
                .Where(m => m.Unit!.EventId == eventId && m.IsCheckedIn)
                .Select(m => m.UserId)
                .ToListAsync()).ToHashSet();

            allPlayers = allPlayers.Where(p => checkedInUserIds.Contains(p.UserId)).ToList();
        }

        // Get available courts
        var availableCourts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive && c.Status == "Available")
            .OrderBy(c => c.SortOrder)
            .ToListAsync();

        if (availableCourts.Count == 0)
            return BadRequest(new { success = false, message = "No available courts" });

        // For gauntlet mode, get winners from last completed games on each court
        Dictionary<int, int?> courtWinners = new();
        if (dto.Method == "gauntlet")
        {
            foreach (var court in availableCourts)
            {
                var lastGame = await _context.EventMatches
                    .Where(m => m.TournamentCourtId == court.Id && m.Status == "Finished")
                    .OrderByDescending(m => m.CompletedAt)
                    .FirstOrDefaultAsync();

                if (lastGame?.WinnerUnitId != null)
                {
                    courtWinners[court.Id] = lastGame.WinnerUnitId;
                }
            }
        }

        // Get the team size from the division or default to 2 (doubles)
        var teamSize = dto.TeamSize ?? 2;
        var playersPerGame = teamSize * 2;

        if (allPlayers.Count < playersPerGame)
            return BadRequest(new { success = false, message = $"Not enough players. Need at least {playersPerGame} for a game." });

        // Shuffle players for random assignment
        var random = new Random();
        var shuffledPlayers = allPlayers.OrderBy(_ => random.Next()).ToList();

        // Create temporary units for ad-hoc games
        var createdMatches = new List<EventMatch>();
        var usedPlayerIds = new HashSet<int>();
        var divisionId = dto.DivisionId ?? evt.Divisions.FirstOrDefault()?.Id ?? 0;

        foreach (var court in availableCourts.Take(dto.MaxGames ?? availableCourts.Count))
        {
            // For gauntlet, try to keep winners on court
            List<int> team1PlayerIds = new();
            List<int> team2PlayerIds = new();

            if (dto.Method == "gauntlet" && courtWinners.TryGetValue(court.Id, out var winnerUnitId) && winnerUnitId.HasValue)
            {
                // Get winner unit's players
                var winnerUnit = await _context.EventUnits
                    .Include(u => u.Members)
                    .FirstOrDefaultAsync(u => u.Id == winnerUnitId.Value);

                if (winnerUnit != null)
                {
                    var winnerPlayerIds = winnerUnit.Members
                        .Where(m => m.InviteStatus == "Accepted")
                        .Select(m => m.UserId)
                        .Take(teamSize)
                        .ToList();

                    // Check if all winner players are still available
                    if (winnerPlayerIds.All(id => shuffledPlayers.Any(p => p.UserId == id && !usedPlayerIds.Contains(id))))
                    {
                        team1PlayerIds = winnerPlayerIds;
                        foreach (var id in team1PlayerIds) usedPlayerIds.Add(id);
                    }
                }
            }

            // Fill remaining spots from shuffled players
            var availableForTeam1 = shuffledPlayers
                .Where(p => !usedPlayerIds.Contains(p.UserId))
                .Take(teamSize - team1PlayerIds.Count)
                .ToList();

            foreach (var p in availableForTeam1)
            {
                team1PlayerIds.Add(p.UserId);
                usedPlayerIds.Add(p.UserId);
            }

            var availableForTeam2 = shuffledPlayers
                .Where(p => !usedPlayerIds.Contains(p.UserId))
                .Take(teamSize)
                .ToList();

            foreach (var p in availableForTeam2)
            {
                team2PlayerIds.Add(p.UserId);
                usedPlayerIds.Add(p.UserId);
            }

            // Check if we have enough players for both teams
            if (team1PlayerIds.Count < teamSize || team2PlayerIds.Count < teamSize)
                break;

            // Create temporary units for this game
            var unit1 = new EventUnit
            {
                EventId = eventId,
                DivisionId = divisionId,
                Name = $"Team {createdMatches.Count * 2 + 1}",
                Status = "Registered",
                IsTemporary = true,
                CaptainUserId = team1PlayerIds.First(),
                CreatedAt = DateTime.Now
            };
            _context.EventUnits.Add(unit1);
            await _context.SaveChangesAsync();

            foreach (var playerId in team1PlayerIds)
            {
                _context.EventUnitMembers.Add(new EventUnitMember
                {
                    UnitId = unit1.Id,
                    UserId = playerId,
                    Role = "Player",
                    InviteStatus = "Accepted",
                    CreatedAt = DateTime.Now
                });
            }

            var unit2 = new EventUnit
            {
                EventId = eventId,
                DivisionId = divisionId,
                Name = $"Team {createdMatches.Count * 2 + 2}",
                Status = "Registered",
                IsTemporary = true,
                CaptainUserId = team2PlayerIds.First(),
                CreatedAt = DateTime.Now
            };
            _context.EventUnits.Add(unit2);
            await _context.SaveChangesAsync();

            foreach (var playerId in team2PlayerIds)
            {
                _context.EventUnitMembers.Add(new EventUnitMember
                {
                    UnitId = unit2.Id,
                    UserId = playerId,
                    Role = "Player",
                    InviteStatus = "Accepted",
                    CreatedAt = DateTime.Now
                });
            }

            // Create the match
            var match = new EventMatch
            {
                EventId = eventId,
                DivisionId = divisionId,
                Unit1Id = unit1.Id,
                Unit2Id = unit2.Id,
                TournamentCourtId = court.Id,
                Status = "Scheduled",
                BestOf = dto.BestOf ?? 1,
                CreatedAt = DateTime.Now
            };
            _context.EventMatches.Add(match);

            // Update court status
            court.Status = "InUse";

            createdMatches.Add(match);
        }

        await _context.SaveChangesAsync();

        // Load the created matches with all related data for response
        // Use HashSet for efficient Contains check in memory (avoids EF Core CTE generation issues)
        var matchIdSet = createdMatches.Select(m => m.Id).ToHashSet();
        var loadedMatches = (await _context.EventMatches
            .Include(m => m.Unit1).ThenInclude(u => u.Members).ThenInclude(mem => mem.User)
            .Include(m => m.Unit2).ThenInclude(u => u.Members).ThenInclude(mem => mem.User)
            .Include(m => m.TournamentCourt)
            .Include(m => m.Division)
            .Include(m => m.Games)
            .Where(m => m.EventId == eventId)
            .ToListAsync())
            .Where(m => matchIdSet.Contains(m.Id))
            .ToList();

        return Ok(new
        {
            success = true,
            data = new
            {
                gamesCreated = createdMatches.Count,
                playersAssigned = usedPlayerIds.Count,
                games = loadedMatches.Select(MapToGameDto).ToList()
            },
            message = $"Created {createdMatches.Count} games using {dto.Method} scheduling"
        });
    }

    /// <summary>
    /// Get available players for manual game scheduling
    /// </summary>
    [HttpGet("events/{eventId}/players")]
    public async Task<IActionResult> GetAvailablePlayers(int eventId, [FromQuery] int? divisionId = null, [FromQuery] bool checkedInOnly = false)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        if (!await IsEventOrganizer(eventId, userId.Value))
            return Forbid();

        // Get all units for this event (optionally filtered by division)
        var unitsQuery = _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Where(u => u.EventId == eventId && u.Status != "Cancelled" && !u.IsTemporary);

        if (divisionId.HasValue)
        {
            unitsQuery = unitsQuery.Where(u => u.DivisionId == divisionId.Value);
        }

        var units = await unitsQuery.ToListAsync();

        // Get all accepted members from units
        var allPlayers = units
            .SelectMany(u => u.Members.Where(m => m.InviteStatus == "Accepted"))
            .Select(m => new
            {
                userId = m.UserId,
                name = Utility.FormatName(m.User?.LastName, m.User?.FirstName),
                profileImageUrl = m.User?.ProfileImageUrl,
                isCheckedIn = m.IsCheckedIn,
                unitId = m.UnitId,
                unitName = units.FirstOrDefault(u => u.Id == m.UnitId)?.Name
            })
            .DistinctBy(p => p.userId)
            .ToList();

        // Filter to checked-in only if required
        if (checkedInOnly)
        {
            allPlayers = allPlayers.Where(p => p.isCheckedIn).ToList();
        }

        // Get players currently in active games
        var activeMatches = await _context.EventMatches
            .Where(m => m.EventId == eventId && (m.Status == "InProgress" || m.Status == "Scheduled" || m.Status == "Queued"))
            .Include(m => m.Unit1).ThenInclude(u => u!.Members)
            .Include(m => m.Unit2).ThenInclude(u => u!.Members)
            .ToListAsync();

        var playersInActiveGames = activeMatches
            .SelectMany(m =>
                (m.Unit1?.Members?.Where(mem => mem.InviteStatus == "Accepted").Select(mem => mem.UserId) ?? Enumerable.Empty<int>())
                .Concat(m.Unit2?.Members?.Where(mem => mem.InviteStatus == "Accepted").Select(mem => mem.UserId) ?? Enumerable.Empty<int>()))
            .Distinct()
            .ToHashSet();

        // Mark players who are available (not in active games)
        var playersWithAvailability = allPlayers.Select(p => new
        {
            p.userId,
            p.name,
            p.profileImageUrl,
            p.isCheckedIn,
            p.unitId,
            p.unitName,
            isAvailable = !playersInActiveGames.Contains(p.userId)
        }).OrderBy(p => p.name).ToList();

        return Ok(new
        {
            success = true,
            data = playersWithAvailability
        });
    }

    /// <summary>
    /// Create a manual game with specific players
    /// </summary>
    [HttpPost("events/{eventId}/manual-game")]
    public async Task<IActionResult> CreateManualGame(int eventId, [FromBody] CreateManualGameDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        if (!await IsEventOrganizer(eventId, userId.Value))
            return Forbid();

        var evt = await _context.Events
            .Include(e => e.Divisions)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new { success = false, message = "Event not found" });

        // Validate player lists
        if (dto.Team1PlayerIds == null || dto.Team1PlayerIds.Count == 0)
            return BadRequest(new { success = false, message = "Team 1 must have at least one player" });

        if (dto.Team2PlayerIds == null || dto.Team2PlayerIds.Count == 0)
            return BadRequest(new { success = false, message = "Team 2 must have at least one player" });

        // Check for duplicate players
        var allPlayerIds = dto.Team1PlayerIds.Concat(dto.Team2PlayerIds).ToList();
        if (allPlayerIds.Count != allPlayerIds.Distinct().Count())
            return BadRequest(new { success = false, message = "A player cannot be on both teams" });

        // Verify all players are registered for this event
        var registeredPlayers = (await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.InviteStatus == "Accepted")
            .Select(m => m.UserId)
            .Distinct()
            .ToListAsync()).ToHashSet();

        var unregisteredPlayers = allPlayerIds.Where(id => !registeredPlayers.Contains(id)).ToList();
        if (unregisteredPlayers.Any())
            return BadRequest(new { success = false, message = "Some players are not registered for this event" });

        // Get or assign court
        TournamentCourt? court = null;
        if (dto.CourtId.HasValue)
        {
            court = await _context.TournamentCourts.FindAsync(dto.CourtId.Value);
            if (court == null || court.EventId != eventId)
                return BadRequest(new { success = false, message = "Invalid court" });
        }

        // Get division
        var divisionId = dto.DivisionId ?? evt.Divisions.FirstOrDefault()?.Id ?? 0;

        // Create temporary units for this game
        var unit1 = new EventUnit
        {
            EventId = eventId,
            DivisionId = divisionId,
            Name = dto.Team1Name ?? "Team A",
            Status = "Registered",
            IsTemporary = true,
            CaptainUserId = dto.Team1PlayerIds.First(),
            CreatedAt = DateTime.Now
        };
        _context.EventUnits.Add(unit1);
        await _context.SaveChangesAsync();

        foreach (var playerId in dto.Team1PlayerIds)
        {
            _context.EventUnitMembers.Add(new EventUnitMember
            {
                UnitId = unit1.Id,
                UserId = playerId,
                Role = "Player",
                InviteStatus = "Accepted",
                CreatedAt = DateTime.Now
            });
        }

        var unit2 = new EventUnit
        {
            EventId = eventId,
            DivisionId = divisionId,
            Name = dto.Team2Name ?? "Team B",
            Status = "Registered",
            IsTemporary = true,
            CaptainUserId = dto.Team2PlayerIds.First(),
            CreatedAt = DateTime.Now
        };
        _context.EventUnits.Add(unit2);
        await _context.SaveChangesAsync();

        foreach (var playerId in dto.Team2PlayerIds)
        {
            _context.EventUnitMembers.Add(new EventUnitMember
            {
                UnitId = unit2.Id,
                UserId = playerId,
                Role = "Player",
                InviteStatus = "Accepted",
                CreatedAt = DateTime.Now
            });
        }

        // Create the match
        var match = new EventMatch
        {
            EventId = eventId,
            DivisionId = divisionId,
            Unit1Id = unit1.Id,
            Unit2Id = unit2.Id,
            TournamentCourtId = dto.CourtId,
            Status = dto.CourtId.HasValue ? "Scheduled" : "Pending",
            BestOf = dto.BestOf ?? 1,
            RoundType = "GameDay",
            RoundNumber = 1,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };
        _context.EventMatches.Add(match);

        // Update court status if assigned
        if (court != null)
        {
            court.Status = "InUse";
        }

        await _context.SaveChangesAsync();

        // Create game(s) based on BestOf
        for (int i = 1; i <= match.BestOf; i++)
        {
            var game = new EventGame
            {
                MatchId = match.Id,
                GameNumber = i,
                TournamentCourtId = i == 1 ? dto.CourtId : null,
                Status = i == 1 && dto.CourtId.HasValue ? "Queued" : "New",
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            _context.EventGames.Add(game);
        }

        await _context.SaveChangesAsync();

        // Load the created match with all related data
        var loadedMatch = await _context.EventMatches
            .Include(m => m.Unit1).ThenInclude(u => u.Members).ThenInclude(mem => mem.User)
            .Include(m => m.Unit2).ThenInclude(u => u.Members).ThenInclude(mem => mem.User)
            .Include(m => m.TournamentCourt)
            .Include(m => m.Division)
            .Include(m => m.Games)
            .FirstOrDefaultAsync(m => m.Id == match.Id);

        return Ok(new
        {
            success = true,
            data = MapToGameDto(loadedMatch!),
            message = "Game created successfully"
        });
    }

    /// <summary>
    /// Search for users to add as on-site players
    /// </summary>
    [HttpGet("events/{eventId}/search-users")]
    public async Task<IActionResult> SearchUsersForOnSiteJoin(int eventId, [FromQuery] string query)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        if (!await IsEventOrganizer(eventId, userId.Value))
            return Forbid();

        if (string.IsNullOrWhiteSpace(query) || query.Length < 2)
            return Ok(new { success = true, data = new List<object>() });

        // Get users already registered for this event
        var registeredUserIds = (await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.InviteStatus == "Accepted")
            .Select(m => m.UserId)
            .Distinct()
            .ToListAsync()).ToHashSet();

        // Search for users by name
        var queryLower = query.ToLower();
        var users = await _context.Users
            .Where(u => (u.FirstName != null && u.FirstName.ToLower().Contains(queryLower)) ||
                       (u.LastName != null && u.LastName.ToLower().Contains(queryLower)) ||
                       (u.Email != null && u.Email.ToLower().Contains(queryLower)))
            .Take(20)
            .Select(u => new
            {
                userId = u.Id,
                name = Utility.FormatName(u.LastName, u.FirstName),
                email = u.Email,
                profileImageUrl = u.ProfileImageUrl,
                isAlreadyRegistered = registeredUserIds.Contains(u.Id)
            })
            .ToListAsync();

        return Ok(new { success = true, data = users });
    }

    /// <summary>
    /// Add a player on-site (quick registration for walk-ins)
    /// </summary>
    [HttpPost("events/{eventId}/on-site-join")]
    public async Task<IActionResult> OnSiteJoin(int eventId, [FromBody] OnSiteJoinDto dto)
    {
        var organizerId = GetUserId();
        if (!organizerId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        if (!await IsEventOrganizer(eventId, organizerId.Value))
            return Forbid();

        var evt = await _context.Events
            .Include(e => e.Divisions)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new { success = false, message = "Event not found" });

        // Verify user exists
        var user = await _context.Users.FindAsync(dto.UserId);
        if (user == null)
            return BadRequest(new { success = false, message = "User not found" });

        // Check if already registered
        var existingMembership = await _context.EventUnitMembers
            .Include(m => m.Unit)
            .FirstOrDefaultAsync(m => m.Unit!.EventId == eventId && m.UserId == dto.UserId && m.InviteStatus == "Accepted");

        if (existingMembership != null)
            return BadRequest(new { success = false, message = "User is already registered for this event" });

        // Get or use first division
        var divisionId = dto.DivisionId ?? evt.Divisions.FirstOrDefault()?.Id ?? 0;

        // Create a single-player unit for this walk-in (marked as on-site)
        var unit = new EventUnit
        {
            EventId = eventId,
            DivisionId = divisionId,
            Name = Utility.FormatName(user.LastName, user.FirstName) ?? "Walk-in",
            Status = "Registered",
            IsTemporary = false, // Real registration, not temporary for games
            CaptainUserId = dto.UserId,
            CreatedAt = DateTime.Now
        };
        _context.EventUnits.Add(unit);
        await _context.SaveChangesAsync();

        // Add the user as a member
        var member = new EventUnitMember
        {
            UnitId = unit.Id,
            UserId = dto.UserId,
            Role = "Player",
            InviteStatus = "Accepted",
            IsCheckedIn = true, // Auto check-in for on-site players
            CheckedInAt = DateTime.Now,
            CreatedAt = DateTime.Now
        };
        _context.EventUnitMembers.Add(member);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            data = new
            {
                userId = dto.UserId,
                name = Utility.FormatName(user.LastName, user.FirstName),
                unitId = unit.Id,
                isCheckedIn = true
            },
            message = $"{Utility.FormatName(user.LastName, user.FirstName)} has been added to the event"
        });
    }

    // ==========================================
    // Helper Methods
    // ==========================================

    private GameDayGameDto MapToGameDto(EventMatch m)
    {
        var currentGame = m.Games?.OrderBy(g => g.GameNumber).FirstOrDefault(g => g.Status != "Finished")
            ?? m.Games?.OrderByDescending(g => g.GameNumber).FirstOrDefault();

        return new GameDayGameDto
        {
            Id = m.Id,
            DivisionId = m.DivisionId,
            DivisionName = m.Division?.Name,
            Unit1 = m.Unit1 != null ? new GameDayUnitDto
            {
                Id = m.Unit1.Id,
                Name = m.Unit1.Name,
                Status = m.Unit1.Status,
                Members = m.Unit1.Members?.Where(mem => mem.InviteStatus == "Accepted").Select(mem => new GameDayPlayerDto
                {
                    UserId = mem.UserId,
                    Name = Utility.FormatName(mem.User?.LastName, mem.User?.FirstName),
                    ProfileImageUrl = mem.User?.ProfileImageUrl
                }).ToList() ?? new List<GameDayPlayerDto>()
            } : null,
            Unit2 = m.Unit2 != null ? new GameDayUnitDto
            {
                Id = m.Unit2.Id,
                Name = m.Unit2.Name,
                Status = m.Unit2.Status,
                Members = m.Unit2.Members?.Where(mem => mem.InviteStatus == "Accepted").Select(mem => new GameDayPlayerDto
                {
                    UserId = mem.UserId,
                    Name = Utility.FormatName(mem.User?.LastName, mem.User?.FirstName),
                    ProfileImageUrl = mem.User?.ProfileImageUrl
                }).ToList() ?? new List<GameDayPlayerDto>()
            } : null,
            CourtId = m.TournamentCourtId,
            CourtLabel = m.TournamentCourt?.CourtLabel,
            Status = m.Status,
            BestOf = m.BestOf,
            CurrentGameNumber = currentGame?.GameNumber ?? 1,
            Unit1Score = currentGame?.Unit1Score ?? 0,
            Unit2Score = currentGame?.Unit2Score ?? 0,
            Unit1Wins = m.Games?.Count(g => g.WinnerUnitId == m.Unit1Id) ?? 0,
            Unit2Wins = m.Games?.Count(g => g.WinnerUnitId == m.Unit2Id) ?? 0,
            WinnerUnitId = m.WinnerUnitId,
            CreatedAt = m.CreatedAt,
            Games = m.Games?.OrderBy(g => g.GameNumber).Select(g => new GameScoreDto
            {
                GameNumber = g.GameNumber,
                Unit1Score = g.Unit1Score,
                Unit2Score = g.Unit2Score,
                WinnerUnitId = g.WinnerUnitId,
                Status = g.Status
            }).ToList() ?? new List<GameScoreDto>()
        };
    }
}

// ==========================================
// DTOs
// ==========================================

public class GameDayOverviewDto
{
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public string? EventTypeName { get; set; }
    public DateTime StartDate { get; set; }
    public bool IsOrganizer { get; set; }
    public List<GameDayDivisionDto> Divisions { get; set; } = new();
    public List<GameDayCourtDto> Courts { get; set; } = new();
    public List<GameDayGameDto> Games { get; set; } = new();
    public List<GameDayScoreFormatDto> ScoreFormats { get; set; } = new();
    public GameDayStatsDto Stats { get; set; } = new();
}

public class GameDayDivisionDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int TeamSize { get; set; }
    public int? DefaultScoreFormatId { get; set; }
    public List<GameDayUnitDto> Units { get; set; } = new();
}

public class GameDayUnitDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public List<GameDayPlayerDto> Members { get; set; } = new();
}

public class GameDayPlayerDto
{
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public bool IsCheckedIn { get; set; }
}

public class GameDayCourtDto
{
    public int Id { get; set; }
    public string Label { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int? CurrentGameId { get; set; }
}

public class GameDayGameDto
{
    public int Id { get; set; }
    public int DivisionId { get; set; }
    public string? DivisionName { get; set; }
    public GameDayUnitDto? Unit1 { get; set; }
    public GameDayUnitDto? Unit2 { get; set; }
    public int? CourtId { get; set; }
    public string? CourtLabel { get; set; }
    public string Status { get; set; } = string.Empty;
    public int BestOf { get; set; }
    public int CurrentGameNumber { get; set; }
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public int Unit1Wins { get; set; }
    public int Unit2Wins { get; set; }
    public int? WinnerUnitId { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<GameScoreDto> Games { get; set; } = new();
}

public class GameScoreDto
{
    public int GameNumber { get; set; }
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public int? WinnerUnitId { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class GameDayStatsDto
{
    public int TotalUnits { get; set; }
    public int TotalPlayers { get; set; }
    public int CheckedInPlayers { get; set; }
    public int TotalCourts { get; set; }
    public int ActiveCourts { get; set; }
    public int TotalGames { get; set; }
    public int CompletedGames { get; set; }
    public int InProgressGames { get; set; }
}

public class GameDayScoreFormatDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? ScoreMethodId { get; set; }
    public string? ScoreMethodName { get; set; }
    public string ScoringType { get; set; } = string.Empty;
    public int MaxPoints { get; set; }
    public int WinByMargin { get; set; }
    public int CapAfter { get; set; }
    public bool SwitchEndsAtMidpoint { get; set; }
    public int? MidpointScore { get; set; }
    public bool IsDefault { get; set; }
}

// Request DTOs
public class AddCourtDto
{
    public string? Label { get; set; }
}

public class UpdateCourtDto
{
    public string? Label { get; set; }
    public string? Status { get; set; }
    public bool? IsActive { get; set; }
}

public class CreateGameDayGameDto
{
    public int Unit1Id { get; set; }
    public int Unit2Id { get; set; }
    public int? CourtId { get; set; }
    public int? ScoreFormatId { get; set; }
    public int? BestOf { get; set; }
}

public class UpdateGameStatusDto
{
    public string Status { get; set; } = string.Empty;
}

public class UpdateScoreDto
{
    public int? GameNumber { get; set; }
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public bool? IsFinished { get; set; }
}

public class AssignCourtDto
{
    public int? CourtId { get; set; }
}

public class CreateScoreFormatDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? ScoreMethodId { get; set; }
    public string? ScoringType { get; set; }
    public int? MaxPoints { get; set; } // Play To (7-39)
    public int? WinByMargin { get; set; } // Win By (1 or 2)
    public int? CapAfter { get; set; } // Cap After (0-9)
    public bool? SwitchEndsAtMidpoint { get; set; } // Change Ends
    public int? MidpointScore { get; set; }
    public int? TimeLimitMinutes { get; set; }
}

public class SetScoreFormatDto
{
    public int? ScoreFormatId { get; set; }
}

public class GenerateRoundDto
{
    /// <summary>
    /// Scheduling method: "popcorn" (random) or "gauntlet" (winners stay)
    /// </summary>
    public string Method { get; set; } = "popcorn";

    /// <summary>
    /// Division to schedule from (optional - uses all if not specified)
    /// </summary>
    public int? DivisionId { get; set; }

    /// <summary>
    /// Team size (1 = singles, 2 = doubles, etc.)
    /// </summary>
    public int? TeamSize { get; set; }

    /// <summary>
    /// Only include checked-in players
    /// </summary>
    public bool CheckedInOnly { get; set; } = false;

    /// <summary>
    /// Maximum number of games to create (defaults to number of available courts)
    /// </summary>
    public int? MaxGames { get; set; }

    /// <summary>
    /// Best of N games per match
    /// </summary>
    public int? BestOf { get; set; }
}

public class CreateManualGameDto
{
    /// <summary>
    /// Player IDs for Team 1
    /// </summary>
    public List<int> Team1PlayerIds { get; set; } = new();

    /// <summary>
    /// Player IDs for Team 2
    /// </summary>
    public List<int> Team2PlayerIds { get; set; } = new();

    /// <summary>
    /// Optional name for Team 1
    /// </summary>
    public string? Team1Name { get; set; }

    /// <summary>
    /// Optional name for Team 2
    /// </summary>
    public string? Team2Name { get; set; }

    /// <summary>
    /// Division ID (optional - uses first division if not specified)
    /// </summary>
    public int? DivisionId { get; set; }

    /// <summary>
    /// Court ID to assign the game to (optional)
    /// </summary>
    public int? CourtId { get; set; }

    /// <summary>
    /// Best of N games per match
    /// </summary>
    public int? BestOf { get; set; }
}

public class OnSiteJoinDto
{
    /// <summary>
    /// User ID to add to the event
    /// </summary>
    public int UserId { get; set; }

    /// <summary>
    /// Division ID (optional - uses first division if not specified)
    /// </summary>
    public int? DivisionId { get; set; }
}
