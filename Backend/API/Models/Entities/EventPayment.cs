using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Stores payment records for event registrations separately from registration records.
/// This ensures payment data is preserved even if a registration is removed.
/// </summary>
public class EventPayment
{
    public int Id { get; set; }

    /// <summary>
    /// The event this payment is for
    /// </summary>
    public int EventId { get; set; }

    /// <summary>
    /// The user who submitted/owns this payment
    /// </summary>
    public int UserId { get; set; }

    /// <summary>
    /// The unit this payment is associated with (if any)
    /// </summary>
    public int? UnitId { get; set; }

    /// <summary>
    /// The member record this payment is applied to (if any)
    /// </summary>
    public int? MemberId { get; set; }

    /// <summary>
    /// Amount paid
    /// </summary>
    [Column(TypeName = "decimal(10,2)")]
    public decimal Amount { get; set; } = 0;

    /// <summary>
    /// URL to payment proof image/document
    /// </summary>
    [MaxLength(500)]
    public string? PaymentProofUrl { get; set; }

    /// <summary>
    /// External payment reference (e.g., Zelle confirmation, Venmo ID)
    /// </summary>
    [MaxLength(100)]
    public string? PaymentReference { get; set; }

    /// <summary>
    /// System-generated reference ID for matching (E{eventId}-U{unitId}-P{userId})
    /// </summary>
    [MaxLength(50)]
    public string? ReferenceId { get; set; }

    /// <summary>
    /// Payment method: Cash, Zelle, Venmo, PayPal, CreditCard, Check, Other
    /// </summary>
    [MaxLength(50)]
    public string? PaymentMethod { get; set; }

    /// <summary>
    /// Status: Pending, Verified, Rejected, Refunded, Cancelled
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = "Pending";

    /// <summary>
    /// Admin/organizer who verified this payment
    /// </summary>
    public int? VerifiedByUserId { get; set; }

    /// <summary>
    /// When the payment was verified
    /// </summary>
    public DateTime? VerifiedAt { get; set; }

    /// <summary>
    /// Admin notes about the payment
    /// </summary>
    [MaxLength(500)]
    public string? Notes { get; set; }

    /// <summary>
    /// Whether this payment has been applied to a registration
    /// </summary>
    public bool IsApplied { get; set; } = false;

    /// <summary>
    /// When the payment was applied to a registration
    /// </summary>
    public DateTime? AppliedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }

    [ForeignKey("UnitId")]
    public EventUnit? Unit { get; set; }

    [ForeignKey("MemberId")]
    public EventUnitMember? Member { get; set; }

    [ForeignKey("VerifiedByUserId")]
    public User? VerifiedByUser { get; set; }
}
