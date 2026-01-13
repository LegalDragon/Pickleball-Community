using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Represents a spontaneous pickup game session where players can join and play on the spot.
/// Supports multiple scheduling methods: Manual, Popcorn (rotating teams), and Gauntlet (king of the court).
/// </summary>
public class InstaGame
{
    public int Id { get; set; }

    public int CreatorId { get; set; }

    public int? VenueId { get; set; }

    public int? CourtId { get; set; }

    /// <summary>
    /// Session name (e.g., "Saturday Pickup @ Memorial Park")
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Short code for joining (e.g., "G-A3X9")
    /// </summary>
    [Required]
    [MaxLength(10)]
    public string JoinCode { get; set; } = string.Empty;

    /// <summary>
    /// Session status: Lobby, Active, Paused, Completed, Cancelled
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string Status { get; set; } = "Lobby";

    /// <summary>
    /// Scheduling method: Manual, Popcorn, Gauntlet
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string SchedulingMethod { get; set; } = "Manual";

    public int? ScoreFormatId { get; set; }

    /// <summary>
    /// Maximum players allowed (null = unlimited)
    /// </summary>
    public int? MaxPlayers { get; set; }

    /// <summary>
    /// Team size: 1 for singles, 2 for doubles
    /// </summary>
    public int TeamSize { get; set; } = 2;

    /// <summary>
    /// Custom location name if no venue selected
    /// </summary>
    [MaxLength(200)]
    public string? CustomLocationName { get; set; }

    public decimal? Latitude { get; set; }

    public decimal? Longitude { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? StartedAt { get; set; }

    public DateTime? EndedAt { get; set; }

    // Navigation properties
    [ForeignKey("CreatorId")]
    public User? Creator { get; set; }

    [ForeignKey("VenueId")]
    public Venue? Venue { get; set; }

    [ForeignKey("ScoreFormatId")]
    public ScoreFormat? ScoreFormat { get; set; }

    public ICollection<InstaGamePlayer> Players { get; set; } = new List<InstaGamePlayer>();

    public ICollection<InstaGameMatch> Matches { get; set; } = new List<InstaGameMatch>();

    public ICollection<InstaGameQueue> Queue { get; set; } = new List<InstaGameQueue>();
}

/// <summary>
/// Represents a player in an InstaGame session with their session stats.
/// </summary>
public class InstaGamePlayer
{
    public int Id { get; set; }

    public int InstaGameId { get; set; }

    public int UserId { get; set; }

    /// <summary>
    /// Player status: Available, Playing, Resting, Left
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string Status { get; set; } = "Available";

    /// <summary>
    /// Whether this player can manage games (create matches, update scores)
    /// </summary>
    public bool IsOrganizer { get; set; } = false;

    // Session statistics
    public int GamesPlayed { get; set; } = 0;
    public int GamesWon { get; set; } = 0;
    public int PointsScored { get; set; } = 0;
    public int PointsAgainst { get; set; } = 0;

    // Gauntlet-specific stats
    public int CurrentWinStreak { get; set; } = 0;
    public int MaxWinStreak { get; set; } = 0;

    /// <summary>
    /// Queue position for scheduling (used in Gauntlet mode)
    /// </summary>
    public int? QueuePosition { get; set; }

    public DateTime? QueuedAt { get; set; }

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    public DateTime? LeftAt { get; set; }

    // Navigation properties
    [ForeignKey("InstaGameId")]
    public InstaGame? InstaGame { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }

    // Computed properties
    [NotMapped]
    public int GamesLost => GamesPlayed - GamesWon;

    [NotMapped]
    public int PointsDifferential => PointsScored - PointsAgainst;

    [NotMapped]
    public double WinRate => GamesPlayed > 0 ? (double)GamesWon / GamesPlayed * 100 : 0;
}

/// <summary>
/// Represents a single match/game within an InstaGame session.
/// </summary>
public class InstaGameMatch
{
    public int Id { get; set; }

    public int InstaGameId { get; set; }

    /// <summary>
    /// Sequential match number in the session
    /// </summary>
    public int MatchNumber { get; set; }

