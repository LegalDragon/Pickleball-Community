using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pickleball.Community.Services;
using Pickleball.Community.Hubs;
using System.Security.Claims;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class PushController : ControllerBase
{
    private readonly IPushNotificationService _pushService;
    private readonly ILogger<PushController> _logger;

    public PushController(
        IPushNotificationService pushService,
        ILogger<PushController> logger)
    {
        _pushService = pushService;
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
    /// Get the VAPID public key for subscribing to push notifications
    /// </summary>
    [HttpGet("vapid-public-key")]
    [AllowAnonymous]
    public IActionResult GetVapidPublicKey()
    {
        try
        {
            var publicKey = _pushService.GetPublicKey();
            return Ok(new { success = true, data = publicKey });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting VAPID public key");
            return StatusCode(500, new { success = false, message = "Push notifications not configured" });
        }
    }

    /// <summary>
    /// Subscribe current user's device to push notifications
    /// </summary>
    [HttpPost("subscribe")]
    [Authorize]
    public async Task<IActionResult> Subscribe([FromBody] PushSubscriptionDto dto)
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { success = false, message = "Unauthorized" });
            }

            var subscription = await _pushService.SubscribeAsync(
                userId.Value,
                dto.Endpoint,
                dto.Keys.P256dh,
                dto.Keys.Auth,
                dto.UserAgent,
                dto.DeviceName);

            return Ok(new { success = true, data = new { id = subscription.Id } });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error subscribing to push notifications");
            return StatusCode(500, new { success = false, message = "Failed to subscribe" });
        }
    }

    /// <summary>
    /// Unsubscribe current user's device from push notifications
    /// </summary>
    [HttpPost("unsubscribe")]
    [Authorize]
    public async Task<IActionResult> Unsubscribe([FromBody] UnsubscribeDto dto)
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { success = false, message = "Unauthorized" });
            }

            var success = await _pushService.UnsubscribeAsync(userId.Value, dto.Endpoint);
            return Ok(new { success });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unsubscribing from push notifications");
            return StatusCode(500, new { success = false, message = "Failed to unsubscribe" });
        }
    }

    /// <summary>
    /// Unsubscribe all devices for current user
    /// </summary>
    [HttpDelete("subscriptions")]
    [Authorize]
    public async Task<IActionResult> UnsubscribeAll()
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { success = false, message = "Unauthorized" });
            }

            var count = await _pushService.UnsubscribeAllAsync(userId.Value);
            return Ok(new { success = true, count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unsubscribing all devices");
            return StatusCode(500, new { success = false, message = "Failed to unsubscribe" });
        }
    }

    /// <summary>
    /// Get all subscriptions for current user
    /// </summary>
    [HttpGet("subscriptions")]
    [Authorize]
    public async Task<IActionResult> GetSubscriptions()
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { success = false, message = "Unauthorized" });
            }

            var subscriptions = await _pushService.GetSubscriptionsAsync(userId.Value);
            return Ok(new
            {
                success = true,
                data = subscriptions.Select(s => new
                {
                    s.Id,
                    s.DeviceName,
                    s.UserAgent,
                    s.CreatedAt,
                    s.LastUsedAt
                })
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting subscriptions");
            return StatusCode(500, new { success = false, message = "Failed to get subscriptions" });
        }
    }

    /// <summary>
    /// Test push notification to current user (for testing)
    /// </summary>
    [HttpPost("test")]
    [Authorize]
    public async Task<IActionResult> TestPush()
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { success = false, message = "Unauthorized" });
            }

            var count = await _pushService.SendToUserAsync(
                userId.Value,
                "Test Notification",
                "This is a test push notification from Pickleball Community!",
                "/notifications");

            return Ok(new { success = true, sentTo = count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending test push notification");
            return StatusCode(500, new { success = false, message = "Failed to send test notification" });
        }
    }
    /// <summary>
    /// Admin: Send push notification to specific users
    /// </summary>
    [HttpPost("send")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AdminSendPush([FromBody] AdminPushRequest dto)
    {
        try
        {
            if (dto.UserIds == null || dto.UserIds.Length == 0)
            {
                return BadRequest(new { success = false, message = "At least one user ID is required" });
            }

            if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Body))
            {
                return BadRequest(new { success = false, message = "Title and body are required" });
            }

            var count = await _pushService.SendToUsersAsync(
                dto.UserIds,
                dto.Title,
                dto.Body,
                dto.Url);

            _logger.LogInformation("Admin sent push to {UserCount} users ({SentCount} subscriptions): {Title}",
                dto.UserIds.Length, count, dto.Title);

            return Ok(new { success = true, sentTo = count, targetUsers = dto.UserIds.Length });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending admin push notification");
            return StatusCode(500, new { success = false, message = $"Failed to send push notification: {ex.Message}", detail = ex.ToString() });
        }
    }

    /// <summary>
    /// Admin: Send push notification to all currently online users
    /// </summary>
    [HttpPost("send-online")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AdminSendPushToOnline([FromBody] AdminPushOnlineRequest dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Body))
            {
                return BadRequest(new { success = false, message = "Title and body are required" });
            }

            var onlineUserIds = NotificationHub.GetAllConnectedUserIds();

            if (onlineUserIds.Count == 0)
            {
                return Ok(new { success = true, sentTo = 0, onlineUsers = 0, message = "No users currently online" });
            }

            var count = await _pushService.SendToUsersAsync(
                onlineUserIds,
                dto.Title,
                dto.Body,
                dto.Url);

            _logger.LogInformation("Admin sent push to {OnlineCount} online users ({SentCount} subscriptions): {Title}",
                onlineUserIds.Count, count, dto.Title);

            return Ok(new { success = true, sentTo = count, onlineUsers = onlineUserIds.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending admin push to online users");
            return StatusCode(500, new { success = false, message = $"Failed to send push notification: {ex.Message}", detail = ex.ToString() });
        }
    }
}

// DTOs
public class AdminPushRequest
{
    public int[] UserIds { get; set; } = Array.Empty<int>();
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? Url { get; set; }
}

public class AdminPushOnlineRequest
{
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? Url { get; set; }
}

public class PushSubscriptionDto
{
    public string Endpoint { get; set; } = string.Empty;
    public PushKeysDto Keys { get; set; } = new();
    public string? UserAgent { get; set; }
    public string? DeviceName { get; set; }
}

public class PushKeysDto
{
    public string P256dh { get; set; } = string.Empty;
    public string Auth { get; set; } = string.Empty;
}

public class UnsubscribeDto
{
    public string Endpoint { get; set; } = string.Empty;
}
