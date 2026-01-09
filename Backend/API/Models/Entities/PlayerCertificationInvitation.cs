using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Tracks users invited to submit a peer review
/// </summary>
public class PlayerCertificationInvitation
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int RequestId { get; set; }

    [ForeignKey("RequestId")]
    public virtual PlayerCertificationRequest Request { get; set; } = null!;

    [Required]
    public int InvitedUserId { get; set; }

    [ForeignKey("InvitedUserId")]
    public virtual User InvitedUser { get; set; } = null!;

    /// <summary>
    /// Whether the invited user has submitted a review
    /// </summary>
    public bool HasReviewed { get; set; } = false;

    public DateTime InvitedAt { get; set; } = DateTime.Now;

    public DateTime? ReviewedAt { get; set; }
}
