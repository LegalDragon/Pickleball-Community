using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Constants;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Hubs;
using Pickleball.Community.Services;
using Pickleball.Community.Controllers.Base;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class TournamentController : EventControllerBase
{
    private readonly ILogger<TournamentController> _logger;
    private readonly IDrawingBroadcaster _drawingBroadcaster;
    private readonly INotificationService _notificationService;
    private readonly IBracketProgressionService _bracketProgressionService;
    private readonly IScoreBroadcaster _scoreBroadcaster;
    private readonly ICourtAssignmentService _courtAssignmentService;
    private readonly IEmailNotificationService _emailService;

    public TournamentController(
        ApplicationDbContext context,
        ILogger<TournamentController> logger,
        IDrawingBroadcaster drawingBroadcaster,
        INotificationService notificationService,
        IBracketProgressionService bracketProgressionService,
        IScoreBroadcaster scoreBroadcaster,
        ICourtAssignmentService courtAssignmentService,
        IEmailNotificationService emailService)
        : base(context)
    {
        _logger = logger;
        _drawingBroadcaster = drawingBroadcaster;
        _notificationService = notificationService;
        _bracketProgressionService = bracketProgressionService;
        _scoreBroadcaster = scoreBroadcaster;
        _courtAssignmentService = courtAssignmentService;
        _emailService = emailService;
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
            .Include(e => e.Divisions)
                .ThenInclude(d => d.Fees)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new ApiResponse<EventDetailWithDivisionsDto> { Success = false, Message = "Event not found" });

        // Get registration counts per division
        var registrationCounts = await _context.EventUnits
            .Where(u => u.EventId == eventId)
            .GroupBy(u => new { u.DivisionId, u.Status })
            .Select(g => new { g.Key.DivisionId, g.Key.Status, Count = g.Count() })
            .ToListAsync();

        // Get completed unit counts per division (for MaxUnits check)
        var completedUnitCounts = await _context.EventUnits
            .Include(u => u.Members)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Where(u => u.EventId == eventId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .ToListAsync();

        var completedCountsByDivision = completedUnitCounts
            .GroupBy(u => u.DivisionId)
            .ToDictionary(
                g => g.Key,
                g => g.Count(u => {
                    var teamSize = u.Division?.TeamUnit?.TotalPlayers ?? u.Division?.TeamSize ?? 1;
                    return u.Members.Count(m => m.InviteStatus == "Accepted") >= teamSize;
                })
            );

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

                var completedCount = completedCountsByDivision.GetValueOrDefault(d.Id, 0);
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
                    CompletedCount = completedCount,
                    WaitlistedCount = waitlistCount,
                    IsFull = d.MaxUnits.HasValue && completedCount >= d.MaxUnits.Value,
                    LookingForPartner = incompleteUnits.ContainsKey(d.Id)
                        ? incompleteUnits[d.Id].Select(u => MapToUnitDto(u)).ToList()
                        : new List<EventUnitDto>(),
                    Fees = d.Fees.Where(f => f.IsActive).OrderBy(f => f.SortOrder).Select(f => new DivisionFeeDto
                    {
                        Id = f.Id,
                        DivisionId = f.DivisionId,
                        Name = f.Name,
                        Description = f.Description,
                        Amount = f.Amount,
                        IsDefault = f.IsDefault,
                        AvailableFrom = f.AvailableFrom,
                        AvailableUntil = f.AvailableUntil,
                        IsActive = f.IsActive,
                        SortOrder = f.SortOrder,
                        IsCurrentlyAvailable = (!f.AvailableFrom.HasValue || f.AvailableFrom <= DateTime.UtcNow) &&
                                               (!f.AvailableUntil.HasValue || f.AvailableUntil > DateTime.UtcNow)
                    }).ToList()
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

            // Check MaxPlayers capacity (more accurate than MaxUnits for incomplete teams)
            var isWaitlistedByPlayers = false;
            if (division.MaxPlayers.HasValue)
            {
                var currentPlayerCount = await _context.EventUnitMembers
                    .Include(m => m.Unit)
                    .CountAsync(m => m.Unit!.DivisionId == divisionId &&
                        m.Unit.EventId == eventId &&
                        m.Unit.Status != "Cancelled" &&
                        m.Unit.Status != "Waitlisted" &&
                        m.InviteStatus == "Accepted");

                isWaitlistedByPlayers = currentPlayerCount >= division.MaxPlayers.Value;
            }

            // Check MaxUnits capacity - only count completed units
            var completedUnitCount = await _context.EventUnits
                .Include(u => u.Members)
                .CountAsync(u => u.DivisionId == divisionId &&
                    u.Status != "Cancelled" &&
                    u.Status != "Waitlisted" &&
                    u.Members.Count(m => m.InviteStatus == "Accepted") >= teamSize);

            var isWaitlistedByUnits = division.MaxUnits.HasValue && completedUnitCount >= division.MaxUnits.Value;
            var isWaitlisted = isWaitlistedByPlayers || isWaitlistedByUnits;

            // Create unit
            var unitName = isSingles
                ? Utility.FormatName(user.LastName, user.FirstName)
                : $"{user.FirstName}'s Team";

            // For team divisions, use the requested join method
            var joinMethod = isSingles ? "Approval" : (request.JoinMethod ?? "Approval");
            string? joinCode = null;
            if (joinMethod == "Code" && !isSingles)
            {
                joinCode = GenerateJoinCode();
            }

            var unit = new EventUnit
            {
                EventId = eventId,
                DivisionId = divisionId,
                Name = unitName,
                Status = isWaitlisted ? "Waitlisted" : "Registered",
                WaitlistPosition = isWaitlisted ? await GetNextWaitlistPosition(divisionId) : null,
                CaptainUserId = userId.Value,
                JoinMethod = joinMethod,
                JoinCode = joinCode,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            _context.EventUnits.Add(unit);
            await _context.SaveChangesAsync();

            // Set unit ReferenceId now that we have the ID
            unit.ReferenceId = $"E{eventId}-U{unit.Id}";

            // Add captain as member
            var member = new EventUnitMember
            {
                UnitId = unit.Id,
                UserId = userId.Value,
                Role = "Captain",
                InviteStatus = "Accepted",
                CreatedAt = DateTime.Now,
                ReferenceId = $"E{eventId}-U{unit.Id}-P{userId.Value}",
                SelectedFeeId = request.SelectedFeeId
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
                    CreatedAt = DateTime.Now,
                    ReferenceId = $"E{eventId}-U{unit.Id}-P{request.PartnerUserId.Value}"
                };
                _context.EventUnitMembers.Add(partnerMember);
            }

            await _context.SaveChangesAsync();
            createdUnits.Add(unit);

            // Add waitlist warning if applicable
            if (isWaitlisted)
            {
                var waitlistReason = isWaitlistedByPlayers
                    ? $"Division '{division.Name}' has reached its maximum player limit"
                    : $"Division '{division.Name}' has reached its maximum team limit";
                warnings.Add($"WAITLIST: {waitlistReason}. You have been placed on the waiting list (position #{unit.WaitlistPosition}). You will be notified if a spot becomes available.");
            }
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

        // Send registration confirmation email
        try
        {
            if (!string.IsNullOrEmpty(user.Email) && units.Any())
            {
                var firstUnit = units.First();
                var division = firstUnit.Division;
                var feeAmount = division?.DivisionFee ?? evt.PerDivisionFee ?? evt.RegistrationFee ?? 0;

                var emailBody = EmailTemplates.EventRegistrationConfirmation(
                    $"{user.FirstName} {user.LastName}".Trim(),
                    evt.Name,
                    division?.Name ?? "Unknown Division",
                    evt.StartDate,
                    evt.VenueName,
                    firstUnit.Name,
                    feeAmount,
                    waiverSigned: false, // Not yet signed at registration time
                    paymentComplete: false // Not yet paid at registration time
                );

                await _emailService.SendSimpleAsync(
                    userId.Value,
                    user.Email,
                    $"Registration Confirmed: {evt.Name}",
                    emailBody
                );
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send registration confirmation email to user {UserId}", userId);
            // Don't fail the registration if email fails
        }

        return Ok(new ApiResponse<List<EventUnitDto>>
        {
            Success = true,
            Data = units.Select(MapToUnitDto).ToList(),
            Warnings = warnings.Any() ? warnings : null
        });
    }

    // ============================================
    // Admin Registration (Organizer adds users to event)
    // ============================================

    /// <summary>
    /// Search for users to add to event registration (organizer only)
    /// </summary>
    [Authorize]
    [HttpGet("events/{eventId}/search-users")]
    public async Task<ActionResult<ApiResponse<List<UserSearchResultDto>>>> SearchUsersForRegistration(int eventId, [FromQuery] string query)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<List<UserSearchResultDto>> { Success = false, Message = "Unauthorized" });

        // Check if user is organizer or admin
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<List<UserSearchResultDto>> { Success = false, Message = "Event not found" });

        if (!await CanManageEventAsync(eventId))
            return Forbid();

        if (string.IsNullOrWhiteSpace(query) || query.Length < 2)
            return Ok(new ApiResponse<List<UserSearchResultDto>> { Success = true, Data = new List<UserSearchResultDto>() });

        // Get users already registered for this event
        var registeredUserIds = (await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.InviteStatus == "Accepted")
            .Select(m => m.UserId)
            .Distinct()
            .ToListAsync()).ToHashSet();

        // Search for users by name or email
        var queryLower = query.ToLower();
        var users = await _context.Users
            .Where(u => (u.FirstName != null && u.FirstName.ToLower().Contains(queryLower)) ||
                       (u.LastName != null && u.LastName.ToLower().Contains(queryLower)) ||
                       (u.Email != null && u.Email.ToLower().Contains(queryLower)))
            .Take(20)
            .Select(u => new UserSearchResultDto
            {
                UserId = u.Id,
                Name = Utility.FormatName(u.LastName, u.FirstName) ?? "",
                Email = u.Email,
                ProfileImageUrl = u.ProfileImageUrl,
                City = u.City,
                State = u.State,
                IsAlreadyRegistered = registeredUserIds.Contains(u.Id)
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<UserSearchResultDto>> { Success = true, Data = users });
    }

    /// <summary>
    /// Add a user registration to event (organizer only)
    /// </summary>
    [Authorize]
    [HttpPost("events/{eventId}/admin-register")]
    public async Task<ActionResult<ApiResponse<EventUnitDto>>> AdminRegisterUser(int eventId, [FromBody] AdminAddRegistrationRequest request)
    {
        var organizerId = GetUserId();
        if (!organizerId.HasValue)
            return Unauthorized(new ApiResponse<EventUnitDto> { Success = false, Message = "Unauthorized" });

        // Get event with divisions
        var evt = await _context.Events
            .Include(e => e.Divisions)
                .ThenInclude(d => d.TeamUnit)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new ApiResponse<EventUnitDto> { Success = false, Message = "Event not found" });

        // Check if user is organizer or admin
        var isOrganizer = evt.OrganizedByUserId == organizerId.Value;
        var isAdmin = await IsAdminAsync();

        if (!isOrganizer && !isAdmin)
            return Forbid();

        // Validate user exists
        var user = await _context.Users.FindAsync(request.UserId);
        if (user == null)
            return NotFound(new ApiResponse<EventUnitDto> { Success = false, Message = "User not found" });

        // Validate division
        var division = evt.Divisions.FirstOrDefault(d => d.Id == request.DivisionId);
        if (division == null || !division.IsActive)
            return NotFound(new ApiResponse<EventUnitDto> { Success = false, Message = "Division not found" });

        // Check if user is already registered in this division
        var existingMember = await _context.EventUnitMembers
            .Include(m => m.Unit)
            .FirstOrDefaultAsync(m => m.UserId == request.UserId &&
                m.Unit!.DivisionId == request.DivisionId &&
                m.Unit.EventId == eventId &&
                m.Unit.Status != "Cancelled" &&
                m.InviteStatus == "Accepted");

        if (existingMember != null)
            return BadRequest(new ApiResponse<EventUnitDto> { Success = false, Message = "User is already registered in this division" });

        // Get team size from division
        var teamSize = division.TeamUnit?.TotalPlayers ?? division.TeamSize;
        var isSingles = teamSize == 1;

        // Check capacity (admin can override waitlist)
        var completedUnitCount = await _context.EventUnits
            .Include(u => u.Members)
            .CountAsync(u => u.DivisionId == request.DivisionId &&
                u.Status != "Cancelled" &&
                u.Status != "Waitlisted" &&
                u.Members.Count(m => m.InviteStatus == "Accepted") >= teamSize);

        var isWaitlistedByUnits = division.MaxUnits.HasValue && completedUnitCount >= division.MaxUnits.Value;

        // Check MaxPlayers capacity
        var isWaitlistedByPlayers = false;
        if (division.MaxPlayers.HasValue)
        {
            var currentPlayerCount = await _context.EventUnitMembers
                .Include(m => m.Unit)
                .CountAsync(m => m.Unit!.DivisionId == request.DivisionId &&
                    m.Unit.EventId == eventId &&
                    m.Unit.Status != "Cancelled" &&
                    m.Unit.Status != "Waitlisted" &&
                    m.InviteStatus == "Accepted");

            isWaitlistedByPlayers = currentPlayerCount >= division.MaxPlayers.Value;
        }

        // Admin registrations go to waitlist if division is full (they can promote later)
        var isWaitlisted = isWaitlistedByPlayers || isWaitlistedByUnits;

        // Create unit
        var unitName = isSingles
            ? Utility.FormatName(user.LastName, user.FirstName)
            : $"{user.FirstName}'s Team";

        var unit = new EventUnit
        {
            EventId = eventId,
            DivisionId = request.DivisionId,
            Name = unitName,
            Status = isWaitlisted ? "Waitlisted" : "Registered",
            WaitlistPosition = isWaitlisted ? await GetNextWaitlistPosition(request.DivisionId) : null,
            CaptainUserId = request.UserId,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _context.EventUnits.Add(unit);
        await _context.SaveChangesAsync();

        // Set unit ReferenceId
        unit.ReferenceId = $"E{eventId}-U{unit.Id}";

        // Add captain as member
        var member = new EventUnitMember
        {
            UnitId = unit.Id,
            UserId = request.UserId,
            Role = "Captain",
            InviteStatus = "Accepted",
            IsCheckedIn = request.AutoCheckIn,
            CheckedInAt = request.AutoCheckIn ? DateTime.Now : null,
            CreatedAt = DateTime.Now,
            ReferenceId = $"E{eventId}-U{unit.Id}-P{request.UserId}"
        };
        _context.EventUnitMembers.Add(member);

        // If partner specified, add them too
        if (!isSingles && request.PartnerUserId.HasValue)
        {
            var partnerUser = await _context.Users.FindAsync(request.PartnerUserId.Value);
            if (partnerUser != null)
            {
                // Check if partner is already registered
                var partnerExisting = await _context.EventUnitMembers
                    .Include(m => m.Unit)
                    .FirstOrDefaultAsync(m => m.UserId == request.PartnerUserId.Value &&
                        m.Unit!.DivisionId == request.DivisionId &&
                        m.Unit.EventId == eventId &&
                        m.Unit.Status != "Cancelled" &&
                        m.InviteStatus == "Accepted");

                if (partnerExisting == null)
                {
                    var partnerMember = new EventUnitMember
                    {
                        UnitId = unit.Id,
                        UserId = request.PartnerUserId.Value,
                        Role = "Player",
                        InviteStatus = "Accepted", // Admin registration = auto-accept partner
                        IsCheckedIn = request.AutoCheckIn,
                        CheckedInAt = request.AutoCheckIn ? DateTime.Now : null,
                        CreatedAt = DateTime.Now,
                        ReferenceId = $"E{eventId}-U{unit.Id}-P{request.PartnerUserId.Value}"
                    };
                    _context.EventUnitMembers.Add(partnerMember);
                }
            }
        }

        await _context.SaveChangesAsync();

        // Reload unit with all data
        var loadedUnit = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .FirstOrDefaultAsync(u => u.Id == unit.Id);

        var message = $"{Utility.FormatName(user.LastName, user.FirstName)} has been registered for {division.Name}";
        if (isWaitlisted)
            message += " (placed on waitlist)";
        if (request.AutoCheckIn)
            message += " and checked in";

        return Ok(new ApiResponse<EventUnitDto>
        {
            Success = true,
            Data = MapToUnitDto(loadedUnit!),
            Message = message
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

        // Check MaxPlayers capacity for the division (warn but don't block - will be waitlisted if accepted)
        string? waitlistWarning = null;
        if (unit.Division?.MaxPlayers.HasValue == true)
        {
            var currentPlayerCount = await _context.EventUnitMembers
                .Include(m => m.Unit)
                .CountAsync(m => m.Unit!.DivisionId == unit.DivisionId &&
                    m.Unit.EventId == unit.EventId &&
                    m.Unit.Status != "Cancelled" &&
                    m.Unit.Status != "Waitlisted" &&
                    m.InviteStatus == "Accepted");

            if (currentPlayerCount >= unit.Division.MaxPlayers.Value)
            {
                waitlistWarning = $"Division '{unit.Division.Name}' has reached its maximum player limit. If your request is accepted, you will be placed on the waiting list.";
            }
        }

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

        // Check if already registered in this division (as accepted member of a team where user is NOT captain)
        // Captains of incomplete units CAN request to join other teams (to merge/find partners)
        var alreadyRegisteredAsNonCaptain = await _context.EventUnitMembers
            .Include(m => m.Unit)
            .AnyAsync(m => m.UserId == userId.Value &&
                m.Unit!.DivisionId == unit.DivisionId &&
                m.Unit.Status != "Cancelled" &&
                m.Unit.CaptainUserId != userId.Value && // Allow if user is captain (looking for partner)
                m.InviteStatus == "Accepted");

        if (alreadyRegisteredAsNonCaptain)
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

        // Set unit ReferenceId if not already set
        if (string.IsNullOrEmpty(unit.ReferenceId))
        {
            unit.ReferenceId = $"E{unit.EventId}-U{unitId}";
        }

        // Also create a membership record with PendingJoinRequest status
        // This allows the user to pay early and shows up in their registrations
        var membership = new EventUnitMember
        {
            UnitId = unitId,
            UserId = userId.Value,
            Role = "Player",
            InviteStatus = "PendingJoinRequest",
            CreatedAt = DateTime.Now,
            ReferenceId = $"E{unit.EventId}-U{unitId}-P{userId.Value}"
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
            },
            Warnings = waitlistWarning != null ? new List<string> { waitlistWarning } : null
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
                .ThenInclude(u => u!.Event)
            .FirstOrDefaultAsync(r => r.Id == request.RequestId);

        if (joinRequest == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Request not found" });

        // Allow captain, site admin, or event organizer to respond
        var isCaptain = joinRequest.Unit?.CaptainUserId == userId.Value;
        var eventId = joinRequest.Unit?.EventId ?? 0;
        var canManage = eventId > 0 && await CanManageEventAsync(eventId);

        if (!isCaptain && !canManage)
            return Forbid();

        // If accepting, check MaxPlayers capacity (allow but waitlist if over capacity)
        bool shouldWaitlist = false;
        string? waitlistMessage = null;
        if (request.Accept)
        {
            // Check if membership already exists (player already has a reserved spot)
            var existingMembership = await _context.EventUnitMembers
                .AnyAsync(m => m.UnitId == joinRequest.UnitId &&
                    m.UserId == joinRequest.UserId &&
                    (m.InviteStatus == "PendingJoinRequest" || m.InviteStatus == "PendingPartnerInvite"));

            // Only check capacity if this is a new member (no existing membership)
            if (!existingMembership)
            {
                var division = await _context.EventDivisions
                    .FirstOrDefaultAsync(d => d.Id == joinRequest.Unit.DivisionId);

                if (division?.MaxPlayers.HasValue == true)
                {
                    var currentPlayerCount = await _context.EventUnitMembers
                        .Include(m => m.Unit)
                        .CountAsync(m => m.Unit!.DivisionId == division.Id &&
                            m.Unit.EventId == joinRequest.Unit.EventId &&
                            m.Unit.Status != "Cancelled" &&
                            m.Unit.Status != "Waitlisted" &&
                            m.InviteStatus == "Accepted");

                    if (currentPlayerCount >= division.MaxPlayers.Value)
                    {
                        shouldWaitlist = true;
                        waitlistMessage = $"Division '{division.Name}' has reached its maximum player limit. Your team has been placed on the waiting list.";
                    }
                }
            }
        }

        joinRequest.Status = request.Accept ? "Accepted" : "Declined";
        joinRequest.ResponseMessage = request.Message;
        joinRequest.RespondedAt = DateTime.Now;

        // Find ANY existing membership for this user and unit (regardless of status)
        var membership = await _context.EventUnitMembers
            .FirstOrDefaultAsync(m => m.UnitId == joinRequest.UnitId &&
                m.UserId == joinRequest.UserId);

        if (request.Accept)
        {
            if (membership != null)
            {
                // Update existing membership to Accepted
                membership.InviteStatus = "Accepted";
                membership.RespondedAt = DateTime.Now;

                // Generate ReferenceId if not already set
                if (string.IsNullOrEmpty(membership.ReferenceId))
                {
                    membership.ReferenceId = $"E{joinRequest.Unit!.EventId}-U{joinRequest.UnitId}-P{membership.UserId}";
                }
            }
            else
            {
                // Create new membership if not found (for legacy requests without membership record)
                var member = new EventUnitMember
                {
                    UnitId = joinRequest.UnitId,
                    UserId = joinRequest.UserId,
                    Role = "Player",
                    InviteStatus = "Accepted",
                    CreatedAt = DateTime.Now,
                    ReferenceId = $"E{joinRequest.Unit!.EventId}-U{joinRequest.UnitId}-P{joinRequest.UserId}"
                };
                _context.EventUnitMembers.Add(member);
                membership = member;
            }

            // Generate unit ReferenceId if not already set
            if (joinRequest.Unit != null && string.IsNullOrEmpty(joinRequest.Unit.ReferenceId))
            {
                joinRequest.Unit.ReferenceId = $"E{joinRequest.Unit.EventId}-U{joinRequest.UnitId}";
            }

            // Recalculate unit payment status based on all accepted members
            if (joinRequest.Unit != null)
            {
                var allMembers = await _context.EventUnitMembers
                    .Where(m => m.UnitId == joinRequest.UnitId && m.InviteStatus == "Accepted")
                    .ToListAsync();

                // Include the just-accepted member if not yet in the list
                if (!allMembers.Any(m => m.UserId == membership.UserId))
                {
                    allMembers.Add(membership);
                }

                var allMembersPaid = allMembers.All(m => m.HasPaid);
                var someMembersPaid = allMembers.Any(m => m.HasPaid);

                if (allMembersPaid && allMembers.Count > 0)
                {
                    joinRequest.Unit.PaymentStatus = "Paid";
                    joinRequest.Unit.AmountPaid = allMembers.Sum(m => m.AmountPaid);
                    joinRequest.Unit.PaidAt ??= DateTime.Now;
                }
                else if (someMembersPaid)
                {
                    joinRequest.Unit.PaymentStatus = "Partial";
                    joinRequest.Unit.AmountPaid = allMembers.Sum(m => m.AmountPaid);
                }

                joinRequest.Unit.UpdatedAt = DateTime.Now;
            }
        }
        else
        {
            // Declined - update membership status to Rejected (preserve payment info if any)
            if (membership != null)
            {
                membership.InviteStatus = "Rejected";
                membership.RespondedAt = DateTime.Now;
            }
            // Remove the join request so the user can make a new request to another team
            _context.EventUnitJoinRequests.Remove(joinRequest);
        }

        // If accepting and should be waitlisted, update unit status
        if (request.Accept && shouldWaitlist && joinRequest.Unit != null && joinRequest.Unit.Status != "Waitlisted")
        {
            joinRequest.Unit.Status = "Waitlisted";
            joinRequest.Unit.WaitlistPosition = await GetNextWaitlistPosition(joinRequest.Unit.DivisionId);
            joinRequest.Unit.UpdatedAt = DateTime.Now;
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool>
        {
            Success = true,
            Data = true,
            Warnings = waitlistMessage != null ? new List<string> { waitlistMessage } : null
        });
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
            .Include(m => m.Unit)
            .FirstOrDefaultAsync(m => m.UnitId == request.UnitId && m.UserId == userId.Value && m.InviteStatus == "Pending");

        if (membership == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Invitation not found" });

        membership.InviteStatus = request.Accept ? "Accepted" : "Declined";
        membership.RespondedAt = DateTime.Now;

        if (request.Accept)
        {
            // Generate ReferenceId if not already set
            if (string.IsNullOrEmpty(membership.ReferenceId) && membership.Unit != null)
            {
                membership.ReferenceId = $"E{membership.Unit.EventId}-U{membership.UnitId}-P{membership.UserId}";
            }

            // Generate unit ReferenceId if not already set
            if (membership.Unit != null && string.IsNullOrEmpty(membership.Unit.ReferenceId))
            {
                membership.Unit.ReferenceId = $"E{membership.Unit.EventId}-U{membership.UnitId}";
            }

            // Recalculate unit payment status based on all accepted members
            if (membership.Unit != null)
            {
                var allMembers = await _context.EventUnitMembers
                    .Where(m => m.UnitId == membership.UnitId && m.InviteStatus == "Accepted")
                    .ToListAsync();

                // Include this member (just accepted) if not yet in the list
                if (!allMembers.Any(m => m.UserId == membership.UserId))
                {
                    allMembers.Add(membership);
                }

                var allMembersPaid = allMembers.All(m => m.HasPaid);
                var someMembersPaid = allMembers.Any(m => m.HasPaid);

                if (allMembersPaid && allMembers.Count > 0)
                {
                    membership.Unit.PaymentStatus = "Paid";
                    membership.Unit.AmountPaid = allMembers.Sum(m => m.AmountPaid);
                    membership.Unit.PaidAt ??= DateTime.Now;
                }
                else if (someMembersPaid)
                {
                    membership.Unit.PaymentStatus = "Partial";
                    membership.Unit.AmountPaid = allMembers.Sum(m => m.AmountPaid);
                }

                membership.Unit.UpdatedAt = DateTime.Now;
            }
        }

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
        var hasScheduledMatches = await _context.EventEncounters
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

    /// <summary>
    /// Admin/Organizer: Break a unit apart - creates individual registrations for each member
    /// Captain stays in original unit, other members get their own units
    /// </summary>
    [Authorize]
    [HttpPost("units/{unitId}/admin-break")]
    public async Task<ActionResult<ApiResponse<object>>> AdminBreakUnit(int unitId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        var unit = await _context.EventUnits
            .Include(u => u.Event)
            .Include(u => u.Division)
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.JoinRequests)
            .FirstOrDefaultAsync(u => u.Id == unitId);

        if (unit == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Unit not found" });

        // Only site admin or event organizer can break units
        if (!await CanManageEventAsync(unit.EventId))
            return Forbid();

        // Check if unit has scheduled matches
        var hasScheduledMatches = await _context.EventEncounters
            .AnyAsync(m => (m.Unit1Id == unitId || m.Unit2Id == unitId) && m.Status != "Cancelled");

        if (hasScheduledMatches)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Cannot break unit with scheduled matches. Cancel or reassign the matches first."
            });
        }

        // Get accepted members (excluding pending/requested)
        var acceptedMembers = unit.Members
            .Where(m => m.InviteStatus == "Accepted")
            .ToList();

        if (acceptedMembers.Count <= 1)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Unit only has one member. Nothing to break apart."
            });
        }

        // Remove all join requests for this unit
        if (unit.JoinRequests.Any())
        {
            _context.EventUnitJoinRequests.RemoveRange(unit.JoinRequests);
        }

        // Remove pending/requested members (they'll need to request again)
        var pendingMembers = unit.Members
            .Where(m => m.InviteStatus != "Accepted")
            .ToList();
        if (pendingMembers.Any())
        {
            _context.EventUnitMembers.RemoveRange(pendingMembers);
        }

        // Create new units for non-captain members
        var createdUnits = new List<string>();
        var captain = acceptedMembers.FirstOrDefault(m => m.UserId == unit.CaptainUserId);
        var nonCaptainMembers = acceptedMembers.Where(m => m.UserId != unit.CaptainUserId).ToList();

        foreach (var member in nonCaptainMembers)
        {
            // Create a new unit for this member
            var memberName = Utility.FormatName(member.User?.LastName, member.User?.FirstName);
            var newUnit = new EventUnit
            {
                EventId = unit.EventId,
                DivisionId = unit.DivisionId,
                Name = memberName,
                Status = member.IsCheckedIn ? "CheckedIn" : "Registered",
                CaptainUserId = member.UserId,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            _context.EventUnits.Add(newUnit);
            await _context.SaveChangesAsync(); // Save to get ID

            // Sync member's payment data to the new unit
            newUnit.ReferenceId = $"E{unit.EventId}-U{newUnit.Id}";
            if (member.HasPaid)
            {
                newUnit.PaymentStatus = "Paid";
                newUnit.AmountPaid = member.AmountPaid;
                newUnit.PaidAt = member.PaidAt;
                newUnit.PaymentProofUrl = member.PaymentProofUrl;
                newUnit.PaymentReference = member.PaymentReference;
            }
            else if (!string.IsNullOrEmpty(member.PaymentProofUrl))
            {
                newUnit.PaymentStatus = "PendingVerification";
                newUnit.PaymentProofUrl = member.PaymentProofUrl;
                newUnit.PaymentReference = member.PaymentReference;
            }

            // Move member to new unit and make them captain
            member.UnitId = newUnit.Id;
            member.Role = "Captain";
            member.ReferenceId = $"E{unit.EventId}-U{newUnit.Id}-P{member.UserId}";

            createdUnits.Add(memberName);
        }

        // Update original unit for captain
        if (captain != null)
        {
            unit.Name = Utility.FormatName(captain.User?.LastName, captain.User?.FirstName);
            unit.Status = captain.IsCheckedIn ? "CheckedIn" : "Registered";

            // Reset unit payment to captain's individual payment data
            unit.ReferenceId = $"E{unit.EventId}-U{unit.Id}";
            if (captain.HasPaid)
            {
                unit.PaymentStatus = "Paid";
                unit.AmountPaid = captain.AmountPaid;
                unit.PaidAt = captain.PaidAt;
                unit.PaymentProofUrl = captain.PaymentProofUrl;
                unit.PaymentReference = captain.PaymentReference;
            }
            else if (!string.IsNullOrEmpty(captain.PaymentProofUrl))
            {
                unit.PaymentStatus = "PendingVerification";
                unit.AmountPaid = 0;
                unit.PaymentProofUrl = captain.PaymentProofUrl;
                unit.PaymentReference = captain.PaymentReference;
            }
            else
            {
                unit.PaymentStatus = "Pending";
                unit.AmountPaid = 0;
                unit.PaymentProofUrl = null;
                unit.PaymentReference = null;
            }

            // Update captain's member reference ID
            captain.ReferenceId = $"E{unit.EventId}-U{unit.Id}-P{captain.UserId}";
        }
        unit.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Data = new { createdUnits = createdUnits.Count },
            Message = $"Unit broken apart. {createdUnits.Count} new individual registration(s) created: {string.Join(", ", createdUnits)}"
        });
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

        // Check if user is a member of this unit or the event organizer/admin
        var isMember = unit.Members.Any(m => m.UserId == userId.Value);
        var canManage = await CanManageEventAsync(unit.EventId);

        if (!isMember && !canManage)
            return Forbid();

        // Determine which members to apply payment to
        // If MemberIds provided, use those; otherwise just the submitting user
        var acceptedMembers = unit.Members.Where(m => m.InviteStatus == "Accepted").ToList();
        List<EventUnitMember> membersToPayFor;

        if (request.MemberIds != null && request.MemberIds.Count > 0)
        {
            // Validate that all requested member IDs are valid accepted members of this unit
            membersToPayFor = acceptedMembers.Where(m => request.MemberIds.Contains(m.Id)).ToList();
            if (membersToPayFor.Count == 0)
            {
                return BadRequest(new ApiResponse<PaymentInfoDto> { Success = false, Message = "No valid members selected for payment" });
            }
        }
        else
        {
            // Default: just the submitting user
            var submitterMember = acceptedMembers.FirstOrDefault(m => m.UserId == userId.Value);
            membersToPayFor = submitterMember != null ? new List<EventUnitMember> { submitterMember } : new List<EventUnitMember>();
        }

        if (membersToPayFor.Count == 0)
        {
            return BadRequest(new ApiResponse<PaymentInfoDto> { Success = false, Message = "No members to apply payment to" });
        }

        // Calculate amount due and per-member amount
        var amountDue = (unit.Event?.RegistrationFee ?? 0m) + (unit.Division?.DivisionFee ?? 0m);
        var totalPaymentAmount = request.AmountPaid ?? 0m;
        var perMemberAmount = membersToPayFor.Count > 0 ? totalPaymentAmount / membersToPayFor.Count : 0m;

        // Generate reference ID for this payment
        var referenceId = $"E{eventId}-U{unitId}-P{userId.Value}";

        // STEP 1: Create ONE UserPayment record for the submitter (tracks total payment)
        var userPayment = new UserPayment
        {
            UserId = userId.Value, // The person who made the payment
            PaymentType = PaymentTypes.EventRegistration,
            RelatedObjectId = eventId,
            SecondaryObjectId = unitId,
            Description = $"Event registration - {unit.Event?.Name} ({membersToPayFor.Count} member{(membersToPayFor.Count > 1 ? "s" : "")})",
            Amount = totalPaymentAmount,
            PaymentProofUrl = request.PaymentProofUrl,
            PaymentReference = request.PaymentReference,
            PaymentMethod = request.PaymentMethod,
            ReferenceId = referenceId,
            Status = "Pending",
            IsApplied = true,
            AppliedAt = DateTime.Now,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _context.UserPayments.Add(userPayment);
        await _context.SaveChangesAsync(); // Save to get PaymentId

        // STEP 2: Update each member's registration with PaymentId and amount
        foreach (var member in membersToPayFor)
        {
            member.HasPaid = true;
            member.PaidAt = DateTime.Now;
            member.AmountPaid = perMemberAmount;
            member.PaymentProofUrl = request.PaymentProofUrl;
            member.PaymentReference = request.PaymentReference;
            member.PaymentMethod = request.PaymentMethod;
            member.ReferenceId = referenceId;
            member.PaymentId = userPayment.Id; // Link to the UserPayment record
        }

        await _context.SaveChangesAsync();

        // STEP 2: Update unit-level payment info
        if (!string.IsNullOrEmpty(request.PaymentProofUrl))
        {
            unit.PaymentProofUrl = request.PaymentProofUrl;
        }

        if (!string.IsNullOrEmpty(request.PaymentReference))
        {
            unit.PaymentReference = request.PaymentReference;
        }

        // Calculate total amount paid across all members
        var totalPaidByMembers = acceptedMembers.Where(m => m.HasPaid).Sum(m => m.AmountPaid);
        unit.AmountPaid = totalPaidByMembers;

        // Set reference ID on unit if not already set
        if (string.IsNullOrEmpty(unit.ReferenceId))
        {
            unit.ReferenceId = $"E{eventId}-U{unitId}";
        }

        // Auto-update payment status based on member payments
        var allMembersPaid = acceptedMembers.All(m => m.HasPaid);
        var someMembersPaid = acceptedMembers.Any(m => m.HasPaid);

        if (allMembersPaid && unit.AmountPaid >= amountDue && amountDue > 0)
        {
            unit.PaymentStatus = "Paid";
            unit.PaidAt = DateTime.Now;
        }
        else if (someMembersPaid || unit.AmountPaid > 0)
        {
            unit.PaymentStatus = "Partial";
        }
        else if (!string.IsNullOrEmpty(unit.PaymentProofUrl))
        {
            unit.PaymentStatus = "PendingVerification";
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
        var memberCount = unit.Members.Count;
        var perMemberAmount = memberCount > 0 ? amountDue / memberCount : amountDue;

        // STEP 1: Save payment records to UserPayments for each member
        foreach (var member in unit.Members)
        {
            var referenceId = $"E{eventId}-U{unitId}-P{member.UserId}";

            // Check if payment record already exists
            var existingPayment = await _context.UserPayments
                .FirstOrDefaultAsync(p => p.PaymentType == PaymentTypes.EventRegistration
                    && p.RelatedObjectId == eventId && p.SecondaryObjectId == unitId && p.UserId == member.UserId);

            if (existingPayment == null)
            {
                var userPayment = new UserPayment
                {
                    UserId = member.UserId,
                    PaymentType = PaymentTypes.EventRegistration,
                    RelatedObjectId = eventId,
                    SecondaryObjectId = unitId,
                    TertiaryObjectId = member.Id,
                    Description = $"Event registration - {unit.Event?.Name}",
                    Amount = perMemberAmount,
                    ReferenceId = referenceId,
                    Status = "Verified",
                    VerifiedByUserId = userId.Value,
                    VerifiedAt = DateTime.Now,
                    Notes = "Marked as paid by organizer",
                    IsApplied = true,
                    AppliedAt = DateTime.Now,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };
                _context.UserPayments.Add(userPayment);
            }
            else
            {
                existingPayment.Status = "Verified";
                existingPayment.VerifiedByUserId = userId.Value;
                existingPayment.VerifiedAt = DateTime.Now;
                existingPayment.IsApplied = true;
                existingPayment.AppliedAt = DateTime.Now;
                existingPayment.UpdatedAt = DateTime.Now;
            }
        }

        // STEP 2: Update registration records
        unit.PaymentStatus = "Paid";
        unit.AmountPaid = amountDue;
        unit.PaidAt = DateTime.Now;
        unit.UpdatedAt = DateTime.Now;

        // Mark all members as paid when organizer marks the whole unit as paid
        foreach (var member in unit.Members)
        {
            member.HasPaid = true;
            member.PaidAt = DateTime.Now;
            member.AmountPaid = perMemberAmount;
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

        // Update UserPayments status to Pending for all members in this unit
        var userPayments = await _context.UserPayments
            .Where(p => p.PaymentType == PaymentTypes.EventRegistration
                && p.RelatedObjectId == eventId && p.SecondaryObjectId == unitId && p.Status == "Verified")
            .ToListAsync();

        foreach (var payment in userPayments)
        {
            payment.Status = !string.IsNullOrEmpty(payment.PaymentProofUrl) ? "PendingVerification" : "Pending";
            payment.IsApplied = false;
            payment.AppliedAt = null;
            payment.VerifiedAt = null;
            payment.VerifiedByUserId = null;
            payment.UpdatedAt = DateTime.Now;
        }

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
    /// Mark a specific member as paid (organizer/admin only)
    /// </summary>
    [Authorize]
    [HttpPost("events/{eventId}/units/{unitId}/members/{memberId}/mark-paid")]
    public async Task<ActionResult<ApiResponse<MemberPaymentDto>>> MarkMemberAsPaid(int eventId, int unitId, int memberId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<MemberPaymentDto> { Success = false, Message = "Unauthorized" });

        var unit = await _context.EventUnits
            .Include(u => u.Event)
            .Include(u => u.Division)
            .Include(u => u.Members)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return NotFound(new ApiResponse<MemberPaymentDto> { Success = false, Message = "Registration not found" });

        // Only organizer or site admin can mark as paid
        var isAdmin = await IsAdminAsync();
        if (unit.Event?.OrganizedByUserId != userId.Value && !isAdmin)
            return Forbid();

        var member = unit.Members.FirstOrDefault(m => m.UserId == memberId);
        if (member == null)
            return NotFound(new ApiResponse<MemberPaymentDto> { Success = false, Message = "Member not found in unit" });

        var memberCount = unit.Members.Count;
        var amountDue = (unit.Event?.RegistrationFee ?? 0m) + (unit.Division?.DivisionFee ?? 0m);
        var perMemberAmount = memberCount > 0 ? amountDue / memberCount : amountDue;
        var referenceId = $"E{eventId}-U{unitId}-P{memberId}";

        // STEP 1: Save payment record to UserPayments first
        var existingPayment = await _context.UserPayments
            .FirstOrDefaultAsync(p => p.PaymentType == PaymentTypes.EventRegistration
                && p.RelatedObjectId == eventId && p.SecondaryObjectId == unitId && p.UserId == memberId);

        if (existingPayment == null)
        {
            var userPayment = new UserPayment
            {
                UserId = memberId,
                PaymentType = PaymentTypes.EventRegistration,
                RelatedObjectId = eventId,
                SecondaryObjectId = unitId,
                TertiaryObjectId = member.Id,
                Description = $"Event registration - {unit.Event?.Name}",
                Amount = perMemberAmount,
                ReferenceId = referenceId,
                Status = "Verified",
                VerifiedByUserId = userId.Value,
                VerifiedAt = DateTime.Now,
                Notes = "Marked as paid by organizer",
                IsApplied = true,
                AppliedAt = DateTime.Now,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            _context.UserPayments.Add(userPayment);
        }
        else
        {
            existingPayment.Status = "Verified";
            existingPayment.VerifiedByUserId = userId.Value;
            existingPayment.VerifiedAt = DateTime.Now;
            existingPayment.IsApplied = true;
            existingPayment.AppliedAt = DateTime.Now;
            existingPayment.UpdatedAt = DateTime.Now;
        }

        // STEP 2: Mark this specific member as paid
        member.HasPaid = true;
        member.PaidAt = DateTime.Now;
        member.AmountPaid = perMemberAmount;
        if (string.IsNullOrEmpty(member.ReferenceId))
        {
            member.ReferenceId = referenceId;
        }

        // Update unit-level payment status based on all members
        var allMembersPaid = unit.Members.All(m => m.HasPaid);
        var anyMemberPaid = unit.Members.Any(m => m.HasPaid);

        if (allMembersPaid)
        {
            unit.PaymentStatus = "Paid";
            unit.AmountPaid = amountDue;
            unit.PaidAt = DateTime.Now;
        }
        else if (anyMemberPaid)
        {
            unit.PaymentStatus = "Partial";
            unit.AmountPaid = unit.Members.Where(m => m.HasPaid).Sum(m => m.AmountPaid);
        }
        unit.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        // Get member user info
        var memberUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == memberId);

        return Ok(new ApiResponse<MemberPaymentDto>
        {
            Success = true,
            Data = new MemberPaymentDto
            {
                UserId = member.UserId,
                FirstName = memberUser?.FirstName,
                LastName = memberUser?.LastName,
                HasPaid = member.HasPaid,
                PaidAt = member.PaidAt,
                AmountPaid = member.AmountPaid,
                PaymentProofUrl = member.PaymentProofUrl,
                PaymentReference = member.PaymentReference,
                ReferenceId = member.ReferenceId,
                UnitPaymentStatus = unit.PaymentStatus
            },
            Message = "Member marked as paid"
        });
    }

    /// <summary>
    /// Unmark a specific member's payment (organizer/admin only)
    /// </summary>
    [Authorize]
    [HttpPost("events/{eventId}/units/{unitId}/members/{memberId}/unmark-paid")]
    public async Task<ActionResult<ApiResponse<MemberPaymentDto>>> UnmarkMemberPaid(int eventId, int unitId, int memberId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<MemberPaymentDto> { Success = false, Message = "Unauthorized" });

        var unit = await _context.EventUnits
            .Include(u => u.Event)
            .Include(u => u.Division)
            .Include(u => u.Members)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return NotFound(new ApiResponse<MemberPaymentDto> { Success = false, Message = "Registration not found" });

        // Only organizer or site admin can unmark payment
        var isAdmin = await IsAdminAsync();
        if (unit.Event?.OrganizedByUserId != userId.Value && !isAdmin)
            return Forbid();

        var member = unit.Members.FirstOrDefault(m => m.UserId == memberId);
        if (member == null)
            return NotFound(new ApiResponse<MemberPaymentDto> { Success = false, Message = "Member not found in unit" });

        // Update UserPayment status for this member
        var userPayment = await _context.UserPayments
            .FirstOrDefaultAsync(p => p.PaymentType == PaymentTypes.EventRegistration
                && p.RelatedObjectId == eventId && p.SecondaryObjectId == unitId && p.UserId == memberId && p.Status == "Verified");

        if (userPayment != null)
        {
            userPayment.Status = !string.IsNullOrEmpty(userPayment.PaymentProofUrl) ? "PendingVerification" : "Pending";
            userPayment.IsApplied = false;
            userPayment.AppliedAt = null;
            userPayment.VerifiedAt = null;
            userPayment.VerifiedByUserId = null;
            userPayment.UpdatedAt = DateTime.Now;
        }

        // Reset this member's payment
        member.HasPaid = false;
        member.PaidAt = null;
        member.AmountPaid = 0;
        // Keep ReferenceId, PaymentProofUrl, PaymentReference for records

        // Update unit-level payment status based on all members
        var allMembersPaid = unit.Members.All(m => m.HasPaid);
        var anyMemberPaid = unit.Members.Any(m => m.HasPaid);
        var amountDue = (unit.Event?.RegistrationFee ?? 0m) + (unit.Division?.DivisionFee ?? 0m);

        if (allMembersPaid)
        {
            unit.PaymentStatus = "Paid";
            unit.AmountPaid = amountDue;
        }
        else if (anyMemberPaid)
        {
            unit.PaymentStatus = "Partial";
            unit.AmountPaid = unit.Members.Where(m => m.HasPaid).Sum(m => m.AmountPaid);
        }
        else if (!string.IsNullOrEmpty(unit.PaymentProofUrl))
        {
            unit.PaymentStatus = "PendingVerification";
            unit.AmountPaid = 0;
        }
        else
        {
            unit.PaymentStatus = "Pending";
            unit.AmountPaid = 0;
        }
        unit.PaidAt = allMembersPaid ? unit.PaidAt : null;
        unit.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        // Get member user info
        var memberUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == memberId);

        return Ok(new ApiResponse<MemberPaymentDto>
        {
            Success = true,
            Data = new MemberPaymentDto
            {
                UserId = member.UserId,
                FirstName = memberUser?.FirstName,
                LastName = memberUser?.LastName,
                HasPaid = member.HasPaid,
                PaidAt = member.PaidAt,
                AmountPaid = member.AmountPaid,
                PaymentProofUrl = member.PaymentProofUrl,
                PaymentReference = member.PaymentReference,
                ReferenceId = member.ReferenceId,
                UnitPaymentStatus = unit.PaymentStatus
            },
            Message = "Member payment unmarked"
        });
    }

    /// <summary>
    /// Apply a member's existing payment to other teammates (organizer/admin only)
    /// Copies payment proof and reference, splits amount among all selected members
    /// </summary>
    [Authorize]
    [HttpPost("events/{eventId}/units/{unitId}/members/{memberId}/apply-to-teammates")]
    public async Task<ActionResult<ApiResponse<object>>> ApplyPaymentToTeammates(
        int eventId, int unitId, int memberId, [FromBody] ApplyPaymentToTeammatesRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        if (request.TargetMemberIds == null || request.TargetMemberIds.Count == 0)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "No target members specified" });

        var unit = await _context.EventUnits
            .Include(u => u.Event)
            .Include(u => u.Division)
            .Include(u => u.Members)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Registration not found" });

        // Only organizer or site admin can apply payment to teammates
        var isAdmin = await IsAdminAsync();
        if (unit.Event?.OrganizedByUserId != userId.Value && !isAdmin)
            return Forbid();

        // Get the source member (whose payment we're copying)
        var sourceMember = unit.Members.FirstOrDefault(m => m.UserId == memberId);
        if (sourceMember == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Source member not found" });

        if (!sourceMember.HasPaid)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Source member has not paid yet" });

        // Get accepted members only
        var acceptedMembers = unit.Members.Where(m => m.InviteStatus == "Accepted").ToList();

        // Validate target members exist and are unpaid
        var targetMembers = acceptedMembers
            .Where(m => request.TargetMemberIds.Contains(m.UserId) && m.UserId != memberId && !m.HasPaid)
            .ToList();

        if (targetMembers.Count == 0)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "No valid unpaid teammates to apply payment to" });

        // Calculate amounts
        var amountDue = (unit.Event?.RegistrationFee ?? 0m) + (unit.Division?.DivisionFee ?? 0m);
        var totalMembersBeingCovered = targetMembers.Count + 1; // targets + source member
        var perMemberAmount = amountDue / acceptedMembers.Count;

        // If redistributing, update source member's amount
        if (request.RedistributeAmount)
        {
            sourceMember.AmountPaid = perMemberAmount;
        }

        // Get the PaymentId from the source member (they should have one if they paid)
        var sourcePaymentId = sourceMember.PaymentId;

        var appliedCount = 0;

        foreach (var targetMember in targetMembers)
        {
            // Update target member's payment info - link to same PaymentId as source
            targetMember.HasPaid = true;
            targetMember.PaidAt = DateTime.Now;
            targetMember.AmountPaid = perMemberAmount;
            targetMember.PaymentProofUrl = sourceMember.PaymentProofUrl;
            targetMember.PaymentReference = sourceMember.PaymentReference;
            targetMember.ReferenceId = sourceMember.ReferenceId;
            targetMember.PaymentId = sourcePaymentId; // Link to same UserPayment as source

            appliedCount++;
        }

        // Update unit-level payment status
        var allMembersPaid = acceptedMembers.All(m => m.HasPaid);
        var totalPaidAmount = acceptedMembers.Where(m => m.HasPaid).Sum(m => m.AmountPaid);

        if (allMembersPaid)
        {
            unit.PaymentStatus = "Paid";
            unit.AmountPaid = totalPaidAmount;
            unit.PaidAt = DateTime.Now;
        }
        else
        {
            unit.PaymentStatus = "Partial";
            unit.AmountPaid = totalPaidAmount;
        }
        unit.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Data = new { appliedCount, unitPaymentStatus = unit.PaymentStatus },
            Message = $"Payment applied to {appliedCount} teammate{(appliedCount > 1 ? "s" : "")}"
        });
    }

    /// <summary>
    /// Update a member's payment info (organizer/admin only)
    /// </summary>
    [Authorize]
    [HttpPut("events/{eventId}/units/{unitId}/members/{memberId}/payment")]
    public async Task<ActionResult<ApiResponse<MemberPaymentDto>>> UpdateMemberPayment(
        int eventId, int unitId, int memberId, [FromBody] UpdateMemberPaymentRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<MemberPaymentDto> { Success = false, Message = "Unauthorized" });

        var unit = await _context.EventUnits
            .Include(u => u.Event)
            .Include(u => u.Division)
            .Include(u => u.Members)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return NotFound(new ApiResponse<MemberPaymentDto> { Success = false, Message = "Registration not found" });

        // Only organizer or site admin can update payment info
        var isAdmin = await IsAdminAsync();
        if (unit.Event?.OrganizedByUserId != userId.Value && !isAdmin)
            return Forbid();

        var member = unit.Members.FirstOrDefault(m => m.UserId == memberId);
        if (member == null)
            return NotFound(new ApiResponse<MemberPaymentDto> { Success = false, Message = "Member not found in unit" });

        // Update member payment fields
        if (request.PaymentReference != null)
            member.PaymentReference = request.PaymentReference;
        if (request.PaymentProofUrl != null)
            member.PaymentProofUrl = request.PaymentProofUrl;
        if (request.PaymentMethod != null)
            member.PaymentMethod = request.PaymentMethod;
        if (request.AmountPaid.HasValue)
            member.AmountPaid = request.AmountPaid.Value;
        if (request.ReferenceId != null)
            member.ReferenceId = request.ReferenceId;

        // If marking as paid
        if (request.HasPaid.HasValue)
        {
            member.HasPaid = request.HasPaid.Value;
            if (request.HasPaid.Value && !member.PaidAt.HasValue)
            {
                member.PaidAt = DateTime.Now;
            }
            else if (!request.HasPaid.Value)
            {
                member.PaidAt = null;
            }
        }

        // Update unit-level payment status based on all members
        var allMembersPaid = unit.Members.All(m => m.HasPaid);
        var anyMemberPaid = unit.Members.Any(m => m.HasPaid);
        var amountDue = (unit.Event?.RegistrationFee ?? 0m) + (unit.Division?.DivisionFee ?? 0m);

        if (allMembersPaid)
        {
            unit.PaymentStatus = "Paid";
            unit.AmountPaid = amountDue;
            unit.PaidAt = DateTime.Now;
        }
        else if (anyMemberPaid)
        {
            unit.PaymentStatus = "Partial";
            unit.AmountPaid = unit.Members.Where(m => m.HasPaid).Sum(m => m.AmountPaid);
        }
        else if (unit.Members.Any(m => !string.IsNullOrEmpty(m.PaymentProofUrl)))
        {
            unit.PaymentStatus = "PendingVerification";
            unit.AmountPaid = 0;
        }
        else
        {
            unit.PaymentStatus = "Pending";
            unit.AmountPaid = 0;
        }
        unit.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        // Get member user info
        var memberUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == memberId);

        return Ok(new ApiResponse<MemberPaymentDto>
        {
            Success = true,
            Data = new MemberPaymentDto
            {
                UserId = member.UserId,
                FirstName = memberUser?.FirstName,
                LastName = memberUser?.LastName,
                HasPaid = member.HasPaid,
                PaidAt = member.PaidAt,
                AmountPaid = member.AmountPaid,
                PaymentProofUrl = member.PaymentProofUrl,
                PaymentReference = member.PaymentReference,
                ReferenceId = member.ReferenceId,
                UnitPaymentStatus = unit.PaymentStatus
            },
            Message = "Payment info updated"
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
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Unit not found" });

        var member = unit.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Member not found in unit" });

        var acceptedMembers = unit.Members.Where(m => m.InviteStatus == "Accepted").ToList();
        var isOnlyMember = acceptedMembers.Count <= 1;
        var memberHasPayment = member.HasPaid || member.AmountPaid > 0 || !string.IsNullOrEmpty(member.PaymentProofUrl);

        if (isOnlyMember)
        {
            // Only member in the unit - check if we can delete the unit
            if (memberHasPayment)
            {
                return BadRequest(new ApiResponse<bool>
                {
                    Success = false,
                    Message = "Cannot remove last member with payment records. Cancel payment first or use a different method."
                });
            }

            // No payment - safe to delete the unit entirely
            try
            {
                // Remove any game player assignments for this unit
                var gamePlayers = await _context.EventGamePlayers
                    .Where(p => p.UnitId == unitId)
                    .ToListAsync();
                if (gamePlayers.Any())
                    _context.EventGamePlayers.RemoveRange(gamePlayers);

                // Remove any match player assignments for this unit
                var matchPlayers = await _context.EncounterMatchPlayers
                    .Where(p => p.UnitId == unitId)
                    .ToListAsync();
                if (matchPlayers.Any())
                    _context.EncounterMatchPlayers.RemoveRange(matchPlayers);

                // Check if unit is referenced in any encounters
                var encountersWithUnit = await _context.EventEncounters
                    .Where(e => e.Unit1Id == unitId || e.Unit2Id == unitId)
                    .ToListAsync();
                if (encountersWithUnit.Any())
                {
                    // Can't delete if unit is part of scheduled matches
                    return BadRequest(new ApiResponse<bool>
                    {
                        Success = false,
                        Message = "Cannot remove registration - unit has scheduled matches. Remove matches first or contact administrator."
                    });
                }

                // Remove any pending join requests for this unit
                var joinRequests = await _context.EventUnitJoinRequests
                    .Where(jr => jr.UnitId == unitId)
                    .ToListAsync();
                if (joinRequests.Any())
                    _context.EventUnitJoinRequests.RemoveRange(joinRequests);

                // Remove all members (including pending ones)
                _context.EventUnitMembers.RemoveRange(unit.Members);
                _context.EventUnits.Remove(unit);

                await _context.SaveChangesAsync();
                return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Registration cancelled" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing registration for unit {UnitId} in event {EventId}", unitId, eventId);
                return StatusCode(500, new ApiResponse<bool>
                {
                    Success = false,
                    Message = "Failed to remove registration due to database constraints. The unit may have related records (games, matches) that need to be removed first."
                });
            }
        }
        else
        {
            // Has other members - create a new individual unit for the removed member
            var memberName = Utility.FormatName(member.User?.LastName, member.User?.FirstName);
            var newUnit = new EventUnit
            {
                EventId = unit.EventId,
                DivisionId = unit.DivisionId,
                Name = memberName,
                Status = member.IsCheckedIn ? "CheckedIn" : "Registered",
                CaptainUserId = member.UserId,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            _context.EventUnits.Add(newUnit);
            await _context.SaveChangesAsync(); // Save to get ID

            // Set new unit's ReferenceId and sync member's payment data to unit level
            newUnit.ReferenceId = $"E{unit.EventId}-U{newUnit.Id}";
            if (member.HasPaid)
            {
                newUnit.PaymentStatus = "Paid";
                newUnit.AmountPaid = member.AmountPaid;
                newUnit.PaidAt = member.PaidAt;
                newUnit.PaymentProofUrl = member.PaymentProofUrl;
                newUnit.PaymentReference = member.PaymentReference;
            }
            else if (!string.IsNullOrEmpty(member.PaymentProofUrl))
            {
                newUnit.PaymentStatus = "PendingVerification";
                newUnit.PaymentProofUrl = member.PaymentProofUrl;
                newUnit.PaymentReference = member.PaymentReference;
            }

            // Move member to new unit and make them captain
            member.UnitId = newUnit.Id;
            member.Role = "Captain";
            member.ReferenceId = $"E{unit.EventId}-U{newUnit.Id}-P{member.UserId}";

            // If removed member was captain of old unit, transfer captaincy
            if (unit.CaptainUserId == userId)
            {
                var newCaptain = acceptedMembers.FirstOrDefault(m => m.UserId != userId);
                if (newCaptain != null)
                {
                    unit.CaptainUserId = newCaptain.UserId;
                    newCaptain.Role = "Captain";
                }
            }

            // Update old unit name if it was using the removed member's name
            if (unit.Name == memberName)
            {
                var remainingCaptain = acceptedMembers.FirstOrDefault(m => m.UserId != userId);
                if (remainingCaptain != null)
                {
                    unit.Name = Utility.FormatName(remainingCaptain.User?.LastName, remainingCaptain.User?.FirstName);
                }
            }

            // Recalculate old unit's payment status
            var remainingMembers = acceptedMembers.Where(m => m.UserId != userId).ToList();
            var allPaid = remainingMembers.All(m => m.HasPaid);
            var somePaid = remainingMembers.Any(m => m.HasPaid);

            if (allPaid && remainingMembers.Count > 0)
            {
                unit.PaymentStatus = "Paid";
                unit.AmountPaid = remainingMembers.Sum(m => m.AmountPaid);
            }
            else if (somePaid)
            {
                unit.PaymentStatus = "Partial";
                unit.AmountPaid = remainingMembers.Sum(m => m.AmountPaid);
            }
            else
            {
                unit.PaymentStatus = "Pending";
                unit.AmountPaid = 0;
            }

            unit.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = $"{memberName} now has their own registration" });
        }
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
    /// Allow a player to move themselves to a different division.
    /// Handles leaving current unit and either creating new unit or joining existing one.
    /// </summary>
    [Authorize]
    [HttpPost("events/{eventId}/self-move-division")]
    public async Task<ActionResult<ApiResponse<EventUnitDto>>> SelfMoveToDivision(int eventId, [FromBody] SelfMoveDivisionRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<EventUnitDto> { Success = false, Message = "Unauthorized" });

        var evt = await _context.Events
            .Include(e => e.Divisions)
                .ThenInclude(d => d.TeamUnit)
            .FirstOrDefaultAsync(e => e.Id == eventId && e.IsActive);
        if (evt == null)
            return NotFound(new ApiResponse<EventUnitDto> { Success = false, Message = "Event not found" });

        // Verify target division exists
        var targetDivision = evt.Divisions.FirstOrDefault(d => d.Id == request.NewDivisionId && d.IsActive);
        if (targetDivision == null)
            return NotFound(new ApiResponse<EventUnitDto> { Success = false, Message = "Target division not found" });

        // Find user's current unit in this event
        var currentMembership = await _context.EventUnitMembers
            .Include(m => m.Unit)
                .ThenInclude(u => u.Members)
            .FirstOrDefaultAsync(m => m.UserId == userId.Value &&
                m.Unit!.EventId == eventId &&
                m.Unit.Status != "Cancelled" &&
                m.InviteStatus == "Accepted");

        if (currentMembership == null)
            return BadRequest(new ApiResponse<EventUnitDto> { Success = false, Message = "You are not registered for this event" });

        var currentUnit = currentMembership.Unit!;

        // Check if already in target division
        if (currentUnit.DivisionId == request.NewDivisionId)
            return BadRequest(new ApiResponse<EventUnitDto> { Success = false, Message = "You are already in this division" });

        // Check if already registered in target division
        var alreadyInTarget = await _context.EventUnitMembers
            .Include(m => m.Unit)
            .AnyAsync(m => m.UserId == userId.Value &&
                m.Unit!.DivisionId == request.NewDivisionId &&
                m.Unit.Status != "Cancelled" &&
                m.InviteStatus == "Accepted");
        if (alreadyInTarget)
            return BadRequest(new ApiResponse<EventUnitDto> { Success = false, Message = "You are already registered in the target division" });

        EventUnit? targetUnit = null;
        var teamSize = targetDivision.TeamUnit?.TotalPlayers ?? 2;

        // Option 1: Join an existing unit
        if (request.JoinUnitId.HasValue)
        {
            targetUnit = await _context.EventUnits
                .Include(u => u.Members)
                .Include(u => u.Division)
                    .ThenInclude(d => d!.TeamUnit)
                .FirstOrDefaultAsync(u => u.Id == request.JoinUnitId.Value &&
                    u.DivisionId == request.NewDivisionId &&
                    u.Status != "Cancelled");

            if (targetUnit == null)
                return NotFound(new ApiResponse<EventUnitDto> { Success = false, Message = "Target unit not found in that division" });

            var targetTeamSize = targetUnit.Division?.TeamUnit?.TotalPlayers ?? 2;
            var acceptedMembers = targetUnit.Members.Count(m => m.InviteStatus == "Accepted");
            if (acceptedMembers >= targetTeamSize)
                return BadRequest(new ApiResponse<EventUnitDto> { Success = false, Message = "Target unit is already full" });
        }

        // Remove player from current unit
        _context.EventUnitMembers.Remove(currentMembership);

        // Handle current unit after player leaves
        var remainingMembers = currentUnit.Members.Where(m => m.Id != currentMembership.Id && m.InviteStatus == "Accepted").ToList();
        if (remainingMembers.Count == 0)
        {
            // No members left - delete the unit
            currentUnit.Status = "Cancelled";
        }
        else if (currentUnit.CaptainUserId == userId.Value)
        {
            // Player was captain - assign new captain to first remaining member
            currentUnit.CaptainUserId = remainingMembers.First().UserId;
        }

        // Option 1: Join existing unit
        if (targetUnit != null)
        {
            var newMembership = new EventUnitMember
            {
                UnitId = targetUnit.Id,
                UserId = userId.Value,
                Role = "Player",
                InviteStatus = "Accepted",
                CreatedAt = DateTime.Now
            };
            _context.EventUnitMembers.Add(newMembership);

            await _context.SaveChangesAsync();

            // Reload for response
            targetUnit = await _context.EventUnits
                .Include(u => u.Members).ThenInclude(m => m.User)
                .Include(u => u.Division).ThenInclude(d => d!.TeamUnit)
                .Include(u => u.Captain)
                .Include(u => u.Event)
                .FirstOrDefaultAsync(u => u.Id == targetUnit.Id);

            return Ok(new ApiResponse<EventUnitDto>
            {
                Success = true,
                Data = MapToUnitDto(targetUnit!),
                Message = "Successfully moved to new division and joined existing team"
            });
        }

        // Option 2: Create a new unit
        var newUnit = new EventUnit
        {
            EventId = eventId,
            DivisionId = request.NewDivisionId,
            Name = request.NewUnitName,
            CaptainUserId = userId.Value,
            Status = "Registered",
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };
        _context.EventUnits.Add(newUnit);
        await _context.SaveChangesAsync();

        // Add player as member
        var captainMembership = new EventUnitMember
        {
            UnitId = newUnit.Id,
            UserId = userId.Value,
            Role = "Captain",
            InviteStatus = "Accepted",
            CreatedAt = DateTime.Now
        };
        _context.EventUnitMembers.Add(captainMembership);
        await _context.SaveChangesAsync();

        // Reload for response
        newUnit = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Include(u => u.Division).ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Captain)
            .Include(u => u.Event)
            .FirstOrDefaultAsync(u => u.Id == newUnit.Id);

        return Ok(new ApiResponse<EventUnitDto>
        {
            Success = true,
            Data = MapToUnitDto(newUnit!),
            Message = "Successfully moved to new division with new team"
        });
    }

    /// <summary>
    /// Get incomplete units in a division that a player can join
    /// </summary>
    [Authorize]
    [HttpGet("events/{eventId}/divisions/{divisionId}/joinable-units")]
    public async Task<ActionResult<ApiResponse<List<EventUnitDto>>>> GetJoinableUnits(int eventId, int divisionId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<List<EventUnitDto>> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions
            .Include(d => d.TeamUnit)
            .FirstOrDefaultAsync(d => d.Id == divisionId && d.EventId == eventId && d.IsActive);

        if (division == null)
            return NotFound(new ApiResponse<List<EventUnitDto>> { Success = false, Message = "Division not found" });

        var teamSize = division.TeamUnit?.TotalPlayers ?? 2;

        // Find units that are incomplete (fewer accepted members than team size)
        var units = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Include(u => u.Division).ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Captain)
            .Where(u => u.DivisionId == divisionId &&
                u.EventId == eventId &&
                u.Status != "Cancelled" &&
                u.Members.Count(m => m.InviteStatus == "Accepted") < teamSize)
            .OrderBy(u => u.CreatedAt)
            .ToListAsync();

        return Ok(new ApiResponse<List<EventUnitDto>>
        {
            Success = true,
            Data = units.Select(MapToUnitDto).ToList()
        });
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
                .ThenInclude(g => g!.EncounterMatch)
                    .ThenInclude(m => m!.Encounter)
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

    /// <summary>
    /// Bulk create multiple courts at once
    /// </summary>
    [Authorize]
    [HttpPost("events/{eventId}/courts/bulk")]
    public async Task<ActionResult<ApiResponse<List<TournamentCourtDto>>>> BulkCreateCourts(int eventId, [FromBody] BulkCreateCourtsRequest request)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<List<TournamentCourtDto>> { Success = false, Message = "Event not found" });

        if (request.NumberOfCourts <= 0 || request.NumberOfCourts > 100)
            return BadRequest(new ApiResponse<List<TournamentCourtDto>> { Success = false, Message = "Number of courts must be between 1 and 100" });

        // Get the current max sort order
        var maxSortOrder = await _context.TournamentCourts
            .Where(c => c.EventId == eventId)
            .MaxAsync(c => (int?)c.SortOrder) ?? 0;

        var prefix = string.IsNullOrWhiteSpace(request.LabelPrefix) ? "Court" : request.LabelPrefix.Trim();
        var courts = new List<TournamentCourt>();

        for (int i = 0; i < request.NumberOfCourts; i++)
        {
            var courtNumber = request.StartingNumber + i;
            var court = new TournamentCourt
            {
                EventId = eventId,
                CourtLabel = $"{prefix} {courtNumber}",
                SortOrder = maxSortOrder + i + 1,
                Status = "Available",
                IsActive = true
            };
            courts.Add(court);
            _context.TournamentCourts.Add(court);
        }

        await _context.SaveChangesAsync();

        var result = courts.Select(c => new TournamentCourtDto
        {
            Id = c.Id,
            EventId = c.EventId,
            CourtLabel = c.CourtLabel,
            Status = c.Status,
            SortOrder = c.SortOrder
        }).ToList();

        return Ok(new ApiResponse<List<TournamentCourtDto>>
        {
            Success = true,
            Data = result,
            Message = $"Created {courts.Count} court{(courts.Count > 1 ? "s" : "")}"
        });
    }

    // ============================================
    // Match Scheduling
    // ============================================

    [Authorize]
    [HttpPost("divisions/{divisionId}/generate-schedule")]
    public async Task<ActionResult<ApiResponse<List<EventMatchDto>>>> GenerateSchedule(int divisionId, [FromBody] CreateMatchScheduleRequest request)
    {
        try
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
        var existingMatches = await _context.EventEncounters
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .Where(m => m.DivisionId == divisionId)
            .ToListAsync();

        if (existingMatches.Any())
        {
            // Clear TournamentCourt references to games in this division first
            // Using a subquery approach to avoid OPENJSON issues with List.Contains()
            var courtsWithGames = await _context.TournamentCourts
                .Where(c => c.CurrentGameId != null &&
                    _context.EventGames.Any(g => g.Id == c.CurrentGameId &&
                        _context.EncounterMatches.Any(em => em.Id == g.EncounterMatchId &&
                            _context.EventEncounters.Any(m => m.Id == em.EncounterId && m.DivisionId == divisionId))))
                .ToListAsync();

            foreach (var court in courtsWithGames)
            {
                court.CurrentGameId = null;
                court.Status = "Available";
            }

            // Get all game IDs for this division to delete score history first
            var gameIds = existingMatches
                .SelectMany(e => e.Matches)
                .SelectMany(m => m.Games)
                .Select(g => g.Id)
                .ToList();

            // Delete score history for these games (must be done before deleting games due to FK constraint)
            if (gameIds.Any())
            {
                try
                {
                    var scoreHistories = await _context.EventGameScoreHistories
                        .Where(h => gameIds.Contains(h.GameId))
                        .ToListAsync();
                    if (scoreHistories.Any())
                    {
                        _context.EventGameScoreHistories.RemoveRange(scoreHistories);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Could not delete score histories for division {DivisionId} - table may not exist", divisionId);
                }
            }

            // Delete games first, then matches
            foreach (var encounter in existingMatches)
            {
                var allGames = encounter.Matches.SelectMany(m => m.Games).ToList();
                _context.EventGames.RemoveRange(allGames);
                _context.EncounterMatches.RemoveRange(encounter.Matches);
            }
            _context.EventEncounters.RemoveRange(existingMatches);
            await _context.SaveChangesAsync();
        }

        // Also clear unit number assignments since schedule is being regenerated
        foreach (var unit in units)
        {
            unit.UnitNumber = null;
            unit.PoolNumber = null;
            unit.PoolName = null;
        }

        var matches = new List<EventEncounter>();

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

        _context.EventEncounters.AddRange(matches);
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

        // Create EncounterMatch and games for each encounter based on phase
        foreach (var encounter in matches)
        {
            // Determine if this is a pool match or playoff match
            var isPoolMatch = encounter.RoundType == "Pool";
            var gamesPerMatch = isPoolMatch ? poolGamesPerMatch : playoffGamesPerMatch;
            var scoreFormatId = isPoolMatch ? poolScoreFormatId : playoffScoreFormatId;

            // Update encounter with correct games per match
            encounter.BestOf = gamesPerMatch;
            encounter.ScoreFormatId = scoreFormatId;

            // Create default EncounterMatch for simple divisions (MatchesPerEncounter=1)
            var encounterMatch = new EncounterMatch
            {
                EncounterId = encounter.Id,
                MatchOrder = 1,
                Status = "Scheduled",
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            _context.EncounterMatches.Add(encounterMatch);
        }
        await _context.SaveChangesAsync();

        // Now create games for each EncounterMatch
        foreach (var encounter in matches)
        {
            var isPoolMatch = encounter.RoundType == "Pool";
            var gamesPerMatch = isPoolMatch ? poolGamesPerMatch : playoffGamesPerMatch;
            var scoreFormatId = isPoolMatch ? poolScoreFormatId : playoffScoreFormatId;

            // Get the EncounterMatch we just created
            var encounterMatch = await _context.EncounterMatches
                .FirstOrDefaultAsync(m => m.EncounterId == encounter.Id);

            if (encounterMatch != null)
            {
                for (int g = 1; g <= gamesPerMatch; g++)
                {
                    var game = new EventGame
                    {
                        EncounterMatchId = encounterMatch.Id,
                        GameNumber = g,
                        ScoreFormatId = scoreFormatId,
                        Status = "New",
                        CreatedAt = DateTime.Now,
                        UpdatedAt = DateTime.Now
                    };
                    _context.EventGames.Add(game);
                }
            }
        }
        await _context.SaveChangesAsync();

        // Reload with games
        var result = await _context.EventEncounters
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .Where(m => m.DivisionId == divisionId)
            .OrderBy(m => m.RoundNumber)
            .ThenBy(m => m.EncounterNumber)
            .ToListAsync();

        return Ok(new ApiResponse<List<EventMatchDto>>
        {
            Success = true,
            Data = result.Select(m => MapToMatchDto(m)).ToList()
        });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating schedule for division {DivisionId}", divisionId);
            var innerMessage = ex.InnerException?.Message ?? "";
            var fullMessage = string.IsNullOrEmpty(innerMessage)
                ? ex.Message
                : $"{ex.Message} Inner: {innerMessage}";
            return StatusCode(500, new ApiResponse<List<EventMatchDto>>
            {
                Success = false,
                Message = $"Error generating schedule: {fullMessage}",
                Data = null
            });
        }
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
        var matches = await _context.EventEncounters
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
            .Include(d => d.Event).ThenInclude(e => e!.DefaultScoreFormat)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<ScheduleExportDto> { Success = false, Message = "Division not found" });

        var matches = await _context.EventEncounters
            .Include(m => m.Unit1)
            .Include(m => m.Unit2)
            .Include(m => m.Winner)
            .Include(m => m.Matches).ThenInclude(match => match.Games).ThenInclude(game => game.TournamentCourt)
            .Where(m => m.DivisionId == divisionId)
            .OrderBy(m => m.RoundType)
            .ThenBy(m => m.RoundNumber)
            .ThenBy(m => m.EncounterNumber)
            .ToListAsync();

        // Get pool count from division settings or infer from encounters
        var poolEncounters = matches.Where(m => m.RoundType == "Pool").ToList();
        var poolCount = poolEncounters.Any()
            ? poolEncounters.Max(m => m.RoundNumber)
            : division.PoolCount ?? 2; // Default to 2 pools if not specified

        // Extract pool assignments from pool encounters as fallback (for units without UnitNumber)
        var unitPoolAssignmentsFromEncounters = new Dictionary<int, (int PoolNumber, string PoolName)>();
        foreach (var enc in poolEncounters)
        {
            var poolNum = enc.RoundNumber;
            var poolName = enc.RoundName ?? $"Pool {(char)('A' + poolNum - 1)}";

            if (enc.Unit1Id.HasValue && !unitPoolAssignmentsFromEncounters.ContainsKey(enc.Unit1Id.Value))
                unitPoolAssignmentsFromEncounters[enc.Unit1Id.Value] = (poolNum, poolName);
            if (enc.Unit2Id.HasValue && !unitPoolAssignmentsFromEncounters.ContainsKey(enc.Unit2Id.Value))
                unitPoolAssignmentsFromEncounters[enc.Unit2Id.Value] = (poolNum, poolName);
        }

        // Include members to show team composition
        // Order: pool number, then by matches won (for standings after games), then by point differential, then by unit number (for drawing results)
        var units = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled")
            .OrderBy(u => u.PoolNumber)
            .ThenByDescending(u => u.MatchesWon)
            .ThenByDescending(u => u.PointsScored - u.PointsAgainst)
            .ThenBy(u => u.UnitNumber)
            .ToListAsync();

        // Apply pool assignments to units (for display purposes)
        // Priority: 1) Calculate from UnitNumber (deterministic), 2) From encounters (fallback)
        foreach (var unit in units)
        {
            if (!unit.PoolNumber.HasValue || unit.PoolNumber == 0)
            {
                // Calculate pool from UnitNumber if available (most reliable)
                // Pool assignment: odd UnitNumbers to Pool 1, even to Pool 2 (for 2 pools)
                // General formula: ((UnitNumber - 1) % poolCount) + 1
                if (unit.UnitNumber.HasValue && unit.UnitNumber > 0 && poolCount > 0)
                {
                    var calculatedPool = ((unit.UnitNumber.Value - 1) % poolCount) + 1;
                    unit.PoolNumber = calculatedPool;
                    unit.PoolName = $"Pool {(char)('A' + calculatedPool - 1)}";
                }
                // Fallback to encounter-derived pool info
                else if (unitPoolAssignmentsFromEncounters.TryGetValue(unit.Id, out var poolInfo))
                {
                    unit.PoolNumber = poolInfo.PoolNumber;
                    unit.PoolName = poolInfo.PoolName;
                }
            }
        }

        // Re-sort units after applying pool assignments
        units = units
            .OrderBy(u => u.PoolNumber ?? 99)
            .ThenByDescending(u => u.MatchesWon)
            .ThenByDescending(u => u.PointsScored - u.PointsAgainst)
            .ThenBy(u => u.UnitNumber)
            .ToList();

        // Build lookup for unit pool/rank info (for playoff seed descriptions)
        var unitPoolInfo = new Dictionary<int, (string PoolName, int Rank)>();
        var poolGroups = units.GroupBy(u => u.PoolNumber ?? 0).OrderBy(g => g.Key);
        foreach (var poolGroup in poolGroups)
        {
            var poolName = poolGroup.First().PoolName ?? $"Pool {poolGroup.Key}";
            int rank = 1;
            foreach (var unit in poolGroup)
            {
                if (unit.Id > 0)
                    unitPoolInfo[unit.Id] = (poolName, rank);
                rank++;
            }
        }

        // Build lookup for unit display names (FirstName1 + FirstName2 for pairs)
        var unitDisplayNames = units.ToDictionary(
            u => u.Id,
            u => Utility.FormatUnitDisplayName(u.Members, u.Name)
        );

        // Helper to get display name for a unit
        string? GetUnitDisplayName(int? unitId)
        {
            if (!unitId.HasValue || !unitDisplayNames.ContainsKey(unitId.Value))
                return null;
            return unitDisplayNames[unitId.Value];
        }

        // Helper to get seed info for a unit in playoff matches
        string? GetSeedInfo(int? unitId)
        {
            if (!unitId.HasValue || !unitPoolInfo.ContainsKey(unitId.Value))
                return null;
            var info = unitPoolInfo[unitId.Value];
            return $"{info.PoolName} #{info.Rank}";
        }

        // Build court lookup for games - load all courts for this event to avoid EF Core CTE issue with Contains()
        var courts = await _context.TournamentCourts
            .Where(c => c.EventId == division.EventId)
            .ToDictionaryAsync(c => c.Id, c => c.CourtLabel);

        // Helper to get court label for an encounter
        string? GetCourtLabel(EventEncounter encounter)
        {
            var game = encounter.Matches
                .SelectMany(em => em.Games)
                .FirstOrDefault(g => g.TournamentCourtId.HasValue);
            if (game?.TournamentCourtId != null && courts.TryGetValue(game.TournamentCourtId.Value, out var label))
                return label;
            return null;
        }

        var schedule = new ScheduleExportDto
        {
            DivisionId = divisionId,
            DivisionName = division.Name,
            EventName = division.Event?.Name ?? "",
            ScheduleType = division.ScheduleType,
            PlayoffFromPools = division.PlayoffFromPools,
            MatchesPerEncounter = division.MatchesPerEncounter,
            GamesPerMatch = division.GamesPerMatch,
            DefaultScoreFormat = division.Event?.DefaultScoreFormat?.Name,
            ExportedAt = DateTime.Now,
            Rounds = matches
                // Include all matches - show position numbers before drawing, team names after
                .GroupBy(m => new { m.RoundType, m.RoundNumber, m.RoundName })
                .OrderBy(g => g.Key.RoundType == "Pool" ? 0 : (g.Key.RoundType == "Bracket" || g.Key.RoundType == RoundType.ThirdPlace) ? 1 : 2)
                .ThenBy(g => g.Key.RoundNumber)
                .Select(g => new ScheduleRoundDto
                {
                    RoundType = g.Key.RoundType,
                    RoundNumber = g.Key.RoundNumber,
                    RoundName = g.Key.RoundName,
                    Matches = g.Select(m => new ScheduleMatchDto
                    {
                        EncounterId = m.Id,
                        MatchNumber = m.MatchNumber,
                        Unit1Number = m.Unit1Number,
                        Unit2Number = m.Unit2Number,
                        Unit1Name = GetUnitDisplayName(m.Unit1Id) ?? m.Unit1?.Name,
                        Unit2Name = GetUnitDisplayName(m.Unit2Id) ?? m.Unit2?.Name,
                        // Add seed info for playoff (Bracket) and bronze medal (ThirdPlace) matches
                        // Use stored seed label if unit not assigned yet, otherwise calculate from pool position
                        Unit1SeedInfo = (g.Key.RoundType == "Bracket" || g.Key.RoundType == RoundType.ThirdPlace)
                            ? (m.Unit1Id == null ? m.Unit1SeedLabel : GetSeedInfo(m.Unit1Id))
                            : null,
                        Unit2SeedInfo = (g.Key.RoundType == "Bracket" || g.Key.RoundType == RoundType.ThirdPlace)
                            ? (m.Unit2Id == null ? m.Unit2SeedLabel : GetSeedInfo(m.Unit2Id))
                            : null,
                        IsBye = (m.Unit1Id == null) != (m.Unit2Id == null), // One but not both is null
                        CourtLabel = GetCourtLabel(m),
                        ScheduledTime = m.ScheduledTime,
                        StartedAt = m.StartedAt,
                        CompletedAt = m.CompletedAt,
                        Status = m.Status,
                        Score = GetMatchScore(m),
                        WinnerName = GetUnitDisplayName(m.WinnerUnitId) ?? m.Winner?.Name,
                        Games = m.Matches.SelectMany(match => match.Games).OrderBy(game => game.GameNumber).Select(game => new ScheduleGameDto
                        {
                            GameId = game.Id,
                            GameNumber = game.GameNumber,
                            Unit1Score = game.Unit1Score,
                            Unit2Score = game.Unit2Score,
                            TournamentCourtId = game.TournamentCourtId,
                            CourtLabel = game.TournamentCourtId.HasValue && courts.TryGetValue(game.TournamentCourtId.Value, out var courtLabel) ? courtLabel : null,
                            Status = game.Status,
                            StartedAt = game.StartedAt,
                            CompletedAt = game.FinishedAt
                        }).ToList()
                    }).ToList()
                }).ToList(),
            // Group by PoolName first (if set), then by PoolNumber as fallback
            // This handles cases where PoolName is set but PoolNumber is null
            PoolStandings = units.GroupBy(u => u.PoolName ?? $"Pool {u.PoolNumber ?? 0}")
                .OrderBy(g => g.First().PoolNumber ?? 0)
                .ThenBy(g => g.Key)
                .Select(g => new PoolStandingsDto
                {
                    PoolNumber = g.First().PoolNumber ?? 0,
                    PoolName = g.Key,
                    Standings = g.Select((u, idx) => new PoolStandingEntryDto
                    {
                        Rank = idx + 1,
                        PoolNumber = u.PoolNumber ?? 0,
                        PoolName = u.PoolName ?? $"Pool {u.PoolNumber ?? 0}",
                        UnitId = u.Id,
                        UnitNumber = u.UnitNumber,
                        UnitName = Utility.FormatUnitDisplayName(u.Members, u.Name),
                        Members = u.Members
                            .Where(m => m.User != null)
                            .Select(m => new TeamMemberInfoDto
                            {
                                UserId = m.UserId,
                                FirstName = m.User!.FirstName,
                                LastName = m.User.LastName,
                                ProfileImageUrl = m.User.ProfileImageUrl
                            })
                            .ToList(),
                        MatchesPlayed = u.MatchesPlayed,
                        MatchesWon = u.MatchesWon,
                        MatchesLost = u.MatchesLost,
                        GamesWon = u.GamesWon,
                        GamesLost = u.GamesLost,
                        PointsFor = u.PointsScored,
                        PointsAgainst = u.PointsAgainst,
                        PointDifferential = u.PointsScored - u.PointsAgainst
                    }).ToList()
                }).ToList()
        };

        return Ok(new ApiResponse<ScheduleExportDto> { Success = true, Data = schedule });
    }

    [HttpGet("divisions/{divisionId}/scoresheet")]
    public async Task<IActionResult> DownloadScoresheet(int divisionId)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Division not found" });

        var encounters = await _context.EventEncounters
            .Include(m => m.Unit1).ThenInclude(u => u!.Members).ThenInclude(m => m.User)
            .Include(m => m.Unit2).ThenInclude(u => u!.Members).ThenInclude(m => m.User)
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .Where(m => m.DivisionId == divisionId)
            .OrderBy(m => m.RoundType)
            .ThenBy(m => m.RoundNumber)
            .ThenBy(m => m.EncounterNumber)
            .ToListAsync();

        var units = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled")
            .OrderBy(u => u.UnitNumber)
            .ToListAsync();

        // Generate Excel file using ClosedXML
        using var workbook = new ClosedXML.Excel.XLWorkbook();

        // Sheet 1: Drawing Results
        var drawingSheet = workbook.Worksheets.Add("Drawing Results");
        drawingSheet.Cell(1, 1).Value = division.Event?.Name ?? "Event";
        drawingSheet.Cell(1, 1).Style.Font.Bold = true;
        drawingSheet.Cell(1, 1).Style.Font.FontSize = 16;
        drawingSheet.Cell(2, 1).Value = division.Name;
        drawingSheet.Cell(2, 1).Style.Font.Bold = true;
        drawingSheet.Cell(2, 1).Style.Font.FontSize = 14;
        drawingSheet.Cell(3, 1).Value = $"Generated: {DateTime.Now:g}";

        // Drawing results table
        drawingSheet.Cell(5, 1).Value = "#";
        drawingSheet.Cell(5, 2).Value = "Team Name";
        drawingSheet.Cell(5, 3).Value = "Players";
        drawingSheet.Range(5, 1, 5, 3).Style.Font.Bold = true;
        drawingSheet.Range(5, 1, 5, 3).Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;

        int row = 6;
        foreach (var unit in units)
        {
            drawingSheet.Cell(row, 1).Value = unit.UnitNumber ?? 0;
            drawingSheet.Cell(row, 2).Value = unit.Name;
            drawingSheet.Cell(row, 3).Value = string.Join(", ", unit.Members.Select(m =>
                $"{m.User?.FirstName} {m.User?.LastName}".Trim()));
            row++;
        }
        drawingSheet.Columns().AdjustToContents();

        // Sheet 2: Match Schedule with scoresheet
        var scheduleSheet = workbook.Worksheets.Add("Scoresheet");
        scheduleSheet.Cell(1, 1).Value = division.Event?.Name ?? "Event";
        scheduleSheet.Cell(1, 1).Style.Font.Bold = true;
        scheduleSheet.Cell(2, 1).Value = $"{division.Name} - Scoresheet";
        scheduleSheet.Cell(2, 1).Style.Font.Bold = true;

        // Scoresheet headers
        scheduleSheet.Cell(4, 1).Value = "Match #";
        scheduleSheet.Cell(4, 2).Value = "Round";
        scheduleSheet.Cell(4, 3).Value = "Team 1";
        scheduleSheet.Cell(4, 4).Value = "Team 2";
        scheduleSheet.Cell(4, 5).Value = "Game 1";
        scheduleSheet.Cell(4, 6).Value = "Game 2";
        scheduleSheet.Cell(4, 7).Value = "Game 3";
        scheduleSheet.Cell(4, 8).Value = "Winner";
        scheduleSheet.Range(4, 1, 4, 8).Style.Font.Bold = true;
        scheduleSheet.Range(4, 1, 4, 8).Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;

        row = 5;
        foreach (var encounter in encounters)
        {
            var unit1Name = encounter.Unit1?.Name ?? $"Position {encounter.Unit1Number}";
            var unit2Name = encounter.Unit2?.Name ?? $"Position {encounter.Unit2Number}";
            var roundLabel = encounter.RoundName ?? $"{encounter.RoundType} R{encounter.RoundNumber}";

            scheduleSheet.Cell(row, 1).Value = encounter.MatchNumber;
            scheduleSheet.Cell(row, 2).Value = roundLabel;
            scheduleSheet.Cell(row, 3).Value = $"[{encounter.Unit1Number}] {unit1Name}";
            scheduleSheet.Cell(row, 4).Value = $"[{encounter.Unit2Number}] {unit2Name}";

            // Add borders for score entry cells
            for (int col = 5; col <= 7; col++)
            {
                scheduleSheet.Cell(row, col).Style.Border.OutsideBorder = ClosedXML.Excel.XLBorderStyleValues.Thin;
                scheduleSheet.Cell(row, col).Value = "__ - __";
                scheduleSheet.Cell(row, col).Style.Alignment.Horizontal = ClosedXML.Excel.XLAlignmentHorizontalValues.Center;
            }
            scheduleSheet.Cell(row, 8).Style.Border.OutsideBorder = ClosedXML.Excel.XLBorderStyleValues.Thin;

            row++;
        }
        scheduleSheet.Columns().AdjustToContents();

        // Return as file download
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;

        var fileName = $"{division.Name.Replace(" ", "_")}_Scoresheet.xlsx";
        return File(stream.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            fileName);
    }

    // ============================================
    // Game Management
    // ============================================

    [Authorize]
    [HttpPost("games/assign-court")]
    public async Task<ActionResult<ApiResponse<EventGameDto>>> AssignGameToCourt([FromBody] AssignGameToCourtRequest request)
    {
        var game = await _context.EventGames
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(e => e!.Unit1).ThenInclude(u => u!.Members)
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(e => e!.Unit2).ThenInclude(u => u!.Members)
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

        // Send real-time notifications to players in this game
        var encounter = game.EncounterMatch?.Encounter;
        if (encounter != null)
        {
            var playerIds = new List<int>();
            if (encounter.Unit1?.Members != null)
                playerIds.AddRange(encounter.Unit1.Members.Where(m => m.InviteStatus == "Accepted").Select(m => m.UserId));
            if (encounter.Unit2?.Members != null)
                playerIds.AddRange(encounter.Unit2.Members.Where(m => m.InviteStatus == "Accepted").Select(m => m.UserId));

            if (playerIds.Count > 0)
            {
                var unit1Name = encounter.Unit1?.Name ?? "Team 1";
                var unit2Name = encounter.Unit2?.Name ?? "Team 2";
                var actionUrl = $"/event/{encounter.EventId}/gameday";

                foreach (var playerId in playerIds.Distinct())
                {
                    await _notificationService.CreateAndSendAsync(
                        playerId,
                        "GameUpdate",
                        "Your game is ready!",
                        $"{unit1Name} vs {unit2Name} - Court: {court.CourtLabel}",
                        actionUrl,
                        "Game",
                        game.Id);
                }
            }

            // Also broadcast to event group for admin dashboard refresh
            await _notificationService.SendToEventAsync(encounter.EventId, new NotificationPayload
            {
                Type = "GameUpdate",
                Title = "Game Queued",
                Message = $"Game assigned to {court.CourtLabel}",
                ReferenceType = "Game",
                ReferenceId = game.Id,
                CreatedAt = DateTime.Now
            });
        }

        return Ok(new ApiResponse<EventGameDto>
        {
            Success = true,
            Data = MapToGameDto(game)
        });
    }

    /// <summary>
    /// Pre-assign a court to an encounter (schedule planning, not starting the game)
    /// </summary>
    [Authorize]
    [HttpPost("encounters/pre-assign-court")]
    public async Task<ActionResult<ApiResponse<object>>> PreAssignCourtToEncounter([FromBody] PreAssignCourtRequest request)
    {
        var encounter = await _context.EventEncounters
            .Include(e => e.Event)
            .FirstOrDefaultAsync(e => e.Id == request.EncounterId);

        if (encounter == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Encounter not found" });

        // Verify user is organizer or admin
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        if (!await IsAdminAsync() && !await IsEventOrganizerAsync(encounter.EventId, userId.Value))
            return Forbid();

        if (request.TournamentCourtId.HasValue)
        {
            var court = await _context.TournamentCourts.FindAsync(request.TournamentCourtId.Value);
            if (court == null || court.EventId != encounter.EventId)
                return NotFound(new ApiResponse<object> { Success = false, Message = "Court not found" });
        }

        encounter.TournamentCourtId = request.TournamentCourtId;
        encounter.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = request.TournamentCourtId.HasValue ? "Court pre-assigned" : "Court assignment removed"
        });
    }

    /// <summary>
    /// Bulk pre-assign courts to multiple encounters (schedule planning)
    /// </summary>
    [Authorize]
    [HttpPost("encounters/bulk-pre-assign-courts")]
    public async Task<ActionResult<ApiResponse<object>>> BulkPreAssignCourts([FromBody] BulkPreAssignCourtsRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        if (!await IsAdminAsync() && !await IsEventOrganizerAsync(request.EventId, userId.Value))
            return Forbid();

        if (request.Assignments == null || request.Assignments.Count == 0)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "No assignments provided" });

        var encounterIds = request.Assignments.Select(a => a.EncounterId).ToList();
        var encounters = await _context.EventEncounters
            .Where(e => encounterIds.Contains(e.Id) && e.EventId == request.EventId)
            .ToListAsync();

        if (encounters.Count != encounterIds.Count)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Some encounters not found or don't belong to this event" });

        // Validate all courts exist for this event
        var courtIds = request.Assignments
            .Where(a => a.TournamentCourtId.HasValue)
            .Select(a => a.TournamentCourtId!.Value)
            .Distinct()
            .ToList();

        if (courtIds.Count > 0)
        {
            var validCourts = await _context.TournamentCourts
                .Where(c => courtIds.Contains(c.Id) && c.EventId == request.EventId)
                .Select(c => c.Id)
                .ToListAsync();

            if (validCourts.Count != courtIds.Count)
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Some courts not found or don't belong to this event" });
        }

        // Apply assignments
        var now = DateTime.Now;
        foreach (var assignment in request.Assignments)
        {
            var encounter = encounters.First(e => e.Id == assignment.EncounterId);
            encounter.TournamentCourtId = assignment.TournamentCourtId;
            encounter.UpdatedAt = now;
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = $"{request.Assignments.Count} court assignments updated"
        });
    }

    // ============================================
    // Court Planning (Dedicated Court Pre-Assignment)
    // ============================================

    /// <summary>
    /// Get complete court planning data for an event
    /// Includes all divisions, encounters, courts, and court groups
    /// </summary>
    [Authorize]
    [HttpGet("court-planning/{eventId}")]
    public async Task<ActionResult<ApiResponse<CourtPlanningDto>>> GetCourtPlanningData(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<CourtPlanningDto> { Success = false, Message = "Unauthorized" });

        if (!await IsAdminAsync() && !await IsEventOrganizerAsync(eventId, userId.Value))
            return Forbid();

        var evt = await _context.Events
            .Include(e => e.Divisions)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new ApiResponse<CourtPlanningDto> { Success = false, Message = "Event not found" });

        // Get court groups with their courts
        var courtGroups = await _context.CourtGroups
            .Where(g => g.EventId == eventId && g.IsActive)
            .OrderBy(g => g.SortOrder)
            .Select(g => new CourtGroupPlanningDto
            {
                Id = g.Id,
                GroupName = g.GroupName,
                GroupCode = g.GroupCode,
                LocationArea = g.LocationArea,
                CourtCount = g.CourtCount,
                Priority = g.Priority,
                SortOrder = g.SortOrder,
                Courts = g.Courts.Where(c => c.IsActive).OrderBy(c => c.SortOrder).Select(c => new CourtPlanningItemDto
                {
                    Id = c.Id,
                    CourtLabel = c.CourtLabel,
                    Status = c.Status,
                    LocationDescription = c.LocationDescription,
                    SortOrder = c.SortOrder
                }).ToList()
            })
            .ToListAsync();

        // Get unassigned courts
        var unassignedCourts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive && c.CourtGroupId == null)
            .OrderBy(c => c.SortOrder)
            .Select(c => new CourtPlanningItemDto
            {
                Id = c.Id,
                CourtLabel = c.CourtLabel,
                Status = c.Status,
                LocationDescription = c.LocationDescription,
                SortOrder = c.SortOrder
            })
            .ToListAsync();

        // Get divisions with their court assignments and phases
        var divisions = await _context.EventDivisions
            .Where(d => d.EventId == eventId)
            .OrderBy(d => d.SortOrder)
            .Select(d => new DivisionPlanningDto
            {
                Id = d.Id,
                Name = d.Name,
                BracketType = d.BracketType,
                UnitCount = d.Units.Count(u => u.Status != "Cancelled"),
                EncounterCount = _context.EventEncounters.Count(e => e.DivisionId == d.Id),
                EstimatedMatchDurationMinutes = d.EstimatedMatchDurationMinutes,
                MatchesPerEncounter = d.MatchesPerEncounter,
                SchedulePublishedAt = d.SchedulePublishedAt,
                AssignedCourtGroups = _context.DivisionCourtAssignments
                    .Where(a => a.DivisionId == d.Id && a.IsActive)
                    .OrderBy(a => a.Priority)
                    .Select(a => new DivisionCourtGroupAssignmentDto
                    {
                        Id = a.Id,
                        CourtGroupId = a.CourtGroupId,
                        CourtGroupName = a.CourtGroup!.GroupName,
                        Priority = a.Priority,
                        ValidFromTime = a.ValidFromTime,
                        ValidToTime = a.ValidToTime,
                        AssignmentMode = a.AssignmentMode,
                        PoolName = a.PoolName,
                        MatchFormatId = a.MatchFormatId,
                        MatchFormatName = a.MatchFormat != null ? a.MatchFormat.Name : null
                    }).ToList(),
                Phases = _context.DivisionPhases
                    .Where(p => p.DivisionId == d.Id && p.IsActive)
                    .OrderBy(p => p.SortOrder)
                    .Select(p => new DivisionPhasePlanningDto
                    {
                        Id = p.Id,
                        Name = p.Name,
                        PhaseType = p.PhaseType,
                        SortOrder = p.SortOrder,
                        EncounterCount = _context.EventEncounters.Count(e => e.PhaseId == p.Id),
                        EstimatedStartTime = p.EstimatedStartTime,
                        EstimatedEndTime = p.EstimatedEndTime
                    }).ToList()
            })
            .ToListAsync();

        // Get all encounters grouped by division
        var encounters = await _context.EventEncounters
            .Where(e => e.EventId == eventId)
            .OrderBy(e => e.DivisionId)
            .ThenBy(e => e.ScheduledTime ?? e.EstimatedStartTime ?? DateTime.MaxValue)
            .ThenBy(e => e.RoundNumber)
            .ThenBy(e => e.EncounterNumber)
            .Select(e => new EncounterPlanningDto
            {
                Id = e.Id,
                DivisionId = e.DivisionId,
                DivisionName = e.Division!.Name,
                PhaseId = e.PhaseId,
                PhaseName = e.Phase != null ? e.Phase.Name : null,
                RoundType = e.RoundType,
                RoundNumber = e.RoundNumber,
                RoundName = e.RoundName,
                EncounterNumber = e.EncounterNumber,
                EncounterLabel = e.EncounterLabel,
                Unit1Id = e.Unit1Id,
                Unit1Name = e.Unit1 != null ? e.Unit1.Name : e.Unit1SeedLabel,
                Unit2Id = e.Unit2Id,
                Unit2Name = e.Unit2 != null ? e.Unit2.Name : e.Unit2SeedLabel,
                Status = e.Status,
                CourtId = e.TournamentCourtId,
                CourtLabel = e.TournamentCourt != null ? e.TournamentCourt.CourtLabel : null,
                CourtGroupId = e.TournamentCourt != null ? e.TournamentCourt.CourtGroupId : null,
                ScheduledTime = e.ScheduledTime,
                EstimatedStartTime = e.EstimatedStartTime,
                EstimatedEndTime = e.EstimatedEndTime,
                EstimatedDurationMinutes = e.EstimatedDurationMinutes ?? e.Division!.EstimatedMatchDurationMinutes,
                IsBye = e.Status == "Bye" || (e.Unit1Id == null && e.Unit2Id == null && e.Unit1SeedLabel == "BYE")
            })
            .ToListAsync();

        return Ok(new ApiResponse<CourtPlanningDto>
        {
            Success = true,
            Data = new CourtPlanningDto
            {
                EventId = eventId,
                EventName = evt.Name,
                EventStartDate = evt.StartDate,
                EventEndDate = evt.EndDate,
                SchedulePublishedAt = evt.SchedulePublishedAt,
                ScheduleConflictCount = evt.ScheduleConflictCount,
                ScheduleValidatedAt = evt.ScheduleValidatedAt,
                CourtGroups = courtGroups,
                UnassignedCourts = unassignedCourts,
                Divisions = divisions,
                Encounters = encounters
            }
        });
    }

    /// <summary>
    /// Bulk update court and time assignments for encounters
    /// </summary>
    [Authorize]
    [HttpPost("court-planning/bulk-assign")]
    public async Task<ActionResult<ApiResponse<object>>> BulkAssignCourtsAndTimes([FromBody] BulkCourtTimeAssignmentRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        if (!await IsAdminAsync() && !await IsEventOrganizerAsync(request.EventId, userId.Value))
            return Forbid();

        if (request.Assignments == null || request.Assignments.Count == 0)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "No assignments provided" });

        var encounterIds = request.Assignments.Select(a => a.EncounterId).ToList();
        var encounters = await _context.EventEncounters
            .Where(e => encounterIds.Contains(e.Id) && e.EventId == request.EventId)
            .ToListAsync();

        if (encounters.Count != encounterIds.Count)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Some encounters not found" });

        // Validate courts
        var courtIds = request.Assignments
            .Where(a => a.CourtId.HasValue)
            .Select(a => a.CourtId!.Value)
            .Distinct()
            .ToList();

        if (courtIds.Count > 0)
        {
            var validCourts = await _context.TournamentCourts
                .Where(c => courtIds.Contains(c.Id) && c.EventId == request.EventId)
                .Select(c => c.Id)
                .ToListAsync();

            if (validCourts.Count != courtIds.Count)
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Invalid court IDs" });
        }

        var now = DateTime.Now;
        foreach (var assignment in request.Assignments)
        {
            var encounter = encounters.First(e => e.Id == assignment.EncounterId);
            encounter.TournamentCourtId = assignment.CourtId;
            if (assignment.ScheduledTime.HasValue)
                encounter.ScheduledTime = assignment.ScheduledTime;
            if (assignment.EstimatedStartTime.HasValue)
                encounter.EstimatedStartTime = assignment.EstimatedStartTime;
            encounter.UpdatedAt = now;
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = $"{request.Assignments.Count} encounters updated"
        });
    }

    /// <summary>
    /// Assign court groups to a division
    /// </summary>
    [Authorize]
    [HttpPost("court-planning/division-courts")]
    public async Task<ActionResult<ApiResponse<object>>> AssignCourtGroupsToDivision([FromBody] DivisionCourtGroupsRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == request.DivisionId);

        if (division == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Division not found" });

        if (!await IsAdminAsync() && !await IsEventOrganizerAsync(division.EventId, userId.Value))
            return Forbid();

        // Remove existing division-level court assignments (not phase-level)
        var existingAssignments = await _context.DivisionCourtAssignments
            .Where(a => a.DivisionId == request.DivisionId && a.PhaseId == null)
            .ToListAsync();
        _context.DivisionCourtAssignments.RemoveRange(existingAssignments);

        // Add new assignments
        if (request.CourtGroupIds?.Any() == true)
        {
            var validGroups = await _context.CourtGroups
                .Where(g => request.CourtGroupIds.Contains(g.Id) && g.EventId == division.EventId)
                .Select(g => g.Id)
                .ToListAsync();

            int priority = 0;
            foreach (var groupId in request.CourtGroupIds.Where(id => validGroups.Contains(id)))
            {
                _context.DivisionCourtAssignments.Add(new DivisionCourtAssignment
                {
                    DivisionId = request.DivisionId,
                    CourtGroupId = groupId,
                    Priority = priority++,
                    ValidFromTime = request.ValidFromTime,
                    ValidToTime = request.ValidToTime,
                    AssignmentMode = request.AssignmentMode,
                    PoolName = request.PoolName,
                    MatchFormatId = request.MatchFormatId
                });
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Court groups assigned to division"
        });
    }

    /// <summary>
    /// Auto-assign courts and calculate times for a division
    /// Uses division's assigned court groups
    /// </summary>
    [Authorize]
    [HttpPost("court-planning/auto-assign/{divisionId}")]
    public async Task<ActionResult<ApiResponse<object>>> AutoAssignDivisionCourts(int divisionId, [FromBody] AutoAssignRequest? request = null)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Division not found" });

        if (!await IsAdminAsync() && !await IsEventOrganizerAsync(division.EventId, userId.Value))
            return Forbid();

        var options = new CourtAssignmentOptions
        {
            StartTime = request?.StartTime,
            MatchDurationMinutes = request?.MatchDurationMinutes,
            ClearExisting = request?.ClearExisting ?? true
        };

        var result = await _courtAssignmentService.AutoAssignDivisionAsync(divisionId, options);

        if (!result.Success)
            return BadRequest(new ApiResponse<object> { Success = false, Message = result.Message });

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Data = new
            {
                Assigned = result.AssignedCount,
                CourtsUsed = result.CourtsUsed,
                StartTime = result.StartTime,
                EstimatedEndTime = result.EstimatedEndTime
            },
            Message = result.Message
        });
    }

    /// <summary>
    /// Clear all court/time assignments for a division
    /// </summary>
    [Authorize]
    [HttpPost("court-planning/clear/{divisionId}")]
    public async Task<ActionResult<ApiResponse<object>>> ClearDivisionCourtAssignments(int divisionId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Division not found" });

        if (!await IsAdminAsync() && !await IsEventOrganizerAsync(division.EventId, userId.Value))
            return Forbid();

        var cleared = await _courtAssignmentService.ClearDivisionAssignmentsAsync(divisionId);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = $"Cleared court/time assignments for {cleared} encounters"
        });
    }

    /// <summary>
    /// Validate schedule for conflicts before publishing
    /// </summary>
    [Authorize]
    [HttpGet("court-planning/validate/{eventId}")]
    public async Task<ActionResult<ApiResponse<ScheduleValidationResult>>> ValidateSchedule(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<ScheduleValidationResult> { Success = false, Message = "Unauthorized" });

        if (!await CanManageEventAsync(eventId))
            return Forbid();

        var result = await ValidateEventScheduleAsync(eventId);

        // Update event with validation results
        var evt = await _context.Events.FindAsync(eventId);
        if (evt != null)
        {
            evt.ScheduleValidatedAt = DateTime.Now;
            evt.ScheduleConflictCount = result.ConflictCount;
            await _context.SaveChangesAsync();
        }

        return Ok(new ApiResponse<ScheduleValidationResult>
        {
            Success = true,
            Data = result
        });
    }

    /// <summary>
    /// Publish the event schedule for players/spectators to view
    /// </summary>
    [Authorize]
    [HttpPost("court-planning/publish/{eventId}")]
    public async Task<ActionResult<ApiResponse<object>>> PublishSchedule(int eventId, [FromBody] SchedulePublishRequest? request = null)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        if (!await CanManageEventAsync(eventId))
            return Forbid();

        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Event not found" });

        // Validate first if requested
        if (request?.ValidateFirst != false)
        {
            var validation = await ValidateEventScheduleAsync(eventId);
            if (!validation.IsValid)
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Message = $"Cannot publish: {validation.ConflictCount} conflicts found",
                    Data = validation
                });
            }
        }

        // Mark event as published
        evt.SchedulePublishedAt = DateTime.Now;
        evt.SchedulePublishedByUserId = userId.Value;
        evt.UpdatedAt = DateTime.Now;

        // Also mark all divisions as published
        var divisions = await _context.EventDivisions
            .Where(d => d.EventId == eventId && d.IsActive)
            .ToListAsync();

        foreach (var division in divisions)
        {
            division.SchedulePublishedAt = DateTime.Now;
            division.SchedulePublishedByUserId = userId.Value;
            division.UpdatedAt = DateTime.Now;
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Schedule published for event {EventId} by user {UserId}", eventId, userId.Value);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Schedule published successfully",
            Data = new { PublishedAt = evt.SchedulePublishedAt }
        });
    }

    /// <summary>
    /// Unpublish the event schedule
    /// </summary>
    [Authorize]
    [HttpPost("court-planning/unpublish/{eventId}")]
    public async Task<ActionResult<ApiResponse<object>>> UnpublishSchedule(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        if (!await CanManageEventAsync(eventId))
            return Forbid();

        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Event not found" });

        evt.SchedulePublishedAt = null;
        evt.SchedulePublishedByUserId = null;
        evt.UpdatedAt = DateTime.Now;

        // Also unpublish all divisions
        var divisions = await _context.EventDivisions
            .Where(d => d.EventId == eventId && d.IsActive)
            .ToListAsync();

        foreach (var division in divisions)
        {
            division.SchedulePublishedAt = null;
            division.SchedulePublishedByUserId = null;
            division.UpdatedAt = DateTime.Now;
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Schedule unpublished"
        });
    }

    /// <summary>
    /// Get timeline data for visualizing court schedules
    /// </summary>
    [HttpGet("court-planning/timeline/{eventId}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<TimelineDataDto>>> GetTimelineData(int eventId)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<TimelineDataDto> { Success = false, Message = "Event not found" });

        var isPublished = evt.SchedulePublishedAt.HasValue;

        // Get court data with grouped encounters
        var courts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive)
            .OrderBy(c => c.SortOrder)
            .Select(c => new TimelineCourtDto
            {
                Id = c.Id,
                CourtLabel = c.CourtLabel,
                CourtGroupId = c.CourtGroupId,
                CourtGroupName = c.CourtGroup != null ? c.CourtGroup.GroupName : null,
                LocationArea = c.CourtGroup != null ? c.CourtGroup.LocationArea : null,
                SortOrder = c.SortOrder,
                Blocks = new List<TimelineBlockDto>()
            })
            .ToListAsync();

        // Get encounters with time assignments
        var encounters = await _context.EventEncounters
            .Where(e => e.EventId == eventId && e.TournamentCourtId != null && e.EstimatedStartTime != null)
            .Include(e => e.Division)
            .Include(e => e.Phase)
            .Include(e => e.Unit1)
            .Include(e => e.Unit2)
            .Include(e => e.TournamentCourt)
            .ToListAsync();

        // Build timeline blocks for each court
        foreach (var court in courts)
        {
            var courtEncounters = encounters
                .Where(e => e.TournamentCourtId == court.Id)
                .OrderBy(e => e.EstimatedStartTime)
                .ToList();

            foreach (var enc in courtEncounters)
            {
                var duration = enc.EstimatedDurationMinutes ?? enc.Division?.EstimatedMatchDurationMinutes ?? 20;
                var endTime = enc.EstimatedEndTime ?? enc.EstimatedStartTime!.Value.AddMinutes(duration);

                court.Blocks.Add(new TimelineBlockDto
                {
                    EncounterId = enc.Id,
                    DivisionId = enc.DivisionId,
                    DivisionName = enc.Division?.Name ?? "",
                    DivisionColor = GetDivisionColor(enc.DivisionId),
                    PhaseId = enc.PhaseId,
                    PhaseName = enc.Phase?.Name,
                    RoundName = enc.RoundName,
                    EncounterLabel = enc.EncounterLabel ?? $"Match {enc.EncounterNumber}",
                    Unit1Name = enc.Unit1?.Name ?? enc.Unit1SeedLabel,
                    Unit2Name = enc.Unit2?.Name ?? enc.Unit2SeedLabel,
                    StartTime = enc.EstimatedStartTime!.Value,
                    EndTime = endTime,
                    DurationMinutes = duration,
                    Status = enc.Status,
                    HasConflict = false // Will be populated by validation
                });
            }
        }

        // Check for conflicts
        foreach (var court in courts)
        {
            for (int i = 0; i < court.Blocks.Count - 1; i++)
            {
                var current = court.Blocks[i];
                var next = court.Blocks[i + 1];
                if (current.EndTime > next.StartTime)
                {
                    current.HasConflict = true;
                    next.HasConflict = true;
                }
            }
        }

        // Get division summary
        var divisionSummary = await _context.EventDivisions
            .Where(d => d.EventId == eventId && d.IsActive)
            .Select(d => new TimelineDivisionDto
            {
                Id = d.Id,
                Name = d.Name,
                Color = null, // Will be assigned
                EncounterCount = d.Encounters.Count,
                AssignedCount = d.Encounters.Count(e => e.TournamentCourtId != null && e.EstimatedStartTime != null),
                FirstEncounterTime = d.Encounters
                    .Where(e => e.EstimatedStartTime != null)
                    .Min(e => e.EstimatedStartTime),
                LastEncounterTime = d.Encounters
                    .Where(e => e.EstimatedStartTime != null)
                    .Max(e => e.EstimatedStartTime)
            })
            .ToListAsync();

        // Assign colors to divisions
        for (int i = 0; i < divisionSummary.Count; i++)
        {
            divisionSummary[i].Color = GetDivisionColor(divisionSummary[i].Id);
        }

        return Ok(new ApiResponse<TimelineDataDto>
        {
            Success = true,
            Data = new TimelineDataDto
            {
                EventId = eventId,
                EventStartDate = evt.StartDate,
                EventEndDate = evt.EndDate,
                IsSchedulePublished = isPublished,
                Courts = courts,
                Divisions = divisionSummary
            }
        });
    }

    /// <summary>
    /// Add or update a court group assignment for a division
    /// </summary>
    [Authorize]
    [HttpPost("court-planning/division-assignment")]
    public async Task<ActionResult<ApiResponse<object>>> AddDivisionCourtAssignment([FromBody] DivisionCourtAssignmentRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions.FindAsync(request.DivisionId);
        if (division == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Division not found" });

        if (!await CanManageEventAsync(division.EventId))
            return Forbid();

        var courtGroup = await _context.CourtGroups.FindAsync(request.CourtGroupId);
        if (courtGroup == null || courtGroup.EventId != division.EventId)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Invalid court group" });

        // Create or update assignment
        var existing = await _context.DivisionCourtAssignments
            .FirstOrDefaultAsync(a =>
                a.DivisionId == request.DivisionId &&
                a.CourtGroupId == request.CourtGroupId &&
                a.PhaseId == request.PhaseId &&
                a.AssignmentMode == request.AssignmentMode &&
                a.PoolName == request.PoolName &&
                a.MatchFormatId == request.MatchFormatId);

        if (existing != null)
        {
            existing.Priority = request.Priority;
            existing.ValidFromTime = request.ValidFromTime;
            existing.ValidToTime = request.ValidToTime;
        }
        else
        {
            _context.DivisionCourtAssignments.Add(new DivisionCourtAssignment
            {
                DivisionId = request.DivisionId,
                CourtGroupId = request.CourtGroupId,
                PhaseId = request.PhaseId,
                AssignmentMode = request.AssignmentMode,
                PoolName = request.PoolName,
                MatchFormatId = request.MatchFormatId,
                Priority = request.Priority,
                ValidFromTime = request.ValidFromTime,
                ValidToTime = request.ValidToTime
            });
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Court assignment saved"
        });
    }

    /// <summary>
    /// Delete a court group assignment
    /// </summary>
    [Authorize]
    [HttpDelete("court-planning/division-assignment/{assignmentId}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteDivisionCourtAssignment(int assignmentId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        var assignment = await _context.DivisionCourtAssignments
            .Include(a => a.Division)
            .FirstOrDefaultAsync(a => a.Id == assignmentId);

        if (assignment == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Assignment not found" });

        if (!await CanManageEventAsync(assignment.Division!.EventId))
            return Forbid();

        _context.DivisionCourtAssignments.Remove(assignment);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Assignment deleted"
        });
    }

    // Helper method to validate event schedule
    private async Task<ScheduleValidationResult> ValidateEventScheduleAsync(int eventId)
    {
        var result = new ScheduleValidationResult { IsValid = true };

        // Get all encounters with court assignments
        var encounters = await _context.EventEncounters
            .Where(e => e.EventId == eventId && e.Status != "Cancelled" && e.Status != "Bye")
            .Include(e => e.Division)
            .Include(e => e.TournamentCourt)
            .ToListAsync();

        // Check for unassigned encounters
        var unassigned = encounters.Where(e => e.TournamentCourtId == null || e.EstimatedStartTime == null).ToList();
        result.UnassignedEncounters = unassigned.Count;
        if (unassigned.Count > 0)
        {
            result.Warnings.Add($"{unassigned.Count} encounters without court/time assignments");
        }

        // Get assigned encounters grouped by court
        var assignedByCourtId = encounters
            .Where(e => e.TournamentCourtId.HasValue && e.EstimatedStartTime.HasValue)
            .GroupBy(e => e.TournamentCourtId!.Value)
            .ToList();

        // Check for time overlaps on each court
        foreach (var courtGroup in assignedByCourtId)
        {
            var courtEncounters = courtGroup
                .OrderBy(e => e.EstimatedStartTime)
                .ToList();

            for (int i = 0; i < courtEncounters.Count - 1; i++)
            {
                var current = courtEncounters[i];
                var next = courtEncounters[i + 1];

                var duration = current.EstimatedDurationMinutes ?? current.Division?.EstimatedMatchDurationMinutes ?? 20;
                var currentEnd = current.EstimatedEndTime ?? current.EstimatedStartTime!.Value.AddMinutes(duration);

                if (currentEnd > next.EstimatedStartTime)
                {
                    result.Conflicts.Add(new ScheduleConflictDto
                    {
                        ConflictType = "CourtOverlap",
                        CourtId = courtGroup.Key,
                        CourtLabel = current.TournamentCourt?.CourtLabel ?? $"Court {courtGroup.Key}",
                        Encounter1Id = current.Id,
                        Encounter2Id = next.Id,
                        Encounter1Label = current.EncounterLabel ?? $"{current.Division?.Name} Match {current.EncounterNumber}",
                        Encounter2Label = next.EncounterLabel ?? $"{next.Division?.Name} Match {next.EncounterNumber}",
                        ConflictStartTime = next.EstimatedStartTime,
                        ConflictEndTime = currentEnd,
                        Message = $"Overlapping matches on {current.TournamentCourt?.CourtLabel}: {current.Division?.Name} ends at {currentEnd:HH:mm} but {next.Division?.Name} starts at {next.EstimatedStartTime:HH:mm}"
                    });
                }
            }
        }

        // Check for same unit playing at overlapping times
        var unitEncounters = encounters
            .Where(e => e.EstimatedStartTime.HasValue && (e.Unit1Id.HasValue || e.Unit2Id.HasValue))
            .SelectMany(e => new[]
            {
                e.Unit1Id.HasValue ? (UnitId: e.Unit1Id.Value, Encounter: e) : ((int, EventEncounter)?)null,
                e.Unit2Id.HasValue ? (UnitId: e.Unit2Id.Value, Encounter: e) : ((int, EventEncounter)?)null
            })
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .GroupBy(x => x.UnitId)
            .ToList();

        foreach (var unitGroup in unitEncounters)
        {
            var unitMatches = unitGroup
                .OrderBy(x => x.Encounter.EstimatedStartTime)
                .ToList();

            for (int i = 0; i < unitMatches.Count - 1; i++)
            {
                var current = unitMatches[i].Encounter;
                var next = unitMatches[i + 1].Encounter;

                var duration = current.EstimatedDurationMinutes ?? current.Division?.EstimatedMatchDurationMinutes ?? 20;
                var currentEnd = current.EstimatedEndTime ?? current.EstimatedStartTime!.Value.AddMinutes(duration);

                if (currentEnd > next.EstimatedStartTime)
                {
                    // Only add if not already in conflicts
                    if (!result.Conflicts.Any(c =>
                        c.ConflictType == "UnitOverlap" &&
                        ((c.Encounter1Id == current.Id && c.Encounter2Id == next.Id) ||
                         (c.Encounter1Id == next.Id && c.Encounter2Id == current.Id))))
                    {
                        result.Conflicts.Add(new ScheduleConflictDto
                        {
                            ConflictType = "UnitOverlap",
                            CourtId = current.TournamentCourtId ?? 0,
                            CourtLabel = current.TournamentCourt?.CourtLabel ?? "",
                            Encounter1Id = current.Id,
                            Encounter2Id = next.Id,
                            Encounter1Label = current.EncounterLabel ?? $"{current.Division?.Name} Match {current.EncounterNumber}",
                            Encounter2Label = next.EncounterLabel ?? $"{next.Division?.Name} Match {next.EncounterNumber}",
                            ConflictStartTime = next.EstimatedStartTime,
                            ConflictEndTime = currentEnd,
                            Message = $"Team has overlapping matches"
                        });
                    }
                }
            }
        }

        // Check divisions without court assignments
        var divisionsWithoutCourts = await _context.EventDivisions
            .Where(d => d.EventId == eventId && d.IsActive)
            .Where(d => !_context.DivisionCourtAssignments.Any(a => a.DivisionId == d.Id))
            .CountAsync();

        result.DivisionsWithoutCourts = divisionsWithoutCourts;
        if (divisionsWithoutCourts > 0)
        {
            result.Warnings.Add($"{divisionsWithoutCourts} divisions without court group assignments");
        }

        result.ConflictCount = result.Conflicts.Count;
        result.IsValid = result.ConflictCount == 0 && result.UnassignedEncounters == 0;

        return result;
    }

    // Helper to assign colors to divisions for timeline visualization
    private static string GetDivisionColor(int divisionId)
    {
        var colors = new[]
        {
            "#3b82f6", // blue
            "#10b981", // emerald
            "#f97316", // orange
            "#8b5cf6", // violet
            "#ef4444", // red
            "#06b6d4", // cyan
            "#f59e0b", // amber
            "#ec4899", // pink
            "#6366f1", // indigo
            "#84cc16"  // lime
        };
        return colors[divisionId % colors.Length];
    }

    [Authorize]
    [HttpPost("games/update-status")]
    public async Task<ActionResult<ApiResponse<EventGameDto>>> UpdateGameStatus([FromBody] UpdateGameStatusRequest request)
    {
        var game = await _context.EventGames
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(e => e!.Unit1).ThenInclude(u => u!.Members)
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(e => e!.Unit2).ThenInclude(u => u!.Members)
            .Include(g => g.TournamentCourt)
            .FirstOrDefaultAsync(g => g.Id == request.GameId);

        if (game == null)
            return NotFound(new ApiResponse<EventGameDto> { Success = false, Message = "Game not found" });

        var oldStatus = game.Status;
        game.Status = request.Status;
        game.UpdatedAt = DateTime.Now;

        var finishedCourtId = (int?)null;
        if (request.Status == "Started" || request.Status == "Playing")
        {
            game.StartedAt ??= DateTime.Now;
        }
        else if (request.Status == "Finished" || request.Status == "Completed")
        {
            game.FinishedAt = DateTime.Now;

            // Save court ID before freeing it (for auto-starting next game)
            finishedCourtId = game.TournamentCourtId;

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

        // Send real-time notifications to players if status changed significantly
        var encounter = game.EncounterMatch?.Encounter;
        var notifyStatuses = new[] { "Queued", "Ready", "InProgress", "Started", "Playing" };
        if (encounter != null && notifyStatuses.Contains(request.Status) && oldStatus != request.Status)
        {
            var playerIds = new List<int>();
            if (encounter.Unit1?.Members != null)
                playerIds.AddRange(encounter.Unit1.Members.Where(m => m.InviteStatus == "Accepted").Select(m => m.UserId));
            if (encounter.Unit2?.Members != null)
                playerIds.AddRange(encounter.Unit2.Members.Where(m => m.InviteStatus == "Accepted").Select(m => m.UserId));

            if (playerIds.Count > 0)
            {
                var unit1Name = encounter.Unit1?.Name ?? "Team 1";
                var unit2Name = encounter.Unit2?.Name ?? "Team 2";
                var courtName = game.TournamentCourt?.CourtLabel ?? "assigned court";
                var actionUrl = $"/event/{encounter.EventId}/gameday";

                // Customize message based on status
                var title = request.Status switch
                {
                    "Queued" => "Game Queued!",
                    "Ready" => "Get Ready!",
                    "InProgress" or "Playing" or "Started" => "Game Starting!",
                    _ => "Game Update"
                };

                foreach (var playerId in playerIds.Distinct())
                {
                    await _notificationService.CreateAndSendAsync(
                        playerId,
                        "GameUpdate",
                        title,
                        $"{unit1Name} vs {unit2Name} - {courtName}",
                        actionUrl,
                        "Game",
                        game.Id);
                }
            }
        }

        // Broadcast to event group for admin dashboard refresh
        if (encounter != null)
        {
            await _notificationService.SendToEventAsync(encounter.EventId, new NotificationPayload
            {
                Type = "GameUpdate",
                Title = $"Game {request.Status}",
                Message = $"Game status updated to {request.Status}",
                ReferenceType = "Game",
                ReferenceId = game.Id,
                CreatedAt = DateTime.Now
            });

            // Auto-start next queued game on the same court if game finished
            if (finishedCourtId.HasValue && (request.Status == "Finished" || request.Status == "Completed"))
            {
                await StartNextQueuedGameOnCourt(finishedCourtId.Value, encounter.EventId);
            }
        }

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
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(m => m!.Unit1)
                    .ThenInclude(u => u!.Members)
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(m => m!.Unit2)
                    .ThenInclude(u => u!.Members)
            .FirstOrDefaultAsync(g => g.Id == request.GameId);

        if (game == null)
            return NotFound(new ApiResponse<EventGameDto> { Success = false, Message = "Game not found" });

        // Check if user is in one of the units
        var encounter = game.EncounterMatch?.Encounter;
        var userUnit = encounter?.Unit1?.Members.Any(m => m.UserId == userId) == true ? encounter.Unit1 :
                       encounter?.Unit2?.Members.Any(m => m.UserId == userId) == true ? encounter.Unit2 : null;

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

    /// <summary>
    /// Admin endpoint to update game scores without being a participant
    /// </summary>
    [Authorize]
    [HttpPost("games/admin-update-score")]
    public async Task<ActionResult<ApiResponse<EventGameDto>>> AdminUpdateScore([FromBody] AdminUpdateScoreRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<EventGameDto> { Success = false, Message = "Unauthorized" });

        // Check if user is admin
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
        if (user?.Role != "Admin")
            return Forbid();

        var game = await _context.EventGames
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
            .Include(g => g.ScoreFormat)
            .FirstOrDefaultAsync(g => g.Id == request.GameId);

        if (game == null)
            return NotFound(new ApiResponse<EventGameDto> { Success = false, Message = "Game not found" });

        var encounter = game.EncounterMatch?.Encounter;
        var wasAlreadyFinished = game.Status == "Finished";
        var oldUnit1Score = game.Unit1Score;
        var oldUnit2Score = game.Unit2Score;
        var oldWinnerId = game.WinnerUnitId;

        game.Unit1Score = request.Unit1Score;
        game.Unit2Score = request.Unit2Score;
        game.UpdatedAt = DateTime.Now;

        // If marking as finished (first time)
        if (request.MarkAsFinished && !wasAlreadyFinished)
        {
            game.Status = "Finished";
            game.FinishedAt = DateTime.Now;

            var finishedCourtId = game.TournamentCourtId;

            if (encounter != null)
            {
                game.WinnerUnitId = game.Unit1Score > game.Unit2Score ? encounter.Unit1Id : encounter.Unit2Id;

                // Update unit stats (games won/lost, points scored/against)
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

                // Broadcast game score update via SignalR
                var winnerUnit = game.WinnerUnitId == encounter.Unit1Id ? encounter.Unit1 : encounter.Unit2;
                await _scoreBroadcaster.BroadcastGameScoreUpdated(encounter.EventId, encounter.DivisionId, new GameScoreUpdateDto
                {
                    GameId = game.Id,
                    EncounterId = encounter.Id,
                    DivisionId = encounter.DivisionId,
                    GameNumber = game.GameNumber,
                    Unit1Score = game.Unit1Score,
                    Unit2Score = game.Unit2Score,
                    WinnerUnitId = game.WinnerUnitId,
                    WinnerName = winnerUnit?.Name,
                    Status = game.Status ?? "Finished",
                    UpdatedAt = DateTime.Now
                });

                // Check if match is complete (for best-of series) - this also handles bracket progression
                await CheckMatchComplete(encounter.Id);

                // Save changes before starting next game
                await _context.SaveChangesAsync();

                // Auto-start next queued game on the same court
                if (finishedCourtId.HasValue)
                {
                    await StartNextQueuedGameOnCourt(finishedCourtId.Value, encounter.EventId);
                }

                return Ok(new ApiResponse<EventGameDto>
                {
                    Success = true,
                    Data = MapToGameDto(game)
                });
            }
        }
        // If already finished and score changed, update stats with delta
        else if (wasAlreadyFinished && encounter != null &&
                 (oldUnit1Score != request.Unit1Score || oldUnit2Score != request.Unit2Score))
        {
            // Update winner based on new scores
            game.WinnerUnitId = game.Unit1Score > game.Unit2Score ? encounter.Unit1Id : encounter.Unit2Id;

            // Adjust unit stats (subtract old, add new)
            await AdjustUnitStats(encounter, oldUnit1Score, oldUnit2Score, oldWinnerId,
                                  game.Unit1Score, game.Unit2Score, game.WinnerUnitId);

            // Broadcast score change
            var winnerUnit = game.WinnerUnitId == encounter.Unit1Id ? encounter.Unit1 : encounter.Unit2;
            await _scoreBroadcaster.BroadcastGameScoreUpdated(encounter.EventId, encounter.DivisionId, new GameScoreUpdateDto
            {
                GameId = game.Id,
                EncounterId = encounter.Id,
                DivisionId = encounter.DivisionId,
                GameNumber = game.GameNumber,
                Unit1Score = game.Unit1Score,
                Unit2Score = game.Unit2Score,
                WinnerUnitId = game.WinnerUnitId,
                WinnerName = winnerUnit?.Name,
                Status = game.Status ?? "Finished",
                UpdatedAt = DateTime.Now
            });

            // Re-check match completion in case winner changed
            await CheckMatchComplete(encounter.Id);
        }

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
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(m => m!.Unit1)
                    .ThenInclude(u => u!.Members)
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(m => m!.Unit2)
                    .ThenInclude(u => u!.Members)
            .Include(g => g.ScoreFormat)
            .FirstOrDefaultAsync(g => g.Id == request.GameId);

        if (game == null)
            return NotFound(new ApiResponse<EventGameDto> { Success = false, Message = "Game not found" });

        // Check if user is in the OTHER unit (not the one that submitted)
        var encounter = game.EncounterMatch?.Encounter;
        var userUnit = encounter?.Unit1?.Members.Any(m => m.UserId == userId) == true ? encounter.Unit1 :
                       encounter?.Unit2?.Members.Any(m => m.UserId == userId) == true ? encounter.Unit2 : null;

        if (userUnit == null || userUnit.Id == game.ScoreSubmittedByUnitId)
            return Forbid();

        if (request.Confirm)
        {
            game.ScoreConfirmedByUnitId = userUnit.Id;
            game.ScoreConfirmedAt = DateTime.Now;
            game.Status = "Finished";
            game.FinishedAt = DateTime.Now;

            var finishedCourtId = game.TournamentCourtId;

            // Determine winner
            var unit1Id = encounter!.Unit1Id;
            var unit2Id = encounter!.Unit2Id;
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
            await CheckMatchComplete(game.EncounterMatch!.EncounterId);

            game.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            // Auto-start next queued game on the same court
            if (finishedCourtId.HasValue)
            {
                await StartNextQueuedGameOnCourt(finishedCourtId.Value, encounter.EventId);
            }

            return Ok(new ApiResponse<EventGameDto>
            {
                Success = true,
                Data = MapToGameDto(game)
            });
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

    /// <summary>
    /// Admin endpoint to update encounter units (teams)
    /// </summary>
    [Authorize]
    [HttpPost("encounters/update-units")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateEncounterUnits([FromBody] UpdateEncounterUnitsRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        // Check if user is admin
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
        if (user?.Role != "Admin")
            return Forbid();

        var encounter = await _context.EventEncounters
            .Include(e => e.Division)
            .FirstOrDefaultAsync(e => e.Id == request.EncounterId);

        if (encounter == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Encounter not found" });

        // Validate units belong to same division
        if (request.Unit1Id.HasValue)
        {
            var unit1 = await _context.EventUnits.FirstOrDefaultAsync(u => u.Id == request.Unit1Id.Value);
            if (unit1 == null || unit1.DivisionId != encounter.DivisionId)
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Unit 1 not found or not in same division" });
        }

        if (request.Unit2Id.HasValue)
        {
            var unit2 = await _context.EventUnits.FirstOrDefaultAsync(u => u.Id == request.Unit2Id.Value);
            if (unit2 == null || unit2.DivisionId != encounter.DivisionId)
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Unit 2 not found or not in same division" });
        }

        // Update encounter units
        encounter.Unit1Id = request.Unit1Id;
        encounter.Unit2Id = request.Unit2Id;
        encounter.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Encounter units updated successfully"
        });
    }

    /// <summary>
    /// Get all units in a division
    /// </summary>
    [Authorize]
    [HttpGet("divisions/{divisionId}/units")]
    public async Task<ActionResult<ApiResponse<List<EventUnitDto>>>> GetDivisionUnits(int divisionId)
    {
        var units = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Where(u => u.DivisionId == divisionId)
            .OrderBy(u => u.UnitNumber)
            .Select(u => new EventUnitDto
            {
                Id = u.Id,
                Name = u.Name,
                UnitNumber = u.UnitNumber,
                Status = u.Status,
                Members = u.Members!.Where(m => m.InviteStatus == "Accepted").Select(m => new EventUnitMemberDto
                {
                    UserId = m.UserId,
                    FirstName = m.User!.FirstName,
                    LastName = m.User.LastName,
                    ProfileImageUrl = m.User.ProfileImageUrl
                }).ToList()
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<EventUnitDto>>
        {
            Success = true,
            Data = units
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

        var matches = await _context.EventEncounters
            .Where(m => m.EventId == eventId)
            .ToListAsync();

        var games = await _context.EventGames
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter).ThenInclude(e => e!.Unit1).ThenInclude(u => u!.Members).ThenInclude(m => m.User)
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter).ThenInclude(e => e!.Unit2).ThenInclude(u => u!.Members).ThenInclude(m => m.User)
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter).ThenInclude(e => e!.Division)
            .Include(g => g.TournamentCourt)
            .Where(g => g.EncounterMatch!.Encounter!.EventId == eventId)
            .ToListAsync();

        var courts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive)
            .ToListAsync();

        // Helper to get player names from unit members
        string GetPlayerNames(EventUnit? unit)
        {
            if (unit?.Members == null || !unit.Members.Any()) return unit?.Name ?? "TBD";
            return string.Join(" / ", unit.Members.Where(m => m.User != null).Select(m => m.User!.FirstName));
        }

        // Helper to build game info DTO
        CourtGameInfoDto? BuildGameInfo(EventGame? game)
        {
            if (game == null) return null;
            var encounter = game.EncounterMatch?.Encounter;
            return new CourtGameInfoDto
            {
                GameId = game.Id,
                EncounterId = encounter?.Id,
                Unit1Name = encounter?.Unit1?.Name,
                Unit2Name = encounter?.Unit2?.Name,
                Unit1Players = GetPlayerNames(encounter?.Unit1),
                Unit2Players = GetPlayerNames(encounter?.Unit2),
                Unit1Score = game.Unit1Score,
                Unit2Score = game.Unit2Score,
                Status = game.Status,
                StartedAt = game.StartedAt,
                QueuedAt = game.QueuedAt,
                DivisionName = encounter?.Division?.Name,
                RoundName = encounter?.RoundName,
                GameNumber = game.GameNumber
            };
        }

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
                RegisteredUnits = units.Count(u => u.DivisionId == d.Id && u.Status != "Cancelled"),
                WaitlistedUnits = units.Count(u => u.DivisionId == d.Id && u.Status == "Waitlisted"),
                CheckedInUnits = units.Count(u => u.DivisionId == d.Id && u.Status == "CheckedIn"),
                TotalMatches = matches.Count(m => m.DivisionId == d.Id),
                CompletedMatches = matches.Count(m => m.DivisionId == d.Id && m.Status == "Completed"),
                InProgressMatches = matches.Count(m => m.DivisionId == d.Id && m.Status == "InProgress"),
                ScheduleReady = matches.Any(m => m.DivisionId == d.Id),
                UnitsAssigned = units.Where(u => u.DivisionId == d.Id).All(u => u.UnitNumber.HasValue)
            }).ToList(),
            Courts = courts.Select(c => {
                // Find current game (playing/started on this court)
                var currentGame = games.FirstOrDefault(g =>
                    g.TournamentCourtId == c.Id &&
                    (g.Status == "Playing" || g.Status == "Started" || g.Status == "InProgress"));

                // Find next game (queued for this court, ordered by queued time)
                var nextGame = games
                    .Where(g => g.TournamentCourtId == c.Id && g.Status == "Queued")
                    .OrderBy(g => g.QueuedAt ?? DateTime.MaxValue)
                    .FirstOrDefault();

                return new TournamentCourtDto
                {
                    Id = c.Id,
                    EventId = c.EventId,
                    CourtLabel = c.CourtLabel,
                    Status = c.Status,
                    CurrentGameId = c.CurrentGameId,
                    CurrentGame = BuildGameInfo(currentGame),
                    NextGame = BuildGameInfo(nextGame),
                    SortOrder = c.SortOrder
                };
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

        var validStatuses = new[] { "Draft", "RegistrationOpen", "RegistrationClosed", "ScheduleReady", "Drawing", "Running", "Completed", "Cancelled" };
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
            JoinMethod = u.JoinMethod ?? "Approval",
            JoinCode = u.JoinCode,
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
                    JoinRequestId = null,
                    // Member-level payment info
                    HasPaid = m.HasPaid,
                    PaidAt = m.PaidAt,
                    AmountPaid = m.AmountPaid,
                    PaymentProofUrl = m.PaymentProofUrl,
                    PaymentReference = m.PaymentReference,
                    PaymentMethod = m.PaymentMethod,
                    ReferenceId = m.ReferenceId
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

    private EventMatchDto MapToMatchDto(EventEncounter m)
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
            Games = m.Matches.SelectMany(match => match.Games).OrderBy(g => g.GameNumber).Select(MapToGameDto).ToList(),
            Unit1GamesWon = m.Matches.SelectMany(match => match.Games).Count(g => g.WinnerUnitId == m.Unit1Id),
            Unit2GamesWon = m.Matches.SelectMany(match => match.Games).Count(g => g.WinnerUnitId == m.Unit2Id)
        };
    }

    private EventGameDto MapToGameDto(EventGame g)
    {
        return new EventGameDto
        {
            Id = g.Id,
            EncounterMatchId = g.EncounterMatchId,
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

    private List<EventEncounter> GenerateRoundRobinMatches(EventDivision division, List<EventUnit> units, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventEncounter>();
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
                    matches.Add(new EventEncounter
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

    private List<EventEncounter> GenerateSingleEliminationMatches(EventDivision division, List<EventUnit> units, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventEncounter>();
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
                matches.Add(new EventEncounter
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
    private List<EventEncounter> GenerateRoundRobinMatchesForTarget(EventDivision division, int targetUnitCount, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventEncounter>();
        var poolCount = request.PoolCount ?? 1;

        // Generate round robin within each pool using placeholder numbers
        for (int pool = 1; pool <= poolCount; pool++)
        {
            // Determine which unit numbers belong to this pool
            // Seed evenly: unit 1 to pool 1, unit 2 to pool 2, unit 3 to pool 3, then unit 4 to pool 1, etc.
            var poolUnitNumbers = new List<int>();
            for (int i = 0; i < targetUnitCount; i++)
            {
                if ((i % poolCount) + 1 == pool)
                {
                    poolUnitNumbers.Add(i + 1);
                }
            }

            // Use circle method for balanced round-robin scheduling
            // This ensures each unit gets roughly equal wait time between matches
            var roundRobinMatches = GenerateCircleMethodSchedule(poolUnitNumbers);

            var matchNum = 1;
            foreach (var (unit1, unit2, roundNum) in roundRobinMatches)
            {
                matches.Add(new EventEncounter
                {
                    EventId = division.EventId,
                    DivisionId = division.Id,
                    RoundType = "Pool",
                    RoundNumber = pool,
                    RoundName = $"Pool {(char)('A' + pool - 1)}",
                    MatchNumber = matchNum++,
                    EncounterNumber = roundNum, // Use encounter number to track round within pool
                    Unit1Number = unit1,
                    Unit2Number = unit2,
                    BestOf = request.BestOf,
                    ScoreFormatId = request.ScoreFormatId,
                    Status = "Scheduled",
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                });
            }
        }

        return matches;
    }

    /// <summary>
    /// Generate round-robin matches using the circle method (polygon method)
    /// This ensures balanced wait times - each unit plays once per round
    /// </summary>
    private List<(int unit1, int unit2, int round)> GenerateCircleMethodSchedule(List<int> unitNumbers)
    {
        var matches = new List<(int unit1, int unit2, int round)>();
        var n = unitNumbers.Count;

        if (n < 2) return matches;

        // For odd number of units, add a dummy (BYE) position
        var units = new List<int>(unitNumbers);
        bool hasBye = (n % 2 == 1);
        if (hasBye)
        {
            units.Add(-1); // -1 represents BYE (will be filtered out)
            n++;
        }

        // Number of rounds = n-1 for even, n for odd (but we added dummy, so still n-1)
        var rounds = n - 1;

        // Circle method: fix position 0, rotate others
        for (int round = 0; round < rounds; round++)
        {
            // In each round, pair units[i] with units[n-1-i]
            for (int i = 0; i < n / 2; i++)
            {
                int pos1 = i;
                int pos2 = n - 1 - i;

                // Get actual indices after rotation
                int idx1 = (pos1 == 0) ? 0 : ((pos1 + round - 1) % (n - 1)) + 1;
                int idx2 = (pos2 == 0) ? 0 : ((pos2 + round - 1) % (n - 1)) + 1;

                var unit1 = units[idx1];
                var unit2 = units[idx2];

                // Skip matches involving the BYE
                if (unit1 == -1 || unit2 == -1) continue;

                // Ensure lower unit number is always unit1 for consistency
                if (unit1 > unit2)
                {
                    (unit1, unit2) = (unit2, unit1);
                }

                matches.Add((unit1, unit2, round + 1));
            }
        }

        return matches;
    }

    private List<EventEncounter> GeneratePlayoffMatchesForTarget(EventDivision division, int playoffUnits, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventEncounter>();

        // Find next power of 2 for bracket size
        var bracketSize = 1;
        while (bracketSize < playoffUnits) bracketSize *= 2;

        var rounds = (int)Math.Log2(bracketSize);
        var matchNum = 1;

        // Get pool configuration
        var poolCount = request.PoolCount ?? 1;
        var playoffFromPools = request.PlayoffFromPools ?? 2;

        // Generate seed labels for playoff positions
        // Standard cross-pool seeding: Pool A #1 vs Pool B #2, Pool B #1 vs Pool A #2, etc.
        var seedLabels = GeneratePlayoffSeedLabels(poolCount, playoffFromPools, bracketSize);

        // Get seeded bracket positions for first round
        var seedPositions = GetSeededBracketPositions(bracketSize);

        for (int round = 1; round <= rounds; round++)
        {
            var matchesInRound = bracketSize / (int)Math.Pow(2, round);
            var roundName = round == rounds ? "Playoff Final" :
                           round == rounds - 1 ? "Playoff Semifinal" :
                           round == rounds - 2 ? "Playoff Quarterfinal" :
                           $"Playoff Round {round}";
            var roundAbbr = round == rounds ? "F" :
                           round == rounds - 1 ? "SF" :
                           round == rounds - 2 ? "QF" :
                           $"R{round}";

            for (int m = 1; m <= matchesInRound; m++)
            {
                var matchIdx = matchNum;
                string? unit1Label = null;
                string? unit2Label = null;

                if (round == 1)
                {
                    // First round: use pool-based seed labels
                    var matchup = seedPositions[m - 1];
                    var seed1 = matchup.Item1;
                    var seed2 = matchup.Item2;

                    unit1Label = seed1 <= playoffUnits && seedLabels.ContainsKey(seed1) ? seedLabels[seed1] : null;
                    unit2Label = seed2 <= playoffUnits && seedLabels.ContainsKey(seed2) ? seedLabels[seed2] : null;

                    // Handle byes
                    if (seed1 > playoffUnits) unit1Label = "BYE";
                    if (seed2 > playoffUnits) unit2Label = "BYE";
                }
                else
                {
                    // Later rounds: reference winners from previous round
                    // Calculate which matches from previous round feed into this one
                    var prevRoundMatchBase = 0;
                    for (int r = 1; r < round; r++)
                    {
                        prevRoundMatchBase += bracketSize / (int)Math.Pow(2, r);
                    }
                    var prevRoundMatchCount = bracketSize / (int)Math.Pow(2, round - 1);
                    var prevRoundAbbr = round - 1 == rounds - 1 ? "SF" :
                                        round - 1 == rounds - 2 ? "QF" :
                                        $"R{round - 1}";

                    // Match m in this round comes from matches (m*2-1) and (m*2) in previous round
                    var prevMatch1 = prevRoundMatchBase - prevRoundMatchCount + (m * 2 - 1);
                    var prevMatch2 = prevRoundMatchBase - prevRoundMatchCount + (m * 2);

                    unit1Label = $"W {prevRoundAbbr}{m * 2 - 1}";
                    unit2Label = $"W {prevRoundAbbr}{m * 2}";
                }

                matches.Add(new EventEncounter
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
                    Unit1SeedLabel = unit1Label,
                    Unit2SeedLabel = unit2Label,
                    Status = "Scheduled",
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                });
            }
        }

        // Add bronze medal match (3rd place) - between losers of semi-finals
        // Only add if there are at least 2 rounds (meaning there are semi-finals)
        if (rounds >= 2)
        {
            matches.Add(new EventEncounter
            {
                EventId = division.EventId,
                DivisionId = division.Id,
                RoundType = RoundType.ThirdPlace,
                RoundNumber = rounds, // Same round as finals
                RoundName = "Bronze Medal",
                MatchNumber = matchNum++,
                BracketPosition = 1,
                Unit1SeedLabel = "L SF1", // Loser of Playoff Semi-final 1
                Unit2SeedLabel = "L SF2", // Loser of Playoff Semi-final 2
                BestOf = request.PlayoffGamesPerMatch ?? request.BestOf,
                ScoreFormatId = request.PlayoffScoreFormatId ?? request.ScoreFormatId,
                Status = "Scheduled",
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            });
        }

        return matches;
    }

    /// <summary>
    /// Generate seed labels for playoff positions based on pool configuration.
    /// Cross-pool seeding ensures pool winners face lower seeds from other pools.
    /// </summary>
    private Dictionary<int, string> GeneratePlayoffSeedLabels(int poolCount, int playoffFromPools, int bracketSize)
    {
        var labels = new Dictionary<int, string>();

        // Pool names: A, B, C, D, etc.
        var poolNames = Enumerable.Range(0, poolCount).Select(i => (char)('A' + i)).ToArray();

        // Generate seeds by alternating pools for each rank position
        // Seed 1: Pool A #1, Seed 2: Pool B #1, Seed 3: Pool C #1, ...
        // Seed N+1: Pool A #2, Seed N+2: Pool B #2, ...
        var seed = 1;
        for (int rank = 1; rank <= playoffFromPools && seed <= bracketSize; rank++)
        {
            for (int pool = 0; pool < poolCount && seed <= bracketSize; pool++)
            {
                labels[seed] = $"Pool {poolNames[pool]} #{rank}";
                seed++;
            }
        }

        return labels;
    }

    private List<EventEncounter> GenerateSingleEliminationMatchesForTarget(EventDivision division, int targetUnitCount, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventEncounter>();

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
                matches.Add(new EventEncounter
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

        // Add bronze medal match (3rd place) - between losers of semi-finals
        // Only add if there are at least 4 units (meaning there are semi-finals)
        if (rounds >= 2)
        {
            matches.Add(new EventEncounter
            {
                EventId = division.EventId,
                DivisionId = division.Id,
                RoundType = RoundType.ThirdPlace,
                RoundNumber = rounds, // Same round as finals
                RoundName = "Bronze Medal",
                MatchNumber = matchNum++,
                BracketPosition = 1,
                Unit1SeedLabel = "L SF1", // Loser of Semi-final 1
                Unit2SeedLabel = "L SF2", // Loser of Semi-final 2
                BestOf = request.BestOf,
                ScoreFormatId = request.ScoreFormatId,
                Status = "Scheduled",
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            });
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

    private List<EventEncounter> GenerateDoubleEliminationMatchesForTarget(EventDivision division, int targetUnitCount, CreateMatchScheduleRequest request)
    {
        var matches = new List<EventEncounter>();

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
                matches.Add(new EventEncounter
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
                matches.Add(new EventEncounter
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
        matches.Add(new EventEncounter
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

    private string? GetMatchScore(EventEncounter match)
    {
        var allGames = match.Matches.SelectMany(m => m.Games);
        // Show scores for any game that has been scored (has non-zero scores or is finished/completed)
        var scoredGames = allGames
            .Where(g => g.Status == "Finished" || g.Status == "Completed" ||
                        g.Unit1Score > 0 || g.Unit2Score > 0)
            .OrderBy(g => g.GameNumber)
            .ToList();

        if (!scoredGames.Any()) return null;

        return string.Join(", ", scoredGames.Select(g => $"{g.Unit1Score}-{g.Unit2Score}"));
    }

    private async Task UpdateUnitStats(EventGame game)
    {
        var encounter = game.EncounterMatch?.Encounter;
        if (encounter == null) return;

        var unit1 = await _context.EventUnits.FindAsync(encounter.Unit1Id);
        var unit2 = await _context.EventUnits.FindAsync(encounter.Unit2Id);

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

    /// <summary>
    /// Adjusts unit stats when an already-finished game's score is changed.
    /// Subtracts old values and adds new values.
    /// </summary>
    private async Task AdjustUnitStats(EventEncounter encounter,
        int oldUnit1Score, int oldUnit2Score, int? oldWinnerId,
        int newUnit1Score, int newUnit2Score, int? newWinnerId)
    {
        var unit1 = await _context.EventUnits.FindAsync(encounter.Unit1Id);
        var unit2 = await _context.EventUnits.FindAsync(encounter.Unit2Id);

        if (unit1 != null)
        {
            // Adjust games won/lost if winner changed
            if (oldWinnerId != newWinnerId)
            {
                if (oldWinnerId == unit1.Id)
                {
                    unit1.GamesWon--;
                    unit1.GamesLost++;
                }
                else if (newWinnerId == unit1.Id)
                {
                    unit1.GamesWon++;
                    unit1.GamesLost--;
                }
            }

            // Adjust points (subtract old, add new)
            unit1.PointsScored = unit1.PointsScored - oldUnit1Score + newUnit1Score;
            unit1.PointsAgainst = unit1.PointsAgainst - oldUnit2Score + newUnit2Score;
            unit1.UpdatedAt = DateTime.Now;
        }

        if (unit2 != null)
        {
            // Adjust games won/lost if winner changed
            if (oldWinnerId != newWinnerId)
            {
                if (oldWinnerId == unit2.Id)
                {
                    unit2.GamesWon--;
                    unit2.GamesLost++;
                }
                else if (newWinnerId == unit2.Id)
                {
                    unit2.GamesWon++;
                    unit2.GamesLost--;
                }
            }

            // Adjust points (subtract old, add new)
            unit2.PointsScored = unit2.PointsScored - oldUnit2Score + newUnit2Score;
            unit2.PointsAgainst = unit2.PointsAgainst - oldUnit1Score + newUnit1Score;
            unit2.UpdatedAt = DateTime.Now;
        }
    }

    /// <summary>
    /// When a game finishes and frees up a court, check if there's another game queued
    /// on that court and automatically start it.
    /// </summary>
    private async Task StartNextQueuedGameOnCourt(int courtId, int eventId)
    {
        // Find the next queued game on this court
        var nextGame = await _context.EventGames
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(e => e!.Unit1).ThenInclude(u => u!.Members)
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter)
                .ThenInclude(e => e!.Unit2).ThenInclude(u => u!.Members)
            .Include(g => g.TournamentCourt)
            .Where(g => g.TournamentCourtId == courtId
                && g.Status == "Queued"
                && g.EncounterMatch!.Encounter!.EventId == eventId)
            .OrderBy(g => g.QueuedAt)
            .FirstOrDefaultAsync();

        if (nextGame == null) return;

        // Start the next game
        nextGame.Status = "InProgress";
        nextGame.StartedAt = DateTime.Now;
        nextGame.UpdatedAt = DateTime.Now;

        // Update the court status
        var court = await _context.TournamentCourts.FindAsync(courtId);
        if (court != null)
        {
            court.Status = "InUse";
            court.CurrentGameId = nextGame.Id;
        }

        await _context.SaveChangesAsync();

        // Send notifications to players
        var encounter = nextGame.EncounterMatch?.Encounter;
        if (encounter != null)
        {
            var playerIds = new List<int>();
            if (encounter.Unit1?.Members != null)
                playerIds.AddRange(encounter.Unit1.Members.Where(m => m.InviteStatus == "Accepted").Select(m => m.UserId));
            if (encounter.Unit2?.Members != null)
                playerIds.AddRange(encounter.Unit2.Members.Where(m => m.InviteStatus == "Accepted").Select(m => m.UserId));

            if (playerIds.Count > 0)
            {
                var unit1Name = encounter.Unit1?.Name ?? "Team 1";
                var unit2Name = encounter.Unit2?.Name ?? "Team 2";
                var courtName = nextGame.TournamentCourt?.CourtLabel ?? "assigned court";
                var actionUrl = $"/event/{encounter.EventId}/gameday";

                foreach (var playerId in playerIds.Distinct())
                {
                    await _notificationService.CreateAndSendAsync(
                        playerId,
                        "GameUpdate",
                        "Game Starting!",
                        $"{unit1Name} vs {unit2Name} - {courtName}",
                        actionUrl,
                        "Game",
                        nextGame.Id);
                }
            }

            // Broadcast to event group for admin dashboard refresh
            await _notificationService.SendToEventAsync(encounter.EventId, new NotificationPayload
            {
                Type = "GameUpdate",
                Title = "Game Started",
                Message = $"Next game auto-started on {court?.CourtLabel}",
                ReferenceType = "Game",
                ReferenceId = nextGame.Id,
                CreatedAt = DateTime.Now
            });
        }
    }

    private async Task CheckMatchComplete(int matchId)
    {
        var match = await _context.EventEncounters
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .Include(m => m.Unit1)
            .Include(m => m.Unit2)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null) return;

        var allGames = match.Matches.SelectMany(m => m.Games);
        var gamesNeeded = (match.BestOf / 2) + 1;
        var unit1Wins = allGames.Count(g => g.WinnerUnitId == match.Unit1Id);
        var unit2Wins = allGames.Count(g => g.WinnerUnitId == match.Unit2Id);

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

            await _context.SaveChangesAsync();

            // Broadcast match completion
            await _scoreBroadcaster.BroadcastMatchCompleted(match.EventId, match.DivisionId, new MatchCompletedDto
            {
                EncounterId = match.Id,
                DivisionId = match.DivisionId,
                RoundType = match.RoundType ?? "",
                RoundName = match.RoundName ?? "",
                Unit1Id = match.Unit1Id,
                Unit1Name = match.Unit1?.Name,
                Unit2Id = match.Unit2Id,
                Unit2Name = match.Unit2?.Name,
                WinnerUnitId = match.WinnerUnitId,
                WinnerName = winner?.Name,
                Score = $"{unit1Wins} - {unit2Wins}",
                CompletedAt = match.CompletedAt ?? DateTime.Now
            });

            // Check for bracket progression (playoff matches only)
            if (match.RoundType == "Bracket" || match.RoundType == "Final" || match.RoundType == "ThirdPlace")
            {
                var progressionResult = await _bracketProgressionService.CheckAndAdvanceAsync(matchId);

                if (progressionResult.WinnerAdvanced && progressionResult.NextMatchId.HasValue)
                {
                    // Broadcast bracket progression
                    await _scoreBroadcaster.BroadcastBracketProgression(match.EventId, match.DivisionId, new BracketProgressionDto
                    {
                        FromEncounterId = match.Id,
                        ToEncounterId = progressionResult.NextMatchId.Value,
                        DivisionId = match.DivisionId,
                        WinnerUnitId = match.WinnerUnitId ?? 0,
                        WinnerName = winner?.Name ?? "",
                        FromRoundName = match.RoundName ?? "",
                        NextRoundName = progressionResult.NextMatchRoundName ?? "",
                        SlotPosition = (match.BracketPosition ?? 0) % 2 == 1 ? 1 : 2,
                        AdvancedAt = DateTime.Now
                    });

                    _logger.LogInformation(
                        "Bracket progression: {WinnerName} advanced from {FromRound} to {NextRound} (Match {FromMatch} -> {ToMatch})",
                        winner?.Name, match.RoundName, progressionResult.NextMatchRoundName,
                        match.Id, progressionResult.NextMatchId);
                }
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

    // ============================================
    // Live Drawing
    // ============================================

    /// <summary>
    /// Get the current drawing state for a division
    /// </summary>
    [HttpGet("divisions/{divisionId}/drawing")]
    public async Task<ActionResult<ApiResponse<DrawingStateDto>>> GetDrawingState(int divisionId)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<DrawingStateDto> { Success = false, Message = "Division not found" });

        if (!division.DrawingInProgress)
            return Ok(new ApiResponse<DrawingStateDto> { Success = true, Data = null, Message = "No drawing in progress" });

        var units = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .ToListAsync();

        var drawnUnits = units
            .Where(u => u.UnitNumber.HasValue)
            .OrderBy(u => u.UnitNumber)
            .Select(u => new DrawnUnitDto
            {
                UnitId = u.Id,
                UnitNumber = u.UnitNumber!.Value,
                UnitName = u.Name,
                MemberNames = u.Members.Where(m => m.InviteStatus == "Accepted" && m.User != null)
                    .Select(m => Utility.FormatName(m.User!.LastName, m.User.FirstName)).ToList(),
                DrawnAt = u.UpdatedAt
            }).ToList();

        var remainingUnitNames = units
            .Where(u => !u.UnitNumber.HasValue)
            .Select(u => u.Name)
            .ToList();

        var startedBy = division.DrawingByUserId.HasValue
            ? await _context.Users.FindAsync(division.DrawingByUserId.Value)
            : null;

        var state = new DrawingStateDto
        {
            DivisionId = division.Id,
            DivisionName = division.Name,
            EventId = division.EventId,
            EventName = division.Event?.Name ?? "",
            TotalUnits = units.Count,
            DrawnCount = drawnUnits.Count,
            DrawnUnits = drawnUnits,
            RemainingUnitNames = remainingUnitNames,
            StartedAt = division.DrawingStartedAt ?? DateTime.Now,
            StartedByName = startedBy != null ? Utility.FormatName(startedBy.LastName, startedBy.FirstName) : null
        };

        return Ok(new ApiResponse<DrawingStateDto> { Success = true, Data = state });
    }

    /// <summary>
    /// Start a live drawing session for a division
    /// </summary>
    [Authorize]
    [HttpPost("divisions/{divisionId}/drawing/start")]
    public async Task<ActionResult<ApiResponse<DrawingStateDto>>> StartDrawing(int divisionId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<DrawingStateDto> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<DrawingStateDto> { Success = false, Message = "Division not found" });

        var evt = division.Event;
        if (evt == null)
            return NotFound(new ApiResponse<DrawingStateDto> { Success = false, Message = "Event not found" });

        // Check if user is organizer or admin
        if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
            return Forbid();

        // Check if drawing is already in progress
        if (division.DrawingInProgress)
            return BadRequest(new ApiResponse<DrawingStateDto> { Success = false, Message = "Drawing is already in progress" });

        // Check registration is closed
        var now = DateTime.Now;
        var isRegistrationOpen = evt.TournamentStatus == "RegistrationOpen" ||
            (evt.RegistrationOpenDate <= now && (evt.RegistrationCloseDate == null || evt.RegistrationCloseDate > now));

        if (isRegistrationOpen)
            return BadRequest(new ApiResponse<DrawingStateDto> { Success = false, Message = "Cannot start drawing while registration is still open" });

        // Check schedule status
        if (division.ScheduleStatus == "Finalized")
            return BadRequest(new ApiResponse<DrawingStateDto> { Success = false, Message = "Schedule is already finalized. Clear the schedule first if you need to redraw." });

        // Get and validate units
        var units = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .ToListAsync();

        if (!units.Any())
            return BadRequest(new ApiResponse<DrawingStateDto> { Success = false, Message = "No units to draw" });

        // Note: Team completion check removed - admin can draw even with incomplete teams for testing

        // Clear any existing unit numbers
        foreach (var unit in units)
        {
            unit.UnitNumber = null;
            unit.PoolNumber = null;
            unit.PoolName = null;
        }

        // Start the drawing
        division.DrawingInProgress = true;
        division.DrawingStartedAt = DateTime.Now;
        division.DrawingByUserId = userId.Value;
        division.DrawingSequence = 0;
        division.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        var startedBy = await _context.Users.FindAsync(userId.Value);
        var state = new DrawingStateDto
        {
            DivisionId = division.Id,
            DivisionName = division.Name,
            EventId = division.EventId,
            EventName = evt.Name,
            TotalUnits = units.Count,
            DrawnCount = 0,
            DrawnUnits = new List<DrawnUnitDto>(),
            RemainingUnitNames = units.Select(u => u.Name).ToList(),
            StartedAt = division.DrawingStartedAt.Value,
            StartedByName = startedBy != null ? Utility.FormatName(startedBy.LastName, startedBy.FirstName) : null
        };

        // Broadcast to connected viewers (both division and event level)
        await _drawingBroadcaster.BroadcastDrawingStarted(divisionId, state);
        await _drawingBroadcaster.BroadcastEventDrawingStarted(division.EventId, divisionId, state);

        return Ok(new ApiResponse<DrawingStateDto> { Success = true, Data = state });
    }

    /// <summary>
    /// Draw the next unit (randomly selects from remaining units)
    /// </summary>
    [Authorize]
    [HttpPost("divisions/{divisionId}/drawing/next")]
    public async Task<ActionResult<ApiResponse<DrawnUnitDto>>> DrawNextUnit(int divisionId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<DrawnUnitDto> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<DrawnUnitDto> { Success = false, Message = "Division not found" });

        var evt = division.Event;
        if (evt == null)
            return NotFound(new ApiResponse<DrawnUnitDto> { Success = false, Message = "Event not found" });

        // Check if user is organizer or admin
        if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
            return Forbid();

        // Use stored procedure for atomic drawing to prevent race conditions
        var drawnUnitIdParam = new Microsoft.Data.SqlClient.SqlParameter("@DrawnUnitId", System.Data.SqlDbType.Int)
        {
            Direction = System.Data.ParameterDirection.Output
        };
        var assignedNumberParam = new Microsoft.Data.SqlClient.SqlParameter("@AssignedNumber", System.Data.SqlDbType.Int)
        {
            Direction = System.Data.ParameterDirection.Output
        };

        try
        {
            await _context.Database.ExecuteSqlRawAsync(
                "EXEC sp_DrawNextUnit @DivisionId, @DrawnUnitId OUTPUT, @AssignedNumber OUTPUT",
                new Microsoft.Data.SqlClient.SqlParameter("@DivisionId", divisionId),
                drawnUnitIdParam,
                assignedNumberParam
            );
        }
        catch (Microsoft.Data.SqlClient.SqlException ex)
        {
            // Map stored procedure errors to appropriate HTTP responses
            if (ex.Message.Contains("Division not found"))
                return NotFound(new ApiResponse<DrawnUnitDto> { Success = false, Message = "Division not found" });
            if (ex.Message.Contains("No drawing in progress"))
                return BadRequest(new ApiResponse<DrawnUnitDto> { Success = false, Message = "No drawing in progress. Start a drawing first." });
            if (ex.Message.Contains("No units remaining"))
                return BadRequest(new ApiResponse<DrawnUnitDto> { Success = false, Message = "All units have been drawn. Complete the drawing." });
            throw;
        }

        var drawnUnitId = (int)drawnUnitIdParam.Value;
        var assignedNumber = (int)assignedNumberParam.Value;

        // Fetch the drawn unit with member details for the response
        var selectedUnit = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(u => u.Id == drawnUnitId);

        if (selectedUnit == null)
            return StatusCode(500, new ApiResponse<DrawnUnitDto> { Success = false, Message = "Failed to retrieve drawn unit" });

        var drawnUnit = new DrawnUnitDto
        {
            UnitId = selectedUnit.Id,
            UnitNumber = assignedNumber,
            UnitName = selectedUnit.Name,
            MemberNames = selectedUnit.Members.Where(m => m.InviteStatus == "Accepted" && m.User != null)
                .Select(m => Utility.FormatName(m.User!.LastName, m.User.FirstName)).ToList(),
            DrawnAt = DateTime.Now
        };

        // Broadcast to connected viewers (both division and event level)
        await _drawingBroadcaster.BroadcastUnitDrawn(divisionId, drawnUnit);
        await _drawingBroadcaster.BroadcastEventUnitDrawn(division.EventId, divisionId, drawnUnit);

        return Ok(new ApiResponse<DrawnUnitDto> { Success = true, Data = drawnUnit });
    }

    /// <summary>
    /// Complete the drawing and finalize unit assignments
    /// </summary>
    [Authorize]
    [HttpPost("divisions/{divisionId}/drawing/complete")]
    public async Task<ActionResult<ApiResponse<DrawingCompletedDto>>> CompleteDrawing(int divisionId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<DrawingCompletedDto> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<DrawingCompletedDto> { Success = false, Message = "Division not found" });

        var evt = division.Event;
        if (evt == null)
            return NotFound(new ApiResponse<DrawingCompletedDto> { Success = false, Message = "Event not found" });

        // Check if user is organizer or admin
        if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
            return Forbid();

        // Check if drawing is in progress
        if (!division.DrawingInProgress)
            return BadRequest(new ApiResponse<DrawingCompletedDto> { Success = false, Message = "No drawing in progress" });

        // Check all units are drawn
        var undrawnUnits = await _context.EventUnits
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted" && u.UnitNumber == null)
            .CountAsync();

        if (undrawnUnits > 0)
            return BadRequest(new ApiResponse<DrawingCompletedDto> { Success = false, Message = $"{undrawnUnits} units have not been drawn yet" });

        // Update matches with actual unit IDs based on assigned numbers
        var units = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .ToListAsync();

        var matches = await _context.EventEncounters
            .Where(m => m.DivisionId == divisionId)
            .ToListAsync();

        foreach (var match in matches)
        {
            match.Unit1Id = units.FirstOrDefault(u => u.UnitNumber == match.Unit1Number)?.Id;
            match.Unit2Id = units.FirstOrDefault(u => u.UnitNumber == match.Unit2Number)?.Id;
            match.UpdatedAt = DateTime.Now;

            // Handle byes
            if (match.Unit1Id == null && match.Unit2Id != null)
            {
                match.WinnerUnitId = match.Unit2Id;
                match.Status = "Bye";
            }
            else if (match.Unit2Id == null && match.Unit1Id != null)
            {
                match.WinnerUnitId = match.Unit1Id;
                match.Status = "Bye";
            }
        }

        // End the drawing session
        division.DrawingInProgress = false;
        division.ScheduleStatus = "UnitsAssigned";
        division.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        var finalOrder = units
            .OrderBy(u => u.UnitNumber)
            .Select(u => new DrawnUnitDto
            {
                UnitId = u.Id,
                UnitNumber = u.UnitNumber ?? 0,
                UnitName = u.Name,
                MemberNames = u.Members.Where(m => m.InviteStatus == "Accepted" && m.User != null)
                    .Select(m => Utility.FormatName(m.User!.LastName, m.User.FirstName)).ToList(),
                DrawnAt = u.UpdatedAt
            }).ToList();

        var result = new DrawingCompletedDto
        {
            DivisionId = divisionId,
            FinalOrder = finalOrder,
            CompletedAt = DateTime.Now
        };

        // Broadcast completion to connected viewers (both division and event level)
        await _drawingBroadcaster.BroadcastDrawingCompleted(divisionId, result);
        await _drawingBroadcaster.BroadcastEventDrawingCompleted(division.EventId, divisionId, result);

        return Ok(new ApiResponse<DrawingCompletedDto> { Success = true, Data = result });
    }

    /// <summary>
    /// Cancel an in-progress drawing
    /// </summary>
    [Authorize]
    [HttpPost("divisions/{divisionId}/drawing/cancel")]
    public async Task<ActionResult<ApiResponse<bool>>> CancelDrawing(int divisionId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Division not found" });

        var evt = division.Event;
        if (evt == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

        // Check if user is organizer or admin
        if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
            return Forbid();

        // Allow cancelling both in-progress drawings and completed drawings (for redraw)
        // Check if there's anything to reset (either drawing in progress or units already assigned)
        var hasUnitsAssigned = await _context.EventUnits
            .AnyAsync(u => u.DivisionId == divisionId
                && u.Status != "Cancelled" && u.Status != "Waitlisted"
                && u.UnitNumber != null);

        if (!division.DrawingInProgress && !hasUnitsAssigned)
        {
            // Nothing to reset in database - but still broadcast to ensure UI state is synced
            await _drawingBroadcaster.BroadcastDrawingCancelled(divisionId);
            await _drawingBroadcaster.BroadcastEventDrawingCancelled(division.EventId, divisionId);
            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Already reset" });
        }

        // Clear unit numbers assigned during this drawing
        var units = await _context.EventUnits
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .ToListAsync();

        foreach (var unit in units)
        {
            unit.UnitNumber = null;
            unit.PoolNumber = null;
            unit.PoolName = null;
        }

        // Clear Unit1Id/Unit2Id from pool encounters to prevent stale pool assignments
        // This ensures GetSchedule derives pools correctly after a new drawing
        var poolEncounters = await _context.EventEncounters
            .Where(m => m.DivisionId == divisionId && m.RoundType == "Pool")
            .ToListAsync();

        foreach (var encounter in poolEncounters)
        {
            encounter.Unit1Id = null;
            encounter.Unit2Id = null;
            encounter.WinnerUnitId = null;
            encounter.Status = "Scheduled";
            encounter.UpdatedAt = DateTime.Now;
        }

        // End the drawing session and reset status
        division.DrawingInProgress = false;
        division.DrawingStartedAt = null;
        division.DrawingByUserId = null;
        division.DrawingSequence = 0;
        division.ScheduleStatus = "NotGenerated"; // Reset so drawing can start again
        division.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        // Broadcast cancellation to connected viewers (both division and event level)
        await _drawingBroadcaster.BroadcastDrawingCancelled(divisionId);
        await _drawingBroadcaster.BroadcastEventDrawingCancelled(division.EventId, divisionId);

        return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Drawing cancelled" });
    }

    // ============================================
    // Event-Level Drawing State (for Drawing Monitor)
    // ============================================

    /// <summary>
    /// Get the complete drawing state for an event (all divisions)
    /// Used by the drawing monitor page to show all divisions' drawing states
    /// </summary>
    [HttpGet("events/{eventId}/drawing")]
    public async Task<ActionResult<ApiResponse<EventDrawingStateDto>>> GetEventDrawingState(int eventId)
    {
        var evt = await _context.Events
            .Include(e => e.Divisions)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new ApiResponse<EventDrawingStateDto> { Success = false, Message = "Event not found" });

        var divisions = await _context.EventDivisions
            .Include(d => d.TeamUnit)
            .Where(d => d.EventId == eventId)
            .OrderBy(d => d.Name)
            .ToListAsync();

        var divisionStates = new List<DivisionDrawingStateDto>();

        foreach (var division in divisions)
        {
            var units = await _context.EventUnits
                .Include(u => u.Members)
                    .ThenInclude(m => m.User)
                .Where(u => u.DivisionId == division.Id && u.Status != "Cancelled" && u.Status != "Waitlisted")
                .ToListAsync();

            var drawnUnits = units
                .Where(u => u.UnitNumber.HasValue)
                .OrderBy(u => u.UnitNumber)
                .Select(u => new DrawnUnitDto
                {
                    UnitId = u.Id,
                    UnitNumber = u.UnitNumber!.Value,
                    UnitName = u.Name,
                    MemberNames = u.Members.Where(m => m.InviteStatus == "Accepted" && m.User != null)
                        .Select(m => Utility.FormatName(m.User!.LastName, m.User.FirstName)).ToList(),
                    DrawnAt = u.UpdatedAt
                }).ToList();

            var remainingUnitNames = units
                .Where(u => !u.UnitNumber.HasValue)
                .Select(u => u.Name)
                .ToList();

            User? startedBy = null;
            if (division.DrawingByUserId.HasValue)
            {
                startedBy = await _context.Users.FindAsync(division.DrawingByUserId.Value);
            }

            // Build units list with member info for display
            var unitsWithMembers = units.Select(u => new DrawingUnitDto
            {
                UnitId = u.Id,
                UnitName = u.Name,
                UnitNumber = u.UnitNumber,
                Members = u.Members
                    .Where(m => m.InviteStatus == "Accepted" && m.User != null)
                    .Select(m => new DrawingMemberDto
                    {
                        UserId = m.UserId,
                        Name = Utility.FormatName(m.User!.LastName, m.User.FirstName) ?? "",
                        AvatarUrl = m.User.ProfileImageUrl
                    }).ToList()
            }).ToList();

            divisionStates.Add(new DivisionDrawingStateDto
            {
                DivisionId = division.Id,
                DivisionName = division.Name,
                TeamSize = division.TeamUnit?.TotalPlayers ?? division.TeamSize,
                ScheduleStatus = division.ScheduleStatus ?? "NotGenerated",
                DrawingInProgress = division.DrawingInProgress,
                DrawingStartedAt = division.DrawingStartedAt,
                DrawingByName = startedBy != null ? Utility.FormatName(startedBy.LastName, startedBy.FirstName) : null,
                TotalUnits = units.Count,
                DrawnCount = drawnUnits.Count,
                DrawnUnits = drawnUnits,
                RemainingUnitNames = remainingUnitNames,
                Units = unitsWithMembers
            });
        }

        // Get current viewers
        var viewers = DrawingHub.GetEventViewers(eventId);

        // Check if current user can manage event
        var isOrganizer = await CanManageEventAsync(eventId);

        var state = new EventDrawingStateDto
        {
            EventId = evt.Id,
            EventName = evt.Name,
            TournamentStatus = evt.TournamentStatus ?? "Draft",
            IsOrganizer = isOrganizer,
            Divisions = divisionStates,
            Viewers = viewers,
            ViewerCount = viewers.Count
        };

        return Ok(new ApiResponse<EventDrawingStateDto> { Success = true, Data = state });
    }

    /// <summary>
    /// Set event tournament status to Drawing mode
    /// </summary>
    [Authorize]
    [HttpPost("events/{eventId}/drawing/start-mode")]
    public async Task<ActionResult<ApiResponse<bool>>> StartDrawingMode(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

        // Check if user is organizer or admin
        if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
            return Forbid();

        // Set to Drawing status
        evt.TournamentStatus = "Drawing";
        evt.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Event is now in Drawing mode" });
    }

    /// <summary>
    /// End drawing mode and transition to next status
    /// </summary>
    [Authorize]
    [HttpPost("events/{eventId}/drawing/end-mode")]
    public async Task<ActionResult<ApiResponse<bool>>> EndDrawingMode(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

        // Check if user is organizer or admin
        if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
            return Forbid();

        // Check if all divisions have completed drawing
        var divisions = await _context.EventDivisions
            .Where(d => d.EventId == eventId)
            .ToListAsync();

        var anyDrawingInProgress = divisions.Any(d => d.DrawingInProgress);
        if (anyDrawingInProgress)
            return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot end drawing mode while a division drawing is in progress" });

        // Set to Running status (or ScheduleReady if you prefer)
        evt.TournamentStatus = "Running";
        evt.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Drawing mode ended, event is now Running" });
    }

    // ==================== Payment Verification ====================

    /// <summary>
    /// Get payment summary for an event (organizer/admin only)
    /// </summary>
    [HttpGet("events/{eventId}/payment-summary")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<EventPaymentSummaryDto>>> GetEventPaymentSummary(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<EventPaymentSummaryDto> { Success = false, Message = "Unauthorized" });

        var evt = await _context.Events
            .Include(e => e.Divisions)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new ApiResponse<EventPaymentSummaryDto> { Success = false, Message = "Event not found" });

        // Check authorization
        if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
            return Forbid();

        // Get all units with members for this event
        var units = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
            .Where(u => u.EventId == eventId && u.Status != "Cancelled")
            .OrderBy(u => u.Division != null ? u.Division.Name : "")
            .ThenBy(u => u.Name)
            .ToListAsync();

        // Get all payments for this event
        var payments = await _context.UserPayments
            .Include(p => p.User)
            .Where(p => p.PaymentType == PaymentTypes.EventRegistration && p.RelatedObjectId == eventId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        // Build payment details per division
        var divisionPayments = new List<DivisionPaymentSummaryDto>();
        foreach (var division in evt.Divisions.OrderBy(d => d.Name))
        {
            var divUnits = units.Where(u => u.DivisionId == division.Id).ToList();
            var divPayments = new DivisionPaymentSummaryDto
            {
                DivisionId = division.Id,
                DivisionName = division.Name,
                ExpectedFeePerUnit = evt.RegistrationFee + (division.DivisionFee ?? 0m),
                TotalUnits = divUnits.Count,
                TotalExpected = divUnits.Count * (evt.RegistrationFee + (division.DivisionFee ?? 0m)),
                TotalPaid = divUnits.Sum(u => u.AmountPaid),
                Units = divUnits.Select(u => new UnitPaymentDto
                {
                    UnitId = u.Id,
                    UnitName = u.Name,
                    PaymentStatus = u.PaymentStatus ?? "Pending",
                    AmountPaid = u.AmountPaid,
                    AmountDue = evt.RegistrationFee + (division.DivisionFee ?? 0m),
                    PaymentProofUrl = u.PaymentProofUrl,
                    PaymentReference = u.PaymentReference,
                    ReferenceId = u.ReferenceId,
                    PaidAt = u.PaidAt,
                    Members = u.Members.Select(m => new UnitMemberPaymentDto
                    {
                        UserId = m.UserId,
                        UserName = $"{m.User?.FirstName} {m.User?.LastName}".Trim(),
                        UserEmail = m.User?.Email,
                        HasPaid = m.HasPaid,
                        AmountPaid = m.AmountPaid,
                        PaymentProofUrl = m.PaymentProofUrl,
                        PaymentReference = m.PaymentReference,
                        PaidAt = m.PaidAt
                    }).ToList()
                }).ToList()
            };

            divPayments.UnitsFullyPaid = divPayments.Units.Count(u => u.PaymentStatus == "Paid" || u.AmountPaid >= u.AmountDue);
            divPayments.UnitsPartiallyPaid = divPayments.Units.Count(u =>
                u.PaymentStatus != "Paid" && u.AmountPaid > 0 && u.AmountPaid < u.AmountDue);
            divPayments.UnitsUnpaid = divPayments.Units.Count(u => u.AmountPaid == 0);
            divPayments.IsBalanced = Math.Abs(divPayments.TotalPaid - divPayments.TotalExpected) < 0.01m;

            divisionPayments.Add(divPayments);
        }

        // Get all members that have payments applied (for building AppliedTo lists)
        var allMembersWithPayments = await _context.EventUnitMembers
            .Include(m => m.User)
            .Include(m => m.Unit)
            .Where(m => m.Unit!.EventId == eventId && m.PaymentId != null)
            .ToListAsync();

        // Build payment records with applied-to information
        var paymentRecords = new List<PaymentRecordDto>();
        foreach (var p in payments)
        {
            var appliedMembers = allMembersWithPayments
                .Where(m => m.PaymentId == p.Id)
                .Select(m => new PaymentApplicationDto
                {
                    UserId = m.UserId,
                    UserName = Utility.FormatName(m.User?.LastName, m.User?.FirstName) ?? "",
                    AmountApplied = m.AmountPaid
                })
                .ToList();

            var totalApplied = appliedMembers.Sum(a => a.AmountApplied);

            paymentRecords.Add(new PaymentRecordDto
            {
                Id = p.Id,
                UserId = p.UserId,
                UserName = Utility.FormatName(p.User?.LastName, p.User?.FirstName) ?? "",
                UserEmail = p.User?.Email,
                Amount = p.Amount,
                PaymentMethod = p.PaymentMethod,
                PaymentReference = p.PaymentReference,
                PaymentProofUrl = p.PaymentProofUrl,
                ReferenceId = p.ReferenceId,
                Status = p.Status,
                CreatedAt = p.CreatedAt,
                VerifiedAt = p.VerifiedAt,
                TotalApplied = totalApplied,
                IsFullyApplied = Math.Abs(totalApplied - p.Amount) < 0.01m,
                AppliedTo = appliedMembers
            });
        }

        // Build overall summary
        var summary = new EventPaymentSummaryDto
        {
            EventId = eventId,
            EventName = evt.Name,
            RegistrationFee = evt.RegistrationFee,
            TotalUnits = units.Count,
            TotalExpected = divisionPayments.Sum(d => d.TotalExpected),
            TotalPaid = divisionPayments.Sum(d => d.TotalPaid),
            TotalOutstanding = divisionPayments.Sum(d => d.TotalExpected) - divisionPayments.Sum(d => d.TotalPaid),
            UnitsFullyPaid = divisionPayments.Sum(d => d.UnitsFullyPaid),
            UnitsPartiallyPaid = divisionPayments.Sum(d => d.UnitsPartiallyPaid),
            UnitsUnpaid = divisionPayments.Sum(d => d.UnitsUnpaid),
            IsBalanced = Math.Abs(divisionPayments.Sum(d => d.TotalExpected) - divisionPayments.Sum(d => d.TotalPaid)) < 0.01m,
            DivisionPayments = divisionPayments,
            RecentPayments = paymentRecords
        };

        return Ok(new ApiResponse<EventPaymentSummaryDto> { Success = true, Data = summary });
    }

    /// <summary>
    /// Verify a payment (organizer/admin only)
    /// </summary>
    [HttpPost("payments/{paymentId}/verify")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> VerifyPayment(int paymentId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        var payment = await _context.UserPayments
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == paymentId);

        if (payment == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Payment not found" });

        // Check authorization - must be event organizer or admin
        if (payment.PaymentType == PaymentTypes.EventRegistration && payment.RelatedObjectId.HasValue)
        {
            var evt = await _context.Events.FindAsync(payment.RelatedObjectId.Value);
            if (evt == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

            if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
                return Forbid();
        }
        else if (!await IsAdminAsync())
        {
            return Forbid();
        }

        payment.Status = "Verified";
        payment.VerifiedByUserId = userId.Value;
        payment.VerifiedAt = DateTime.Now;
        payment.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Payment verified" });
    }

    /// <summary>
    /// Unverify a payment (organizer/admin only)
    /// </summary>
    [HttpPost("payments/{paymentId}/unverify")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> UnverifyPayment(int paymentId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        var payment = await _context.UserPayments
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == paymentId);

        if (payment == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Payment not found" });

        // Check authorization - must be event organizer or admin
        if (payment.PaymentType == PaymentTypes.EventRegistration && payment.RelatedObjectId.HasValue)
        {
            var evt = await _context.Events.FindAsync(payment.RelatedObjectId.Value);
            if (evt == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

            if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
                return Forbid();
        }
        else if (!await IsAdminAsync())
        {
            return Forbid();
        }

        payment.Status = "Pending";
        payment.VerifiedByUserId = null;
        payment.VerifiedAt = null;
        payment.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Payment verification removed" });
    }

    // ============================================
    // Tournament Reset (for Testing/Dry Run)
    // ============================================

    /// <summary>
    /// Reset all tournament data for an event (drawings, scores, court assignments) except schedule structure.
    /// This is useful for testing and dry runs.
    /// </summary>
    [Authorize]
    [HttpPost("reset-tournament/{eventId}")]
    public async Task<ActionResult<ApiResponse<object>>> ResetTournament(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        // Check if user is admin or event organizer
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Event not found" });

        if (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync())
            return Forbid();

        try
        {
            // Reset all units' drawing and stats data
            var units = await _context.EventUnits.Where(u => u.EventId == eventId).ToListAsync();
            foreach (var unit in units)
            {
                unit.UnitNumber = null;
                unit.PoolNumber = null;
                unit.PoolName = null;
                unit.Seed = null;
                unit.MatchesPlayed = 0;
                unit.MatchesWon = 0;
                unit.MatchesLost = 0;
                unit.GamesWon = 0;
                unit.GamesLost = 0;
                unit.PointsScored = 0;
                unit.PointsAgainst = 0;
                unit.PoolRank = null;
                unit.OverallRank = null;
                unit.AdvancedToPlayoff = false;
                unit.ManuallyAdvanced = false;
                unit.FinalPlacement = null;
                unit.UpdatedAt = DateTime.Now;
            }

            // Reset all encounters (keep structure, reset results and unit assignments for playoff rounds)
            var encounters = await _context.EventEncounters
                .Where(e => e.EventId == eventId)
                .ToListAsync();
            foreach (var encounter in encounters)
            {
                encounter.WinnerUnitId = null;
                encounter.UpdatedAt = DateTime.Now;

                // For playoff rounds (bracket), reset unit assignments since they depend on pool rankings
                if (encounter.RoundType != "Pool")
                {
                    // Keep Unit1Number and Unit2Number (bracket position), but reset actual unit IDs
                    encounter.Unit1Id = null;
                    encounter.Unit2Id = null;
                }
            }

            // Reset all encounter matches
            var encounterMatches = await _context.EncounterMatches
                .Where(m => m.Encounter!.EventId == eventId)
                .ToListAsync();
            foreach (var match in encounterMatches)
            {
                match.Unit1Score = 0;
                match.Unit2Score = 0;
                match.WinnerUnitId = null;
            }

            // Reset all games
            var games = await _context.EventGames
                .Where(g => g.EncounterMatch!.Encounter!.EventId == eventId)
                .ToListAsync();
            foreach (var game in games)
            {
                game.Unit1Score = 0;
                game.Unit2Score = 0;
                game.WinnerUnitId = null;
                game.Status = "Scheduled";
                game.TournamentCourtId = null;
                game.QueuedAt = null;
                game.StartedAt = null;
                game.FinishedAt = null;
                game.ScoreSubmittedByUnitId = null;
                game.ScoreSubmittedAt = null;
                game.ScoreConfirmedByUnitId = null;
                game.ScoreConfirmedAt = null;
                game.UpdatedAt = DateTime.Now;
            }

            // Reset all courts
            var courts = await _context.TournamentCourts.Where(c => c.EventId == eventId).ToListAsync();
            foreach (var court in courts)
            {
                court.CurrentGameId = null;
                court.Status = "Available";
            }

            // Delete all score history (wrapped in try-catch in case table doesn't exist)
            try
            {
                var scoreHistories = await _context.EventGameScoreHistories
                    .Where(h => h.Game!.EncounterMatch!.Encounter!.EventId == eventId)
                    .ToListAsync();
                if (scoreHistories.Any())
                {
                    _context.EventGameScoreHistories.RemoveRange(scoreHistories);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not delete score histories for event {EventId} - table may not exist", eventId);
            }

            // Delete game-related notifications for this event
            var gameIds = games.Select(g => g.Id).ToList();
            var notifications = await _context.Notifications
                .Where(n =>
                    (n.ReferenceType == "Event" && n.ReferenceId == eventId) ||
                    (n.ReferenceType == "Game" && n.ReferenceId.HasValue && gameIds.Contains(n.ReferenceId.Value)))
                .ToListAsync();
            _context.Notifications.RemoveRange(notifications);

            // Reset division drawing state
            var divisions = await _context.EventDivisions.Where(d => d.EventId == eventId).ToListAsync();
            foreach (var division in divisions)
            {
                division.DrawingInProgress = false;
                division.DrawingSequence = 0;
                division.DrawingStartedAt = null;
                division.DrawingByUserId = null;
                // Keep ScheduleStatus unchanged since we want to preserve the schedule structure
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Tournament {EventId} reset by user {UserId}", eventId, userId.Value);

            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Tournament data has been reset. Drawing results, game scores, and court assignments have been cleared. Schedule structure is preserved."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resetting tournament {EventId}", eventId);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Message = "Failed to reset tournament: " + ex.Message
            });
        }
    }

    // ============================================
    // Division Court Blocks (Court Pre-allocation)
    // ============================================

    /// <summary>
    /// Get court blocks for a division (pre-allocated courts with priority)
    /// </summary>
    [HttpGet("division/{divisionId}/court-blocks")]
    public async Task<ActionResult<ApiResponse<List<DivisionCourtBlockDto>>>> GetDivisionCourtBlocks(int divisionId)
    {
        var blocks = await _context.DivisionCourtBlocks
            .Include(b => b.TournamentCourt)
            .Include(b => b.Division)
            .Where(b => b.DivisionId == divisionId && b.IsActive)
            .OrderBy(b => b.Priority)
            .Select(b => new DivisionCourtBlockDto
            {
                Id = b.Id,
                DivisionId = b.DivisionId,
                DivisionName = b.Division != null ? b.Division.Name : null,
                TournamentCourtId = b.TournamentCourtId,
                CourtLabel = b.TournamentCourt != null ? b.TournamentCourt.CourtLabel : null,
                Priority = b.Priority,
                IntendedStartTime = b.IntendedStartTime,
                IntendedEndTime = b.IntendedEndTime,
                Notes = b.Notes,
                IsActive = b.IsActive,
                CreatedAt = b.CreatedAt
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<DivisionCourtBlockDto>> { Success = true, Data = blocks });
    }

    /// <summary>
    /// Add a court block to a division
    /// </summary>
    [Authorize]
    [HttpPost("division/{divisionId}/court-blocks")]
    public async Task<ActionResult<ApiResponse<DivisionCourtBlockDto>>> CreateDivisionCourtBlock(
        int divisionId,
        [FromBody] CreateDivisionCourtBlockDto dto)
    {
        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return NotFound(new ApiResponse<DivisionCourtBlockDto> { Success = false, Message = "Division not found" });

        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<DivisionCourtBlockDto> { Success = false, Message = "User not authenticated" });

        // Check permission
        var evt = await _context.Events.FindAsync(division.EventId);
        if (evt == null || (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync()))
            return Forbid();

        // Check if court exists and belongs to the same event
        var court = await _context.TournamentCourts.FindAsync(dto.TournamentCourtId);
        if (court == null || court.EventId != division.EventId)
            return BadRequest(new ApiResponse<DivisionCourtBlockDto> { Success = false, Message = "Invalid court" });

        // Check if already assigned
        var existing = await _context.DivisionCourtBlocks
            .FirstOrDefaultAsync(b => b.DivisionId == divisionId && b.TournamentCourtId == dto.TournamentCourtId);
        if (existing != null)
            return BadRequest(new ApiResponse<DivisionCourtBlockDto> { Success = false, Message = "Court is already assigned to this division" });

        var block = new DivisionCourtBlock
        {
            DivisionId = divisionId,
            TournamentCourtId = dto.TournamentCourtId,
            Priority = dto.Priority,
            IntendedStartTime = dto.IntendedStartTime,
            IntendedEndTime = dto.IntendedEndTime,
            Notes = dto.Notes
        };

        _context.DivisionCourtBlocks.Add(block);
        await _context.SaveChangesAsync();

        await _context.Entry(block).Reference(b => b.TournamentCourt).LoadAsync();
        await _context.Entry(block).Reference(b => b.Division).LoadAsync();

        var result = new DivisionCourtBlockDto
        {
            Id = block.Id,
            DivisionId = block.DivisionId,
            DivisionName = block.Division?.Name,
            TournamentCourtId = block.TournamentCourtId,
            CourtLabel = block.TournamentCourt?.CourtLabel,
            Priority = block.Priority,
            IntendedStartTime = block.IntendedStartTime,
            IntendedEndTime = block.IntendedEndTime,
            Notes = block.Notes,
            IsActive = block.IsActive,
            CreatedAt = block.CreatedAt
        };

        return Ok(new ApiResponse<DivisionCourtBlockDto> { Success = true, Data = result });
    }

    /// <summary>
    /// Update a court block
    /// </summary>
    [Authorize]
    [HttpPut("division/{divisionId}/court-blocks/{blockId}")]
    public async Task<ActionResult<ApiResponse<DivisionCourtBlockDto>>> UpdateDivisionCourtBlock(
        int divisionId,
        int blockId,
        [FromBody] UpdateDivisionCourtBlockDto dto)
    {
        var block = await _context.DivisionCourtBlocks
            .Include(b => b.Division)
            .Include(b => b.TournamentCourt)
            .FirstOrDefaultAsync(b => b.Id == blockId && b.DivisionId == divisionId);

        if (block == null)
            return NotFound(new ApiResponse<DivisionCourtBlockDto> { Success = false, Message = "Court block not found" });

        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<DivisionCourtBlockDto> { Success = false, Message = "User not authenticated" });

        // Check permission
        var evt = await _context.Events.FindAsync(block.Division!.EventId);
        if (evt == null || (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync()))
            return Forbid();

        // Update fields
        if (dto.Priority.HasValue)
            block.Priority = dto.Priority.Value;
        if (dto.IntendedStartTime.HasValue)
            block.IntendedStartTime = dto.IntendedStartTime;
        if (dto.IntendedEndTime.HasValue)
            block.IntendedEndTime = dto.IntendedEndTime;
        if (dto.Notes != null)
            block.Notes = dto.Notes;
        if (dto.IsActive.HasValue)
            block.IsActive = dto.IsActive.Value;

        block.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        var result = new DivisionCourtBlockDto
        {
            Id = block.Id,
            DivisionId = block.DivisionId,
            DivisionName = block.Division?.Name,
            TournamentCourtId = block.TournamentCourtId,
            CourtLabel = block.TournamentCourt?.CourtLabel,
            Priority = block.Priority,
            IntendedStartTime = block.IntendedStartTime,
            IntendedEndTime = block.IntendedEndTime,
            Notes = block.Notes,
            IsActive = block.IsActive,
            CreatedAt = block.CreatedAt
        };

        return Ok(new ApiResponse<DivisionCourtBlockDto> { Success = true, Data = result });
    }

    /// <summary>
    /// Delete a court block
    /// </summary>
    [Authorize]
    [HttpDelete("division/{divisionId}/court-blocks/{blockId}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteDivisionCourtBlock(int divisionId, int blockId)
    {
        var block = await _context.DivisionCourtBlocks
            .Include(b => b.Division)
            .FirstOrDefaultAsync(b => b.Id == blockId && b.DivisionId == divisionId);

        if (block == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Court block not found" });

        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

        // Check permission
        var evt = await _context.Events.FindAsync(block.Division!.EventId);
        if (evt == null || (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync()))
            return Forbid();

        _context.DivisionCourtBlocks.Remove(block);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true });
    }

    /// <summary>
    /// Bulk update court blocks for a division (replaces all blocks)
    /// </summary>
    [Authorize]
    [HttpPut("division/{divisionId}/court-blocks")]
    public async Task<ActionResult<ApiResponse<List<DivisionCourtBlockDto>>>> BulkUpdateDivisionCourtBlocks(
        int divisionId,
        [FromBody] BulkUpdateDivisionCourtBlocksDto dto)
    {
        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return NotFound(new ApiResponse<List<DivisionCourtBlockDto>> { Success = false, Message = "Division not found" });

        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<List<DivisionCourtBlockDto>> { Success = false, Message = "User not authenticated" });

        // Check permission
        var evt = await _context.Events.FindAsync(division.EventId);
        if (evt == null || (evt.OrganizedByUserId != userId.Value && !await IsAdminAsync()))
            return Forbid();

        // Validate all courts
        var courtIds = dto.CourtBlocks.Select(b => b.TournamentCourtId).ToList();
        var validCourts = await _context.TournamentCourts
            .Where(c => courtIds.Contains(c.Id) && c.EventId == division.EventId)
            .Select(c => c.Id)
            .ToListAsync();

        var invalidCourts = courtIds.Except(validCourts).ToList();
        if (invalidCourts.Any())
            return BadRequest(new ApiResponse<List<DivisionCourtBlockDto>> { Success = false, Message = $"Invalid court IDs: {string.Join(", ", invalidCourts)}" });

        // Remove existing blocks
        var existingBlocks = await _context.DivisionCourtBlocks
            .Where(b => b.DivisionId == divisionId)
            .ToListAsync();
        _context.DivisionCourtBlocks.RemoveRange(existingBlocks);

        // Add new blocks
        var newBlocks = dto.CourtBlocks.Select(b => new DivisionCourtBlock
        {
            DivisionId = divisionId,
            TournamentCourtId = b.TournamentCourtId,
            Priority = b.Priority,
            IntendedStartTime = b.IntendedStartTime,
            IntendedEndTime = b.IntendedEndTime,
            Notes = b.Notes
        }).ToList();

        _context.DivisionCourtBlocks.AddRange(newBlocks);
        await _context.SaveChangesAsync();

        // Load and return results
        var blocks = await _context.DivisionCourtBlocks
            .Include(b => b.TournamentCourt)
            .Include(b => b.Division)
            .Where(b => b.DivisionId == divisionId)
            .OrderBy(b => b.Priority)
            .Select(b => new DivisionCourtBlockDto
            {
                Id = b.Id,
                DivisionId = b.DivisionId,
                DivisionName = b.Division != null ? b.Division.Name : null,
                TournamentCourtId = b.TournamentCourtId,
                CourtLabel = b.TournamentCourt != null ? b.TournamentCourt.CourtLabel : null,
                Priority = b.Priority,
                IntendedStartTime = b.IntendedStartTime,
                IntendedEndTime = b.IntendedEndTime,
                Notes = b.Notes,
                IsActive = b.IsActive,
                CreatedAt = b.CreatedAt
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<DivisionCourtBlockDto>> { Success = true, Data = blocks });
    }

    #region Join Code Methods

    /// <summary>
    /// Generate a unique 6-character alphanumeric join code
    /// </summary>
    private string GenerateJoinCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars like 0/O, 1/I/L
        var random = new Random();
        var code = new char[6];
        for (int i = 0; i < 6; i++)
        {
            code[i] = chars[random.Next(chars.Length)];
        }
        return new string(code);
    }

    /// <summary>
    /// Join a unit using a join code (for code-based joining)
    /// </summary>
    [Authorize]
    [HttpPost("units/join-by-code")]
    public async Task<ActionResult<ApiResponse<EventUnitDto>>> JoinUnitByCode([FromBody] JoinByCodeRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<EventUnitDto> { Success = false, Message = "Unauthorized" });

        if (string.IsNullOrWhiteSpace(request.JoinCode))
            return BadRequest(new ApiResponse<EventUnitDto> { Success = false, Message = "Join code is required" });

        var code = request.JoinCode.ToUpper().Trim();

        // Find unit by code
        var unit = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Include(u => u.Division).ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Event)
            .Include(u => u.Captain)
            .FirstOrDefaultAsync(u => u.JoinCode == code && u.JoinMethod == "Code");

        if (unit == null)
            return NotFound(new ApiResponse<EventUnitDto> { Success = false, Message = "Invalid join code. Please check the code and try again." });

        // Check if unit is full
        var teamSize = unit.Division?.TeamUnit?.TotalPlayers ?? unit.Division?.TeamSize ?? 2;
        var acceptedCount = unit.Members.Count(m => m.InviteStatus == "Accepted");
        if (acceptedCount >= teamSize)
            return BadRequest(new ApiResponse<EventUnitDto> { Success = false, Message = "This team is already full" });

        // Check if user is already a member
        if (unit.Members.Any(m => m.UserId == userId.Value && m.InviteStatus == "Accepted"))
            return BadRequest(new ApiResponse<EventUnitDto> { Success = false, Message = "You are already a member of this team" });

        // Check if user is already registered in this division
        var alreadyInDivision = await _context.EventUnitMembers
            .Include(m => m.Unit)
            .AnyAsync(m => m.UserId == userId.Value &&
                m.Unit!.DivisionId == unit.DivisionId &&
                m.Unit.Status != "Cancelled" &&
                m.InviteStatus == "Accepted");

        if (alreadyInDivision)
            return BadRequest(new ApiResponse<EventUnitDto> { Success = false, Message = "You are already registered in this division" });

        // Add user as member (directly accepted for code-based join)
        var member = new EventUnitMember
        {
            UnitId = unit.Id,
            UserId = userId.Value,
            Role = "Player",
            InviteStatus = "Accepted",
            CreatedAt = DateTime.Now,
            ReferenceId = $"E{unit.EventId}-U{unit.Id}-P{userId.Value}",
            SelectedFeeId = request.SelectedFeeId
        };
        _context.EventUnitMembers.Add(member);

        // Clear the join code after use (one-time use)
        unit.JoinCode = null;
        unit.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        // Reload with all navigation properties
        unit = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Include(u => u.Division).ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Event)
            .Include(u => u.Captain)
            .Include(u => u.JoinRequests)
            .FirstOrDefaultAsync(u => u.Id == unit.Id);

        return Ok(new ApiResponse<EventUnitDto>
        {
            Success = true,
            Message = $"Successfully joined {unit!.Name}!",
            Data = MapToUnitDto(unit)
        });
    }

    /// <summary>
    /// Regenerate a join code for a unit (captain only)
    /// </summary>
    [Authorize]
    [HttpPost("units/{unitId}/regenerate-code")]
    public async Task<ActionResult<ApiResponse<string>>> RegenerateJoinCode(int unitId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<string> { Success = false, Message = "Unauthorized" });

        var unit = await _context.EventUnits
            .Include(u => u.Division).ThenInclude(d => d!.TeamUnit)
            .FirstOrDefaultAsync(u => u.Id == unitId);

        if (unit == null)
            return NotFound(new ApiResponse<string> { Success = false, Message = "Unit not found" });

        // Only captain can regenerate code
        if (unit.CaptainUserId != userId.Value)
            return Forbid();

        // Check if unit is full (no need to regenerate)
        var teamSize = unit.Division?.TeamUnit?.TotalPlayers ?? unit.Division?.TeamSize ?? 2;
        var acceptedCount = await _context.EventUnitMembers
            .CountAsync(m => m.UnitId == unitId && m.InviteStatus == "Accepted");
        if (acceptedCount >= teamSize)
            return BadRequest(new ApiResponse<string> { Success = false, Message = "Team is already full" });

        // Generate new code
        unit.JoinCode = GenerateJoinCode();
        unit.JoinMethod = "Code"; // Ensure method is set
        unit.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<string>
        {
            Success = true,
            Message = "New join code generated",
            Data = unit.JoinCode
        });
    }

    /// <summary>
    /// Get joinable units in a division (for "Join Existing Team" list)
    /// Now includes JoinMethod indicator
    /// </summary>
    [Authorize]
    [HttpGet("events/{eventId}/divisions/{divisionId}/joinable-units-v2")]
    public async Task<ActionResult<ApiResponse<List<JoinableUnitDto>>>> GetJoinableUnitsV2(int eventId, int divisionId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<List<JoinableUnitDto>> { Success = false, Message = "Unauthorized" });

        var division = await _context.EventDivisions
            .Include(d => d.TeamUnit)
            .FirstOrDefaultAsync(d => d.Id == divisionId && d.EventId == eventId && d.IsActive);

        if (division == null)
            return NotFound(new ApiResponse<List<JoinableUnitDto>> { Success = false, Message = "Division not found" });

        var teamSize = division.TeamUnit?.TotalPlayers ?? 2;

        // Find units that are incomplete (fewer accepted members than team size)
        var units = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Include(u => u.Division).ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Captain)
            .Where(u => u.DivisionId == divisionId &&
                u.EventId == eventId &&
                u.Status != "Cancelled" &&
                u.Members.Count(m => m.InviteStatus == "Accepted") < teamSize)
            .OrderBy(u => u.CreatedAt)
            .ToListAsync();

        var result = units.Select(u => new JoinableUnitDto
        {
            Id = u.Id,
            Name = u.Name,
            CaptainUserId = u.CaptainUserId,
            CaptainName = u.Captain != null ? FormatName(u.Captain.LastName, u.Captain.FirstName) : null,
            CaptainProfileImageUrl = u.Captain?.ProfileImageUrl,
            JoinMethod = u.JoinMethod ?? "Approval",
            MemberCount = u.Members.Count(m => m.InviteStatus == "Accepted"),
            RequiredPlayers = teamSize,
            Members = u.Members.Where(m => m.InviteStatus == "Accepted").Select(m => new JoinableUnitMemberDto
            {
                UserId = m.UserId,
                Name = m.User != null ? FormatName(m.User.LastName, m.User.FirstName) : null,
                ProfileImageUrl = m.User?.ProfileImageUrl
            }).ToList()
        }).ToList();

        return Ok(new ApiResponse<List<JoinableUnitDto>> { Success = true, Data = result });
    }

    #endregion

    // ============================================
    // Division Fee Management
    // ============================================
    #region Division Fees

    /// <summary>
    /// Get all fees for a division
    /// </summary>
    [HttpGet("divisions/{divisionId}/fees")]
    public async Task<ActionResult<ApiResponse<List<DivisionFeeDto>>>> GetDivisionFees(int divisionId)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Fees)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<List<DivisionFeeDto>> { Success = false, Message = "Division not found" });

        var fees = division.Fees.OrderBy(f => f.SortOrder).Select(f => new DivisionFeeDto
        {
            Id = f.Id,
            DivisionId = f.DivisionId,
            Name = f.Name,
            Description = f.Description,
            Amount = f.Amount,
            IsDefault = f.IsDefault,
            AvailableFrom = f.AvailableFrom,
            AvailableUntil = f.AvailableUntil,
            IsActive = f.IsActive,
            SortOrder = f.SortOrder,
            IsCurrentlyAvailable = (!f.AvailableFrom.HasValue || f.AvailableFrom <= DateTime.UtcNow) &&
                                   (!f.AvailableUntil.HasValue || f.AvailableUntil > DateTime.UtcNow)
        }).ToList();

        return Ok(new ApiResponse<List<DivisionFeeDto>> { Success = true, Data = fees });
    }

    /// <summary>
    /// Create a new fee for a division
    /// </summary>
    [HttpPost("divisions/{divisionId}/fees")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<DivisionFeeDto>>> CreateDivisionFee(int divisionId, [FromBody] DivisionFeeRequest request)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<DivisionFeeDto> { Success = false, Message = "Division not found" });

        // Check authorization
        if (!await CanManageEventAsync(division.EventId))
            return Forbid();

        // If this is set as default, clear other defaults
        if (request.IsDefault)
        {
            var existingFees = await _context.DivisionFees.Where(f => f.DivisionId == divisionId && f.IsDefault).ToListAsync();
            foreach (var existingFee in existingFees)
            {
                existingFee.IsDefault = false;
            }
        }

        var fee = new DivisionFee
        {
            DivisionId = divisionId,
            Name = request.Name,
            Description = request.Description,
            Amount = request.Amount,
            IsDefault = request.IsDefault,
            AvailableFrom = request.AvailableFrom,
            AvailableUntil = request.AvailableUntil,
            IsActive = request.IsActive,
            SortOrder = request.SortOrder,
            CreatedAt = DateTime.UtcNow
        };

        _context.DivisionFees.Add(fee);
        await _context.SaveChangesAsync();

        var dto = new DivisionFeeDto
        {
            Id = fee.Id,
            DivisionId = fee.DivisionId,
            Name = fee.Name,
            Description = fee.Description,
            Amount = fee.Amount,
            IsDefault = fee.IsDefault,
            AvailableFrom = fee.AvailableFrom,
            AvailableUntil = fee.AvailableUntil,
            IsActive = fee.IsActive,
            SortOrder = fee.SortOrder,
            IsCurrentlyAvailable = (!fee.AvailableFrom.HasValue || fee.AvailableFrom <= DateTime.UtcNow) &&
                                   (!fee.AvailableUntil.HasValue || fee.AvailableUntil > DateTime.UtcNow)
        };

        return Ok(new ApiResponse<DivisionFeeDto> { Success = true, Data = dto });
    }

    /// <summary>
    /// Update a division fee
    /// </summary>
    [HttpPut("divisions/{divisionId}/fees/{feeId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<DivisionFeeDto>>> UpdateDivisionFee(int divisionId, int feeId, [FromBody] DivisionFeeRequest request)
    {
        var fee = await _context.DivisionFees
            .Include(f => f.Division)
            .FirstOrDefaultAsync(f => f.Id == feeId && f.DivisionId == divisionId);

        if (fee == null)
            return NotFound(new ApiResponse<DivisionFeeDto> { Success = false, Message = "Fee not found" });

        // Check authorization
        if (!await CanManageEventAsync(fee.Division!.EventId))
            return Forbid();

        // If this is set as default, clear other defaults
        if (request.IsDefault && !fee.IsDefault)
        {
            var existingFees = await _context.DivisionFees.Where(f => f.DivisionId == divisionId && f.IsDefault && f.Id != feeId).ToListAsync();
            foreach (var existingFee in existingFees)
            {
                existingFee.IsDefault = false;
            }
        }

        fee.Name = request.Name;
        fee.Description = request.Description;
        fee.Amount = request.Amount;
        fee.IsDefault = request.IsDefault;
        fee.AvailableFrom = request.AvailableFrom;
        fee.AvailableUntil = request.AvailableUntil;
        fee.IsActive = request.IsActive;
        fee.SortOrder = request.SortOrder;
        fee.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var dto = new DivisionFeeDto
        {
            Id = fee.Id,
            DivisionId = fee.DivisionId,
            Name = fee.Name,
            Description = fee.Description,
            Amount = fee.Amount,
            IsDefault = fee.IsDefault,
            AvailableFrom = fee.AvailableFrom,
            AvailableUntil = fee.AvailableUntil,
            IsActive = fee.IsActive,
            SortOrder = fee.SortOrder,
            IsCurrentlyAvailable = (!fee.AvailableFrom.HasValue || fee.AvailableFrom <= DateTime.UtcNow) &&
                                   (!fee.AvailableUntil.HasValue || fee.AvailableUntil > DateTime.UtcNow)
        };

        return Ok(new ApiResponse<DivisionFeeDto> { Success = true, Data = dto });
    }

    /// <summary>
    /// Delete a division fee
    /// </summary>
    [HttpDelete("divisions/{divisionId}/fees/{feeId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteDivisionFee(int divisionId, int feeId)
    {
        var fee = await _context.DivisionFees
            .Include(f => f.Division)
            .FirstOrDefaultAsync(f => f.Id == feeId && f.DivisionId == divisionId);

        if (fee == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Fee not found" });

        // Check authorization
        if (!await CanManageEventAsync(fee.Division!.EventId))
            return Forbid();

        // Check if any registrations are using this fee
        var usedByMembers = await _context.EventUnitMembers.AnyAsync(m => m.SelectedFeeId == feeId);

        if (usedByMembers)
            return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot delete fee that is in use by existing registrations" });

        _context.DivisionFees.Remove(fee);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true });
    }

    /// <summary>
    /// Bulk update division fees (replaces all fees for a division)
    /// </summary>
    [HttpPut("divisions/{divisionId}/fees")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<DivisionFeeDto>>>> BulkUpdateDivisionFees(int divisionId, [FromBody] List<DivisionFeeRequest> fees)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Fees)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound(new ApiResponse<List<DivisionFeeDto>> { Success = false, Message = "Division not found" });

        // Check authorization
        if (!await CanManageEventAsync(division.EventId))
            return Forbid();

        // Check if any existing fees are in use
        var existingFeeIds = division.Fees.Select(f => f.Id).ToList();
        var usedByMembers = await _context.EventUnitMembers.AnyAsync(m => m.SelectedFeeId != null && existingFeeIds.Contains(m.SelectedFeeId.Value));

        if (usedByMembers)
            return BadRequest(new ApiResponse<List<DivisionFeeDto>> { Success = false, Message = "Cannot replace fees that are in use by existing registrations. Please update individual fees instead." });

        // Remove existing fees
        _context.DivisionFees.RemoveRange(division.Fees);

        // Ensure only one default
        var hasDefault = false;
        var newFees = fees.Select((f, index) => {
            var isDefault = f.IsDefault && !hasDefault;
            if (isDefault) hasDefault = true;
            return new DivisionFee
            {
                DivisionId = divisionId,
                Name = f.Name,
                Description = f.Description,
                Amount = f.Amount,
                IsDefault = isDefault,
                AvailableFrom = f.AvailableFrom,
                AvailableUntil = f.AvailableUntil,
                IsActive = f.IsActive,
                SortOrder = f.SortOrder > 0 ? f.SortOrder : index,
                CreatedAt = DateTime.UtcNow
            };
        }).ToList();

        _context.DivisionFees.AddRange(newFees);
        await _context.SaveChangesAsync();

        var result = newFees.OrderBy(f => f.SortOrder).Select(f => new DivisionFeeDto
        {
            Id = f.Id,
            DivisionId = f.DivisionId,
            Name = f.Name,
            Description = f.Description,
            Amount = f.Amount,
            IsDefault = f.IsDefault,
            AvailableFrom = f.AvailableFrom,
            AvailableUntil = f.AvailableUntil,
            IsActive = f.IsActive,
            SortOrder = f.SortOrder,
            IsCurrentlyAvailable = (!f.AvailableFrom.HasValue || f.AvailableFrom <= DateTime.UtcNow) &&
                                   (!f.AvailableUntil.HasValue || f.AvailableUntil > DateTime.UtcNow)
        }).ToList();

        return Ok(new ApiResponse<List<DivisionFeeDto>> { Success = true, Data = result });
    }

    #endregion
}

// DTOs for join code feature
public class JoinByCodeRequest
{
    public string JoinCode { get; set; } = string.Empty;
    public int? SelectedFeeId { get; set; }
}

public class JoinableUnitDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int CaptainUserId { get; set; }
    public string? CaptainName { get; set; }
    public string? CaptainProfileImageUrl { get; set; }
    public string JoinMethod { get; set; } = "Approval";
    public int MemberCount { get; set; }
    public int RequiredPlayers { get; set; }
    public List<JoinableUnitMemberDto> Members { get; set; } = new();
}

public class JoinableUnitMemberDto
{
    public int UserId { get; set; }
    public string? Name { get; set; }
    public string? ProfileImageUrl { get; set; }
}
