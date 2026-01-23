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

    /// <summary>
    /// Assignment mode: "Default", "Pool", "MatchType"
    /// - Default: General assignment for the division
    /// - Pool: Specific pool assignment (e.g., Pool A gets Courts 1-4)
    /// - MatchType: Specific match type assignment (e.g., Men's Doubles on Court 1)
    /// </summary>
    [System.ComponentModel.DataAnnotations.MaxLength(20)]
    public string AssignmentMode { get; set; } = "Default";

    /// <summary>
    /// Pool name for pool-based assignment (e.g., "A", "B", "Pool 1")
    /// </summary>
    [System.ComponentModel.DataAnnotations.MaxLength(50)]
    public string? PoolName { get; set; }

    /// <summary>
    /// Match format ID for match-type-based assignment (team scrimmages)
    /// References EncounterMatchFormat for divisions with multiple match types
    /// </summary>
    public int? MatchFormatId { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }

    [ForeignKey("PhaseId")]
    public DivisionPhase? Phase { get; set; }

    [ForeignKey("CourtGroupId")]
    public CourtGroup? CourtGroup { get; set; }

    [ForeignKey("MatchFormatId")]
    public EncounterMatchFormat? MatchFormat { get; set; }
}
