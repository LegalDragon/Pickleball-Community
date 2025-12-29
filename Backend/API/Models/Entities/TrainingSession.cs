using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.College.Models.Entities;

public class TrainingSession
{
    public int Id { get; set; }
    public int CoachId { get; set; }
    public int StudentId { get; set; }
    public int? MaterialId { get; set; }

    [Required]
    public string SessionType { get; set; } = "Online";

    // RequestedAt = when student requested, ScheduledAt = confirmed time by coach
    public DateTime? RequestedAt { get; set; }
    public DateTime ScheduledAt { get; set; }
    public int DurationMinutes { get; set; }
    public decimal Price { get; set; }

    // Status: Pending, PendingStudentApproval, Confirmed, Completed, Cancelled
    public string Status { get; set; } = "Pending";

    public string? MeetingLink { get; set; }
    public string? Location { get; set; }

    [MaxLength(1000)]
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Coach proposal fields (for counter-proposals)
    // NOTE: These are NotMapped until Migration_011_SessionProposals.sql is run
    // After running the migration, remove the [NotMapped] attributes
    [NotMapped]
    public DateTime? ProposedScheduledAt { get; set; }
    [NotMapped]
    public int? ProposedDurationMinutes { get; set; }
    [NotMapped]
    public decimal? ProposedPrice { get; set; }
    [NotMapped]
    [MaxLength(200)]
    public string? ProposedLocation { get; set; }
    [NotMapped]
    [MaxLength(500)]
    public string? ProposalNote { get; set; }
    [NotMapped]
    public DateTime? ProposedAt { get; set; }

    public User Coach { get; set; } = null!;
    public User Student { get; set; } = null!;
    public TrainingMaterial? Material { get; set; }
}
