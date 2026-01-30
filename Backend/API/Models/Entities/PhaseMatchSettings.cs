using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Stores game settings for a specific phase and match format combination.
/// Allows different BestOf/ScoreFormat settings per phase.
/// e.g., Pool play = 1 game, Semifinals = Best of 3, Finals = Best of 5
/// </summary>
public class PhaseMatchSettings
{
    public int Id { get; set; }

    /// <summary>
    /// The phase these settings apply to
    /// </summary>
    public int PhaseId { get; set; }

    /// <summary>
    /// The match format these settings apply to.
    /// NULL means applies to all matches (single-match encounters) or default for the phase.
    /// </summary>
    public int? MatchFormatId { get; set; }

    /// <summary>
    /// Best of X games (1, 3, or 5)
    /// </summary>
    public int BestOf { get; set; } = 1;

    /// <summary>
    /// Score format for games in this phase/match type
    /// </summary>
    public int? ScoreFormatId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation properties
    [ForeignKey("PhaseId")]
    public DivisionPhase? Phase { get; set; }

    [ForeignKey("MatchFormatId")]
    public EncounterMatchFormat? MatchFormat { get; set; }

    [ForeignKey("ScoreFormatId")]
    public ScoreFormat? ScoreFormat { get; set; }
}
