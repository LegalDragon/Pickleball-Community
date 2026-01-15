using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Controllers;

[ApiController]
[Route("[controller]")]
public class ObjectTypesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ObjectTypesController> _logger;

    public ObjectTypesController(ApplicationDbContext context, ILogger<ObjectTypesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst("UserId")?.Value ?? User.FindFirst("sub")?.Value;
        return int.TryParse(userIdClaim, out var id) ? id : null;
    }

    private async Task<bool> IsAdminAsync()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return false;
        var user = await _context.Users.FindAsync(userId.Value);
        return user?.Role == "Admin";
    }

    // GET: /objecttypes - Get all object types
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ObjectTypeDto>>>> GetAll([FromQuery] bool includeInactive = false)
    {
        try
        {
            var query = _context.ObjectTypes.AsQueryable();

            if (!includeInactive)
                query = query.Where(t => t.IsActive);

            var types = await query
                .OrderBy(t => t.SortOrder)
                .ThenBy(t => t.DisplayName)
                .Select(t => new ObjectTypeDto
                {
                    Id = t.Id,
                    Name = t.Name,
                    DisplayName = t.DisplayName,
                    TableName = t.TableName,
                    SortOrder = t.SortOrder,
                    IsActive = t.IsActive,
                    AssetTypeCount = t.AssetTypes.Count(at => at.IsActive)
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<ObjectTypeDto>> { Success = true, Data = types });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting object types");
            return StatusCode(500, new ApiResponse<List<ObjectTypeDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /objecttypes/{id} - Get single object type with its asset types
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<ObjectTypeDto>>> GetById(int id)
    {
        try
        {
            var type = await _context.ObjectTypes
                .Where(t => t.Id == id)
                .Select(t => new ObjectTypeDto
                {
                    Id = t.Id,
                    Name = t.Name,
                    DisplayName = t.DisplayName,
                    TableName = t.TableName,
                    SortOrder = t.SortOrder,
                    IsActive = t.IsActive,
                    AssetTypeCount = t.AssetTypes.Count(at => at.IsActive)
                })
                .FirstOrDefaultAsync();

            if (type == null)
                return NotFound(new ApiResponse<ObjectTypeDto> { Success = false, Message = "Object type not found" });

            return Ok(new ApiResponse<ObjectTypeDto> { Success = true, Data = type });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting object type {Id}", id);
            return StatusCode(500, new ApiResponse<ObjectTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /objecttypes - Create new object type (admin only)
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ObjectTypeDto>>> Create([FromBody] CreateObjectTypeDto dto)
    {
        try
        {
            if (!await IsAdminAsync())
                return Forbid();

            // Check for duplicate name
            if (await _context.ObjectTypes.AnyAsync(t => t.Name == dto.Name))
                return BadRequest(new ApiResponse<ObjectTypeDto> { Success = false, Message = "An object type with this name already exists" });

            var type = new ObjectType
            {
                Name = dto.Name,
                DisplayName = dto.DisplayName,
                TableName = dto.TableName,
                SortOrder = dto.SortOrder,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.ObjectTypes.Add(type);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<ObjectTypeDto>
            {
                Success = true,
                Data = new ObjectTypeDto
                {
                    Id = type.Id,
                    Name = type.Name,
                    DisplayName = type.DisplayName,
                    TableName = type.TableName,
                    SortOrder = type.SortOrder,
                    IsActive = type.IsActive,
                    AssetTypeCount = 0
                },
                Message = "Object type created successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating object type");
            return StatusCode(500, new ApiResponse<ObjectTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /objecttypes/{id} - Update object type (admin only)
    [HttpPut("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ObjectTypeDto>>> Update(int id, [FromBody] UpdateObjectTypeDto dto)
    {
        try
        {
            if (!await IsAdminAsync())
                return Forbid();

            var type = await _context.ObjectTypes.FindAsync(id);
            if (type == null)
                return NotFound(new ApiResponse<ObjectTypeDto> { Success = false, Message = "Object type not found" });

            // Check for duplicate name
            if (dto.Name != null && dto.Name != type.Name &&
                await _context.ObjectTypes.AnyAsync(t => t.Name == dto.Name && t.Id != id))
                return BadRequest(new ApiResponse<ObjectTypeDto> { Success = false, Message = "An object type with this name already exists" });

            if (dto.Name != null) type.Name = dto.Name;
            if (dto.DisplayName != null) type.DisplayName = dto.DisplayName;
            if (dto.TableName != null) type.TableName = dto.TableName;
            if (dto.SortOrder.HasValue) type.SortOrder = dto.SortOrder.Value;
            if (dto.IsActive.HasValue) type.IsActive = dto.IsActive.Value;

            await _context.SaveChangesAsync();

            var assetTypeCount = await _context.ObjectAssetTypes.CountAsync(at => at.ObjectTypeId == id && at.IsActive);

            return Ok(new ApiResponse<ObjectTypeDto>
            {
                Success = true,
                Data = new ObjectTypeDto
                {
                    Id = type.Id,
                    Name = type.Name,
                    DisplayName = type.DisplayName,
                    TableName = type.TableName,
                    SortOrder = type.SortOrder,
                    IsActive = type.IsActive,
                    AssetTypeCount = assetTypeCount
                },
                Message = "Object type updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating object type {Id}", id);
            return StatusCode(500, new ApiResponse<ObjectTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /objecttypes/{id} - Delete object type (admin only, soft delete)
    [HttpDelete("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
    {
        try
        {
            if (!await IsAdminAsync())
                return Forbid();

            var type = await _context.ObjectTypes.FindAsync(id);
            if (type == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Object type not found" });

            // Check if there are any assets using this type
            var hasAssets = await _context.ObjectAssets.AnyAsync(a => a.ObjectTypeId == id);
            if (hasAssets)
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot delete object type that has assets. Deactivate it instead." });

            type.IsActive = false;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Object type deactivated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting object type {Id}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }
}
