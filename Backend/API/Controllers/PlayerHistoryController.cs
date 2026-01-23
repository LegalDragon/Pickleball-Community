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

        // Game stats - find games via unit membership
        // Use IQueryable subquery to avoid OPENJSON CTE issues with Contains on List
        var userUnitIdsQuery = _context.EventUnitMembers
            .Where(m => m.UserId == userId && m.InviteStatus == "Accepted")
            .Select(m => m.UnitId);

        // Materialize for in-memory processing later
        var userUnitIds = await userUnitIdsQuery.Distinct().ToListAsync();
        var userUnitIdsSet = userUnitIds.ToHashSet();

        int totalGames = 0;
        int totalWins = 0;
        int totalLosses = 0;
        decimal winPercentage = 0;
        DateTime? lastGameDate = null;

        if (userUnitIds.Any())
        {
            // Use subquery-based Contains to avoid OPENJSON CTE issues
            // Get encounter IDs via subquery (generates IN (SELECT ...) instead of OPENJSON)
            var encounterIdsQuery = _context.EventEncounters
                .Where(e => (e.Unit1Id != null && userUnitIdsQuery.Contains(e.Unit1Id.Value)) ||
                            (e.Unit2Id != null && userUnitIdsQuery.Contains(e.Unit2Id.Value)))
                .Select(e => e.Id);

            // Get finished games using the subquery
            var rawGameStats = await _context.EventGames
                .Where(g => g.Status == "Finished" && g.EncounterMatch != null && g.EncounterMatch.EncounterId != null)
                .Where(g => encounterIdsQuery.Contains(g.EncounterMatch!.EncounterId))
                .Select(g => new
                {
                    Unit1Id = g.EncounterMatch!.Encounter!.Unit1Id,
                    Unit2Id = g.EncounterMatch!.Encounter!.Unit2Id,
                    WinnerUnitId = g.WinnerUnitId,
                    FinishedAt = g.FinishedAt
                })
                .ToListAsync();

            // Process in memory to determine player's unit for each game
            var gameStats = rawGameStats.Select(g => new
            {
                PlayerUnitId = userUnitIdsSet.Contains(g.Unit1Id ?? 0) ? g.Unit1Id : g.Unit2Id,
                WinnerUnitId = g.WinnerUnitId,
                FinishedAt = g.FinishedAt
            }).ToList();

            totalGames = gameStats.Count;
            totalWins = gameStats.Count(g => g.PlayerUnitId == g.WinnerUnitId);
            totalLosses = totalGames - totalWins;
            winPercentage = totalGames > 0 ? Math.Round((decimal)totalWins / totalGames * 100, 1) : 0;
            lastGameDate = gameStats.Any() ? gameStats.Max(g => g.FinishedAt) : null;
        }

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

        // Payment summary
        var payments = await _context.UserPayments
            .Where(p => p.UserId == userId )
            .ToListAsync();

        var totalPayments = payments.Count;
        var totalAmountPaid = payments.Where(p => p.Status == "Verified").Sum(p => p.Amount);
        var pendingPayments = payments.Count(p => p.Status == "Pending" || p.Status == "PendingVerification");

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
            RecentRatings = recentRatings,
            TotalPayments = totalPayments,
            TotalAmountPaid = totalAmountPaid,
            PendingPayments = pendingPayments
        };

        return Ok(new ApiResponse<PlayerHistorySummaryDto> { Success = true, Data = summary });
    }

    // =====================================================
    // Game History Endpoints
    // =====================================================

    /// <summary>
    /// Get player's game history with filtering
    /// Uses EventUnitMembers to find player's units, then finds games from encounters
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

        // Step 1: Create IQueryable subquery for user's units (avoids OPENJSON CTE issues)
        var userUnitIdsQuery = _context.EventUnitMembers
            .Where(m => m.UserId == userId && m.InviteStatus == "Accepted")
            .Select(m => m.UnitId);

        // Materialize for in-memory processing later and early exit check
        var userUnitIds = await userUnitIdsQuery.Distinct().ToListAsync();

        if (!userUnitIds.Any())
        {
            return Ok(new ApiResponse<GameHistoryPagedResponse>
            {
                Success = true,
                Data = new GameHistoryPagedResponse
                {
                    Games = new List<PlayerGameHistoryDto>(),
                    TotalCount = 0,
                    Page = request.Page,
                    PageSize = request.PageSize,
                    TotalGames = 0,
                    TotalWins = 0,
                    TotalLosses = 0,
                    WinPercentage = 0
                }
            });
        }

        // Step 2: Create IQueryable subquery for encounter IDs (generates IN (SELECT ...) instead of OPENJSON)
        var encounterIdsQuery = _context.EventEncounters
            .Where(e => (e.Unit1Id != null && userUnitIdsQuery.Contains(e.Unit1Id.Value)) ||
                        (e.Unit2Id != null && userUnitIdsQuery.Contains(e.Unit2Id.Value)))
            .Select(e => e.Id);

        // Step 3: Get all finished games using subquery-based filtering
        var gamesQuery = _context.EventGames
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Event)
                        .ThenInclude(ev => ev!.EventType)
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Division)
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Unit1)
                        .ThenInclude(u => u!.Members)
                            .ThenInclude(m => m.User)
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Unit2)
                        .ThenInclude(u => u!.Members)
                            .ThenInclude(m => m.User)
            .Where(g => g.Status == "Finished" && g.EncounterMatch != null && g.EncounterMatch.EncounterId != null)
            .Where(g => encounterIdsQuery.Contains(g.EncounterMatch!.EncounterId));

        // Apply filters
        if (request.DateFrom.HasValue)
        {
            gamesQuery = gamesQuery.Where(g => g.FinishedAt >= request.DateFrom.Value);
        }

        if (request.DateTo.HasValue)
        {
            gamesQuery = gamesQuery.Where(g => g.FinishedAt <= request.DateTo.Value);
        }

        if (!string.IsNullOrEmpty(request.EventType))
        {
            gamesQuery = gamesQuery.Where(g => g.EncounterMatch!.Encounter!.Event!.EventType!.Name == request.EventType);
        }

        if (request.EventId.HasValue)
        {
            gamesQuery = gamesQuery.Where(g => g.EncounterMatch!.Encounter!.EventId == request.EventId.Value);
        }

        var allGames = await gamesQuery
            .OrderByDescending(g => g.FinishedAt ?? g.CreatedAt)
            .ToListAsync();

        // Build game history DTOs with partner/opponent info
        var gameHistoryList = new List<PlayerGameHistoryDto>();

        foreach (var game in allGames)
        {
            var encounter = game.EncounterMatch!.Encounter!;
            var evt = encounter.Event!;
            var division = encounter.Division;

            // Determine which unit the player was on
            var playerUnitId = userUnitIds.Contains(encounter.Unit1Id ?? 0) ? encounter.Unit1Id : encounter.Unit2Id;
            if (!playerUnitId.HasValue) continue;

            var isWin = game.WinnerUnitId == playerUnitId;

            // Apply wins only filter
            if (request.WinsOnly == true && !isWin)
                continue;

            // Determine player's score and opponent's score
            var playerScore = encounter.Unit1Id == playerUnitId ? game.Unit1Score : game.Unit2Score;
            var opponentScore = encounter.Unit1Id == playerUnitId ? game.Unit2Score : game.Unit1Score;

            // Get partner and opponents from unit members
            var playerUnit = encounter.Unit1Id == playerUnitId ? encounter.Unit1 : encounter.Unit2;
            var opponentUnit = encounter.Unit1Id == playerUnitId ? encounter.Unit2 : encounter.Unit1;

            var partnerMember = playerUnit?.Members
                .Where(m => m.UserId != userId && m.InviteStatus == "Accepted")
                .FirstOrDefault();
            var partner = partnerMember?.User;

            var opponents = opponentUnit?.Members
                .Where(m => m.InviteStatus == "Accepted")
                .Select(m => new GameOpponentDto
                {
                    UserId = m.UserId,
                    Name = m.User != null ? Utility.FormatName(m.User.LastName, m.User.FirstName) : "Unknown",
                    ProfileImageUrl = m.User?.ProfileImageUrl
                })
                .ToList() ?? new List<GameOpponentDto>();

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
                MatchId = encounter.Id,
                EventId = evt.Id,
                EventName = evt.Name,
                EventType = evt.EventType?.Name,
                DivisionId = division?.Id ?? 0,
                DivisionName = division?.Name ?? "Unknown",
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
                RoundType = encounter.RoundType,
                RoundName = encounter.RoundName,
                MatchNumber = encounter.EncounterNumber
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
    // Payment History Endpoints
    // =====================================================

    /// <summary>
    /// Get player's payment history
    /// </summary>
    [HttpGet("{userId}/payments")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PaymentHistoryPagedResponse>>> GetPayments(
        int userId,
        [FromQuery] PaymentHistorySearchRequest? request = null)
    {
        request ??= new PaymentHistorySearchRequest();

        var currentUserId = GetUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(new ApiResponse<PaymentHistoryPagedResponse> { Success = false, Message = "Unauthorized" });

        // Users can only view their own payment history, unless they're admin
        var currentUser = await _context.Users.FindAsync(currentUserId.Value);
        var isAdmin = currentUser?.Role == "Admin";
        if (userId != currentUserId.Value && !isAdmin)
            return Forbid();

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return NotFound(new ApiResponse<PaymentHistoryPagedResponse> { Success = false, Message = "User not found" });

        var query = _context.UserPayments
            .Include(p => p.VerifiedByUser)
            .Where(p => p.UserId == userId && p.PaymentType == "EventRegistration");

        // Apply filters
        if (!string.IsNullOrEmpty(request.Status))
        {
            query = query.Where(p => p.Status == request.Status);
        }

        if (request.EventId.HasValue)
        {
            query = query.Where(p => p.RelatedObjectId == request.EventId.Value);
        }

        if (request.DateFrom.HasValue)
        {
            query = query.Where(p => p.CreatedAt >= request.DateFrom.Value);
        }

        if (request.DateTo.HasValue)
        {
            query = query.Where(p => p.CreatedAt <= request.DateTo.Value);
        }

        var totalCount = await query.CountAsync();

        // Fetch payments first
        var paymentRecords = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync();

        // Get related event and unit IDs
        var eventIds = paymentRecords.Where(p => p.RelatedObjectId.HasValue).Select(p => p.RelatedObjectId!.Value).Distinct().ToList();
        var unitIds = paymentRecords.Where(p => p.SecondaryObjectId.HasValue).Select(p => p.SecondaryObjectId!.Value).Distinct().ToList();

        // Fetch events and units in separate queries (only if we have IDs)
        // Use individual lookups to avoid EF Core OPENJSON compatibility issues with older SQL Server
        var events = new Dictionary<int, Pickleball.Community.Models.Entities.Event>();
        foreach (var eventId in eventIds)
        {
            var evt = await _context.Events.FindAsync(eventId);
            if (evt != null) events[eventId] = evt;
        }

        var units = new Dictionary<int, Pickleball.Community.Models.Entities.EventUnit>();
        foreach (var unitId in unitIds)
        {
            var unit = await _context.EventUnits
                .Include(u => u.Division)
                .FirstOrDefaultAsync(u => u.Id == unitId);
            if (unit != null) units[unitId] = unit;
        }

        // Fetch registrations linked to these payments
        var paymentIds = paymentRecords.Select(p => p.Id).ToList();
        var registrationsByPayment = new Dictionary<int, List<PaymentRegistrationDto>>();

        foreach (var paymentId in paymentIds)
        {
            var members = await _context.EventUnitMembers
                .Include(m => m.Unit)
                    .ThenInclude(u => u!.Division)
                .Include(m => m.Unit)
                    .ThenInclude(u => u!.Event)
                .Include(m => m.User)
                .Include(m => m.SelectedFee)
                .Where(m => m.PaymentId == paymentId)
                .ToListAsync();

            registrationsByPayment[paymentId] = members.Select(m => new PaymentRegistrationDto
            {
                MemberId = m.Id,
                UnitId = m.UnitId,
                UnitName = m.Unit?.Name ?? "Unknown Unit",
                DivisionId = m.Unit?.DivisionId ?? 0,
                DivisionName = m.Unit?.Division?.Name ?? "Unknown Division",
                EventId = m.Unit?.EventId ?? 0,
                EventName = m.Unit?.Event?.Name ?? "Unknown Event",
                PlayerName = m.User != null ? Utility.FormatName(m.User.LastName, m.User.FirstName) : "Unknown Player",
                FeeAmount = m.SelectedFee?.Amount ?? m.AmountPaid,
                FeeName = m.SelectedFee?.Name
            }).ToList();
        }

        // Map to DTOs
        var payments = paymentRecords.Select(p =>
        {
            var regs = registrationsByPayment.TryGetValue(p.Id, out var r) ? r : new List<PaymentRegistrationDto>();
            return new PlayerPaymentHistoryDto
            {
                Id = p.Id,
                EventId = p.RelatedObjectId,
                EventName = p.RelatedObjectId.HasValue && events.TryGetValue(p.RelatedObjectId.Value, out var evt) ? evt.Name : "Unknown Event",
                EventDate = p.RelatedObjectId.HasValue && events.TryGetValue(p.RelatedObjectId.Value, out var evt2) ? evt2.StartDate : null,
                UnitId = p.SecondaryObjectId,
                UnitName = p.SecondaryObjectId.HasValue && units.TryGetValue(p.SecondaryObjectId.Value, out var unit) ? unit.Name : null,
                DivisionName = p.SecondaryObjectId.HasValue && units.TryGetValue(p.SecondaryObjectId.Value, out var unit2) && unit2.Division != null ? unit2.Division.Name : null,
                Amount = p.Amount,
                PaymentMethod = p.PaymentMethod,
                PaymentReference = p.PaymentReference,
                PaymentProofUrl = p.PaymentProofUrl,
                ReferenceId = p.ReferenceId,
                Status = p.Status,
                IsApplied = p.IsApplied,
                AppliedAt = p.AppliedAt,
                VerifiedAt = p.VerifiedAt,
                VerifiedByName = p.VerifiedByUser != null
                    ? Utility.FormatName(p.VerifiedByUser.LastName, p.VerifiedByUser.FirstName)
                    : null,
                Notes = p.Notes,
                CreatedAt = p.CreatedAt,
                Registrations = regs,
                TotalRegistrationFees = regs.Sum(reg => reg.FeeAmount)
            };
        }).ToList();

        // Calculate summary stats for all payments (not just current page)
        var allPayments = await _context.UserPayments
            .Where(p => p.UserId == userId && p.PaymentType == "EventRegistration")
            .ToListAsync();

        var response = new PaymentHistoryPagedResponse
        {
            Payments = payments,
            TotalCount = totalCount,
            Page = request.Page,
            PageSize = request.PageSize,
            TotalAmountPaid = allPayments.Where(p => p.Status == "Verified").Sum(p => p.Amount),
            TotalVerified = allPayments.Count(p => p.Status == "Verified"),
            TotalPending = allPayments.Count(p => p.Status == "Pending" || p.Status == "PendingVerification")
        };

        return Ok(new ApiResponse<PaymentHistoryPagedResponse> { Success = true, Data = response });
    }

    /// <summary>
    /// Get payment status types for filtering
    /// </summary>
    [HttpGet("payment-statuses")]
    public ActionResult<ApiResponse<List<string>>> GetPaymentStatuses()
    {
        var statuses = new List<string>
        {
            "Pending",
            "Verified",
            "Rejected",
            "Refunded",
            "Cancelled"
        };

        return Ok(new ApiResponse<List<string>> { Success = true, Data = statuses });
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
