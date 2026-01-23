using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Junction table for many-to-many relationship between CourtGroups and TournamentCourts.
/// Allows a court to belong to multiple groups.
/// </summary>
public class CourtGroupCourt
{
    public int Id { get; set; }

    public int CourtGroupId { get; set; }

    public int TournamentCourtId { get; set; }

    /// <summary>
    /// Order of the court within the group
    /// </summary>
    public int SortOrder { get; set; } = 0;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("CourtGroupId")]
    public CourtGroup? CourtGroup { get; set; }

    [ForeignKey("TournamentCourtId")]
    public TournamentCourt? Court { get; set; }
}
