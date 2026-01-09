using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Individual FAQ question/answer entries
/// </summary>
public class FaqEntry
{
    public int Id { get; set; }

    public int CategoryId { get; set; }

    [Required]
    [MaxLength(500)]
    public string Question { get; set; } = string.Empty;

    [Required]
    public string Answer { get; set; } = string.Empty;

    public int SortOrder { get; set; } = 0;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("CategoryId")]
    public FaqCategory? Category { get; set; }
}
