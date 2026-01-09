using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Stores Web Push notification subscriptions for users.
/// Each user can have multiple subscriptions (one per device/browser).
/// </summary>
public class UserPushSubscription
{
    public int Id { get; set; }

    [Required]
    public int UserId { get; set; }

    /// <summary>
    /// The push service endpoint URL (unique per subscription)
    /// </summary>
    [Required]
    [MaxLength(500)]
    public string Endpoint { get; set; } = string.Empty;

    /// <summary>
    /// The P256DH key for message encryption
    /// </summary>
    [Required]
    [MaxLength(500)]
    public string P256dh { get; set; } = string.Empty;

    /// <summary>
    /// The Auth secret for message encryption
    /// </summary>
    [Required]
    [MaxLength(500)]
    public string Auth { get; set; } = string.Empty;

    /// <summary>
    /// Optional: User agent string to identify the device/browser
    /// </summary>
    [MaxLength(500)]
    public string? UserAgent { get; set; }

    /// <summary>
    /// Optional: Friendly name for the device (e.g., "My iPhone", "Work Laptop")
    /// </summary>
    [MaxLength(100)]
    public string? DeviceName { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    /// <summary>
    /// Last time a push notification was successfully sent to this subscription
    /// </summary>
    public DateTime? LastUsedAt { get; set; }

    /// <summary>
    /// Whether this subscription is still active
    /// Set to false when push service returns a 410 Gone status
    /// </summary>
    public bool IsActive { get; set; } = true;

    [ForeignKey("UserId")]
    public User? User { get; set; }
}
