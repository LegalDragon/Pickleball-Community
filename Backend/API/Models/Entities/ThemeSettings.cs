using System.ComponentModel.DataAnnotations;

namespace Pickleball.College.Models.Entities;

public class ThemeSettings
{
    [Key]
    public int ThemeId { get; set; }

    [Required]
    [MaxLength(200)]
    public string OrganizationName { get; set; } = "Pickleball College";

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

    // Status
    public bool IsActive { get; set; } = true;

    // Audit fields
    public int? UpdatedBy { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
