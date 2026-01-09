using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class GrantTransactionAttachment
{
    public int Id { get; set; }

    [Required]
    public int TransactionId { get; set; }

    [Required]
    [MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    [Required]
    [MaxLength(500)]
    public string FileUrl { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? FileType { get; set; }

    public long? FileSize { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    [Required]
    public int UploadedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation properties
    [ForeignKey("TransactionId")]
    public ClubGrantTransaction? Transaction { get; set; }

    [ForeignKey("UploadedByUserId")]
    public User? UploadedBy { get; set; }
}
