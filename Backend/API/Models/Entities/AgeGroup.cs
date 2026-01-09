using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Age groups for event divisions (admin managed).
/// Examples: Open, Junior (Under 18), Senior 50+, Senior 60+, Senior 70+
/// </summary>
public class AgeGroup
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Minimum age for this group (null means no minimum)
    /// </summary>
    public int? MinAge { get; set; }

    /// <summary>
    /// Maximum age for this group (null means no maximum)
    /// </summary>
    public int? MaxAge { get; set; }

    [MaxLength(50)]
    public string? Icon { get; set; }

    [MaxLength(20)]
    public string? Color { get; set; }

    public int SortOrder { get; set; } = 0;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}
