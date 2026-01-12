using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.Services;

/// <summary>
/// Service interface for InstaGame operations
/// </summary>
public interface IInstaGameService
{
    // Session management
    Task<InstaGameDetailDto> CreateAsync(CreateInstaGameRequest request, int userId);
    Task<InstaGameDetailDto?> GetByIdAsync(int id, int? userId = null);
    Task<InstaGameDetailDto?> GetByJoinCodeAsync(string joinCode, int? userId = null);
    Task<List<InstaGameDto>> GetActiveAsync(int? limit = 20);
    Task<List<InstaGameDto>> GetNearbyAsync(decimal latitude, decimal longitude, double radiusMiles = 10, int limit = 20);
    Task<InstaGameDetailDto?> UpdateAsync(int id, UpdateInstaGameRequest request, int userId);
    Task<bool> StartSessionAsync(int id, int userId);
    Task<bool> PauseSessionAsync(int id, int userId);
    Task<bool> EndSessionAsync(int id, int userId);

    // Player management
    Task<InstaGameDetailDto?> JoinAsync(string joinCode, int userId);
    Task<bool> LeaveAsync(int instaGameId, int userId);
    Task<bool> UpdatePlayerStatusAsync(int instaGameId, int userId, string status);
    Task<bool> ToggleOrganizerAsync(int instaGameId, int targetUserId, int requestingUserId);

    // Match management
    Task<InstaGameMatchDto?> CreateManualMatchAsync(int instaGameId, CreateManualMatchRequest request, int userId);
    Task<NextMatchResponse> GenerateNextMatchAsync(int instaGameId, int userId);
    Task<bool> StartMatchAsync(int matchId, int userId);
    Task<bool> UpdateMatchScoreAsync(int matchId, UpdateMatchScoreRequest request, int userId);
    Task<InstaGameMatchDto?> CompleteMatchAsync(int matchId, CompleteMatchRequest request, int userId);

    // Queue management
    Task<List<InstaGameQueueDto>> GetQueueAsync(int instaGameId);
    Task<InstaGameQueueDto?> AddToQueueAsync(int instaGameId, AddToQueueRequest request, int userId);
    Task<bool> RemoveFromQueueAsync(int instaGameId, int queueId, int userId);
    Task<List<InstaGameQueueDto>> ReorderQueueAsync(int instaGameId, ReorderQueueRequest request, int userId);

    // Helpers
    Task<string> GenerateJoinCodeAsync();
}

/// <summary>
/// Implementation of InstaGame service
/// </summary>
public class InstaGameService : IInstaGameService
{
    private readonly ApplicationDbContext _context;
    private readonly INotificationService _notificationService;
    private readonly ILogger<InstaGameService> _logger;

    public InstaGameService(
        ApplicationDbContext context,
        INotificationService notificationService,
        ILogger<InstaGameService> logger)
    {
        _context = context;
        _notificationService = notificationService;
        _logger = logger;
    }

    #region Session Management

    public async Task<InstaGameDetailDto> CreateAsync(CreateInstaGameRequest request, int userId)
    {
        var joinCode = await GenerateJoinCodeAsync();

        var instaGame = new InstaGame
        {
            CreatorId = userId,
            Name = request.Name,
            JoinCode = joinCode,
            Status = InstaGameStatus.Lobby,
            SchedulingMethod = request.SchedulingMethod,
            TeamSize = request.TeamSize,
            MaxPlayers = request.MaxPlayers,
            ScoreFormatId = request.ScoreFormatId,
            VenueId = request.VenueId,
            CustomLocationName = request.CustomLocationName,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            CreatedAt = DateTime.UtcNow
        };

        _context.InstaGames.Add(instaGame);
        await _context.SaveChangesAsync();

        // Add creator as organizer
        var player = new InstaGamePlayer
        {
            InstaGameId = instaGame.Id,
            UserId = userId,
            Status = InstaGamePlayerStatus.Available,
            IsOrganizer = true,
            JoinedAt = DateTime.UtcNow
        };

        _context.InstaGamePlayers.Add(player);
        await _context.SaveChangesAsync();

        _logger.LogInformation("InstaGame {Id} created by user {UserId} with code {JoinCode}",
            instaGame.Id, userId, joinCode);

        return (await GetByIdAsync(instaGame.Id, userId))!;
    }

    public async Task<InstaGameDetailDto?> GetByIdAsync(int id, int? userId = null)
    {
        var instaGame = await _context.InstaGames
            .Include(g => g.Creator)
            .Include(g => g.Venue)
            .Include(g => g.ScoreFormat)
            .Include(g => g.Players.Where(p => p.Status != InstaGamePlayerStatus.Left))
                .ThenInclude(p => p.User)
            .Include(g => g.Matches.OrderByDescending(m => m.MatchNumber).Take(10))
            .Include(g => g.Queue.OrderBy(q => q.Position))
            .FirstOrDefaultAsync(g => g.Id == id);

        if (instaGame == null) return null;

        return MapToDetailDto(instaGame, userId);
    }

    public async Task<InstaGameDetailDto?> GetByJoinCodeAsync(string joinCode, int? userId = null)
    {
        var instaGame = await _context.InstaGames
            .Include(g => g.Creator)
            .Include(g => g.Venue)
            .Include(g => g.ScoreFormat)
            .Include(g => g.Players.Where(p => p.Status != InstaGamePlayerStatus.Left))
                .ThenInclude(p => p.User)
            .Include(g => g.Matches.OrderByDescending(m => m.MatchNumber).Take(10))
            .Include(g => g.Queue.OrderBy(q => q.Position))
            .FirstOrDefaultAsync(g => g.JoinCode == joinCode.ToUpper());

        if (instaGame == null) return null;

        return MapToDetailDto(instaGame, userId);
    }

