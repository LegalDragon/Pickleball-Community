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

    // Location (references Venues table - formerly Courts)
    public int? CourtId { get; set; } // Column name kept for DB compatibility, references Venues

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

    /// <summary>
    /// Unit for the registration fee: "person", "pair", or "team"
    /// </summary>
    [MaxLength(20)]
    public string? PriceUnit { get; set; }

    /// <summary>
    /// How the fee is charged: "per_unit" (team pays once) or "per_person" (each player pays)
    /// </summary>
    [MaxLength(20)]
    public string? PaymentModel { get; set; } = "per_unit";

    // Contact
    [MaxLength(100)]
    public string? ContactName { get; set; }

    [MaxLength(100)]
    public string? ContactEmail { get; set; }

    [MaxLength(20)]
    public string? ContactPhone { get; set; }

    /// <summary>
    /// Instructions for how to pay registration fees (e.g., Venmo, Zelle, PayPal info)
    /// </summary>
    [MaxLength(1000)]
    public string? PaymentInstructions { get; set; }

    // Organizer
    public int OrganizedByUserId { get; set; }
    public int? OrganizedByClubId { get; set; }

    // Capacity
    public int? MaxParticipants { get; set; }

    /// <summary>
    /// Whether players can register for multiple divisions in this event.
    /// Defaults to true. If false, players can only register for one division.
    /// </summary>
    public bool AllowMultipleDivisions { get; set; } = true;

    /// <summary>
    /// Tournament status: Draft, RegistrationOpen, RegistrationClosed, ScheduleReady, Running, Completed, Cancelled
    /// </summary>
    [MaxLength(20)]
    public string TournamentStatus { get; set; } = "Draft";

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
    public bool IsActive { get; set; } = true;

    // Navigation
    [ForeignKey("EventTypeId")]
    public EventType? EventType { get; set; }

    [ForeignKey("CourtId")]
    public Venue? Venue { get; set; }

    [ForeignKey("OrganizedByUserId")]
    public User? OrganizedBy { get; set; }

    [ForeignKey("OrganizedByClubId")]
    public Club? OrganizedByClub { get; set; }

    public ICollection<EventDivision> Divisions { get; set; } = new List<EventDivision>();
    public ICollection<EventRegistration> Registrations { get; set; } = new List<EventRegistration>();
    public ICollection<EventUnit> Units { get; set; } = new List<EventUnit>();
    public ICollection<TournamentCourt> TournamentCourts { get; set; } = new List<TournamentCourt>();
    public ICollection<EventMatch> Matches { get; set; } = new List<EventMatch>();
    public ICollection<EventDocument> Documents { get; set; } = new List<EventDocument>();
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
    /// Reference to skill level (admin managed)
    /// </summary>
    public int? SkillLevelId { get; set; }

    /// <summary>
    /// Minimum skill rating for this division (e.g., 3.0)
    /// Legacy field - use SkillLevelId for new divisions
    /// </summary>
    [Column(TypeName = "decimal(4,2)")]
    public decimal? MinSkillRating { get; set; }

    /// <summary>
    /// Maximum skill rating for this division (e.g., 3.5)
    /// Legacy field - use SkillLevelId for new divisions
    /// </summary>
    [Column(TypeName = "decimal(4,2)")]
    public decimal? MaxSkillRating { get; set; }

    /// <summary>
    /// Maximum number of units (teams) allowed in this division
    /// </summary>
    public int? MaxUnits { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? DivisionFee { get; set; } // Override event's per-division fee

    // Tournament structure
    public int? DefaultScoreFormatId { get; set; }
    public int? PoolCount { get; set; } // Number of pools for round robin
    public int? PoolSize { get; set; } // Target number of units per pool
    [MaxLength(30)]
    public string? ScheduleType { get; set; } // RoundRobin, RoundRobinPlayoff, SingleElimination, DoubleElimination, RandomPairing
    [MaxLength(20)]
    public string ScheduleStatus { get; set; } = "NotGenerated"; // NotGenerated, TemplateReady, UnitsAssigned, Finalized
    [MaxLength(20)]
    public string? BracketType { get; set; } // SingleElimination, DoubleElimination, RoundRobin, Hybrid
    public int? PlayoffFromPools { get; set; } // How many from each pool advance to playoffs
    public int GamesPerMatch { get; set; } = 1; // Best of X
    public int? TargetUnitCount { get; set; } // Target number of units/placeholders for schedule generation

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

    [ForeignKey("SkillLevelId")]
    public SkillLevel? SkillLevel { get; set; }

    [ForeignKey("DefaultScoreFormatId")]
    public ScoreFormat? DefaultScoreFormat { get; set; }

    public ICollection<EventRegistration> Registrations { get; set; } = new List<EventRegistration>();
    public ICollection<EventPartnerRequest> PartnerRequests { get; set; } = new List<EventPartnerRequest>();
    public ICollection<DivisionReward> Rewards { get; set; } = new List<DivisionReward>();
    public ICollection<EventUnit> Units { get; set; } = new List<EventUnit>();
    public ICollection<EventMatch> Matches { get; set; } = new List<EventMatch>();
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

    public DateTime RegisteredAt { get; set; } = DateTime.Now;
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

    public DateTime CreatedAt { get; set; } = DateTime.Now;

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

public class EventDocument
{
    public int Id { get; set; }

    public int EventId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [MaxLength(500)]
    public string FileUrl { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string FileName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? FileType { get; set; }

    public int? FileSize { get; set; }

    /// <summary>
    /// If true, document is visible to all users.
    /// If false, only visible to organizers and registered participants.
    /// </summary>
    public bool IsPublic { get; set; } = true;

    public int SortOrder { get; set; } = 0;

    public int UploadedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("UploadedByUserId")]
    public User? UploadedBy { get; set; }
}
