using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Middleware;

/// <summary>
/// Middleware that automatically creates a local user record when an authenticated user
/// from shared auth doesn't exist in the local database.
/// This ensures users can use the app immediately after registering through shared auth.
/// </summary>
public class UserAutoSyncMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<UserAutoSyncMiddleware> _logger;

    public UserAutoSyncMiddleware(RequestDelegate next, ILogger<UserAutoSyncMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, ApplicationDbContext dbContext)
    {
        // Only process if user is authenticated
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? context.User.FindFirst("nameid")?.Value
                ?? context.User.FindFirst("sub")?.Value;

            if (int.TryParse(userIdClaim, out var userId))
            {
                // Check if user exists locally
                var userExists = await dbContext.Users.AnyAsync(u => u.Id == userId);

                if (!userExists)
                {
                    _logger.LogInformation("User {UserId} authenticated but not in local DB - creating...", userId);

                    // Log all claims for debugging
                    var allClaims = context.User.Claims.Select(c => $"{c.Type}={c.Value}").ToList();
                    _logger.LogDebug("JWT Claims: {Claims}", string.Join(", ", allClaims));

                    // Extract user info from claims
                    var email = context.User.FindFirst(ClaimTypes.Email)?.Value
                        ?? context.User.FindFirst("email")?.Value
                        ?? string.Empty;

                    var firstName = context.User.FindFirst(ClaimTypes.GivenName)?.Value
                        ?? context.User.FindFirst("firstName")?.Value
                        ?? context.User.FindFirst("FirstName")?.Value
                        ?? context.User.FindFirst("given_name")?.Value;

                    var lastName = context.User.FindFirst(ClaimTypes.Surname)?.Value
                        ?? context.User.FindFirst("lastName")?.Value
                        ?? context.User.FindFirst("LastName")?.Value
                        ?? context.User.FindFirst("family_name")?.Value;

                    var phone = context.User.FindFirst(ClaimTypes.MobilePhone)?.Value
                        ?? context.User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone")?.Value
                        ?? context.User.FindFirst("phone")?.Value
                        ?? context.User.FindFirst("phone_number")?.Value;

                    // Create new local user record with defaults for required fields
                    var newUser = new User
                    {
                        Id = userId,
                        Email = !string.IsNullOrEmpty(email) ? email : $"user{userId}@placeholder.local",
                        FirstName = !string.IsNullOrEmpty(firstName) ? firstName : "New",
                        LastName = !string.IsNullOrEmpty(lastName) ? lastName : "User",
                        Phone = phone,
                        Role = "Student",  // Default role
                        PasswordHash = null,  // No local password - auth via shared service
                        Bio = string.Empty,
                        ProfileImageUrl = string.Empty,
                        RefreshToken = string.Empty,
                        IsActive = true,
                        AllowDirectMessages = true,
                        AllowClubMessages = true,
                        CanWriteBlog = false,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    try
                    {
                        dbContext.Users.Add(newUser);
                        await dbContext.SaveChangesAsync();
                        _logger.LogInformation("Successfully created local user {UserId} ({Email})", userId, newUser.Email);
                    }
                    catch (DbUpdateException ex)
                    {
                        // User might have been created by another concurrent request
                        _logger.LogWarning(ex, "Could not create user {UserId} - may already exist or DB error: {Message}", userId, ex.InnerException?.Message ?? ex.Message);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Unexpected error creating user {UserId}: {Message}", userId, ex.Message);
                    }
                }
            }
            else
            {
                _logger.LogWarning("Authenticated user but could not parse userId from claim: {Claim}", userIdClaim);
            }
        }

        await _next(context);
    }
}

/// <summary>
/// Extension method to add UserAutoSyncMiddleware to the pipeline
/// </summary>
public static class UserAutoSyncMiddlewareExtensions
{
    public static IApplicationBuilder UseUserAutoSync(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<UserAutoSyncMiddleware>();
    }
}
