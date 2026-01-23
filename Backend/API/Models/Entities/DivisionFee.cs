using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Represents a fee configuration for an event or division.
/// - For event-level fees: DivisionId = 0 (applies to all registrations)
/// - For division-level fees: DivisionId = actual division ID (overrides event fee for that division)
/// All fees must reference a FeeTypeId from EventFeeTypes (the name/description come from there).
/// </summary>
public class DivisionFee
{
    public int Id { get; set; }

    /// <summary>
    /// The event this fee belongs to (always required)
    /// </summary>
    public int EventId { get; set; }

    /// <summary>
    /// The division this fee belongs to.
    /// Use 0 for event-level fees that apply to all divisions.
    /// Use actual division ID for division-specific fees.
    /// Note: This is not a strict FK - EventDivision navigation only works when DivisionId > 0.
    /// </summary>
    public int DivisionId { get; set; } = 0;

    /// <summary>
    /// Reference to the fee type (required - provides name/description)
    /// </summary>
    public int FeeTypeId { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal Amount { get; set; } = 0;

    /// <summary>
    /// If true, this fee is pre-selected when users register.
    /// Only one fee should be marked as default per division (or per event if DivisionId=0).
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
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    // Note: No FK constraint on DivisionId since it can be 0 for event-level fees
    // Division navigation is manually loaded when needed
    [NotMapped]
    public EventDivision? Division { get; set; }

    [ForeignKey("FeeTypeId")]
    public EventFeeType? FeeType { get; set; }

    /// <summary>
    /// Helper to check if this is an event-level fee (not division-specific)
    /// </summary>
    [NotMapped]
    public bool IsEventFee => DivisionId == 0;

    /// <summary>
    /// Helper to check if this fee is currently available based on date range
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

    /// <summary>
    /// Get the fee name from the FeeType
    /// </summary>
    [NotMapped]
    public string Name => FeeType?.Name ?? "";

    /// <summary>
    /// Get the fee description from the FeeType
    /// </summary>
    [NotMapped]
    public string? Description => FeeType?.Description;
}
