using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Defines the format for a match position within an encounter.
/// Created at division setup time to define the structure of team scrimmages.
/// Example: Match 1 = Men's Doubles (2M), Match 2 = Women's Doubles (2F), Match 3 = Mixed (1M+1F)
/// </summary>
public class EncounterMatchFormat
{
    public int Id { get; set; }

    public int DivisionId { get; set; }

    /// <summary>
    /// Order of this match type within the encounter (1, 2, 3...)
    /// </summary>
    public int MatchOrder { get; set; } = 1;

    /// <summary>
    /// Display name for this match type (e.g., "Men's Doubles", "Mixed Doubles")
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Number of male players required per side
    /// </summary>
    public int MaleCount { get; set; } = 0;

    /// <summary>
    /// Number of female players required per side
    /// </summary>
    public int FemaleCount { get; set; } = 0;

    /// <summary>
    /// Number of players of any gender required per side
    /// Total players per side = MaleCount + FemaleCount + UnisexCount
    /// </summary>
    public int UnisexCount { get; set; } = 2;

    /// <summary>
    /// Number of games per match: 1, 3, or 5 (best-of format)
    /// </summary>
    public int GamesPerMatch { get; set; } = 1;

    /// <summary>
    /// Score format for games in this match type (can override division default)
    /// </summary>
    public int? ScoreFormatId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }

    [ForeignKey("ScoreFormatId")]
    public ScoreFormat? ScoreFormat { get; set; }

    // Computed properties
    [NotMapped]
    public int PlayersPerSide => MaleCount + FemaleCount + UnisexCount;
}
