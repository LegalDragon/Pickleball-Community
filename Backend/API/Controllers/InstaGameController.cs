using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Services;
using System.Security.Claims;

namespace Pickleball.Community.Controllers;

/// <summary>
/// Controller for InstaGame (spontaneous pickup games) operations
/// </summary>
[Route("[controller]")]
[ApiController]
[Authorize]
public class InstaGameController : ControllerBase
{
    private readonly IInstaGameService _instaGameService;
    private readonly ILogger<InstaGameController> _logger;

    public InstaGameController(
        IInstaGameService instaGameService,
        ILogger<InstaGameController> logger)
    {
        _instaGameService = instaGameService;
        _logger = logger;
    }

    private int GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
        return int.Parse(userIdClaim!);
    }

    #region Session Management

    /// <summary>
    /// Create a new InstaGame session
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<InstaGameResponse>> Create([FromBody] CreateInstaGameRequest request)
    {
        try
        {
            var userId = GetUserId();
            var instaGame = await _instaGameService.CreateAsync(request, userId);

            return Ok(new InstaGameResponse
            {
                Success = true,
                InstaGame = instaGame
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating InstaGame");
            return BadRequest(new InstaGameResponse
            {
                Success = false,
                Message = "Failed to create game session"
            });
        }
    }

    /// <summary>
    /// Get InstaGame by ID
    /// </summary>
    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<ActionResult<InstaGameDetailDto>> GetById(int id)
    {
        int? userId = null;
        try { userId = GetUserId(); } catch { }

        var instaGame = await _instaGameService.GetByIdAsync(id, userId);
        if (instaGame == null)
            return NotFound();

        return Ok(instaGame);
    }

    /// <summary>
    /// Get InstaGame by join code
    /// </summary>
    [HttpGet("code/{joinCode}")]
    [AllowAnonymous]
    public async Task<ActionResult<InstaGameDetailDto>> GetByCode(string joinCode)
    {
        int? userId = null;
        try { userId = GetUserId(); } catch { }

        var instaGame = await _instaGameService.GetByJoinCodeAsync(joinCode, userId);
        if (instaGame == null)
            return NotFound();

        return Ok(instaGame);
    }

    /// <summary>
    /// Get active InstaGames
    /// </summary>
    [HttpGet("active")]
    [AllowAnonymous]
    public async Task<ActionResult<List<InstaGameDto>>> GetActive([FromQuery] int? limit = 20)
    {
        var games = await _instaGameService.GetActiveAsync(limit);
        return Ok(games);
    }

    /// <summary>
    /// Find nearby InstaGames
    /// </summary>
    [HttpGet("nearby")]
    [AllowAnonymous]
    public async Task<ActionResult<List<InstaGameDto>>> GetNearby(
        [FromQuery] decimal latitude,
        [FromQuery] decimal longitude,
        [FromQuery] double radiusMiles = 10,
        [FromQuery] int limit = 20)
    {
        var games = await _instaGameService.GetNearbyAsync(latitude, longitude, radiusMiles, limit);
        return Ok(games);
    }

    /// <summary>
    /// Update InstaGame settings
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<InstaGameDetailDto>> Update(int id, [FromBody] UpdateInstaGameRequest request)
    {
        var userId = GetUserId();
        var instaGame = await _instaGameService.UpdateAsync(id, request, userId);

        if (instaGame == null)
            return NotFound();

        return Ok(instaGame);
    }

    /// <summary>
    /// Start the InstaGame session
    /// </summary>
    [HttpPost("{id}/start")]
    public async Task<ActionResult> Start(int id)
    {
        var userId = GetUserId();
        var success = await _instaGameService.StartSessionAsync(id, userId);

        if (!success)
            return BadRequest(new { message = "Failed to start session" });

        return Ok(new { message = "Session started" });
    }

    /// <summary>
    /// Pause the InstaGame session
    /// </summary>
    [HttpPost("{id}/pause")]
    public async Task<ActionResult> Pause(int id)
    {
        var userId = GetUserId();
        var success = await _instaGameService.PauseSessionAsync(id, userId);

        if (!success)
            return BadRequest(new { message = "Failed to pause session" });

        return Ok(new { message = "Session paused" });
    }

    /// <summary>
    /// End the InstaGame session
    /// </summary>
    [HttpPost("{id}/end")]
    public async Task<ActionResult> End(int id)
    {
        var userId = GetUserId();
        var success = await _instaGameService.EndSessionAsync(id, userId);

        if (!success)
            return BadRequest(new { message = "Failed to end session" });

        return Ok(new { message = "Session ended" });
    }

    #endregion

    #region Player Management

    /// <summary>
    /// Join an InstaGame by code
    /// </summary>
    [HttpPost("join")]
    public async Task<ActionResult<InstaGameResponse>> Join([FromBody] JoinInstaGameRequest request)
    {
        try
        {
            var userId = GetUserId();
            var instaGame = await _instaGameService.JoinAsync(request.JoinCode, userId);

            if (instaGame == null)
                return BadRequest(new InstaGameResponse
                {
                    Success = false,
                    Message = "Invalid code or session not joinable"
                });

            return Ok(new InstaGameResponse
            {
                Success = true,
                InstaGame = instaGame
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error joining InstaGame");
            return BadRequest(new InstaGameResponse
            {
                Success = false,
                Message = "Failed to join game session"
            });
        }
    }

    /// <summary>
    /// Leave an InstaGame
    /// </summary>
    [HttpPost("{id}/leave")]
    public async Task<ActionResult> Leave(int id)
    {
        var userId = GetUserId();
        var success = await _instaGameService.LeaveAsync(id, userId);

        if (!success)
            return BadRequest(new { message = "Failed to leave session" });

        return Ok(new { message = "Left session" });
    }

    /// <summary>
    /// Update player status (Available, Resting)
    /// </summary>
    [HttpPut("{id}/status")]
    public async Task<ActionResult> UpdateStatus(int id, [FromBody] UpdatePlayerStatusRequest request)
    {
        var userId = GetUserId();
        var success = await _instaGameService.UpdatePlayerStatusAsync(id, userId, request.Status);

        if (!success)
            return BadRequest(new { message = "Failed to update status" });

        return Ok(new { message = "Status updated" });
    }

    /// <summary>
    /// Toggle organizer status for a player (creator only)
    /// </summary>
    [HttpPut("{id}/players/{targetUserId}/organizer")]
    public async Task<ActionResult> ToggleOrganizer(int id, int targetUserId)
    {
        var userId = GetUserId();
        var success = await _instaGameService.ToggleOrganizerAsync(id, targetUserId, userId);

        if (!success)
            return BadRequest(new { message = "Failed to toggle organizer status" });

        return Ok(new { message = "Organizer status toggled" });
    }

    #endregion

    #region Match Management

    /// <summary>
    /// Create a manual match with specified teams
    /// </summary>
    [HttpPost("{id}/matches")]
    public async Task<ActionResult<InstaGameMatchDto>> CreateMatch(int id, [FromBody] CreateManualMatchRequest request)
    {
        var userId = GetUserId();
        var match = await _instaGameService.CreateManualMatchAsync(id, request, userId);

        if (match == null)
            return BadRequest(new { message = "Failed to create match" });

        return Ok(match);
    }

    /// <summary>
    /// Auto-generate next match based on scheduling method
    /// </summary>
    [HttpPost("{id}/matches/auto")]
    public async Task<ActionResult<NextMatchResponse>> GenerateNextMatch(int id)
    {
        var userId = GetUserId();
        var response = await _instaGameService.GenerateNextMatchAsync(id, userId);

        if (!response.Success)
            return BadRequest(response);

        return Ok(response);
    }

    /// <summary>
    /// Start a match
    /// </summary>
    [HttpPost("{id}/matches/{matchId}/start")]
    public async Task<ActionResult> StartMatch(int id, int matchId)
    {
        var userId = GetUserId();
        var success = await _instaGameService.StartMatchAsync(matchId, userId);

        if (!success)
            return BadRequest(new { message = "Failed to start match" });

        return Ok(new { message = "Match started" });
    }

    /// <summary>
    /// Update match score
    /// </summary>
    [HttpPut("{id}/matches/{matchId}/score")]
    public async Task<ActionResult> UpdateScore(int id, int matchId, [FromBody] UpdateMatchScoreRequest request)
    {
        var userId = GetUserId();
        var success = await _instaGameService.UpdateMatchScoreAsync(matchId, request, userId);

        if (!success)
            return BadRequest(new { message = "Failed to update score" });

        return Ok(new { message = "Score updated" });
    }

    /// <summary>
    /// Complete a match with final score
    /// </summary>
    [HttpPost("{id}/matches/{matchId}/complete")]
    public async Task<ActionResult<InstaGameMatchDto>> CompleteMatch(int id, int matchId, [FromBody] CompleteMatchRequest request)
    {
        var userId = GetUserId();
        var match = await _instaGameService.CompleteMatchAsync(matchId, request, userId);

        if (match == null)
            return BadRequest(new { message = "Failed to complete match" });

        return Ok(match);
    }

    #endregion

    #region Queue Management

    /// <summary>
    /// Get the current queue
    /// </summary>
    [HttpGet("{id}/queue")]
    public async Task<ActionResult<List<InstaGameQueueDto>>> GetQueue(int id)
    {
        var queue = await _instaGameService.GetQueueAsync(id);
        return Ok(queue);
    }

    /// <summary>
    /// Add teams to queue
    /// </summary>
    [HttpPost("{id}/queue")]
    public async Task<ActionResult<InstaGameQueueDto>> AddToQueue(int id, [FromBody] AddToQueueRequest request)
    {
        var userId = GetUserId();
        var queueItem = await _instaGameService.AddToQueueAsync(id, request, userId);

        if (queueItem == null)
            return BadRequest(new { message = "Failed to add to queue" });

        return Ok(queueItem);
    }

    /// <summary>
    /// Remove from queue
    /// </summary>
    [HttpDelete("{id}/queue/{queueId}")]
    public async Task<ActionResult> RemoveFromQueue(int id, int queueId)
    {
        var userId = GetUserId();
        var success = await _instaGameService.RemoveFromQueueAsync(id, queueId, userId);

        if (!success)
            return BadRequest(new { message = "Failed to remove from queue" });

        return Ok(new { message = "Removed from queue" });
    }

    /// <summary>
    /// Reorder queue
    /// </summary>
    [HttpPut("{id}/queue/reorder")]
    public async Task<ActionResult<List<InstaGameQueueDto>>> ReorderQueue(int id, [FromBody] ReorderQueueRequest request)
    {
        var userId = GetUserId();
        var queue = await _instaGameService.ReorderQueueAsync(id, request, userId);

        return Ok(queue);
    }

    #endregion
}
