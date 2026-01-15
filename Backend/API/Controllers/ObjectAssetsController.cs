using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Controllers;

[ApiController]
[Route("[controller]")]
public class ObjectAssetsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ObjectAssetsController> _logger;

    public ObjectAssetsController(ApplicationDbContext context, ILogger<ObjectAssetsController> logger)
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

    /// <summary>
    /// Check if user can manage assets for the given object
    /// </summary>
    private async Task<bool> CanManageObjectAsync(string objectTypeName, int objectId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return false;

        if (await IsAdminAsync()) return true;

        // Check based on object type
        return objectTypeName switch
        {
            "Event" => await _context.Events.AnyAsync(e => e.Id == objectId && e.OrganizedByUserId == userId.Value),
            "Club" => await _context.ClubMembers.AnyAsync(m => m.ClubId == objectId && m.UserId == userId.Value && m.Role == "Admin"),
            "Venue" => await _context.Venues.AnyAsync(v => v.Id == objectId && v.CreatedByUserId == userId.Value),
            "League" => await _context.Set<League>().AnyAsync(l => l.Id == objectId && l.CreatedByUserId == userId.Value),
            "User" => objectId == userId.Value,
            _ => false
        };
    }

    /// <summary>
    /// Check if user can view private assets for the given object
    /// </summary>
    private async Task<bool> CanViewPrivateAssetsAsync(string objectTypeName, int objectId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return false;

        if (await IsAdminAsync()) return true;
        if (await CanManageObjectAsync(objectTypeName, objectId)) return true;

        // Additional checks based on object type
        return objectTypeName switch
        {
            "Event" => await _context.EventUnitMembers.AnyAsync(m =>
                m.Unit!.EventId == objectId && m.UserId == userId.Value && m.Unit.Status != "Cancelled"),
            "Club" => await _context.ClubMembers.AnyAsync(m => m.ClubId == objectId && m.UserId == userId.Value && m.Status == "Active"),
            _ => false
        };
    }

    // GET: /objectassets/{objectTypeName}/{objectId} - Get assets for an object
    [HttpGet("{objectTypeName}/{objectId}")]
    public async Task<ActionResult<ApiResponse<List<ObjectAssetDto>>>> GetAssets(string objectTypeName, int objectId)
    {
        try
        {
            var userId = GetCurrentUserId();
            var isAdmin = userId.HasValue && await IsAdminAsync();

            // Get object type
            var objectType = await _context.ObjectTypes.FirstOrDefaultAsync(t => t.Name == objectTypeName && t.IsActive);
            if (objectType == null)
                return NotFound(new ApiResponse<List<ObjectAssetDto>> { Success = false, Message = "Object type not found" });

            var canViewPrivate = await CanViewPrivateAssetsAsync(objectTypeName, objectId);

            var query = _context.ObjectAssets
                .Include(a => a.AssetType)
                .Include(a => a.UploadedBy)
                .Where(a => a.ObjectTypeId == objectType.Id && a.ObjectId == objectId);

            if (!canViewPrivate)
                query = query.Where(a => a.IsPublic);

            var assets = await query
                .OrderBy(a => a.AssetType!.SortOrder)
                .ThenBy(a => a.SortOrder)
                .ThenBy(a => a.CreatedAt)
                .Select(a => new ObjectAssetDto
                {
                    Id = a.Id,
                    ObjectTypeId = a.ObjectTypeId,
                    ObjectTypeName = objectTypeName,
                    ObjectAssetTypeId = a.ObjectAssetTypeId,
                    AssetTypeName = a.AssetType != null ? a.AssetType.TypeName : null,
                    AssetTypeDisplayName = a.AssetType != null ? a.AssetType.DisplayName : null,
                    AssetTypeIconName = a.AssetType != null ? a.AssetType.IconName : null,
                    AssetTypeColorClass = a.AssetType != null ? a.AssetType.ColorClass : null,
                    ObjectId = a.ObjectId,
                    Title = a.Title,
                    FileUrl = a.FileUrl,
                    FileName = a.FileName,
                    FileType = a.FileType,
                    FileSize = a.FileSize,
                    IsPublic = a.IsPublic,
                    SortOrder = a.SortOrder,
                    UploadedByUserId = a.UploadedByUserId,
                    UploadedByUserName = a.UploadedBy != null ? (a.UploadedBy.FirstName + " " + a.UploadedBy.LastName).Trim() : null,
                    CreatedAt = a.CreatedAt,
                    UpdatedAt = a.UpdatedAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<ObjectAssetDto>> { Success = true, Data = assets });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting assets for {ObjectTypeName} {ObjectId}", objectTypeName, objectId);
            return StatusCode(500, new ApiResponse<List<ObjectAssetDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /objectassets/{objectTypeName}/{objectId} - Add asset to an object
    [HttpPost("{objectTypeName}/{objectId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ObjectAssetDto>>> AddAsset(string objectTypeName, int objectId, [FromBody] CreateObjectAssetDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ObjectAssetDto> { Success = false, Message = "User not authenticated" });

            // Get object type
            var objectType = await _context.ObjectTypes.FirstOrDefaultAsync(t => t.Name == objectTypeName && t.IsActive);
            if (objectType == null)
                return NotFound(new ApiResponse<ObjectAssetDto> { Success = false, Message = "Object type not found" });

            // Check permission
            if (!await CanManageObjectAsync(objectTypeName, objectId))
                return Forbid();

            // Verify asset type exists and belongs to this object type
            var assetType = await _context.ObjectAssetTypes.FirstOrDefaultAsync(t => t.Id == dto.ObjectAssetTypeId && t.ObjectTypeId == objectType.Id && t.IsActive);
            if (assetType == null)
                return BadRequest(new ApiResponse<ObjectAssetDto> { Success = false, Message = "Invalid asset type for this object type" });

            var asset = new ObjectAsset
            {
                ObjectTypeId = objectType.Id,
                ObjectAssetTypeId = dto.ObjectAssetTypeId,
                ObjectId = objectId,
                Title = dto.Title,
                FileUrl = dto.FileUrl,
                FileName = dto.FileName,
                FileType = dto.FileType,
                FileSize = dto.FileSize,
                IsPublic = dto.IsPublic,
                SortOrder = dto.SortOrder,
                UploadedByUserId = userId.Value,
                CreatedAt = DateTime.UtcNow
            };

            _context.ObjectAssets.Add(asset);
            await _context.SaveChangesAsync();

            var user = await _context.Users.FindAsync(userId.Value);

            return Ok(new ApiResponse<ObjectAssetDto>
            {
                Success = true,
                Data = new ObjectAssetDto
                {
                    Id = asset.Id,
                    ObjectTypeId = asset.ObjectTypeId,
                    ObjectTypeName = objectTypeName,
                    ObjectAssetTypeId = asset.ObjectAssetTypeId,
                    AssetTypeName = assetType.TypeName,
                    AssetTypeDisplayName = assetType.DisplayName,
                    AssetTypeIconName = assetType.IconName,
                    AssetTypeColorClass = assetType.ColorClass,
                    ObjectId = asset.ObjectId,
                    Title = asset.Title,
                    FileUrl = asset.FileUrl,
                    FileName = asset.FileName,
                    FileType = asset.FileType,
                    FileSize = asset.FileSize,
                    IsPublic = asset.IsPublic,
                    SortOrder = asset.SortOrder,
                    UploadedByUserId = asset.UploadedByUserId,
                    UploadedByUserName = user != null ? (user.FirstName + " " + user.LastName).Trim() : null,
                    CreatedAt = asset.CreatedAt,
                    UpdatedAt = asset.UpdatedAt
                },
                Message = "Asset added successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding asset to {ObjectTypeName} {ObjectId}", objectTypeName, objectId);
            return StatusCode(500, new ApiResponse<ObjectAssetDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /objectassets/{objectTypeName}/{objectId}/{assetId} - Update asset
    [HttpPut("{objectTypeName}/{objectId}/{assetId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ObjectAssetDto>>> UpdateAsset(string objectTypeName, int objectId, int assetId, [FromBody] UpdateObjectAssetDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ObjectAssetDto> { Success = false, Message = "User not authenticated" });

            // Get object type
            var objectType = await _context.ObjectTypes.FirstOrDefaultAsync(t => t.Name == objectTypeName && t.IsActive);
            if (objectType == null)
                return NotFound(new ApiResponse<ObjectAssetDto> { Success = false, Message = "Object type not found" });

            // Check permission
            if (!await CanManageObjectAsync(objectTypeName, objectId))
                return Forbid();

            var asset = await _context.ObjectAssets
                .Include(a => a.AssetType)
                .Include(a => a.UploadedBy)
                .FirstOrDefaultAsync(a => a.Id == assetId && a.ObjectTypeId == objectType.Id && a.ObjectId == objectId);

            if (asset == null)
                return NotFound(new ApiResponse<ObjectAssetDto> { Success = false, Message = "Asset not found" });

            // Update asset type if provided
            if (dto.ObjectAssetTypeId.HasValue)
            {
                var newAssetType = await _context.ObjectAssetTypes.FirstOrDefaultAsync(t => t.Id == dto.ObjectAssetTypeId.Value && t.ObjectTypeId == objectType.Id && t.IsActive);
                if (newAssetType == null)
                    return BadRequest(new ApiResponse<ObjectAssetDto> { Success = false, Message = "Invalid asset type for this object type" });
                asset.ObjectAssetTypeId = dto.ObjectAssetTypeId.Value;
                asset.AssetType = newAssetType;
            }

            if (dto.Title != null) asset.Title = dto.Title;
            if (dto.IsPublic.HasValue) asset.IsPublic = dto.IsPublic.Value;
            if (dto.SortOrder.HasValue) asset.SortOrder = dto.SortOrder.Value;
            asset.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<ObjectAssetDto>
            {
                Success = true,
                Data = new ObjectAssetDto
                {
                    Id = asset.Id,
                    ObjectTypeId = asset.ObjectTypeId,
                    ObjectTypeName = objectTypeName,
                    ObjectAssetTypeId = asset.ObjectAssetTypeId,
                    AssetTypeName = asset.AssetType?.TypeName,
                    AssetTypeDisplayName = asset.AssetType?.DisplayName,
                    AssetTypeIconName = asset.AssetType?.IconName,
                    AssetTypeColorClass = asset.AssetType?.ColorClass,
                    ObjectId = asset.ObjectId,
                    Title = asset.Title,
                    FileUrl = asset.FileUrl,
                    FileName = asset.FileName,
                    FileType = asset.FileType,
                    FileSize = asset.FileSize,
                    IsPublic = asset.IsPublic,
                    SortOrder = asset.SortOrder,
                    UploadedByUserId = asset.UploadedByUserId,
                    UploadedByUserName = asset.UploadedBy != null ? (asset.UploadedBy.FirstName + " " + asset.UploadedBy.LastName).Trim() : null,
                    CreatedAt = asset.CreatedAt,
                    UpdatedAt = asset.UpdatedAt
                },
                Message = "Asset updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating asset {AssetId}", assetId);
            return StatusCode(500, new ApiResponse<ObjectAssetDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /objectassets/{objectTypeName}/{objectId}/{assetId} - Delete asset
    [HttpDelete("{objectTypeName}/{objectId}/{assetId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteAsset(string objectTypeName, int objectId, int assetId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            // Get object type
            var objectType = await _context.ObjectTypes.FirstOrDefaultAsync(t => t.Name == objectTypeName && t.IsActive);
            if (objectType == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Object type not found" });

            // Check permission
            if (!await CanManageObjectAsync(objectTypeName, objectId))
                return Forbid();

            var asset = await _context.ObjectAssets
                .FirstOrDefaultAsync(a => a.Id == assetId && a.ObjectTypeId == objectType.Id && a.ObjectId == objectId);

            if (asset == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Asset not found" });

            _context.ObjectAssets.Remove(asset);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Asset deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting asset {AssetId}", assetId);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }
}
