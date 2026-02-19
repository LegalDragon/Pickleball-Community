using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Constants;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Services;
using Pickleball.Community.Controllers.Base;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("tournament")]
public class TournamentPaymentController : EventControllerBase
{
    private readonly ILogger<TournamentPaymentController> _logger;
    private readonly IEmailNotificationService _emailService;
    private readonly ITournamentPaymentService _paymentService;
    private readonly ITournamentFeeService _feeService;

    public TournamentPaymentController(
        ApplicationDbContext context,
        ILogger<TournamentPaymentController> logger,
        IEmailNotificationService emailService,
        ITournamentPaymentService paymentService,
        ITournamentFeeService feeService)
        : base(context)
    {
        _logger = logger;
        _emailService = emailService;
        _paymentService = paymentService;
        _feeService = feeService;
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
        var canManage = await CanManagePaymentsAsync(unit.EventId);

        if (!isMember && !canManage)
            return Forbid();

        // Determine which members to apply payment to
        // If MemberIds provided, use those; otherwise just the submitting user
        var acceptedMembers = unit.Members.Where(m => m.InviteStatus == "Accepted").ToList();
        var allMembers = unit.Members.ToList();
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
            // First try accepted members, then fall back to any member (they may have just registered)
            var submitterMember = acceptedMembers.FirstOrDefault(m => m.UserId == userId.Value);
            if (submitterMember == null)
            {
                // Try to find in all members - the user who registered should be able to pay
                submitterMember = allMembers.FirstOrDefault(m => m.UserId == userId.Value);
                if (submitterMember != null && submitterMember.InviteStatus != "Accepted")
                {
                    // Auto-accept the member since they're paying for their own registration
                    submitterMember.InviteStatus = "Accepted";
                }
            }
            membersToPayFor = submitterMember != null ? new List<EventUnitMember> { submitterMember } : new List<EventUnitMember>();
        }

