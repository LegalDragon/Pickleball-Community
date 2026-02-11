using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Phase types for tournament progression.
/// </summary>
public static class PhaseTypes
{
    public const string RoundRobin = "RoundRobin";
    public const string SingleElimination = "SingleElimination";
    public const string DoubleElimination = "DoubleElimination";
    public const string Swiss = "Swiss";
    public const string Pools = "Pools";
    public const string Bracket = "Bracket";
    /// <summary>
    /// Fine-grained bracket round (Semifinal, Final, etc.) - generates exactly IncomingSlotCount/2 matches
    /// Use this for separate phases like "Semifinal" → "Final" instead of one SingleElimination phase
    /// </summary>
    public const string BracketRound = "BracketRound";
    /// <summary>
    /// Draw phase - seeding/entry point, no encounters generated
    /// </summary>
    public const string Draw = "Draw";
    /// <summary>
    /// Award phase - exit point for placements (1st, 2nd, 3rd...), no encounters generated
    /// </summary>
    public const string Award = "Award";
}

/// <summary>
/// Seeding strategies for advancement from pools to bracket phases
/// </summary>
public static class SeedingStrategies
{
    /// <summary>
    /// Standard snake draft: 1A, 1B, 2B, 2A, 3A, 3B, 4B, 4A...
    /// </summary>
    public const string Snake = "Snake";
    /// <summary>
    /// Sequential: 1A, 2A, 3A, 4A, 1B, 2B, 3B, 4B...
    /// </summary>
    public const string Sequential = "Sequential";
    /// <summary>
    /// Cross-pool: 1A vs 2B, 1B vs 2A format
    /// </summary>
    public const string CrossPool = "CrossPool";
}

/// <summary>
/// Phase status tracking.
/// </summary>
public static class PhaseStatus
{
    public const string Pending = "Pending";
    public const string InProgress = "InProgress";
    public const string Completed = "Completed";
    public const string Locked = "Locked";
}

/// <summary>
/// Reseed options between phases.
/// </summary>
public static class ReseedOptions
{
    public const string PreserveSeeds = "PreserveSeeds";
    public const string ReseedByStandings = "ReseedByStandings";
    public const string Random = "Random";
}

/// <summary>
/// Represents a phase in a multi-phase tournament structure.
/// Examples: Pool Play -> Quarterfinals -> Semifinals -> Finals
/// </summary>
public class DivisionPhase
{
    public int Id { get; set; }

    public int DivisionId { get; set; }

    /// <summary>
    /// Sequence order within the division (1, 2, 3, etc.)
    /// </summary>
    public int PhaseOrder { get; set; } = 1;

    /// <summary>
    /// Type of phase: RoundRobin, SingleElimination, DoubleElimination, Swiss, Pools, Bracket
    /// </summary>
    [Required]
    [MaxLength(30)]
    public string PhaseType { get; set; } = PhaseTypes.RoundRobin;

    /// <summary>
    /// Human-readable name (e.g., "Pool Play", "Quarterfinals", "Championship Bracket")
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of this phase
    /// </summary>
    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Number of slots coming into this phase (from registrations or previous phase)
    /// </summary>
    public int IncomingSlotCount { get; set; }

    /// <summary>
    /// Number of slots advancing from this phase (0 for final phase)
    /// </summary>
    public int AdvancingSlotCount { get; set; }

    /// <summary>
    /// Status: Pending, InProgress, Completed, Locked
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = PhaseStatus.Pending;

    /// <summary>
    /// JSON configuration for ranking/tie-breaker criteria
    /// Example: {"primary":"wins","secondary":"point_differential","tertiary":"head_to_head"}
    /// </summary>
    [MaxLength(1000)]
    public string? RankingCriteria { get; set; }

    /// <summary>
    /// How to reseed units between phases: PreserveSeeds, ReseedByStandings, Random
    /// </summary>
    [MaxLength(30)]
    public string? ReseedOption { get; set; } = ReseedOptions.PreserveSeeds;

