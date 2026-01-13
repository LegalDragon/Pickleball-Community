namespace Pickleball.College.Models.Entities;

/// <summary>
/// Represents a notification message template that admins can customize
/// </summary>
public class NotificationTemplate
{
    public int Id { get; set; }

    /// <summary>
    /// Unique key identifier for the template (e.g., "welcome_email", "password_reset")
    /// </summary>
    public string TemplateKey { get; set; } = string.Empty;

    /// <summary>
    /// Display name for the template
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Description of when this template is used
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Category for grouping templates (e.g., "Account", "Sessions", "Purchases")
    /// </summary>
    public string Category { get; set; } = "General";

    /// <summary>
    /// Subject line of the notification (supports placeholders)
    /// </summary>
    public string Subject { get; set; } = string.Empty;

    /// <summary>
    /// Body content of the notification (supports placeholders and basic Handlebars syntax)
    /// </summary>
    public string Body { get; set; } = string.Empty;

    /// <summary>
    /// JSON array of available placeholder names for this template
    /// </summary>
    public string? Placeholders { get; set; }

    /// <summary>
    /// Whether this template is active and can be used
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Whether this is a system template (cannot be deleted, only edited)
    /// </summary>
    public bool IsSystem { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    // Navigation properties
    public User? CreatedByUser { get; set; }
    public User? UpdatedByUser { get; set; }
}
