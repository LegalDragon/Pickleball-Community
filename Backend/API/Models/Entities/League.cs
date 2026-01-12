using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// League entity with hierarchical structure (National -> Regions -> States -> Districts)
/// </summary>
public class League
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    /// <summary>
    /// Scope/Level: National, Regional, State, District, Local
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string Scope { get; set; } = "Local";

    /// <summary>
    /// Avatar/Logo URL for the league
    /// </summary>
    [MaxLength(500)]
    public string? AvatarUrl { get; set; }

    /// <summary>
    /// Banner image URL
    /// </summary>
    [MaxLength(500)]
    public string? BannerUrl { get; set; }

    /// <summary>
    /// Website URL
    /// </summary>
    [MaxLength(500)]
    public string? Website { get; set; }

    /// <summary>
    /// Contact email
    /// </summary>
    [MaxLength(255)]
    public string? ContactEmail { get; set; }

    /// <summary>
    /// Parent league ID for hierarchy (e.g., State league belongs to Regional league)
    /// </summary>
    public int? ParentLeagueId { get; set; }

    /// <summary>
    /// Geographic coverage - state code if applicable
    /// </summary>
    [MaxLength(50)]
    public string? State { get; set; }

    /// <summary>
    /// Geographic coverage - region name if applicable
    /// </summary>
    [MaxLength(100)]
    public string? Region { get; set; }

    /// <summary>
    /// Geographic coverage - country
    /// </summary>
    [MaxLength(50)]
    public string? Country { get; set; } = "USA";

    /// <summary>
    /// Sort order for display
    /// </summary>
    public int SortOrder { get; set; } = 0;

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation properties
    [ForeignKey("ParentLeagueId")]
    public League? ParentLeague { get; set; }

    public ICollection<League> ChildLeagues { get; set; } = new List<League>();
    public ICollection<LeagueManager> Managers { get; set; } = new List<LeagueManager>();
    public ICollection<LeagueClub> Clubs { get; set; } = new List<LeagueClub>();
    public ICollection<LeagueClubRequest> ClubRequests { get; set; } = new List<LeagueClubRequest>();
    public ICollection<LeagueDocument> Documents { get; set; } = new List<LeagueDocument>();
}

/// <summary>
/// Manager/Role assignment for a league
/// </summary>
public class LeagueManager
{
    public int Id { get; set; }

    public int LeagueId { get; set; }
    public int UserId { get; set; }

    /// <summary>
    /// Role: President, Vice President, Director, Secretary, Treasurer, Admin, Moderator
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string Role { get; set; } = "Admin";

    /// <summary>
    /// Optional title override (e.g., "Regional Director - Southeast")
    /// </summary>
    [MaxLength(100)]
    public string? Title { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("LeagueId")]
    public League? League { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }
}

/// <summary>
/// Club membership in a league
/// </summary>
public class LeagueClub
{
    public int Id { get; set; }

    public int LeagueId { get; set; }
    public int ClubId { get; set; }

    /// <summary>
    /// Status: Active, Suspended, Inactive
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = "Active";

    /// <summary>
    /// When the club joined the league
    /// </summary>
    public DateTime JoinedAt { get; set; } = DateTime.Now;

    /// <summary>
    /// Membership expiration date if applicable
    /// </summary>
    public DateTime? ExpiresAt { get; set; }

    /// <summary>
    /// Notes about the membership
    /// </summary>
    [MaxLength(500)]
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("LeagueId")]
    public League? League { get; set; }

    [ForeignKey("ClubId")]
    public Club? Club { get; set; }
}

/// <summary>
/// Club request to join a league
/// </summary>
public class LeagueClubRequest
{
    public int Id { get; set; }

    public int LeagueId { get; set; }
    public int ClubId { get; set; }

    /// <summary>
    /// User who submitted the request (must be club admin)
    /// </summary>
    public int RequestedByUserId { get; set; }

    /// <summary>
    /// Status: Pending, Approved, Rejected
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = "Pending";

    /// <summary>
    /// Message from the club explaining why they want to join
    /// </summary>
    [MaxLength(1000)]
    public string? Message { get; set; }

    /// <summary>
    /// Response message from league admin
    /// </summary>
    [MaxLength(1000)]
    public string? ResponseMessage { get; set; }

    /// <summary>
    /// User who processed the request
    /// </summary>
    public int? ProcessedByUserId { get; set; }

    public DateTime? ProcessedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("LeagueId")]
    public League? League { get; set; }

    [ForeignKey("ClubId")]
    public Club? Club { get; set; }

    [ForeignKey("RequestedByUserId")]
    public User? RequestedBy { get; set; }

    [ForeignKey("ProcessedByUserId")]
    public User? ProcessedBy { get; set; }
}

/// <summary>
/// Document attachment for a league (rules, forms, etc.)
/// </summary>
public class LeagueDocument
{
    public int Id { get; set; }

    public int LeagueId { get; set; }

    /// <summary>
    /// Document title
    /// </summary>
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Document description
    /// </summary>
    [MaxLength(1000)]
    public string? Description { get; set; }

    /// <summary>
    /// File URL
    /// </summary>
    [Required]
    [MaxLength(500)]
    public string FileUrl { get; set; } = string.Empty;

    /// <summary>
    /// Original file name
    /// </summary>
    [MaxLength(255)]
    public string? FileName { get; set; }

    /// <summary>
    /// File type/MIME type
    /// </summary>
    [MaxLength(100)]
    public string? FileType { get; set; }

    /// <summary>
    /// File size in bytes
    /// </summary>
    public long? FileSize { get; set; }

    /// <summary>
    /// Sort order for display
    /// </summary>
    public int SortOrder { get; set; } = 0;

    /// <summary>
    /// Whether the document is publicly visible
    /// </summary>
    public bool IsPublic { get; set; } = true;

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    /// <summary>
    /// User who uploaded the document
    /// </summary>
    public int? UploadedByUserId { get; set; }

    // Navigation
    [ForeignKey("LeagueId")]
    public League? League { get; set; }

    [ForeignKey("UploadedByUserId")]
    public User? UploadedBy { get; set; }
}

/// <summary>
/// Configurable roles for league managers
/// </summary>
public class LeagueRole
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
    public string? Icon { get; set; } // Lucide icon name (e.g., "Crown", "Shield")

    public int SortOrder { get; set; } = 0;

    public bool IsSystemRole { get; set; } = false; // System roles cannot be deleted

    // Permissions
    public bool CanManageLeague { get; set; } = false;
    public bool CanManageMembers { get; set; } = false;
    public bool CanManageClubs { get; set; } = false;
    public bool CanManageDocuments { get; set; } = false;
    public bool CanApproveRequests { get; set; } = false;

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}
