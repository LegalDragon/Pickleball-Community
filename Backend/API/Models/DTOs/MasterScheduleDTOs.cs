namespace Pickleball.Community.Models.DTOs;

// ============================================
// Master Schedule Block DTOs
// ============================================

public class EventCourtScheduleBlockDto
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int DivisionId { get; set; }
    public string? DivisionName { get; set; }
    public string? DivisionColor { get; set; }
    public int? PhaseId { get; set; }
    public string? PhaseName { get; set; }
    public string? PhaseType { get; set; }
    public string? BlockLabel { get; set; }
    public List<int> CourtIds { get; set; } = new();
    public List<CourtSummaryDto> Courts { get; set; } = new();
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int? DependsOnBlockId { get; set; }
    public string? DependsOnBlockLabel { get; set; }
    public int DependencyBufferMinutes { get; set; }
    public int SortOrder { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; }
    public int? EstimatedMatchDurationMinutes { get; set; }
    public int? EncounterCount { get; set; }
    public int? ScheduledEncounterCount { get; set; }
    public DateTime? LastScheduledAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CourtSummaryDto
{
    public int Id { get; set; }
    public string CourtLabel { get; set; } = string.Empty;
}

public class CreateScheduleBlockRequest
{
    public int DivisionId { get; set; }
    public int? PhaseId { get; set; }
    public string? PhaseType { get; set; }
    public string? BlockLabel { get; set; }
    public List<int>? CourtIds { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? DependsOnBlockId { get; set; }
    public int DependencyBufferMinutes { get; set; } = 0;
    public int SortOrder { get; set; } = 0;
    public string? Notes { get; set; }
    public int? EstimatedMatchDurationMinutes { get; set; }
}

public class UpdateScheduleBlockRequest
{
    public int? DivisionId { get; set; }
    public int? PhaseId { get; set; }
    public string? PhaseType { get; set; }
    public string? BlockLabel { get; set; }
    public List<int>? CourtIds { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? DependsOnBlockId { get; set; }
    public int? DependencyBufferMinutes { get; set; }
    public int? SortOrder { get; set; }
    public string? Notes { get; set; }
    public bool? IsActive { get; set; }
    public int? EstimatedMatchDurationMinutes { get; set; }
}

// ============================================
// Master Schedule Timeline DTOs
// ============================================

public class MasterScheduleTimelineDto
{
    public int EventId { get; set; }
    public string? EventName { get; set; }
    public DateTime EventStartDate { get; set; }
    public DateTime EventEndDate { get; set; }
    public bool IsSchedulePublished { get; set; }
    public DateTime? SchedulePublishedAt { get; set; }
    
    /// <summary>
    /// All schedule blocks for the event
    /// </summary>
    public List<EventCourtScheduleBlockDto> Blocks { get; set; } = new();
    
    /// <summary>
    /// All courts available for the event
    /// </summary>
    public List<TimelineCourtBlocksDto> Courts { get; set; } = new();
    
    /// <summary>
    /// Division summary with colors
    /// </summary>
    public List<TimelineDivisionSummaryDto> Divisions { get; set; } = new();
    
