using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.Entities;

public class ContentType
{
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Code { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Icon { get; set; } = string.Empty;

    [MaxLength(500)]
    public string Prompt { get; set; } = string.Empty;

    [MaxLength(500)]
    public string AllowedExtensions { get; set; } = string.Empty;

    public int MaxFileSizeMB { get; set; } = 100;

    public int SortOrder { get; set; } = 0;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
