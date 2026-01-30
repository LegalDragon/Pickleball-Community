using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Constants;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.API.Controllers;

namespace Pickleball.Community.Services;

public interface ITournamentRegistrationService
{
    Task<ServiceResult<List<EventUnitDto>>> RegisterForEventAsync(int eventId, int userId, EventRegistrationRequest request);
    Task<ServiceResult<EventUnitDto>> AdminRegisterUserAsync(int eventId, int organizerId, bool isOrganizer, bool isAdmin, AdminAddRegistrationRequest request);
    Task<ServiceResult<UnitJoinRequestDto>> RequestToJoinUnitAsync(int unitId, int userId, JoinUnitRequest request);
    Task<ServiceResult<bool>> RespondToJoinRequestAsync(int userId, bool canManageEvent, RespondToJoinRequest request);
    Task<ServiceResult<bool>> RespondToInvitationAsync(int userId, RespondToInvitationRequest request);
    Task<ServiceResult<bool>> LeaveUnitAsync(int unitId, int userId);
    Task<ServiceResult<bool>> UnregisterFromDivisionAsync(int eventId, int divisionId, int userId);
    Task<ServiceResult<EventUnitDto>> SetUnitNameAsync(int unitId, int userId, bool isAdmin, bool isOrganizer, SetUnitNameRequest request);
    Task<ServiceResult<EventUnitDto>> UpdateUnitJoinMethodAsync(int unitId, int userId, bool isAdmin, bool isOrganizer, UpdateJoinMethodRequest request);
    Task<ServiceResult<object>> AdminBreakUnitAsync(int unitId, int userId, bool canManage);
    Task<ServiceResult<object>> MoveRegistrationAsync(int eventId, int unitId, int userId, bool isAdmin, MoveRegistrationRequest request);
    Task<ServiceResult<EventUnitDto>> SelfMoveToDivisionAsync(int eventId, int userId, SelfMoveDivisionRequest request);
    Task<ServiceResult<List<EventUnitDto>>> GetJoinableUnitsAsync(int eventId, int divisionId, int userId);
    Task<ServiceResult<EventUnitDto>> MergeRegistrationsAsync(int eventId, int userId, bool isAdmin, MergeRegistrationsRequest request);
    Task<ServiceResult<EventUnitDto>> JoinUnitByCodeAsync(int userId, JoinByCodeRequest request);
    Task<ServiceResult<string>> RegenerateJoinCodeAsync(int unitId, int userId);
    Task<ServiceResult<List<JoinableUnitDto>>> GetJoinableUnitsV2Async(int eventId, int divisionId, int userId);
    Task<ServiceResult<RegistrationValidationResultDto>> ValidateRegistrationsAsync(int eventId);
}

