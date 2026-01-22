using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Pickleball.Community.Database;

namespace Pickleball.Community.Controllers.Base;

/// <summary>
/// Base controller for event-related operations.
/// Provides standardized authorization and helper methods.
/// </summary>
public abstract class EventControllerBase : ControllerBase
{
    protected readonly ApplicationDbContext _context;

    protected EventControllerBase(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Gets the current user's ID from the JWT claims
    /// </summary>
    protected int? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    /// <summary>
    /// Checks if the current user is an admin
    /// </summary>
    protected async Task<bool> IsAdminAsync()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return false;

        var user = await _context.Users.FindAsync(userId.Value);
        return user?.Role == "Admin";
    }

    /// <summary>
    /// Checks if a user is the organizer of an event
    /// </summary>
    protected async Task<bool> IsEventOrganizerAsync(int eventId, int userId)
    {
        var evt = await _context.Events.FindAsync(eventId);
        return evt?.OrganizedByUserId == userId;
    }

    /// <summary>
    /// Checks if the current user is the organizer of an event
    /// </summary>
    protected async Task<bool> IsEventOrganizerAsync(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return false;
        return await IsEventOrganizerAsync(eventId, userId.Value);
    }

    /// <summary>
    /// Checks if the current user can manage an event (is admin, organizer, or has CanFullyManageEvent staff permission)
    /// </summary>
    protected async Task<bool> CanManageEventAsync(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return false;

        // Admin can manage any event
        if (await IsAdminAsync()) return true;

        // Organizer can manage their event
        if (await IsEventOrganizerAsync(eventId, userId.Value)) return true;

        // Staff with CanFullyManageEvent permission can also manage
        var staff = await _context.EventStaff
            .Include(s => s.Role)
            .FirstOrDefaultAsync(s => s.EventId == eventId
                                   && s.UserId == userId.Value
                                   && s.Status == "Active"
                                   && s.Role != null
                                   && s.Role.CanFullyManageEvent);

        return staff != null;
    }

    /// <summary>
    /// Checks if a user has a specific staff permission for an event.
    /// Permission names match EventStaffRole properties:
    /// CanRecordScores, CanCheckInPlayers, CanManageCourts, CanManageSchedule,
    /// CanManageLineups, CanViewAllData, CanFullyManageEvent
    /// </summary>
    protected async Task<bool> HasStaffPermissionAsync(int eventId, int userId, string permission)
    {
        var staff = await _context.EventStaff
            .Include(s => s.Role)
            .FirstOrDefaultAsync(s => s.EventId == eventId
                                   && s.UserId == userId
                                   && s.Status == "Active"
                                   && s.Role != null);

        if (staff?.Role == null) return false;

        return permission switch
        {
            "CanRecordScores" => staff.Role.CanRecordScores,
            "CanCheckInPlayers" => staff.Role.CanCheckInPlayers,
            "CanManageCourts" => staff.Role.CanManageCourts,
            "CanManageSchedule" => staff.Role.CanManageSchedule,
            "CanManageLineups" => staff.Role.CanManageLineups,
            "CanViewAllData" => staff.Role.CanViewAllData,
            "CanFullyManageEvent" => staff.Role.CanFullyManageEvent,
            _ => false
        };
    }

    /// <summary>
    /// Checks if the current user has a specific staff permission for an event
    /// </summary>
    protected async Task<bool> HasStaffPermissionAsync(int eventId, string permission)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return false;
        return await HasStaffPermissionAsync(eventId, userId.Value, permission);
    }

    /// <summary>
    /// Returns an unauthorized response if user is not authenticated
    /// </summary>
    protected ActionResult UnauthorizedResponse(string message = "Unauthorized")
    {
        return Unauthorized(new { success = false, message });
    }

    /// <summary>
    /// Returns a not found response
    /// </summary>
    protected ActionResult NotFoundResponse(string message)
    {
        return NotFound(new { success = false, message });
    }

    /// <summary>
    /// Returns a bad request response
    /// </summary>
    protected ActionResult BadRequestResponse(string message)
    {
        return BadRequest(new { success = false, message });
    }

    /// <summary>
    /// Returns a success response
    /// </summary>
    protected ActionResult SuccessResponse(string message)
    {
        return Ok(new { success = true, message });
    }

    /// <summary>
    /// Returns a success response with data
    /// </summary>
    protected ActionResult SuccessResponse<T>(T data, string? message = null)
    {
        return Ok(new { success = true, data, message });
    }
}
