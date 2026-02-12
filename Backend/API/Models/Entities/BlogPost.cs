using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public enum BlogPostStatus
{
    Draft,
    Published,
    Archived
}

public enum BlogPostType
{
    Blog,
    Vlog
}

public class BlogPost
{
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Slug { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Excerpt { get; set; }

    [Required]
    public string Content { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? FeaturedImageUrl { get; set; }

    // Video support for Vlogs
    public BlogPostType PostType { get; set; } = BlogPostType.Blog;

    [MaxLength(500)]
    public string? VideoUrl { get; set; }

    public int? VideoAssetId { get; set; }

    public int AuthorId { get; set; }

    public int? CategoryId { get; set; }

    public BlogPostStatus Status { get; set; } = BlogPostStatus.Draft;

    public DateTime? PublishedAt { get; set; }

    public int ViewCount { get; set; } = 0;

    public bool AllowComments { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public DateTime? UpdatedAt { get; set; }

    // Navigation
    [ForeignKey("AuthorId")]
    public virtual User? Author { get; set; }

    [ForeignKey("CategoryId")]
    public virtual BlogCategory? Category { get; set; }

    public virtual ICollection<BlogComment> Comments { get; set; } = new List<BlogComment>();
}
