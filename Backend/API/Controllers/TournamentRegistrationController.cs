using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Constants;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Hubs;
using Pickleball.Community.Services;
using Pickleball.Community.Controllers.Base;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("tournament")]
public class TournamentRegistrationController : EventControllerBase
{
    private readonly ILogger<TournamentRegistrationController> _logger;
    private readonly INotificationService _notificationService;
    private readonly IEmailNotificationService _emailService;
    private readonly ITournamentRegistrationService _registrationService;
    private readonly ITournamentPaymentService _paymentService;

    public TournamentRegistrationController(
        ApplicationDbContext context,
        ILogger<TournamentRegistrationController> logger,
        INotificationService notificationService,
        IEmailNotificationService emailService,
        ITournamentRegistrationService registrationService,
        ITournamentPaymentService paymentService)
        : base(context)
    {
        _logger = logger;
        _notificationService = notificationService;
        _emailService = emailService;
        _registrationService = registrationService;
        _paymentService = paymentService;
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

        // Load division fees separately (DivisionId > 0 means division-specific fees)
        var divisionIds = evt.Divisions.Select(d => d.Id).ToList();
        var divisionFees = await _context.DivisionFees
            .Include(f => f.FeeType)
            .Where(f => divisionIds.Contains(f.DivisionId))
            .ToListAsync();
        var feesByDivision = divisionFees.GroupBy(f => f.DivisionId).ToDictionary(g => g.Key, g => g.ToList());

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
                    Fees = feesByDivision.GetValueOrDefault(d.Id, new List<DivisionFee>())
                        .Where(f => f.IsActive).OrderBy(f => f.SortOrder).Select(f => new DivisionFeeDto
                    {
                        Id = f.Id,
                        DivisionId = f.DivisionId,
                        Name = f.FeeType?.Name ?? f.Name,
                        Description = f.FeeType?.Description ?? f.Description,
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
            var joinMethod = isSingles ? "Approval" : (request.JoinMethod ?? "Open");
            string? joinCode = null;
            if (joinMethod == "Code" && !isSingles)
            {
                joinCode = GenerateJoinCode();
            }
            // "Open" join method means anyone can join instantly (auto-accept)
            var autoAccept = !isSingles && (joinMethod == "Open" || request.AutoAcceptMembers);

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
                AutoAcceptMembers = autoAccept,
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

        // Send registration confirmation email immediately
        // Email will include status of waiver and payment (pending if not yet completed)
        try
        {
            foreach (var unit in units)
            {
                var division = evt.Divisions.FirstOrDefault(d => d.Id == unit.DivisionId);
                var feeAmount = division?.DivisionFee ?? 0;

                // Check if there are waivers for this event
                var waiverCount = await _context.ObjectAssets
                    .Include(a => a.AssetType)
                    .CountAsync(a => a.ObjectId == eventId
                        && a.AssetType != null
                        && a.AssetType.TypeName.ToLower() == "waiver");

                // Get the member ID for the badge URL
                var member = unit.Members.FirstOrDefault(m => m.UserId == userId.Value);
                var badgeUrl = member != null
                    ? $"https://pickleball.community/badge/{member.Id}"
                    : null;

                var emailBody = EmailTemplates.EventRegistrationConfirmation(
                    $"{user.FirstName} {user.LastName}".Trim(),
                    evt.Name ?? "Event",
                    division?.Name ?? "Division",
                    evt.StartDate,
                    evt.VenueName,
                    unit.Name,
                    feeAmount,
                    waiverSigned: waiverCount == 0, // No waivers = considered signed
                    paymentComplete: feeAmount == 0, // No fee = considered paid
                    badgeUrl: badgeUrl
                );

                var subject = feeAmount == 0 && waiverCount == 0
                    ? $"Registration Complete: {evt.Name}"
                    : $"Registration Received: {evt.Name}";

                await _emailService.SendSimpleAsync(
                    userId.Value,
                    user.Email!,
                    subject,
                    emailBody
                );
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send registration email for user {UserId}", userId);
            // Don't fail registration if email fails
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

        // Update unit display name based on members
        await UpdateUnitDisplayNameAsync(unit.Id);
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

                // Update unit display name after merge
                await UpdateUnitDisplayNameAsync(requesterUnit.Id);
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

        // Check if this is a FriendsOnly unit and user is a friend - auto-accept
        var isFriendsOnlyUnit = (unit.JoinMethod ?? "Approval") == "FriendsOnly";
        bool isFriend = false;
        if (isFriendsOnlyUnit)
        {
            isFriend = await _context.Friendships.AnyAsync(f =>
                (f.UserId1 == userId.Value && f.UserId2 == unit.CaptainUserId) ||
                (f.UserId1 == unit.CaptainUserId && f.UserId2 == userId.Value));
        }

        if (isFriendsOnlyUnit && isFriend)
        {
            // Auto-accept: Add user directly as accepted member
            if (string.IsNullOrEmpty(unit.ReferenceId))
            {
                unit.ReferenceId = $"E{unit.EventId}-U{unitId}";
            }

            var acceptedMember = new EventUnitMember
            {
                UnitId = unitId,
                UserId = userId.Value,
                Role = "Player",
                InviteStatus = "Accepted",
                CreatedAt = DateTime.Now,
                ReferenceId = $"E{unit.EventId}-U{unitId}-P{userId.Value}",
                SelectedFeeId = request.SelectedFeeId
            };
            _context.EventUnitMembers.Add(acceptedMember);

            await _context.SaveChangesAsync();

            // Update unit display name after member added
            await UpdateUnitDisplayNameAsync(unit.Id);
            await _context.SaveChangesAsync();

            var acceptedUser = await _context.Users.FindAsync(userId.Value);
            var captain = await _context.Users.FindAsync(unit.CaptainUserId);

            return Ok(new ApiResponse<UnitJoinRequestDto>
            {
                Success = true,
                Message = $"You have joined {Utility.FormatName(captain?.LastName, captain?.FirstName)}'s team! (Friend auto-accept)",
                Data = new UnitJoinRequestDto
                {
                    Id = 0, // No join request created - auto-accepted
                    UnitId = unitId,
                    UnitName = unit.Name,
                    UserId = userId.Value,
                    UserName = Utility.FormatName(acceptedUser?.LastName, acceptedUser?.FirstName),
                    ProfileImageUrl = acceptedUser?.ProfileImageUrl,
                    Message = "Auto-accepted (friends)",
                    Status = "Accepted",
                    CreatedAt = DateTime.Now
                },
                Warnings = waitlistWarning != null ? new List<string> { waitlistWarning } : null
            });
        }

        // Check if unit has AutoAcceptMembers enabled - auto-accept without captain approval
        if (unit.AutoAcceptMembers)
        {
            // Auto-accept: Add user directly as accepted member
            if (string.IsNullOrEmpty(unit.ReferenceId))
            {
                unit.ReferenceId = $"E{unit.EventId}-U{unitId}";
            }

            var autoAcceptedMember = new EventUnitMember
            {
                UnitId = unitId,
                UserId = userId.Value,
                Role = "Player",
                InviteStatus = "Accepted",
                CreatedAt = DateTime.Now,
                ReferenceId = $"E{unit.EventId}-U{unitId}-P{userId.Value}",
                SelectedFeeId = request.SelectedFeeId
            };
            _context.EventUnitMembers.Add(autoAcceptedMember);

            await _context.SaveChangesAsync();

            // Update unit display name after member added
            await UpdateUnitDisplayNameAsync(unit.Id);
            await _context.SaveChangesAsync();

            var autoAcceptedUser = await _context.Users.FindAsync(userId.Value);
            var unitCaptain = await _context.Users.FindAsync(unit.CaptainUserId);

            return Ok(new ApiResponse<UnitJoinRequestDto>
            {
                Success = true,
                Message = $"You have joined {Utility.FormatName(unitCaptain?.LastName, unitCaptain?.FirstName)}'s team!",
                Data = new UnitJoinRequestDto
                {
                    Id = 0, // No join request created - auto-accepted
                    UnitId = unitId,
                    UnitName = unit.Name,
                    UserId = userId.Value,
                    UserName = Utility.FormatName(autoAcceptedUser?.LastName, autoAcceptedUser?.FirstName),
                    ProfileImageUrl = autoAcceptedUser?.ProfileImageUrl,
                    Message = "Auto-accepted",
                    Status = "Accepted",
                    CreatedAt = DateTime.Now
                },
                Warnings = waitlistWarning != null ? new List<string> { waitlistWarning } : null
            });
        }

        // Standard flow: Create pending join request
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

        // Update unit display name after membership change
        if (request.Accept)
        {
            await UpdateUnitDisplayNameAsync(joinRequest.UnitId);
            await _context.SaveChangesAsync();
        }

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

        // Update unit display name after membership change
        if (request.Accept)
        {
            await UpdateUnitDisplayNameAsync(request.UnitId);
            await _context.SaveChangesAsync();
        }

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

        var memberUnitId = membership.UnitId;
        _context.EventUnitMembers.Remove(membership);
        await _context.SaveChangesAsync();

        // Update unit display name after member leaves
        await UpdateUnitDisplayNameAsync(memberUnitId);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true });
    }

    /// <summary>
    /// Unregister from a division - allows player to withdraw their registration
    /// Uses stored procedure to handle complex cleanup logic:
    /// - Removes join requests
    /// - Removes unit members
    /// - Removes unit if user was alone or captain
    /// - Cleans up waiver records
    /// </summary>
    [Authorize]
    [HttpDelete("events/{eventId}/divisions/{divisionId}/unregister")]
    public async Task<ActionResult<ApiResponse<bool>>> UnregisterFromDivision(int eventId, int divisionId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        try
        {
            // Use stored procedure for complex unregister logic
            var successParam = new Microsoft.Data.SqlClient.SqlParameter("@Success", System.Data.SqlDbType.Bit) { Direction = System.Data.ParameterDirection.Output };
            var messageParam = new Microsoft.Data.SqlClient.SqlParameter("@Message", System.Data.SqlDbType.NVarChar, 500) { Direction = System.Data.ParameterDirection.Output };

            await _context.Database.ExecuteSqlRawAsync(
                "EXEC sp_UnregisterFromDivision @EventId, @DivisionId, @UserId, @Success OUTPUT, @Message OUTPUT",
                new Microsoft.Data.SqlClient.SqlParameter("@EventId", eventId),
                new Microsoft.Data.SqlClient.SqlParameter("@DivisionId", divisionId),
                new Microsoft.Data.SqlClient.SqlParameter("@UserId", userId.Value),
                successParam,
                messageParam
            );

            var success = (bool)successParam.Value;
            var message = (string)messageParam.Value;

            if (success)
            {
                return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = message });
            }
            else
            {
                // Determine appropriate status code based on message
                if (message.Contains("not registered"))
                    return NotFound(new ApiResponse<bool> { Success = false, Message = message });
                else if (message.Contains("Cannot unregister"))
                    return BadRequest(new ApiResponse<bool> { Success = false, Message = message });
                else
                    return BadRequest(new ApiResponse<bool> { Success = false, Message = message });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unregistering user {UserId} from division {DivisionId} in event {EventId}", userId, divisionId, eventId);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred while unregistering" });
        }
    }

    /// <summary>
    /// Set a custom team name (captain only for teams, not allowed for pairs/singles)
    /// For pairs (size=2), names are auto-computed from member first names
    /// </summary>
    [Authorize]
    [HttpPut("units/{unitId}/name")]
    public async Task<ActionResult<ApiResponse<EventUnitDto>>> SetUnitName(int unitId, [FromBody] SetUnitNameRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<EventUnitDto> { Success = false, Message = "Unauthorized" });

        var unit = await _context.EventUnits
            .Include(u => u.Members.Where(m => m.InviteStatus == "Accepted"))
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Captain)
            .FirstOrDefaultAsync(u => u.Id == unitId);

        if (unit == null)
            return NotFound(new ApiResponse<EventUnitDto> { Success = false, Message = "Unit not found" });

        // Only captain can change unit name
        if (unit.CaptainUserId != userId.Value)
        {
            var isAdmin = await IsAdminAsync();
            var isOrganizer = await IsEventOrganizerAsync(unit.EventId, userId.Value);
            if (!isAdmin && !isOrganizer)
                return Forbid();
        }

        var teamSize = unit.Division?.TeamUnit?.TotalPlayers ?? 1;

        // For teams (size > 2): allow custom names
        if (teamSize > 2)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                // Reset to default
                unit.HasCustomName = false;
                var captain = unit.Members.FirstOrDefault(m => m.Role == "Captain")?.User ?? unit.Captain;
                unit.Name = captain != null ? $"{captain.FirstName}'s team" : "Team";
            }
            else
            {
                unit.Name = request.Name.Trim();
                unit.HasCustomName = true;
            }
        }
        // For pairs (size = 2): normally auto-computed, but allow custom if explicitly requested
        else if (teamSize == 2)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                // Reset to auto-computed name
                unit.HasCustomName = false;
                await UpdateUnitDisplayNameAsync(unitId);
            }
            else
            {
                unit.Name = request.Name.Trim();
                unit.HasCustomName = true;
            }
        }
        else
        {
            // Singles: use player's name, no custom names
            return BadRequest(new ApiResponse<EventUnitDto>
            {
                Success = false,
                Message = "Cannot set custom name for singles registration"
            });
        }

        unit.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        // Reload with all data
        var loadedUnit = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Captain)
            .FirstOrDefaultAsync(u => u.Id == unitId);

        return Ok(new ApiResponse<EventUnitDto>
        {
            Success = true,
            Data = MapToUnitDto(loadedUnit!),
            Message = unit.HasCustomName ? "Custom team name set" : "Team name reset to default"
        });
    }

    /// <summary>
    /// Update the join method for a unit (captain only)
    /// Allows changing between "Approval" (open to anyone) and "FriendsOnly" (friends auto-accept)
    /// </summary>
    [Authorize]
    [HttpPut("units/{unitId}/join-method")]
    public async Task<ActionResult<ApiResponse<EventUnitDto>>> UpdateUnitJoinMethod(int unitId, [FromBody] UpdateJoinMethodRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<EventUnitDto> { Success = false, Message = "Unauthorized" });

        var unit = await _context.EventUnits
            .Include(u => u.Members.Where(m => m.InviteStatus == "Accepted"))
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Captain)
            .FirstOrDefaultAsync(u => u.Id == unitId);

        if (unit == null)
            return NotFound(new ApiResponse<EventUnitDto> { Success = false, Message = "Unit not found" });

        // Only captain can change join method
        if (unit.CaptainUserId != userId.Value)
        {
            var isAdmin = await IsAdminAsync();
            var isOrganizer = await IsEventOrganizerAsync(unit.EventId, userId.Value);
            if (!isAdmin && !isOrganizer)
                return Forbid();
        }

        var teamSize = unit.Division?.TeamUnit?.TotalPlayers ?? 1;

        // Only applicable for team registrations (size > 1)
        if (teamSize <= 1)
        {
            return BadRequest(new ApiResponse<EventUnitDto>
            {
                Success = false,
                Message = "Join method is not applicable for singles registration"
            });
        }

        // Validate join method value
        var validMethods = new[] { "Open", "Approval", "FriendsOnly" };
        if (!validMethods.Contains(request.JoinMethod))
        {
            return BadRequest(new ApiResponse<EventUnitDto>
            {
                Success = false,
                Message = "Invalid join method. Must be 'Open', 'Approval', or 'FriendsOnly'"
            });
        }

        unit.JoinMethod = request.JoinMethod;
        // "Open" means anyone can join instantly (auto-accept enabled)
        unit.AutoAcceptMembers = request.JoinMethod == "Open";
        unit.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        // Reload with all data
        var loadedUnit = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Captain)
            .FirstOrDefaultAsync(u => u.Id == unitId);

        var methodDescription = request.JoinMethod == "Open" ? "Anyone can join" : request.JoinMethod == "FriendsOnly" ? "Friends only" : "Approval required";
        return Ok(new ApiResponse<EventUnitDto>
        {
            Success = true,
            Data = MapToUnitDto(loadedUnit!),
            Message = $"Join method updated to: {methodDescription}"
        });
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
    // Registration Removal
    // ============================================

    [HttpDelete("events/{eventId}/registrations/{unitId}/members/{userId}")]
    public async Task<ActionResult<ApiResponse<bool>>> RemoveRegistration(int eventId, int unitId, int userId, [FromQuery] bool force = false)
    {
        var currentUserId = GetUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        var evt = await _context.Events.FirstOrDefaultAsync(e => e.Id == eventId && e.IsActive);
        if (evt == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

        var unit = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Unit not found" });

        var member = unit.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Member not found in unit" });

        // Authorization: organizer, admin, or captain of the unit (but captain can't remove themselves)
        var isAdmin = await IsAdminAsync();
        var isOrganizer = evt.OrganizedByUserId == currentUserId.Value;
        var isCaptain = unit.CaptainUserId == currentUserId.Value;
        
        if (!isOrganizer && !isAdmin && !isCaptain)
            return Forbid();
        
        // Captain cannot remove themselves - they should use "Cancel registration" instead
        if (isCaptain && !isOrganizer && !isAdmin && userId == currentUserId.Value)
            return BadRequest(new ApiResponse<bool> { Success = false, Message = "Use 'Cancel registration' to leave your own team" });

        var acceptedMembers = unit.Members.Where(m => m.InviteStatus == "Accepted").ToList();
        var isOnlyMember = acceptedMembers.Count <= 1;
        var memberHasPayment = member.HasPaid || member.AmountPaid > 0 || !string.IsNullOrEmpty(member.PaymentProofUrl);

        if (isOnlyMember)
        {
            // Only member in the unit - check if we can delete the unit
            if (memberHasPayment && !force)
            {
                // Return 200 OK with Success=false so frontend can show confirmation dialog
                return Ok(new ApiResponse<bool>
                {
                    Success = false,
                    Message = "This player has payment records. Are you sure you want to remove them? This will delete their payment history.",
                    Data = false
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

            // Update unit display names after membership change
            await UpdateUnitDisplayNameAsync(unit.Id);
            await UpdateUnitDisplayNameAsync(newUnit.Id);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = $"{memberName} now has their own registration" });
        }
    }

    /// <summary>
    /// Move a registration to a different division (organizer only)
    /// Handles fee adjustment by finding matching fee types in the new division
    /// </summary>
    [Authorize]

    [HttpPost("events/{eventId}/registrations/{unitId}/move")]
    public async Task<ActionResult<ApiResponse<object>>> MoveRegistration(int eventId, int unitId, [FromBody] MoveRegistrationRequest request)
    {
        var currentUserId = GetUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        // Check if user is organizer or site admin
        var evt = await _context.Events.FirstOrDefaultAsync(e => e.Id == eventId && e.IsActive);
        if (evt == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Event not found" });

        var isAdmin = await IsAdminAsync();
        if (evt.OrganizedByUserId != currentUserId.Value && !isAdmin)
            return Forbid();

        var unit = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.SelectedFee)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);
        if (unit == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Unit not found" });

        var oldDivisionId = unit.DivisionId;

        // Verify target division exists and belongs to this event
        var targetDivision = await _context.EventDivisions
            .FirstOrDefaultAsync(d => d.Id == request.NewDivisionId && d.EventId == eventId && d.IsActive);
        if (targetDivision == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Target division not found" });

        // Get fees for the new division (division-specific first, then event-level fallback)
        var newDivisionFees = await _context.DivisionFees
            .Include(f => f.FeeType)
            .Where(f => f.EventId == eventId && (f.DivisionId == request.NewDivisionId || f.DivisionId == 0) && f.IsActive)
            .ToListAsync();

        // Prioritize division-specific fees over event-level fees
        var newFeesByType = newDivisionFees
            .GroupBy(f => f.FeeTypeId)
            .ToDictionary(
                g => g.Key,
                g => g.FirstOrDefault(f => f.DivisionId == request.NewDivisionId) ?? g.First()
            );

        // Track fee changes for response
        var feeChanges = new List<object>();

        // Update each member's SelectedFeeId to point to matching fee in new division
        foreach (var member in unit.Members.Where(m => m.SelectedFeeId.HasValue && m.SelectedFee != null))
        {
            var oldFeeTypeId = member.SelectedFee!.FeeTypeId;
            var oldAmount = member.SelectedFee.Amount;

            if (newFeesByType.TryGetValue(oldFeeTypeId, out var newFee))
            {
                member.SelectedFeeId = newFee.Id;
                feeChanges.Add(new
                {
                    memberId = member.Id,
                    userId = member.UserId,
                    oldFeeId = member.SelectedFee.Id,
                    newFeeId = newFee.Id,
                    feeTypeName = newFee.FeeType?.Name ?? "Unknown",
                    oldAmount = oldAmount,
                    newAmount = newFee.Amount
                });
            }
            else
            {
                // No matching fee type in new division - clear selection
                // Admin will need to manually assign a new fee
                feeChanges.Add(new
                {
                    memberId = member.Id,
                    userId = member.UserId,
                    oldFeeId = member.SelectedFeeId,
                    newFeeId = (int?)null,
                    feeTypeName = member.SelectedFee.FeeType?.Name ?? "Unknown",
                    oldAmount = oldAmount,
                    newAmount = (decimal?)null,
                    warning = "No matching fee type in target division"
                });
                member.SelectedFeeId = null;
            }
        }

        unit.DivisionId = request.NewDivisionId;
        unit.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Data = new
            {
                unitId = unit.Id,
                oldDivisionId,
                newDivisionId = request.NewDivisionId,
                feeChanges
            },
            Message = feeChanges.Any(fc => ((dynamic)fc).newFeeId == null)
                ? "Registration moved. Warning: Some members had fees that don't exist in the new division."
                : "Registration moved to new division"
        });
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

        // Update unit display name after merge
        await UpdateUnitDisplayNameAsync(targetUnit.Id);
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
            DisplayName = Utility.GetUnitDisplayName(unit, requiredPlayers),
            HasCustomName = unit.HasCustomName,
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
                CheckedInAt = m.CheckedInAt,
                WaiverSigned = m.WaiverSignedAt.HasValue,
                WaiverSignedAt = m.WaiverSignedAt,
                HasPaid = m.HasPaid,
                PaidAt = m.PaidAt,
                AmountPaid = m.AmountPaid,
                PaymentProofUrl = m.PaymentProofUrl,
                PaymentReference = m.PaymentReference,
                ReferenceId = m.ReferenceId,
                PaymentMethod = m.PaymentMethod
            }).ToList() ?? new List<EventUnitMemberDto>()
        };
    }


    // ============================================
    // Join Requests (TD/Organizer View)
    // ============================================

    [Authorize]
    [HttpGet("events/{eventId}/join-requests")]
    public async Task<ActionResult<ApiResponse<EventJoinRequestsDto>>> GetEventJoinRequests(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<EventJoinRequestsDto> { Success = false, Message = "Unauthorized" });

        var canManage = await CanManageEventAsync(eventId);
        if (!canManage)
            return Forbid();

        var pendingRequests = await _context.EventUnitJoinRequests
            .Include(r => r.User)
            .Include(r => r.Unit)
                .ThenInclude(u => u!.Division)
            .Where(r => r.Unit!.EventId == eventId && r.Status == "Pending")
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new PendingJoinRequestDto
            {
                RequestId = r.Id,
                RequesterName = (r.User!.FirstName ?? "") + " " + (r.User.LastName ?? ""),
                RequesterProfileImage = r.User.ProfileImageUrl,
                RequesterUserId = r.UserId,
                UnitId = r.UnitId,
                UnitName = r.Unit!.Name,
                DivisionId = r.Unit.DivisionId,
                DivisionName = r.Unit.Division != null ? r.Unit.Division.Name : "",
                Message = r.Message,
                CreatedAt = r.CreatedAt
            })
            .ToListAsync();

        var result = new EventJoinRequestsDto
        {
            EventId = eventId,
            PendingRequests = pendingRequests
        };

        return Ok(new ApiResponse<EventJoinRequestsDto> { Success = true, Data = result });
    }


    #region Join Code Methods

    /// <summary>
    /// Generate a unique 4-digit numeric join code
    /// </summary>
    private string GenerateJoinCode()
    {
        var random = new Random();
        return random.Next(1000, 10000).ToString(); // 1000-9999
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
    /// Includes friendship info: Friends with FriendsOnly get auto-accept, others need approval
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

        // Get user's friend IDs
        var friendIds = await _context.Friendships
            .Where(f => f.UserId1 == userId.Value || f.UserId2 == userId.Value)
            .Select(f => f.UserId1 == userId.Value ? f.UserId2 : f.UserId1)
            .ToListAsync();
        var friendIdSet = friendIds.ToHashSet();

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

        // Filter: Show units based on join method
        // "Open" - visible to everyone (anyone can join instantly)
        // "Approval" - visible to everyone (requires captain approval)
        // "FriendsOnly" - only visible to friends of the captain
        var filteredUnits = units.Where(u =>
        {
            var method = u.JoinMethod ?? "Approval";
            if (method == "Open") return true;
            if (method == "Approval") return true;
            if (method == "FriendsOnly") return friendIdSet.Contains(u.CaptainUserId);
            return false; // Don't show "Code" method units (legacy)
        }).ToList();

        var result = filteredUnits.Select(u => new JoinableUnitDto
        {
            Id = u.Id,
            Name = u.Name,
            CaptainUserId = u.CaptainUserId,
            CaptainName = u.Captain != null ? FormatName(u.Captain.LastName, u.Captain.FirstName) : null,
            CaptainProfileImageUrl = u.Captain?.ProfileImageUrl,
            CaptainCity = u.Captain?.City,
            JoinMethod = u.JoinMethod ?? "Approval",
            IsFriend = friendIdSet.Contains(u.CaptainUserId),
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
    // Registration Validation
    // ============================================

    /// <summary>
    /// Validate all registrations for an event and return issues found
    /// </summary>
    [Authorize]
    [HttpGet("events/{eventId}/validate-registrations")]
    public async Task<ActionResult<ApiResponse<RegistrationValidationResultDto>>> ValidateRegistrations(int eventId)
    {
        if (!await CanManageEventAsync(eventId))
            return Forbid();

        var result = new RegistrationValidationResultDto
        {
            Summary = new List<ValidationSummaryItem>(),
            Issues = new List<ValidationIssue>()
        };

        try
        {
            using var connection = _context.Database.GetDbConnection();
            await connection.OpenAsync();

            using var command = connection.CreateCommand();
            command.CommandText = "EXEC sp_ValidateEventRegistrations @EventId";
            var param = command.CreateParameter();
            param.ParameterName = "@EventId";
            param.Value = eventId;
            command.Parameters.Add(param);

            using var reader = await command.ExecuteReaderAsync();

            // First result set: summary
            while (await reader.ReadAsync())
            {
                result.Summary.Add(new ValidationSummaryItem
                {
                    Category = reader.GetString(0),
                    Severity = reader.GetString(1),
                    IssueCount = reader.GetInt32(2)
                });
            }

            // Second result set: issues
            if (await reader.NextResultAsync())
            {
                while (await reader.ReadAsync())
                {
                    result.Issues.Add(new ValidationIssue
                    {
                        Category = reader.GetString(0),
                        Severity = reader.GetString(1),
                        DivisionId = reader.IsDBNull(2) ? null : reader.GetInt32(2),
                        DivisionName = reader.IsDBNull(3) ? null : reader.GetString(3),
                        UnitId = reader.IsDBNull(4) ? null : reader.GetInt32(4),
                        UnitName = reader.IsDBNull(5) ? null : reader.GetString(5),
                        UserId = reader.IsDBNull(6) ? null : reader.GetInt32(6),
                        UserName = reader.IsDBNull(7) ? null : reader.GetString(7),
                        Message = reader.GetString(8)
                    });
                }
            }

            result.TotalErrors = result.Summary.Where(s => s.Severity == "Error").Sum(s => s.IssueCount);
            result.TotalWarnings = result.Summary.Where(s => s.Severity == "Warning").Sum(s => s.IssueCount);
            result.TotalInfo = result.Summary.Where(s => s.Severity == "Info").Sum(s => s.IssueCount);

            return Ok(new ApiResponse<RegistrationValidationResultDto>
            {
                Success = true,
                Data = result
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to validate registrations for event {EventId}", eventId);
            return StatusCode(500, new ApiResponse<RegistrationValidationResultDto>
            {
                Success = false,
                Message = "Failed to validate registrations: " + ex.Message
            });
        }
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
            EventName = u.Event?.Name,
            DivisionId = u.DivisionId,
            DivisionName = u.Division?.Name,
            Name = u.Name,
            DisplayName = Utility.GetUnitDisplayName(u, teamSize),
            HasCustomName = u.HasCustomName,
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
            AutoAcceptMembers = u.AutoAcceptMembers,
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
                    // Waiver status
                    WaiverSigned = m.WaiverSignedAt.HasValue,
                    WaiverSignedAt = m.WaiverSignedAt,
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


    /// <summary>
    /// Updates the unit's Name field based on current members and naming rules:
    /// - Singles (size=1): "LastName, FirstName"
    /// - Pairs (size=2) without custom name: "FirstName1 & FirstName2" or "FirstName's team" if solo
    /// - Teams (size>2): Keep stored name (captain can customize)
    /// Call this when members join/leave to keep display name current.
    /// </summary>
    private async Task UpdateUnitDisplayNameAsync(int unitId)
    {
        var unit = await _context.EventUnits
            .Include(u => u.Members.Where(m => m.InviteStatus == "Accepted"))
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Captain)
            .FirstOrDefaultAsync(u => u.Id == unitId);

        if (unit == null) return;

        var teamSize = unit.Division?.TeamUnit?.TotalPlayers ?? 1;

        // Singles: use "LastName, FirstName"
        if (teamSize == 1)
        {
            var player = unit.Members.FirstOrDefault(m => m.InviteStatus == "Accepted")?.User ?? unit.Captain;
            if (player != null)
            {
                unit.Name = FormatName(player.LastName, player.FirstName);
            }
            return;
        }

        // Teams (size > 2): Don't auto-update unless name is empty
        if (teamSize > 2)
        {
            if (string.IsNullOrEmpty(unit.Name))
            {
                var captain = unit.Members.FirstOrDefault(m => m.Role == "Captain")?.User ?? unit.Captain;
                if (captain != null)
                {
                    unit.Name = $"{captain.FirstName}'s team";
                }
            }
            return;
        }

        // Pairs (size = 2): Auto-update name based on members if not custom
        if (unit.HasCustomName)
            return;

        var acceptedMembers = unit.Members
            .Where(m => m.InviteStatus == "Accepted" && m.User != null)
            .OrderBy(m => m.Id)
            .ToList();

        if (acceptedMembers.Count >= 2)
        {
            // Both players present: "FirstName1 & FirstName2"
            unit.Name = $"{acceptedMembers[0].User!.FirstName} & {acceptedMembers[1].User!.FirstName}";
        }
        else if (acceptedMembers.Count == 1)
        {
            // Only one player: "FirstName's team"
            unit.Name = $"{acceptedMembers[0].User!.FirstName}'s team";
        }

        unit.UpdatedAt = DateTime.Now;
    }

}

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
    public string? CaptainCity { get; set; }
    public string JoinMethod { get; set; } = "Approval";
    /// <summary>
    /// True if the requesting user is a friend of the captain
    /// </summary>
    public bool IsFriend { get; set; }
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

/// <summary>
/// Request to set a custom team name
/// </summary>
public class SetUnitNameRequest
{
    /// <summary>
    /// Custom team name. If null or empty, resets to default (auto-computed for pairs).
    /// </summary>
    public string? Name { get; set; }
}

/// <summary>
/// Request to update the join method for a unit
/// </summary>
public class UpdateJoinMethodRequest
{
    /// <summary>
    /// How partners can join: "Approval" (open to anyone, captain approves) or "FriendsOnly" (friends auto-accept)
    /// </summary>
    public string JoinMethod { get; set; } = "Approval";
}
