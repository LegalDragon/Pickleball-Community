using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Hubs;
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
    private readonly IScoreBroadcaster _scoreBroadcaster;

    public EncounterController(ApplicationDbContext context, ILogger<EncounterController> logger, IScoreBroadcaster scoreBroadcaster)
    {
        _context = context;
        _logger = logger;
        _scoreBroadcaster = scoreBroadcaster;
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
        // Admins can manage any event
        if (User.IsInRole("Admin"))
            return true;
            
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
                    Code = f.Code,
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
                existingFormat.Code = formatDto.Code;
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
                    Code = formatDto.Code,
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
    [AllowAnonymous]
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
            DivisionMatchNumber = encounter.DivisionMatchNumber,
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
            Unit1LineupLocked = encounter.Unit1LineupLocked,
            Unit2LineupLocked = encounter.Unit2LineupLocked,
            Unit1LineupLockedAt = encounter.Unit1LineupLockedAt,
            Unit2LineupLockedAt = encounter.Unit2LineupLockedAt,
            BothLineupsLocked = encounter.Unit1LineupLocked && encounter.Unit2LineupLocked,
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
                            MatchId = g.EncounterMatchId,
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
                _context.EventGames.Add(new EventGame
                {
                    EncounterMatchId = match.Id,
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

        // Broadcast real-time updates
        try
        {
            await _scoreBroadcaster.BroadcastScheduleRefresh(encounter.EventId, encounter.DivisionId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast start encounter update for encounter {EncounterId}", encounterId);
        }

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

        // Auto-advance winner to next encounter (bracket progression)
        if (encounter.WinnerUnitId.HasValue && encounter.WinnerNextEncounterId.HasValue && encounter.WinnerSlotPosition.HasValue)
        {
            var nextEncounter = await _context.EventEncounters.FindAsync(encounter.WinnerNextEncounterId.Value);
            if (nextEncounter != null)
            {
                if (encounter.WinnerSlotPosition == 1)
                {
                    nextEncounter.Unit1Id = encounter.WinnerUnitId;
                    // Also resolve the slot if it exists
                    if (nextEncounter.Unit1SlotId.HasValue)
                    {
                        var slot = await _context.PhaseSlots.FindAsync(nextEncounter.Unit1SlotId.Value);
                        if (slot != null)
                        {
                            slot.UnitId = encounter.WinnerUnitId;
                            slot.IsResolved = true;
                            slot.ResolvedAt = DateTime.UtcNow;
                        }
                    }
                }
                else
                {
                    nextEncounter.Unit2Id = encounter.WinnerUnitId;
                    if (nextEncounter.Unit2SlotId.HasValue)
                    {
                        var slot = await _context.PhaseSlots.FindAsync(nextEncounter.Unit2SlotId.Value);
                        if (slot != null)
                        {
                            slot.UnitId = encounter.WinnerUnitId;
                            slot.IsResolved = true;
                            slot.ResolvedAt = DateTime.UtcNow;
                        }
                    }
                }
                nextEncounter.UpdatedAt = DateTime.UtcNow;
                _logger.LogInformation("Auto-advanced winner {WinnerId} from encounter {EncounterId} to encounter {NextEncounterId} slot {Slot}",
                    encounter.WinnerUnitId, encounter.Id, nextEncounter.Id, encounter.WinnerSlotPosition);
            }
        }

        // Auto-advance loser for double elimination brackets
        if (encounter.WinnerUnitId.HasValue && encounter.LoserNextEncounterId.HasValue && encounter.LoserSlotPosition.HasValue)
        {
            var loserUnitId = encounter.Unit1Id == encounter.WinnerUnitId ? encounter.Unit2Id : encounter.Unit1Id;
            if (loserUnitId.HasValue)
            {
                var loserNextEncounter = await _context.EventEncounters.FindAsync(encounter.LoserNextEncounterId.Value);
                if (loserNextEncounter != null)
                {
                    if (encounter.LoserSlotPosition == 1)
                    {
                        loserNextEncounter.Unit1Id = loserUnitId;
                        if (loserNextEncounter.Unit1SlotId.HasValue)
                        {
                            var slot = await _context.PhaseSlots.FindAsync(loserNextEncounter.Unit1SlotId.Value);
                            if (slot != null)
                            {
                                slot.UnitId = loserUnitId;
                                slot.IsResolved = true;
                                slot.ResolvedAt = DateTime.UtcNow;
                            }
                        }
                    }
                    else
                    {
                        loserNextEncounter.Unit2Id = loserUnitId;
                        if (loserNextEncounter.Unit2SlotId.HasValue)
                        {
                            var slot = await _context.PhaseSlots.FindAsync(loserNextEncounter.Unit2SlotId.Value);
                            if (slot != null)
                            {
                                slot.UnitId = loserUnitId;
                                slot.IsResolved = true;
                                slot.ResolvedAt = DateTime.UtcNow;
                            }
                        }
                    }
                    loserNextEncounter.UpdatedAt = DateTime.UtcNow;
                    _logger.LogInformation("Auto-advanced loser {LoserId} from encounter {EncounterId} to encounter {NextEncounterId} slot {Slot}",
                        loserUnitId, encounter.Id, loserNextEncounter.Id, encounter.LoserSlotPosition);
                }
            }
        }

        await _context.SaveChangesAsync();

        // Broadcast match completion
        try
        {
            await _scoreBroadcaster.BroadcastMatchCompleted(encounter.EventId, encounter.DivisionId, new MatchCompletedDto
            {
                EncounterId = encounter.Id,
                DivisionId = encounter.DivisionId,
                RoundType = encounter.RoundType ?? "",
                RoundName = encounter.RoundName ?? "",
                Unit1Id = encounter.Unit1Id,
                Unit2Id = encounter.Unit2Id,
                WinnerUnitId = encounter.WinnerUnitId,
                Score = $"{unit1Wins}-{unit2Wins}",
                CompletedAt = DateTime.UtcNow
            });
            await _scoreBroadcaster.BroadcastScheduleRefresh(encounter.EventId, encounter.DivisionId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast encounter completion for encounter {EncounterId}", encounterId);
        }

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

        // Broadcast real-time updates
        try
        {
            await _scoreBroadcaster.BroadcastScheduleRefresh(match.Encounter!.EventId, match.Encounter.DivisionId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast start match update for match {MatchId}", matchId);
        }

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

        // Broadcast score update
        try
        {
            await _scoreBroadcaster.BroadcastScheduleRefresh(match.Encounter!.EventId, match.Encounter.DivisionId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast match score submission for match {MatchId}", matchId);
        }

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

        // Broadcast updates
        try
        {
            if (dto.Confirmed && match.Status == "Completed")
            {
                await _scoreBroadcaster.BroadcastMatchCompleted(match.Encounter!.EventId, match.Encounter.DivisionId, new MatchCompletedDto
                {
                    EncounterId = match.EncounterId,
                    DivisionId = match.Encounter.DivisionId,
                    Unit1Id = match.Encounter.Unit1Id,
                    Unit2Id = match.Encounter.Unit2Id,
                    WinnerUnitId = match.WinnerUnitId,
                    Score = $"{match.Unit1Score}-{match.Unit2Score}",
                    CompletedAt = DateTime.UtcNow
                });
            }
            await _scoreBroadcaster.BroadcastScheduleRefresh(match.Encounter!.EventId, match.Encounter.DivisionId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast match score confirmation for match {MatchId}", matchId);
        }

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

        // Broadcast updates
        try
        {
            if (match.Status == "Completed" && match.WinnerUnitId.HasValue)
            {
                await _scoreBroadcaster.BroadcastMatchCompleted(match.Encounter!.EventId, match.Encounter.DivisionId, new MatchCompletedDto
                {
                    EncounterId = match.EncounterId,
                    DivisionId = match.Encounter.DivisionId,
                    Unit1Id = match.Encounter.Unit1Id,
                    Unit2Id = match.Encounter.Unit2Id,
                    WinnerUnitId = match.WinnerUnitId,
                    Score = $"{match.Unit1Score}-{match.Unit2Score}",
                    CompletedAt = DateTime.UtcNow
                });
            }
            await _scoreBroadcaster.BroadcastScheduleRefresh(match.Encounter!.EventId, match.Encounter.DivisionId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast match score update for match {MatchId}", matchId);
        }

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

        var game = await _context.EventGames
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
            .FirstOrDefaultAsync(g => g.Id == gameId);

        if (game == null)
            return NotFound(new { success = false, message = "Game not found" });

        game.Unit1Score = dto.Unit1Score;
        game.Unit2Score = dto.Unit2Score;

        if (dto.WinnerUnitId.HasValue)
            game.WinnerUnitId = dto.WinnerUnitId;
        else if (dto.Unit1Score > dto.Unit2Score)
            game.WinnerUnitId = game.EncounterMatch?.Encounter?.Unit1Id;
        else if (dto.Unit2Score > dto.Unit1Score)
            game.WinnerUnitId = game.EncounterMatch?.Encounter?.Unit2Id;

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
        var match = game.EncounterMatch;
        if (match != null)
        {
            var allGames = await _context.EventGames
                .Where(g => g.EncounterMatchId == match.Id)
                .ToListAsync();

            match.Unit1Score = allGames.Count(g => g.WinnerUnitId == match.Encounter?.Unit1Id);
            match.Unit2Score = allGames.Count(g => g.WinnerUnitId == match.Encounter?.Unit2Id);
            match.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        // Broadcast game score update
        try
        {
            var encounter = game.EncounterMatch?.Encounter;
            if (encounter != null)
            {
                await _scoreBroadcaster.BroadcastGameScoreUpdated(encounter.EventId, encounter.DivisionId, new GameScoreUpdateDto
                {
                    GameId = game.Id,
                    EncounterId = encounter.Id,
                    DivisionId = encounter.DivisionId,
                    GameNumber = game.GameNumber,
                    Unit1Score = game.Unit1Score,
                    Unit2Score = game.Unit2Score,
                    WinnerUnitId = game.WinnerUnitId,
                    Status = game.Status,
                    UpdatedAt = DateTime.UtcNow
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast game score update for game {GameId}", gameId);
        }

        return Ok(new { success = true, message = "Game score updated" });
    }

    // ==========================================
    // Lineup Locking
    // ==========================================

    /// <summary>
    /// Lock or unlock lineup for a unit in an encounter.
    /// Can be done by unit captain, event organizer, or admin.
    /// </summary>
    [HttpPost("{encounterId}/lineup-lock")]
    public async Task<IActionResult> ToggleLineupLock(int encounterId, [FromBody] LineupLockToggleDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var encounter = await _context.EventEncounters
            .Include(e => e.Unit1)
            .Include(e => e.Unit2)
            .Include(e => e.Event)
            .FirstOrDefaultAsync(e => e.Id == encounterId);

        if (encounter == null)
            return NotFound(new { success = false, message = "Encounter not found" });

        // Check authorization: must be organizer, admin, or captain of the unit
        var isOrganizer = encounter.Event?.OrganizedByUserId == userId.Value;
        var isAdmin = User.IsInRole("Admin");

        EventUnit? targetUnit = dto.UnitSide == 1 ? encounter.Unit1 : encounter.Unit2;
        if (targetUnit == null)
            return BadRequest(new { success = false, message = $"Unit {dto.UnitSide} not assigned to encounter" });

        var isCaptain = targetUnit.CaptainUserId == userId.Value;

        if (!isOrganizer && !isAdmin && !isCaptain)
            return Forbid();

        // Update lock status
        if (dto.UnitSide == 1)
        {
            encounter.Unit1LineupLocked = dto.Locked;
            encounter.Unit1LineupLockedAt = dto.Locked ? DateTime.UtcNow : null;
            encounter.Unit1LineupLockedByUserId = dto.Locked ? userId : null;
        }
        else
        {
            encounter.Unit2LineupLocked = dto.Locked;
            encounter.Unit2LineupLockedAt = dto.Locked ? DateTime.UtcNow : null;
            encounter.Unit2LineupLockedByUserId = dto.Locked ? userId : null;
        }

        encounter.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var result = new LineupLockResultDto
        {
            Success = true,
            Message = dto.Locked ? "Lineup locked successfully" : "Lineup unlocked successfully",
            Unit1LineupLocked = encounter.Unit1LineupLocked,
            Unit2LineupLocked = encounter.Unit2LineupLocked,
            BothLineupsLocked = encounter.Unit1LineupLocked && encounter.Unit2LineupLocked,
            Unit1LineupLockedAt = encounter.Unit1LineupLockedAt,
            Unit2LineupLockedAt = encounter.Unit2LineupLockedAt
        };

        return Ok(new { success = true, data = result });
    }

    /// <summary>
    /// Get lineup lock status for an encounter
    /// </summary>
    [HttpGet("{encounterId}/lineup-lock")]
    [AllowAnonymous]
    public async Task<IActionResult> GetLineupLockStatus(int encounterId)
    {
        var encounter = await _context.EventEncounters
            .Select(e => new
            {
                e.Id,
                e.Unit1LineupLocked,
                e.Unit2LineupLocked,
                e.Unit1LineupLockedAt,
                e.Unit2LineupLockedAt
            })
            .FirstOrDefaultAsync(e => e.Id == encounterId);

        if (encounter == null)
            return NotFound(new { success = false, message = "Encounter not found" });

        var result = new LineupLockResultDto
        {
            Success = true,
            Unit1LineupLocked = encounter.Unit1LineupLocked,
            Unit2LineupLocked = encounter.Unit2LineupLocked,
            BothLineupsLocked = encounter.Unit1LineupLocked && encounter.Unit2LineupLocked,
            Unit1LineupLockedAt = encounter.Unit1LineupLockedAt,
            Unit2LineupLockedAt = encounter.Unit2LineupLockedAt
        };

        return Ok(new { success = true, data = result });
    }

    // ==========================================
    // Phase Match Settings (Game Configuration per Phase)
    // ==========================================

    /// <summary>
    /// Get all game settings for a division (organized by phase and match format)
    /// </summary>
    [HttpGet("divisions/{divisionId}/game-settings")]
    public async Task<IActionResult> GetDivisionGameSettings(int divisionId)
    {
        var division = await _context.EventDivisions
            .Include(d => d.EncounterMatchFormats.Where(f => f.IsActive))
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new { success = false, message = "Division not found" });

        // Get phases with their settings
        var phases = await _context.DivisionPhases
            .Where(p => p.DivisionId == divisionId)
            .OrderBy(p => p.PhaseOrder)
            .ToListAsync();

        // Get all phase match settings for this division's phases using join to avoid EF Core Contains() issues
        var allSettings = await _context.PhaseMatchSettings
            .Include(s => s.MatchFormat)
            .Include(s => s.ScoreFormat)
            .Include(s => s.GameFormats)
                .ThenInclude(g => g.ScoreFormat)
            .Join(
                _context.DivisionPhases.Where(dp => dp.DivisionId == divisionId),
                pms => pms.PhaseId,
                dp => dp.Id,
                (pms, dp) => pms
            )
            .ToListAsync();

        // Get default score format
        var defaultScoreFormat = division.DefaultScoreFormatId.HasValue
            ? await _context.ScoreFormats.FindAsync(division.DefaultScoreFormatId.Value)
            : null;

        var dto = new DivisionGameSettingsDto
        {
            DivisionId = division.Id,
            DivisionName = division.Name,
            DefaultBestOf = division.MatchesPerEncounter <= 1 ? division.GamesPerMatch : null,
            DefaultScoreFormatId = division.DefaultScoreFormatId,
            DefaultScoreFormatName = defaultScoreFormat?.Name,
            MatchFormats = division.EncounterMatchFormats
                .OrderBy(f => f.SortOrder)
                .Select(f => new EncounterMatchFormatDto
                {
                    Id = f.Id,
                    DivisionId = f.DivisionId,
                    Name = f.Name,
                    Code = f.Code,
                    MatchNumber = f.MatchNumber,
                    MaleCount = f.MaleCount,
                    FemaleCount = f.FemaleCount,
                    UnisexCount = f.UnisexCount,
                    TotalPlayers = f.TotalPlayers,
                    BestOf = f.BestOf,
                    ScoreFormatId = f.ScoreFormatId,
                    SortOrder = f.SortOrder,
                    IsActive = f.IsActive
                }).ToList(),
            Phases = phases.Select(p => new PhaseGameSettingsDto
            {
                PhaseId = p.Id,
                PhaseName = p.Name,
                PhaseType = p.PhaseType,
                PhaseOrder = p.PhaseOrder,
                MatchSettings = allSettings
                    .Where(s => s.PhaseId == p.Id)
                    .Select(s => new PhaseMatchSettingsDto
                    {
                        Id = s.Id,
                        PhaseId = s.PhaseId,
                        PhaseName = p.Name,
                        MatchFormatId = s.MatchFormatId,
                        MatchFormatName = s.MatchFormat?.Name,
                        MatchFormatCode = s.MatchFormat?.Code,
                        BestOf = s.BestOf,
                        ScoreFormatId = s.ScoreFormatId,
                        ScoreFormatName = s.ScoreFormat?.Name,
                        GameFormats = s.GameFormats
                            .OrderBy(g => g.GameNumber)
                            .Select(g => new GameFormatDto
                            {
                                Id = g.Id,
                                GameNumber = g.GameNumber,
                                ScoreFormatId = g.ScoreFormatId,
                                ScoreFormatName = g.ScoreFormat?.Name,
                                EstimatedMinutes = g.EstimatedMinutes
                            }).ToList()
                    }).ToList()
            }).ToList()
        };

        return Ok(new { success = true, data = dto });
    }

    /// <summary>
    /// Update game settings for a phase (or create if not exists)
    /// </summary>
    [HttpPut("phases/{phaseId}/game-settings")]
    public async Task<IActionResult> UpdatePhaseGameSettings(int phaseId, [FromBody] List<PhaseMatchSettingsCreateDto> settings)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var phase = await _context.DivisionPhases
            .Include(p => p.Division)
                .ThenInclude(d => d!.Event)
            .FirstOrDefaultAsync(p => p.Id == phaseId);

        if (phase == null)
            return NotFound(new { success = false, message = "Phase not found" });

        if (!await IsEventOrganizer(phase.Division!.EventId, userId.Value))
            return Forbid();

        // Remove existing settings for this phase (cascade will delete GameFormats)
        var existingSettings = await _context.PhaseMatchSettings
            .Where(s => s.PhaseId == phaseId)
            .ToListAsync();
        _context.PhaseMatchSettings.RemoveRange(existingSettings);

        // Add new settings
        foreach (var dto in settings)
        {
            var setting = new PhaseMatchSettings
            {
                PhaseId = phaseId,
                MatchFormatId = dto.MatchFormatId,
                BestOf = dto.BestOf,
                ScoreFormatId = dto.ScoreFormatId
            };
            
            // Add per-game formats if provided
            if (dto.GameFormats?.Any() == true)
            {
                foreach (var gf in dto.GameFormats)
                {
                    setting.GameFormats.Add(new PhaseMatchGameFormat
                    {
                        GameNumber = gf.GameNumber,
                        ScoreFormatId = gf.ScoreFormatId,
                        EstimatedMinutes = gf.EstimatedMinutes
                    });
                }
            }
            
            _context.PhaseMatchSettings.Add(setting);
        }

        await _context.SaveChangesAsync();

        // Recalculate encounter durations for this phase based on new BestOf settings
        await RecalculateEncounterDurationsForPhaseAsync(phaseId, phase.Division!);

        return Ok(new { success = true, message = "Phase game settings updated" });
    }

    /// <summary>
    /// Recalculate estimated duration for all encounters in a phase based on BestOf settings
    /// </summary>
    private async Task RecalculateEncounterDurationsForPhaseAsync(int phaseId, EventDivision division)
    {
        var phase = await _context.DivisionPhases
            .Include(p => p.Division)
            .FirstOrDefaultAsync(p => p.Id == phaseId);
        
        if (phase == null) return;

        // Get phase match settings to find the BestOf
        var phaseSettings = await _context.PhaseMatchSettings
            .Where(s => s.PhaseId == phaseId)
            .ToListAsync();
        
        // Resolve effective BestOf: PhaseMatchSettings > Phase.BestOf > Division.GamesPerMatch > 1
        var phaseSetting = phaseSettings.FirstOrDefault();
        int bestOf;
        if (phaseSetting != null && phaseSetting.BestOf > 0)
            bestOf = phaseSetting.BestOf;
        else if (phase.BestOf.HasValue && phase.BestOf.Value > 0)
            bestOf = phase.BestOf.Value;
        else
            bestOf = division.GamesPerMatch > 0 ? division.GamesPerMatch : 1;

        // Base game duration (no buffer for multi-game matches)
        var gameDuration = phase.GameDurationMinutes 
            ?? phase.EstimatedMatchDurationMinutes 
            ?? division.EstimatedMatchDurationMinutes 
            ?? 20;

        // Calculate total duration: for BO3/BO5, just games × duration (no buffer)
        // For single game, add buffer
        var buffer = phase.MatchBufferMinutes ?? 5;
        var totalDuration = bestOf > 1 ? bestOf * gameDuration : gameDuration + buffer;

        // Update all encounters in this phase
        var encounters = await _context.EventEncounters
            .Where(e => e.PhaseId == phaseId)
            .ToListAsync();

        foreach (var enc in encounters)
        {
            enc.EstimatedDurationMinutes = totalDuration;
            enc.BestOf = bestOf;
            enc.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Bulk update game settings for all phases in a division
    /// </summary>
    [HttpPut("divisions/{divisionId}/game-settings")]
    public async Task<IActionResult> UpdateDivisionGameSettings(int divisionId, [FromBody] DivisionPhaseSettingsUpdateDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { success = false, message = "Unauthorized" });

        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new { success = false, message = "Division not found" });

        if (!await IsEventOrganizer(division.EventId, userId.Value))
            return Forbid();

        // Get all phases for this division
        var phaseIds = await _context.DivisionPhases
            .Where(p => p.DivisionId == divisionId)
            .Select(p => p.Id)
            .ToListAsync();

        var phaseIdSet = new HashSet<int>(phaseIds);

        // Remove existing settings for all phases using join to avoid EF Core Contains() issues
        var existingSettings = await _context.PhaseMatchSettings
            .Join(
                _context.DivisionPhases.Where(dp => dp.DivisionId == divisionId),
                pms => pms.PhaseId,
                dp => dp.Id,
                (pms, dp) => pms
            )
            .ToListAsync();
        _context.PhaseMatchSettings.RemoveRange(existingSettings);

        // Add new settings
        foreach (var settingDto in dto.Settings)
        {
            if (!phaseIdSet.Contains(settingDto.PhaseId))
                continue; // Skip if phase doesn't belong to this division

            var setting = new PhaseMatchSettings
            {
                PhaseId = settingDto.PhaseId,
                MatchFormatId = settingDto.MatchFormatId,
                BestOf = settingDto.BestOf,
                ScoreFormatId = settingDto.ScoreFormatId
            };
            
            // Add per-game formats if provided
            if (settingDto.GameFormats?.Any() == true)
            {
                foreach (var gf in settingDto.GameFormats)
                {
                    setting.GameFormats.Add(new PhaseMatchGameFormat
                    {
                        GameNumber = gf.GameNumber,
                        ScoreFormatId = gf.ScoreFormatId,
                        EstimatedMinutes = gf.EstimatedMinutes
                    });
                }
            }
            
            _context.PhaseMatchSettings.Add(setting);
        }

        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Division game settings updated" });
    }

    /// <summary>
    /// Get game settings for a specific phase
    /// </summary>
    [HttpGet("phases/{phaseId}/game-settings")]
    public async Task<IActionResult> GetPhaseGameSettings(int phaseId)
    {
        var phase = await _context.DivisionPhases
            .FirstOrDefaultAsync(p => p.Id == phaseId);

        if (phase == null)
            return NotFound(new { success = false, message = "Phase not found" });

        var settings = await _context.PhaseMatchSettings
            .Include(s => s.MatchFormat)
            .Include(s => s.ScoreFormat)
            .Include(s => s.GameFormats)
                .ThenInclude(g => g.ScoreFormat)
            .Where(s => s.PhaseId == phaseId)
            .ToListAsync();

        var dtos = settings.Select(s => new PhaseMatchSettingsDto
        {
            Id = s.Id,
            PhaseId = s.PhaseId,
            PhaseName = phase.Name,
            MatchFormatId = s.MatchFormatId,
            MatchFormatName = s.MatchFormat?.Name,
            MatchFormatCode = s.MatchFormat?.Code,
            BestOf = s.BestOf,
            ScoreFormatId = s.ScoreFormatId,
            ScoreFormatName = s.ScoreFormat?.Name,
            GameFormats = s.GameFormats
                .OrderBy(g => g.GameNumber)
                .Select(g => new GameFormatDto
                {
                    Id = g.Id,
                    GameNumber = g.GameNumber,
                    ScoreFormatId = g.ScoreFormatId,
                    ScoreFormatName = g.ScoreFormat?.Name,
                    EstimatedMinutes = g.EstimatedMinutes
                }).ToList()
        }).ToList();

        return Ok(new { success = true, data = dtos });
    }
}
