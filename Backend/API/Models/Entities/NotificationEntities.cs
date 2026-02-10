using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Global notification event types (e.g., user.registered, tournament.payment_received)
/// Admin-defined, applies to all tournaments and system events
/// </summary>
public class NotificationEventType
{
    public int Id { get; set; }
    
    [Required, MaxLength(100)]
    public string EventKey { get; set; } = string.Empty;
    
    [Required, MaxLength(50)]
    public string Category { get; set; } = string.Empty; // System, Tournament, League
    
    [Required, MaxLength(200)]
    public string DisplayName { get; set; } = string.Empty;
    
    [MaxLength(500)]
    public string? Description { get; set; }
    
    /// <summary>
    /// JSON array of available merge field names for this event type
    /// </summary>
    public string? AvailableMergeFields { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    public int SortOrder { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation
    public ICollection<NotificationChannelTemplate> Templates { get; set; } = new List<NotificationChannelTemplate>();
}

/// <summary>
/// Template for a specific channel (Email, SMS, Push) linked to an event type
/// </summary>
public class NotificationChannelTemplate
{
    public int Id { get; set; }
    
    public int EventTypeId { get; set; }
    
    [Required, MaxLength(50)]
    public string Channel { get; set; } = string.Empty; // Email, SMS, Push, WhatsApp
    
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    
    /// <summary>
    /// FXNotification TaskCode for Email/SMS delivery
    /// </summary>
    [MaxLength(50)]
    public string? FXTaskCode { get; set; }
    
    /// <summary>
    /// Subject line for email/push title
    /// </summary>
    [MaxLength(500)]
    public string? Subject { get; set; }
    
    /// <summary>
    /// Template body with {{mergeFields}}
    /// </summary>
    [Required]
    public string Body { get; set; } = string.Empty;
    
    public bool IsActive { get; set; } = true;
    
    /// <summary>
    /// When true, notifications are logged but not actually sent
    /// </summary>
    public bool IsTestMode { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    public int? CreatedByUserId { get; set; }
    
    // Navigation
    [ForeignKey("EventTypeId")]
    public NotificationEventType? EventType { get; set; }
    
    [ForeignKey("CreatedByUserId")]
    public User? CreatedBy { get; set; }
}

/// <summary>
/// Audit log for all notification sends (test and live)
/// </summary>
public class NotificationLog
{
    public int Id { get; set; }
    
    public int? TemplateId { get; set; }
    
    [Required, MaxLength(100)]
    public string EventTypeKey { get; set; } = string.Empty;
    
    [Required, MaxLength(50)]
    public string Channel { get; set; } = string.Empty;
    
    public int? RecipientUserId { get; set; }
    
    [MaxLength(255)]
    public string? RecipientContact { get; set; } // email or phone
    
    [MaxLength(500)]
    public string? MergedSubject { get; set; }
    
    public string? MergedBody { get; set; }
    
    /// <summary>
    /// Original context data as JSON
    /// </summary>
    public string? ContextJson { get; set; }
    
    [Required, MaxLength(50)]
    public string Status { get; set; } = "Test"; // Test, Queued, Sent, Failed
    
    /// <summary>
    /// Tracking ID from FXNotification (for email/SMS)
    /// </summary>
    [MaxLength(100)]
    public string? FXNotificationId { get; set; }
    
    public string? ErrorMessage { get; set; }
    
    /// <summary>
    /// Related object type for context (Event, Division, User, etc.)
    /// </summary>
    [MaxLength(50)]
    public string? RelatedObjectType { get; set; }
    
    public int? RelatedObjectId { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation
    [ForeignKey("TemplateId")]
    public NotificationChannelTemplate? Template { get; set; }
    
    [ForeignKey("RecipientUserId")]
    public User? RecipientUser { get; set; }
}

/// <summary>
/// Notification channel types
/// </summary>
public static class NotificationChannel
{
    public const string Email = "Email";
    public const string SMS = "SMS";
    public const string Push = "Push";
    public const string WhatsApp = "WhatsApp";
}

/// <summary>
/// Notification status values
/// </summary>
public static class NotificationStatus
{
    public const string Test = "Test";
    public const string Queued = "Queued";
    public const string Sent = "Sent";
    public const string Failed = "Failed";
}

/// <summary>
/// Event categories
/// </summary>
public static class NotificationCategory
{
    public const string System = "System";
    public const string Tournament = "Tournament";
    public const string League = "League";
}
