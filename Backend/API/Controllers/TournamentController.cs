using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class TournamentController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TournamentController> _logger;

    public TournamentController(ApplicationDbContext context, ILogger<TournamentController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
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

    // ============================================
    // Event Registration with Divisions
    // ============================================

    [HttpGet("events/{eventId}/details")]
    public async Task<ActionResult<ApiResponse<EventDetailWithDivisionsDto>>> GetEventDetails(int eventId)
    {
        var userId = GetUserId();

        var evt = await _context.Events
            .Include(e => e.EventType)
            .Include(e => e.Divisions)
                .ThenInclude(d => d.TeamUnit)
            .Include(e => e.Divisions)
                .ThenInclude(d => d.SkillLevel)
            .Include(e => e.Divisions)
                .ThenInclude(d => d.AgeGroupEntity)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new ApiResponse<EventDetailWithDivisionsDto> { Success = false, Message = "Event not found" });

        // Get registration counts per division
        var registrationCounts = await _context.EventUnits
            .Where(u => u.EventId == eventId)
            .GroupBy(u => new { u.DivisionId, u.Status })
            .Select(g => new { g.Key.DivisionId, g.Key.Status, Count = g.Count() })
            .ToListAsync();

        // Get user's registrations
        var userRegistrations = userId.HasValue
            ? await _context.EventUnitMembers
                .Where(m => m.User!.Id == userId && m.Unit!.EventId == eventId && m.InviteStatus == "Accepted")
                .Select(m => m.Unit!.DivisionId)
                .ToListAsync()
            : new List<int>();

        // Get units looking for partners (incomplete doubles/team units)
        var lookingForPartner = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Where(u => u.EventId == eventId && u.Status == "Registered")
            .ToListAsync();

        var incompleteUnits = lookingForPartner
            .Where(u => u.Division?.TeamUnit != null &&
                        u.Members.Count(m => m.InviteStatus == "Accepted") < u.Division.TeamUnit.TotalPlayers)
            .GroupBy(u => u.DivisionId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var now = DateTime.UtcNow;
        var isRegistrationOpen = evt.TournamentStatus == "RegistrationOpen" ||
            (evt.RegistrationOpenDate <= now && (evt.RegistrationCloseDate == null || evt.RegistrationCloseDate > now));

        var dto = new EventDetailWithDivisionsDto
        {
            Id = evt.Id,
            Name = evt.Name,
            Description = evt.Description,
            EventTypeId = evt.EventTypeId,
            EventTypeName = evt.EventType?.Name,
            EventTypeIcon = evt.EventType?.Icon,
            EventTypeColor = evt.EventType?.Color,
            StartDate = evt.StartDate,
            EndDate = evt.EndDate,
            RegistrationOpenDate = evt.RegistrationOpenDate,
            RegistrationCloseDate = evt.RegistrationCloseDate,
            TournamentStatus = evt.TournamentStatus,
            IsRegistrationOpen = isRegistrationOpen,
            VenueName = evt.VenueName,
            Address = evt.Address,
            City = evt.City,
            State = evt.State,
            RegistrationFee = evt.RegistrationFee,
            PerDivisionFee = evt.PerDivisionFee,
            PosterImageUrl = evt.PosterImageUrl,
            UserRegisteredDivisionIds = userRegistrations,
            Divisions = evt.Divisions.Where(d => d.IsActive).OrderBy(d => d.SortOrder).Select(d =>
            {
                var regCount = registrationCounts
                    .Where(r => r.DivisionId == d.Id && r.Status != "Cancelled" && r.Status != "Waitlisted")
                    .Sum(r => r.Count);
                var waitlistCount = registrationCounts
                    .Where(r => r.DivisionId == d.Id && r.Status == "Waitlisted")
                    .Sum(r => r.Count);

                return new EventDivisionDetailDto
                {
                    Id = d.Id,
                    Name = d.Name,
                    Description = d.Description,
                    TeamUnitId = d.TeamUnitId,
                    TeamUnitName = d.TeamUnit?.Name,
                    TeamSize = d.TeamUnit?.TotalPlayers ?? d.TeamSize,
                    SkillLevelName = d.SkillLevel?.Name,
                    AgeGroupName = d.AgeGroupEntity?.Name,
                    DivisionFee = d.DivisionFee,
                    MaxUnits = d.MaxUnits,
                    RegisteredUnits = regCount,
                    WaitlistedCount = waitlistCount,
                    IsFull = d.MaxUnits.HasValue && regCount >= d.MaxUnits.Value,
                    LookingForPartner = incompleteUnits.ContainsKey(d.Id)
                        ? incompleteUnits[d.Id].Select(u => MapToUnitDto(u)).ToList()
                        : new List<EventUnitDto>()
                };
            }).ToList()
        };

        return Ok(new ApiResponse<EventDetailWithDivisionsDto> { Success = true, Data = dto });
    }

    [Authorize]
    [HttpPost("events/{eventId}/register")]
    public async Task<ActionResult<ApiResponse<List<EventUnitDto>>>> RegisterForEvent(int eventId, [FromBody] EventRegistrationRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<List<EventUnitDto>> { Success = false, Message = "Unauthorized" });

        var evt = await _context.Events
            .Include(e => e.Divisions)
                .ThenInclude(d => d.TeamUnit)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new ApiResponse<List<EventUnitDto>> { Success = false, Message = "Event not found" });

        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null)
            return NotFound(new ApiResponse<List<EventUnitDto>> { Success = false, Message = "User not found" });

        var createdUnits = new List<EventUnit>();

        foreach (var divisionId in request.DivisionIds)
        {
            var division = evt.Divisions.FirstOrDefault(d => d.Id == divisionId);
            if (division == null) continue;

            // Check if already registered
            var existingMember = await _context.EventUnitMembers
                .Include(m => m.Unit)
                .FirstOrDefaultAsync(m => m.UserId == userId.Value &&
                    m.Unit!.DivisionId == divisionId &&
                    m.Unit.EventId == eventId &&
                    m.InviteStatus == "Accepted");

            if (existingMember != null) continue;

            var teamSize = division.TeamUnit?.TotalPlayers ?? division.TeamSize;
            var isSingles = teamSize == 1;

            // Check capacity
            var currentCount = await _context.EventUnits
                .CountAsync(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted");

            var isWaitlisted = division.MaxUnits.HasValue && currentCount >= division.MaxUnits.Value;

            // Create unit
            var unitName = isSingles
                ? $"{user.FirstName} {user.LastName}"
                : $"{user.FirstName}'s Team";

            var unit = new EventUnit
            {
                EventId = eventId,
                DivisionId = divisionId,
                Name = unitName,
                Status = isWaitlisted ? "Waitlisted" : "Registered",
                WaitlistPosition = isWaitlisted ? await GetNextWaitlistPosition(divisionId) : null,
                CaptainUserId = userId.Value,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.EventUnits.Add(unit);
            await _context.SaveChangesAsync();

            // Add captain as member
            var member = new EventUnitMember
            {
                UnitId = unit.Id,
                UserId = userId.Value,
                Role = "Captain",
                InviteStatus = "Accepted",
                CreatedAt = DateTime.UtcNow
            };
            _context.EventUnitMembers.Add(member);

            // If partner specified, invite them
            if (!isSingles && request.PartnerUserId.HasValue)
            {
                var partnerMember = new EventUnitMember
                {
                    UnitId = unit.Id,
                    UserId = request.PartnerUserId.Value,
                    Role = "Player",
                    InviteStatus = "Pending",
                    InvitedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };
                _context.EventUnitMembers.Add(partnerMember);
            }

            await _context.SaveChangesAsync();
            createdUnits.Add(unit);
        }

        // Reload with members
        var unitIds = createdUnits.Select(u => u.Id).ToList();
        var units = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Where(u => unitIds.Contains(u.Id))
            .ToListAsync();

        return Ok(new ApiResponse<List<EventUnitDto>>
        {
            Success = true,
            Data = units.Select(MapToUnitDto).ToList()
        });
    }

    // ============================================
    // Unit Management
    // ============================================

    [HttpGet("events/{eventId}/units")]
    public async Task<ActionResult<ApiResponse<List<EventUnitDto>>>> GetEventUnits(int eventId, [FromQuery] int? divisionId = null)
    {
        var query = _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Captain)
            .Where(u => u.EventId == eventId && u.Status != "Cancelled");

        if (divisionId.HasValue)
            query = query.Where(u => u.DivisionId == divisionId.Value);

        var units = await query.OrderBy(u => u.WaitlistPosition ?? 0).ThenBy(u => u.CreatedAt).ToListAsync();

        return Ok(new ApiResponse<List<EventUnitDto>>
        {
            Success = true,
            Data = units.Select(MapToUnitDto).ToList()
        });
    }

    [Authorize]
    [HttpPost("units/{unitId}/join-request")]
    public async Task<ActionResult<ApiResponse<UnitJoinRequestDto>>> RequestToJoinUnit(int unitId, [FromBody] JoinUnitRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<UnitJoinRequestDto> { Success = false, Message = "Unauthorized" });

        var unit = await _context.EventUnits
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Members)
            .FirstOrDefaultAsync(u => u.Id == unitId);

        if (unit == null)
            return NotFound(new ApiResponse<UnitJoinRequestDto> { Success = false, Message = "Unit not found" });

        var teamSize = unit.Division?.TeamUnit?.TotalPlayers ?? 1;
        var currentMembers = unit.Members.Count(m => m.InviteStatus == "Accepted");

        if (currentMembers >= teamSize)
            return BadRequest(new ApiResponse<UnitJoinRequestDto> { Success = false, Message = "Unit is already full" });

        // Check for existing request
        var existing = await _context.EventUnitJoinRequests
            .FirstOrDefaultAsync(r => r.UnitId == unitId && r.UserId == userId.Value && r.Status == "Pending");

        if (existing != null)
            return BadRequest(new ApiResponse<UnitJoinRequestDto> { Success = false, Message = "You already have a pending request" });

        var joinRequest = new EventUnitJoinRequest
        {
            UnitId = unitId,
            UserId = userId.Value,
            Message = request.Message,
            Status = "Pending",
            CreatedAt = DateTime.UtcNow
        };

        _context.EventUnitJoinRequests.Add(joinRequest);
        await _context.SaveChangesAsync();

        var user = await _context.Users.FindAsync(userId.Value);

        return Ok(new ApiResponse<UnitJoinRequestDto>
        {
            Success = true,
            Data = new UnitJoinRequestDto
            {
                Id = joinRequest.Id,
                UnitId = unitId,
                UnitName = unit.Name,
                UserId = userId.Value,
                UserName = $"{user?.FirstName} {user?.LastName}",
                ProfileImageUrl = user?.ProfileImageUrl,
                Message = request.Message,
                Status = "Pending",
                CreatedAt = joinRequest.CreatedAt
            }
        });
    }

    [Authorize]
    [HttpPost("units/join-request/respond")]
    public async Task<ActionResult<ApiResponse<bool>>> RespondToJoinRequest([FromBody] RespondToJoinRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        var joinRequest = await _context.EventUnitJoinRequests
            .Include(r => r.Unit)
            .FirstOrDefaultAsync(r => r.Id == request.RequestId);

        if (joinRequest == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Request not found" });

        if (joinRequest.Unit?.CaptainUserId != userId.Value)
            return Forbid();

        joinRequest.Status = request.Accept ? "Accepted" : "Declined";
        joinRequest.ResponseMessage = request.Message;
        joinRequest.RespondedAt = DateTime.UtcNow;

        if (request.Accept)
        {
            var member = new EventUnitMember
            {
                UnitId = joinRequest.UnitId,
                UserId = joinRequest.UserId,
                Role = "Player",
                InviteStatus = "Accepted",
                CreatedAt = DateTime.UtcNow
            };
            _context.EventUnitMembers.Add(member);
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true });
    }

    /// <summary>
    /// Get the current user's units (teams they're on) and pending requests
    /// </summary>
    [Authorize]
    [HttpGet("my-units")]
    public async Task<ActionResult<ApiResponse<MyUnitsDto>>> GetMyUnits()
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<MyUnitsDto> { Success = false, Message = "Unauthorized" });

        // Get units where user is a member
        var myUnits = await _context.EventUnitMembers
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Event)
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Division)
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Members)
                    .ThenInclude(m => m.User)
            .Where(m => m.UserId == userId.Value && m.InviteStatus != "Declined")
            .ToListAsync();

        // Get pending invitations to join teams
        var pendingInvitations = myUnits
            .Where(m => m.InviteStatus == "Pending")
            .Select(m => MapToEventUnitDto(m.Unit!))
            .ToList();

        // Get units where user is captain with pending join requests
        var captainUnits = myUnits
            .Where(m => m.InviteStatus == "Accepted" && m.Unit?.CaptainUserId == userId.Value)
            .Select(m => m.Unit!.Id)
            .ToList();

        var pendingJoinRequests = await _context.EventUnitJoinRequests
            .Include(r => r.Unit)
            .Include(r => r.User)
            .Where(r => captainUnits.Contains(r.UnitId) && r.Status == "Pending")
            .Select(r => new UnitJoinRequestDto
            {
                Id = r.Id,
                UnitId = r.UnitId,
                UnitName = r.Unit!.Name,
                UserId = r.UserId,
                UserName = r.User != null ? $"{r.User.FirstName} {r.User.LastName}" : null,
                ProfileImageUrl = r.User != null ? r.User.ProfileImageUrl : null,
                Message = r.Message,
                Status = r.Status,
                CreatedAt = r.CreatedAt
            })
            .ToListAsync();

        // Get active units (accepted membership)
        var activeUnits = myUnits
            .Where(m => m.InviteStatus == "Accepted")
            .Select(m => MapToEventUnitDto(m.Unit!))
            .ToList();

        return Ok(new ApiResponse<MyUnitsDto>
        {
            Success = true,
            Data = new MyUnitsDto
            {
                ActiveUnits = activeUnits,
                PendingInvitations = pendingInvitations,
                PendingJoinRequestsAsCaption = pendingJoinRequests
            }
        });
    }

    /// <summary>
    /// Accept or decline an invitation to join a unit
    /// </summary>
    [Authorize]
    [HttpPost("units/invitation/respond")]
    public async Task<ActionResult<ApiResponse<bool>>> RespondToInvitation([FromBody] RespondToInvitationRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        var membership = await _context.EventUnitMembers
            .FirstOrDefaultAsync(m => m.UnitId == request.UnitId && m.UserId == userId.Value && m.InviteStatus == "Pending");

        if (membership == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Invitation not found" });

        membership.InviteStatus = request.Accept ? "Accepted" : "Declined";
        membership.RespondedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true });
    }

    /// <summary>
    /// Leave a unit (for non-captain members)
    /// </summary>
    [Authorize]
    [HttpDelete("units/{unitId}/leave")]
    public async Task<ActionResult<ApiResponse<bool>>> LeaveUnit(int unitId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        var membership = await _context.EventUnitMembers
            .Include(m => m.Unit)
            .FirstOrDefaultAsync(m => m.UnitId == unitId && m.UserId == userId.Value);

        if (membership == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Membership not found" });

        if (membership.Unit?.CaptainUserId == userId.Value)
            return BadRequest(new ApiResponse<bool> { Success = false, Message = "Captain cannot leave the unit. Disband or transfer captaincy first." });

        _context.EventUnitMembers.Remove(membership);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true });
    }

    private EventUnitDto MapToEventUnitDto(EventUnit unit)
    {
        var teamUnit = unit.Division?.TeamUnit;
        var requiredPlayers = teamUnit?.TotalPlayers ?? unit.Division?.TeamSize ?? 1;

        return new EventUnitDto
        {
            Id = unit.Id,
            EventId = unit.EventId,
            DivisionId = unit.DivisionId,
            Name = unit.Name,
            UnitNumber = unit.UnitNumber,
            PoolNumber = unit.PoolNumber,
            PoolName = unit.PoolName,
            Seed = unit.Seed,
            Status = unit.Status,
            WaitlistPosition = unit.WaitlistPosition,
            CaptainUserId = unit.CaptainUserId,
            CaptainName = unit.Members?.FirstOrDefault(m => m.UserId == unit.CaptainUserId)?.User != null
                ? $"{unit.Members.First(m => m.UserId == unit.CaptainUserId).User!.FirstName} {unit.Members.First(m => m.UserId == unit.CaptainUserId).User!.LastName}"
                : null,
            CaptainProfileImageUrl = unit.Members?.FirstOrDefault(m => m.UserId == unit.CaptainUserId)?.User?.ProfileImageUrl,
            MatchesPlayed = unit.MatchesPlayed,
            MatchesWon = unit.MatchesWon,
            MatchesLost = unit.MatchesLost,
            GamesWon = unit.GamesWon,
            GamesLost = unit.GamesLost,
            PointsScored = unit.PointsScored,
            PointsAgainst = unit.PointsAgainst,
            RequiredPlayers = requiredPlayers,
            IsComplete = unit.Members?.Count(m => m.InviteStatus == "Accepted") >= requiredPlayers,
            AllCheckedIn = unit.Members?.All(m => m.IsCheckedIn) ?? false,
            Members = unit.Members?.Select(m => new EventUnitMemberDto
            {
                Id = m.Id,
                UserId = m.UserId,
                FirstName = m.User?.FirstName,
                LastName = m.User?.LastName,
                ProfileImageUrl = m.User?.ProfileImageUrl,
                Role = m.Role,
                InviteStatus = m.InviteStatus,
                IsCheckedIn = m.IsCheckedIn,
                CheckedInAt = m.CheckedInAt
            }).ToList() ?? new List<EventUnitMemberDto>()
        };
    }

    // ============================================
    // Tournament Courts
    // ============================================

    [HttpGet("events/{eventId}/courts")]
    public async Task<ActionResult<ApiResponse<List<TournamentCourtDto>>>> GetTournamentCourts(int eventId)
    {
        var courts = await _context.TournamentCourts
            .Include(c => c.Court)
            .Include(c => c.CurrentGame)
                .ThenInclude(g => g!.Match)
            .Where(c => c.EventId == eventId && c.IsActive)
            .OrderBy(c => c.SortOrder)
            .Select(c => new TournamentCourtDto
            {
                Id = c.Id,
                EventId = c.EventId,
                CourtId = c.CourtId,
                CourtName = c.Court != null ? c.Court.CourtName : null,
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
            CourtId = request.CourtId,
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
                CourtId = court.CourtId,
                CourtLabel = court.CourtLabel,
                Status = court.Status,
                LocationDescription = court.LocationDescription,
                SortOrder = court.SortOrder
            }
        });
    }

    // ============================================
    // Match Scheduling
    // ============================================

    [Authorize]
    [HttpPost("divisions/{divisionId}/generate-schedule")]
    public async Task<ActionResult<ApiResponse<List<EventMatchDto>>>> GenerateSchedule(int divisionId, [FromBody] CreateMatchScheduleRequest request)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<List<EventMatchDto>> { Success = false, Message = "Division not found" });

        var units = await _context.EventUnits
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .OrderBy(u => u.Seed ?? 999)
            .ThenBy(u => u.Id)
            .ToListAsync();

        if (units.Count < 2)
            return BadRequest(new ApiResponse<List<EventMatchDto>> { Success = false, Message = "Need at least 2 units to generate schedule" });

        // Clear existing matches for this division
        var existingMatches = await _context.EventMatches
            .Where(m => m.DivisionId == divisionId)
            .ToListAsync();
        _context.EventMatches.RemoveRange(existingMatches);

        var matches = new List<EventMatch>();

        if (request.ScheduleType == "RoundRobin" || request.ScheduleType == "Hybrid")
        {
            matches.AddRange(GenerateRoundRobinMatches(division, units, request));
        }
        else if (request.ScheduleType == "SingleElimination")
        {
            matches.AddRange(GenerateSingleEliminationMatches(division, units, request));
        }

        _context.EventMatches.AddRange(matches);
        await _context.SaveChangesAsync();

        // Update division settings
        division.PoolCount = request.PoolCount;
        division.BracketType = request.ScheduleType;
        division.PlayoffFromPools = request.PlayoffFromPools;
        division.GamesPerMatch = request.BestOf;
        division.DefaultScoreFormatId = request.ScoreFormatId;
        await _context.SaveChangesAsync();

        // Create games for each match
        foreach (var match in matches)
        {
            for (int g = 1; g <= request.BestOf; g++)
            {
                var game = new EventGame
                {
                    MatchId = match.Id,
                    GameNumber = g,
                    ScoreFormatId = request.ScoreFormatId,
                    Status = "New",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.EventGames.Add(game);
            }
        }
        await _context.SaveChangesAsync();

        // Reload with games
        var result = await _context.EventMatches
            .Include(m => m.Games)
            .Where(m => m.DivisionId == divisionId)
            .OrderBy(m => m.RoundNumber)
            .ThenBy(m => m.MatchNumber)
            .ToListAsync();

        return Ok(new ApiResponse<List<EventMatchDto>>
        {
            Success = true,
            Data = result.Select(m => MapToMatchDto(m)).ToList()
        });
    }

    [Authorize]
    [HttpPost("divisions/{divisionId}/assign-unit-numbers")]
    public async Task<ActionResult<ApiResponse<List<EventUnitDto>>>> AssignRandomUnitNumbers(int divisionId)
    {
        var units = await _context.EventUnits
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .ToListAsync();

        if (!units.Any())
            return BadRequest(new ApiResponse<List<EventUnitDto>> { Success = false, Message = "No units to assign" });

        // Randomize and assign numbers
        var random = new Random();
        var shuffled = units.OrderBy(x => random.Next()).ToList();

        for (int i = 0; i < shuffled.Count; i++)
        {
            shuffled[i].UnitNumber = i + 1;
            shuffled[i].UpdatedAt = DateTime.UtcNow;
        }

        // Update matches with actual unit IDs
        var matches = await _context.EventMatches
            .Where(m => m.DivisionId == divisionId)
            .ToListAsync();

        foreach (var match in matches)
        {
            match.Unit1Id = units.FirstOrDefault(u => u.UnitNumber == match.Unit1Number)?.Id;
            match.Unit2Id = units.FirstOrDefault(u => u.UnitNumber == match.Unit2Number)?.Id;
            match.UpdatedAt = DateTime.UtcNow;
        }

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

    [HttpGet("divisions/{divisionId}/schedule")]
    public async Task<ActionResult<ApiResponse<ScheduleExportDto>>> GetSchedule(int divisionId)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<ScheduleExportDto> { Success = false, Message = "Division not found" });

        var matches = await _context.EventMatches
            .Include(m => m.Unit1)
            .Include(m => m.Unit2)
            .Include(m => m.Winner)
            .Include(m => m.Games)
            .Where(m => m.DivisionId == divisionId)
            .OrderBy(m => m.RoundType)
            .ThenBy(m => m.RoundNumber)
            .ThenBy(m => m.MatchNumber)
            .ToListAsync();

        var units = await _context.EventUnits
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled")
            .OrderBy(u => u.PoolNumber)
            .ThenByDescending(u => u.MatchesWon)
            .ThenByDescending(u => u.PointsScored - u.PointsAgainst)
            .ToListAsync();

        var schedule = new ScheduleExportDto
        {
            DivisionId = divisionId,
            DivisionName = division.Name,
            EventName = division.Event?.Name ?? "",
            ExportedAt = DateTime.UtcNow,
            Rounds = matches.GroupBy(m => new { m.RoundType, m.RoundNumber, m.RoundName })
                .OrderBy(g => g.Key.RoundType == "Pool" ? 0 : g.Key.RoundType == "Bracket" ? 1 : 2)
                .ThenBy(g => g.Key.RoundNumber)
                .Select(g => new ScheduleRoundDto
                {
                    RoundType = g.Key.RoundType,
                    RoundNumber = g.Key.RoundNumber,
                    RoundName = g.Key.RoundName,
                    Matches = g.Select(m => new ScheduleMatchDto
                    {
                        MatchNumber = m.MatchNumber,
                        Unit1Number = m.Unit1Number,
                        Unit2Number = m.Unit2Number,
                        Unit1Name = m.Unit1?.Name,
                        Unit2Name = m.Unit2?.Name,
                        Status = m.Status,
                        Score = GetMatchScore(m),
                        WinnerName = m.Winner?.Name
                    }).ToList()
                }).ToList(),
            PoolStandings = units.GroupBy(u => u.PoolNumber ?? 0)
                .OrderBy(g => g.Key)
                .Select(g => new PoolStandingsDto
                {
                    PoolNumber = g.Key,
                    PoolName = g.First().PoolName,
                    Standings = g.Select((u, idx) => new PoolStandingEntryDto
                    {
                        Rank = idx + 1,
                        UnitNumber = u.UnitNumber,
                        UnitName = u.Name,
                        MatchesPlayed = u.MatchesPlayed,
                        MatchesWon = u.MatchesWon,
                        MatchesLost = u.MatchesLost,
                        GamesWon = u.GamesWon,
                        GamesLost = u.GamesLost,
                        PointDifferential = u.PointsScored - u.PointsAgainst
                    }).ToList()
                }).ToList()
        };

        return Ok(new ApiResponse<ScheduleExportDto> { Success = true, Data = schedule });
    }

    // ============================================
    // Game Management
    // ============================================

    [Authorize]
    [HttpPost("games/assign-court")]
    public async Task<ActionResult<ApiResponse<EventGameDto>>> AssignGameToCourt([FromBody] AssignGameToCourtRequest request)
    {
        var game = await _context.EventGames
            .Include(g => g.Match)
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
        game.QueuedAt = DateTime.UtcNow;
        game.UpdatedAt = DateTime.UtcNow;

        court.CurrentGameId = game.Id;
        court.Status = "InUse";

        await _context.SaveChangesAsync();

        // Call stored procedure for notifications
        await CallGameStatusChangeSP(game.Id, oldStatus, "Queued");

        return Ok(new ApiResponse<EventGameDto>
        {
            Success = true,
            Data = MapToGameDto(game)
        });
    }

    [Authorize]
    [HttpPost("games/update-status")]
    public async Task<ActionResult<ApiResponse<EventGameDto>>> UpdateGameStatus([FromBody] UpdateGameStatusRequest request)
    {
        var game = await _context.EventGames
            .Include(g => g.Match)
            .Include(g => g.TournamentCourt)
            .FirstOrDefaultAsync(g => g.Id == request.GameId);

        if (game == null)
            return NotFound(new ApiResponse<EventGameDto> { Success = false, Message = "Game not found" });

        var oldStatus = game.Status;
        game.Status = request.Status;
        game.UpdatedAt = DateTime.UtcNow;

        if (request.Status == "Started" || request.Status == "Playing")
        {
            game.StartedAt ??= DateTime.UtcNow;
        }
        else if (request.Status == "Finished")
        {
            game.FinishedAt = DateTime.UtcNow;

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
            .Include(g => g.Match)
                .ThenInclude(m => m!.Unit1)
                    .ThenInclude(u => u!.Members)
            .Include(g => g.Match)
                .ThenInclude(m => m!.Unit2)
                    .ThenInclude(u => u!.Members)
            .FirstOrDefaultAsync(g => g.Id == request.GameId);

        if (game == null)
            return NotFound(new ApiResponse<EventGameDto> { Success = false, Message = "Game not found" });

        // Check if user is in one of the units
        var userUnit = game.Match?.Unit1?.Members.Any(m => m.UserId == userId) == true ? game.Match.Unit1 :
                       game.Match?.Unit2?.Members.Any(m => m.UserId == userId) == true ? game.Match.Unit2 : null;

        if (userUnit == null)
            return Forbid();

        game.Unit1Score = request.Unit1Score;
        game.Unit2Score = request.Unit2Score;
        game.ScoreSubmittedByUnitId = userUnit.Id;
        game.ScoreSubmittedAt = DateTime.UtcNow;
        game.UpdatedAt = DateTime.UtcNow;

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
            .Include(g => g.Match)
                .ThenInclude(m => m!.Unit1)
                    .ThenInclude(u => u!.Members)
            .Include(g => g.Match)
                .ThenInclude(m => m!.Unit2)
                    .ThenInclude(u => u!.Members)
            .Include(g => g.ScoreFormat)
            .FirstOrDefaultAsync(g => g.Id == request.GameId);

        if (game == null)
            return NotFound(new ApiResponse<EventGameDto> { Success = false, Message = "Game not found" });

        // Check if user is in the OTHER unit (not the one that submitted)
        var userUnit = game.Match?.Unit1?.Members.Any(m => m.UserId == userId) == true ? game.Match.Unit1 :
                       game.Match?.Unit2?.Members.Any(m => m.UserId == userId) == true ? game.Match.Unit2 : null;

        if (userUnit == null || userUnit.Id == game.ScoreSubmittedByUnitId)
            return Forbid();

        if (request.Confirm)
        {
            game.ScoreConfirmedByUnitId = userUnit.Id;
            game.ScoreConfirmedAt = DateTime.UtcNow;
            game.Status = "Finished";
            game.FinishedAt = DateTime.UtcNow;

            // Determine winner
            var unit1Id = game.Match!.Unit1Id;
            var unit2Id = game.Match!.Unit2Id;
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
            await CheckMatchComplete(game.MatchId);
        }
        else
        {
            game.ScoreDisputedAt = DateTime.UtcNow;
            game.ScoreDisputeReason = request.DisputeReason;
        }

        game.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<EventGameDto>
        {
            Success = true,
            Data = MapToGameDto(game)
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
            member.CheckedInAt = DateTime.UtcNow;

            // Check if all members of unit are checked in
            var allCheckedIn = await _context.EventUnitMembers
                .Where(m => m.UnitId == member.UnitId && m.InviteStatus == "Accepted")
                .AllAsync(m => m.IsCheckedIn);

            if (allCheckedIn && member.Unit != null)
            {
                member.Unit.Status = "CheckedIn";
                member.Unit.UpdatedAt = DateTime.UtcNow;
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
            UserName = $"{g.First().User?.FirstName} {g.First().User?.LastName}",
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
            .Include(e => e.Divisions)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new ApiResponse<TournamentDashboardDto> { Success = false, Message = "Event not found" });

        var units = await _context.EventUnits
            .Include(u => u.Members)
            .Where(u => u.EventId == eventId)
            .ToListAsync();

        var matches = await _context.EventMatches
            .Where(m => m.EventId == eventId)
            .ToListAsync();

        var games = await _context.EventGames
            .Include(g => g.Match)
            .Where(g => g.Match!.EventId == eventId)
            .ToListAsync();

        var courts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive)
            .ToListAsync();

        var dashboard = new TournamentDashboardDto
        {
            EventId = eventId,
            EventName = evt.Name,
            TournamentStatus = evt.TournamentStatus,
            Stats = new TournamentStatsDto
            {
                TotalRegistrations = units.Count(u => u.Status != "Cancelled"),
                CheckedInPlayers = units.SelectMany(u => u.Members).Count(m => m.IsCheckedIn),
                TotalMatches = matches.Count,
                CompletedMatches = matches.Count(m => m.Status == "Completed"),
                InProgressGames = games.Count(g => g.Status == "Playing" || g.Status == "Started"),
                AvailableCourts = courts.Count(c => c.Status == "Available"),
                InUseCourts = courts.Count(c => c.Status == "InUse")
            },
            Divisions = evt.Divisions.Where(d => d.IsActive).Select(d => new DivisionStatusDto
            {
                Id = d.Id,
                Name = d.Name,
                TeamUnitId = d.TeamUnitId,
                MaxUnits = d.MaxUnits ?? 0,
                RegisteredUnits = units.Count(u => u.DivisionId == d.Id && u.Status != "Cancelled" && u.Status != "Waitlisted"),
                WaitlistedUnits = units.Count(u => u.DivisionId == d.Id && u.Status == "Waitlisted"),
                CheckedInUnits = units.Count(u => u.DivisionId == d.Id && u.Status == "CheckedIn"),
                TotalMatches = matches.Count(m => m.DivisionId == d.Id),
                CompletedMatches = matches.Count(m => m.DivisionId == d.Id && m.Status == "Completed"),
                InProgressMatches = matches.Count(m => m.DivisionId == d.Id && m.Status == "InProgress"),
                ScheduleReady = matches.Any(m => m.DivisionId == d.Id),
                UnitsAssigned = units.Where(u => u.DivisionId == d.Id).All(u => u.UnitNumber.HasValue)
            }).ToList(),
            Courts = courts.Select(c => new TournamentCourtDto
            {
                Id = c.Id,
                EventId = c.EventId,
                CourtLabel = c.CourtLabel,
                Status = c.Status,
                CurrentGameId = c.CurrentGameId,
                SortOrder = c.SortOrder
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

        var validStatuses = new[] { "Draft", "RegistrationOpen", "RegistrationClosed", "ScheduleReady", "Running", "Completed", "Cancelled" };
        if (!validStatuses.Contains(status))
            return BadRequest(new ApiResponse<bool> { Success = false, Message = "Invalid status" });

        evt.TournamentStatus = status;
        evt.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true });
    }

    // ============================================
    // Helper Methods
    // ============================================

    private async Task<int> GetNextWaitlistPosition(int divisionId)
    {
        var max = await _context.EventUnits
            .Where(u => u.DivisionId == divisionId && u.Status == "Waitlisted")
            .MaxAsync(u => (int?)u.WaitlistPosition) ?? 0;
        return max + 1;
    }

    private EventUnitDto MapToUnitDto(EventUnit u)
    {
        var teamSize = u.Division?.TeamUnit?.TotalPlayers ?? 1;
        var acceptedMembers = u.Members.Where(m => m.InviteStatus == "Accepted").ToList();

        return new EventUnitDto
        {
            Id = u.Id,
            EventId = u.EventId,
            DivisionId = u.DivisionId,
            Name = u.Name,
            UnitNumber = u.UnitNumber,
            PoolNumber = u.PoolNumber,
            PoolName = u.PoolName,
            Seed = u.Seed,
            Status = u.Status,
            WaitlistPosition = u.WaitlistPosition,
            CaptainUserId = u.CaptainUserId,
            CaptainName = u.Captain != null ? $"{u.Captain.FirstName} {u.Captain.LastName}" : null,
            CaptainProfileImageUrl = u.Captain?.ProfileImageUrl,
            MatchesPlayed = u.MatchesPlayed,
            MatchesWon = u.MatchesWon,
            MatchesLost = u.MatchesLost,
            GamesWon = u.GamesWon,
            GamesLost = u.GamesLost,
            PointsScored = u.PointsScored,
            PointsAgainst = u.PointsAgainst,
            TeamUnitId = u.Division?.TeamUnitId,
            RequiredPlayers = teamSize,
            IsComplete = acceptedMembers.Count >= teamSize,
            AllCheckedIn = acceptedMembers.All(m => m.IsCheckedIn),
            Members = u.Members.Select(m => new EventUnitMemberDto
            {
                Id = m.Id,
                UserId = m.UserId,
                FirstName = m.User?.FirstName,
                LastName = m.User?.LastName,
                ProfileImageUrl = m.User?.ProfileImageUrl,
                Role = m.Role,
                InviteStatus = m.InviteStatus,
                IsCheckedIn = m.IsCheckedIn,
                CheckedInAt = m.CheckedInAt
            }).ToList()
        };
    }

    private EventMatchDto MapToMatchDto(EventMatch m)
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
            Games = m.Games.OrderBy(g => g.GameNumber).Select(MapToGameDto).ToList(),
            Unit1GamesWon = m.Games.Count(g => g.WinnerUnitId == m.Unit1Id),
            Unit2GamesWon = m.Games.Count(g => g.WinnerUnitId == m.Unit2Id)
        };
    }

    private EventGameDto MapToGameDto(EventGame g)
    {
        return new EventGameDto
        {
            Id = g.Id,
            MatchId = g.MatchId,
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

    private List<EventMatch> GenerateRoundRobinMatches(EventDivision division, List<EventUnit> units, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventMatch>();
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
                    matches.Add(new EventMatch
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
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
            }
        }

        return matches;
    }

    private List<EventMatch> GenerateSingleEliminationMatches(EventDivision division, List<EventUnit> units, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventMatch>();
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
                matches.Add(new EventMatch
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
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
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

    private string? GetMatchScore(EventMatch match)
    {
        if (!match.Games.Any(g => g.Status == "Finished")) return null;

        return string.Join(", ", match.Games
            .Where(g => g.Status == "Finished")
            .OrderBy(g => g.GameNumber)
            .Select(g => $"{g.Unit1Score}-{g.Unit2Score}"));
    }

    private async Task UpdateUnitStats(EventGame game)
    {
        var match = game.Match;
        if (match == null) return;

        var unit1 = await _context.EventUnits.FindAsync(match.Unit1Id);
        var unit2 = await _context.EventUnits.FindAsync(match.Unit2Id);

        if (unit1 != null)
        {
            if (game.WinnerUnitId == unit1.Id)
                unit1.GamesWon++;
            else
                unit1.GamesLost++;

            unit1.PointsScored += game.Unit1Score;
            unit1.PointsAgainst += game.Unit2Score;
            unit1.UpdatedAt = DateTime.UtcNow;
        }

        if (unit2 != null)
        {
            if (game.WinnerUnitId == unit2.Id)
                unit2.GamesWon++;
            else
                unit2.GamesLost++;

            unit2.PointsScored += game.Unit2Score;
            unit2.PointsAgainst += game.Unit1Score;
            unit2.UpdatedAt = DateTime.UtcNow;
        }
    }

    private async Task CheckMatchComplete(int matchId)
    {
        var match = await _context.EventMatches
            .Include(m => m.Games)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null) return;

        var gamesNeeded = (match.BestOf / 2) + 1;
        var unit1Wins = match.Games.Count(g => g.WinnerUnitId == match.Unit1Id);
        var unit2Wins = match.Games.Count(g => g.WinnerUnitId == match.Unit2Id);

        if (unit1Wins >= gamesNeeded || unit2Wins >= gamesNeeded)
        {
            match.WinnerUnitId = unit1Wins >= gamesNeeded ? match.Unit1Id : match.Unit2Id;
            match.Status = "Completed";
            match.CompletedAt = DateTime.UtcNow;
            match.UpdatedAt = DateTime.UtcNow;

            // Update match stats
            var winner = await _context.EventUnits.FindAsync(match.WinnerUnitId);
            var loserId = match.WinnerUnitId == match.Unit1Id ? match.Unit2Id : match.Unit1Id;
            var loser = await _context.EventUnits.FindAsync(loserId);

            if (winner != null)
            {
                winner.MatchesPlayed++;
                winner.MatchesWon++;
                winner.UpdatedAt = DateTime.UtcNow;
            }

            if (loser != null)
            {
                loser.MatchesPlayed++;
                loser.MatchesLost++;
                loser.UpdatedAt = DateTime.UtcNow;
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
            UserName = user != null ? $"{user.FirstName} {user.LastName}" : null,
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
}
