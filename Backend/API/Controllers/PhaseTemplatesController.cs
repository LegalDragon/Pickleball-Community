using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;
using System.Security.Claims;
using System.Text.Json;

namespace Pickleball.Community.Controllers;

/// <summary>
/// Controller for managing phase templates - pre-built tournament structures
/// that TDs can select and apply to divisions.
/// </summary>
[ApiController]
[Route("[controller]")]
public class PhaseTemplatesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<PhaseTemplatesController> _logger;

    public PhaseTemplatesController(ApplicationDbContext context, ILogger<PhaseTemplatesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get all active templates, optionally filtered by category
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<PhaseTemplateListDto>>> GetTemplates(
        [FromQuery] string? category = null,
        [FromQuery] bool includeInactive = false)
    {
        var query = _context.PhaseTemplates.AsQueryable();

        if (!includeInactive)
            query = query.Where(t => t.IsActive);

        if (!string.IsNullOrEmpty(category))
            query = query.Where(t => t.Category == category);

        var templates = await query
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.Name)
            .Select(t => new PhaseTemplateListDto
            {
                Id = t.Id,
                Name = t.Name,
                Description = t.Description,
                Category = t.Category,
                MinUnits = t.MinUnits,
                MaxUnits = t.MaxUnits,
                DefaultUnits = t.DefaultUnits,
                IsSystemTemplate = t.IsSystemTemplate,
                IsActive = t.IsActive,
                DiagramText = t.DiagramText,
                Tags = t.Tags,
                StructureJson = t.StructureJson,
                CreatedByUserId = t.CreatedByUserId,
                CreatedByName = t.CreatedBy != null ? t.CreatedBy.FirstName + " " + t.CreatedBy.LastName : null
            })
            .ToListAsync();

        return Ok(templates);
    }

    /// <summary>
    /// Get templates suitable for a specific unit count
    /// </summary>
    [HttpGet("for-units/{unitCount}")]
    public async Task<ActionResult<List<PhaseTemplateListDto>>> GetTemplatesForUnitCount(int unitCount)
    {
        var templates = await _context.PhaseTemplates
            .Where(t => t.IsActive && t.MinUnits <= unitCount && t.MaxUnits >= unitCount)
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.Name)
            .Select(t => new PhaseTemplateListDto
            {
                Id = t.Id,
                Name = t.Name,
                Description = t.Description,
                Category = t.Category,
                MinUnits = t.MinUnits,
                MaxUnits = t.MaxUnits,
                DefaultUnits = t.DefaultUnits,
                IsSystemTemplate = t.IsSystemTemplate,
                IsActive = t.IsActive,
                DiagramText = t.DiagramText,
                Tags = t.Tags,
                StructureJson = t.StructureJson
            })
            .ToListAsync();

        return Ok(templates);
    }

    /// <summary>
    /// Get template by ID with full structure
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<PhaseTemplateDetailDto>> GetTemplate(int id)
    {
        var template = await _context.PhaseTemplates
            .Include(t => t.CreatedBy)
            .Where(t => t.Id == id)
            .Select(t => new PhaseTemplateDetailDto
            {
                Id = t.Id,
                Name = t.Name,
                Description = t.Description,
                Category = t.Category,
                MinUnits = t.MinUnits,
                MaxUnits = t.MaxUnits,
                DefaultUnits = t.DefaultUnits,
                IsSystemTemplate = t.IsSystemTemplate,
                SortOrder = t.SortOrder,
                StructureJson = t.StructureJson,
                DiagramText = t.DiagramText,
                Tags = t.Tags,
                CreatedAt = t.CreatedAt,
                CreatedByUserId = t.CreatedByUserId,
                CreatedByName = t.CreatedBy != null ? t.CreatedBy.FirstName + " " + t.CreatedBy.LastName : null
            })
            .FirstOrDefaultAsync();

        if (template == null)
            return NotFound("Template not found");

        return Ok(template);
    }

    /// <summary>
    /// Get templates by category
    /// </summary>
    [HttpGet("category/{category}")]
    public async Task<ActionResult<List<PhaseTemplateListDto>>> GetTemplatesByCategory(string category)
    {
        var templates = await _context.PhaseTemplates
            .Where(t => t.IsActive && t.Category == category)
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.Name)
            .Select(t => new PhaseTemplateListDto
            {
                Id = t.Id,
                Name = t.Name,
                Description = t.Description,
                Category = t.Category,
                MinUnits = t.MinUnits,
                MaxUnits = t.MaxUnits,
                DefaultUnits = t.DefaultUnits,
                IsSystemTemplate = t.IsSystemTemplate,
                IsActive = t.IsActive,
                DiagramText = t.DiagramText,
                Tags = t.Tags,
                StructureJson = t.StructureJson
            })
            .ToListAsync();

        return Ok(templates);
    }

    /// <summary>
    /// Get templates created by the current user
    /// </summary>
    [HttpGet("my-templates")]
    [Authorize]
    public async Task<ActionResult<List<PhaseTemplateListDto>>> GetMyTemplates()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var templates = await _context.PhaseTemplates
            .Where(t => t.CreatedByUserId == userId && t.IsActive)
            .OrderBy(t => t.SortOrder)
            .Select(t => new PhaseTemplateListDto
            {
                Id = t.Id,
                Name = t.Name,
                Description = t.Description,
                Category = t.Category,
                MinUnits = t.MinUnits,
                MaxUnits = t.MaxUnits,
                DefaultUnits = t.DefaultUnits,
                IsSystemTemplate = t.IsSystemTemplate,
                IsActive = t.IsActive,
                DiagramText = t.DiagramText,
                Tags = t.Tags,
                StructureJson = t.StructureJson
            })
            .ToListAsync();

        return Ok(templates);
    }

    /// <summary>
    /// Get all user-created templates (Admin only) — for reviewing community templates
    /// </summary>
    [HttpGet("user-templates")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<List<PhaseTemplateDetailDto>>> GetAllUserTemplates()
    {
        var templates = await _context.PhaseTemplates
            .Include(t => t.CreatedBy)
            .Where(t => !t.IsSystemTemplate && t.IsActive && t.CreatedByUserId != null)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new PhaseTemplateDetailDto
            {
                Id = t.Id,
                Name = t.Name,
                Description = t.Description,
                Category = t.Category,
                MinUnits = t.MinUnits,
                MaxUnits = t.MaxUnits,
                DefaultUnits = t.DefaultUnits,
                IsSystemTemplate = t.IsSystemTemplate,
                SortOrder = t.SortOrder,
                StructureJson = t.StructureJson,
                DiagramText = t.DiagramText,
                Tags = t.Tags,
                CreatedAt = t.CreatedAt,
                CreatedByUserId = t.CreatedByUserId,
                CreatedByName = t.CreatedBy != null ? t.CreatedBy.FirstName + " " + t.CreatedBy.LastName : null
            })
            .ToListAsync();

        return Ok(templates);
    }

    /// <summary>
    /// Copy a user template to a system template (Admin only)
    /// </summary>
    [HttpPost("{id}/copy-to-system")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<PhaseTemplateDetailDto>> CopyToSystemTemplate(int id)
    {
        var source = await _context.PhaseTemplates.FindAsync(id);
        if (source == null)
            return NotFound("Template not found");

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        int? userId = int.TryParse(userIdClaim, out var uid) ? uid : null;

        var systemTemplate = new PhaseTemplate
        {
            Name = source.Name,
            Description = source.Description,
            Category = source.Category,
            MinUnits = source.MinUnits,
            MaxUnits = source.MaxUnits,
            DefaultUnits = source.DefaultUnits,
            IsSystemTemplate = true,
            IsActive = true,
            SortOrder = source.SortOrder,
            StructureJson = source.StructureJson,
            DiagramText = source.DiagramText,
            Tags = source.Tags,
            CreatedByUserId = userId
        };

        _context.PhaseTemplates.Add(systemTemplate);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Admin {UserId} copied template {SourceId} to system template {NewId}", userId, id, systemTemplate.Id);

        return CreatedAtAction(nameof(GetTemplate), new { id = systemTemplate.Id }, new PhaseTemplateDetailDto
        {
            Id = systemTemplate.Id,
            Name = systemTemplate.Name,
            Description = systemTemplate.Description,
            Category = systemTemplate.Category,
            MinUnits = systemTemplate.MinUnits,
            MaxUnits = systemTemplate.MaxUnits,
            DefaultUnits = systemTemplate.DefaultUnits,
            IsSystemTemplate = systemTemplate.IsSystemTemplate,
            SortOrder = systemTemplate.SortOrder,
            StructureJson = systemTemplate.StructureJson,
            DiagramText = systemTemplate.DiagramText,
            Tags = systemTemplate.Tags,
            CreatedAt = systemTemplate.CreatedAt,
            CreatedByUserId = systemTemplate.CreatedByUserId
        });
    }

    /// <summary>
    /// Create a custom template (any authenticated user)
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<PhaseTemplateDetailDto>> CreateTemplate([FromBody] PhaseTemplateCreateDto dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        int? userId = int.TryParse(userIdClaim, out var id) ? id : null;

        // Validate JSON structure
        try
        {
            JsonDocument.Parse(dto.StructureJson);
        }
        catch (JsonException)
        {
            return BadRequest("Invalid JSON in StructureJson");
        }

        var template = new PhaseTemplate
        {
            Name = dto.Name,
            Description = dto.Description,
            Category = dto.Category,
            MinUnits = dto.MinUnits,
            MaxUnits = dto.MaxUnits,
            DefaultUnits = dto.DefaultUnits,
            IsSystemTemplate = false,
            IsActive = true,
            SortOrder = dto.SortOrder,
            StructureJson = dto.StructureJson,
            DiagramText = dto.DiagramText,
            Tags = dto.Tags,
            CreatedByUserId = userId
        };

        _context.PhaseTemplates.Add(template);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Created phase template {TemplateId} '{Name}' by user {UserId}", template.Id, template.Name, userId);

        return CreatedAtAction(nameof(GetTemplate), new { id = template.Id }, new PhaseTemplateDetailDto
        {
            Id = template.Id,
            Name = template.Name,
            Description = template.Description,
            Category = template.Category,
            MinUnits = template.MinUnits,
            MaxUnits = template.MaxUnits,
            DefaultUnits = template.DefaultUnits,
            IsSystemTemplate = template.IsSystemTemplate,
            SortOrder = template.SortOrder,
            StructureJson = template.StructureJson,
            DiagramText = template.DiagramText,
            Tags = template.Tags,
            CreatedAt = template.CreatedAt,
            CreatedByUserId = template.CreatedByUserId
        });
    }

    /// <summary>
    /// Update a template (owner or Admin for user templates, Admin only for system templates)
    /// </summary>
    [HttpPut("{id}")]
    [Authorize]
    public async Task<ActionResult<PhaseTemplateDetailDto>> UpdateTemplate(int id, [FromBody] PhaseTemplateCreateDto dto)
    {
        var template = await _context.PhaseTemplates.FindAsync(id);
        if (template == null)
            return NotFound("Template not found");

        // Check ownership: must be admin or the creator
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var isAdmin = User.IsInRole("Admin");
        int.TryParse(userIdClaim, out var currentUserId);

        // System templates can only be modified by admins
        if (template.IsSystemTemplate && !isAdmin)
            return BadRequest("Only admins can modify system templates");

        // Non-system templates: must be admin or creator
        if (!template.IsSystemTemplate && !isAdmin && template.CreatedByUserId != currentUserId)
            return Forbid();

        // Validate JSON structure
        try
        {
            JsonDocument.Parse(dto.StructureJson);
        }
        catch (JsonException)
        {
            return BadRequest("Invalid JSON in StructureJson");
        }

        template.Name = dto.Name;
        template.Description = dto.Description;
        template.Category = dto.Category;
        template.MinUnits = dto.MinUnits;
        template.MaxUnits = dto.MaxUnits;
        template.DefaultUnits = dto.DefaultUnits;
        template.SortOrder = dto.SortOrder;
        template.StructureJson = dto.StructureJson;
        template.DiagramText = dto.DiagramText;
        template.Tags = dto.Tags;
        template.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Updated phase template {TemplateId}", id);

        return Ok(new PhaseTemplateDetailDto
        {
            Id = template.Id,
            Name = template.Name,
            Description = template.Description,
            Category = template.Category,
            MinUnits = template.MinUnits,
            MaxUnits = template.MaxUnits,
            DefaultUnits = template.DefaultUnits,
            IsSystemTemplate = template.IsSystemTemplate,
            SortOrder = template.SortOrder,
            StructureJson = template.StructureJson,
            DiagramText = template.DiagramText,
            Tags = template.Tags,
            CreatedAt = template.CreatedAt,
            CreatedByUserId = template.CreatedByUserId
        });
    }

    /// <summary>
    /// Delete (deactivate) a template (owner or Admin for user templates, Admin only for system templates)
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize]
    public async Task<ActionResult> DeleteTemplate(int id)
    {
        var template = await _context.PhaseTemplates.FindAsync(id);
        if (template == null)
            return NotFound("Template not found");

        // Check ownership: must be admin or the creator
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var isAdmin = User.IsInRole("Admin");
        int.TryParse(userIdClaim, out var currentUserId);

        // System templates can only be deleted by admins
        if (template.IsSystemTemplate && !isAdmin)
            return BadRequest("Only admins can delete system templates");

        // Non-system templates: must be admin or creator
        if (!template.IsSystemTemplate && !isAdmin && template.CreatedByUserId != currentUserId)
            return Forbid();

        template.IsActive = false;
        template.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Deactivated phase template {TemplateId}", id);

        return NoContent();
    }

    /// <summary>
    /// Preview what applying a template would create
    /// </summary>
    [HttpPost("preview")]
    [Authorize]
    public async Task<ActionResult<TemplatePreviewDto>> PreviewTemplate([FromBody] ApplyTemplateRequest request)
    {
        var template = await _context.PhaseTemplates.FindAsync(request.TemplateId);
        if (template == null)
            return NotFound("Template not found");

        var division = await _context.EventDivisions
            .Include(d => d.Units)
            .FirstOrDefaultAsync(d => d.Id == request.DivisionId);

        if (division == null)
            return NotFound("Division not found");

        // Determine unit count
        var unitCount = request.UnitCount ?? division.Units?.Count ?? template.DefaultUnits;

        // Parse and generate preview
        try
        {
            // Handle null/empty/invalid JSON by using fallback
            if (string.IsNullOrWhiteSpace(template.StructureJson) || template.StructureJson == "{}")
            {
                var fallbackPreview = GenerateFallbackPreviewResult(template, unitCount);
                return Ok(fallbackPreview);
            }
            
            var structure = JsonDocument.Parse(template.StructureJson);
            var preview = GeneratePreview(template, structure, unitCount);
            return Ok(preview);
        }
        catch (JsonException ex)
        {
            // JSON parsing failed - use fallback based on template name/category
            _logger.LogWarning(ex, "Invalid JSON in template {TemplateId}, using fallback preview", request.TemplateId);
            var fallbackPreview = GenerateFallbackPreviewResult(template, unitCount);
            return Ok(fallbackPreview);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating template preview for template {TemplateId}", request.TemplateId);
            return BadRequest("Error parsing template structure");
        }
    }
    
    private TemplatePreviewDto GenerateFallbackPreviewResult(PhaseTemplate template, int unitCount)
    {
        var phases = GenerateFallbackPreview(template, unitCount);
        return new TemplatePreviewDto
        {
            TemplateId = template.Id,
            TemplateName = template.Name,
            UnitCount = unitCount,
            Phases = phases,
            TotalEncounters = phases.Sum(p => p.EncounterCount),
            TotalRounds = phases.Count,
            AdvancementRules = new List<TemplateAdvancementPreviewDto>()
        };
    }

    /// <summary>
    /// Apply a template to a division, creating all phases, slots, and advancement rules
    /// </summary>
    [HttpPost("{templateId}/apply/{divisionId}")]
    [Authorize]
    public async Task<ActionResult<ApplyTemplateResultDto>> ApplyTemplate(
        int templateId,
        int divisionId,
        [FromQuery] int? unitCount = null,
        [FromQuery] bool clearExisting = true)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var template = await _context.PhaseTemplates.FindAsync(templateId);
        if (template == null || !template.IsActive)
            return NotFound("Template not found or inactive");

        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .Include(d => d.Units)
            .Include(d => d.Phases)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return NotFound("Division not found");

        // Check authorization - must be admin or event organizer
        var isAdmin = User.IsInRole("Admin");
        var isOrganizer = division.Event?.OrganizedByUserId == userId;
        if (!isAdmin && !isOrganizer)
            return Forbid();

        // Determine unit count
        var actualUnitCount = unitCount ?? division.Units?.Count ?? template.DefaultUnits;

        // Validate unit count is within template range
        if (actualUnitCount < template.MinUnits || actualUnitCount > template.MaxUnits)
            return BadRequest($"Unit count {actualUnitCount} is outside template range ({template.MinUnits}-{template.MaxUnits})");

        try
        {
            var result = await ApplyTemplateToDiv(template, division, actualUnitCount, clearExisting);
            _logger.LogInformation("Applied template {TemplateId} to division {DivisionId} by user {UserId}", templateId, divisionId, userId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error applying template {TemplateId} to division {DivisionId}", templateId, divisionId);
            return BadRequest($"Error applying template: {ex.Message}");
        }
    }

    /// <summary>
    /// Manually assign a unit to an exit/advancing slot (TD override)
    /// </summary>
    [HttpPost("manual-exit-assignment")]
    [Authorize]
    public async Task<ActionResult<SlotAssignmentResultDto>> ManualExitAssignment([FromBody] ManualExitSlotRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        // Validate phase exists and get authorization context
        var phase = await _context.DivisionPhases
            .Include(p => p.Division)
                .ThenInclude(d => d!.Event)
            .FirstOrDefaultAsync(p => p.Id == request.PhaseId);

        if (phase?.Division?.Event == null)
            return NotFound("Phase not found");

        // Check authorization
        var isAdmin = User.IsInRole("Admin");
        var isOrganizer = phase.Division.Event.OrganizedByUserId == userId;
        if (!isAdmin && !isOrganizer)
            return Forbid();

        // Execute stored procedure
        try
        {
            await _context.Database.ExecuteSqlRawAsync(
                "EXEC sp_ManuallyAssignExitSlot @PhaseId = {0}, @SlotNumber = {1}, @UnitId = {2}, @UserId = {3}, @Notes = {4}",
                request.PhaseId, request.SlotNumber, request.UnitId, userId, request.Notes ?? "");

            // Get the updated slot
            var slot = await _context.PhaseSlots
                .Include(s => s.Unit)
                .FirstOrDefaultAsync(s => s.PhaseId == request.PhaseId
                    && s.SlotType == SlotTypes.Advancing
                    && s.SlotNumber == request.SlotNumber);

            if (slot == null)
                return NotFound("Slot not found after assignment");

            _logger.LogInformation("Manual exit slot assignment: Phase {PhaseId}, Slot {SlotNumber}, Unit {UnitId} by User {UserId}",
                request.PhaseId, request.SlotNumber, request.UnitId, userId);

            return Ok(new SlotAssignmentResultDto
            {
                Success = true,
                SlotId = slot.Id,
                SlotNumber = slot.SlotNumber,
                UnitId = request.UnitId,
                UnitName = slot.Unit?.Name,
                Message = "Exit slot assigned successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in manual exit slot assignment");
            return BadRequest(new SlotAssignmentResultDto
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    /// <summary>
    /// Process all bye encounters in a phase
    /// </summary>
    [HttpPost("{phaseId}/process-byes")]
    [Authorize]
    public async Task<ActionResult<ByeProcessingResultDto>> ProcessByes(int phaseId)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        // Validate phase exists and get authorization context
        var phase = await _context.DivisionPhases
            .Include(p => p.Division)
                .ThenInclude(d => d!.Event)
            .FirstOrDefaultAsync(p => p.Id == phaseId);

        if (phase?.Division?.Event == null)
            return NotFound("Phase not found");

        // Check authorization
        var isAdmin = User.IsInRole("Admin");
        var isOrganizer = phase.Division.Event.OrganizedByUserId == userId;
        if (!isAdmin && !isOrganizer)
            return Forbid();

        try
        {
            // Execute stored procedure and get result
            var result = await _context.Database
                .SqlQueryRaw<int>("EXEC sp_ProcessByeEncounters @PhaseId = {0}", phaseId)
                .ToListAsync();

            var byesProcessed = result.FirstOrDefault();

            _logger.LogInformation("Processed {ByeCount} byes in phase {PhaseId} by user {UserId}", byesProcessed, phaseId, userId);

            return Ok(new ByeProcessingResultDto
            {
                Success = true,
                ByesProcessed = byesProcessed,
                Message = byesProcessed > 0 ? $"Processed {byesProcessed} bye encounters" : "No bye encounters to process"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing byes in phase {PhaseId}", phaseId);
            return BadRequest(new ByeProcessingResultDto
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    /// <summary>
    /// Get exit slot status for a phase
    /// </summary>
    [HttpGet("{phaseId}/exit-slots")]
    [Authorize]
    public async Task<ActionResult<List<object>>> GetExitSlots(int phaseId)
    {
        var slots = await _context.PhaseSlots
            .Include(s => s.Unit)
            .Where(s => s.PhaseId == phaseId && s.SlotType == SlotTypes.Advancing)
            .OrderBy(s => s.SlotNumber)
            .Select(s => new
            {
                s.Id,
                s.SlotNumber,
                s.UnitId,
                UnitName = s.Unit != null ? s.Unit.Name : null,
                s.IsResolved,
                s.WasManuallyResolved,
                s.ResolvedAt,
                s.ResolutionNotes,
                s.PlaceholderLabel,
                s.ExitLabel
            })
            .ToListAsync();

        return Ok(slots);
    }

    #region Private Helper Methods

    private TemplatePreviewDto GeneratePreview(PhaseTemplate template, JsonDocument structure, int unitCount)
    {
        var preview = new TemplatePreviewDto
        {
            TemplateId = template.Id,
            TemplateName = template.Name,
            UnitCount = unitCount,
            Phases = new List<TemplatePhasePreviewDto>(),
            AdvancementRules = new List<TemplateAdvancementPreviewDto>()
        };

        var root = structure.RootElement;

        // Check if flexible template
        if (root.TryGetProperty("isFlexible", out var isFlexible) && isFlexible.GetBoolean())
        {
            // Generate dynamic phases based on unit count
            preview.Phases = GenerateFlexiblePhases(root, unitCount);
        }
        else if (root.TryGetProperty("phases", out var phases) && phases.GetArrayLength() > 0)
        {
            // Use defined phases (only if array is non-empty)
            foreach (var phase in phases.EnumerateArray())
            {
                var phasePreview = new TemplatePhasePreviewDto
                {
                    Order = phase.GetProperty("order").GetInt32(),
                    Name = phase.GetProperty("name").GetString() ?? "",
                    Type = phase.GetProperty("type").GetString() ?? "",
                    IncomingSlots = phase.GetProperty("incomingSlots").GetInt32(),
                    ExitingSlots = phase.GetProperty("exitingSlots").GetInt32(),
                    PoolCount = phase.TryGetProperty("poolCount", out var pc) ? pc.GetInt32() : null,
                    IncludeConsolation = phase.TryGetProperty("includeConsolation", out var ic) && ic.GetBoolean()
                };

                // Calculate encounter count based on phase type
                phasePreview.EncounterCount = CalculateEncounterCount(phasePreview);

                preview.Phases.Add(phasePreview);
            }
        }
        else
        {
            // Fallback: generate basic preview based on template category
            // Triggers when: no phases property, empty phases array, or no isFlexible
            preview.Phases = GenerateFallbackPreview(template, unitCount);
        }

        // Calculate totals
        preview.TotalEncounters = preview.Phases.Sum(p => p.EncounterCount);
        preview.TotalRounds = preview.Phases.Count;

        // Parse advancement rules
        if (root.TryGetProperty("advancementRules", out var rules) && rules.ValueKind == JsonValueKind.Array)
        {
            foreach (var rule in rules.EnumerateArray())
            {
                var fromPhaseNum = rule.GetProperty("fromPhase").GetInt32();
                var fromPhase = preview.Phases.FirstOrDefault(p => p.Order == fromPhaseNum);

                var rulePreview = new TemplateAdvancementPreviewDto
                {
                    FromPhase = fromPhase?.Name ?? $"Phase {fromPhaseNum}",
                    ToPhase = preview.Phases.FirstOrDefault(p => p.Order == rule.GetProperty("toPhase").GetInt32())?.Name ?? "",
                    ToSlot = rule.GetProperty("toSlot").GetInt32()
                };

                if (rule.TryGetProperty("fromPool", out var pool))
                    rulePreview.FromDescription = $"Pool {pool.GetString()} #{rule.GetProperty("fromRank").GetInt32()}";
                else if (rule.TryGetProperty("fromRank", out var rank))
                    rulePreview.FromDescription = $"#{rank.GetInt32()}";

                preview.AdvancementRules.Add(rulePreview);
            }
        }

        return preview;
    }

    private List<TemplatePhasePreviewDto> GenerateFlexiblePhases(JsonElement root, int unitCount)
    {
        var phases = new List<TemplatePhasePreviewDto>();

        if (root.TryGetProperty("generateBracket", out var bracketConfig))
        {
            var bracketType = bracketConfig.GetProperty("type").GetString();

            // Calculate bracket size (next power of 2)
            var bracketSize = 1;
            while (bracketSize < unitCount) bracketSize *= 2;

            var byes = bracketSize - unitCount;

            if (bracketType == "SingleElimination")
            {
                // Generate bracket rounds
                var remaining = bracketSize;
                var order = 1;
                while (remaining > 1)
                {
                    var name = remaining switch
                    {
                        2 => "Finals",
                        4 => "Semifinals",
                        8 => "Quarterfinals",
                        _ => $"Round of {remaining}"
                    };

                    phases.Add(new TemplatePhasePreviewDto
                    {
                        Order = order++,
                        Name = name,
                        Type = "BracketRound",
                        IncomingSlots = remaining,
                        ExitingSlots = remaining / 2,
                        EncounterCount = remaining / 2,
                        IncludeConsolation = remaining == 4 && bracketConfig.TryGetProperty("consolation", out var c) && c.GetBoolean()
                    });

                    remaining /= 2;
                }
            }
        }
        else if (root.TryGetProperty("generateFormat", out var formatConfig))
        {
            var poolSize = formatConfig.GetProperty("poolSize").GetInt32();
            var advancePerPool = formatConfig.GetProperty("advancePerPool").GetInt32();

            // Calculate pool count
            var poolCount = (int)Math.Ceiling((double)unitCount / poolSize);
            var advancingCount = poolCount * advancePerPool;

            // Pool play phase
            phases.Add(new TemplatePhasePreviewDto
            {
                Order = 1,
                Name = "Pool Play",
                Type = "Pools",
                IncomingSlots = unitCount,
                ExitingSlots = advancingCount,
                PoolCount = poolCount,
                EncounterCount = poolCount * (poolSize * (poolSize - 1) / 2)
            });

            // Bracket phases for advancing teams
            var remaining = advancingCount;
            var order = 2;
            while (remaining > 1)
            {
                var name = remaining switch
                {
                    2 => "Finals",
                    4 => "Semifinals",
                    8 => "Quarterfinals",
                    _ => $"Round of {remaining}"
                };

                phases.Add(new TemplatePhasePreviewDto
                {
                    Order = order++,
                    Name = name,
                    Type = "BracketRound",
                    IncomingSlots = remaining,
                    ExitingSlots = remaining == 2 ? 2 : remaining / 2,
                    EncounterCount = remaining / 2
                });

                remaining /= 2;
            }
        }

        return phases;
    }

    private int CalculateEncounterCount(TemplatePhasePreviewDto phase)
    {
        return phase.Type switch
        {
            "RoundRobin" => phase.IncomingSlots * (phase.IncomingSlots - 1) / 2,
            "Pools" => (phase.PoolCount ?? 1) * ((phase.IncomingSlots / (phase.PoolCount ?? 1)) * ((phase.IncomingSlots / (phase.PoolCount ?? 1)) - 1) / 2),
            "BracketRound" => phase.IncomingSlots / 2 + (phase.IncludeConsolation ? 1 : 0),
            "SingleElimination" => phase.IncomingSlots - 1,
            "DoubleElimination" => (phase.IncomingSlots * 2) - 1,
            _ => phase.IncomingSlots / 2
        };
    }

    /// <summary>
    /// Generate a basic preview when template has no explicit phases defined
    /// Uses template category and name to infer type, then generates preview
    /// </summary>
    private List<TemplatePhasePreviewDto> GenerateFallbackPreview(PhaseTemplate template, int unitCount)
    {
        var phases = new List<TemplatePhasePreviewDto>();
        var category = template.Category?.ToLower() ?? "";
        var templateName = template.Name?.ToLower() ?? "";
        
        // Check both category and name for type hints
        var isRoundRobin = category.Contains("roundrobin") || category.Contains("round") 
            || templateName.Contains("rr") || templateName.Contains("round robin");
        var isDoubleElim = category.Contains("double") || templateName.Contains("double");
        var isSingleElim = category.Contains("single") || category.Contains("bracket") 
            || category.Contains("elimination") || templateName.Contains("elimination") || templateName.Contains("bracket");

        if (isRoundRobin)
        {
            // Simple round robin
            phases.Add(new TemplatePhasePreviewDto
            {
                Order = 1,
                Name = "Round Robin",
                Type = "RoundRobin",
                IncomingSlots = unitCount,
                ExitingSlots = unitCount,
                EncounterCount = unitCount * (unitCount - 1) / 2
            });
        }
        else if (isDoubleElim)
        {
            // Double elimination
            phases.Add(new TemplatePhasePreviewDto
            {
                Order = 1,
                Name = "Double Elimination",
                Type = "DoubleElimination",
                IncomingSlots = unitCount,
                ExitingSlots = 2,
                EncounterCount = (unitCount * 2) - 1
            });
        }
        else if (isSingleElim)
        {
            // Single elimination bracket
            var bracketSize = 1;
            while (bracketSize < unitCount) bracketSize *= 2;

            var remaining = bracketSize;
            var order = 1;
            while (remaining > 1)
            {
                var name = remaining switch
                {
                    2 => "Finals",
                    4 => "Semifinals",
                    8 => "Quarterfinals",
                    _ => $"Round of {remaining}"
                };

                phases.Add(new TemplatePhasePreviewDto
                {
                    Order = order++,
                    Name = name,
                    Type = "BracketRound",
                    IncomingSlots = remaining,
                    ExitingSlots = remaining / 2,
                    EncounterCount = remaining / 2
                });

                remaining /= 2;
            }
        }
        else
        {
            // Default: simple round robin if category unknown
            phases.Add(new TemplatePhasePreviewDto
            {
                Order = 1,
                Name = template.Name ?? "Phase 1",
                Type = "RoundRobin",
                IncomingSlots = unitCount,
                ExitingSlots = unitCount,
                EncounterCount = unitCount * (unitCount - 1) / 2
            });
        }

        return phases;
    }

    private async Task<ApplyTemplateResultDto> ApplyTemplateToDiv(
        PhaseTemplate template,
        EventDivision division,
        int unitCount,
        bool clearExisting)
    {
        var result = new ApplyTemplateResultDto
        {
            Success = true,
            DivisionId = division.Id,
            CreatedPhaseIds = new List<int>()
        };

        // Clear existing phases if requested using stored procedure
        // (avoids EF Core OPENJSON query issues with Contains() on lists)
        if (clearExisting && division.Phases?.Any() == true)
        {
            await _context.Database.ExecuteSqlRawAsync(
                "EXEC sp_ClearDivisionPhases @DivisionId = {0}", division.Id);
        }

        // Parse template structure
        var structure = JsonDocument.Parse(template.StructureJson);
        var root = structure.RootElement;

        var createdPhases = new Dictionary<int, DivisionPhase>();  // order -> phase

        // Handle flexible templates
        if (root.TryGetProperty("isFlexible", out var isFlexible) && isFlexible.GetBoolean())
        {
            var flexiblePhases = GenerateFlexiblePhases(root, unitCount);
            foreach (var phasePreview in flexiblePhases)
            {
                var phase = await CreatePhaseFromPreview(division.Id, phasePreview);
                createdPhases[phasePreview.Order] = phase;
                result.CreatedPhaseIds.Add(phase.Id);
            }
        }
        else if (root.TryGetProperty("phases", out var phases))
        {
            foreach (var phaseJson in phases.EnumerateArray())
            {
                var phase = await CreatePhaseFromJson(division.Id, phaseJson);
                createdPhases[phase.PhaseOrder] = phase;
                result.CreatedPhaseIds.Add(phase.Id);
            }
        }

        await _context.SaveChangesAsync();

        // Create advancement rules
        if (root.TryGetProperty("advancementRules", out var rules) && rules.ValueKind == JsonValueKind.Array)
        {
            foreach (var ruleJson in rules.EnumerateArray())
            {
                if (ruleJson.ValueKind == JsonValueKind.String && ruleJson.GetString() == "auto")
                {
                    // Auto-generate advancement rules between consecutive phases
                    await GenerateAutoAdvancementRules(createdPhases);
                }
                else
                {
                    await CreateAdvancementRuleFromJson(ruleJson, createdPhases);
                }
            }
            // Count advancement rules using direct query on division phases (avoids Contains() OPENJSON issue)
            result.TotalAdvancementRules = await _context.PhaseAdvancementRules
                .CountAsync(r => r.SourcePhase != null && r.SourcePhase.DivisionId == division.Id);
        }

        await _context.SaveChangesAsync();

        // Count created items (avoid Contains() OPENJSON issue by querying by division)
        result.TotalPhases = result.CreatedPhaseIds.Count;
        result.TotalSlots = await _context.PhaseSlots
            .CountAsync(s => s.Phase != null && s.Phase.DivisionId == division.Id);

        result.Message = $"Created {result.TotalPhases} phases with {result.TotalSlots} slots";

        return result;
    }

    private async Task<DivisionPhase> CreatePhaseFromPreview(int divisionId, TemplatePhasePreviewDto preview)
    {
        var phase = new DivisionPhase
        {
            DivisionId = divisionId,
            PhaseOrder = preview.Order,
            Name = preview.Name,
            PhaseType = preview.Type,
            IncomingSlotCount = preview.IncomingSlots,
            AdvancingSlotCount = preview.ExitingSlots,
            PoolCount = preview.PoolCount ?? 1,
            IncludeConsolation = preview.IncludeConsolation,
            Status = PhaseStatus.Pending
        };

        _context.DivisionPhases.Add(phase);
        await _context.SaveChangesAsync();

        // Create incoming slots
        for (int i = 1; i <= preview.IncomingSlots; i++)
        {
            _context.PhaseSlots.Add(new PhaseSlot
            {
                PhaseId = phase.Id,
                SlotType = SlotTypes.Incoming,
                SlotNumber = i,
                SourceType = SlotSourceTypes.Seeded,
                PlaceholderLabel = $"Team {i}"
            });
        }

        // Create advancing/exit slots
        var poolCount = preview.PoolCount ?? 1;
        for (int i = 1; i <= preview.ExitingSlots; i++)
        {
            _context.PhaseSlots.Add(new PhaseSlot
            {
                PhaseId = phase.Id,
                SlotType = SlotTypes.Advancing,
                SlotNumber = i,
                SourceType = SlotSourceTypes.Manual,
                PlaceholderLabel = GetExitLabel(i, preview.ExitingSlots, poolCount)
            });
        }

        await _context.SaveChangesAsync();

        // Create pools if this is a multi-pool phase
        if (poolCount > 1)
        {
            await CreatePhasePools(phase.Id, poolCount, preview.IncomingSlots);
        }

        return phase;
    }

    private async Task<DivisionPhase> CreatePhaseFromJson(int divisionId, JsonElement phaseJson)
    {
        // Support both old and new property names for backward compatibility
        // Old: order, type, incomingSlots, exitingSlots
        // New: sortOrder, phaseType, incomingSlotCount, advancingSlotCount
        var phaseOrder = phaseJson.TryGetProperty("order", out var orderProp) ? orderProp.GetInt32()
            : phaseJson.TryGetProperty("sortOrder", out var sortOrderProp) ? sortOrderProp.GetInt32() : 1;
        var phaseType = phaseJson.TryGetProperty("type", out var typeProp) ? typeProp.GetString()
            : phaseJson.TryGetProperty("phaseType", out var phaseTypeProp) ? phaseTypeProp.GetString() : PhaseTypes.RoundRobin;
        var incomingSlots = phaseJson.TryGetProperty("incomingSlots", out var inProp) ? inProp.GetInt32()
            : phaseJson.TryGetProperty("incomingSlotCount", out var inCountProp) ? inCountProp.GetInt32() : 8;
        var advancingSlots = phaseJson.TryGetProperty("exitingSlots", out var exitProp) ? exitProp.GetInt32()
            : phaseJson.TryGetProperty("advancingSlotCount", out var advCountProp) ? advCountProp.GetInt32() : 4;

        var phase = new DivisionPhase
        {
            DivisionId = divisionId,
            PhaseOrder = phaseOrder,
            Name = phaseJson.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "" : "",
            PhaseType = phaseType ?? PhaseTypes.RoundRobin,
            IncomingSlotCount = incomingSlots,
            AdvancingSlotCount = advancingSlots,
            PoolCount = phaseJson.TryGetProperty("poolCount", out var pc) ? pc.GetInt32() : 1,
            IncludeConsolation = phaseJson.TryGetProperty("includeConsolation", out var ic) && ic.GetBoolean(),
            Status = PhaseStatus.Pending
        };

        if (phaseJson.TryGetProperty("settings", out var settings))
        {
            phase.Settings = settings.GetRawText();
        }

        _context.DivisionPhases.Add(phase);
        await _context.SaveChangesAsync();

        // Create incoming slots
        for (int i = 1; i <= phase.IncomingSlotCount; i++)
        {
            _context.PhaseSlots.Add(new PhaseSlot
            {
                PhaseId = phase.Id,
                SlotType = SlotTypes.Incoming,
                SlotNumber = i,
                SourceType = SlotSourceTypes.Seeded,
                PlaceholderLabel = $"Team {i}"
            });
        }

        // Create advancing/exit slots
        for (int i = 1; i <= phase.AdvancingSlotCount; i++)
        {
            _context.PhaseSlots.Add(new PhaseSlot
            {
                PhaseId = phase.Id,
                SlotType = SlotTypes.Advancing,
                SlotNumber = i,
                SourceType = SlotSourceTypes.Manual,
                PlaceholderLabel = GetExitLabel(i, phase.AdvancingSlotCount, phase.PoolCount)
            });
        }

        await _context.SaveChangesAsync();

        // Create pools if this is a multi-pool phase
        if (phase.PoolCount > 1)
        {
            await CreatePhasePools(phase.Id, phase.PoolCount, phase.IncomingSlotCount);
        }

        return phase;
    }

    private string GetExitLabel(int slotNumber, int total, int poolCount = 1)
    {
        // For pool phases, generate pool-based exit labels
        // E.g., with 2 pools and 4 exit slots: Pool A #1, Pool B #1, Pool A #2, Pool B #2
        if (poolCount > 1)
        {
            int poolIndex = (slotNumber - 1) % poolCount;
            int positionInPool = ((slotNumber - 1) / poolCount) + 1;
            char poolLetter = (char)('A' + poolIndex);
            return $"Pool {poolLetter} #{positionInPool}";
        }

        // For non-pool phases, use standard placement labels
        return slotNumber switch
        {
            1 => "Champion",
            2 => "Runner-up",
            3 => "3rd Place",
            4 => "4th Place",
            _ => $"#{slotNumber}"
        };
    }

    private async Task CreatePhasePools(int phaseId, int poolCount, int totalSlots)
    {
        var slots = await _context.PhaseSlots
            .Where(s => s.PhaseId == phaseId && s.SlotType == SlotTypes.Incoming)
            .OrderBy(s => s.SlotNumber)
            .ToListAsync();

        // Create all pools first
        var pools = new List<PhasePool>();
        for (int p = 0; p < poolCount; p++)
        {
            int poolSlotCount = totalSlots / poolCount + (p < totalSlots % poolCount ? 1 : 0);
            var pool = new PhasePool
            {
                PhaseId = phaseId,
                PoolName = ((char)('A' + p)).ToString(),
                PoolOrder = p + 1,
                SlotCount = poolSlotCount
            };
            _context.PhasePools.Add(pool);
            pools.Add(pool);
        }
        await _context.SaveChangesAsync();

        // Sequential round-robin fill: 1→A, 2→B, 3→C, 4→A, 5→B, 6→C...
        for (int i = 0; i < slots.Count; i++)
        {
            int poolIndex = i % poolCount;
            int positionInPool = i / poolCount + 1;
            var poolSlot = new PhasePoolSlot
            {
                PoolId = pools[poolIndex].Id,
                SlotId = slots[i].Id,
                PoolPosition = positionInPool
            };
            _context.PhasePoolSlots.Add(poolSlot);
        }
        await _context.SaveChangesAsync();
    }

    private async Task CreateAdvancementRuleFromJson(JsonElement ruleJson, Dictionary<int, DivisionPhase> phases)
    {
        // Support both old format (fromPhase/toPhase) and new visual editor format (sourcePhaseOrder/targetPhaseOrder)
        var fromPhaseOrder = ruleJson.TryGetProperty("sourcePhaseOrder", out var spo) ? spo.GetInt32()
            : ruleJson.TryGetProperty("fromPhase", out var fp) ? fp.GetInt32() : 0;
        var toPhaseOrder = ruleJson.TryGetProperty("targetPhaseOrder", out var tpo) ? tpo.GetInt32()
            : ruleJson.TryGetProperty("toPhase", out var tp) ? tp.GetInt32() : 0;

        if (!phases.TryGetValue(fromPhaseOrder, out var fromPhase) ||
            !phases.TryGetValue(toPhaseOrder, out var toPhase))
        {
            return; // Skip invalid rules
        }

        var targetSlot = ruleJson.TryGetProperty("targetSlotNumber", out var tsn) ? tsn.GetInt32()
            : ruleJson.TryGetProperty("toSlot", out var ts) ? ts.GetInt32() : 1;
        var sourceRank = ruleJson.TryGetProperty("finishPosition", out var fpos) ? fpos.GetInt32()
            : ruleJson.TryGetProperty("fromRank", out var rank) ? rank.GetInt32() : 1;

        var rule = new PhaseAdvancementRule
        {
            SourcePhaseId = fromPhase.Id,
            TargetPhaseId = toPhase.Id,
            TargetSlotNumber = targetSlot,
            SourceRank = sourceRank,
        };

        // Resolve pool-specific rules: sourcePoolIndex → SourcePoolId
        if (ruleJson.TryGetProperty("sourcePoolIndex", out var poolIdx) && poolIdx.ValueKind == JsonValueKind.Number)
        {
            var poolIndex = poolIdx.GetInt32();
            var pool = await _context.PhasePools
                .Where(p => p.PhaseId == fromPhase.Id && p.PoolOrder == poolIndex + 1) // poolIndex is 0-based, PoolOrder is 1-based
                .FirstOrDefaultAsync();
            if (pool != null)
            {
                rule.SourcePoolId = pool.Id;
            }
        }

        _context.PhaseAdvancementRules.Add(rule);
    }

    private async Task GenerateAutoAdvancementRules(Dictionary<int, DivisionPhase> phases)
    {
        var orderedPhases = phases.OrderBy(kv => kv.Key).Select(kv => kv.Value).ToList();
        
        // Group phases: identify parallel pool phases vs sequential phases
        // Phases with "Pool" in name at same level are parallel (both receive from prior, both feed to next)
        var processedIndices = new HashSet<int>();
        
        for (int i = 0; i < orderedPhases.Count; i++)
        {
            if (processedIndices.Contains(i)) continue;
            
            var currentPhase = orderedPhases[i];
            
            // Check if this is a pool phase and find all parallel pool phases
            // Detect pool phases by: "Pool" in name, "RoundRobin" type, or PoolCount > 1
            var isPoolPhase = IsPoolPhase(currentPhase);
            var parallelPools = new List<(int index, DivisionPhase phase)> { (i, currentPhase) };
            
            if (isPoolPhase)
            {
                // Find other pool phases at similar position (consecutive pool phases are parallel)
                for (int j = i + 1; j < orderedPhases.Count; j++)
                {
                    var nextPhase = orderedPhases[j];
                    var nextIsPool = IsPoolPhase(nextPhase);
                    if (nextIsPool)
                    {
                        parallelPools.Add((j, nextPhase));
                        processedIndices.Add(j);
                    }
                    else
                    {
                        break; // Stop at first non-pool phase
                    }
                }
            }
            
            processedIndices.Add(i);
            
            if (parallelPools.Count > 1)
            {
                // Multiple parallel pool phases - all receive from the phase before first pool
                var sourcePhase = i > 0 ? orderedPhases[i - 1] : null;
                var targetPhaseIndex = parallelPools.Max(p => p.index) + 1;
                var targetPhase = targetPhaseIndex < orderedPhases.Count ? orderedPhases[targetPhaseIndex] : null;
                
                if (sourcePhase != null)
                {
                    // Distribute source advancing slots across all pools
                    // E.g., 11 teams from Draw → 5 to Pool A, 6 to Pool B
                    int totalPoolSlots = parallelPools.Sum(p => p.phase.IncomingSlotCount);
                    int slotOffset = 0;
                    
                    foreach (var (_, poolPhase) in parallelPools)
                    {
                        for (int slot = 1; slot <= poolPhase.IncomingSlotCount; slot++)
                        {
                            _context.PhaseAdvancementRules.Add(new PhaseAdvancementRule
                            {
                                SourcePhaseId = sourcePhase.Id,
                                TargetPhaseId = poolPhase.Id,
                                SourceRank = slotOffset + slot,
                                TargetSlotNumber = slot
                            });
                        }
                        slotOffset += poolPhase.IncomingSlotCount;
                    }
                }
                
                if (targetPhase != null)
                {
                    // All pools feed into next phase (e.g., Semifinals)
                    // Cross-pool seeding: Pool A #1, Pool B #1, Pool A #2, Pool B #2, etc.
                    int targetSlot = 1;
                    int maxAdvancing = parallelPools.Max(p => p.phase.AdvancingSlotCount);
                    
                    for (int rank = 1; rank <= maxAdvancing && targetSlot <= targetPhase.IncomingSlotCount; rank++)
                    {
                        foreach (var (_, poolPhase) in parallelPools)
                        {
                            if (rank <= poolPhase.AdvancingSlotCount && targetSlot <= targetPhase.IncomingSlotCount)
                            {
                                _context.PhaseAdvancementRules.Add(new PhaseAdvancementRule
                                {
                                    SourcePhaseId = poolPhase.Id,
                                    TargetPhaseId = targetPhase.Id,
                                    SourceRank = rank,
                                    TargetSlotNumber = targetSlot++
                                });
                            }
                        }
                    }
                    
                    // Mark target phase as processed since we handled advancement to it
                    processedIndices.Add(targetPhaseIndex);
                }
            }
            else
            {
                // Single phase - simple sequential advancement to next phase
                if (i < orderedPhases.Count - 1)
                {
                    var targetPhase = orderedPhases[i + 1];
                    var advancingCount = Math.Min(currentPhase.AdvancingSlotCount, targetPhase.IncomingSlotCount);
                    
                    for (int slot = 1; slot <= advancingCount; slot++)
                    {
                        _context.PhaseAdvancementRules.Add(new PhaseAdvancementRule
                        {
                            SourcePhaseId = currentPhase.Id,
                            TargetPhaseId = targetPhase.Id,
                            SourceRank = slot,
                            TargetSlotNumber = slot
                        });
                    }
                }
            }
        }
    }

    /// <summary>
    /// Detect if a phase is a pool/round-robin phase that should be grouped with parallel phases
    /// </summary>
    private static bool IsPoolPhase(DivisionPhase phase)
    {
        // Check name patterns: "Pool", "RoundRobin", or single letter suffix (A, B, C...)
        var name = phase.Name ?? "";
        var hasPoolInName = name.Contains("Pool", StringComparison.OrdinalIgnoreCase);
        var hasRoundRobinInName = name.Contains("RoundRobin", StringComparison.OrdinalIgnoreCase);
        
        // Check if name ends with a single letter (Pool A, Pool B, RoundRobin A, etc.)
        var trimmedName = name.Trim();
        var endsWithPoolLetter = trimmedName.Length > 1 && 
            char.IsLetter(trimmedName[^1]) && 
            (trimmedName.Length < 2 || trimmedName[^2] == ' ');
        
        // Check phase type
        var isRoundRobinType = phase.PhaseType == PhaseTypes.RoundRobin || phase.PhaseType == PhaseTypes.Pools;
        
        // Check pool count
        var hasMultiplePools = phase.PoolCount > 1;
        
        return hasPoolInName || hasRoundRobinInName || hasMultiplePools || 
               (isRoundRobinType && endsWithPoolLetter);
    }

    #endregion
}
