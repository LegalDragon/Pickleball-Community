namespace Pickleball.Community.Models.DTOs;

public class ThemeSettingsDto
{
    public int ThemeId { get; set; }
    public string OrganizationName { get; set; } = "Pickleball Community";
    public string? LogoUrl { get; set; }
    public string? FaviconUrl { get; set; }

    // Primary colors
    public string PrimaryColor { get; set; } = "#047857";
    public string PrimaryDarkColor { get; set; } = "#065f46";
    public string PrimaryLightColor { get; set; } = "#d1fae5";

    // Accent colors
    public string AccentColor { get; set; } = "#f59e0b";
    public string AccentDarkColor { get; set; } = "#d97706";
    public string AccentLightColor { get; set; } = "#fef3c7";

    // Status colors
    public string SuccessColor { get; set; } = "#10b981";
    public string ErrorColor { get; set; } = "#ef4444";
    public string WarningColor { get; set; } = "#f59e0b";
    public string InfoColor { get; set; } = "#3b82f6";

    // Text colors
    public string TextPrimaryColor { get; set; } = "#111827";
    public string TextSecondaryColor { get; set; } = "#6b7280";
    public string TextLightColor { get; set; } = "#f9fafb";

    // Background colors
    public string BackgroundColor { get; set; } = "#ffffff";
    public string BackgroundSecondaryColor { get; set; } = "#f3f4f6";

    // Other colors
    public string BorderColor { get; set; } = "#e5e7eb";
    public string ShadowColor { get; set; } = "#00000026";

    // Typography
    public string FontFamily { get; set; } = "Inter, system-ui, sans-serif";
    public string HeadingFontFamily { get; set; } = "Playfair Display, serif";

    // Custom CSS
    public string? CustomCss { get; set; }

    public DateTime? UpdatedAt { get; set; }
}

public class UpdateThemeRequest
{
    public string? OrganizationName { get; set; }
    public string? LogoUrl { get; set; }
    public string? FaviconUrl { get; set; }

    // Primary colors
    public string? PrimaryColor { get; set; }
    public string? PrimaryDarkColor { get; set; }
    public string? PrimaryLightColor { get; set; }

    // Accent colors
    public string? AccentColor { get; set; }
    public string? AccentDarkColor { get; set; }
    public string? AccentLightColor { get; set; }

    // Status colors
    public string? SuccessColor { get; set; }
    public string? ErrorColor { get; set; }
    public string? WarningColor { get; set; }
    public string? InfoColor { get; set; }

    // Text colors
    public string? TextPrimaryColor { get; set; }
    public string? TextSecondaryColor { get; set; }
    public string? TextLightColor { get; set; }

    // Background colors
    public string? BackgroundColor { get; set; }
    public string? BackgroundSecondaryColor { get; set; }

    // Other colors
    public string? BorderColor { get; set; }
    public string? ShadowColor { get; set; }

    // Typography
    public string? FontFamily { get; set; }
    public string? HeadingFontFamily { get; set; }

    // Custom CSS
    public string? CustomCss { get; set; }
}

public class ThemePresetDto
{
    public int PresetId { get; set; }
    public string PresetName { get; set; } = string.Empty;
    public string? Description { get; set; }

    // Primary colors
    public string PrimaryColor { get; set; } = "#047857";
    public string PrimaryDarkColor { get; set; } = "#065f46";
    public string PrimaryLightColor { get; set; } = "#d1fae5";

    // Accent colors
    public string AccentColor { get; set; } = "#f59e0b";
    public string AccentDarkColor { get; set; } = "#d97706";
    public string AccentLightColor { get; set; } = "#fef3c7";

    public string? PreviewImage { get; set; }
    public bool IsDefault { get; set; }
}

public class UploadResponse
{
    public string Url { get; set; } = string.Empty;
}

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public T? Data { get; set; }
}
