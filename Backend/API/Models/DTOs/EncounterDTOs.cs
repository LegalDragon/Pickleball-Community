namespace Pickleball.Community.Models.DTOs;

// =====================================================
// Encounter Match Format DTOs
// =====================================================

/// <summary>
/// DTO for viewing an encounter match format template
/// </summary>
public class EncounterMatchFormatDto
{
    public int Id { get; set; }
    public int DivisionId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public int MatchNumber { get; set; }
    public int MaleCount { get; set; }
    public int FemaleCount { get; set; }
    public int UnisexCount { get; set; }
    public int TotalPlayers { get; set; }
    public int BestOf { get; set; }
    public int? ScoreFormatId { get; set; }
    public string? ScoreFormatName { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

/// <summary>
/// DTO for creating/updating an encounter match format
/// </summary>
public class EncounterMatchFormatCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public int MatchNumber { get; set; } = 1;
    public int MaleCount { get; set; } = 0;
    public int FemaleCount { get; set; } = 0;
    public int UnisexCount { get; set; } = 0;
    public int BestOf { get; set; } = 1;
    public int? ScoreFormatId { get; set; }
    public int SortOrder { get; set; } = 0;
}

// =====================================================
// Event Encounter DTOs
// =====================================================

/// <summary>
/// DTO for viewing an encounter summary (list view)
/// </summary>
public class EventEncounterSummaryDto
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int DivisionId { get; set; }
    public string RoundType { get; set; } = "Pool";
    public int RoundNumber { get; set; }
    public string? RoundName { get; set; }
    public int EncounterNumber { get; set; }
    public int? DivisionMatchNumber { get; set; }
    public int? Unit1Id { get; set; }
    public string? Unit1Name { get; set; }
    public int? Unit2Id { get; set; }
    public string? Unit2Name { get; set; }
    public int Unit1EncounterScore { get; set; }
    public int Unit2EncounterScore { get; set; }
    public int? WinnerUnitId { get; set; }
    public string Status { get; set; } = "Scheduled";
    public DateTime? ScheduledTime { get; set; }
    public string? CourtLabel { get; set; }
    public int MatchCount { get; set; }
    public int CompletedMatchCount { get; set; }

    // Lineup locking status
    public bool Unit1LineupLocked { get; set; }
    public bool Unit2LineupLocked { get; set; }
    public bool BothLineupsLocked { get; set; }
}

