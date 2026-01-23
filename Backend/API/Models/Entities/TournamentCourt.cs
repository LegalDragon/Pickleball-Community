using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// A court set up for a tournament event
/// This is separate from the general Courts table - it represents
/// a specific court configuration for this tournament
/// </summary>
public class TournamentCourt
{
    public int Id { get; set; }

    public int EventId { get; set; }

    /// <summary>
    /// Reference to the venue (facility) where this court is located
    /// </summary>
    [Column("CourtId")] // Maps to existing CourtId column in database
    public int? VenueId { get; set; }

    /// <summary>
    /// Court label for this tournament (e.g., "Court 1", "Court A")
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string CourtLabel { get; set; } = string.Empty;

    /// <summary>
    /// Current status: Available, InUse, Maintenance, Closed
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = "Available";

    /// <summary>
    /// Current game being played on this court
    /// </summary>
    public int? CurrentGameId { get; set; }

    /// <summary>
    /// Location description within the venue
    /// </summary>
    [MaxLength(200)]
    public string? LocationDescription { get; set; }

    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("VenueId")]
    public Venue? Venue { get; set; }

    [ForeignKey("CurrentGameId")]
    public EventGame? CurrentGame { get; set; }

    /// <summary>
    /// Groups this court belongs to (many-to-many via junction table)
    /// </summary>
    public ICollection<CourtGroupCourt> CourtGroupCourts { get; set; } = new List<CourtGroupCourt>();
}
