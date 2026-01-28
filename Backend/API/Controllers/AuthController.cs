using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Services;
using Stripe.Climate;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
[AllowAnonymous]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ISharedAuthService _sharedAuthService;
    private readonly IConfiguration _configuration;

    public AuthController(
        IAuthService authService,
        ISharedAuthService sharedAuthService,
        IConfiguration configuration)
    {
        _authService = authService;
        _sharedAuthService = sharedAuthService;
        _configuration = configuration;
    }

    /// <summary>
    /// Syncs a user from the shared auth service to the local database
    /// Called by frontend after successful login/register via shared auth
    /// </summary>
    [HttpPost("sync")]
    public async Task<ActionResult> SyncFromSharedAuth([FromBody] SyncUserRequest request)
    {
        try
        {
            if (string.IsNullOrEmpty(request.Token))
            {
                Console.WriteLine("[Auth/Sync] Error: Empty token received");
                return BadRequest("Token is required");
            }

            Console.WriteLine($"[Auth/Sync] Starting sync for token (first 50 chars): {request.Token.Substring(0, Math.Min(50, request.Token.Length))}...");

            // Validate the token with shared auth service
            var sharedUser = await _sharedAuthService.ValidateTokenAsync(request.Token);

            if (sharedUser == null)
            {
                Console.WriteLine("[Auth/Sync] Error: ValidateTokenAsync returned null");
                return Unauthorized("Invalid token - could not decode");
            }

            if (!sharedUser.IsValid)
            {
                Console.WriteLine($"[Auth/Sync] Error: Token marked as invalid for user {sharedUser.Id}");
                return Unauthorized("Invalid token from shared auth");
            }

            Console.WriteLine($"[Auth/Sync] Token valid for user {sharedUser.Id} ({sharedUser.Email})");

            // Sync user to local database
            var localUser = await _sharedAuthService.SyncUserAsync(sharedUser);
            Console.WriteLine($"[Auth/Sync] User synced successfully: {localUser.Id} with role {localUser.Role}");

            // Update role if provided from shared auth (isSiteAdmin or siteRole)
            if (!string.IsNullOrEmpty(request.Role))
            {
                var validRoles = new[] { "Player", "Manager", "Admin" };
                if (validRoles.Contains(request.Role) && localUser.Role != request.Role)
                {
                    Console.WriteLine($"[Auth/Sync] Updating role from {localUser.Role} to {request.Role}");
                    localUser = await _authService.UpdateRoleAsync(localUser.Id, request.Role);
                }
            }

            // Generate a new local JWT with the site-specific role
            var localToken = _authService.GenerateJwtToken(localUser);

            // Return the local user with their site-specific role and NEW token
            return Ok(new
            {
                Token = localToken,  // Use local token with site-specific role
                User = new
                {
                    localUser.Id,
                    localUser.Email,
                    localUser.FirstName,
                    localUser.LastName,
                    localUser.Role,  // Site-specific role
                    localUser.ProfileImageUrl,
                    localUser.CanWriteBlog
                }
            });
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException dbEx)
        {
            var innerMessage = dbEx.InnerException?.Message ?? dbEx.Message;
            Console.WriteLine($"[Auth/Sync] Database error: {innerMessage}");
            return BadRequest($"Database error during sync: {innerMessage}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Auth/Sync] Error: {ex.GetType().Name}: {ex.Message}");
            Console.WriteLine($"[Auth/Sync] Stack trace: {ex.StackTrace}");
            return BadRequest($"Failed to sync user: {ex.Message}");
        }
    }

    /// <summary>
    /// Returns the shared auth service URL for frontend to use
    /// </summary>
    [HttpGet("config")]
    public ActionResult GetAuthConfig()
    {
        return Ok(new
        {
            SharedAuthUrl = _configuration["SharedAuth:BaseUrl"],
            SiteCode = _configuration["SharedAuth:SiteCode"]
        });
    }

    /// <summary>
    /// Debug endpoint to check current token claims
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    public ActionResult GetCurrentUser()
    {
        var claims = User.Claims.Select(c => new { c.Type, c.Value }).ToList();
        var role = User.FindFirst("role")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

        return Ok(new
        {
            UserId = userId,
            Role = role,
            IsAdmin = User.IsInRole("Admin"),
            Claims = claims
        });
    }

    // Keep legacy endpoints for backwards compatibility during transition
    [HttpPost("register")]
    public async Task<ActionResult> Register(RegisterRequest request)
    {
        try
        {
            var user = await _authService.RegisterAsync(request);
            var token = _authService.GenerateJwtToken(user);

            return Ok(new
            {
                Token = token,
                User = new { user.Id, user.Email, user.FirstName, user.LastName, user.Role, user.ProfileImageUrl, user.CanWriteBlog }
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult> Login([FromBody] LoginDto loginDto)
    {
        var user = await _authService.AuthenticateAsync(loginDto.Email, loginDto.Password);

        if (user == null)
        {
            return Unauthorized("Invalid credentials");
        }
        var token = _authService.GenerateJwtToken(user);

        return Ok(new
        {
            Token = token,
            User = new
            {
                user.Id,
                user.Email,
                user.FirstName,
                user.LastName,
                user.Role,
                user.ProfileImageUrl,
                user.CanWriteBlog
            }
        });
    }

    [HttpPost("fastlogin")]
    public async Task<ActionResult> FastLogin([FromBody] string token)
    {
        var user = await _authService.FastAuthenticateAsync(token);
        if (user == null)
        {
            return Unauthorized("Invalid token");
        }

        return Ok(new
        {
            Token = token,
            User = new { user.Id, user.Email, user.FirstName, user.LastName, user.Role, user.ProfileImageUrl, user.CanWriteBlog }
        });
    }

    /// <summary>
    /// Updates the user's role (Admin only)
    /// </summary>
    [HttpPost("role")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> UpdateRole([FromBody] UpdateRoleRequest request)
    {
        try
        {
            var user = await _authService.UpdateRoleAsync(request.UserId, request.Role);
            if (user == null)
            {
                return NotFound("User not found");
            }

            return Ok(new { user.Id, user.Role });
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>
    /// Tests the API key connection to Funtime-Shared service
    /// Uses the API key from appsettings, no JWT authentication required
    /// </summary>
    [HttpGet("test-apikey")]
    public async Task<ActionResult> TestApiKey()
    {
        try
        {
            var baseUrl = _configuration["SharedAuth:BaseUrl"];
            var apiKey = _configuration["SharedAuth:ApiKey"];

            Console.WriteLine($"[TestApiKey] BaseUrl: {baseUrl}");
            Console.WriteLine($"[TestApiKey] ApiKey: {apiKey}");

            if (string.IsNullOrEmpty(baseUrl))
            {
                return BadRequest(new { success = false, message = "SharedAuth:BaseUrl not configured" });
            }

            if (string.IsNullOrEmpty(apiKey))
            {
                return BadRequest(new { success = false, message = "SharedAuth:ApiKey not configured" });
            }

            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Add("X-Api-Key", apiKey);

            var response = await httpClient.GetAsync($"{baseUrl}/apikey/test");
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                // Parse and return the JSON response
                var result = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(content);
                return Ok(result);
            }
            else
            {
                return StatusCode((int)response.StatusCode, new
                {
                    success = false,
                    message = $"API key test failed with status {response.StatusCode}",
                    details = content
                });
            }
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to test API key",
                error = ex.Message
            });
        }
    }
}

public class SyncUserRequest
{
    public string Token { get; set; } = string.Empty;
    public string? Role { get; set; }  // Optional site-specific role from shared auth
}

public class UpdateRoleRequest
{
    public int UserId { get; set; }
    public string Role { get; set; } = "Player";
}
