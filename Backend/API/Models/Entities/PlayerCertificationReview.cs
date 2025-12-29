using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.College.Models.Entities;

/// <summary>
/// An individual review submitted by a reviewer
/// </summary>
public class PlayerCertificationReview
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int RequestId { get; set; }

    [ForeignKey("RequestId")]
    public virtual PlayerCertificationRequest Request { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string ReviewerName { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? ReviewerEmail { get; set; }

    [Required]
    public int KnowledgeLevelId { get; set; }

    [ForeignKey("KnowledgeLevelId")]
    public virtual KnowledgeLevel KnowledgeLevel { get; set; } = null!;

    /// <summary>
    /// Whether the reviewer wants to remain anonymous to the player
    /// </summary>
    public bool IsAnonymous { get; set; } = false;

    /// <summary>
    /// Optional comments from the reviewer
    /// </summary>
    [MaxLength(2000)]
    public string? Comments { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property
    public virtual ICollection<PlayerCertificationScore> Scores { get; set; } = new List<PlayerCertificationScore>();
}
