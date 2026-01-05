using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class ClubGrantTransaction
{
    public int Id { get; set; }

    [Required]
    public int AccountId { get; set; }

    [Required]
    [MaxLength(20)]
    public string TransactionType { get; set; } = string.Empty; // Credit, Debit

    [Required]
    [MaxLength(50)]
    public string Category { get; set; } = string.Empty; // Donation, Grant, Fee, Adjustment, Refund

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal BalanceAfter { get; set; }

    [Required]
    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    // Donation-specific fields
    [MaxLength(200)]
    public string? DonorName { get; set; }

    [MaxLength(255)]
    public string? DonorEmail { get; set; }

    [MaxLength(50)]
    public string? DonorPhone { get; set; }

    public DateTime? DonationDate { get; set; }

    // Fee-specific fields
    [MaxLength(200)]
    public string? FeeReason { get; set; }

    // Grant-specific fields
    [MaxLength(500)]
    public string? GrantPurpose { get; set; }

    // Reference fields
    [MaxLength(100)]
    public string? ReferenceNumber { get; set; }

    [MaxLength(100)]
    public string? ExternalReferenceId { get; set; }

    // Audit fields
    [Required]
    public int ProcessedByUserId { get; set; }

    public int? ApprovedByUserId { get; set; }

    public string? Notes { get; set; }

    public bool IsVoided { get; set; } = false;

    public int? VoidedByUserId { get; set; }

    public DateTime? VoidedAt { get; set; }

    [MaxLength(500)]
    public string? VoidReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ClubGrantAccount? Account { get; set; }
    public User? ProcessedBy { get; set; }
    public User? ApprovedBy { get; set; }
    public User? VoidedBy { get; set; }
    public ICollection<GrantTransactionAttachment> Attachments { get; set; } = new List<GrantTransactionAttachment>();
}