        if (membersToPayFor.Count == 0)
        {
            return BadRequest(new ApiResponse<PaymentInfoDto> { Success = false, Message = "No members to apply payment to. Please ensure you are a registered member of this unit." });
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

        // Check if registration is now complete (waiver signed AND payment submitted)
        // Send registration complete email if so
        try
        {
            var payingMember = membersToPayFor.FirstOrDefault(m => m.UserId == userId.Value) ?? membersToPayFor.First();
            var payingUser = await _context.Users.FindAsync(payingMember.UserId);

            if (payingUser?.Email != null)
            {
                // Check if waiver is signed (check ObjectAssets for waivers)
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
                    // Both waiver and payment complete - send registration complete email
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

        // Check authorization - allow organizer, admin, or staff with payment permissions
        if (!await CanManagePaymentsAsync(eventId))
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

        // Check authorization - allow organizer, admin, or staff with payment permissions
        if (!await CanManagePaymentsAsync(eventId))
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

        // Check authorization - allow organizer, admin, or staff with payment permissions
        if (!await CanManagePaymentsAsync(eventId))
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

        // Check authorization - allow organizer, admin, or staff with payment permissions
        if (!await CanManagePaymentsAsync(eventId))
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

        // Check authorization - allow organizer, admin, or staff with payment permissions
        if (!await CanManagePaymentsAsync(eventId))
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

        // Check authorization - allow organizer, admin, or staff with payment permissions
        if (!await CanManagePaymentsAsync(eventId))
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

    // ==================== Payment Verification ====================

    /// <summary>
    /// Get payment summary for an event (organizer/admin only)
    /// Supports filtering by player name, payment status, division, and payment method
    /// </summary>
    [HttpGet("events/{eventId}/payment-summary")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<EventPaymentSummaryDto>>> GetEventPaymentSummary(
        int eventId,
        [FromQuery] string? searchName = null,
        [FromQuery] string? paymentStatus = null,
        [FromQuery] int? divisionId = null,
        [FromQuery] string? paymentMethod = null)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<EventPaymentSummaryDto> { Success = false, Message = "Unauthorized" });

        // Check authorization - allow organizer, admin, or staff with payment permissions
        if (!await CanManagePaymentsAsync(eventId))
            return Forbid();

        // Build filter request
        PaymentSummaryFilterRequest? filter = null;
        if (!string.IsNullOrEmpty(searchName) || !string.IsNullOrEmpty(paymentStatus) ||
            divisionId.HasValue || !string.IsNullOrEmpty(paymentMethod))
        {
            filter = new PaymentSummaryFilterRequest
            {
                SearchName = searchName,
                PaymentStatus = paymentStatus,
                DivisionId = divisionId,
                PaymentMethod = paymentMethod
            };
        }

        var result = await _paymentService.GetEventPaymentSummaryAsync(eventId, userId.Value, filter);

        if (!result.Success)
        {
            if (result.StatusCode == 404)
                return NotFound(new ApiResponse<EventPaymentSummaryDto> { Success = false, Message = result.Message });
            if (result.StatusCode == 403)
                return Forbid();
            return BadRequest(new ApiResponse<EventPaymentSummaryDto> { Success = false, Message = result.Message });
        }

        return Ok(new ApiResponse<EventPaymentSummaryDto> { Success = true, Data = result.Data });
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
            // Check authorization - allow organizer, admin, or staff with payment permissions
            if (!await CanManagePaymentsAsync(payment.RelatedObjectId.Value))
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

        // Check authorization - allow organizer, admin, or staff with payment permissions
        if (payment.PaymentType == PaymentTypes.EventRegistration && payment.RelatedObjectId.HasValue)
        {
            if (!await CanManagePaymentsAsync(payment.RelatedObjectId.Value))
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

    /// <summary>
    /// Update payment proof on a UserPayment record (organizer/admin only)
    /// </summary>
    [HttpPut("payments/{paymentId}/proof")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> UpdatePaymentProof(int paymentId, [FromBody] UpdatePaymentProofRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Unauthorized" });

        var payment = await _context.UserPayments
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == paymentId);

        if (payment == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Payment not found" });

        // Check authorization - allow organizer, admin, or staff with payment permissions
        if (payment.PaymentType == PaymentTypes.EventRegistration && payment.RelatedObjectId.HasValue)
        {
            if (!await CanManagePaymentsAsync(payment.RelatedObjectId.Value))
                return Forbid();
        }
        else if (!await IsAdminAsync())
        {
            return Forbid();
        }

        // Update fields
        if (request.PaymentProofUrl != null)
            payment.PaymentProofUrl = request.PaymentProofUrl;
        if (request.PaymentReference != null)
            payment.PaymentReference = request.PaymentReference;
        if (request.PaymentMethod != null)
            payment.PaymentMethod = request.PaymentMethod;
        if (request.Notes != null)
            payment.Notes = request.Notes;

        // Auto-update status if proof is uploaded and status is Pending
        if (!string.IsNullOrEmpty(request.PaymentProofUrl) && payment.Status == "Pending")
            payment.Status = "PendingVerification";

        payment.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Payment proof updated" });
    }

    /// <summary>
    /// Get registrations that a payment can be applied to.
    /// By default returns payer's registrations. Use includeAllPlayers=true to get all event registrations.
    /// Use search parameter to filter by player name.
    /// </summary>
    [HttpGet("payments/{paymentId}/applicable-registrations")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> GetApplicableRegistrations(
        int paymentId,
        [FromQuery] bool includeAllPlayers = false,
        [FromQuery] string? search = null)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        var payment = await _context.UserPayments
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == paymentId);

        if (payment == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Payment not found" });

        // Must be event registration payment
        if (payment.PaymentType != PaymentTypes.EventRegistration || !payment.RelatedObjectId.HasValue)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Payment is not for event registration" });

        var eventId = payment.RelatedObjectId.Value;

        // Check authorization
        if (!await CanManagePaymentsAsync(eventId))
            return Forbid();

        // Build query for registrations
        var query = _context.EventUnitMembers
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Division)
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Event)
            .Include(m => m.User)
            .Where(m => m.Unit!.EventId == eventId && m.Unit.Status != "Cancelled" && m.InviteStatus == "Accepted");

        // Filter by payer only if not including all players
        if (!includeAllPlayers)
        {
            query = query.Where(m => m.UserId == payment.UserId);
        }

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(m => 
                (m.User != null && m.User.FirstName != null && m.User.FirstName.ToLower().Contains(searchLower)) ||
                (m.User != null && m.User.LastName != null && m.User.LastName.ToLower().Contains(searchLower)));
        }

        var registrations = await query
            .OrderBy(m => m.User!.LastName)
            .ThenBy(m => m.User!.FirstName)
            .Select(m => new {
                MemberId = m.Id,
                m.UserId,
                UserName = Utility.FormatName(m.User!.LastName, m.User.FirstName),
                UnitId = m.UnitId,
                UnitName = m.Unit!.Name,
                DivisionId = m.Unit.DivisionId,
                DivisionName = m.Unit.Division != null ? m.Unit.Division.Name : null,
                AmountDue = (m.Unit.Event!.RegistrationFee + (m.Unit.Division != null ? m.Unit.Division.DivisionFee ?? 0 : 0)) / m.Unit.Members.Count(x => x.InviteStatus == "Accepted"),
                m.HasPaid,
                m.AmountPaid,
                m.PaymentId,
                AlreadyLinkedToThisPayment = m.PaymentId == paymentId,
                IsPayerRegistration = m.UserId == payment.UserId
            })
            .ToListAsync();

        // Calculate how much of this payment is already applied
        var alreadyApplied = await _context.EventUnitMembers
            .Where(m => m.PaymentId == paymentId)
            .SumAsync(m => m.AmountPaid);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Data = new
            {
                payment = new
                {
                    payment.Id,
                    payment.UserId,
                    PayerName = Utility.FormatName(payment.User?.LastName, payment.User?.FirstName),
                    payment.Amount,
                    AlreadyApplied = alreadyApplied,
                    Remaining = payment.Amount - alreadyApplied
                },
                registrations = registrations
            }
        });
    }

    /// <summary>
    /// Apply a payment to one or more registrations
    /// </summary>
    [HttpPost("payments/{paymentId}/apply")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> ApplyPaymentToRegistrations(
        int paymentId,
        [FromBody] ApplyPaymentRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        if (request.MemberIds == null || request.MemberIds.Count == 0)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "No registrations selected" });

