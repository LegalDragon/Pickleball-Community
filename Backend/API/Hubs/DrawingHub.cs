using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using System.Security.Claims;

namespace Pickleball.Community.Hubs;

/// <summary>
/// SignalR Hub for live division drawing broadcasts
/// Players can watch as units are drawn and assigned numbers in real-time
/// Also tracks viewers watching the drawing
/// </summary>
public class DrawingHub : Hub
{
    private readonly ILogger<DrawingHub> _logger;

    // Static storage for viewers - keyed by eventId, contains dictionary of connectionId -> viewer info
    private static readonly ConcurrentDictionary<int, ConcurrentDictionary<string, DrawingViewerDto>> _eventViewers = new();

    // Track which event each connection is watching
    private static readonly ConcurrentDictionary<string, int> _connectionEvents = new();

    public DrawingHub(ILogger<DrawingHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Join a division drawing room to receive real-time updates
    /// </summary>
    public async Task JoinDrawingRoom(int divisionId)
    {
        var groupName = GetDrawingGroupName(divisionId);
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Connection {ConnectionId} joined drawing room for division {DivisionId}",
            Context.ConnectionId, divisionId);
    }

    /// <summary>
    /// Leave a division drawing room
    /// </summary>
    public async Task LeaveDrawingRoom(int divisionId)
    {
        var groupName = GetDrawingGroupName(divisionId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Connection {ConnectionId} left drawing room for division {DivisionId}",
            Context.ConnectionId, divisionId);
    }

    /// <summary>
    /// Join an event's drawing monitor page as a viewer
    /// </summary>
    public async Task JoinEventDrawing(int eventId, string? displayName, string? avatarUrl)
    {
        var connectionId = Context.ConnectionId;
        var groupName = GetEventGroupName(eventId);

        // Add to SignalR group
        await Groups.AddToGroupAsync(connectionId, groupName);

        // Get user info from claims if authenticated
        var userId = GetUserId();
        var isAuthenticated = userId.HasValue;

        var viewer = new DrawingViewerDto
        {
            ConnectionId = connectionId,
            UserId = userId,
            DisplayName = isAuthenticated ? displayName ?? "User" : "Anonymous",
            AvatarUrl = isAuthenticated ? avatarUrl : null,
            IsAuthenticated = isAuthenticated,
            JoinedAt = DateTime.UtcNow
        };

        // Add to event viewers
        var eventViewerDict = _eventViewers.GetOrAdd(eventId, _ => new ConcurrentDictionary<string, DrawingViewerDto>());
        eventViewerDict[connectionId] = viewer;

        // Track which event this connection is watching
        _connectionEvents[connectionId] = eventId;

        _logger.LogInformation("Connection {ConnectionId} joined event {EventId} drawing as {DisplayName}",
            connectionId, eventId, viewer.DisplayName);

        // Broadcast updated viewer list to all viewers
        await BroadcastViewerList(eventId);
    }

    /// <summary>
    /// Leave an event's drawing monitor page
    /// </summary>
    public async Task LeaveEventDrawing(int eventId)
    {
        var connectionId = Context.ConnectionId;
        await RemoveViewerFromEvent(connectionId, eventId);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var connectionId = Context.ConnectionId;

        // Check if this connection was watching an event
        if (_connectionEvents.TryRemove(connectionId, out var eventId))
        {
            await RemoveViewerFromEvent(connectionId, eventId);
        }

        _logger.LogInformation("Connection {ConnectionId} disconnected from drawing hub", connectionId);
        await base.OnDisconnectedAsync(exception);
    }

    private async Task RemoveViewerFromEvent(string connectionId, int eventId)
    {
        var groupName = GetEventGroupName(eventId);
        await Groups.RemoveFromGroupAsync(connectionId, groupName);

        if (_eventViewers.TryGetValue(eventId, out var viewers))
        {
            viewers.TryRemove(connectionId, out _);

            // Cleanup empty event dictionaries
            if (viewers.IsEmpty)
            {
                _eventViewers.TryRemove(eventId, out _);
            }
        }

        _connectionEvents.TryRemove(connectionId, out _);

        _logger.LogInformation("Connection {ConnectionId} left event {EventId} drawing", connectionId, eventId);

        // Broadcast updated viewer list
        await BroadcastViewerList(eventId);
    }

