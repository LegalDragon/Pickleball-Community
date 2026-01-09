using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class Club
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(500)]
    public string? LogoUrl { get; set; }

    [MaxLength(500)]
    public string? BannerUrl { get; set; }

    // Location
    [MaxLength(200)]
    public string? Address { get; set; }

    [MaxLength(100)]
    public string? City { get; set; }

    [MaxLength(100)]
    public string? State { get; set; }

    [MaxLength(100)]
    public string? Country { get; set; }

    [MaxLength(20)]
    public string? PostalCode { get; set; }

    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    // Contact
    [MaxLength(100)]
    public string? Website { get; set; }

    [MaxLength(100)]
    public string? Email { get; set; }

    [MaxLength(20)]
    public string? Phone { get; set; }

    // Settings
    public bool IsPublic { get; set; } = true;
    public bool RequiresApproval { get; set; } = true;

    // Unique invite code for joining
    [MaxLength(50)]
    public string? InviteCode { get; set; }

    // Membership fees
    public bool HasMembershipFee { get; set; } = false;

    [MaxLength(100)]
    public string? MembershipFeeAmount { get; set; } // e.g., "$25", "$50/year"

    [MaxLength(50)]
    public string? MembershipFeePeriod { get; set; } // monthly, yearly, quarterly, one-time

    [MaxLength(2000)]
    public string? PaymentInstructions { get; set; } // How to pay, Venmo/PayPal info, etc.

    // Home venue - the primary location for this club
    public int? HomeVenueId { get; set; }

    public int CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
    public bool IsActive { get; set; } = true;

    // Chat settings (opt-in by club owner)
    public bool ChatEnabled { get; set; } = false;
    public int? ChatConversationId { get; set; }

    // Navigation
    [ForeignKey("HomeVenueId")]
    public Venue? HomeVenue { get; set; }

    [ForeignKey("CreatedByUserId")]
    public User? CreatedBy { get; set; }

    [ForeignKey("ChatConversationId")]
    public Conversation? ChatConversation { get; set; }

    public ICollection<ClubMember> Members { get; set; } = new List<ClubMember>();
    public ICollection<ClubJoinRequest> JoinRequests { get; set; } = new List<ClubJoinRequest>();
    public ICollection<ClubNotification> Notifications { get; set; } = new List<ClubNotification>();
}

public class ClubMember
{
    public int Id { get; set; }

    public int ClubId { get; set; }
    public int UserId { get; set; }

    [MaxLength(20)]
    public string Role { get; set; } = "Member"; // Admin, Moderator, Member

    [MaxLength(100)]
    public string? Title { get; set; } // Custom title like "Treasurer", "Secretary", "Tournament Director"

    public DateTime JoinedAt { get; set; } = DateTime.Now;
    public DateTime? MembershipValidTo { get; set; } // When membership expires (null = lifetime/no expiry)

    [MaxLength(500)]
    public string? MembershipNotes { get; set; } // Admin notes about payment status, etc.

    public bool IsActive { get; set; } = true;

    // Navigation
    [ForeignKey("ClubId")]
    public Club? Club { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }
}

public class ClubJoinRequest
{
    public int Id { get; set; }

    public int ClubId { get; set; }
    public int UserId { get; set; }

    [MaxLength(500)]
    public string? Message { get; set; }

    [MaxLength(20)]
    public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected

    public int? ReviewedByUserId { get; set; }
    public DateTime? ReviewedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("ClubId")]
    public Club? Club { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }

    [ForeignKey("ReviewedByUserId")]
    public User? ReviewedBy { get; set; }
}

public class ClubNotification
{
    public int Id { get; set; }

    public int ClubId { get; set; }
    public int SentByUserId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Message { get; set; } = string.Empty;

    public DateTime SentAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("ClubId")]
    public Club? Club { get; set; }

    [ForeignKey("SentByUserId")]
    public User? SentBy { get; set; }
}

public class ClubMemberRole
{
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Description { get; set; }

    [MaxLength(20)]
    public string? Color { get; set; }

    [MaxLength(50)]
    public string? Icon { get; set; } // Lucide icon name (e.g., "Crown", "DollarSign", "Shield")

    public int SortOrder { get; set; } = 0;

    public bool IsSystemRole { get; set; } = false; // System roles (Admin, Member) cannot be deleted

    // Permissions
    public bool CanManageMembers { get; set; } = false;
    public bool CanManageClub { get; set; } = false;
    public bool CanPostAnnouncements { get; set; } = false;

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}
