namespace Pickleball.Community.Models.Entities;

public class Rating
{
    public int Id { get; set; }
    public int UserId { get; set; }

    // Polymorphic rating: Material, Coach, or Course
    public string RatableType { get; set; } = string.Empty; // "Material", "Coach", "Course"
    public int RatableId { get; set; }

    public int Stars { get; set; } // 1-5
    public string? Review { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}
