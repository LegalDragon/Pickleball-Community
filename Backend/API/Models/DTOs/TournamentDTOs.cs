namespace Pickleball.Community.Models.DTOs;

// ============================================
// Score Method DTOs (Admin-configurable scoring types)
// ============================================
public class ScoreMethodDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ShortCode { get; set; }
    public string? Description { get; set; }
    public string BaseType { get; set; } = "Rally"; // Classic or Rally
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public bool IsDefault { get; set; }
}

public class CreateScoreMethodDto
{
    public string Name { get; set; } = string.Empty;
    public string? ShortCode { get; set; }
    public string? Description { get; set; }
    public string BaseType { get; set; } = "Rally";
    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public bool IsDefault { get; set; } = false;
}

public class UpdateScoreMethodDto
{
    public string? Name { get; set; }
    public string? ShortCode { get; set; }
    public string? Description { get; set; }
    public string? BaseType { get; set; }
    public int? SortOrder { get; set; }
    public bool? IsActive { get; set; }
    public bool? IsDefault { get; set; }
}

// ============================================
// Score Format DTOs
// ============================================
public class ScoreFormatDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? ScoreMethodId { get; set; }
    public string? ScoreMethodName { get; set; }
    public string ScoringType { get; set; } = "Rally";
    public int MaxPoints { get; set; }
    public int WinByMargin { get; set; }
    public int CapAfter { get; set; }
    public bool SwitchEndsAtMidpoint { get; set; }
    public int? MidpointScore { get; set; }
    public int? TimeLimitMinutes { get; set; }
    public bool IsTiebreaker { get; set; }
    public bool IsDefault { get; set; }
    public bool IsPreset { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public int? EventId { get; set; }

    /// <summary>
    /// Short display string like "Rally 11-2" or "Rally 15-2 cap 19"
    /// </summary>
    public string ShortDisplay { get; set; } = string.Empty;
}

public class CreateScoreFormatRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? ScoreMethodId { get; set; }
    public string? ScoringType { get; set; }
    public int? MaxPoints { get; set; }
    public int? WinByMargin { get; set; }
    public int? CapAfter { get; set; }
    public bool? SwitchEndsAtMidpoint { get; set; }
    public int? MidpointScore { get; set; }
    public int? TimeLimitMinutes { get; set; }
    public bool? IsTiebreaker { get; set; }
    public bool? IsPreset { get; set; }
    public int? EventId { get; set; }
    public int? SortOrder { get; set; }
}

public class UpdateScoreFormatRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public int? ScoreMethodId { get; set; }
    public string? ScoringType { get; set; }
    public int? MaxPoints { get; set; }
    public int? WinByMargin { get; set; }
    public int? CapAfter { get; set; }
    public bool? SwitchEndsAtMidpoint { get; set; }
    public int? MidpointScore { get; set; }
    public int? TimeLimitMinutes { get; set; }
    public bool? IsTiebreaker { get; set; }
    public bool? IsActive { get; set; }
    public bool? IsDefault { get; set; }
    public int? SortOrder { get; set; }
}

/// <summary>
/// Request to find an existing format or create a new one if not found
/// </summary>
public class FindOrCreateScoreFormatRequest
{
    public int? ScoreMethodId { get; set; }
    public int MaxPoints { get; set; } = 11;
    public int WinByMargin { get; set; } = 2;
    public int CapAfter { get; set; } = 0;
    public bool SwitchEndsAtMidpoint { get; set; } = false;
    public int? MidpointScore { get; set; }
    public int? TimeLimitMinutes { get; set; }
    public bool IsTiebreaker { get; set; } = false;
    public int? EventId { get; set; } // For event-specific formats
}

// ============================================
// Event Unit DTOs
// ============================================
public class EventUnitDto
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public string? EventName { get; set; }
    public int DivisionId { get; set; }
    public string? DivisionName { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Computed display name based on naming rules:
    /// - Pairs (size=2) with 2 members: "FirstName1 & FirstName2"
    /// - Singles or incomplete pairs: stored Name
    /// - Teams (size>2): stored Name (captain can customize)
    /// </summary>
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>
    /// Whether captain has set a custom name.
    /// For pairs, if false, DisplayName is computed from member names.
    /// </summary>
    public bool HasCustomName { get; set; }
    public int? UnitNumber { get; set; }
    public int? PoolNumber { get; set; }
    public string? PoolName { get; set; }
    public int? Seed { get; set; }
    public string Status { get; set; } = "Registered";
    public int? WaitlistPosition { get; set; }
    public int CaptainUserId { get; set; }
    public string? CaptainName { get; set; }
    public string? CaptainProfileImageUrl { get; set; }

    /// <summary>
    /// High-level registration status: "Waiting for Captain Accept", "Looking for Partner", "Team Complete"
    /// Computed from unit completeness and member statuses
    /// </summary>
    public string RegistrationStatus { get; set; } = "Team Complete";

    /// <summary>
    /// How partners can join: "Approval" or "Code"
    /// </summary>
    public string JoinMethod { get; set; } = "Approval";

    /// <summary>
    /// Join code for code-based joining (only shown to captain)
    /// </summary>
    public string? JoinCode { get; set; }

    /// <summary>
    /// When true, join requests are automatically accepted without captain approval
    /// </summary>
    public bool AutoAcceptMembers { get; set; }

    // Stats
    public int MatchesPlayed { get; set; }
    public int MatchesWon { get; set; }
    public int MatchesLost { get; set; }
    public int GamesWon { get; set; }
    public int GamesLost { get; set; }
    public int PointsScored { get; set; }
    public int PointsAgainst { get; set; }
    public int PointDifferential => PointsScored - PointsAgainst;

    // Members (includes accepted members, pending invites, and pending join requests - no duplicates)
    public List<EventUnitMemberDto> Members { get; set; } = new();

    // Team unit info
    public int? TeamUnitId { get; set; }
    public int RequiredPlayers { get; set; }
    public bool IsComplete { get; set; }
    public bool AllCheckedIn { get; set; }

    // Payment info
    public string PaymentStatus { get; set; } = "Pending";
    public decimal AmountPaid { get; set; }
    public decimal AmountDue { get; set; }
    public string? PaymentProofUrl { get; set; }
    public string? PaymentReference { get; set; }
    public string? ReferenceId { get; set; }
    public DateTime? PaidAt { get; set; }

    public DateTime CreatedAt { get; set; }
}

