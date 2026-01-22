using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Assigns court groups to divisions or specific phases.
/// Allows TDs to control which courts are used for which divisions.
/// </summary>
public class DivisionCourtAssignment
{
    public int Id { get; set; }

    public int DivisionId { get; set; }

    /// <summary>
    /// Specific phase (null = applies to entire division)
    /// </summary>
    public int? PhaseId { get; set; }

    public int CourtGroupId { get; set; }

    /// <summary>
    /// Priority within division (lower = higher priority)
    /// </summary>
    public int Priority { get; set; } = 0;

    /// <summary>
    /// Court group available from this time (optional)
    /// </summary>
    public TimeSpan? ValidFromTime { get; set; }

    /// <summary>
    /// Court group available until this time (optional)
    /// </summary>
    public TimeSpan? ValidToTime { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }

    [ForeignKey("PhaseId")]
    public DivisionPhase? Phase { get; set; }

    [ForeignKey("CourtGroupId")]
    public CourtGroup? CourtGroup { get; set; }
}
