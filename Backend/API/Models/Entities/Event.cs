using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class Event
{
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Description { get; set; }

    public int EventTypeId { get; set; }

    // Dates
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    // Registration
    public DateTime? RegistrationOpenDate { get; set; }
    public DateTime? RegistrationCloseDate { get; set; }
    public bool IsPublished { get; set; } = false;

    /// <summary>
    /// Private events are only visible to invited participants and club members.
    /// Public events are visible to everyone.
    /// </summary>
    public bool IsPrivate { get; set; } = false;

    // Location
    public int? CourtId { get; set; }

    [MaxLength(200)]
    public string? VenueName { get; set; }

    [MaxLength(300)]
    public string? Address { get; set; }

    [MaxLength(100)]
    public string? City { get; set; }

    [MaxLength(100)]
    public string? State { get; set; }

    [MaxLength(100)]
    public string? Country { get; set; }

    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    // Media
    [MaxLength(500)]
    public string? PosterImageUrl { get; set; }

    [MaxLength(500)]
    public string? BannerImageUrl { get; set; }

    // Fees
    [Column(TypeName = "decimal(10,2)")]
    public decimal RegistrationFee { get; set; } = 0;

    [Column(TypeName = "decimal(10,2)")]
    public decimal PerDivisionFee { get; set; } = 0;

    // Contact
    [MaxLength(100)]
    public string? ContactEmail { get; set; }

    [MaxLength(20)]
    public string? ContactPhone { get; set; }

    // Organizer
    public int OrganizedByUserId { get; set; }
    public int? OrganizedByClubId { get; set; }

    // Capacity
    public int? MaxParticipants { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;

    // Navigation
    [ForeignKey("EventTypeId")]
    public EventType? EventType { get; set; }

    [ForeignKey("CourtId")]
    public Court? Court { get; set; }

    [ForeignKey("OrganizedByUserId")]
    public User? OrganizedBy { get; set; }

    [ForeignKey("OrganizedByClubId")]
    public Club? OrganizedByClub { get; set; }

    public ICollection<EventDivision> Divisions { get; set; } = new List<EventDivision>();
    public ICollection<EventRegistration> Registrations { get; set; } = new List<EventRegistration>();
}

public class EventDivision
{
    public int Id { get; set; }

    public int EventId { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty; // e.g., "Men's Singles 3.5", "Mixed Doubles 4.0"

    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Reference to the team unit (defines team composition by gender)
    /// </summary>
    public int? TeamUnitId { get; set; }

    /// <summary>
    /// Reference to age group (admin managed)
    /// </summary>
    public int? AgeGroupId { get; set; }

    /// <summary>
    /// Minimum skill rating for this division (e.g., 3.0)
    /// </summary>
    [Column(TypeName = "decimal(4,2)")]
    public decimal? MinSkillRating { get; set; }

    /// <summary>
    /// Maximum skill rating for this division (e.g., 3.5)
    /// </summary>
    [Column(TypeName = "decimal(4,2)")]
    public decimal? MaxSkillRating { get; set; }

    /// <summary>
    /// Maximum number of units (teams) allowed in this division
    /// </summary>
    public int? MaxUnits { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? DivisionFee { get; set; } // Override event's per-division fee

    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;

    // Legacy fields (kept for backward compatibility during migration)
    public int TeamSize { get; set; } = 1; // 1 for singles, 2 for doubles

    [MaxLength(50)]
    public string? SkillLevelMin { get; set; } // e.g., "3.0"

    [MaxLength(50)]
    public string? SkillLevelMax { get; set; } // e.g., "3.5"

    [MaxLength(20)]
    public string? Gender { get; set; } // Men, Women, Mixed, Open

    [MaxLength(20)]
    public string? AgeGroup { get; set; } // Open, Senior, Junior, etc.

    public int? MaxTeams { get; set; }

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("TeamUnitId")]
    public TeamUnit? TeamUnit { get; set; }

    [ForeignKey("AgeGroupId")]
    public AgeGroup? AgeGroupEntity { get; set; }

    public ICollection<EventRegistration> Registrations { get; set; } = new List<EventRegistration>();
    public ICollection<EventPartnerRequest> PartnerRequests { get; set; } = new List<EventPartnerRequest>();
    public ICollection<DivisionReward> Rewards { get; set; } = new List<DivisionReward>();
}

public class EventRegistration
{
    public int Id { get; set; }

    public int EventId { get; set; }
    public int DivisionId { get; set; }
    public int UserId { get; set; }

    // Team info - null for singles, team ID for doubles/mixed
    public int? TeamId { get; set; }

    [MaxLength(100)]
    public string? TeamName { get; set; }

    // Payment
    [MaxLength(20)]
    public string PaymentStatus { get; set; } = "Pending"; // Pending, Paid, Refunded

    [Column(TypeName = "decimal(10,2)")]
    public decimal AmountPaid { get; set; } = 0;

    public DateTime? PaidAt { get; set; }

    [MaxLength(100)]
    public string? PaymentReference { get; set; }

    // Status
    [MaxLength(20)]
    public string Status { get; set; } = "Registered"; // Registered, Confirmed, Waitlisted, Cancelled, CheckedIn

    public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;
    public DateTime? CheckedInAt { get; set; }

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }
}

public class EventPartnerRequest
{
    public int Id { get; set; }

    public int EventId { get; set; }
    public int DivisionId { get; set; }
    public int UserId { get; set; }

    [MaxLength(500)]
    public string? Message { get; set; }

    public bool IsLookingForPartner { get; set; } = true;

    // If someone requests to join this person
    public int? RequestedByUserId { get; set; }

    [MaxLength(20)]
    public string Status { get; set; } = "Open"; // Open, Matched, Closed

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }

    [ForeignKey("RequestedByUserId")]
    public User? RequestedBy { get; set; }
}
