using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class ActivityLog
{
    [Key]
    public int LogId { get; set; }

    public int? UserId { get; set; }

    [Required]
    [MaxLength(100)]
    public string ActivityType { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [MaxLength(100)]
    public string? IpAddress { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation property
    [ForeignKey("UserId")]
    public User? User { get; set; }
}
