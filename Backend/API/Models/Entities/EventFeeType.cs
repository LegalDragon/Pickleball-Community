using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Defines a fee type template for an event (e.g., "Early Bird", "Regular", "Late Registration").
/// Fee types are defined once at the event level and can be used by both event fees and division fees.
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
    /// Default amount for this fee type (can be overridden per division)
    /// </summary>
    [Column(TypeName = "decimal(10,2)")]
    public decimal DefaultAmount { get; set; } = 0;

    /// <summary>
    /// Optional: Date when this fee type becomes available
    /// </summary>
    public DateTime? AvailableFrom { get; set; }

    /// <summary>
    /// Optional: Date when this fee type expires (useful for Early Bird pricing)
    /// </summary>
    public DateTime? AvailableUntil { get; set; }

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
    /// Division fees that use this fee type
    /// </summary>
    public ICollection<DivisionFee> DivisionFees { get; set; } = new List<DivisionFee>();

    /// <summary>
    /// Helper to check if this fee type is currently available based on date range
    /// </summary>
    [NotMapped]
    public bool IsCurrentlyAvailable
    {
        get
        {
            if (!IsActive) return false;
            var now = DateTime.UtcNow;
            if (AvailableFrom.HasValue && now < AvailableFrom.Value) return false;
            if (AvailableUntil.HasValue && now > AvailableUntil.Value) return false;
            return true;
        }
    }
}
