using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace Pickleball.Community.Hubs;

/// <summary>
/// SignalR Hub for real-time score and bracket progression updates.
/// Clients can subscribe to event or division updates to receive live notifications
/// when scores change or playoff brackets advance.
/// </summary>
public class ScoreHub : Hub
{
    private readonly ILogger<ScoreHub> _logger;

    public ScoreHub(ILogger<ScoreHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Join an event group to receive score updates for all divisions in that event
    /// </summary>
    public async Task JoinEvent(int eventId)
    {
        var groupName = GetEventGroupName(eventId);
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Connection {ConnectionId} joined score updates for event {EventId}",
            Context.ConnectionId, eventId);
    }

    /// <summary>
    /// Leave an event group
    /// </summary>
    public async Task LeaveEvent(int eventId)
    {
        var groupName = GetEventGroupName(eventId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Connection {ConnectionId} left score updates for event {EventId}",
            Context.ConnectionId, eventId);
    }

    /// <summary>
    /// Join a division group to receive score updates for that specific division
    /// </summary>
    public async Task JoinDivision(int divisionId)
    {
        var groupName = GetDivisionGroupName(divisionId);
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Connection {ConnectionId} joined score updates for division {DivisionId}",
            Context.ConnectionId, divisionId);
    }

    /// <summary>
    /// Leave a division group
    /// </summary>
    public async Task LeaveDivision(int divisionId)
    {
        var groupName = GetDivisionGroupName(divisionId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Connection {ConnectionId} left score updates for division {DivisionId}",
            Context.ConnectionId, divisionId);
    }

    /// <summary>
    /// Join court updates group for an event
    /// </summary>
    public async Task JoinCourtUpdates(int eventId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"courts_{eventId}");
        _logger.LogInformation("Connection {ConnectionId} joined court updates for event {EventId}",
            Context.ConnectionId, eventId);
    }

    /// <summary>
    /// Leave court updates group for an event
    /// </summary>
    public async Task LeaveCourtUpdates(int eventId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"courts_{eventId}");
        _logger.LogInformation("Connection {ConnectionId} left court updates for event {EventId}",
            Context.ConnectionId, eventId);
    }

    /// <summary>
    /// Join Game Day updates for an event (player queue, status changes, round generation)
    /// </summary>
    public async Task JoinGameDay(int eventId)
    {
        var groupName = GetGameDayGroupName(eventId);
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Connection {ConnectionId} joined Game Day updates for event {EventId}",
            Context.ConnectionId, eventId);
    }

    /// <summary>
    /// Leave Game Day updates for an event
    /// </summary>
    public async Task LeaveGameDay(int eventId)
    {
        var groupName = GetGameDayGroupName(eventId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Connection {ConnectionId} left Game Day updates for event {EventId}",
            Context.ConnectionId, eventId);
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogDebug("Connection {ConnectionId} disconnected from ScoreHub", Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    public static string GetEventGroupName(int eventId) => $"score_event_{eventId}";
    public static string GetDivisionGroupName(int divisionId) => $"score_division_{divisionId}";
    public static string GetCourtGroupName(int eventId) => $"courts_{eventId}";
    public static string GetGameDayGroupName(int eventId) => $"gameday_{eventId}";
}

/// <summary>
/// Service for broadcasting score and bracket updates to connected clients
/// </summary>
public interface IScoreBroadcaster
{
    /// <summary>
    /// Broadcast a game score update
    /// </summary>
    Task BroadcastGameScoreUpdated(int eventId, int divisionId, GameScoreUpdateDto update);

    /// <summary>
    /// Broadcast a match/encounter completion
    /// </summary>
    Task BroadcastMatchCompleted(int eventId, int divisionId, MatchCompletedDto update);

    /// <summary>
    /// Broadcast bracket progression (winner advanced to next round)
    /// </summary>
    Task BroadcastBracketProgression(int eventId, int divisionId, BracketProgressionDto update);

    /// <summary>
    /// Broadcast a full schedule refresh signal (clients should reload data)
    /// </summary>
    Task BroadcastScheduleRefresh(int eventId, int divisionId);

    /// <summary>
    /// Broadcast a court status change (game queued, started, completed on court)
    /// </summary>
    Task BroadcastCourtStatusChanged(int eventId, CourtStatusDto update);

    /// <summary>
    /// Broadcast pool rankings update (after calculation or finalization)
    /// </summary>
    Task BroadcastStandingsUpdated(int eventId, int divisionId);

    /// <summary>
    /// Broadcast that a new game is ready/queued (for TD dashboard refresh)
    /// </summary>
    Task BroadcastGameStatusChanged(int eventId, int divisionId, GameStatusChangeDto update);

    /// <summary>
    /// Broadcast that a Game Day round was generated (new games created)
    /// </summary>
    Task BroadcastGameDayRoundGenerated(int eventId, GameDayRoundGeneratedDto update);

    /// <summary>
    /// Broadcast a game completion in Game Day (triggers court release notification)
    /// </summary>
    Task BroadcastGameDayGameCompleted(int eventId, GameDayGameCompletedDto update);

    /// <summary>
    /// Broadcast a player status change in Game Day
    /// </summary>
    Task BroadcastGameDayPlayerStatusChanged(int eventId, GameDayPlayerStatusChangedDto update);

    /// <summary>
    /// Broadcast a queue update in Game Day (player priorities changed)
    /// </summary>
    Task BroadcastGameDayQueueUpdated(int eventId, GameDayQueueUpdatedDto update);
}

public class ScoreBroadcaster : IScoreBroadcaster
{
    private readonly IHubContext<ScoreHub> _hubContext;
    private readonly ILogger<ScoreBroadcaster> _logger;

    public ScoreBroadcaster(IHubContext<ScoreHub> hubContext, ILogger<ScoreBroadcaster> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task BroadcastGameScoreUpdated(int eventId, int divisionId, GameScoreUpdateDto update)
    {
        var eventGroup = ScoreHub.GetEventGroupName(eventId);
        var divisionGroup = ScoreHub.GetDivisionGroupName(divisionId);

        // Send to both event and division groups
        await Task.WhenAll(
            _hubContext.Clients.Group(eventGroup).SendAsync("GameScoreUpdated", update),
            _hubContext.Clients.Group(divisionGroup).SendAsync("GameScoreUpdated", update)
        );

        _logger.LogDebug("Broadcasted game score update: Game {GameId} = {Unit1Score}-{Unit2Score}",
            update.GameId, update.Unit1Score, update.Unit2Score);
    }

    public async Task BroadcastMatchCompleted(int eventId, int divisionId, MatchCompletedDto update)
    {
        var eventGroup = ScoreHub.GetEventGroupName(eventId);
        var divisionGroup = ScoreHub.GetDivisionGroupName(divisionId);

        await Task.WhenAll(
            _hubContext.Clients.Group(eventGroup).SendAsync("MatchCompleted", update),
            _hubContext.Clients.Group(divisionGroup).SendAsync("MatchCompleted", update)
        );

        _logger.LogInformation("Broadcasted match completed: Encounter {EncounterId}, Winner: {WinnerName}",
            update.EncounterId, update.WinnerName);
    }

    public async Task BroadcastBracketProgression(int eventId, int divisionId, BracketProgressionDto update)
    {
        var eventGroup = ScoreHub.GetEventGroupName(eventId);
        var divisionGroup = ScoreHub.GetDivisionGroupName(divisionId);

        await Task.WhenAll(
            _hubContext.Clients.Group(eventGroup).SendAsync("BracketProgression", update),
            _hubContext.Clients.Group(divisionGroup).SendAsync("BracketProgression", update)
        );

        _logger.LogInformation("Broadcasted bracket progression: {WinnerName} advanced to {NextRoundName}",
            update.WinnerName, update.NextRoundName);
    }

    public async Task BroadcastScheduleRefresh(int eventId, int divisionId)
    {
        var eventGroup = ScoreHub.GetEventGroupName(eventId);
        var divisionGroup = ScoreHub.GetDivisionGroupName(divisionId);

        var message = new { eventId, divisionId, timestamp = DateTime.UtcNow };

        await Task.WhenAll(
            _hubContext.Clients.Group(eventGroup).SendAsync("ScheduleRefresh", message),
            _hubContext.Clients.Group(divisionGroup).SendAsync("ScheduleRefresh", message)
        );

        _logger.LogDebug("Broadcasted schedule refresh for event {EventId}, division {DivisionId}",
            eventId, divisionId);
    }

    public async Task BroadcastCourtStatusChanged(int eventId, CourtStatusDto update)
    {
        var eventGroup = ScoreHub.GetEventGroupName(eventId);
        var courtGroup = ScoreHub.GetCourtGroupName(eventId);

        await Task.WhenAll(
            _hubContext.Clients.Group(eventGroup).SendAsync("CourtStatusChanged", update),
            _hubContext.Clients.Group(courtGroup).SendAsync("CourtStatusChanged", update)
        );

        _logger.LogDebug("Broadcasted court status change: Court {CourtId} = {Status}",
            update.CourtId, update.Status);
    }

    public async Task BroadcastStandingsUpdated(int eventId, int divisionId)
    {
        var eventGroup = ScoreHub.GetEventGroupName(eventId);
        var divisionGroup = ScoreHub.GetDivisionGroupName(divisionId);

        var message = new { eventId, divisionId, timestamp = DateTime.UtcNow };

        await Task.WhenAll(
            _hubContext.Clients.Group(eventGroup).SendAsync("StandingsUpdated", message),
            _hubContext.Clients.Group(divisionGroup).SendAsync("StandingsUpdated", message)
        );

        _logger.LogDebug("Broadcasted standings update for event {EventId}, division {DivisionId}",
            eventId, divisionId);
    }

    public async Task BroadcastGameStatusChanged(int eventId, int divisionId, GameStatusChangeDto update)
    {
        var eventGroup = ScoreHub.GetEventGroupName(eventId);
        var divisionGroup = ScoreHub.GetDivisionGroupName(divisionId);

        await Task.WhenAll(
            _hubContext.Clients.Group(eventGroup).SendAsync("GameStatusChanged", update),
            _hubContext.Clients.Group(divisionGroup).SendAsync("GameStatusChanged", update)
        );

        _logger.LogDebug("Broadcasted game status change: Game {GameId} = {NewStatus}",
            update.GameId, update.NewStatus);
    }

    public async Task BroadcastGameDayRoundGenerated(int eventId, GameDayRoundGeneratedDto update)
    {
        var eventGroup = ScoreHub.GetEventGroupName(eventId);
        var gameDayGroup = ScoreHub.GetGameDayGroupName(eventId);

        await Task.WhenAll(
            _hubContext.Clients.Group(eventGroup).SendAsync("GameDayRoundGenerated", update),
            _hubContext.Clients.Group(gameDayGroup).SendAsync("GameDayRoundGenerated", update)
        );

        _logger.LogInformation("Broadcasted Game Day round generated for event {EventId}: {GamesCreated} games",
            eventId, update.GamesCreated);
    }

    public async Task BroadcastGameDayGameCompleted(int eventId, GameDayGameCompletedDto update)
    {
        var eventGroup = ScoreHub.GetEventGroupName(eventId);
        var gameDayGroup = ScoreHub.GetGameDayGroupName(eventId);

        await Task.WhenAll(
            _hubContext.Clients.Group(eventGroup).SendAsync("GameDayGameCompleted", update),
            _hubContext.Clients.Group(gameDayGroup).SendAsync("GameDayGameCompleted", update)
        );

        _logger.LogInformation("Broadcasted Game Day game completed for event {EventId}, court {CourtLabel} released",
            eventId, update.CourtLabel);
    }

    public async Task BroadcastGameDayPlayerStatusChanged(int eventId, GameDayPlayerStatusChangedDto update)
    {
        var gameDayGroup = ScoreHub.GetGameDayGroupName(eventId);

        await _hubContext.Clients.Group(gameDayGroup).SendAsync("GameDayPlayerStatusChanged", update);

        _logger.LogDebug("Broadcasted Game Day player status change for event {EventId}: user {UserId} = {Status}",
            eventId, update.UserId, update.NewStatus);
    }

    public async Task BroadcastGameDayQueueUpdated(int eventId, GameDayQueueUpdatedDto update)
    {
        var gameDayGroup = ScoreHub.GetGameDayGroupName(eventId);

        await _hubContext.Clients.Group(gameDayGroup).SendAsync("GameDayQueueUpdated", update);

        _logger.LogDebug("Broadcasted Game Day queue update for event {EventId}: {PlayerCount} players in queue",
            eventId, update.TotalPlayersInQueue);
    }
}

// ==========================================
// DTOs for score broadcasts
// ==========================================

public class GameScoreUpdateDto
{
    public int GameId { get; set; }
    public int EncounterId { get; set; }
    public int DivisionId { get; set; }
    public int GameNumber { get; set; }
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public int? WinnerUnitId { get; set; }
    public string? WinnerName { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}

public class MatchCompletedDto
{
    public int EncounterId { get; set; }
    public int DivisionId { get; set; }
    public string RoundType { get; set; } = string.Empty;
    public string RoundName { get; set; } = string.Empty;
    public int? Unit1Id { get; set; }
    public string? Unit1Name { get; set; }
    public int? Unit2Id { get; set; }
    public string? Unit2Name { get; set; }
    public int? WinnerUnitId { get; set; }
    public string? WinnerName { get; set; }
    public string Score { get; set; } = string.Empty;
    public DateTime CompletedAt { get; set; }
}

public class BracketProgressionDto
{
    public int FromEncounterId { get; set; }
    public int ToEncounterId { get; set; }
    public int DivisionId { get; set; }
    public int WinnerUnitId { get; set; }
    public string WinnerName { get; set; } = string.Empty;
    public string FromRoundName { get; set; } = string.Empty;
    public string NextRoundName { get; set; } = string.Empty;
    public int SlotPosition { get; set; } // 1 = Unit1, 2 = Unit2
    public DateTime AdvancedAt { get; set; }
}

public class CourtStatusDto
{
    public int CourtId { get; set; }
    public string CourtLabel { get; set; } = "";
    public string Status { get; set; } = ""; // Available, InUse
    public int? CurrentGameId { get; set; }
    public string? Unit1Name { get; set; }
    public string? Unit2Name { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class GameStatusChangeDto
{
    public int GameId { get; set; }
    public int EncounterId { get; set; }
    public string OldStatus { get; set; } = "";
    public string NewStatus { get; set; } = "";
    public int? CourtId { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// ==========================================
// Game Day SignalR DTOs
// ==========================================

public class GameDayRoundGeneratedDto
{
    public int EventId { get; set; }
    public int GamesCreated { get; set; }
    public int PlayersAssigned { get; set; }
    public string Method { get; set; } = "";
    public DateTime GeneratedAt { get; set; }
}

public class GameDayGameCompletedDto
{
    public int EventId { get; set; }
    public int EncounterId { get; set; }
    public int? CourtId { get; set; }
    public string? CourtLabel { get; set; }
    public string? WinnerName { get; set; }
    public string? LoserName { get; set; }
    public string Score { get; set; } = "";
    public DateTime CompletedAt { get; set; }
}

public class GameDayPlayerStatusChangedDto
{
    public int EventId { get; set; }
    public int UserId { get; set; }
    public string PlayerName { get; set; } = "";
    public string OldStatus { get; set; } = "";
    public string NewStatus { get; set; } = "";
    public DateTime UpdatedAt { get; set; }
}

public class GameDayQueueUpdatedDto
{
    public int EventId { get; set; }
    public int TotalPlayersInQueue { get; set; }
    public int AvailablePlayers { get; set; }
    public int PlayingPlayers { get; set; }
    public int RestingPlayers { get; set; }
    public DateTime UpdatedAt { get; set; }
}
