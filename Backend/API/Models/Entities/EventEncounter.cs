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
    /// Phase this encounter belongs to (null for legacy encounters without phases)
    /// </summary>
    public int? PhaseId { get; set; }

    /// <summary>
    /// Slot reference for Unit1 (enables placeholder-based scheduling)
    /// When set, Unit1Id is derived from the slot's resolved unit
    /// </summary>
    public int? Unit1SlotId { get; set; }

    /// <summary>
    /// Slot reference for Unit2 (enables placeholder-based scheduling)
    /// When set, Unit2Id is derived from the slot's resolved unit
    /// </summary>
    public int? Unit2SlotId { get; set; }

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
    /// Sequential match number within the division (1, 2, 3, ... N)
    /// Used for referencing matches: "Match #5", "Match #12", etc.
    /// </summary>
    public int? DivisionMatchNumber { get; set; }

    /// <summary>
    /// Backward-compatible alias for EncounterNumber
    /// </summary>
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public int MatchNumber
    {
        get => EncounterNumber;
        set => EncounterNumber = value;
    }

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
    /// Seed label for playoff brackets (e.g., "Pool A #1", "Winner SF1")
    /// Shown before actual units are assigned
    /// </summary>
    [MaxLength(50)]
    public string? Unit1SeedLabel { get; set; }
    [MaxLength(50)]
    public string? Unit2SeedLabel { get; set; }

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

    // =====================================================
    // Bracket Progression (for elimination brackets)
    // =====================================================

    /// <summary>
    /// The encounter the winner advances to
    /// </summary>
    public int? WinnerNextEncounterId { get; set; }

    /// <summary>
    /// The encounter the loser advances to (for double elimination)
    /// </summary>
    public int? LoserNextEncounterId { get; set; }

    /// <summary>
    /// Which slot (1=Unit1, 2=Unit2) in the next encounter for winner
    /// </summary>
    public int? WinnerSlotPosition { get; set; }

    /// <summary>
    /// Which slot in the loser bracket for loser
    /// </summary>
    public int? LoserSlotPosition { get; set; }

    /// <summary>
    /// Pool within the phase (for multi-pool phases)
    /// </summary>
    public int? PoolId { get; set; }

    /// <summary>
    /// Display label like "Match 1", "SF1", "Final"
    /// </summary>
    [MaxLength(50)]
    public string? EncounterLabel { get; set; }

    /// <summary>
    /// Calculated start time based on court assignment and sequence
    /// </summary>
    public DateTime? EstimatedStartTime { get; set; }

    /// <summary>
    /// Estimated duration in minutes for this encounter
    /// </summary>
    public int? EstimatedDurationMinutes { get; set; }

    /// <summary>
    /// Calculated end time based on start time and duration
    /// </summary>
    public DateTime? EstimatedEndTime { get; set; }

    // =====================================================
    // Lineup Locking (for team scrimmage formats)
    // =====================================================

    /// <summary>
    /// Whether Unit1's captain has locked their lineup for this encounter.
    /// When both units lock their lineups, lineup becomes visible to regular users.
    /// </summary>
    public bool Unit1LineupLocked { get; set; } = false;

    /// <summary>
    /// Whether Unit2's captain has locked their lineup for this encounter.
    /// </summary>
    public bool Unit2LineupLocked { get; set; } = false;

    /// <summary>
    /// When Unit1's lineup was locked
    /// </summary>
    public DateTime? Unit1LineupLockedAt { get; set; }

    /// <summary>
    /// When Unit2's lineup was locked
    /// </summary>
    public DateTime? Unit2LineupLockedAt { get; set; }

    /// <summary>
    /// User who locked Unit1's lineup (captain or admin)
    /// </summary>
    public int? Unit1LineupLockedByUserId { get; set; }

    /// <summary>
    /// User who locked Unit2's lineup (captain or admin)
    /// </summary>
    public int? Unit2LineupLockedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }

    [ForeignKey("PhaseId")]
    public DivisionPhase? Phase { get; set; }

    [ForeignKey("Unit1SlotId")]
    public PhaseSlot? Unit1Slot { get; set; }

    [ForeignKey("Unit2SlotId")]
    public PhaseSlot? Unit2Slot { get; set; }

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

    [ForeignKey("WinnerNextEncounterId")]
    public EventEncounter? WinnerNextEncounter { get; set; }

    [ForeignKey("LoserNextEncounterId")]
    public EventEncounter? LoserNextEncounter { get; set; }

    [ForeignKey("PoolId")]
    public PhasePool? Pool { get; set; }

    /// <summary>
    /// Matches within this encounter (1 for simple, multiple for team scrimmages)
    /// Always has at least 1 match - simple divisions auto-create 1 match.
    /// </summary>
    public ICollection<EncounterMatch> Matches { get; set; } = new List<EncounterMatch>();

    /// <summary>
    /// Encounters that feed winners into this encounter
    /// </summary>
    [InverseProperty("WinnerNextEncounter")]
    public ICollection<EventEncounter> WinnerSourceEncounters { get; set; } = new List<EventEncounter>();

    /// <summary>
    /// Encounters that feed losers into this encounter
    /// </summary>
    [InverseProperty("LoserNextEncounter")]
    public ICollection<EventEncounter> LoserSourceEncounters { get; set; } = new List<EventEncounter>();
}
