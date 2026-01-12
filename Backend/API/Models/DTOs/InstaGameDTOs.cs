namespace Pickleball.Community.Models.DTOs;

// ===============================================
// InstaGame DTOs
// ===============================================

/// <summary>
/// InstaGame list item for browse/discovery
/// </summary>
public class InstaGameDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string JoinCode { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string SchedulingMethod { get; set; } = string.Empty;
    public int TeamSize { get; set; }
    public int? MaxPlayers { get; set; }

    // Location
    public int? VenueId { get; set; }
    public string? VenueName { get; set; }
    public string? VenueCity { get; set; }
    public string? VenueState { get; set; }
    public string? CustomLocationName { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public double? DistanceMiles { get; set; }

    // Creator
    public int CreatorId { get; set; }
    public string? CreatorName { get; set; }
    public string? CreatorAvatarUrl { get; set; }

    // Stats
    public int PlayerCount { get; set; }
    public int GamesPlayed { get; set; }

    // Score format
    public int? ScoreFormatId { get; set; }
    public string? ScoreFormatName { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }
}

/// <summary>
/// Full InstaGame details including players and current match
/// </summary>
public class InstaGameDetailDto : InstaGameDto
{
    public List<InstaGamePlayerDto> Players { get; set; } = new();
    public InstaGameMatchDto? CurrentMatch { get; set; }
    public List<InstaGameMatchDto> RecentMatches { get; set; } = new();
    public List<InstaGameQueueDto> Queue { get; set; } = new();

    // User's relationship
    public bool IsCreator { get; set; }
    public bool IsOrganizer { get; set; }
    public bool IsPlayer { get; set; }
    public InstaGamePlayerDto? MyPlayerInfo { get; set; }
}

/// <summary>
/// InstaGame player info with session stats
/// </summary>
public class InstaGamePlayerDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool IsOrganizer { get; set; }

    // Session stats
    public int GamesPlayed { get; set; }
    public int GamesWon { get; set; }
    public int GamesLost { get; set; }
    public int PointsScored { get; set; }
    public int PointsAgainst { get; set; }
    public int PointsDifferential { get; set; }
    public double WinRate { get; set; }

    // Gauntlet stats
    public int CurrentWinStreak { get; set; }
    public int MaxWinStreak { get; set; }

    // Queue info
    public int? QueuePosition { get; set; }
    public DateTime? QueuedAt { get; set; }
    public DateTime JoinedAt { get; set; }
}

/// <summary>
/// InstaGame match info
/// </summary>
public class InstaGameMatchDto
{
    public int Id { get; set; }
    public int InstaGameId { get; set; }
    public int MatchNumber { get; set; }
    public string Status { get; set; } = string.Empty;

    // Teams with player details
    public List<InstaGameMatchPlayerDto> Team1 { get; set; } = new();
    public List<InstaGameMatchPlayerDto> Team2 { get; set; } = new();

    // Scores
    public int Team1Score { get; set; }
    public int Team2Score { get; set; }
    public int? WinningTeam { get; set; }

