using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// A team/unit registered in an event division
/// For singles, this is a single player. For doubles, this is a pair.
/// </summary>
public class EventUnit
{
    public int Id { get; set; }

    public int EventId { get; set; }
    public int DivisionId { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Random number assigned when tournament starts (for bracket placement)
    /// </summary>
    public int? UnitNumber { get; set; }

    /// <summary>
    /// Pool assignment for round robin
    /// </summary>
    public int? PoolNumber { get; set; }

    [MaxLength(50)]
    public string? PoolName { get; set; }

    /// <summary>
    /// Seed for seeded brackets
    /// </summary>
    public int? Seed { get; set; }

    /// <summary>
    /// Status: Registered, Confirmed, Waitlisted, Cancelled, CheckedIn
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = "Registered";

    /// <summary>
    /// Whether this unit was created temporarily for ad-hoc games (popcorn/gauntlet scheduling)
    /// </summary>
    public bool IsTemporary { get; set; } = false;

    /// <summary>
    /// Position in waitlist (if waitlisted)
    /// </summary>
    public int? WaitlistPosition { get; set; }

    /// <summary>
    /// User who manages this unit
    /// </summary>
    public int CaptainUserId { get; set; }

    // Payment
    /// <summary>
    /// Payment status: Pending, Paid, Partial, Waived
    /// </summary>
    [MaxLength(20)]
    public string PaymentStatus { get; set; } = "Pending";

    /// <summary>
    /// Amount paid for this registration
    /// </summary>
    [Column(TypeName = "decimal(10,2)")]
    public decimal AmountPaid { get; set; } = 0;

    /// <summary>
    /// URL to payment proof image/document (for manual payment verification)
    /// </summary>
    [MaxLength(500)]
    public string? PaymentProofUrl { get; set; }

    public DateTime? PaidAt { get; set; }

    [MaxLength(100)]
    public string? PaymentReference { get; set; }

    /// <summary>
    /// System-generated reference ID in format E{eventId}-U{unitId}-P{userId} for matching payments
    /// </summary>
    [MaxLength(50)]
    public string? ReferenceId { get; set; }

    // Stats
    public int MatchesPlayed { get; set; } = 0;
    public int MatchesWon { get; set; } = 0;
    public int MatchesLost { get; set; } = 0;
    public int GamesWon { get; set; } = 0;
    public int GamesLost { get; set; } = 0;
    public int PointsScored { get; set; } = 0;
    public int PointsAgainst { get; set; } = 0;

    // Ranking and Playoff
    /// <summary>
    /// Rank within pool (for round robin)
    /// </summary>
    public int? PoolRank { get; set; }

    /// <summary>
    /// Overall rank in division
    /// </summary>
    public int? OverallRank { get; set; }

    /// <summary>
    /// Whether this unit advanced to playoff round
    /// </summary>
    public bool AdvancedToPlayoff { get; set; } = false;

    /// <summary>
    /// Whether this unit was manually advanced by TD
    /// </summary>
    public bool ManuallyAdvanced { get; set; } = false;

    /// <summary>
    /// Final placement in the tournament (1st, 2nd, 3rd, etc.)
    /// </summary>
    public int? FinalPlacement { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }

    [ForeignKey("CaptainUserId")]
    public User? Captain { get; set; }

    public ICollection<EventUnitMember> Members { get; set; } = new List<EventUnitMember>();
    public ICollection<EventUnitJoinRequest> JoinRequests { get; set; } = new List<EventUnitJoinRequest>();
}

/// <summary>
/// A player who is part of a unit
/// </summary>
public class EventUnitMember
{
    public int Id { get; set; }

    public int UnitId { get; set; }
    public int UserId { get; set; }

    /// <summary>
    /// Role: Captain or Player
    /// </summary>
    [MaxLength(20)]
    public string Role { get; set; } = "Player";

    /// <summary>
    /// Invitation status: Pending, Accepted, Declined
    /// </summary>
    [MaxLength(20)]
    public string InviteStatus { get; set; } = "Accepted";

