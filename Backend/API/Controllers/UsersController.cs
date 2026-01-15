using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Services;

namespace Pickleball.Community.API.Controllers;

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
                .FirstOrDefaultAsync(u => u.Id == userId.Value);

            if (user == null)
            {
                return NotFound(new ApiResponse<UserProfileDto>
                {
                    Success = false,
                    Message = "User not found"
                });
            }

            // Load social links
            var socialLinks = await _context.UserSocialLinks
                .Where(s => s.UserId == userId.Value && s.IsActive)
                .OrderBy(s => s.SortOrder)
                .Select(s => new SocialLinkDto
                {
                    Id = s.Id,
                    Platform = s.Platform,
                    Url = s.Url,
                    DisplayName = s.DisplayName,
                    SortOrder = s.SortOrder
                })
                .ToListAsync();

            var profileDto = MapToProfileDto(user, socialLinks);

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

    // GET: api/Users/{id}/public - Get public profile (anyone can view)
    [HttpGet("{id}/public")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<PublicProfileDto>>> GetPublicProfile(int id)
    {
        try
        {
            var currentUserId = GetCurrentUserId();

            var user = await _context.Users
                .Where(u => u.Id == id && u.IsActive)
                .FirstOrDefaultAsync();

            if (user == null)
            {
                return NotFound(new ApiResponse<PublicProfileDto>
                {
                    Success = false,
                    Message = "User not found"
                });
            }

            // Load social links for public profile
            var socialLinks = await _context.UserSocialLinks
                .Where(s => s.UserId == id && s.IsActive)
                .OrderBy(s => s.SortOrder)
                .Select(s => new SocialLinkDto
                {
                    Id = s.Id,
                    Platform = s.Platform,
                    Url = s.Url,
                    DisplayName = s.DisplayName,
                    SortOrder = s.SortOrder
                })
                .ToListAsync();

            var publicProfile = new PublicProfileDto
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Bio = user.Bio,
                ProfileImageUrl = user.ProfileImageUrl,
                City = user.City,
                State = user.State,
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
                FriendshipStatus = "none",
                FriendRequestId = null,
                SocialLinks = socialLinks
            };

            // Check friendship status if user is logged in and viewing someone else's profile
            if (currentUserId.HasValue && currentUserId.Value != id)
            {
                // Check if they are friends (UserId1 is always smaller, UserId2 is always larger)
                var smallerId = Math.Min(currentUserId.Value, id);
                var largerId = Math.Max(currentUserId.Value, id);
                var friendship = await _context.Friendships
                    .Where(f => f.UserId1 == smallerId && f.UserId2 == largerId)
                    .FirstOrDefaultAsync();

                if (friendship != null)
                {
                    publicProfile.FriendshipStatus = "friends";
                }
                else
                {
                    // Check for pending friend requests
                    var sentRequest = await _context.FriendRequests
                        .Where(fr => fr.SenderId == currentUserId.Value && fr.RecipientId == id && fr.Status == "Pending")
                        .FirstOrDefaultAsync();

                    if (sentRequest != null)
                    {
                        publicProfile.FriendshipStatus = "pending_sent";
                        publicProfile.FriendRequestId = sentRequest.Id;
                    }
                    else
                    {
                        var receivedRequest = await _context.FriendRequests
                            .Where(fr => fr.SenderId == id && fr.RecipientId == currentUserId.Value && fr.Status == "Pending")
                            .FirstOrDefaultAsync();

                        if (receivedRequest != null)
                        {
                            publicProfile.FriendshipStatus = "pending_received";
                            publicProfile.FriendRequestId = receivedRequest.Id;
                        }
                    }
                }
            }
            else if (currentUserId.HasValue && currentUserId.Value == id)
            {
                publicProfile.FriendshipStatus = "self";
            }

            return Ok(new ApiResponse<PublicProfileDto>
            {
                Success = true,
                Data = publicProfile
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching public profile for user {UserId}", id);
            return StatusCode(500, new ApiResponse<PublicProfileDto>
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
            if (request.ProfileImageUrl != null)
                user.ProfileImageUrl = request.ProfileImageUrl;

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

            user.UpdatedAt = DateTime.Now;

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
            _logger.LogError(ex, "Error updating profile for user {UserId}. Message: {Message}, InnerException: {Inner}",
                GetCurrentUserId(), ex.Message, ex.InnerException?.Message);
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
            user.UpdatedAt = DateTime.Now;
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
            user.UpdatedAt = DateTime.Now;
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

    // GET: api/Users/recent - Get recently joined players (public, for home page marquee)
    [HttpGet("recent")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<RecentPlayerDto>>>> GetRecentPlayers([FromQuery] int count = 20, [FromQuery] int days = 30)
    {
        try
        {
            // Limit to reasonable range
            count = Math.Clamp(count, 5, 50);
            days = Math.Clamp(days, 1, 365);

            var cutoffDate = DateTime.Now.AddDays(-days);

            var recentPlayers = await _context.Users
                .Where(u => u.IsActive && !string.IsNullOrEmpty(u.FirstName) && u.CreatedAt >= cutoffDate)
                .OrderByDescending(u => u.CreatedAt)
                .Take(count)
                .Select(u => new RecentPlayerDto
                {
                    Id = u.Id,
                    FirstName = u.FirstName,
                    LastName = u.LastName,
                    ProfileImageUrl = u.ProfileImageUrl,
                    City = u.City,
                    State = u.State,
                    JoinedAt = u.CreatedAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<RecentPlayerDto>>
            {
                Success = true,
                Data = recentPlayers
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching recent players");
            return StatusCode(500, new ApiResponse<List<RecentPlayerDto>>
            {
                Success = false,
                Message = "An error occurred while fetching recent players"
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
            var managers = await _context.Users
                .Where(u => u.Role == "Manager" && u.IsActive)
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
                Data = managers
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
            var manager = await _context.Users
                .Where(u => u.Id == id && u.Role == "Manager" && u.IsActive)
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

            if (manager == null)
            {
                return NotFound(new ApiResponse<UserProfileDto>
                {
                    Success = false,
                    Message = "Manager not found"
                });
            }

            return Ok(new ApiResponse<UserProfileDto>
            {
                Success = true,
                Data = manager
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
                Message = $"Error fetching users: {ex.Message}"
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

            user.UpdatedAt = DateTime.Now;

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
    private static UserProfileDto MapToProfileDto(User user, List<SocialLinkDto>? socialLinks = null)
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
            IsActive = user.IsActive,
            SocialLinks = socialLinks
        };
    }

    // ==================== Social Links Endpoints ====================

    // GET: api/Users/social-links
    [HttpGet("social-links")]
    public async Task<ActionResult<ApiResponse<List<SocialLinkDto>>>> GetSocialLinks()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<List<SocialLinkDto>>
                {
                    Success = false,
                    Message = "User not authenticated"
                });
            }

            var links = await _context.UserSocialLinks
                .Where(s => s.UserId == userId.Value && s.IsActive)
                .OrderBy(s => s.SortOrder)
                .Select(s => new SocialLinkDto
                {
                    Id = s.Id,
                    Platform = s.Platform,
                    Url = s.Url,
                    DisplayName = s.DisplayName,
                    SortOrder = s.SortOrder
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<SocialLinkDto>>
            {
                Success = true,
                Data = links
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching social links");
            return StatusCode(500, new ApiResponse<List<SocialLinkDto>>
            {
                Success = false,
                Message = "An error occurred while fetching social links"
            });
        }
    }

    // POST: api/Users/social-links
    [HttpPost("social-links")]
    public async Task<ActionResult<ApiResponse<SocialLinkDto>>> AddSocialLink([FromBody] CreateSocialLinkRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<SocialLinkDto>
                {
                    Success = false,
                    Message = "User not authenticated"
                });
            }

            // Validate platform
            if (!SocialPlatforms.IsValid(request.Platform))
            {
                return BadRequest(new ApiResponse<SocialLinkDto>
                {
                    Success = false,
                    Message = $"Invalid platform. Valid platforms are: {string.Join(", ", SocialPlatforms.All)}"
                });
            }

            // Check if platform already exists for this user
            var existingLink = await _context.UserSocialLinks
                .FirstOrDefaultAsync(s => s.UserId == userId.Value && s.Platform == request.Platform && s.IsActive);

            if (existingLink != null)
            {
                return BadRequest(new ApiResponse<SocialLinkDto>
                {
                    Success = false,
                    Message = $"You already have a {request.Platform} link. Please update or remove it first."
                });
            }

            // Get max sort order
            var maxSortOrder = await _context.UserSocialLinks
                .Where(s => s.UserId == userId.Value && s.IsActive)
                .MaxAsync(s => (int?)s.SortOrder) ?? -1;

            var link = new UserSocialLink
            {
                UserId = userId.Value,
                Platform = request.Platform,
                Url = request.Url,
                DisplayName = request.DisplayName,
                SortOrder = request.SortOrder ?? (maxSortOrder + 1),
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.UserSocialLinks.Add(link);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<SocialLinkDto>
            {
                Success = true,
                Message = "Social link added successfully",
                Data = new SocialLinkDto
                {
                    Id = link.Id,
                    Platform = link.Platform,
                    Url = link.Url,
                    DisplayName = link.DisplayName,
                    SortOrder = link.SortOrder
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding social link");
            return StatusCode(500, new ApiResponse<SocialLinkDto>
            {
                Success = false,
                Message = "An error occurred while adding social link"
            });
        }
    }

    // PUT: api/Users/social-links/{id}
    [HttpPut("social-links/{id}")]
    public async Task<ActionResult<ApiResponse<SocialLinkDto>>> UpdateSocialLink(int id, [FromBody] UpdateSocialLinkRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<SocialLinkDto>
                {
                    Success = false,
                    Message = "User not authenticated"
                });
            }

            var link = await _context.UserSocialLinks
                .FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId.Value);

            if (link == null)
            {
                return NotFound(new ApiResponse<SocialLinkDto>
                {
                    Success = false,
                    Message = "Social link not found"
                });
            }

            if (request.Url != null)
                link.Url = request.Url;
            if (request.DisplayName != null)
                link.DisplayName = request.DisplayName;
            if (request.SortOrder.HasValue)
                link.SortOrder = request.SortOrder.Value;

            link.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<SocialLinkDto>
            {
                Success = true,
                Message = "Social link updated successfully",
                Data = new SocialLinkDto
                {
                    Id = link.Id,
                    Platform = link.Platform,
                    Url = link.Url,
                    DisplayName = link.DisplayName,
                    SortOrder = link.SortOrder
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating social link");
            return StatusCode(500, new ApiResponse<SocialLinkDto>
            {
                Success = false,
                Message = "An error occurred while updating social link"
            });
        }
    }

    // DELETE: api/Users/social-links/{id}
    [HttpDelete("social-links/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteSocialLink(int id)
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

            var link = await _context.UserSocialLinks
                .FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId.Value);

            if (link == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = "Social link not found"
                });
            }

            // Soft delete
            link.IsActive = false;
            link.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Social link deleted successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting social link");
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Message = "An error occurred while deleting social link"
            });
        }
    }

    // PUT: api/Users/social-links/bulk
    [HttpPut("social-links/bulk")]
    public async Task<ActionResult<ApiResponse<List<SocialLinkDto>>>> BulkUpdateSocialLinks([FromBody] BulkUpdateSocialLinksRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new ApiResponse<List<SocialLinkDto>>
                {
                    Success = false,
                    Message = "User not authenticated"
                });
            }

            // Validate all platforms
            foreach (var link in request.Links)
            {
                if (!SocialPlatforms.IsValid(link.Platform))
                {
                    return BadRequest(new ApiResponse<List<SocialLinkDto>>
                    {
                        Success = false,
                        Message = $"Invalid platform: {link.Platform}. Valid platforms are: {string.Join(", ", SocialPlatforms.All)}"
                    });
                }
            }

            // Check for duplicate platforms in request
            var duplicates = request.Links
                .GroupBy(l => l.Platform)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToList();

            if (duplicates.Any())
            {
                return BadRequest(new ApiResponse<List<SocialLinkDto>>
                {
                    Success = false,
                    Message = $"Duplicate platforms in request: {string.Join(", ", duplicates)}"
                });
            }

            // Soft delete all existing active links
            var existingLinks = await _context.UserSocialLinks
                .Where(s => s.UserId == userId.Value && s.IsActive)
                .ToListAsync();

            foreach (var existing in existingLinks)
            {
                existing.IsActive = false;
                existing.UpdatedAt = DateTime.UtcNow;
            }

            // Add new links
            var newLinks = new List<UserSocialLink>();
            for (int i = 0; i < request.Links.Count; i++)
            {
                var linkRequest = request.Links[i];
                var link = new UserSocialLink
                {
                    UserId = userId.Value,
                    Platform = linkRequest.Platform,
                    Url = linkRequest.Url,
                    DisplayName = linkRequest.DisplayName,
                    SortOrder = linkRequest.SortOrder ?? i,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                newLinks.Add(link);
                _context.UserSocialLinks.Add(link);
            }

            await _context.SaveChangesAsync();

            var result = newLinks.Select(l => new SocialLinkDto
            {
                Id = l.Id,
                Platform = l.Platform,
                Url = l.Url,
                DisplayName = l.DisplayName,
                SortOrder = l.SortOrder
            }).ToList();

            return Ok(new ApiResponse<List<SocialLinkDto>>
            {
                Success = true,
                Message = "Social links updated successfully",
                Data = result
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error bulk updating social links");
            return StatusCode(500, new ApiResponse<List<SocialLinkDto>>
            {
                Success = false,
                Message = "An error occurred while updating social links"
            });
        }
    }

    // GET: api/Users/social-platforms
    [HttpGet("social-platforms")]
    [AllowAnonymous]
    public ActionResult<ApiResponse<string[]>> GetSocialPlatforms()
    {
        return Ok(new ApiResponse<string[]>
        {
            Success = true,
            Data = SocialPlatforms.All
        });
    }
}
