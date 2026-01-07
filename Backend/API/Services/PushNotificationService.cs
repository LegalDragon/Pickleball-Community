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
            existing.LastUsedAt = DateTime.UtcNow;
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
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };
            _context.PushSubscriptions.Add(existing);
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Push subscription created/updated for user {UserId}", userId);
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
        var subscriptions = await _context.PushSubscriptions
            .Where(s => s.UserId == userId && s.IsActive)
            .ToListAsync();

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
            icon = icon ?? "/icon-192.png",
            badge = "/icon-192.png",
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

                await _webPushClient.SendNotificationAsync(pushSubscription, payload, _vapidDetails);

                subscription.LastUsedAt = DateTime.UtcNow;
                successCount++;
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
}
