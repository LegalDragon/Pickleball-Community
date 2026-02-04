using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Tracks per-player status during a Game Day event for fairness scheduling.
/// Ported from InstaGamePlayer patterns but adapted for the Event/GameDay system.
/// </summary>
public class GameDayPlayerStatus
{
    public int Id { get; set; }

    public int EventId { get; set; }

    public int UserId { get; set; }

    /// <summary>
    /// Player status: Available, Playing, Resting, SittingOut
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string Status { get; set; } = "Available";

    /// <summary>
    /// Number of rounds since this player last played (incremented each GenerateRound where they sit out)
    /// </summary>
    public int GamesSinceLastPlay { get; set; } = 0;

    /// <summary>
    /// Number of consecutive games played without rest
    /// </summary>
    public int ConsecutiveGames { get; set; } = 0;

    /// <summary>
    /// Total games played in this event session
    /// </summary>
    public int TotalGamesPlayed { get; set; } = 0;

    /// <summary>
    /// When this player last started or finished a game
    /// </summary>
    public DateTime? LastPlayedAt { get; set; }

    /// <summary>
    /// Queue position for scheduling priority (lower = higher priority)
    /// </summary>
    public int? QueuePosition { get; set; }

    /// <summary>
    /// When the player was placed in queue
    /// </summary>
    public DateTime? QueuedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }
}

/// <summary>
/// Static class containing GameDay player status constants
/// </summary>
public static class GameDayPlayerStatusValues
{
    public const string Available = "Available";
    public const string Playing = "Playing";
    public const string Resting = "Resting";
    public const string SittingOut = "SittingOut";
}
