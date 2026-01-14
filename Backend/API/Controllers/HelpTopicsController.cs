using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;
using System.Security.Claims;

namespace Pickleball.Community.Controllers;

[ApiController]
[Route("[controller]")]
public class HelpTopicsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<HelpTopicsController> _logger;

    public HelpTopicsController(ApplicationDbContext context, ILogger<HelpTopicsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get help topic by topic code (public endpoint for displaying help)
    /// </summary>
    [HttpGet("code/{topicCode}")]
    public async Task<ActionResult<ApiResponse<HelpTopicDto>>> GetByCode(string topicCode)
    {
        try
        {
            var topic = await _context.HelpTopics
                .Where(t => t.TopicCode == topicCode && t.IsActive)
                .Select(t => new HelpTopicDto
                {
                    Id = t.Id,
                    TopicCode = t.TopicCode,
                    Title = t.Title,
                    Content = t.Content,
                    Category = t.Category
                })
                .FirstOrDefaultAsync();

            if (topic == null)
            {
                return NotFound(new ApiResponse<HelpTopicDto>
                {
                    Success = false,
                    Message = "Help topic not found"
                });
            }

            return Ok(new ApiResponse<HelpTopicDto> { Success = true, Data = topic });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching help topic {TopicCode}", topicCode);
            return StatusCode(500, new ApiResponse<HelpTopicDto>
            {
                Success = false,
                Message = "An error occurred"
            });
        }
    }

    /// <summary>
    /// Get multiple help topics by codes (batch fetch for performance)
    /// </summary>
    [HttpPost("batch")]
    public async Task<ActionResult<ApiResponse<List<HelpTopicDto>>>> GetBatch([FromBody] List<string> topicCodes)
    {
        try
        {
            var topics = await _context.HelpTopics
                .Where(t => topicCodes.Contains(t.TopicCode) && t.IsActive)
                .Select(t => new HelpTopicDto
                {
                    Id = t.Id,
                    TopicCode = t.TopicCode,
                    Title = t.Title,
                    Content = t.Content,
                    Category = t.Category
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<HelpTopicDto>> { Success = true, Data = topics });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching help topics batch");
            return StatusCode(500, new ApiResponse<List<HelpTopicDto>>
            {
                Success = false,
                Message = "An error occurred"
            });
        }
    }

    /// <summary>
    /// Get all help topics by category
    /// </summary>
    [HttpGet("category/{category}")]
    public async Task<ActionResult<ApiResponse<List<HelpTopicDto>>>> GetByCategory(string category)
    {
        try
        {
            var topics = await _context.HelpTopics
                .Where(t => t.Category == category && t.IsActive)
                .OrderBy(t => t.SortOrder)
                .Select(t => new HelpTopicDto
                {
                    Id = t.Id,
                    TopicCode = t.TopicCode,
                    Title = t.Title,
                    Content = t.Content,
                    Category = t.Category
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<HelpTopicDto>> { Success = true, Data = topics });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching help topics for category {Category}", category);
            return StatusCode(500, new ApiResponse<List<HelpTopicDto>>
            {
                Success = false,
                Message = "An error occurred"
            });
        }
    }

    // ============ Admin Endpoints ============

    /// <summary>
    /// Get all help topics (admin)
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<List<HelpTopicListDto>>>> GetAll([FromQuery] string? category = null)
    {
        try
        {
            var query = _context.HelpTopics.AsQueryable();

            if (!string.IsNullOrEmpty(category))
            {
                query = query.Where(t => t.Category == category);
            }

            var topics = await query
                .OrderBy(t => t.Category)
                .ThenBy(t => t.SortOrder)
                .Select(t => new HelpTopicListDto
                {
                    Id = t.Id,
                    TopicCode = t.TopicCode,
                    Title = t.Title,
                    Category = t.Category,
                    IsActive = t.IsActive,
                    SortOrder = t.SortOrder,
                    UpdatedAt = t.UpdatedAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<HelpTopicListDto>> { Success = true, Data = topics });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching all help topics");
            return StatusCode(500, new ApiResponse<List<HelpTopicListDto>>
            {
                Success = false,
                Message = "An error occurred"
            });
        }
    }

    /// <summary>
    /// Get help topic by ID (admin)
    /// </summary>
    [HttpGet("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<HelpTopicDto>>> GetById(int id)
    {
        try
        {
            var topic = await _context.HelpTopics
                .Where(t => t.Id == id)
                .Select(t => new HelpTopicDto
                {
                    Id = t.Id,
                    TopicCode = t.TopicCode,
                    Title = t.Title,
                    Content = t.Content,
                    Category = t.Category
                })
                .FirstOrDefaultAsync();

            if (topic == null)
            {
                return NotFound(new ApiResponse<HelpTopicDto>
                {
                    Success = false,
                    Message = "Help topic not found"
                });
            }

            return Ok(new ApiResponse<HelpTopicDto> { Success = true, Data = topic });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching help topic {Id}", id);
            return StatusCode(500, new ApiResponse<HelpTopicDto>
            {
                Success = false,
                Message = "An error occurred"
            });
        }
    }

    /// <summary>
    /// Create help topic (admin)
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<HelpTopicDto>>> Create([FromBody] CreateHelpTopicDto dto)
    {
        try
        {
            // Check for duplicate topic code
            var exists = await _context.HelpTopics.AnyAsync(t => t.TopicCode == dto.TopicCode);
            if (exists)
            {
                return BadRequest(new ApiResponse<HelpTopicDto>
                {
                    Success = false,
                    Message = "A help topic with this code already exists"
                });
            }

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

            var topic = new HelpTopic
            {
                TopicCode = dto.TopicCode,
                Title = dto.Title,
                Content = dto.Content,
                Category = dto.Category,
                IsActive = dto.IsActive,
                SortOrder = dto.SortOrder,
                CreatedByUserId = userId,
                UpdatedByUserId = userId
            };

            _context.HelpTopics.Add(topic);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<HelpTopicDto>
            {
                Success = true,
                Data = new HelpTopicDto
                {
                    Id = topic.Id,
                    TopicCode = topic.TopicCode,
                    Title = topic.Title,
                    Content = topic.Content,
                    Category = topic.Category
                },
                Message = "Help topic created successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating help topic");
            return StatusCode(500, new ApiResponse<HelpTopicDto>
            {
                Success = false,
                Message = "An error occurred"
            });
        }
    }

    /// <summary>
    /// Update help topic (admin)
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<HelpTopicDto>>> Update(int id, [FromBody] UpdateHelpTopicDto dto)
    {
        try
        {
            var topic = await _context.HelpTopics.FindAsync(id);
            if (topic == null)
            {
                return NotFound(new ApiResponse<HelpTopicDto>
                {
                    Success = false,
                    Message = "Help topic not found"
                });
            }

            // Check for duplicate topic code if changing
            if (!string.IsNullOrEmpty(dto.TopicCode) && dto.TopicCode != topic.TopicCode)
            {
                var exists = await _context.HelpTopics.AnyAsync(t => t.TopicCode == dto.TopicCode);
                if (exists)
                {
                    return BadRequest(new ApiResponse<HelpTopicDto>
                    {
                        Success = false,
                        Message = "A help topic with this code already exists"
                    });
                }
                topic.TopicCode = dto.TopicCode;
            }

            if (dto.Title != null) topic.Title = dto.Title;
            if (dto.Content != null) topic.Content = dto.Content;
            if (dto.Category != null) topic.Category = dto.Category;
            if (dto.IsActive.HasValue) topic.IsActive = dto.IsActive.Value;
            if (dto.SortOrder.HasValue) topic.SortOrder = dto.SortOrder.Value;

            topic.UpdatedAt = DateTime.Now;
            topic.UpdatedByUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<HelpTopicDto>
            {
                Success = true,
                Data = new HelpTopicDto
                {
                    Id = topic.Id,
                    TopicCode = topic.TopicCode,
                    Title = topic.Title,
                    Content = topic.Content,
                    Category = topic.Category
                },
                Message = "Help topic updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating help topic {Id}", id);
            return StatusCode(500, new ApiResponse<HelpTopicDto>
            {
                Success = false,
                Message = "An error occurred"
            });
        }
    }

    /// <summary>
    /// Delete help topic (admin)
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
    {
        try
        {
            var topic = await _context.HelpTopics.FindAsync(id);
            if (topic == null)
            {
                return NotFound(new ApiResponse<bool>
                {
                    Success = false,
                    Message = "Help topic not found"
                });
            }

            _context.HelpTopics.Remove(topic);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool>
            {
                Success = true,
                Data = true,
                Message = "Help topic deleted successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting help topic {Id}", id);
            return StatusCode(500, new ApiResponse<bool>
            {
                Success = false,
                Message = "An error occurred"
            });
        }
    }

    /// <summary>
    /// Get all categories
    /// </summary>
    [HttpGet("categories")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<List<string>>>> GetCategories()
    {
        try
        {
            var categories = await _context.HelpTopics
                .Where(t => t.Category != null)
                .Select(t => t.Category!)
                .Distinct()
                .OrderBy(c => c)
                .ToListAsync();

            return Ok(new ApiResponse<List<string>> { Success = true, Data = categories });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching help topic categories");
            return StatusCode(500, new ApiResponse<List<string>>
            {
                Success = false,
                Message = "An error occurred"
            });
        }
    }
}