    public async Task<List<InstaGameDto>> GetActiveAsync(int? limit = 20)
    {
        var games = await _context.InstaGames
            .Include(g => g.Creator)
            .Include(g => g.Venue)
            .Include(g => g.Players)
            .Include(g => g.Matches)
            .Where(g => g.Status == InstaGameStatus.Lobby ||
                       g.Status == InstaGameStatus.Active ||
                       g.Status == InstaGameStatus.Paused)
            .OrderByDescending(g => g.CreatedAt)
            .Take(limit ?? 20)
            .ToListAsync();

        return games.Select(MapToDto).ToList();
    }

    public async Task<List<InstaGameDto>> GetNearbyAsync(decimal latitude, decimal longitude, double radiusMiles = 10, int limit = 20)
    {
        // Use stored procedure for geospatial query
        var games = await _context.InstaGames
            .FromSqlRaw("EXEC sp_InstaGame_FindNearby @p0, @p1, @p2, @p3",
                latitude, longitude, radiusMiles, limit)
            .ToListAsync();

        // If stored procedure fails, fall back to EF Core
        if (!games.Any())
        {
            games = await _context.InstaGames
                .Include(g => g.Creator)
                .Include(g => g.Venue)
                .Include(g => g.Players)
                .Include(g => g.Matches)
                .Where(g => g.Status == InstaGameStatus.Lobby ||
                           g.Status == InstaGameStatus.Active ||
                           g.Status == InstaGameStatus.Paused)
                .Where(g => g.Latitude != null || g.Venue!.Latitude != null)
                .OrderByDescending(g => g.CreatedAt)
                .Take(limit)
                .ToListAsync();
        }

        return games.Select(MapToDto).ToList();
    }

    public async Task<InstaGameDetailDto?> UpdateAsync(int id, UpdateInstaGameRequest request, int userId)
    {
        var instaGame = await _context.InstaGames.FindAsync(id);
        if (instaGame == null) return null;

        // Only creator or organizer can update
        var isOrganizer = await IsOrganizerAsync(id, userId);
        if (!isOrganizer) return null;

        if (request.Name != null) instaGame.Name = request.Name;
        if (request.SchedulingMethod != null) instaGame.SchedulingMethod = request.SchedulingMethod;
        if (request.MaxPlayers.HasValue) instaGame.MaxPlayers = request.MaxPlayers;
        if (request.ScoreFormatId.HasValue) instaGame.ScoreFormatId = request.ScoreFormatId;

        await _context.SaveChangesAsync();

        return await GetByIdAsync(id, userId);
    }

    public async Task<bool> StartSessionAsync(int id, int userId)
    {
        var instaGame = await _context.InstaGames.FindAsync(id);
        if (instaGame == null) return false;

        if (!await IsOrganizerAsync(id, userId)) return false;

        instaGame.Status = InstaGameStatus.Active;
        instaGame.StartedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Notify all players
        await NotifySessionStatusChangeAsync(id, InstaGameStatus.Active);

        return true;
    }

    public async Task<bool> PauseSessionAsync(int id, int userId)
    {
        var instaGame = await _context.InstaGames.FindAsync(id);
        if (instaGame == null) return false;

        if (!await IsOrganizerAsync(id, userId)) return false;

        instaGame.Status = InstaGameStatus.Paused;
        await _context.SaveChangesAsync();

        await NotifySessionStatusChangeAsync(id, InstaGameStatus.Paused);

        return true;
    }

    public async Task<bool> EndSessionAsync(int id, int userId)
    {
        var instaGame = await _context.InstaGames.FindAsync(id);
        if (instaGame == null) return false;

        if (!await IsOrganizerAsync(id, userId)) return false;

        instaGame.Status = InstaGameStatus.Completed;
        instaGame.EndedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await NotifySessionStatusChangeAsync(id, InstaGameStatus.Completed);

        return true;
    }

    #endregion

    #region Player Management

    public async Task<InstaGameDetailDto?> JoinAsync(string joinCode, int userId)
    {
        var instaGame = await _context.InstaGames
            .Include(g => g.Players)
            .FirstOrDefaultAsync(g => g.JoinCode == joinCode.ToUpper());

        if (instaGame == null) return null;

        // Check if session is joinable
        if (instaGame.Status == InstaGameStatus.Completed ||
            instaGame.Status == InstaGameStatus.Cancelled)
            return null;

        // Check if already joined
        var existingPlayer = instaGame.Players.FirstOrDefault(p => p.UserId == userId);
        if (existingPlayer != null)
        {
            if (existingPlayer.Status == InstaGamePlayerStatus.Left)
            {
                // Rejoin
                existingPlayer.Status = InstaGamePlayerStatus.Available;
                existingPlayer.LeftAt = null;
                await _context.SaveChangesAsync();
            }
            return await GetByIdAsync(instaGame.Id, userId);
        }

        // Check max players
        var activePlayers = instaGame.Players.Count(p => p.Status != InstaGamePlayerStatus.Left);
        if (instaGame.MaxPlayers.HasValue && activePlayers >= instaGame.MaxPlayers.Value)
            return null;

        // Add player
        var player = new InstaGamePlayer
        {
            InstaGameId = instaGame.Id,
            UserId = userId,
            Status = InstaGamePlayerStatus.Available,
            IsOrganizer = false,
            JoinedAt = DateTime.UtcNow
        };

        _context.InstaGamePlayers.Add(player);
        await _context.SaveChangesAsync();

        // Notify other players
        await NotifyPlayerJoinedAsync(instaGame.Id, userId);

        _logger.LogInformation("User {UserId} joined InstaGame {Id}", userId, instaGame.Id);

        return await GetByIdAsync(instaGame.Id, userId);
    }

