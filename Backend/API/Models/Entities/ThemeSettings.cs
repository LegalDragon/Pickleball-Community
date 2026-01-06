using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.Entities;

public class ThemeSettings
{
    [Key]
    public int ThemeId { get; set; }

    [Required]
    [MaxLength(200)]
    public string OrganizationName { get; set; } = "Pickleball Community";

    [MaxLength(500)]
    public string? LogoUrl { get; set; }

    [MaxLength(500)]
    public string? FaviconUrl { get; set; }

    // Primary colors
    [MaxLength(20)]
    public string PrimaryColor { get; set; } = "#047857";

    [MaxLength(20)]
    public string PrimaryDarkColor { get; set; } = "#065f46";

    [MaxLength(20)]
    public string PrimaryLightColor { get; set; } = "#d1fae5";

    // Accent colors
    [MaxLength(20)]
    public string AccentColor { get; set; } = "#f59e0b";

    [MaxLength(20)]
    public string AccentDarkColor { get; set; } = "#d97706";

    [MaxLength(20)]
    public string AccentLightColor { get; set; } = "#fef3c7";

    // Status colors
    [MaxLength(20)]
    public string SuccessColor { get; set; } = "#10b981";

    [MaxLength(20)]
    public string ErrorColor { get; set; } = "#ef4444";

    [MaxLength(20)]
    public string WarningColor { get; set; } = "#f59e0b";

    [MaxLength(20)]
    public string InfoColor { get; set; } = "#3b82f6";

    // Text colors
    [MaxLength(20)]
    public string TextPrimaryColor { get; set; } = "#111827";

    [MaxLength(20)]
    public string TextSecondaryColor { get; set; } = "#6b7280";

    [MaxLength(20)]
    public string TextLightColor { get; set; } = "#f9fafb";

    // Background colors
    [MaxLength(20)]
    public string BackgroundColor { get; set; } = "#ffffff";

    [MaxLength(20)]
    public string BackgroundSecondaryColor { get; set; } = "#f3f4f6";

    // Other colors
    [MaxLength(20)]
    public string BorderColor { get; set; } = "#e5e7eb";

    [MaxLength(20)]
    public string ShadowColor { get; set; } = "#00000026";

    // Typography
    [MaxLength(200)]
    public string FontFamily { get; set; } = "Inter, system-ui, sans-serif";

    [MaxLength(200)]
    public string HeadingFontFamily { get; set; } = "Playfair Display, serif";

    // Custom CSS
    public string? CustomCss { get; set; }

    // Hero Section
    [MaxLength(500)]
    public string? HeroVideoUrl { get; set; }

    [MaxLength(500)]
    public string? HeroVideoThumbnailUrl { get; set; }

    [MaxLength(500)]
    public string? HeroImageUrl { get; set; }

    [MaxLength(200)]
    public string? HeroTitle { get; set; } = "Your Pickleball Community Awaits";

    [MaxLength(500)]
    public string? HeroSubtitle { get; set; } = "Connect with players, find courts, join clubs, and get certified. The ultimate platform for pickleball enthusiasts.";

    [MaxLength(100)]
    public string? HeroCtaText { get; set; } = "Find Courts";

    [MaxLength(200)]
    public string? HeroCtaLink { get; set; } = "/courts";

    [MaxLength(100)]
    public string? HeroSecondaryCtaText { get; set; } = "Join a Club";

    [MaxLength(200)]
    public string? HeroSecondaryCtaLink { get; set; } = "/clubs";

    // Marquee Settings
    public bool MarqueeShowPlayers { get; set; } = true;
    public bool MarqueeShowClubs { get; set; } = true;
    public int MarqueeRecentDays { get; set; } = 30; // How many days back to consider "recent"
    public int MarqueePlayerCount { get; set; } = 20; // Max players to show
    public int MarqueeClubCount { get; set; } = 15; // Max clubs to show
    public int MarqueeSpeed { get; set; } = 40; // Animation duration in seconds (higher = slower)

    // Status
    public bool IsActive { get; set; } = true;

    // Audit fields
    public int? UpdatedBy { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
