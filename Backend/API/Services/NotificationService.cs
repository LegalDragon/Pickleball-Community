using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Hubs;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Services;

/// <summary>
/// Service interface for sending real-time notifications via SignalR
/// </summary>
public interface INotificationService
{
    /// <summary>
    /// Create a notification in the database and push it via SignalR
    /// </summary>
    Task<Notification> CreateAndSendAsync(int userId, string type, string title, string? message = null,
        string? actionUrl = null, string? referenceType = null, int? referenceId = null);

    /// <summary>
    /// Send a notification to a specific user via SignalR (without saving to DB)
    /// </summary>
    Task SendToUserAsync(int userId, NotificationPayload notification);

    /// <summary>
    /// Send notifications to multiple users via SignalR
    /// </summary>
    Task SendToUsersAsync(IEnumerable<int> userIds, NotificationPayload notification);

    /// <summary>
    /// Broadcast a notification to all connected users
    /// </summary>
    Task BroadcastAsync(NotificationPayload notification);

    /// <summary>
    /// Send notification to all users watching a specific game
    /// </summary>
    Task SendToGameAsync(int gameId, NotificationPayload notification);

    /// <summary>
    /// Send notification to all users in an event group
    /// </summary>
    Task SendToEventAsync(int eventId, NotificationPayload notification);

    /// <summary>
    /// Send notification to all users in a club group
    /// </summary>
    Task SendToClubAsync(int clubId, NotificationPayload notification);

    /// <summary>
    /// Create and send notifications to multiple users (saves to DB and pushes via SignalR)
    /// </summary>
    Task<List<Notification>> CreateAndSendToUsersAsync(IEnumerable<int> userIds, string type, string title,
        string? message = null, string? actionUrl = null, string? referenceType = null, int? referenceId = null);

    /// <summary>
    /// Send game score update to all users watching a game (SignalR only - no toast, no push, no DB)
    /// Used for real-time game progress monitoring
    /// </summary>
    Task SendGameScoreAsync(int gameId, GameScorePayload scoreUpdate);
}