    /// <summary>
    /// JSON configuration for phase-type specific settings
    /// RoundRobin: {"games_per_match":2}
    /// SingleElim: {"consolation":true,"third_place_match":true}
    /// Pools: {"pool_count":4,"pool_size":4,"cross_pool_matches":false}
    /// </summary>
    [MaxLength(2000)]
    public string? Settings { get; set; }

    /// <summary>
    /// Best of X games for matches in this phase (can override division default)
    /// </summary>
    public int? BestOf { get; set; }

    /// <summary>
    /// Score format override for this phase
    /// </summary>
    public int? ScoreFormatId { get; set; }

    // =====================================================
    // Pool and Timing Configuration
    // =====================================================

    /// <summary>
    /// Number of pools in this phase (1 for single bracket, 2+ for multi-pool)
    /// </summary>
    public int PoolCount { get; set; } = 1;

    /// <summary>
    /// When this phase is scheduled to begin
    /// </summary>
    public DateTime? StartTime { get; set; }

    /// <summary>
    /// Calculated end time based on matches and duration
    /// </summary>
    public DateTime? EstimatedEndTime { get; set; }

    /// <summary>
    /// Estimated match duration in minutes (overrides division default).
    /// If set, used directly. If null, calculated from game settings.
    /// </summary>
    public int? EstimatedMatchDurationMinutes { get; set; }

    /// <summary>
    /// Estimated duration per game in minutes (e.g., 12 for rally to 11, 18 for rally to 21).
    /// Used with BestOf to calculate total match time.
    /// </summary>
    public int? GameDurationMinutes { get; set; }

    /// <summary>
    /// Time in minutes between games within the same match (changeover/break).
    /// Default: 2 minutes.
    /// </summary>
    public int ChangeoverMinutes { get; set; } = 2;

    /// <summary>
    /// Buffer time in minutes between different matches on the same court.
    /// Accounts for court transition, cleanup, etc.
    /// Default: 5 minutes.
    /// </summary>
    public int MatchBufferMinutes { get; set; } = 5;

    /// <summary>
    /// Whether this phase has been manually locked (no automatic slot resolution)
    /// </summary>
    public bool IsManuallyLocked { get; set; } = false;

    /// <summary>
    /// Include 3rd place (consolation) match for semifinal losers.
    /// Only applies to BracketRound phases with 4 incoming teams (semifinals).
    /// </summary>
    public bool IncludeConsolation { get; set; } = false;

    /// <summary>
    /// Seeding strategy when receiving from multiple pools: Snake, Sequential, CrossPool
    /// Snake = 1A, 1B, 2B, 2A (standard snake draft)
    /// </summary>
    [MaxLength(30)]
    public string? SeedingStrategy { get; set; } = SeedingStrategies.Snake;

    /// <summary>
    /// When this phase was locked/finalized
    /// </summary>
    public DateTime? LockedAt { get; set; }

    /// <summary>
    /// User who locked/finalized this phase
    /// </summary>
    public int? LockedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }

    [ForeignKey("ScoreFormatId")]
    public ScoreFormat? ScoreFormat { get; set; }

    [ForeignKey("LockedByUserId")]
    public User? LockedBy { get; set; }

    /// <summary>
    /// All slots in this phase (incoming and advancing)
    /// </summary>
    public ICollection<PhaseSlot> Slots { get; set; } = new List<PhaseSlot>();

    /// <summary>
    /// All encounters in this phase
    /// </summary>
    public ICollection<EventEncounter> Encounters { get; set; } = new List<EventEncounter>();

    /// <summary>
    /// Pools within this phase (for multi-pool formats)
    /// </summary>
    public ICollection<PhasePool> Pools { get; set; } = new List<PhasePool>();

    /// <summary>
    /// Advancement rules where this phase is the source
    /// </summary>
    [InverseProperty("SourcePhase")]
    public ICollection<PhaseAdvancementRule> OutgoingAdvancementRules { get; set; } = new List<PhaseAdvancementRule>();

    /// <summary>
    /// Advancement rules where this phase is the target
    /// </summary>
    [InverseProperty("TargetPhase")]
    public ICollection<PhaseAdvancementRule> IncomingAdvancementRules { get; set; } = new List<PhaseAdvancementRule>();
}