    // Score confirmation
    public int? ScoreSubmittedByUserId { get; set; }
    public string? ScoreSubmittedByName { get; set; }
    public DateTime? ScoreSubmittedAt { get; set; }
    public int? ScoreConfirmedByUserId { get; set; }
    public string? ScoreConfirmedByName { get; set; }
    public DateTime? ScoreConfirmedAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

/// <summary>
/// Player info for a match
/// </summary>
public class InstaGameMatchPlayerDto
{
    public int UserId { get; set; }
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
}

/// <summary>
/// Queue item for upcoming games
/// </summary>
public class InstaGameQueueDto
{
    public int Id { get; set; }
    public int Position { get; set; }
    public List<InstaGameMatchPlayerDto> Team1 { get; set; } = new();
    public List<InstaGameMatchPlayerDto>? Team2 { get; set; }
    public string QueueType { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

// ===============================================
// Request DTOs
// ===============================================

/// <summary>
/// Request to create a new InstaGame
/// </summary>
public class CreateInstaGameRequest
{
    public string Name { get; set; } = string.Empty;
    public string SchedulingMethod { get; set; } = "Manual"; // Manual, Popcorn, Gauntlet
    public int TeamSize { get; set; } = 2; // 1=singles, 2=doubles
    public int? MaxPlayers { get; set; }
    public int? ScoreFormatId { get; set; }

    // Location - either venue or custom
    public int? VenueId { get; set; }
    public string? CustomLocationName { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
}

/// <summary>
/// Request to update InstaGame settings
/// </summary>
public class UpdateInstaGameRequest
{
    public string? Name { get; set; }
    public string? SchedulingMethod { get; set; }
    public int? MaxPlayers { get; set; }
    public int? ScoreFormatId { get; set; }
}

/// <summary>
/// Request to join an InstaGame by code
/// </summary>
public class JoinInstaGameRequest
{
    public string JoinCode { get; set; } = string.Empty;
}

/// <summary>
/// Request to update player status
/// </summary>
public class UpdatePlayerStatusRequest
{
    public string Status { get; set; } = string.Empty; // Available, Resting
}

/// <summary>
/// Request to create a manual match
/// </summary>
public class CreateManualMatchRequest
{
    public List<int> Team1PlayerIds { get; set; } = new();
    public List<int> Team2PlayerIds { get; set; } = new();
}

/// <summary>
/// Request to update match score
/// </summary>
public class UpdateMatchScoreRequest
{
    public int Team1Score { get; set; }
    public int Team2Score { get; set; }
}

/// <summary>
/// Request to complete a match
/// </summary>
public class CompleteMatchRequest
{
    public int Team1Score { get; set; }
    public int Team2Score { get; set; }
    public int WinningTeam { get; set; } // 1 or 2
}

/// <summary>
/// Request to add to queue
/// </summary>
public class AddToQueueRequest
{
    public List<int> Team1PlayerIds { get; set; } = new();
    public List<int>? Team2PlayerIds { get; set; }
    public string QueueType { get; set; } = "Standard";
}

/// <summary>
/// Request to reorder queue
/// </summary>
public class ReorderQueueRequest
{
    public List<int> QueueItemIds { get; set; } = new();
}

/// <summary>
/// Request to find nearby InstaGames
/// </summary>
public class FindNearbyRequest
{
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public double RadiusMiles { get; set; } = 10;
}

// ===============================================
// Response DTOs
// ===============================================

/// <summary>
/// Response after creating/joining an InstaGame
/// </summary>
public class InstaGameResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public InstaGameDetailDto? InstaGame { get; set; }
}

/// <summary>
/// Response for generating next match
/// </summary>
public class NextMatchResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public InstaGameMatchDto? Match { get; set; }
    public bool NotEnoughPlayers { get; set; }
}

// ===============================================
// SignalR Payloads
// ===============================================

/// <summary>
/// Payload for real-time InstaGame score updates
/// </summary>
public class InstaGameScorePayload
{
    public int InstaGameId { get; set; }
    public int MatchId { get; set; }
    public int MatchNumber { get; set; }
    public int Team1Score { get; set; }
    public int Team2Score { get; set; }
    public int? WinningTeam { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// Payload for player updates (join/leave/status change)
/// </summary>
public class InstaGamePlayerPayload
{
    public int InstaGameId { get; set; }
    public string Action { get; set; } = string.Empty; // Joined, Left, StatusChanged
    public InstaGamePlayerDto Player { get; set; } = new();
}

/// <summary>
/// Payload for queue updates
/// </summary>
public class InstaGameQueuePayload
{
    public int InstaGameId { get; set; }
    public string Action { get; set; } = string.Empty; // Added, Removed, Reordered
    public List<InstaGameQueueDto> Queue { get; set; } = new();
}

/// <summary>
/// Payload for session status changes
/// </summary>
public class InstaGameStatusPayload
{
    public int InstaGameId { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
}
