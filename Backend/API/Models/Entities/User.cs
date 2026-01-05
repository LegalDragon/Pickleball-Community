using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.Entities;

public class User
{
    public int Id { get; set; }

    [Required]
    [EmailAddress]
    public string? Email { get; set; } = string.Empty;

    // PasswordHash can be null for users authenticating via shared auth
    public string? PasswordHash { get; set; }

    [Required]
    public string? Role { get; set; } = "Player";

    [Required]
    public string? FirstName { get; set; } = string.Empty;

    [Required]
    public string? LastName { get; set; } = string.Empty;

    public string? RefreshToken{ get; set; } = string.Empty;
    public string? Bio { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; } = string.Empty;

    // Basic info fields
    [MaxLength(20)]
    public string? Gender { get; set; }

    public DateTime? DateOfBirth { get; set; }

    [MaxLength(20)]
    public string? Phone { get; set; }

    [MaxLength(200)]
    public string? Address { get; set; }

    [MaxLength(100)]
    public string? City { get; set; }

    [MaxLength(100)]
    public string? State { get; set; }

    [MaxLength(20)]
    public string? ZipCode { get; set; }

    [MaxLength(100)]
    public string? Country { get; set; }

    // Pickleball info fields
    [MaxLength(10)]
    public string? Handedness { get; set; }

    [MaxLength(100)]
    public string? ExperienceLevel { get; set; }

    [MaxLength(100)]
    public string? PlayingStyle { get; set; }

    [MaxLength(100)]
    public string? PaddleBrand { get; set; }

    [MaxLength(100)]
    public string? PaddleModel { get; set; }

    public int? YearsPlaying { get; set; }

    [MaxLength(100)]
    public string? TournamentLevel { get; set; }

    [MaxLength(100)]
    public string? FavoriteShot { get; set; }

    [MaxLength(500)]
    public string? IntroVideo { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;

    // Blog permissions
    public bool CanWriteBlog { get; set; } = false;

    // Messaging preferences (opt-in)
    public bool AllowDirectMessages { get; set; } = true;
    public bool AllowClubMessages { get; set; } = true;

    // Navigation
    public virtual ICollection<BlogPost> BlogPosts { get; set; } = new List<BlogPost>();
    public virtual ICollection<BlogComment> BlogComments { get; set; } = new List<BlogComment>();
}
