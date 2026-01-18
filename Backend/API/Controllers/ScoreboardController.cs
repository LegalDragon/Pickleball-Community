using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using System.Security.Claims;
using System.Text;

namespace Pickleball.Community.Controllers;

[Route("[controller]")]
[ApiController]
public class ScoreboardController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ScoreboardController> _logger;

    public ScoreboardController(ApplicationDbContext context, ILogger<ScoreboardController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get scoreboard data with filtering
    /// </summary>
    [HttpGet("{eventId}")]
    public async Task<ActionResult<ApiResponse<ScoreboardDto>>> GetScoreboard(
        int eventId,
        [FromQuery] int? divisionId = null,
        [FromQuery] string? roundType = null,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var evt = await _context.Events
            .Include(e => e.Divisions)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new ApiResponse<ScoreboardDto> { Success = false, Message = "Event not found" });

        var query = _context.EventMatches
            .Where(m => m.EventId == eventId);

        if (divisionId.HasValue)
            query = query.Where(m => m.DivisionId == divisionId.Value);

        if (!string.IsNullOrEmpty(roundType))
            query = query.Where(m => m.RoundType == roundType);

        if (!string.IsNullOrEmpty(status))
            query = query.Where(m => m.Status == status);

        var totalCount = await query.CountAsync();

        var matches = await query
            .Include(m => m.Division)
            .Include(m => m.Unit1)
            .Include(m => m.Unit2)
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .Include(m => m.TournamentCourt)
            .OrderBy(m => m.Status == "InProgress" ? 0 : (m.Status == "Ready" ? 1 : (m.Status == "Scheduled" ? 2 : 3)))
            .ThenBy(m => m.RoundNumber)
            .ThenBy(m => m.EncounterNumber)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => new ScoreboardMatchDto
            {
                MatchId = m.Id,
                DivisionId = m.DivisionId,
                DivisionName = m.Division!.Name,
                RoundType = m.RoundType,
                RoundNumber = m.RoundNumber,
                RoundName = m.RoundName,
                MatchNumber = m.EncounterNumber,
                BracketPosition = m.BracketPosition,
                Status = m.Status,
                BestOf = m.BestOf,
                Unit1Id = m.Unit1Id,
                Unit1Name = m.Unit1 != null ? m.Unit1.Name : null,
                Unit1Seed = m.Unit1 != null ? m.Unit1.Seed : null,
                Unit2Id = m.Unit2Id,
                Unit2Name = m.Unit2 != null ? m.Unit2.Name : null,
                Unit2Seed = m.Unit2 != null ? m.Unit2.Seed : null,
                WinnerUnitId = m.WinnerUnitId,
                ScheduledTime = m.ScheduledTime,
                StartedAt = m.StartedAt,
                CompletedAt = m.CompletedAt,
                CourtName = m.TournamentCourt != null ? m.TournamentCourt.CourtLabel : null,
                CourtNumber = m.TournamentCourt != null ? m.TournamentCourt.SortOrder : null,
                Games = m.Matches.SelectMany(match => match.Games).OrderBy(g => g.GameNumber).Select(g => new ScoreboardGameDto
                {
                    GameNumber = g.GameNumber,
                    Unit1Score = g.Unit1Score,
                    Unit2Score = g.Unit2Score,
                    WinnerUnitId = g.WinnerUnitId,
                    Status = g.Status
                }).ToList()
            })
            .ToListAsync();

        return Ok(new ApiResponse<ScoreboardDto>
        {
            Success = true,
            Data = new ScoreboardDto
            {
                EventId = eventId,
                EventName = evt.Name,
                EventStatus = evt.TournamentStatus,
                Divisions = evt.Divisions.Select(d => new DivisionFilterDto
                {
                    Id = d.Id,
                    Name = d.Name
                }).ToList(),
                TotalMatches = totalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling((double)totalCount / pageSize),
                Matches = matches
            }
        });
    }

    /// <summary>
    /// Get live scores for all active games
    /// </summary>
    [HttpGet("live/{eventId}")]
    public async Task<ActionResult<ApiResponse<List<LiveGameDto>>>> GetLiveScores(int eventId)
    {
        var liveGames = await _context.EventGames
            .Where(g => g.EncounterMatch!.Encounter!.EventId == eventId && (g.Status == "Playing" || g.Status == "Queued"))
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
            .OrderBy(g => g.TournamentCourt!.SortOrder)
            .Select(g => new LiveGameDto
            {
                GameId = g.Id,
                MatchId = g.EncounterMatch!.EncounterId,
                GameNumber = g.GameNumber,
                Status = g.Status,
                Unit1Score = g.Unit1Score,
                Unit2Score = g.Unit2Score,
                Unit1Name = g.EncounterMatch.Encounter!.Unit1!.Name,
                Unit2Name = g.EncounterMatch.Encounter.Unit2!.Name,
                DivisionName = g.EncounterMatch.Encounter.Division!.Name,
                RoundName = g.EncounterMatch.Encounter.RoundName,
                CourtName = g.TournamentCourt != null ? g.TournamentCourt.CourtLabel : null,
                CourtNumber = g.TournamentCourt != null ? g.TournamentCourt.SortOrder : null,
                StartedAt = g.StartedAt
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<LiveGameDto>> { Success = true, Data = liveGames });
    }

    /// <summary>
    /// Get event results/final standings
    /// </summary>
    [HttpGet("results/{eventId}")]
    public async Task<ActionResult<ApiResponse<EventResultsDto>>> GetEventResults(int eventId, [FromQuery] int? divisionId = null)
    {
        var evt = await _context.Events
            .Include(e => e.Divisions)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new ApiResponse<EventResultsDto> { Success = false, Message = "Event not found" });

        var query = _context.EventUnits
            .Where(u => u.EventId == eventId && u.Status != "Cancelled" && u.Status != "Waitlisted");

        if (divisionId.HasValue)
            query = query.Where(u => u.DivisionId == divisionId.Value);

        var standings = await query
            .Include(u => u.Division)
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .OrderBy(u => u.DivisionId)
            .ThenBy(u => u.FinalPlacement ?? 999)
            .ThenBy(u => u.OverallRank ?? 999)
            .ThenByDescending(u => u.MatchesWon)
            .ThenByDescending(u => u.GamesWon - u.GamesLost)
            .ThenByDescending(u => u.PointsScored - u.PointsAgainst)
            .Select(u => new UnitResultDto
            {
                DivisionId = u.DivisionId,
                DivisionName = u.Division!.Name,
                UnitId = u.Id,
                UnitName = u.Name,
                Players = u.Members
                    .Where(m => m.InviteStatus == "Accepted")
                    .Select(m => m.User!.FirstName + " " + m.User.LastName)
                    .ToList(),
                PoolNumber = u.PoolNumber,
                PoolName = u.PoolName,
                PoolRank = u.PoolRank,
                OverallRank = u.OverallRank,
                FinalPlacement = u.FinalPlacement,
                AdvancedToPlayoff = u.AdvancedToPlayoff,
                MatchesPlayed = u.MatchesPlayed,
                MatchesWon = u.MatchesWon,
                MatchesLost = u.MatchesLost,
                GamesWon = u.GamesWon,
                GamesLost = u.GamesLost,
                PointsFor = u.PointsScored,
                PointsAgainst = u.PointsAgainst,
                PointDiff = u.PointsScored - u.PointsAgainst
            })
            .ToListAsync();

        return Ok(new ApiResponse<EventResultsDto>
        {
            Success = true,
            Data = new EventResultsDto
            {
                EventId = eventId,
                EventName = evt.Name,
                EventStatus = evt.TournamentStatus,
                StartDate = evt.StartDate,
                EndDate = evt.EndDate,
                VenueName = evt.VenueName,
                Divisions = evt.Divisions.Select(d => new DivisionFilterDto
                {
                    Id = d.Id,
                    Name = d.Name
                }).ToList(),
                Standings = standings
            }
        });
    }

    /// <summary>
    /// Download event results as CSV
    /// </summary>
    [HttpGet("results/{eventId}/download")]
    public async Task<IActionResult> DownloadResults(int eventId, [FromQuery] int? divisionId = null)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound();

        var query = _context.EventUnits
            .Where(u => u.EventId == eventId && u.Status != "Cancelled" && u.Status != "Waitlisted");

        if (divisionId.HasValue)
            query = query.Where(u => u.DivisionId == divisionId.Value);

        var standings = await query
            .Include(u => u.Division)
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .OrderBy(u => u.DivisionId)
            .ThenBy(u => u.FinalPlacement ?? 999)
            .ThenByDescending(u => u.MatchesWon)
            .ToListAsync();

        var csv = new StringBuilder();
        csv.AppendLine("Division,Placement,Team,Players,Matches Won,Matches Lost,Games Won,Games Lost,Points For,Points Against,Point Diff");

        foreach (var unit in standings)
        {
            var players = string.Join(" / ", unit.Members
                .Where(m => m.InviteStatus == "Accepted")
                .Select(m => $"{m.User?.FirstName} {m.User?.LastName}"));

            csv.AppendLine($"\"{unit.Division?.Name}\",{unit.FinalPlacement ?? unit.OverallRank},\"{unit.Name}\",\"{players}\",{unit.MatchesWon},{unit.MatchesLost},{unit.GamesWon},{unit.GamesLost},{unit.PointsScored},{unit.PointsAgainst},{unit.PointsScored - unit.PointsAgainst}");
        }

        var fileName = $"{evt.Name.Replace(" ", "_")}_Results_{DateTime.Now:yyyyMMdd}.csv";
        return File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv", fileName);
    }

    /// <summary>
    /// Get bracket data for a division
    /// </summary>
    [HttpGet("bracket/{eventId}/{divisionId}")]
    public async Task<ActionResult<ApiResponse<BracketDto>>> GetBracket(int eventId, int divisionId)
    {
        var division = await _context.EventDivisions
            .FirstOrDefaultAsync(d => d.Id == divisionId && d.EventId == eventId);

        if (division == null)
            return NotFound(new ApiResponse<BracketDto> { Success = false, Message = "Division not found" });

        var matches = await _context.EventMatches
            .Where(m => m.DivisionId == divisionId && m.RoundType == "Bracket")
            .Include(m => m.Unit1)
            .Include(m => m.Unit2)
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .OrderBy(m => m.RoundNumber)
            .ThenBy(m => m.BracketPosition)
            .Select(m => new BracketMatchDto
            {
                MatchId = m.Id,
                RoundNumber = m.RoundNumber,
                RoundName = m.RoundName,
                BracketPosition = m.BracketPosition ?? 0,
                Status = m.Status,
                Unit1Id = m.Unit1Id,
                Unit1Name = m.Unit1 != null ? m.Unit1.Name : null,
                Unit1Seed = m.Unit1 != null ? m.Unit1.Seed : null,
                Unit2Id = m.Unit2Id,
                Unit2Name = m.Unit2 != null ? m.Unit2.Name : null,
                Unit2Seed = m.Unit2 != null ? m.Unit2.Seed : null,
                WinnerUnitId = m.WinnerUnitId,
                Unit1GamesWon = m.Matches.SelectMany(match => match.Games).Count(g => g.WinnerUnitId == m.Unit1Id),
                Unit2GamesWon = m.Matches.SelectMany(match => match.Games).Count(g => g.WinnerUnitId == m.Unit2Id)
            })
            .ToListAsync();

        // Group by round
        var rounds = matches
            .GroupBy(m => m.RoundNumber)
            .OrderBy(g => g.Key)
            .Select(g => new BracketRoundDto
            {
                RoundNumber = g.Key,
                RoundName = g.First().RoundName ?? $"Round {g.Key}",
                Matches = g.OrderBy(m => m.BracketPosition).ToList()
            })
            .ToList();

        return Ok(new ApiResponse<BracketDto>
        {
            Success = true,
            Data = new BracketDto
            {
                DivisionId = divisionId,
                DivisionName = division.Name,
                BracketType = division.BracketType,
                Rounds = rounds
            }
        });
    }

    /// <summary>
    /// Get pool play standings for a division
    /// </summary>
    [HttpGet("pools/{eventId}/{divisionId}")]
    public async Task<ActionResult<ApiResponse<PoolsDto>>> GetPools(int eventId, int divisionId)
    {
        var division = await _context.EventDivisions
            .FirstOrDefaultAsync(d => d.Id == divisionId && d.EventId == eventId);

        if (division == null)
            return NotFound(new ApiResponse<PoolsDto> { Success = false, Message = "Division not found" });

        var units = await _context.EventUnits
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled")
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .OrderBy(u => u.PoolNumber)
            .ThenByDescending(u => u.MatchesWon)
            .ThenByDescending(u => u.GamesWon - u.GamesLost)
            .ThenByDescending(u => u.PointsScored - u.PointsAgainst)
            .ToListAsync();

        var pools = units
            .GroupBy(u => u.PoolNumber ?? 0)
            .OrderBy(g => g.Key)
            .Select(g => new PoolDto
            {
                PoolNumber = g.Key,
                PoolName = g.First().PoolName ?? $"Pool {g.Key}",
                Units = g.Select((u, index) => new PoolUnitDto
                {
                    Rank = index + 1,
                    UnitId = u.Id,
                    UnitName = u.Name,
                    Players = u.Members
                        .Where(m => m.InviteStatus == "Accepted")
                        .Select(m => m.User!.FirstName + " " + m.User.LastName)
                        .ToList(),
                    MatchesPlayed = u.MatchesPlayed,
                    MatchesWon = u.MatchesWon,
                    MatchesLost = u.MatchesLost,
                    GamesWon = u.GamesWon,
                    GamesLost = u.GamesLost,
                    PointsFor = u.PointsScored,
                    PointsAgainst = u.PointsAgainst,
                    PointDiff = u.PointsScored - u.PointsAgainst,
                    AdvancedToPlayoff = u.AdvancedToPlayoff
                }).ToList()
            })
            .ToList();

        // Get pool matches
        var poolMatches = await _context.EventMatches
            .Where(m => m.DivisionId == divisionId && m.RoundType == "Pool")
            .Include(m => m.Unit1)
            .Include(m => m.Unit2)
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .OrderBy(m => m.RoundNumber)
            .ThenBy(m => m.EncounterNumber)
            .Select(m => new PoolMatchDto
            {
                MatchId = m.Id,
                PoolNumber = m.Unit1 != null ? m.Unit1.PoolNumber : null,
                Unit1Id = m.Unit1Id,
                Unit1Name = m.Unit1 != null ? m.Unit1.Name : null,
                Unit2Id = m.Unit2Id,
                Unit2Name = m.Unit2 != null ? m.Unit2.Name : null,
                Status = m.Status,
                WinnerUnitId = m.WinnerUnitId,
                Games = m.Matches.SelectMany(match => match.Games).OrderBy(g => g.GameNumber).Select(g => new ScoreboardGameDto
                {
                    GameNumber = g.GameNumber,
                    Unit1Score = g.Unit1Score,
                    Unit2Score = g.Unit2Score,
                    WinnerUnitId = g.WinnerUnitId,
                    Status = g.Status
                }).ToList()
            })
            .ToListAsync();

        return Ok(new ApiResponse<PoolsDto>
        {
            Success = true,
            Data = new PoolsDto
            {
                DivisionId = divisionId,
                DivisionName = division.Name,
                PoolCount = division.PoolCount,
                PlayoffFromPools = division.PlayoffFromPools,
                Pools = pools,
                Matches = poolMatches
            }
        });
    }
}