    public async Task<bool> LeaveAsync(int instaGameId, int userId)
    {
        var player = await _context.InstaGamePlayers
            .FirstOrDefaultAsync(p => p.InstaGameId == instaGameId && p.UserId == userId);

        if (player == null) return false;

        player.Status = InstaGamePlayerStatus.Left;
        player.LeftAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Notify other players
        await NotifyPlayerLeftAsync(instaGameId, userId);

        return true;
    }

    public async Task<bool> UpdatePlayerStatusAsync(int instaGameId, int userId, string status)
    {
        var player = await _context.InstaGamePlayers
            .FirstOrDefaultAsync(p => p.InstaGameId == instaGameId && p.UserId == userId);

        if (player == null) return false;

        player.Status = status;
        await _context.SaveChangesAsync();

        // Notify other players
        await NotifyPlayerStatusChangedAsync(instaGameId, userId, status);

        return true;
    }

    public async Task<bool> ToggleOrganizerAsync(int instaGameId, int targetUserId, int requestingUserId)
    {
        // Only creator can toggle organizer status
        var instaGame = await _context.InstaGames.FindAsync(instaGameId);
        if (instaGame == null || instaGame.CreatorId != requestingUserId) return false;

        var player = await _context.InstaGamePlayers
            .FirstOrDefaultAsync(p => p.InstaGameId == instaGameId && p.UserId == targetUserId);

        if (player == null) return false;

        player.IsOrganizer = !player.IsOrganizer;
        await _context.SaveChangesAsync();

        return true;
    }

    #endregion

    #region Match Management

    public async Task<InstaGameMatchDto?> CreateManualMatchAsync(int instaGameId, CreateManualMatchRequest request, int userId)
    {
        if (!await IsOrganizerAsync(instaGameId, userId)) return null;

        var instaGame = await _context.InstaGames
            .Include(g => g.Matches)
            .FirstOrDefaultAsync(g => g.Id == instaGameId);

        if (instaGame == null) return null;

        var nextMatchNumber = instaGame.Matches.Any()
            ? instaGame.Matches.Max(m => m.MatchNumber) + 1
            : 1;

        var match = new InstaGameMatch
        {
            InstaGameId = instaGameId,
            MatchNumber = nextMatchNumber,
            Status = InstaGameMatchStatus.Ready,
            Team1PlayerIds = JsonSerializer.Serialize(request.Team1PlayerIds),
            Team2PlayerIds = JsonSerializer.Serialize(request.Team2PlayerIds),
            CreatedAt = DateTime.UtcNow
        };

        _context.InstaGameMatches.Add(match);

        // Mark players as playing
        await UpdatePlayersStatusForMatch(instaGameId, request.Team1PlayerIds.Concat(request.Team2PlayerIds).ToList(), InstaGamePlayerStatus.Playing);

        await _context.SaveChangesAsync();

        // Notify players
        await NotifyMatchCreatedAsync(instaGameId, match.Id);

        return await MapMatchToDtoAsync(match);
    }

    public async Task<NextMatchResponse> GenerateNextMatchAsync(int instaGameId, int userId)
    {
        if (!await IsOrganizerAsync(instaGameId, userId))
            return new NextMatchResponse { Success = false, Message = "Not authorized" };

        var instaGame = await _context.InstaGames
            .Include(g => g.Matches.OrderByDescending(m => m.MatchNumber))
            .Include(g => g.Players.Where(p => p.Status == InstaGamePlayerStatus.Available))
            .FirstOrDefaultAsync(g => g.Id == instaGameId);

        if (instaGame == null)
            return new NextMatchResponse { Success = false, Message = "InstaGame not found" };

        var lastMatch = instaGame.Matches.FirstOrDefault(m => m.Status == InstaGameMatchStatus.Completed);
        List<int>? team1Ids = null;
        List<int>? team2Ids = null;

        switch (instaGame.SchedulingMethod)
        {
            case InstaGameSchedulingMethod.Popcorn:
                (team1Ids, team2Ids) = await GeneratePopcornTeamsAsync(instaGame, lastMatch);
                break;

            case InstaGameSchedulingMethod.Gauntlet:
                (team1Ids, team2Ids) = await GenerateGauntletTeamsAsync(instaGame, lastMatch);
                break;

            case InstaGameSchedulingMethod.Manual:
            default:
                // For manual, check if there's a queued match
                var queuedMatch = await _context.InstaGameQueues
                    .Where(q => q.InstaGameId == instaGameId)
                    .OrderBy(q => q.Position)
                    .FirstOrDefaultAsync();

                if (queuedMatch != null)
                {
                    team1Ids = JsonSerializer.Deserialize<List<int>>(queuedMatch.Team1PlayerIds);
                    team2Ids = queuedMatch.Team2PlayerIds != null
                        ? JsonSerializer.Deserialize<List<int>>(queuedMatch.Team2PlayerIds)
                        : null;

                    // Remove from queue
                    _context.InstaGameQueues.Remove(queuedMatch);
                }
                break;
        }

        if (team1Ids == null || team2Ids == null || team1Ids.Count < instaGame.TeamSize || team2Ids.Count < instaGame.TeamSize)
        {
            return new NextMatchResponse
            {
                Success = false,
                Message = "Not enough available players",
                NotEnoughPlayers = true
            };
        }

        var nextMatchNumber = instaGame.Matches.Any()
            ? instaGame.Matches.Max(m => m.MatchNumber) + 1
            : 1;

        var match = new InstaGameMatch
        {
            InstaGameId = instaGameId,
            MatchNumber = nextMatchNumber,
            Status = InstaGameMatchStatus.Ready,
            Team1PlayerIds = JsonSerializer.Serialize(team1Ids),
            Team2PlayerIds = JsonSerializer.Serialize(team2Ids),
            CreatedAt = DateTime.UtcNow
        };

        _context.InstaGameMatches.Add(match);

        // Mark players as playing
        await UpdatePlayersStatusForMatch(instaGameId, team1Ids.Concat(team2Ids).ToList(), InstaGamePlayerStatus.Playing);

        await _context.SaveChangesAsync();

        await NotifyMatchCreatedAsync(instaGameId, match.Id);

        return new NextMatchResponse
        {
            Success = true,
            Match = await MapMatchToDtoAsync(match)
        };
    }

