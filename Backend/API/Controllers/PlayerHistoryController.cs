using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Database;
using System.Security.Claims;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("player-history")]
public class PlayerHistoryController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<PlayerHistoryController> _logger;

    public PlayerHistoryController(ApplicationDbContext context, ILogger<PlayerHistoryController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    // =====================================================
    // Summary Endpoint
    // =====================================================

    /// <summary>
    /// Get player history summary (overview of all history types)
    /// </summary>
    [HttpGet("{userId}/summary")]
    public async Task<ActionResult<ApiResponse<PlayerHistorySummaryDto>>> GetSummary(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return NotFound(new ApiResponse<PlayerHistorySummaryDto> { Success = false, Message = "User not found" });

        // Game stats
        var gameStats = await _context.Set<EventGamePlayer>()
            .Where(gp => gp.UserId == userId && gp.Game != null && gp.Game.Status == "Finished")
            .Select(gp => new
            {
                gp.UnitId,
                WinnerUnitId = gp.Game!.WinnerUnitId,
                FinishedAt = gp.Game.FinishedAt
            })
            .ToListAsync();

        var totalGames = gameStats.Count;
        var totalWins = gameStats.Count(g => g.UnitId == g.WinnerUnitId);
        var totalLosses = totalGames - totalWins;
        var winPercentage = totalGames > 0 ? Math.Round((decimal)totalWins / totalGames * 100, 1) : 0;
        var lastGameDate = gameStats.Max(g => g.FinishedAt);

        // Awards summary
        var awards = await _context.Set<PlayerAward>()
            .Where(a => a.UserId == userId && a.IsActive)
            .ToListAsync();

        var totalAwards = awards.Count;
        var totalBadges = awards.Count(a => a.AwardType == "Badge");
        var totalLeaguePoints = awards.Where(a => a.AwardType == "LeaguePoints").Sum(a => a.PointsValue ?? 0);
        var notableFinishes = awards.Count(a => a.AwardType == "NotableFinish");

        var recentAwards = await _context.Set<PlayerAward>()
            .Where(a => a.UserId == userId && a.IsActive)
            .OrderByDescending(a => a.AwardedAt)
            .Take(5)
            .Select(a => new PlayerAwardDto
            {
                Id = a.Id,
                UserId = a.UserId,
                AwardType = a.AwardType,
                Title = a.Title,
                Description = a.Description,
                IconUrl = a.IconUrl,
                BadgeColor = a.BadgeColor,
                PointsValue = a.PointsValue,
                EventId = a.EventId,
                EventName = a.Event != null ? a.Event.Name : null,
                LeagueId = a.LeagueId,
                LeagueName = a.League != null ? a.League.Name : null,
                ClubId = a.ClubId,
                ClubName = a.Club != null ? a.Club.Name : null,
                PlacementRank = a.PlacementRank,
                AwardedAt = a.AwardedAt,
                AwardedBySystem = a.AwardedBySystem,
                IsActive = a.IsActive
            })
            .ToListAsync();

        // Rating summary
        var latestRating = await _context.Set<PlayerRatingHistory>()
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.EffectiveDate)
            .FirstOrDefaultAsync();

        var highestRating = await _context.Set<PlayerRatingHistory>()
            .Where(r => r.UserId == userId)
            .MaxAsync(r => (decimal?)r.Rating);

        var thirtyDaysAgo = DateTime.Now.AddDays(-30);
        var ratingTrend = await _context.Set<PlayerRatingHistory>()
            .Where(r => r.UserId == userId && r.EffectiveDate >= thirtyDaysAgo)
            .OrderByDescending(r => r.EffectiveDate)
            .Select(r => r.RatingChange)
            .FirstOrDefaultAsync();

        var recentRatings = await _context.Set<PlayerRatingHistory>()
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.EffectiveDate)
            .Take(5)
            .Select(r => new PlayerRatingHistoryDto
            {
                Id = r.Id,
                UserId = r.UserId,
                Rating = r.Rating,
                PreviousRating = r.PreviousRating,
                RatingChange = r.RatingChange,
                RatingType = r.RatingType,
                Source = r.Source,
                EffectiveDate = r.EffectiveDate,
                CalculatedBySystem = r.CalculatedBySystem
            })
            .ToListAsync();

        var summary = new PlayerHistorySummaryDto
        {
            TotalGamesPlayed = totalGames,
            TotalWins = totalWins,
            TotalLosses = totalLosses,
            WinPercentage = winPercentage,
            LastGameDate = lastGameDate,
            TotalAwards = totalAwards,
            TotalBadges = totalBadges,
            TotalLeaguePoints = totalLeaguePoints,
            NotableFinishes = notableFinishes,
            RecentAwards = recentAwards,
            CurrentRating = latestRating?.Rating,
            CurrentRatingType = latestRating?.RatingType,
            HighestRating = highestRating,
            RatingTrend = ratingTrend,
            RecentRatings = recentRatings
        };

        return Ok(new ApiResponse<PlayerHistorySummaryDto> { Success = true, Data = summary });
    }

    // =====================================================
    // Game History Endpoints
    // =====================================================

    /// <summary>
    /// Get player's game history with filtering
    /// </summary>
    [HttpGet("{userId}/games")]
    public async Task<ActionResult<ApiResponse<GameHistoryPagedResponse>>> GetGameHistory(
        int userId,
        [FromQuery] GameHistorySearchRequest? request = null)
    {
        request ??= new GameHistorySearchRequest();

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return NotFound(new ApiResponse<GameHistoryPagedResponse> { Success = false, Message = "User not found" });

        // Base query: get all games where this player participated
        var query = _context.Set<EventGamePlayer>()
            .Include(gp => gp.Game)
                .ThenInclude(g => g!.Match)
                    .ThenInclude(m => m!.Event)
                        .ThenInclude(e => e!.EventType)
            .Include(gp => gp.Game)
                .ThenInclude(g => g!.Match)
                    .ThenInclude(m => m!.Division)
            .Include(gp => gp.Game)
                .ThenInclude(g => g!.Players)
                    .ThenInclude(p => p.User)
            .Include(gp => gp.Unit)
            .Where(gp => gp.UserId == userId && gp.Game != null && gp.Game.Status == "Finished");

        // Apply filters
        if (request.DateFrom.HasValue)
        {
            query = query.Where(gp => gp.Game!.FinishedAt >= request.DateFrom.Value);
        }

        if (request.DateTo.HasValue)
        {
            query = query.Where(gp => gp.Game!.FinishedAt <= request.DateTo.Value);
        }

        if (!string.IsNullOrEmpty(request.EventType))
        {
            query = query.Where(gp => gp.Game!.Match!.Event!.EventType!.Name == request.EventType);
        }

        if (request.EventId.HasValue)
        {
            query = query.Where(gp => gp.Game!.Match!.EventId == request.EventId.Value);
        }

        if (request.WinsOnly == true)
        {
            query = query.Where(gp => gp.Game!.WinnerUnitId == gp.UnitId);
        }

        // Partner/Opponent name filtering will be done post-query due to complexity
        var allGames = await query
            .OrderByDescending(gp => gp.Game!.FinishedAt)
            .ToListAsync();

        // Build game history DTOs with partner/opponent info
        var gameHistoryList = new List<PlayerGameHistoryDto>();

        foreach (var gp in allGames)
        {
            var game = gp.Game!;
            var match = game.Match!;
            var evt = match.Event!;
            var division = match.Division!;

            var playerUnitId = gp.UnitId;
            var isWin = game.WinnerUnitId == playerUnitId;

            // Determine player's score and opponent's score
            var playerScore = match.Unit1Id == playerUnitId ? game.Unit1Score : game.Unit2Score;
            var opponentScore = match.Unit1Id == playerUnitId ? game.Unit2Score : game.Unit1Score;

            // Get partner (same unit, different user)
            var partner = game.Players
                .Where(p => p.UnitId == playerUnitId && p.UserId != userId)
                .Select(p => p.User)
                .FirstOrDefault();

            // Get opponents (different unit)
            var opponents = game.Players
                .Where(p => p.UnitId != playerUnitId)
                .Select(p => new GameOpponentDto
                {
                    UserId = p.UserId,
                    Name = p.User != null ? Utility.FormatName(p.User.LastName, p.User.FirstName) : "Unknown",
                    ProfileImageUrl = p.User?.ProfileImageUrl
                })
                .ToList();

            // Apply partner/opponent name filters
            if (!string.IsNullOrEmpty(request.PartnerName))
            {
                var partnerName = partner != null ? Utility.FormatName(partner.LastName, partner.FirstName).ToLower() : "";
                if (!partnerName.Contains(request.PartnerName.ToLower()))
                    continue;
            }

            if (request.PartnerUserId.HasValue && partner?.Id != request.PartnerUserId.Value)
                continue;

            if (!string.IsNullOrEmpty(request.OpponentName))
            {
                var hasMatchingOpponent = opponents.Any(o =>
                    o.Name.ToLower().Contains(request.OpponentName.ToLower()));
                if (!hasMatchingOpponent)
                    continue;
            }

            if (request.OpponentUserId.HasValue)
            {
                if (!opponents.Any(o => o.UserId == request.OpponentUserId.Value))
                    continue;
            }

            gameHistoryList.Add(new PlayerGameHistoryDto
            {
                GameId = game.Id,
                MatchId = match.Id,
                EventId = evt.Id,
                EventName = evt.Name,
                EventType = evt.EventType?.Name,
                DivisionId = division.Id,
                DivisionName = division.Name,
                GameDate = game.FinishedAt ?? game.CreatedAt,
                GameNumber = game.GameNumber,
                PlayerScore = playerScore,
                OpponentScore = opponentScore,
                ScoreDisplay = $"{playerScore}-{opponentScore}",
                IsWin = isWin,
                Result = isWin ? "Win" : "Loss",
                PartnerId = partner?.Id,
                PartnerName = partner != null ? Utility.FormatName(partner.LastName, partner.FirstName) : null,
                PartnerProfileImageUrl = partner?.ProfileImageUrl,
                Opponents = opponents,
                RoundType = match.RoundType,
                RoundName = match.RoundName,
                MatchNumber = match.MatchNumber
            });
        }

        // Calculate totals for summary
        var totalGames = gameHistoryList.Count;
        var totalWins = gameHistoryList.Count(g => g.IsWin);
        var totalLosses = totalGames - totalWins;
        var winPercentage = totalGames > 0 ? Math.Round((decimal)totalWins / totalGames * 100, 1) : 0;

        // Paginate
        var totalCount = gameHistoryList.Count;
        var pagedGames = gameHistoryList
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToList();

        var response = new GameHistoryPagedResponse
        {
            Games = pagedGames,
            TotalCount = totalCount,
            Page = request.Page,
            PageSize = request.PageSize,
            TotalGames = totalGames,
            TotalWins = totalWins,
            TotalLosses = totalLosses,
            WinPercentage = winPercentage
        };

        return Ok(new ApiResponse<GameHistoryPagedResponse> { Success = true, Data = response });
    }

    // =====================================================
    // Awards History Endpoints
    // =====================================================

    /// <summary>
    /// Get player's awards with filtering
    /// </summary>
    [HttpGet("{userId}/awards")]
    public async Task<ActionResult<ApiResponse<AwardPagedResponse>>> GetAwards(
        int userId,
        [FromQuery] AwardSearchRequest? request = null)
    {
        request ??= new AwardSearchRequest();

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return NotFound(new ApiResponse<AwardPagedResponse> { Success = false, Message = "User not found" });

        var query = _context.Set<PlayerAward>()
            .Include(a => a.Event)
            .Include(a => a.Division)
            .Include(a => a.League)
            .Include(a => a.Club)
            .Include(a => a.AwardedBy)
            .Where(a => a.UserId == userId);

        // Apply filters
        if (!string.IsNullOrEmpty(request.AwardType))
        {
            query = query.Where(a => a.AwardType == request.AwardType);
        }

        if (request.EventId.HasValue)
        {
            query = query.Where(a => a.EventId == request.EventId.Value);
        }

        if (request.LeagueId.HasValue)
        {
            query = query.Where(a => a.LeagueId == request.LeagueId.Value);
        }

        if (request.ClubId.HasValue)
        {
            query = query.Where(a => a.ClubId == request.ClubId.Value);
        }

        if (request.DateFrom.HasValue)
        {
            query = query.Where(a => a.AwardedAt >= request.DateFrom.Value);
        }

        if (request.DateTo.HasValue)
        {
            query = query.Where(a => a.AwardedAt <= request.DateTo.Value);
        }

        if (request.ActiveOnly == true)
        {
            query = query.Where(a => a.IsActive && (!a.ExpiresAt.HasValue || a.ExpiresAt > DateTime.Now));
        }

        var totalCount = await query.CountAsync();

        var awards = await query
            .OrderByDescending(a => a.AwardedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(a => new PlayerAwardDto
            {
                Id = a.Id,
                UserId = a.UserId,
                AwardType = a.AwardType,
                Title = a.Title,
                Description = a.Description,
                IconUrl = a.IconUrl,
                BadgeColor = a.BadgeColor,
                PointsValue = a.PointsValue,
                EventId = a.EventId,
                EventName = a.Event != null ? a.Event.Name : null,
                DivisionId = a.DivisionId,
                DivisionName = a.Division != null ? a.Division.Name : null,
                LeagueId = a.LeagueId,
                LeagueName = a.League != null ? a.League.Name : null,
                ClubId = a.ClubId,
                ClubName = a.Club != null ? a.Club.Name : null,
                PlacementRank = a.PlacementRank,
                AwardedAt = a.AwardedAt,
                AwardedBySystem = a.AwardedBySystem,
                AwardedByName = a.AwardedBy != null ? Utility.FormatName(a.AwardedBy.LastName, a.AwardedBy.FirstName) : null,
                ExpiresAt = a.ExpiresAt,
                IsActive = a.IsActive,
                Notes = a.Notes
            })
            .ToListAsync();

        // Calculate summary stats (from all awards, not just current page)
        var allAwards = await _context.Set<PlayerAward>()
            .Where(a => a.UserId == userId && a.IsActive)
            .ToListAsync();

        var response = new AwardPagedResponse
        {
            Awards = awards,
            TotalCount = totalCount,
            Page = request.Page,
            PageSize = request.PageSize,
            TotalBadges = allAwards.Count(a => a.AwardType == "Badge"),
            TotalLeaguePoints = allAwards.Where(a => a.AwardType == "LeaguePoints").Sum(a => a.PointsValue ?? 0),
            NotableFinishes = allAwards.Count(a => a.AwardType == "NotableFinish")
        };

        return Ok(new ApiResponse<AwardPagedResponse> { Success = true, Data = response });
    }

    /// <summary>
    /// Create a new award for a player (admin only or system)
    /// </summary>
    [HttpPost("awards")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PlayerAwardDto>>> CreateAward([FromBody] CreatePlayerAwardDto dto)
    {
        var currentUserId = GetUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(new ApiResponse<PlayerAwardDto> { Success = false, Message = "Unauthorized" });

        // Check if current user is admin
        var currentUser = await _context.Users.FindAsync(currentUserId.Value);
        if (currentUser?.Role != "Admin")
            return Forbid();

        var targetUser = await _context.Users.FindAsync(dto.UserId);
        if (targetUser == null)
            return NotFound(new ApiResponse<PlayerAwardDto> { Success = false, Message = "Target user not found" });

        // Get previous rating if this is a rating update
        decimal? previousRating = null;
        if (!string.IsNullOrEmpty(dto.AwardType))
        {
            var lastRating = await _context.Set<PlayerRatingHistory>()
                .Where(r => r.UserId == dto.UserId)
                .OrderByDescending(r => r.EffectiveDate)
                .FirstOrDefaultAsync();
            previousRating = lastRating?.Rating;
        }

        var award = new PlayerAward
        {
            UserId = dto.UserId,
            AwardType = dto.AwardType,
            Title = dto.Title,
            Description = dto.Description,
            IconUrl = dto.IconUrl,
            BadgeColor = dto.BadgeColor,
            PointsValue = dto.PointsValue,
            EventId = dto.EventId,
            DivisionId = dto.DivisionId,
            LeagueId = dto.LeagueId,
            ClubId = dto.ClubId,
            SeasonId = dto.SeasonId,
            PlacementRank = dto.PlacementRank,
            AwardedAt = DateTime.Now,
            AwardedBySystem = false,
            AwardedByUserId = currentUserId.Value,
            ExpiresAt = dto.ExpiresAt,
            Notes = dto.Notes
        };

        _context.Set<PlayerAward>().Add(award);
        await _context.SaveChangesAsync();

        // Reload with navigation properties
        await _context.Entry(award).Reference(a => a.Event).LoadAsync();
        await _context.Entry(award).Reference(a => a.League).LoadAsync();
        await _context.Entry(award).Reference(a => a.Club).LoadAsync();
        await _context.Entry(award).Reference(a => a.AwardedBy).LoadAsync();

        var result = new PlayerAwardDto
        {
            Id = award.Id,
            UserId = award.UserId,
            AwardType = award.AwardType,
            Title = award.Title,
            Description = award.Description,
            IconUrl = award.IconUrl,
            BadgeColor = award.BadgeColor,
            PointsValue = award.PointsValue,
            EventId = award.EventId,
            EventName = award.Event?.Name,
            LeagueId = award.LeagueId,
            LeagueName = award.League?.Name,
            ClubId = award.ClubId,
            ClubName = award.Club?.Name,
            PlacementRank = award.PlacementRank,
            AwardedAt = award.AwardedAt,
            AwardedBySystem = award.AwardedBySystem,
            AwardedByName = award.AwardedBy != null ? Utility.FormatName(award.AwardedBy.LastName, award.AwardedBy.FirstName) : null,
            ExpiresAt = award.ExpiresAt,
            IsActive = award.IsActive,
            Notes = award.Notes
        };

        return Ok(new ApiResponse<PlayerAwardDto> { Success = true, Data = result });
    }

    // =====================================================
    // Ratings History Endpoints
    // =====================================================

    /// <summary>
    /// Get player's rating history
    /// </summary>
    [HttpGet("{userId}/ratings")]
    public async Task<ActionResult<ApiResponse<RatingHistoryPagedResponse>>> GetRatings(
        int userId,
        [FromQuery] RatingHistorySearchRequest? request = null)
    {
        request ??= new RatingHistorySearchRequest();

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return NotFound(new ApiResponse<RatingHistoryPagedResponse> { Success = false, Message = "User not found" });

        var query = _context.Set<PlayerRatingHistory>()
            .Include(r => r.Event)
            .Include(r => r.UpdatedBy)
            .Where(r => r.UserId == userId);

        // Apply filters
        if (!string.IsNullOrEmpty(request.RatingType))
        {
            query = query.Where(r => r.RatingType == request.RatingType);
        }

        if (request.DateFrom.HasValue)
        {
            query = query.Where(r => r.EffectiveDate >= request.DateFrom.Value);
        }

        if (request.DateTo.HasValue)
        {
            query = query.Where(r => r.EffectiveDate <= request.DateTo.Value);
        }

        var totalCount = await query.CountAsync();

        var ratings = await query
            .OrderByDescending(r => r.EffectiveDate)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(r => new PlayerRatingHistoryDto
            {
                Id = r.Id,
                UserId = r.UserId,
                Rating = r.Rating,
                PreviousRating = r.PreviousRating,
                RatingChange = r.RatingChange,
                RatingType = r.RatingType,
                Source = r.Source,
                Confidence = r.Confidence,
                EventId = r.EventId,
                EventName = r.Event != null ? r.Event.Name : null,
                GameId = r.GameId,
                EffectiveDate = r.EffectiveDate,
                CalculatedBySystem = r.CalculatedBySystem,
                UpdatedByName = r.UpdatedBy != null ? Utility.FormatName(r.UpdatedBy.LastName, r.UpdatedBy.FirstName) : null,
                Notes = r.Notes
            })
            .ToListAsync();

        // Calculate summary stats
        var allRatings = await _context.Set<PlayerRatingHistory>()
            .Where(r => r.UserId == userId)
            .ToListAsync();

        var currentRating = allRatings.OrderByDescending(r => r.EffectiveDate).FirstOrDefault()?.Rating;
        var highestRating = allRatings.Any() ? allRatings.Max(r => r.Rating) : (decimal?)null;
        var lowestRating = allRatings.Any() ? allRatings.Min(r => r.Rating) : (decimal?)null;

        // Rating trend over last 30 days
        var thirtyDaysAgo = DateTime.Now.AddDays(-30);
        var recentRatings = allRatings.Where(r => r.EffectiveDate >= thirtyDaysAgo).OrderBy(r => r.EffectiveDate).ToList();
        decimal? ratingTrend = null;
        if (recentRatings.Count >= 2)
        {
            ratingTrend = recentRatings.Last().Rating - recentRatings.First().Rating;
        }

        var response = new RatingHistoryPagedResponse
        {
            Ratings = ratings,
            TotalCount = totalCount,
            Page = request.Page,
            PageSize = request.PageSize,
            CurrentRating = currentRating,
            HighestRating = highestRating,
            LowestRating = lowestRating,
            RatingTrend = ratingTrend
        };

        return Ok(new ApiResponse<RatingHistoryPagedResponse> { Success = true, Data = response });
    }

    /// <summary>
    /// Add a rating history entry (admin/system only)
    /// </summary>
    [HttpPost("ratings")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PlayerRatingHistoryDto>>> CreateRating([FromBody] CreatePlayerRatingHistoryDto dto)
    {
        var currentUserId = GetUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(new ApiResponse<PlayerRatingHistoryDto> { Success = false, Message = "Unauthorized" });

        // Check if current user is admin
        var currentUser = await _context.Users.FindAsync(currentUserId.Value);
        if (currentUser?.Role != "Admin")
            return Forbid();

        var targetUser = await _context.Users.FindAsync(dto.UserId);
        if (targetUser == null)
            return NotFound(new ApiResponse<PlayerRatingHistoryDto> { Success = false, Message = "Target user not found" });

        // Get previous rating
        var lastRating = await _context.Set<PlayerRatingHistory>()
            .Where(r => r.UserId == dto.UserId)
            .OrderByDescending(r => r.EffectiveDate)
            .FirstOrDefaultAsync();

        var previousRating = lastRating?.Rating;
        var ratingChange = previousRating.HasValue ? dto.Rating - previousRating.Value : (decimal?)null;

        var rating = new PlayerRatingHistory
        {
            UserId = dto.UserId,
            Rating = dto.Rating,
            PreviousRating = previousRating,
            RatingChange = ratingChange,
            RatingType = dto.RatingType,
            Source = dto.Source,
            Confidence = dto.Confidence,
            EventId = dto.EventId,
            GameId = dto.GameId,
            PeerReviewId = dto.PeerReviewId,
            CalculatedBySystem = false,
            UpdatedByUserId = currentUserId.Value,
            EffectiveDate = DateTime.Now,
            Notes = dto.Notes
        };

        _context.Set<PlayerRatingHistory>().Add(rating);
        await _context.SaveChangesAsync();

        await _context.Entry(rating).Reference(r => r.Event).LoadAsync();
        await _context.Entry(rating).Reference(r => r.UpdatedBy).LoadAsync();

        var result = new PlayerRatingHistoryDto
        {
            Id = rating.Id,
            UserId = rating.UserId,
            Rating = rating.Rating,
            PreviousRating = rating.PreviousRating,
            RatingChange = rating.RatingChange,
            RatingType = rating.RatingType,
            Source = rating.Source,
            Confidence = rating.Confidence,
            EventId = rating.EventId,
            EventName = rating.Event?.Name,
            GameId = rating.GameId,
            EffectiveDate = rating.EffectiveDate,
            CalculatedBySystem = rating.CalculatedBySystem,
            UpdatedByName = rating.UpdatedBy != null ? Utility.FormatName(rating.UpdatedBy.LastName, rating.UpdatedBy.FirstName) : null,
            Notes = rating.Notes
        };

        return Ok(new ApiResponse<PlayerRatingHistoryDto> { Success = true, Data = result });
    }

    // =====================================================
    // Helper Endpoints
    // =====================================================

    /// <summary>
    /// Get available event types for filtering
    /// </summary>
    [HttpGet("event-types")]
    public async Task<ActionResult<ApiResponse<List<string>>>> GetEventTypes()
    {
        var eventTypes = await _context.Set<EventType>()
            .Where(et => et.IsActive)
            .Select(et => et.Name)
            .Distinct()
            .ToListAsync();

        return Ok(new ApiResponse<List<string>> { Success = true, Data = eventTypes });
    }

    /// <summary>
    /// Get award types for filtering
    /// </summary>
    [HttpGet("award-types")]
    public ActionResult<ApiResponse<List<string>>> GetAwardTypes()
    {
        var awardTypes = new List<string>
        {
            "Badge",
            "LeaguePoints",
            "NotableFinish",
            "Achievement",
            "Milestone"
        };

        return Ok(new ApiResponse<List<string>> { Success = true, Data = awardTypes });
    }

    /// <summary>
    /// Get rating types for filtering
    /// </summary>
    [HttpGet("rating-types")]
    public ActionResult<ApiResponse<List<string>>> GetRatingTypes()
    {
        var ratingTypes = new List<string>
        {
            "PeerReview",
            "SystemCalculated",
            "Official",
            "SelfRated",
            "Imported"
        };

        return Ok(new ApiResponse<List<string>> { Success = true, Data = ratingTypes });
    }
}
