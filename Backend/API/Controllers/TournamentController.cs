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

    private async Task<bool> IsAdminAsync()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return false;

        var user = await _context.Users.FindAsync(userId.Value);
        return user?.Role == "Admin";
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

        var now = DateTime.Now;
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
                    RegisteredCount = regCount,
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
        var warnings = new List<string>();

        // Check if user has gender set in profile
        if (string.IsNullOrEmpty(user.Gender))
        {
            warnings.Add("Please update your profile with your gender for accurate division placement.");
        }

        // Check if event allows multiple divisions
        if (!evt.AllowMultipleDivisions && request.DivisionIds.Count > 1)
        {
            return BadRequest(new ApiResponse<List<EventUnitDto>> { Success = false, Message = "This event only allows registration for one division" });
        }

        // If event doesn't allow multiple divisions, check if user is already registered for another division
        if (!evt.AllowMultipleDivisions)
        {
            var existingRegistration = await _context.EventUnitMembers
                .Include(m => m.Unit)
                .AnyAsync(m => m.UserId == userId.Value &&
                    m.Unit!.EventId == eventId &&
                    m.Unit.Status != "Cancelled" &&
                    m.InviteStatus == "Accepted");

            if (existingRegistration)
            {
                return BadRequest(new ApiResponse<List<EventUnitDto>> { Success = false, Message = "This event only allows registration for one division. You are already registered." });
            }
        }

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

            // Check if user has a pending join request in this division
            var hasPendingJoinRequest = await _context.EventUnitJoinRequests
                .Include(r => r.Unit)
                .AnyAsync(r => r.UserId == userId.Value &&
                    r.Unit!.DivisionId == divisionId &&
                    r.Unit.EventId == eventId &&
                    r.Status == "Pending");

            if (hasPendingJoinRequest)
            {
                warnings.Add($"You have a pending join request in division '{division.Name}'. Cancel it first or wait for a response.");
                continue;
            }

            // Check gender compatibility with division
            if (!string.IsNullOrEmpty(division.Gender) && division.Gender != "Open")
            {
                if (!string.IsNullOrEmpty(user.Gender))
                {
                    // For Men's/Women's divisions, check if gender matches
                    if (division.Gender == "Men" && user.Gender != "Male")
                    {
                        warnings.Add($"Division '{division.Name}' is for Men. Your profile indicates a different gender.");
                    }
                    else if (division.Gender == "Women" && user.Gender != "Female")
                    {
                        warnings.Add($"Division '{division.Name}' is for Women. Your profile indicates a different gender.");
                    }
                    // For Mixed divisions, any gender is welcome but we note it for team composition tracking
                }
            }

            var teamSize = division.TeamUnit?.TotalPlayers ?? division.TeamSize;
            var isSingles = teamSize == 1;

            // Check capacity
            var currentCount = await _context.EventUnits
                .CountAsync(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted");

            var isWaitlisted = division.MaxUnits.HasValue && currentCount >= division.MaxUnits.Value;

            // Create unit
            var unitName = isSingles
                ? Utility.FormatName(user.LastName, user.FirstName)
                : $"{user.FirstName}'s Team";

            var unit = new EventUnit
            {
                EventId = eventId,
                DivisionId = divisionId,
                Name = unitName,
                Status = isWaitlisted ? "Waitlisted" : "Registered",
                WaitlistPosition = isWaitlisted ? await GetNextWaitlistPosition(divisionId) : null,
                CaptainUserId = userId.Value,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
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
                CreatedAt = DateTime.Now
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
                    InvitedAt = DateTime.Now,
                    CreatedAt = DateTime.Now
                };
                _context.EventUnitMembers.Add(partnerMember);
            }

            await _context.SaveChangesAsync();
            createdUnits.Add(unit);
        }

        // Reload with members
        if (!createdUnits.Any())
        {
            return Ok(new ApiResponse<List<EventUnitDto>>
            {
                Success = true,
                Data = new List<EventUnitDto>(),
                Warnings = warnings.Any() ? warnings : null
            });
        }

        // Load all units for this event and filter in-memory to avoid OPENJSON issues with List.Contains()
        var unitIdsSet = createdUnits.Select(c => c.Id).ToHashSet();
        var allUnits = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Where(u => u.EventId == eventId)
            .ToListAsync();
        var units = allUnits.Where(u => unitIdsSet.Contains(u.Id)).ToList();

        return Ok(new ApiResponse<List<EventUnitDto>>
        {
            Success = true,
            Data = units.Select(MapToUnitDto).ToList(),
            Warnings = warnings.Any() ? warnings : null
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
            .Include(u => u.JoinRequests)
                .ThenInclude(jr => jr.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Captain)
            .Include(u => u.Event)
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

        // Check for existing request to this specific unit
        var existingToUnit = await _context.EventUnitJoinRequests
            .FirstOrDefaultAsync(r => r.UnitId == unitId && r.UserId == userId.Value && r.Status == "Pending");

        if (existingToUnit != null)
            return BadRequest(new ApiResponse<UnitJoinRequestDto> { Success = false, Message = "You already have a pending request to this team" });

        // Check for any pending request in the same division
        var existingInDivision = await _context.EventUnitJoinRequests
            .Include(r => r.Unit)
            .FirstOrDefaultAsync(r => r.UserId == userId.Value &&
                r.Unit!.DivisionId == unit.DivisionId &&
                r.Status == "Pending");

        if (existingInDivision != null)
            return BadRequest(new ApiResponse<UnitJoinRequestDto> { Success = false, Message = "You already have a pending request in this division. Cancel it first before requesting to join another team." });

        // Check if already registered in this division (as accepted member)
        var alreadyRegistered = await _context.EventUnitMembers
            .Include(m => m.Unit)
            .AnyAsync(m => m.UserId == userId.Value &&
                m.Unit!.DivisionId == unit.DivisionId &&
                m.Unit.Status != "Cancelled" &&
                m.InviteStatus == "Accepted");

        if (alreadyRegistered)
            return BadRequest(new ApiResponse<UnitJoinRequestDto> { Success = false, Message = "You are already registered in this division" });

        // Check for MUTUAL REQUEST scenario:
        // If the requesting user is captain of their own unit, and the target unit's captain
        // has a pending join request to the requester's unit, auto-merge instead of creating another request
        var requesterUnit = await _context.EventUnits
            .Include(u => u.Members)
            .Include(u => u.JoinRequests)
            .FirstOrDefaultAsync(u => u.DivisionId == unit.DivisionId &&
                u.CaptainUserId == userId.Value &&
                u.Status != "Cancelled");

        if (requesterUnit != null)
        {
            // Check if the target unit's captain has requested to join the requester's unit
            var mutualRequest = await _context.EventUnitJoinRequests
                .FirstOrDefaultAsync(r => r.UnitId == requesterUnit.Id &&
                    r.UserId == unit.CaptainUserId &&
                    r.Status == "Pending");

            if (mutualRequest != null)
            {
                // MUTUAL REQUEST DETECTED - Auto-merge the units
                // Keep the requester's unit (requesterUnit), move target captain as member, delete target unit

                // Add target unit's captain as member of requester's unit
                var newMember = new EventUnitMember
                {
                    UnitId = requesterUnit.Id,
                    UserId = unit.CaptainUserId,
                    Role = "Player",
                    InviteStatus = "Accepted",
                    CreatedAt = DateTime.Now
                };
                _context.EventUnitMembers.Add(newMember);

                // Move any other members from target unit to requester's unit
                var targetMembers = await _context.EventUnitMembers
                    .Where(m => m.UnitId == unit.Id && m.UserId != unit.CaptainUserId)
                    .ToListAsync();
                foreach (var member in targetMembers)
                {
                    member.UnitId = requesterUnit.Id;
                }

                // Combine payments if any
                if (unit.AmountPaid > 0)
                {
                    requesterUnit.AmountPaid += unit.AmountPaid;
                }

                // Delete the mutual request and any other join requests to the target unit
                var targetJoinRequests = await _context.EventUnitJoinRequests
                    .Where(r => r.UnitId == unit.Id)
                    .ToListAsync();
                _context.EventUnitJoinRequests.RemoveRange(targetJoinRequests);

                // Delete the mutual request (from requester's unit)
                _context.EventUnitJoinRequests.Remove(mutualRequest);

                // Delete the target unit
                _context.EventUnits.Remove(unit);

                // Update requester's unit completeness check
                var updatedMemberCount = requesterUnit.Members.Count(m => m.InviteStatus == "Accepted") + 1; // +1 for newly added captain

                await _context.SaveChangesAsync();

                // Return success with merged unit info
                var requesterUser = await _context.Users.FindAsync(userId.Value);
                var targetUser = await _context.Users.FindAsync(unit.CaptainUserId);

                return Ok(new ApiResponse<UnitJoinRequestDto>
                {
                    Success = true,
                    Message = $"Mutual request detected! Your team has been automatically merged with {Utility.FormatName(targetUser?.LastName, targetUser?.FirstName)}'s registration.",
                    Data = new UnitJoinRequestDto
                    {
                        Id = 0, // No join request created - units were merged
                        UnitId = requesterUnit.Id,
                        UnitName = requesterUnit.Name,
                        UserId = userId.Value,
                        UserName = Utility.FormatName(requesterUser?.LastName, requesterUser?.FirstName),
                        ProfileImageUrl = requesterUser?.ProfileImageUrl,
                        Message = "Units merged automatically",
                        Status = "Merged",
                        CreatedAt = DateTime.Now
                    }
                });
            }
        }

        var joinRequest = new EventUnitJoinRequest
        {
            UnitId = unitId,
            UserId = userId.Value,
            Message = request.Message,
            Status = "Pending",
            CreatedAt = DateTime.Now
        };

        _context.EventUnitJoinRequests.Add(joinRequest);

        // Also create a membership record with PendingJoinRequest status
        // This allows the user to pay early and shows up in their registrations
        var membership = new EventUnitMember
        {
            UnitId = unitId,
            UserId = userId.Value,
            Role = "Player",
            InviteStatus = "PendingJoinRequest",
            CreatedAt = DateTime.Now
        };
        _context.EventUnitMembers.Add(membership);

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
                UserName = Utility.FormatName(user?.LastName, user?.FirstName),
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
        joinRequest.RespondedAt = DateTime.Now;

        // Find and update the existing membership (created when join request was submitted)
        var membership = await _context.EventUnitMembers
            .FirstOrDefaultAsync(m => m.UnitId == joinRequest.UnitId &&
                m.UserId == joinRequest.UserId &&
                m.InviteStatus == "PendingJoinRequest");

        if (request.Accept)
        {
            if (membership != null)
            {
                // Update existing membership to Accepted
                membership.InviteStatus = "Accepted";
                membership.RespondedAt = DateTime.Now;
            }
            else
            {
                // Fallback: create new membership if not found (for legacy requests)
                var member = new EventUnitMember
                {
                    UnitId = joinRequest.UnitId,
                    UserId = joinRequest.UserId,
                    Role = "Player",
                    InviteStatus = "Accepted",
                    CreatedAt = DateTime.Now
                };
                _context.EventUnitMembers.Add(member);
            }
        }
        else
        {
            // Declined - remove the pending membership
            if (membership != null)
            {
                _context.EventUnitMembers.Remove(membership);
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true });
    }

    /// <summary>
    /// Cancel a join request (by the user who made the request)
    /// </summary>
    [Authorize]
    [HttpDelete("join-requests/{requestId}")]
    public async Task<ActionResult<ApiResponse<bool>>> CancelJoinRequest(int requestId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        var joinRequest = await _context.EventUnitJoinRequests
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (joinRequest == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Request not found" });

        if (joinRequest.UserId != userId.Value)
            return Forbid();

        if (joinRequest.Status != "Pending")
            return BadRequest(new ApiResponse<bool> { Success = false, Message = "Can only cancel pending requests" });

        // Also remove the associated membership record
        var membership = await _context.EventUnitMembers
            .FirstOrDefaultAsync(m => m.UnitId == joinRequest.UnitId &&
                m.UserId == joinRequest.UserId &&
                m.InviteStatus == "PendingJoinRequest");

        if (membership != null)
        {
            _context.EventUnitMembers.Remove(membership);
        }

        _context.EventUnitJoinRequests.Remove(joinRequest);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Join request cancelled" });
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

        // Use a subquery approach to avoid OPENJSON issue with list.Contains
        var pendingJoinRequests = captainUnits.Count > 0
            ? await _context.EventUnitJoinRequests
                .Include(r => r.Unit)
                .Include(r => r.User)
                .Where(r => r.Status == "Pending" && _context.EventUnits
                    .Any(u => u.Id == r.UnitId && u.CaptainUserId == userId.Value))
                .Select(r => new UnitJoinRequestDto
                {
                    Id = r.Id,
                    UnitId = r.UnitId,
                    UnitName = r.Unit!.Name,
                    UserId = r.UserId,
                    UserName = r.User != null ? Utility.FormatName(r.User.LastName, r.User.FirstName) : null,
                    ProfileImageUrl = r.User != null ? r.User.ProfileImageUrl : null,
                    Message = r.Message,
                    Status = r.Status,
                    CreatedAt = r.CreatedAt
                })
                .ToListAsync()
            : new List<UnitJoinRequestDto>();

        // Get active units (accepted membership)
        var activeUnits = myUnits
            .Where(m => m.InviteStatus == "Accepted")
            .Select(m => MapToEventUnitDto(m.Unit!))
            .ToList();

        // Get user's own pending join requests (requests they submitted to join other teams)
        var myPendingJoinRequests = await _context.EventUnitJoinRequests
            .Include(r => r.Unit)
                .ThenInclude(u => u!.Division)
                    .ThenInclude(d => d!.TeamUnit)
            .Include(r => r.Unit)
                .ThenInclude(u => u!.Event)
            .Include(r => r.Unit)
                .ThenInclude(u => u!.Captain)
            .Where(r => r.UserId == userId.Value && r.Status == "Pending")
            .Select(r => new MyPendingJoinRequestSummaryDto
            {
                RequestId = r.Id,
                EventId = r.Unit!.EventId,
                EventName = r.Unit.Event != null ? r.Unit.Event.Name : "",
                UnitId = r.UnitId,
                DivisionId = r.Unit.DivisionId,
                DivisionName = r.Unit.Division != null ? r.Unit.Division.Name : "",
                TeamUnitName = r.Unit.Division != null && r.Unit.Division.TeamUnit != null ? r.Unit.Division.TeamUnit.Name : null,
                CaptainName = r.Unit.Captain != null ? Utility.FormatName(r.Unit.Captain.LastName, r.Unit.Captain.FirstName) : null,
                CaptainProfileImageUrl = r.Unit.Captain != null ? r.Unit.Captain.ProfileImageUrl : null,
                Status = r.Status,
                CreatedAt = r.CreatedAt
            })
            .ToListAsync();

        return Ok(new ApiResponse<MyUnitsDto>
        {
            Success = true,
            Data = new MyUnitsDto
            {
                ActiveUnits = activeUnits,
                PendingInvitations = pendingInvitations,
                PendingJoinRequestsAsCaption = pendingJoinRequests,
                MyPendingJoinRequests = myPendingJoinRequests
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
        membership.RespondedAt = DateTime.Now;

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

    /// <summary>
    /// Unregister from a division - allows player to withdraw their registration
    /// For singles/solo: deletes the unit entirely
    /// For captain of team: deletes entire unit (team withdraws)
    /// </summary>
    [Authorize]
    [HttpDelete("events/{eventId}/divisions/{divisionId}/unregister")]
    public async Task<ActionResult<ApiResponse<bool>>> UnregisterFromDivision(int eventId, int divisionId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        // Find user's unit in this division
        var membership = await _context.EventUnitMembers
            .Include(m => m.Unit)
            .ThenInclude(u => u!.Members)
            .FirstOrDefaultAsync(m => m.UserId == userId.Value
                && m.Unit!.EventId == eventId
                && m.Unit.DivisionId == divisionId
                && m.Unit.Status != "Cancelled");

        if (membership?.Unit == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "You are not registered for this division" });

        var unit = membership.Unit;

        // Check if tournament has started (matches scheduled)
        var hasScheduledMatches = await _context.EventMatches
            .AnyAsync(m => m.DivisionId == divisionId && (m.Unit1Id == unit.Id || m.Unit2Id == unit.Id) && m.Status != "Cancelled");

        if (hasScheduledMatches)
            return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot unregister after tournament schedule has been created. Contact the organizer." });

        // If user is captain or solo player, delete the entire unit
        if (unit.CaptainUserId == userId.Value || unit.Members.Count == 1)
        {
            // Remove all members first
            _context.EventUnitMembers.RemoveRange(unit.Members);
            _context.EventUnits.Remove(unit);
        }
        else
        {
            // Just remove this member
            _context.EventUnitMembers.Remove(membership);
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Successfully unregistered from division" });
    }

    // ============================================
    // Payment Management
    // ============================================

    /// <summary>
    /// Upload payment proof for a registration
    /// </summary>
    [Authorize]
    [HttpPost("events/{eventId}/units/{unitId}/payment")]
    public async Task<ActionResult<ApiResponse<PaymentInfoDto>>> UploadPaymentProof(
        int eventId,
        int unitId,
        [FromBody] UploadPaymentProofRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<PaymentInfoDto> { Success = false, Message = "Unauthorized" });

        var unit = await _context.EventUnits
            .Include(u => u.Members)
            .Include(u => u.Event)
            .Include(u => u.Division)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return NotFound(new ApiResponse<PaymentInfoDto> { Success = false, Message = "Registration not found" });

        // Check if user is a member of this unit or the event organizer
        var isMember = unit.Members.Any(m => m.UserId == userId.Value);
        var isOrganizer = unit.Event?.OrganizedByUserId == userId.Value;

        if (!isMember && !isOrganizer)
            return Forbid();

        // Update payment info
        if (!string.IsNullOrEmpty(request.PaymentProofUrl))
        {
            unit.PaymentProofUrl = request.PaymentProofUrl;
        }

        if (!string.IsNullOrEmpty(request.PaymentReference))
        {
            unit.PaymentReference = request.PaymentReference;
        }

        if (request.AmountPaid.HasValue)
        {
            unit.AmountPaid = request.AmountPaid.Value;
        }

        // Generate reference ID if not already set (for matching payments)
        if (string.IsNullOrEmpty(unit.ReferenceId))
        {
            unit.ReferenceId = $"E{eventId}-U{unitId}-P{userId.Value}";
        }

        // Calculate amount due
        var amountDue = (unit.Event?.RegistrationFee ?? 0m) + (unit.Division?.DivisionFee ?? 0m);

        // Auto-update payment status based on amount paid
        if (unit.AmountPaid >= amountDue && amountDue > 0)
        {
            unit.PaymentStatus = "Paid";
            unit.PaidAt = DateTime.Now;
        }
        else if (unit.AmountPaid > 0)
        {
            unit.PaymentStatus = "Partial";
        }
        else if (!string.IsNullOrEmpty(unit.PaymentProofUrl))
        {
            // If proof uploaded but no amount, mark as pending verification
            unit.PaymentStatus = "PendingVerification";
        }

        // Mark the submitting user's member record as paid and copy payment details
        var memberRecord = unit.Members.FirstOrDefault(m => m.UserId == userId.Value);
        if (memberRecord != null)
        {
            memberRecord.HasPaid = true;
            memberRecord.PaidAt = DateTime.Now;
            memberRecord.AmountPaid = request.AmountPaid ?? 0;
            memberRecord.PaymentProofUrl = unit.PaymentProofUrl;
            memberRecord.PaymentReference = unit.PaymentReference;
            // Generate member-specific ReferenceId (not copied from unit)
            memberRecord.ReferenceId = $"E{eventId}-U{unitId}-P{userId.Value}";
        }

        unit.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<PaymentInfoDto>
        {
            Success = true,
            Data = new PaymentInfoDto
            {
                UnitId = unit.Id,
                PaymentStatus = unit.PaymentStatus,
                AmountPaid = unit.AmountPaid,
                AmountDue = amountDue,
                PaymentProofUrl = unit.PaymentProofUrl,
                PaymentReference = unit.PaymentReference,
                ReferenceId = unit.ReferenceId,
                PaidAt = unit.PaidAt
            },
            Message = "Payment info updated"
        });
    }

    /// <summary>
    /// Mark registration as paid (organizer only)
    /// </summary>
    [Authorize]
    [HttpPost("events/{eventId}/units/{unitId}/mark-paid")]
    public async Task<ActionResult<ApiResponse<PaymentInfoDto>>> MarkAsPaid(int eventId, int unitId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<PaymentInfoDto> { Success = false, Message = "Unauthorized" });

        var unit = await _context.EventUnits
            .Include(u => u.Event)
            .Include(u => u.Division)
            .Include(u => u.Members)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return NotFound(new ApiResponse<PaymentInfoDto> { Success = false, Message = "Registration not found" });

        // Only organizer or site admin can mark as paid
        var isAdmin = await IsAdminAsync();
        if (unit.Event?.OrganizedByUserId != userId.Value && !isAdmin)
            return Forbid();

        var amountDue = (unit.Event?.RegistrationFee ?? 0m) + (unit.Division?.DivisionFee ?? 0m);

        unit.PaymentStatus = "Paid";
        unit.AmountPaid = amountDue;
        unit.PaidAt = DateTime.Now;
        unit.UpdatedAt = DateTime.Now;

        // Mark all members as paid when organizer marks the whole unit as paid
        foreach (var member in unit.Members)
        {
            member.HasPaid = true;
            member.PaidAt = DateTime.Now;
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<PaymentInfoDto>
        {
            Success = true,
            Data = new PaymentInfoDto
            {
                UnitId = unit.Id,
                PaymentStatus = unit.PaymentStatus,
                AmountPaid = unit.AmountPaid,
                AmountDue = amountDue,
                PaymentProofUrl = unit.PaymentProofUrl,
                PaymentReference = unit.PaymentReference,
                ReferenceId = unit.ReferenceId,
                PaidAt = unit.PaidAt
            },
            Message = "Marked as paid"
        });
    }

    /// <summary>
    /// Unmark registration payment (organizer only) - resets to Pending
    /// </summary>
    [Authorize]
    [HttpPost("events/{eventId}/units/{unitId}/unmark-paid")]
    public async Task<ActionResult<ApiResponse<PaymentInfoDto>>> UnmarkPaid(int eventId, int unitId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<PaymentInfoDto> { Success = false, Message = "Unauthorized" });

        var unit = await _context.EventUnits
            .Include(u => u.Event)
            .Include(u => u.Division)
            .Include(u => u.Members)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return NotFound(new ApiResponse<PaymentInfoDto> { Success = false, Message = "Registration not found" });

        // Only organizer or site admin can unmark payment
        var isAdmin = await IsAdminAsync();
        if (unit.Event?.OrganizedByUserId != userId.Value && !isAdmin)
            return Forbid();

        var amountDue = (unit.Event?.RegistrationFee ?? 0m) + (unit.Division?.DivisionFee ?? 0m);

        // Reset payment status based on what's still present
        if (!string.IsNullOrEmpty(unit.PaymentProofUrl))
        {
            unit.PaymentStatus = "PendingVerification";
        }
        else
        {
            unit.PaymentStatus = "Pending";
        }
        unit.AmountPaid = 0;
        unit.PaidAt = null;
        unit.UpdatedAt = DateTime.Now;

        // Reset all member payment status
        foreach (var member in unit.Members)
        {
            member.HasPaid = false;
            member.PaidAt = null;
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<PaymentInfoDto>
        {
            Success = true,
            Data = new PaymentInfoDto
            {
                UnitId = unit.Id,
                PaymentStatus = unit.PaymentStatus,
                AmountPaid = unit.AmountPaid,
                AmountDue = amountDue,
                PaymentProofUrl = unit.PaymentProofUrl,
                PaymentReference = unit.PaymentReference,
                ReferenceId = unit.ReferenceId,
                PaidAt = unit.PaidAt
            },
            Message = "Payment unmarked"
        });
    }

    /// <summary>
    /// Remove a registration (organizer only) - removes member from unit, deletes unit if empty
    /// </summary>
    [Authorize]
    [HttpDelete("events/{eventId}/registrations/{unitId}/members/{userId}")]
    public async Task<ActionResult<ApiResponse<bool>>> RemoveRegistration(int eventId, int unitId, int userId)
    {
        var currentUserId = GetUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        // Check if user is organizer or site admin
        var evt = await _context.Events.FirstOrDefaultAsync(e => e.Id == eventId && e.IsActive);
        if (evt == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

        var isAdmin = await IsAdminAsync();
        if (evt.OrganizedByUserId != currentUserId.Value && !isAdmin)
            return Forbid();

        var unit = await _context.EventUnits
            .Include(u => u.Members)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Unit not found" });

        var member = unit.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Member not found in unit" });

        _context.EventUnitMembers.Remove(member);

        // If unit is now empty, delete it
        if (unit.Members.Count <= 1)
        {
            _context.EventUnits.Remove(unit);
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Registration removed" });
    }

    /// <summary>
    /// Move a registration to a different division (organizer only)
    /// </summary>
    [Authorize]
    [HttpPost("events/{eventId}/registrations/{unitId}/move")]
    public async Task<ActionResult<ApiResponse<bool>>> MoveRegistration(int eventId, int unitId, [FromBody] MoveRegistrationRequest request)
    {
        var currentUserId = GetUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        // Check if user is organizer or site admin
        var evt = await _context.Events.FirstOrDefaultAsync(e => e.Id == eventId && e.IsActive);
        if (evt == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

        var isAdmin = await IsAdminAsync();
        if (evt.OrganizedByUserId != currentUserId.Value && !isAdmin)
            return Forbid();

        var unit = await _context.EventUnits.FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);
        if (unit == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Unit not found" });

        // Verify target division exists and belongs to this event
        var targetDivision = await _context.EventDivisions
            .FirstOrDefaultAsync(d => d.Id == request.NewDivisionId && d.EventId == eventId && d.IsActive);
        if (targetDivision == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Target division not found" });

        unit.DivisionId = request.NewDivisionId;
        unit.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Registration moved to new division" });
    }

    /// <summary>
    /// Merge two registrations in the same division (organizer only)
    /// Moves members from source unit to target unit, then removes source unit
    /// </summary>
    [Authorize]
    [HttpPost("events/{eventId}/registrations/merge")]
    public async Task<ActionResult<ApiResponse<EventUnitDto>>> MergeRegistrations(int eventId, [FromBody] MergeRegistrationsRequest request)
    {
        var currentUserId = GetUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(new ApiResponse<EventUnitDto> { Success = false, Message = "Unauthorized" });

        // Check if user is organizer or site admin
        var evt = await _context.Events
            .Include(e => e.Divisions)
                .ThenInclude(d => d.TeamUnit)
            .FirstOrDefaultAsync(e => e.Id == eventId && e.IsActive);
        if (evt == null)
            return NotFound(new ApiResponse<EventUnitDto> { Success = false, Message = "Event not found" });

        var isAdmin = await IsAdminAsync();
        if (evt.OrganizedByUserId != currentUserId.Value && !isAdmin)
            return Forbid();

        // Get both units with their members
        var targetUnit = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .FirstOrDefaultAsync(u => u.Id == request.TargetUnitId && u.EventId == eventId);

        var sourceUnit = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(u => u.Id == request.SourceUnitId && u.EventId == eventId);

        if (targetUnit == null)
            return NotFound(new ApiResponse<EventUnitDto> { Success = false, Message = "Target registration not found" });

        if (sourceUnit == null)
            return NotFound(new ApiResponse<EventUnitDto> { Success = false, Message = "Source registration not found" });

        // Verify both units are in the same division
        if (targetUnit.DivisionId != sourceUnit.DivisionId)
            return BadRequest(new ApiResponse<EventUnitDto> { Success = false, Message = "Both registrations must be in the same division" });

        // Calculate capacity
        var teamSize = targetUnit.Division?.TeamUnit?.TotalPlayers ?? targetUnit.Division?.TeamSize ?? 2;
        var targetMemberCount = targetUnit.Members.Count(m => m.InviteStatus == "Accepted");
        var sourceMemberCount = sourceUnit.Members.Count(m => m.InviteStatus == "Accepted");

        if (targetMemberCount + sourceMemberCount > teamSize)
            return BadRequest(new ApiResponse<EventUnitDto> { Success = false, Message = $"Combined members ({targetMemberCount + sourceMemberCount}) would exceed team size ({teamSize})" });

        // Move members from source to target
        foreach (var member in sourceUnit.Members.ToList())
        {
            // Check if this user is already in target unit
            if (targetUnit.Members.Any(m => m.UserId == member.UserId))
            {
                // Remove duplicate from source
                _context.EventUnitMembers.Remove(member);
                continue;
            }

            // Move member to target unit
            member.UnitId = targetUnit.Id;
            member.InviteStatus = "Accepted"; // Auto-accept when admin merges
            member.Role = "Member"; // Demote to member (target captain stays captain)
        }

        // Combine payment info - keep higher amount paid
        if (sourceUnit.AmountPaid > 0)
        {
            targetUnit.AmountPaid += sourceUnit.AmountPaid;
            // Update payment status if now fully paid
            var amountDue = (evt.RegistrationFee) + (targetUnit.Division?.DivisionFee ?? 0m);
            if (targetUnit.AmountPaid >= amountDue)
            {
                targetUnit.PaymentStatus = "Paid";
                targetUnit.PaidAt ??= DateTime.Now;
            }
            else if (targetUnit.AmountPaid > 0)
            {
                targetUnit.PaymentStatus = "Partial";
            }
        }

        // Delete any pending join requests for the source unit
        var sourceJoinRequests = await _context.EventUnitJoinRequests
            .Where(r => r.UnitId == sourceUnit.Id)
            .ToListAsync();
        _context.EventUnitJoinRequests.RemoveRange(sourceJoinRequests);

        // Get all merged user IDs as a HashSet for efficient lookup
        var mergedUserIds = targetUnit.Members.Select(m => m.UserId).ToHashSet();

        // Delete any pending join requests TO the target unit from users who are now members
        var targetJoinRequests = await _context.EventUnitJoinRequests
            .Where(r => r.UnitId == targetUnit.Id)
            .ToListAsync();
        var targetJoinRequestsFromMembers = targetJoinRequests.Where(r => mergedUserIds.Contains(r.UserId)).ToList();
        _context.EventUnitJoinRequests.RemoveRange(targetJoinRequestsFromMembers);

        // Delete any pending join requests FROM the merged users to other units in this division
        var divisionJoinRequests = await _context.EventUnitJoinRequests
            .Include(r => r.Unit)
            .Where(r => r.Unit!.DivisionId == targetUnit.DivisionId && r.Status == "Pending")
            .ToListAsync();
        var otherJoinRequests = divisionJoinRequests.Where(r => mergedUserIds.Contains(r.UserId)).ToList();
        _context.EventUnitJoinRequests.RemoveRange(otherJoinRequests);

        // Remove the source unit
        _context.EventUnits.Remove(sourceUnit);

        targetUnit.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        // Reload target unit to get updated data
        var updatedUnit = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Event)
            .FirstOrDefaultAsync(u => u.Id == targetUnit.Id);

        return Ok(new ApiResponse<EventUnitDto>
        {
            Success = true,
            Data = MapToEventUnitDto(updatedUnit!),
            Message = "Registrations merged successfully"
        });
    }

    private EventUnitDto MapToEventUnitDto(EventUnit unit)
    {
        var teamUnit = unit.Division?.TeamUnit;
        var requiredPlayers = teamUnit?.TotalPlayers ?? unit.Division?.TeamSize ?? 1;

        return new EventUnitDto
        {
            Id = unit.Id,
            EventId = unit.EventId,
            EventName = unit.Event?.Name,
            DivisionId = unit.DivisionId,
            DivisionName = unit.Division?.Name,
            Name = unit.Name,
            UnitNumber = unit.UnitNumber,
            PoolNumber = unit.PoolNumber,
            PoolName = unit.PoolName,
            Seed = unit.Seed,
            Status = unit.Status,
            WaitlistPosition = unit.WaitlistPosition,
            CaptainUserId = unit.CaptainUserId,
            CaptainName = unit.Members?.FirstOrDefault(m => m.UserId == unit.CaptainUserId)?.User != null
                ? Utility.FormatName(unit.Members.First(m => m.UserId == unit.CaptainUserId).User!.LastName, unit.Members.First(m => m.UserId == unit.CaptainUserId).User!.FirstName)
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
            CreatedAt = unit.CreatedAt,
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
            .Include(c => c.Venue)
            .Include(c => c.CurrentGame)
                .ThenInclude(g => g!.Match)
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

    // ============================================
    // Match Scheduling
    // ============================================

    [Authorize]
    [HttpPost("divisions/{divisionId}/generate-schedule")]
    public async Task<ActionResult<ApiResponse<List<EventMatchDto>>>> GenerateSchedule(int divisionId, [FromBody] CreateMatchScheduleRequest request)
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
        var existingMatches = await _context.EventMatches
            .Include(m => m.Games)
            .Where(m => m.DivisionId == divisionId)
            .ToListAsync();

        if (existingMatches.Any())
        {
            // Clear TournamentCourt references to games in this division first
            // Using a subquery approach to avoid OPENJSON issues with List.Contains()
            var courtsWithGames = await _context.TournamentCourts
                .Where(c => c.CurrentGameId != null &&
                    _context.EventGames.Any(g => g.Id == c.CurrentGameId &&
                        _context.EventMatches.Any(m => m.Id == g.MatchId && m.DivisionId == divisionId)))
                .ToListAsync();

            foreach (var court in courtsWithGames)
            {
                court.CurrentGameId = null;
                court.Status = "Available";
            }

            // Delete games first, then matches
            foreach (var match in existingMatches)
            {
                _context.EventGames.RemoveRange(match.Games);
            }
            _context.EventMatches.RemoveRange(existingMatches);
            await _context.SaveChangesAsync();
        }

        // Also clear unit number assignments since schedule is being regenerated
        foreach (var unit in units)
        {
            unit.UnitNumber = null;
            unit.PoolNumber = null;
            unit.PoolName = null;
        }

        var matches = new List<EventMatch>();

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

        _context.EventMatches.AddRange(matches);
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

        // Create games for each match based on phase
        foreach (var match in matches)
        {
            // Determine if this is a pool match or playoff match
            var isPoolMatch = match.RoundType == "Pool";
            var gamesPerMatch = isPoolMatch ? poolGamesPerMatch : playoffGamesPerMatch;
            var scoreFormatId = isPoolMatch ? poolScoreFormatId : playoffScoreFormatId;

            // Update match with correct games per match
            match.BestOf = gamesPerMatch;
            match.ScoreFormatId = scoreFormatId;

            for (int g = 1; g <= gamesPerMatch; g++)
            {
                var game = new EventGame
                {
                    MatchId = match.Id,
                    GameNumber = g,
                    ScoreFormatId = scoreFormatId,
                    Status = "New",
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
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
        var matches = await _context.EventMatches
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
            ExportedAt = DateTime.Now,
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
        game.QueuedAt = DateTime.Now;
        game.UpdatedAt = DateTime.Now;

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
        game.UpdatedAt = DateTime.Now;

        if (request.Status == "Started" || request.Status == "Playing")
        {
            game.StartedAt ??= DateTime.Now;
        }
        else if (request.Status == "Finished")
        {
            game.FinishedAt = DateTime.Now;

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
        game.ScoreSubmittedAt = DateTime.Now;
        game.UpdatedAt = DateTime.Now;

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
            game.ScoreConfirmedAt = DateTime.Now;
            game.Status = "Finished";
            game.FinishedAt = DateTime.Now;

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

        // Calculate payment stats
        var activeUnits = units.Where(u => u.Status != "Cancelled").ToList();
        var paymentsSubmitted = activeUnits.Count(u => !string.IsNullOrEmpty(u.PaymentProofUrl) || !string.IsNullOrEmpty(u.PaymentReference));
        var paymentsPaid = activeUnits.Count(u => u.PaymentStatus == "Paid");
        var paymentsPending = activeUnits.Count(u => u.PaymentStatus == "Pending" || u.PaymentStatus == "PendingVerification" || u.PaymentStatus == "Partial");

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
                TotalAmountPaid = activeUnits.Sum(u => u.AmountPaid)
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
        evt.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true });
    }

    // ============================================
    // Helper Methods
    // ============================================

    private async Task<int> GetNextWaitlistPosition(int divisionId)
    {
        // Use OrderByDescending + FirstOrDefault instead of MaxAsync to avoid SQL generation issues
        var maxUnit = await _context.EventUnits
            .Where(u => u.DivisionId == divisionId && u.Status == "Waitlisted" && u.WaitlistPosition != null)
            .OrderByDescending(u => u.WaitlistPosition)
            .Select(u => u.WaitlistPosition)
            .FirstOrDefaultAsync();

        return (maxUnit ?? 0) + 1;
    }

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
            DivisionId = u.DivisionId,
            Name = u.Name,
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
                    JoinRequestId = null
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
                        CreatedAt = DateTime.Now,
                        UpdatedAt = DateTime.Now
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
    private List<EventMatch> GenerateRoundRobinMatchesForTarget(EventDivision division, int targetUnitCount, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventMatch>();
        var poolCount = request.PoolCount ?? 1;

        // Generate round robin within each pool using placeholder numbers
        for (int pool = 1; pool <= poolCount; pool++)
        {
            // Determine which unit numbers belong to this pool
            var poolUnitNumbers = new List<int>();
            for (int i = 0; i < targetUnitCount; i++)
            {
                if ((i % poolCount) + 1 == pool)
                {
                    poolUnitNumbers.Add(i + 1);
                }
            }

            var matchNum = 1;

            for (int i = 0; i < poolUnitNumbers.Count; i++)
            {
                for (int j = i + 1; j < poolUnitNumbers.Count; j++)
                {
                    matches.Add(new EventMatch
                    {
                        EventId = division.EventId,
                        DivisionId = division.Id,
                        RoundType = "Pool",
                        RoundNumber = pool,
                        RoundName = $"Pool {(char)('A' + pool - 1)}",
                        MatchNumber = matchNum++,
                        Unit1Number = poolUnitNumbers[i],
                        Unit2Number = poolUnitNumbers[j],
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

    private List<EventMatch> GeneratePlayoffMatchesForTarget(EventDivision division, int playoffUnits, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventMatch>();

        // Find next power of 2 for bracket size
        var bracketSize = 1;
        while (bracketSize < playoffUnits) bracketSize *= 2;

        var rounds = (int)Math.Log2(bracketSize);
        var matchNum = 1;

        for (int round = 1; round <= rounds; round++)
        {
            var matchesInRound = bracketSize / (int)Math.Pow(2, round);
            var roundName = round == rounds ? "Playoff Final" :
                           round == rounds - 1 ? "Playoff Semifinal" :
                           round == rounds - 2 ? "Playoff Quarterfinal" :
                           $"Playoff Round {round}";

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
                    BestOf = request.PlayoffGamesPerMatch ?? request.BestOf,
                    ScoreFormatId = request.PlayoffScoreFormatId ?? request.ScoreFormatId,
                    Status = "Scheduled",
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                });
            }
        }

        // Note: Playoff bracket positions are determined after pool play completes
        // The unit assignments will be filled in based on pool standings

        return matches;
    }

    private List<EventMatch> GenerateSingleEliminationMatchesForTarget(EventDivision division, int targetUnitCount, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventMatch>();

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

    private List<EventMatch> GenerateDoubleEliminationMatchesForTarget(EventDivision division, int targetUnitCount, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventMatch>();

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
                matches.Add(new EventMatch
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
                matches.Add(new EventMatch
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
        matches.Add(new EventMatch
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
}
