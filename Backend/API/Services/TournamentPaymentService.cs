using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Constants;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.Services;

public interface ITournamentPaymentService
{
    Task<ServiceResult<PaymentInfoDto>> UploadPaymentProofAsync(int eventId, int unitId, int userId, UploadPaymentProofRequest request);
    Task<ServiceResult<PaymentInfoDto>> MarkAsPaidAsync(int eventId, int unitId, int organizerUserId);
    Task<ServiceResult<PaymentInfoDto>> UnmarkPaidAsync(int eventId, int unitId, int organizerUserId);
    Task<ServiceResult<MemberPaymentDto>> MarkMemberAsPaidAsync(int eventId, int unitId, int memberId, int organizerUserId);
    Task<ServiceResult<MemberPaymentDto>> UnmarkMemberPaidAsync(int eventId, int unitId, int memberId, int organizerUserId);
    Task<ServiceResult<object>> ApplyPaymentToTeammatesAsync(int eventId, int unitId, int memberId, int organizerUserId, ApplyPaymentToTeammatesRequest request);
    Task<ServiceResult<MemberPaymentDto>> UpdateMemberPaymentAsync(int eventId, int unitId, int memberId, int organizerUserId, UpdateMemberPaymentRequest request);
    Task<ServiceResult<bool>> RemoveRegistrationAsync(int eventId, int unitId, int targetUserId, int currentUserId);
    Task<ServiceResult<EventPaymentSummaryDto>> GetEventPaymentSummaryAsync(int eventId, int userId, PaymentSummaryFilterRequest? filter = null);
    Task<ServiceResult<bool>> VerifyPaymentAsync(int paymentId, int userId);
    Task<ServiceResult<bool>> UnverifyPaymentAsync(int paymentId, int userId);
}