// DTOs for Scoreboard
public class ScoreboardDto
{
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public string EventStatus { get; set; } = string.Empty;
    public List<DivisionFilterDto> Divisions { get; set; } = new();
    public int TotalMatches { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
    public List<ScoreboardMatchDto> Matches { get; set; } = new();
}

public class DivisionFilterDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class ScoreboardMatchDto
{
    public int MatchId { get; set; }
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public string RoundType { get; set; } = string.Empty;
    public int RoundNumber { get; set; }
    public string? RoundName { get; set; }
    public int MatchNumber { get; set; }
    public int? BracketPosition { get; set; }
    public string Status { get; set; } = string.Empty;
    public int BestOf { get; set; }
    public int? Unit1Id { get; set; }
    public string? Unit1Name { get; set; }
    public int? Unit1Seed { get; set; }
    public int? Unit2Id { get; set; }
    public string? Unit2Name { get; set; }
    public int? Unit2Seed { get; set; }
    public int? WinnerUnitId { get; set; }
    public DateTime? ScheduledTime { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? CourtName { get; set; }
    public int? CourtNumber { get; set; }
    public List<ScoreboardGameDto> Games { get; set; } = new();
}

public class ScoreboardGameDto
{
    public int GameNumber { get; set; }
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public int? WinnerUnitId { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class LiveGameDto
{
    public int GameId { get; set; }
    public int MatchId { get; set; }
    public int GameNumber { get; set; }
    public string Status { get; set; } = string.Empty;
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public string Unit1Name { get; set; } = string.Empty;
    public string Unit2Name { get; set; } = string.Empty;
    public string DivisionName { get; set; } = string.Empty;
    public string? RoundName { get; set; }
    public string? CourtName { get; set; }
    public int? CourtNumber { get; set; }
    public DateTime? StartedAt { get; set; }
}

public class EventResultsDto
{
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public string EventStatus { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? VenueName { get; set; }
    public List<DivisionFilterDto> Divisions { get; set; } = new();
    public List<UnitResultDto> Standings { get; set; } = new();
}

public class UnitResultDto
{
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public List<string> Players { get; set; } = new();
    public int? PoolNumber { get; set; }
    public string? PoolName { get; set; }
    public int? PoolRank { get; set; }
    public int? OverallRank { get; set; }
    public int? FinalPlacement { get; set; }
    public bool AdvancedToPlayoff { get; set; }
    public int MatchesPlayed { get; set; }
    public int MatchesWon { get; set; }
    public int MatchesLost { get; set; }
    public int GamesWon { get; set; }
    public int GamesLost { get; set; }
    public int PointsFor { get; set; }
    public int PointsAgainst { get; set; }
    public int PointDiff { get; set; }
}

public class BracketDto
{
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public string? BracketType { get; set; }
    public List<BracketRoundDto> Rounds { get; set; } = new();
}

public class BracketRoundDto
{
    public int RoundNumber { get; set; }
    public string RoundName { get; set; } = string.Empty;
    public List<BracketMatchDto> Matches { get; set; } = new();
}

public class BracketMatchDto
{
    public int MatchId { get; set; }
    public int RoundNumber { get; set; }
    public string? RoundName { get; set; }
    public int BracketPosition { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? Unit1Id { get; set; }
    public string? Unit1Name { get; set; }
    public int? Unit1Seed { get; set; }
    public int? Unit2Id { get; set; }
    public string? Unit2Name { get; set; }
    public int? Unit2Seed { get; set; }
    public int? WinnerUnitId { get; set; }
    public int Unit1GamesWon { get; set; }
    public int Unit2GamesWon { get; set; }
}

public class PoolsDto
{
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public int? PoolCount { get; set; }
    public int? PlayoffFromPools { get; set; }
    public List<PoolDto> Pools { get; set; } = new();
    public List<PoolMatchDto> Matches { get; set; } = new();
}

public class PoolDto
{
    public int PoolNumber { get; set; }
    public string PoolName { get; set; } = string.Empty;
    public List<PoolUnitDto> Units { get; set; } = new();
}

public class PoolUnitDto
{
    public int Rank { get; set; }
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public List<string> Players { get; set; } = new();
    public int MatchesPlayed { get; set; }
    public int MatchesWon { get; set; }
    public int MatchesLost { get; set; }
    public int GamesWon { get; set; }
    public int GamesLost { get; set; }
    public int PointsFor { get; set; }
    public int PointsAgainst { get; set; }
    public int PointDiff { get; set; }
    public bool AdvancedToPlayoff { get; set; }
}

public class PoolMatchDto
{
    public int MatchId { get; set; }
    public int? PoolNumber { get; set; }
    public int? Unit1Id { get; set; }
    public string? Unit1Name { get; set; }
    public int? Unit2Id { get; set; }
    public string? Unit2Name { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? WinnerUnitId { get; set; }
    public List<ScoreboardGameDto> Games { get; set; } = new();
}
