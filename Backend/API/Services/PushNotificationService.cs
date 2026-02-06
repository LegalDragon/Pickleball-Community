using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using WebPush;

namespace Pickleball.Community.Services;

/// <summary>
/// Service interface for Web Push notifications
/// </summary>
public interface IPushNotificationService
{
    /// <summary>
    /// Get VAPID public key for client subscription
    /// </summary>
    string GetPublicKey();

    /// <summary>
    /// Subscribe a user's device to push notifications
    /// </summary>
    Task<UserPushSubscription> SubscribeAsync(int userId, string endpoint, string p256dh, string auth, string? userAgent = null, string? deviceName = null);

    /// <summary>
    /// Unsubscribe a device from push notifications
    /// </summary>
    Task<bool> UnsubscribeAsync(int userId, string endpoint);

    /// <summary>
    /// Unsubscribe all devices for a user
    /// </summary>
    Task<int> UnsubscribeAllAsync(int userId);

    /// <summary>
    /// Get all active subscriptions for a user
    /// </summary>
    Task<List<UserPushSubscription>> GetSubscriptionsAsync(int userId);

    /// <summary>
    /// Send push notification to a specific user (all their devices)
    /// </summary>
    Task<int> SendToUserAsync(int userId, string title, string body, string? url = null, string? icon = null);

    /// <summary>
    /// Send push notification to multiple users
    /// </summary>
    Task<int> SendToUsersAsync(IEnumerable<int> userIds, string title, string body, string? url = null, string? icon = null);

    /// <summary>
    /// Send push notification to all subscribed users
    /// </summary>
    Task<int> BroadcastAsync(string title, string body, string? url = null, string? icon = null);

    /// <summary>
    /// Send push notification that requires user acknowledgment ("Got it" button)
    /// Creates a notification record and sends push with acknowledgment URL
    /// </summary>
    Task<(int notificationId, int sentCount)> SendWithAcknowledgmentAsync(
        int userId,
        string title,
        string body,
        string notificationType = "System",
        string? referenceType = null,
        int? referenceId = null);

    /// <summary>
    /// Acknowledge a notification by token
    /// </summary>
    Task<bool> AcknowledgeAsync(string token);

    /// <summary>
    /// Get pending acknowledgments for a user
    /// </summary>
    Task<List<Notification>> GetPendingAcknowledgmentsAsync(int userId);
}

