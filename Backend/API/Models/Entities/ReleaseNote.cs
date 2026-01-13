namespace Pickleball.Community.Models.Entities;

public class ReleaseNote
{
    public int Id { get; set; }
    public string Version { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime ReleaseDate { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
    public bool IsMajor { get; set; } = false;
    public bool IsTest { get; set; } = false; // Test mode - only visible to admins
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int CreatedByUserId { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? UpdatedByUserId { get; set; }

    // Navigation properties
    public User? CreatedBy { get; set; }
    public User? UpdatedBy { get; set; }
    public ICollection<UserDismissedRelease> DismissedByUsers { get; set; } = new List<UserDismissedRelease>();
}
