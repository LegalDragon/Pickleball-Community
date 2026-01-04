using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using System.Security.Claims;

namespace Pickleball.Community.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<NotificationsController> _logger;

    public NotificationsController(ApplicationDbContext context, ILogger<NotificationsController> logger)
    {
        _context = context;
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
                notification.ReadAt = DateTime.UtcNow;
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

            var now = DateTime.UtcNow;
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
    /// Create a notification for a user (Admin or System use)
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateNotification([FromBody] CreateNotificationDto dto)
    {
        try
        {
            // Validate user exists
            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null)
            {
                return BadRequest(new { success = false, message = "User not found" });
            }

            var notification = new Notification
            {
                UserId = dto.UserId,
                Type = dto.Type ?? "General",
                Title = dto.Title,
                Message = dto.Message,
                ActionUrl = dto.ActionUrl,
                ReferenceType = dto.ReferenceType,
                ReferenceId = dto.ReferenceId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };

            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, data = notification.Id });
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
            var notifications = dto.UserIds.Select(userId => new Notification
            {
                UserId = userId,
                Type = dto.Type ?? "System",
                Title = dto.Title,
                Message = dto.Message,
                ActionUrl = dto.ActionUrl,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            }).ToList();

            _context.Notifications.AddRange(notifications);
            await _context.SaveChangesAsync();

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
    public int UserId { get; set; }
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
