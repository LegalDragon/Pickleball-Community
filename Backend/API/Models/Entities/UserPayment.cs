using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Generic payment record for users. Supports multiple payment types:
/// - EventRegistration: Payment for event registration fees
/// - ClubMembership: Payment for club membership fees
/// - SiteMembership: Payment for site subscription/membership
/// - Donation: Donations to clubs, events, etc.
/// - Other: Miscellaneous payments
/// </summary>
public class UserPayment
{
    public int Id { get; set; }

    /// <summary>
    /// The user who submitted/owns this payment
    /// </summary>
    public int UserId { get; set; }

    /// <summary>
    /// Type of payment: EventRegistration, ClubMembership, SiteMembership, Donation, Other
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string PaymentType { get; set; } = "EventRegistration";

    /// <summary>
    /// ID of the related object (EventId, ClubId, etc. depending on PaymentType)
    /// </summary>
    public int? RelatedObjectId { get; set; }

    /// <summary>
    /// Optional secondary related object ID (e.g., UnitId for event registrations)
    /// </summary>
    public int? SecondaryObjectId { get; set; }

    /// <summary>
    /// Optional tertiary related object ID (e.g., MemberId for event registrations)
    /// </summary>
    public int? TertiaryObjectId { get; set; }

    /// <summary>
    /// Human-readable description of what this payment is for
    /// </summary>
    [MaxLength(200)]
    public string? Description { get; set; }

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
    /// System-generated reference ID for matching
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
    /// Whether this payment has been applied to the target record
    /// </summary>
    public bool IsApplied { get; set; } = false;

    /// <summary>
    /// When the payment was applied
    /// </summary>
    public DateTime? AppliedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("UserId")]
    public User? User { get; set; }

    [ForeignKey("VerifiedByUserId")]
    public User? VerifiedByUser { get; set; }

    // Helper properties for backward compatibility with event payments
    [NotMapped]
    public int? EventId => PaymentType == "EventRegistration" ? RelatedObjectId : null;

    [NotMapped]
    public int? UnitId => PaymentType == "EventRegistration" ? SecondaryObjectId : null;

    [NotMapped]
    public int? MemberId => PaymentType == "EventRegistration" ? TertiaryObjectId : null;

    [NotMapped]
    public int? ClubId => PaymentType == "ClubMembership" ? RelatedObjectId : null;
}

/// <summary>
/// Payment type constants
/// </summary>
public static class PaymentTypes
{
    public const string EventRegistration = "EventRegistration";
    public const string ClubMembership = "ClubMembership";
    public const string SiteMembership = "SiteMembership";
    public const string Donation = "Donation";
    public const string Other = "Other";
}
