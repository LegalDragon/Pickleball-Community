using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using System.Security.Claims;

namespace Pickleball.Community.Controllers;

[Route("[controller]")]
[ApiController]
public class CheckInController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<CheckInController> _logger;

    public CheckInController(ApplicationDbContext context, ILogger<CheckInController> logger)
    {
        _context = context;
        _logger = logger;
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
        var userId = GetUserId();
        if (userId == 0) return Unauthorized();

        // Get user's registrations in this event
        var registrations = await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.UserId == userId && m.InviteStatus == "Accepted")
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Division)
            .Include(m => m.WaiverDocument)
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

        // Get event check-in record
        var checkIn = await _context.EventCheckIns
            .FirstOrDefaultAsync(c => c.EventId == eventId && c.UserId == userId);

        // Get event waivers
        var waivers = await _context.EventWaivers
            .Where(w => w.EventId == eventId && w.IsActive && w.IsRequired)
            .ToListAsync();

        var firstReg = registrations.First();
        var allWaiversSigned = !waivers.Any() || firstReg.WaiverSignedAt != null;

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
                PendingWaivers = waivers
                    .Where(w => firstReg.WaiverSignedAt == null || firstReg.WaiverDocumentId != w.Id)
                    .Select(w => new WaiverDto
                    {
                        Id = w.Id,
                        Title = w.Title,
                        Content = w.Content,
                        Version = w.Version,
                        IsRequired = w.IsRequired,
                        RequiresMinorWaiver = w.RequiresMinorWaiver,
                        MinorAgeThreshold = w.MinorAgeThreshold
                    }).ToList(),
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
            .FirstOrDefaultAsync(w => w.Id == request.WaiverId && w.EventId == eventId && w.IsActive);

        if (waiver == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Waiver not found" });

        // Get user's registrations
        var registrations = await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.UserId == userId && m.InviteStatus == "Accepted")
            .ToListAsync();

        if (!registrations.Any())
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Not registered for this event" });

        // Validate signature
        if (string.IsNullOrWhiteSpace(request.Signature))
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Signature is required" });

        // Sign waiver for all registrations
        foreach (var reg in registrations)
        {
            reg.WaiverSignedAt = DateTime.Now;
            reg.WaiverDocumentId = waiver.Id;
            reg.WaiverSignature = request.Signature.Trim();
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
            Message = "Waiver signed successfully"
        });
    }

    /// <summary>
    /// Check in to an event (self check-in)
    /// </summary>
    [HttpPost("{eventId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<CheckInResultDto>>> CheckIn(int eventId)
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

        // Check if waiver is required but not signed
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

        // Create or update event-level check-in
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

        // Update all unit member check-ins
        foreach (var reg in registrations)
        {
            reg.IsCheckedIn = true;
            reg.CheckedInAt = DateTime.Now;
        }

        // Check if this makes any games ready
        var readyGames = new List<int>();
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
    /// Get waivers for an event
    /// </summary>
    [HttpGet("waivers/{eventId}")]
    public async Task<ActionResult<ApiResponse<List<WaiverDto>>>> GetEventWaivers(int eventId)
    {
        var waivers = await _context.EventWaivers
            .Where(w => w.EventId == eventId && w.IsActive)
            .Select(w => new WaiverDto
            {
                Id = w.Id,
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
    /// Create or update a waiver (TD only)
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
    /// Delete a waiver (TD only)
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
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
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
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public bool IsRequired { get; set; } = true;
    public bool RequiresMinorWaiver { get; set; } = false;
    public int MinorAgeThreshold { get; set; } = 18;
}
