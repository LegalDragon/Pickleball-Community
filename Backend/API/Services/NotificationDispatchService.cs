using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Services;

public interface INotificationDispatchService
{
    /// <summary>
    /// Send notifications for an event to a user
    /// </summary>
    Task<DispatchNotificationResult> SendAsync(string eventKey, int userId, Dictionary<string, object?> context, 
        string? relatedObjectType = null, int? relatedObjectId = null, List<string>? channels = null);
    
    /// <summary>
    /// Send notifications for an event to a direct contact (no user record)
    /// </summary>
    Task<DispatchNotificationResult> SendDirectAsync(string eventKey, string? email, string? phone, 
        Dictionary<string, object?> context, string? relatedObjectType = null, int? relatedObjectId = null);
    
    /// <summary>
    /// Preview a template with sample data
    /// </summary>
    Task<PreviewNotificationResult?> PreviewAsync(int templateId, Dictionary<string, object?> context);
}

public class NotificationDispatchService : INotificationDispatchService
{
    private readonly ApplicationDbContext _context;
    private readonly IPushNotificationService _pushService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<NotificationDispatchService> _logger;

    public NotificationDispatchService(
        ApplicationDbContext context,
        IPushNotificationService pushService,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<NotificationDispatchService> logger)
    {
        _context = context;
        _pushService = pushService;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<DispatchNotificationResult> SendAsync(string eventKey, int userId, Dictionary<string, object?> context,
        string? relatedObjectType = null, int? relatedObjectId = null, List<string>? channels = null)
    {
        var result = new DispatchNotificationResult { Success = true };
        
        // Get user
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            result.Success = false;
            result.Message = "User not found";
            return result;
        }

        // Get active templates for this event
        var templates = await GetActiveTemplates(eventKey, channels);
        if (!templates.Any())
        {
            result.Message = "No active templates found for this event";
            return result;
        }

        // Add user info to context
        context["userName"] = $"{user.FirstName} {user.LastName}".Trim();
        context["userEmail"] = user.Email;
        context["firstName"] = user.FirstName;
        context["lastName"] = user.LastName;

        // Process each template
        foreach (var template in templates)
        {
            var detail = await ProcessTemplate(template, user.Id, user.Email, null, context, relatedObjectType, relatedObjectId);
            result.Details.Add(detail);
            
            if (detail.Status == NotificationStatus.Failed)
            {
                result.Success = false;
            }
        }

        result.Message = $"Processed {result.Details.Count} notification(s)";
        return result;
    }

    public async Task<DispatchNotificationResult> SendDirectAsync(string eventKey, string? email, string? phone,
        Dictionary<string, object?> context, string? relatedObjectType = null, int? relatedObjectId = null)
    {
        var result = new DispatchNotificationResult { Success = true };
        
        if (string.IsNullOrEmpty(email) && string.IsNullOrEmpty(phone))
        {
            result.Success = false;
            result.Message = "Email or phone required";
            return result;
        }

        // Get active templates
        var templates = await GetActiveTemplates(eventKey, null);
        if (!templates.Any())
        {
            result.Message = "No active templates found for this event";
            return result;
        }

        // Filter templates by available contact info
        var applicableTemplates = templates.Where(t =>
            (t.Channel == NotificationChannel.Email && !string.IsNullOrEmpty(email)) ||
            (t.Channel == NotificationChannel.SMS && !string.IsNullOrEmpty(phone)) ||
            (t.Channel == NotificationChannel.WhatsApp && !string.IsNullOrEmpty(phone))
        ).ToList();

        foreach (var template in applicableTemplates)
        {
            var contact = template.Channel == NotificationChannel.Email ? email : phone;
            var detail = await ProcessTemplate(template, null, contact, contact, context, relatedObjectType, relatedObjectId);
            result.Details.Add(detail);
            
            if (detail.Status == NotificationStatus.Failed)
            {
                result.Success = false;
            }
        }

        result.Message = $"Processed {result.Details.Count} notification(s)";
        return result;
    }

    public async Task<PreviewNotificationResult?> PreviewAsync(int templateId, Dictionary<string, object?> context)
    {
        var template = await _context.Set<NotificationChannelTemplate>()
            .FirstOrDefaultAsync(t => t.Id == templateId);
            
        if (template == null) return null;

        return new PreviewNotificationResult
        {
            Subject = MergeTemplate(template.Subject, context),
            Body = MergeTemplate(template.Body, context) ?? string.Empty,
            Channel = template.Channel
        };
    }

    private async Task<List<NotificationChannelTemplate>> GetActiveTemplates(string eventKey, List<string>? channels)
    {
        var query = _context.Set<NotificationChannelTemplate>()
            .Include(t => t.EventType)
            .Where(t => t.EventType != null && t.EventType.EventKey == eventKey)
            .Where(t => t.IsActive && t.EventType!.IsActive);

        if (channels != null && channels.Any())
        {
            query = query.Where(t => channels.Contains(t.Channel));
        }

        return await query.ToListAsync();
    }

