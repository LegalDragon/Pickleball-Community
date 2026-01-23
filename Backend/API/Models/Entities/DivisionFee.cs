using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Represents a fee option for a tournament division or event.
/// Both divisions and events can have multiple fee options (e.g., Early Bird, Regular, Late Registration).
/// For division fees: DivisionId is set, EventId is set (from division's event)
/// For event fees: DivisionId is null, EventId is set
/// </summary>
public class DivisionFee
{
    public int Id { get; set; }

    /// <summary>
    /// The division this fee belongs to (null for event-level fees)
    /// </summary>
    public int? DivisionId { get; set; }

    /// <summary>
    /// The event this fee belongs to (always set for both division and event fees)
    /// </summary>
    public int? EventId { get; set; }

    /// <summary>
    /// Reference to the fee type template (optional - if set, Name/Description/dates come from fee type)
    /// </summary>
    public int? FeeTypeId { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty; // e.g., "Early Bird", "Regular Registration", "Late Registration"

    [MaxLength(500)]
    public string? Description { get; set; } // e.g., "Register before Jan 15 for discounted rate"

    [Column(TypeName = "decimal(10,2)")]
    public decimal Amount { get; set; } = 0;

    /// <summary>
    /// If true, this fee is pre-selected when users register for this division.
    /// Only one fee should be marked as default per division.
    /// </summary>
    public bool IsDefault { get; set; } = false;

    /// <summary>
    /// Optional: Date when this fee becomes available
    /// </summary>
    public DateTime? AvailableFrom { get; set; }

    /// <summary>
    /// Optional: Date when this fee expires (useful for Early Bird pricing)
    /// </summary>
    public DateTime? AvailableUntil { get; set; }

    /// <summary>
    /// Whether this fee option is currently active
    /// </summary>
    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; } = 0;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }

    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("FeeTypeId")]
    public EventFeeType? FeeType { get; set; }

    /// <summary>
    /// Helper to check if this is an event-level fee (not division-specific)
    /// </summary>
    public bool IsEventFee => DivisionId == null;
}
