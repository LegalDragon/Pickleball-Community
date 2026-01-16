namespace Pickleball.Community.Models.DTOs;

// =====================================================
// Game History DTOs
// =====================================================

public class PlayerGameHistoryDto
{
    public int GameId { get; set; }
    public int MatchId { get; set; }
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public string? EventType { get; set; }
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;

    public DateTime GameDate { get; set; }
    public int GameNumber { get; set; }

    // Scores
    public int PlayerScore { get; set; }
    public int OpponentScore { get; set; }
    public string ScoreDisplay { get; set; } = string.Empty; // "11-7"
    public bool IsWin { get; set; }
    public string Result { get; set; } = string.Empty; // "Win" or "Loss"

    // Partner info (for doubles)
    public int? PartnerId { get; set; }
    public string? PartnerName { get; set; }
    public string? PartnerProfileImageUrl { get; set; }

    // Opponents
    public List<GameOpponentDto> Opponents { get; set; } = new();

    // Match context
    public string? RoundType { get; set; } // Pool, Bracket, Final
    public string? RoundName { get; set; }
    public int MatchNumber { get; set; }
}

public class GameOpponentDto
{
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
}

public class GameHistorySearchRequest
{
    public int? PartnerUserId { get; set; }
    public int? OpponentUserId { get; set; }
    public string? PartnerName { get; set; }
    public string? OpponentName { get; set; }
    public DateTime? DateFrom { get; set; }
    public DateTime? DateTo { get; set; }
    public string? EventType { get; set; } // Tournament, League, Social, etc.
    public int? EventId { get; set; }
    public bool? WinsOnly { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class GameHistoryPagedResponse
{
    public List<PlayerGameHistoryDto> Games { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);

    // Summary stats
    public int TotalGames { get; set; }
    public int TotalWins { get; set; }
    public int TotalLosses { get; set; }
    public decimal WinPercentage { get; set; }
}

// =====================================================
// Awards History DTOs
// =====================================================

public class PlayerAwardDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string AwardType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? IconUrl { get; set; }
    public string? BadgeColor { get; set; }
    public int? PointsValue { get; set; }

    // Context
    public int? EventId { get; set; }
    public string? EventName { get; set; }
    public int? DivisionId { get; set; }
    public string? DivisionName { get; set; }
    public int? LeagueId { get; set; }
    public string? LeagueName { get; set; }
    public int? ClubId { get; set; }
    public string? ClubName { get; set; }

    public int? PlacementRank { get; set; }
    public DateTime AwardedAt { get; set; }
    public bool AwardedBySystem { get; set; }
    public string? AwardedByName { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool IsActive { get; set; }
    public bool IsExpired => ExpiresAt.HasValue && ExpiresAt.Value < DateTime.Now;
    public string? Notes { get; set; }
}

public class CreatePlayerAwardDto
{
    public int UserId { get; set; }
    public string AwardType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? IconUrl { get; set; }
    public string? BadgeColor { get; set; }
    public int? PointsValue { get; set; }
    public int? EventId { get; set; }
    public int? DivisionId { get; set; }
    public int? LeagueId { get; set; }
    public int? ClubId { get; set; }
    public int? SeasonId { get; set; }
    public int? PlacementRank { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string? Notes { get; set; }
}

public class AwardSearchRequest
{
    public string? AwardType { get; set; }
    public int? EventId { get; set; }
    public int? LeagueId { get; set; }
    public int? ClubId { get; set; }
    public DateTime? DateFrom { get; set; }
    public DateTime? DateTo { get; set; }
    public bool? ActiveOnly { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class AwardPagedResponse
{
    public List<PlayerAwardDto> Awards { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);

    // Summary
    public int TotalBadges { get; set; }
    public int TotalLeaguePoints { get; set; }
    public int NotableFinishes { get; set; }
}

// =====================================================
// Ratings History DTOs
// =====================================================

public class PlayerRatingHistoryDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public decimal Rating { get; set; }
    public decimal? PreviousRating { get; set; }
    public decimal? RatingChange { get; set; }
    public string RatingType { get; set; } = string.Empty;
    public string? Source { get; set; }
    public int? Confidence { get; set; }

    // Context
    public int? EventId { get; set; }
    public string? EventName { get; set; }
    public int? GameId { get; set; }

    public DateTime EffectiveDate { get; set; }
    public bool CalculatedBySystem { get; set; }
    public string? UpdatedByName { get; set; }
    public string? Notes { get; set; }
}

public class CreatePlayerRatingHistoryDto
{
    public int UserId { get; set; }
    public decimal Rating { get; set; }
    public string RatingType { get; set; } = string.Empty;
    public string? Source { get; set; }
    public int? Confidence { get; set; }
    public int? EventId { get; set; }
    public int? GameId { get; set; }
    public int? PeerReviewId { get; set; }
    public string? Notes { get; set; }
}

public class RatingHistorySearchRequest
{
    public string? RatingType { get; set; }
    public DateTime? DateFrom { get; set; }
    public DateTime? DateTo { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

public class RatingHistoryPagedResponse
{
    public List<PlayerRatingHistoryDto> Ratings { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);

    // Current state
    public decimal? CurrentRating { get; set; }
    public decimal? HighestRating { get; set; }
    public decimal? LowestRating { get; set; }
    public decimal? RatingTrend { get; set; } // Change over last 30 days
}

// =====================================================
// Combined Player History Summary
// =====================================================

public class PlayerHistorySummaryDto
{
    // Game stats
    public int TotalGamesPlayed { get; set; }
    public int TotalWins { get; set; }
    public int TotalLosses { get; set; }
    public decimal WinPercentage { get; set; }
    public DateTime? LastGameDate { get; set; }

    // Awards summary
    public int TotalAwards { get; set; }
    public int TotalBadges { get; set; }
    public int TotalLeaguePoints { get; set; }
    public int NotableFinishes { get; set; }
    public List<PlayerAwardDto> RecentAwards { get; set; } = new();

    // Rating summary
    public decimal? CurrentRating { get; set; }
    public string? CurrentRatingType { get; set; }
    public decimal? HighestRating { get; set; }
    public decimal? RatingTrend { get; set; }
    public List<PlayerRatingHistoryDto> RecentRatings { get; set; } = new();

    // Payment summary
    public int TotalPayments { get; set; }
    public decimal TotalAmountPaid { get; set; }
    public int PendingPayments { get; set; }
}

// =====================================================
// Payment History DTOs
// =====================================================

public class PlayerPaymentHistoryDto
{
    public int Id { get; set; }
    public int? EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public DateTime? EventDate { get; set; }
    public int? UnitId { get; set; }
    public string? UnitName { get; set; }
    public string? DivisionName { get; set; }
    public decimal Amount { get; set; }
    public string? PaymentMethod { get; set; }
    public string? PaymentReference { get; set; }
    public string? PaymentProofUrl { get; set; }
    public string? ReferenceId { get; set; }
    public string Status { get; set; } = "Pending";
    public bool IsApplied { get; set; }
    public DateTime? AppliedAt { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public string? VerifiedByName { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PaymentHistorySearchRequest
{
    public string? Status { get; set; }
    public int? EventId { get; set; }
    public DateTime? DateFrom { get; set; }
    public DateTime? DateTo { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class PaymentHistoryPagedResponse
{
    public List<PlayerPaymentHistoryDto> Payments { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);

    // Summary
    public decimal TotalAmountPaid { get; set; }
    public int TotalVerified { get; set; }
    public int TotalPending { get; set; }
}
