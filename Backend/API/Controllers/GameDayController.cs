using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using System.Security.Claims;

namespace Pickleball.Community.Controllers;

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
                        Name = $"{m.User?.FirstName} {m.User?.LastName}".Trim(),
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
            ScoreFormats = scoreFormats.Select(s => new ScoreFormatDto
            {
                Id = s.Id,
                Name = s.Name,
                ScoringType = s.ScoringType,
                MaxPoints = s.MaxPoints,
                WinByMargin = s.WinByMargin,
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
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
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
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
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

        var now = DateTime.UtcNow;
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

        var now = DateTime.UtcNow;
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
        match.UpdatedAt = DateTime.UtcNow;

        // Update current game
        var currentGame = match.Games.OrderBy(g => g.GameNumber).FirstOrDefault(g => g.Status != "Finished");
        if (currentGame != null)
        {
            currentGame.TournamentCourtId = dto.CourtId;
            currentGame.Status = dto.CourtId.HasValue ? "Queued" : "New";
            currentGame.UpdatedAt = DateTime.UtcNow;
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
            ScoringType = dto.ScoringType ?? "Rally",
            MaxPoints = dto.MaxPoints ?? 11,
            WinByMargin = dto.WinByMargin ?? 2,
            SwitchEndsAtMidpoint = dto.SwitchEndsAtMidpoint ?? false,
            MidpointScore = dto.MidpointScore,
            TimeLimitMinutes = dto.TimeLimitMinutes,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.ScoreFormats.Add(format);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, data = new ScoreFormatDto
        {
            Id = format.Id,
            Name = format.Name,
            ScoringType = format.ScoringType,
            MaxPoints = format.MaxPoints,
            WinByMargin = format.WinByMargin,
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
                    Name = $"{mem.User?.FirstName} {mem.User?.LastName}".Trim(),
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
                    Name = $"{mem.User?.FirstName} {mem.User?.LastName}".Trim(),
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
    public List<ScoreFormatDto> ScoreFormats { get; set; } = new();
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

public class ScoreFormatDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ScoringType { get; set; } = string.Empty;
    public int MaxPoints { get; set; }
    public int WinByMargin { get; set; }
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
    public string? ScoringType { get; set; }
    public int? MaxPoints { get; set; }
    public int? WinByMargin { get; set; }
    public bool? SwitchEndsAtMidpoint { get; set; }
    public int? MidpointScore { get; set; }
    public int? TimeLimitMinutes { get; set; }
}

public class SetScoreFormatDto
{
    public int? ScoreFormatId { get; set; }
}
