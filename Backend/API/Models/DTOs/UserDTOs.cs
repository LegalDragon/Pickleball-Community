namespace Pickleball.Community.Models.DTOs;

public class UserProfileDto
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string Role { get; set; } = "Student";
    public string? Bio { get; set; }
    public string? ProfileImageUrl { get; set; }

    // Basic info fields
    public string? Gender { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? ZipCode { get; set; }
    public string? Country { get; set; }

    // Pickleball info fields
    public string? Handedness { get; set; }
    public string? ExperienceLevel { get; set; }
    public string? PlayingStyle { get; set; }
    public string? PaddleBrand { get; set; }
    public string? PaddleModel { get; set; }
    public int? YearsPlaying { get; set; }
    public string? TournamentLevel { get; set; }
    public string? FavoriteShot { get; set; }
    public string? IntroVideo { get; set; }

    public DateTime CreatedAt { get; set; }
    public bool IsActive { get; set; }
}

public class UpdateProfileRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Bio { get; set; }

    // Basic info fields
    public string? Gender { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? ZipCode { get; set; }
    public string? Country { get; set; }

    // Pickleball info fields
    public string? Handedness { get; set; }
    public string? ExperienceLevel { get; set; }
    public string? PlayingStyle { get; set; }
    public string? PaddleBrand { get; set; }
    public string? PaddleModel { get; set; }
    public int? YearsPlaying { get; set; }
    public string? TournamentLevel { get; set; }
    public string? FavoriteShot { get; set; }
    public string? IntroVideo { get; set; }
}

public class AdminUpdateUserRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Bio { get; set; }
    public string? Role { get; set; }
    public bool? IsActive { get; set; }
}

public class AvatarResponse
{
    public string AvatarUrl { get; set; } = string.Empty;
}
