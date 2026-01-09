using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

[Table("SiteContent")]
public class SiteContent
{
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string ContentKey { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Content { get; set; } = string.Empty;

    public int? LastUpdatedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public DateTime? UpdatedAt { get; set; }

    // Navigation
    [ForeignKey("LastUpdatedByUserId")]
    public virtual User? LastUpdatedByUser { get; set; }
}