    private async Task<NotificationSendDetail> ProcessTemplate(
        NotificationChannelTemplate template,
        int? userId,
        string? email,
        string? phone,
        Dictionary<string, object?> context,
        string? relatedObjectType,
        int? relatedObjectId)
    {
        var detail = new NotificationSendDetail
        {
            Channel = template.Channel,
            TemplateName = template.Name
        };

        var mergedSubject = MergeTemplate(template.Subject, context);
        var mergedBody = MergeTemplate(template.Body, context) ?? string.Empty;
        var contact = template.Channel == NotificationChannel.Email ? email : phone;

        // Create log entry
        var log = new NotificationLog
        {
            TemplateId = template.Id,
            EventTypeKey = template.EventType?.EventKey ?? "unknown",
            Channel = template.Channel,
            RecipientUserId = userId,
            RecipientContact = contact,
            MergedSubject = mergedSubject,
            MergedBody = mergedBody,
            ContextJson = JsonSerializer.Serialize(context),
            RelatedObjectType = relatedObjectType,
            RelatedObjectId = relatedObjectId,
            Status = NotificationStatus.Test
        };

        try
        {
            if (template.IsTestMode)
            {
                // Test mode: log only
                log.Status = NotificationStatus.Test;
                detail.Status = NotificationStatus.Test;
                _logger.LogInformation("TEST MODE: Would send {Channel} notification to {Contact}: {Subject}", 
                    template.Channel, contact, mergedSubject);
            }
            else
            {
                // Live mode: actually send
                switch (template.Channel)
                {
                    case NotificationChannel.Push:
                        if (userId.HasValue)
                        {
                            await SendPushNotification(userId.Value, mergedSubject ?? "Notification", mergedBody);
                            log.Status = NotificationStatus.Sent;
                            detail.Status = NotificationStatus.Sent;
                        }
                        else
                        {
                            log.Status = NotificationStatus.Failed;
                            log.ErrorMessage = "Push notifications require a user ID";
                            detail.Status = NotificationStatus.Failed;
                            detail.Error = log.ErrorMessage;
                        }
                        break;

                    case NotificationChannel.Email:
                    case NotificationChannel.SMS:
                    case NotificationChannel.WhatsApp:
                        if (!string.IsNullOrEmpty(template.FXTaskCode))
                        {
                            var fxResult = await SendViaFXNotification(template.FXTaskCode, contact!, mergedSubject, mergedBody);
                            log.Status = fxResult.Success ? NotificationStatus.Queued : NotificationStatus.Failed;
                            log.FXNotificationId = fxResult.NotificationId;
                            log.ErrorMessage = fxResult.Error;
                            detail.Status = log.Status;
                            detail.Error = fxResult.Error;
                        }
                        else
                        {
                            log.Status = NotificationStatus.Failed;
                            log.ErrorMessage = $"No FXTaskCode configured for {template.Channel} template";
                            detail.Status = NotificationStatus.Failed;
                            detail.Error = log.ErrorMessage;
                        }
                        break;

                    default:
                        log.Status = NotificationStatus.Failed;
                        log.ErrorMessage = $"Unknown channel: {template.Channel}";
                        detail.Status = NotificationStatus.Failed;
                        detail.Error = log.ErrorMessage;
                        break;
                }
            }
        }
        catch (Exception ex)
        {
            log.Status = NotificationStatus.Failed;
            log.ErrorMessage = ex.Message;
            detail.Status = NotificationStatus.Failed;
            detail.Error = ex.Message;
            _logger.LogError(ex, "Error processing notification template {TemplateId}", template.Id);
        }

        // Save log
        _context.Set<NotificationLog>().Add(log);
        await _context.SaveChangesAsync();
        detail.LogId = log.Id;

        return detail;
    }

    private string? MergeTemplate(string? template, Dictionary<string, object?> context)
    {
        if (string.IsNullOrEmpty(template)) return template;

        // Replace {{fieldName}} with values from context
        return Regex.Replace(template, @"\{\{(\w+)\}\}", match =>
        {
            var fieldName = match.Groups[1].Value;
            if (context.TryGetValue(fieldName, out var value))
            {
                return value?.ToString() ?? string.Empty;
            }
            return match.Value; // Keep original if not found
        });
    }

    private async Task SendPushNotification(int userId, string title, string body)
    {
        await _pushService.SendToUserAsync(userId, title, body, null, null);
    }

    private async Task<FXNotificationResult> SendViaFXNotification(string taskCode, string to, string? subject, string body)
    {
        var result = new FXNotificationResult();

        try
        {
            var fxBaseUrl = _configuration["FXNotification:BaseUrl"];
            var fxApiKey = _configuration["FXNotification:ApiKey"];

            if (string.IsNullOrEmpty(fxBaseUrl) || string.IsNullOrEmpty(fxApiKey))
            {
                result.Error = "FXNotification not configured";
                return result;
            }

            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("X-API-Key", fxApiKey);

            var payload = new
            {
                TaskCode = taskCode,
                To = to,
                Subject = subject,
                BodyHtml = body
            };

            var response = await client.PostAsJsonAsync($"{fxBaseUrl}/api/notifications/queue", payload);
            
            if (response.IsSuccessStatusCode)
            {
                var responseBody = await response.Content.ReadFromJsonAsync<FXNotificationResponse>();
                result.Success = true;
                result.NotificationId = responseBody?.Id?.ToString();
            }
            else
            {
                result.Error = $"FXNotification returned {response.StatusCode}";
            }
        }
        catch (Exception ex)
        {
            result.Error = ex.Message;
            _logger.LogError(ex, "Error sending via FXNotification");
        }

        return result;
    }

    private class FXNotificationResult
    {
        public bool Success { get; set; }
        public string? NotificationId { get; set; }
        public string? Error { get; set; }
    }

    private class FXNotificationResponse
    {
        public int? Id { get; set; }
    }
}
