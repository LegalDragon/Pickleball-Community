using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Logical grouping of courts for scheduling purposes.
/// Allows tournament directors to assign related matches to nearby courts.
/// Examples: "Courts 1-4", "Championship Courts", "Indoor Courts"
/// </summary>
public class CourtGroup
{
    public int Id { get; set; }

    public int EventId { get; set; }

    /// <summary>
    /// Group name (e.g., "Courts 1-4", "Championship Courts")
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string GroupName { get; set; } = string.Empty;

    /// <summary>
    /// Short code (e.g., "A", "B", "CHAMP")
    /// </summary>
    [MaxLength(20)]
    public string? GroupCode { get; set; }

    /// <summary>
    /// Description of this court group
    /// </summary>
    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Location area within the venue (e.g., "North Side", "Indoor", "Main Arena")
    /// </summary>
    [MaxLength(100)]
    public string? LocationArea { get; set; }

    /// <summary>
    /// Number of courts in this group (auto-calculated or manual)
    /// </summary>
    public int CourtCount { get; set; } = 0;

    /// <summary>
    /// Priority for important matches (higher = preferred)
    /// </summary>
    public int Priority { get; set; } = 0;

    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    /// <summary>
    /// Courts in this group (many-to-many via junction table)
    /// </summary>
    public ICollection<CourtGroupCourt> CourtGroupCourts { get; set; } = new List<CourtGroupCourt>();

    /// <summary>
    /// Division/phase court assignments for this group
    /// </summary>
    public ICollection<DivisionCourtAssignment> DivisionAssignments { get; set; } = new List<DivisionCourtAssignment>();
}