/// <summary>
/// DTO for viewing full encounter details
/// </summary>
public class EventEncounterDetailDto
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int DivisionId { get; set; }
    public string? DivisionName { get; set; }
    public string RoundType { get; set; } = "Pool";
    public int RoundNumber { get; set; }
    public string? RoundName { get; set; }
    public int EncounterNumber { get; set; }
    public int? DivisionMatchNumber { get; set; }
    public int? Unit1Number { get; set; }
    public int? Unit2Number { get; set; }
    public int? Unit1Id { get; set; }
    public string? Unit1Name { get; set; }
    public int? Unit2Id { get; set; }
    public string? Unit2Name { get; set; }
    public int Unit1EncounterScore { get; set; }
    public int Unit2EncounterScore { get; set; }
    public int? WinnerUnitId { get; set; }
    public string Status { get; set; } = "Scheduled";
    public DateTime? ScheduledTime { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int? TournamentCourtId { get; set; }
    public string? CourtLabel { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Lineup locking status
    public bool Unit1LineupLocked { get; set; }
    public bool Unit2LineupLocked { get; set; }
    public DateTime? Unit1LineupLockedAt { get; set; }
    public DateTime? Unit2LineupLockedAt { get; set; }

    /// <summary>
    /// True when both units have locked their lineups - lineup is visible to all users
    /// </summary>
    public bool BothLineupsLocked { get; set; }

    // Matches within this encounter
    public List<EncounterMatchDto> Matches { get; set; } = new();

    // Unit rosters
    public List<EncounterUnitRosterDto> Unit1Roster { get; set; } = new();
    public List<EncounterUnitRosterDto> Unit2Roster { get; set; } = new();
}

/// <summary>
/// DTO for a player in the unit roster
/// </summary>
public class EncounterUnitRosterDto
{
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public string? Gender { get; set; }
    public bool IsCheckedIn { get; set; }
}

/// <summary>
/// DTO for creating an encounter
/// </summary>
public class EventEncounterCreateDto
{
    public int DivisionId { get; set; }
    public string RoundType { get; set; } = "Pool";
    public int RoundNumber { get; set; } = 1;
    public string? RoundName { get; set; }
    public int EncounterNumber { get; set; } = 1;
    public int? Unit1Number { get; set; }
    public int? Unit2Number { get; set; }
    public int? Unit1Id { get; set; }
    public int? Unit2Id { get; set; }
    public DateTime? ScheduledTime { get; set; }
    public int? TournamentCourtId { get; set; }
    public string? Notes { get; set; }
}

/// <summary>
/// DTO for updating an encounter
/// </summary>
public class EventEncounterUpdateDto
{
    public string? RoundName { get; set; }
    public int? Unit1Id { get; set; }
    public int? Unit2Id { get; set; }
    public DateTime? ScheduledTime { get; set; }
    public int? TournamentCourtId { get; set; }
    public string? Notes { get; set; }
}

// =====================================================
// Encounter Match DTOs
// =====================================================

/// <summary>
/// DTO for viewing an encounter match
/// </summary>
public class EncounterMatchDto
{
    public int Id { get; set; }
    public int EncounterId { get; set; }
    public int? FormatId { get; set; }
    public string FormatName { get; set; } = string.Empty;
    public int MaleCount { get; set; }
    public int FemaleCount { get; set; }
    public int UnisexCount { get; set; }
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public int Unit1HandicapPoints { get; set; }
    public int Unit2HandicapPoints { get; set; }
    public int? WinnerUnitId { get; set; }
    public string Status { get; set; } = "New";
    public int? TournamentCourtId { get; set; }
    public string? CourtLabel { get; set; }
    public DateTime? ScheduledTime { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    // Score submission status
    public int? ScoreSubmittedByUnitId { get; set; }
    public DateTime? ScoreSubmittedAt { get; set; }
    public int? ScoreConfirmedByUnitId { get; set; }
    public DateTime? ScoreConfirmedAt { get; set; }
    public bool IsScoreDisputed { get; set; }
    public string? ScoreDisputeReason { get; set; }

    public string? Notes { get; set; }

    // Players in this match
    public List<EncounterMatchPlayerDto> Unit1Players { get; set; } = new();
    public List<EncounterMatchPlayerDto> Unit2Players { get; set; } = new();

    // Games (for best-of series)
    public List<EncounterMatchGameDto> Games { get; set; } = new();
}

/// <summary>
/// DTO for a player in an encounter match
/// </summary>
public class EncounterMatchPlayerDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public int UnitId { get; set; }
    public int UnitSide { get; set; }
    public string? Gender { get; set; }
    public int? Position { get; set; }
}

/// <summary>
/// DTO for assigning players to a match
/// </summary>
public class EncounterMatchPlayerAssignDto
{
    public int UserId { get; set; }
    public int UnitSide { get; set; }
    public int? Position { get; set; }
}

/// <summary>
/// DTO for updating match players (bulk update)
/// </summary>
public class EncounterMatchPlayersUpdateDto
{
    public List<EncounterMatchPlayerAssignDto> Players { get; set; } = new();
}

/// <summary>
/// DTO for updating match scores
/// </summary>
public class EncounterMatchScoreUpdateDto
{
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public int? WinnerUnitId { get; set; }
}

/// <summary>
/// DTO for submitting match score
/// </summary>
public class EncounterMatchScoreSubmitDto
{
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public int SubmittingUnitId { get; set; }
}

/// <summary>
/// DTO for confirming match score
/// </summary>
public class EncounterMatchScoreConfirmDto
{
    public int ConfirmingUnitId { get; set; }
    public bool Confirmed { get; set; }
    public string? DisputeReason { get; set; }
}

// =====================================================
// Encounter Match Game DTOs
// =====================================================

/// <summary>
/// DTO for viewing an encounter match game
/// </summary>
public class EncounterMatchGameDto
{
    public int Id { get; set; }
    public int MatchId { get; set; }
    public int GameNumber { get; set; }
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public int? WinnerUnitId { get; set; }
    public string Status { get; set; } = "New";
    public int? ScoreFormatId { get; set; }
    public int? TournamentCourtId { get; set; }
    public string? CourtLabel { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
}

/// <summary>
/// DTO for updating game score
/// </summary>
public class EncounterMatchGameScoreUpdateDto
{
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public int? WinnerUnitId { get; set; }
    public string? Status { get; set; }
}

// =====================================================
// Division Encounter Configuration DTOs
// =====================================================

/// <summary>
/// DTO for division's encounter configuration
/// </summary>
public class DivisionEncounterConfigDto
{
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public int? MatchesPerEncounter { get; set; }
    public bool AllowPlayerReuseInEncounter { get; set; }
    public bool AllowLineupChangePerEncounter { get; set; }
    public List<EncounterMatchFormatDto> MatchFormats { get; set; } = new();
}

/// <summary>
/// DTO for updating division's encounter configuration
/// </summary>
public class DivisionEncounterConfigUpdateDto
{
    public int? MatchesPerEncounter { get; set; }
    public bool AllowPlayerReuseInEncounter { get; set; }
    public bool AllowLineupChangePerEncounter { get; set; }
    public List<EncounterMatchFormatCreateDto> MatchFormats { get; set; } = new();
}

// =====================================================
// Lineup Locking DTOs
// =====================================================

/// <summary>
/// DTO for toggling lineup lock status
/// </summary>
public class LineupLockToggleDto
{
    /// <summary>
    /// Which unit side (1 or 2) is locking/unlocking
    /// </summary>
    public int UnitSide { get; set; }

    /// <summary>
    /// True to lock, false to unlock
    /// </summary>
    public bool Locked { get; set; }
}

/// <summary>
/// Response for lineup lock operations
/// </summary>
public class LineupLockResultDto
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public bool Unit1LineupLocked { get; set; }
    public bool Unit2LineupLocked { get; set; }
    public bool BothLineupsLocked { get; set; }
    public DateTime? Unit1LineupLockedAt { get; set; }
    public DateTime? Unit2LineupLockedAt { get; set; }
}

// =====================================================
// Phase Match Settings DTOs
// =====================================================

/// <summary>
/// DTO for viewing phase-specific match settings
/// </summary>
public class PhaseMatchSettingsDto
{
    public int Id { get; set; }
    public int PhaseId { get; set; }
    public string? PhaseName { get; set; }
    public int? MatchFormatId { get; set; }
    public string? MatchFormatName { get; set; }
    public string? MatchFormatCode { get; set; }
    public int BestOf { get; set; }
    public int? ScoreFormatId { get; set; }
    public string? ScoreFormatName { get; set; }
}

/// <summary>
/// DTO for creating/updating phase match settings
/// </summary>
public class PhaseMatchSettingsCreateDto
{
    public int PhaseId { get; set; }
    public int? MatchFormatId { get; set; }
    public int BestOf { get; set; } = 1;
    public int? ScoreFormatId { get; set; }
}

/// <summary>
/// DTO for bulk updating phase match settings for a division
/// </summary>
public class DivisionPhaseSettingsUpdateDto
{
    public List<PhaseMatchSettingsCreateDto> Settings { get; set; } = new();
}

/// <summary>
/// DTO for retrieving all game settings for a division (organized by phase)
/// </summary>
public class DivisionGameSettingsDto
{
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public int? DefaultBestOf { get; set; }
    public int? DefaultScoreFormatId { get; set; }
    public string? DefaultScoreFormatName { get; set; }
    public List<PhaseGameSettingsDto> Phases { get; set; } = new();
    public List<EncounterMatchFormatDto> MatchFormats { get; set; } = new();
}

/// <summary>
/// DTO for phase-level game settings
/// </summary>
public class PhaseGameSettingsDto
{
    public int PhaseId { get; set; }
    public string PhaseName { get; set; } = string.Empty;
    public string PhaseType { get; set; } = string.Empty;
    public int PhaseOrder { get; set; }
    public List<PhaseMatchSettingsDto> MatchSettings { get; set; } = new();
}