public class EventUnitMemberDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? ProfileImageUrl { get; set; }
    public string Role { get; set; } = "Player";
    // InviteStatus: "Accepted", "Pending" (invited), or "Requested" (join request)
    public string InviteStatus { get; set; } = "Accepted";
    public bool IsCheckedIn { get; set; }
    public DateTime? CheckedInAt { get; set; }
    // For join requests - the request ID (null for regular members)
    public int? JoinRequestId { get; set; }

    // Waiver status
    public bool WaiverSigned { get; set; }
    public DateTime? WaiverSignedAt { get; set; }

    // Member-level payment info
    public bool HasPaid { get; set; }
    public DateTime? PaidAt { get; set; }
    public decimal AmountPaid { get; set; }
    public string? PaymentProofUrl { get; set; }
    public string? PaymentReference { get; set; }
    public string? ReferenceId { get; set; }
    public string? PaymentMethod { get; set; }
}

public class CreateUnitRequest
{
    public int EventId { get; set; }
    public int DivisionId { get; set; }
    public string? Name { get; set; }
    public List<int>? PartnerUserIds { get; set; } // For doubles
}

public class JoinUnitRequest
{
    public int UnitId { get; set; }
    public string? Message { get; set; }
    public int? SelectedFeeId { get; set; }
}

public class MoveRegistrationRequest
{
    public int NewDivisionId { get; set; }
}

public class SelfMoveDivisionRequest
{
    public int NewDivisionId { get; set; }
    public int? JoinUnitId { get; set; } // If set, join this existing unit; otherwise create new
    public string? NewUnitName { get; set; } // Optional name for new unit if creating
}

public class MergeRegistrationsRequest
{
    public int TargetUnitId { get; set; }
    public int SourceUnitId { get; set; }
}

public class RespondToJoinRequest
{
    public int RequestId { get; set; }
    public bool Accept { get; set; }
    public string? Message { get; set; }
}

public class UnitJoinRequestDto
{
    public int Id { get; set; }
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public int UserId { get; set; }
    public string? UserName { get; set; }
    public string? ProfileImageUrl { get; set; }
    public string? Message { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; }
}

public class MyUnitsDto
{
    public List<EventUnitDto> ActiveUnits { get; set; } = new();
    public List<EventUnitDto> PendingInvitations { get; set; } = new();
    public List<UnitJoinRequestDto> PendingJoinRequestsAsCaption { get; set; } = new();
    /// <summary>
    /// Join requests the user has submitted to join other teams (awaiting captain approval)
    /// </summary>
    public List<MyPendingJoinRequestSummaryDto> MyPendingJoinRequests { get; set; } = new();
}

/// <summary>
/// Summary of a pending join request the user has submitted
/// </summary>
public class MyPendingJoinRequestSummaryDto
{
    public int RequestId { get; set; }
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public int UnitId { get; set; }
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public string? TeamUnitName { get; set; }
    public string? CaptainName { get; set; }
    public string? CaptainProfileImageUrl { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; }
}

public class RespondToInvitationRequest
{
    public int UnitId { get; set; }
    public bool Accept { get; set; }
}

// ============================================
// Tournament Court DTOs
// ============================================
public class TournamentCourtDto
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int? VenueId { get; set; }
    public string? VenueName { get; set; }
    public string CourtLabel { get; set; } = string.Empty;
    public string Status { get; set; } = "Available";
    public int? CurrentGameId { get; set; }
    public CourtGameInfoDto? CurrentGame { get; set; }
    public CourtGameInfoDto? NextGame { get; set; }
    public string? LocationDescription { get; set; }
    public int SortOrder { get; set; }
}

