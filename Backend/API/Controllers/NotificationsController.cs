using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Services;
using System.Security.Claims;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly INotificationService _notificationService;
    private readonly ILogger<NotificationsController> _logger;

    public NotificationsController(
        ApplicationDbContext context,
        INotificationService notificationService,
        ILogger<NotificationsController> logger)
    {
        _context = context;
        _notificationService = notificationService;
        _logger = logger;
    }

    private int? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int userId))
        {
            return userId;
        }
        return null;
    }

    /// <summary>
    /// Get current user's notifications
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetNotifications(
        [FromQuery] bool? unreadOnly = null,
        [FromQuery] string? type = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { success = false, message = "Unauthorized" });
            }

            var query = _context.Notifications
                .Where(n => n.UserId == userId.Value)
                .AsQueryable();

            if (unreadOnly == true)
            {
                query = query.Where(n => !n.IsRead);
            }

            if (!string.IsNullOrEmpty(type))
            {
                query = query.Where(n => n.Type == type);
            }

            var totalCount = await query.CountAsync();
            var unreadCount = await _context.Notifications
                .CountAsync(n => n.UserId == userId.Value && !n.IsRead);

            var notifications = await query
                .OrderByDescending(n => n.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(n => new NotificationDto
                {
                    Id = n.Id,
                    Type = n.Type,
                    Title = n.Title,
                    Message = n.Message,
                    ActionUrl = n.ActionUrl,
                    ReferenceType = n.ReferenceType,
                    ReferenceId = n.ReferenceId,
                    IsRead = n.IsRead,
                    ReadAt = n.ReadAt,
                    CreatedAt = n.CreatedAt
                })
                .ToListAsync();

            return Ok(new
            {
                success = true,
                data = notifications,
                totalCount,
                unreadCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting notifications");
            return StatusCode(500, new { success = false, message = "Failed to load notifications" });
        }
    }

    /// <summary>
    /// Get unread notification count
    /// </summary>
    [HttpGet("count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { success = false, message = "Unauthorized" });
            }

            var count = await _context.Notifications
                .CountAsync(n => n.UserId == userId.Value && !n.IsRead);

            return Ok(new { success = true, data = count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting notification count");
            return StatusCode(500, new { success = false, message = "Failed to get count" });
        }
    }

    /// <summary>
    /// Mark a notification as read
    /// </summary>
    [HttpPut("{id}/read")]
    public async Task<IActionResult> MarkAsRead(int id)
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { success = false, message = "Unauthorized" });
            }

            var notification = await _context.Notifications
                .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId.Value);

            if (notification == null)
            {
                return NotFound(new { success = false, message = "Notification not found" });
            }

            if (!notification.IsRead)
            {
                notification.IsRead = true;
                notification.ReadAt = DateTime.Now;
                await _context.SaveChangesAsync();
            }

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking notification as read");
            return StatusCode(500, new { success = false, message = "Failed to update notification" });
        }
    }

    /// <summary>
    /// Mark all notifications as read
    /// </summary>
    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { success = false, message = "Unauthorized" });
            }

            var now = DateTime.Now;
            var unreadNotifications = await _context.Notifications
                .Where(n => n.UserId == userId.Value && !n.IsRead)
                .ToListAsync();

            foreach (var notification in unreadNotifications)
            {
                notification.IsRead = true;
                notification.ReadAt = now;
            }

            await _context.SaveChangesAsync();

            return Ok(new { success = true, count = unreadNotifications.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking all notifications as read");
            return StatusCode(500, new { success = false, message = "Failed to update notifications" });
        }
    }

    /// <summary>
    /// Delete a notification
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteNotification(int id)
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { success = false, message = "Unauthorized" });
            }

            var notification = await _context.Notifications
                .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId.Value);

            if (notification == null)
            {
                return NotFound(new { success = false, message = "Notification not found" });
            }

            _context.Notifications.Remove(notification);
            await _context.SaveChangesAsync();

            _logger.LogInformation("User {UserId} deleted notification {NotificationId}", userId.Value, id);

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting notification {Id}", id);
            return StatusCode(500, new { success = false, message = "Failed to delete notification" });
        }
    }

    /// <summary>
    /// Delete all read notifications
    /// </summary>
    [HttpDelete("read")]
    public async Task<IActionResult> DeleteReadNotifications()
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { success = false, message = "Unauthorized" });
            }

            var readNotifications = await _context.Notifications
                .Where(n => n.UserId == userId.Value && n.IsRead)
                .ToListAsync();

            _context.Notifications.RemoveRange(readNotifications);
            await _context.SaveChangesAsync();

            _logger.LogInformation("User {UserId} deleted {Count} read notifications", userId.Value, readNotifications.Count);

            return Ok(new { success = true, count = readNotifications.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting read notifications");
            return StatusCode(500, new { success = false, message = "Failed to delete notifications" });
        }
    }

    /// <summary>
    /// Send a test notification to yourself (tests both SignalR and Web Push)
    /// Creates a real notification in the database
    /// </summary>
    [HttpPost("test")]
    public async Task<IActionResult> SendTestNotification()
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { success = false, message = "Unauthorized" });
            }

            // Create and send notification - this uses NotificationService which:
            // 1. Saves to database
            // 2. Sends via SignalR (if user is connected)
            // 3. Sends via Web Push (if user has subscriptions)
            var notification = await _notificationService.CreateAndSendAsync(
                userId.Value,
                "Test",
                "Test Notification",
                "This is a test notification sent via both SignalR and Web Push!",
                "/notifications");

            _logger.LogInformation("Test notification sent to user {UserId}", userId.Value);

            return Ok(new {
                success = true,
                message = "Test notification sent via SignalR and Web Push",
                notificationId = notification.Id
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending test notification");
            return StatusCode(500, new { success = false, message = "Failed to send test notification" });
        }
    }

    /// <summary>
    /// Delete all notifications
    /// </summary>
    [HttpDelete("all")]
    public async Task<IActionResult> DeleteAllNotifications()
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { success = false, message = "Unauthorized" });
            }

            var notifications = await _context.Notifications
                .Where(n => n.UserId == userId.Value)
                .ToListAsync();

            _context.Notifications.RemoveRange(notifications);
            await _context.SaveChangesAsync();

            _logger.LogInformation("User {UserId} deleted all {Count} notifications", userId.Value, notifications.Count);

            return Ok(new { success = true, count = notifications.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting all notifications");
            return StatusCode(500, new { success = false, message = "Failed to delete notifications" });
        }
    }

    // ==================== ADMIN/SYSTEM ENDPOINTS ====================

    /// <summary>
    /// Create and send a notification (Admin only)
    /// Supports different target types: user, game, event, club, broadcast
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateNotification([FromBody] CreateNotificationDto dto)
    {
        try
        {
            var targetType = dto.TargetType?.ToLowerInvariant() ?? "user";
            var payload = new NotificationPayload
            {
                Type = dto.Type ?? "System",
                Title = dto.Title,
                Message = dto.Message,
                ActionUrl = dto.ActionUrl,
                ReferenceType = dto.ReferenceType,
                ReferenceId = dto.ReferenceId,
                CreatedAt = DateTime.Now
            };

            switch (targetType)
            {
                case "user":
                    // Validate user exists
                    if (!dto.TargetId.HasValue)
                    {
                        return BadRequest(new { success = false, message = "TargetId (UserId) is required for user notifications" });
                    }
                    var user = await _context.Users.FindAsync(dto.TargetId.Value);
                    if (user == null)
                    {
                        return BadRequest(new { success = false, message = "User not found" });
                    }
                    // Create and save to DB, then push via SignalR
                    var notification = await _notificationService.CreateAndSendAsync(
                        dto.TargetId.Value,
                        dto.Type ?? "System",
                        dto.Title,
                        dto.Message,
                        dto.ActionUrl,
                        dto.ReferenceType,
                        dto.ReferenceId
                    );
                    _logger.LogInformation("Notification sent to user {UserId}: {Title}", dto.TargetId.Value, dto.Title);
                    return Ok(new { success = true, data = notification.Id, message = "Notification sent to user" });

                case "game":
                    // Game notifications are real-time only (for live score updates) - no DB save
                    if (!dto.TargetId.HasValue)
                    {
                        return BadRequest(new { success = false, message = "TargetId (GameId) is required for game notifications" });
                    }
                    await _notificationService.SendToGameAsync(dto.TargetId.Value, payload);
                    _logger.LogInformation("Game score update sent to game group {GameId}: {Title}", dto.TargetId.Value, dto.Title);
                    return Ok(new { success = true, message = $"Game update sent to game group {dto.TargetId.Value} (real-time only)" });

                case "event":
                    // Event notifications: Save to DB for all registered users + real-time push
                    if (!dto.TargetId.HasValue)
                    {
                        return BadRequest(new { success = false, message = "TargetId (EventId) is required for event notifications" });
                    }
                    var eventUserIds = await _context.EventRegistrations
                        .Where(r => r.EventId == dto.TargetId.Value)
                        .Select(r => r.UserId)
                        .Distinct()
                        .ToListAsync();
                    if (eventUserIds.Count > 0)
                    {
                        await _notificationService.CreateAndSendToUsersAsync(
                            eventUserIds, dto.Type ?? "Event", dto.Title, dto.Message,
                            dto.ActionUrl, "Event", dto.TargetId.Value);
                    }
                    // Also send via SignalR group for any connected watchers
                    await _notificationService.SendToEventAsync(dto.TargetId.Value, payload);
                    _logger.LogInformation("Notification sent to event {EventId} ({Count} registered users): {Title}",
                        dto.TargetId.Value, eventUserIds.Count, dto.Title);
                    return Ok(new { success = true, message = $"Notification sent to {eventUserIds.Count} event registrants" });

                case "club":
                    // Club notifications: Save to DB for all club members + real-time push
                    if (!dto.TargetId.HasValue)
                    {
                        return BadRequest(new { success = false, message = "TargetId (ClubId) is required for club notifications" });
                    }
                    var clubUserIds = await _context.ClubMembers
                        .Where(m => m.ClubId == dto.TargetId.Value)
                        .Select(m => m.UserId)
                        .Distinct()
                        .ToListAsync();
                    if (clubUserIds.Count > 0)
                    {
                        await _notificationService.CreateAndSendToUsersAsync(
                            clubUserIds, dto.Type ?? "Club", dto.Title, dto.Message,
                            dto.ActionUrl, "Club", dto.TargetId.Value);
                    }
                    // Also send via SignalR group for any connected watchers
                    await _notificationService.SendToClubAsync(dto.TargetId.Value, payload);
                    _logger.LogInformation("Notification sent to club {ClubId} ({Count} members): {Title}",
                        dto.TargetId.Value, clubUserIds.Count, dto.Title);
                    return Ok(new { success = true, message = $"Notification sent to {clubUserIds.Count} club members" });

                case "broadcast":
                    // Broadcast: Save to DB for all active users + real-time push
                    var allUserIds = await _context.Users
                        .Where(u => u.IsActive)
                        .Select(u => u.Id)
                        .ToListAsync();
                    if (allUserIds.Count > 0)
                    {
                        await _notificationService.CreateAndSendToUsersAsync(
                            allUserIds, dto.Type ?? "Announcement", dto.Title, dto.Message,
                            dto.ActionUrl, null, null);
                    }
                    // Also broadcast via SignalR for immediate delivery
                    await _notificationService.BroadcastAsync(payload);
                    _logger.LogInformation("Notification broadcast to all {Count} users: {Title}", allUserIds.Count, dto.Title);
                    return Ok(new { success = true, message = $"Notification broadcast to {allUserIds.Count} users" });

                default:
                    return BadRequest(new { success = false, message = $"Invalid target type: {targetType}" });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating notification");
            return StatusCode(500, new { success = false, message = "Failed to create notification" });
        }
    }

    /// <summary>
    /// Send notification to multiple users (Admin only)
    /// </summary>
    [HttpPost("broadcast")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> BroadcastNotification([FromBody] BroadcastNotificationDto dto)
    {
        try
        {
            var notifications = new List<Notification>();
            var now = DateTime.Now;

            foreach (var userId in dto.UserIds)
            {
                var notification = new Notification
                {
                    UserId = userId,
                    Type = dto.Type ?? "System",
                    Title = dto.Title,
                    Message = dto.Message,
                    ActionUrl = dto.ActionUrl,
                    IsRead = false,
                    CreatedAt = now
                };
                notifications.Add(notification);
            }

            _context.Notifications.AddRange(notifications);
            await _context.SaveChangesAsync();

            // Push to all users via SignalR
            var payload = new NotificationPayload
            {
                Type = dto.Type ?? "System",
                Title = dto.Title,
                Message = dto.Message,
                ActionUrl = dto.ActionUrl,
                CreatedAt = now
            };
            await _notificationService.SendToUsersAsync(dto.UserIds, payload);

            return Ok(new { success = true, count = notifications.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error broadcasting notification");
            return StatusCode(500, new { success = false, message = "Failed to send notifications" });
        }
    }
}

// DTOs
public class NotificationDto
{
    public int Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Message { get; set; }
    public string? ActionUrl { get; set; }
    public string? ReferenceType { get; set; }
    public int? ReferenceId { get; set; }
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateNotificationDto
{
    /// <summary>
    /// Target type: user, game, event, club, broadcast
    /// </summary>
    public string? TargetType { get; set; } = "user";

    /// <summary>
    /// Target ID (UserId for user, GameId for game, EventId for event, ClubId for club)
    /// Not required for broadcast
    /// </summary>
    public int? TargetId { get; set; }

    public string? Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Message { get; set; }
    public string? ActionUrl { get; set; }
    public string? ReferenceType { get; set; }
    public int? ReferenceId { get; set; }
}

public class BroadcastNotificationDto
{
    public List<int> UserIds { get; set; } = new();
    public string? Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Message { get; set; }
    public string? ActionUrl { get; set; }
}
