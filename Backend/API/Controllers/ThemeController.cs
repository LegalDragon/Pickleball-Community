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
public class ThemeController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAssetService _assetService;
    private readonly ILogger<ThemeController> _logger;

    public ThemeController(
        ApplicationDbContext context,
        IAssetService assetService,
        ILogger<ThemeController> logger)
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

    // GET: api/Theme/active (Public - no auth required)
    [AllowAnonymous]
    [HttpGet("active")]
    public async Task<ActionResult<ApiResponse<ThemeSettingsDto>>> GetActiveTheme()
    {
        try
        {
            var theme = await _context.ThemeSettings
                .Where(t => t.IsActive)
                .OrderByDescending(t => t.ThemeId)
                .FirstOrDefaultAsync();

            if (theme == null)
            {
                // Return default theme if none exists
                return Ok(new ApiResponse<ThemeSettingsDto>
                {
                    Success = true,
                    Data = GetDefaultTheme()
                });
            }

            var themeDto = MapToDto(theme);

            return Ok(new ApiResponse<ThemeSettingsDto>
            {
                Success = true,
                Data = themeDto
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching active theme");
            return StatusCode(500, new ApiResponse<ThemeSettingsDto>
            {
                Success = false,
                Message = "An error occurred while fetching theme"
            });
        }
    }

    // GET: api/Theme (Admin only)
    [Authorize(Roles = "Admin")]
    [HttpGet]
    public async Task<ActionResult<ApiResponse<ThemeSettingsDto>>> GetTheme()
    {
        try
        {
            var theme = await _context.ThemeSettings
                .Where(t => t.IsActive)
                .OrderByDescending(t => t.ThemeId)
                .FirstOrDefaultAsync();

            if (theme == null)
            {
                // Create default theme if none exists
                theme = await CreateDefaultThemeAsync();
            }

            var themeDto = MapToDto(theme);

            return Ok(new ApiResponse<ThemeSettingsDto>
            {
                Success = true,
                Data = themeDto
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching theme");
            return StatusCode(500, new ApiResponse<ThemeSettingsDto>
            {
                Success = false,
                Message = "An error occurred while fetching theme"
            });
        }
    }

    // PUT: api/Theme (Admin only)
    [Authorize(Roles = "Admin")]
    [HttpPut]
    public async Task<ActionResult<ApiResponse<ThemeSettingsDto>>> UpdateTheme([FromBody] UpdateThemeRequest request)
    {
        try
        {
            var theme = await _context.ThemeSettings
                .Where(t => t.IsActive)
                .OrderByDescending(t => t.ThemeId)
                .FirstOrDefaultAsync();

            if (theme == null)
            {
                // Create default theme if none exists
                theme = await CreateDefaultThemeAsync();
            }

            var currentUserId = GetCurrentUserId();

            // Update fields
            if (!string.IsNullOrEmpty(request.OrganizationName))
                theme.OrganizationName = request.OrganizationName;

            if (request.LogoUrl != null)
                theme.LogoUrl = request.LogoUrl;

            if (request.FaviconUrl != null)
                theme.FaviconUrl = request.FaviconUrl;

            // Primary colors
            if (!string.IsNullOrEmpty(request.PrimaryColor))
                theme.PrimaryColor = request.PrimaryColor;
            if (!string.IsNullOrEmpty(request.PrimaryDarkColor))
                theme.PrimaryDarkColor = request.PrimaryDarkColor;
            if (!string.IsNullOrEmpty(request.PrimaryLightColor))
                theme.PrimaryLightColor = request.PrimaryLightColor;

            // Accent colors
            if (!string.IsNullOrEmpty(request.AccentColor))
                theme.AccentColor = request.AccentColor;
            if (!string.IsNullOrEmpty(request.AccentDarkColor))
                theme.AccentDarkColor = request.AccentDarkColor;
            if (!string.IsNullOrEmpty(request.AccentLightColor))
                theme.AccentLightColor = request.AccentLightColor;

            // Status colors
            if (!string.IsNullOrEmpty(request.SuccessColor))
                theme.SuccessColor = request.SuccessColor;
            if (!string.IsNullOrEmpty(request.ErrorColor))
                theme.ErrorColor = request.ErrorColor;
            if (!string.IsNullOrEmpty(request.WarningColor))
                theme.WarningColor = request.WarningColor;
            if (!string.IsNullOrEmpty(request.InfoColor))
                theme.InfoColor = request.InfoColor;

            // Text colors
            if (!string.IsNullOrEmpty(request.TextPrimaryColor))
                theme.TextPrimaryColor = request.TextPrimaryColor;
            if (!string.IsNullOrEmpty(request.TextSecondaryColor))
                theme.TextSecondaryColor = request.TextSecondaryColor;
            if (!string.IsNullOrEmpty(request.TextLightColor))
                theme.TextLightColor = request.TextLightColor;

            // Background colors
            if (!string.IsNullOrEmpty(request.BackgroundColor))
                theme.BackgroundColor = request.BackgroundColor;
            if (!string.IsNullOrEmpty(request.BackgroundSecondaryColor))
                theme.BackgroundSecondaryColor = request.BackgroundSecondaryColor;

            // Other colors
            if (!string.IsNullOrEmpty(request.BorderColor))
                theme.BorderColor = request.BorderColor;
            if (!string.IsNullOrEmpty(request.ShadowColor))
                theme.ShadowColor = request.ShadowColor;

            // Typography
            if (!string.IsNullOrEmpty(request.FontFamily))
                theme.FontFamily = request.FontFamily;
            if (!string.IsNullOrEmpty(request.HeadingFontFamily))
                theme.HeadingFontFamily = request.HeadingFontFamily;

            // Custom CSS
            if (request.CustomCss != null)
                theme.CustomCss = request.CustomCss;

            // Hero section
            if (request.HeroVideoUrl != null)
                theme.HeroVideoUrl = request.HeroVideoUrl;
            if (request.HeroVideoThumbnailUrl != null)
                theme.HeroVideoThumbnailUrl = request.HeroVideoThumbnailUrl;
            if (request.HeroImageUrl != null)
                theme.HeroImageUrl = request.HeroImageUrl;
            if (request.HeroTitle != null)
                theme.HeroTitle = request.HeroTitle;
            if (request.HeroSubtitle != null)
                theme.HeroSubtitle = request.HeroSubtitle;
            if (request.HeroCtaText != null)
                theme.HeroCtaText = request.HeroCtaText;
            if (request.HeroCtaLink != null)
                theme.HeroCtaLink = request.HeroCtaLink;
            if (request.HeroSecondaryCtaText != null)
                theme.HeroSecondaryCtaText = request.HeroSecondaryCtaText;
            if (request.HeroSecondaryCtaLink != null)
                theme.HeroSecondaryCtaLink = request.HeroSecondaryCtaLink;

            // Marquee settings
            if (request.MarqueeShowPlayers.HasValue)
                theme.MarqueeShowPlayers = request.MarqueeShowPlayers.Value;
            if (request.MarqueeShowClubs.HasValue)
                theme.MarqueeShowClubs = request.MarqueeShowClubs.Value;
            if (request.MarqueeRecentDays.HasValue)
                theme.MarqueeRecentDays = Math.Clamp(request.MarqueeRecentDays.Value, 1, 365);
            if (request.MarqueePlayerCount.HasValue)
                theme.MarqueePlayerCount = Math.Clamp(request.MarqueePlayerCount.Value, 5, 50);
            if (request.MarqueeClubCount.HasValue)
                theme.MarqueeClubCount = Math.Clamp(request.MarqueeClubCount.Value, 5, 50);
            if (request.MarqueeSpeed.HasValue)
                theme.MarqueeSpeed = Math.Clamp(request.MarqueeSpeed.Value, 10, 120);

            theme.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Log activity
            if (currentUserId.HasValue)
            {
                var log = new ActivityLog
                {
                    UserId = currentUserId.Value,
                    ActivityType = "ThemeUpdated",
                    Description = "Updated theme settings"
                };
                _context.ActivityLogs.Add(log);
                await _context.SaveChangesAsync();
            }

            var themeDto = MapToDto(theme);

            return Ok(new ApiResponse<ThemeSettingsDto>
            {
                Success = true,
                Message = "Theme updated successfully",
                Data = themeDto
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating theme");
            return StatusCode(500, new ApiResponse<ThemeSettingsDto>
            {
                Success = false,
                Message = "An error occurred while updating theme"
            });
        }
    }

    // POST: api/Theme/logo (Admin only)
    [Authorize(Roles = "Admin")]
    [HttpPost("logo")]
    public async Task<ActionResult<ApiResponse<UploadResponse>>> UploadLogo(IFormFile file)
    {
        try
        {
            // Validate file using asset service
            var validation = _assetService.ValidateFile(file, "theme");
            if (!validation.IsValid)
            {
                return BadRequest(new ApiResponse<UploadResponse>
                {
                    Success = false,
                    Message = validation.ErrorMessage ?? "Invalid file"
                });
            }

            // Get current theme
            var theme = await _context.ThemeSettings
                .Where(t => t.IsActive)
                .OrderByDescending(t => t.ThemeId)
                .FirstOrDefaultAsync();

            // Delete old logo if exists
            if (theme != null && !string.IsNullOrEmpty(theme.LogoUrl))
            {
                await _assetService.DeleteFileAsync(theme.LogoUrl);
            }

            var currentUserId = GetCurrentUserId();

            // Upload new logo using asset service
            var result = await _assetService.UploadFileAsync(file, "theme", currentUserId, "ThemeSettings", theme?.ThemeId);
            if (!result.Success)
            {
                return BadRequest(new ApiResponse<UploadResponse>
                {
                    Success = false,
                    Message = result.ErrorMessage ?? "Upload failed"
                });
            }

            // Update theme if exists
            if (theme != null)
            {
                theme.LogoUrl = result.Url;
                theme.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            // Log activity
            if (currentUserId.HasValue)
            {
                var log = new ActivityLog
                {
                    UserId = currentUserId.Value,
                    ActivityType = "LogoUpdated",
                    Description = "Updated organization logo"
                };
                _context.ActivityLogs.Add(log);
                await _context.SaveChangesAsync();
            }

            return Ok(new ApiResponse<UploadResponse>
            {
                Success = true,
                Message = "Logo uploaded successfully",
                Data = new UploadResponse { Url = result.Url! }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading logo");
            return StatusCode(500, new ApiResponse<UploadResponse>
            {
                Success = false,
                Message = "An error occurred while uploading logo"
            });
        }
    }

    // POST: api/Theme/favicon (Admin only)
    [Authorize(Roles = "Admin")]
    [HttpPost("favicon")]
    public async Task<ActionResult<ApiResponse<UploadResponse>>> UploadFavicon(IFormFile file)
    {
        try
        {
            // Validate file using asset service
            var validation = _assetService.ValidateFile(file, "theme");
            if (!validation.IsValid)
            {
                return BadRequest(new ApiResponse<UploadResponse>
                {
                    Success = false,
                    Message = validation.ErrorMessage ?? "Invalid file"
                });
            }

            // Get current theme
            var theme = await _context.ThemeSettings
                .Where(t => t.IsActive)
                .OrderByDescending(t => t.ThemeId)
                .FirstOrDefaultAsync();

            // Delete old favicon if exists
            if (theme != null && !string.IsNullOrEmpty(theme.FaviconUrl))
            {
                await _assetService.DeleteFileAsync(theme.FaviconUrl);
            }

            var currentUserId = GetCurrentUserId();

            // Upload new favicon using asset service
            var result = await _assetService.UploadFileAsync(file, "theme", currentUserId, "ThemeSettings", theme?.ThemeId);
            if (!result.Success)
            {
                return BadRequest(new ApiResponse<UploadResponse>
                {
                    Success = false,
                    Message = result.ErrorMessage ?? "Upload failed"
                });
            }

            // Update theme if exists
            if (theme != null)
            {
                theme.FaviconUrl = result.Url;
                theme.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            // Log activity
            if (currentUserId.HasValue)
            {
                var log = new ActivityLog
                {
                    UserId = currentUserId.Value,
                    ActivityType = "FaviconUpdated",
                    Description = "Updated organization favicon"
                };
                _context.ActivityLogs.Add(log);
                await _context.SaveChangesAsync();
            }

            return Ok(new ApiResponse<UploadResponse>
            {
                Success = true,
                Message = "Favicon uploaded successfully",
                Data = new UploadResponse { Url = result.Url! }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading favicon");
            return StatusCode(500, new ApiResponse<UploadResponse>
            {
                Success = false,
                Message = "An error occurred while uploading favicon"
            });
        }
    }

    // POST: api/Theme/hero-video (Admin only)
    [Authorize(Roles = "Admin")]
    [HttpPost("hero-video")]
    public async Task<ActionResult<ApiResponse<UploadResponse>>> UploadHeroVideo(IFormFile file)
    {
        try
        {
            // Validate file (allow videos)
            var allowedExtensions = new[] { ".mp4", ".mov", ".webm", ".avi" };
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest(new ApiResponse<UploadResponse>
                {
                    Success = false,
                    Message = "Invalid file type. Allowed: MP4, MOV, WebM, AVI"
                });
            }

            if (file.Length > 100 * 1024 * 1024) // 100MB limit
            {
                return BadRequest(new ApiResponse<UploadResponse>
                {
                    Success = false,
                    Message = "File size exceeds 100MB limit"
                });
            }

            // Get current theme
            var theme = await _context.ThemeSettings
                .Where(t => t.IsActive)
                .OrderByDescending(t => t.ThemeId)
                .FirstOrDefaultAsync();

            // Delete old video if exists
            if (theme != null && !string.IsNullOrEmpty(theme.HeroVideoUrl))
            {
                await _assetService.DeleteFileAsync(theme.HeroVideoUrl);
            }

            var currentUserId = GetCurrentUserId();

            // Upload new video using asset service
            var result = await _assetService.UploadFileAsync(file, "hero", currentUserId, "ThemeSettings", theme?.ThemeId);
            if (!result.Success)
            {
                return BadRequest(new ApiResponse<UploadResponse>
                {
                    Success = false,
                    Message = result.ErrorMessage ?? "Upload failed"
                });
            }

            // Update theme if exists
            if (theme != null)
            {
                theme.HeroVideoUrl = result.Url;
                theme.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            // Log activity
            if (currentUserId.HasValue)
            {
                var log = new ActivityLog
                {
                    UserId = currentUserId.Value,
                    ActivityType = "HeroVideoUpdated",
                    Description = "Updated hero video"
                };
                _context.ActivityLogs.Add(log);
                await _context.SaveChangesAsync();
            }

            return Ok(new ApiResponse<UploadResponse>
            {
                Success = true,
                Message = "Hero video uploaded successfully",
                Data = new UploadResponse { Url = result.Url! }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading hero video");
            return StatusCode(500, new ApiResponse<UploadResponse>
            {
                Success = false,
                Message = "An error occurred while uploading hero video"
            });
        }
    }

    // DELETE: api/Theme/hero-video (Admin only)
    [Authorize(Roles = "Admin")]
    [HttpDelete("hero-video")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteHeroVideo()
    {
        try
        {
            var theme = await _context.ThemeSettings
                .Where(t => t.IsActive)
                .OrderByDescending(t => t.ThemeId)
                .FirstOrDefaultAsync();

            if (theme != null && !string.IsNullOrEmpty(theme.HeroVideoUrl))
            {
                await _assetService.DeleteFileAsync(theme.HeroVideoUrl);
                theme.HeroVideoUrl = null;
                theme.HeroVideoThumbnailUrl = null;
                theme.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Hero video deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting hero video");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: api/Theme/hero-image (Admin only)
    [Authorize(Roles = "Admin")]
    [HttpPost("hero-image")]
    public async Task<ActionResult<ApiResponse<UploadResponse>>> UploadHeroImage(IFormFile file)
    {
        try
        {
            // Validate file using asset service
            var validation = _assetService.ValidateFile(file, "theme");
            if (!validation.IsValid)
            {
                return BadRequest(new ApiResponse<UploadResponse>
                {
                    Success = false,
                    Message = validation.ErrorMessage ?? "Invalid file"
                });
            }

            // Get current theme
            var theme = await _context.ThemeSettings
                .Where(t => t.IsActive)
                .OrderByDescending(t => t.ThemeId)
                .FirstOrDefaultAsync();

            // Delete old image if exists
            if (theme != null && !string.IsNullOrEmpty(theme.HeroImageUrl))
            {
                await _assetService.DeleteFileAsync(theme.HeroImageUrl);
            }

            var currentUserId = GetCurrentUserId();

            // Upload new image using asset service
            var result = await _assetService.UploadFileAsync(file, "hero", currentUserId, "ThemeSettings", theme?.ThemeId);
            if (!result.Success)
            {
                return BadRequest(new ApiResponse<UploadResponse>
                {
                    Success = false,
                    Message = result.ErrorMessage ?? "Upload failed"
                });
            }

            // Update theme if exists
            if (theme != null)
            {
                theme.HeroImageUrl = result.Url;
                theme.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            // Log activity
            if (currentUserId.HasValue)
            {
                var log = new ActivityLog
                {
                    UserId = currentUserId.Value,
                    ActivityType = "HeroImageUpdated",
                    Description = "Updated hero image"
                };
                _context.ActivityLogs.Add(log);
                await _context.SaveChangesAsync();
            }

            return Ok(new ApiResponse<UploadResponse>
            {
                Success = true,
                Message = "Hero image uploaded successfully",
                Data = new UploadResponse { Url = result.Url! }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading hero image");
            return StatusCode(500, new ApiResponse<UploadResponse>
            {
                Success = false,
                Message = "An error occurred while uploading hero image"
            });
        }
    }

    // DELETE: api/Theme/hero-image (Admin only)
    [Authorize(Roles = "Admin")]
    [HttpDelete("hero-image")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteHeroImage()
    {
        try
        {
            var theme = await _context.ThemeSettings
                .Where(t => t.IsActive)
                .OrderByDescending(t => t.ThemeId)
                .FirstOrDefaultAsync();

            if (theme != null && !string.IsNullOrEmpty(theme.HeroImageUrl))
            {
                await _assetService.DeleteFileAsync(theme.HeroImageUrl);
                theme.HeroImageUrl = null;
                theme.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Hero image deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting hero image");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: api/Theme/presets (Admin only)
    [Authorize(Roles = "Admin")]
    [HttpGet("presets")]
    public async Task<ActionResult<ApiResponse<List<ThemePresetDto>>>> GetThemePresets()
    {
        try
        {
            var presets = await _context.ThemePresets
                .Select(p => new ThemePresetDto
                {
                    PresetId = p.PresetId,
                    PresetName = p.PresetName,
                    Description = p.Description,
                    PrimaryColor = p.PrimaryColor,
                    PrimaryDarkColor = p.PrimaryDarkColor,
                    PrimaryLightColor = p.PrimaryLightColor,
                    AccentColor = p.AccentColor,
                    AccentDarkColor = p.AccentDarkColor,
                    AccentLightColor = p.AccentLightColor,
                    PreviewImage = p.PreviewImage,
                    IsDefault = p.IsDefault
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<ThemePresetDto>>
            {
                Success = true,
                Data = presets
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching theme presets");
            return StatusCode(500, new ApiResponse<List<ThemePresetDto>>
            {
                Success = false,
                Message = "An error occurred while fetching theme presets"
            });
        }
    }

    // POST: api/Theme/reset (Admin only)
    [Authorize(Roles = "Admin")]
    [HttpPost("reset")]
    public async Task<ActionResult<ApiResponse<ThemeSettingsDto>>> ResetToDefault()
    {
        try
        {
            var theme = await _context.ThemeSettings
                .Where(t => t.IsActive)
                .OrderByDescending(t => t.ThemeId)
                .FirstOrDefaultAsync();

            if (theme == null)
            {
                // Create default theme if none exists
                theme = await CreateDefaultThemeAsync();
            }

            var currentUserId = GetCurrentUserId();

            // Reset to default values
            var defaultTheme = GetDefaultTheme();
            theme.PrimaryColor = defaultTheme.PrimaryColor;
            theme.PrimaryDarkColor = defaultTheme.PrimaryDarkColor;
            theme.PrimaryLightColor = defaultTheme.PrimaryLightColor;
            theme.AccentColor = defaultTheme.AccentColor;
            theme.AccentDarkColor = defaultTheme.AccentDarkColor;
            theme.AccentLightColor = defaultTheme.AccentLightColor;
            theme.SuccessColor = defaultTheme.SuccessColor;
            theme.ErrorColor = defaultTheme.ErrorColor;
            theme.WarningColor = defaultTheme.WarningColor;
            theme.InfoColor = defaultTheme.InfoColor;
            theme.TextPrimaryColor = defaultTheme.TextPrimaryColor;
            theme.TextSecondaryColor = defaultTheme.TextSecondaryColor;
            theme.TextLightColor = defaultTheme.TextLightColor;
            theme.BackgroundColor = defaultTheme.BackgroundColor;
            theme.BackgroundSecondaryColor = defaultTheme.BackgroundSecondaryColor;
            theme.BorderColor = defaultTheme.BorderColor;
            theme.ShadowColor = defaultTheme.ShadowColor;
            theme.FontFamily = defaultTheme.FontFamily;
            theme.HeadingFontFamily = defaultTheme.HeadingFontFamily;
            theme.CustomCss = null;

            theme.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Log activity
            if (currentUserId.HasValue)
            {
                var log = new ActivityLog
                {
                    UserId = currentUserId.Value,
                    ActivityType = "ThemeReset",
                    Description = "Reset theme to default"
                };
                _context.ActivityLogs.Add(log);
                await _context.SaveChangesAsync();
            }

            var themeDto = MapToDto(theme);

            return Ok(new ApiResponse<ThemeSettingsDto>
            {
                Success = true,
                Message = "Theme reset to default",
                Data = themeDto
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resetting theme");
            return StatusCode(500, new ApiResponse<ThemeSettingsDto>
            {
                Success = false,
                Message = "An error occurred while resetting theme"
            });
        }
    }

    // Helper methods
    private async Task<ThemeSettings> CreateDefaultThemeAsync()
    {
        var defaultTheme = new ThemeSettings
        {
            OrganizationName = "Pickleball Community",
            PrimaryColor = "#047857",
            PrimaryDarkColor = "#065f46",
            PrimaryLightColor = "#d1fae5",
            AccentColor = "#f59e0b",
            AccentDarkColor = "#d97706",
            AccentLightColor = "#fef3c7",
            SuccessColor = "#10b981",
            ErrorColor = "#ef4444",
            WarningColor = "#f59e0b",
            InfoColor = "#3b82f6",
            TextPrimaryColor = "#111827",
            TextSecondaryColor = "#6b7280",
            TextLightColor = "#f9fafb",
            BackgroundColor = "#ffffff",
            BackgroundSecondaryColor = "#f3f4f6",
            BorderColor = "#e5e7eb",
            ShadowColor = "#00000026",
            FontFamily = "Inter, system-ui, sans-serif",
            HeadingFontFamily = "Playfair Display, serif",
            IsActive = true,
            UpdatedAt = DateTime.UtcNow
        };

        _context.ThemeSettings.Add(defaultTheme);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Created default theme settings");
        return defaultTheme;
    }

    private ThemeSettingsDto MapToDto(ThemeSettings theme)
    {
        return new ThemeSettingsDto
        {
            ThemeId = theme.ThemeId,
            OrganizationName = theme.OrganizationName,
            LogoUrl = theme.LogoUrl,
            FaviconUrl = theme.FaviconUrl,
            PrimaryColor = theme.PrimaryColor,
            PrimaryDarkColor = theme.PrimaryDarkColor,
            PrimaryLightColor = theme.PrimaryLightColor,
            AccentColor = theme.AccentColor,
            AccentDarkColor = theme.AccentDarkColor,
            AccentLightColor = theme.AccentLightColor,
            SuccessColor = theme.SuccessColor,
            ErrorColor = theme.ErrorColor,
            WarningColor = theme.WarningColor,
            InfoColor = theme.InfoColor,
            TextPrimaryColor = theme.TextPrimaryColor,
            TextSecondaryColor = theme.TextSecondaryColor,
            TextLightColor = theme.TextLightColor,
            BackgroundColor = theme.BackgroundColor,
            BackgroundSecondaryColor = theme.BackgroundSecondaryColor,
            BorderColor = theme.BorderColor,
            ShadowColor = theme.ShadowColor,
            FontFamily = theme.FontFamily,
            HeadingFontFamily = theme.HeadingFontFamily,
            CustomCss = theme.CustomCss,
            // Hero section
            HeroVideoUrl = theme.HeroVideoUrl,
            HeroVideoThumbnailUrl = theme.HeroVideoThumbnailUrl,
            HeroImageUrl = theme.HeroImageUrl,
            HeroTitle = theme.HeroTitle,
            HeroSubtitle = theme.HeroSubtitle,
            HeroCtaText = theme.HeroCtaText,
            HeroCtaLink = theme.HeroCtaLink,
            HeroSecondaryCtaText = theme.HeroSecondaryCtaText,
            HeroSecondaryCtaLink = theme.HeroSecondaryCtaLink,
            // Marquee settings
            MarqueeShowPlayers = theme.MarqueeShowPlayers,
            MarqueeShowClubs = theme.MarqueeShowClubs,
            MarqueeRecentDays = theme.MarqueeRecentDays,
            MarqueePlayerCount = theme.MarqueePlayerCount,
            MarqueeClubCount = theme.MarqueeClubCount,
            MarqueeSpeed = theme.MarqueeSpeed,
            UpdatedAt = theme.UpdatedAt
        };
    }

    private ThemeSettingsDto GetDefaultTheme()
    {
        return new ThemeSettingsDto
        {
            OrganizationName = "Pickleball Community",
            PrimaryColor = "#047857",
            PrimaryDarkColor = "#065f46",
            PrimaryLightColor = "#d1fae5",
            AccentColor = "#f59e0b",
            AccentDarkColor = "#d97706",
            AccentLightColor = "#fef3c7",
            SuccessColor = "#10b981",
            ErrorColor = "#ef4444",
            WarningColor = "#f59e0b",
            InfoColor = "#3b82f6",
            TextPrimaryColor = "#111827",
            TextSecondaryColor = "#6b7280",
            TextLightColor = "#f9fafb",
            BackgroundColor = "#ffffff",
            BackgroundSecondaryColor = "#f3f4f6",
            BorderColor = "#e5e7eb",
            ShadowColor = "#00000026",
            FontFamily = "Inter, system-ui, sans-serif",
            HeadingFontFamily = "Playfair Display, serif",
            // Hero defaults
            HeroTitle = "Your Pickleball Community Awaits",
            HeroSubtitle = "Connect with players, find courts, join clubs, and get certified. The ultimate platform for pickleball enthusiasts.",
            HeroCtaText = "Find Courts",
            HeroCtaLink = "/courts",
            HeroSecondaryCtaText = "Join a Club",
            HeroSecondaryCtaLink = "/clubs",
            // Marquee defaults
            MarqueeShowPlayers = true,
            MarqueeShowClubs = true,
            MarqueeRecentDays = 30,
            MarqueePlayerCount = 20,
            MarqueeClubCount = 15,
            MarqueeSpeed = 40
        };
    }
}
