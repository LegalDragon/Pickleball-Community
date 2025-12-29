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
            // Validate the token with shared auth service
            var sharedUser = await _sharedAuthService.ValidateTokenAsync(request.Token);

            if (sharedUser == null || !sharedUser.IsValid)
            {
                return Unauthorized("Invalid token from shared auth");
            }

            // Sync user to local database
            var localUser = await _sharedAuthService.SyncUserAsync(sharedUser);

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
                    localUser.ProfileImageUrl
                }
            });
        }
        catch (Exception ex)
        {
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
                User = new { user.Id, user.Email, user.FirstName, user.LastName, user.Role, user.ProfileImageUrl }
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
                user.ProfileImageUrl
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
            User = new { user.Id, user.Email, user.FirstName, user.LastName, user.Role, user.ProfileImageUrl }
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
}

public class SyncUserRequest
{
    public string Token { get; set; } = string.Empty;
}

public class UpdateRoleRequest
{
    public int UserId { get; set; }
    public string Role { get; set; } = "Student";
}
