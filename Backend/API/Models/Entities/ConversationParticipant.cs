using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class ConversationParticipant
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ConversationId { get; set; }

    [Required]
    public int UserId { get; set; }

    [MaxLength(20)]
    public string Role { get; set; } = "Member"; // Admin, Member

    public bool IsMuted { get; set; } = false;

    public DateTime JoinedAt { get; set; } = DateTime.Now;
    public DateTime? LastReadAt { get; set; }
    public DateTime? LeftAt { get; set; }

    // Navigation properties
    [ForeignKey("ConversationId")]
    public Conversation? Conversation { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }
}

public static class ParticipantRole
{
    public const string Admin = "Admin";
    public const string Member = "Member";
}
