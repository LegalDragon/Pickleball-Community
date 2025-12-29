using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Pickleball.College.Database;
using Pickleball.College.Models.Entities;
using Pickleball.College.Models.DTOs;
using Pickleball.College.Services;

namespace Pickleball.College.API.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAssetService _assetService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(
        ApplicationDbContext context,
        IAssetService assetService,
        ILogger<UsersController> logger)
    {
        _context = context;
        _assetService = assetService;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    // GET: api/Users/profile
    [HttpGet("profile")]
    public async Task<ActionResult<ApiResponse<UserProfileDto>>> GetProfile()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<UserProfileDto>
                {
                    Success = false,
                    Message = "User not authenticated"
                });
            }

            var user = await _context.Users
                .Include(u => u.CoachProfile)
                .FirstOrDefaultAsync(u => u.Id == userId.Value);

            if (user == null)
            {
                return NotFound(new ApiResponse<UserProfileDto>
                {
                    Success = false,
                    Message = "User not found"
                });
            }

            var profileDto = MapToProfileDto(user);

            return Ok(new ApiResponse<UserProfileDto>
            {
                Success = true,
                Data = profileDto
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching user profile");
            return StatusCode(500, new ApiResponse<UserProfileDto>
            {
                Success = false,
                Message = "An error occurred while fetching profile"
            });
        }
    }

    // PUT: api/Users/profile
    [HttpPut("profile")]
    public async Task<ActionResult<ApiResponse<UserProfileDto>>> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<UserProfileDto>
                {
                    Success = false,
                    Message = "User not authenticated"
                });
            }

            var user = await _context.Users.FindAsync(userId.Value);
            if (user == null)
            {
                return NotFound(new ApiResponse<UserProfileDto>
                {
                    Success = false,
                    Message = "User not found"
                });
            }

            // Update basic fields
            if (!string.IsNullOrEmpty(request.FirstName))
                user.FirstName = request.FirstName;
            if (!string.IsNullOrEmpty(request.LastName))
                user.LastName = request.LastName;
            if (request.Bio != null)
                user.Bio = request.Bio;

            // Update basic info fields
            if (request.Gender != null)
                user.Gender = request.Gender;
            if (request.DateOfBirth.HasValue)
                user.DateOfBirth = request.DateOfBirth;
            if (request.Phone != null)
                user.Phone = request.Phone;
            if (request.Address != null)
                user.Address = request.Address;
            if (request.City != null)
                user.City = request.City;
            if (request.State != null)
                user.State = request.State;
            if (request.ZipCode != null)
                user.ZipCode = request.ZipCode;
            if (request.Country != null)
                user.Country = request.Country;

            // Update pickleball info fields
            if (request.Handedness != null)
                user.Handedness = request.Handedness;
            if (request.ExperienceLevel != null)
                user.ExperienceLevel = request.ExperienceLevel;
            if (request.PlayingStyle != null)
                user.PlayingStyle = request.PlayingStyle;
            if (request.PaddleBrand != null)
                user.PaddleBrand = request.PaddleBrand;
            if (request.PaddleModel != null)
                user.PaddleModel = request.PaddleModel;
            if (request.YearsPlaying.HasValue)
                user.YearsPlaying = request.YearsPlaying;
            if (request.TournamentLevel != null)
                user.TournamentLevel = request.TournamentLevel;
            if (request.FavoriteShot != null)
                user.FavoriteShot = request.FavoriteShot;
            if (request.IntroVideo != null)
                user.IntroVideo = request.IntroVideo;

            user.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Log activity
            var log = new ActivityLog
            {
                UserId = userId.Value,
                ActivityType = "ProfileUpdated",
                Description = "Updated profile information"
            };
            _context.ActivityLogs.Add(log);
            await _context.SaveChangesAsync();

            var profileDto = MapToProfileDto(user);

            return Ok(new ApiResponse<UserProfileDto>
            {
                Success = true,
                Message = "Profile updated successfully",
                Data = profileDto
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating profile");
            return StatusCode(500, new ApiResponse<UserProfileDto>
            {
                Success = false,
                Message = "An error occurred while updating profile"
            });
        }
    }

    // POST: api/Users/avatar
    [HttpPost("avatar")]
    public async Task<ActionResult<ApiResponse<AvatarResponse>>> UploadAvatar(IFormFile file)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<AvatarResponse>
                {
                    Success = false,
                    Message = "User not authenticated"
                });
            }

            // Validate file using asset service
            var validation = _assetService.ValidateFile(file, "useravatar");
            if (!validation.IsValid)
            {
                return BadRequest(new ApiResponse<AvatarResponse>
                {
                    Success = false,
                    Message = validation.ErrorMessage ?? "Invalid file"
                });
            }

            // Get user
            var user = await _context.Users.FindAsync(userId.Value);
            if (user == null)
            {
                return NotFound(new ApiResponse<AvatarResponse>
                {
                    Success = false,
                    Message = "User not found"
                });
            }

            // Delete old avatar if exists
            if (!string.IsNullOrEmpty(user.ProfileImageUrl))
            {
                await _assetService.DeleteFileAsync(user.ProfileImageUrl);
            }

            // Upload new avatar using asset service (useravatar as folder and objectType)
            var result = await _assetService.UploadFileAsync(file, "useravatar", userId, "useravatar", userId);
            if (!result.Success)
            {
                return BadRequest(new ApiResponse<AvatarResponse>
                {
                    Success = false,
                    Message = result.ErrorMessage ?? "Upload failed"
                });
            }

            // Update user
            user.ProfileImageUrl = result.Url;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Log activity
            var log = new ActivityLog
            {
                UserId = userId.Value,
                ActivityType = "AvatarUpdated",
                Description = "Updated profile avatar"
            };
            _context.ActivityLogs.Add(log);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<AvatarResponse>
            {
                Success = true,
                Message = "Avatar uploaded successfully",
                Data = new AvatarResponse { AvatarUrl = result.Url! }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading avatar");
            return StatusCode(500, new ApiResponse<AvatarResponse>
            {
                Success = false,
                Message = "An error occurred while uploading avatar"
            });
        }
    }

    // DELETE: api/Users/avatar
    [HttpDelete("avatar")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteAvatar()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<object>
                {
                    Success = false,
                    Message = "User not authenticated"
                });
            }

            var user = await _context.Users.FindAsync(userId.Value);
            if (user == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = "User not found"
                });
            }

            // Delete avatar file using asset service
            if (!string.IsNullOrEmpty(user.ProfileImageUrl))
            {
                await _assetService.DeleteFileAsync(user.ProfileImageUrl);
            }

            user.ProfileImageUrl = null;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Log activity
            var log = new ActivityLog
            {
                UserId = userId.Value,
                ActivityType = "AvatarDeleted",
                Description = "Removed profile avatar"
            };
            _context.ActivityLogs.Add(log);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Avatar deleted successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting avatar");
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Message = "An error occurred while deleting avatar"
            });
        }
    }

    // GET: api/Users/coaches (Public - anyone can browse coaches)
    [HttpGet("coaches")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<UserProfileDto>>>> GetCoaches()
    {
        try
        {
            var coaches = await _context.Users
                .Where(u => u.Role == "Coach" && u.IsActive)
                .Select(u => new UserProfileDto
                {
                    Id = u.Id,
                    Email = u.Email,
                    FirstName = u.FirstName,
                    LastName = u.LastName,
                    Role = u.Role,
                    Bio = u.Bio,
                    ProfileImageUrl = u.ProfileImageUrl,
                    ExperienceLevel = u.ExperienceLevel,
                    PlayingStyle = u.PlayingStyle,
                    YearsPlaying = u.YearsPlaying,
                    CreatedAt = u.CreatedAt,
                    IsActive = u.IsActive
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<UserProfileDto>>
            {
                Success = true,
                Data = coaches
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching coaches");
            return StatusCode(500, new ApiResponse<List<UserProfileDto>>
            {
                Success = false,
                Message = "An error occurred while fetching coaches"
            });
        }
    }

    // GET: api/Users/coaches/{id} (Get a single coach by ID)
    [HttpGet("coaches/{id}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<UserProfileDto>>> GetCoach(int id)
    {
        try
        {
            var coach = await _context.Users
                .Where(u => u.Id == id && u.Role == "Coach" && u.IsActive)
                .Select(u => new UserProfileDto
                {
                    Id = u.Id,
                    Email = u.Email,
                    FirstName = u.FirstName,
                    LastName = u.LastName,
                    Role = u.Role,
                    Bio = u.Bio,
                    ProfileImageUrl = u.ProfileImageUrl,
                    ExperienceLevel = u.ExperienceLevel,
                    PlayingStyle = u.PlayingStyle,
                    YearsPlaying = u.YearsPlaying,
                    IntroVideo = u.IntroVideo,
                    CreatedAt = u.CreatedAt,
                    IsActive = u.IsActive
                })
                .FirstOrDefaultAsync();

            if (coach == null)
            {
                return NotFound(new ApiResponse<UserProfileDto>
                {
                    Success = false,
                    Message = "Coach not found"
                });
            }

            return Ok(new ApiResponse<UserProfileDto>
            {
                Success = true,
                Data = coach
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching coach {CoachId}", id);
            return StatusCode(500, new ApiResponse<UserProfileDto>
            {
                Success = false,
                Message = "An error occurred while fetching coach"
            });
        }
    }

    // GET: api/Users (Admin only)
    [Authorize(Roles = "Admin")]
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<UserProfileDto>>>> GetAllUsers()
    {
        try
        {
            var users = await _context.Users
                .Select(u => new UserProfileDto
                {
                    Id = u.Id,
                    Email = u.Email,
                    FirstName = u.FirstName,
                    LastName = u.LastName,
                    Role = u.Role,
                    Bio = u.Bio,
                    ProfileImageUrl = u.ProfileImageUrl,
                    Gender = u.Gender,
                    DateOfBirth = u.DateOfBirth,
                    Phone = u.Phone,
                    Address = u.Address,
                    City = u.City,
                    State = u.State,
                    ZipCode = u.ZipCode,
                    Country = u.Country,
                    Handedness = u.Handedness,
                    ExperienceLevel = u.ExperienceLevel,
                    PlayingStyle = u.PlayingStyle,
                    PaddleBrand = u.PaddleBrand,
                    PaddleModel = u.PaddleModel,
                    YearsPlaying = u.YearsPlaying,
                    TournamentLevel = u.TournamentLevel,
                    FavoriteShot = u.FavoriteShot,
                    IntroVideo = u.IntroVideo,
                    CreatedAt = u.CreatedAt,
                    IsActive = u.IsActive
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<UserProfileDto>>
            {
                Success = true,
                Data = users
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching users");
            return StatusCode(500, new ApiResponse<List<UserProfileDto>>
            {
                Success = false,
                Message = "An error occurred while fetching users"
            });
        }
    }

    // PUT: api/Users/{id} (Admin only)
    [Authorize(Roles = "Admin")]
    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<UserProfileDto>>> AdminEditUser(int id, [FromBody] AdminUpdateUserRequest request)
    {
        try
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound(new ApiResponse<UserProfileDto>
                {
                    Success = false,
                    Message = "User not found"
                });
            }

            // Update fields
            if (!string.IsNullOrEmpty(request.FirstName))
                user.FirstName = request.FirstName;
            if (!string.IsNullOrEmpty(request.LastName))
                user.LastName = request.LastName;
            if (request.Bio != null)
                user.Bio = request.Bio;
            if (!string.IsNullOrEmpty(request.Role))
                user.Role = request.Role;
            if (request.IsActive.HasValue)
                user.IsActive = request.IsActive.Value;

            user.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Log activity
            var currentUserId = GetCurrentUserId();
            if (currentUserId.HasValue)
            {
                var log = new ActivityLog
                {
                    UserId = currentUserId.Value,
                    ActivityType = "AdminUserEdit",
                    Description = $"Admin edited user {user.Email}"
                };
                _context.ActivityLogs.Add(log);
                await _context.SaveChangesAsync();
            }

            var profileDto = MapToProfileDto(user);

            return Ok(new ApiResponse<UserProfileDto>
            {
                Success = true,
                Message = "User updated successfully",
                Data = profileDto
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user");
            return StatusCode(500, new ApiResponse<UserProfileDto>
            {
                Success = false,
                Message = "An error occurred while updating user"
            });
        }
    }

    // Helper method to map User entity to UserProfileDto
    private static UserProfileDto MapToProfileDto(User user)
    {
        return new UserProfileDto
        {
            Id = user.Id,
            Email = user.Email,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Role = user.Role,
            Bio = user.Bio,
            ProfileImageUrl = user.ProfileImageUrl,
            Gender = user.Gender,
            DateOfBirth = user.DateOfBirth,
            Phone = user.Phone,
            Address = user.Address,
            City = user.City,
            State = user.State,
            ZipCode = user.ZipCode,
            Country = user.Country,
            Handedness = user.Handedness,
            ExperienceLevel = user.ExperienceLevel,
            PlayingStyle = user.PlayingStyle,
            PaddleBrand = user.PaddleBrand,
            PaddleModel = user.PaddleModel,
            YearsPlaying = user.YearsPlaying,
            TournamentLevel = user.TournamentLevel,
            FavoriteShot = user.FavoriteShot,
            IntroVideo = user.IntroVideo,
            CreatedAt = user.CreatedAt,
            IsActive = user.IsActive
        };
    }
}
