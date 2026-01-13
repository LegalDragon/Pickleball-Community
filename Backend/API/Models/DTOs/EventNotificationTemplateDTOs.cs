namespace Pickleball.Community.Models.DTOs;

// Response DTO for notification templates
public class EventNotificationTemplateDto
{
    public int Id { get; set; }
    public int? EventId { get; set; }
    public string? EventName { get; set; }
    public string NotificationType { get; set; } = string.Empty;
    public string NotificationTypeDescription { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string MessageTemplate { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public bool IsDefault { get; set; } // True if EventId is null
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? CreatedByName { get; set; }
}

// DTO for creating a new notification template
public class CreateNotificationTemplateDto
{
    public int? EventId { get; set; }
    public string NotificationType { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string MessageTemplate { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

// DTO for updating a notification template
public class UpdateNotificationTemplateDto
{
    public string? Subject { get; set; }
    public string? MessageTemplate { get; set; }
    public bool? IsActive { get; set; }
}

// DTO for notification type info
public class NotificationTypeInfoDto
{
    public string Type { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> AvailablePlaceholders { get; set; } = new();
}

// DTO for sending a notification preview
public class NotificationPreviewDto
{
    public string Subject { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

// DTO for requesting a notification preview
public class PreviewNotificationRequest
{
    public string Subject { get; set; } = string.Empty;
    public string MessageTemplate { get; set; } = string.Empty;
    public string NotificationType { get; set; } = string.Empty;
}
