using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class FeedbackEntry
{
    public int Id { get; set; }

    [Required]
    public int CategoryId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Subject { get; set; } = string.Empty;

    [Required]
    public string Message { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? UserEmail { get; set; }

    [MaxLength(100)]
    public string? UserName { get; set; }

    // Optional - linked if user was logged in
    public int? UserId { get; set; }

    [MaxLength(50)]
    public string Status { get; set; } = "New"; // New, InProgress, Resolved, Closed

    [MaxLength(1000)]
    public string? AdminNotes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("CategoryId")]
    public virtual FeedbackCategory? Category { get; set; }

    [ForeignKey("UserId")]
    public virtual User? User { get; set; }
}
