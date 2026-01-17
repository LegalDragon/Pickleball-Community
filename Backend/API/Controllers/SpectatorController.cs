using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using System.Security.Claims;

namespace Pickleball.Community.Controllers;

[Route("[controller]")]
[ApiController]
public class SpectatorController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<SpectatorController> _logger;

    public SpectatorController(ApplicationDbContext context, ILogger<SpectatorController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
        return int.TryParse(userIdClaim, out var id) ? id : 0;
    }

    /// <summary>
    /// Get user's subscriptions for an event
    /// </summary>
    [HttpGet("subscriptions/{eventId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<SubscriptionDto>>>> GetSubscriptions(int eventId)
    {
        var userId = GetUserId();
        if (userId == 0) return Unauthorized();

        var subscriptions = await _context.SpectatorSubscriptions
            .Where(s => s.EventId == eventId && s.UserId == userId)
            .Select(s => new SubscriptionDto
            {
                Id = s.Id,
                SubscriptionType = s.SubscriptionType,
                TargetId = s.TargetId,
                NotifyOnGameQueued = s.NotifyOnGameQueued,
                NotifyOnGameStarted = s.NotifyOnGameStarted,
                NotifyOnScoreUpdate = s.NotifyOnScoreUpdate,
                NotifyOnGameFinished = s.NotifyOnGameFinished,
                IsActive = s.IsActive,
                CreatedAt = s.CreatedAt
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<SubscriptionDto>> { Success = true, Data = subscriptions });
    }

    /// <summary>
    /// Subscribe to an event, division, unit, player, or specific game
    /// </summary>
    [HttpPost("subscribe")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<SubscriptionDto>>> Subscribe([FromBody] SubscribeRequest request)
    {
        var userId = GetUserId();
        if (userId == 0) return Unauthorized();

        // Validate event exists
        var evt = await _context.Events.FindAsync(request.EventId);
        if (evt == null)
            return NotFound(new ApiResponse<SubscriptionDto> { Success = false, Message = "Event not found" });

        // Check if already subscribed
        var existing = await _context.SpectatorSubscriptions
            .FirstOrDefaultAsync(s =>
                s.UserId == userId &&
                s.EventId == request.EventId &&
                s.SubscriptionType == request.SubscriptionType &&
                s.TargetId == request.TargetId);

        if (existing != null)
        {
            // Update existing subscription
            existing.NotifyOnGameQueued = request.NotifyOnGameQueued;
            existing.NotifyOnGameStarted = request.NotifyOnGameStarted;
            existing.NotifyOnScoreUpdate = request.NotifyOnScoreUpdate;
            existing.NotifyOnGameFinished = request.NotifyOnGameFinished;
            existing.IsActive = true;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<SubscriptionDto>
            {
                Success = true,
                Data = new SubscriptionDto
                {
                    Id = existing.Id,
                    SubscriptionType = existing.SubscriptionType,
                    TargetId = existing.TargetId,
                    NotifyOnGameQueued = existing.NotifyOnGameQueued,
                    NotifyOnGameStarted = existing.NotifyOnGameStarted,
                    NotifyOnScoreUpdate = existing.NotifyOnScoreUpdate,
                    NotifyOnGameFinished = existing.NotifyOnGameFinished,
                    IsActive = existing.IsActive
                }
            });
        }

        // Create new subscription
        var subscription = new SpectatorSubscription
        {
            UserId = userId,
            EventId = request.EventId,
            SubscriptionType = request.SubscriptionType,
            TargetId = request.TargetId,
            NotifyOnGameQueued = request.NotifyOnGameQueued,
            NotifyOnGameStarted = request.NotifyOnGameStarted,
            NotifyOnScoreUpdate = request.NotifyOnScoreUpdate,
            NotifyOnGameFinished = request.NotifyOnGameFinished
        };

        _context.SpectatorSubscriptions.Add(subscription);
        await _context.SaveChangesAsync();

        _logger.LogInformation("User {UserId} subscribed to {Type} {TargetId} in event {EventId}",
            userId, request.SubscriptionType, request.TargetId, request.EventId);

        return Ok(new ApiResponse<SubscriptionDto>
        {
            Success = true,
            Data = new SubscriptionDto
            {
                Id = subscription.Id,
                SubscriptionType = subscription.SubscriptionType,
                TargetId = subscription.TargetId,
                NotifyOnGameQueued = subscription.NotifyOnGameQueued,
                NotifyOnGameStarted = subscription.NotifyOnGameStarted,
                NotifyOnScoreUpdate = subscription.NotifyOnScoreUpdate,
                NotifyOnGameFinished = subscription.NotifyOnGameFinished,
                IsActive = subscription.IsActive
            }
        });
    }

    /// <summary>
    /// Unsubscribe from a subscription
    /// </summary>
    [HttpDelete("unsubscribe/{subscriptionId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> Unsubscribe(int subscriptionId)
    {
        var userId = GetUserId();
        if (userId == 0) return Unauthorized();

        var subscription = await _context.SpectatorSubscriptions
            .FirstOrDefaultAsync(s => s.Id == subscriptionId && s.UserId == userId);

        if (subscription == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Subscription not found" });

        _context.SpectatorSubscriptions.Remove(subscription);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object> { Success = true, Message = "Unsubscribed successfully" });
    }

    /// <summary>
    /// Toggle subscription active status
    /// </summary>
    [HttpPut("toggle/{subscriptionId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> ToggleSubscription(int subscriptionId)
    {
        var userId = GetUserId();
        if (userId == 0) return Unauthorized();

        var subscription = await _context.SpectatorSubscriptions
            .FirstOrDefaultAsync(s => s.Id == subscriptionId && s.UserId == userId);

        if (subscription == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Subscription not found" });

        subscription.IsActive = !subscription.IsActive;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = subscription.IsActive ? "Subscription enabled" : "Subscription paused"
        });
    }

    /// <summary>
    /// Get spectator view of an event
    /// </summary>
    [HttpGet("event/{eventId}")]
    public async Task<ActionResult<ApiResponse<SpectatorEventViewDto>>> GetSpectatorView(int eventId)
    {
        var evt = await _context.Events
            .Include(e => e.Divisions)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return NotFound(new ApiResponse<SpectatorEventViewDto> { Success = false, Message = "Event not found" });

        // Get courts with current games
        var courts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive)
            .Include(c => c.CurrentGame)
                .ThenInclude(g => g!.EncounterMatch)
                    .ThenInclude(m => m!.Encounter)
                        .ThenInclude(e => e!.Unit1)
            .Include(c => c.CurrentGame)
                .ThenInclude(g => g!.EncounterMatch)
                    .ThenInclude(m => m!.Encounter)
                        .ThenInclude(e => e!.Unit2)
            .OrderBy(c => c.SortOrder)
            .Select(c => new SpectatorCourtDto
            {
                CourtId = c.Id,
                Name = c.CourtLabel,
                CourtNumber = c.SortOrder,
                Status = c.Status,
                CurrentGame = c.CurrentGame != null ? new SpectatorGameDto
                {
                    GameId = c.CurrentGame.Id,
                    Status = c.CurrentGame.Status,
                    Unit1Score = c.CurrentGame.Unit1Score,
                    Unit2Score = c.CurrentGame.Unit2Score,
                    Unit1Name = c.CurrentGame.EncounterMatch!.Encounter!.Unit1!.Name,
                    Unit2Name = c.CurrentGame.EncounterMatch.Encounter.Unit2!.Name,
                    RoundName = c.CurrentGame.EncounterMatch.Encounter.RoundName,
                    StartedAt = c.CurrentGame.StartedAt
                } : null
            })
            .ToListAsync();

        // Get recent completed games
        var recentGames = await _context.EventGames
            .Where(g => g.EncounterMatch!.Encounter!.EventId == eventId && g.Status == "Finished")
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Unit1)
            .Include(g => g.EncounterMatch)
                .ThenInclude(m => m!.Encounter)
                    .ThenInclude(e => e!.Unit2)
            .OrderByDescending(g => g.FinishedAt)
            .Take(10)
            .Select(g => new SpectatorGameDto
            {
                GameId = g.Id,
                Status = g.Status,
                Unit1Score = g.Unit1Score,
                Unit2Score = g.Unit2Score,
                Unit1Name = g.EncounterMatch!.Encounter!.Unit1!.Name,
                Unit2Name = g.EncounterMatch.Encounter.Unit2!.Name,
                RoundName = g.EncounterMatch.Encounter.RoundName,
                FinishedAt = g.FinishedAt
            })
            .ToListAsync();

        return Ok(new ApiResponse<SpectatorEventViewDto>
        {
            Success = true,
            Data = new SpectatorEventViewDto
            {
                EventId = eventId,
                EventName = evt.Name,
                EventStatus = evt.TournamentStatus,
                StartDate = evt.StartDate,
                VenueName = evt.VenueName,
                Divisions = evt.Divisions.Select(d => new DivisionSummaryDto
                {
                    Id = d.Id,
                    Name = d.Name
                }).ToList(),
                Courts = courts,
                RecentGames = recentGames
            }
        });
    }

    /// <summary>
    /// Get players/units available to subscribe to
    /// </summary>
    [HttpGet("subscribable/{eventId}")]
    public async Task<ActionResult<ApiResponse<SubscribableItemsDto>>> GetSubscribableItems(int eventId)
    {
        var divisions = await _context.EventDivisions
            .Where(d => d.EventId == eventId)
            .Select(d => new SubscribableItemDto
            {
                Id = d.Id,
                Name = d.Name,
                Type = "Division"
            })
            .ToListAsync();

        var units = await _context.EventUnits
            .Where(u => u.EventId == eventId && u.Status != "Cancelled")
            .Include(u => u.Division)
            .Select(u => new SubscribableItemDto
            {
                Id = u.Id,
                Name = u.Name,
                Type = "Unit",
                ParentName = u.Division!.Name
            })
            .ToListAsync();

        var players = await _context.EventUnitMembers
            .Where(m => m.Unit!.EventId == eventId && m.InviteStatus == "Accepted")
            .Include(m => m.User)
            .Select(m => new SubscribableItemDto
            {
                Id = m.UserId,
                Name = m.User!.FirstName + " " + m.User.LastName,
                Type = "Player"
            })
            .Distinct()
            .ToListAsync();

        return Ok(new ApiResponse<SubscribableItemsDto>
        {
            Success = true,
            Data = new SubscribableItemsDto
            {
                Divisions = divisions,
                Units = units,
                Players = players
            }
        });
    }
}

// DTOs for Spectator
public class SubscriptionDto
{
    public int Id { get; set; }
    public string SubscriptionType { get; set; } = string.Empty;
    public int? TargetId { get; set; }
    public bool NotifyOnGameQueued { get; set; }
    public bool NotifyOnGameStarted { get; set; }
    public bool NotifyOnScoreUpdate { get; set; }
    public bool NotifyOnGameFinished { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SubscribeRequest
{
    public int EventId { get; set; }
    public string SubscriptionType { get; set; } = "Event";
    public int? TargetId { get; set; }
    public bool NotifyOnGameQueued { get; set; } = true;
    public bool NotifyOnGameStarted { get; set; } = true;
    public bool NotifyOnScoreUpdate { get; set; } = true;
    public bool NotifyOnGameFinished { get; set; } = true;
}

public class SpectatorEventViewDto
{
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public string EventStatus { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public string? VenueName { get; set; }
    public List<DivisionSummaryDto> Divisions { get; set; } = new();
    public List<SpectatorCourtDto> Courts { get; set; } = new();
    public List<SpectatorGameDto> RecentGames { get; set; } = new();
}

public class DivisionSummaryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class SpectatorCourtDto
{
    public int CourtId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int CourtNumber { get; set; }
    public string Status { get; set; } = string.Empty;
    public SpectatorGameDto? CurrentGame { get; set; }
}

public class SpectatorGameDto
{
    public int GameId { get; set; }
    public string Status { get; set; } = string.Empty;
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }
    public string Unit1Name { get; set; } = string.Empty;
    public string Unit2Name { get; set; } = string.Empty;
    public string? RoundName { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
}

public class SubscribableItemsDto
{
    public List<SubscribableItemDto> Divisions { get; set; } = new();
    public List<SubscribableItemDto> Units { get; set; } = new();
    public List<SubscribableItemDto> Players { get; set; } = new();
}

public class SubscribableItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string? ParentName { get; set; }
}
