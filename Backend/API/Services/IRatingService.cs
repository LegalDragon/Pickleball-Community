using Pickleball.College.Models.DTOs;

namespace Pickleball.College.Services;

public interface IRatingService
{
    // Create or update a rating
    Task<RatingDto> CreateOrUpdateRatingAsync(int userId, CreateRatingRequest request);

    // Get a user's rating for a specific item
    Task<RatingDto?> GetUserRatingAsync(int userId, string ratableType, int ratableId);

    // Get all ratings for a specific item
    Task<List<RatingDto>> GetRatingsAsync(string ratableType, int ratableId);

    // Get rating summary for a specific item
    Task<RatingSummaryDto> GetRatingSummaryAsync(string ratableType, int ratableId);

    // Get rating summaries for multiple items of the same type
    Task<Dictionary<int, RatingSummaryDto>> GetRatingSummariesAsync(string ratableType, List<int> ratableIds);

    // Delete a rating
    Task<bool> DeleteRatingAsync(int userId, string ratableType, int ratableId);
}