/// <summary>
/// Payload sent via SignalR for real-time notifications
/// </summary>
public class NotificationPayload
{
    public int Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Message { get; set; }
    public string? ActionUrl { get; set; }
    public string? ReferenceType { get; set; }
    public int? ReferenceId { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Payload for real-time game score updates (SignalR only - no toast, no push, no DB)
/// </summary>
public class GameScorePayload
{
    public int GameId { get; set; }
    public int EventId { get; set; }
    public string? GameName { get; set; }

    // Current score
    public int Team1Score { get; set; }
    public int Team2Score { get; set; }

    // Game sets/rounds if applicable
    public int? CurrentSet { get; set; }
    public List<int[]>? SetScores { get; set; } // e.g., [[11,9], [9,11], [11,7]]

    // Game state
    public string Status { get; set; } = "InProgress"; // NotStarted, InProgress, Paused, Completed
    public string? ServingTeam { get; set; } // "Team1" or "Team2"
    public int? ServingPlayer { get; set; } // UserId of current server

    // Team info for display
    public List<GamePlayerInfo>? Team1Players { get; set; }
    public List<GamePlayerInfo>? Team2Players { get; set; }

    // Timing
    public DateTime UpdatedAt { get; set; }
    public TimeSpan? ElapsedTime { get; set; }
}

/// <summary>
/// Player info for game score display
/// </summary>
public class GamePlayerInfo
{
    public int UserId { get; set; }
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
}

/// <summary>
/// Implementation of the notification service
/// </summary>
public class NotificationService : INotificationService
{
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<NotificationService> _logger;
    private readonly IServiceProvider _serviceProvider;

    public NotificationService(
        IHubContext<NotificationHub> hubContext,
        ApplicationDbContext context,
        ILogger<NotificationService> logger,
        IServiceProvider serviceProvider)
    {
        _hubContext = hubContext;
        _context = context;
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    /// <summary>
    /// Get push service (lazy loaded to avoid circular dependency)
    /// </summary>
    private IPushNotificationService? GetPushService()
    {
        try
        {
            return _serviceProvider.GetService<IPushNotificationService>();
        }
        catch
        {
            return null;
        }
    }

    /// <inheritdoc />
    public async Task<Notification> CreateAndSendAsync(int userId, string type, string title, string? message = null,
        string? actionUrl = null, string? referenceType = null, int? referenceId = null)
    {
        // Create notification in database
        var notification = new Notification
        {
            UserId = userId,
            Type = type,
            Title = title,
            Message = message,
            ActionUrl = actionUrl,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            IsRead = false,
            CreatedAt = DateTime.Now
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        // Push via SignalR if user is connected
        var payload = new NotificationPayload
        {
            Id = notification.Id,
            Type = notification.Type,
            Title = notification.Title,
            Message = notification.Message,
            ActionUrl = notification.ActionUrl,
            ReferenceType = notification.ReferenceType,
            ReferenceId = notification.ReferenceId,
            CreatedAt = notification.CreatedAt
        };

        // SendToUserAsync now handles both SignalR and Web Push
        await SendToUserAsync(userId, payload);

        _logger.LogInformation("Notification {Id} created and sent to user {UserId}: {Title}",
            notification.Id, userId, title);

        return notification;
    }

    /// <inheritdoc />
    public async Task SendToUserAsync(int userId, NotificationPayload notification)
    {
        try
        {
            // Send via SignalR
            await _hubContext.Clients.Group($"user_{userId}")
                .SendAsync("ReceiveNotification", notification);

            // Also send Web Push for offline users
            var pushService = GetPushService();
            if (pushService != null)
            {
                try
                {
                    await pushService.SendToUserAsync(userId, notification.Title, notification.Message ?? "", notification.ActionUrl);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to send push notification to user {UserId}", userId);
                }
            }

            _logger.LogDebug("Notification sent to user {UserId}: {Title}", userId, notification.Title);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending notification to user {UserId}", userId);
        }
    }

    /// <inheritdoc />
    public async Task SendToUsersAsync(IEnumerable<int> userIds, NotificationPayload notification)
    {
        var userIdList = userIds.ToList();

        // Send via SignalR
        var tasks = userIdList.Select(userId =>
            _hubContext.Clients.Group($"user_{userId}")
                .SendAsync("ReceiveNotification", notification));
        await Task.WhenAll(tasks);

        // Also send Web Push for offline users
        var pushService = GetPushService();
        if (pushService != null)
        {
            try
            {
                await pushService.SendToUsersAsync(userIdList, notification.Title, notification.Message ?? "", notification.ActionUrl);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send push notifications to {Count} users", userIdList.Count);
            }
        }

        _logger.LogDebug("Notification sent to {Count} users: {Title}", userIdList.Count, notification.Title);
    }

    /// <inheritdoc />
    public async Task BroadcastAsync(NotificationPayload notification)
    {
        // Send via SignalR
        await _hubContext.Clients.All.SendAsync("ReceiveNotification", notification);

        // Also send Web Push to all subscribed users
        var pushService = GetPushService();
        if (pushService != null)
        {
            try
            {
                await pushService.BroadcastAsync(notification.Title, notification.Message ?? "", notification.ActionUrl);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to broadcast push notification");
            }
        }

        _logger.LogDebug("Notification broadcast to all users: {Title}", notification.Title);
    }

    /// <inheritdoc />
    public async Task SendToGameAsync(int gameId, NotificationPayload notification)
    {
        // Send via SignalR to game group
        var groupName = $"game_{gameId}";
        await _hubContext.Clients.Group(groupName).SendAsync("ReceiveNotification", notification);

        // Get game participants for Web Push
        var pushService = GetPushService();
        if (pushService != null)
        {
            try
            {
                var userIds = await _context.EventGamePlayers
                    .Where(gp => gp.GameId == gameId)
                    .Select(gp => gp.UserId)
                    .ToListAsync();

                if (userIds.Count > 0)
                {
                    await pushService.SendToUsersAsync(userIds, notification.Title, notification.Message ?? "", notification.ActionUrl);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send push notifications to game {GameId}", gameId);
            }
        }

        _logger.LogDebug("Notification sent to game {GameId}: {Title}", gameId, notification.Title);
    }

    /// <inheritdoc />
    public async Task SendToEventAsync(int eventId, NotificationPayload notification)
    {
        // Send via SignalR to event group
        var groupName = $"event_{eventId}";
        await _hubContext.Clients.Group(groupName).SendAsync("ReceiveNotification", notification);

        // Get event participants for Web Push
        var pushService = GetPushService();
        if (pushService != null)
        {
            try
            {
                var userIds = await _context.EventRegistrations
                    .Where(er => er.EventId == eventId)
                    .Select(er => er.UserId)
                    .Distinct()
                    .ToListAsync();

                if (userIds.Count > 0)
                {
                    await pushService.SendToUsersAsync(userIds, notification.Title, notification.Message ?? "", notification.ActionUrl);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send push notifications to event {EventId}", eventId);
            }
        }

        _logger.LogDebug("Notification sent to event {EventId}: {Title}", eventId, notification.Title);
    }

    /// <inheritdoc />
    public async Task SendToClubAsync(int clubId, NotificationPayload notification)
    {
        // Send via SignalR to club group
        var groupName = $"club_{clubId}";
        await _hubContext.Clients.Group(groupName).SendAsync("ReceiveNotification", notification);

        // Get club members for Web Push
        var pushService = GetPushService();
        if (pushService != null)
        {
            try
            {
                var userIds = await _context.ClubMembers
                    .Where(cm => cm.ClubId == clubId && cm.IsActive)
                    .Select(cm => cm.UserId)
                    .ToListAsync();

                if (userIds.Count > 0)
                {
                    await pushService.SendToUsersAsync(userIds, notification.Title, notification.Message ?? "", notification.ActionUrl);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send push notifications to club {ClubId}", clubId);
            }
        }

        _logger.LogDebug("Notification sent to club {ClubId}: {Title}", clubId, notification.Title);
    }

    /// <inheritdoc />
    public async Task<List<Notification>> CreateAndSendToUsersAsync(IEnumerable<int> userIds, string type, string title,
        string? message = null, string? actionUrl = null, string? referenceType = null, int? referenceId = null)
    {
        var now = DateTime.Now;
        var notifications = userIds.Select(userId => new Notification
        {
            UserId = userId,
            Type = type,
            Title = title,
            Message = message,
            ActionUrl = actionUrl,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            IsRead = false,
            CreatedAt = now
        }).ToList();

        _context.Notifications.AddRange(notifications);
        await _context.SaveChangesAsync();

        // Push to all users via SignalR
        var payload = new NotificationPayload
        {
            Type = type,
            Title = title,
            Message = message,
            ActionUrl = actionUrl,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            CreatedAt = now
        };

        // SendToUsersAsync now handles both SignalR and Web Push
        await SendToUsersAsync(userIds, payload);

        _logger.LogInformation("Notification sent to {Count} users: {Title}", notifications.Count, title);

        return notifications;
    }

    /// <inheritdoc />
    public async Task SendGameScoreAsync(int gameId, GameScorePayload scoreUpdate)
    {
        // SignalR only - no toast, no web push, no DB save
        // This is a lightweight update for real-time game monitoring
        try
        {
            scoreUpdate.GameId = gameId;
            scoreUpdate.UpdatedAt = DateTime.Now;

            var groupName = $"game_{gameId}";
            await _hubContext.Clients.Group(groupName).SendAsync("GameScoreUpdate", scoreUpdate);

            _logger.LogDebug("Game score update sent to game {GameId}: {Team1}-{Team2}",
                gameId, scoreUpdate.Team1Score, scoreUpdate.Team2Score);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending game score update to game {GameId}", gameId);
        }
    }
}
