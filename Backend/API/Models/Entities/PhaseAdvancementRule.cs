using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Defines how units advance from one phase to another.
/// Maps source positions (e.g., "Pool A 1st") to target slots (e.g., "Semifinal Slot 1").
/// </summary>
public class PhaseAdvancementRule
{
    public int Id { get; set; }

    // Source phase and position
    public int SourcePhaseId { get; set; }

    /// <summary>
    /// Specific pool within source phase (null for overall phase ranking)
    /// </summary>
    public int? SourcePoolId { get; set; }

    /// <summary>
    /// Which rank position advances (1 = 1st place, 2 = 2nd, etc.)
    /// </summary>
    public int SourceRank { get; set; }

    // Target phase and slot
    public int TargetPhaseId { get; set; }

    /// <summary>
    /// Which incoming slot number in the target phase
    /// </summary>
    public int TargetSlotNumber { get; set; }

    /// <summary>
    /// Human-readable description (e.g., "Pool A 1st -> Semifinal Slot 1")
    /// </summary>
    [MaxLength(200)]
    public string? Description { get; set; }

    /// <summary>
    /// Processing order for complex advancement scenarios
    /// </summary>
    public int ProcessOrder { get; set; } = 1;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("SourcePhaseId")]
    public DivisionPhase? SourcePhase { get; set; }

    [ForeignKey("SourcePoolId")]
    public PhasePool? SourcePool { get; set; }

    [ForeignKey("TargetPhaseId")]
    public DivisionPhase? TargetPhase { get; set; }
}
