using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;
using System.Security.Claims;

namespace Pickleball.Community.API.Controllers;

/// <summary>
/// Controller for managing team league encounters and matches
/// </summary>
[ApiController]
[Route("encounters")]
[Authorize]
public class EncounterController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<EncounterController> _logger;

    public EncounterController(ApplicationDbContext context, ILogger<EncounterController> logger)
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
    // Division Encounter Configuration
    // ==========================================

    /// <summary>
    /// Get encounter configuration for a division
    /// </summary>
    [HttpGet("divisions/{divisionId}/config")]
    public async Task<IActionResult> GetDivisionEncounterConfig(int divisionId)
    {
        var division = await _context.EventDivisions
            .Include(d => d.EncounterMatchFormats.Where(f => f.IsActive))
                .ThenInclude(f => f.ScoreFormat)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new { success = false, message = "Division not found" });

        var config = new DivisionEncounterConfigDto
        {
            DivisionId = division.Id,
            DivisionName = division.Name,
            MatchesPerEncounter = division.MatchesPerEncounter,
            AllowPlayerReuseInEncounter = division.AllowPlayerReuseInEncounter,
            AllowLineupChangePerEncounter = division.AllowLineupChangePerEncounter,
            MatchFormats = division.EncounterMatchFormats
                .OrderBy(f => f.SortOrder)
                .Select(f => new EncounterMatchFormatDto
                {
                    Id = f.Id,
                    DivisionId = f.DivisionId,
                    Name = f.Name,
                    MatchNumber = f.MatchNumber,
                    MaleCount = f.MaleCount,
                    FemaleCount = f.FemaleCount,
                    UnisexCount = f.UnisexCount,
                    TotalPlayers = f.TotalPlayers,
                    BestOf = f.BestOf,
                    ScoreFormatId = f.ScoreFormatId,
                    ScoreFormatName = f.ScoreFormat?.Name,
                    SortOrder = f.SortOrder,
                    IsActive = f.IsActive
                }).ToList()
        };

        return Ok(new { success = true, data = config });
    }

    /// <summary>
    /// Update encounter configuration for a division
    /// </summary>
    [HttpPut("divisions/{divisionId}/config")]
    public async Task<IActionResult> UpdateDivisionEncounterConfig(int divisionId, [FromBody] DivisionEncounterConfigUpdateDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .Include(d => d.EncounterMatchFormats)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new { success = false, message = "Division not found" });

        if (!await IsEventOrganizer(division.EventId, userId.Value))
            return Forbid();

        // Update division configuration
        division.MatchesPerEncounter = dto.MatchesPerEncounter ?? 1;
        division.AllowPlayerReuseInEncounter = dto.AllowPlayerReuseInEncounter;
        division.AllowLineupChangePerEncounter = dto.AllowLineupChangePerEncounter;
        division.UpdatedAt = DateTime.UtcNow;

        // Deactivate existing formats
        foreach (var format in division.EncounterMatchFormats)
        {
            format.IsActive = false;
            format.UpdatedAt = DateTime.UtcNow;
        }

        // Add/update formats
        foreach (var formatDto in dto.MatchFormats)
        {
            var existingFormat = division.EncounterMatchFormats
                .FirstOrDefault(f => f.MatchNumber == formatDto.MatchNumber);

            if (existingFormat != null)
            {
                existingFormat.Name = formatDto.Name;
                existingFormat.MaleCount = formatDto.MaleCount;
                existingFormat.FemaleCount = formatDto.FemaleCount;
                existingFormat.UnisexCount = formatDto.UnisexCount;
                existingFormat.BestOf = formatDto.BestOf;
                existingFormat.ScoreFormatId = formatDto.ScoreFormatId;
                existingFormat.SortOrder = formatDto.SortOrder;
                existingFormat.IsActive = true;
                existingFormat.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                division.EncounterMatchFormats.Add(new EncounterMatchFormat
                {
                    DivisionId = divisionId,
                    Name = formatDto.Name,
                    MatchNumber = formatDto.MatchNumber,
                    MaleCount = formatDto.MaleCount,
                    FemaleCount = formatDto.FemaleCount,
                    UnisexCount = formatDto.UnisexCount,
                    BestOf = formatDto.BestOf,
                    ScoreFormatId = formatDto.ScoreFormatId,
                    SortOrder = formatDto.SortOrder,
                    IsActive = true
                });
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Encounter configuration updated" });
    }

    // ==========================================
    // Encounters
    // ==========================================

    /// <summary>
    /// Get encounters for an event
    /// </summary>
    [HttpGet("events/{eventId}")]
    public async Task<IActionResult> GetEventEncounters(int eventId, [FromQuery] int? divisionId = null)
    {
        var query = _context.EventEncounters
            .Include(e => e.Unit1)
            .Include(e => e.Unit2)
            .Include(e => e.TournamentCourt)
            .Include(e => e.Matches)
            .Where(e => e.EventId == eventId);

        if (divisionId.HasValue)
        {
            query = query.Where(e => e.DivisionId == divisionId.Value);
        }

        var encounters = await query
            .OrderBy(e => e.RoundNumber)
            .ThenBy(e => e.EncounterNumber)
            .ToListAsync();

        var dtos = encounters.Select(e => new EventEncounterSummaryDto
        {
            Id = e.Id,
            EventId = e.EventId,
            DivisionId = e.DivisionId,
            RoundType = e.RoundType,
            RoundNumber = e.RoundNumber,
            RoundName = e.RoundName,
            EncounterNumber = e.EncounterNumber,
            Unit1Id = e.Unit1Id,
            Unit1Name = e.Unit1?.Name,
            Unit2Id = e.Unit2Id,
            Unit2Name = e.Unit2?.Name,
            Unit1EncounterScore = e.Unit1EncounterScore,
            Unit2EncounterScore = e.Unit2EncounterScore,
            WinnerUnitId = e.WinnerUnitId,
            Status = e.Status,
            ScheduledTime = e.ScheduledTime,
            CourtLabel = e.TournamentCourt?.CourtLabel,
            MatchCount = e.Matches.Count,
            CompletedMatchCount = e.Matches.Count(m => m.Status == "Completed")
        }).ToList();

        return Ok(new { success = true, data = dtos });
    }

    /// <summary>
    /// Get encounter details
    /// </summary>
    [HttpGet("{encounterId}")]
    public async Task<IActionResult> GetEncounter(int encounterId)
    {
        var encounter = await _context.EventEncounters
            .Include(e => e.Division)
            .Include(e => e.Unit1)
                .ThenInclude(u => u!.Members)
                    .ThenInclude(m => m.User)
            .Include(e => e.Unit2)
                .ThenInclude(u => u!.Members)
                    .ThenInclude(m => m.User)
            .Include(e => e.TournamentCourt)
            .Include(e => e.Matches)
                .ThenInclude(m => m.Format)
            .Include(e => e.Matches)
                .ThenInclude(m => m.Players)
                    .ThenInclude(p => p.User)
            .Include(e => e.Matches)
                .ThenInclude(m => m.Games)
            .Include(e => e.Matches)
                .ThenInclude(m => m.TournamentCourt)
            .FirstOrDefaultAsync(e => e.Id == encounterId);

        if (encounter == null)
            return NotFound(new { success = false, message = "Encounter not found" });

        var dto = new EventEncounterDetailDto
        {
            Id = encounter.Id,
            EventId = encounter.EventId,
            DivisionId = encounter.DivisionId,
            DivisionName = encounter.Division?.Name,
            RoundType = encounter.RoundType,
            RoundNumber = encounter.RoundNumber,
            RoundName = encounter.RoundName,
            EncounterNumber = encounter.EncounterNumber,
            Unit1Number = encounter.Unit1Number,
            Unit2Number = encounter.Unit2Number,
            Unit1Id = encounter.Unit1Id,
            Unit1Name = encounter.Unit1?.Name,
            Unit2Id = encounter.Unit2Id,
            Unit2Name = encounter.Unit2?.Name,
            Unit1EncounterScore = encounter.Unit1EncounterScore,
            Unit2EncounterScore = encounter.Unit2EncounterScore,
            WinnerUnitId = encounter.WinnerUnitId,
            Status = encounter.Status,
            ScheduledTime = encounter.ScheduledTime,
            StartedAt = encounter.StartedAt,
            CompletedAt = encounter.CompletedAt,
            TournamentCourtId = encounter.TournamentCourtId,
            CourtLabel = encounter.TournamentCourt?.CourtLabel,
            Notes = encounter.Notes,
            CreatedAt = encounter.CreatedAt,
            UpdatedAt = encounter.UpdatedAt,
            Matches = encounter.Matches
                .OrderBy(m => m.Format?.SortOrder ?? 0)
                .Select(m => new EncounterMatchDto
                {
                    Id = m.Id,
                    EncounterId = m.EncounterId,
                    FormatId = m.FormatId,
                    FormatName = m.Format?.Name ?? "Unknown",
                    MaleCount = m.Format?.MaleCount ?? 0,
                    FemaleCount = m.Format?.FemaleCount ?? 0,
                    UnisexCount = m.Format?.UnisexCount ?? 0,
                    Unit1Score = m.Unit1Score,
                    Unit2Score = m.Unit2Score,
                    Unit1HandicapPoints = m.Unit1HandicapPoints,
                    Unit2HandicapPoints = m.Unit2HandicapPoints,
                    WinnerUnitId = m.WinnerUnitId,
                    Status = m.Status,
                    TournamentCourtId = m.TournamentCourtId,
                    CourtLabel = m.TournamentCourt?.CourtLabel,
                    ScheduledTime = m.ScheduledTime,
                    StartedAt = m.StartedAt,
                    CompletedAt = m.CompletedAt,
                    ScoreSubmittedByUnitId = m.ScoreSubmittedByUnitId,
                    ScoreSubmittedAt = m.ScoreSubmittedAt,
                    ScoreConfirmedByUnitId = m.ScoreConfirmedByUnitId,
                    ScoreConfirmedAt = m.ScoreConfirmedAt,
                    IsScoreDisputed = m.ScoreDisputedAt.HasValue,
                    ScoreDisputeReason = m.ScoreDisputeReason,
                    Notes = m.Notes,
                    Unit1Players = m.Players
                        .Where(p => p.UnitSide == 1)
                        .Select(p => new EncounterMatchPlayerDto
                        {
                            Id = p.Id,
                            UserId = p.UserId,
                            Name = $"{p.User?.FirstName} {p.User?.LastName}".Trim(),
                            ProfileImageUrl = p.User?.ProfileImageUrl,
                            UnitId = p.UnitId,
                            UnitSide = p.UnitSide,
                            Gender = p.Gender,
                            Position = p.Position
                        }).ToList(),
                    Unit2Players = m.Players
                        .Where(p => p.UnitSide == 2)
                        .Select(p => new EncounterMatchPlayerDto
                        {
                            Id = p.Id,
                            UserId = p.UserId,
                            Name = $"{p.User?.FirstName} {p.User?.LastName}".Trim(),
                            ProfileImageUrl = p.User?.ProfileImageUrl,
                            UnitId = p.UnitId,
                            UnitSide = p.UnitSide,
                            Gender = p.Gender,
                            Position = p.Position
                        }).ToList(),
                    Games = m.Games
                        .OrderBy(g => g.GameNumber)
                        .Select(g => new EncounterMatchGameDto
                        {
                            Id = g.Id,
                            MatchId = g.MatchId,
                            GameNumber = g.GameNumber,
                            Unit1Score = g.Unit1Score,
                            Unit2Score = g.Unit2Score,
                            WinnerUnitId = g.WinnerUnitId,
                            Status = g.Status,
                            ScoreFormatId = g.ScoreFormatId,
                            TournamentCourtId = g.TournamentCourtId,
                            StartedAt = g.StartedAt,
                            FinishedAt = g.FinishedAt
                        }).ToList()
                }).ToList(),
            Unit1Roster = encounter.Unit1?.Members
                .Where(m => m.InviteStatus == "Accepted")
                .Select(m => new EncounterUnitRosterDto
                {
                    UserId = m.UserId,
                    Name = $"{m.User?.FirstName} {m.User?.LastName}".Trim(),
                    ProfileImageUrl = m.User?.ProfileImageUrl,
                    Gender = m.User?.Gender,
                    IsCheckedIn = m.IsCheckedIn
                }).ToList() ?? new List<EncounterUnitRosterDto>(),
            Unit2Roster = encounter.Unit2?.Members
                .Where(m => m.InviteStatus == "Accepted")
                .Select(m => new EncounterUnitRosterDto
                {
                    UserId = m.UserId,
                    Name = $"{m.User?.FirstName} {m.User?.LastName}".Trim(),
                    ProfileImageUrl = m.User?.ProfileImageUrl,
                    Gender = m.User?.Gender,
                    IsCheckedIn = m.IsCheckedIn
                }).ToList() ?? new List<EncounterUnitRosterDto>()
        };

        return Ok(new { success = true, data = dto });
    }

    /// <summary>
    /// Create an encounter
    /// </summary>
    [HttpPost("events/{eventId}")]
    public async Task<IActionResult> CreateEncounter(int eventId, [FromBody] EventEncounterCreateDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        if (!await IsEventOrganizer(eventId, userId.Value))
            return Forbid();

        var division = await _context.EventDivisions
            .Include(d => d.EncounterMatchFormats.Where(f => f.IsActive))
            .FirstOrDefaultAsync(d => d.Id == dto.DivisionId && d.EventId == eventId);

        if (division == null)
            return NotFound(new { success = false, message = "Division not found" });

        var encounter = new EventEncounter
        {
            EventId = eventId,
            DivisionId = dto.DivisionId,
            RoundType = dto.RoundType,
            RoundNumber = dto.RoundNumber,
            RoundName = dto.RoundName,
            EncounterNumber = dto.EncounterNumber,
            Unit1Number = dto.Unit1Number,
            Unit2Number = dto.Unit2Number,
            Unit1Id = dto.Unit1Id,
            Unit2Id = dto.Unit2Id,
            ScheduledTime = dto.ScheduledTime,
            TournamentCourtId = dto.TournamentCourtId,
            Notes = dto.Notes
        };

        _context.EventEncounters.Add(encounter);
        await _context.SaveChangesAsync();

        // Auto-create matches based on the division's encounter match formats
        foreach (var format in division.EncounterMatchFormats.OrderBy(f => f.SortOrder))
        {
            var match = new EncounterMatch
            {
                EncounterId = encounter.Id,
                FormatId = format.Id
            };
            _context.EncounterMatches.Add(match);

            // If best-of > 1, create game records
            for (int i = 1; i <= format.BestOf; i++)
            {
                _context.EncounterMatchGames.Add(new EncounterMatchGame
                {
                    MatchId = match.Id,
                    GameNumber = i,
                    ScoreFormatId = format.ScoreFormatId
                });
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new { success = true, data = new { id = encounter.Id }, message = "Encounter created" });
    }

    /// <summary>
    /// Update an encounter
    /// </summary>
    [HttpPut("{encounterId}")]
    public async Task<IActionResult> UpdateEncounter(int encounterId, [FromBody] EventEncounterUpdateDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var encounter = await _context.EventEncounters.FindAsync(encounterId);
        if (encounter == null)
            return NotFound(new { success = false, message = "Encounter not found" });

        if (!await IsEventOrganizer(encounter.EventId, userId.Value))
            return Forbid();

        if (dto.RoundName != null)
            encounter.RoundName = dto.RoundName;
        if (dto.Unit1Id.HasValue)
            encounter.Unit1Id = dto.Unit1Id;
        if (dto.Unit2Id.HasValue)
            encounter.Unit2Id = dto.Unit2Id;
        if (dto.ScheduledTime.HasValue)
            encounter.ScheduledTime = dto.ScheduledTime;
        if (dto.TournamentCourtId.HasValue)
            encounter.TournamentCourtId = dto.TournamentCourtId;
        if (dto.Notes != null)
            encounter.Notes = dto.Notes;

        encounter.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Encounter updated" });
    }

    /// <summary>
    /// Start an encounter
    /// </summary>
    [HttpPost("{encounterId}/start")]
    public async Task<IActionResult> StartEncounter(int encounterId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var encounter = await _context.EventEncounters.FindAsync(encounterId);
        if (encounter == null)
            return NotFound(new { success = false, message = "Encounter not found" });

        if (!await IsEventOrganizer(encounter.EventId, userId.Value))
            return Forbid();

        encounter.Status = "InProgress";
        encounter.StartedAt = DateTime.UtcNow;
        encounter.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Encounter started" });
    }

    /// <summary>
    /// Complete an encounter
    /// </summary>
    [HttpPost("{encounterId}/complete")]
    public async Task<IActionResult> CompleteEncounter(int encounterId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var encounter = await _context.EventEncounters
            .Include(e => e.Matches)
            .FirstOrDefaultAsync(e => e.Id == encounterId);

        if (encounter == null)
            return NotFound(new { success = false, message = "Encounter not found" });

        if (!await IsEventOrganizer(encounter.EventId, userId.Value))
            return Forbid();

        // Calculate encounter scores from match wins
        var unit1Wins = encounter.Matches.Count(m => m.WinnerUnitId == encounter.Unit1Id);
        var unit2Wins = encounter.Matches.Count(m => m.WinnerUnitId == encounter.Unit2Id);

        encounter.Unit1EncounterScore = unit1Wins;
        encounter.Unit2EncounterScore = unit2Wins;

        // Determine winner
        if (unit1Wins > unit2Wins)
            encounter.WinnerUnitId = encounter.Unit1Id;
        else if (unit2Wins > unit1Wins)
            encounter.WinnerUnitId = encounter.Unit2Id;

        encounter.Status = "Completed";
        encounter.CompletedAt = DateTime.UtcNow;
        encounter.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Encounter completed" });
    }

    // ==========================================
    // Encounter Matches
    // ==========================================

    /// <summary>
    /// Assign players to an encounter match
    /// </summary>
    [HttpPut("matches/{matchId}/players")]
    public async Task<IActionResult> AssignMatchPlayers(int matchId, [FromBody] EncounterMatchPlayersUpdateDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var match = await _context.EncounterMatches
            .Include(m => m.Encounter)
            .Include(m => m.Players)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null)
            return NotFound(new { success = false, message = "Match not found" });

        if (!await IsEventOrganizer(match.Encounter!.EventId, userId.Value))
            return Forbid();

        // Remove existing players
        _context.EncounterMatchPlayers.RemoveRange(match.Players);

        // Add new players
        foreach (var playerDto in dto.Players)
        {
            var user = await _context.Users.FindAsync(playerDto.UserId);
            var unitId = playerDto.UnitSide == 1 ? match.Encounter.Unit1Id : match.Encounter.Unit2Id;

            if (unitId.HasValue)
            {
                match.Players.Add(new EncounterMatchPlayer
                {
                    MatchId = matchId,
                    UserId = playerDto.UserId,
                    UnitId = unitId.Value,
                    UnitSide = playerDto.UnitSide,
                    Gender = user?.Gender,
                    Position = playerDto.Position
                });
            }
        }

        match.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Players assigned" });
    }

    /// <summary>
    /// Start a match
    /// </summary>
    [HttpPost("matches/{matchId}/start")]
    public async Task<IActionResult> StartMatch(int matchId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var match = await _context.EncounterMatches
            .Include(m => m.Encounter)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null)
            return NotFound(new { success = false, message = "Match not found" });

        if (!await IsEventOrganizer(match.Encounter!.EventId, userId.Value))
            return Forbid();

        match.Status = "InProgress";
        match.StartedAt = DateTime.UtcNow;
        match.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Match started" });
    }

    /// <summary>
    /// Submit match score
    /// </summary>
    [HttpPost("matches/{matchId}/score/submit")]
    public async Task<IActionResult> SubmitMatchScore(int matchId, [FromBody] EncounterMatchScoreSubmitDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var match = await _context.EncounterMatches
            .Include(m => m.Encounter)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null)
            return NotFound(new { success = false, message = "Match not found" });

        match.Unit1Score = dto.Unit1Score;
        match.Unit2Score = dto.Unit2Score;
        match.ScoreSubmittedByUnitId = dto.SubmittingUnitId;
        match.ScoreSubmittedAt = DateTime.UtcNow;
        match.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Score submitted" });
    }

    /// <summary>
    /// Confirm or dispute match score
    /// </summary>
    [HttpPost("matches/{matchId}/score/confirm")]
    public async Task<IActionResult> ConfirmMatchScore(int matchId, [FromBody] EncounterMatchScoreConfirmDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var match = await _context.EncounterMatches
            .Include(m => m.Encounter)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null)
            return NotFound(new { success = false, message = "Match not found" });

        if (dto.Confirmed)
        {
            match.ScoreConfirmedByUnitId = dto.ConfirmingUnitId;
            match.ScoreConfirmedAt = DateTime.UtcNow;

            // Determine winner based on scores
            if (match.Unit1Score > match.Unit2Score)
                match.WinnerUnitId = match.Encounter?.Unit1Id;
            else if (match.Unit2Score > match.Unit1Score)
                match.WinnerUnitId = match.Encounter?.Unit2Id;

            match.Status = "Completed";
            match.CompletedAt = DateTime.UtcNow;
        }
        else
        {
            match.ScoreDisputedAt = DateTime.UtcNow;
            match.ScoreDisputeReason = dto.DisputeReason;
        }

        match.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = dto.Confirmed ? "Score confirmed" : "Score disputed" });
    }

    /// <summary>
    /// Update match score (organizer override)
    /// </summary>
    [HttpPut("matches/{matchId}/score")]
    public async Task<IActionResult> UpdateMatchScore(int matchId, [FromBody] EncounterMatchScoreUpdateDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var match = await _context.EncounterMatches
            .Include(m => m.Encounter)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null)
            return NotFound(new { success = false, message = "Match not found" });

        if (!await IsEventOrganizer(match.Encounter!.EventId, userId.Value))
            return Forbid();

        match.Unit1Score = dto.Unit1Score;
        match.Unit2Score = dto.Unit2Score;

        if (dto.WinnerUnitId.HasValue)
            match.WinnerUnitId = dto.WinnerUnitId;
        else if (dto.Unit1Score > dto.Unit2Score)
            match.WinnerUnitId = match.Encounter?.Unit1Id;
        else if (dto.Unit2Score > dto.Unit1Score)
            match.WinnerUnitId = match.Encounter?.Unit2Id;

        if (match.WinnerUnitId.HasValue && match.Status != "Completed")
        {
            match.Status = "Completed";
            match.CompletedAt = DateTime.UtcNow;
        }

        match.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Match score updated" });
    }

    // ==========================================
    // Encounter Match Games
    // ==========================================

    /// <summary>
    /// Update game score
    /// </summary>
    [HttpPut("games/{gameId}/score")]
    public async Task<IActionResult> UpdateGameScore(int gameId, [FromBody] EncounterMatchGameScoreUpdateDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var game = await _context.EncounterMatchGames
            .Include(g => g.Match)
                .ThenInclude(m => m!.Encounter)
            .FirstOrDefaultAsync(g => g.Id == gameId);

        if (game == null)
            return NotFound(new { success = false, message = "Game not found" });

        game.Unit1Score = dto.Unit1Score;
        game.Unit2Score = dto.Unit2Score;

        if (dto.WinnerUnitId.HasValue)
            game.WinnerUnitId = dto.WinnerUnitId;
        else if (dto.Unit1Score > dto.Unit2Score)
            game.WinnerUnitId = game.Match?.Encounter?.Unit1Id;
        else if (dto.Unit2Score > dto.Unit1Score)
            game.WinnerUnitId = game.Match?.Encounter?.Unit2Id;

        if (!string.IsNullOrEmpty(dto.Status))
            game.Status = dto.Status;

        if (game.WinnerUnitId.HasValue && game.Status != "Completed")
        {
            game.Status = "Completed";
            game.FinishedAt = DateTime.UtcNow;
        }

        game.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Update match score based on game wins
        var match = game.Match;
        if (match != null)
        {
            var allGames = await _context.EncounterMatchGames
                .Where(g => g.MatchId == match.Id)
                .ToListAsync();

            match.Unit1Score = allGames.Count(g => g.WinnerUnitId == match.Encounter?.Unit1Id);
            match.Unit2Score = allGames.Count(g => g.WinnerUnitId == match.Encounter?.Unit2Id);
            match.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        return Ok(new { success = true, message = "Game score updated" });
    }
}
