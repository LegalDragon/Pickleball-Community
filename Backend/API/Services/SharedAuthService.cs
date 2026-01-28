using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Services;

public interface ISharedAuthService
{
    Task<SharedUserInfo?> ValidateTokenAsync(string token);
    Task<User> SyncUserAsync(SharedUserInfo sharedUser);
    Task<User?> GetOrCreateUserAsync(int sharedUserId, string email, string? firstName, string? lastName);
}

public class SharedUserInfo
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Phone { get; set; }
    public string? ProfileImageUrl { get; set; }
    public List<string> Sites { get; set; } = new();
    public bool IsValid { get; set; }
}

public class SharedAuthService : ISharedAuthService
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private readonly ILogger<SharedAuthService> _logger;
    private readonly IEmailNotificationService _emailService;

    public SharedAuthService(
        ApplicationDbContext context,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        ILogger<SharedAuthService> logger,
        IEmailNotificationService emailService)
    {
        _context = context;
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient("SharedAuth");
        _logger = logger;
        _emailService = emailService;

        // Configure base URL from settings
        var baseUrl = _configuration["SharedAuth:BaseUrl"];
        if (!string.IsNullOrEmpty(baseUrl))
        {
            _httpClient.BaseAddress = new Uri(baseUrl);
        }
    }

    /// <summary>
    /// Validates a JWT token by decoding it locally and extracting user info from claims.
    /// The token was issued by the shared auth service and we trust it.
    /// </summary>
    public Task<SharedUserInfo?> ValidateTokenAsync(string token)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();

            // Check if token is in valid JWT format
            if (!handler.CanReadToken(token))
            {
                _logger.LogWarning("Invalid JWT token format");
                return Task.FromResult<SharedUserInfo?>(null);
            }

            // Decode the token without validation (we trust tokens from shared auth)
            var jwtToken = handler.ReadJwtToken(token);

            // Check if token is expired
            if (jwtToken.ValidTo < DateTime.Now)
            {
                _logger.LogWarning("JWT token is expired");
                return Task.FromResult<SharedUserInfo?>(null);
            }

            // Extract user info from claims
            var claims = jwtToken.Claims.ToList();

            // Try different claim types for user ID (FuntimePickleball uses "nameid")
            var userIdClaim = claims.FirstOrDefault(c => c.Type == "nameid" || c.Type == "sub" || c.Type == ClaimTypes.NameIdentifier || c.Type == "userId" || c.Type == "UserId" || c.Type == "id");
            var emailClaim = claims.FirstOrDefault(c => c.Type == "email" || c.Type == ClaimTypes.Email);
            var firstNameClaim = claims.FirstOrDefault(c => c.Type == "firstName" || c.Type == "FirstName" || c.Type == "given_name" || c.Type == ClaimTypes.GivenName);
            var lastNameClaim = claims.FirstOrDefault(c => c.Type == "lastName" || c.Type == "LastName" || c.Type == "family_name" || c.Type == ClaimTypes.Surname);
            // FuntimePickleball uses the full URI for mobile phone claim
            var phoneClaim = claims.FirstOrDefault(c =>
                c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone" ||
                c.Type == ClaimTypes.MobilePhone ||
                c.Type == "phone" || c.Type == "Phone" || c.Type == "phoneNumber");
            // Sites claim contains JSON array of site keys
            var sitesClaim = claims.FirstOrDefault(c => c.Type == "sites");

            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
            {
                _logger.LogWarning("Could not extract valid user ID from token. Claims: {Claims}",
                    string.Join(", ", claims.Select(c => $"{c.Type}={c.Value}")));
                return Task.FromResult<SharedUserInfo?>(null);
            }

            // Parse sites claim if present
            var sites = new List<string>();
            if (sitesClaim != null)
            {
                try
                {
                    sites = JsonSerializer.Deserialize<List<string>>(sitesClaim.Value) ?? new List<string>();
                }
                catch
                {
                    _logger.LogWarning("Could not parse sites claim: {Sites}", sitesClaim.Value);
                }
            }

            var userInfo = new SharedUserInfo
            {
                Id = userId,
                Email = emailClaim?.Value ?? string.Empty,
                FirstName = firstNameClaim?.Value,
                LastName = lastNameClaim?.Value,
                Phone = phoneClaim?.Value,
                Sites = sites,
                IsValid = true
            };

            _logger.LogInformation("Decoded token for user {UserId} ({Email})", userInfo.Id, userInfo.Email);
            return Task.FromResult<SharedUserInfo?>(userInfo);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error decoding JWT token");
            return Task.FromResult<SharedUserInfo?>(null);
        }
    }

    /// <summary>
    /// Syncs a user from the shared auth service to the local database
    /// Creates a new user record if one doesn't exist, or updates existing
    /// </summary>
    public async Task<User> SyncUserAsync(SharedUserInfo sharedUser)
    {
        _logger.LogInformation("SyncUserAsync starting for user {UserId} ({Email})", sharedUser.Id, sharedUser.Email);

        // Check if another user already has this email (different UserId)
        var userWithEmail = await _context.Users.FirstOrDefaultAsync(u => u.Email == sharedUser.Email && u.Id != sharedUser.Id);
        if (userWithEmail != null)
        {
            _logger.LogWarning("Email {Email} already exists for different user {ExistingId}, syncing user {NewId}",
                sharedUser.Email, userWithEmail.Id, sharedUser.Id);
            // Update the existing user's email to avoid conflict (mark as orphaned)
            userWithEmail.Email = $"orphaned_{userWithEmail.Id}_{userWithEmail.Email}";
            userWithEmail.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();
            _logger.LogInformation("Marked user {UserId} email as orphaned", userWithEmail.Id);
        }

        var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == sharedUser.Id);

        if (existingUser == null)
        {
            _logger.LogInformation("User {UserId} not found locally, creating new record", sharedUser.Id);

            // Create new local user record with the shared UserId
            var newUser = new User
            {
                Id = sharedUser.Id,  // Use the shared UserId
                Email = sharedUser.Email,
                FirstName = !string.IsNullOrEmpty(sharedUser.FirstName) ? sharedUser.FirstName : "New",
                LastName = !string.IsNullOrEmpty(sharedUser.LastName) ? sharedUser.LastName : "User",
                Phone = sharedUser.Phone,
                ProfileImageUrl = sharedUser.ProfileImageUrl,
                Role = "Player",  // Default role for new users
                PasswordHash = null,  // No local password - auth handled by shared service
                IsActive = true,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            try
            {
                _context.Users.Add(newUser);
                await _context.SaveChangesAsync();
                _logger.LogInformation("Created new local user {UserId} from shared auth", sharedUser.Id);

                // Send welcome email to new user
                if (!string.IsNullOrEmpty(newUser.Email))
                {
                    try
                    {
                        var welcomeHtml = EmailTemplates.WelcomeNewUser(newUser.FirstName);
                        await _emailService.SendSimpleAsync(
                            newUser.Id,
                            newUser.Email,
                            "Welcome to Pickleball Community! 🏓",
                            welcomeHtml);
                        _logger.LogInformation("Sent welcome email to new user {UserId}", newUser.Id);
                    }
                    catch (Exception emailEx)
                    {
                        // Don't fail user creation if email fails
                        _logger.LogWarning(emailEx, "Failed to send welcome email to user {UserId}", newUser.Id);
                    }
                }

                return newUser;
            }
            catch (DbUpdateException ex)
            {
                var innerMessage = ex.InnerException?.Message ?? ex.Message;
                _logger.LogWarning("DbUpdateException creating user {UserId}: {Message}", sharedUser.Id, innerMessage);

                if (innerMessage?.Contains("duplicate key") == true || innerMessage?.Contains("PRIMARY KEY") == true)
                {
                    // Race condition - user was created between our check and insert
                    // Detach the failed entity and fetch the existing one
                    _context.Entry(newUser).State = EntityState.Detached;

                    existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == sharedUser.Id);
                    if (existingUser != null)
                    {
                        _logger.LogInformation("User {UserId} was created by another request, updating instead", sharedUser.Id);
                        // Fall through to update logic below
                    }
                    else
                    {
                        _logger.LogError(ex, "Failed to create or find user {UserId} after duplicate key error", sharedUser.Id);
                        throw; // Something else went wrong
                    }
                }
                else if (innerMessage?.Contains("UNIQUE") == true || innerMessage?.Contains("IX_Users_Email") == true)
                {
                    // Email uniqueness violation - try to resolve
                    _context.Entry(newUser).State = EntityState.Detached;
                    _logger.LogWarning("Email uniqueness violation for {Email}, attempting to resolve", sharedUser.Email);

                    var conflictingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == sharedUser.Email);
                    if (conflictingUser != null && conflictingUser.Id != sharedUser.Id)
                    {
                        // Mark the old user's email as orphaned
                        conflictingUser.Email = $"orphaned_{conflictingUser.Id}_{conflictingUser.Email}";
                        conflictingUser.UpdatedAt = DateTime.Now;
                        await _context.SaveChangesAsync();
                        _logger.LogInformation("Resolved email conflict by orphaning user {UserId}", conflictingUser.Id);

                        // Retry creating the new user
                        var retryUser = new User
                        {
                            Id = sharedUser.Id,
                            Email = sharedUser.Email,
                            FirstName = !string.IsNullOrEmpty(sharedUser.FirstName) ? sharedUser.FirstName : "New",
                            LastName = !string.IsNullOrEmpty(sharedUser.LastName) ? sharedUser.LastName : "User",
                            Phone = sharedUser.Phone,
                            ProfileImageUrl = sharedUser.ProfileImageUrl,
                            Role = "Player",
                            PasswordHash = null,
                            IsActive = true,
                            CreatedAt = DateTime.Now,
                            UpdatedAt = DateTime.Now
                        };
                        _context.Users.Add(retryUser);
                        await _context.SaveChangesAsync();
                        _logger.LogInformation("Successfully created user {UserId} after resolving email conflict", sharedUser.Id);
                        return retryUser;
                    }
                    throw;
                }
                else
                {
                    _logger.LogError(ex, "Unexpected database error creating user {UserId}", sharedUser.Id);
                    throw;
                }
            }
        }

        // Update existing user with latest info from shared auth
        if (existingUser != null)
        {
            existingUser.Email = sharedUser.Email;
            existingUser.FirstName = sharedUser.FirstName ?? existingUser.FirstName;
            existingUser.LastName = sharedUser.LastName ?? existingUser.LastName;
            existingUser.Phone = sharedUser.Phone ?? existingUser.Phone;

            // Only update profile image if shared auth has one and local doesn't
            if (!string.IsNullOrEmpty(sharedUser.ProfileImageUrl) && string.IsNullOrEmpty(existingUser.ProfileImageUrl))
            {
                existingUser.ProfileImageUrl = sharedUser.ProfileImageUrl;
            }

            existingUser.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Updated local user {UserId} from shared auth", sharedUser.Id);
            return existingUser;
        }

        throw new InvalidOperationException($"Failed to sync user {sharedUser.Id}");
    }

    /// <summary>
    /// Gets an existing user or creates a new one with the shared UserId
    /// Used during initial login/registration flow
    /// </summary>
    public async Task<User?> GetOrCreateUserAsync(int sharedUserId, string email, string? firstName, string? lastName)
    {
        var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == sharedUserId);

        if (existingUser != null)
        {
            return existingUser;
        }

        // Create new local user
        var newUser = new User
        {
            Id = sharedUserId,
            Email = email,
            FirstName = !string.IsNullOrEmpty(firstName) ? firstName : "New",
            LastName = !string.IsNullOrEmpty(lastName) ? lastName : "User",
            Role = "Player",
            PasswordHash = null,
            IsActive = true,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync();

        return newUser;
    }
}
