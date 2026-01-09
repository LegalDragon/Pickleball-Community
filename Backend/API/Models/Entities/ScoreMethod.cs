using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Admin-configurable scoring method types (e.g., "Classic Side Out Score", "Rally Score", "UPA Rally Score")
/// These are the options shown in the dropdown when configuring a score format
/// </summary>
public class ScoreMethod
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    /// <summary>
    /// Base scoring type: Classic (side-out) or Rally
    /// </summary>
    [MaxLength(20)]
    public string BaseType { get; set; } = "Rally"; // Classic, Rally

    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public bool IsDefault { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}
