namespace Pickleball.Community.Models.Entities;

public class UserDismissedRelease
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int ReleaseNoteId { get; set; }
    public DateTime DismissedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User? User { get; set; }
    public ReleaseNote? ReleaseNote { get; set; }
}
