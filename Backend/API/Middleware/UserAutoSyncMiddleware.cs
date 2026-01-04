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
                    // Extract user info from claims
                    var email = context.User.FindFirst(ClaimTypes.Email)?.Value
                        ?? context.User.FindFirst("email")?.Value
                        ?? string.Empty;

                    var firstName = context.User.FindFirst(ClaimTypes.GivenName)?.Value
                        ?? context.User.FindFirst("firstName")?.Value
                        ?? context.User.FindFirst("FirstName")?.Value;

                    var lastName = context.User.FindFirst(ClaimTypes.Surname)?.Value
                        ?? context.User.FindFirst("lastName")?.Value
                        ?? context.User.FindFirst("LastName")?.Value;

                    var phone = context.User.FindFirst(ClaimTypes.MobilePhone)?.Value
                        ?? context.User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone")?.Value
                        ?? context.User.FindFirst("phone")?.Value;

                    // Create new local user record
                    var newUser = new User
                    {
                        Id = userId,
                        Email = email,
                        FirstName = firstName,
                        LastName = lastName,
                        Phone = phone,
                        Role = "Student",  // Default role
                        PasswordHash = null,  // No local password - auth via shared service
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    try
                    {
                        dbContext.Users.Add(newUser);
                        await dbContext.SaveChangesAsync();
                        _logger.LogInformation("Auto-created local user {UserId} ({Email}) from shared auth token", userId, email);
                    }
                    catch (DbUpdateException ex)
                    {
                        // User might have been created by another concurrent request
                        _logger.LogWarning(ex, "Could not auto-create user {UserId} - may already exist", userId);
                    }
                }
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
