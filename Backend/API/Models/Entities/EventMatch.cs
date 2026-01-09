using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// A scheduled match between two units in a division
/// </summary>
public class EventMatch
{
    public int Id { get; set; }

    public int EventId { get; set; }
    public int DivisionId { get; set; }

    /// <summary>
    /// Type of round: Pool, Bracket, Final
    /// </summary>
    [MaxLength(20)]
    public string RoundType { get; set; } = "Pool";

    /// <summary>
    /// Round number within the round type
    /// </summary>
    public int RoundNumber { get; set; } = 1;

    /// <summary>
    /// Human-readable round name (e.g., "Pool A", "Quarterfinal", "Semifinal", "Final")
    /// </summary>
    [MaxLength(50)]
    public string? RoundName { get; set; }

    /// <summary>
    /// Match number within the round
    /// </summary>
    public int MatchNumber { get; set; } = 1;

    /// <summary>
    /// Position in bracket (for elimination brackets)
    /// </summary>
    public int? BracketPosition { get; set; }

    /// <summary>
    /// Unit number placeholder (before units are assigned)
    /// </summary>
    public int? Unit1Number { get; set; }
    public int? Unit2Number { get; set; }

    /// <summary>
    /// Actual unit IDs (after assignment)
    /// </summary>
    public int? Unit1Id { get; set; }
    public int? Unit2Id { get; set; }

    /// <summary>
    /// Best of X games (1, 3, 5, etc.)
    /// </summary>
    public int BestOf { get; set; } = 1;

    /// <summary>
    /// Winner of the match
    /// </summary>
    public int? WinnerUnitId { get; set; }

    /// <summary>
    /// Status: Scheduled, Ready, InProgress, Completed, Cancelled
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = "Scheduled";

    /// <summary>
    /// Scheduled start time
    /// </summary>
    public DateTime? ScheduledTime { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    /// <summary>
    /// Assigned tournament court
    /// </summary>
    public int? TournamentCourtId { get; set; }

    /// <summary>
    /// Score format (can override division default)
    /// </summary>
    public int? ScoreFormatId { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }

    [ForeignKey("Unit1Id")]
    public EventUnit? Unit1 { get; set; }

    [ForeignKey("Unit2Id")]
    public EventUnit? Unit2 { get; set; }

    [ForeignKey("WinnerUnitId")]
    public EventUnit? Winner { get; set; }

    [ForeignKey("TournamentCourtId")]
    public TournamentCourt? TournamentCourt { get; set; }

    [ForeignKey("ScoreFormatId")]
    public ScoreFormat? ScoreFormat { get; set; }

    public ICollection<EventGame> Games { get; set; } = new List<EventGame>();
}
