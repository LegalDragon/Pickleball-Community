namespace Pickleball.Community.Models.DTOs;

public class UserProfileDto
{
    public int Id { get; set; }
    public string? Email { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Role { get; set; }
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

    public DateTime? CreatedAt { get; set; }
    public bool IsActive { get; set; }

    // Social media links
    public List<SocialLinkDto>? SocialLinks { get; set; }
}

public class UpdateProfileRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
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

// Public profile DTO - excludes private information
public class PublicProfileDto
{
    public int Id { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Email { get; set; }
    public string? Bio { get; set; }
    public string? ProfileImageUrl { get; set; }

    // Location (city/state only, no address)
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }

    // Pickleball info (all public)
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

    // Friendship status (for logged-in users)
    public string? FriendshipStatus { get; set; } // "friends", "pending_sent", "pending_received", "none"
    public int? FriendRequestId { get; set; }

    // Social media links (public)
    public List<SocialLinkDto>? SocialLinks { get; set; }
}

// Lightweight DTO for recently joined players marquee
public class RecentPlayerDto
{
    public int Id { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? ProfileImageUrl { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public DateTime JoinedAt { get; set; }
}

// Social media link DTO
public class SocialLinkDto
{
    public int Id { get; set; }
    public string Platform { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public int SortOrder { get; set; }
}

// DTO for creating a social link
public class CreateSocialLinkRequest
{
    public string Platform { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public int? SortOrder { get; set; }
}

// DTO for updating a social link
public class UpdateSocialLinkRequest
{
    public string? Url { get; set; }
    public string? DisplayName { get; set; }
    public int? SortOrder { get; set; }
}

// DTO for bulk updating social links (reorder or replace all)
public class BulkUpdateSocialLinksRequest
{
    public List<CreateSocialLinkRequest> Links { get; set; } = new();
}
