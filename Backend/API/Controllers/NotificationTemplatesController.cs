using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using Pickleball.College.Database;
using Pickleball.College.Models.Entities;
using Pickleball.College.Models.DTOs;

namespace Pickleball.College.API.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize(Roles = "Admin")]
public class NotificationTemplatesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<NotificationTemplatesController> _logger;

    public NotificationTemplatesController(
        ApplicationDbContext context,
        ILogger<NotificationTemplatesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    /// <summary>
    /// Get all notification templates
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<NotificationTemplateDto>>>> GetTemplates(
        [FromQuery] bool activeOnly = false,
        [FromQuery] string? category = null)
    {
        try
        {
            var query = _context.NotificationTemplates.AsQueryable();

            if (activeOnly)
                query = query.Where(t => t.IsActive);

            if (!string.IsNullOrEmpty(category))
                query = query.Where(t => t.Category == category);

            var templates = await query
                .OrderBy(t => t.Category)
                .ThenBy(t => t.Name)
                .Select(t => MapToDto(t))
                .ToListAsync();

            return Ok(new ApiResponse<List<NotificationTemplateDto>>
            {
                Success = true,
                Data = templates
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching notification templates");
            return StatusCode(500, new ApiResponse<List<NotificationTemplateDto>>
            {
                Success = false,
                Message = "An error occurred while fetching templates"
            });
        }
    }

    /// <summary>
    /// Get templates grouped by category
    /// </summary>
    [HttpGet("grouped")]
    public async Task<ActionResult<ApiResponse<List<NotificationTemplateCategoryGroup>>>> GetTemplatesGrouped(
        [FromQuery] bool activeOnly = false)
    {
        try
        {
            var query = _context.NotificationTemplates.AsQueryable();

            if (activeOnly)
                query = query.Where(t => t.IsActive);

            var templates = await query
                .OrderBy(t => t.Category)
                .ThenBy(t => t.Name)
                .ToListAsync();

            var grouped = templates
                .GroupBy(t => t.Category)
                .Select(g => new NotificationTemplateCategoryGroup
                {
                    Category = g.Key,
                    Templates = g.Select(t => MapToDto(t)).ToList()
                })
                .ToList();

            return Ok(new ApiResponse<List<NotificationTemplateCategoryGroup>>
            {
                Success = true,
                Data = grouped
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching grouped notification templates");
            return StatusCode(500, new ApiResponse<List<NotificationTemplateCategoryGroup>>
            {
                Success = false,
                Message = "An error occurred while fetching templates"
            });
        }
    }

    /// <summary>
    /// Get all available categories
    /// </summary>
    [HttpGet("categories")]
    public async Task<ActionResult<ApiResponse<List<string>>>> GetCategories()
    {
        try
        {
            var categories = await _context.NotificationTemplates
                .Select(t => t.Category)
                .Distinct()
                .OrderBy(c => c)
                .ToListAsync();

            return Ok(new ApiResponse<List<string>>
            {
                Success = true,
                Data = categories
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching categories");
            return StatusCode(500, new ApiResponse<List<string>>
            {
                Success = false,
                Message = "An error occurred while fetching categories"
            });
        }
    }

    /// <summary>
    /// Get a single template by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<NotificationTemplateDto>>> GetTemplate(int id)
    {
        try
        {
            var template = await _context.NotificationTemplates.FindAsync(id);

            if (template == null)
            {
                return NotFound(new ApiResponse<NotificationTemplateDto>
                {
                    Success = false,
                    Message = "Template not found"
                });
            }

            return Ok(new ApiResponse<NotificationTemplateDto>
            {
                Success = true,
                Data = MapToDto(template)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching template {Id}", id);
            return StatusCode(500, new ApiResponse<NotificationTemplateDto>
            {
                Success = false,
                Message = "An error occurred while fetching template"
            });
        }
    }

    /// <summary>
    /// Get a template by its unique key
    /// </summary>
    [HttpGet("key/{templateKey}")]
    public async Task<ActionResult<ApiResponse<NotificationTemplateDto>>> GetTemplateByKey(string templateKey)
    {
        try
        {
            var template = await _context.NotificationTemplates
                .FirstOrDefaultAsync(t => t.TemplateKey == templateKey);

            if (template == null)
            {
                return NotFound(new ApiResponse<NotificationTemplateDto>
                {
                    Success = false,
                    Message = "Template not found"
                });
            }

            return Ok(new ApiResponse<NotificationTemplateDto>
            {
                Success = true,
                Data = MapToDto(template)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching template by key {Key}", templateKey);
            return StatusCode(500, new ApiResponse<NotificationTemplateDto>
            {
                Success = false,
                Message = "An error occurred while fetching template"
            });
        }
    }

    /// <summary>
    /// Create a new notification template
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<NotificationTemplateDto>>> CreateTemplate(
        [FromBody] CreateNotificationTemplateRequest request)
    {
        try
        {
            // Check if template key already exists
            var existingTemplate = await _context.NotificationTemplates
                .FirstOrDefaultAsync(t => t.TemplateKey == request.TemplateKey);

            if (existingTemplate != null)
            {
                return BadRequest(new ApiResponse<NotificationTemplateDto>
                {
                    Success = false,
                    Message = "A template with this key already exists"
                });
            }

            var currentUserId = GetCurrentUserId();

            var template = new NotificationTemplate
            {
                TemplateKey = request.TemplateKey,
                Name = request.Name,
                Description = request.Description,
                Category = request.Category,
                Subject = request.Subject,
                Body = request.Body,
                Placeholders = JsonSerializer.Serialize(request.Placeholders),
                IsActive = request.IsActive,
                IsSystem = false,
                CreatedByUserId = currentUserId,
                UpdatedByUserId = currentUserId
            };

            _context.NotificationTemplates.Add(template);
            await _context.SaveChangesAsync();

            // Log activity
            if (currentUserId.HasValue)
            {
                var log = new ActivityLog
                {
                    UserId = currentUserId.Value,
                    ActivityType = "NotificationTemplateCreated",
                    Description = $"Created notification template: {template.Name} ({template.TemplateKey})"
                };
                _context.ActivityLogs.Add(log);
                await _context.SaveChangesAsync();
            }

            _logger.LogInformation("Created notification template {Id} ({Key})", template.Id, template.TemplateKey);

            return CreatedAtAction(
                nameof(GetTemplate),
                new { id = template.Id },
                new ApiResponse<NotificationTemplateDto>
                {
                    Success = true,
                    Message = "Template created successfully",
                    Data = MapToDto(template)
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating notification template");
            return StatusCode(500, new ApiResponse<NotificationTemplateDto>
            {
                Success = false,
                Message = "An error occurred while creating template"
            });
        }
    }

    /// <summary>
    /// Update an existing notification template
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<NotificationTemplateDto>>> UpdateTemplate(
        int id,
        [FromBody] UpdateNotificationTemplateRequest request)
    {
        try
        {
            var template = await _context.NotificationTemplates.FindAsync(id);

            if (template == null)
            {
                return NotFound(new ApiResponse<NotificationTemplateDto>
                {
                    Success = false,
                    Message = "Template not found"
                });
            }

            var currentUserId = GetCurrentUserId();

            // Update fields if provided
            if (!string.IsNullOrEmpty(request.Name))
                template.Name = request.Name;

            if (request.Description != null)
                template.Description = request.Description;

            if (!string.IsNullOrEmpty(request.Category))
                template.Category = request.Category;

            if (!string.IsNullOrEmpty(request.Subject))
                template.Subject = request.Subject;

            if (!string.IsNullOrEmpty(request.Body))
                template.Body = request.Body;

            if (request.Placeholders != null)
                template.Placeholders = JsonSerializer.Serialize(request.Placeholders);

            if (request.IsActive.HasValue)
                template.IsActive = request.IsActive.Value;

            template.UpdatedAt = DateTime.UtcNow;
            template.UpdatedByUserId = currentUserId;

            await _context.SaveChangesAsync();

            // Log activity
            if (currentUserId.HasValue)
            {
                var log = new ActivityLog
                {
                    UserId = currentUserId.Value,
                    ActivityType = "NotificationTemplateUpdated",
                    Description = $"Updated notification template: {template.Name} ({template.TemplateKey})"
                };
                _context.ActivityLogs.Add(log);
                await _context.SaveChangesAsync();
            }

            _logger.LogInformation("Updated notification template {Id} ({Key})", template.Id, template.TemplateKey);

            return Ok(new ApiResponse<NotificationTemplateDto>
            {
                Success = true,
                Message = "Template updated successfully",
                Data = MapToDto(template)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating notification template {Id}", id);
            return StatusCode(500, new ApiResponse<NotificationTemplateDto>
            {
                Success = false,
                Message = "An error occurred while updating template"
            });
        }
    }

    /// <summary>
    /// Delete a notification template (only non-system templates)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteTemplate(int id)
    {
        try
        {
            var template = await _context.NotificationTemplates.FindAsync(id);

            if (template == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = "Template not found"
                });
            }

            if (template.IsSystem)
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Message = "System templates cannot be deleted"
                });
            }

            var currentUserId = GetCurrentUserId();

            _context.NotificationTemplates.Remove(template);
            await _context.SaveChangesAsync();

            // Log activity
            if (currentUserId.HasValue)
            {
                var log = new ActivityLog
                {
                    UserId = currentUserId.Value,
                    ActivityType = "NotificationTemplateDeleted",
                    Description = $"Deleted notification template: {template.Name} ({template.TemplateKey})"
                };
                _context.ActivityLogs.Add(log);
                await _context.SaveChangesAsync();
            }

            _logger.LogInformation("Deleted notification template {Id} ({Key})", id, template.TemplateKey);

            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Template deleted successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting notification template {Id}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Message = "An error occurred while deleting template"
            });
        }
    }

    /// <summary>
    /// Preview a template with sample data
    /// </summary>
    [HttpPost("preview")]
    public ActionResult<ApiResponse<PreviewTemplateResponse>> PreviewTemplate(
        [FromBody] PreviewTemplateRequest request)
    {
        try
        {
            var renderedSubject = RenderTemplate(request.Subject, request.SampleData);
            var renderedBody = RenderTemplate(request.Body, request.SampleData);

            return Ok(new ApiResponse<PreviewTemplateResponse>
            {
                Success = true,
                Data = new PreviewTemplateResponse
                {
                    RenderedSubject = renderedSubject,
                    RenderedBody = renderedBody
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error previewing template");
            return StatusCode(500, new ApiResponse<PreviewTemplateResponse>
            {
                Success = false,
                Message = "An error occurred while previewing template"
            });
        }
    }

    /// <summary>
    /// Toggle the active status of a template
    /// </summary>
    [HttpPost("{id}/toggle-active")]
    public async Task<ActionResult<ApiResponse<NotificationTemplateDto>>> ToggleActive(int id)
    {
        try
        {
            var template = await _context.NotificationTemplates.FindAsync(id);

            if (template == null)
            {
                return NotFound(new ApiResponse<NotificationTemplateDto>
                {
                    Success = false,
                    Message = "Template not found"
                });
            }

            var currentUserId = GetCurrentUserId();

            template.IsActive = !template.IsActive;
            template.UpdatedAt = DateTime.UtcNow;
            template.UpdatedByUserId = currentUserId;

            await _context.SaveChangesAsync();

            // Log activity
            if (currentUserId.HasValue)
            {
                var log = new ActivityLog
                {
                    UserId = currentUserId.Value,
                    ActivityType = "NotificationTemplateToggled",
                    Description = $"Toggled notification template: {template.Name} ({template.TemplateKey}) - Now {(template.IsActive ? "Active" : "Inactive")}"
                };
                _context.ActivityLogs.Add(log);
                await _context.SaveChangesAsync();
            }

            return Ok(new ApiResponse<NotificationTemplateDto>
            {
                Success = true,
                Message = $"Template is now {(template.IsActive ? "active" : "inactive")}",
                Data = MapToDto(template)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error toggling notification template {Id}", id);
            return StatusCode(500, new ApiResponse<NotificationTemplateDto>
            {
                Success = false,
                Message = "An error occurred while toggling template"
            });
        }
    }

    /// <summary>
    /// Reset a system template to its default content
    /// </summary>
    [HttpPost("{id}/reset")]
    public async Task<ActionResult<ApiResponse<NotificationTemplateDto>>> ResetTemplate(int id)
    {
        try
        {
            var template = await _context.NotificationTemplates.FindAsync(id);

            if (template == null)
            {
                return NotFound(new ApiResponse<NotificationTemplateDto>
                {
                    Success = false,
                    Message = "Template not found"
                });
            }

            if (!template.IsSystem)
            {
                return BadRequest(new ApiResponse<NotificationTemplateDto>
                {
                    Success = false,
                    Message = "Only system templates can be reset to defaults"
                });
            }

            // Get default content based on template key
            var defaultContent = GetDefaultTemplateContent(template.TemplateKey);
            if (defaultContent == null)
            {
                return BadRequest(new ApiResponse<NotificationTemplateDto>
                {
                    Success = false,
                    Message = "No default content available for this template"
                });
            }

            var currentUserId = GetCurrentUserId();

            template.Subject = defaultContent.Subject;
            template.Body = defaultContent.Body;
            template.Placeholders = defaultContent.Placeholders;
            template.UpdatedAt = DateTime.UtcNow;
            template.UpdatedByUserId = currentUserId;

            await _context.SaveChangesAsync();

            // Log activity
            if (currentUserId.HasValue)
            {
                var log = new ActivityLog
                {
                    UserId = currentUserId.Value,
                    ActivityType = "NotificationTemplateReset",
                    Description = $"Reset notification template to default: {template.Name} ({template.TemplateKey})"
                };
                _context.ActivityLogs.Add(log);
                await _context.SaveChangesAsync();
            }

            return Ok(new ApiResponse<NotificationTemplateDto>
            {
                Success = true,
                Message = "Template reset to default",
                Data = MapToDto(template)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resetting notification template {Id}", id);
            return StatusCode(500, new ApiResponse<NotificationTemplateDto>
            {
                Success = false,
                Message = "An error occurred while resetting template"
            });
        }
    }

    // Helper method to render template with placeholders
    private static string RenderTemplate(string template, Dictionary<string, string> data)
    {
        if (string.IsNullOrEmpty(template))
            return template;

        var result = template;

        // Replace simple placeholders: {{PlaceholderName}}
        foreach (var kvp in data)
        {
            result = result.Replace($"{{{{{kvp.Key}}}}}", kvp.Value);
        }

        // Handle conditional blocks: {{#if Condition}}...{{/if}}
        var conditionalPattern = @"\{\{#if\s+(\w+)\}\}(.*?)\{\{/if\}\}";
        result = Regex.Replace(result, conditionalPattern, match =>
        {
            var conditionName = match.Groups[1].Value;
            var content = match.Groups[2].Value;

            if (data.TryGetValue(conditionName, out var value) && !string.IsNullOrEmpty(value))
            {
                return content;
            }
            return string.Empty;
        }, RegexOptions.Singleline);

        return result;
    }

    // Helper method to map entity to DTO
    private static NotificationTemplateDto MapToDto(NotificationTemplate template)
    {
        var placeholders = new List<string>();
        if (!string.IsNullOrEmpty(template.Placeholders))
        {
            try
            {
                placeholders = JsonSerializer.Deserialize<List<string>>(template.Placeholders) ?? new List<string>();
            }
            catch
            {
                // If JSON parsing fails, try to extract from the old format or return empty
            }
        }

        return new NotificationTemplateDto
        {
            Id = template.Id,
            TemplateKey = template.TemplateKey,
            Name = template.Name,
            Description = template.Description,
            Category = template.Category,
            Subject = template.Subject,
            Body = template.Body,
            Placeholders = placeholders,
            IsActive = template.IsActive,
            IsSystem = template.IsSystem,
            CreatedAt = template.CreatedAt,
            UpdatedAt = template.UpdatedAt
        };
    }

    // Helper to get default template content for reset functionality
    private static (string Subject, string Body, string Placeholders)? GetDefaultTemplateContent(string templateKey)
    {
        return templateKey switch
        {
            "welcome_email" => (
                "Welcome to {{OrganizationName}}, {{FirstName}}!",
                @"Hi {{FirstName}},

Welcome to {{OrganizationName}}! We're excited to have you join our pickleball community.

Here's what you can do next:
- Complete your profile
- Browse our training materials
- Connect with coaches
- Start improving your game!

If you have any questions, feel free to reach out to our support team.

Best regards,
The {{OrganizationName}} Team",
                "[\"FirstName\", \"LastName\", \"Email\", \"OrganizationName\"]"
            ),
            "password_reset" => (
                "Reset Your {{OrganizationName}} Password",
                @"Hi {{FirstName}},

We received a request to reset your password for your {{OrganizationName}} account.

Click the link below to reset your password:
{{ResetLink}}

This link will expire in {{ExpirationHours}} hours.

If you didn't request this password reset, please ignore this email or contact support if you have concerns.

Best regards,
The {{OrganizationName}} Team",
                "[\"FirstName\", \"Email\", \"ResetLink\", \"ExpirationHours\", \"OrganizationName\"]"
            ),
            "session_confirmed" => (
                "Your Training Session is Confirmed!",
                @"Hi {{StudentName}},

Great news! Your training session with {{CoachName}} has been confirmed.

Session Details:
- Date: {{SessionDate}}
- Time: {{SessionTime}}
- Duration: {{Duration}} minutes
- Type: {{SessionType}}
- Location: {{Location}}

{{#if Notes}}
Notes from your coach:
{{Notes}}
{{/if}}

We look forward to seeing you there!

Best regards,
The {{OrganizationName}} Team",
                "[\"StudentName\", \"CoachName\", \"SessionDate\", \"SessionTime\", \"Duration\", \"SessionType\", \"Location\", \"Notes\", \"OrganizationName\"]"
            ),
            _ => null
        };
    }
}
