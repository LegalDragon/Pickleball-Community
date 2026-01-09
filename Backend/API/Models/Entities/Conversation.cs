using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class Conversation
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(20)]
    public string Type { get; set; } = "Direct"; // Direct, FriendGroup, Club

    [MaxLength(100)]
    public string? Name { get; set; }

    public int? ClubId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
    public DateTime? LastMessageAt { get; set; }

    public bool IsDeleted { get; set; } = false;

    // Navigation properties
    [ForeignKey("ClubId")]
    public Club? Club { get; set; }

    public ICollection<ConversationParticipant> Participants { get; set; } = new List<ConversationParticipant>();
    public ICollection<Message> Messages { get; set; } = new List<Message>();
}

public static class ConversationType
{
    public const string Direct = "Direct";
    public const string FriendGroup = "FriendGroup";
    public const string Club = "Club";
}
