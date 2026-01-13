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
    /// Whether this member has paid their portion
    /// </summary>
    public bool HasPaid { get; set; } = false;
    public DateTime? PaidAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("UnitId")]
    public EventUnit? Unit { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }
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
