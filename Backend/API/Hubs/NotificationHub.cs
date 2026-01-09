using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace Pickleball.Community.Hubs;

/// <summary>
/// SignalR Hub for real-time notifications
/// Allows pushing notifications to specific users in real-time
/// </summary>
[Authorize]
public class NotificationHub : Hub
{
    private readonly ILogger<NotificationHub> _logger;
    private static readonly Dictionary<int, HashSet<string>> _userConnections = new();
    private static readonly object _lock = new();

    public NotificationHub(ILogger<NotificationHub> logger)
    {
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            _logger.LogWarning("Notification hub connection rejected - no user ID");
            Context.Abort();
            return;
        }

        // Track user connection
        lock (_lock)
        {
            if (!_userConnections.ContainsKey(userId.Value))
            {
                _userConnections[userId.Value] = new HashSet<string>();
            }
            _userConnections[userId.Value].Add(Context.ConnectionId);
        }

        // Add user to their personal notification group
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId.Value}");

        _logger.LogInformation("User {UserId} connected to notification hub with connection {ConnectionId}",
            userId.Value, Context.ConnectionId);

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetCurrentUserId();
        if (userId.HasValue)
        {
            lock (_lock)
            {
                if (_userConnections.ContainsKey(userId.Value))
                {
                    _userConnections[userId.Value].Remove(Context.ConnectionId);
                    if (_userConnections[userId.Value].Count == 0)
                    {
                        _userConnections.Remove(userId.Value);
                    }
                }
            }

            _logger.LogInformation("User {UserId} disconnected from notification hub", userId.Value);
        }

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Check if a user is currently connected to the notification hub
    /// </summary>
    public static bool IsUserConnected(int userId)
    {
        lock (_lock)
        {
            return _userConnections.ContainsKey(userId) && _userConnections[userId].Count > 0;
        }
    }

    /// <summary>
    /// Get all connection IDs for a user
    /// </summary>
    public static IEnumerable<string> GetUserConnections(int userId)
    {
        lock (_lock)
        {
            if (_userConnections.TryGetValue(userId, out var connections))
            {
                return connections.ToList();
            }
            return Enumerable.Empty<string>();
        }
    }

    /// <summary>
    /// Get count of connected users
    /// </summary>
    public static int GetConnectedUserCount()
    {
        lock (_lock)
        {
            return _userConnections.Count;
        }
    }

    /// <summary>
    /// Join a game group to receive real-time score updates
    /// </summary>
    public async Task JoinGameGroup(int gameId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return;

        var groupName = $"game_{gameId}";
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("User {UserId} joined game group {GroupName}", userId.Value, groupName);
    }

    /// <summary>
    /// Leave a game group
    /// </summary>
    public async Task LeaveGameGroup(int gameId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return;

        var groupName = $"game_{gameId}";
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("User {UserId} left game group {GroupName}", userId.Value, groupName);
    }

    /// <summary>
    /// Join an event group to receive event updates
    /// </summary>
    public async Task JoinEventGroup(int eventId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return;

        var groupName = $"event_{eventId}";
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("User {UserId} joined event group {GroupName}", userId.Value, groupName);
    }

    /// <summary>
    /// Leave an event group
    /// </summary>
    public async Task LeaveEventGroup(int eventId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return;

        var groupName = $"event_{eventId}";
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("User {UserId} left event group {GroupName}", userId.Value, groupName);
    }

    /// <summary>
    /// Join a club group to receive club updates
    /// </summary>
    public async Task JoinClubGroup(int clubId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return;

        var groupName = $"club_{clubId}";
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("User {UserId} joined club group {GroupName}", userId.Value, groupName);
    }

    /// <summary>
    /// Leave a club group
    /// </summary>
    public async Task LeaveClubGroup(int clubId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return;

        var groupName = $"club_{clubId}";
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("User {UserId} left club group {GroupName}", userId.Value, groupName);
    }
}
