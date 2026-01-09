using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class FriendRequest
{
    public int Id { get; set; }

    [Required]
    public int SenderId { get; set; }

    [Required]
    public int RecipientId { get; set; }

    [Required]
    [MaxLength(20)]
    public string Status { get; set; } = "Pending"; // Pending, Accepted, Rejected, Cancelled

    [MaxLength(500)]
    public string? Message { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public DateTime? RespondedAt { get; set; }

    [ForeignKey("SenderId")]
    public User? Sender { get; set; }

    [ForeignKey("RecipientId")]
    public User? Recipient { get; set; }
}
