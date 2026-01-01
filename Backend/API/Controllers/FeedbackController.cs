using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using API.Models.DTOs;
using System.Security.Claims;

namespace Pickleball.Community.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FeedbackController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<FeedbackController> _logger;

    public FeedbackController(ApplicationDbContext context, ILogger<FeedbackController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // ==================== PUBLIC ENDPOINTS ====================

    /// <summary>
    /// Get active feedback categories for the submission form
    /// </summary>
    [HttpGet("categories")]
    public async Task<IActionResult> GetActiveCategories()
    {
        try
        {
            var categories = await _context.FeedbackCategories
                .Where(c => c.IsActive)
                .OrderBy(c => c.SortOrder)
                .ThenBy(c => c.Name)
                .Select(c => new FeedbackCategoryDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    Description = c.Description,
                    Icon = c.Icon,
                    Color = c.Color,
                    SortOrder = c.SortOrder,
                    IsActive = c.IsActive
                })
                .ToListAsync();

            return Ok(new { success = true, data = categories });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting feedback categories");
            return StatusCode(500, new { success = false, message = "Failed to load feedback categories" });
        }
    }

    /// <summary>
    /// Submit feedback - works with or without authentication
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> SubmitFeedback([FromBody] CreateFeedbackEntryDto dto)
    {
        try
        {
            // Validate category exists
            var category = await _context.FeedbackCategories.FindAsync(dto.CategoryId);
            if (category == null || !category.IsActive)
            {
                return BadRequest(new { success = false, message = "Invalid feedback category" });
            }

            // Validate required fields
            if (string.IsNullOrWhiteSpace(dto.Subject))
            {
                return BadRequest(new { success = false, message = "Subject is required" });
            }
            if (string.IsNullOrWhiteSpace(dto.Message))
            {
                return BadRequest(new { success = false, message = "Message is required" });
            }

            // Check if user is authenticated
            int? userId = null;
            string? userEmail = dto.UserEmail;
            string? userName = dto.UserName;

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int parsedUserId))
            {
                userId = parsedUserId;
                // Get user info if authenticated
                var user = await _context.Users.FindAsync(userId);
                if (user != null)
                {
                    userEmail = user.Email;
                    userName = $"{user.FirstName} {user.LastName}".Trim();
                }
            }

            var entry = new FeedbackEntry
            {
                CategoryId = dto.CategoryId,
                Subject = dto.Subject.Trim(),
                Message = dto.Message.Trim(),
                UserEmail = userEmail?.Trim(),
                UserName = userName?.Trim(),
                UserId = userId,
                Status = "New",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.FeedbackEntries.Add(entry);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Feedback submitted: {Subject} from {Email}", entry.Subject, entry.UserEmail ?? "anonymous");

            return Ok(new { success = true, message = "Thank you for your feedback!" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting feedback");
            return StatusCode(500, new { success = false, message = "Failed to submit feedback" });
        }
    }

    // ==================== ADMIN ENDPOINTS ====================

    /// <summary>
    /// Get all categories including inactive (Admin only)
    /// </summary>
    [HttpGet("categories/all")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllCategories()
    {
        try
        {
            var categories = await _context.FeedbackCategories
                .OrderBy(c => c.SortOrder)
                .ThenBy(c => c.Name)
                .Select(c => new FeedbackCategoryDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    Description = c.Description,
                    Icon = c.Icon,
                    Color = c.Color,
                    SortOrder = c.SortOrder,
                    IsActive = c.IsActive,
                    EntryCount = c.Entries.Count
                })
                .ToListAsync();

            return Ok(new { success = true, data = categories });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all feedback categories");
            return StatusCode(500, new { success = false, message = "Failed to load feedback categories" });
        }
    }

    /// <summary>
    /// Create a new category (Admin only)
    /// </summary>
    [HttpPost("categories")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateCategory([FromBody] CreateFeedbackCategoryDto dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
            {
                return BadRequest(new { success = false, message = "Name is required" });
            }

            var category = new FeedbackCategory
            {
                Name = dto.Name.Trim(),
                Description = dto.Description?.Trim(),
                Icon = dto.Icon?.Trim(),
                Color = dto.Color?.Trim(),
                SortOrder = dto.SortOrder,
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.FeedbackCategories.Add(category);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, data = category.Id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating feedback category");
            return StatusCode(500, new { success = false, message = "Failed to create category" });
        }
    }

    /// <summary>
    /// Update a category (Admin only)
    /// </summary>
    [HttpPut("categories/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] UpdateFeedbackCategoryDto dto)
    {
        try
        {
            var category = await _context.FeedbackCategories.FindAsync(id);
            if (category == null)
            {
                return NotFound(new { success = false, message = "Category not found" });
            }

            category.Name = dto.Name.Trim();
            category.Description = dto.Description?.Trim();
            category.Icon = dto.Icon?.Trim();
            category.Color = dto.Color?.Trim();
            category.SortOrder = dto.SortOrder;
            category.IsActive = dto.IsActive;
            category.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating feedback category {Id}", id);
            return StatusCode(500, new { success = false, message = "Failed to update category" });
        }
    }

    /// <summary>
    /// Delete a category (Admin only)
    /// </summary>
    [HttpDelete("categories/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        try
        {
            var category = await _context.FeedbackCategories
                .Include(c => c.Entries)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (category == null)
            {
                return NotFound(new { success = false, message = "Category not found" });
            }

            if (category.Entries.Any())
            {
                // Soft delete - just deactivate
                category.IsActive = false;
                category.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                // Hard delete if no entries
                _context.FeedbackCategories.Remove(category);
            }

            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting feedback category {Id}", id);
            return StatusCode(500, new { success = false, message = "Failed to delete category" });
        }
    }

    /// <summary>
    /// Get all feedback entries with filtering (Admin only)
    /// </summary>
    [HttpGet("entries")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllEntries(
        [FromQuery] int? categoryId = null,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        try
        {
            var query = _context.FeedbackEntries
                .Include(e => e.Category)
                .AsQueryable();

            if (categoryId.HasValue)
            {
                query = query.Where(e => e.CategoryId == categoryId.Value);
            }

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(e => e.Status == status);
            }

            var totalCount = await query.CountAsync();

            var entries = await query
                .OrderByDescending(e => e.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(e => new FeedbackEntryDto
                {
                    Id = e.Id,
                    CategoryId = e.CategoryId,
                    CategoryName = e.Category != null ? e.Category.Name : "Unknown",
                    Subject = e.Subject,
                    Message = e.Message,
                    UserEmail = e.UserEmail,
                    UserName = e.UserName,
                    UserId = e.UserId,
                    Status = e.Status,
                    AdminNotes = e.AdminNotes,
                    CreatedAt = e.CreatedAt,
                    UpdatedAt = e.UpdatedAt
                })
                .ToListAsync();

            return Ok(new
            {
                success = true,
                data = entries,
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting feedback entries");
            return StatusCode(500, new { success = false, message = "Failed to load feedback entries" });
        }
    }

    /// <summary>
    /// Get feedback statistics (Admin only)
    /// </summary>
    [HttpGet("stats")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetStats()
    {
        try
        {
            var stats = new
            {
                total = await _context.FeedbackEntries.CountAsync(),
                newCount = await _context.FeedbackEntries.CountAsync(e => e.Status == "New"),
                inProgressCount = await _context.FeedbackEntries.CountAsync(e => e.Status == "InProgress"),
                resolvedCount = await _context.FeedbackEntries.CountAsync(e => e.Status == "Resolved"),
                closedCount = await _context.FeedbackEntries.CountAsync(e => e.Status == "Closed"),
                byCategory = await _context.FeedbackCategories
                    .Select(c => new { c.Name, Count = c.Entries.Count })
                    .ToListAsync()
            };

            return Ok(new { success = true, data = stats });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting feedback stats");
            return StatusCode(500, new { success = false, message = "Failed to load statistics" });
        }
    }

    /// <summary>
    /// Update feedback entry status/notes (Admin only)
    /// </summary>
    [HttpPut("entries/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateEntry(int id, [FromBody] UpdateFeedbackEntryDto dto)
    {
        try
        {
            var entry = await _context.FeedbackEntries.FindAsync(id);
            if (entry == null)
            {
                return NotFound(new { success = false, message = "Feedback entry not found" });
            }

            if (!string.IsNullOrEmpty(dto.Status))
            {
                entry.Status = dto.Status;
            }

            entry.AdminNotes = dto.AdminNotes;
            entry.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating feedback entry {Id}", id);
            return StatusCode(500, new { success = false, message = "Failed to update feedback" });
        }
    }

    /// <summary>
    /// Delete a feedback entry (Admin only)
    /// </summary>
    [HttpDelete("entries/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteEntry(int id)
    {
        try
        {
            var entry = await _context.FeedbackEntries.FindAsync(id);
            if (entry == null)
            {
                return NotFound(new { success = false, message = "Feedback entry not found" });
            }

            _context.FeedbackEntries.Remove(entry);
            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting feedback entry {Id}", id);
            return StatusCode(500, new { success = false, message = "Failed to delete feedback" });
        }
    }
}