    private async Task BroadcastViewerList(int eventId)
    {
        var groupName = GetEventGroupName(eventId);
        var viewers = GetEventViewers(eventId);
        await Clients.Group(groupName).SendAsync("ViewersUpdated", viewers);
    }

    private int? GetUserId()
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    public static string GetDrawingGroupName(int divisionId) => $"drawing_{divisionId}";
    public static string GetEventGroupName(int eventId) => $"event_drawing_{eventId}";

    public static List<DrawingViewerDto> GetEventViewers(int eventId)
    {
        if (_eventViewers.TryGetValue(eventId, out var viewers))
        {
            return viewers.Values.ToList();
        }
        return new List<DrawingViewerDto>();
    }

    public static int GetEventViewerCount(int eventId)
    {
        if (_eventViewers.TryGetValue(eventId, out var viewers))
        {
            return viewers.Count;
        }
        return 0;
    }
}

/// <summary>
/// Service for sending drawing updates to connected clients
/// </summary>
public interface IDrawingBroadcaster
{
    Task BroadcastDrawingStarted(int divisionId, DrawingStateDto state);
    Task BroadcastUnitDrawn(int divisionId, DrawnUnitDto drawnUnit);
    Task BroadcastDrawingCompleted(int divisionId, DrawingCompletedDto result);
    Task BroadcastDrawingCancelled(int divisionId);
    Task BroadcastEventDrawingStarted(int eventId, int divisionId, DrawingStateDto state);
    Task BroadcastEventUnitDrawn(int eventId, int divisionId, DrawnUnitDto drawnUnit);
    Task BroadcastEventDrawingCompleted(int eventId, int divisionId, DrawingCompletedDto result);
    Task BroadcastEventDrawingCancelled(int eventId, int divisionId);
    Task BroadcastViewersUpdated(int eventId, List<DrawingViewerDto> viewers);
}

public class DrawingBroadcaster : IDrawingBroadcaster
{
    private readonly IHubContext<DrawingHub> _hubContext;
    private readonly ILogger<DrawingBroadcaster> _logger;

