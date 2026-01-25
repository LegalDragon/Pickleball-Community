using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Template categories for organizing phase templates.
/// </summary>
public static class TemplateCategories
{
    public const string SingleElimination = "SingleElimination";
    public const string DoubleElimination = "DoubleElimination";
    public const string RoundRobin = "RoundRobin";
    public const string Pools = "Pools";
    public const string Combined = "Combined";
    public const string Custom = "Custom";
}

/// <summary>
/// Pre-built tournament phase template that TDs can select and apply to divisions.
/// Templates define the complete tournament structure including phases, slots, and advancement rules.
/// </summary>
public class PhaseTemplate
{
    public int Id { get; set; }

    /// <summary>
    /// Display name (e.g., "8-Team Single Elimination", "4 Pools + Bracket (16 teams)")
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Detailed description of the tournament format
    /// </summary>
    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Category for filtering: SingleElimination, DoubleElimination, RoundRobin, Pools, Combined, Custom
    /// </summary>
    [Required]
    [MaxLength(30)]
    public string Category { get; set; } = TemplateCategories.SingleElimination;

    /// <summary>
    /// Minimum number of units this template supports
    /// </summary>
    public int MinUnits { get; set; }

    /// <summary>
    /// Maximum number of units this template supports
    /// </summary>
    public int MaxUnits { get; set; }

    /// <summary>
    /// Default/recommended unit count for this template
    /// </summary>
    public int DefaultUnits { get; set; }

    /// <summary>
    /// Whether this is a system-provided template (vs user-created)
    /// System templates cannot be deleted by users
    /// </summary>
    public bool IsSystemTemplate { get; set; } = false;

    /// <summary>
    /// Whether this template is active and available for selection
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Sort order for display (lower = first)
    /// </summary>
    public int SortOrder { get; set; } = 100;

    /// <summary>
    /// JSON structure defining the complete tournament format.
    /// Schema:
    /// {
    ///   "phases": [
    ///     {
    ///       "order": 1,
    ///       "name": "Pool Play",
    ///       "type": "Pools",
    ///       "poolCount": 4,
    ///       "incomingSlots": 16,
    ///       "exitingSlots": 8,
    ///       "settings": {}
    ///     }
    ///   ],
    ///   "advancementRules": [
    ///     { "fromPhase": 1, "fromPool": "A", "fromRank": 1, "toPhase": 2, "toSlot": 1 }
    ///   ],
    ///   "seedingStrategy": "Snake",
    ///   "exitPositions": [
    ///     { "rank": 1, "label": "Champion", "awardType": "Gold" }
    ///   ]
    /// }
    /// </summary>
    [Required]
    public string StructureJson { get; set; } = "{}";

    /// <summary>
    /// Short visual representation or ASCII diagram of the format
    /// </summary>
    [MaxLength(1000)]
    public string? DiagramText { get; set; }

    /// <summary>
    /// Tags for search/filtering (comma-separated)
    /// </summary>
    [MaxLength(200)]
    public string? Tags { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// User who created this template (null for system templates)
    /// </summary>
    public int? CreatedByUserId { get; set; }

    // Navigation
    [ForeignKey("CreatedByUserId")]
    public User? CreatedBy { get; set; }
}