    public async Task<bool> StartMatchAsync(int matchId, int userId)
    {
        var match = await _context.InstaGameMatches.FindAsync(matchId);
        if (match == null) return false;

        if (!await IsOrganizerAsync(match.InstaGameId, userId)) return false;

        match.Status = InstaGameMatchStatus.InProgress;
        match.StartedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await NotifyMatchScoreUpdateAsync(match);

        return true;
    }

    public async Task<bool> UpdateMatchScoreAsync(int matchId, UpdateMatchScoreRequest request, int userId)
    {
        var match = await _context.InstaGameMatches.FindAsync(matchId);
        if (match == null) return false;

        // Check if user is organizer or participant
        var isOrganizer = await IsOrganizerAsync(match.InstaGameId, userId);
        var isParticipant = match.Team1Players.Contains(userId) || match.Team2Players.Contains(userId);

        if (!isOrganizer && !isParticipant) return false;

        match.Team1Score = request.Team1Score;
        match.Team2Score = request.Team2Score;
        match.ScoreSubmittedByUserId = userId;
        match.ScoreSubmittedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await NotifyMatchScoreUpdateAsync(match);

        return true;
    }

    public async Task<InstaGameMatchDto?> CompleteMatchAsync(int matchId, CompleteMatchRequest request, int userId)
    {
        var match = await _context.InstaGameMatches.FindAsync(matchId);
        if (match == null) return null;

        // Check authorization
        var isOrganizer = await IsOrganizerAsync(match.InstaGameId, userId);
        var isParticipant = match.Team1Players.Contains(userId) || match.Team2Players.Contains(userId);

        if (!isOrganizer && !isParticipant) return null;

        match.Team1Score = request.Team1Score;
        match.Team2Score = request.Team2Score;
        match.WinningTeam = request.WinningTeam;
        match.Status = InstaGameMatchStatus.Completed;
        match.CompletedAt = DateTime.UtcNow;

        if (match.ScoreSubmittedByUserId == null)
        {
            match.ScoreSubmittedByUserId = userId;
            match.ScoreSubmittedAt = DateTime.UtcNow;
        }

        // Update player stats using stored procedure
        await _context.Database.ExecuteSqlRawAsync(
            "EXEC sp_InstaGame_UpdatePlayerStats @p0", matchId);

        // Mark players as available again
        var allPlayerIds = match.Team1Players.Concat(match.Team2Players).ToList();
        await UpdatePlayersStatusForMatch(match.InstaGameId, allPlayerIds, InstaGamePlayerStatus.Available);

        // For Gauntlet: update queue positions (losers go to back)
        var instaGame = await _context.InstaGames.FindAsync(match.InstaGameId);
        if (instaGame?.SchedulingMethod == InstaGameSchedulingMethod.Gauntlet)
        {
            await UpdateGauntletQueueAsync(match);
        }

        await _context.SaveChangesAsync();

        await NotifyMatchScoreUpdateAsync(match);

        return await MapMatchToDtoAsync(match);
    }

    #endregion

    #region Queue Management

    public async Task<List<InstaGameQueueDto>> GetQueueAsync(int instaGameId)
    {
        var queue = await _context.InstaGameQueues
            .Where(q => q.InstaGameId == instaGameId)
            .OrderBy(q => q.Position)
            .ToListAsync();

        var dtos = new List<InstaGameQueueDto>();
        foreach (var item in queue)
        {
            dtos.Add(await MapQueueToDtoAsync(item));
        }
        return dtos;
    }

    public async Task<InstaGameQueueDto?> AddToQueueAsync(int instaGameId, AddToQueueRequest request, int userId)
    {
        if (!await IsOrganizerAsync(instaGameId, userId)) return null;

        var maxPosition = await _context.InstaGameQueues
            .Where(q => q.InstaGameId == instaGameId)
            .MaxAsync(q => (int?)q.Position) ?? 0;

        var queueItem = new InstaGameQueue
        {
            InstaGameId = instaGameId,
            Position = maxPosition + 1,
            Team1PlayerIds = JsonSerializer.Serialize(request.Team1PlayerIds),
            Team2PlayerIds = request.Team2PlayerIds != null
                ? JsonSerializer.Serialize(request.Team2PlayerIds)
                : null,
            QueueType = request.QueueType,
            CreatedAt = DateTime.UtcNow
        };

        _context.InstaGameQueues.Add(queueItem);
        await _context.SaveChangesAsync();

        await NotifyQueueUpdateAsync(instaGameId);

        return await MapQueueToDtoAsync(queueItem);
    }

