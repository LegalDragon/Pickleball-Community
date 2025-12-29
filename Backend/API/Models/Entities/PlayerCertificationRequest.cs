using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.College.Models.Entities;

/// <summary>
/// A certification review request created by a student
/// </summary>
public class PlayerCertificationRequest
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int StudentId { get; set; }

    [ForeignKey("StudentId")]
    public virtual User Student { get; set; } = null!;

    /// <summary>
    /// Unique token for the shareable review link
    /// </summary>
    [Required]
    [MaxLength(64)]
    public string Token { get; set; } = string.Empty;

    /// <summary>
    /// Optional custom message to show reviewers
    /// </summary>
    [MaxLength(1000)]
    public string? Message { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ExpiresAt { get; set; }

    // Navigation property
    public virtual ICollection<PlayerCertificationReview> Reviews { get; set; } = new List<PlayerCertificationReview>();
}
