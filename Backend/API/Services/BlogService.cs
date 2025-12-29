using Microsoft.EntityFrameworkCore;
using Pickleball.College.API.Models.DTOs;
using Pickleball.College.Models.Entities;
using Pickleball.College.Database;
using System.Text.RegularExpressions;

namespace Pickleball.College.Services
{
    public interface IBlogService
    {
        Task<List<BlogPostListDto>> GetPublishedPostsAsync(int page = 1, int pageSize = 10, string? category = null);
        Task<List<BlogPostListDto>> GetCoachPostsAsync(int coachId, bool includeUnpublished = false);
        Task<BlogPostDetailDto?> GetPostBySlugAsync(string slug);
        Task<BlogPostDetailDto?> GetPostByIdAsync(int id);
        Task<BlogPostDetailDto> CreatePostAsync(int authorId, CreateBlogPostDto dto);
        Task<BlogPostDetailDto?> UpdatePostAsync(int postId, int authorId, UpdateBlogPostDto dto);
        Task<bool> DeletePostAsync(int postId, int authorId);
        Task<bool> TogglePublishAsync(int postId, int authorId);
        Task IncrementViewCountAsync(int postId);
        Task<List<string>> GetCategoriesAsync();
    }

    public class BlogService : IBlogService
    {
        private readonly ApplicationDbContext _context;

