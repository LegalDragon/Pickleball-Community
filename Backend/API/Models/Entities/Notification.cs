using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class Notification
{
    public int Id { get; set; }

    [Required]
    public int UserId { get; set; }

    [Required]
    [MaxLength(50)]
    public string Type { get; set; } = "General"; // General, FriendRequest, ClubInvite, EventUpdate, GameReady, Message, System

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Message { get; set; }

    // Optional link to navigate to
    [MaxLength(500)]
    public string? ActionUrl { get; set; }

    // Reference to related entity (optional)
    [MaxLength(50)]
    public string? ReferenceType { get; set; } // FriendRequest, Club, Event, Game, Conversation, etc.

    public int? ReferenceId { get; set; }

    public bool IsRead { get; set; } = false;

    public DateTime? ReadAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [ForeignKey("UserId")]
    public User? User { get; set; }
}
