using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class VideoRoom
{
    [Key]
    public int RoomId { get; set; }

    /// <summary>
    /// Unique short code for shareable links (e.g., abc123)
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string RoomCode { get; set; } = string.Empty;

    /// <summary>
    /// Display name for the room
    /// </summary>
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// SHA256 hash of the passcode
    /// </summary>
    [Required]
    [MaxLength(128)]
    public string PasscodeHash { get; set; } = string.Empty;

    /// <summary>
    /// User ID of the room creator (nullable for guest-created scenarios)
    /// </summary>
    public int? CreatedBy { get; set; }

    /// <summary>
    /// Display name of the creator
    /// </summary>
    [MaxLength(200)]
    public string? CreatorName { get; set; }

    /// <summary>
    /// Maximum number of participants (0 = unlimited)
    /// </summary>
    public int MaxParticipants { get; set; } = 6;

    /// <summary>
    /// Whether the room is currently active/joinable
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Whether the room is locked (no new participants can join)
    /// </summary>
    public bool IsLocked { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? EndedAt { get; set; }

    /// <summary>
    /// Optional club association for persistent club rooms
    /// </summary>
    public int? ClubId { get; set; }

    /// <summary>
    /// Whether this is a persistent club room (doesn't auto-expire)
    /// </summary>
    public bool IsClubRoom { get; set; } = false;

    // Navigation
    [ForeignKey("CreatedBy")]
    public virtual User? Creator { get; set; }

    [ForeignKey("ClubId")]
    public virtual Club? Club { get; set; }
}
