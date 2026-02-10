namespace Pickleball.Community.Models.DTOs;

// =====================================================
// Event Type DTOs
// =====================================================

public class NotificationEventTypeDto
{
    public int Id { get; set; }
    public string EventKey { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string> AvailableMergeFields { get; set; } = new();
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public int TemplateCount { get; set; }
    public int ActiveTemplateCount { get; set; }
}

public class NotificationEventTypeDetailDto : NotificationEventTypeDto
{
    public DateTime CreatedAt { get; set; }
    public List<NotificationChannelTemplateDto> Templates { get; set; } = new();
}

public class CreateNotificationEventTypeDto
{
    public string EventKey { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string> AvailableMergeFields { get; set; } = new();
    public int SortOrder { get; set; }
}

// =====================================================
// Template DTOs
// =====================================================

public class NotificationChannelTemplateDto
{
    public int Id { get; set; }
    public int EventTypeId { get; set; }
    public string EventTypeKey { get; set; } = string.Empty;
    public string EventTypeDisplayName { get; set; } = string.Empty;
    public string Channel { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? FXTaskCode { get; set; }
    public string? Subject { get; set; }
    public string Body { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public bool IsTestMode { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class CreateNotificationTemplateDto
{
    public int EventTypeId { get; set; }
    public string Channel { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? FXTaskCode { get; set; }
    public string? Subject { get; set; }
    public string Body { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public bool IsTestMode { get; set; } = true;
}

public class UpdateNotificationTemplateDto
{
    public string? Name { get; set; }
    public string? FXTaskCode { get; set; }
    public string? Subject { get; set; }
    public string? Body { get; set; }
    public bool? IsActive { get; set; }
    public bool? IsTestMode { get; set; }
}

// =====================================================
// Log DTOs
// =====================================================

public class NotificationLogDto
{
    public int Id { get; set; }
    public int? TemplateId { get; set; }
    public string? TemplateName { get; set; }
    public string EventTypeKey { get; set; } = string.Empty;
    public string Channel { get; set; } = string.Empty;
    public int? RecipientUserId { get; set; }
    public string? RecipientName { get; set; }
    public string? RecipientContact { get; set; }
    public string? MergedSubject { get; set; }
    public string? MergedBody { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ErrorMessage { get; set; }
    public string? RelatedObjectType { get; set; }
    public int? RelatedObjectId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class NotificationLogFilterDto
{
    public string? EventTypeKey { get; set; }
    public string? Channel { get; set; }
    public string? Status { get; set; }
    public int? RecipientUserId { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

public class NotificationLogPagedResult
{
    public List<NotificationLogDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
}

// =====================================================
// Send Request DTOs
// =====================================================

public class SendNotificationRequest
{
    /// <summary>
    /// Event type key (e.g., "tournament.registration_confirmed")
    /// </summary>
    public string EventKey { get; set; } = string.Empty;
    
    /// <summary>
    /// Recipient user ID (optional if using direct contact)
    /// </summary>
    public int? UserId { get; set; }
    
    /// <summary>
    /// Direct email address (if no user ID)
    /// </summary>
    public string? Email { get; set; }
    
    /// <summary>
    /// Direct phone number (if no user ID)
    /// </summary>
    public string? Phone { get; set; }
    
    /// <summary>
    /// Context data for template merge fields
    /// </summary>
    public Dictionary<string, object?> Context { get; set; } = new();
    
    /// <summary>
    /// Related object for tracking (optional)
    /// </summary>
    public string? RelatedObjectType { get; set; }
    public int? RelatedObjectId { get; set; }
    
    /// <summary>
    /// Specific channels to send (null = all active)
    /// </summary>
    public List<string>? Channels { get; set; }
}

public class SendNotificationResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public List<NotificationSendDetail> Details { get; set; } = new();
}

public class NotificationSendDetail
{
    public string Channel { get; set; } = string.Empty;
    public string TemplateName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int? LogId { get; set; }
    public string? Error { get; set; }
}

// =====================================================
// Preview DTO
// =====================================================

public class PreviewNotificationRequest
{
    public int TemplateId { get; set; }
    public Dictionary<string, object?> Context { get; set; } = new();
}

public class PreviewNotificationResult
{
    public string? Subject { get; set; }
    public string Body { get; set; } = string.Empty;
    public string Channel { get; set; } = string.Empty;
}