    public async Task<bool> RemoveFromQueueAsync(int instaGameId, int queueId, int userId)
    {
        if (!await IsOrganizerAsync(instaGameId, userId)) return false;

        var queueItem = await _context.InstaGameQueues.FindAsync(queueId);
        if (queueItem == null || queueItem.InstaGameId != instaGameId) return false;

        _context.InstaGameQueues.Remove(queueItem);
        await _context.SaveChangesAsync();

        // Reorder remaining items
        var remainingItems = await _context.InstaGameQueues
            .Where(q => q.InstaGameId == instaGameId)
            .OrderBy(q => q.Position)
            .ToListAsync();

        for (int i = 0; i < remainingItems.Count; i++)
        {
            remainingItems[i].Position = i + 1;
        }

        await _context.SaveChangesAsync();
        await NotifyQueueUpdateAsync(instaGameId);

        return true;
    }

    public async Task<List<InstaGameQueueDto>> ReorderQueueAsync(int instaGameId, ReorderQueueRequest request, int userId)
    {
        if (!await IsOrganizerAsync(instaGameId, userId)) return new List<InstaGameQueueDto>();

        var queueItems = await _context.InstaGameQueues
            .Where(q => q.InstaGameId == instaGameId)
            .ToListAsync();

        for (int i = 0; i < request.QueueItemIds.Count; i++)
        {
            var item = queueItems.FirstOrDefault(q => q.Id == request.QueueItemIds[i]);
            if (item != null)
            {
                item.Position = i + 1;
            }
        }

        await _context.SaveChangesAsync();
        await NotifyQueueUpdateAsync(instaGameId);

        return await GetQueueAsync(instaGameId);
    }

    #endregion

    #region Scheduling Algorithms

    private async Task<(List<int>? Team1, List<int>? Team2)> GeneratePopcornTeamsAsync(InstaGame instaGame, InstaGameMatch? lastMatch)
    {
        var availablePlayers = instaGame.Players
            .Where(p => p.Status == InstaGamePlayerStatus.Available)
            .Select(p => p.UserId)
            .ToList();

        if (lastMatch != null && lastMatch.WinningTeam.HasValue && instaGame.TeamSize == 2)
        {
            // Popcorn rotation: Winners split, each pairs with a loser
            var winners = lastMatch.WinningTeam == 1 ? lastMatch.Team1Players : lastMatch.Team2Players;
            var losers = lastMatch.WinningTeam == 1 ? lastMatch.Team2Players : lastMatch.Team1Players;

            if (winners.Count >= 2 && losers.Count >= 2)
            {
                // W1+L1 vs W2+L2
                var team1 = new List<int> { winners[0], losers[0] };
                var team2 = new List<int> { winners[1], losers[1] };

                // Verify all players are available
                var allIds = team1.Concat(team2).ToList();
                if (allIds.All(id => availablePlayers.Contains(id)))
                {
                    return (team1, team2);
                }
            }
        }

        // Fallback: Random teams from available players
        var neededPlayers = instaGame.TeamSize * 2;
        if (availablePlayers.Count < neededPlayers)
            return (null, null);

        var shuffled = availablePlayers.OrderBy(_ => Guid.NewGuid()).ToList();
        var team1Ids = shuffled.Take(instaGame.TeamSize).ToList();
        var team2Ids = shuffled.Skip(instaGame.TeamSize).Take(instaGame.TeamSize).ToList();

        return (team1Ids, team2Ids);
    }

    private async Task<(List<int>? Team1, List<int>? Team2)> GenerateGauntletTeamsAsync(InstaGame instaGame, InstaGameMatch? lastMatch)
    {
        var availablePlayers = await _context.InstaGamePlayers
            .Where(p => p.InstaGameId == instaGame.Id && p.Status == InstaGamePlayerStatus.Available)
            .OrderBy(p => p.QueuePosition ?? int.MaxValue)
            .ThenBy(p => p.QueuedAt)
            .ThenBy(p => p.JoinedAt)
            .Select(p => p.UserId)
            .ToListAsync();

        if (lastMatch != null && lastMatch.WinningTeam.HasValue)
        {
            // Winners stay on court
            var winners = lastMatch.WinningTeam == 1 ? lastMatch.Team1Players : lastMatch.Team2Players;

            // Get next challengers from queue (excluding winners)
            var challengers = availablePlayers
                .Where(id => !winners.Contains(id))
                .Take(instaGame.TeamSize)
                .ToList();

            if (winners.Count >= instaGame.TeamSize && challengers.Count >= instaGame.TeamSize)
            {
                return (winners.Take(instaGame.TeamSize).ToList(), challengers);
            }
        }

        // Fallback: First players from queue
        var neededPlayers = instaGame.TeamSize * 2;
        if (availablePlayers.Count < neededPlayers)
            return (null, null);

        var team1Ids = availablePlayers.Take(instaGame.TeamSize).ToList();
        var team2Ids = availablePlayers.Skip(instaGame.TeamSize).Take(instaGame.TeamSize).ToList();

        return (team1Ids, team2Ids);
    }

