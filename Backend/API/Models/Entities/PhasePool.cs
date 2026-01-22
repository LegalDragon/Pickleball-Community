using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Represents a pool within a tournament phase.
/// Used for round-robin pool play where multiple pools run in parallel.
/// </summary>
public class PhasePool
{
    public int Id { get; set; }

    public int PhaseId { get; set; }

    /// <summary>
    /// Pool identifier (e.g., "A", "B", "C" or "1", "2", "3")
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string PoolName { get; set; } = string.Empty;

    /// <summary>
    /// Display/processing order
    /// </summary>
    public int PoolOrder { get; set; } = 1;

    /// <summary>
    /// Number of slots in this pool
    /// </summary>
    public int SlotCount { get; set; } = 4;

    /// <summary>
    /// Status: Pending, InProgress, Completed
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = "Pending";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("PhaseId")]
    public DivisionPhase? Phase { get; set; }

    /// <summary>
    /// Slots assigned to this pool
    /// </summary>
    public ICollection<PhasePoolSlot> PoolSlots { get; set; } = new List<PhasePoolSlot>();

    /// <summary>
    /// Encounters within this pool
    /// </summary>
    public ICollection<EventEncounter> Encounters { get; set; } = new List<EventEncounter>();
}
