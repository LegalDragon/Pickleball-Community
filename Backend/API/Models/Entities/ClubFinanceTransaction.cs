using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class ClubFinanceTransaction
{
    public int Id { get; set; }

    [Required]
    public int AccountId { get; set; }

    [Required]
    [MaxLength(20)]
    public string TransactionType { get; set; } = string.Empty; // 'Income' or 'Expense'

    [Required]
    [MaxLength(50)]
    public string Category { get; set; } = string.Empty; // MembershipDue, EventFee, Equipment, Venue, etc.

    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal BalanceAfter { get; set; }

    [Required]
    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    // Member payment fields
    public int? MemberId { get; set; } // ClubMembers.Id if payment from a member
    public int? MemberUserId { get; set; } // The user who made the payment

    [MaxLength(50)]
    public string? PaymentMethod { get; set; } // Cash, Check, Card, Venmo, Zelle, Other

    [MaxLength(100)]
    public string? PaymentReference { get; set; } // Check number, transaction ID, etc.

    // Expense fields
    [MaxLength(200)]
    public string? Vendor { get; set; }

    public DateTime? ExpenseDate { get; set; }

    // Period tracking (e.g., for membership dues)
    public DateTime? PeriodStart { get; set; }
    public DateTime? PeriodEnd { get; set; }

    // Reference fields
    [MaxLength(100)]
    public string? ReferenceNumber { get; set; }

    [MaxLength(100)]
    public string? ExternalReferenceId { get; set; }

    // Audit fields
    [Required]
    public int RecordedByUserId { get; set; }

    public int? ApprovedByUserId { get; set; }

    public string? Notes { get; set; }

    public bool IsVoided { get; set; } = false;
    public int? VoidedByUserId { get; set; }
    public DateTime? VoidedAt { get; set; }

    [MaxLength(500)]
    public string? VoidReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation properties
    public ClubFinanceAccount? Account { get; set; }
    public ClubMember? Member { get; set; }
    public User? MemberUser { get; set; }
    public User? RecordedBy { get; set; }
    public User? ApprovedBy { get; set; }
    public User? VoidedBy { get; set; }
    public ICollection<ClubFinanceTransactionAttachment> Attachments { get; set; } = new List<ClubFinanceTransactionAttachment>();
}