    public DateTime? InvitedAt { get; set; }
    public DateTime? RespondedAt { get; set; }

    /// <summary>
    /// Whether this member has checked in
    /// </summary>
    public bool IsCheckedIn { get; set; } = false;
    public DateTime? CheckedInAt { get; set; }

    /// <summary>
    /// Check-in status: None, Requested, Approved, Rejected
    /// None = not requested, Requested = player submitted self-check-in, Approved = admin approved, Rejected = admin rejected
    /// </summary>
    [MaxLength(20)]
    public string CheckInStatus { get; set; } = "None";

    /// <summary>
    /// When the player requested check-in
    /// </summary>
    public DateTime? CheckInRequestedAt { get; set; }

    /// <summary>
    /// Whether this member has paid their portion
    /// </summary>
    public bool HasPaid { get; set; } = false;
    public DateTime? PaidAt { get; set; }
    public decimal AmountPaid { get; set; } = 0;
    public string? PaymentProofUrl { get; set; }
    public string? PaymentReference { get; set; }
    public string? ReferenceId { get; set; }

    /// <summary>
    /// Payment method: Zelle, Cash, Venmo, etc.
    /// </summary>
    [MaxLength(50)]
    public string? PaymentMethod { get; set; }

    /// <summary>
    /// Reference to the UserPayment record that covered this registration
    /// </summary>
    public int? PaymentId { get; set; }

    /// <summary>
    /// When the waiver was signed
    /// </summary>
    public DateTime? WaiverSignedAt { get; set; }

    /// <summary>
    /// Reference to the waiver document signed
    /// </summary>
    public int? WaiverDocumentId { get; set; }

    /// <summary>
    /// Digital signature (typed full name)
    /// </summary>
    [MaxLength(200)]
    public string? WaiverSignature { get; set; }

    /// <summary>
    /// URL to drawn signature image (stored in asset management)
    /// </summary>
    [MaxLength(500)]
    public string? SignatureAssetUrl { get; set; }

    /// <summary>
    /// URL to generated PDF of signed waiver (stored in asset management)
    /// </summary>
    [MaxLength(500)]
    public string? SignedWaiverPdfUrl { get; set; }

    /// <summary>
    /// Email address at time of signing (for legal record)
    /// </summary>
    [MaxLength(255)]
    public string? SignerEmail { get; set; }

    /// <summary>
    /// IP address at time of signing (for legal record)
    /// </summary>
    [MaxLength(50)]
    public string? SignerIpAddress { get; set; }

    /// <summary>
    /// Who signed: Participant, Parent, Guardian
    /// </summary>
    [MaxLength(20)]
    public string? WaiverSignerRole { get; set; }

    /// <summary>
    /// Parent/Guardian name for minors
    /// </summary>
    [MaxLength(200)]
    public string? ParentGuardianName { get; set; }

    /// <summary>
    /// Emergency contact phone number
    /// </summary>
    [MaxLength(30)]
    public string? EmergencyPhone { get; set; }

    /// <summary>
    /// Chinese name for tournaments that require it
    /// </summary>
    [MaxLength(100)]
    public string? ChineseName { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("UnitId")]
    public EventUnit? Unit { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }

    [ForeignKey("WaiverDocumentId")]
    public EventWaiver? WaiverDocument { get; set; }

    [ForeignKey("PaymentId")]
    public UserPayment? Payment { get; set; }
}

/// <summary>
/// Request from a user to join an existing unit
/// </summary>
public class EventUnitJoinRequest
{
    public int Id { get; set; }

    public int UnitId { get; set; }
    public int UserId { get; set; }

    [MaxLength(500)]
    public string? Message { get; set; }

    /// <summary>
    /// Status: Pending, Accepted, Declined
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = "Pending";

    [MaxLength(500)]
    public string? ResponseMessage { get; set; }
    public DateTime? RespondedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("UnitId")]
    public EventUnit? Unit { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }
}
