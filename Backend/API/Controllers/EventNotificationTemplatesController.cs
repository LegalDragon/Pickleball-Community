using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using System.Security.Claims;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class EventNotificationTemplatesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<EventNotificationTemplatesController> _logger;

    public EventNotificationTemplatesController(ApplicationDbContext context, ILogger<EventNotificationTemplatesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private async Task<bool> IsUserAdmin()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return false;
        var user = await _context.Users.FindAsync(userId.Value);
        return user?.Role == "Admin";
    }

    // GET: /eventnotificationtemplates/types - Get all notification types with their placeholders
    [HttpGet("types")]
    public ActionResult<ApiResponse<List<NotificationTypeInfoDto>>> GetNotificationTypes()
    {
        var types = NotificationTypes.All.Select(type => new NotificationTypeInfoDto
        {
            Type = type,
            Description = NotificationTypes.GetDescription(type),
            AvailablePlaceholders = GetPlaceholdersForType(type)
        }).ToList();

        return Ok(new ApiResponse<List<NotificationTypeInfoDto>> { Success = true, Data = types });
    }

    private List<string> GetPlaceholdersForType(string type)
    {
        var common = new List<string> { "{PlayerName}", "{PlayerFirstName}", "{EventName}", "{DivisionName}" };

        return type switch
        {
            NotificationTypes.MatchScheduled => common.Concat(new[] { "{CourtName}", "{CourtNumber}", "{MatchTime}", "{OpponentName}", "{RoundName}" }).ToList(),
            NotificationTypes.MatchStarting => common.Concat(new[] { "{CourtName}", "{CourtNumber}", "{OpponentName}" }).ToList(),
            NotificationTypes.MatchComplete => common.Concat(new[] { "{Score}", "{Unit1Score}", "{Unit2Score}", "{Result}", "{WinnerName}", "{LoserName}" }).ToList(),
            NotificationTypes.ScoreUpdated => common.Concat(new[] { "{Unit1Score}", "{Unit2Score}", "{CourtName}", "{CourtNumber}" }).ToList(),
            NotificationTypes.CheckInReminder => common,
            NotificationTypes.BracketAdvance => common.Concat(new[] { "{RoundName}", "{WinnerName}" }).ToList(),
            _ => common
        };
    }

    // GET: /eventnotificationtemplates - Get all default templates
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<EventNotificationTemplateDto>>>> GetDefaultTemplates()
    {
        try
        {
            var templates = await _context.EventNotificationTemplates
                .Where(t => t.EventId == null)
                .OrderBy(t => t.NotificationType)
                .Select(t => new EventNotificationTemplateDto
                {
                    Id = t.Id,
                    EventId = t.EventId,
                    EventName = null,
                    NotificationType = t.NotificationType,
                    NotificationTypeDescription = NotificationTypes.GetDescription(t.NotificationType),
                    Subject = t.Subject,
                    MessageTemplate = t.MessageTemplate,
                    IsActive = t.IsActive,
                    IsDefault = true,
                    CreatedAt = t.CreatedAt,
                    UpdatedAt = t.UpdatedAt,
                    CreatedByName = t.CreatedBy != null ? $"{t.CreatedBy.FirstName} {t.CreatedBy.LastName}" : null
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<EventNotificationTemplateDto>> { Success = true, Data = templates });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching default templates");
            return StatusCode(500, new ApiResponse<List<EventNotificationTemplateDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /eventnotificationtemplates/event/{eventId} - Get templates for a specific event (includes defaults)
    [HttpGet("event/{eventId}")]
    public async Task<ActionResult<ApiResponse<List<EventNotificationTemplateDto>>>> GetTemplatesForEvent(int eventId)
    {
        try
        {
            var eventEntity = await _context.Events.FindAsync(eventId);
            if (eventEntity == null)
                return NotFound(new ApiResponse<List<EventNotificationTemplateDto>> { Success = false, Message = "Event not found" });

            // Get event-specific templates
            var eventTemplates = await _context.EventNotificationTemplates
                .Where(t => t.EventId == eventId)
                .ToListAsync();

            // Get default templates for types not overridden
            var overriddenTypes = eventTemplates.Select(t => t.NotificationType).ToHashSet();
            var defaultTemplates = await _context.EventNotificationTemplates
                .Where(t => t.EventId == null && !overriddenTypes.Contains(t.NotificationType))
                .ToListAsync();

            var allTemplates = eventTemplates.Concat(defaultTemplates)
                .OrderBy(t => t.NotificationType)
                .Select(t => new EventNotificationTemplateDto
                {
                    Id = t.Id,
                    EventId = t.EventId,
                    EventName = t.EventId == eventId ? eventEntity.Name : null,
                    NotificationType = t.NotificationType,
                    NotificationTypeDescription = NotificationTypes.GetDescription(t.NotificationType),
                    Subject = t.Subject,
                    MessageTemplate = t.MessageTemplate,
                    IsActive = t.IsActive,
                    IsDefault = t.EventId == null,
                    CreatedAt = t.CreatedAt,
                    UpdatedAt = t.UpdatedAt
                })
                .ToList();

            return Ok(new ApiResponse<List<EventNotificationTemplateDto>> { Success = true, Data = allTemplates });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching templates for event {EventId}", eventId);
            return StatusCode(500, new ApiResponse<List<EventNotificationTemplateDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /eventnotificationtemplates - Create a new template (admin only for defaults)
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ApiResponse<EventNotificationTemplateDto>>> CreateTemplate([FromBody] CreateNotificationTemplateDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<EventNotificationTemplateDto> { Success = false, Message = "Not authenticated" });

            // Only admins can create default templates
            if (dto.EventId == null && !await IsUserAdmin())
                return Forbid();

            // Validate notification type
            if (!NotificationTypes.All.Contains(dto.NotificationType))
                return BadRequest(new ApiResponse<EventNotificationTemplateDto> { Success = false, Message = "Invalid notification type" });

            // Check if template already exists for this event/type combination
            var exists = await _context.EventNotificationTemplates
                .AnyAsync(t => t.EventId == dto.EventId && t.NotificationType == dto.NotificationType);
            if (exists)
                return BadRequest(new ApiResponse<EventNotificationTemplateDto> { Success = false, Message = "A template for this type already exists" });

            var template = new EventNotificationTemplate
            {
                EventId = dto.EventId,
                NotificationType = dto.NotificationType,
                Subject = dto.Subject,
                MessageTemplate = dto.MessageTemplate,
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = userId.Value
            };

            _context.EventNotificationTemplates.Add(template);
            await _context.SaveChangesAsync();

            var user = await _context.Users.FindAsync(userId.Value);
            var eventEntity = dto.EventId.HasValue ? await _context.Events.FindAsync(dto.EventId.Value) : null;

            return Ok(new ApiResponse<EventNotificationTemplateDto>
            {
                Success = true,
                Data = new EventNotificationTemplateDto
                {
                    Id = template.Id,
                    EventId = template.EventId,
                    EventName = eventEntity?.Name,
                    NotificationType = template.NotificationType,
                    NotificationTypeDescription = NotificationTypes.GetDescription(template.NotificationType),
                    Subject = template.Subject,
                    MessageTemplate = template.MessageTemplate,
                    IsActive = template.IsActive,
                    IsDefault = template.EventId == null,
                    CreatedAt = template.CreatedAt,
                    CreatedByName = user != null ? $"{user.FirstName} {user.LastName}" : null
                },
                Message = "Template created successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating notification template");
            return StatusCode(500, new ApiResponse<EventNotificationTemplateDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /eventnotificationtemplates/{id} - Update a template
    [HttpPut("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<EventNotificationTemplateDto>>> UpdateTemplate(int id, [FromBody] UpdateNotificationTemplateDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<EventNotificationTemplateDto> { Success = false, Message = "Not authenticated" });

            var template = await _context.EventNotificationTemplates
                .Include(t => t.CreatedBy)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (template == null)
                return NotFound(new ApiResponse<EventNotificationTemplateDto> { Success = false, Message = "Template not found" });

            // Only admins can update default templates
            if (template.EventId == null && !await IsUserAdmin())
                return Forbid();

            // Update fields
            if (!string.IsNullOrWhiteSpace(dto.Subject)) template.Subject = dto.Subject;
            if (!string.IsNullOrWhiteSpace(dto.MessageTemplate)) template.MessageTemplate = dto.MessageTemplate;
            if (dto.IsActive.HasValue) template.IsActive = dto.IsActive.Value;

            template.UpdatedAt = DateTime.UtcNow;
            template.UpdatedByUserId = userId.Value;

            await _context.SaveChangesAsync();

            var eventEntity = template.EventId.HasValue ? await _context.Events.FindAsync(template.EventId.Value) : null;

            return Ok(new ApiResponse<EventNotificationTemplateDto>
            {
                Success = true,
                Data = new EventNotificationTemplateDto
                {
                    Id = template.Id,
                    EventId = template.EventId,
                    EventName = eventEntity?.Name,
                    NotificationType = template.NotificationType,
                    NotificationTypeDescription = NotificationTypes.GetDescription(template.NotificationType),
                    Subject = template.Subject,
                    MessageTemplate = template.MessageTemplate,
                    IsActive = template.IsActive,
                    IsDefault = template.EventId == null,
                    CreatedAt = template.CreatedAt,
                    UpdatedAt = template.UpdatedAt,
                    CreatedByName = template.CreatedBy != null ? $"{template.CreatedBy.FirstName} {template.CreatedBy.LastName}" : null
                },
                Message = "Template updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating notification template {TemplateId}", id);
            return StatusCode(500, new ApiResponse<EventNotificationTemplateDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /eventnotificationtemplates/{id} - Delete a template (event-specific only, not defaults)
    [HttpDelete("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteTemplate(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Not authenticated" });

            var template = await _context.EventNotificationTemplates.FindAsync(id);
            if (template == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Template not found" });

            // Cannot delete default templates
            if (template.EventId == null)
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot delete default templates. Disable them instead." });

            _context.EventNotificationTemplates.Remove(template);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Template deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting notification template {TemplateId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /eventnotificationtemplates/preview - Preview a notification with sample data
    [HttpPost("preview")]
    [Authorize]
    public ActionResult<ApiResponse<NotificationPreviewDto>> PreviewNotification([FromBody] PreviewNotificationRequest request)
    {
        try
        {
            // Sample data for preview
            var sampleData = new Dictionary<string, string>
            {
                { "{PlayerName}", "John Smith" },
                { "{PlayerFirstName}", "John" },
                { "{OpponentName}", "Jane Doe / Mike Johnson" },
                { "{CourtName}", "Court 3" },
                { "{CourtNumber}", "3" },
                { "{MatchTime}", DateTime.Now.AddMinutes(15).ToString("h:mm tt") },
                { "{EventName}", "Summer Tournament 2024" },
                { "{DivisionName}", "Men's Doubles 4.0+" },
                { "{RoundName}", "Quarter Finals" },
                { "{Score}", "11-7, 9-11, 11-8" },
                { "{Unit1Score}", "2" },
                { "{Unit2Score}", "1" },
                { "{Result}", "Won" },
                { "{WinnerName}", "John Smith" },
                { "{LoserName}", "Jane Doe" }
            };

            var subject = ReplacePlaceholders(request.Subject, sampleData);
            var message = ReplacePlaceholders(request.MessageTemplate, sampleData);

            return Ok(new ApiResponse<NotificationPreviewDto>
            {
                Success = true,
                Data = new NotificationPreviewDto
                {
                    Subject = subject,
                    Message = message
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating notification preview");
            return StatusCode(500, new ApiResponse<NotificationPreviewDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /eventnotificationtemplates/event/{eventId}/copy-defaults - Copy default templates to event for customization
    [HttpPost("event/{eventId}/copy-defaults")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<EventNotificationTemplateDto>>>> CopyDefaultsToEvent(int eventId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<EventNotificationTemplateDto>> { Success = false, Message = "Not authenticated" });

            var eventEntity = await _context.Events.FindAsync(eventId);
            if (eventEntity == null)
                return NotFound(new ApiResponse<List<EventNotificationTemplateDto>> { Success = false, Message = "Event not found" });

            // Get existing event templates
            var existingTypes = await _context.EventNotificationTemplates
                .Where(t => t.EventId == eventId)
                .Select(t => t.NotificationType)
                .ToListAsync();

            // Get default templates that aren't already overridden
            var defaultTemplates = await _context.EventNotificationTemplates
                .Where(t => t.EventId == null && !existingTypes.Contains(t.NotificationType))
                .ToListAsync();

            var newTemplates = new List<EventNotificationTemplate>();
            foreach (var defaultTemplate in defaultTemplates)
            {
                newTemplates.Add(new EventNotificationTemplate
                {
                    EventId = eventId,
                    NotificationType = defaultTemplate.NotificationType,
                    Subject = defaultTemplate.Subject,
                    MessageTemplate = defaultTemplate.MessageTemplate,
                    IsActive = defaultTemplate.IsActive,
                    CreatedAt = DateTime.UtcNow,
                    CreatedByUserId = userId.Value
                });
            }

            _context.EventNotificationTemplates.AddRange(newTemplates);
            await _context.SaveChangesAsync();

            var result = newTemplates.Select(t => new EventNotificationTemplateDto
            {
                Id = t.Id,
                EventId = t.EventId,
                EventName = eventEntity.Name,
                NotificationType = t.NotificationType,
                NotificationTypeDescription = NotificationTypes.GetDescription(t.NotificationType),
                Subject = t.Subject,
                MessageTemplate = t.MessageTemplate,
                IsActive = t.IsActive,
                IsDefault = false,
                CreatedAt = t.CreatedAt
            }).ToList();

            return Ok(new ApiResponse<List<EventNotificationTemplateDto>>
            {
                Success = true,
                Data = result,
                Message = $"Copied {result.Count} templates to event"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error copying default templates to event {EventId}", eventId);
            return StatusCode(500, new ApiResponse<List<EventNotificationTemplateDto>> { Success = false, Message = "An error occurred" });
        }
    }

    private string ReplacePlaceholders(string template, Dictionary<string, string> data)
    {
        var result = template;
        foreach (var kvp in data)
        {
            result = result.Replace(kvp.Key, kvp.Value);
        }
        return result;
    }
}
