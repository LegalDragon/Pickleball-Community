using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Configurable staff roles for events. Can be global templates (EventId = null)
/// or event-specific custom roles.
/// </summary>
public class EventStaffRole
{
    public int Id { get; set; }

    /// <summary>
    /// NULL = global/default role template, otherwise event-specific role
    /// </summary>
    public int? EventId { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    // Permission flags
    public bool CanManageSchedule { get; set; } = false;
    public bool CanManageCourts { get; set; } = false;
    public bool CanRecordScores { get; set; } = false;
    public bool CanCheckInPlayers { get; set; } = false;
    public bool CanManageLineups { get; set; } = false;
    public bool CanViewAllData { get; set; } = false;

    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }
}

/// <summary>
/// Staff assignment for an event. Supports both self-registration
/// (volunteer signs up) and admin assignment.
/// </summary>
public class EventStaff
{
    public int Id { get; set; }

    public int EventId { get; set; }
    public int UserId { get; set; }

    /// <summary>
    /// Reference to the staff role
    /// </summary>
    public int? RoleId { get; set; }

    /// <summary>
    /// True if the user registered themselves for this role
    /// </summary>
    public bool IsSelfRegistered { get; set; } = false;

    /// <summary>
    /// Status: Pending, Approved, Active, Declined, Removed
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = "Pending";

    /// <summary>
    /// Priority for role assignment (higher = more preferred for assignments)
    /// Admin can adjust this to prioritize certain staff members
    /// </summary>
    public int Priority { get; set; } = 0;

    /// <summary>
    /// Optional availability window start
    /// </summary>
    public DateTime? AvailableFrom { get; set; }

    /// <summary>
    /// Optional availability window end
    /// </summary>
    public DateTime? AvailableTo { get; set; }

    /// <summary>
    /// Notes from the volunteer when self-registering
    /// </summary>
    [MaxLength(500)]
    public string? SelfRegistrationNotes { get; set; }

    /// <summary>
    /// Notes from admin about this staff assignment
    /// </summary>
    [MaxLength(500)]
    public string? AdminNotes { get; set; }

    /// <summary>
    /// User who approved/assigned this staff member
    /// </summary>
    public int? AssignedByUserId { get; set; }

    /// <summary>
    /// When the assignment was made/approved
    /// </summary>
    public DateTime? AssignedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }

    [ForeignKey("RoleId")]
    public EventStaffRole? Role { get; set; }

    [ForeignKey("AssignedByUserId")]
    public User? AssignedBy { get; set; }
}

/// <summary>
/// Links a division to specific tournament courts with priority order.
/// Used for court pre-allocation during scheduling.
/// </summary>
public class DivisionCourtBlock
{
    public int Id { get; set; }

    public int DivisionId { get; set; }
    public int TournamentCourtId { get; set; }

    /// <summary>
    /// Priority order (lower = higher priority, used first)
    /// </summary>
    public int Priority { get; set; } = 0;

    /// <summary>
    /// Intended start time for this court block
    /// </summary>
    public DateTime? IntendedStartTime { get; set; }

    /// <summary>
    /// Intended end time for this court block
    /// </summary>
    public DateTime? IntendedEndTime { get; set; }

    /// <summary>
    /// Notes for organizers
    /// </summary>
    [MaxLength(500)]
    public string? Notes { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }

    [ForeignKey("TournamentCourtId")]
    public TournamentCourt? TournamentCourt { get; set; }
}
