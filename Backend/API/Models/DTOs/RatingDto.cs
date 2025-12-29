using System.ComponentModel.DataAnnotations;

namespace Pickleball.College.Models.DTOs;

public class RatingDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string? UserName { get; set; }
    public string? UserAvatar { get; set; }
    public string RatableType { get; set; } = string.Empty;
    public int RatableId { get; set; }
    public int Stars { get; set; }
    public string? Review { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateRatingRequest
{
    [Required]
    public string RatableType { get; set; } = string.Empty; // "Material", "Coach", "Course"

    [Required]
    public int RatableId { get; set; }

    [Required]
    [Range(1, 5, ErrorMessage = "Stars must be between 1 and 5")]
    public int Stars { get; set; }

    [MaxLength(1000)]
    public string? Review { get; set; }
}

public class UpdateRatingRequest
{
    [Required]
    [Range(1, 5, ErrorMessage = "Stars must be between 1 and 5")]
    public int Stars { get; set; }

    [MaxLength(1000)]
    public string? Review { get; set; }
}

public class RatingSummaryDto
{
    public string RatableType { get; set; } = string.Empty;
    public int RatableId { get; set; }
    public double AverageRating { get; set; }
    public int TotalRatings { get; set; }
    public int[] StarCounts { get; set; } = new int[5]; // Index 0 = 1 star, Index 4 = 5 stars
}
