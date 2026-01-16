using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Services;
using System.Security.Claims;

namespace Pickleball.Community.Controllers;

[Route("[controller]")]
[ApiController]
public class CheckInController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<CheckInController> _logger;
    private readonly IWaiverPdfService _waiverPdfService;
    private readonly IHttpClientFactory _httpClientFactory;

    public CheckInController(ApplicationDbContext context, ILogger<CheckInController> logger, IWaiverPdfService waiverPdfService, IHttpClientFactory httpClientFactory)
    {
        _context = context;
        _logger = logger;
        _waiverPdfService = waiverPdfService;
        _httpClientFactory = httpClientFactory;
    }

    // Helper to check if file is renderable (md/html)
    private static bool IsRenderableFile(string? fileName)
    {
        if (string.IsNullOrEmpty(fileName)) return false;
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext == ".md" || ext == ".html" || ext == ".htm";
    }

    // Fetch content from URL for renderable files
    private async Task<string> FetchFileContentAsync(string url)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            var response = await client.GetAsync(url);
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync();
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch waiver content from {Url}", url);
        }
        return string.Empty;
    }

    private int GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
        return int.TryParse(userIdClaim, out var id) ? id : 0;
    }

    /// <summary>
    /// Get check-in status for current user at an event
    /// </summary>
    [HttpGet("status/{eventId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PlayerCheckInStatusDto>>> GetCheckInStatus(int eventId)
    {
        try
        {
            var userId = GetUserId();
            if (userId == 0) return Unauthorized();

            // Get user's registrations in this event
            var registrations = await _context.EventUnitMembers
                .Where(m => m.Unit!.EventId == eventId && m.UserId == userId && m.InviteStatus == "Accepted")
                .Include(m => m.Unit)
                    .ThenInclude(u => u!.Division)
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

            // Fallback to legacy EventWaivers table if no ObjectAssets found
            if (!pendingWaiverDtos.Any())
            {
                try
                {
                    var legacyWaivers = await _context.EventWaivers
                        .Where(w => w.EventId == eventId && w.IsActive && w.IsRequired)
                        .ToListAsync();

                    pendingWaiverDtos = legacyWaivers.Select(w => new WaiverDto
                    {
                        Id = w.Id,
                        DocumentType = "waiver",
                        Title = w.Title,
                        Content = w.Content,
                        Version = w.Version,
                        IsRequired = w.IsRequired,
                        RequiresMinorWaiver = w.RequiresMinorWaiver,
                        MinorAgeThreshold = w.MinorAgeThreshold
                    }).ToList();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Could not query EventWaivers table - it may not exist yet");
                }
            }

            var firstReg = registrations.First();
            var allWaiversSigned = !pendingWaiverDtos.Any() || firstReg.WaiverSignedAt != null;

            // Filter out already signed waivers
            if (firstReg.WaiverSignedAt != null)
            {
                pendingWaiverDtos = pendingWaiverDtos
                    .Where(w => firstReg.WaiverDocumentId != w.Id)
                    .ToList();
            }

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
                    PendingWaivers = pendingWaiverDtos,
                    Divisions = registrations.Select(r => new CheckInDivisionDto
                    {
                        DivisionId = r.Unit!.DivisionId,
                        DivisionName = r.Unit.Division?.Name ?? "",
                        UnitId = r.UnitId,
                        UnitName = r.Unit.Name,
                        IsCheckedIn = r.IsCheckedIn,
                        CheckedInAt = r.CheckedInAt
                    }).ToList()
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
        if (userId == 0) return Unauthorized();

        // Verify waiver exists and is active
        var waiver = await _context.EventWaivers
            .Include(w => w.Event)
            .FirstOrDefaultAsync(w => w.Id == request.WaiverId && w.EventId == eventId && w.IsActive);

        if (waiver == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Waiver not found" });

        // Get user info for legal record
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "User not found" });

        // Get user's registrations
        var registrations = await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.UserId == userId && m.InviteStatus == "Accepted")
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

        // Process signature: upload to S3, generate PDF, call notification SP
        WaiverSigningResult? signingResult = null;
        try
        {
            signingResult = await _waiverPdfService.ProcessWaiverSignatureAsync(
                waiver,
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

        // Sign waiver for all registrations
        foreach (var reg in registrations)
        {
            reg.WaiverSignedAt = signedAt;
            reg.WaiverDocumentId = waiver.Id;
            reg.WaiverSignature = request.Signature.Trim();
            reg.SignatureAssetUrl = signingResult?.SignatureAssetUrl;
            reg.SignedWaiverPdfUrl = signingResult?.SignedWaiverPdfUrl;
            reg.SignerEmail = user.Email;
            reg.SignerIpAddress = ipAddress;
            reg.WaiverSignerRole = request.SignerRole;
            reg.ParentGuardianName = request.ParentGuardianName?.Trim();
            reg.EmergencyPhone = request.EmergencyPhone?.Trim();
            reg.ChineseName = request.ChineseName?.Trim();
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("User {UserId} signed waiver {WaiverId} for event {EventId} with signature '{Signature}'",
            userId, waiver.Id, eventId, request.Signature);

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
    /// Check in to an event (self check-in)
    /// </summary>
    [HttpPost("{eventId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<CheckInResultDto>>> CheckIn(int eventId)
    {
        try
        {
            var userId = GetUserId();
            if (userId == 0) return Unauthorized();

            // Verify user is registered
            var registrations = await _context.EventUnitMembers
                .Where(m => m.Unit!.EventId == eventId && m.UserId == userId && m.InviteStatus == "Accepted")
                .Include(m => m.Unit)
                .ToListAsync();

            if (!registrations.Any())
                return BadRequest(new ApiResponse<CheckInResultDto> { Success = false, Message = "Not registered for this event" });

            // Check if waiver is required but not signed (gracefully handle missing table)
            try
            {
                var pendingWaivers = await _context.EventWaivers
                    .Where(w => w.EventId == eventId && w.IsActive && w.IsRequired)
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
                _logger.LogWarning(ex, "Could not query EventWaivers table - skipping waiver check");
            }

            // Create or update event-level check-in (gracefully handle missing table)
            try
            {
                var existingCheckIn = await _context.EventCheckIns
                    .FirstOrDefaultAsync(c => c.EventId == eventId && c.UserId == userId);

                if (existingCheckIn == null)
                {
                    existingCheckIn = new EventCheckIn
                    {
                        EventId = eventId,
                        UserId = userId,
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
                        .Include(g => g.Match)
                            .ThenInclude(m => m!.Unit1)
                                .ThenInclude(u => u!.Members)
                        .Include(g => g.Match)
                            .ThenInclude(m => m!.Unit2)
                                .ThenInclude(u => u!.Members)
                        .Where(g => g.Status == "New" &&
                            (g.Match!.Unit1Id == unit.Id || g.Match.Unit2Id == unit.Id))
                        .ToListAsync();

                    foreach (var game in games)
                    {
                        var unit1Members = game.Match!.Unit1?.Members.Where(m => m.InviteStatus == "Accepted").ToList() ?? new List<EventUnitMember>();
                        var unit2Members = game.Match!.Unit2?.Members.Where(m => m.InviteStatus == "Accepted").ToList() ?? new List<EventUnitMember>();

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
        if (userId == 0) return Unauthorized();

        // Verify user is TD/organizer
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<EventCheckInSummaryDto> { Success = false, Message = "Event not found" });

        var currentUser = await _context.Users.FindAsync(userId);
        var isOrganizer = evt.OrganizedByUserId == userId || currentUser?.Role == "Admin";

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
                WaiverSigned = m.WaiverSignedAt != null,
                WaiverSignedAt = m.WaiverSignedAt,
                HasPaid = m.HasPaid
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
    /// Get waivers for an event (legacy - returns only waiver type documents)
    /// </summary>
    [HttpGet("waivers/{eventId}")]
    public async Task<ActionResult<ApiResponse<List<WaiverDto>>>> GetEventWaivers(int eventId)
    {
        var waivers = await _context.EventWaivers
            .Where(w => w.EventId == eventId && w.IsActive && (w.DocumentType == "waiver" || w.DocumentType == null))
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
        if (userId == 0) return Unauthorized();

        // Verify user is organizer
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<WaiverDto> { Success = false, Message = "Event not found" });

        var currentUser = await _context.Users.FindAsync(userId);
        var isOrganizer = evt.OrganizedByUserId == userId || currentUser?.Role == "Admin";

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
        if (userId == 0) return Unauthorized();

        // Verify user is organizer
        var evt = await _context.Events.FirstOrDefaultAsync(e => e.Id == eventId);
        if (evt == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

        var isOrganizer = evt.OrganizedByUserId == userId;
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
        if (userId == 0) return Unauthorized();

        // Verify user is organizer
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return NotFound(new ApiResponse<WaiverDto> { Success = false, Message = "Event not found" });

        var currentUser = await _context.Users.FindAsync(userId);
        var isOrganizer = evt.OrganizedByUserId == userId || currentUser?.Role == "Admin";

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
    /// Delete an event document (TD only)
    /// </summary>
    [HttpDelete("documents/{eventId}/{documentId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteDocument(int eventId, int documentId)
    {
        var userId = GetUserId();
        if (userId == 0) return Unauthorized();

        // Verify user is organizer
        var evt = await _context.Events.FirstOrDefaultAsync(e => e.Id == eventId);
        if (evt == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

        var currentUser = await _context.Users.FindAsync(userId);
        var isOrganizer = evt.OrganizedByUserId == userId || currentUser?.Role == "Admin";
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
}

// DTOs for Check-In
public class PlayerCheckInStatusDto
{
    public bool IsRegistered { get; set; }
    public bool IsCheckedIn { get; set; }
    public DateTime? CheckedInAt { get; set; }
    public bool WaiverSigned { get; set; }
    public DateTime? WaiverSignedAt { get; set; }
    public List<WaiverDto> PendingWaivers { get; set; } = new();
    public List<CheckInDivisionDto> Divisions { get; set; } = new();
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
    public bool WaiverSigned { get; set; }
    public DateTime? WaiverSignedAt { get; set; }
    public bool HasPaid { get; set; }
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