        public BlogService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<BlogPostListDto>> GetPublishedPostsAsync(int page = 1, int pageSize = 10, string? category = null)
        {
            var query = _context.BlogPosts
                .Include(b => b.Author)
                .Where(b => b.IsPublished)
                .AsQueryable();

            if (!string.IsNullOrEmpty(category))
            {
                query = query.Where(b => b.Category == category);
            }

            var posts = await query
                .OrderByDescending(b => b.PublishedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return posts.Select(MapToListDto).ToList();
        }

        public async Task<List<BlogPostListDto>> GetCoachPostsAsync(int coachId, bool includeUnpublished = false)
        {
            var query = _context.BlogPosts
                .Include(b => b.Author)
                .Where(b => b.AuthorId == coachId);

            if (!includeUnpublished)
            {
                query = query.Where(b => b.IsPublished);
            }

            var posts = await query
                .OrderByDescending(b => b.CreatedAt)
                .ToListAsync();

            return posts.Select(MapToListDto).ToList();
        }

        public async Task<BlogPostDetailDto?> GetPostBySlugAsync(string slug)
        {
            var post = await _context.BlogPosts
                .Include(b => b.Author)
                .FirstOrDefaultAsync(b => b.Slug == slug);

            return post == null ? null : MapToDetailDto(post);
        }

        public async Task<BlogPostDetailDto?> GetPostByIdAsync(int id)
        {
            var post = await _context.BlogPosts
                .Include(b => b.Author)
                .FirstOrDefaultAsync(b => b.Id == id);

            return post == null ? null : MapToDetailDto(post);
        }

        public async Task<BlogPostDetailDto> CreatePostAsync(int authorId, CreateBlogPostDto dto)
        {
            var slug = GenerateSlug(dto.Title);

            // Ensure unique slug
            var baseSlug = slug;
            var counter = 1;
            while (await _context.BlogPosts.AnyAsync(b => b.Slug == slug))
            {
                slug = $"{baseSlug}-{counter}";
                counter++;
            }

            var post = new BlogPost
            {
                Title = dto.Title,
                Slug = slug,
                Summary = dto.Summary,
                Content = dto.Content,
                FeaturedImageUrl = dto.FeaturedImageUrl,
                Category = dto.Category,
                Tags = dto.Tags,
                AuthorId = authorId,
                IsPublished = dto.IsPublished,
                PublishedAt = dto.IsPublished ? DateTime.UtcNow : null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.BlogPosts.Add(post);
            await _context.SaveChangesAsync();

            // Reload with author
            await _context.Entry(post).Reference(b => b.Author).LoadAsync();

            return MapToDetailDto(post);
        }

        public async Task<BlogPostDetailDto?> UpdatePostAsync(int postId, int authorId, UpdateBlogPostDto dto)
        {
            var post = await _context.BlogPosts
                .Include(b => b.Author)
                .FirstOrDefaultAsync(b => b.Id == postId && b.AuthorId == authorId);

            if (post == null) return null;

            // Update slug if title changed
            if (post.Title != dto.Title)
            {
                var newSlug = GenerateSlug(dto.Title);
                var baseSlug = newSlug;
                var counter = 1;
                while (await _context.BlogPosts.AnyAsync(b => b.Slug == newSlug && b.Id != postId))
                {
                    newSlug = $"{baseSlug}-{counter}";
                    counter++;
                }
                post.Slug = newSlug;
            }

            post.Title = dto.Title;
            post.Summary = dto.Summary;
            post.Content = dto.Content;
            post.FeaturedImageUrl = dto.FeaturedImageUrl;
            post.Category = dto.Category;
            post.Tags = dto.Tags;
            post.UpdatedAt = DateTime.UtcNow;

            // Handle publish status change
            if (dto.IsPublished && !post.IsPublished)
            {
                post.PublishedAt = DateTime.UtcNow;
            }
            post.IsPublished = dto.IsPublished;

            await _context.SaveChangesAsync();

            return MapToDetailDto(post);
        }

        public async Task<bool> DeletePostAsync(int postId, int authorId)
        {
            var post = await _context.BlogPosts
                .FirstOrDefaultAsync(b => b.Id == postId && b.AuthorId == authorId);

            if (post == null) return false;

            _context.BlogPosts.Remove(post);
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<bool> TogglePublishAsync(int postId, int authorId)
        {
            var post = await _context.BlogPosts
                .FirstOrDefaultAsync(b => b.Id == postId && b.AuthorId == authorId);

            if (post == null) return false;

            post.IsPublished = !post.IsPublished;
            if (post.IsPublished && post.PublishedAt == null)
            {
                post.PublishedAt = DateTime.UtcNow;
            }
            post.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return true;
        }

        public async Task IncrementViewCountAsync(int postId)
        {
            var post = await _context.BlogPosts.FindAsync(postId);
            if (post != null)
            {
                post.ViewCount++;
                await _context.SaveChangesAsync();
            }
        }

        public async Task<List<string>> GetCategoriesAsync()
        {
            return await _context.BlogPosts
                .Where(b => b.IsPublished && !string.IsNullOrEmpty(b.Category))
                .Select(b => b.Category!)
                .Distinct()
                .OrderBy(c => c)
                .ToListAsync();
        }

        private static string GenerateSlug(string title)
        {
            // Convert to lowercase
            var slug = title.ToLowerInvariant();

            // Remove special characters
            slug = Regex.Replace(slug, @"[^a-z0-9\s-]", "");

            // Replace spaces with hyphens
            slug = Regex.Replace(slug, @"\s+", "-");

            // Remove multiple consecutive hyphens
            slug = Regex.Replace(slug, @"-+", "-");

            // Trim hyphens from start and end
            slug = slug.Trim('-');

            return slug;
        }

        private static BlogPostListDto MapToListDto(BlogPost post)
        {
            return new BlogPostListDto
            {
                Id = post.Id,
                Title = post.Title,
                Slug = post.Slug,
                Summary = post.Summary,
                FeaturedImageUrl = post.FeaturedImageUrl,
                Category = post.Category,
                Tags = post.Tags,
                Author = new BlogAuthorDto
                {
                    Id = post.Author.Id,
                    FirstName = post.Author.FirstName,
                    LastName = post.Author.LastName,
                    AvatarUrl = post.Author.ProfileImageUrl,
                    Bio = post.Author.Bio
                },
                IsPublished = post.IsPublished,
                PublishedAt = post.PublishedAt,
                CreatedAt = post.CreatedAt,
                ViewCount = post.ViewCount
            };
        }

        private static BlogPostDetailDto MapToDetailDto(BlogPost post)
        {
            return new BlogPostDetailDto
            {
                Id = post.Id,
                Title = post.Title,
                Slug = post.Slug,
                Summary = post.Summary,
                Content = post.Content,
                FeaturedImageUrl = post.FeaturedImageUrl,
                Category = post.Category,
                Tags = post.Tags,
                Author = new BlogAuthorDto
                {
                    Id = post.Author.Id,
                    FirstName = post.Author.FirstName,
                    LastName = post.Author.LastName,
                    AvatarUrl = post.Author.ProfileImageUrl,
                    Bio = post.Author.Bio
                },
                IsPublished = post.IsPublished,
                PublishedAt = post.PublishedAt,
                CreatedAt = post.CreatedAt,
                UpdatedAt = post.UpdatedAt,
                ViewCount = post.ViewCount
            };
        }
    }
}
