namespace Pickleball.Community.Models.DTOs;

// Club Grant Account DTOs
public class ClubGrantAccountDto
{
    public int Id { get; set; }
    public int ClubId { get; set; }
    public string ClubName { get; set; } = string.Empty;
    public string? ClubLogoUrl { get; set; }
    public int LeagueId { get; set; }
    public string LeagueName { get; set; } = string.Empty;
    public decimal CurrentBalance { get; set; }
    public decimal TotalCredits { get; set; }
    public decimal TotalDebits { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public int TransactionCount { get; set; }
    public DateTime? LastTransactionDate { get; set; }
}

public class ClubGrantAccountSummaryDto
{
    public int TotalAccounts { get; set; }
    public decimal TotalBalance { get; set; }
    public decimal TotalCreditsAllTime { get; set; }
    public decimal TotalDebitsAllTime { get; set; }
    public int ActiveAccountsCount { get; set; }
}

// Transaction DTOs
public class ClubGrantTransactionDto
{
    public int Id { get; set; }
    public int AccountId { get; set; }
    public int ClubId { get; set; }
    public string ClubName { get; set; } = string.Empty;
    public int LeagueId { get; set; }
    public string LeagueName { get; set; } = string.Empty;
    public string TransactionType { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal BalanceAfter { get; set; }
    public string Description { get; set; } = string.Empty;

    // Donation fields
    public string? DonorName { get; set; }
    public string? DonorEmail { get; set; }
    public string? DonorPhone { get; set; }
    public DateTime? DonationDate { get; set; }

    // Fee fields
    public string? FeeReason { get; set; }

    // Grant fields
    public string? GrantPurpose { get; set; }

    // Reference fields
    public string? ReferenceNumber { get; set; }
    public string? ExternalReferenceId { get; set; }

    // Audit fields
    public int ProcessedByUserId { get; set; }
    public string ProcessedByName { get; set; } = string.Empty;
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

    public List<GrantTransactionAttachmentDto> Attachments { get; set; } = new();
}

public class CreateTransactionDto
{
    public int ClubId { get; set; }
    public int LeagueId { get; set; }
    public string TransactionType { get; set; } = string.Empty; // Credit or Debit
    public string Category { get; set; } = string.Empty; // Donation, Grant, Fee, Adjustment, Refund
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;

    // Donation fields
    public string? DonorName { get; set; }
    public string? DonorEmail { get; set; }
    public string? DonorPhone { get; set; }
    public DateTime? DonationDate { get; set; }

    // Fee fields
    public string? FeeReason { get; set; }

    // Grant fields
    public string? GrantPurpose { get; set; }

    // Reference fields
    public string? ReferenceNumber { get; set; }
    public string? ExternalReferenceId { get; set; }

    public string? Notes { get; set; }
}

public class VoidTransactionDto
{
    public string Reason { get; set; } = string.Empty;
}

// Grant Manager DTOs
public class GrantManagerDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? UserEmail { get; set; }
    public string? UserProfileImageUrl { get; set; }
    public int? LeagueId { get; set; }
    public string? LeagueName { get; set; }
    public string Role { get; set; } = string.Empty;
    public bool CanRecordDonations { get; set; }
    public bool CanIssueFees { get; set; }
    public bool CanIssueGrants { get; set; }
    public bool CanVoidTransactions { get; set; }
    public bool CanManageManagers { get; set; }
    public bool IsActive { get; set; }
    public int CreatedByUserId { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class CreateGrantManagerDto
{
    public int UserId { get; set; }
    public int? LeagueId { get; set; }
    public string Role { get; set; } = "Manager";
    public bool CanRecordDonations { get; set; } = true;
    public bool CanIssueFees { get; set; } = false;
    public bool CanIssueGrants { get; set; } = false;
    public bool CanVoidTransactions { get; set; } = false;
    public bool CanManageManagers { get; set; } = false;
}

public class UpdateGrantManagerDto
{
    public string? Role { get; set; }
    public bool? CanRecordDonations { get; set; }
    public bool? CanIssueFees { get; set; }
    public bool? CanIssueGrants { get; set; }
    public bool? CanVoidTransactions { get; set; }
    public bool? CanManageManagers { get; set; }
    public bool? IsActive { get; set; }
}

// Attachment DTOs
public class GrantTransactionAttachmentDto
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

public class CreateAttachmentDto
{
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string? FileType { get; set; }
    public long? FileSize { get; set; }
    public string? Description { get; set; }
}

// Search/Filter DTOs
public class TransactionSearchRequest
{
    public int? LeagueId { get; set; }
    public int? ClubId { get; set; }
    public string? TransactionType { get; set; }
    public string? Category { get; set; }
    public DateTime? DateFrom { get; set; }
    public DateTime? DateTo { get; set; }
    public string? DonorName { get; set; }
    public bool? IncludeVoided { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

// Current user permissions
public class GrantPermissionsDto
{
    public bool IsGrantManager { get; set; }
    public bool IsSiteAdmin { get; set; }
    public bool CanRecordDonations { get; set; }
    public bool CanIssueFees { get; set; }
    public bool CanIssueGrants { get; set; }
    public bool CanVoidTransactions { get; set; }
    public bool CanManageManagers { get; set; }
    public List<int> AccessibleLeagueIds { get; set; } = new();
}