/// <summary>
/// Game info for court display (current/next game)
/// </summary>
public class CourtGameInfoDto
{
    public int GameId { get; set; }
    public int? EncounterId { get; set; }
    public string? Unit1Name { get; set; }
    public string? Unit2Name { get; set; }
    public string? Unit1Players { get; set; }
    public string? Unit2Players { get; set; }
    public int? Unit1Score { get; set; }
    public int? Unit2Score { get; set; }
    public string? Status { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? QueuedAt { get; set; }
    public string? DivisionName { get; set; }
    public string? RoundName { get; set; }
    public int? GameNumber { get; set; }
}

public class CreateTournamentCourtRequest
{
    public int EventId { get; set; }
    public int? VenueId { get; set; }
    public string CourtLabel { get; set; } = string.Empty;
    public string? LocationDescription { get; set; }
    public int SortOrder { get; set; }
}

public class BulkCreateCourtsRequest
{
    /// <summary>
    /// Number of courts to create
    /// </summary>
    public int NumberOfCourts { get; set; }
    /// <summary>
    /// Optional prefix for court labels (default: "Court")
    /// </summary>
    public string? LabelPrefix { get; set; }
    /// <summary>
    /// Starting number for court labels (default: 1)
    /// </summary>
    public int StartingNumber { get; set; } = 1;
}

// ============================================
// Event Match DTOs
// ============================================
public class EventMatchDto
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int DivisionId { get; set; }
    public string? DivisionName { get; set; }
    public string RoundType { get; set; } = "Pool";
    public int RoundNumber { get; set; }
    public string? RoundName { get; set; }
    public int MatchNumber { get; set; }
    public int? DivisionMatchNumber { get; set; }
    public int? BracketPosition { get; set; }

    // Units
    public int? Unit1Number { get; set; }
    public int? Unit2Number { get; set; }
    public int? Unit1Id { get; set; }
    public int? Unit2Id { get; set; }
    public EventUnitDto? Unit1 { get; set; }
    public EventUnitDto? Unit2 { get; set; }

    public int BestOf { get; set; }
    public int? WinnerUnitId { get; set; }
    public string Status { get; set; } = "Scheduled";

    public DateTime? ScheduledTime { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public int? TournamentCourtId { get; set; }
    public string? CourtLabel { get; set; }
    public int? ScoreFormatId { get; set; }

    public List<EventGameDto> Games { get; set; } = new();

    // Calculated
    public int Unit1GamesWon { get; set; }
    public int Unit2GamesWon { get; set; }
}

public class CreateMatchScheduleRequest
{
    public int DivisionId { get; set; }
    public string ScheduleType { get; set; } = "RoundRobin"; // RoundRobin, SingleElimination, DoubleElimination, RoundRobinPlayoff
    public int? TargetUnits { get; set; } // Target number of units/placeholders in schedule (can be > registered units)
    public int? PoolCount { get; set; }
    public int? PlayoffFromPools { get; set; }

    // Pool phase configuration
    public int? PoolGamesPerMatch { get; set; } // 1, 3, or 5 games per pool match
    public int? PoolScoreFormatId { get; set; }

    // Playoff phase configuration
    public int? PlayoffGamesPerMatch { get; set; } // 1, 3, or 5 games per playoff match
    public int? PlayoffScoreFormatId { get; set; }

    // Legacy fields for backward compatibility
    public int BestOf { get; set; } = 1;
    public int? ScoreFormatId { get; set; }
}

public class AssignUnitNumbersRequest
{
    public List<UnitAssignment>? Assignments { get; set; }
}

public class UnitAssignment
{
    public int UnitId { get; set; }
    public int UnitNumber { get; set; }
}

// ============================================
// Event Game DTOs
// ============================================
public class EventGameDto
{
    public int Id { get; set; }
    public int EncounterMatchId { get; set; }
    public int GameNumber { get; set; }
    public int? ScoreFormatId { get; set; }
    public ScoreFormatDto? ScoreFormat { get; set; }

    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public int? WinnerUnitId { get; set; }

    public string Status { get; set; } = "New";
    public int? TournamentCourtId { get; set; }
    public string? CourtLabel { get; set; }

    public DateTime? QueuedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }

    public int? ScoreSubmittedByUnitId { get; set; }
    public DateTime? ScoreSubmittedAt { get; set; }
    public int? ScoreConfirmedByUnitId { get; set; }
    public DateTime? ScoreConfirmedAt { get; set; }
    public bool ScoreConfirmed => ScoreConfirmedByUnitId != null;

    public List<EventGamePlayerDto> Players { get; set; } = new();
}

public class EventGamePlayerDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? ProfileImageUrl { get; set; }
    public int UnitId { get; set; }
    public int? Position { get; set; }
}

public class AssignGameToCourtRequest
{
    public int GameId { get; set; }
    public int TournamentCourtId { get; set; }
}

public class PreAssignCourtRequest
{
    public int EncounterId { get; set; }
    public int? TournamentCourtId { get; set; } // null to unassign
}

public class BulkPreAssignCourtsRequest
{
    public int EventId { get; set; }
    public List<PreAssignCourtRequest> Assignments { get; set; } = new();
}

public class SubmitScoreRequest
{
    public int GameId { get; set; }
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
}

public class ConfirmScoreRequest
{
    public int GameId { get; set; }
    public bool Confirm { get; set; }
    public string? DisputeReason { get; set; }
}

public class UpdateGameStatusRequest
{
    public int GameId { get; set; }
    public string Status { get; set; } = string.Empty; // New, Ready, Queued, Started, Playing, Finished
}

public class AdminUpdateScoreRequest
{
    public int GameId { get; set; }
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public bool MarkAsFinished { get; set; } = false;
}

public class UpdateEncounterUnitsRequest
{
    public int EncounterId { get; set; }
    public int? Unit1Id { get; set; }
    public int? Unit2Id { get; set; }
}

