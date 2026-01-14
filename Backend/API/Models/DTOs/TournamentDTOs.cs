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

    // Member-level payment info
    public bool HasPaid { get; set; }
    public DateTime? PaidAt { get; set; }
    public decimal AmountPaid { get; set; }
    public string? PaymentProofUrl { get; set; }
    public string? PaymentReference { get; set; }
    public string? ReferenceId { get; set; }
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
    public EventGameDto? CurrentGame { get; set; }
    public string? LocationDescription { get; set; }
    public int SortOrder { get; set; }
}

public class CreateTournamentCourtRequest
{
    public int EventId { get; set; }
    public int? VenueId { get; set; }
    public string CourtLabel { get; set; } = string.Empty;
    public string? LocationDescription { get; set; }
    public int SortOrder { get; set; }
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
    public int MatchId { get; set; }
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
    public int? TeamUnitId { get; set; }
    public string? TeamUnitName { get; set; }
    public int MaxUnits { get; set; }
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
}

// ============================================
// Schedule Export DTOs
// ============================================
public class ScheduleExportDto
{
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public string EventName { get; set; } = string.Empty;
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
    public int MatchNumber { get; set; }
    public int? Unit1Number { get; set; }
    public int? Unit2Number { get; set; }
    public string? Unit1Name { get; set; }
    public string? Unit2Name { get; set; }
    public string? CourtLabel { get; set; }
    public DateTime? ScheduledTime { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Score { get; set; } // "11-7, 9-11, 11-5"
    public string? WinnerName { get; set; }
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
    public int? UnitNumber { get; set; }
    public string? UnitName { get; set; }
    public int MatchesPlayed { get; set; }
    public int MatchesWon { get; set; }
    public int MatchesLost { get; set; }
    public int GamesWon { get; set; }
    public int GamesLost { get; set; }
    public int PointDifferential { get; set; }
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
}

// Payment DTOs
public class UploadPaymentProofRequest
{
    public string? PaymentProofUrl { get; set; }
    public string? PaymentReference { get; set; }
    public decimal? AmountPaid { get; set; }
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
    public string? ReferenceId { get; set; }
}
