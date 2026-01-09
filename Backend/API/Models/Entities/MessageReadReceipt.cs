using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class MessageReadReceipt
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int MessageId { get; set; }

    [Required]
    public int UserId { get; set; }

    public DateTime ReadAt { get; set; } = DateTime.Now;

    // Navigation properties
    [ForeignKey("MessageId")]
    public Message? Message { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }
}
