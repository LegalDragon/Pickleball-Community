using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Services;
using Pickleball.Community.Controllers.Base;

namespace Pickleball.Community.Controllers;

[Route("[controller]")]
[ApiController]
public class CheckInController : EventControllerBase
{
    private readonly ILogger<CheckInController> _logger;
    private readonly IWaiverPdfService _waiverPdfService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly IEmailNotificationService _emailService;

    public CheckInController(
        ApplicationDbContext context,
        ILogger<CheckInController> logger,
        IWaiverPdfService waiverPdfService,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        IEmailNotificationService emailService)
        : base(context)
    {
        _logger = logger;
        _waiverPdfService = waiverPdfService;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _emailService = emailService;
    }

    // Helper to check if file is renderable (md/html)
    private static bool IsRenderableFile(string? fileName)
    {
        if (string.IsNullOrEmpty(fileName)) return false;
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext == ".md" || ext == ".html" || ext == ".htm";
    }

    // Convert relative URL to absolute using SharedAuth base URL
    private string GetFullUrl(string url)
    {
        if (string.IsNullOrEmpty(url)) return url;

        // Already a full URL
        if (url.StartsWith("http://") || url.StartsWith("https://"))
            return url;

        // Get base URL from config
        var baseUrl = _configuration["SharedAuth:BaseUrl"]?.TrimEnd('/');
        if (string.IsNullOrEmpty(baseUrl))
            return url;

        // Ensure URL starts with /
        if (!url.StartsWith("/"))
            url = "/" + url;

        return baseUrl + url;
    }

