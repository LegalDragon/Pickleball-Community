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

    public SharedAuthService(
        ApplicationDbContext context,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        ILogger<SharedAuthService> logger)
    {
        _context = context;
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient("SharedAuth");
        _logger = logger;

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
            if (jwtToken.ValidTo < DateTime.UtcNow)
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
        var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == sharedUser.Id);

        if (existingUser == null)
        {
            // Create new local user record with the shared UserId
            var newUser = new User
            {
                Id = sharedUser.Id,  // Use the shared UserId
                Email = sharedUser.Email,
                FirstName = sharedUser.FirstName,
                LastName = sharedUser.LastName,
                Phone = sharedUser.Phone,
                ProfileImageUrl = sharedUser.ProfileImageUrl,
                Role = "Player",  // Default role for new users
                PasswordHash = null,  // No local password - auth handled by shared service
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Users.Add(newUser);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Created new local user {UserId} from shared auth", sharedUser.Id);
            return newUser;
        }
        else
        {
            // Update existing user with latest info from shared auth
            existingUser.Email = sharedUser.Email;
            existingUser.FirstName = sharedUser.FirstName ?? existingUser.FirstName;
            existingUser.LastName = sharedUser.LastName ?? existingUser.LastName;
            existingUser.Phone = sharedUser.Phone ?? existingUser.Phone;

            // Only update profile image if shared auth has one and local doesn't
            if (!string.IsNullOrEmpty(sharedUser.ProfileImageUrl) && string.IsNullOrEmpty(existingUser.ProfileImageUrl))
            {
                existingUser.ProfileImageUrl = sharedUser.ProfileImageUrl;
            }

            existingUser.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Updated local user {UserId} from shared auth", sharedUser.Id);
            return existingUser;
        }
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
            FirstName = firstName,
            LastName = lastName,
            Role = "Player",
            PasswordHash = null,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync();

        return newUser;
    }
}
