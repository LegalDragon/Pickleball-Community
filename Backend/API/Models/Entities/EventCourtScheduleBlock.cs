using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// A scheduled block on the master schedule, representing when a division/phase
/// runs on specific courts. Enables TD to create a master schedule showing
/// which divisions run on which courts at what times.
/// </summary>
public class EventCourtScheduleBlock
{
    public int Id { get; set; }

    /// <summary>
    /// The event this schedule block belongs to
    /// </summary>
    public int EventId { get; set; }

    /// <summary>
    /// The division this block schedules (required)
    /// </summary>
    public int DivisionId { get; set; }

    /// <summary>
    /// Specific phase within the division (null = whole division)
    /// </summary>
    public int? PhaseId { get; set; }

    /// <summary>
    /// Phase type string for display: "RR", "QF", "SF", "Bronze", "Gold", "Pool", etc.
    /// Can be used independently of PhaseId for flexible labeling
    /// </summary>
    [MaxLength(30)]
    public string? PhaseType { get; set; }

    /// <summary>
    /// Human-readable label for the block (e.g., "MD 9 Round Robin", "WD 7.5 Semifinals")
    /// Auto-generated if not provided
    /// </summary>
    [MaxLength(100)]
    public string? BlockLabel { get; set; }

    /// <summary>
    /// JSON array of court IDs assigned to this block
    /// Example: [1, 2, 3, 4]
    /// </summary>
    [MaxLength(500)]
    public string? CourtIdsJson { get; set; }

    /// <summary>
    /// Scheduled start time for this block
    /// </summary>
    public DateTime StartTime { get; set; }

    /// <summary>
    /// Scheduled end time for this block (calculated or manual)
    /// </summary>
    public DateTime EndTime { get; set; }

    /// <summary>
    /// If this block depends on another block to finish first (handoff scheduling)
    /// Example: "WD 9 RR starts after MD 7.5 RR ends"
    /// </summary>
    public int? DependsOnBlockId { get; set; }

    /// <summary>
    /// Buffer time in minutes after the dependency block ends
    /// Default: 0 (starts immediately after dependency)
    /// </summary>
    public int DependencyBufferMinutes { get; set; } = 0;

    /// <summary>
    /// Sort order for display on timeline (lower = earlier)
    /// </summary>
    public int SortOrder { get; set; } = 0;

    /// <summary>
    /// Notes for the TD about this block
    /// </summary>
    [MaxLength(500)]
    public string? Notes { get; set; }

    /// <summary>
    /// Whether this block is active (soft delete)
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Estimated duration per encounter in this block (overrides division default)
    /// </summary>
    public int? EstimatedMatchDurationMinutes { get; set; }

    /// <summary>
    /// Number of encounters in this block (calculated)
    /// </summary>
    public int? EncounterCount { get; set; }

    /// <summary>
    /// When the auto-scheduler last processed this block
    /// </summary>
    public DateTime? LastScheduledAt { get; set; }

    // Audit fields
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation properties
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }

    [ForeignKey("PhaseId")]
    public DivisionPhase? Phase { get; set; }

    [ForeignKey("DependsOnBlockId")]
    public EventCourtScheduleBlock? DependsOnBlock { get; set; }

    [ForeignKey("CreatedByUserId")]
    public User? CreatedBy { get; set; }

    [ForeignKey("UpdatedByUserId")]
    public User? UpdatedBy { get; set; }

    /// <summary>
    /// Blocks that depend on this block
    /// </summary>
    [InverseProperty("DependsOnBlock")]
    public ICollection<EventCourtScheduleBlock> DependentBlocks { get; set; } = new List<EventCourtScheduleBlock>();

    // Helper properties (not mapped)
    
    /// <summary>
    /// Parses CourtIdsJson into a list of court IDs
    /// </summary>
    [NotMapped]
    public List<int> CourtIds
    {
        get
        {
            if (string.IsNullOrEmpty(CourtIdsJson)) return new List<int>();
            try
            {
                return System.Text.Json.JsonSerializer.Deserialize<List<int>>(CourtIdsJson) ?? new List<int>();
            }
            catch
            {
                return new List<int>();
            }
        }
        set
        {
            CourtIdsJson = System.Text.Json.JsonSerializer.Serialize(value ?? new List<int>());
        }
    }
}
