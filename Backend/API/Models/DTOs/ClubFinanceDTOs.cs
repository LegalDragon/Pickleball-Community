namespace Pickleball.Community.Models.DTOs;

// Club Finance Account DTOs
public class ClubFinanceAccountDto
{
    public int Id { get; set; }
    public int ClubId { get; set; }
    public string ClubName { get; set; } = string.Empty;
    public decimal CurrentBalance { get; set; }
    public decimal TotalIncome { get; set; }
    public decimal TotalExpenses { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public int TransactionCount { get; set; }
    public DateTime? LastTransactionDate { get; set; }
}

public class ClubFinanceSummaryDto
{
    public decimal CurrentBalance { get; set; }
    public decimal TotalIncome { get; set; }
    public decimal TotalExpenses { get; set; }
    public int TransactionCount { get; set; }
    public decimal IncomeThisMonth { get; set; }
    public decimal ExpensesThisMonth { get; set; }
    public Dictionary<string, decimal> IncomeByCategory { get; set; } = new();
    public Dictionary<string, decimal> ExpensesByCategory { get; set; } = new();
}

// Transaction DTOs
public class ClubFinanceTransactionDto
{
    public int Id { get; set; }
    public int AccountId { get; set; }
    public int ClubId { get; set; }
    public string TransactionType { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal BalanceAfter { get; set; }
    public string Description { get; set; } = string.Empty;

    // Member payment fields
    public int? MemberId { get; set; }
    public int? MemberUserId { get; set; }
    public string? MemberName { get; set; }
    public string? PaymentMethod { get; set; }
    public string? PaymentReference { get; set; }

    // Expense fields
    public string? Vendor { get; set; }
    public DateTime? ExpenseDate { get; set; }

    // Period tracking
    public DateTime? PeriodStart { get; set; }
    public DateTime? PeriodEnd { get; set; }

    // Reference fields
    public string? ReferenceNumber { get; set; }
    public string? ExternalReferenceId { get; set; }

    // Audit fields
    public int RecordedByUserId { get; set; }
    public string RecordedByName { get; set; } = string.Empty;
    public int? ApprovedByUserId { get; set; }
    public string? ApprovedByName { get; set; }
    public string? Notes { get; set; }

    // Void info
    public bool IsVoided { get; set; }
    public int? VoidedByUserId { get; set; }
    public string? VoidedByName { get; set; }
    public DateTime? VoidedAt { get; set; }
    public string? VoidReason { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<ClubFinanceAttachmentDto> Attachments { get; set; } = new();
}

public class CreateClubFinanceTransactionDto
{
    public string TransactionType { get; set; } = string.Empty; // Income or Expense
    public string Category { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;

    // Member payment fields
    public int? MemberId { get; set; }
    public int? MemberUserId { get; set; }
    public string? PaymentMethod { get; set; }
    public string? PaymentReference { get; set; }

    // Expense fields
    public string? Vendor { get; set; }
    public DateTime? ExpenseDate { get; set; }

    // Period tracking
    public DateTime? PeriodStart { get; set; }
    public DateTime? PeriodEnd { get; set; }

    // Reference fields
    public string? ReferenceNumber { get; set; }
    public string? ExternalReferenceId { get; set; }

    public string? Notes { get; set; }
}

public class UpdateClubFinanceTransactionDto
{
    public string? Description { get; set; }
    public string? PaymentMethod { get; set; }
    public string? PaymentReference { get; set; }
    public string? Vendor { get; set; }
    public DateTime? ExpenseDate { get; set; }
    public DateTime? PeriodStart { get; set; }
    public DateTime? PeriodEnd { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }
}

public class VoidClubFinanceTransactionDto
{
    public string Reason { get; set; } = string.Empty;
}

// Attachment DTOs
public class ClubFinanceAttachmentDto
{
    public int Id { get; set; }
    public int TransactionId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string? FileType { get; set; }
    public long? FileSize { get; set; }
    public string? Description { get; set; }
    public int UploadedByUserId { get; set; }
    public string UploadedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class CreateClubFinanceAttachmentDto
{
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string? FileType { get; set; }
    public long? FileSize { get; set; }
    public string? Description { get; set; }
}

// Search/Filter DTOs
public class ClubFinanceTransactionSearchRequest
{
    public string? TransactionType { get; set; }
    public string? Category { get; set; }
    public int? MemberUserId { get; set; }
    public DateTime? DateFrom { get; set; }
    public DateTime? DateTo { get; set; }
    public bool? IncludeVoided { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

// Permissions DTO
public class ClubFinancePermissionsDto
{
    public bool CanView { get; set; }
    public bool CanEdit { get; set; }
    public bool CanVoid { get; set; }
    public string Role { get; set; } = string.Empty;
}

// Member payment summary (for dues tracking)
public class MemberPaymentSummaryDto
{
    public int MemberUserId { get; set; }
    public string MemberName { get; set; } = string.Empty;
    public string? MemberEmail { get; set; }
    public decimal TotalPaid { get; set; }
    public DateTime? LastPaymentDate { get; set; }
    public DateTime? PaidThrough { get; set; } // Latest PeriodEnd date
    public int PaymentCount { get; set; }
}

// Paginated response wrapper
public class ClubFinanceTransactionPagedResponse
{
    public List<ClubFinanceTransactionDto> Transactions { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
}