    private async Task UpdateGauntletQueueAsync(InstaGameMatch match)
    {
        if (match.WinningTeam == null) return;

        // Losers go to back of queue
        var losers = match.WinningTeam == 1 ? match.Team2Players : match.Team1Players;

        var maxQueuePosition = await _context.InstaGamePlayers
            .Where(p => p.InstaGameId == match.InstaGameId)
            .MaxAsync(p => (int?)p.QueuePosition) ?? 0;

        foreach (var loserId in losers)
        {
            var player = await _context.InstaGamePlayers
                .FirstOrDefaultAsync(p => p.InstaGameId == match.InstaGameId && p.UserId == loserId);

            if (player != null)
            {
                player.QueuePosition = ++maxQueuePosition;
                player.QueuedAt = DateTime.UtcNow;
            }
        }

        // Winners keep front of queue (or reset)
        var winners = match.WinningTeam == 1 ? match.Team1Players : match.Team2Players;
        foreach (var winnerId in winners)
        {
            var player = await _context.InstaGamePlayers
                .FirstOrDefaultAsync(p => p.InstaGameId == match.InstaGameId && p.UserId == winnerId);

            if (player != null)
            {
                player.QueuePosition = 1; // Front of queue
                player.QueuedAt = DateTime.UtcNow;
            }
        }
    }

    #endregion

    #region Helpers

    public async Task<string> GenerateJoinCodeAsync()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();

        for (int attempts = 0; attempts < 100; attempts++)
        {
            var code = "G-" + new string(Enumerable.Range(0, 4)
                .Select(_ => chars[random.Next(chars.Length)])
                .ToArray());

            var exists = await _context.InstaGames.AnyAsync(g => g.JoinCode == code);
            if (!exists) return code;
        }

