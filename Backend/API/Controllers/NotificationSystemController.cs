using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Services;
using System.Security.Claims;

namespace Pickleball.Community.Controllers;

/// <summary>
/// Controller for managing the unified notification system
/// </summary>
[ApiController]
[Route("notifications")]
[Authorize]
public class NotificationSystemController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly INotificationDispatchService _dispatchService;
    private readonly ILogger<NotificationSystemController> _logger;

    public NotificationSystemController(
        ApplicationDbContext context,
        INotificationDispatchService dispatchService,
        ILogger<NotificationSystemController> logger)
    {
        _context = context;
        _dispatchService = dispatchService;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : null;
    }

    private bool IsAdmin() => User.IsInRole("Admin");

    // =====================================================
    // Event Types
    // =====================================================

    /// <summary>
    /// Get all notification event types
    /// </summary>
    [HttpGet("event-types")]
    public async Task<ActionResult<List<NotificationEventTypeDto>>> GetEventTypes([FromQuery] string? category = null)
    {
        var query = _context.Set<NotificationEventType>()
            .Include(e => e.Templates)
            .AsQueryable();

        if (!string.IsNullOrEmpty(category))
            query = query.Where(e => e.Category == category);

        var eventTypes = await query
            .OrderBy(e => e.Category)
            .ThenBy(e => e.SortOrder)
            .ThenBy(e => e.DisplayName)
            .Select(e => new NotificationEventTypeDto
            {
                Id = e.Id,
                EventKey = e.EventKey,
                Category = e.Category,
                DisplayName = e.DisplayName,
                Description = e.Description,
                AvailableMergeFields = string.IsNullOrEmpty(e.AvailableMergeFields) 
                    ? new List<string>() 
                    : JsonSerializer.Deserialize<List<string>>(e.AvailableMergeFields) ?? new List<string>(),
                IsActive = e.IsActive,
                SortOrder = e.SortOrder,
                TemplateCount = e.Templates.Count,
                ActiveTemplateCount = e.Templates.Count(t => t.IsActive)
            })
            .ToListAsync();

        return Ok(eventTypes);
    }

    /// <summary>
    /// Get event type details with templates
    /// </summary>
    [HttpGet("event-types/{id}")]
    public async Task<ActionResult<NotificationEventTypeDetailDto>> GetEventType(int id)
    {
        var eventType = await _context.Set<NotificationEventType>()
            .Include(e => e.Templates)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (eventType == null)
            return NotFound("Event type not found");

        var dto = new NotificationEventTypeDetailDto
        {
            Id = eventType.Id,
            EventKey = eventType.EventKey,
            Category = eventType.Category,
            DisplayName = eventType.DisplayName,
            Description = eventType.Description,
            AvailableMergeFields = string.IsNullOrEmpty(eventType.AvailableMergeFields)
                ? new List<string>()
                : JsonSerializer.Deserialize<List<string>>(eventType.AvailableMergeFields) ?? new List<string>(),
            IsActive = eventType.IsActive,
            SortOrder = eventType.SortOrder,
            CreatedAt = eventType.CreatedAt,
            TemplateCount = eventType.Templates.Count,
            ActiveTemplateCount = eventType.Templates.Count(t => t.IsActive),
            Templates = eventType.Templates.Select(t => new NotificationChannelTemplateDto
            {
                Id = t.Id,
                EventTypeId = t.EventTypeId,
                EventTypeKey = eventType.EventKey,
                EventTypeDisplayName = eventType.DisplayName,
                Channel = t.Channel,
                Name = t.Name,
                FXTaskCode = t.FXTaskCode,
                Subject = t.Subject,
                Body = t.Body,
                IsActive = t.IsActive,
                IsTestMode = t.IsTestMode,
                CreatedAt = t.CreatedAt,
                UpdatedAt = t.UpdatedAt
            }).ToList()
        };

        return Ok(dto);
    }

    /// <summary>
    /// Create a new event type (Admin only)
    /// </summary>
    [HttpPost("event-types")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<NotificationEventTypeDto>> CreateEventType([FromBody] CreateNotificationEventTypeDto dto)
    {
        // Check for duplicate key
        if (await _context.Set<NotificationEventType>().AnyAsync(e => e.EventKey == dto.EventKey))
            return BadRequest("Event key already exists");

        var eventType = new NotificationEventType
        {
            EventKey = dto.EventKey,
            Category = dto.Category,
            DisplayName = dto.DisplayName,
            Description = dto.Description,
            AvailableMergeFields = JsonSerializer.Serialize(dto.AvailableMergeFields),
            SortOrder = dto.SortOrder,
            IsActive = true
        };

        _context.Set<NotificationEventType>().Add(eventType);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Created notification event type {EventKey} by user {UserId}", dto.EventKey, GetCurrentUserId());

        return CreatedAtAction(nameof(GetEventType), new { id = eventType.Id }, new NotificationEventTypeDto
        {
            Id = eventType.Id,
            EventKey = eventType.EventKey,
            Category = eventType.Category,
            DisplayName = eventType.DisplayName,
            Description = eventType.Description,
            AvailableMergeFields = dto.AvailableMergeFields,
            IsActive = eventType.IsActive,
            SortOrder = eventType.SortOrder
        });
    }

    /// <summary>
    /// Toggle event type active status (Admin only)
    /// </summary>
    [HttpPost("event-types/{id}/toggle")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ToggleEventType(int id)
    {
        var eventType = await _context.Set<NotificationEventType>().FindAsync(id);
        if (eventType == null)
            return NotFound("Event type not found");

        eventType.IsActive = !eventType.IsActive;
        await _context.SaveChangesAsync();

        return Ok(new { eventType.IsActive });
    }

    // =====================================================
    // Templates
    // =====================================================

    /// <summary>
    /// Get all templates (optionally filtered)
    /// </summary>
    [HttpGet("templates")]
    public async Task<ActionResult<List<NotificationChannelTemplateDto>>> GetTemplates(
        [FromQuery] int? eventTypeId = null,
        [FromQuery] string? channel = null)
    {
        var query = _context.Set<NotificationChannelTemplate>()
            .Include(t => t.EventType)
            .AsQueryable();

        if (eventTypeId.HasValue)
            query = query.Where(t => t.EventTypeId == eventTypeId.Value);
        if (!string.IsNullOrEmpty(channel))
            query = query.Where(t => t.Channel == channel);

        var templates = await query
            .OrderBy(t => t.EventType!.Category)
            .ThenBy(t => t.EventType!.SortOrder)
            .ThenBy(t => t.Channel)
            .Select(t => new NotificationChannelTemplateDto
            {
                Id = t.Id,
                EventTypeId = t.EventTypeId,
                EventTypeKey = t.EventType!.EventKey,
                EventTypeDisplayName = t.EventType.DisplayName,
                Channel = t.Channel,
                Name = t.Name,
                FXTaskCode = t.FXTaskCode,
                Subject = t.Subject,
                Body = t.Body,
                IsActive = t.IsActive,
                IsTestMode = t.IsTestMode,
                CreatedAt = t.CreatedAt,
                UpdatedAt = t.UpdatedAt
            })
            .ToListAsync();

        return Ok(templates);
    }

    /// <summary>
    /// Get a single template
    /// </summary>
    [HttpGet("templates/{id}")]
    public async Task<ActionResult<NotificationChannelTemplateDto>> GetTemplate(int id)
    {
        var template = await _context.Set<NotificationChannelTemplate>()
            .Include(t => t.EventType)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (template == null)
            return NotFound("Template not found");

        return Ok(new NotificationChannelTemplateDto
        {
            Id = template.Id,
            EventTypeId = template.EventTypeId,
            EventTypeKey = template.EventType?.EventKey ?? string.Empty,
            EventTypeDisplayName = template.EventType?.DisplayName ?? string.Empty,
            Channel = template.Channel,
            Name = template.Name,
            FXTaskCode = template.FXTaskCode,
            Subject = template.Subject,
            Body = template.Body,
            IsActive = template.IsActive,
            IsTestMode = template.IsTestMode,
            CreatedAt = template.CreatedAt,
            UpdatedAt = template.UpdatedAt
        });
    }

    /// <summary>
    /// Create a new template
    /// </summary>
    [HttpPost("templates")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<NotificationChannelTemplateDto>> CreateTemplate([FromBody] CreateChannelTemplateDto dto)
    {
        // Validate event type exists
        var eventType = await _context.Set<NotificationEventType>().FindAsync(dto.EventTypeId);
        if (eventType == null)
            return BadRequest("Event type not found");

        var template = new NotificationChannelTemplate
        {
            EventTypeId = dto.EventTypeId,
            Channel = dto.Channel,
            Name = dto.Name,
            FXTaskCode = dto.FXTaskCode,
            Subject = dto.Subject,
            Body = dto.Body,
            IsActive = dto.IsActive,
            IsTestMode = dto.IsTestMode,
            CreatedByUserId = GetCurrentUserId()
        };

        _context.Set<NotificationChannelTemplate>().Add(template);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Created notification template {TemplateName} for {EventKey} by user {UserId}",
            dto.Name, eventType.EventKey, GetCurrentUserId());

        return CreatedAtAction(nameof(GetTemplate), new { id = template.Id }, new NotificationChannelTemplateDto
        {
            Id = template.Id,
            EventTypeId = template.EventTypeId,
            EventTypeKey = eventType.EventKey,
            EventTypeDisplayName = eventType.DisplayName,
            Channel = template.Channel,
            Name = template.Name,
            FXTaskCode = template.FXTaskCode,
            Subject = template.Subject,
            Body = template.Body,
            IsActive = template.IsActive,
            IsTestMode = template.IsTestMode,
            CreatedAt = template.CreatedAt
        });
    }

    /// <summary>
    /// Update a template
    /// </summary>
    [HttpPut("templates/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<NotificationChannelTemplateDto>> UpdateTemplate(int id, [FromBody] UpdateChannelTemplateDto dto)
    {
        var template = await _context.Set<NotificationChannelTemplate>()
            .Include(t => t.EventType)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (template == null)
            return NotFound("Template not found");

        if (dto.Name != null) template.Name = dto.Name;
        if (dto.FXTaskCode != null) template.FXTaskCode = dto.FXTaskCode;
        if (dto.Subject != null) template.Subject = dto.Subject;
        if (dto.Body != null) template.Body = dto.Body;
        if (dto.IsActive.HasValue) template.IsActive = dto.IsActive.Value;
        if (dto.IsTestMode.HasValue) template.IsTestMode = dto.IsTestMode.Value;
        template.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Updated notification template {TemplateId} by user {UserId}", id, GetCurrentUserId());

        return Ok(new NotificationChannelTemplateDto
        {
            Id = template.Id,
            EventTypeId = template.EventTypeId,
            EventTypeKey = template.EventType?.EventKey ?? string.Empty,
            EventTypeDisplayName = template.EventType?.DisplayName ?? string.Empty,
            Channel = template.Channel,
            Name = template.Name,
            FXTaskCode = template.FXTaskCode,
            Subject = template.Subject,
            Body = template.Body,
            IsActive = template.IsActive,
            IsTestMode = template.IsTestMode,
            CreatedAt = template.CreatedAt,
            UpdatedAt = template.UpdatedAt
        });
    }

    /// <summary>
    /// Toggle template test mode
    /// </summary>
    [HttpPost("templates/{id}/toggle-test-mode")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ToggleTestMode(int id)
    {
        var template = await _context.Set<NotificationChannelTemplate>().FindAsync(id);
        if (template == null)
            return NotFound("Template not found");

        template.IsTestMode = !template.IsTestMode;
        template.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Toggled test mode for template {TemplateId} to {IsTestMode} by user {UserId}",
            id, template.IsTestMode, GetCurrentUserId());

        return Ok(new { template.IsTestMode });
    }

    /// <summary>
    /// Toggle template active status
    /// </summary>
    [HttpPost("templates/{id}/toggle-active")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var template = await _context.Set<NotificationChannelTemplate>().FindAsync(id);
        if (template == null)
            return NotFound("Template not found");

        template.IsActive = !template.IsActive;
        template.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { template.IsActive });
    }

    /// <summary>
    /// Delete a template
    /// </summary>
    [HttpDelete("templates/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteTemplate(int id)
    {
        var template = await _context.Set<NotificationChannelTemplate>().FindAsync(id);
        if (template == null)
            return NotFound("Template not found");

        _context.Set<NotificationChannelTemplate>().Remove(template);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Deleted notification template {TemplateId} by user {UserId}", id, GetCurrentUserId());

        return NoContent();
    }

    // =====================================================
    // Preview & Send
    // =====================================================

    /// <summary>
    /// Preview a template with sample data
    /// </summary>
    [HttpPost("templates/{id}/preview")]
    public async Task<ActionResult<PreviewNotificationResult>> PreviewTemplate(int id, [FromBody] Dictionary<string, object?> context)
    {
        var result = await _dispatchService.PreviewAsync(id, context);
        if (result == null)
            return NotFound("Template not found");
        return Ok(result);
    }

    /// <summary>
    /// Send a test notification (Admin only)
    /// </summary>
    [HttpPost("send")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SendNotificationResult>> SendNotification([FromBody] SendNotificationRequest request)
    {
        SendNotificationResult result;

        if (request.UserId.HasValue)
        {
            result = await _dispatchService.SendAsync(
                request.EventKey,
                request.UserId.Value,
                request.Context,
                request.RelatedObjectType,
                request.RelatedObjectId,
                request.Channels);
        }
        else if (!string.IsNullOrEmpty(request.Email) || !string.IsNullOrEmpty(request.Phone))
        {
            result = await _dispatchService.SendDirectAsync(
                request.EventKey,
                request.Email,
                request.Phone,
                request.Context,
                request.RelatedObjectType,
                request.RelatedObjectId);
        }
        else
        {
            return BadRequest("Either UserId or Email/Phone is required");
        }

        return Ok(result);
    }

    // =====================================================
    // Logs
    // =====================================================

    /// <summary>
    /// Get notification logs with filtering
    /// </summary>
    [HttpGet("logs")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<NotificationLogPagedResult>> GetLogs([FromQuery] NotificationLogFilterDto filter)
    {
        var query = _context.Set<NotificationLog>()
            .Include(l => l.Template)
            .Include(l => l.RecipientUser)
            .AsQueryable();

        if (!string.IsNullOrEmpty(filter.EventTypeKey))
            query = query.Where(l => l.EventTypeKey == filter.EventTypeKey);
        if (!string.IsNullOrEmpty(filter.Channel))
            query = query.Where(l => l.Channel == filter.Channel);
        if (!string.IsNullOrEmpty(filter.Status))
            query = query.Where(l => l.Status == filter.Status);
        if (filter.RecipientUserId.HasValue)
            query = query.Where(l => l.RecipientUserId == filter.RecipientUserId);
        if (filter.FromDate.HasValue)
            query = query.Where(l => l.CreatedAt >= filter.FromDate.Value);
        if (filter.ToDate.HasValue)
            query = query.Where(l => l.CreatedAt <= filter.ToDate.Value);

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(l => new NotificationLogDto
            {
                Id = l.Id,
                TemplateId = l.TemplateId,
                TemplateName = l.Template != null ? l.Template.Name : null,
                EventTypeKey = l.EventTypeKey,
                Channel = l.Channel,
                RecipientUserId = l.RecipientUserId,
                RecipientName = l.RecipientUser != null ? $"{l.RecipientUser.FirstName} {l.RecipientUser.LastName}" : null,
                RecipientContact = l.RecipientContact,
                MergedSubject = l.MergedSubject,
                MergedBody = l.MergedBody,
                Status = l.Status,
                ErrorMessage = l.ErrorMessage,
                RelatedObjectType = l.RelatedObjectType,
                RelatedObjectId = l.RelatedObjectId,
                CreatedAt = l.CreatedAt
            })
            .ToListAsync();

        return Ok(new NotificationLogPagedResult
        {
            Items = items,
            TotalCount = totalCount,
            Page = filter.Page,
            PageSize = filter.PageSize
        });
    }

    /// <summary>
    /// Get log details
    /// </summary>
    [HttpGet("logs/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<NotificationLogDto>> GetLog(int id)
    {
        var log = await _context.Set<NotificationLog>()
            .Include(l => l.Template)
            .Include(l => l.RecipientUser)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (log == null)
            return NotFound("Log not found");

        return Ok(new NotificationLogDto
        {
            Id = log.Id,
            TemplateId = log.TemplateId,
            TemplateName = log.Template?.Name,
            EventTypeKey = log.EventTypeKey,
            Channel = log.Channel,
            RecipientUserId = log.RecipientUserId,
            RecipientName = log.RecipientUser != null ? $"{log.RecipientUser.FirstName} {log.RecipientUser.LastName}" : null,
            RecipientContact = log.RecipientContact,
            MergedSubject = log.MergedSubject,
            MergedBody = log.MergedBody,
            Status = log.Status,
            ErrorMessage = log.ErrorMessage,
            RelatedObjectType = log.RelatedObjectType,
            RelatedObjectId = log.RelatedObjectId,
            CreatedAt = log.CreatedAt
        });
    }

    /// <summary>
    /// Get available channels
    /// </summary>
    [HttpGet("channels")]
    public IActionResult GetChannels()
    {
        return Ok(new[]
        {
            new { Value = NotificationChannel.Email, Label = "Email", RequiresFXTaskCode = true },
            new { Value = NotificationChannel.SMS, Label = "SMS", RequiresFXTaskCode = true },
            new { Value = NotificationChannel.Push, Label = "Web Push", RequiresFXTaskCode = false },
            new { Value = NotificationChannel.WhatsApp, Label = "WhatsApp", RequiresFXTaskCode = true }
        });
    }

    /// <summary>
    /// Get categories
    /// </summary>
    [HttpGet("categories")]
    public IActionResult GetCategories()
    {
        return Ok(new[]
        {
            NotificationCategory.System,
            NotificationCategory.Tournament,
            NotificationCategory.League
        });
    }
}
