using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Defines team composition for event divisions.
/// Examples:
/// - Men's Singles: MaleCount=1, FemaleCount=0, UnisexCount=0
/// - Women's Doubles: MaleCount=0, FemaleCount=2, UnisexCount=0
/// - Mixed Doubles: MaleCount=1, FemaleCount=1, UnisexCount=0
/// - UCA Team: MaleCount=3, FemaleCount=2, UnisexCount=0
/// </summary>
public class TeamUnit
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Short code for the unit (e.g., "MD" for Men's Doubles, "WS" for Women's Singles)
    /// </summary>
    [MaxLength(20)]
    public string? UnitCode { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Number of male players required in this unit
    /// </summary>
    public int MaleCount { get; set; } = 0;

    /// <summary>
    /// Number of female players required in this unit
    /// </summary>
    public int FemaleCount { get; set; } = 0;

    /// <summary>
    /// Number of players of any gender allowed in this unit
    /// </summary>
    public int UnisexCount { get; set; } = 0;

    /// <summary>
    /// Total players in this unit (computed)
    /// </summary>
    public int TotalPlayers => MaleCount + FemaleCount + UnisexCount;

    [MaxLength(50)]
    public string? Icon { get; set; }

    [MaxLength(20)]
    public string? Color { get; set; }

    public int SortOrder { get; set; } = 0;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
