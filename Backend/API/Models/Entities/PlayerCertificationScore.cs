using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.College.Models.Entities;

/// <summary>
/// Individual skill score within a review
/// </summary>
public class PlayerCertificationScore
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ReviewId { get; set; }

    [ForeignKey("ReviewId")]
    public virtual PlayerCertificationReview Review { get; set; } = null!;

    [Required]
    public int SkillAreaId { get; set; }

    [ForeignKey("SkillAreaId")]
    public virtual SkillArea SkillArea { get; set; } = null!;

    /// <summary>
    /// Score from 1 to 10
    /// </summary>
    [Required]
    [Range(1, 10)]
    public int Score { get; set; }
}
