using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using System.Security.Claims;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class FaqController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<FaqController> _logger;

    public FaqController(ApplicationDbContext context, ILogger<FaqController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private async Task<bool> IsUserAdmin()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return false;
        var user = await _context.Users.FindAsync(userId.Value);
        return user?.Role == "Admin";
    }

    #region Public Endpoints

    // GET: /faq - Get all active categories with their entries (public)
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<FaqCategoryDto>>>> GetFaq()
    {
        try
        {
            var categories = await _context.FaqCategories
                .Where(c => c.IsActive)
                .OrderBy(c => c.SortOrder)
                .Include(c => c.Entries.Where(e => e.IsActive).OrderBy(e => e.SortOrder))
                .Select(c => new FaqCategoryDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    Description = c.Description,
                    Icon = c.Icon,
                    Color = c.Color,
                    SortOrder = c.SortOrder,
                    IsActive = c.IsActive,
                    Entries = c.Entries.Select(e => new FaqEntryDto
                    {
                        Id = e.Id,
                        CategoryId = e.CategoryId,
                        Question = e.Question,
                        Answer = e.Answer,
                        SortOrder = e.SortOrder,
                        IsActive = e.IsActive
                    }).ToList()
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<FaqCategoryDto>> { Success = true, Data = categories });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching FAQ");
            return StatusCode(500, new ApiResponse<List<FaqCategoryDto>> { Success = false, Message = "An error occurred" });
        }
    }

    #endregion

    #region Category Admin Endpoints

    // GET: /faq/categories/all - Get all categories including inactive (admin only)
    [HttpGet("categories/all")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<FaqCategoryDto>>>> GetAllCategories()
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var categories = await _context.FaqCategories
                .OrderBy(c => c.SortOrder)
                .Include(c => c.Entries.OrderBy(e => e.SortOrder))
                .Select(c => new FaqCategoryDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    Description = c.Description,
                    Icon = c.Icon,
                    Color = c.Color,
                    SortOrder = c.SortOrder,
                    IsActive = c.IsActive,
                    Entries = c.Entries.Select(e => new FaqEntryDto
                    {
                        Id = e.Id,
                        CategoryId = e.CategoryId,
                        Question = e.Question,
                        Answer = e.Answer,
                        SortOrder = e.SortOrder,
                        IsActive = e.IsActive
                    }).ToList()
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<FaqCategoryDto>> { Success = true, Data = categories });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching all FAQ categories");
            return StatusCode(500, new ApiResponse<List<FaqCategoryDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /faq/categories - Create a new category (admin only)
    [HttpPost("categories")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<FaqCategoryDto>>> CreateCategory([FromBody] CreateFaqCategoryDto dto)
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var category = new FaqCategory
            {
                Name = dto.Name,
                Description = dto.Description,
                Icon = dto.Icon,
                Color = dto.Color,
                SortOrder = dto.SortOrder
            };

            _context.FaqCategories.Add(category);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<FaqCategoryDto>
            {
                Success = true,
                Data = new FaqCategoryDto
                {
                    Id = category.Id,
                    Name = category.Name,
                    Description = category.Description,
                    Icon = category.Icon,
                    Color = category.Color,
                    SortOrder = category.SortOrder,
                    IsActive = category.IsActive,
                    Entries = new List<FaqEntryDto>()
                },
                Message = "Category created successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating FAQ category");
            return StatusCode(500, new ApiResponse<FaqCategoryDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /faq/categories/{id} - Update a category (admin only)
    [HttpPut("categories/{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<FaqCategoryDto>>> UpdateCategory(int id, [FromBody] UpdateFaqCategoryDto dto)
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var category = await _context.FaqCategories.FindAsync(id);
            if (category == null)
                return NotFound(new ApiResponse<FaqCategoryDto> { Success = false, Message = "Category not found" });

            category.Name = dto.Name;
            category.Description = dto.Description;
            category.Icon = dto.Icon;
            category.Color = dto.Color;
            category.SortOrder = dto.SortOrder;
            category.IsActive = dto.IsActive;
            category.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<FaqCategoryDto>
            {
                Success = true,
                Data = new FaqCategoryDto
                {
                    Id = category.Id,
                    Name = category.Name,
                    Description = category.Description,
                    Icon = category.Icon,
                    Color = category.Color,
                    SortOrder = category.SortOrder,
                    IsActive = category.IsActive,
                    Entries = new List<FaqEntryDto>()
                },
                Message = "Category updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating FAQ category {Id}", id);
            return StatusCode(500, new ApiResponse<FaqCategoryDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /faq/categories/{id} - Delete a category (admin only, soft delete)
    [HttpDelete("categories/{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteCategory(int id)
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var category = await _context.FaqCategories.FindAsync(id);
            if (category == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Category not found" });

            category.IsActive = false;
            category.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Category deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting FAQ category {Id}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    #endregion

    #region Entry Admin Endpoints

    // GET: /faq/entries/all - Get all entries including inactive (admin only)
    [HttpGet("entries/all")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<FaqEntryDto>>>> GetAllEntries()
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var entries = await _context.FaqEntries
                .Include(e => e.Category)
                .OrderBy(e => e.CategoryId)
                .ThenBy(e => e.SortOrder)
                .Select(e => new FaqEntryDto
                {
                    Id = e.Id,
                    CategoryId = e.CategoryId,
                    CategoryName = e.Category!.Name,
                    Question = e.Question,
                    Answer = e.Answer,
                    SortOrder = e.SortOrder,
                    IsActive = e.IsActive
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<FaqEntryDto>> { Success = true, Data = entries });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching all FAQ entries");
            return StatusCode(500, new ApiResponse<List<FaqEntryDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /faq/entries - Create a new entry (admin only)
    [HttpPost("entries")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<FaqEntryDto>>> CreateEntry([FromBody] CreateFaqEntryDto dto)
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var category = await _context.FaqCategories.FindAsync(dto.CategoryId);
            if (category == null)
                return BadRequest(new ApiResponse<FaqEntryDto> { Success = false, Message = "Category not found" });

            var entry = new FaqEntry
            {
                CategoryId = dto.CategoryId,
                Question = dto.Question,
                Answer = dto.Answer,
                SortOrder = dto.SortOrder
            };

            _context.FaqEntries.Add(entry);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<FaqEntryDto>
            {
                Success = true,
                Data = new FaqEntryDto
                {
                    Id = entry.Id,
                    CategoryId = entry.CategoryId,
                    CategoryName = category.Name,
                    Question = entry.Question,
                    Answer = entry.Answer,
                    SortOrder = entry.SortOrder,
                    IsActive = entry.IsActive
                },
                Message = "Entry created successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating FAQ entry");
            return StatusCode(500, new ApiResponse<FaqEntryDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /faq/entries/{id} - Update an entry (admin only)
    [HttpPut("entries/{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<FaqEntryDto>>> UpdateEntry(int id, [FromBody] UpdateFaqEntryDto dto)
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var entry = await _context.FaqEntries
                .Include(e => e.Category)
                .FirstOrDefaultAsync(e => e.Id == id);

            if (entry == null)
                return NotFound(new ApiResponse<FaqEntryDto> { Success = false, Message = "Entry not found" });

            entry.CategoryId = dto.CategoryId;
            entry.Question = dto.Question;
            entry.Answer = dto.Answer;
            entry.SortOrder = dto.SortOrder;
            entry.IsActive = dto.IsActive;
            entry.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            // Reload category name if changed
            var category = await _context.FaqCategories.FindAsync(dto.CategoryId);

            return Ok(new ApiResponse<FaqEntryDto>
            {
                Success = true,
                Data = new FaqEntryDto
                {
                    Id = entry.Id,
                    CategoryId = entry.CategoryId,
                    CategoryName = category?.Name,
                    Question = entry.Question,
                    Answer = entry.Answer,
                    SortOrder = entry.SortOrder,
                    IsActive = entry.IsActive
                },
                Message = "Entry updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating FAQ entry {Id}", id);
            return StatusCode(500, new ApiResponse<FaqEntryDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /faq/entries/{id} - Delete an entry (admin only, soft delete)
    [HttpDelete("entries/{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteEntry(int id)
    {
        try
        {
            if (!await IsUserAdmin())
                return Forbid();

            var entry = await _context.FaqEntries.FindAsync(id);
            if (entry == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Entry not found" });

            entry.IsActive = false;
            entry.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Entry deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting FAQ entry {Id}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    #endregion
}