public class TournamentRegistrationService : ITournamentRegistrationService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TournamentRegistrationService> _logger;
    private readonly IEmailNotificationService _emailService;

    public TournamentRegistrationService(
        ApplicationDbContext context,
        ILogger<TournamentRegistrationService> logger,
        IEmailNotificationService emailService)
    {
        _context = context;
        _logger = logger;
        _emailService = emailService;
    }

    public async Task<ServiceResult<List<EventUnitDto>>> RegisterForEventAsync(int eventId, int userId, EventRegistrationRequest request)
    {
        var evt = await _context.Events
            .Include(e => e.Divisions)
                .ThenInclude(d => d.TeamUnit)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return ServiceResult<List<EventUnitDto>>.NotFound("Event not found");

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return ServiceResult<List<EventUnitDto>>.NotFound("User not found");

        var createdUnits = new List<EventUnit>();
        var warnings = new List<string>();

        if (string.IsNullOrEmpty(user.Gender))
            warnings.Add("Please update your profile with your gender for accurate division placement.");

        if (!evt.AllowMultipleDivisions && request.DivisionIds.Count > 1)
            return ServiceResult<List<EventUnitDto>>.Fail("This event only allows registration for one division");

        if (!evt.AllowMultipleDivisions)
        {
            var existingRegistration = await _context.EventUnitMembers
                .Include(m => m.Unit)
                .AnyAsync(m => m.UserId == userId &&
                    m.Unit!.EventId == eventId &&
                    m.Unit.Status != "Cancelled" &&
                    m.InviteStatus == "Accepted");

            if (existingRegistration)
                return ServiceResult<List<EventUnitDto>>.Fail("This event only allows registration for one division. You are already registered.");
        }

        foreach (var divisionId in request.DivisionIds)
        {
            var division = evt.Divisions.FirstOrDefault(d => d.Id == divisionId);
            if (division == null) continue;

            var existingMember = await _context.EventUnitMembers
                .Include(m => m.Unit)
                .FirstOrDefaultAsync(m => m.UserId == userId &&
                    m.Unit!.DivisionId == divisionId &&
                    m.Unit.EventId == eventId &&
                    m.InviteStatus == "Accepted");

            if (existingMember != null) continue;

            var hasPendingJoinRequest = await _context.EventUnitJoinRequests
                .Include(r => r.Unit)
                .AnyAsync(r => r.UserId == userId &&
                    r.Unit!.DivisionId == divisionId &&
                    r.Unit.EventId == eventId &&
                    r.Status == "Pending");

            if (hasPendingJoinRequest)
            {
                warnings.Add($"You have a pending join request in division '{division.Name}'. Cancel it first or wait for a response.");
                continue;
            }

            if (!string.IsNullOrEmpty(division.Gender) && division.Gender != "Open")
            {
                if (!string.IsNullOrEmpty(user.Gender))
                {
                    if (division.Gender == "Men" && user.Gender != "Male")
                        warnings.Add($"Division '{division.Name}' is for Men. Your profile indicates a different gender.");
                    else if (division.Gender == "Women" && user.Gender != "Female")
                        warnings.Add($"Division '{division.Name}' is for Women. Your profile indicates a different gender.");
                }
            }

            var teamSize = division.TeamUnit?.TotalPlayers ?? division.TeamSize;
            var isSingles = teamSize == 1;

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

            var completedUnitCount = await _context.EventUnits
                .Include(u => u.Members)
                .CountAsync(u => u.DivisionId == divisionId &&
                    u.Status != "Cancelled" &&
                    u.Status != "Waitlisted" &&
                    u.Members.Count(m => m.InviteStatus == "Accepted") >= teamSize);

            var isWaitlistedByUnits = division.MaxUnits.HasValue && completedUnitCount >= division.MaxUnits.Value;
            var isWaitlisted = isWaitlistedByPlayers || isWaitlistedByUnits;

            var unitName = isSingles
                ? Utility.FormatName(user.LastName, user.FirstName)
                : $"{user.FirstName}'s Team";

            var joinMethod = isSingles ? "Approval" : (request.JoinMethod ?? "Approval");
            string? joinCode = null;
            if (joinMethod == "Code" && !isSingles)
                joinCode = GenerateJoinCode();

            var unit = new EventUnit
            {
                EventId = eventId,
                DivisionId = divisionId,
                Name = unitName,
                Status = isWaitlisted ? "Waitlisted" : "Registered",
                WaitlistPosition = isWaitlisted ? await GetNextWaitlistPosition(divisionId) : null,
                CaptainUserId = userId,
                JoinMethod = joinMethod,
                JoinCode = joinCode,
                AutoAcceptMembers = !isSingles && request.AutoAcceptMembers,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            _context.EventUnits.Add(unit);
            await _context.SaveChangesAsync();

            unit.ReferenceId = $"E{eventId}-U{unit.Id}";

            var member = new EventUnitMember
            {
                UnitId = unit.Id,
                UserId = userId,
                Role = "Captain",
                InviteStatus = "Accepted",
                CreatedAt = DateTime.Now,
                ReferenceId = $"E{eventId}-U{unit.Id}-P{userId}",
                SelectedFeeId = request.SelectedFeeId
            };
            _context.EventUnitMembers.Add(member);

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

            if (isWaitlisted)
            {
                var waitlistReason = isWaitlistedByPlayers
                    ? $"Division '{division.Name}' has reached its maximum player limit"
                    : $"Division '{division.Name}' has reached its maximum team limit";
                warnings.Add($"WAITLIST: {waitlistReason}. You have been placed on the waiting list (position #{unit.WaitlistPosition}). You will be notified if a spot becomes available.");
            }
        }

        if (!createdUnits.Any())
        {
            return ServiceResult<List<EventUnitDto>>.OkWithWarnings(new List<EventUnitDto>(), warnings);
        }

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
            foreach (var unit in units)
            {
                var division = evt.Divisions.FirstOrDefault(d => d.Id == unit.DivisionId);
                var feeAmount = division?.DivisionFee ?? 0;

                var waiverCount = await _context.ObjectAssets
                    .Include(a => a.AssetType)
                    .CountAsync(a => a.ObjectId == eventId
                        && a.AssetType != null
                        && a.AssetType.TypeName.ToLower() == "waiver");

                var emailBody = EmailTemplates.EventRegistrationConfirmation(
                    $"{user.FirstName} {user.LastName}".Trim(),
                    evt.Name ?? "Event",
                    division?.Name ?? "Division",
                    evt.StartDate,
                    evt.VenueName,
                    unit.Name,
                    feeAmount,
                    waiverSigned: waiverCount == 0,
                    paymentComplete: feeAmount == 0
                );

                var subject = feeAmount == 0 && waiverCount == 0
                    ? $"Registration Complete: {evt.Name}"
                    : $"Registration Received: {evt.Name}";

                await _emailService.SendSimpleAsync(
                    userId,
                    user.Email!,
                    subject,
                    emailBody
                );
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send registration email for user {UserId}", userId);
        }

        return ServiceResult<List<EventUnitDto>>.OkWithWarnings(
            units.Select(MapToUnitDto).ToList(),
            warnings
        );
    }

    public async Task<ServiceResult<EventUnitDto>> AdminRegisterUserAsync(int eventId, int organizerId, bool isOrganizer, bool isAdmin, AdminAddRegistrationRequest request)
    {
        var evt = await _context.Events
            .Include(e => e.Divisions)
                .ThenInclude(d => d.TeamUnit)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return ServiceResult<EventUnitDto>.NotFound("Event not found");

        if (!isOrganizer && !isAdmin)
            return ServiceResult<EventUnitDto>.Forbidden();

        var user = await _context.Users.FindAsync(request.UserId);
        if (user == null)
            return ServiceResult<EventUnitDto>.NotFound("User not found");

        var division = evt.Divisions.FirstOrDefault(d => d.Id == request.DivisionId);
        if (division == null || !division.IsActive)
            return ServiceResult<EventUnitDto>.NotFound("Division not found");

        var existingMember = await _context.EventUnitMembers
            .Include(m => m.Unit)
            .FirstOrDefaultAsync(m => m.UserId == request.UserId &&
                m.Unit!.DivisionId == request.DivisionId &&
                m.Unit.EventId == eventId &&
                m.Unit.Status != "Cancelled" &&
                m.InviteStatus == "Accepted");

        if (existingMember != null)
            return ServiceResult<EventUnitDto>.Fail("User is already registered in this division");

        var teamSize = division.TeamUnit?.TotalPlayers ?? division.TeamSize;
        var isSingles = teamSize == 1;

        var completedUnitCount = await _context.EventUnits
            .Include(u => u.Members)
            .CountAsync(u => u.DivisionId == request.DivisionId &&
                u.Status != "Cancelled" &&
                u.Status != "Waitlisted" &&
                u.Members.Count(m => m.InviteStatus == "Accepted") >= teamSize);

        var isWaitlistedByUnits = division.MaxUnits.HasValue && completedUnitCount >= division.MaxUnits.Value;

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

        var isWaitlisted = isWaitlistedByPlayers || isWaitlistedByUnits;

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

        unit.ReferenceId = $"E{eventId}-U{unit.Id}";

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

        if (!isSingles && request.PartnerUserId.HasValue)
        {
            var partnerUser = await _context.Users.FindAsync(request.PartnerUserId.Value);
            if (partnerUser != null)
            {
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
                        InviteStatus = "Accepted",
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

        await UpdateUnitDisplayNameAsync(unit.Id);
        await _context.SaveChangesAsync();

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

        return ServiceResult<EventUnitDto>.Ok(MapToUnitDto(loadedUnit!), message);
    }

    public async Task<ServiceResult<UnitJoinRequestDto>> RequestToJoinUnitAsync(int unitId, int userId, JoinUnitRequest request)
    {
        var unit = await _context.EventUnits
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Members)
            .FirstOrDefaultAsync(u => u.Id == unitId);

        if (unit == null)
            return ServiceResult<UnitJoinRequestDto>.NotFound("Unit not found");

        var teamSize = unit.Division?.TeamUnit?.TotalPlayers ?? 1;
        var currentMembers = unit.Members.Count(m => m.InviteStatus == "Accepted");

        if (currentMembers >= teamSize)
            return ServiceResult<UnitJoinRequestDto>.Fail("Unit is already full");

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
                waitlistWarning = $"Division '{unit.Division.Name}' has reached its maximum player limit. If your request is accepted, you will be placed on the waiting list.";
        }

        var existingToUnit = await _context.EventUnitJoinRequests
            .FirstOrDefaultAsync(r => r.UnitId == unitId && r.UserId == userId && r.Status == "Pending");

        if (existingToUnit != null)
            return ServiceResult<UnitJoinRequestDto>.Fail("You already have a pending request to this team");

        var existingInDivision = await _context.EventUnitJoinRequests
            .Include(r => r.Unit)
            .FirstOrDefaultAsync(r => r.UserId == userId &&
                r.Unit!.DivisionId == unit.DivisionId &&
                r.Status == "Pending");

        if (existingInDivision != null)
            return ServiceResult<UnitJoinRequestDto>.Fail("You already have a pending request in this division. Cancel it first before requesting to join another team.");

        var alreadyRegisteredAsNonCaptain = await _context.EventUnitMembers
            .Include(m => m.Unit)
            .AnyAsync(m => m.UserId == userId &&
                m.Unit!.DivisionId == unit.DivisionId &&
                m.Unit.Status != "Cancelled" &&
                m.Unit.CaptainUserId != userId &&
                m.InviteStatus == "Accepted");

        if (alreadyRegisteredAsNonCaptain)
            return ServiceResult<UnitJoinRequestDto>.Fail("You are already registered in this division");

        // Check for MUTUAL REQUEST scenario
        var requesterUnit = await _context.EventUnits
            .Include(u => u.Members)
            .Include(u => u.JoinRequests)
            .FirstOrDefaultAsync(u => u.DivisionId == unit.DivisionId &&
                u.CaptainUserId == userId &&
                u.Status != "Cancelled");

        if (requesterUnit != null)
        {
            var mutualRequest = await _context.EventUnitJoinRequests
                .FirstOrDefaultAsync(r => r.UnitId == requesterUnit.Id &&
                    r.UserId == unit.CaptainUserId &&
                    r.Status == "Pending");

            if (mutualRequest != null)
            {
                var newMember = new EventUnitMember
                {
                    UnitId = requesterUnit.Id,
                    UserId = unit.CaptainUserId,
                    Role = "Player",
                    InviteStatus = "Accepted",
                    CreatedAt = DateTime.Now
                };
                _context.EventUnitMembers.Add(newMember);

                var targetMembers = await _context.EventUnitMembers
                    .Where(m => m.UnitId == unit.Id && m.UserId != unit.CaptainUserId)
                    .ToListAsync();
                foreach (var member in targetMembers)
                    member.UnitId = requesterUnit.Id;

                if (unit.AmountPaid > 0)
                    requesterUnit.AmountPaid += unit.AmountPaid;

                var targetJoinRequests = await _context.EventUnitJoinRequests
                    .Where(r => r.UnitId == unit.Id)
                    .ToListAsync();
                _context.EventUnitJoinRequests.RemoveRange(targetJoinRequests);

                _context.EventUnitJoinRequests.Remove(mutualRequest);
                _context.EventUnits.Remove(unit);

                await _context.SaveChangesAsync();

                await UpdateUnitDisplayNameAsync(requesterUnit.Id);
                await _context.SaveChangesAsync();

                var requesterUser = await _context.Users.FindAsync(userId);
                var targetUser = await _context.Users.FindAsync(unit.CaptainUserId);

                return ServiceResult<UnitJoinRequestDto>.Ok(new UnitJoinRequestDto
                {
                    Id = 0,
                    UnitId = requesterUnit.Id,
                    UnitName = requesterUnit.Name,
                    UserId = userId,
                    UserName = Utility.FormatName(requesterUser?.LastName, requesterUser?.FirstName),
                    ProfileImageUrl = requesterUser?.ProfileImageUrl,
                    Message = "Units merged automatically",
                    Status = "Merged",
                    CreatedAt = DateTime.Now
                }, $"Mutual request detected! Your team has been automatically merged with {Utility.FormatName(targetUser?.LastName, targetUser?.FirstName)}'s registration.");
            }
        }

        // Check if this is a FriendsOnly unit and user is a friend - auto-accept
        var isFriendsOnlyUnit = (unit.JoinMethod ?? "Approval") == "FriendsOnly";
        bool isFriend = false;
        if (isFriendsOnlyUnit)
        {
            isFriend = await _context.Friendships.AnyAsync(f =>
                (f.UserId1 == userId && f.UserId2 == unit.CaptainUserId) ||
                (f.UserId1 == unit.CaptainUserId && f.UserId2 == userId));
        }

        if (isFriendsOnlyUnit && isFriend)
        {
            if (string.IsNullOrEmpty(unit.ReferenceId))
                unit.ReferenceId = $"E{unit.EventId}-U{unitId}";

            var acceptedMember = new EventUnitMember
            {
                UnitId = unitId,
                UserId = userId,
                Role = "Player",
                InviteStatus = "Accepted",
                CreatedAt = DateTime.Now,
                ReferenceId = $"E{unit.EventId}-U{unitId}-P{userId}",
                SelectedFeeId = request.SelectedFeeId
            };
            _context.EventUnitMembers.Add(acceptedMember);

            await _context.SaveChangesAsync();

            await UpdateUnitDisplayNameAsync(unit.Id);
            await _context.SaveChangesAsync();

            var acceptedUser = await _context.Users.FindAsync(userId);
            var captain = await _context.Users.FindAsync(unit.CaptainUserId);

            return ServiceResult<UnitJoinRequestDto>.OkWithWarnings(
                new UnitJoinRequestDto
                {
                    Id = 0,
                    UnitId = unitId,
                    UnitName = unit.Name,
                    UserId = userId,
                    UserName = Utility.FormatName(acceptedUser?.LastName, acceptedUser?.FirstName),
                    ProfileImageUrl = acceptedUser?.ProfileImageUrl,
                    Message = "Auto-accepted (friends)",
                    Status = "Accepted",
                    CreatedAt = DateTime.Now
                },
                waitlistWarning != null ? new List<string> { waitlistWarning } : null,
                $"You have joined {Utility.FormatName(captain?.LastName, captain?.FirstName)}'s team! (Friend auto-accept)"
            );
        }

        // Check if unit has AutoAcceptMembers enabled
        if (unit.AutoAcceptMembers)
        {
            if (string.IsNullOrEmpty(unit.ReferenceId))
                unit.ReferenceId = $"E{unit.EventId}-U{unitId}";

            var autoAcceptedMember = new EventUnitMember
            {
                UnitId = unitId,
                UserId = userId,
                Role = "Player",
                InviteStatus = "Accepted",
                CreatedAt = DateTime.Now,
                ReferenceId = $"E{unit.EventId}-U{unitId}-P{userId}",
                SelectedFeeId = request.SelectedFeeId
            };
            _context.EventUnitMembers.Add(autoAcceptedMember);

            await _context.SaveChangesAsync();

            await UpdateUnitDisplayNameAsync(unit.Id);
            await _context.SaveChangesAsync();

            var autoAcceptedUser = await _context.Users.FindAsync(userId);
            var unitCaptain = await _context.Users.FindAsync(unit.CaptainUserId);

            return ServiceResult<UnitJoinRequestDto>.OkWithWarnings(
                new UnitJoinRequestDto
                {
                    Id = 0,
                    UnitId = unitId,
                    UnitName = unit.Name,
                    UserId = userId,
                    UserName = Utility.FormatName(autoAcceptedUser?.LastName, autoAcceptedUser?.FirstName),
                    ProfileImageUrl = autoAcceptedUser?.ProfileImageUrl,
                    Message = "Auto-accepted",
                    Status = "Accepted",
                    CreatedAt = DateTime.Now
                },
                waitlistWarning != null ? new List<string> { waitlistWarning } : null,
                $"You have joined {Utility.FormatName(unitCaptain?.LastName, unitCaptain?.FirstName)}'s team!"
            );
        }

        // Standard flow: Create pending join request
        var joinRequest = new EventUnitJoinRequest
        {
            UnitId = unitId,
            UserId = userId,
            Message = request.Message,
            Status = "Pending",
            CreatedAt = DateTime.Now
        };

        _context.EventUnitJoinRequests.Add(joinRequest);

        if (string.IsNullOrEmpty(unit.ReferenceId))
            unit.ReferenceId = $"E{unit.EventId}-U{unitId}";

        var membership = new EventUnitMember
        {
            UnitId = unitId,
            UserId = userId,
            Role = "Player",
            InviteStatus = "PendingJoinRequest",
            CreatedAt = DateTime.Now,
            ReferenceId = $"E{unit.EventId}-U{unitId}-P{userId}"
        };
        _context.EventUnitMembers.Add(membership);

        await _context.SaveChangesAsync();

        var user2 = await _context.Users.FindAsync(userId);

        return ServiceResult<UnitJoinRequestDto>.OkWithWarnings(
            new UnitJoinRequestDto
            {
                Id = joinRequest.Id,
                UnitId = unitId,
                UnitName = unit.Name,
                UserId = userId,
                UserName = Utility.FormatName(user2?.LastName, user2?.FirstName),
                ProfileImageUrl = user2?.ProfileImageUrl,
                Message = request.Message,
                Status = "Pending",
                CreatedAt = joinRequest.CreatedAt
            },
            waitlistWarning != null ? new List<string> { waitlistWarning } : null
        );
    }

    public async Task<ServiceResult<bool>> RespondToJoinRequestAsync(int userId, bool canManageEvent, RespondToJoinRequest request)
    {
        var joinRequest = await _context.EventUnitJoinRequests
            .Include(r => r.Unit)
                .ThenInclude(u => u!.Event)
            .FirstOrDefaultAsync(r => r.Id == request.RequestId);

        if (joinRequest == null)
            return ServiceResult<bool>.NotFound("Request not found");

        var isCaptain = joinRequest.Unit?.CaptainUserId == userId;
        if (!isCaptain && !canManageEvent)
            return ServiceResult<bool>.Forbidden();

        bool shouldWaitlist = false;
        string? waitlistMessage = null;
        if (request.Accept)
        {
            var existingMembership = await _context.EventUnitMembers
                .AnyAsync(m => m.UnitId == joinRequest.UnitId &&
                    m.UserId == joinRequest.UserId &&
                    (m.InviteStatus == "PendingJoinRequest" || m.InviteStatus == "PendingPartnerInvite"));

            if (!existingMembership)
            {
                var division = await _context.EventDivisions
                    .FirstOrDefaultAsync(d => d.Id == joinRequest.Unit!.DivisionId);

                if (division?.MaxPlayers.HasValue == true)
                {
                    var currentPlayerCount = await _context.EventUnitMembers
                        .Include(m => m.Unit)
                        .CountAsync(m => m.Unit!.DivisionId == division.Id &&
                            m.Unit.EventId == joinRequest.Unit!.EventId &&
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

        var membership = await _context.EventUnitMembers
            .FirstOrDefaultAsync(m => m.UnitId == joinRequest.UnitId &&
                m.UserId == joinRequest.UserId);

        if (request.Accept)
        {
            if (membership != null)
            {
                membership.InviteStatus = "Accepted";
                membership.RespondedAt = DateTime.Now;

                if (string.IsNullOrEmpty(membership.ReferenceId))
                    membership.ReferenceId = $"E{joinRequest.Unit!.EventId}-U{joinRequest.UnitId}-P{membership.UserId}";
            }
            else
            {
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

            if (joinRequest.Unit != null && string.IsNullOrEmpty(joinRequest.Unit.ReferenceId))
                joinRequest.Unit.ReferenceId = $"E{joinRequest.Unit.EventId}-U{joinRequest.UnitId}";

            if (joinRequest.Unit != null)
            {
                var allMembers = await _context.EventUnitMembers
                    .Where(m => m.UnitId == joinRequest.UnitId && m.InviteStatus == "Accepted")
                    .ToListAsync();

                if (!allMembers.Any(m => m.UserId == membership!.UserId))
                    allMembers.Add(membership!);

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
            if (membership != null)
            {
                membership.InviteStatus = "Rejected";
                membership.RespondedAt = DateTime.Now;
            }
            _context.EventUnitJoinRequests.Remove(joinRequest);
        }

        if (request.Accept && shouldWaitlist && joinRequest.Unit != null && joinRequest.Unit.Status != "Waitlisted")
        {
            joinRequest.Unit.Status = "Waitlisted";
            joinRequest.Unit.WaitlistPosition = await GetNextWaitlistPosition(joinRequest.Unit.DivisionId);
            joinRequest.Unit.UpdatedAt = DateTime.Now;
        }

        await _context.SaveChangesAsync();

        if (request.Accept)
        {
            await UpdateUnitDisplayNameAsync(joinRequest.UnitId);
            await _context.SaveChangesAsync();
        }

        return ServiceResult<bool>.OkWithWarnings(true, waitlistMessage != null ? new List<string> { waitlistMessage } : null);
    }

    public async Task<ServiceResult<bool>> RespondToInvitationAsync(int userId, RespondToInvitationRequest request)
    {
        var membership = await _context.EventUnitMembers
            .Include(m => m.Unit)
            .FirstOrDefaultAsync(m => m.UnitId == request.UnitId && m.UserId == userId && m.InviteStatus == "Pending");

        if (membership == null)
            return ServiceResult<bool>.NotFound("Invitation not found");

        membership.InviteStatus = request.Accept ? "Accepted" : "Declined";
        membership.RespondedAt = DateTime.Now;

        if (request.Accept)
        {
            if (string.IsNullOrEmpty(membership.ReferenceId) && membership.Unit != null)
                membership.ReferenceId = $"E{membership.Unit.EventId}-U{membership.UnitId}-P{membership.UserId}";

            if (membership.Unit != null && string.IsNullOrEmpty(membership.Unit.ReferenceId))
                membership.Unit.ReferenceId = $"E{membership.Unit.EventId}-U{membership.UnitId}";

            if (membership.Unit != null)
            {
                var allMembers = await _context.EventUnitMembers
                    .Where(m => m.UnitId == membership.UnitId && m.InviteStatus == "Accepted")
                    .ToListAsync();

                if (!allMembers.Any(m => m.UserId == membership.UserId))
                    allMembers.Add(membership);

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

        if (request.Accept)
        {
            await UpdateUnitDisplayNameAsync(request.UnitId);
            await _context.SaveChangesAsync();
        }

        return ServiceResult<bool>.Ok(true);
    }

    public async Task<ServiceResult<bool>> LeaveUnitAsync(int unitId, int userId)
    {
        var membership = await _context.EventUnitMembers
            .Include(m => m.Unit)
            .FirstOrDefaultAsync(m => m.UnitId == unitId && m.UserId == userId);

        if (membership == null)
            return ServiceResult<bool>.NotFound("Membership not found");

        if (membership.Unit?.CaptainUserId == userId)
            return ServiceResult<bool>.Fail("Captain cannot leave the unit. Disband or transfer captaincy first.");

        var memberUnitId = membership.UnitId;
        _context.EventUnitMembers.Remove(membership);
        await _context.SaveChangesAsync();

        await UpdateUnitDisplayNameAsync(memberUnitId);
        await _context.SaveChangesAsync();

        return ServiceResult<bool>.Ok(true);
    }

    public async Task<ServiceResult<bool>> UnregisterFromDivisionAsync(int eventId, int divisionId, int userId)
    {
        try
        {
            var successParam = new SqlParameter("@Success", System.Data.SqlDbType.Bit) { Direction = System.Data.ParameterDirection.Output };
            var messageParam = new SqlParameter("@Message", System.Data.SqlDbType.NVarChar, 500) { Direction = System.Data.ParameterDirection.Output };

            await _context.Database.ExecuteSqlRawAsync(
                "EXEC sp_UnregisterFromDivision @EventId, @DivisionId, @UserId, @Success OUTPUT, @Message OUTPUT",
                new SqlParameter("@EventId", eventId),
                new SqlParameter("@DivisionId", divisionId),
                new SqlParameter("@UserId", userId),
                successParam,
                messageParam
            );

            var success = (bool)successParam.Value;
            var message = (string)messageParam.Value;

            if (success)
                return ServiceResult<bool>.Ok(true, message);

            if (message.Contains("not registered"))
                return ServiceResult<bool>.NotFound(message);
            return ServiceResult<bool>.Fail(message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unregistering user {UserId} from division {DivisionId} in event {EventId}", userId, divisionId, eventId);
            return ServiceResult<bool>.ServerError("An error occurred while unregistering");
        }
    }

    public async Task<ServiceResult<EventUnitDto>> SetUnitNameAsync(int unitId, int userId, bool isAdmin, bool isOrganizer, SetUnitNameRequest request)
    {
        var unit = await _context.EventUnits
            .Include(u => u.Members.Where(m => m.InviteStatus == "Accepted"))
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Captain)
            .FirstOrDefaultAsync(u => u.Id == unitId);

        if (unit == null)
            return ServiceResult<EventUnitDto>.NotFound("Unit not found");

        if (unit.CaptainUserId != userId && !isAdmin && !isOrganizer)
            return ServiceResult<EventUnitDto>.Forbidden();

        var teamSize = unit.Division?.TeamUnit?.TotalPlayers ?? 1;

        if (teamSize > 2)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
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
        else if (teamSize == 2)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
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
            return ServiceResult<EventUnitDto>.Fail("Cannot set custom name for singles registration");
        }

        unit.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        var loadedUnit = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Captain)
            .FirstOrDefaultAsync(u => u.Id == unitId);

        return ServiceResult<EventUnitDto>.Ok(
            MapToUnitDto(loadedUnit!),
            unit.HasCustomName ? "Custom team name set" : "Team name reset to default"
        );
    }

    public async Task<ServiceResult<EventUnitDto>> UpdateUnitJoinMethodAsync(int unitId, int userId, bool isAdmin, bool isOrganizer, UpdateJoinMethodRequest request)
    {
        var unit = await _context.EventUnits
            .Include(u => u.Members.Where(m => m.InviteStatus == "Accepted"))
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Captain)
            .FirstOrDefaultAsync(u => u.Id == unitId);

        if (unit == null)
            return ServiceResult<EventUnitDto>.NotFound("Unit not found");

        if (unit.CaptainUserId != userId && !isAdmin && !isOrganizer)
            return ServiceResult<EventUnitDto>.Forbidden();

        var teamSize = unit.Division?.TeamUnit?.TotalPlayers ?? 1;

        if (teamSize <= 1)
            return ServiceResult<EventUnitDto>.Fail("Join method is not applicable for singles registration");

        var validMethods = new[] { "Approval", "FriendsOnly" };
        if (!validMethods.Contains(request.JoinMethod))
            return ServiceResult<EventUnitDto>.Fail("Invalid join method. Must be 'Approval' or 'FriendsOnly'");

        unit.JoinMethod = request.JoinMethod;
        unit.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        var loadedUnit = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Captain)
            .FirstOrDefaultAsync(u => u.Id == unitId);

        var methodDescription = request.JoinMethod == "FriendsOnly" ? "Friends only (auto-accept)" : "Open to anyone";
        return ServiceResult<EventUnitDto>.Ok(MapToUnitDto(loadedUnit!), $"Join method updated to: {methodDescription}");
    }

    public async Task<ServiceResult<object>> AdminBreakUnitAsync(int unitId, int userId, bool canManage)
    {
        var unit = await _context.EventUnits
            .Include(u => u.Event)
            .Include(u => u.Division)
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.JoinRequests)
            .FirstOrDefaultAsync(u => u.Id == unitId);

        if (unit == null)
            return ServiceResult<object>.NotFound("Unit not found");

        if (!canManage)
            return ServiceResult<object>.Forbidden();

        var hasScheduledMatches = await _context.EventEncounters
            .AnyAsync(m => (m.Unit1Id == unitId || m.Unit2Id == unitId) && m.Status != "Cancelled");

        if (hasScheduledMatches)
            return ServiceResult<object>.Fail("Cannot break unit with scheduled matches. Cancel or reassign the matches first.");

        var acceptedMembers = unit.Members.Where(m => m.InviteStatus == "Accepted").ToList();

        if (acceptedMembers.Count <= 1)
            return ServiceResult<object>.Fail("Unit only has one member. Nothing to break apart.");

        if (unit.JoinRequests.Any())
            _context.EventUnitJoinRequests.RemoveRange(unit.JoinRequests);

        var pendingMembers = unit.Members.Where(m => m.InviteStatus != "Accepted").ToList();
        if (pendingMembers.Any())
            _context.EventUnitMembers.RemoveRange(pendingMembers);

        var createdUnits = new List<string>();
        var captain = acceptedMembers.FirstOrDefault(m => m.UserId == unit.CaptainUserId);
        var nonCaptainMembers = acceptedMembers.Where(m => m.UserId != unit.CaptainUserId).ToList();

        foreach (var member in nonCaptainMembers)
        {
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
            await _context.SaveChangesAsync();

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

            member.UnitId = newUnit.Id;
            member.Role = "Captain";
            member.ReferenceId = $"E{unit.EventId}-U{newUnit.Id}-P{member.UserId}";

            createdUnits.Add(memberName!);
        }

        if (captain != null)
        {
            unit.Name = Utility.FormatName(captain.User?.LastName, captain.User?.FirstName);
            unit.Status = captain.IsCheckedIn ? "CheckedIn" : "Registered";

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

            captain.ReferenceId = $"E{unit.EventId}-U{unit.Id}-P{captain.UserId}";
        }
        unit.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return ServiceResult<object>.Ok(
            new { createdUnits = createdUnits.Count },
            $"Unit broken apart. {createdUnits.Count} new individual registration(s) created: {string.Join(", ", createdUnits)}"
        );
    }

    public async Task<ServiceResult<object>> MoveRegistrationAsync(int eventId, int unitId, int userId, bool isAdmin, MoveRegistrationRequest request)
    {
        var evt = await _context.Events.FirstOrDefaultAsync(e => e.Id == eventId && e.IsActive);
        if (evt == null)
            return ServiceResult<object>.NotFound("Event not found");

        if (evt.OrganizedByUserId != userId && !isAdmin)
            return ServiceResult<object>.Forbidden();

        var unit = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.SelectedFee)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);
        if (unit == null)
            return ServiceResult<object>.NotFound("Unit not found");

        var oldDivisionId = unit.DivisionId;

        var targetDivision = await _context.EventDivisions
            .FirstOrDefaultAsync(d => d.Id == request.NewDivisionId && d.EventId == eventId && d.IsActive);
        if (targetDivision == null)
            return ServiceResult<object>.NotFound("Target division not found");

        var newDivisionFees = await _context.DivisionFees
            .Include(f => f.FeeType)
            .Where(f => f.EventId == eventId && (f.DivisionId == request.NewDivisionId || f.DivisionId == 0) && f.IsActive)
            .ToListAsync();

        var newFeesByType = newDivisionFees
            .GroupBy(f => f.FeeTypeId)
            .ToDictionary(
                g => g.Key,
                g => g.FirstOrDefault(f => f.DivisionId == request.NewDivisionId) ?? g.First()
            );

        var feeChanges = new List<object>();

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
                    oldAmount,
                    newAmount = newFee.Amount
                });
            }
            else
            {
                feeChanges.Add(new
                {
                    memberId = member.Id,
                    userId = member.UserId,
                    oldFeeId = member.SelectedFeeId,
                    newFeeId = (int?)null,
                    feeTypeName = member.SelectedFee.FeeType?.Name ?? "Unknown",
                    oldAmount,
                    newAmount = (decimal?)null,
                    warning = "No matching fee type in target division"
                });
                member.SelectedFeeId = null;
            }
        }

        unit.DivisionId = request.NewDivisionId;
        unit.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        return ServiceResult<object>.Ok(
            new { unitId = unit.Id, oldDivisionId, newDivisionId = request.NewDivisionId, feeChanges },
            feeChanges.Any(fc => ((dynamic)fc).newFeeId == null)
                ? "Registration moved. Warning: Some members had fees that don't exist in the new division."
                : "Registration moved to new division"
        );
    }

    public async Task<ServiceResult<EventUnitDto>> SelfMoveToDivisionAsync(int eventId, int userId, SelfMoveDivisionRequest request)
    {
        var evt = await _context.Events
            .Include(e => e.Divisions)
                .ThenInclude(d => d.TeamUnit)
            .FirstOrDefaultAsync(e => e.Id == eventId && e.IsActive);
        if (evt == null)
            return ServiceResult<EventUnitDto>.NotFound("Event not found");

        var targetDivision = evt.Divisions.FirstOrDefault(d => d.Id == request.NewDivisionId && d.IsActive);
        if (targetDivision == null)
            return ServiceResult<EventUnitDto>.NotFound("Target division not found");

        var currentMembership = await _context.EventUnitMembers
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Members)
            .FirstOrDefaultAsync(m => m.UserId == userId &&
                m.Unit!.EventId == eventId &&
                m.Unit.Status != "Cancelled" &&
                m.InviteStatus == "Accepted");

        if (currentMembership == null)
            return ServiceResult<EventUnitDto>.Fail("You are not registered for this event");

        var currentUnit = currentMembership.Unit!;

        if (currentUnit.DivisionId == request.NewDivisionId)
            return ServiceResult<EventUnitDto>.Fail("You are already in this division");

        var alreadyInTarget = await _context.EventUnitMembers
            .Include(m => m.Unit)
            .AnyAsync(m => m.UserId == userId &&
                m.Unit!.DivisionId == request.NewDivisionId &&
                m.Unit.Status != "Cancelled" &&
                m.InviteStatus == "Accepted");
        if (alreadyInTarget)
            return ServiceResult<EventUnitDto>.Fail("You are already registered in the target division");

        EventUnit? targetUnit = null;

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
                return ServiceResult<EventUnitDto>.NotFound("Target unit not found in that division");

            var targetTeamSize = targetUnit.Division?.TeamUnit?.TotalPlayers ?? 2;
            var acceptedMembers = targetUnit.Members.Count(m => m.InviteStatus == "Accepted");
            if (acceptedMembers >= targetTeamSize)
                return ServiceResult<EventUnitDto>.Fail("Target unit is already full");
        }

        _context.EventUnitMembers.Remove(currentMembership);

        var remainingMembers = currentUnit.Members.Where(m => m.Id != currentMembership.Id && m.InviteStatus == "Accepted").ToList();
        if (remainingMembers.Count == 0)
            currentUnit.Status = "Cancelled";
        else if (currentUnit.CaptainUserId == userId)
            currentUnit.CaptainUserId = remainingMembers.First().UserId;

        if (targetUnit != null)
        {
            var newMembership = new EventUnitMember
            {
                UnitId = targetUnit.Id,
                UserId = userId,
                Role = "Player",
                InviteStatus = "Accepted",
                CreatedAt = DateTime.Now
            };
            _context.EventUnitMembers.Add(newMembership);

            await _context.SaveChangesAsync();

            targetUnit = await _context.EventUnits
                .Include(u => u.Members).ThenInclude(m => m.User)
                .Include(u => u.Division).ThenInclude(d => d!.TeamUnit)
                .Include(u => u.Captain)
                .Include(u => u.Event)
                .FirstOrDefaultAsync(u => u.Id == targetUnit.Id);

            return ServiceResult<EventUnitDto>.Ok(
                MapToUnitDtoSimple(targetUnit!),
                "Successfully moved to new division and joined existing team"
            );
        }

        var newUnit = new EventUnit
        {
            EventId = eventId,
            DivisionId = request.NewDivisionId,
            Name = request.NewUnitName,
            CaptainUserId = userId,
            Status = "Registered",
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };
        _context.EventUnits.Add(newUnit);
        await _context.SaveChangesAsync();

        var captainMembership = new EventUnitMember
        {
            UnitId = newUnit.Id,
            UserId = userId,
            Role = "Captain",
            InviteStatus = "Accepted",
            CreatedAt = DateTime.Now
        };
        _context.EventUnitMembers.Add(captainMembership);
        await _context.SaveChangesAsync();

        newUnit = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Include(u => u.Division).ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Captain)
            .Include(u => u.Event)
            .FirstOrDefaultAsync(u => u.Id == newUnit.Id);

        return ServiceResult<EventUnitDto>.Ok(
            MapToUnitDtoSimple(newUnit!),
            "Successfully moved to new division with new team"
        );
    }

    public async Task<ServiceResult<List<EventUnitDto>>> GetJoinableUnitsAsync(int eventId, int divisionId, int userId)
    {
        var division = await _context.EventDivisions
            .Include(d => d.TeamUnit)
            .FirstOrDefaultAsync(d => d.Id == divisionId && d.EventId == eventId && d.IsActive);

        if (division == null)
            return ServiceResult<List<EventUnitDto>>.NotFound("Division not found");

        var teamSize = division.TeamUnit?.TotalPlayers ?? 2;

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

        return ServiceResult<List<EventUnitDto>>.Ok(units.Select(MapToUnitDto).ToList());
    }

    public async Task<ServiceResult<EventUnitDto>> MergeRegistrationsAsync(int eventId, int userId, bool isAdmin, MergeRegistrationsRequest request)
    {
        var evt = await _context.Events
            .Include(e => e.Divisions)
                .ThenInclude(d => d.TeamUnit)
            .FirstOrDefaultAsync(e => e.Id == eventId && e.IsActive);
        if (evt == null)
            return ServiceResult<EventUnitDto>.NotFound("Event not found");

        if (evt.OrganizedByUserId != userId && !isAdmin)
            return ServiceResult<EventUnitDto>.Forbidden();

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
            return ServiceResult<EventUnitDto>.NotFound("Target registration not found");

        if (sourceUnit == null)
            return ServiceResult<EventUnitDto>.NotFound("Source registration not found");

        if (targetUnit.DivisionId != sourceUnit.DivisionId)
            return ServiceResult<EventUnitDto>.Fail("Both registrations must be in the same division");

        var teamSize = targetUnit.Division?.TeamUnit?.TotalPlayers ?? targetUnit.Division?.TeamSize ?? 2;
        var targetMemberCount = targetUnit.Members.Count(m => m.InviteStatus == "Accepted");
        var sourceMemberCount = sourceUnit.Members.Count(m => m.InviteStatus == "Accepted");

        if (targetMemberCount + sourceMemberCount > teamSize)
            return ServiceResult<EventUnitDto>.Fail($"Combined members ({targetMemberCount + sourceMemberCount}) would exceed team size ({teamSize})");

        foreach (var member in sourceUnit.Members.ToList())
        {
            if (targetUnit.Members.Any(m => m.UserId == member.UserId))
            {
                _context.EventUnitMembers.Remove(member);
                continue;
            }
            member.UnitId = targetUnit.Id;
            member.InviteStatus = "Accepted";
            member.Role = "Member";
        }

        if (sourceUnit.AmountPaid > 0)
        {
            targetUnit.AmountPaid += sourceUnit.AmountPaid;
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

        var sourceJoinRequests = await _context.EventUnitJoinRequests
            .Where(r => r.UnitId == sourceUnit.Id)
            .ToListAsync();
        _context.EventUnitJoinRequests.RemoveRange(sourceJoinRequests);

        var mergedUserIds = targetUnit.Members.Select(m => m.UserId).ToHashSet();

        var targetJoinRequests = await _context.EventUnitJoinRequests
            .Where(r => r.UnitId == targetUnit.Id)
            .ToListAsync();
        var targetJoinRequestsFromMembers = targetJoinRequests.Where(r => mergedUserIds.Contains(r.UserId)).ToList();
        _context.EventUnitJoinRequests.RemoveRange(targetJoinRequestsFromMembers);

        var divisionJoinRequests = await _context.EventUnitJoinRequests
            .Include(r => r.Unit)
            .Where(r => r.Unit!.DivisionId == targetUnit.DivisionId && r.Status == "Pending")
            .ToListAsync();
        var otherJoinRequests = divisionJoinRequests.Where(r => mergedUserIds.Contains(r.UserId)).ToList();
        _context.EventUnitJoinRequests.RemoveRange(otherJoinRequests);

        _context.EventUnits.Remove(sourceUnit);

        targetUnit.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        await UpdateUnitDisplayNameAsync(targetUnit.Id);
        await _context.SaveChangesAsync();

        var updatedUnit = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Event)
            .FirstOrDefaultAsync(u => u.Id == targetUnit.Id);

        return ServiceResult<EventUnitDto>.Ok(MapToUnitDtoSimple(updatedUnit!), "Registrations merged successfully");
    }

    public async Task<ServiceResult<EventUnitDto>> JoinUnitByCodeAsync(int userId, JoinByCodeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.JoinCode))
            return ServiceResult<EventUnitDto>.Fail("Join code is required");

        var code = request.JoinCode.ToUpper().Trim();

        var unit = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Include(u => u.Division).ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Event)
            .Include(u => u.Captain)
            .FirstOrDefaultAsync(u => u.JoinCode == code && u.JoinMethod == "Code");

        if (unit == null)
            return ServiceResult<EventUnitDto>.NotFound("Invalid join code. Please check the code and try again.");

        var teamSize = unit.Division?.TeamUnit?.TotalPlayers ?? unit.Division?.TeamSize ?? 2;
        var acceptedCount = unit.Members.Count(m => m.InviteStatus == "Accepted");
        if (acceptedCount >= teamSize)
            return ServiceResult<EventUnitDto>.Fail("This team is already full");

        if (unit.Members.Any(m => m.UserId == userId && m.InviteStatus == "Accepted"))
            return ServiceResult<EventUnitDto>.Fail("You are already a member of this team");

        var alreadyInDivision = await _context.EventUnitMembers
            .Include(m => m.Unit)
            .AnyAsync(m => m.UserId == userId &&
                m.Unit!.DivisionId == unit.DivisionId &&
                m.Unit.Status != "Cancelled" &&
                m.InviteStatus == "Accepted");

        if (alreadyInDivision)
            return ServiceResult<EventUnitDto>.Fail("You are already registered in this division");

        var member = new EventUnitMember
        {
            UnitId = unit.Id,
            UserId = userId,
            Role = "Player",
            InviteStatus = "Accepted",
            CreatedAt = DateTime.Now,
            ReferenceId = $"E{unit.EventId}-U{unit.Id}-P{userId}",
            SelectedFeeId = request.SelectedFeeId
        };
        _context.EventUnitMembers.Add(member);

        unit.JoinCode = null;
        unit.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        unit = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Include(u => u.Division).ThenInclude(d => d!.TeamUnit)
            .Include(u => u.Event)
            .Include(u => u.Captain)
            .Include(u => u.JoinRequests)
            .FirstOrDefaultAsync(u => u.Id == unit.Id);

        return ServiceResult<EventUnitDto>.Ok(MapToUnitDto(unit!), $"Successfully joined {unit!.Name}!");
    }

    public async Task<ServiceResult<string>> RegenerateJoinCodeAsync(int unitId, int userId)
    {
        var unit = await _context.EventUnits
            .Include(u => u.Division).ThenInclude(d => d!.TeamUnit)
            .FirstOrDefaultAsync(u => u.Id == unitId);

        if (unit == null)
            return ServiceResult<string>.NotFound("Unit not found");

        if (unit.CaptainUserId != userId)
            return ServiceResult<string>.Forbidden();

        var teamSize = unit.Division?.TeamUnit?.TotalPlayers ?? unit.Division?.TeamSize ?? 2;
        var acceptedCount = await _context.EventUnitMembers
            .CountAsync(m => m.UnitId == unitId && m.InviteStatus == "Accepted");
        if (acceptedCount >= teamSize)
            return ServiceResult<string>.Fail("Team is already full");

        unit.JoinCode = GenerateJoinCode();
        unit.JoinMethod = "Code";
        unit.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return ServiceResult<string>.Ok(unit.JoinCode, "New join code generated");
    }

    public async Task<ServiceResult<List<JoinableUnitDto>>> GetJoinableUnitsV2Async(int eventId, int divisionId, int userId)
    {
        var division = await _context.EventDivisions
            .Include(d => d.TeamUnit)
            .FirstOrDefaultAsync(d => d.Id == divisionId && d.EventId == eventId && d.IsActive);

        if (division == null)
            return ServiceResult<List<JoinableUnitDto>>.NotFound("Division not found");

        var teamSize = division.TeamUnit?.TotalPlayers ?? 2;

        var friendIds = await _context.Friendships
            .Where(f => f.UserId1 == userId || f.UserId2 == userId)
            .Select(f => f.UserId1 == userId ? f.UserId2 : f.UserId1)
            .ToListAsync();
        var friendIdSet = friendIds.ToHashSet();

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

        var filteredUnits = units.Where(u =>
        {
            var method = u.JoinMethod ?? "Approval";
            if (method == "Approval") return true;
            if (method == "FriendsOnly") return friendIdSet.Contains(u.CaptainUserId);
            return false;
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

        return ServiceResult<List<JoinableUnitDto>>.Ok(result);
    }

    public async Task<ServiceResult<RegistrationValidationResultDto>> ValidateRegistrationsAsync(int eventId)
    {
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

            while (await reader.ReadAsync())
            {
                result.Summary.Add(new ValidationSummaryItem
                {
                    Category = reader.GetString(0),
                    Severity = reader.GetString(1),
                    IssueCount = reader.GetInt32(2)
                });
            }

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

            return ServiceResult<RegistrationValidationResultDto>.Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to validate registrations for event {EventId}", eventId);
            return ServiceResult<RegistrationValidationResultDto>.ServerError("Failed to validate registrations: " + ex.Message);
        }
    }

    // ============================================
    // Private Helper Methods
    // ============================================

    private async Task<int> GetNextWaitlistPosition(int divisionId)
    {
        var maxUnit = await _context.EventUnits
            .Where(u => u.DivisionId == divisionId && u.Status == "Waitlisted" && u.WaitlistPosition != null)
            .OrderByDescending(u => u.WaitlistPosition)
            .Select(u => u.WaitlistPosition)
            .FirstOrDefaultAsync();

        return (maxUnit ?? 0) + 1;
    }

    private string GenerateJoinCode()
    {
        var random = new Random();
        return random.Next(1000, 10000).ToString();
    }

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

        if (teamSize == 1)
        {
            var player = unit.Members.FirstOrDefault(m => m.InviteStatus == "Accepted")?.User ?? unit.Captain;
            if (player != null)
                unit.Name = FormatName(player.LastName, player.FirstName);
            return;
        }

        if (teamSize > 2)
        {
            if (string.IsNullOrEmpty(unit.Name))
            {
                var captain = unit.Members.FirstOrDefault(m => m.Role == "Captain")?.User ?? unit.Captain;
                if (captain != null)
                    unit.Name = $"{captain.FirstName}'s team";
            }
            return;
        }

        if (unit.HasCustomName)
            return;

        var acceptedMembers = unit.Members
            .Where(m => m.InviteStatus == "Accepted" && m.User != null)
            .OrderBy(m => m.Id)
            .ToList();

        if (acceptedMembers.Count >= 2)
            unit.Name = $"{acceptedMembers[0].User!.FirstName} & {acceptedMembers[1].User!.FirstName}";
        else if (acceptedMembers.Count == 1)
            unit.Name = $"{acceptedMembers[0].User!.FirstName}'s team";

        unit.UpdatedAt = DateTime.Now;
    }

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

    private EventUnitDto MapToUnitDto(EventUnit u)
    {
        var teamSize = u.Division?.TeamUnit?.TotalPlayers ?? 1;
        var acceptedMembers = u.Members.Where(m => m.InviteStatus == "Accepted").ToList();
        var isComplete = acceptedMembers.Count >= teamSize;

        var pendingJoinRequests = (u.JoinRequests ?? new List<EventUnitJoinRequest>())
            .Where(jr => jr.Status == "Pending")
            .ToList();
        var pendingJoinRequestUserIds = pendingJoinRequests.Select(jr => jr.UserId).ToHashSet();

        string registrationStatus;
        if (isComplete)
            registrationStatus = "Team Complete";
        else if (u.Members.Any(m => m.InviteStatus == "Pending") || pendingJoinRequests.Any())
            registrationStatus = "Waiting for Captain Accept";
        else
            registrationStatus = "Looking for Partner";

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
            PaymentStatus = u.PaymentStatus ?? "Pending",
            AmountPaid = u.AmountPaid,
            AmountDue = (u.Event?.RegistrationFee ?? 0m) + (u.Division?.DivisionFee ?? 0m),
            PaymentProofUrl = u.PaymentProofUrl,
            PaymentReference = u.PaymentReference,
            ReferenceId = u.ReferenceId,
            PaidAt = u.PaidAt,
            CreatedAt = u.CreatedAt,
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
                    WaiverSigned = m.WaiverSignedAt.HasValue,
                    WaiverSignedAt = m.WaiverSignedAt,
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
                        Id = 0,
                        UserId = jr.UserId,
                        FirstName = jr.User?.FirstName,
                        LastName = jr.User?.LastName,
                        ProfileImageUrl = jr.User?.ProfileImageUrl,
                        Role = "Player",
                        InviteStatus = "Requested",
                        IsCheckedIn = false,
                        CheckedInAt = null,
                        JoinRequestId = jr.Id
                    })
                ).ToList()
        };
    }

    private EventUnitDto MapToUnitDtoSimple(EventUnit unit)
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
}
