using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.Entities;

public class UserSocialLink
{
    public int Id { get; set; }

    [Required]
    public int UserId { get; set; }

    [Required]
    [MaxLength(50)]
    public string Platform { get; set; } = string.Empty; // Twitter, Instagram, Facebook, LinkedIn, YouTube, TikTok, Website, Other

    [Required]
    [MaxLength(500)]
    public string Url { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? DisplayName { get; set; } // Optional custom display name (e.g., "@username")

    public int SortOrder { get; set; } = 0;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public virtual User? User { get; set; }
}

// Supported platforms enum for reference
public static class SocialPlatforms
{
    public const string Twitter = "Twitter";
    public const string Instagram = "Instagram";
    public const string Facebook = "Facebook";
    public const string LinkedIn = "LinkedIn";
    public const string YouTube = "YouTube";
    public const string TikTok = "TikTok";
    public const string Twitch = "Twitch";
    public const string Discord = "Discord";
    public const string Website = "Website";
    public const string Other = "Other";

    public static readonly string[] All = new[]
    {
        Twitter, Instagram, Facebook, LinkedIn, YouTube, TikTok, Twitch, Discord, Website, Other
    };

    public static bool IsValid(string platform) => All.Contains(platform);
}
