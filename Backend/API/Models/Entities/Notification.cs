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

    // Reference to related entity (optional) - Legacy field, use ObjectType references for new notifications
    [MaxLength(50)]
    public string? ReferenceType { get; set; } // FriendRequest, Club, Event, Game, Conversation, etc.

    public int? ReferenceId { get; set; }

    // Primary Object Reference - Main object this notification is about
    public int? PrimaryObjectTypeId { get; set; }
    public int? PrimaryObjectId { get; set; }

    // Secondary Object Reference - Related object (e.g., user who triggered the action)
    public int? SecondaryObjectTypeId { get; set; }
    public int? SecondaryObjectId { get; set; }

    // Tertiary Object Reference - Additional context object
    public int? TertiaryObjectTypeId { get; set; }
    public int? TertiaryObjectId { get; set; }

    public bool IsRead { get; set; } = false;

    public DateTime? ReadAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    [ForeignKey("UserId")]
    public User? User { get; set; }

    // Navigation properties for object types
    [ForeignKey("PrimaryObjectTypeId")]
    public ObjectType? PrimaryObjectType { get; set; }

    [ForeignKey("SecondaryObjectTypeId")]
    public ObjectType? SecondaryObjectType { get; set; }

    [ForeignKey("TertiaryObjectTypeId")]
    public ObjectType? TertiaryObjectType { get; set; }
}
