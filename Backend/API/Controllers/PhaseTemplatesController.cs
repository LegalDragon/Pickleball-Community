using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;
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
                DiagramText = t.DiagramText,
                Tags = t.Tags
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
                DiagramText = t.DiagramText,
                Tags = t.Tags
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
                CreatedByName = t.CreatedBy != null ? t.CreatedBy.DisplayName : null
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
                DiagramText = t.DiagramText,
                Tags = t.Tags
            })
            .ToListAsync();

        return Ok(templates);
    }

    /// <summary>
    /// Create a custom template (Admin only)
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<PhaseTemplateDetailDto>> CreateTemplate([FromBody] PhaseTemplateCreateDto dto)
    {
        var userIdClaim = User.FindFirst("userId")?.Value;
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
    /// Update a template (Admin only, cannot modify system templates)
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<PhaseTemplateDetailDto>> UpdateTemplate(int id, [FromBody] PhaseTemplateCreateDto dto)
    {
        var template = await _context.PhaseTemplates.FindAsync(id);
        if (template == null)
            return NotFound("Template not found");

        if (template.IsSystemTemplate)
            return BadRequest("Cannot modify system templates");

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
    /// Delete (deactivate) a template (Admin only, cannot delete system templates)
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> DeleteTemplate(int id)
    {
        var template = await _context.PhaseTemplates.FindAsync(id);
        if (template == null)
            return NotFound("Template not found");

        if (template.IsSystemTemplate)
            return BadRequest("Cannot delete system templates");

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
            var structure = JsonDocument.Parse(template.StructureJson);
            var preview = GeneratePreview(template, structure, unitCount);
            return Ok(preview);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating template preview for template {TemplateId}", request.TemplateId);
            return BadRequest("Error parsing template structure");
        }
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
        var userIdClaim = User.FindFirst("userId")?.Value;
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
        var userIdClaim = User.FindFirst("userId")?.Value;
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
                UnitName = slot.Unit?.CustomName,
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
        var userIdClaim = User.FindFirst("userId")?.Value;
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
                UnitName = s.Unit != null ? s.Unit.CustomName : null,
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
        else if (root.TryGetProperty("phases", out var phases))
        {
            // Use defined phases
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

        // Clear existing phases if requested
        if (clearExisting && division.Phases?.Any() == true)
        {
            // Delete in correct order to respect FK constraints
            var phaseIds = division.Phases.Select(p => p.Id).ToList();

            // Delete advancement rules
            var rules = await _context.PhaseAdvancementRules
                .Where(r => phaseIds.Contains(r.SourcePhaseId) || phaseIds.Contains(r.TargetPhaseId))
                .ToListAsync();
            _context.PhaseAdvancementRules.RemoveRange(rules);

            // Delete encounters (they reference phases)
            var encounters = await _context.EventEncounters
                .Where(e => e.PhaseId.HasValue && phaseIds.Contains(e.PhaseId.Value))
                .ToListAsync();
            _context.EventEncounters.RemoveRange(encounters);

            // Delete slots
            var slots = await _context.PhaseSlots
                .Where(s => phaseIds.Contains(s.PhaseId))
                .ToListAsync();
            _context.PhaseSlots.RemoveRange(slots);

            // Delete pools
            var pools = await _context.PhasePools
                .Where(p => phaseIds.Contains(p.PhaseId))
                .ToListAsync();
            _context.PhasePools.RemoveRange(pools);

            // Delete phases
            _context.DivisionPhases.RemoveRange(division.Phases);
            await _context.SaveChangesAsync();
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
            result.TotalAdvancementRules = await _context.PhaseAdvancementRules
                .CountAsync(r => result.CreatedPhaseIds.Contains(r.SourcePhaseId) || result.CreatedPhaseIds.Contains(r.TargetPhaseId));
        }

        await _context.SaveChangesAsync();

        // Count created items
        result.TotalPhases = result.CreatedPhaseIds.Count;
        result.TotalSlots = await _context.PhaseSlots
            .CountAsync(s => result.CreatedPhaseIds.Contains(s.PhaseId));

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
                PlaceholderLabel = $"Seed {i}"
            });
        }

        // Create advancing/exit slots
        for (int i = 1; i <= preview.ExitingSlots; i++)
        {
            _context.PhaseSlots.Add(new PhaseSlot
            {
                PhaseId = phase.Id,
                SlotType = SlotTypes.Advancing,
                SlotNumber = i,
                SourceType = SlotSourceTypes.Manual,
                PlaceholderLabel = GetExitLabel(i, preview.ExitingSlots)
            });
        }

        return phase;
    }

    private async Task<DivisionPhase> CreatePhaseFromJson(int divisionId, JsonElement phaseJson)
    {
        var phase = new DivisionPhase
        {
            DivisionId = divisionId,
            PhaseOrder = phaseJson.GetProperty("order").GetInt32(),
            Name = phaseJson.GetProperty("name").GetString() ?? "",
            PhaseType = phaseJson.GetProperty("type").GetString() ?? PhaseTypes.RoundRobin,
            IncomingSlotCount = phaseJson.GetProperty("incomingSlots").GetInt32(),
            AdvancingSlotCount = phaseJson.GetProperty("exitingSlots").GetInt32(),
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
                PlaceholderLabel = $"Seed {i}"
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
                PlaceholderLabel = GetExitLabel(i, phase.AdvancingSlotCount)
            });
        }

        return phase;
    }

    private string GetExitLabel(int position, int total)
    {
        return position switch
        {
            1 => "Champion",
            2 => "Runner-up",
            3 => "3rd Place",
            4 => "4th Place",
            _ => $"#{position}"
        };
    }

    private async Task CreateAdvancementRuleFromJson(JsonElement ruleJson, Dictionary<int, DivisionPhase> phases)
    {
        var fromPhaseOrder = ruleJson.GetProperty("fromPhase").GetInt32();
        var toPhaseOrder = ruleJson.GetProperty("toPhase").GetInt32();

        if (!phases.TryGetValue(fromPhaseOrder, out var fromPhase) ||
            !phases.TryGetValue(toPhaseOrder, out var toPhase))
        {
            return; // Skip invalid rules
        }

        var rule = new PhaseAdvancementRule
        {
            SourcePhaseId = fromPhase.Id,
            TargetPhaseId = toPhase.Id,
            TargetSlotNumber = ruleJson.GetProperty("toSlot").GetInt32(),
            SourceRank = ruleJson.TryGetProperty("fromRank", out var rank) ? rank.GetInt32() : 1,
            SourcePoolName = ruleJson.TryGetProperty("fromPool", out var pool) ? pool.GetString() : null
        };

        _context.PhaseAdvancementRules.Add(rule);
    }

    private async Task GenerateAutoAdvancementRules(Dictionary<int, DivisionPhase> phases)
    {
        var orderedPhases = phases.OrderBy(kv => kv.Key).Select(kv => kv.Value).ToList();

        for (int i = 0; i < orderedPhases.Count - 1; i++)
        {
            var sourcePhase = orderedPhases[i];
            var targetPhase = orderedPhases[i + 1];

            // Create rules for each advancing slot
            var advancingCount = Math.Min(sourcePhase.AdvancingSlotCount, targetPhase.IncomingSlotCount);
            for (int slot = 1; slot <= advancingCount; slot++)
            {
                _context.PhaseAdvancementRules.Add(new PhaseAdvancementRule
                {
                    SourcePhaseId = sourcePhase.Id,
                    TargetPhaseId = targetPhase.Id,
                    SourceRank = slot,
                    TargetSlotNumber = slot
                });
            }
        }
    }

    #endregion
}
