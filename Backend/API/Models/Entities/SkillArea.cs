using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.College.Models.Entities;

/// <summary>
/// Admin-configurable skill areas to rate (e.g., Forehand Drive, Volley, Dink)
/// </summary>
public class SkillArea
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(50)]
    public string? Category { get; set; } // Legacy field, use SkillGroup instead

    /// <summary>
    /// Optional group for weighted scoring
    /// </summary>
    public int? SkillGroupId { get; set; }

    [ForeignKey("SkillGroupId")]
    public virtual SkillGroup? SkillGroup { get; set; }

    public int SortOrder { get; set; } = 0;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
