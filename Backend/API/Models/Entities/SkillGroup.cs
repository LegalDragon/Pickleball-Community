using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// A group of skill areas with a weight for certification scoring
/// </summary>
public class SkillGroup
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Weight from 0-100 for this group's contribution to the final score
    /// </summary>
    [Range(0, 100)]
    public int Weight { get; set; } = 100;

    public int SortOrder { get; set; } = 0;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property
    public virtual ICollection<SkillArea> SkillAreas { get; set; } = new List<SkillArea>();
}
