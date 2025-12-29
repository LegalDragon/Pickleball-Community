using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.Entities;

public class ThemePreset
{
    [Key]
    public int PresetId { get; set; }

    [Required]
    [MaxLength(100)]
    public string PresetName { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

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

    // Preview image
    [MaxLength(500)]
    public string? PreviewImage { get; set; }

    // Default flag
    public bool IsDefault { get; set; } = false;
}
