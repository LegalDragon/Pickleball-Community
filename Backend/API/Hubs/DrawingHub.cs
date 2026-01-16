using Microsoft.AspNetCore.SignalR;

namespace Pickleball.Community.Hubs;

/// <summary>
/// SignalR Hub for live division drawing broadcasts
/// Players can watch as units are drawn and assigned numbers in real-time
/// </summary>
public class DrawingHub : Hub
{
    private readonly ILogger<DrawingHub> _logger;

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

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Connection {ConnectionId} disconnected from drawing hub", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    public static string GetDrawingGroupName(int divisionId) => $"drawing_{divisionId}";
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