    /// <summary>
    /// Any scheduling conflicts detected
    /// </summary>
    public List<ScheduleBlockConflictDto> Conflicts { get; set; } = new();
}

public class TimelineCourtBlocksDto
{
    public int Id { get; set; }
    public string CourtLabel { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    
    /// <summary>
    /// Schedule blocks that use this court
    /// </summary>
    public List<CourtBlockTimeSlotDto> TimeSlots { get; set; } = new();
}

public class CourtBlockTimeSlotDto
{
    public int BlockId { get; set; }
    public int DivisionId { get; set; }
    public string? DivisionName { get; set; }
    public string? DivisionColor { get; set; }
    public string? PhaseType { get; set; }
    public string? BlockLabel { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public bool HasConflict { get; set; }
}

public class TimelineDivisionSummaryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public int BlockCount { get; set; }
    public int EncounterCount { get; set; }
    public DateTime? FirstBlockStart { get; set; }
    public DateTime? LastBlockEnd { get; set; }
}

public class ScheduleBlockConflictDto
{
    public string ConflictType { get; set; } = string.Empty; // "CourtOverlap", "DependencyViolation"
    public int? CourtId { get; set; }
    public string? CourtLabel { get; set; }
    public int Block1Id { get; set; }
    public int Block2Id { get; set; }
    public string? Block1Label { get; set; }
    public string? Block2Label { get; set; }
    public string Message { get; set; } = string.Empty;
}

// ============================================
// Auto-Schedule DTOs
// ============================================

public class AutoScheduleRequest
{
    /// <summary>
    /// Specific block IDs to schedule (null = all active blocks)
    /// </summary>
    public List<int>? BlockIds { get; set; }
    
    /// <summary>
    /// Whether to clear existing encounter assignments first
    /// </summary>
    public bool ClearExisting { get; set; } = true;
    
    /// <summary>
    /// Whether to recalculate dependent block start times
    /// </summary>
    public bool RecalculateDependencies { get; set; } = true;
}

public class AutoScheduleResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public int BlocksProcessed { get; set; }
    public int EncountersScheduled { get; set; }
    public int ConflictsFound { get; set; }
    public List<BlockScheduleResult> BlockResults { get; set; } = new();
    public List<ScheduleBlockConflictDto> Conflicts { get; set; } = new();
}

public class BlockScheduleResult
{
    public int BlockId { get; set; }
    public string? BlockLabel { get; set; }
    public bool Success { get; set; }
    public string? Message { get; set; }
    public int EncountersScheduled { get; set; }
    public DateTime? CalculatedStartTime { get; set; }
    public DateTime? CalculatedEndTime { get; set; }
}

// ============================================
// Player Schedule DTOs
// ============================================

public class PlayerScheduleItemDto
{
    public int EncounterId { get; set; }
    public DateTime MatchTime { get; set; }
    public DateTime? EstimatedEndTime { get; set; }
    public int? CourtId { get; set; }
    public string? CourtLabel { get; set; }
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public int? PhaseId { get; set; }
    public string? PhaseName { get; set; }
    public string? PhaseType { get; set; }
    public string? RoundName { get; set; }
    public string? EncounterLabel { get; set; }
    
    /// <summary>
    /// Opponent team/player name
    /// </summary>
    public string? OpponentName { get; set; }
    public int? OpponentUnitId { get; set; }
    
    /// <summary>
    /// The player's team/unit name
    /// </summary>
    public string? MyTeamName { get; set; }
    public int? MyUnitId { get; set; }
    
    /// <summary>
    /// Match status: Scheduled, Ready, InProgress, Completed, Cancelled
    /// </summary>
    public string Status { get; set; } = string.Empty;
    
    /// <summary>
    /// Time until match starts (for upcoming matches)
    /// </summary>
    public string? TimeUntilMatch { get; set; }
    
    /// <summary>
    /// Whether this is a bye
    /// </summary>
    public bool IsBye { get; set; }
}

public class PlayerScheduleDto
{
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = string.Empty;
    
    /// <summary>
    /// All matches for the player, ordered by time
    /// </summary>
    public List<PlayerScheduleItemDto> Matches { get; set; } = new();
    
    /// <summary>
    /// Next upcoming match
    /// </summary>
    public PlayerScheduleItemDto? NextMatch { get; set; }
    
    /// <summary>
    /// Total matches scheduled
    /// </summary>
    public int TotalMatches { get; set; }
    
    /// <summary>
    /// Matches completed
    /// </summary>
    public int CompletedMatches { get; set; }
    
    /// <summary>
    /// Matches remaining
    /// </summary>
    public int RemainingMatches { get; set; }
}
