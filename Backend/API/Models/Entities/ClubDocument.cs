using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Documents uploaded by club admins for club members
/// </summary>
public class ClubDocument
{
    public int Id { get; set; }

    public int ClubId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    /// <summary>
    /// URL to the document in shared assets
    /// </summary>
    [Required]
    [MaxLength(500)]
    public string FileUrl { get; set; } = string.Empty;

    /// <summary>
    /// Original filename
    /// </summary>
    [MaxLength(255)]
    public string? FileName { get; set; }

    /// <summary>
    /// File type: Image, PDF, Document, Video, Other
    /// </summary>
    [MaxLength(20)]
    public string FileType { get; set; } = "Other";

    /// <summary>
    /// MIME type of the file
    /// </summary>
    [MaxLength(100)]
    public string? MimeType { get; set; }

    /// <summary>
    /// File size in bytes
    /// </summary>
    public long? FileSizeBytes { get; set; }

    /// <summary>
    /// Visibility level: Public, Member, Admin
    /// Public = anyone can view
    /// Member = club members only
    /// Admin = club admins only
    /// </summary>
    [MaxLength(20)]
    public string Visibility { get; set; } = "Member";

    public int SortOrder { get; set; } = 0;

    public int UploadedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
    public bool IsActive { get; set; } = true;

    // Navigation
    [ForeignKey("ClubId")]
    public Club? Club { get; set; }

    [ForeignKey("UploadedByUserId")]
    public User? UploadedBy { get; set; }
}
