using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class Asset
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int FileId { get; set; }

    [Required]
    [MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? OriginalFileName { get; set; }

    [MaxLength(100)]
    public string? ContentType { get; set; }

    public long FileSize { get; set; }

    /// <summary>
    /// Storage provider (e.g., "local", "azure", "s3")
    /// </summary>
    [MaxLength(50)]
    public string StorageProvider { get; set; } = "local";

    /// <summary>
    /// Full path to the file in storage
    /// </summary>
    [Required]
    [MaxLength(500)]
    public string StoragePath { get; set; } = string.Empty;

    /// <summary>
    /// Folder/category for the asset (e.g., "avatars", "videos", "theme")
    /// </summary>
    [MaxLength(100)]
    public string Folder { get; set; } = string.Empty;

    /// <summary>
    /// The type of object this asset is associated with (e.g., "User", "ThemeSettings", "Material")
    /// </summary>
    [MaxLength(100)]
    public string? ObjectType { get; set; }

    /// <summary>
    /// The ID of the object this asset is associated with
    /// </summary>
    public int? ObjectId { get; set; }

    public int? UploadedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public bool IsDeleted { get; set; } = false;
}
