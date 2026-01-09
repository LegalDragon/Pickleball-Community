using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ChatHub> _logger;
    private static readonly Dictionary<int, HashSet<string>> _userConnections = new();
    private static readonly object _lock = new();

    public ChatHub(ApplicationDbContext context, ILogger<ChatHub> logger)
    {
        _context = context;
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

        // Join user to their conversation groups
        var conversationIds = await _context.ConversationParticipants
            .Where(cp => cp.UserId == userId.Value)
            .Select(cp => cp.ConversationId)
            .ToListAsync();

        foreach (var conversationId in conversationIds)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"conversation_{conversationId}");
        }

        // Notify user's contacts they're online
        await NotifyUserOnlineStatus(userId.Value, true);

        _logger.LogInformation("User {UserId} connected with connection {ConnectionId}", userId, Context.ConnectionId);

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetCurrentUserId();
        if (userId.HasValue)
        {
            bool isLastConnection = false;

            lock (_lock)
            {
                if (_userConnections.ContainsKey(userId.Value))
                {
                    _userConnections[userId.Value].Remove(Context.ConnectionId);
                    if (_userConnections[userId.Value].Count == 0)
                    {
                        _userConnections.Remove(userId.Value);
                        isLastConnection = true;
                    }
                }
            }

            // Only notify offline if this was the last connection
            if (isLastConnection)
            {
                await NotifyUserOnlineStatus(userId.Value, false);
            }

            _logger.LogInformation("User {UserId} disconnected from connection {ConnectionId}", userId, Context.ConnectionId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    // Called when a new conversation is created or user joins a conversation
    public async Task JoinConversation(int conversationId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return;

        // Verify user is a participant
        var isParticipant = await _context.ConversationParticipants
            .AnyAsync(cp => cp.ConversationId == conversationId && cp.UserId == userId.Value);

        if (isParticipant)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"conversation_{conversationId}");
            _logger.LogInformation("User {UserId} joined conversation {ConversationId}", userId, conversationId);
        }
    }

    // Called when user leaves a conversation
    public async Task LeaveConversation(int conversationId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"conversation_{conversationId}");
        _logger.LogInformation("Connection {ConnectionId} left conversation {ConversationId}", Context.ConnectionId, conversationId);
    }

    // Send a message - called by the controller after saving
    public async Task SendMessage(NewMessageNotification notification)
    {
        await Clients.Group($"conversation_{notification.ConversationId}")
            .SendAsync("ReceiveMessage", notification);
    }

    // Notify typing status
    public async Task SendTyping(int conversationId, bool isTyping)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return;

        // Verify user is a participant
        var participant = await _context.ConversationParticipants
            .Include(cp => cp.User)
            .FirstOrDefaultAsync(cp => cp.ConversationId == conversationId && cp.UserId == userId.Value);

        if (participant == null) return;

        var notification = new TypingNotification
        {
            ConversationId = conversationId,
            UserId = userId.Value,
            UserName = participant.User != null ? $"{participant.User.FirstName} {participant.User.LastName}".Trim() : null,
            IsTyping = isTyping
        };

        await Clients.OthersInGroup($"conversation_{conversationId}")
            .SendAsync("UserTyping", notification);
    }

    // Mark messages as read
    public async Task MarkRead(int conversationId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return;

        var participant = await _context.ConversationParticipants
            .Include(cp => cp.User)
            .FirstOrDefaultAsync(cp => cp.ConversationId == conversationId && cp.UserId == userId.Value);

        if (participant == null) return;

        participant.LastReadAt = DateTime.Now;
        await _context.SaveChangesAsync();

        var notification = new MessageReadNotification
        {
            ConversationId = conversationId,
            MessageId = 0, // All messages up to LastReadAt
            UserId = userId.Value,
            UserName = participant.User != null ? $"{participant.User.FirstName} {participant.User.LastName}".Trim() : null,
            ReadAt = participant.LastReadAt.Value
        };

        await Clients.OthersInGroup($"conversation_{conversationId}")
            .SendAsync("MessageRead", notification);
    }

    // Helper to notify user online status to their conversation partners
    private async Task NotifyUserOnlineStatus(int userId, bool isOnline)
    {
        // Get all users who share a conversation with this user
        var conversationIds = await _context.ConversationParticipants
            .Where(cp => cp.UserId == userId)
            .Select(cp => cp.ConversationId)
            .ToListAsync();

        var notification = new UserOnlineStatusNotification
        {
            UserId = userId,
            IsOnline = isOnline,
            LastSeen = isOnline ? null : DateTime.Now
        };

        foreach (var conversationId in conversationIds)
        {
            await Clients.OthersInGroup($"conversation_{conversationId}")
                .SendAsync("UserOnlineStatus", notification);
        }
    }

    // Check if a user is currently online
    public static bool IsUserOnline(int userId)
    {
        lock (_lock)
        {
            return _userConnections.ContainsKey(userId) && _userConnections[userId].Count > 0;
        }
    }

    // Get connection IDs for a user (for direct messaging)
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
}
