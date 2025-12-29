using Pickleball.College.Models.DTOs;
using Pickleball.College.Models.Entities;

namespace Pickleball.College.Services;

public interface IAuthService
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string hash);
    Task<User?> AuthenticateAsync(string email, string password);
    Task<User?> FastAuthenticateAsync(string token);
    Task<User> RegisterAsync(RegisterRequest request);
    string GenerateJwtToken(User user);
    Task<User?> UpdateRoleAsync(int userId, string role);
}