        var payment = await _context.UserPayments
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == paymentId);

        if (payment == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Payment not found" });

        // Must be event registration payment
        if (payment.PaymentType != PaymentTypes.EventRegistration || !payment.RelatedObjectId.HasValue)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Payment is not for event registration" });

        var eventId = payment.RelatedObjectId.Value;

        // Check authorization
        if (!await CanManagePaymentsAsync(eventId))
            return Forbid();

        // Get members to apply payment to
        var members = await _context.EventUnitMembers
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Division)
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Event)
            .Where(m => request.MemberIds.Contains(m.Id) && m.Unit!.EventId == eventId)
            .ToListAsync();

        if (members.Count == 0)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "No valid registrations found" });

        // Calculate amount per member (or use custom amounts if provided)
        var amountsApplied = new List<(int memberId, decimal amount)>();
        
        foreach (var member in members)
        {
            // Calculate per-member fee
            var unitMemberCount = await _context.EventUnitMembers
                .CountAsync(m => m.UnitId == member.UnitId && m.InviteStatus == "Accepted");
            var totalFee = (member.Unit!.Event!.RegistrationFee + (member.Unit.Division?.DivisionFee ?? 0));
            var perMemberFee = unitMemberCount > 0 ? totalFee / unitMemberCount : totalFee;

            // Use custom amount if provided, otherwise use per-member fee
            var amountToApply = request.CustomAmounts?.ContainsKey(member.Id) == true
                ? request.CustomAmounts[member.Id]
                : perMemberFee;

            // Update member
            member.HasPaid = true;
            member.PaidAt = DateTime.UtcNow;
            member.AmountPaid = amountToApply;
            member.PaymentId = paymentId;
            member.PaymentProofUrl = payment.PaymentProofUrl;
            member.PaymentReference = payment.PaymentReference;
            member.PaymentMethod = payment.PaymentMethod;
            member.ReferenceId = payment.ReferenceId;

            amountsApplied.Add((member.Id, amountToApply));

            // Update unit payment status
            var allUnitMembers = await _context.EventUnitMembers
                .Where(m => m.UnitId == member.UnitId && m.InviteStatus == "Accepted")
                .ToListAsync();
            var allPaid = allUnitMembers.All(m => m.HasPaid);
            var anyPaid = allUnitMembers.Any(m => m.HasPaid);
            var totalPaidInUnit = allUnitMembers.Sum(m => m.AmountPaid);

            member.Unit.AmountPaid = totalPaidInUnit;
            if (allPaid && totalPaidInUnit >= totalFee)
            {
                member.Unit.PaymentStatus = "Paid";
                member.Unit.PaidAt = DateTime.UtcNow;
            }
            else if (anyPaid)
            {
                member.Unit.PaymentStatus = "Partial";
            }
            member.Unit.UpdatedAt = DateTime.UtcNow;
        }

        // Update payment record
        payment.IsApplied = true;
        payment.AppliedAt = DateTime.UtcNow;
        payment.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var totalApplied = amountsApplied.Sum(a => a.amount);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Data = new
            {
                appliedCount = members.Count,
                totalApplied,
                applications = amountsApplied.Select(a => new { memberId = a.memberId, amount = a.amount })
            },
            Message = $"Payment applied to {members.Count} registration(s)"
        });
    }

    /// <summary>
    /// Remove payment application from one or more registrations
    /// </summary>
    [HttpPost("payments/{paymentId}/unapply")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> UnapplyPaymentFromRegistrations(
        int paymentId,
        [FromBody] UnapplyPaymentRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        if (request.MemberIds == null || request.MemberIds.Count == 0)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "No registrations selected" });

        var payment = await _context.UserPayments
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == paymentId);

        if (payment == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Payment not found" });

        // Must be event registration payment
        if (payment.PaymentType != PaymentTypes.EventRegistration || !payment.RelatedObjectId.HasValue)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Payment is not for event registration" });

        var eventId = payment.RelatedObjectId.Value;

        // Check authorization
        if (!await CanManagePaymentsAsync(eventId))
            return Forbid();

        // Get members to remove payment application from
        var members = await _context.EventUnitMembers
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Division)
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Event)
            .Where(m => request.MemberIds.Contains(m.Id) && m.PaymentId == paymentId)
            .ToListAsync();

        if (members.Count == 0)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "No valid registrations found linked to this payment" });

        var removedCount = 0;

        foreach (var member in members)
        {
            // Clear payment info from member
            member.HasPaid = false;
            member.PaidAt = null;
            member.AmountPaid = 0;
            member.PaymentId = null;
            // Keep PaymentProofUrl, PaymentReference, PaymentMethod, ReferenceId for records

            removedCount++;

            // Update unit payment status
            var allUnitMembers = await _context.EventUnitMembers
                .Where(m => m.UnitId == member.UnitId && m.InviteStatus == "Accepted")
                .ToListAsync();
            var allPaid = allUnitMembers.All(m => m.HasPaid);
            var anyPaid = allUnitMembers.Any(m => m.HasPaid);
            var totalPaidInUnit = allUnitMembers.Sum(m => m.AmountPaid);

            var totalFee = (member.Unit!.Event!.RegistrationFee + (member.Unit.Division?.DivisionFee ?? 0));

            member.Unit.AmountPaid = totalPaidInUnit;
            if (allPaid && totalPaidInUnit >= totalFee)
            {
                member.Unit.PaymentStatus = "Paid";
            }
            else if (anyPaid)
            {
                member.Unit.PaymentStatus = "Partial";
                member.Unit.PaidAt = null;
            }
            else
            {
                member.Unit.PaymentStatus = "Pending";
                member.Unit.PaidAt = null;
            }
            member.Unit.UpdatedAt = DateTime.UtcNow;
        }

        // Update payment record - check if still applied anywhere
        var stillLinkedCount = await _context.EventUnitMembers
            .CountAsync(m => m.PaymentId == paymentId);

        if (stillLinkedCount == 0)
        {
            payment.IsApplied = false;
            payment.AppliedAt = null;
        }
        payment.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Data = new { removedCount },
            Message = $"Payment removed from {removedCount} registration(s)"
        });
    }


    // ============================================
    // Division Fee Management
    // ============================================
    #region Division Fees

    /// <summary>
    /// Get all fees for a division (fees with DivisionId matching the division)
    /// </summary>
    [HttpGet("divisions/{divisionId}/fees")]
    public async Task<ActionResult<ApiResponse<List<DivisionFeeDto>>>> GetDivisionFees(int divisionId)
    {
        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return NotFound(new ApiResponse<List<DivisionFeeDto>> { Success = false, Message = "Division not found" });

        var fees = await _context.DivisionFees
            .Include(f => f.FeeType)
            .Where(f => f.DivisionId == divisionId)
            .OrderBy(f => f.SortOrder)
            .ToListAsync();

        var result = fees.Select(f => new DivisionFeeDto
        {
            Id = f.Id,
            DivisionId = f.DivisionId,
            EventId = f.EventId,
            FeeTypeId = f.FeeTypeId,
            Name = f.FeeType?.Name ?? "",
            Description = f.FeeType?.Description,
            Amount = f.Amount,
            IsDefault = f.IsDefault,
            AvailableFrom = f.AvailableFrom,
            AvailableUntil = f.AvailableUntil,
            IsActive = f.IsActive,
            SortOrder = f.SortOrder,
            IsCurrentlyAvailable = f.IsCurrentlyAvailable
        }).ToList();

        return Ok(new ApiResponse<List<DivisionFeeDto>> { Success = true, Data = result });
    }

    /// <summary>
    /// Create a new fee for a division (requires FeeTypeId)
    /// </summary>
    [HttpPost("divisions/{divisionId}/fees")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<DivisionFeeDto>>> CreateDivisionFee(int divisionId, [FromBody] DivisionFeeRequest request)
    {
        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return NotFound(new ApiResponse<DivisionFeeDto> { Success = false, Message = "Division not found" });

        // Check authorization
        if (!await CanManagePaymentsAsync(division.EventId))
            return Forbid();

        // Validate FeeTypeId
        var feeType = await _context.EventFeeTypes
            .FirstOrDefaultAsync(ft => ft.Id == request.FeeTypeId && ft.EventId == division.EventId);
        if (feeType == null)
            return BadRequest(new ApiResponse<DivisionFeeDto> { Success = false, Message = "Fee type not found for this event" });

        // Check if fee already exists for this fee type in this division
        var existingFee = await _context.DivisionFees
            .FirstOrDefaultAsync(f => f.DivisionId == divisionId && f.FeeTypeId == request.FeeTypeId);
        if (existingFee != null)
            return BadRequest(new ApiResponse<DivisionFeeDto> { Success = false, Message = "A fee already exists for this fee type in this division" });

        // If this is set as default, clear other defaults
        if (request.IsDefault)
        {
            var existingDefaults = await _context.DivisionFees
                .Where(f => f.DivisionId == divisionId && f.IsDefault)
                .ToListAsync();
            foreach (var existing in existingDefaults)
            {
                existing.IsDefault = false;
            }
        }

        var fee = new DivisionFee
        {
            DivisionId = divisionId,
            EventId = division.EventId,
            FeeTypeId = request.FeeTypeId,
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
            EventId = fee.EventId,
            FeeTypeId = fee.FeeTypeId,
            Name = feeType.Name,
            Description = feeType.Description,
            Amount = fee.Amount,
            IsDefault = fee.IsDefault,
            AvailableFrom = fee.AvailableFrom,
            AvailableUntil = fee.AvailableUntil,
            IsActive = fee.IsActive,
            SortOrder = fee.SortOrder,
            IsCurrentlyAvailable = fee.IsCurrentlyAvailable
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
            .Include(f => f.FeeType)
            .FirstOrDefaultAsync(f => f.Id == feeId && f.DivisionId == divisionId);

        if (fee == null)
            return NotFound(new ApiResponse<DivisionFeeDto> { Success = false, Message = "Fee not found" });

        // Check authorization
        if (!await CanManagePaymentsAsync(fee.EventId))
            return Forbid();

        // Validate FeeTypeId if being changed
        EventFeeType? feeType = fee.FeeType;
        if (request.FeeTypeId != fee.FeeTypeId)
        {
            feeType = await _context.EventFeeTypes
                .FirstOrDefaultAsync(ft => ft.Id == request.FeeTypeId && ft.EventId == fee.EventId);
            if (feeType == null)
                return BadRequest(new ApiResponse<DivisionFeeDto> { Success = false, Message = "Fee type not found for this event" });
        }

        // If this is set as default, clear other defaults
        if (request.IsDefault && !fee.IsDefault)
        {
            var existingDefaults = await _context.DivisionFees
                .Where(f => f.DivisionId == divisionId && f.IsDefault && f.Id != feeId)
                .ToListAsync();
            foreach (var existing in existingDefaults)
            {
                existing.IsDefault = false;
            }
        }

        fee.FeeTypeId = request.FeeTypeId;
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
            EventId = fee.EventId,
            FeeTypeId = fee.FeeTypeId,
            Name = feeType?.Name ?? "",
            Description = feeType?.Description,
            Amount = fee.Amount,
            IsDefault = fee.IsDefault,
            AvailableFrom = fee.AvailableFrom,
            AvailableUntil = fee.AvailableUntil,
            IsActive = fee.IsActive,
            SortOrder = fee.SortOrder,
            IsCurrentlyAvailable = fee.IsCurrentlyAvailable
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
            .FirstOrDefaultAsync(f => f.Id == feeId && f.DivisionId == divisionId);

        if (fee == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Fee not found" });

        // Check authorization
        if (!await CanManagePaymentsAsync(fee.EventId))
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
    /// Bulk update division fees (replaces all fees for a division).
    /// Each request must have a valid FeeTypeId.
    /// </summary>
    [HttpPut("divisions/{divisionId}/fees")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<DivisionFeeDto>>>> BulkUpdateDivisionFees(int divisionId, [FromBody] List<DivisionFeeRequest> fees)
    {
        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return NotFound(new ApiResponse<List<DivisionFeeDto>> { Success = false, Message = "Division not found" });

        // Check authorization
        if (!await CanManagePaymentsAsync(division.EventId))
            return Forbid();

        // Validate all FeeTypeIds
        var feeTypeIds = fees.Select(f => f.FeeTypeId).Distinct().ToList();
        var validFeeTypes = await _context.EventFeeTypes
            .Where(ft => ft.EventId == division.EventId && feeTypeIds.Contains(ft.Id))
            .ToDictionaryAsync(ft => ft.Id, ft => ft);

        var invalidIds = feeTypeIds.Where(id => !validFeeTypes.ContainsKey(id)).ToList();
        if (invalidIds.Any())
            return BadRequest(new ApiResponse<List<DivisionFeeDto>> { Success = false, Message = $"Invalid fee type IDs: {string.Join(", ", invalidIds)}" });

        // Get existing fees for this division
        var existingFees = await _context.DivisionFees
            .Where(f => f.DivisionId == divisionId)
            .ToListAsync();

        // Check if any existing fees are in use
        var existingFeeIds = existingFees.Select(f => f.Id).ToList();
        var usedByMembers = await _context.EventUnitMembers
            .AnyAsync(m => m.SelectedFeeId != null && existingFeeIds.Contains(m.SelectedFeeId.Value));

        if (usedByMembers)
            return BadRequest(new ApiResponse<List<DivisionFeeDto>> { Success = false, Message = "Cannot replace fees that are in use by existing registrations. Please update individual fees instead." });

        // Remove existing fees
        _context.DivisionFees.RemoveRange(existingFees);

        // Ensure only one default
        var hasDefault = false;
        var newFees = fees.Select((f, index) => {
            var isDefault = f.IsDefault && !hasDefault;
            if (isDefault) hasDefault = true;
            return new DivisionFee
            {
                DivisionId = divisionId,
                EventId = division.EventId,
                FeeTypeId = f.FeeTypeId,
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
            EventId = f.EventId,
            FeeTypeId = f.FeeTypeId,
            Name = validFeeTypes[f.FeeTypeId].Name,
            Description = validFeeTypes[f.FeeTypeId].Description,
            Amount = f.Amount,
            IsDefault = f.IsDefault,
            AvailableFrom = f.AvailableFrom,
            AvailableUntil = f.AvailableUntil,
            IsActive = f.IsActive,
            SortOrder = f.SortOrder,
            IsCurrentlyAvailable = f.IsCurrentlyAvailable
        }).ToList();

        return Ok(new ApiResponse<List<DivisionFeeDto>> { Success = true, Data = result });
    }

    #endregion

    #region Event Fees

    /// <summary>
    /// Get all event-level fees for an event (DivisionId = 0)
    /// </summary>
    [HttpGet("events/{eventId}/fees")]
    public async Task<ActionResult<ApiResponse<List<DivisionFeeDto>>>> GetEventFees(int eventId)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<List<DivisionFeeDto>> { Success = false, Message = "Event not found" });

        var fees = await _context.DivisionFees
            .Include(f => f.FeeType)
            .Where(f => f.EventId == eventId && f.DivisionId == 0)
            .OrderBy(f => f.SortOrder)
            .ToListAsync();

        var result = fees.Select(f => new DivisionFeeDto
        {
            Id = f.Id,
            DivisionId = f.DivisionId,
            EventId = f.EventId,
            FeeTypeId = f.FeeTypeId,
            Name = f.FeeType?.Name ?? "",
            Description = f.FeeType?.Description,
            Amount = f.Amount,
            IsDefault = f.IsDefault,
            AvailableFrom = f.AvailableFrom,
            AvailableUntil = f.AvailableUntil,
            IsActive = f.IsActive,
            SortOrder = f.SortOrder,
            IsCurrentlyAvailable = f.IsCurrentlyAvailable
        }).ToList();

        return Ok(new ApiResponse<List<DivisionFeeDto>> { Success = true, Data = result });
    }

    /// <summary>
    /// Create a new event-level fee (DivisionId = 0, requires FeeTypeId)
    /// </summary>
    [HttpPost("events/{eventId}/fees")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<DivisionFeeDto>>> CreateEventFee(int eventId, [FromBody] DivisionFeeRequest request)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<DivisionFeeDto> { Success = false, Message = "Event not found" });

        // Check authorization
        if (!await CanManagePaymentsAsync(eventId))
            return Forbid();

        // Validate FeeTypeId exists and belongs to this event
        var feeType = await _context.EventFeeTypes
            .FirstOrDefaultAsync(ft => ft.Id == request.FeeTypeId && ft.EventId == eventId);
        if (feeType == null)
            return BadRequest(new ApiResponse<DivisionFeeDto> { Success = false, Message = "Fee type not found for this event" });

        // Check if fee already exists for this fee type at event level
        var existingFee = await _context.DivisionFees
            .FirstOrDefaultAsync(f => f.EventId == eventId && f.DivisionId == 0 && f.FeeTypeId == request.FeeTypeId);
        if (existingFee != null)
            return BadRequest(new ApiResponse<DivisionFeeDto> { Success = false, Message = "An event fee already exists for this fee type" });

        // If setting as default, clear other defaults for event fees
        if (request.IsDefault)
        {
            var existingDefaults = await _context.DivisionFees
                .Where(f => f.EventId == eventId && f.DivisionId == 0 && f.IsDefault)
                .ToListAsync();
            foreach (var existingDefault in existingDefaults)
            {
                existingDefault.IsDefault = false;
            }
        }

        var fee = new DivisionFee
        {
            DivisionId = 0, // Event-level fee
            EventId = eventId,
            FeeTypeId = request.FeeTypeId,
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
            EventId = fee.EventId,
            FeeTypeId = fee.FeeTypeId,
            Name = feeType.Name,
            Description = feeType.Description,
            Amount = fee.Amount,
            IsDefault = fee.IsDefault,
            AvailableFrom = fee.AvailableFrom,
            AvailableUntil = fee.AvailableUntil,
            IsActive = fee.IsActive,
            SortOrder = fee.SortOrder,
            IsCurrentlyAvailable = fee.IsCurrentlyAvailable
        };

        return Ok(new ApiResponse<DivisionFeeDto> { Success = true, Data = dto });
    }

    /// <summary>
    /// Update an event-level fee (DivisionId = 0)
    /// </summary>
    [HttpPut("events/{eventId}/fees/{feeId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<DivisionFeeDto>>> UpdateEventFee(int eventId, int feeId, [FromBody] DivisionFeeRequest request)
    {
        var fee = await _context.DivisionFees
            .Include(f => f.FeeType)
            .FirstOrDefaultAsync(f => f.Id == feeId && f.EventId == eventId && f.DivisionId == 0);

        if (fee == null)
            return NotFound(new ApiResponse<DivisionFeeDto> { Success = false, Message = "Fee not found" });

        // Check authorization
        if (!await CanManagePaymentsAsync(eventId))
            return Forbid();

        // Validate FeeTypeId if being changed
        if (request.FeeTypeId != fee.FeeTypeId)
        {
            var feeType = await _context.EventFeeTypes
                .FirstOrDefaultAsync(ft => ft.Id == request.FeeTypeId && ft.EventId == eventId);
            if (feeType == null)
                return BadRequest(new ApiResponse<DivisionFeeDto> { Success = false, Message = "Fee type not found for this event" });
        }

        // If setting as default, clear other defaults
        if (request.IsDefault && !fee.IsDefault)
        {
            var existingDefaults = await _context.DivisionFees
                .Where(f => f.EventId == eventId && f.DivisionId == 0 && f.IsDefault && f.Id != feeId)
                .ToListAsync();
            foreach (var existing in existingDefaults)
            {
                existing.IsDefault = false;
            }
        }

        fee.FeeTypeId = request.FeeTypeId;
        fee.Amount = request.Amount;
        fee.IsDefault = request.IsDefault;
        fee.AvailableFrom = request.AvailableFrom;
        fee.AvailableUntil = request.AvailableUntil;
        fee.IsActive = request.IsActive;
        fee.SortOrder = request.SortOrder;
        fee.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // Reload FeeType if changed
        if (fee.FeeType == null || fee.FeeType.Id != fee.FeeTypeId)
        {
            fee.FeeType = await _context.EventFeeTypes.FindAsync(fee.FeeTypeId);
        }

        var dto = new DivisionFeeDto
        {
            Id = fee.Id,
            DivisionId = fee.DivisionId,
            EventId = fee.EventId,
            FeeTypeId = fee.FeeTypeId,
            Name = fee.FeeType?.Name ?? "",
            Description = fee.FeeType?.Description,
            Amount = fee.Amount,
            IsDefault = fee.IsDefault,
            AvailableFrom = fee.AvailableFrom,
            AvailableUntil = fee.AvailableUntil,
            IsActive = fee.IsActive,
            SortOrder = fee.SortOrder,
            IsCurrentlyAvailable = fee.IsCurrentlyAvailable
        };

        return Ok(new ApiResponse<DivisionFeeDto> { Success = true, Data = dto });
    }

    /// <summary>
    /// Delete an event-level fee (DivisionId = 0)
    /// </summary>
    [HttpDelete("events/{eventId}/fees/{feeId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteEventFee(int eventId, int feeId)
    {
        var fee = await _context.DivisionFees
            .FirstOrDefaultAsync(f => f.Id == feeId && f.EventId == eventId && f.DivisionId == 0);

        if (fee == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Fee not found" });

        // Check authorization
        if (!await CanManagePaymentsAsync(eventId))
            return Forbid();

        // Check if fee is in use by any members
        var isInUse = await _context.EventUnitMembers.AnyAsync(m => m.SelectedFeeId == feeId);
        if (isInUse)
            return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot delete fee that is in use by existing registrations" });

        _context.DivisionFees.Remove(fee);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true });
    }

    /// <summary>
    /// Bulk update event-level fees (DivisionId = 0).
    /// Each request must have a valid FeeTypeId.
    /// </summary>
    [HttpPut("events/{eventId}/fees")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<DivisionFeeDto>>>> BulkUpdateEventFees(int eventId, [FromBody] List<DivisionFeeRequest> fees)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<List<DivisionFeeDto>> { Success = false, Message = "Event not found" });

        // Check authorization
        if (!await CanManagePaymentsAsync(eventId))
            return Forbid();

        // Validate all FeeTypeIds
        var feeTypeIds = fees.Select(f => f.FeeTypeId).Distinct().ToList();
        var validFeeTypes = await _context.EventFeeTypes
            .Where(ft => ft.EventId == eventId && feeTypeIds.Contains(ft.Id))
            .ToDictionaryAsync(ft => ft.Id, ft => ft);

        var invalidIds = feeTypeIds.Where(id => !validFeeTypes.ContainsKey(id)).ToList();
        if (invalidIds.Any())
            return BadRequest(new ApiResponse<List<DivisionFeeDto>> { Success = false, Message = $"Invalid fee type IDs: {string.Join(", ", invalidIds)}" });

        // Get existing event fees
        var existingFees = await _context.DivisionFees
            .Where(f => f.EventId == eventId && f.DivisionId == 0)
            .ToListAsync();

        // Check if any existing fees are in use
        var existingFeeIds = existingFees.Select(f => f.Id).ToList();
        var usedByMembers = await _context.EventUnitMembers
            .AnyAsync(m => m.SelectedFeeId.HasValue && existingFeeIds.Contains(m.SelectedFeeId.Value));

        if (usedByMembers)
            return BadRequest(new ApiResponse<List<DivisionFeeDto>> { Success = false, Message = "Cannot replace fees that are in use by existing registrations. Please update individual fees instead." });

        // Remove existing event fees
        _context.DivisionFees.RemoveRange(existingFees);

        // Ensure only one default
        var hasDefault = false;
        var newFees = fees.Select((f, index) => {
            var isDefault = f.IsDefault && !hasDefault;
            if (isDefault) hasDefault = true;
            return new DivisionFee
            {
                DivisionId = 0,
                EventId = eventId,
                FeeTypeId = f.FeeTypeId,
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
            EventId = f.EventId,
            FeeTypeId = f.FeeTypeId,
            Name = validFeeTypes[f.FeeTypeId].Name,
            Description = validFeeTypes[f.FeeTypeId].Description,
            Amount = f.Amount,
            IsDefault = f.IsDefault,
            AvailableFrom = f.AvailableFrom,
            AvailableUntil = f.AvailableUntil,
            IsActive = f.IsActive,
            SortOrder = f.SortOrder,
            IsCurrentlyAvailable = f.IsCurrentlyAvailable
        }).ToList();

        return Ok(new ApiResponse<List<DivisionFeeDto>> { Success = true, Data = result });
    }

    #endregion

    #region Event Fee Types

    /// <summary>
    /// Get all fee types for an event (with their event-level fee amounts if configured)
    /// </summary>
    [HttpGet("events/{eventId}/fee-types")]
    public async Task<ActionResult<ApiResponse<List<EventFeeTypeDto>>>> GetEventFeeTypes(int eventId)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<List<EventFeeTypeDto>> { Success = false, Message = "Event not found" });

        // Get fee types with their event-level fees (DivisionId = 0)
        var feeTypes = await _context.EventFeeTypes
            .Where(ft => ft.EventId == eventId)
            .OrderBy(ft => ft.SortOrder)
            .ToListAsync();

        // Get event-level fees (DivisionId = 0) to show amounts
        var eventFees = await _context.DivisionFees
            .Where(f => f.EventId == eventId && f.DivisionId == 0)
            .ToListAsync();

        var result = feeTypes.Select(ft =>
        {
            var eventFee = eventFees.FirstOrDefault(f => f.FeeTypeId == ft.Id);
            return new EventFeeTypeDto
            {
                Id = ft.Id,
                EventId = ft.EventId,
                Name = ft.Name,
                Description = ft.Description,
                IsActive = ft.IsActive,
                SortOrder = ft.SortOrder,
                CreatedAt = ft.CreatedAt,
                EventFeeAmount = eventFee?.Amount,
                HasEventFee = eventFee != null
            };
        }).ToList();

        return Ok(new ApiResponse<List<EventFeeTypeDto>> { Success = true, Data = result });
    }

    /// <summary>
    /// Create a new fee type for an event (just name/description)
    /// </summary>
    [HttpPost("events/{eventId}/fee-types")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<EventFeeTypeDto>>> CreateEventFeeType(int eventId, [FromBody] EventFeeTypeRequest request)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<EventFeeTypeDto> { Success = false, Message = "Event not found" });

        if (!await CanManagePaymentsAsync(eventId))
            return Forbid();

        var feeType = new EventFeeType
        {
            EventId = eventId,
            Name = request.Name,
            Description = request.Description,
            IsActive = request.IsActive,
            SortOrder = request.SortOrder,
            CreatedAt = DateTime.UtcNow
        };

        _context.EventFeeTypes.Add(feeType);
        await _context.SaveChangesAsync();

        var result = new EventFeeTypeDto
        {
            Id = feeType.Id,
            EventId = feeType.EventId,
            Name = feeType.Name,
            Description = feeType.Description,
            IsActive = feeType.IsActive,
            SortOrder = feeType.SortOrder,
            CreatedAt = feeType.CreatedAt
        };

        return Ok(new ApiResponse<EventFeeTypeDto> { Success = true, Data = result });
    }

    /// <summary>
    /// Update a fee type (name/description only)
    /// </summary>
    [HttpPut("events/{eventId}/fee-types/{feeTypeId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<EventFeeTypeDto>>> UpdateEventFeeType(int eventId, int feeTypeId, [FromBody] EventFeeTypeRequest request)
    {
        var feeType = await _context.EventFeeTypes.FirstOrDefaultAsync(ft => ft.Id == feeTypeId && ft.EventId == eventId);
        if (feeType == null)
            return NotFound(new ApiResponse<EventFeeTypeDto> { Success = false, Message = "Fee type not found" });

        if (!await CanManagePaymentsAsync(eventId))
            return Forbid();

        feeType.Name = request.Name;
        feeType.Description = request.Description;
        feeType.IsActive = request.IsActive;
        feeType.SortOrder = request.SortOrder;
        feeType.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // Get event-level fee amount if exists
        var eventFee = await _context.DivisionFees
            .FirstOrDefaultAsync(f => f.EventId == eventId && f.DivisionId == 0 && f.FeeTypeId == feeTypeId);

        var result = new EventFeeTypeDto
        {
            Id = feeType.Id,
            EventId = feeType.EventId,
            Name = feeType.Name,
            Description = feeType.Description,
            IsActive = feeType.IsActive,
            SortOrder = feeType.SortOrder,
            CreatedAt = feeType.CreatedAt,
            EventFeeAmount = eventFee?.Amount,
            HasEventFee = eventFee != null
        };

        return Ok(new ApiResponse<EventFeeTypeDto> { Success = true, Data = result });
    }

    /// <summary>
    /// Delete a fee type
    /// </summary>
    [HttpDelete("events/{eventId}/fee-types/{feeTypeId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteEventFeeType(int eventId, int feeTypeId)
    {
        var feeType = await _context.EventFeeTypes.FirstOrDefaultAsync(ft => ft.Id == feeTypeId && ft.EventId == eventId);
        if (feeType == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Fee type not found" });

        if (!await CanManagePaymentsAsync(eventId))
            return Forbid();

        // Check if any fees are using this fee type
        var usageCount = await _context.DivisionFees.CountAsync(f => f.FeeTypeId == feeTypeId);
        if (usageCount > 0)
        {
            return BadRequest(new ApiResponse<bool>
            {
                Success = false,
                Message = $"Cannot delete fee type - it is used by {usageCount} fee(s). Remove the fees first or update them to use a different fee type."
            });
        }

        _context.EventFeeTypes.Remove(feeType);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true });
    }

    /// <summary>
    /// Bulk update fee types for an event (replaces all fee types not in use)
    /// </summary>
    [HttpPut("events/{eventId}/fee-types")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<EventFeeTypeDto>>>> BulkUpdateEventFeeTypes(int eventId, [FromBody] BulkEventFeeTypesRequest request)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<List<EventFeeTypeDto>> { Success = false, Message = "Event not found" });

        if (!await CanManagePaymentsAsync(eventId))
            return Forbid();

        // Get existing fee types
        var existingFeeTypes = await _context.EventFeeTypes.Where(ft => ft.EventId == eventId).ToListAsync();

        // Check if any are in use before deleting
        var existingIds = existingFeeTypes.Select(ft => ft.Id).ToList();
        var usedFeeTypeIds = await _context.DivisionFees
            .Where(f => existingIds.Contains(f.FeeTypeId))
            .Select(f => f.FeeTypeId)
            .Distinct()
            .ToListAsync();

        // Only delete fee types that are not in use
        var feeTypesToDelete = existingFeeTypes.Where(ft => !usedFeeTypeIds.Contains(ft.Id)).ToList();
        _context.EventFeeTypes.RemoveRange(feeTypesToDelete);

        // Add new fee types (name/description only)
        var newFeeTypes = request.FeeTypes.Select((ft, index) => new EventFeeType
        {
            EventId = eventId,
            Name = ft.Name,
            Description = ft.Description,
            IsActive = ft.IsActive,
            SortOrder = ft.SortOrder > 0 ? ft.SortOrder : index,
            CreatedAt = DateTime.UtcNow
        }).ToList();

        _context.EventFeeTypes.AddRange(newFeeTypes);
        await _context.SaveChangesAsync();

        var result = newFeeTypes.OrderBy(ft => ft.SortOrder).Select(ft => new EventFeeTypeDto
        {
            Id = ft.Id,
            EventId = ft.EventId,
            Name = ft.Name,
            Description = ft.Description,
            IsActive = ft.IsActive,
            SortOrder = ft.SortOrder,
            CreatedAt = ft.CreatedAt
        }).ToList();

        return Ok(new ApiResponse<List<EventFeeTypeDto>> { Success = true, Data = result });
    }

    #endregion

}
