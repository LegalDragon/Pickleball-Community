using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Defines scoring format for games
/// </summary>
public class ScoreFormat
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Reference to the scoring method type (e.g., Rally Score, Classic Side Out)
    /// </summary>
    public int? ScoreMethodId { get; set; }

    /// <summary>
    /// Scoring type: Classic (side-out) or Rally (rally scoring)
    /// Legacy field - use ScoreMethodId for new formats
    /// </summary>
    [MaxLength(20)]
    public string ScoringType { get; set; } = "Rally";

    /// <summary>
    /// Points needed to win (Play To: 7-39)
    /// </summary>
    public int MaxPoints { get; set; } = 11;

    /// <summary>
    /// Win by margin (typically 1 or 2)
    /// </summary>
    public int WinByMargin { get; set; } = 2;

    /// <summary>
    /// Cap after this many points above MaxPoints (0-9, 0 = no cap)
    /// E.g., if MaxPoints=11 and CapAfter=4, game is capped at 15
    /// </summary>
    public int CapAfter { get; set; } = 0;

    /// <summary>
    /// Whether to switch ends (Change Ends)
    /// </summary>
    public bool SwitchEndsAtMidpoint { get; set; } = false;

    /// <summary>
    /// Score at which to switch ends (null = MaxPoints/2)
    /// </summary>
    public int? MidpointScore { get; set; }

    /// <summary>
    /// Optional time limit in minutes
    /// </summary>
    public int? TimeLimitMinutes { get; set; }

    /// <summary>
    /// Whether this is a tiebreaker format
    /// </summary>
    public bool IsTiebreaker { get; set; } = false;

    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public bool IsDefault { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("ScoreMethodId")]
    public ScoreMethod? ScoreMethod { get; set; }
}
