using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.RegularExpressions;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class BlogController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<BlogController> _logger;

    public BlogController(ApplicationDbContext context, ILogger<BlogController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private async Task<bool> CanUserWriteBlog(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        return user != null && (user.Role == "Admin" || user.CanWriteBlog);
    }

    private static string GenerateSlug(string title)
    {
        var slug = title.ToLowerInvariant();
        slug = Regex.Replace(slug, @"[^a-z0-9\s-]", "");
        slug = Regex.Replace(slug, @"\s+", "-");
        slug = Regex.Replace(slug, @"-+", "-");
        slug = slug.Trim('-');
        return slug;
    }

    #region Categories

    // GET: /Blog/categories
    [HttpGet("categories")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<BlogCategoryDto>>>> GetCategories()
    {
        try
        {
            var categories = await _context.BlogCategories
                .Where(c => c.IsActive)
                .OrderBy(c => c.SortOrder)
                .Select(c => new BlogCategoryDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    Slug = c.Slug,
                    Description = c.Description,
                    IsActive = c.IsActive,
                    SortOrder = c.SortOrder,
                    PostCount = c.Posts.Count(p => p.Status == BlogPostStatus.Published)
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<BlogCategoryDto>> { Success = true, Data = categories });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching blog categories");
            return StatusCode(500, new ApiResponse<List<BlogCategoryDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /Blog/categories/all (Admin)
    [HttpGet("categories/all")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<List<BlogCategoryDto>>>> GetAllCategories()
    {
        try
        {
            var categories = await _context.BlogCategories
                .OrderBy(c => c.SortOrder)
                .Select(c => new BlogCategoryDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    Slug = c.Slug,
                    Description = c.Description,
                    IsActive = c.IsActive,
                    SortOrder = c.SortOrder,
                    PostCount = c.Posts.Count
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<BlogCategoryDto>> { Success = true, Data = categories });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching all blog categories");
            return StatusCode(500, new ApiResponse<List<BlogCategoryDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /Blog/categories (Admin)
    [HttpPost("categories")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<BlogCategoryDto>>> CreateCategory([FromBody] CreateBlogCategoryRequest request)
    {
        try
        {
            var slug = GenerateSlug(request.Name);
            var existingSlug = await _context.BlogCategories.AnyAsync(c => c.Slug == slug);
            if (existingSlug)
            {
                slug = $"{slug}-{DateTime.UtcNow.Ticks % 10000}";
            }

            var category = new BlogCategory
            {
                Name = request.Name,
                Slug = slug,
                Description = request.Description,
                SortOrder = request.SortOrder,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.BlogCategories.Add(category);
            await _context.SaveChangesAsync();

            var dto = new BlogCategoryDto
            {
                Id = category.Id,
                Name = category.Name,
                Slug = category.Slug,
                Description = category.Description,
                IsActive = category.IsActive,
                SortOrder = category.SortOrder,
                PostCount = 0
            };

            return Ok(new ApiResponse<BlogCategoryDto> { Success = true, Data = dto, Message = "Category created" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating blog category");
            return StatusCode(500, new ApiResponse<BlogCategoryDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /Blog/categories/{id} (Admin)
    [HttpPut("categories/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<BlogCategoryDto>>> UpdateCategory(int id, [FromBody] UpdateBlogCategoryRequest request)
    {
        try
        {
            var category = await _context.BlogCategories.FindAsync(id);
            if (category == null)
            {
                return NotFound(new ApiResponse<BlogCategoryDto> { Success = false, Message = "Category not found" });
            }

            if (!string.IsNullOrEmpty(request.Name) && request.Name != category.Name)
            {
                category.Name = request.Name;
                category.Slug = GenerateSlug(request.Name);
            }
            if (request.Description != null) category.Description = request.Description;
            if (request.IsActive.HasValue) category.IsActive = request.IsActive.Value;
            if (request.SortOrder.HasValue) category.SortOrder = request.SortOrder.Value;
            category.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            var dto = new BlogCategoryDto
            {
                Id = category.Id,
                Name = category.Name,
                Slug = category.Slug,
                Description = category.Description,
                IsActive = category.IsActive,
                SortOrder = category.SortOrder,
                PostCount = await _context.BlogPosts.CountAsync(p => p.CategoryId == id)
            };

            return Ok(new ApiResponse<BlogCategoryDto> { Success = true, Data = dto, Message = "Category updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating blog category {CategoryId}", id);
            return StatusCode(500, new ApiResponse<BlogCategoryDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /Blog/categories/{id} (Admin)
    [HttpDelete("categories/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteCategory(int id)
    {
        try
        {
            var category = await _context.BlogCategories.FindAsync(id);
            if (category == null)
            {
                return NotFound(new ApiResponse<object> { Success = false, Message = "Category not found" });
            }

            _context.BlogCategories.Remove(category);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object> { Success = true, Message = "Category deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting blog category {CategoryId}", id);
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }

    #endregion

    #region Posts

    // GET: /Blog/posts (Public - published posts only)
    [HttpGet("posts")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<BlogPostListDto>>>> GetPosts(
        [FromQuery] string? category = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        try
        {
            var query = _context.BlogPosts
                .Include(p => p.Author)
                .Include(p => p.Category)
                .Where(p => p.Status == BlogPostStatus.Published);

            if (!string.IsNullOrEmpty(category))
            {
                query = query.Where(p => p.Category != null && p.Category.Slug == category);
            }

            var total = await query.CountAsync();
            var posts = await query
                .OrderByDescending(p => p.PublishedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new BlogPostListDto
                {
                    Id = p.Id,
                    Title = p.Title,
                    Slug = p.Slug,
                    Excerpt = p.Excerpt,
                    FeaturedImageUrl = p.FeaturedImageUrl,
                    AuthorName = $"{p.Author!.FirstName} {p.Author.LastName}",
                    AuthorImageUrl = p.Author.ProfileImageUrl,
                    CategoryName = p.Category != null ? p.Category.Name : null,
                    CategorySlug = p.Category != null ? p.Category.Slug : null,
                    Status = p.Status.ToString(),
                    PublishedAt = p.PublishedAt,
                    ViewCount = p.ViewCount,
                    CommentCount = p.Comments.Count(c => c.IsApproved && !c.IsDeleted),
                    AverageRating = _context.Ratings
                        .Where(r => r.RatableType == "BlogPost" && r.RatableId == p.Id)
                        .Average(r => (double?)r.Stars),
                    CreatedAt = p.CreatedAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<BlogPostListDto>>
            {
                Success = true,
                Data = posts,
                Message = $"Page {page} of {Math.Ceiling((double)total / pageSize)}, Total: {total}"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching blog posts");
            return StatusCode(500, new ApiResponse<List<BlogPostListDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /Blog/posts/my (Author's posts)
    [HttpGet("posts/my")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<BlogPostListDto>>>> GetMyPosts()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<List<BlogPostListDto>> { Success = false, Message = "Not authenticated" });
            }

            var posts = await _context.BlogPosts
                .Include(p => p.Author)
                .Include(p => p.Category)
                .Where(p => p.AuthorId == userId.Value)
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new BlogPostListDto
                {
                    Id = p.Id,
                    Title = p.Title,
                    Slug = p.Slug,
                    Excerpt = p.Excerpt,
                    FeaturedImageUrl = p.FeaturedImageUrl,
                    AuthorName = $"{p.Author!.FirstName} {p.Author.LastName}",
                    AuthorImageUrl = p.Author.ProfileImageUrl,
                    CategoryName = p.Category != null ? p.Category.Name : null,
                    CategorySlug = p.Category != null ? p.Category.Slug : null,
                    Status = p.Status.ToString(),
                    PublishedAt = p.PublishedAt,
                    ViewCount = p.ViewCount,
                    CommentCount = p.Comments.Count(c => !c.IsDeleted),
                    AverageRating = _context.Ratings
                        .Where(r => r.RatableType == "BlogPost" && r.RatableId == p.Id)
                        .Average(r => (double?)r.Stars),
                    CreatedAt = p.CreatedAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<BlogPostListDto>> { Success = true, Data = posts });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching user's blog posts");
            return StatusCode(500, new ApiResponse<List<BlogPostListDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /Blog/posts/all (Admin - all posts)
    [HttpGet("posts/all")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<List<BlogPostListDto>>>> GetAllPosts(
        [FromQuery] string? status = null)
    {
        try
        {
            var query = _context.BlogPosts
                .Include(p => p.Author)
                .Include(p => p.Category)
                .AsQueryable();

            // Filter by status if provided
            if (!string.IsNullOrEmpty(status) && Enum.TryParse<BlogPostStatus>(status, true, out var statusEnum))
            {
                query = query.Where(p => p.Status == statusEnum);
            }

            var posts = await query
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new BlogPostListDto
                {
                    Id = p.Id,
                    Title = p.Title,
                    Slug = p.Slug,
                    Excerpt = p.Excerpt,
                    FeaturedImageUrl = p.FeaturedImageUrl,
                    AuthorName = $"{p.Author!.FirstName} {p.Author.LastName}",
                    AuthorImageUrl = p.Author.ProfileImageUrl,
                    CategoryName = p.Category != null ? p.Category.Name : null,
                    CategorySlug = p.Category != null ? p.Category.Slug : null,
                    Status = p.Status.ToString(),
                    PublishedAt = p.PublishedAt,
                    ViewCount = p.ViewCount,
                    CommentCount = p.Comments.Count(c => !c.IsDeleted),
                    AverageRating = _context.Ratings
                        .Where(r => r.RatableType == "BlogPost" && r.RatableId == p.Id)
                        .Average(r => (double?)r.Stars),
                    CreatedAt = p.CreatedAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<BlogPostListDto>> { Success = true, Data = posts });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching all blog posts");
            return StatusCode(500, new ApiResponse<List<BlogPostListDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /Blog/posts/{slug}
    [HttpGet("posts/{slug}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<BlogPostDto>>> GetPost(string slug)
    {
        try
        {
            var userId = GetCurrentUserId();
            var post = await _context.BlogPosts
                .Include(p => p.Author)
                .Include(p => p.Category)
                .Include(p => p.Comments.Where(c => c.IsApproved && !c.IsDeleted && c.ParentId == null))
                    .ThenInclude(c => c.User)
                .FirstOrDefaultAsync(p => p.Slug == slug);

            if (post == null)
            {
                return NotFound(new ApiResponse<BlogPostDto> { Success = false, Message = "Post not found" });
            }

            // Only show unpublished posts to author or admin
            if (post.Status != BlogPostStatus.Published)
            {
                if (!userId.HasValue || (post.AuthorId != userId.Value && !User.IsInRole("Admin")))
                {
                    return NotFound(new ApiResponse<BlogPostDto> { Success = false, Message = "Post not found" });
                }
            }
            else
            {
                // Increment view count for published posts
                post.ViewCount++;
                await _context.SaveChangesAsync();
            }

            var ratingStats = await _context.Ratings
                .Where(r => r.RatableType == "BlogPost" && r.RatableId == post.Id)
                .GroupBy(r => 1)
                .Select(g => new { Average = g.Average(r => r.Stars), Count = g.Count() })
                .FirstOrDefaultAsync();

            var dto = new BlogPostDto
            {
                Id = post.Id,
                Title = post.Title,
                Slug = post.Slug,
                Excerpt = post.Excerpt,
                Content = post.Content,
                FeaturedImageUrl = post.FeaturedImageUrl,
                AuthorId = post.AuthorId,
                AuthorName = $"{post.Author!.FirstName} {post.Author.LastName}",
                AuthorImageUrl = post.Author.ProfileImageUrl,
                CategoryId = post.CategoryId,
                CategoryName = post.Category?.Name,
                CategorySlug = post.Category?.Slug,
                Status = post.Status.ToString(),
                PublishedAt = post.PublishedAt,
                ViewCount = post.ViewCount,
                AllowComments = post.AllowComments,
                CommentCount = post.Comments.Count,
                AverageRating = ratingStats?.Average,
                RatingCount = ratingStats?.Count ?? 0,
                CreatedAt = post.CreatedAt,
                UpdatedAt = post.UpdatedAt
            };

            return Ok(new ApiResponse<BlogPostDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching blog post {Slug}", slug);
            return StatusCode(500, new ApiResponse<BlogPostDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /Blog/posts
    [HttpPost("posts")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<BlogPostDto>>> CreatePost([FromBody] CreateBlogPostRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<BlogPostDto> { Success = false, Message = "Not authenticated" });
            }

            if (!await CanUserWriteBlog(userId.Value))
            {
                return Forbid();
            }

            var slug = GenerateSlug(request.Title);
            var existingSlug = await _context.BlogPosts.AnyAsync(p => p.Slug == slug);
            if (existingSlug)
            {
                slug = $"{slug}-{DateTime.UtcNow.Ticks % 10000}";
            }

            var post = new BlogPost
            {
                Title = request.Title,
                Slug = slug,
                Excerpt = request.Excerpt,
                Content = request.Content,
                FeaturedImageUrl = request.FeaturedImageUrl,
                AuthorId = userId.Value,
                CategoryId = request.CategoryId,
                AllowComments = request.AllowComments,
                Status = request.Publish ? BlogPostStatus.Published : BlogPostStatus.Draft,
                PublishedAt = request.Publish ? DateTime.UtcNow : null,
                CreatedAt = DateTime.UtcNow
            };

            _context.BlogPosts.Add(post);
            await _context.SaveChangesAsync();

            var author = await _context.Users.FindAsync(userId.Value);
            var category = request.CategoryId.HasValue ? await _context.BlogCategories.FindAsync(request.CategoryId.Value) : null;

            var dto = new BlogPostDto
            {
                Id = post.Id,
                Title = post.Title,
                Slug = post.Slug,
                Excerpt = post.Excerpt,
                Content = post.Content,
                FeaturedImageUrl = post.FeaturedImageUrl,
                AuthorId = post.AuthorId,
                AuthorName = $"{author?.FirstName} {author?.LastName}",
                AuthorImageUrl = author?.ProfileImageUrl,
                CategoryId = post.CategoryId,
                CategoryName = category?.Name,
                CategorySlug = category?.Slug,
                Status = post.Status.ToString(),
                PublishedAt = post.PublishedAt,
                ViewCount = 0,
                AllowComments = post.AllowComments,
                CommentCount = 0,
                CreatedAt = post.CreatedAt
            };

            return Ok(new ApiResponse<BlogPostDto> { Success = true, Data = dto, Message = "Post created" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating blog post");
            return StatusCode(500, new ApiResponse<BlogPostDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /Blog/posts/{id}
    [HttpPut("posts/{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<BlogPostDto>>> UpdatePost(int id, [FromBody] UpdateBlogPostRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<BlogPostDto> { Success = false, Message = "Not authenticated" });
            }

            var post = await _context.BlogPosts
                .Include(p => p.Author)
                .Include(p => p.Category)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (post == null)
            {
                return NotFound(new ApiResponse<BlogPostDto> { Success = false, Message = "Post not found" });
            }

            // Only author or admin can edit
            if (post.AuthorId != userId.Value && !User.IsInRole("Admin"))
            {
                return Forbid();
            }

            if (!string.IsNullOrEmpty(request.Title) && request.Title != post.Title)
            {
                post.Title = request.Title;
                var newSlug = GenerateSlug(request.Title);
                if (newSlug != post.Slug && !await _context.BlogPosts.AnyAsync(p => p.Slug == newSlug && p.Id != id))
                {
                    post.Slug = newSlug;
                }
            }
            if (request.Excerpt != null) post.Excerpt = request.Excerpt;
            if (request.Content != null) post.Content = request.Content;
            if (request.FeaturedImageUrl != null) post.FeaturedImageUrl = request.FeaturedImageUrl;
            if (request.CategoryId.HasValue) post.CategoryId = request.CategoryId.Value;
            if (request.AllowComments.HasValue) post.AllowComments = request.AllowComments.Value;

            if (!string.IsNullOrEmpty(request.Status))
            {
                var newStatus = Enum.Parse<BlogPostStatus>(request.Status);
                if (newStatus == BlogPostStatus.Published && post.Status != BlogPostStatus.Published)
                {
                    post.PublishedAt = DateTime.UtcNow;
                }
                post.Status = newStatus;
            }

            post.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Reload category if changed
            if (request.CategoryId.HasValue)
            {
                await _context.Entry(post).Reference(p => p.Category).LoadAsync();
            }

            var dto = new BlogPostDto
            {
                Id = post.Id,
                Title = post.Title,
                Slug = post.Slug,
                Excerpt = post.Excerpt,
                Content = post.Content,
                FeaturedImageUrl = post.FeaturedImageUrl,
                AuthorId = post.AuthorId,
                AuthorName = $"{post.Author!.FirstName} {post.Author.LastName}",
                AuthorImageUrl = post.Author.ProfileImageUrl,
                CategoryId = post.CategoryId,
                CategoryName = post.Category?.Name,
                CategorySlug = post.Category?.Slug,
                Status = post.Status.ToString(),
                PublishedAt = post.PublishedAt,
                ViewCount = post.ViewCount,
                AllowComments = post.AllowComments,
                CommentCount = await _context.BlogComments.CountAsync(c => c.PostId == id && !c.IsDeleted),
                CreatedAt = post.CreatedAt,
                UpdatedAt = post.UpdatedAt
            };

            return Ok(new ApiResponse<BlogPostDto> { Success = true, Data = dto, Message = "Post updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating blog post {PostId}", id);
            return StatusCode(500, new ApiResponse<BlogPostDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /Blog/posts/{id}
    [HttpDelete("posts/{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> DeletePost(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<object> { Success = false, Message = "Not authenticated" });
            }

            var post = await _context.BlogPosts.FindAsync(id);
            if (post == null)
            {
                return NotFound(new ApiResponse<object> { Success = false, Message = "Post not found" });
            }

            // Only author or admin can delete
            if (post.AuthorId != userId.Value && !User.IsInRole("Admin"))
            {
                return Forbid();
            }

            _context.BlogPosts.Remove(post);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object> { Success = true, Message = "Post deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting blog post {PostId}", id);
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }

    #endregion

    #region Comments

    // GET: /Blog/posts/{postId}/comments
    [HttpGet("posts/{postId}/comments")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<BlogCommentDto>>>> GetComments(int postId)
    {
        try
        {
            var comments = await _context.BlogComments
                .Include(c => c.User)
                .Include(c => c.Replies.Where(r => r.IsApproved && !r.IsDeleted))
                    .ThenInclude(r => r.User)
                .Where(c => c.PostId == postId && c.IsApproved && !c.IsDeleted && c.ParentId == null)
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => MapCommentToDto(c))
                .ToListAsync();

            return Ok(new ApiResponse<List<BlogCommentDto>> { Success = true, Data = comments });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching comments for post {PostId}", postId);
            return StatusCode(500, new ApiResponse<List<BlogCommentDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /Blog/posts/{postId}/comments
    [HttpPost("posts/{postId}/comments")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<BlogCommentDto>>> CreateComment(int postId, [FromBody] CreateBlogCommentRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<BlogCommentDto> { Success = false, Message = "Not authenticated" });
            }

            var post = await _context.BlogPosts.FindAsync(postId);
            if (post == null)
            {
                return NotFound(new ApiResponse<BlogCommentDto> { Success = false, Message = "Post not found" });
            }

            if (!post.AllowComments)
            {
                return BadRequest(new ApiResponse<BlogCommentDto> { Success = false, Message = "Comments are disabled for this post" });
            }

            var comment = new BlogComment
            {
                PostId = postId,
                UserId = userId.Value,
                Content = request.Content,
                ParentId = request.ParentId,
                IsApproved = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.BlogComments.Add(comment);
            await _context.SaveChangesAsync();

            var user = await _context.Users.FindAsync(userId.Value);
            var dto = new BlogCommentDto
            {
                Id = comment.Id,
                PostId = comment.PostId,
                UserId = comment.UserId,
                UserName = $"{user?.FirstName} {user?.LastName}",
                UserImageUrl = user?.ProfileImageUrl,
                Content = comment.Content,
                ParentId = comment.ParentId,
                IsApproved = comment.IsApproved,
                CreatedAt = comment.CreatedAt
            };

            return Ok(new ApiResponse<BlogCommentDto> { Success = true, Data = dto, Message = "Comment added" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating comment for post {PostId}", postId);
            return StatusCode(500, new ApiResponse<BlogCommentDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /Blog/comments/{id}
    [HttpPut("comments/{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<BlogCommentDto>>> UpdateComment(int id, [FromBody] UpdateBlogCommentRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<BlogCommentDto> { Success = false, Message = "Not authenticated" });
            }

            var comment = await _context.BlogComments.Include(c => c.User).FirstOrDefaultAsync(c => c.Id == id);
            if (comment == null)
            {
                return NotFound(new ApiResponse<BlogCommentDto> { Success = false, Message = "Comment not found" });
            }

            // Only comment author or admin can edit
            if (comment.UserId != userId.Value && !User.IsInRole("Admin"))
            {
                return Forbid();
            }

            comment.Content = request.Content;
            comment.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var dto = new BlogCommentDto
            {
                Id = comment.Id,
                PostId = comment.PostId,
                UserId = comment.UserId,
                UserName = $"{comment.User?.FirstName} {comment.User?.LastName}",
                UserImageUrl = comment.User?.ProfileImageUrl,
                Content = comment.Content,
                ParentId = comment.ParentId,
                IsApproved = comment.IsApproved,
                CreatedAt = comment.CreatedAt,
                UpdatedAt = comment.UpdatedAt
            };

            return Ok(new ApiResponse<BlogCommentDto> { Success = true, Data = dto, Message = "Comment updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating comment {CommentId}", id);
            return StatusCode(500, new ApiResponse<BlogCommentDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /Blog/comments/{id}
    [HttpDelete("comments/{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> DeleteComment(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<object> { Success = false, Message = "Not authenticated" });
            }

            var comment = await _context.BlogComments.FindAsync(id);
            if (comment == null)
            {
                return NotFound(new ApiResponse<object> { Success = false, Message = "Comment not found" });
            }

            // Only comment author, post author, or admin can delete
            var post = await _context.BlogPosts.FindAsync(comment.PostId);
            if (comment.UserId != userId.Value && post?.AuthorId != userId.Value && !User.IsInRole("Admin"))
            {
                return Forbid();
            }

            comment.IsDeleted = true;
            comment.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object> { Success = true, Message = "Comment deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting comment {CommentId}", id);
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }

    #endregion

    #region Blog Writers Management

    // GET: /Blog/writers (Admin - get users who can write blogs)
    [HttpGet("writers")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<List<UserProfileDto>>>> GetBlogWriters()
    {
        try
        {
            var writers = await _context.Users
                .Where(u => u.CanWriteBlog || u.Role == "Admin")
                .Select(u => new UserProfileDto
                {
                    Id = u.Id,
                    Email = u.Email,
                    FirstName = u.FirstName,
                    LastName = u.LastName,
                    Role = u.Role,
                    ProfileImageUrl = u.ProfileImageUrl,
                    IsActive = u.IsActive
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<UserProfileDto>> { Success = true, Data = writers });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching blog writers");
            return StatusCode(500, new ApiResponse<List<UserProfileDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /Blog/writers/{userId} (Admin - grant blog writing permission)
    [HttpPost("writers/{userId}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<object>>> GrantBlogWriter(int userId)
    {
        try
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return NotFound(new ApiResponse<object> { Success = false, Message = "User not found" });
            }

            user.CanWriteBlog = true;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object> { Success = true, Message = "Blog writing permission granted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error granting blog writer permission to user {UserId}", userId);
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /Blog/writers/{userId} (Admin - revoke blog writing permission)
    [HttpDelete("writers/{userId}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<object>>> RevokeBlogWriter(int userId)
    {
        try
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return NotFound(new ApiResponse<object> { Success = false, Message = "User not found" });
            }

            user.CanWriteBlog = false;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object> { Success = true, Message = "Blog writing permission revoked" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error revoking blog writer permission from user {UserId}", userId);
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }

    #endregion

    private static BlogCommentDto MapCommentToDto(BlogComment comment)
    {
        return new BlogCommentDto
        {
            Id = comment.Id,
            PostId = comment.PostId,
            UserId = comment.UserId,
            UserName = $"{comment.User?.FirstName} {comment.User?.LastName}",
            UserImageUrl = comment.User?.ProfileImageUrl,
            Content = comment.Content,
            ParentId = comment.ParentId,
            IsApproved = comment.IsApproved,
            CreatedAt = comment.CreatedAt,
            UpdatedAt = comment.UpdatedAt,
            Replies = comment.Replies?
                .Where(r => r.IsApproved && !r.IsDeleted)
                .OrderBy(r => r.CreatedAt)
                .Select(r => MapCommentToDto(r))
                .ToList() ?? new List<BlogCommentDto>()
        };
    }
}
