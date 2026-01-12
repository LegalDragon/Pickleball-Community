using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Services;

public class RatingService : IRatingService
{
    private readonly ApplicationDbContext _context;
    private static readonly string[] ValidRatableTypes = { "Manager", "Player", "BlogPost", "Club", "Court", "Event" };

    public RatingService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<RatingDto> CreateOrUpdateRatingAsync(int userId, CreateRatingRequest request)
    {
        // Validate ratable type
        if (!ValidRatableTypes.Contains(request.RatableType))
        {
            throw new ArgumentException($"Invalid RatableType. Must be one of: {string.Join(", ", ValidRatableTypes)}");
        }

        // Validate that the ratable item exists
        var itemExists = await ValidateRatableItemExistsAsync(request.RatableType, request.RatableId);
        if (!itemExists)
        {
            throw new ArgumentException($"{request.RatableType} with ID {request.RatableId} not found");
        }

        // Check if rating already exists
        var existingRating = await _context.Ratings
            .FirstOrDefaultAsync(r => r.UserId == userId
                && r.RatableType == request.RatableType
                && r.RatableId == request.RatableId);

        if (existingRating != null)
        {
            // Update existing rating
            existingRating.Stars = request.Stars;
            existingRating.Review = request.Review;
            existingRating.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();
            return await MapToDto(existingRating);
        }

        // Create new rating
        var rating = new Rating
        {
            UserId = userId,
            RatableType = request.RatableType,
            RatableId = request.RatableId,
            Stars = request.Stars,
            Review = request.Review
        };

        _context.Ratings.Add(rating);
        await _context.SaveChangesAsync();

        return await MapToDto(rating);
    }

    public async Task<RatingDto?> GetUserRatingAsync(int userId, string ratableType, int ratableId)
    {
        var rating = await _context.Ratings
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.UserId == userId
                && r.RatableType == ratableType
                && r.RatableId == ratableId);

        if (rating == null) return null;

        return await MapToDto(rating);
    }

    public async Task<List<RatingDto>> GetRatingsAsync(string ratableType, int ratableId)
    {
        var ratings = await _context.Ratings
            .Include(r => r.User)
            .Where(r => r.RatableType == ratableType && r.RatableId == ratableId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        var result = new List<RatingDto>();
        foreach (var rating in ratings)
        {
            result.Add(await MapToDto(rating));
        }
        return result;
    }

    public async Task<RatingSummaryDto> GetRatingSummaryAsync(string ratableType, int ratableId)
    {
        var ratings = await _context.Ratings
            .Where(r => r.RatableType == ratableType && r.RatableId == ratableId)
            .ToListAsync();

        return CalculateSummary(ratableType, ratableId, ratings);
    }

    public async Task<Dictionary<int, RatingSummaryDto>> GetRatingSummariesAsync(string ratableType, List<int> ratableIds)
    {
        var result = new Dictionary<int, RatingSummaryDto>();

        // Handle empty list
        if (ratableIds == null || ratableIds.Count == 0)
        {
            return result;
        }

        // Convert to array to avoid EF Core query generation issues with List<T>.Contains
        var idsArray = ratableIds.ToArray();

        // Query all ratings for the given type that match any of the IDs
        var ratings = await _context.Ratings
            .Where(r => r.RatableType == ratableType)
            .ToListAsync();

        // Filter in memory to avoid SQL Server syntax issues with large IN clauses
        var filteredRatings = ratings.Where(r => idsArray.Contains(r.RatableId)).ToList();

        foreach (var id in ratableIds)
        {
            var itemRatings = filteredRatings.Where(r => r.RatableId == id).ToList();
            result[id] = CalculateSummary(ratableType, id, itemRatings);
        }

        return result;
    }

    public async Task<bool> DeleteRatingAsync(int userId, string ratableType, int ratableId)
    {
        var rating = await _context.Ratings
            .FirstOrDefaultAsync(r => r.UserId == userId
                && r.RatableType == ratableType
                && r.RatableId == ratableId);

        if (rating == null) return false;

        _context.Ratings.Remove(rating);
        await _context.SaveChangesAsync();
        return true;
    }

    private async Task<bool> ValidateRatableItemExistsAsync(string ratableType, int ratableId)
    {
        return ratableType switch
        {
            "Manager" => await _context.Users.AnyAsync(u => u.Id == ratableId && u.Role == "Manager"),
            "Player" => await _context.Users.AnyAsync(u => u.Id == ratableId),
            "BlogPost" => await _context.BlogPosts.AnyAsync(p => p.Id == ratableId),
            "Club" => await _context.Clubs.AnyAsync(c => c.Id == ratableId),
            "Court" => await _context.Venues.AnyAsync(v => v.VenueId == ratableId),
            "Event" => await _context.Events.AnyAsync(e => e.Id == ratableId),
            _ => false
        };
    }

    private async Task<RatingDto> MapToDto(Rating rating)
    {
        var user = rating.User ?? await _context.Users.FindAsync(rating.UserId);

        return new RatingDto
        {
            Id = rating.Id,
            UserId = rating.UserId,
            UserName = user != null ? Utility.FormatName(user.LastName, user.FirstName) : "Unknown User",
            UserAvatar = user?.ProfileImageUrl,
            RatableType = rating.RatableType,
            RatableId = rating.RatableId,
            Stars = rating.Stars,
            Review = rating.Review,
            CreatedAt = rating.CreatedAt,
            UpdatedAt = rating.UpdatedAt
        };
    }

    private static RatingSummaryDto CalculateSummary(string ratableType, int ratableId, List<Rating> ratings)
    {
        var starCounts = new int[5];
        foreach (var rating in ratings)
        {
            if (rating.Stars >= 1 && rating.Stars <= 5)
            {
                starCounts[rating.Stars - 1]++;
            }
        }

        var totalRatings = ratings.Count;
        var averageRating = totalRatings > 0
            ? ratings.Average(r => r.Stars)
            : 0;

        return new RatingSummaryDto
        {
            RatableType = ratableType,
            RatableId = ratableId,
            AverageRating = Math.Round(averageRating, 1),
            TotalRatings = totalRatings,
            StarCounts = starCounts
        };
    }
}
