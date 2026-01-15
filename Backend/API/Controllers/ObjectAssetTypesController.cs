using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Controllers;

[ApiController]
[Route("[controller]")]
public class ObjectAssetTypesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ObjectAssetTypesController> _logger;

    public ObjectAssetTypesController(ApplicationDbContext context, ILogger<ObjectAssetTypesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: /objectassettypes - Get all asset types
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ObjectAssetTypeDto>>>> GetAll(
        [FromQuery] int? objectTypeId = null,
        [FromQuery] string? objectTypeName = null,
        [FromQuery] bool includeInactive = false)
    {
        try
        {
            var query = _context.ObjectAssetTypes
                .Include(t => t.ObjectType)
                .AsQueryable();

            if (objectTypeId.HasValue)
                query = query.Where(t => t.ObjectTypeId == objectTypeId.Value);

            if (!string.IsNullOrEmpty(objectTypeName))
                query = query.Where(t => t.ObjectType != null && t.ObjectType.Name == objectTypeName);

            if (!includeInactive)
                query = query.Where(t => t.IsActive);

            var types = await query
                .OrderBy(t => t.ObjectTypeId)
                .ThenBy(t => t.SortOrder)
                .ThenBy(t => t.DisplayName)
                .Select(t => new ObjectAssetTypeDto
                {
                    Id = t.Id,
                    ObjectTypeId = t.ObjectTypeId,
                    ObjectTypeName = t.ObjectType != null ? t.ObjectType.Name : null,
                    TypeName = t.TypeName,
                    DisplayName = t.DisplayName,
                    Description = t.Description,
                    IconName = t.IconName,
                    ColorClass = t.ColorClass,
                    SortOrder = t.SortOrder,
                    IsActive = t.IsActive,
                    IsSystem = t.IsSystem
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<ObjectAssetTypeDto>> { Success = true, Data = types });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting object asset types");
            return StatusCode(500, new ApiResponse<List<ObjectAssetTypeDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /objectassettypes/{id} - Get single asset type
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<ObjectAssetTypeDto>>> GetById(int id)
    {
        try
        {
            var type = await _context.ObjectAssetTypes
                .Include(t => t.ObjectType)
                .Where(t => t.Id == id)
                .Select(t => new ObjectAssetTypeDto
                {
                    Id = t.Id,
                    ObjectTypeId = t.ObjectTypeId,
                    ObjectTypeName = t.ObjectType != null ? t.ObjectType.Name : null,
                    TypeName = t.TypeName,
                    DisplayName = t.DisplayName,
                    Description = t.Description,
                    IconName = t.IconName,
                    ColorClass = t.ColorClass,
                    SortOrder = t.SortOrder,
                    IsActive = t.IsActive,
                    IsSystem = t.IsSystem
                })
                .FirstOrDefaultAsync();

            if (type == null)
                return NotFound(new ApiResponse<ObjectAssetTypeDto> { Success = false, Message = "Asset type not found" });

            return Ok(new ApiResponse<ObjectAssetTypeDto> { Success = true, Data = type });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting asset type {Id}", id);
            return StatusCode(500, new ApiResponse<ObjectAssetTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /objectassettypes - Create new asset type (admin only)
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<ObjectAssetTypeDto>>> Create([FromBody] CreateObjectAssetTypeDto dto)
    {
        try
        {
            // Verify object type exists
            var objectType = await _context.ObjectTypes.FindAsync(dto.ObjectTypeId);
            if (objectType == null)
                return BadRequest(new ApiResponse<ObjectAssetTypeDto> { Success = false, Message = "Object type not found" });

            // Check for duplicate type name within the same object type
            if (await _context.ObjectAssetTypes.AnyAsync(t => t.ObjectTypeId == dto.ObjectTypeId && t.TypeName == dto.TypeName))
                return BadRequest(new ApiResponse<ObjectAssetTypeDto> { Success = false, Message = "An asset type with this name already exists for this object type" });

            var type = new ObjectAssetType
            {
                ObjectTypeId = dto.ObjectTypeId,
                TypeName = dto.TypeName,
                DisplayName = dto.DisplayName,
                Description = dto.Description,
                IconName = dto.IconName,
                ColorClass = dto.ColorClass,
                SortOrder = dto.SortOrder,
                IsActive = true,
                IsSystem = false,
                CreatedAt = DateTime.UtcNow
            };

            _context.ObjectAssetTypes.Add(type);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<ObjectAssetTypeDto>
            {
                Success = true,
                Data = new ObjectAssetTypeDto
                {
                    Id = type.Id,
                    ObjectTypeId = type.ObjectTypeId,
                    ObjectTypeName = objectType.Name,
                    TypeName = type.TypeName,
                    DisplayName = type.DisplayName,
                    Description = type.Description,
                    IconName = type.IconName,
                    ColorClass = type.ColorClass,
                    SortOrder = type.SortOrder,
                    IsActive = type.IsActive,
                    IsSystem = type.IsSystem
                },
                Message = "Asset type created successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating asset type");
            return StatusCode(500, new ApiResponse<ObjectAssetTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /objectassettypes/{id} - Update asset type (admin only)
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<ObjectAssetTypeDto>>> Update(int id, [FromBody] UpdateObjectAssetTypeDto dto)
    {
        try
        {
            var type = await _context.ObjectAssetTypes
                .Include(t => t.ObjectType)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (type == null)
                return NotFound(new ApiResponse<ObjectAssetTypeDto> { Success = false, Message = "Asset type not found" });

            // Check for duplicate type name
            if (dto.TypeName != null && dto.TypeName != type.TypeName &&
                await _context.ObjectAssetTypes.AnyAsync(t => t.ObjectTypeId == type.ObjectTypeId && t.TypeName == dto.TypeName && t.Id != id))
                return BadRequest(new ApiResponse<ObjectAssetTypeDto> { Success = false, Message = "An asset type with this name already exists for this object type" });

            if (dto.TypeName != null) type.TypeName = dto.TypeName;
            if (dto.DisplayName != null) type.DisplayName = dto.DisplayName;
            if (dto.Description != null) type.Description = dto.Description;
            if (dto.IconName != null) type.IconName = dto.IconName;
            if (dto.ColorClass != null) type.ColorClass = dto.ColorClass;
            if (dto.SortOrder.HasValue) type.SortOrder = dto.SortOrder.Value;
            if (dto.IsActive.HasValue) type.IsActive = dto.IsActive.Value;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<ObjectAssetTypeDto>
            {
                Success = true,
                Data = new ObjectAssetTypeDto
                {
                    Id = type.Id,
                    ObjectTypeId = type.ObjectTypeId,
                    ObjectTypeName = type.ObjectType?.Name,
                    TypeName = type.TypeName,
                    DisplayName = type.DisplayName,
                    Description = type.Description,
                    IconName = type.IconName,
                    ColorClass = type.ColorClass,
                    SortOrder = type.SortOrder,
                    IsActive = type.IsActive,
                    IsSystem = type.IsSystem
                },
                Message = "Asset type updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating asset type {Id}", id);
            return StatusCode(500, new ApiResponse<ObjectAssetTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /objectassettypes/{id} - Delete asset type (admin only, soft delete)
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
    {
        try
        {
            var type = await _context.ObjectAssetTypes.FindAsync(id);
            if (type == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Asset type not found" });

            if (type.IsSystem)
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot delete system asset types. Deactivate it instead." });

            // Check if there are any assets using this type
            var hasAssets = await _context.ObjectAssets.AnyAsync(a => a.ObjectAssetTypeId == id);
            if (hasAssets)
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot delete asset type that has assets. Deactivate it instead." });

            type.IsActive = false;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Asset type deactivated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting asset type {Id}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }
}