    // Fetch content from URL for renderable files
    private async Task<string> FetchFileContentAsync(string url)
    {
        try
        {
            // Convert relative URL to full URL
            var fullUrl = GetFullUrl(url);
            _logger.LogInformation("Fetching waiver content from {Url}", fullUrl);

            var client = _httpClientFactory.CreateClient();
            var response = await client.GetAsync(fullUrl);
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync();
            }
            _logger.LogWarning("Failed to fetch waiver content: {StatusCode}", response.StatusCode);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch waiver content from {Url}", url);
        }
        return string.Empty;
    }

    /// <summary>
    /// Get check-in status for current user at an event
    /// </summary>
    [HttpGet("status/{eventId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PlayerCheckInStatusDto>>> GetCheckInStatus(int eventId, [FromQuery] string? redo = null)
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            // Check if redo mode is enabled (allows re-signing waiver)
            var redoWaiver = redo?.ToLower() == "waiver";

            // Get user's registrations in this event
            var registrations = await _context.EventUnitMembers
                .Where(m => m.Unit!.EventId == eventId && m.UserId == userId.Value && m.InviteStatus == "Accepted")
                .Include(m => m.User)
                .Include(m => m.Unit)
                    .ThenInclude(u => u!.Division)
                        .ThenInclude(d => d!.SkillLevel)
                .Include(m => m.Unit)
                    .ThenInclude(u => u!.Members)
                        .ThenInclude(mem => mem.User)
                .ToListAsync();

            if (!registrations.Any())
            {
                return Ok(new ApiResponse<PlayerCheckInStatusDto>
                {
                    Success = true,
                    Data = new PlayerCheckInStatusDto
                    {
                        IsRegistered = false,
                        IsCheckedIn = false,
                        WaiverSigned = false
                    }
                });
            }

            // Get waivers from ObjectAssets (newer system) - look for "Waiver" type documents
            var pendingWaiverDtos = new List<WaiverDto>();
            try
            {
                // First, get the ObjectType ID for "Event"
                var eventObjectType = await _context.ObjectTypes
                    .FirstOrDefaultAsync(ot => ot.Name == "Event");

                if (eventObjectType != null)
                {
                    // Get waiver assets for this event
                    var waiverAssets = await _context.ObjectAssets
                        .Include(a => a.AssetType)
                        .Where(a => a.ObjectTypeId == eventObjectType.Id
                            && a.ObjectId == eventId
                            && a.AssetType != null
                            && a.AssetType.TypeName.ToLower() == "waiver")
                        .ToListAsync();

                    // Fetch content for renderable files (.md, .html)
                    foreach (var w in waiverAssets)
                    {
                        var content = "";
                        if (IsRenderableFile(w.FileName) && !string.IsNullOrEmpty(w.FileUrl))
                        {
                            content = await FetchFileContentAsync(w.FileUrl);
                        }

                        pendingWaiverDtos.Add(new WaiverDto
                        {
                            Id = w.Id,
                            DocumentType = "waiver",
                            Title = w.Title,
                            Content = content,
                            FileUrl = w.FileUrl,
                            FileName = w.FileName,
                            Version = 1,
                            IsRequired = true,
                            RequiresMinorWaiver = false,
                            MinorAgeThreshold = 18
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not query ObjectAssets for waivers - table may not exist yet");
            }

            var firstReg = registrations.First();
            var allWaiversSigned = !pendingWaiverDtos.Any() || firstReg.WaiverSignedAt != null;

            // Filter out already signed waivers (unless in redo mode)
            if (firstReg.WaiverSignedAt != null && !redoWaiver)
            {
                pendingWaiverDtos = pendingWaiverDtos
                    .Where(w => firstReg.WaiverDocumentId != w.Id)
                    .ToList();
            }

            // Get player name
            var playerName = firstReg.User != null
                ? $"{firstReg.User.FirstName} {firstReg.User.LastName}".Trim()
                : null;

            // Get signed waiver PDF URL (convert relative to full URL if needed)
            var signedPdfUrl = !string.IsNullOrEmpty(firstReg.SignedWaiverPdfUrl)
                ? GetFullUrl(firstReg.SignedWaiverPdfUrl)
                : null;

            // Build registration info for payment modal (from first unit)
            var firstUnit = firstReg.Unit!;
            var registrationDto = new CheckInRegistrationDto
            {
                UnitId = firstUnit.Id,
                DivisionName = firstUnit.Division?.Name,
                TeamUnitName = firstUnit.Name,
                SkillLevelName = firstUnit.Division?.SkillLevel?.Name,
                AmountDue = firstUnit.Division?.DivisionFee ?? 0m,
                AmountPaid = firstUnit.Members?.Where(m => m.InviteStatus == "Accepted").Sum(m => m.AmountPaid) ?? 0,
                PaymentStatus = firstUnit.PaymentStatus ?? "Pending",
                PaymentReference = firstReg.PaymentReference,
                PaymentProofUrl = firstReg.PaymentProofUrl,
                Members = firstUnit.Members?
                    .Where(m => m.InviteStatus == "Accepted")
                    .Select(m => new CheckInMemberDto
                    {
                        Id = m.Id,
                        UserId = m.UserId,
                        Name = m.User != null ? $"{m.User.FirstName} {m.User.LastName}".Trim() : null,
                        InviteStatus = m.InviteStatus,
                        HasPaid = m.HasPaid,
                        AmountPaid = m.AmountPaid,
                        PaidAt = m.PaidAt,
                        ReferenceId = m.ReferenceId,
                        PaymentReference = m.PaymentReference,
                        PaymentProofUrl = m.PaymentProofUrl
                    }).ToList() ?? new List<CheckInMemberDto>(),
                Partners = firstUnit.Members?
                    .Where(m => m.InviteStatus == "Accepted" && m.UserId != userId.Value)
                    .Select(m => new CheckInPartnerDto
                    {
                        UserId = m.UserId,
                        Name = m.User != null ? $"{m.User.FirstName} {m.User.LastName}".Trim() : null
                    }).ToList() ?? new List<CheckInPartnerDto>()
            };

            return Ok(new ApiResponse<PlayerCheckInStatusDto>
            {
                Success = true,
                Data = new PlayerCheckInStatusDto
                {
                    IsRegistered = true,
                    IsCheckedIn = firstReg.IsCheckedIn,
                    CheckedInAt = firstReg.CheckedInAt,
                    WaiverSigned = allWaiversSigned,
                    WaiverSignedAt = firstReg.WaiverSignedAt,
                    SignedWaiverPdfUrl = signedPdfUrl,
                    PlayerName = playerName,
                    PendingWaivers = pendingWaiverDtos,
                    Divisions = registrations.Select(r => new CheckInDivisionDto
                    {
                        DivisionId = r.Unit!.DivisionId,
                        DivisionName = r.Unit.Division?.Name ?? "",
                        UnitId = r.UnitId,
                        UnitName = r.Unit.Name,
                        IsCheckedIn = r.IsCheckedIn,
                        CheckedInAt = r.CheckedInAt
                    }).ToList(),
                    Registration = registrationDto
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting check-in status for event {EventId}", eventId);
            return StatusCode(500, new ApiResponse<PlayerCheckInStatusDto>
            {
                Success = false,
                Message = $"Error getting check-in status: {ex.Message}"
            });
        }
    }

    /// <summary>
    /// Sign waiver for an event
    /// </summary>
    [HttpPost("waiver/{eventId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> SignWaiver(int eventId, [FromBody] SignWaiverRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        // Get the event info
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Event not found" });

        // Find waiver in ObjectAssets
        var objectAsset = await _context.ObjectAssets
            .Include(a => a.AssetType)
            .FirstOrDefaultAsync(a => a.Id == request.WaiverId
                && a.ObjectId == eventId
                && a.AssetType != null
                && a.AssetType.TypeName.ToLower() == "waiver");

        if (objectAsset == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Waiver not found" });

        var waiverId = objectAsset.Id;
        var waiverTitle = objectAsset.Title;
        var waiverContent = "";

        // Fetch waiver content from file URL if available
        if (!string.IsNullOrEmpty(objectAsset.FileUrl) && IsRenderableFile(objectAsset.FileName))
        {
            waiverContent = await FetchFileContentAsync(objectAsset.FileUrl);
        }

        // Get user info for legal record
        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "User not found" });

        // Get user's registrations
        var registrations = await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.UserId == userId.Value && m.InviteStatus == "Accepted")
            .ToListAsync();

        if (!registrations.Any())
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Not registered for this event" });

        // Validate typed signature
        if (string.IsNullOrWhiteSpace(request.Signature))
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Typed signature is required" });

        // Validate drawn signature
        if (string.IsNullOrWhiteSpace(request.SignatureImage))
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Drawn signature is required" });

        // Get IP address for legal record
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var signedAt = DateTime.Now;

        // Get first registration for reference ID
        var firstReg = registrations.First();

        // Generate reference ID in format E{eventId}-W{waiverId}-M{memberId}-U{userId}
        var referenceId = $"E{eventId}-W{waiverId}-M{firstReg.Id}-U{userId}";

        // Get player name
        var playerName = $"{user.FirstName} {user.LastName}".Trim();
        if (string.IsNullOrEmpty(playerName))
            playerName = user.Email ?? "Unknown";

        // Process signature: upload assets, generate PDF, call notification SP
        WaiverSigningResult? signingResult = null;
        try
        {
            var waiverDto = new WaiverDocumentDto
            {
                Id = waiverId,
                EventId = eventId,
                EventName = evt.Name,
                Title = waiverTitle,
                Content = waiverContent,
                PlayerName = playerName,
                ReferenceId = referenceId
            };

            signingResult = await _waiverPdfService.ProcessWaiverSignatureAsync(
                waiverDto,
                user,
                request.Signature.Trim(),
                request.SignatureImage,
                signedAt,
                ipAddress,
                request.SignerRole,
                request.ParentGuardianName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process waiver signature for user {UserId} event {EventId}", userId, eventId);
            // Continue - waiver can still be signed even if asset upload fails
        }

        // Create waiver signature records in the junction table
        foreach (var reg in registrations)
        {
            // Check if this waiver was already signed by this member
            var existingSignature = await _context.EventUnitMemberWaivers
                .FirstOrDefaultAsync(w => w.EventUnitMemberId == reg.Id && w.WaiverId == waiverId);

            if (existingSignature == null)
            {
                // Create new waiver signature record
                var waiverSignature = new EventUnitMemberWaiver
                {
                    EventUnitMemberId = reg.Id,
                    WaiverId = waiverId,
                    SignedAt = signedAt,
                    SignatureAssetUrl = signingResult?.SignatureAssetUrl,
                    SignedPdfUrl = signingResult?.SignedWaiverPdfUrl,
                    WaiverSignature = request.Signature.Trim(),
                    SignerRole = request.SignerRole,
                    ParentGuardianName = request.ParentGuardianName?.Trim(),
                    EmergencyPhone = request.EmergencyPhone,
                    SignerEmail = user.Email,
                    SignerIpAddress = ipAddress,
                    WaiverTitle = waiverTitle,
                    WaiverVersion = 1
                };
                _context.EventUnitMemberWaivers.Add(waiverSignature);
            }
            else
            {
                // Update existing signature (re-signing)
                existingSignature.SignedAt = signedAt;
                existingSignature.SignatureAssetUrl = signingResult?.SignatureAssetUrl;
                existingSignature.SignedPdfUrl = signingResult?.SignedWaiverPdfUrl;
                existingSignature.WaiverSignature = request.Signature.Trim();
                existingSignature.SignerRole = request.SignerRole;
                existingSignature.ParentGuardianName = request.ParentGuardianName?.Trim();
                existingSignature.EmergencyPhone = request.EmergencyPhone;
                existingSignature.SignerEmail = user.Email;
                existingSignature.SignerIpAddress = ipAddress;
            }

            // Also update the legacy fields on EventUnitMember for backward compatibility
            reg.WaiverSignedAt = signedAt;
            reg.WaiverDocumentId = waiverId;
            reg.WaiverSignature = request.Signature.Trim();
        }

        // Save junction table records
        await _context.SaveChangesAsync();

        // Now try to update extended fields on EventUnitMember (may fail if columns don't exist yet)
        try
        {
            foreach (var reg in registrations)
            {
                reg.SignatureAssetUrl = signingResult?.SignatureAssetUrl;
                reg.SignedWaiverPdfUrl = signingResult?.SignedWaiverPdfUrl;
                reg.SignerEmail = user.Email;
                reg.SignerIpAddress = ipAddress;
                reg.WaiverSignerRole = request.SignerRole;
                reg.ParentGuardianName = request.ParentGuardianName?.Trim();
            }
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not save extended waiver fields on EventUnitMember - migration may not have been run");
            // Continue - waiver signing to junction table succeeded
        }

        // Check if all waivers for this event have been signed
        // Get waiver IDs from ObjectAssets
        var allWaiverIds = await _context.ObjectAssets
            .Include(a => a.AssetType)
            .Where(a => a.ObjectId == eventId
                && a.AssetType != null
                && a.AssetType.TypeName.ToLower() == "waiver")
            .Select(a => a.Id)
            .ToListAsync();

        // Fetch signed waiver IDs for this member and count in memory
        // (avoids EF Core Contains() SQL generation issues with OPENJSON)
        var signedWaiverIds = await _context.EventUnitMemberWaivers
            .Where(w => w.EventUnitMemberId == firstReg.Id)
            .Select(w => w.WaiverId)
            .ToListAsync();

        var signedWaiverCount = allWaiverIds.Count(id => signedWaiverIds.Contains(id));
        var allWaiversSigned = signedWaiverCount >= allWaiverIds.Count;

        // Send waiver confirmation email with signed PDF attached
        try
        {
            if (!string.IsNullOrEmpty(user.Email))
            {
                var emailBody = EmailTemplates.WaiverSignedConfirmation(
                    playerName,
                    evt.Name,
                    waiverTitle ?? "Event Waiver",
                    signedAt
                );

                await _emailService.CreateEmail(
                    userId.Value,
                    user.Email,
                    $"Waiver Signed: {evt.Name}",
                    emailBody
                )
                .AttachIfPresent("Signed_Waiver.pdf", "application/pdf", signingResult?.SignedWaiverPdfUrl)
                .SendAsync();
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send waiver confirmation email to user {UserId}", userId);
            // Don't fail the waiver signing if email fails
        }

        _logger.LogInformation("User {UserId} signed waiver {WaiverId} for event {EventId} with signature '{Signature}'. All waivers signed: {AllSigned}",
            userId, waiverId, eventId, request.Signature, allWaiversSigned);

        // Check if registration is now complete (all waivers signed AND payment complete)
        // Send registration complete email if so
        if (allWaiversSigned)
        {
            try
            {
                // Check if payment is complete or no payment required
                var unit = await _context.EventUnits
                    .Include(u => u.Division)
                    .FirstOrDefaultAsync(u => u.Id == firstReg.UnitId);

                var feeAmount = unit?.Division?.DivisionFee ?? evt.RegistrationFee;
                var paymentComplete = feeAmount <= 0 || firstReg.HasPaid;

                if (paymentComplete)
                {
                    // Both waiver and payment complete - send registration complete email
                    var badgeUrl = $"https://pickleball.community/badge/{firstReg.Id}";
                    var emailBody = EmailTemplates.EventRegistrationConfirmation(
                        playerName,
                        evt.Name,
                        unit?.Division?.Name ?? "Division",
                        evt.StartDate,
                        evt.VenueName,
                        unit?.Name,
                        feeAmount,
                        waiverSigned: true,
                        paymentComplete: true,
                        badgeUrl: badgeUrl
                    );

                    await _emailService.SendSimpleAsync(
                        userId.Value,
                        user.Email!,
                        $"Registration Complete: {evt.Name}",
                        emailBody
                    );
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send registration complete email to user {UserId}", userId);
            }
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = allWaiversSigned ? "All waivers signed successfully" : "Waiver signed successfully",
            Data = new
            {
                SignedWaiverPdfUrl = signingResult?.SignedWaiverPdfUrl,
                AllWaiversSigned = allWaiversSigned,
                SignedCount = signedWaiverCount,
                TotalCount = allWaiverIds.Count
            }
        });
    }

    /// <summary>
    /// Get all signed waivers for the current user at an event
    /// </summary>
    [HttpGet("signed-waivers/{eventId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<SignedWaiverDto>>>> GetSignedWaivers(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        // Get user's registration
        var registration = await _context.EventUnitMembers
            .FirstOrDefaultAsync(m => m.Unit!.EventId == eventId && m.UserId == userId.Value && m.InviteStatus == "Accepted");

        if (registration == null)
            return NotFound(new ApiResponse<List<SignedWaiverDto>> { Success = false, Message = "Not registered for this event" });

        // Get all signed waivers for this member
        var signedWaivers = await _context.EventUnitMemberWaivers
            .Where(w => w.EventUnitMemberId == registration.Id)
            .OrderBy(w => w.SignedAt)
            .Select(w => new SignedWaiverDto
            {
                Id = w.Id,
                WaiverId = w.WaiverId,
                WaiverTitle = w.WaiverTitle,
                SignedAt = w.SignedAt,
                SignedPdfUrl = w.SignedPdfUrl,
                SignerRole = w.SignerRole
            })
            .ToListAsync();

        // Get total waiver count for this event
        var totalWaivers = await _context.ObjectAssets
            .Include(a => a.AssetType)
            .Where(a => a.ObjectId == eventId
                && a.AssetType != null
                && a.AssetType.TypeName.ToLower() == "waiver")
            .CountAsync();

        return Ok(new ApiResponse<List<SignedWaiverDto>>
        {
            Success = true,
            Data = signedWaivers,
            Message = signedWaivers.Count >= totalWaivers ? "All waivers signed" : $"{signedWaivers.Count} of {totalWaivers} waivers signed"
        });
    }

    /// <summary>
    /// Check in to an event (self check-in)
    /// </summary>
    [HttpPost("{eventId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<CheckInResultDto>>> CheckIn(int eventId)
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            // Verify user is registered
            var registrations = await _context.EventUnitMembers
                .Where(m => m.Unit!.EventId == eventId && m.UserId == userId.Value && m.InviteStatus == "Accepted")
                .Include(m => m.Unit)
                .ToListAsync();

            if (!registrations.Any())
                return BadRequest(new ApiResponse<CheckInResultDto> { Success = false, Message = "Not registered for this event" });

            // Check if waiver is required but not signed (using ObjectAssets)
            try
            {
                var pendingWaivers = await _context.ObjectAssets
                    .Include(a => a.AssetType)
                    .Include(a => a.ObjectType)
                    .Where(a => a.ObjectType != null
                        && a.ObjectType.Name == "Event"
                        && a.ObjectId == eventId
                        && a.AssetType != null
                        && a.AssetType.TypeName.ToLower() == "waiver")
                    .ToListAsync();

                var firstReg = registrations.First();
                if (pendingWaivers.Any() && firstReg.WaiverSignedAt == null)
                {
                    return BadRequest(new ApiResponse<CheckInResultDto>
                    {
                        Success = false,
                        Message = "Please sign the waiver before checking in"
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not query ObjectAssets table - skipping waiver check");
            }

            // Create or update event-level check-in (gracefully handle missing table)
            try
            {
                var existingCheckIn = await _context.EventCheckIns
                    .FirstOrDefaultAsync(c => c.EventId == eventId && c.UserId == userId.Value);

                if (existingCheckIn == null)
                {
                    existingCheckIn = new EventCheckIn
                    {
                        EventId = eventId,
                        UserId = userId.Value,
                        CheckInMethod = CheckInMethod.Self,
                        CheckedInAt = DateTime.Now,
                        IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
                    };
                    _context.EventCheckIns.Add(existingCheckIn);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not query EventCheckIns table - skipping event-level check-in");
            }

            // Update all unit member check-ins
            foreach (var reg in registrations)
            {
                reg.IsCheckedIn = true;
                reg.CheckedInAt = DateTime.Now;
            }

            // Check if this makes any games ready (gracefully handle missing table)
            var readyGames = new List<int>();
            try
            {
                foreach (var reg in registrations)
                {
                    var unit = reg.Unit!;
                    // Find games where this unit is playing
                    var games = await _context.EventGames
                        .Include(g => g.EncounterMatch)
                            .ThenInclude(m => m!.Encounter)
                                .ThenInclude(e => e!.Unit1)
                                    .ThenInclude(u => u!.Members)
                        .Include(g => g.EncounterMatch)
                            .ThenInclude(m => m!.Encounter)
                                .ThenInclude(e => e!.Unit2)
                                    .ThenInclude(u => u!.Members)
                        .Where(g => g.Status == "New" &&
                            (g.EncounterMatch!.Encounter!.Unit1Id == unit.Id || g.EncounterMatch.Encounter.Unit2Id == unit.Id))
                        .ToListAsync();

                    foreach (var game in games)
                    {
                        var encounter = game.EncounterMatch!.Encounter!;
                        var unit1Members = encounter.Unit1?.Members.Where(m => m.InviteStatus == "Accepted").ToList() ?? new List<EventUnitMember>();
                        var unit2Members = encounter.Unit2?.Members.Where(m => m.InviteStatus == "Accepted").ToList() ?? new List<EventUnitMember>();

                        var allUnit1CheckedIn = unit1Members.All(m => m.IsCheckedIn);
                        var allUnit2CheckedIn = unit2Members.All(m => m.IsCheckedIn);

                        if (allUnit1CheckedIn && allUnit2CheckedIn && game.Status == "New")
                        {
                            game.Status = "Ready";
                            game.UpdatedAt = DateTime.Now;
                            readyGames.Add(game.Id);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not query EventGames table - skipping game readiness check");
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("User {UserId} checked in to event {EventId}. {ReadyCount} games now ready.",
                userId, eventId, readyGames.Count);

            return Ok(new ApiResponse<CheckInResultDto>
            {
                Success = true,
                Data = new CheckInResultDto
                {
                    CheckedInAt = DateTime.Now,
                    GamesNowReady = readyGames.Count,
                    Message = readyGames.Count > 0
                        ? $"Checked in successfully! {readyGames.Count} game(s) are now ready to play."
                        : "Checked in successfully!"
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking in to event {EventId}", eventId);
            return StatusCode(500, new ApiResponse<CheckInResultDto>
            {
                Success = false,
                Message = $"Error checking in: {ex.Message}"
            });
        }
    }

    /// <summary>
    /// Player self-check-in request - sets status to "Requested" for admin approval
    /// Requires waiver to be signed and payment info to be verified
    /// </summary>
    [HttpPost("request/{eventId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<CheckInResultDto>>> RequestCheckIn(int eventId, [FromBody] RequestCheckInDto? request = null)
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            // Get event
            var evt = await _context.Events.FindAsync(eventId);
            if (evt == null)
                return NotFound(new ApiResponse<CheckInResultDto> { Success = false, Message = "Event not found" });

            // Get user's registrations
            var registrations = await _context.EventUnitMembers
                .Where(m => m.Unit!.EventId == eventId && m.UserId == userId.Value && m.InviteStatus == "Accepted")
                .Include(m => m.Unit)
                .ToListAsync();

            if (!registrations.Any())
                return BadRequest(new ApiResponse<CheckInResultDto> { Success = false, Message = "Not registered for this event" });

            var firstReg = registrations.First();

            // Verify waiver is signed
            if (firstReg.WaiverSignedAt == null)
                return BadRequest(new ApiResponse<CheckInResultDto> { Success = false, Message = "Please sign the waiver first" });

            // If payment is required, verify payment info is submitted
            if (evt.RegistrationFee > 0 || (firstReg.Unit?.Division?.DivisionFee ?? 0m) > 0)
            {
                // Payment info must be submitted (proof or reference)
                var hasPaymentInfo = !string.IsNullOrEmpty(firstReg.PaymentProofUrl) ||
                                     !string.IsNullOrEmpty(firstReg.PaymentReference) ||
                                     firstReg.AmountPaid > 0;

                if (!hasPaymentInfo && request?.ConfirmPaymentSubmitted != true)
                    return BadRequest(new ApiResponse<CheckInResultDto>
                    {
                        Success = false,
                        Message = "Please verify your payment information before checking in"
                    });
            }

            // Update all registrations to "Requested" status
            foreach (var reg in registrations)
            {
                if (reg.CheckInStatus != "Approved" && !reg.IsCheckedIn)
                {
                    reg.CheckInStatus = "Requested";
                    reg.CheckInRequestedAt = DateTime.Now;
                }
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("User {UserId} requested check-in for event {EventId}", userId, eventId);

            return Ok(new ApiResponse<CheckInResultDto>
            {
                Success = true,
                Data = new CheckInResultDto
                {
                    Message = "Check-in requested! Please wait for admin approval."
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error requesting check-in for event {EventId}", eventId);
            return StatusCode(500, new ApiResponse<CheckInResultDto>
            {
                Success = false,
                Message = $"Error requesting check-in: {ex.Message}"
            });
        }
    }

    /// <summary>
    /// Manual check-in by TD (Tournament Director)
    /// </summary>
    [HttpPost("manual/{eventId}/{userId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<CheckInResultDto>>> ManualCheckIn(int eventId, int userId, [FromBody] ManualCheckInRequest? request = null)
    {
        var currentUserId = GetUserId();
        if (currentUserId == 0) return Unauthorized();

        // Verify current user is TD/organizer
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<CheckInResultDto> { Success = false, Message = "Event not found" });

        var currentUser = await _context.Users.FindAsync(currentUserId);
        var isOrganizer = evt.OrganizedByUserId == currentUserId || currentUser?.Role == "Admin";

        if (!isOrganizer)
            return Forbid();

        // Get user's registrations
        var registrations = await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.UserId == userId && m.InviteStatus == "Accepted")
            .Include(m => m.Unit)
            .ToListAsync();

        if (!registrations.Any())
            return BadRequest(new ApiResponse<CheckInResultDto> { Success = false, Message = "User is not registered for this event" });

        // Create event check-in record
        var existingCheckIn = await _context.EventCheckIns
            .FirstOrDefaultAsync(c => c.EventId == eventId && c.UserId == userId);

        if (existingCheckIn == null)
        {
            existingCheckIn = new EventCheckIn
            {
                EventId = eventId,
                UserId = userId,
                CheckInMethod = CheckInMethod.Manual,
                CheckedInByUserId = currentUserId,
                CheckedInAt = DateTime.Now,
                Notes = request?.Notes,
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
            };
            _context.EventCheckIns.Add(existingCheckIn);
        }

        // Update unit member check-ins
        foreach (var reg in registrations)
        {
            reg.IsCheckedIn = true;
            reg.CheckedInAt = DateTime.Now;
            if (request?.SignWaiver == true)
            {
                reg.WaiverSignedAt = DateTime.Now;
            }
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("TD {TdUserId} manually checked in user {UserId} to event {EventId}",
            currentUserId, userId, eventId);

        return Ok(new ApiResponse<CheckInResultDto>
        {
            Success = true,
            Data = new CheckInResultDto
            {
                CheckedInAt = DateTime.Now,
                Message = "Player checked in successfully"
            }
        });
    }

    /// <summary>
    /// Get all check-ins for an event (TD view)
    /// </summary>
    [HttpGet("event/{eventId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<EventCheckInSummaryDto>>> GetEventCheckIns(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        // Verify user is TD/organizer
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<EventCheckInSummaryDto> { Success = false, Message = "Event not found" });

        var currentUser = await _context.Users.FindAsync(userId.Value);
        var isOrganizer = evt.OrganizedByUserId == userId.Value || currentUser?.Role == "Admin";

        if (!isOrganizer)
            return Forbid();

        // Get all players with check-in status
        var players = await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.InviteStatus == "Accepted")
            .Include(m => m.User)
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Division)
            .Select(m => new PlayerCheckInDto
            {
                MemberId = m.Id,
                UserId = m.UserId,
                FirstName = m.User!.FirstName,
                LastName = m.User.LastName,
                Email = m.User.Email,
                AvatarUrl = m.User.ProfileImageUrl,
                UnitId = m.UnitId,
                UnitName = m.Unit!.Name,
                DivisionId = m.Unit.DivisionId,
                DivisionName = m.Unit.Division!.Name,
                IsCheckedIn = m.IsCheckedIn,
                CheckedInAt = m.CheckedInAt,
                CheckInStatus = m.CheckInStatus,
                CheckInRequestedAt = m.CheckInRequestedAt,
                WaiverSigned = m.WaiverSignedAt != null,
                WaiverSignedAt = m.WaiverSignedAt,
                WaiverSignature = m.WaiverSignature,
                SignedWaiverPdfUrl = m.SignedWaiverPdfUrl,
                WaiverDocumentId = m.WaiverDocumentId,
                HasPaid = m.HasPaid,
                AmountPaid = m.AmountPaid,
                PaidAt = m.PaidAt,
                PaymentReference = m.PaymentReference,
                PaymentProofUrl = m.PaymentProofUrl,
                PaymentMethod = m.PaymentMethod,
                ReferenceId = m.ReferenceId
            })
            .ToListAsync();

        // Get unique players
        var uniquePlayers = players
            .GroupBy(p => p.UserId)
            .Select(g => g.First())
            .ToList();

        return Ok(new ApiResponse<EventCheckInSummaryDto>
        {
            Success = true,
            Data = new EventCheckInSummaryDto
            {
                TotalPlayers = uniquePlayers.Count,
                CheckedInCount = uniquePlayers.Count(p => p.IsCheckedIn),
                WaiverSignedCount = uniquePlayers.Count(p => p.WaiverSigned),
                PaidCount = uniquePlayers.Count(p => p.HasPaid),
                Players = players
            }
        });
    }

    /// <summary>
    /// Get waivers for an event from ObjectAssets
    /// </summary>
    [HttpGet("waivers/{eventId}")]
    public async Task<ActionResult<ApiResponse<List<WaiverDto>>>> GetEventWaivers(int eventId)
    {
        // Get waivers from ObjectAssets where AssetType is "waiver"
        var waiverAssets = await _context.ObjectAssets
            .Include(a => a.AssetType)
            .Where(a => a.ObjectId == eventId
                && a.AssetType != null
                && a.AssetType.TypeName.ToLower() == "waiver")
            .OrderBy(a => a.SortOrder)
            .ToListAsync();

        var waivers = new List<WaiverDto>();
        foreach (var asset in waiverAssets)
        {
            // Try to fetch content from file URL if it's a renderable file
            string content = "";
            if (!string.IsNullOrEmpty(asset.FileUrl) && IsRenderableFile(asset.FileName))
            {
                try
                {
                    content = await FetchFileContentAsync(asset.FileUrl);
                }
                catch
                {
                    // If content fetch fails, leave empty - frontend will show file link
                }
            }

            waivers.Add(new WaiverDto
            {
                Id = asset.Id,
                DocumentType = "waiver",
                Title = asset.Title,
                Content = content,
                FileUrl = asset.FileUrl,
                FileName = asset.FileName,
                Version = 1,
                IsRequired = true, // Waivers are typically required
                RequiresMinorWaiver = false,
                MinorAgeThreshold = 18
            });
        }

        return Ok(new ApiResponse<List<WaiverDto>>
        {
            Success = true,
            Data = waivers
        });
    }

    /// <summary>
    /// Get all documents for an event (waivers, maps, rules, contacts)
    /// </summary>
    [HttpGet("documents/{eventId}")]
    public async Task<ActionResult<ApiResponse<List<WaiverDto>>>> GetEventDocuments(int eventId)
    {
        var documents = await _context.EventWaivers
            .Where(w => w.EventId == eventId && w.IsActive)
            .OrderBy(w => w.DocumentType)
            .ThenBy(w => w.Title)
            .Select(w => new WaiverDto
            {
                Id = w.Id,
                DocumentType = w.DocumentType ?? "waiver",
                Title = w.Title,
                Content = w.Content,
                Version = w.Version,
                IsRequired = w.IsRequired,
                RequiresMinorWaiver = w.RequiresMinorWaiver,
                MinorAgeThreshold = w.MinorAgeThreshold
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<WaiverDto>>
        {
            Success = true,
            Data = documents
        });
    }

    /// <summary>
    /// Create or update a waiver (TD only) - legacy endpoint
    /// </summary>
    [HttpPost("waivers/{eventId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<WaiverDto>>> CreateWaiver(int eventId, [FromBody] CreateWaiverRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        // Verify user is organizer
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<WaiverDto> { Success = false, Message = "Event not found" });

        var currentUser = await _context.Users.FindAsync(userId.Value);
        var isOrganizer = evt.OrganizedByUserId == userId.Value || currentUser?.Role == "Admin";

        if (!isOrganizer)
            return Forbid();

        EventWaiver waiver;

        if (request.Id > 0)
        {
            // Update existing waiver
            waiver = await _context.EventWaivers
                .FirstOrDefaultAsync(w => w.Id == request.Id && w.EventId == eventId);
            if (waiver == null)
                return NotFound(new ApiResponse<WaiverDto> { Success = false, Message = "Waiver not found" });

            waiver.DocumentType = request.DocumentType ?? "waiver";
            waiver.Title = request.Title;
            waiver.Content = request.Content;
            waiver.IsRequired = request.IsRequired;
            waiver.RequiresMinorWaiver = request.RequiresMinorWaiver;
            waiver.MinorAgeThreshold = request.MinorAgeThreshold;
            waiver.UpdatedAt = DateTime.Now;
            waiver.Version++;
        }
        else
        {
            // Create new waiver
            waiver = new EventWaiver
            {
                EventId = eventId,
                DocumentType = request.DocumentType ?? "waiver",
                Title = request.Title,
                Content = request.Content,
                IsRequired = request.IsRequired,
                RequiresMinorWaiver = request.RequiresMinorWaiver,
                MinorAgeThreshold = request.MinorAgeThreshold,
                CreatedByUserId = userId
            };
            _context.EventWaivers.Add(waiver);
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<WaiverDto>
        {
            Success = true,
            Data = new WaiverDto
            {
                Id = waiver.Id,
                DocumentType = waiver.DocumentType,
                Title = waiver.Title,
                Content = waiver.Content,
                Version = waiver.Version,
                IsRequired = waiver.IsRequired,
                RequiresMinorWaiver = waiver.RequiresMinorWaiver,
                MinorAgeThreshold = waiver.MinorAgeThreshold
            }
        });
    }

    /// <summary>
    /// Delete a waiver (TD only) - legacy endpoint
    /// </summary>
    [HttpDelete("waivers/{eventId}/{waiverId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteWaiver(int eventId, int waiverId)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        // Verify user is organizer
        var evt = await _context.Events.FirstOrDefaultAsync(e => e.Id == eventId);
        if (evt == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

        var isOrganizer = evt.OrganizedByUserId == userId.Value;
        if (!isOrganizer)
            return Forbid();

        var waiver = await _context.EventWaivers
            .FirstOrDefaultAsync(w => w.Id == waiverId && w.EventId == eventId);

        if (waiver == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Waiver not found" });

        // Soft delete - mark as inactive
        waiver.IsActive = false;
        waiver.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool>
        {
            Success = true,
            Data = true,
            Message = "Waiver deleted"
        });
    }

    /// <summary>
    /// Create or update an event document (TD only)
    /// </summary>
    [HttpPost("documents/{eventId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<WaiverDto>>> CreateDocument(int eventId, [FromBody] CreateWaiverRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        // Verify user is organizer
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<WaiverDto> { Success = false, Message = "Event not found" });

        var currentUser = await _context.Users.FindAsync(userId.Value);
        var isOrganizer = evt.OrganizedByUserId == userId.Value || currentUser?.Role == "Admin";

        if (!isOrganizer)
            return Forbid();

        // Validate document type
        var validTypes = new[] { "waiver", "map", "rules", "contacts" };
        var docType = request.DocumentType ?? "waiver";
        if (!validTypes.Contains(docType))
            return BadRequest(new ApiResponse<WaiverDto> { Success = false, Message = "Invalid document type" });

        EventWaiver document;

        if (request.Id > 0)
        {
            // Update existing document
            document = await _context.EventWaivers
                .FirstOrDefaultAsync(w => w.Id == request.Id && w.EventId == eventId);
            if (document == null)
                return NotFound(new ApiResponse<WaiverDto> { Success = false, Message = "Document not found" });

            document.DocumentType = docType;
            document.Title = request.Title;
            document.Content = request.Content;
            document.IsRequired = docType == "waiver" && request.IsRequired;
            document.RequiresMinorWaiver = docType == "waiver" && request.RequiresMinorWaiver;
            document.MinorAgeThreshold = request.MinorAgeThreshold;
            document.UpdatedAt = DateTime.Now;
            document.Version++;
        }
        else
        {
            // Create new document
            document = new EventWaiver
            {
                EventId = eventId,
                DocumentType = docType,
                Title = request.Title,
                Content = request.Content,
                IsRequired = docType == "waiver" && request.IsRequired,
                RequiresMinorWaiver = docType == "waiver" && request.RequiresMinorWaiver,
                MinorAgeThreshold = request.MinorAgeThreshold,
                CreatedByUserId = userId
            };
            _context.EventWaivers.Add(document);
        }

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<WaiverDto>
        {
            Success = true,
            Data = new WaiverDto
            {
                Id = document.Id,
                DocumentType = document.DocumentType,
                Title = document.Title,
                Content = document.Content,
                Version = document.Version,
                IsRequired = document.IsRequired,
                RequiresMinorWaiver = document.RequiresMinorWaiver,
                MinorAgeThreshold = document.MinorAgeThreshold
            }
        });
    }

    /// <summary>
    /// Void a player's check-in (admin only)
    /// </summary>
    [HttpPost("void/{eventId}/{userId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> VoidCheckIn(int eventId, int userId, [FromBody] AdminCheckInOverrideRequest? request = null)
    {
        var currentUserId = GetUserId();
        if (currentUserId == 0) return Unauthorized();

        // Verify current user is TD/organizer
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Event not found" });

        var currentUser = await _context.Users.FindAsync(currentUserId);
        var isOrganizer = evt.OrganizedByUserId == currentUserId || currentUser?.Role == "Admin";

        if (!isOrganizer)
            return Forbid();

        // Get user's registrations
        var registrations = await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.UserId == userId && m.InviteStatus == "Accepted")
            .ToListAsync();

        if (!registrations.Any())
            return BadRequest(new ApiResponse<object> { Success = false, Message = "User is not registered for this event" });

        // Void the check-in, waiver, and payment so player can redo
        foreach (var reg in registrations)
        {
            reg.IsCheckedIn = false;
            reg.CheckedInAt = null;
            reg.CheckInStatus = "Pending";
            reg.CheckInRequestedAt = null;

            // Void waiver (clear all waiver-related fields)
            reg.WaiverSignedAt = null;
            reg.WaiverSignature = null;
            reg.SignedWaiverPdfUrl = null;
            reg.SignatureAssetUrl = null;
            reg.SignerEmail = null;
            reg.SignerIpAddress = null;
            reg.WaiverSignerRole = null;
            reg.WaiverDocumentId = null;

            // Void payment
            reg.HasPaid = false;
            reg.AmountPaid = 0;
            reg.PaymentMethod = null;
            reg.PaymentReference = null;
            reg.PaidAt = null;
            reg.PaymentProofUrl = null;
            reg.ReferenceId = null;
        }

        // Remove event-level check-in record
        var eventCheckIn = await _context.EventCheckIns
            .FirstOrDefaultAsync(c => c.EventId == eventId && c.UserId == userId);
        if (eventCheckIn != null)
        {
            _context.EventCheckIns.Remove(eventCheckIn);
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("TD {TdUserId} voided check-in, waiver, and payment for user {UserId} at event {EventId}. Notes: {Notes}",
            currentUserId, userId, eventId, request?.Notes);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Check-in voided - player can now re-sign waiver and re-submit payment"
        });
    }

    /// <summary>
    /// Override waiver requirement for a player (admin only)
    /// </summary>
    [HttpPost("waiver-override/{eventId}/{userId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> OverrideWaiver(int eventId, int userId, [FromBody] AdminWaiverOverrideRequest? request = null)
    {
        var currentUserId = GetUserId();
        if (currentUserId == 0) return Unauthorized();

        // Verify current user is TD/organizer
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Event not found" });

        var currentUser = await _context.Users.FindAsync(currentUserId);
        var isOrganizer = evt.OrganizedByUserId == currentUserId || currentUser?.Role == "Admin";

        if (!isOrganizer)
            return Forbid();

        // Get user's registrations
        var registrations = await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.UserId == userId && m.InviteStatus == "Accepted")
            .ToListAsync();

        if (!registrations.Any())
            return BadRequest(new ApiResponse<object> { Success = false, Message = "User is not registered for this event" });

        // Mark waiver as signed by admin
        foreach (var reg in registrations)
        {
            reg.WaiverSignedAt = DateTime.Now;
            reg.WaiverSignature = $"[Admin Override by {currentUser?.FirstName} {currentUser?.LastName}]";
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("TD {TdUserId} overrode waiver for user {UserId} at event {EventId}. Notes: {Notes}",
            currentUserId, userId, eventId, request?.Notes);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Waiver requirement overridden"
        });
    }

    /// <summary>
    /// Void waiver signature for a player (admin only)
    /// </summary>
    [HttpPost("waiver-void/{eventId}/{userId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> VoidWaiver(int eventId, int userId, [FromBody] AdminWaiverOverrideRequest? request = null)
    {
        var currentUserId = GetUserId();
        if (currentUserId == 0) return Unauthorized();

        // Verify current user is TD/organizer
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Event not found" });

        var currentUser = await _context.Users.FindAsync(currentUserId);
        var isOrganizer = evt.OrganizedByUserId == currentUserId || currentUser?.Role == "Admin";

        if (!isOrganizer)
            return Forbid();

        // Get user's registrations
        var registrations = await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.UserId == userId && m.InviteStatus == "Accepted")
            .ToListAsync();

        if (!registrations.Any())
            return BadRequest(new ApiResponse<object> { Success = false, Message = "User is not registered for this event" });

        // Remove waiver signature
        foreach (var reg in registrations)
        {
            reg.WaiverSignedAt = null;
            reg.WaiverSignature = null;
            reg.WaiverDocumentId = null;
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("TD {TdUserId} voided waiver for user {UserId} at event {EventId}. Notes: {Notes}",
            currentUserId, userId, eventId, request?.Notes);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Waiver signature voided"
        });
    }

    /// <summary>
    /// Get check-in status for a specific user (admin only) - for admin-initiated waiver signing
    /// </summary>
    [HttpGet("admin/status/{eventId}/{targetUserId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PlayerCheckInStatusDto>>> GetAdminCheckInStatus(int eventId, int targetUserId, [FromQuery] string? redo = null)
    {
        try
        {
            var currentUserId = GetUserId();
            if (currentUserId == 0) return Unauthorized();

            // Verify current user is TD/organizer
            var evt = await _context.Events.FindAsync(eventId);
            if (evt == null)
                return NotFound(new ApiResponse<PlayerCheckInStatusDto> { Success = false, Message = "Event not found" });

            var currentUser = await _context.Users.FindAsync(currentUserId);
            var isOrganizer = evt.OrganizedByUserId == currentUserId || currentUser?.Role == "Admin";

            if (!isOrganizer)
                return Forbid();

            // Check if redo mode is enabled (allows re-signing waiver)
            var redoWaiver = redo?.ToLower() == "waiver";

            // Get target user's registrations in this event
            var registrations = await _context.EventUnitMembers
                .Where(m => m.Unit!.EventId == eventId && m.UserId == targetUserId && m.InviteStatus == "Accepted")
                .Include(m => m.User)
                .Include(m => m.Unit)
                    .ThenInclude(u => u!.Division)
                        .ThenInclude(d => d!.SkillLevel)
                .Include(m => m.Unit)
                    .ThenInclude(u => u!.Members)
                        .ThenInclude(mem => mem.User)
                .ToListAsync();

            if (!registrations.Any())
            {
                return Ok(new ApiResponse<PlayerCheckInStatusDto>
                {
                    Success = true,
                    Data = new PlayerCheckInStatusDto
                    {
                        IsRegistered = false,
                        IsCheckedIn = false,
                        WaiverSigned = false
                    }
                });
            }

            // Get waivers from ObjectAssets
            var pendingWaiverDtos = new List<WaiverDto>();
            try
            {
                var eventObjectType = await _context.ObjectTypes
                    .FirstOrDefaultAsync(ot => ot.Name == "Event");

                if (eventObjectType != null)
                {
                    var waiverAssets = await _context.ObjectAssets
                        .Include(a => a.AssetType)
                        .Where(a => a.ObjectTypeId == eventObjectType.Id
                            && a.ObjectId == eventId
                            && a.AssetType != null
                            && a.AssetType.TypeName.ToLower() == "waiver")
                        .ToListAsync();

                    foreach (var asset in waiverAssets)
                    {
                        string content = "";
                        if (!string.IsNullOrEmpty(asset.FileUrl) && IsRenderableFile(asset.FileName))
                        {
                            content = await FetchFileContentAsync(asset.FileUrl);
                        }

                        pendingWaiverDtos.Add(new WaiverDto
                        {
                            Id = asset.Id,
                            Title = asset.Title,
                            FileName = asset.FileName,
                            FileUrl = GetFullUrl(asset.FileUrl),
                            Content = content
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error fetching waivers from ObjectAssets for event {EventId}", eventId);
            }

            var firstReg = registrations.First();
            var targetUser = firstReg.User;

            // Filter out already signed waivers (unless in redo mode)
            if (firstReg.WaiverSignedAt != null && !redoWaiver)
            {
                pendingWaiverDtos = pendingWaiverDtos
                    .Where(w => firstReg.WaiverDocumentId != w.Id)
                    .ToList();
            }

            // Get signed waiver PDF URL
            var signedPdfUrl = !string.IsNullOrEmpty(firstReg.SignedWaiverPdfUrl)
                ? GetFullUrl(firstReg.SignedWaiverPdfUrl)
                : null;

            // Build registration info for payment modal (from first unit)
            var firstUnit = firstReg.Unit!;
            var registrationDto = new CheckInRegistrationDto
            {
                UnitId = firstUnit.Id,
                DivisionName = firstUnit.Division?.Name,
                TeamUnitName = firstUnit.Name,
                SkillLevelName = firstUnit.Division?.SkillLevel?.Name,
                AmountDue = firstUnit.Division?.DivisionFee ?? 0m,
                AmountPaid = firstUnit.Members?.Where(m => m.InviteStatus == "Accepted").Sum(m => m.AmountPaid) ?? 0,
                PaymentStatus = firstUnit.PaymentStatus ?? "Pending",
                PaymentReference = firstReg.PaymentReference,
                PaymentProofUrl = firstReg.PaymentProofUrl,
                Members = firstUnit.Members?
                    .Where(m => m.InviteStatus == "Accepted")
                    .Select(m => new CheckInMemberDto
                    {
                        Id = m.Id,
                        UserId = m.UserId,
                        Name = m.User != null ? $"{m.User.FirstName} {m.User.LastName}".Trim() : null,
                        InviteStatus = m.InviteStatus,
                        HasPaid = m.HasPaid,
                        AmountPaid = m.AmountPaid,
                        PaidAt = m.PaidAt,
                        ReferenceId = m.ReferenceId,
                        PaymentReference = m.PaymentReference,
                        PaymentProofUrl = m.PaymentProofUrl
                    }).ToList() ?? new List<CheckInMemberDto>(),
                Partners = firstUnit.Members?
                    .Where(m => m.InviteStatus == "Accepted" && m.UserId != targetUserId)
                    .Select(m => new CheckInPartnerDto
                    {
                        UserId = m.UserId,
                        Name = m.User != null ? $"{m.User.FirstName} {m.User.LastName}".Trim() : null
                    }).ToList() ?? new List<CheckInPartnerDto>()
            };

            var statusData = new PlayerCheckInStatusDto
            {
                IsRegistered = true,
                IsCheckedIn = firstReg.IsCheckedIn,
                CheckInStatus = firstReg.CheckInStatus,
                WaiverSigned = firstReg.WaiverSignedAt != null,
                WaiverSignedAt = firstReg.WaiverSignedAt,
                SignedWaiverPdfUrl = signedPdfUrl,
                PendingWaivers = pendingWaiverDtos,
                HasPaid = firstReg.HasPaid,
                PaidAt = firstReg.PaidAt,
                AmountPaid = firstReg.AmountPaid,
                PlayerName = targetUser != null ? $"{targetUser.FirstName} {targetUser.LastName}".Trim() : null,
                PlayerEmail = targetUser?.Email,
                Registration = registrationDto
            };

            return Ok(new ApiResponse<PlayerCheckInStatusDto>
            {
                Success = true,
                Data = statusData
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting admin check-in status for event {EventId} user {UserId}", eventId, targetUserId);
            return StatusCode(500, new ApiResponse<PlayerCheckInStatusDto>
            {
                Success = false,
                Message = "An error occurred while getting check-in status"
            });
        }
    }

    /// <summary>
    /// Sign waiver on behalf of a player (admin only) - for in-person signing on admin's device
    /// </summary>
    [HttpPost("admin/waiver/{eventId}/{targetUserId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> AdminSignWaiver(int eventId, int targetUserId, [FromBody] SignWaiverRequest request)
    {
        var currentUserId = GetUserId();
        if (currentUserId == 0) return Unauthorized();

        // Verify current user is TD/organizer
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Event not found" });

        var currentUser = await _context.Users.FindAsync(currentUserId);
        var isOrganizer = evt.OrganizedByUserId == currentUserId || currentUser?.Role == "Admin";

        if (!isOrganizer)
            return Forbid();

        // Find waiver in ObjectAssets
        var objectAsset = await _context.ObjectAssets
            .Include(a => a.AssetType)
            .FirstOrDefaultAsync(a => a.Id == request.WaiverId
                && a.ObjectId == eventId
                && a.AssetType != null
                && a.AssetType.TypeName.ToLower() == "waiver");

        if (objectAsset == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Waiver not found" });

        // Fetch waiver content from file URL if available
        string waiverContent = "";
        if (!string.IsNullOrEmpty(objectAsset.FileUrl) && IsRenderableFile(objectAsset.FileName))
        {
            waiverContent = await FetchFileContentAsync(objectAsset.FileUrl);
        }

        // Get TARGET user info for legal record
        var targetUser = await _context.Users.FindAsync(targetUserId);
        if (targetUser == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Target user not found" });

        // Get target user's registrations
        var registrations = await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.UserId == targetUserId && m.InviteStatus == "Accepted")
            .ToListAsync();

        if (!registrations.Any())
            return BadRequest(new ApiResponse<object> { Success = false, Message = "User is not registered for this event" });

        // Validate typed signature
        if (string.IsNullOrWhiteSpace(request.Signature))
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Typed signature is required" });

        // Validate drawn signature
        if (string.IsNullOrWhiteSpace(request.SignatureImage))
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Drawn signature is required" });

        // Get IP address for legal record
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var signedAt = DateTime.Now;

        // Get first registration for reference ID
        var firstReg = registrations.First();

        // Generate reference ID in format E{eventId}-W{waiverId}-M{memberId}-U{userId}
        var referenceId = $"E{eventId}-W{objectAsset.Id}-M{firstReg.Id}-U{targetUserId}";

        // Get player name from TARGET user
        var playerName = $"{targetUser.FirstName} {targetUser.LastName}".Trim();
        if (string.IsNullOrEmpty(playerName))
            playerName = targetUser.Email ?? "Unknown";

        // Process signature: upload assets, generate PDF, call notification SP
        WaiverSigningResult? signingResult = null;
        try
        {
            var waiverDto = new WaiverDocumentDto
            {
                Id = objectAsset.Id,
                EventId = eventId,
                EventName = evt.Name,
                Title = objectAsset.Title,
                Content = waiverContent,
                PlayerName = playerName,
                ReferenceId = referenceId
            };

            signingResult = await _waiverPdfService.ProcessWaiverSignatureAsync(
                waiverDto,
                targetUser,  // Use target user, not current user
                request.Signature.Trim(),
                request.SignatureImage,
                signedAt,
                ipAddress,
                request.SignerRole,
                request.ParentGuardianName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process waiver signature for user {UserId} event {EventId}", targetUserId, eventId);
        }

        // Sign waiver for all registrations
        foreach (var reg in registrations)
        {
            reg.WaiverSignedAt = signedAt;
            reg.WaiverDocumentId = objectAsset.Id;
            reg.WaiverSignature = request.Signature.Trim();
        }

        await _context.SaveChangesAsync();

        // Update extended fields
        try
        {
            foreach (var reg in registrations)
            {
                reg.SignatureAssetUrl = signingResult?.SignatureAssetUrl;
                reg.SignedWaiverPdfUrl = signingResult?.SignedWaiverPdfUrl;
                reg.SignerEmail = targetUser.Email;
                reg.SignerIpAddress = ipAddress;
                reg.WaiverSignerRole = request.SignerRole;
                reg.ParentGuardianName = request.ParentGuardianName?.Trim();
            }
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not save extended waiver fields - migration may not have been run");
        }

        _logger.LogInformation("Admin {AdminId} signed waiver {WaiverId} for user {UserId} at event {EventId}",
            currentUserId, objectAsset.Id, targetUserId, eventId);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Waiver signed successfully",
            Data = new
            {
                SignedWaiverPdfUrl = signingResult?.SignedWaiverPdfUrl
            }
        });
    }

    /// <summary>
    /// Override payment status for a player (admin only)
    /// </summary>
    [HttpPost("payment-override/{eventId}/{userId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> OverridePayment(int eventId, int userId, [FromBody] AdminPaymentOverrideRequest request)
    {
        var currentUserId = GetUserId();
        if (currentUserId == 0) return Unauthorized();

        // Verify current user is TD/organizer
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Event not found" });

        var currentUser = await _context.Users.FindAsync(currentUserId);
        var isOrganizer = evt.OrganizedByUserId == currentUserId || currentUser?.Role == "Admin";

        if (!isOrganizer)
            return Forbid();

        // Get user's registrations
        var registrations = await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.UserId == userId && m.InviteStatus == "Accepted")
            .ToListAsync();

        if (!registrations.Any())
            return BadRequest(new ApiResponse<object> { Success = false, Message = "User is not registered for this event" });

        // Update payment status
        foreach (var reg in registrations)
        {
            reg.HasPaid = request.HasPaid;
            if (request.HasPaid)
            {
                reg.PaidAt = DateTime.Now;
                reg.AmountPaid = request.AmountPaid ?? 0;
            }
            else
            {
                reg.PaidAt = null;
                reg.AmountPaid = 0;
            }
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("TD {TdUserId} {Action} payment for user {UserId} at event {EventId}. Amount: {Amount}. Notes: {Notes}",
            currentUserId, request.HasPaid ? "marked" : "voided", userId, eventId, request.AmountPaid, request.Notes);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = request.HasPaid ? "Payment marked as paid" : "Payment voided"
        });
    }

    /// <summary>
    /// Send waiver signing request to a player (admin only)
    /// </summary>
    [HttpPost("send-waiver-request/{eventId}/{userId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> SendWaiverRequest(int eventId, int userId)
    {
        var currentUserId = GetUserId();
        if (currentUserId == 0) return Unauthorized();

        // Verify current user is TD/organizer
        var evt = await _context.Events
            .FirstOrDefaultAsync(e => e.Id == eventId);
        if (evt == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Event not found" });

        var currentUser = await _context.Users.FindAsync(currentUserId);
        var isOrganizer = evt.OrganizedByUserId == currentUserId || currentUser?.Role == "Admin";

        if (!isOrganizer)
            return Forbid();

        // Get target user
        var targetUser = await _context.Users.FindAsync(userId);
        if (targetUser == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "User not found" });

        // Check if user is registered
        var registration = await _context.EventUnitMembers
            .FirstOrDefaultAsync(m => m.Unit!.EventId == eventId && m.UserId == userId && m.InviteStatus == "Accepted");

        if (registration == null)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "User is not registered for this event" });

        // Check if waiver already signed
        if (registration.WaiverSignedAt != null)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "User has already signed the waiver" });

        // Get waiver documents for this event (ObjectAssets with AssetType "waiver")
        var eventObjectTypeId = await _context.ObjectTypes.Where(t => t.Name == "Event").Select(t => t.Id).FirstOrDefaultAsync();
        var waiverAssetTypeId = await _context.ObjectAssetTypes.Where(t => t.TypeName == "waiver").Select(t => t.Id).FirstOrDefaultAsync();
        var waivers = await _context.ObjectAssets
            .Where(a => a.ObjectTypeId == eventObjectTypeId && a.ObjectId == eventId && a.ObjectAssetTypeId == waiverAssetTypeId)
            .ToListAsync();
        if (!waivers.Any())
            return BadRequest(new ApiResponse<object> { Success = false, Message = "No active waivers found for this event" });

        // TODO: In the future, integrate with notification service to send email/push notification
        // For now, just log the request and return success (the UI can show the waiver link)
        _logger.LogInformation("Waiver request sent to user {UserId} ({Email}) for event {EventId} by admin {AdminId}",
            userId, targetUser.Email, eventId, currentUserId);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = $"Waiver request sent to {targetUser.FirstName}",
            Data = new
            {
                userId = targetUser.Id,
                email = targetUser.Email,
                firstName = targetUser.FirstName,
                eventId = eventId,
                waiverCount = waivers.Count
            }
        });
    }

    /// <summary>
    /// Delete an event document (TD only)
    /// </summary>
    [HttpDelete("documents/{eventId}/{documentId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteDocument(int eventId, int documentId)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        // Verify user is organizer
        var evt = await _context.Events.FirstOrDefaultAsync(e => e.Id == eventId);
        if (evt == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

        var currentUser = await _context.Users.FindAsync(userId.Value);
        var isOrganizer = evt.OrganizedByUserId == userId.Value || currentUser?.Role == "Admin";
        if (!isOrganizer)
            return Forbid();

        var document = await _context.EventWaivers
            .FirstOrDefaultAsync(w => w.Id == documentId && w.EventId == eventId);

        if (document == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Document not found" });

        // Soft delete - mark as inactive
        document.IsActive = false;
        document.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool>
        {
            Success = true,
            Data = true,
            Message = "Document deleted"
        });
    }

    /// <summary>
    /// Get public badge information for a registered player (no auth required)
    /// </summary>
    [HttpGet("badge/{memberId}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<PlayerBadgeDto>>> GetPlayerBadge(int memberId)
    {
        var member = await _context.EventUnitMembers
            .Include(m => m.User)
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Division)
                    .ThenInclude(d => d!.TeamUnit)
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Event)
            .FirstOrDefaultAsync(m => m.Id == memberId);

        if (member == null || member.Unit == null || member.User == null)
            return NotFound(new ApiResponse<PlayerBadgeDto> { Success = false, Message = "Registration not found" });

        var evt = member.Unit.Event;
        var division = member.Unit.Division;

        // Get waiver status
        var waiverCount = await _context.ObjectAssets
            .Include(a => a.AssetType)
            .CountAsync(a => a.ObjectId == evt!.Id
                && a.AssetType != null
                && a.AssetType.TypeName.ToLower() == "waiver");

        var signedWaiverCount = await _context.EventUnitMemberWaivers
            .CountAsync(w => w.EventUnitMemberId == memberId);

        var waiverSigned = waiverCount == 0 || signedWaiverCount >= waiverCount;

        // Get payment status
        var hasPaid = member.HasPaid || member.AmountPaid > 0;

        var badge = new PlayerBadgeDto
        {
            MemberId = memberId,
            ReferenceId = member.ReferenceId,
            PlayerName = $"{member.User.FirstName} {member.User.LastName}".Trim(),
            ProfileImageUrl = member.User.ProfileImageUrl,
            EventId = evt!.Id,
            EventName = evt.Name ?? "Event",
            EventStartDate = evt.StartDate,
            EventEndDate = evt.EndDate,
            VenueName = evt.VenueName,
            VenueAddress = string.Join(", ", new[] { evt.Address, evt.City, evt.State }.Where(s => !string.IsNullOrEmpty(s))),
            DivisionId = division?.Id ?? 0,
            DivisionName = division?.Name ?? "Division",
            TeamUnitName = division?.TeamUnit?.Name,
            UnitId = member.Unit.Id,
            UnitName = member.Unit.Name,
            IsCheckedIn = member.IsCheckedIn,
            CheckedInAt = member.CheckedInAt,
            WaiverSigned = waiverSigned,
            PaymentComplete = hasPaid,
            PosterImageUrl = evt.PosterImageUrl,
            CheckInUrl = $"https://pickleball.community/event/{evt.Id}/check-in"
        };

        return Ok(new ApiResponse<PlayerBadgeDto> { Success = true, Data = badge });
    }
}

// DTOs for Check-In
public class PlayerCheckInStatusDto
{
    public bool IsRegistered { get; set; }
    public bool IsCheckedIn { get; set; }
    public string? CheckInStatus { get; set; }
    public DateTime? CheckedInAt { get; set; }
    public bool WaiverSigned { get; set; }
    public DateTime? WaiverSignedAt { get; set; }
    public string? SignedWaiverPdfUrl { get; set; }
    public string? PlayerName { get; set; }
    public string? PlayerEmail { get; set; }
    public bool HasPaid { get; set; }
    public DateTime? PaidAt { get; set; }
    public decimal AmountPaid { get; set; }
    public List<WaiverDto> PendingWaivers { get; set; } = new();
    public List<CheckInDivisionDto> Divisions { get; set; } = new();
    /// <summary>
    /// Registration info for payment modal - includes first registration's unit/payment details
    /// </summary>
    public CheckInRegistrationDto? Registration { get; set; }
}

public class CheckInRegistrationDto
{
    public int UnitId { get; set; }
    public string? DivisionName { get; set; }
    public string? TeamUnitName { get; set; }
    public string? SkillLevelName { get; set; }
    public decimal AmountDue { get; set; }
    public decimal AmountPaid { get; set; }
    public string? PaymentStatus { get; set; }
    public string? PaymentReference { get; set; }
    public string? PaymentProofUrl { get; set; }
    public List<CheckInMemberDto> Members { get; set; } = new();
    public List<CheckInPartnerDto> Partners { get; set; } = new();
}

public class CheckInMemberDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string? Name { get; set; }
    public string? InviteStatus { get; set; }
    public bool HasPaid { get; set; }
    public decimal AmountPaid { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? ReferenceId { get; set; }
    public string? PaymentReference { get; set; }
    public string? PaymentProofUrl { get; set; }
}

public class CheckInPartnerDto
{
    public int UserId { get; set; }
    public string? Name { get; set; }
}

public class CheckInDivisionDto
{
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public bool IsCheckedIn { get; set; }
    public DateTime? CheckedInAt { get; set; }
}

public class WaiverDto
{
    public int Id { get; set; }
    public string DocumentType { get; set; } = "waiver";
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? FileUrl { get; set; }
    public string? FileName { get; set; }
    public int Version { get; set; }
    public bool IsRequired { get; set; }
    public bool RequiresMinorWaiver { get; set; }
    public int MinorAgeThreshold { get; set; }
}

/// <summary>
/// Represents a signed waiver record
/// </summary>
public class SignedWaiverDto
{
    public int Id { get; set; }
    public int WaiverId { get; set; }
    public string? WaiverTitle { get; set; }
    public DateTime SignedAt { get; set; }
    public string? SignedPdfUrl { get; set; }
    public string? SignerRole { get; set; }
}

public class SignWaiverRequest
{
    public int WaiverId { get; set; }
    /// <summary>
    /// Digital signature (typed full name)
    /// </summary>
    public string Signature { get; set; } = string.Empty;
    /// <summary>
    /// Drawn signature image (base64 encoded PNG)
    /// </summary>
    public string? SignatureImage { get; set; }
    /// <summary>
    /// Who is signing: Participant, Parent, Guardian
    /// </summary>
    public string SignerRole { get; set; } = "Participant";
    /// <summary>
    /// Parent/Guardian name if signing for a minor
    /// </summary>
    public string? ParentGuardianName { get; set; }
    /// <summary>
    /// Emergency contact phone
    /// </summary>
    public string? EmergencyPhone { get; set; }
    /// <summary>
    /// Chinese name (optional, for tournaments requiring it)
    /// </summary>
    public string? ChineseName { get; set; }
}

public class CheckInResultDto
{
    public DateTime CheckedInAt { get; set; }
    public int GamesNowReady { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class ManualCheckInRequest
{
    public string? Notes { get; set; }
    public bool SignWaiver { get; set; }
}

public class RequestCheckInDto
{
    /// <summary>
    /// Player confirms they have submitted payment
    /// </summary>
    public bool ConfirmPaymentSubmitted { get; set; }
}

public class EventCheckInSummaryDto
{
    public int TotalPlayers { get; set; }
    public int CheckedInCount { get; set; }
    public int WaiverSignedCount { get; set; }
    public int PaidCount { get; set; }
    public List<PlayerCheckInDto> Players { get; set; } = new();
}

public class PlayerCheckInDto
{
    public int UserId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? AvatarUrl { get; set; }
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public bool IsCheckedIn { get; set; }
    public DateTime? CheckedInAt { get; set; }

    // Self check-in request status
    public string CheckInStatus { get; set; } = "None"; // None, Requested, Approved, Rejected
    public DateTime? CheckInRequestedAt { get; set; }

    // Waiver details
    public bool WaiverSigned { get; set; }
    public DateTime? WaiverSignedAt { get; set; }
    public string? WaiverSignature { get; set; }
    public string? SignedWaiverPdfUrl { get; set; }
    public int? WaiverDocumentId { get; set; }

    // Payment details
    public bool HasPaid { get; set; }
    public decimal AmountPaid { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? PaymentReference { get; set; }
    public string? PaymentProofUrl { get; set; }
    public string? PaymentMethod { get; set; }
    public string? ReferenceId { get; set; }
    public int MemberId { get; set; } // EventUnitMember ID for editing
}

public class CreateWaiverRequest
{
    public int Id { get; set; } = 0; // 0 for new, >0 to update
    public string DocumentType { get; set; } = "waiver";
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public bool IsRequired { get; set; } = true;
    public bool RequiresMinorWaiver { get; set; } = false;
    public int MinorAgeThreshold { get; set; } = 18;
}

/// <summary>
/// Admin override request for check-in actions
/// </summary>
public class AdminCheckInOverrideRequest
{
    public string? Notes { get; set; }
}

/// <summary>
/// Admin override request for payment
/// </summary>
public class AdminPaymentOverrideRequest
{
    public bool HasPaid { get; set; }
    public decimal? AmountPaid { get; set; }
    public string? Notes { get; set; }
}

/// <summary>
/// Admin waiver override request
/// </summary>
public class AdminWaiverOverrideRequest
{
    public string? Notes { get; set; }
}

/// <summary>
/// Public badge information for a registered player
/// </summary>
public class PlayerBadgeDto
{
    public int MemberId { get; set; }
    public string? ReferenceId { get; set; }
    public string PlayerName { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public DateTime EventStartDate { get; set; }
    public DateTime? EventEndDate { get; set; }
    public string? VenueName { get; set; }
    public string? VenueAddress { get; set; }
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public string? TeamUnitName { get; set; }
    public int UnitId { get; set; }
    public string? UnitName { get; set; }
    public bool IsCheckedIn { get; set; }
    public DateTime? CheckedInAt { get; set; }
    public bool WaiverSigned { get; set; }
    public bool PaymentComplete { get; set; }
    public string? PosterImageUrl { get; set; }
    public string CheckInUrl { get; set; } = string.Empty;
}
