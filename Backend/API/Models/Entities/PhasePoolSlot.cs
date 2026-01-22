using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Links a PhaseSlot to a PhasePool, establishing which slots belong to which pool.
/// </summary>
public class PhasePoolSlot
{
    public int Id { get; set; }

    public int PoolId { get; set; }
    public int SlotId { get; set; }

    /// <summary>
    /// Position within the pool (for seeding/ordering)
    /// </summary>
    public int PoolPosition { get; set; } = 1;

    // Navigation
    [ForeignKey("PoolId")]
    public PhasePool? Pool { get; set; }

    [ForeignKey("SlotId")]
    public PhaseSlot? Slot { get; set; }
}
