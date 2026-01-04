using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class ContentTypesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ContentTypesController> _logger;

    public ContentTypesController(ApplicationDbContext context, ILogger<ContentTypesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get all active content types for material creation
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetContentTypes()
    {
        try
        {
            var contentTypes = await _context.ContentTypes
                .Where(c => c.IsActive)
                .OrderBy(c => c.SortOrder)
                .Select(c => new ContentTypeDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    Code = c.Code,
                    Icon = c.Icon,
                    Prompt = c.Prompt,
                    AllowedExtensions = c.AllowedExtensions.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList(),
                    MaxFileSizeMB = c.MaxFileSizeMB
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<ContentTypeDto>>
            {
                Success = true,
                Data = contentTypes
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching content types");
            return StatusCode(500, new ApiResponse<List<ContentTypeDto>>
            {
                Success = false,
                Message = "An error occurred while fetching content types"
            });
        }
    }

    /// <summary>
    /// Get a specific content type by code
    /// </summary>
    [HttpGet("{code}")]
    public async Task<IActionResult> GetContentTypeByCode(string code)
    {
        try
        {
            var contentType = await _context.ContentTypes
                .Where(c => c.Code == code && c.IsActive)
                .Select(c => new ContentTypeDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    Code = c.Code,
                    Icon = c.Icon,
                    Prompt = c.Prompt,
                    AllowedExtensions = c.AllowedExtensions.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList(),
                    MaxFileSizeMB = c.MaxFileSizeMB
                })
                .FirstOrDefaultAsync();

            if (contentType == null)
            {
                return NotFound(new ApiResponse<ContentTypeDto>
                {
                    Success = false,
                    Message = "Content type not found"
                });
            }

            return Ok(new ApiResponse<ContentTypeDto>
            {
                Success = true,
                Data = contentType
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching content type {Code}", code);
            return StatusCode(500, new ApiResponse<ContentTypeDto>
            {
                Success = false,
                Message = "An error occurred while fetching content type"
            });
        }
    }
}

public class ContentTypeDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public string Prompt { get; set; } = string.Empty;
    public List<string> AllowedExtensions { get; set; } = new();
    public int MaxFileSizeMB { get; set; }
}
