namespace Pickleball.College.Models.DTOs;

/// <summary>
/// DTO for reading notification templates
/// </summary>
public class NotificationTemplateDto
{
    public int Id { get; set; }
    public string TemplateKey { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = "General";
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public List<string> Placeholders { get; set; } = new();
    public bool IsActive { get; set; }
    public bool IsSystem { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// DTO for creating a new notification template
/// </summary>
public class CreateNotificationTemplateRequest
{
    public string TemplateKey { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = "General";
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public List<string> Placeholders { get; set; } = new();
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// DTO for updating an existing notification template
/// </summary>
public class UpdateNotificationTemplateRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Category { get; set; }
    public string? Subject { get; set; }
    public string? Body { get; set; }
    public List<string>? Placeholders { get; set; }
    public bool? IsActive { get; set; }
}

/// <summary>
/// DTO for previewing a notification template with sample data
/// </summary>
public class PreviewTemplateRequest
{
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public Dictionary<string, string> SampleData { get; set; } = new();
}

/// <summary>
/// Response for template preview
/// </summary>
public class PreviewTemplateResponse
{
    public string RenderedSubject { get; set; } = string.Empty;
    public string RenderedBody { get; set; } = string.Empty;
}

/// <summary>
/// DTO for listing templates grouped by category
/// </summary>
public class NotificationTemplateCategoryGroup
{
    public string Category { get; set; } = string.Empty;
    public List<NotificationTemplateDto> Templates { get; set; } = new();
}
