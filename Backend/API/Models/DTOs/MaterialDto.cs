namespace Pickleball.College.Models.DTOs;

public class MaterialDto
{
    public int Id { get; set; }
    public int CoachId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ContentType { get; set; } = "Text";
    public decimal Price { get; set; }
    public string ThumbnailUrl { get; set; }
    public string VideoUrl { get; set; }
    public string ExternalLink { get; set; }
    public bool IsPublished { get; set; }
    public bool HasPurchased { get; set; }
    public DateTime CreatedAt { get; set; }
    public CoachDto Coach { get; set; } = null!;
}

public class CoachDto
{
    public int Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
}

public class PurchaseResult
{
    public string ClientSecret { get; set; } = string.Empty;
    public int PurchaseId { get; set; }
    public decimal Amount { get; set; }
}

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class RegisterRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Role { get; set; } = "Student";
}

public class SessionRequest
{
    public int CoachId { get; set; }
    public int? MaterialId { get; set; }
    public string SessionType { get; set; } = "Online";
    public DateTime ScheduledAt { get; set; }
    public int DurationMinutes { get; set; }
    public decimal Price { get; set; }
    public string? MeetingLink { get; set; }
    public string? Location { get; set; }
}