/// <summary>
/// Implementation of Web Push notification service using VAPID
/// </summary>
public class PushNotificationService : IPushNotificationService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<PushNotificationService> _logger;
    private readonly IConfiguration _configuration;
    private readonly WebPushClient _webPushClient;
    private readonly VapidDetails _vapidDetails;

    public PushNotificationService(
        ApplicationDbContext context,
        ILogger<PushNotificationService> logger,
        IConfiguration configuration)
    {
        _context = context;
        _logger = logger;
        _configuration = configuration;
        _webPushClient = new WebPushClient();

        // Load VAPID keys from configuration
        var publicKey = _configuration["WebPush:PublicKey"]
            ?? throw new InvalidOperationException("WebPush:PublicKey not configured");
        var privateKey = _configuration["WebPush:PrivateKey"]
            ?? throw new InvalidOperationException("WebPush:PrivateKey not configured");
        var subject = _configuration["WebPush:Subject"] ?? "mailto:admin@pickleball.community";

        _vapidDetails = new VapidDetails(subject, publicKey, privateKey);
    }

    /// <inheritdoc />
    public string GetPublicKey()
    {
        return _vapidDetails.PublicKey;
    }

    /// <inheritdoc />
    public async Task<UserPushSubscription> SubscribeAsync(int userId, string endpoint, string p256dh, string auth, string? userAgent = null, string? deviceName = null)
    {
        _logger.LogInformation("SubscribeAsync: Creating subscription for userId={UserId}, endpoint length={EndpointLen}, p256dh length={P256dhLen}, auth length={AuthLen}",
            userId, endpoint?.Length ?? 0, p256dh?.Length ?? 0, auth?.Length ?? 0);

        // Validate keys - p256dh should be ~87 chars, auth should be ~22 chars (base64url encoded)
        if (string.IsNullOrEmpty(p256dh) || p256dh.Length < 80)
        {
            _logger.LogWarning("Invalid p256dh key length: {Length}", p256dh?.Length ?? 0);
        }
        if (string.IsNullOrEmpty(auth) || auth.Length < 20)
        {
            _logger.LogWarning("Invalid auth key length: {Length}", auth?.Length ?? 0);
        }

        // Check if subscription already exists
        var existing = await _context.PushSubscriptions
            .FirstOrDefaultAsync(s => s.Endpoint == endpoint);

        if (existing != null)
        {
            // Update existing subscription (might be a different user taking over the device)
            existing.UserId = userId;
            existing.P256dh = p256dh;
            existing.Auth = auth;
            existing.UserAgent = userAgent;
            existing.DeviceName = deviceName;
            existing.IsActive = true;
            existing.LastUsedAt = DateTime.Now;
        }
        else
        {
            // Create new subscription
            existing = new UserPushSubscription
            {
                UserId = userId,
                Endpoint = endpoint,
                P256dh = p256dh,
                Auth = auth,
                UserAgent = userAgent,
                DeviceName = deviceName,
                CreatedAt = DateTime.Now,
                IsActive = true
            };
            _context.PushSubscriptions.Add(existing);
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Push subscription created/updated for user {UserId}, subscriptionId={SubscriptionId}, IsActive={IsActive}",
            userId, existing.Id, existing.IsActive);
        return existing;
    }

    /// <inheritdoc />
    public async Task<bool> UnsubscribeAsync(int userId, string endpoint)
    {
        var subscription = await _context.PushSubscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Endpoint == endpoint);

        if (subscription == null)
            return false;

        _context.PushSubscriptions.Remove(subscription);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Push subscription removed for user {UserId}", userId);
        return true;
    }

    /// <inheritdoc />
    public async Task<int> UnsubscribeAllAsync(int userId)
    {
        var subscriptions = await _context.PushSubscriptions
            .Where(s => s.UserId == userId)
            .ToListAsync();

        _context.PushSubscriptions.RemoveRange(subscriptions);
        await _context.SaveChangesAsync();

        _logger.LogInformation("All {Count} push subscriptions removed for user {UserId}", subscriptions.Count, userId);
        return subscriptions.Count;
    }

    /// <inheritdoc />
    public async Task<List<UserPushSubscription>> GetSubscriptionsAsync(int userId)
    {
        return await _context.PushSubscriptions
            .Where(s => s.UserId == userId && s.IsActive)
            .OrderByDescending(s => s.LastUsedAt ?? s.CreatedAt)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<int> SendToUserAsync(int userId, string title, string body, string? url = null, string? icon = null)
    {
        _logger.LogInformation("SendToUserAsync: Looking for subscriptions for userId={UserId}", userId);

        var subscriptions = await _context.PushSubscriptions
            .Where(s => s.UserId == userId && s.IsActive)
            .ToListAsync();

        _logger.LogInformation("SendToUserAsync: Found {Count} active subscriptions for userId={UserId}", subscriptions.Count, userId);

        return await SendToSubscriptionsAsync(subscriptions, title, body, url, icon);
    }

    /// <inheritdoc />
    public async Task<int> SendToUsersAsync(IEnumerable<int> userIds, string title, string body, string? url = null, string? icon = null)
    {
        var userIdList = userIds.ToList();
        var subscriptions = await _context.PushSubscriptions
            .Where(s => userIdList.Contains(s.UserId) && s.IsActive)
            .ToListAsync();

        return await SendToSubscriptionsAsync(subscriptions, title, body, url, icon);
    }

    /// <inheritdoc />
    public async Task<int> BroadcastAsync(string title, string body, string? url = null, string? icon = null)
    {
        var subscriptions = await _context.PushSubscriptions
            .Where(s => s.IsActive)
            .ToListAsync();

        return await SendToSubscriptionsAsync(subscriptions, title, body, url, icon);
    }

    /// <summary>
    /// Send push notification to a list of subscriptions
    /// </summary>
    private async Task<int> SendToSubscriptionsAsync(List<UserPushSubscription> subscriptions, string title, string body, string? url, string? icon)
    {
        if (subscriptions.Count == 0)
            return 0;

        var payload = System.Text.Json.JsonSerializer.Serialize(new
        {
            title,
            body,
            icon = icon ?? "/logo-192.png",
            badge = "/logo-192.png",
            url = url ?? "/notifications",
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        });

        var successCount = 0;
        var failedSubscriptions = new List<UserPushSubscription>();

        foreach (var subscription in subscriptions)
        {
            try
            {
                var pushSubscription = new WebPush.PushSubscription(
                    subscription.Endpoint,
                    subscription.P256dh,
                    subscription.Auth);

                _logger.LogDebug("Sending push to endpoint: {Endpoint}, payload length: {Length}",
                    subscription.Endpoint.Substring(0, Math.Min(50, subscription.Endpoint.Length)),
                    payload.Length);

                await _webPushClient.SendNotificationAsync(pushSubscription, payload, _vapidDetails);

                subscription.LastUsedAt = DateTime.Now;
                successCount++;

                _logger.LogDebug("Push sent successfully to subscription {Id}", subscription.Id);
            }
            catch (WebPushException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Gone ||
                                               ex.StatusCode == System.Net.HttpStatusCode.NotFound ||
                                               ex.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                // Subscription is no longer valid - mark as inactive
                // 410 Gone / 404 NotFound = subscription expired
                // 403 Forbidden = VAPID key mismatch (subscription created with different keys)
                _logger.LogInformation("Push subscription {Id} is no longer valid (status: {Status}), marking inactive",
                    subscription.Id, ex.StatusCode);
                subscription.IsActive = false;
                failedSubscriptions.Add(subscription);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send push notification to subscription {Id}", subscription.Id);
            }
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Push notification sent to {Success}/{Total} subscriptions: {Title}",
            successCount, subscriptions.Count, title);

        return successCount;
    }

    /// <inheritdoc />
    public async Task<(int notificationId, int sentCount)> SendWithAcknowledgmentAsync(
        int userId,
        string title,
        string body,
        string notificationType = "System",
        string? referenceType = null,
        int? referenceId = null)
    {
        // Generate secure acknowledgment token
        var token = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32))
            .Replace("+", "-").Replace("/", "_").TrimEnd('=');

        // Create notification record
        var notification = new Notification
        {
            UserId = userId,
            Type = notificationType,
            Title = title,
            Message = body,
            RequiresAcknowledgment = true,
            AcknowledgmentToken = token,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            CreatedAt = DateTime.Now
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        // Build acknowledgment URL
        var baseUrl = _configuration["SharedAuth:BaseUrl"]?.TrimEnd('/') ?? "https://pickleball.community";
        var ackUrl = $"{baseUrl}/notification/ack/{token}";

        // Send push with acknowledgment URL
        var sentCount = await SendToUserAsync(userId, title, body, ackUrl);

        _logger.LogInformation("Sent acknowledgment-required notification {Id} to user {UserId}: {Title}",
            notification.Id, userId, title);

        return (notification.Id, sentCount);
    }

    /// <inheritdoc />
    public async Task<bool> AcknowledgeAsync(string token)
    {
        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.AcknowledgmentToken == token && n.RequiresAcknowledgment);

        if (notification == null)
            return false;

        if (notification.AcknowledgedAt.HasValue)
        {
            _logger.LogDebug("Notification {Id} already acknowledged", notification.Id);
            return true; // Already acknowledged
        }

        notification.AcknowledgedAt = DateTime.Now;
        notification.IsRead = true;
        notification.ReadAt = DateTime.Now;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Notification {Id} acknowledged by user {UserId}", notification.Id, notification.UserId);
        return true;
    }

    /// <inheritdoc />
    public async Task<List<Notification>> GetPendingAcknowledgmentsAsync(int userId)
    {
        return await _context.Notifications
            .Where(n => n.UserId == userId &&
                       n.RequiresAcknowledgment &&
                       !n.AcknowledgedAt.HasValue)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();
    }
}