    public DrawingBroadcaster(IHubContext<DrawingHub> hubContext, ILogger<DrawingBroadcaster> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task BroadcastDrawingStarted(int divisionId, DrawingStateDto state)
    {
        var groupName = DrawingHub.GetDrawingGroupName(divisionId);
        await _hubContext.Clients.Group(groupName).SendAsync("DrawingStarted", state);
        _logger.LogInformation("Broadcasted drawing started for division {DivisionId}", divisionId);
    }

    public async Task BroadcastUnitDrawn(int divisionId, DrawnUnitDto drawnUnit)
    {
        var groupName = DrawingHub.GetDrawingGroupName(divisionId);
        await _hubContext.Clients.Group(groupName).SendAsync("UnitDrawn", drawnUnit);
        _logger.LogInformation("Broadcasted unit drawn: #{UnitNumber} {UnitName} for division {DivisionId}",
            drawnUnit.UnitNumber, drawnUnit.UnitName, divisionId);
    }

    public async Task BroadcastDrawingCompleted(int divisionId, DrawingCompletedDto result)
    {
        var groupName = DrawingHub.GetDrawingGroupName(divisionId);
        await _hubContext.Clients.Group(groupName).SendAsync("DrawingCompleted", result);
        _logger.LogInformation("Broadcasted drawing completed for division {DivisionId}", divisionId);
    }

    public async Task BroadcastDrawingCancelled(int divisionId)
    {
        var groupName = DrawingHub.GetDrawingGroupName(divisionId);
        await _hubContext.Clients.Group(groupName).SendAsync("DrawingCancelled");
        _logger.LogInformation("Broadcasted drawing cancelled for division {DivisionId}", divisionId);
    }

    // Event-level broadcasts for the drawing monitor page
    public async Task BroadcastEventDrawingStarted(int eventId, int divisionId, DrawingStateDto state)
    {
        var groupName = DrawingHub.GetEventGroupName(eventId);
        await _hubContext.Clients.Group(groupName).SendAsync("EventDrawingStarted", new { divisionId, state });
        _logger.LogInformation("Broadcasted event drawing started for event {EventId} division {DivisionId}", eventId, divisionId);
    }

    public async Task BroadcastEventUnitDrawn(int eventId, int divisionId, DrawnUnitDto drawnUnit)
    {
        var groupName = DrawingHub.GetEventGroupName(eventId);
        await _hubContext.Clients.Group(groupName).SendAsync("EventUnitDrawn", new { divisionId, drawnUnit });
        _logger.LogInformation("Broadcasted event unit drawn for event {EventId} division {DivisionId}", eventId, divisionId);
    }

    public async Task BroadcastEventDrawingCompleted(int eventId, int divisionId, DrawingCompletedDto result)
    {
        var groupName = DrawingHub.GetEventGroupName(eventId);
        await _hubContext.Clients.Group(groupName).SendAsync("EventDrawingCompleted", new { divisionId, result });
        _logger.LogInformation("Broadcasted event drawing completed for event {EventId} division {DivisionId}", eventId, divisionId);
    }

    public async Task BroadcastEventDrawingCancelled(int eventId, int divisionId)
    {
        var groupName = DrawingHub.GetEventGroupName(eventId);
        await _hubContext.Clients.Group(groupName).SendAsync("EventDrawingCancelled", new { divisionId });
        _logger.LogInformation("Broadcasted event drawing cancelled for event {EventId} division {DivisionId}", eventId, divisionId);
    }

    public async Task BroadcastViewersUpdated(int eventId, List<DrawingViewerDto> viewers)
    {
        var groupName = DrawingHub.GetEventGroupName(eventId);
        await _hubContext.Clients.Group(groupName).SendAsync("ViewersUpdated", viewers);
        _logger.LogInformation("Broadcasted viewers updated for event {EventId}: {Count} viewers", eventId, viewers.Count);
    }
}

// DTOs for drawing broadcasts
public class DrawingStateDto
{
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public int TotalUnits { get; set; }
    public int DrawnCount { get; set; }
    public List<DrawnUnitDto> DrawnUnits { get; set; } = new();
    public List<string> RemainingUnitNames { get; set; } = new();
    public DateTime StartedAt { get; set; }
    public string? StartedByName { get; set; }
}

public class DrawnUnitDto
{
    public int UnitId { get; set; }
    public int UnitNumber { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public List<string> MemberNames { get; set; } = new();
    public DateTime DrawnAt { get; set; }
}

public class DrawingCompletedDto
{
    public int DivisionId { get; set; }
    public List<DrawnUnitDto> FinalOrder { get; set; } = new();
    public DateTime CompletedAt { get; set; }
}

public class DrawingViewerDto
{
    public string ConnectionId { get; set; } = string.Empty;
    public int? UserId { get; set; }
    public string DisplayName { get; set; } = "Anonymous";
    public string? AvatarUrl { get; set; }
    public bool IsAuthenticated { get; set; }
    public DateTime JoinedAt { get; set; }
}

/// <summary>
/// Event-level drawing state containing all divisions
/// </summary>
public class EventDrawingStateDto
{
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public string TournamentStatus { get; set; } = string.Empty;
    public List<DivisionDrawingStateDto> Divisions { get; set; } = new();
    public List<DrawingViewerDto> Viewers { get; set; } = new();
    public int ViewerCount { get; set; }
}

/// <summary>
/// Drawing state for a single division within an event
/// </summary>
public class DivisionDrawingStateDto
{
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public int TeamSize { get; set; }
    public string ScheduleStatus { get; set; } = string.Empty;
    public bool DrawingInProgress { get; set; }
    public DateTime? DrawingStartedAt { get; set; }
    public string? DrawingByName { get; set; }
    public int TotalUnits { get; set; }
    public int DrawnCount { get; set; }
    public List<DrawnUnitDto> DrawnUnits { get; set; } = new();
    public List<string> RemainingUnitNames { get; set; } = new();
}
