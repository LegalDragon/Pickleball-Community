using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Admin-managed skill levels for event divisions.
/// Examples: "2.5", "3.0", "3.5", "4.0", "4.0+", "Pro"
/// </summary>
public class SkillLevel
{
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Description { get; set; }

    /// <summary>
    /// Numeric value for sorting and comparison (e.g., 3.0, 3.5, 4.0)
    /// Can be null for special levels like "Pro" or "Open"
    /// </summary>
    [Column(TypeName = "decimal(4,2)")]
    public decimal? Value { get; set; }

    [MaxLength(50)]
    public string? Icon { get; set; }

    [MaxLength(20)]
    public string? Color { get; set; }

    public int SortOrder { get; set; } = 0;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}
