using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Review visibility settings
/// </summary>
public enum ReviewVisibility
{
    Anyone = 0,         // Anyone with the link can review
    Members = 1,        // Only registered community members can review
    InvitedOnly = 2     // Only specifically invited users can review
}

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

    /// <summary>
    /// Who can submit reviews
    /// </summary>
    public ReviewVisibility Visibility { get; set; } = ReviewVisibility.Anyone;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public DateTime? ExpiresAt { get; set; }

    // Navigation properties
    public virtual ICollection<PlayerCertificationReview> Reviews { get; set; } = new List<PlayerCertificationReview>();
    public virtual ICollection<PlayerCertificationInvitation> Invitations { get; set; } = new List<PlayerCertificationInvitation>();
}
