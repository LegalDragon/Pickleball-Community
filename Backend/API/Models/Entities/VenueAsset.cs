using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Images and videos uploaded for a venue
/// </summary>
public class VenueAsset
{
    public int Id { get; set; }

    [Required]
    public int VenueId { get; set; }

    [Required]
    public int UserId { get; set; }

    [Required]
    [MaxLength(20)]
    public string AssetType { get; set; } = "image"; // 'image' or 'video'

    [Required]
    [MaxLength(500)]
    public string AssetUrl { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? ThumbnailUrl { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    public int? Width { get; set; }
    public int? Height { get; set; }
    public long? FileSizeBytes { get; set; }

    [MaxLength(100)]
    public string? MimeType { get; set; }

    public bool IsApproved { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey("VenueId")]
    public Venue? Venue { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }

    public ICollection<VenueAssetLike>? Likes { get; set; }
}

/// <summary>
/// Like/dislike votes on venue assets
/// </summary>
public class VenueAssetLike
{
    public int Id { get; set; }

    [Required]
    public int AssetId { get; set; }

    [Required]
    public int UserId { get; set; }

    public bool IsLike { get; set; } // true = like, false = dislike

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey("AssetId")]
    public VenueAsset? Asset { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }
}