public class TournamentPaymentService : ITournamentPaymentService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TournamentPaymentService> _logger;
    private readonly IEmailNotificationService _emailService;

    public TournamentPaymentService(
        ApplicationDbContext context,
        ILogger<TournamentPaymentService> logger,
        IEmailNotificationService emailService)
    {
        _context = context;
        _logger = logger;
        _emailService = emailService;
    }

    public async Task<ServiceResult<PaymentInfoDto>> UploadPaymentProofAsync(int eventId, int unitId, int userId, UploadPaymentProofRequest request)
    {
        var unit = await _context.EventUnits
            .Include(u => u.Members)
            .Include(u => u.Event)
            .Include(u => u.Division)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return ServiceResult<PaymentInfoDto>.NotFound("Registration not found");

        var isMember = unit.Members.Any(m => m.UserId == userId);
        var canManage = await CanManageEventAsync(unit.EventId, userId);

        if (!isMember && !canManage)
            return ServiceResult<PaymentInfoDto>.Forbidden();

        var acceptedMembers = unit.Members.Where(m => m.InviteStatus == "Accepted").ToList();
        var allMembers = unit.Members.ToList();
        List<EventUnitMember> membersToPayFor;

        if (request.MemberIds != null && request.MemberIds.Count > 0)
        {
            membersToPayFor = acceptedMembers.Where(m => request.MemberIds.Contains(m.Id)).ToList();
            if (membersToPayFor.Count == 0)
                return ServiceResult<PaymentInfoDto>.Fail("No valid members selected for payment");
        }
        else
        {
            var submitterMember = acceptedMembers.FirstOrDefault(m => m.UserId == userId);
            if (submitterMember == null)
            {
                submitterMember = allMembers.FirstOrDefault(m => m.UserId == userId);
                if (submitterMember != null && submitterMember.InviteStatus != "Accepted")
                    submitterMember.InviteStatus = "Accepted";
            }
            membersToPayFor = submitterMember != null ? new List<EventUnitMember> { submitterMember } : new List<EventUnitMember>();
        }

        if (membersToPayFor.Count == 0)
            return ServiceResult<PaymentInfoDto>.Fail("No members to apply payment to. Please ensure you are a registered member of this unit.");

        var amountDue = (unit.Event?.RegistrationFee ?? 0m) + (unit.Division?.DivisionFee ?? 0m);
        var totalPaymentAmount = request.AmountPaid ?? 0m;
        var perMemberAmount = membersToPayFor.Count > 0 ? totalPaymentAmount / membersToPayFor.Count : 0m;

        var referenceId = $"E{eventId}-U{unitId}-P{userId}";

        var userPayment = new UserPayment
        {
            UserId = userId,
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
        await _context.SaveChangesAsync();

        foreach (var member in membersToPayFor)
        {
            member.HasPaid = true;
            member.PaidAt = DateTime.Now;
            member.AmountPaid = perMemberAmount;
            member.PaymentProofUrl = request.PaymentProofUrl;
            member.PaymentReference = request.PaymentReference;
            member.PaymentMethod = request.PaymentMethod;
            member.ReferenceId = referenceId;
            member.PaymentId = userPayment.Id;
        }

        await _context.SaveChangesAsync();

        if (!string.IsNullOrEmpty(request.PaymentProofUrl))
            unit.PaymentProofUrl = request.PaymentProofUrl;

        if (!string.IsNullOrEmpty(request.PaymentReference))
            unit.PaymentReference = request.PaymentReference;

        var totalPaidByMembers = acceptedMembers.Where(m => m.HasPaid).Sum(m => m.AmountPaid);
        unit.AmountPaid = totalPaidByMembers;

        if (string.IsNullOrEmpty(unit.ReferenceId))
            unit.ReferenceId = $"E{eventId}-U{unitId}";

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

        // Send registration complete email if applicable
        try
        {
            var payingMember = membersToPayFor.FirstOrDefault(m => m.UserId == userId) ?? membersToPayFor.First();
            var payingUser = await _context.Users.FindAsync(payingMember.UserId);

            if (payingUser?.Email != null)
            {
                var waiverCount = await _context.ObjectAssets
                    .Include(a => a.AssetType)
                    .CountAsync(a => a.ObjectId == eventId
                        && a.AssetType != null
                        && a.AssetType.TypeName.ToLower() == "waiver");

                var signedWaiverCount = await _context.EventUnitMemberWaivers
                    .CountAsync(w => w.EventUnitMemberId == payingMember.Id);

                var allWaiversSigned = waiverCount == 0 || signedWaiverCount >= waiverCount;

                if (allWaiversSigned)
                {
                    var playerName = $"{payingUser.FirstName} {payingUser.LastName}".Trim();
                    var badgeUrl = $"https://pickleball.community/badge/{payingMember.Id}";
                    var emailBody = EmailTemplates.EventRegistrationConfirmation(
                        playerName,
                        unit.Event?.Name ?? "Event",
                        unit.Division?.Name ?? "Division",
                        unit.Event?.StartDate ?? DateTime.Now,
                        unit.Event?.VenueName,
                        unit.Name,
                        amountDue,
                        waiverSigned: true,
                        paymentComplete: true,
                        badgeUrl: badgeUrl
                    );

                    await _emailService.SendSimpleAsync(
                        payingMember.UserId,
                        payingUser.Email,
                        $"Registration Complete: {unit.Event?.Name}",
                        emailBody
                    );
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send registration complete email after payment for user {UserId}", userId);
        }

        return ServiceResult<PaymentInfoDto>.Ok(new PaymentInfoDto
        {
            UnitId = unit.Id,
            PaymentStatus = unit.PaymentStatus,
            AmountPaid = unit.AmountPaid,
            AmountDue = amountDue,
            PaymentProofUrl = unit.PaymentProofUrl,
            PaymentReference = unit.PaymentReference,
            ReferenceId = unit.ReferenceId,
            PaidAt = unit.PaidAt
        }, "Payment info updated");
    }

    public async Task<ServiceResult<PaymentInfoDto>> MarkAsPaidAsync(int eventId, int unitId, int organizerUserId)
    {
        var unit = await _context.EventUnits
            .Include(u => u.Event)
            .Include(u => u.Division)
            .Include(u => u.Members)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return ServiceResult<PaymentInfoDto>.NotFound("Registration not found");

        var isAdmin = await IsAdminAsync(organizerUserId);
        if (unit.Event?.OrganizedByUserId != organizerUserId && !isAdmin)
            return ServiceResult<PaymentInfoDto>.Forbidden();

        var amountDue = (unit.Event?.RegistrationFee ?? 0m) + (unit.Division?.DivisionFee ?? 0m);
        var memberCount = unit.Members.Count;
        var perMemberAmount = memberCount > 0 ? amountDue / memberCount : amountDue;

        foreach (var member in unit.Members)
        {
            var referenceId = $"E{eventId}-U{unitId}-P{member.UserId}";

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
                    VerifiedByUserId = organizerUserId,
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
                existingPayment.VerifiedByUserId = organizerUserId;
                existingPayment.VerifiedAt = DateTime.Now;
                existingPayment.IsApplied = true;
                existingPayment.AppliedAt = DateTime.Now;
                existingPayment.UpdatedAt = DateTime.Now;
            }
        }

        unit.PaymentStatus = "Paid";
        unit.AmountPaid = amountDue;
        unit.PaidAt = DateTime.Now;
        unit.UpdatedAt = DateTime.Now;

        foreach (var member in unit.Members)
        {
            member.HasPaid = true;
            member.PaidAt = DateTime.Now;
            member.AmountPaid = perMemberAmount;
        }

        await _context.SaveChangesAsync();

        return ServiceResult<PaymentInfoDto>.Ok(new PaymentInfoDto
        {
            UnitId = unit.Id,
            PaymentStatus = unit.PaymentStatus,
            AmountPaid = unit.AmountPaid,
            AmountDue = amountDue,
            PaymentProofUrl = unit.PaymentProofUrl,
            PaymentReference = unit.PaymentReference,
            ReferenceId = unit.ReferenceId,
            PaidAt = unit.PaidAt
        }, "Marked as paid");
    }

    public async Task<ServiceResult<PaymentInfoDto>> UnmarkPaidAsync(int eventId, int unitId, int organizerUserId)
    {
        var unit = await _context.EventUnits
            .Include(u => u.Event)
            .Include(u => u.Division)
            .Include(u => u.Members)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return ServiceResult<PaymentInfoDto>.NotFound("Registration not found");

        var isAdmin = await IsAdminAsync(organizerUserId);
        if (unit.Event?.OrganizedByUserId != organizerUserId && !isAdmin)
            return ServiceResult<PaymentInfoDto>.Forbidden();

        var amountDue = (unit.Event?.RegistrationFee ?? 0m) + (unit.Division?.DivisionFee ?? 0m);

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

        if (!string.IsNullOrEmpty(unit.PaymentProofUrl))
            unit.PaymentStatus = "PendingVerification";
        else
            unit.PaymentStatus = "Pending";
        unit.AmountPaid = 0;
        unit.PaidAt = null;
        unit.UpdatedAt = DateTime.Now;

        foreach (var member in unit.Members)
        {
            member.HasPaid = false;
            member.PaidAt = null;
        }

        await _context.SaveChangesAsync();

        return ServiceResult<PaymentInfoDto>.Ok(new PaymentInfoDto
        {
            UnitId = unit.Id,
            PaymentStatus = unit.PaymentStatus,
            AmountPaid = unit.AmountPaid,
            AmountDue = amountDue,
            PaymentProofUrl = unit.PaymentProofUrl,
            PaymentReference = unit.PaymentReference,
            ReferenceId = unit.ReferenceId,
            PaidAt = unit.PaidAt
        }, "Payment unmarked");
    }

    public async Task<ServiceResult<MemberPaymentDto>> MarkMemberAsPaidAsync(int eventId, int unitId, int memberId, int organizerUserId)
    {
        var unit = await _context.EventUnits
            .Include(u => u.Event)
            .Include(u => u.Division)
            .Include(u => u.Members)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return ServiceResult<MemberPaymentDto>.NotFound("Registration not found");

        var isAdmin = await IsAdminAsync(organizerUserId);
        if (unit.Event?.OrganizedByUserId != organizerUserId && !isAdmin)
            return ServiceResult<MemberPaymentDto>.Forbidden();

        var member = unit.Members.FirstOrDefault(m => m.UserId == memberId);
        if (member == null)
            return ServiceResult<MemberPaymentDto>.NotFound("Member not found in unit");

        var memberCount = unit.Members.Count;
        var amountDue = (unit.Event?.RegistrationFee ?? 0m) + (unit.Division?.DivisionFee ?? 0m);
        var perMemberAmount = memberCount > 0 ? amountDue / memberCount : amountDue;
        var referenceId = $"E{eventId}-U{unitId}-P{memberId}";

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
                VerifiedByUserId = organizerUserId,
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
            existingPayment.VerifiedByUserId = organizerUserId;
            existingPayment.VerifiedAt = DateTime.Now;
            existingPayment.IsApplied = true;
            existingPayment.AppliedAt = DateTime.Now;
            existingPayment.UpdatedAt = DateTime.Now;
        }

        member.HasPaid = true;
        member.PaidAt = DateTime.Now;
        member.AmountPaid = perMemberAmount;
        if (string.IsNullOrEmpty(member.ReferenceId))
            member.ReferenceId = referenceId;

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

        var memberUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == memberId);

        return ServiceResult<MemberPaymentDto>.Ok(new MemberPaymentDto
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
        }, "Member marked as paid");
    }

    public async Task<ServiceResult<MemberPaymentDto>> UnmarkMemberPaidAsync(int eventId, int unitId, int memberId, int organizerUserId)
    {
        var unit = await _context.EventUnits
            .Include(u => u.Event)
            .Include(u => u.Division)
            .Include(u => u.Members)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return ServiceResult<MemberPaymentDto>.NotFound("Registration not found");

        var isAdmin = await IsAdminAsync(organizerUserId);
        if (unit.Event?.OrganizedByUserId != organizerUserId && !isAdmin)
            return ServiceResult<MemberPaymentDto>.Forbidden();

        var member = unit.Members.FirstOrDefault(m => m.UserId == memberId);
        if (member == null)
            return ServiceResult<MemberPaymentDto>.NotFound("Member not found in unit");

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

        member.HasPaid = false;
        member.PaidAt = null;
        member.AmountPaid = 0;

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

        var memberUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == memberId);

        return ServiceResult<MemberPaymentDto>.Ok(new MemberPaymentDto
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
        }, "Member payment unmarked");
    }

    public async Task<ServiceResult<object>> ApplyPaymentToTeammatesAsync(int eventId, int unitId, int memberId, int organizerUserId, ApplyPaymentToTeammatesRequest request)
    {
        if (request.TargetMemberIds == null || request.TargetMemberIds.Count == 0)
            return ServiceResult<object>.Fail("No target members specified");

        var unit = await _context.EventUnits
            .Include(u => u.Event)
            .Include(u => u.Division)
            .Include(u => u.Members)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return ServiceResult<object>.NotFound("Registration not found");

        var isAdmin = await IsAdminAsync(organizerUserId);
        if (unit.Event?.OrganizedByUserId != organizerUserId && !isAdmin)
            return ServiceResult<object>.Forbidden();

        var sourceMember = unit.Members.FirstOrDefault(m => m.UserId == memberId);
        if (sourceMember == null)
            return ServiceResult<object>.NotFound("Source member not found");

        if (!sourceMember.HasPaid)
            return ServiceResult<object>.Fail("Source member has not paid yet");

        var acceptedMembers = unit.Members.Where(m => m.InviteStatus == "Accepted").ToList();

        var targetMembers = acceptedMembers
            .Where(m => request.TargetMemberIds.Contains(m.UserId) && m.UserId != memberId && !m.HasPaid)
            .ToList();

        if (targetMembers.Count == 0)
            return ServiceResult<object>.Fail("No valid unpaid teammates to apply payment to");

        var amountDue = (unit.Event?.RegistrationFee ?? 0m) + (unit.Division?.DivisionFee ?? 0m);
        var perMemberAmount = amountDue / acceptedMembers.Count;

        if (request.RedistributeAmount)
            sourceMember.AmountPaid = perMemberAmount;

        var sourcePaymentId = sourceMember.PaymentId;

        var appliedCount = 0;

        foreach (var targetMember in targetMembers)
        {
            targetMember.HasPaid = true;
            targetMember.PaidAt = DateTime.Now;
            targetMember.AmountPaid = perMemberAmount;
            targetMember.PaymentProofUrl = sourceMember.PaymentProofUrl;
            targetMember.PaymentReference = sourceMember.PaymentReference;
            targetMember.ReferenceId = sourceMember.ReferenceId;
            targetMember.PaymentId = sourcePaymentId;

            appliedCount++;
        }

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

        return ServiceResult<object>.Ok(
            new { appliedCount, unitPaymentStatus = unit.PaymentStatus },
            $"Payment applied to {appliedCount} teammate{(appliedCount > 1 ? "s" : "")}"
        );
    }

    public async Task<ServiceResult<MemberPaymentDto>> UpdateMemberPaymentAsync(int eventId, int unitId, int memberId, int organizerUserId, UpdateMemberPaymentRequest request)
    {
        var unit = await _context.EventUnits
            .Include(u => u.Event)
            .Include(u => u.Division)
            .Include(u => u.Members)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return ServiceResult<MemberPaymentDto>.NotFound("Registration not found");

        var isAdmin = await IsAdminAsync(organizerUserId);
        if (unit.Event?.OrganizedByUserId != organizerUserId && !isAdmin)
            return ServiceResult<MemberPaymentDto>.Forbidden();

        var member = unit.Members.FirstOrDefault(m => m.UserId == memberId);
        if (member == null)
            return ServiceResult<MemberPaymentDto>.NotFound("Member not found in unit");

        // Calculate per-member amount for default
        var memberCount = unit.Members.Count(m => m.InviteStatus == "Accepted");
        var amountDue = (unit.Event?.RegistrationFee ?? 0m) + (unit.Division?.DivisionFee ?? 0m);
        var perMemberAmount = memberCount > 0 ? amountDue / memberCount : amountDue;

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

        // Generate reference ID if not provided
        if (string.IsNullOrEmpty(member.ReferenceId))
            member.ReferenceId = $"E{eventId}-U{unitId}-P{memberId}";

        if (request.HasPaid.HasValue)
        {
            var wasNotPaid = !member.HasPaid;
            member.HasPaid = request.HasPaid.Value;

            if (request.HasPaid.Value)
            {
                if (!member.PaidAt.HasValue)
                    member.PaidAt = DateTime.Now;

                // Default amount if not set
                if (member.AmountPaid == 0 && !request.AmountPaid.HasValue)
                    member.AmountPaid = perMemberAmount;

                // CRITICAL FIX: Create or update UserPayment record when marking as paid
                // This ensures the payment shows up in the TD payments tab
                var existingPayment = await _context.UserPayments
                    .FirstOrDefaultAsync(p => p.PaymentType == PaymentTypes.EventRegistration
                        && p.RelatedObjectId == eventId
                        && p.SecondaryObjectId == unitId
                        && p.UserId == memberId);

                if (existingPayment == null)
                {
                    // Create new UserPayment record
                    var userPayment = new UserPayment
                    {
                        UserId = memberId,
                        PaymentType = PaymentTypes.EventRegistration,
                        RelatedObjectId = eventId,
                        SecondaryObjectId = unitId,
                        TertiaryObjectId = member.Id,
                        Description = $"Event registration - {unit.Event?.Name}",
                        Amount = member.AmountPaid,
                        PaymentProofUrl = member.PaymentProofUrl,
                        PaymentReference = member.PaymentReference,
                        PaymentMethod = member.PaymentMethod,
                        ReferenceId = member.ReferenceId,
                        Status = "Verified",
                        VerifiedByUserId = organizerUserId,
                        VerifiedAt = DateTime.Now,
                        Notes = "Added by organizer",
                        IsApplied = true,
                        AppliedAt = DateTime.Now,
                        CreatedAt = DateTime.Now,
                        UpdatedAt = DateTime.Now
                    };
                    _context.UserPayments.Add(userPayment);
                    await _context.SaveChangesAsync();
                    member.PaymentId = userPayment.Id;
                }
                else
                {
                    // Update existing UserPayment record
                    existingPayment.Amount = member.AmountPaid;
                    existingPayment.PaymentProofUrl = member.PaymentProofUrl;
                    existingPayment.PaymentReference = member.PaymentReference;
                    existingPayment.PaymentMethod = member.PaymentMethod;
                    existingPayment.ReferenceId = member.ReferenceId;
                    existingPayment.Status = "Verified";
                    existingPayment.VerifiedByUserId = organizerUserId;
                    existingPayment.VerifiedAt = DateTime.Now;
                    existingPayment.IsApplied = true;
                    existingPayment.AppliedAt = DateTime.Now;
                    existingPayment.UpdatedAt = DateTime.Now;
                    member.PaymentId = existingPayment.Id;
                }
            }
            else
            {
                // Unmarking as paid
                member.PaidAt = null;

                // Update UserPayment status if exists
                var existingPayment = await _context.UserPayments
                    .FirstOrDefaultAsync(p => p.PaymentType == PaymentTypes.EventRegistration
                        && p.RelatedObjectId == eventId
                        && p.SecondaryObjectId == unitId
                        && p.UserId == memberId);

                if (existingPayment != null)
                {
                    existingPayment.Status = !string.IsNullOrEmpty(existingPayment.PaymentProofUrl) ? "PendingVerification" : "Pending";
                    existingPayment.IsApplied = false;
                    existingPayment.AppliedAt = null;
                    existingPayment.VerifiedAt = null;
                    existingPayment.VerifiedByUserId = null;
                    existingPayment.UpdatedAt = DateTime.Now;
                }
            }
        }

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

        var memberUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == memberId);

        return ServiceResult<MemberPaymentDto>.Ok(new MemberPaymentDto
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
        }, "Payment info updated");
    }

    public async Task<ServiceResult<bool>> RemoveRegistrationAsync(int eventId, int unitId, int targetUserId, int currentUserId)
    {
        var evt = await _context.Events.FirstOrDefaultAsync(e => e.Id == eventId && e.IsActive);
        if (evt == null)
            return ServiceResult<bool>.NotFound("Event not found");

        var isAdmin = await IsAdminAsync(currentUserId);
        if (evt.OrganizedByUserId != currentUserId && !isAdmin)
            return ServiceResult<bool>.Forbidden();

        var unit = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(u => u.Id == unitId && u.EventId == eventId);

        if (unit == null)
            return ServiceResult<bool>.NotFound("Unit not found");

        var member = unit.Members.FirstOrDefault(m => m.UserId == targetUserId);
        if (member == null)
            return ServiceResult<bool>.NotFound("Member not found in unit");

        var acceptedMembers = unit.Members.Where(m => m.InviteStatus == "Accepted").ToList();
        var isOnlyMember = acceptedMembers.Count <= 1;
        var memberHasPayment = member.HasPaid || member.AmountPaid > 0 || !string.IsNullOrEmpty(member.PaymentProofUrl);

        if (isOnlyMember)
        {
            if (memberHasPayment)
                return ServiceResult<bool>.Fail("Cannot remove last member with payment records. Cancel payment first or use a different method.");

            try
            {
                var gamePlayers = await _context.EventGamePlayers
                    .Where(p => p.UnitId == unitId)
                    .ToListAsync();
                if (gamePlayers.Any())
                    _context.EventGamePlayers.RemoveRange(gamePlayers);

                var matchPlayers = await _context.EncounterMatchPlayers
                    .Where(p => p.UnitId == unitId)
                    .ToListAsync();
                if (matchPlayers.Any())
                    _context.EncounterMatchPlayers.RemoveRange(matchPlayers);

                var encountersWithUnit = await _context.EventEncounters
                    .Where(e => e.Unit1Id == unitId || e.Unit2Id == unitId)
                    .ToListAsync();
                if (encountersWithUnit.Any())
                    return ServiceResult<bool>.Fail("Cannot remove registration - unit has scheduled matches. Remove matches first or contact administrator.");

                var joinRequests = await _context.EventUnitJoinRequests
                    .Where(jr => jr.UnitId == unitId)
                    .ToListAsync();
                if (joinRequests.Any())
                    _context.EventUnitJoinRequests.RemoveRange(joinRequests);

                _context.EventUnitMembers.RemoveRange(unit.Members);
                _context.EventUnits.Remove(unit);

                await _context.SaveChangesAsync();
                return ServiceResult<bool>.Ok(true, "Registration cancelled");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing registration for unit {UnitId} in event {EventId}", unitId, eventId);
                return ServiceResult<bool>.ServerError("Failed to remove registration due to database constraints. The unit may have related records (games, matches) that need to be removed first.");
            }
        }
        else
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

            if (unit.CaptainUserId == targetUserId)
            {
                var newCaptain = acceptedMembers.FirstOrDefault(m => m.UserId != targetUserId);
                if (newCaptain != null)
                {
                    unit.CaptainUserId = newCaptain.UserId;
                    newCaptain.Role = "Captain";
                }
            }

            var remainingMembers = acceptedMembers.Where(m => m.UserId != targetUserId).ToList();
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

            await UpdateUnitDisplayNameAsync(unit.Id);
            await UpdateUnitDisplayNameAsync(newUnit.Id);
            await _context.SaveChangesAsync();

            return ServiceResult<bool>.Ok(true, $"{memberName} now has their own registration");
        }
    }

    public async Task<ServiceResult<EventPaymentSummaryDto>> GetEventPaymentSummaryAsync(int eventId, int userId, PaymentSummaryFilterRequest? filter = null)
    {
        var evt = await _context.Events
            .Include(e => e.Divisions)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return ServiceResult<EventPaymentSummaryDto>.NotFound("Event not found");

        if (evt.OrganizedByUserId != userId && !await IsAdminAsync(userId))
            return ServiceResult<EventPaymentSummaryDto>.Forbidden();

        var units = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
            .Where(u => u.EventId == eventId && u.Status != "Cancelled")
            .OrderBy(u => u.Division != null ? u.Division.Name : "")
            .ThenBy(u => u.Name)
            .ToListAsync();

        // Build payments query with filters
        IQueryable<UserPayment> paymentsQuery = _context.UserPayments
            .Include(p => p.User)
            .Where(p => p.PaymentType == PaymentTypes.EventRegistration && p.RelatedObjectId == eventId);

        // Apply filters
        if (filter != null)
        {
            // Filter by payment status
            if (!string.IsNullOrEmpty(filter.PaymentStatus))
            {
                paymentsQuery = paymentsQuery.Where(p => p.Status == filter.PaymentStatus);
            }

            // Filter by payment method
            if (!string.IsNullOrEmpty(filter.PaymentMethod))
            {
                paymentsQuery = paymentsQuery.Where(p => p.PaymentMethod == filter.PaymentMethod);
            }

            // Filter by player name (search in User's first name or last name)
            if (!string.IsNullOrEmpty(filter.SearchName))
            {
                var searchTerm = filter.SearchName.ToLower();
                paymentsQuery = paymentsQuery.Where(p =>
                    (p.User != null && p.User.FirstName != null && p.User.FirstName.ToLower().Contains(searchTerm)) ||
                    (p.User != null && p.User.LastName != null && p.User.LastName.ToLower().Contains(searchTerm)));
            }

            // Filter by division - need to join through units
            if (filter.DivisionId.HasValue)
            {
                var unitIdsInDivision = units
                    .Where(u => u.DivisionId == filter.DivisionId.Value)
                    .Select(u => u.Id)
                    .ToHashSet();

                paymentsQuery = paymentsQuery.Where(p => p.SecondaryObjectId.HasValue && unitIdsInDivision.Contains(p.SecondaryObjectId.Value));
            }
        }

        var payments = await paymentsQuery
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        // Filter units based on filter criteria (for division summary)
        var filteredUnits = units.ToList();
        if (filter != null)
        {
            // Filter units by division
            if (filter.DivisionId.HasValue)
            {
                filteredUnits = filteredUnits.Where(u => u.DivisionId == filter.DivisionId.Value).ToList();
            }

            // Filter units by payment status
            if (!string.IsNullOrEmpty(filter.PaymentStatus))
            {
                // Map payment status filter to unit payment statuses
                var statusFilter = filter.PaymentStatus;
                if (statusFilter == "Verified" || statusFilter == "Paid")
                    filteredUnits = filteredUnits.Where(u => u.PaymentStatus == "Paid").ToList();
                else if (statusFilter == "Pending")
                    filteredUnits = filteredUnits.Where(u => u.PaymentStatus == "Pending" || u.PaymentStatus == "PendingVerification").ToList();
                else if (statusFilter == "PendingVerification")
                    filteredUnits = filteredUnits.Where(u => u.PaymentStatus == "PendingVerification").ToList();
                else if (statusFilter == "Partial")
                    filteredUnits = filteredUnits.Where(u => u.PaymentStatus == "Partial").ToList();
            }

            // Filter units by player name search
            if (!string.IsNullOrEmpty(filter.SearchName))
            {
                var searchTerm = filter.SearchName.ToLower();
                filteredUnits = filteredUnits.Where(u =>
                    u.Members.Any(m =>
                        (m.User?.FirstName?.ToLower().Contains(searchTerm) ?? false) ||
                        (m.User?.LastName?.ToLower().Contains(searchTerm) ?? false)
                    )
                ).ToList();
            }

            // Filter units by payment method
            if (!string.IsNullOrEmpty(filter.PaymentMethod))
            {
                filteredUnits = filteredUnits.Where(u =>
                    u.Members.Any(m => m.PaymentMethod == filter.PaymentMethod)
                ).ToList();
            }
        }

        // Build division summaries using filtered units
        var divisionsToInclude = filter?.DivisionId.HasValue == true
            ? evt.Divisions.Where(d => d.Id == filter.DivisionId.Value)
            : evt.Divisions;

        var divisionPayments = new List<DivisionPaymentSummaryDto>();
        foreach (var division in divisionsToInclude.OrderBy(d => d.Name))
        {
            var divUnits = filteredUnits.Where(u => u.DivisionId == division.Id).ToList();
            var divPayment = new DivisionPaymentSummaryDto
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

            divPayment.UnitsFullyPaid = divPayment.Units.Count(u => u.PaymentStatus == "Paid" || u.AmountPaid >= u.AmountDue);
            divPayment.UnitsPartiallyPaid = divPayment.Units.Count(u =>
                u.PaymentStatus != "Paid" && u.AmountPaid > 0 && u.AmountPaid < u.AmountDue);
            divPayment.UnitsUnpaid = divPayment.Units.Count(u => u.AmountPaid == 0);
            divPayment.IsBalanced = Math.Abs(divPayment.TotalPaid - divPayment.TotalExpected) < 0.01m;

            divisionPayments.Add(divPayment);
        }

        var allMembersWithPayments = await _context.EventUnitMembers
            .Include(m => m.User)
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Division)
            .Where(m => m.Unit!.EventId == eventId && m.PaymentId != null)
            .ToListAsync();

        var paymentRecords = new List<PaymentRecordDto>();
        foreach (var p in payments)
        {
            var appliedMembers = allMembersWithPayments
                .Where(m => m.PaymentId == p.Id)
                .Select(m => new PaymentApplicationDto
                {
                    UserId = m.UserId,
                    MemberId = m.Id,
                    UserName = Utility.FormatName(m.User?.LastName, m.User?.FirstName) ?? "",
                    AmountApplied = m.AmountPaid,
                    DivisionName = m.Unit?.Division?.Name,
                    UnitName = m.Unit?.Name
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

        var summary = new EventPaymentSummaryDto
        {
            EventId = eventId,
            EventName = evt.Name,
            RegistrationFee = evt.RegistrationFee,
            TotalUnits = filteredUnits.Count,
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

        return ServiceResult<EventPaymentSummaryDto>.Ok(summary);
    }

    public async Task<ServiceResult<bool>> VerifyPaymentAsync(int paymentId, int userId)
    {
        var payment = await _context.UserPayments
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == paymentId);

        if (payment == null)
            return ServiceResult<bool>.NotFound("Payment not found");

        if (payment.PaymentType == PaymentTypes.EventRegistration && payment.RelatedObjectId.HasValue)
        {
            var evt = await _context.Events.FindAsync(payment.RelatedObjectId.Value);
            if (evt == null)
                return ServiceResult<bool>.NotFound("Event not found");

            if (evt.OrganizedByUserId != userId && !await IsAdminAsync(userId))
                return ServiceResult<bool>.Forbidden();
        }
        else if (!await IsAdminAsync(userId))
        {
            return ServiceResult<bool>.Forbidden();
        }

        payment.Status = "Verified";
        payment.VerifiedByUserId = userId;
        payment.VerifiedAt = DateTime.Now;
        payment.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return ServiceResult<bool>.Ok(true, "Payment verified");
    }

    public async Task<ServiceResult<bool>> UnverifyPaymentAsync(int paymentId, int userId)
    {
        var payment = await _context.UserPayments
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == paymentId);

        if (payment == null)
            return ServiceResult<bool>.NotFound("Payment not found");

        if (payment.PaymentType == PaymentTypes.EventRegistration && payment.RelatedObjectId.HasValue)
        {
            var evt = await _context.Events.FindAsync(payment.RelatedObjectId.Value);
            if (evt == null)
                return ServiceResult<bool>.NotFound("Event not found");

            if (evt.OrganizedByUserId != userId && !await IsAdminAsync(userId))
                return ServiceResult<bool>.Forbidden();
        }
        else if (!await IsAdminAsync(userId))
        {
            return ServiceResult<bool>.Forbidden();
        }

        payment.Status = "Pending";
        payment.VerifiedByUserId = null;
        payment.VerifiedAt = null;
        payment.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return ServiceResult<bool>.Ok(true, "Payment verification removed");
    }

    // ============================================
    // Private Helpers
    // ============================================

    private async Task<bool> IsAdminAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        return user?.Role == "Admin";
    }

    private async Task<bool> CanManageEventAsync(int eventId, int userId)
    {
        if (await IsAdminAsync(userId)) return true;
        var evt = await _context.Events.FindAsync(eventId);
        if (evt?.OrganizedByUserId == userId) return true;

        var staff = await _context.EventStaff
            .Include(s => s.Role)
            .FirstOrDefaultAsync(s => s.EventId == eventId
                                   && s.UserId == userId
                                   && s.Status == "Active"
                                   && s.Role != null
                                   && s.Role.CanFullyManageEvent);
        return staff != null;
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
                unit.Name = Utility.FormatName(player.LastName, player.FirstName);
            return;
        }

        if (teamSize > 2)
        {
            if (string.IsNullOrEmpty(unit.Name))
            {
                var captain = unit.Members.FirstOrDefault(m => m.Role == "Captain")?.User ?? unit.Captain;
                if (captain != null) unit.Name = $"{captain.FirstName}'s team";
            }
            return;
        }

        if (unit.HasCustomName) return;

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
}
