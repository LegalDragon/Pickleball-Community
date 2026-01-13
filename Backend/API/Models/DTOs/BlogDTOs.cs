namespace Pickleball.Community.Models.DTOs;

// Category DTOs
public class BlogCategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public int PostCount { get; set; }
}

public class CreateBlogCategoryRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; } = 0;
}

public class UpdateBlogCategoryRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public bool? IsActive { get; set; }
    public int? SortOrder { get; set; }
}

// Post DTOs
public class BlogPostDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Excerpt { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? FeaturedImageUrl { get; set; }
    public int AuthorId { get; set; }
    public string AuthorName { get; set; } = string.Empty;
    public string? AuthorImageUrl { get; set; }
    public int? CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public string? CategorySlug { get; set; }
    public string Status { get; set; } = "Draft";
    public DateTime? PublishedAt { get; set; }
    public int ViewCount { get; set; }
    public bool AllowComments { get; set; }
    public int CommentCount { get; set; }
    public double? AverageRating { get; set; }
    public int RatingCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class BlogPostListDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Excerpt { get; set; }
    public string? FeaturedImageUrl { get; set; }
    public string AuthorName { get; set; } = string.Empty;
    public string? AuthorImageUrl { get; set; }
    public string? CategoryName { get; set; }
    public string? CategorySlug { get; set; }
    public string Status { get; set; } = "Draft";
    public DateTime? PublishedAt { get; set; }
    public int ViewCount { get; set; }
    public int CommentCount { get; set; }
    public double? AverageRating { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateBlogPostRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Excerpt { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? FeaturedImageUrl { get; set; }
    public int? CategoryId { get; set; }
    public bool AllowComments { get; set; } = true;
    public bool Publish { get; set; } = false;
}

public class UpdateBlogPostRequest
{
    public string? Title { get; set; }
    public string? Excerpt { get; set; }
    public string? Content { get; set; }
    public string? FeaturedImageUrl { get; set; }
    public int? CategoryId { get; set; }
    public bool? AllowComments { get; set; }
    public string? Status { get; set; }
}

// Comment DTOs
public class BlogCommentDto
{
    public int Id { get; set; }
    public int PostId { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? UserImageUrl { get; set; }
    public string Content { get; set; } = string.Empty;
    public int? ParentId { get; set; }
    public bool IsApproved { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<BlogCommentDto> Replies { get; set; } = new();
}

public class CreateBlogCommentRequest
{
    public string Content { get; set; } = string.Empty;
    public int? ParentId { get; set; }
}

public class UpdateBlogCommentRequest
{
    public string Content { get; set; } = string.Empty;
}
