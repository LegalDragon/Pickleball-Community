using System;
using System.ComponentModel.DataAnnotations;

namespace Pickleball.College.API.Models.DTOs
{
    // DTO for listing blog posts (summary view)
    public class BlogPostListDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string? Summary { get; set; }
        public string? FeaturedImageUrl { get; set; }
        public string? Category { get; set; }
        public string? Tags { get; set; }
        public BlogAuthorDto Author { get; set; } = null!;
        public bool IsPublished { get; set; }
        public DateTime? PublishedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public int ViewCount { get; set; }
    }

    // DTO for full blog post detail
    public class BlogPostDetailDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string? Summary { get; set; }
        public string Content { get; set; } = string.Empty;
        public string? FeaturedImageUrl { get; set; }
        public string? Category { get; set; }
        public string? Tags { get; set; }
        public BlogAuthorDto Author { get; set; } = null!;
        public bool IsPublished { get; set; }
        public DateTime? PublishedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public int ViewCount { get; set; }
    }

    // DTO for blog author info
    public class BlogAuthorDto
    {
        public int Id { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public string? Bio { get; set; }
    }

    // DTO for creating a blog post
    public class CreateBlogPostDto
    {
        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Summary { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? FeaturedImageUrl { get; set; }

        [MaxLength(100)]
        public string? Category { get; set; }

        [MaxLength(500)]
        public string? Tags { get; set; }

        public bool IsPublished { get; set; } = false;
    }

    // DTO for updating a blog post
    public class UpdateBlogPostDto
    {
        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Summary { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? FeaturedImageUrl { get; set; }

        [MaxLength(100)]
        public string? Category { get; set; }

        [MaxLength(500)]
        public string? Tags { get; set; }

        public bool IsPublished { get; set; }
    }
}