// ============================================
// Check-in DTOs
// ============================================
public class CheckInRequest
{
    public int EventId { get; set; }
    public int? DivisionId { get; set; }
}

public class CheckInStatusDto
{
    public int EventId { get; set; }
    public int UserId { get; set; }
    public string? UserName { get; set; }
    public string? ProfileImageUrl { get; set; }
    public bool IsCheckedIn { get; set; }
    public DateTime? CheckedInAt { get; set; }
    public List<DivisionCheckInDto> Divisions { get; set; } = new();
}

public class DivisionCheckInDto
{
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public int? UnitId { get; set; }
    public string? UnitName { get; set; }
    public bool IsCheckedIn { get; set; }
    public DateTime? CheckedInAt { get; set; }
}

// ============================================
// Tournament Dashboard DTOs
// ============================================
public class TournamentDashboardDto
{
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public string TournamentStatus { get; set; } = "Draft";
    public List<DivisionStatusDto> Divisions { get; set; } = new();
    public List<TournamentCourtDto> Courts { get; set; } = new();
    public TournamentStatsDto Stats { get; set; } = new();
}

public class DivisionStatusDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? TeamUnitId { get; set; }
    public string? TeamUnitName { get; set; }
    public int? SkillLevelId { get; set; }
    public string? SkillLevelName { get; set; }
    public int? AgeGroupId { get; set; }
    public string? AgeGroupName { get; set; }
    public int MaxUnits { get; set; }
    public int? MaxPlayers { get; set; }
    public decimal? DivisionFee { get; set; }
    public bool IsActive { get; set; } = true;
    public int RegisteredUnits { get; set; }
    public int WaitlistedUnits { get; set; }
    public int CheckedInUnits { get; set; }
    public int TotalMatches { get; set; }
    public int CompletedMatches { get; set; }
    public int InProgressMatches { get; set; }
    public bool ScheduleReady { get; set; }
    public bool UnitsAssigned { get; set; }
}

public class TournamentStatsDto
{
    public int TotalRegistrations { get; set; }
    public int CheckedInPlayers { get; set; }
    public int TotalMatches { get; set; }
    public int CompletedMatches { get; set; }
    public int InProgressGames { get; set; }
    public int AvailableCourts { get; set; }
    public int InUseCourts { get; set; }

    // Payment stats
    public int PaymentsSubmitted { get; set; }
    public int PaymentsPaid { get; set; }
    public int PaymentsPending { get; set; }
    public decimal TotalAmountDue { get; set; }
    public decimal TotalAmountPaid { get; set; }

    // Join request stats
    public int PendingJoinRequests { get; set; }
}

/// <summary>
/// Detailed match and game statistics for a division
/// </summary>
public class DivisionMatchStatsDto
{
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public int TotalEncounters { get; set; }
    public int TotalMatches { get; set; }
    public int TotalGames { get; set; }
    public int CompletedEncounters { get; set; }
    public int CompletedMatches { get; set; }
    public int CompletedGames { get; set; }
    public int InProgressEncounters { get; set; }
    public int ScheduledEncounters { get; set; }
}

// ============================================
// Join Request DTOs (for TD/organizer view)
// ============================================

