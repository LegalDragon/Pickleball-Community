using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;
using System.Security.Claims;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("courts")]
public class CourtAssetsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<CourtAssetsController> _logger;

    public CourtAssetsController(ApplicationDbContext context, ILogger<CourtAssetsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var id) ? id : null;
    }

    // GET: /courts/{courtId}/assets - Get assets for a court (top 20 most liked, most recent)
    [HttpGet("{courtId}/assets")]
    public async Task<ActionResult<ApiResponse<List<CourtAssetDto>>>> GetCourtAssets(int courtId)
    {
        try
        {
            var userId = GetUserId();

            // Get top 20 assets ordered by net likes (likes - dislikes), then by most recent
            var assets = await _context.CourtAssets
                .Where(a => a.CourtId == courtId && a.IsApproved)
                .Select(a => new
                {
                    Asset = a,
                    User = a.User,
                    LikeCount = a.Likes.Count(l => l.IsLike),
                    DislikeCount = a.Likes.Count(l => !l.IsLike),
                    UserVote = userId.HasValue
                        ? a.Likes.FirstOrDefault(l => l.UserId == userId.Value)
                        : null
                })
                .OrderByDescending(a => a.LikeCount - a.DislikeCount)
                .ThenByDescending(a => a.Asset.CreatedAt)
                .Take(20)
                .ToListAsync();

            var dtos = assets.Select(a => new CourtAssetDto
            {
                Id = a.Asset.Id,
                CourtId = a.Asset.CourtId,
                UserId = a.Asset.UserId,
                UserName = a.User != null ? $"{a.User.FirstName} {a.User.LastName}".Trim() : null,
                UserProfileImageUrl = a.User?.ProfileImageUrl,
                AssetType = a.Asset.AssetType,
                AssetUrl = a.Asset.AssetUrl,
                ThumbnailUrl = a.Asset.ThumbnailUrl,
                Description = a.Asset.Description,
                Width = a.Asset.Width,
                Height = a.Asset.Height,
                LikeCount = a.LikeCount,
                DislikeCount = a.DislikeCount,
                UserLiked = a.UserVote != null ? a.UserVote.IsLike : null,
                IsOwner = userId.HasValue && a.Asset.UserId == userId.Value,
                CreatedAt = a.Asset.CreatedAt
            }).ToList();

            return Ok(new ApiResponse<List<CourtAssetDto>> { Success = true, Data = dtos });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching assets for court {CourtId}", courtId);
            return StatusCode(500, new ApiResponse<List<CourtAssetDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /courts/{courtId}/assets - Upload a new asset
    [HttpPost("{courtId}/assets")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<CourtAssetDto>>> UploadAsset(int courtId, [FromBody] UploadCourtAssetDto dto)
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<CourtAssetDto> { Success = false, Message = "User not authenticated" });

            // Verify court exists
            var courtExists = await _context.Courts.AnyAsync(c => c.CourtId == courtId);
            if (!courtExists)
                return NotFound(new ApiResponse<CourtAssetDto> { Success = false, Message = "Court not found" });

            // Validate asset type
            if (dto.AssetType != "image" && dto.AssetType != "video")
                return BadRequest(new ApiResponse<CourtAssetDto> { Success = false, Message = "Asset type must be 'image' or 'video'" });

            // Validate URL
            if (string.IsNullOrWhiteSpace(dto.AssetUrl))
                return BadRequest(new ApiResponse<CourtAssetDto> { Success = false, Message = "Asset URL is required" });

            var asset = new CourtAsset
            {
                CourtId = courtId,
                UserId = userId.Value,
                AssetType = dto.AssetType,
                AssetUrl = dto.AssetUrl,
                ThumbnailUrl = dto.ThumbnailUrl,
                Description = dto.Description,
                Width = dto.Width,
                Height = dto.Height,
                FileSizeBytes = dto.FileSizeBytes,
                MimeType = dto.MimeType,
                IsApproved = true // Auto-approve for now
            };

            _context.CourtAssets.Add(asset);
            await _context.SaveChangesAsync();

            // Get user info for response
            var user = await _context.Users.FindAsync(userId.Value);

            var result = new CourtAssetDto
            {
                Id = asset.Id,
                CourtId = asset.CourtId,
                UserId = asset.UserId,
                UserName = user != null ? $"{user.FirstName} {user.LastName}".Trim() : null,
                UserProfileImageUrl = user?.ProfileImageUrl,
                AssetType = asset.AssetType,
                AssetUrl = asset.AssetUrl,
                ThumbnailUrl = asset.ThumbnailUrl,
                Description = asset.Description,
                Width = asset.Width,
                Height = asset.Height,
                LikeCount = 0,
                DislikeCount = 0,
                UserLiked = null,
                IsOwner = true,
                CreatedAt = asset.CreatedAt
            };

            return Ok(new ApiResponse<CourtAssetDto> { Success = true, Data = result, Message = "Asset uploaded successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading asset for court {CourtId}", courtId);
            return StatusCode(500, new ApiResponse<CourtAssetDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /courts/assets/{id} - Delete an asset (owner only)
    [HttpDelete("assets/{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteAsset(int id)
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var asset = await _context.CourtAssets.FindAsync(id);
            if (asset == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Asset not found" });

            // Check ownership
            if (asset.UserId != userId.Value)
            {
                // Check if user is admin
                var user = await _context.Users.FindAsync(userId.Value);
                if (user?.Role != "Admin")
                    return Forbid();
            }

            _context.CourtAssets.Remove(asset);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Asset deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting asset {AssetId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /courts/assets/{id}/vote - Like or dislike an asset
    [HttpPost("assets/{id}/vote")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<CourtAssetDto>>> VoteOnAsset(int id, [FromBody] CourtAssetLikeDto dto)
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<CourtAssetDto> { Success = false, Message = "User not authenticated" });

            var asset = await _context.CourtAssets
                .Include(a => a.Likes)
                .Include(a => a.User)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (asset == null)
                return NotFound(new ApiResponse<CourtAssetDto> { Success = false, Message = "Asset not found" });

            // Find existing vote
            var existingVote = asset.Likes?.FirstOrDefault(l => l.UserId == userId.Value);

            if (existingVote != null)
            {
                // Update existing vote
                existingVote.IsLike = dto.IsLike;
                existingVote.CreatedAt = DateTime.UtcNow;
            }
            else
            {
                // Create new vote
                var vote = new CourtAssetLike
                {
                    AssetId = id,
                    UserId = userId.Value,
                    IsLike = dto.IsLike
                };
                _context.CourtAssetLikes.Add(vote);
            }

            await _context.SaveChangesAsync();

            // Reload to get updated counts
            var likeCount = await _context.CourtAssetLikes.CountAsync(l => l.AssetId == id && l.IsLike);
            var dislikeCount = await _context.CourtAssetLikes.CountAsync(l => l.AssetId == id && !l.IsLike);

            var result = new CourtAssetDto
            {
                Id = asset.Id,
                CourtId = asset.CourtId,
                UserId = asset.UserId,
                UserName = asset.User != null ? $"{asset.User.FirstName} {asset.User.LastName}".Trim() : null,
                UserProfileImageUrl = asset.User?.ProfileImageUrl,
                AssetType = asset.AssetType,
                AssetUrl = asset.AssetUrl,
                ThumbnailUrl = asset.ThumbnailUrl,
                Description = asset.Description,
                Width = asset.Width,
                Height = asset.Height,
                LikeCount = likeCount,
                DislikeCount = dislikeCount,
                UserLiked = dto.IsLike,
                IsOwner = asset.UserId == userId.Value,
                CreatedAt = asset.CreatedAt
            };

            return Ok(new ApiResponse<CourtAssetDto> { Success = true, Data = result });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error voting on asset {AssetId}", id);
            return StatusCode(500, new ApiResponse<CourtAssetDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /courts/assets/{id}/vote - Remove vote
    [HttpDelete("assets/{id}/vote")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<CourtAssetDto>>> RemoveVote(int id)
    {
        try
        {
            var userId = GetUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<CourtAssetDto> { Success = false, Message = "User not authenticated" });

            var asset = await _context.CourtAssets
                .Include(a => a.User)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (asset == null)
                return NotFound(new ApiResponse<CourtAssetDto> { Success = false, Message = "Asset not found" });

            var vote = await _context.CourtAssetLikes
                .FirstOrDefaultAsync(l => l.AssetId == id && l.UserId == userId.Value);

            if (vote != null)
            {
                _context.CourtAssetLikes.Remove(vote);
                await _context.SaveChangesAsync();
            }

            // Get updated counts
            var likeCount = await _context.CourtAssetLikes.CountAsync(l => l.AssetId == id && l.IsLike);
            var dislikeCount = await _context.CourtAssetLikes.CountAsync(l => l.AssetId == id && !l.IsLike);

            var result = new CourtAssetDto
            {
                Id = asset.Id,
                CourtId = asset.CourtId,
                UserId = asset.UserId,
                UserName = asset.User != null ? $"{asset.User.FirstName} {asset.User.LastName}".Trim() : null,
                UserProfileImageUrl = asset.User?.ProfileImageUrl,
                AssetType = asset.AssetType,
                AssetUrl = asset.AssetUrl,
                ThumbnailUrl = asset.ThumbnailUrl,
                Description = asset.Description,
                Width = asset.Width,
                Height = asset.Height,
                LikeCount = likeCount,
                DislikeCount = dislikeCount,
                UserLiked = null,
                IsOwner = asset.UserId == userId.Value,
                CreatedAt = asset.CreatedAt
            };

            return Ok(new ApiResponse<CourtAssetDto> { Success = true, Data = result });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing vote on asset {AssetId}", id);
            return StatusCode(500, new ApiResponse<CourtAssetDto> { Success = false, Message = "An error occurred" });
        }
    }
}
