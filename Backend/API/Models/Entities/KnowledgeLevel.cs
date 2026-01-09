using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Admin-configurable options for "How well do you know the player?"
/// </summary>
public class KnowledgeLevel
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public int SortOrder { get; set; } = 0;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}