public class PendingJoinRequestDto
{
    public int RequestId { get; set; }
    public string RequesterName { get; set; } = string.Empty;
    public string? RequesterProfileImage { get; set; }
    public int RequesterUserId { get; set; }
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public string? Message { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class EventJoinRequestsDto
{
    public int EventId { get; set; }
    public List<PendingJoinRequestDto> PendingRequests { get; set; } = new();
}

// ============================================
// Schedule Export DTOs
// ============================================
public class ScheduleExportDto
{
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public string EventName { get; set; } = string.Empty;
    public string? ScheduleType { get; set; } // RoundRobin, RoundRobinPlayoff, SingleElimination, etc.
    public int? PlayoffFromPools { get; set; } // Number of teams advancing per pool to playoffs
    public int MatchesPerEncounter { get; set; } = 1; // Number of matches per encounter (1 for simple, 3+ for team scrimmages)
    public int GamesPerMatch { get; set; } = 1; // Best of X games per match
    public string? DefaultScoreFormat { get; set; } // e.g., "Rally to 11, win by 2"
    public DateTime ExportedAt { get; set; }
    public List<ScheduleRoundDto> Rounds { get; set; } = new();
    public List<PoolStandingsDto> PoolStandings { get; set; } = new();
}

public class ScheduleRoundDto
{
    public string RoundType { get; set; } = string.Empty;
    public int RoundNumber { get; set; }
    public string? RoundName { get; set; }
    public List<ScheduleMatchDto> Matches { get; set; } = new();
}

public class ScheduleMatchDto
{
    public int EncounterId { get; set; } // For linking to encounter details/editing
    public int MatchNumber { get; set; }
    public int? DivisionMatchNumber { get; set; }
    public int? Unit1Number { get; set; }
    public int? Unit2Number { get; set; }
    public string? Unit1Name { get; set; }
    public string? Unit2Name { get; set; }
    public string? Unit1SeedInfo { get; set; } // e.g., "Pool A #1" for playoff matches
    public string? Unit2SeedInfo { get; set; }
    public bool IsBye { get; set; } // True if one team has a bye
    public int? CourtId { get; set; } // TournamentCourtId for dropdown selection
    public string? CourtLabel { get; set; }
    public DateTime? ScheduledTime { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Score { get; set; } // "11-7, 9-11, 11-5"
    public string? WinnerName { get; set; }
    public List<ScheduleGameDto> Games { get; set; } = new(); // Individual games within the match
}

public class ScheduleGameDto
{
    public int GameId { get; set; }
    public int GameNumber { get; set; }
    public int? Unit1Score { get; set; }
    public int? Unit2Score { get; set; }
    public int? TournamentCourtId { get; set; }
    public string? CourtLabel { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public class PoolStandingsDto
{
    public int PoolNumber { get; set; }
    public string? PoolName { get; set; }
    public List<PoolStandingEntryDto> Standings { get; set; } = new();
}

public class PoolStandingEntryDto
{
    public int Rank { get; set; }
    public int? PoolNumber { get; set; }
    public string? PoolName { get; set; }
    public int? UnitNumber { get; set; }
    public int? UnitId { get; set; }
    public string? UnitName { get; set; }
    public List<TeamMemberInfoDto> Members { get; set; } = new(); // Team member details
    public int MatchesPlayed { get; set; }
    public int MatchesWon { get; set; }
    public int MatchesLost { get; set; }
    public int GamesWon { get; set; }
    public int GamesLost { get; set; }
    public int PointsFor { get; set; }
    public int PointsAgainst { get; set; }
    public int PointDifferential { get; set; }
}

/// <summary>
/// Lightweight member info for display in schedule/drawing results
/// </summary>
public class TeamMemberInfoDto
{
    public int UserId { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? ProfileImageUrl { get; set; }

    public string FullName => $"{FirstName} {LastName}".Trim();
}

// ============================================
// Event Registration Enhancement DTOs
// ============================================
public class EventRegistrationRequest
{
    public int EventId { get; set; }
    public List<int> DivisionIds { get; set; } = new();
    public string? PartnerName { get; set; } // For finding partner
    public int? PartnerUserId { get; set; } // If already have partner
    /// <summary>
    /// How partners can join: "Open" (anyone joins instantly, default), "FriendsOnly" (only friends), or "Approval" (captain approves)
    /// </summary>
    public string JoinMethod { get; set; } = "Open";
    /// <summary>
    /// When true, join requests will be automatically accepted without captain approval
    /// </summary>
    public bool AutoAcceptMembers { get; set; } = false;
    /// <summary>
    /// The selected fee option ID (if division has multiple fee options)
    /// </summary>
    public int? SelectedFeeId { get; set; }
}

public class EventDetailWithDivisionsDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int EventTypeId { get; set; }
    public string? EventTypeName { get; set; }
    public string? EventTypeIcon { get; set; }
    public string? EventTypeColor { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public DateTime? RegistrationOpenDate { get; set; }
    public DateTime? RegistrationCloseDate { get; set; }
    public string TournamentStatus { get; set; } = "Draft";
    public bool IsRegistrationOpen { get; set; }
    public string? VenueName { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public decimal RegistrationFee { get; set; }
    public decimal PerDivisionFee { get; set; }
    public string? PosterImageUrl { get; set; }
    public List<EventDivisionDetailDto> Divisions { get; set; } = new();
    public List<int> UserRegisteredDivisionIds { get; set; } = new(); // For logged in user
}

public class EventDivisionDetailDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? TeamUnitId { get; set; }
    public string? TeamUnitName { get; set; }
    public int TeamSize { get; set; }
    public string? SkillLevelName { get; set; }
    public string? AgeGroupName { get; set; }
    public decimal? DivisionFee { get; set; }
    public int? MaxUnits { get; set; }
    public int RegisteredCount { get; set; }
    public int CompletedCount { get; set; }
    public int WaitlistedCount { get; set; }
    public bool IsFull { get; set; }
    public bool HasWaitlist => WaitlistedCount > 0;
    public List<EventUnitDto> LookingForPartner { get; set; } = new(); // Units needing partners
    /// <summary>
    /// Available fee options for this division. If empty, use DivisionFee.
    /// </summary>
    public List<DivisionFeeDto> Fees { get; set; } = new();
}

// Payment DTOs
public class UploadPaymentProofRequest
{
    public string? PaymentProofUrl { get; set; }
    public string? PaymentReference { get; set; }
    public decimal? AmountPaid { get; set; }
    /// <summary>
    /// Payment method: Cash, Zelle, Venmo, PayPal, CreditCard, Check, Other
    /// </summary>
    public string? PaymentMethod { get; set; }
    /// <summary>
    /// List of member IDs to apply payment to. If null/empty, applies only to the submitting user.
    /// Allows a player to pay for the whole team by selecting all members.
    /// </summary>
    public List<int>? MemberIds { get; set; }
}

public class PaymentInfoDto
{
    public int UnitId { get; set; }
    public string PaymentStatus { get; set; } = "Pending";
    public decimal AmountPaid { get; set; }
    public decimal AmountDue { get; set; }
    public string? PaymentProofUrl { get; set; }
    public string? PaymentReference { get; set; }
    public string? ReferenceId { get; set; }
    public DateTime? PaidAt { get; set; }
}

public class MemberPaymentDto
{
    public int UserId { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public bool HasPaid { get; set; }
    public DateTime? PaidAt { get; set; }
    public decimal AmountPaid { get; set; }
    public string? PaymentProofUrl { get; set; }
    public string? PaymentReference { get; set; }
    public string? ReferenceId { get; set; }
    public string? UnitPaymentStatus { get; set; }
}

public class UpdateMemberPaymentRequest
{
    public bool? HasPaid { get; set; }
    public decimal? AmountPaid { get; set; }
    public string? PaymentProofUrl { get; set; }
    public string? PaymentReference { get; set; }
    public string? PaymentMethod { get; set; }
    public string? ReferenceId { get; set; }
}

public class ApplyPaymentToTeammatesRequest
{
    /// <summary>
    /// List of teammate user IDs to apply payment to
    /// </summary>
    public List<int> TargetMemberIds { get; set; } = new();
    /// <summary>
    /// If true, redistributes the source member's amount evenly across all members
    /// </summary>
    public bool RedistributeAmount { get; set; } = true;
}

// ==================== Payment Summary DTOs ====================

public class EventPaymentSummaryDto
{
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public decimal RegistrationFee { get; set; }
    public int TotalUnits { get; set; }
    public decimal TotalExpected { get; set; }
    public decimal TotalPaid { get; set; }
    public decimal TotalOutstanding { get; set; }
    public int UnitsFullyPaid { get; set; }
    public int UnitsPartiallyPaid { get; set; }
    public int UnitsUnpaid { get; set; }
    public bool IsBalanced { get; set; }
    public List<DivisionPaymentSummaryDto> DivisionPayments { get; set; } = new();
    public List<PaymentRecordDto> RecentPayments { get; set; } = new();
}

public class DivisionPaymentSummaryDto
{
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public decimal ExpectedFeePerUnit { get; set; }
    public int TotalUnits { get; set; }
    public decimal TotalExpected { get; set; }
    public decimal TotalPaid { get; set; }
    public int UnitsFullyPaid { get; set; }
    public int UnitsPartiallyPaid { get; set; }
    public int UnitsUnpaid { get; set; }
    public bool IsBalanced { get; set; }
    public List<UnitPaymentDto> Units { get; set; } = new();
}

public class UnitPaymentDto
{
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public string PaymentStatus { get; set; } = "Pending";
    public decimal AmountPaid { get; set; }
    public decimal AmountDue { get; set; }
    public string? PaymentProofUrl { get; set; }
    public string? PaymentReference { get; set; }
    public string? ReferenceId { get; set; }
    public DateTime? PaidAt { get; set; }
    public List<UnitMemberPaymentDto> Members { get; set; } = new();
}

public class UnitMemberPaymentDto
{
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? UserEmail { get; set; }
    public bool HasPaid { get; set; }
    public decimal AmountPaid { get; set; }
    public string? PaymentProofUrl { get; set; }
    public string? PaymentReference { get; set; }
    public DateTime? PaidAt { get; set; }
}

public class PaymentRecordDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? UserEmail { get; set; }
    public decimal Amount { get; set; }
    public string? PaymentMethod { get; set; }
    public string? PaymentReference { get; set; }
    public string? PaymentProofUrl { get; set; }
    public string? ReferenceId { get; set; }
    public string? Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? VerifiedAt { get; set; }

    /// <summary>
    /// Total amount applied to members
    /// </summary>
    public decimal TotalApplied { get; set; }

    /// <summary>
    /// Whether total applied equals amount paid
    /// </summary>
    public bool IsFullyApplied { get; set; }

    /// <summary>
    /// List of members this payment was applied to
    /// </summary>
    public List<PaymentApplicationDto> AppliedTo { get; set; } = new();
}

public class PaymentApplicationDto
{
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public decimal AmountApplied { get; set; }
}

// ============================================
// Admin Registration DTOs
// ============================================

/// <summary>
/// Request to add a user registration to an event (admin/organizer only)
/// </summary>
public class AdminAddRegistrationRequest
{
    /// <summary>
    /// The user ID to register for the event
    /// </summary>
    public int UserId { get; set; }

    /// <summary>
    /// The division ID to register the user for
    /// </summary>
    public int DivisionId { get; set; }

    /// <summary>
    /// Optional partner user ID for doubles/team events
    /// </summary>
    public int? PartnerUserId { get; set; }

    /// <summary>
    /// Whether to auto-check-in the user (for on-site registrations)
    /// </summary>
    public bool AutoCheckIn { get; set; } = false;
}

/// <summary>
/// User search result for admin registration
/// </summary>
public class UserSearchResultDto
{
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? ProfileImageUrl { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public bool IsAlreadyRegistered { get; set; }
}

// ============================================
// Court Planning DTOs
// ============================================

/// <summary>
/// Complete court planning data for an event
/// </summary>
public class CourtPlanningDto
{
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public DateTime EventStartDate { get; set; }
    public DateTime? EventEndDate { get; set; }
    public DateTime? SchedulePublishedAt { get; set; }
    public int? ScheduleConflictCount { get; set; }
    public DateTime? ScheduleValidatedAt { get; set; }
    public List<CourtGroupPlanningDto> CourtGroups { get; set; } = new();
    public List<CourtPlanningItemDto> UnassignedCourts { get; set; } = new();
    public List<DivisionPlanningDto> Divisions { get; set; } = new();
    public List<EncounterPlanningDto> Encounters { get; set; } = new();
}

public class CourtGroupPlanningDto
{
    public int Id { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public string? GroupCode { get; set; }
    public string? LocationArea { get; set; }
    public int CourtCount { get; set; }
    public int Priority { get; set; }
    public int SortOrder { get; set; }
    public List<CourtPlanningItemDto> Courts { get; set; } = new();
}

public class CourtPlanningItemDto
{
    public int Id { get; set; }
    public string CourtLabel { get; set; } = string.Empty;
    public string? Status { get; set; }
    public string? LocationDescription { get; set; }
    public int SortOrder { get; set; }
}

public class DivisionPlanningDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? BracketType { get; set; }
    public int UnitCount { get; set; }
    public int EncounterCount { get; set; }
    public int? EstimatedMatchDurationMinutes { get; set; }
    public int MatchesPerEncounter { get; set; } = 1;
    public DateTime? SchedulePublishedAt { get; set; }
    public List<DivisionCourtGroupAssignmentDto> AssignedCourtGroups { get; set; } = new();
    public List<DivisionPhasePlanningDto> Phases { get; set; } = new();
}

public class DivisionPhasePlanningDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string PhaseType { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public int EncounterCount { get; set; }
    public DateTime? EstimatedStartTime { get; set; }
    public DateTime? EstimatedEndTime { get; set; }
}

public class DivisionCourtGroupAssignmentDto
{
    public int Id { get; set; }
    public int CourtGroupId { get; set; }
    public string CourtGroupName { get; set; } = string.Empty;
    public int Priority { get; set; }
    public TimeSpan? ValidFromTime { get; set; }
    public TimeSpan? ValidToTime { get; set; }
    public string AssignmentMode { get; set; } = "Default";
    public string? PoolName { get; set; }
    public int? MatchFormatId { get; set; }
    public string? MatchFormatName { get; set; }
}

public class EncounterPlanningDto
{
    public int Id { get; set; }
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public int? PhaseId { get; set; }
    public string? PhaseName { get; set; }
    public string RoundType { get; set; } = string.Empty;
    public int RoundNumber { get; set; }
    public string? RoundName { get; set; }
    public int EncounterNumber { get; set; }
    public int? DivisionMatchNumber { get; set; }
    public string? EncounterLabel { get; set; }
    public int? Unit1Id { get; set; }
    public string? Unit1Name { get; set; }
    public int? Unit2Id { get; set; }
    public string? Unit2Name { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? CourtId { get; set; }
    public string? CourtLabel { get; set; }
    public int? CourtGroupId { get; set; }
    public DateTime? ScheduledTime { get; set; }
    public DateTime? EstimatedStartTime { get; set; }
    public DateTime? EstimatedEndTime { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public bool IsBye { get; set; }
}

// ============================================
// Court Planning Request DTOs
// ============================================

public class BulkCourtTimeAssignmentRequest
{
    public int EventId { get; set; }
    public List<CourtTimeAssignment> Assignments { get; set; } = new();
}

public class CourtTimeAssignment
{
    public int EncounterId { get; set; }
    public int? CourtId { get; set; }
    public DateTime? ScheduledTime { get; set; }
    public DateTime? EstimatedStartTime { get; set; }
}

public class DivisionCourtGroupsRequest
{
    public int DivisionId { get; set; }
    public List<int>? CourtGroupIds { get; set; }
    public TimeSpan? ValidFromTime { get; set; }
    public TimeSpan? ValidToTime { get; set; }
    public string AssignmentMode { get; set; } = "Default";
    public string? PoolName { get; set; }
    public int? MatchFormatId { get; set; }
}

public class AutoAssignRequest
{
    public DateTime? StartTime { get; set; }
    public int? MatchDurationMinutes { get; set; }
    public bool ClearExisting { get; set; } = true;
}

// ============================================
// Schedule Publishing DTOs
// ============================================

public class SchedulePublishRequest
{
    public int EventId { get; set; }
    public bool ValidateFirst { get; set; } = true;
}

public class ScheduleValidationResult
{
    public bool IsValid { get; set; }
    public int ConflictCount { get; set; }
    public int UnassignedEncounters { get; set; }
    public int DivisionsWithoutCourts { get; set; }
    public List<ScheduleConflictDto> Conflicts { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
}

public class ScheduleConflictDto
{
    public string ConflictType { get; set; } = string.Empty; // "CourtOverlap", "UnitOverlap", "TimeGap"
    public int CourtId { get; set; }
    public string CourtLabel { get; set; } = string.Empty;
    public int Encounter1Id { get; set; }
    public int? Encounter2Id { get; set; }
    public string Encounter1Label { get; set; } = string.Empty;
    public string? Encounter2Label { get; set; }
    public DateTime? ConflictStartTime { get; set; }
    public DateTime? ConflictEndTime { get; set; }
    public string Message { get; set; } = string.Empty;
}

// ============================================
// Timeline View DTOs
// ============================================

public class TimelineDataDto
{
    public int EventId { get; set; }
    public DateTime EventStartDate { get; set; }
    public DateTime EventEndDate { get; set; }
    public bool IsSchedulePublished { get; set; }
    public List<TimelineCourtDto> Courts { get; set; } = new();
    public List<TimelineDivisionDto> Divisions { get; set; } = new();
}

public class TimelineCourtDto
{
    public int Id { get; set; }
    public string CourtLabel { get; set; } = string.Empty;
    public int? CourtGroupId { get; set; }
    public string? CourtGroupName { get; set; }
    public string? LocationArea { get; set; }
    public int SortOrder { get; set; }
    public List<TimelineBlockDto> Blocks { get; set; } = new();
}

public class TimelineBlockDto
{
    public int EncounterId { get; set; }
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public string? DivisionColor { get; set; }
    public int? PhaseId { get; set; }
    public string? PhaseName { get; set; }
    public string? RoundName { get; set; }
    public string? EncounterLabel { get; set; }
    public string? Unit1Name { get; set; }
    public string? Unit2Name { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int DurationMinutes { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool HasConflict { get; set; }
}

public class TimelineDivisionDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Color { get; set; }
    public int EncounterCount { get; set; }
    public int AssignedCount { get; set; }
    public DateTime? FirstEncounterTime { get; set; }
    public DateTime? LastEncounterTime { get; set; }
}

public class DivisionCourtAssignmentRequest
{
    public int DivisionId { get; set; }
    public int CourtGroupId { get; set; }
    public int? PhaseId { get; set; }
    public string AssignmentMode { get; set; } = "Default";
    public string? PoolName { get; set; }
    public int? MatchFormatId { get; set; }
    public TimeSpan? ValidFromTime { get; set; }
    public TimeSpan? ValidToTime { get; set; }
    public int Priority { get; set; } = 0;
}

// =====================================================
// Division Fee DTOs
// =====================================================

/// <summary>
/// Fee option for a division or event, shown during registration.
/// DivisionId = 0 for event-level fees, actual ID for division fees.
/// </summary>
public class DivisionFeeDto
{
    public int Id { get; set; }
    /// <summary>
    /// Division this fee belongs to. 0 for event-level fees.
    /// </summary>
    public int DivisionId { get; set; }
    public int EventId { get; set; }
    /// <summary>
    /// Reference to the fee type template (required)
    /// </summary>
    public int FeeTypeId { get; set; }
    /// <summary>
    /// Name from the fee type
    /// </summary>
    public string Name { get; set; } = string.Empty;
    /// <summary>
    /// Description from the fee type
    /// </summary>
    public string? Description { get; set; }
    public decimal Amount { get; set; }
    public bool IsDefault { get; set; }
    public DateTime? AvailableFrom { get; set; }
    public DateTime? AvailableUntil { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    /// <summary>
    /// Whether this fee is currently available based on AvailableFrom/AvailableUntil dates
    /// </summary>
    public bool IsCurrentlyAvailable { get; set; }
    /// <summary>
    /// True if this is an event-level fee (DivisionId = 0)
    /// </summary>
    public bool IsEventFee => DivisionId == 0;
}

/// <summary>
/// Request to create or update a division/event fee.
/// FeeTypeId is required - name/description come from the fee type.
/// </summary>
public class DivisionFeeRequest
{
    /// <summary>
    /// Required: Reference to the fee type (provides name/description)
    /// </summary>
    public int FeeTypeId { get; set; }
    public decimal Amount { get; set; }
    public bool IsDefault { get; set; }
    public DateTime? AvailableFrom { get; set; }
    public DateTime? AvailableUntil { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; } = 0;
}

/// <summary>
/// Bulk update request for managing multiple division fees at once
/// </summary>
public class BulkDivisionFeesRequest
{
    public int DivisionId { get; set; }
    public List<DivisionFeeRequest> Fees { get; set; } = new();
}

// ============================================
// Event Fee Type DTOs
// ============================================

/// <summary>
/// Fee type template defined at event level, used by both event fees and division fees.
/// Just a name/description - amounts are set on DivisionFees.
/// </summary>
public class EventFeeTypeDto
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>
    /// Event-level fee amount for this fee type (if configured)
    /// </summary>
    public decimal? EventFeeAmount { get; set; }
    /// <summary>
    /// Whether there's an event-level fee configured for this type
    /// </summary>
    public bool HasEventFee { get; set; }
}

/// <summary>
/// Request to create or update an event fee type (just name/description)
/// </summary>
public class EventFeeTypeRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; } = 0;
}

/// <summary>
/// Bulk update request for managing all fee types for an event
/// </summary>
public class BulkEventFeeTypesRequest
{
    public List<EventFeeTypeRequest> FeeTypes { get; set; } = new();
}

// ============================================
// Registration Validation DTOs
// ============================================

/// <summary>
/// Result of registration validation
/// </summary>
public class RegistrationValidationResultDto
{
    public int TotalErrors { get; set; }
    public int TotalWarnings { get; set; }
    public int TotalInfo { get; set; }
    public List<ValidationSummaryItem> Summary { get; set; } = new();
    public List<ValidationIssue> Issues { get; set; } = new();
}

/// <summary>
/// Summary count by category
/// </summary>
public class ValidationSummaryItem
{
    public string Category { get; set; } = string.Empty;
    public string Severity { get; set; } = string.Empty;
    public int IssueCount { get; set; }
}

/// <summary>
/// Individual validation issue
/// </summary>
public class ValidationIssue
{
    public string Category { get; set; } = string.Empty;
    public string Severity { get; set; } = string.Empty;
    public int? DivisionId { get; set; }
    public string? DivisionName { get; set; }
    public int? UnitId { get; set; }
    public string? UnitName { get; set; }
    public int? UserId { get; set; }
    public string? UserName { get; set; }
    public string Message { get; set; } = string.Empty;
}
