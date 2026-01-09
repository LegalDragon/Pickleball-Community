using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Represents a hero video that can be displayed on the landing page.
/// Multiple videos can be configured, with active ones rotating/displaying.
/// </summary>
public class HeroVideo
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ThemeId { get; set; }

    [ForeignKey("ThemeId")]
    public virtual ThemeSettings Theme { get; set; } = null!;

    [Required]
    [MaxLength(500)]
    public string VideoUrl { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? ThumbnailUrl { get; set; }

    [MaxLength(200)]
    public string? Title { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Type of video: "upload" for uploaded files, "youtube" for YouTube links, "external" for other URLs
    /// </summary>
    [MaxLength(50)]
    public string VideoType { get; set; } = "upload";

    /// <summary>
    /// Display order for multiple videos
    /// </summary>
    public int SortOrder { get; set; } = 0;

    /// <summary>
    /// Whether this video is currently active and should be displayed
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Duration in seconds to display this video before switching (for rotation)
    /// Null means use default duration or play full video
    /// </summary>
    public int? DisplayDuration { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
    public int? CreatedBy { get; set; }
    public int? UpdatedBy { get; set; }
}
