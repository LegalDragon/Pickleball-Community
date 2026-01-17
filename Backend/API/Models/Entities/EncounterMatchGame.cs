using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// An individual game within an encounter match (for best-of-3/5 series).
/// </summary>
public class EncounterMatchGame
{
    public int Id { get; set; }

    public int MatchId { get; set; }

    /// <summary>
    /// Game number within the match (1, 2, 3, etc.)
    /// </summary>
    public int GameNumber { get; set; } = 1;

    /// <summary>
    /// Score for Unit 1 in this game
    /// </summary>
    public int Unit1Score { get; set; } = 0;

    /// <summary>
    /// Score for Unit 2 in this game
    /// </summary>
    public int Unit2Score { get; set; } = 0;

    /// <summary>
    /// Winner of this game
    /// </summary>
    public int? WinnerUnitId { get; set; }

    /// <summary>
    /// Status: New, InProgress, Completed
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = "New";

    /// <summary>
    /// Score format for this game
    /// </summary>
    public int? ScoreFormatId { get; set; }

    /// <summary>
    /// Court assignment for this game
    /// </summary>
    public int? TournamentCourtId { get; set; }

    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("MatchId")]
    public EncounterMatch? Match { get; set; }

    [ForeignKey("WinnerUnitId")]
    public EventUnit? Winner { get; set; }

    [ForeignKey("ScoreFormatId")]
    public ScoreFormat? ScoreFormat { get; set; }

    [ForeignKey("TournamentCourtId")]
    public TournamentCourt? TournamentCourt { get; set; }
}
