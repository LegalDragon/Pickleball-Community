using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Services;

/// <summary>
/// Service interface for managing Game Day player status tracking.
/// Ported from InstaGameService patterns for the Event/GameDay system.
/// </summary>
public interface IGameDayPlayerStatusService
{
    /// <summary>
    /// Get or create player status for a user in an event
    /// </summary>
    Task<GameDayPlayerStatus> GetOrCreateAsync(int eventId, int userId);

    /// <summary>
    /// Update a player's status (Available, Playing, Resting, SittingOut)
    /// </summary>
    Task<GameDayPlayerStatus?> UpdateStatusAsync(int eventId, int userId, string status);

    /// <summary>
    /// Get the player queue sorted by fairness priority (longest sitting → highest priority)
    /// </summary>
    Task<List<GameDayPlayerStatusDto>> GetPlayerQueueAsync(int eventId);

    /// <summary>
    /// Get all available player IDs sorted by fairness priority
    /// </summary>
    Task<List<int>> GetAvailablePlayerIdsByPriorityAsync(int eventId, int? maxConsecutiveGames = null);

    /// <summary>
    /// Mark players as playing (called when a round is generated)
    /// </summary>
    Task MarkPlayersPlayingAsync(int eventId, IEnumerable<int> userIds);

    /// <summary>
    /// Mark players as available (called when a game completes)
    /// </summary>
    Task MarkPlayersAvailableAsync(int eventId, IEnumerable<int> userIds);

    /// <summary>
    /// Increment GamesSinceLastPlay for all available players who were NOT assigned a game
    /// </summary>
    Task IncrementSitOutCountAsync(int eventId, IEnumerable<int> assignedPlayerIds);

    /// <summary>
    /// Initialize player statuses from checked-in members (call at start of game day)
    /// </summary>
    Task InitializeFromCheckedInAsync(int eventId);
}

