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

    public int CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;

    // Navigation
    [ForeignKey("CreatedByUserId")]
    public User? CreatedBy { get; set; }

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

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
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

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

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

    public DateTime SentAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("ClubId")]
    public Club? Club { get; set; }

    [ForeignKey("SentByUserId")]
    public User? SentBy { get; set; }
}
