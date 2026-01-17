using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// An individual match within an encounter.
/// For team scrimmages, an encounter can have multiple matches (e.g., Men's Doubles, Women's Doubles, Mixed).
/// For simple divisions (MatchesPerEncounter=1), there's one match per encounter.
/// </summary>
public class EncounterMatch
{
    public int Id { get; set; }

    public int EncounterId { get; set; }

    /// <summary>
    /// Reference to the match format template (defines player requirements).
    /// NULL for simple encounters where MatchesPerEncounter=1.
    /// </summary>
    public int? FormatId { get; set; }

    /// <summary>
    /// Order of this match within the encounter (1, 2, 3...)
    /// </summary>
    public int MatchOrder { get; set; } = 1;

    /// <summary>
    /// Match-level score: games won by each unit (for best-of-3/5)
    /// For single-game matches, this tracks the game score directly.
    /// </summary>
    public int Unit1Score { get; set; } = 0;
    public int Unit2Score { get; set; } = 0;

    /// <summary>
    /// Winner of this match
    /// </summary>
    public int? WinnerUnitId { get; set; }

    /// <summary>
    /// Handicap points for gender shortage (applied per game)
    /// </summary>
    public int Unit1HandicapPoints { get; set; } = 0;
    public int Unit2HandicapPoints { get; set; } = 0;

    /// <summary>
    /// Reason for handicap (e.g., "Missing 1 male player")
    /// </summary>
    [MaxLength(200)]
    public string? HandicapReason { get; set; }

    /// <summary>
    /// Status: Scheduled, InProgress, Completed, Cancelled
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = "Scheduled";

    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("EncounterId")]
    public EventEncounter? Encounter { get; set; }

    [ForeignKey("FormatId")]
    public EncounterMatchFormat? Format { get; set; }

    [ForeignKey("WinnerUnitId")]
    public EventUnit? Winner { get; set; }

    /// <summary>
    /// Players assigned to this match (for lineup management)
    /// </summary>
    public ICollection<EncounterMatchPlayer> Players { get; set; } = new List<EncounterMatchPlayer>();

    /// <summary>
    /// Games within this match (for best-of-3/5)
    /// </summary>
    public ICollection<EventGame> Games { get; set; } = new List<EventGame>();
}