        // Fallback
        return "G-" + Guid.NewGuid().ToString("N").Substring(0, 4).ToUpper();
    }

    private async Task<bool> IsOrganizerAsync(int instaGameId, int userId)
    {
        var instaGame = await _context.InstaGames.FindAsync(instaGameId);
        if (instaGame == null) return false;

        if (instaGame.CreatorId == userId) return true;

        var player = await _context.InstaGamePlayers
            .FirstOrDefaultAsync(p => p.InstaGameId == instaGameId && p.UserId == userId);

        return player?.IsOrganizer ?? false;
    }

    private async Task UpdatePlayersStatusForMatch(int instaGameId, List<int> playerIds, string status)
    {
        var players = await _context.InstaGamePlayers
            .Where(p => p.InstaGameId == instaGameId && playerIds.Contains(p.UserId))
            .ToListAsync();

        foreach (var player in players)
        {
            player.Status = status;
        }
    }

    #endregion

    #region Notifications

    private async Task NotifySessionStatusChangeAsync(int instaGameId, string status)
    {
        var payload = new NotificationPayload
        {
            Type = "InstaGameStatus",
            Title = status == InstaGameStatus.Active ? "Game session started!" :
                    status == InstaGameStatus.Paused ? "Game session paused" :
                    status == InstaGameStatus.Completed ? "Game session ended" : "Session update",
            ActionUrl = $"/instagame/{instaGameId}",
            ReferenceType = "InstaGame",
            ReferenceId = instaGameId,
            CreatedAt = DateTime.UtcNow
        };

        await _notificationService.SendToEventAsync(instaGameId, payload);
    }

    private async Task NotifyPlayerJoinedAsync(int instaGameId, int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        var payload = new NotificationPayload
        {
            Type = "InstaGamePlayerJoined",
            Title = $"{user?.DisplayName ?? "A player"} joined the game",
            ActionUrl = $"/instagame/{instaGameId}",
            ReferenceType = "InstaGame",
            ReferenceId = instaGameId,
            CreatedAt = DateTime.UtcNow
        };

        await _notificationService.SendToEventAsync(instaGameId, payload);
    }

    private async Task NotifyPlayerLeftAsync(int instaGameId, int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        var payload = new NotificationPayload
        {
            Type = "InstaGamePlayerLeft",
            Title = $"{user?.DisplayName ?? "A player"} left the game",
            ActionUrl = $"/instagame/{instaGameId}",
            ReferenceType = "InstaGame",
            ReferenceId = instaGameId,
            CreatedAt = DateTime.UtcNow
        };

        await _notificationService.SendToEventAsync(instaGameId, payload);
    }

    private async Task NotifyPlayerStatusChangedAsync(int instaGameId, int userId, string status)
    {
        var user = await _context.Users.FindAsync(userId);
        var payload = new NotificationPayload
        {
            Type = "InstaGamePlayerStatus",
            Title = $"{user?.DisplayName ?? "A player"} is now {status.ToLower()}",
            ActionUrl = $"/instagame/{instaGameId}",
            ReferenceType = "InstaGame",
            ReferenceId = instaGameId,
            CreatedAt = DateTime.UtcNow
        };

        await _notificationService.SendToEventAsync(instaGameId, payload);
    }

    private async Task NotifyMatchCreatedAsync(int instaGameId, int matchId)
    {
        var payload = new NotificationPayload
        {
            Type = "InstaGameMatchReady",
            Title = "New game is ready!",
            Message = "Check who's playing next",
            ActionUrl = $"/instagame/{instaGameId}",
            ReferenceType = "InstaGameMatch",
            ReferenceId = matchId,
            CreatedAt = DateTime.UtcNow
        };

        await _notificationService.SendToEventAsync(instaGameId, payload);
    }

    private async Task NotifyMatchScoreUpdateAsync(InstaGameMatch match)
    {
        var payload = new InstaGameScorePayload
        {
            InstaGameId = match.InstaGameId,
            MatchId = match.Id,
            MatchNumber = match.MatchNumber,
            Team1Score = match.Team1Score,
            Team2Score = match.Team2Score,
            WinningTeam = match.WinningTeam,
            Status = match.Status,
            UpdatedAt = DateTime.UtcNow
        };

        // Use game group for score updates
        await _notificationService.SendGameScoreAsync(match.InstaGameId, new GameScorePayload
        {
            GameId = match.Id,
            EventId = match.InstaGameId,
            Team1Score = match.Team1Score,
            Team2Score = match.Team2Score,
            Status = match.Status
        });
    }

    private async Task NotifyQueueUpdateAsync(int instaGameId)
    {
        var queue = await GetQueueAsync(instaGameId);
        var payload = new NotificationPayload
        {
            Type = "InstaGameQueueUpdate",
            Title = "Queue updated",
            ActionUrl = $"/instagame/{instaGameId}",
            ReferenceType = "InstaGame",
            ReferenceId = instaGameId,
            CreatedAt = DateTime.UtcNow
        };

        await _notificationService.SendToEventAsync(instaGameId, payload);
    }

    #endregion

    #region Mapping

    private InstaGameDto MapToDto(InstaGame instaGame)
    {
        return new InstaGameDto
        {
            Id = instaGame.Id,
            Name = instaGame.Name,
            JoinCode = instaGame.JoinCode,
            Status = instaGame.Status,
            SchedulingMethod = instaGame.SchedulingMethod,
            TeamSize = instaGame.TeamSize,
            MaxPlayers = instaGame.MaxPlayers,
            VenueId = instaGame.VenueId,
            VenueName = instaGame.Venue?.Name,
            VenueCity = instaGame.Venue?.City,
            VenueState = instaGame.Venue?.State,
            CustomLocationName = instaGame.CustomLocationName,
            Latitude = instaGame.Latitude ?? instaGame.Venue?.Latitude,
            Longitude = instaGame.Longitude ?? instaGame.Venue?.Longitude,
            CreatorId = instaGame.CreatorId,
            CreatorName = instaGame.Creator?.DisplayName,
            CreatorAvatarUrl = instaGame.Creator?.AvatarUrl,
            PlayerCount = instaGame.Players?.Count(p => p.Status != InstaGamePlayerStatus.Left) ?? 0,
            GamesPlayed = instaGame.Matches?.Count(m => m.Status == InstaGameMatchStatus.Completed) ?? 0,
            ScoreFormatId = instaGame.ScoreFormatId,
            ScoreFormatName = instaGame.ScoreFormat?.Name,
            CreatedAt = instaGame.CreatedAt,
            StartedAt = instaGame.StartedAt
        };
    }

    private InstaGameDetailDto MapToDetailDto(InstaGame instaGame, int? userId)
    {
        var dto = new InstaGameDetailDto
        {
            Id = instaGame.Id,
            Name = instaGame.Name,
            JoinCode = instaGame.JoinCode,
            Status = instaGame.Status,
            SchedulingMethod = instaGame.SchedulingMethod,
            TeamSize = instaGame.TeamSize,
            MaxPlayers = instaGame.MaxPlayers,
            VenueId = instaGame.VenueId,
            VenueName = instaGame.Venue?.Name,
            VenueCity = instaGame.Venue?.City,
            VenueState = instaGame.Venue?.State,
            CustomLocationName = instaGame.CustomLocationName,
            Latitude = instaGame.Latitude ?? instaGame.Venue?.Latitude,
            Longitude = instaGame.Longitude ?? instaGame.Venue?.Longitude,
            CreatorId = instaGame.CreatorId,
            CreatorName = instaGame.Creator?.DisplayName,
            CreatorAvatarUrl = instaGame.Creator?.AvatarUrl,
            PlayerCount = instaGame.Players?.Count(p => p.Status != InstaGamePlayerStatus.Left) ?? 0,
            GamesPlayed = instaGame.Matches?.Count(m => m.Status == InstaGameMatchStatus.Completed) ?? 0,
            ScoreFormatId = instaGame.ScoreFormatId,
            ScoreFormatName = instaGame.ScoreFormat?.Name,
            CreatedAt = instaGame.CreatedAt,
            StartedAt = instaGame.StartedAt,
            IsCreator = userId.HasValue && instaGame.CreatorId == userId.Value,
            Players = instaGame.Players?
                .Where(p => p.Status != InstaGamePlayerStatus.Left)
                .Select(p => MapPlayerToDto(p))
                .ToList() ?? new List<InstaGamePlayerDto>()
        };

        if (userId.HasValue)
        {
            var myPlayer = instaGame.Players?.FirstOrDefault(p => p.UserId == userId.Value);
            dto.IsPlayer = myPlayer != null && myPlayer.Status != InstaGamePlayerStatus.Left;
            dto.IsOrganizer = myPlayer?.IsOrganizer ?? false || dto.IsCreator;
            if (myPlayer != null)
            {
                dto.MyPlayerInfo = MapPlayerToDto(myPlayer);
            }
        }

        // Current match (in progress or ready)
        var currentMatch = instaGame.Matches?
            .FirstOrDefault(m => m.Status == InstaGameMatchStatus.InProgress || m.Status == InstaGameMatchStatus.Ready);
        if (currentMatch != null)
        {
            dto.CurrentMatch = MapMatchToDto(currentMatch, instaGame.Players?.ToList());
        }

        // Recent completed matches
        dto.RecentMatches = instaGame.Matches?
            .Where(m => m.Status == InstaGameMatchStatus.Completed)
            .OrderByDescending(m => m.CompletedAt)
            .Take(5)
            .Select(m => MapMatchToDto(m, instaGame.Players?.ToList()))
            .ToList() ?? new List<InstaGameMatchDto>();

        // Queue
        dto.Queue = instaGame.Queue?
            .OrderBy(q => q.Position)
            .Select(q => MapQueueToDto(q, instaGame.Players?.ToList()))
            .ToList() ?? new List<InstaGameQueueDto>();

        return dto;
    }

    private InstaGamePlayerDto MapPlayerToDto(InstaGamePlayer player)
    {
        return new InstaGamePlayerDto
        {
            Id = player.Id,
            UserId = player.UserId,
            DisplayName = player.User?.DisplayName,
            AvatarUrl = player.User?.AvatarUrl,
            Status = player.Status,
            IsOrganizer = player.IsOrganizer,
            GamesPlayed = player.GamesPlayed,
            GamesWon = player.GamesWon,
            GamesLost = player.GamesLost,
            PointsScored = player.PointsScored,
            PointsAgainst = player.PointsAgainst,
            PointsDifferential = player.PointsDifferential,
            WinRate = player.WinRate,
            CurrentWinStreak = player.CurrentWinStreak,
            MaxWinStreak = player.MaxWinStreak,
            QueuePosition = player.QueuePosition,
            QueuedAt = player.QueuedAt,
            JoinedAt = player.JoinedAt
        };
    }

    private InstaGameMatchDto MapMatchToDto(InstaGameMatch match, List<InstaGamePlayer>? players)
    {
        var playerLookup = players?.ToDictionary(p => p.UserId, p => p.User) ?? new Dictionary<int, User?>();

        return new InstaGameMatchDto
        {
            Id = match.Id,
            InstaGameId = match.InstaGameId,
            MatchNumber = match.MatchNumber,
            Status = match.Status,
            Team1 = match.Team1Players.Select(id => new InstaGameMatchPlayerDto
            {
                UserId = id,
                DisplayName = playerLookup.GetValueOrDefault(id)?.DisplayName,
                AvatarUrl = playerLookup.GetValueOrDefault(id)?.AvatarUrl
            }).ToList(),
            Team2 = match.Team2Players.Select(id => new InstaGameMatchPlayerDto
            {
                UserId = id,
                DisplayName = playerLookup.GetValueOrDefault(id)?.DisplayName,
                AvatarUrl = playerLookup.GetValueOrDefault(id)?.AvatarUrl
            }).ToList(),
            Team1Score = match.Team1Score,
            Team2Score = match.Team2Score,
            WinningTeam = match.WinningTeam,
            ScoreSubmittedByUserId = match.ScoreSubmittedByUserId,
            ScoreSubmittedAt = match.ScoreSubmittedAt,
            ScoreConfirmedByUserId = match.ScoreConfirmedByUserId,
            ScoreConfirmedAt = match.ScoreConfirmedAt,
            CreatedAt = match.CreatedAt,
            StartedAt = match.StartedAt,
            CompletedAt = match.CompletedAt
        };
    }

    private async Task<InstaGameMatchDto> MapMatchToDtoAsync(InstaGameMatch match)
    {
        var players = await _context.InstaGamePlayers
            .Include(p => p.User)
            .Where(p => p.InstaGameId == match.InstaGameId)
            .ToListAsync();

        return MapMatchToDto(match, players);
    }

    private InstaGameQueueDto MapQueueToDto(InstaGameQueue queueItem, List<InstaGamePlayer>? players)
    {
        var playerLookup = players?.ToDictionary(p => p.UserId, p => p.User) ?? new Dictionary<int, User?>();
        var team1Ids = JsonSerializer.Deserialize<List<int>>(queueItem.Team1PlayerIds) ?? new List<int>();
        var team2Ids = queueItem.Team2PlayerIds != null
            ? JsonSerializer.Deserialize<List<int>>(queueItem.Team2PlayerIds)
            : null;

        return new InstaGameQueueDto
        {
            Id = queueItem.Id,
            Position = queueItem.Position,
            Team1 = team1Ids.Select(id => new InstaGameMatchPlayerDto
            {
                UserId = id,
                DisplayName = playerLookup.GetValueOrDefault(id)?.DisplayName,
                AvatarUrl = playerLookup.GetValueOrDefault(id)?.AvatarUrl
            }).ToList(),
            Team2 = team2Ids?.Select(id => new InstaGameMatchPlayerDto
            {
                UserId = id,
                DisplayName = playerLookup.GetValueOrDefault(id)?.DisplayName,
                AvatarUrl = playerLookup.GetValueOrDefault(id)?.AvatarUrl
            }).ToList(),
            QueueType = queueItem.QueueType,
            CreatedAt = queueItem.CreatedAt
        };
    }

    private async Task<InstaGameQueueDto> MapQueueToDtoAsync(InstaGameQueue queueItem)
    {
        var players = await _context.InstaGamePlayers
            .Include(p => p.User)
            .Where(p => p.InstaGameId == queueItem.InstaGameId)
            .ToListAsync();

        return MapQueueToDto(queueItem, players);
    }

    #endregion
}