    /// <summary>
    /// Match status: Pending, Ready, InProgress, Completed, Cancelled
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string Status { get; set; } = "Pending";

    /// <summary>
    /// JSON array of user IDs for team 1 (e.g., "[1,2]" for doubles)
    /// </summary>
    [Required]
    [MaxLength(200)]
    public string Team1PlayerIds { get; set; } = "[]";

    /// <summary>
    /// JSON array of user IDs for team 2
    /// </summary>
    [Required]
    [MaxLength(200)]
    public string Team2PlayerIds { get; set; } = "[]";

    public int Team1Score { get; set; } = 0;

    public int Team2Score { get; set; } = 0;

    /// <summary>
    /// 1 for Team1, 2 for Team2, null if not completed
    /// </summary>
    public int? WinningTeam { get; set; }

    // Score confirmation
    public int? ScoreSubmittedByUserId { get; set; }
    public DateTime? ScoreSubmittedAt { get; set; }
    public int? ScoreConfirmedByUserId { get; set; }
    public DateTime? ScoreConfirmedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    // Navigation properties
    [ForeignKey("InstaGameId")]
    public InstaGame? InstaGame { get; set; }

    [ForeignKey("ScoreSubmittedByUserId")]
    public User? ScoreSubmittedBy { get; set; }

    [ForeignKey("ScoreConfirmedByUserId")]
    public User? ScoreConfirmedBy { get; set; }

    // Helper methods for team player IDs
    [NotMapped]
    public List<int> Team1Players => ParsePlayerIds(Team1PlayerIds);

    [NotMapped]
    public List<int> Team2Players => ParsePlayerIds(Team2PlayerIds);

    private static List<int> ParsePlayerIds(string json)
    {
        if (string.IsNullOrEmpty(json) || json == "[]")
            return new List<int>();

        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<List<int>>(json) ?? new List<int>();
        }
        catch
        {
            return new List<int>();
        }
    }
}

/// <summary>
/// Represents a queued match in an InstaGame session.
/// Used for pre-arranged upcoming games in Manual mode or challenge queue in Gauntlet.
/// </summary>
public class InstaGameQueue
{
    public int Id { get; set; }

    public int InstaGameId { get; set; }

    /// <summary>
    /// Queue order (1 = next up)
    /// </summary>
    public int Position { get; set; }

    /// <summary>
    /// JSON array of user IDs for team 1
    /// </summary>
    [Required]
    [MaxLength(200)]
    public string Team1PlayerIds { get; set; } = "[]";

    /// <summary>
    /// JSON array of user IDs for team 2 (null in challenge queue where opponent TBD)
    /// </summary>
    [MaxLength(200)]
    public string? Team2PlayerIds { get; set; }

    /// <summary>
    /// Queue type: Standard, Challenge, Winner, Loser
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string QueueType { get; set; } = "Standard";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey("InstaGameId")]
    public InstaGame? InstaGame { get; set; }
}

/// <summary>
/// Static class containing InstaGame status constants
/// </summary>
public static class InstaGameStatus
{
    public const string Lobby = "Lobby";
    public const string Active = "Active";
    public const string Paused = "Paused";
    public const string Completed = "Completed";
    public const string Cancelled = "Cancelled";
}

/// <summary>
/// Static class containing InstaGame scheduling method constants
/// </summary>
public static class InstaGameSchedulingMethod
{
    public const string Manual = "Manual";
    public const string Popcorn = "Popcorn";
    public const string Gauntlet = "Gauntlet";
}

/// <summary>
/// Static class containing InstaGamePlayer status constants
/// </summary>
public static class InstaGamePlayerStatus
{
    public const string Available = "Available";
    public const string Playing = "Playing";
    public const string Resting = "Resting";
    public const string Left = "Left";
}

/// <summary>
/// Static class containing InstaGameMatch status constants
/// </summary>
public static class InstaGameMatchStatus
{
    public const string Pending = "Pending";
    public const string Ready = "Ready";
    public const string InProgress = "InProgress";
    public const string Completed = "Completed";
    public const string Cancelled = "Cancelled";
}
