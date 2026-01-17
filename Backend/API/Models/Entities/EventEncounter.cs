using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// A scheduled encounter between two units in a division.
/// An encounter can contain multiple matches (e.g., team scrimmage format).
/// </summary>
public class EventEncounter
{
    public int Id { get; set; }

    public int EventId { get; set; }
    public int DivisionId { get; set; }

    /// <summary>
    /// Type of round: Pool, Bracket, Final
    /// </summary>
    [MaxLength(20)]
    public string RoundType { get; set; } = "Pool";

    /// <summary>
    /// Round number within the round type
    /// </summary>
    public int RoundNumber { get; set; } = 1;

    /// <summary>
    /// Human-readable round name (e.g., "Pool A", "Quarterfinal", "Semifinal", "Final")
    /// </summary>
    [MaxLength(50)]
    public string? RoundName { get; set; }

    /// <summary>
    /// Encounter number within the round (was MatchNumber)
    /// </summary>
    public int EncounterNumber { get; set; } = 1;

    /// <summary>
    /// Position in bracket (for elimination brackets)
    /// </summary>
    public int? BracketPosition { get; set; }

    /// <summary>
    /// Unit number placeholder (before units are assigned via drawing)
    /// </summary>
    public int? Unit1Number { get; set; }
    public int? Unit2Number { get; set; }

    /// <summary>
    /// Actual unit IDs (after drawing assignment)
    /// </summary>
    public int? Unit1Id { get; set; }
    public int? Unit2Id { get; set; }

    /// <summary>
    /// Encounter-level score: number of matches won by each unit
    /// Only relevant when MatchesPerEncounter > 1
    /// </summary>
    public int Unit1EncounterScore { get; set; } = 0;
    public int Unit2EncounterScore { get; set; } = 0;

    /// <summary>
    /// Best of X games (legacy - now defined per match in EncounterMatchFormat)
    /// </summary>
    public int BestOf { get; set; } = 1;

    /// <summary>
    /// Winner of the encounter
    /// </summary>
    public int? WinnerUnitId { get; set; }

    /// <summary>
    /// Status: Scheduled, Ready, InProgress, Completed, Cancelled, Bye
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = "Scheduled";

    /// <summary>
    /// Scheduled start time
    /// </summary>
    public DateTime? ScheduledTime { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    /// <summary>
    /// Assigned tournament court
    /// </summary>
    public int? TournamentCourtId { get; set; }

    /// <summary>
    /// Score format (can override division default) - legacy for simple encounters
    /// </summary>
    public int? ScoreFormatId { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    /// <summary>
    /// Whether winning this encounter qualifies a unit for playoffs
    /// </summary>
    public bool IsPlayoffQualifier { get; set; } = false;

    /// <summary>
    /// Which playoff position the winner advances to
    /// </summary>
    public int? PlayoffAdvancePosition { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }

    [ForeignKey("Unit1Id")]
    public EventUnit? Unit1 { get; set; }

    [ForeignKey("Unit2Id")]
    public EventUnit? Unit2 { get; set; }

    [ForeignKey("WinnerUnitId")]
    public EventUnit? Winner { get; set; }

    [ForeignKey("TournamentCourtId")]
    public TournamentCourt? TournamentCourt { get; set; }

    [ForeignKey("ScoreFormatId")]
    public ScoreFormat? ScoreFormat { get; set; }

    /// <summary>
    /// Matches within this encounter (1 for simple, multiple for team scrimmages)
    /// </summary>
    public ICollection<EncounterMatch> Matches { get; set; } = new List<EncounterMatch>();

    /// <summary>
    /// Legacy: Games directly on encounter (for backward compatibility during migration)
    /// New code should use Matches[].Games
    /// </summary>
    public ICollection<EventGame> Games { get; set; } = new List<EventGame>();
}
