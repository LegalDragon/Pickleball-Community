using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Defines the types of objects in the system that can have assets
/// </summary>
public class ObjectType
{
    public int Id { get; set; }

    /// <summary>
    /// Internal name (e.g., "Event", "Club", "Venue", "League", "User")
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Display name for UI
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>
    /// Database table name for reference
    /// </summary>
    [MaxLength(100)]
    public string? TableName { get; set; }

    /// <summary>
    /// URL template for viewing this object type (e.g., "/events/{id}")
    /// Use {id} as placeholder for the object ID
    /// </summary>
    [MaxLength(500)]
    public string? ViewUrl { get; set; }

    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<ObjectAssetType> AssetTypes { get; set; } = new List<ObjectAssetType>();
    public ICollection<ObjectAsset> Assets { get; set; } = new List<ObjectAsset>();
}

/// <summary>
/// Defines the types of assets allowed for each object type
/// </summary>
public class ObjectAssetType
{
    public int Id { get; set; }

    public int ObjectTypeId { get; set; }

    /// <summary>
    /// Internal type name (e.g., "waiver", "map", "logo", "banner")
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string TypeName { get; set; } = string.Empty;

    /// <summary>
    /// Display name for UI
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>
    /// Description of this asset type
    /// </summary>
    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Icon name for UI (e.g., "Shield", "Map", "FileText")
    /// </summary>
    [MaxLength(50)]
    public string? IconName { get; set; }

    /// <summary>
    /// CSS color class for UI styling
    /// </summary>
    [MaxLength(50)]
    public string? ColorClass { get; set; }

    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// System types cannot be deleted by admin
    /// </summary>
    public bool IsSystem { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("ObjectTypeId")]
    public ObjectType? ObjectType { get; set; }

    public ICollection<ObjectAsset> Assets { get; set; } = new List<ObjectAsset>();
}

/// <summary>
/// Stores assets (files) for any object in the system
/// </summary>
public class ObjectAsset
{
    public int Id { get; set; }

    public int ObjectTypeId { get; set; }
    public int ObjectAssetTypeId { get; set; }

    /// <summary>
    /// The ID of the specific object (event ID, club ID, venue ID, etc.)
    /// </summary>
    public int ObjectId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [MaxLength(2000)]
    public string FileUrl { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string FileName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? FileType { get; set; }

    public int? FileSize { get; set; }

    /// <summary>
    /// If true, asset is visible to all users.
    /// If false, only visible to owners/organizers and participants.
    /// </summary>
    public bool IsPublic { get; set; } = true;

    public int SortOrder { get; set; } = 0;

    public int UploadedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    [ForeignKey("ObjectTypeId")]
    public ObjectType? ObjectType { get; set; }

    [ForeignKey("ObjectAssetTypeId")]
    public ObjectAssetType? AssetType { get; set; }

    [ForeignKey("UploadedByUserId")]
    public User? UploadedBy { get; set; }
}
