using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Services;
using System.Security.Claims;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class RatingsController : ControllerBase
{
    private readonly IRatingService _ratingService;

    public RatingsController(IRatingService ratingService)
    {
        _ratingService = ratingService;
    }

    /// <summary>
    /// Create or update a rating
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<RatingDto>> CreateOrUpdateRating([FromBody] CreateRatingRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var rating = await _ratingService.CreateOrUpdateRatingAsync(userId.Value, request);
            return Ok(rating);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Get the current user's rating for a specific item
    /// </summary>
    [HttpGet("{ratableType}/{ratableId}/my-rating")]
    [Authorize]
    public async Task<ActionResult<RatingDto>> GetMyRating(string ratableType, int ratableId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var rating = await _ratingService.GetUserRatingAsync(userId.Value, ratableType, ratableId);
        // Return null instead of 404 when no rating exists yet - this is a valid state
        return Ok(rating);
    }

    /// <summary>
    /// Get all ratings for a specific item
    /// </summary>
    [HttpGet("{ratableType}/{ratableId}")]
    public async Task<ActionResult<List<RatingDto>>> GetRatings(string ratableType, int ratableId)
    {
        var ratings = await _ratingService.GetRatingsAsync(ratableType, ratableId);
        return Ok(ratings);
    }

    /// <summary>
    /// Get rating summary for a specific item
    /// </summary>
    [HttpGet("{ratableType}/{ratableId}/summary")]
    public async Task<ActionResult<RatingSummaryDto>> GetRatingSummary(string ratableType, int ratableId)
    {
        var summary = await _ratingService.GetRatingSummaryAsync(ratableType, ratableId);
        return Ok(summary);
    }

    /// <summary>
    /// Get rating summaries for multiple items
    /// </summary>
    [HttpPost("{ratableType}/summaries")]
    public async Task<ActionResult<Dictionary<int, RatingSummaryDto>>> GetRatingSummaries(
        string ratableType,
        [FromBody] List<int> ratableIds)
    {
        var summaries = await _ratingService.GetRatingSummariesAsync(ratableType, ratableIds);
        return Ok(summaries);
    }

    /// <summary>
    /// Delete a rating
    /// </summary>
    [HttpDelete("{ratableType}/{ratableId}")]
    [Authorize]
    public async Task<ActionResult> DeleteRating(string ratableType, int ratableId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var deleted = await _ratingService.DeleteRatingAsync(userId.Value, ratableType, ratableId);
        if (!deleted) return NotFound();

        return NoContent();
    }

    private int? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? User.FindFirst("sub")?.Value
                       ?? User.FindFirst("userId")?.Value;

        if (int.TryParse(userIdClaim, out var userId))
            return userId;

        return null;
    }
}
