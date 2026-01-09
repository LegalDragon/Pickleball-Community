using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.Entities;

public class BlogCategory
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Slug { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; } = 0;

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public virtual ICollection<BlogPost> Posts { get; set; } = new List<BlogPost>();
}