/// <summary>
/// Implementation of GameDay player status tracking service.
/// </summary>
public class GameDayPlayerStatusService : IGameDayPlayerStatusService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<GameDayPlayerStatusService> _logger;

    public GameDayPlayerStatusService(ApplicationDbContext context, ILogger<GameDayPlayerStatusService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<GameDayPlayerStatus> GetOrCreateAsync(int eventId, int userId)
    {
        var status = await _context.GameDayPlayerStatuses
            .FirstOrDefaultAsync(s => s.EventId == eventId && s.UserId == userId);

        if (status == null)
        {
            status = new GameDayPlayerStatus
            {
                EventId = eventId,
                UserId = userId,
                Status = GameDayPlayerStatusValues.Available,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            _context.GameDayPlayerStatuses.Add(status);
            await _context.SaveChangesAsync();
        }

        return status;
    }

    public async Task<GameDayPlayerStatus?> UpdateStatusAsync(int eventId, int userId, string status)
    {
        var validStatuses = new[] {
            GameDayPlayerStatusValues.Available,
            GameDayPlayerStatusValues.Playing,
            GameDayPlayerStatusValues.Resting,
            GameDayPlayerStatusValues.SittingOut
        };

        if (!validStatuses.Contains(status))
            return null;

        var playerStatus = await GetOrCreateAsync(eventId, userId);
        playerStatus.Status = status;
        playerStatus.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();
        return playerStatus;
    }

    public async Task<List<GameDayPlayerStatusDto>> GetPlayerQueueAsync(int eventId)
    {
        var statuses = await _context.GameDayPlayerStatuses
            .Include(s => s.User)
            .Where(s => s.EventId == eventId)
            .OrderByDescending(s => s.GamesSinceLastPlay) // Longest waiting first
            .ThenBy(s => s.TotalGamesPlayed) // Fewest games played next
            .ThenBy(s => s.LastPlayedAt ?? DateTime.MinValue) // Never played first
            .ToListAsync();

        return statuses.Select((s, index) => new GameDayPlayerStatusDto
        {
            UserId = s.UserId,
            Name = Utility.FormatName(s.User?.LastName, s.User?.FirstName),
            ProfileImageUrl = s.User?.ProfileImageUrl,
            Status = s.Status,
            GamesSinceLastPlay = s.GamesSinceLastPlay,
            ConsecutiveGames = s.ConsecutiveGames,
            TotalGamesPlayed = s.TotalGamesPlayed,
            LastPlayedAt = s.LastPlayedAt,
            QueuePosition = index + 1,
            WaitTimeMinutes = s.LastPlayedAt.HasValue
                ? (int)(DateTime.Now - s.LastPlayedAt.Value).TotalMinutes
                : null
        }).ToList();
    }

    public async Task<List<int>> GetAvailablePlayerIdsByPriorityAsync(int eventId, int? maxConsecutiveGames = null)
    {
        var query = _context.GameDayPlayerStatuses
            .Where(s => s.EventId == eventId && s.Status == GameDayPlayerStatusValues.Available);

        // If max consecutive games set, exclude players who've hit the limit
        if (maxConsecutiveGames.HasValue)
        {
            query = query.Where(s => s.ConsecutiveGames < maxConsecutiveGames.Value);
        }

        return await query
            .OrderByDescending(s => s.GamesSinceLastPlay) // Longest waiting first
            .ThenBy(s => s.TotalGamesPlayed) // Fewest games played next
            .ThenBy(s => s.LastPlayedAt ?? DateTime.MinValue) // Never played first
            .Select(s => s.UserId)
            .ToListAsync();
    }

    public async Task MarkPlayersPlayingAsync(int eventId, IEnumerable<int> userIds)
    {
        var userIdList = userIds.ToList();
        var statuses = await _context.GameDayPlayerStatuses
            .Where(s => s.EventId == eventId && userIdList.Contains(s.UserId))
            .ToListAsync();

        var now = DateTime.Now;
        foreach (var status in statuses)
        {
            status.Status = GameDayPlayerStatusValues.Playing;
            status.ConsecutiveGames++;
            status.TotalGamesPlayed++;
            status.GamesSinceLastPlay = 0;
            status.LastPlayedAt = now;
            status.UpdatedAt = now;
        }

        // Create statuses for any users that don't have one yet
        var existingUserIds = statuses.Select(s => s.UserId).ToHashSet();
        foreach (var userId in userIdList.Where(id => !existingUserIds.Contains(id)))
        {
            _context.GameDayPlayerStatuses.Add(new GameDayPlayerStatus
            {
                EventId = eventId,
                UserId = userId,
                Status = GameDayPlayerStatusValues.Playing,
                ConsecutiveGames = 1,
                TotalGamesPlayed = 1,
                GamesSinceLastPlay = 0,
                LastPlayedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        await _context.SaveChangesAsync();
    }

    public async Task MarkPlayersAvailableAsync(int eventId, IEnumerable<int> userIds)
    {
        var userIdList = userIds.ToList();
        var statuses = await _context.GameDayPlayerStatuses
            .Where(s => s.EventId == eventId && userIdList.Contains(s.UserId))
            .ToListAsync();

        var now = DateTime.Now;
        foreach (var status in statuses)
        {
            status.Status = GameDayPlayerStatusValues.Available;
            status.UpdatedAt = now;
        }

        await _context.SaveChangesAsync();
    }

    public async Task IncrementSitOutCountAsync(int eventId, IEnumerable<int> assignedPlayerIds)
    {
        var assignedSet = assignedPlayerIds.ToHashSet();
        var sittingPlayers = await _context.GameDayPlayerStatuses
            .Where(s => s.EventId == eventId
                    && s.Status == GameDayPlayerStatusValues.Available
                    && !assignedSet.Contains(s.UserId))
            .ToListAsync();

        var now = DateTime.Now;
        foreach (var status in sittingPlayers)
        {
            status.GamesSinceLastPlay++;
            status.ConsecutiveGames = 0; // Reset consecutive since they're sitting
            status.UpdatedAt = now;
        }

        await _context.SaveChangesAsync();
    }

    public async Task InitializeFromCheckedInAsync(int eventId)
    {
        // Get all checked-in player IDs for this event
        var checkedInUserIds = await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.IsCheckedIn && m.InviteStatus == "Accepted")
            .Select(m => m.UserId)
            .Distinct()
            .ToListAsync();

        // Get existing statuses
        var existingUserIds = await _context.GameDayPlayerStatuses
            .Where(s => s.EventId == eventId)
            .Select(s => s.UserId)
            .ToListAsync();

        var existingSet = existingUserIds.ToHashSet();
        var now = DateTime.Now;

        // Create statuses for any checked-in players that don't have one
        foreach (var userId in checkedInUserIds.Where(id => !existingSet.Contains(id)))
        {
            _context.GameDayPlayerStatuses.Add(new GameDayPlayerStatus
            {
                EventId = eventId,
                UserId = userId,
                Status = GameDayPlayerStatusValues.Available,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        await _context.SaveChangesAsync();

        var newCount = checkedInUserIds.Count - existingUserIds.Count;
        _logger.LogInformation("Initialized {Count} player statuses for event {EventId}",
            newCount, eventId);
    }
}

// ==========================================
// DTOs for GameDay Player Status
// ==========================================

/// <summary>
/// DTO for player status in the queue
/// </summary>
public class GameDayPlayerStatusDto
{
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public string Status { get; set; } = string.Empty;
    public int GamesSinceLastPlay { get; set; }
    public int ConsecutiveGames { get; set; }
    public int TotalGamesPlayed { get; set; }
    public DateTime? LastPlayedAt { get; set; }
    public int QueuePosition { get; set; }
    public int? WaitTimeMinutes { get; set; }
}

/// <summary>
/// Request DTO for updating player status
/// </summary>
public class UpdateGameDayPlayerStatusDto
{
    /// <summary>
    /// Player's user ID
    /// </summary>
    public int UserId { get; set; }

    /// <summary>
    /// New status: Available, Resting, SittingOut
    /// </summary>
    public string Status { get; set; } = string.Empty;
}

/// <summary>
/// Request DTO for confirming a game score
/// </summary>
public class ConfirmScoreDto
{
    /// <summary>
    /// Which team the confirming player is on (1 or 2)
    /// If null, auto-detected from player's unit membership
    /// </summary>
    public int? Team { get; set; }
}
