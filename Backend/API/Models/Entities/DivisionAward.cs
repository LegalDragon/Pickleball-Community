using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Defines placement awards for a division (Gold, Silver, Bronze, etc.).
/// </summary>
public class DivisionAward
{
    public int Id { get; set; }

    public int DivisionId { get; set; }

    /// <summary>
    /// Position/place (1 = 1st place, 2 = 2nd, etc.)
    /// </summary>
    public int Position { get; set; }

    /// <summary>
    /// Award name (e.g., "Gold", "Silver", "Bronze", "4th Place")
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string AwardName { get; set; } = string.Empty;

    /// <summary>
    /// Description (e.g., "Division Champion", "Runner-up")
    /// </summary>
    [MaxLength(500)]
    public string? AwardDescription { get; set; }

    /// <summary>
    /// Prize value description (e.g., "$500", "Gift Card")
    /// </summary>
    [MaxLength(100)]
    public string? PrizeValue { get; set; }

    /// <summary>
    /// URL to medal/badge image
    /// </summary>
    [MaxLength(500)]
    public string? BadgeImageUrl { get; set; }

    /// <summary>
    /// Color code for styling (e.g., "#FFD700" for gold)
    /// </summary>
    [MaxLength(20)]
    public string? ColorCode { get; set; }

    /// <summary>
    /// Icon name for display (e.g., "trophy", "medal")
    /// </summary>
    [MaxLength(50)]
    public string? IconName { get; set; }

    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }
}
