using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.DTOs;

/// <summary>
/// DTO for listing phase templates
/// </summary>
public class PhaseTemplateListDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = string.Empty;
    public int MinUnits { get; set; }
    public int MaxUnits { get; set; }
    public int DefaultUnits { get; set; }
    public bool IsSystemTemplate { get; set; }
    public bool IsActive { get; set; } = true;
    public string? DiagramText { get; set; }
    public string? Tags { get; set; }
    public string StructureJson { get; set; } = "{}";
}

/// <summary>
/// DTO for full template details including structure
/// </summary>
public class PhaseTemplateDetailDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = string.Empty;
    public int MinUnits { get; set; }
    public int MaxUnits { get; set; }
    public int DefaultUnits { get; set; }
    public bool IsSystemTemplate { get; set; }
    public int SortOrder { get; set; }
    public string StructureJson { get; set; } = "{}";
    public string? DiagramText { get; set; }
    public string? Tags { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public string? CreatedByName { get; set; }
}

/// <summary>
/// Request to create or update a template
/// </summary>
public class PhaseTemplateCreateDto
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [Required]
    [MaxLength(30)]
    public string Category { get; set; } = "SingleElimination";

    public int MinUnits { get; set; } = 4;
    public int MaxUnits { get; set; } = 64;
    public int DefaultUnits { get; set; } = 8;

    public int SortOrder { get; set; } = 100;

    [Required]
    public string StructureJson { get; set; } = "{}";

    [MaxLength(1000)]
    public string? DiagramText { get; set; }

    [MaxLength(200)]
    public string? Tags { get; set; }
}

/// <summary>
/// Request to apply a template to a division
/// </summary>
public class ApplyTemplateRequest
{
    [Required]
    public int TemplateId { get; set; }

    [Required]
    public int DivisionId { get; set; }

    /// <summary>
    /// Override unit count (null = use division's registered units or template default)
    /// </summary>
    public int? UnitCount { get; set; }

    /// <summary>
    /// Whether to clear existing phases before applying
    /// </summary>
    public bool ClearExistingPhases { get; set; } = true;
}

/// <summary>
/// Preview of what applying a template would create
/// </summary>
public class TemplatePreviewDto
{
    public int TemplateId { get; set; }
    public string TemplateName { get; set; } = string.Empty;
    public int UnitCount { get; set; }
    public List<TemplatePhasePreviewDto> Phases { get; set; } = new();
    public int TotalEncounters { get; set; }
    public int TotalRounds { get; set; }
    public List<TemplateAdvancementPreviewDto> AdvancementRules { get; set; } = new();
}

/// <summary>
/// Preview of a single phase in template
/// </summary>
public class TemplatePhasePreviewDto
{
    public int Order { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public int IncomingSlots { get; set; }
    public int ExitingSlots { get; set; }
    public int? PoolCount { get; set; }
    public int EncounterCount { get; set; }
    public bool IncludeConsolation { get; set; }
}

/// <summary>
/// Preview of advancement rules
/// </summary>
public class TemplateAdvancementPreviewDto
{
    public string FromPhase { get; set; } = string.Empty;
    public string FromDescription { get; set; } = string.Empty;  // "Pool A 1st", "Winner of Match 3"
    public string ToPhase { get; set; } = string.Empty;
    public int ToSlot { get; set; }
}

/// <summary>
/// Request to manually assign an exit slot
/// </summary>
public class ManualExitSlotRequest
{
    [Required]
    public int PhaseId { get; set; }

    [Required]
    public int SlotNumber { get; set; }

    [Required]
    public int UnitId { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }
}

/// <summary>
/// Response from manual slot assignment
/// </summary>
public class SlotAssignmentResultDto
{
    public bool Success { get; set; }
    public int SlotId { get; set; }
    public int SlotNumber { get; set; }
    public int UnitId { get; set; }
    public string? UnitName { get; set; }
    public string? Message { get; set; }
}

/// <summary>
/// Response from processing byes
/// </summary>
public class ByeProcessingResultDto
{
    public bool Success { get; set; }
    public int ByesProcessed { get; set; }
    public List<int> AdvancedUnitIds { get; set; } = new();
    public string? Message { get; set; }
}

/// <summary>
/// Result of applying a template
/// </summary>
public class ApplyTemplateResultDto
{
    public bool Success { get; set; }
    public int DivisionId { get; set; }
    public List<int> CreatedPhaseIds { get; set; } = new();
    public int TotalPhases { get; set; }
    public int TotalSlots { get; set; }
    public int TotalAdvancementRules { get; set; }
    public string? Message { get; set; }
}
