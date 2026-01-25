using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Types of slots within a phase.
/// </summary>
public static class SlotTypes
{
    /// <summary>
    /// Slot for units entering this phase (from seeding or previous phase)
    /// </summary>
    public const string Incoming = "Incoming";

    /// <summary>
    /// Slot for units advancing to the next phase
    /// </summary>
    public const string Advancing = "Advancing";
}

/// <summary>
/// How a slot gets filled.
/// </summary>
public static class SlotSourceTypes
{
    /// <summary>
    /// Manual assignment from registration/seeding
    /// </summary>
    public const string Seeded = "Seeded";

    /// <summary>
    /// Winner of a specific encounter
    /// </summary>
    public const string WinnerOf = "WinnerOf";

    /// <summary>
    /// Loser of a specific encounter (for consolation/double-elim)
    /// </summary>
    public const string LoserOf = "LoserOf";

    /// <summary>
    /// Unit ranked at specific position in a previous phase
    /// </summary>
    public const string RankFromPhase = "RankFromPhase";

    /// <summary>
    /// Tournament director manual override
    /// </summary>
    public const string Manual = "Manual";

    /// <summary>
    /// Automatic bye (empty slot in bracket)
    /// </summary>
    public const string Bye = "Bye";
}

/// <summary>
/// Represents a slot in a tournament phase that can be filled by a unit.
/// Enables placeholder-based scheduling where the entire tournament structure
/// exists before actual units are assigned.
/// </summary>
public class PhaseSlot
{
    public int Id { get; set; }

    public int PhaseId { get; set; }

    /// <summary>
    /// Type: Incoming (units entering phase) or Advancing (units moving to next phase)
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string SlotType { get; set; } = SlotTypes.Incoming;

    /// <summary>
    /// Position/seed number within this slot type (1-based)
    /// For incoming: seed position
    /// For advancing: final rank in phase
    /// </summary>
    public int SlotNumber { get; set; } = 1;

    /// <summary>
    /// Actual unit assigned to this slot (null until resolved)
    /// </summary>
    public int? UnitId { get; set; }

    /// <summary>
    /// How this slot gets filled: Seeded, WinnerOf, LoserOf, RankFromPhase, Manual, Bye
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string SourceType { get; set; } = SlotSourceTypes.Seeded;

    /// <summary>
    /// For WinnerOf/LoserOf: the encounter whose result fills this slot
    /// </summary>
    public int? SourceEncounterId { get; set; }

    /// <summary>
    /// For RankFromPhase: the phase whose results fill this slot
    /// </summary>
    public int? SourcePhaseId { get; set; }

    /// <summary>
    /// For RankFromPhase: which rank position (1 = 1st place, 2 = 2nd, etc.)
    /// </summary>
    public int? SourceRank { get; set; }

    /// <summary>
    /// For RankFromPhase with pools: which pool (null = overall ranking)
    /// </summary>
    [MaxLength(20)]
    public string? SourcePoolName { get; set; }

    /// <summary>
    /// Display label for unresolved slots (e.g., "Winner of Match 3", "Pool A #1", "TBD")
    /// </summary>
    [MaxLength(100)]
    public string? PlaceholderLabel { get; set; }

    /// <summary>
    /// Exit label for advancing slots (e.g., "Champion", "Runner-up", "3rd Place")
    /// </summary>
    [MaxLength(50)]
    public string? ExitLabel { get; set; }

    /// <summary>
    /// Whether this slot has been resolved (unit assigned)
    /// </summary>
    public bool IsResolved { get; set; } = false;

    /// <summary>
    /// When this slot was resolved
    /// </summary>
    public DateTime? ResolvedAt { get; set; }

    /// <summary>
    /// Whether resolution was manual (TD override) vs automatic
    /// </summary>
    public bool WasManuallyResolved { get; set; } = false;

    /// <summary>
    /// User who manually resolved this slot (if applicable)
    /// </summary>
    public int? ResolvedByUserId { get; set; }

    /// <summary>
    /// Notes about manual resolution
    /// </summary>
    [MaxLength(500)]
    public string? ResolutionNotes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("PhaseId")]
    public DivisionPhase? Phase { get; set; }

    [ForeignKey("UnitId")]
    public EventUnit? Unit { get; set; }

    [ForeignKey("SourceEncounterId")]
    public EventEncounter? SourceEncounter { get; set; }

    [ForeignKey("SourcePhaseId")]
    public DivisionPhase? SourcePhase { get; set; }

    [ForeignKey("ResolvedByUserId")]
    public User? ResolvedBy { get; set; }

    /// <summary>
    /// Encounters where this slot is Unit1
    /// </summary>
    [InverseProperty("Unit1Slot")]
    public ICollection<EventEncounter> EncountersAsUnit1 { get; set; } = new List<EventEncounter>();

    /// <summary>
    /// Encounters where this slot is Unit2
    /// </summary>
    [InverseProperty("Unit2Slot")]
    public ICollection<EventEncounter> EncountersAsUnit2 { get; set; } = new List<EventEncounter>();
}
