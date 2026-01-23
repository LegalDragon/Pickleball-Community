using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Defines a fee type name/template for an event (e.g., "Early Bird", "Regular", "Late Registration").
/// Fee types are defined once at the event level and referenced by both event fees (DivisionId=0) and division fees.
/// This is just a name/label - actual amounts are stored in DivisionFees table.
/// </summary>
public class EventFeeType
{
    public int Id { get; set; }

    /// <summary>
    /// The event this fee type belongs to
    /// </summary>
    public int EventId { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty; // e.g., "Early Bird", "Regular Registration", "Late Registration"

    [MaxLength(500)]
    public string? Description { get; set; } // e.g., "Register before Jan 15 for discounted rate"

    /// <summary>
    /// Whether this fee type is currently active
    /// </summary>
    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; } = 0;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    /// <summary>
    /// Fees that use this fee type (both event-level and division-level)
    /// </summary>
    public ICollection<DivisionFee> Fees { get; set; } = new List<DivisionFee>();
}
