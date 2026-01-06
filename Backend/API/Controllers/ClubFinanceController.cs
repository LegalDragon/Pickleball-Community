using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;
using System.Security.Claims;

namespace Pickleball.Community.Controllers;

[ApiController]
[Route("clubs/{clubId}/finance")]
public class ClubFinanceController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ClubFinanceController> _logger;

    public ClubFinanceController(ApplicationDbContext context, ILogger<ClubFinanceController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private async Task<(bool isMember, bool canEdit, string? role)> GetClubPermissions(int clubId, int userId)
    {
        var membership = await _context.ClubMembers
            .Where(m => m.ClubId == clubId && m.UserId == userId && m.IsActive)
            .Select(m => new { m.Role })
            .FirstOrDefaultAsync();

        if (membership == null)
            return (false, false, null);

        // Admin and Treasurer can edit
        var canEdit = membership.Role == "Admin" || membership.Role == "Treasurer";
        return (true, canEdit, membership.Role);
    }

    // GET: /clubs/{clubId}/finance/permissions
    [HttpGet("permissions")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ClubFinancePermissionsDto>>> GetPermissions(int clubId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<ClubFinancePermissionsDto> { Success = false, Message = "Unauthorized" });

        var (isMember, canEdit, role) = await GetClubPermissions(clubId, userId.Value);

        return Ok(new ApiResponse<ClubFinancePermissionsDto>
        {
            Success = true,
            Data = new ClubFinancePermissionsDto
            {
                CanView = isMember,
                CanEdit = canEdit,
                CanVoid = canEdit,
                Role = role ?? ""
            }
        });
    }

    // GET: /clubs/{clubId}/finance/account
    [HttpGet("account")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ClubFinanceAccountDto>>> GetAccount(int clubId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<ClubFinanceAccountDto> { Success = false, Message = "Unauthorized" });

        var (isMember, _, _) = await GetClubPermissions(clubId, userId.Value);
        if (!isMember)
            return Forbid();

        var account = await _context.ClubFinanceAccounts
            .Include(a => a.Club)
            .Where(a => a.ClubId == clubId)
            .Select(a => new ClubFinanceAccountDto
            {
                Id = a.Id,
                ClubId = a.ClubId,
                ClubName = a.Club != null ? a.Club.Name : "",
                CurrentBalance = a.CurrentBalance,
                TotalIncome = a.TotalIncome,
                TotalExpenses = a.TotalExpenses,
                Notes = a.Notes,
                IsActive = a.IsActive,
                CreatedAt = a.CreatedAt,
                UpdatedAt = a.UpdatedAt,
                TransactionCount = a.Transactions.Count(t => !t.IsVoided),
                LastTransactionDate = a.Transactions.Where(t => !t.IsVoided).Max(t => (DateTime?)t.CreatedAt)
            })
            .FirstOrDefaultAsync();

        // Create account if it doesn't exist
        if (account == null)
        {
            var club = await _context.Clubs.FindAsync(clubId);
            if (club == null)
                return NotFound(new ApiResponse<ClubFinanceAccountDto> { Success = false, Message = "Club not found" });

            var newAccount = new ClubFinanceAccount
            {
                ClubId = clubId,
                CurrentBalance = 0,
                TotalIncome = 0,
                TotalExpenses = 0,
                IsActive = true
            };
            _context.ClubFinanceAccounts.Add(newAccount);
            await _context.SaveChangesAsync();

            account = new ClubFinanceAccountDto
            {
                Id = newAccount.Id,
                ClubId = clubId,
                ClubName = club.Name,
                CurrentBalance = 0,
                TotalIncome = 0,
                TotalExpenses = 0,
                IsActive = true,
                CreatedAt = newAccount.CreatedAt,
                UpdatedAt = newAccount.UpdatedAt,
                TransactionCount = 0
            };
        }

        return Ok(new ApiResponse<ClubFinanceAccountDto> { Success = true, Data = account });
    }

    // GET: /clubs/{clubId}/finance/summary
    [HttpGet("summary")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ClubFinanceSummaryDto>>> GetSummary(int clubId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<ClubFinanceSummaryDto> { Success = false, Message = "Unauthorized" });

        var (isMember, _, _) = await GetClubPermissions(clubId, userId.Value);
        if (!isMember)
            return Forbid();

        var account = await _context.ClubFinanceAccounts
            .Where(a => a.ClubId == clubId)
            .FirstOrDefaultAsync();

        if (account == null)
        {
            return Ok(new ApiResponse<ClubFinanceSummaryDto>
            {
                Success = true,
                Data = new ClubFinanceSummaryDto()
            });
        }

        var startOfMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);

        var transactions = await _context.ClubFinanceTransactions
            .Where(t => t.AccountId == account.Id && !t.IsVoided)
            .ToListAsync();

        var thisMonthTransactions = transactions.Where(t => t.CreatedAt >= startOfMonth).ToList();

        var summary = new ClubFinanceSummaryDto
        {
            CurrentBalance = account.CurrentBalance,
            TotalIncome = account.TotalIncome,
            TotalExpenses = account.TotalExpenses,
            TransactionCount = transactions.Count,
            IncomeThisMonth = thisMonthTransactions.Where(t => t.TransactionType == "Income").Sum(t => t.Amount),
            ExpensesThisMonth = thisMonthTransactions.Where(t => t.TransactionType == "Expense").Sum(t => t.Amount),
            IncomeByCategory = transactions
                .Where(t => t.TransactionType == "Income")
                .GroupBy(t => t.Category)
                .ToDictionary(g => g.Key, g => g.Sum(t => t.Amount)),
            ExpensesByCategory = transactions
                .Where(t => t.TransactionType == "Expense")
                .GroupBy(t => t.Category)
                .ToDictionary(g => g.Key, g => g.Sum(t => t.Amount))
        };

        return Ok(new ApiResponse<ClubFinanceSummaryDto> { Success = true, Data = summary });
    }

    // GET: /clubs/{clubId}/finance/transactions
    [HttpGet("transactions")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ClubFinanceTransactionPagedResponse>>> GetTransactions(
        int clubId,
        [FromQuery] ClubFinanceTransactionSearchRequest? request = null)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<ClubFinanceTransactionPagedResponse> { Success = false, Message = "Unauthorized" });

        var (isMember, _, _) = await GetClubPermissions(clubId, userId.Value);
        if (!isMember)
            return Forbid();

        var account = await _context.ClubFinanceAccounts
            .Where(a => a.ClubId == clubId)
            .FirstOrDefaultAsync();

        if (account == null)
        {
            return Ok(new ApiResponse<List<ClubFinanceTransactionDto>>
            {
                Success = true,
                Data = new List<ClubFinanceTransactionDto>()
            });
        }

        request ??= new ClubFinanceTransactionSearchRequest();

        var query = _context.ClubFinanceTransactions
            .Include(t => t.RecordedBy)
            .Include(t => t.ApprovedBy)
            .Include(t => t.VoidedBy)
            .Include(t => t.MemberUser)
            .Include(t => t.Attachments).ThenInclude(a => a.UploadedBy)
            .Where(t => t.AccountId == account.Id)
            .AsQueryable();

        if (!request.IncludeVoided.GetValueOrDefault(false))
            query = query.Where(t => !t.IsVoided);

        if (!string.IsNullOrEmpty(request.TransactionType))
            query = query.Where(t => t.TransactionType == request.TransactionType);

        if (!string.IsNullOrEmpty(request.Category))
            query = query.Where(t => t.Category == request.Category);

        if (request.MemberUserId.HasValue)
            query = query.Where(t => t.MemberUserId == request.MemberUserId);

        if (request.DateFrom.HasValue)
            query = query.Where(t => t.CreatedAt >= request.DateFrom.Value);

        if (request.DateTo.HasValue)
            query = query.Where(t => t.CreatedAt <= request.DateTo.Value.AddDays(1));

        var totalCount = await query.CountAsync();

        var transactions = await query
            .OrderByDescending(t => t.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(t => new ClubFinanceTransactionDto
            {
                Id = t.Id,
                AccountId = t.AccountId,
                ClubId = clubId,
                TransactionType = t.TransactionType,
                Category = t.Category,
                Amount = t.Amount,
                BalanceAfter = t.BalanceAfter,
                Description = t.Description,
                MemberId = t.MemberId,
                MemberUserId = t.MemberUserId,
                MemberName = t.MemberUser != null ? $"{t.MemberUser.FirstName} {t.MemberUser.LastName}".Trim() : null,
                PaymentMethod = t.PaymentMethod,
                PaymentReference = t.PaymentReference,
                Vendor = t.Vendor,
                ExpenseDate = t.ExpenseDate,
                PeriodStart = t.PeriodStart,
                PeriodEnd = t.PeriodEnd,
                ReferenceNumber = t.ReferenceNumber,
                ExternalReferenceId = t.ExternalReferenceId,
                RecordedByUserId = t.RecordedByUserId,
                RecordedByName = t.RecordedBy != null ? $"{t.RecordedBy.FirstName} {t.RecordedBy.LastName}".Trim() : "",
                ApprovedByUserId = t.ApprovedByUserId,
                ApprovedByName = t.ApprovedBy != null ? $"{t.ApprovedBy.FirstName} {t.ApprovedBy.LastName}".Trim() : null,
                Notes = t.Notes,
                IsVoided = t.IsVoided,
                VoidedByUserId = t.VoidedByUserId,
                VoidedByName = t.VoidedBy != null ? $"{t.VoidedBy.FirstName} {t.VoidedBy.LastName}".Trim() : null,
                VoidedAt = t.VoidedAt,
                VoidReason = t.VoidReason,
                CreatedAt = t.CreatedAt,
                UpdatedAt = t.UpdatedAt,
                Attachments = t.Attachments.Select(a => new ClubFinanceAttachmentDto
                {
                    Id = a.Id,
                    TransactionId = a.TransactionId,
                    FileName = a.FileName,
                    FileUrl = a.FileUrl,
                    FileType = a.FileType,
                    FileSize = a.FileSize,
                    Description = a.Description,
                    UploadedByUserId = a.UploadedByUserId,
                    UploadedByName = a.UploadedBy != null ? $"{a.UploadedBy.FirstName} {a.UploadedBy.LastName}".Trim() : "",
                    CreatedAt = a.CreatedAt
                }).ToList()
            })
            .ToListAsync();

        return Ok(new ApiResponse<ClubFinanceTransactionPagedResponse>
        {
            Success = true,
            Data = new ClubFinanceTransactionPagedResponse
            {
                Transactions = transactions,
                TotalCount = totalCount,
                Page = request.Page,
                PageSize = request.PageSize
            }
        });
    }

    // POST: /clubs/{clubId}/finance/transactions
    [HttpPost("transactions")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ClubFinanceTransactionDto>>> CreateTransaction(
        int clubId,
        [FromBody] CreateClubFinanceTransactionDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<ClubFinanceTransactionDto> { Success = false, Message = "Unauthorized" });

        var (isMember, canEdit, _) = await GetClubPermissions(clubId, userId.Value);
        if (!isMember)
            return Forbid();
        if (!canEdit)
            return Forbid();

        // Validate transaction type
        if (dto.TransactionType != "Income" && dto.TransactionType != "Expense")
            return BadRequest(new ApiResponse<ClubFinanceTransactionDto> { Success = false, Message = "Invalid transaction type" });

        // Get or create account
        var account = await _context.ClubFinanceAccounts
            .Where(a => a.ClubId == clubId)
            .FirstOrDefaultAsync();

        if (account == null)
        {
            account = new ClubFinanceAccount
            {
                ClubId = clubId,
                CurrentBalance = 0,
                TotalIncome = 0,
                TotalExpenses = 0,
                IsActive = true
            };
            _context.ClubFinanceAccounts.Add(account);
            await _context.SaveChangesAsync();
        }

        // Calculate new balance
        decimal newBalance;
        if (dto.TransactionType == "Income")
        {
            newBalance = account.CurrentBalance + dto.Amount;
            account.CurrentBalance = newBalance;
            account.TotalIncome += dto.Amount;
        }
        else
        {
            newBalance = account.CurrentBalance - dto.Amount;
            account.CurrentBalance = newBalance;
            account.TotalExpenses += dto.Amount;
        }
        account.UpdatedAt = DateTime.UtcNow;

        var transaction = new ClubFinanceTransaction
        {
            AccountId = account.Id,
            TransactionType = dto.TransactionType,
            Category = dto.Category,
            Amount = dto.Amount,
            BalanceAfter = newBalance,
            Description = dto.Description,
            MemberId = dto.MemberId,
            MemberUserId = dto.MemberUserId,
            PaymentMethod = dto.PaymentMethod,
            PaymentReference = dto.PaymentReference,
            Vendor = dto.Vendor,
            ExpenseDate = dto.ExpenseDate,
            PeriodStart = dto.PeriodStart,
            PeriodEnd = dto.PeriodEnd,
            ReferenceNumber = dto.ReferenceNumber,
            ExternalReferenceId = dto.ExternalReferenceId,
            RecordedByUserId = userId.Value,
            Notes = dto.Notes
        };

        _context.ClubFinanceTransactions.Add(transaction);
        await _context.SaveChangesAsync();

        // Reload with navigation properties
        var user = await _context.Users.FindAsync(userId.Value);

        return Ok(new ApiResponse<ClubFinanceTransactionDto>
        {
            Success = true,
            Data = new ClubFinanceTransactionDto
            {
                Id = transaction.Id,
                AccountId = transaction.AccountId,
                ClubId = clubId,
                TransactionType = transaction.TransactionType,
                Category = transaction.Category,
                Amount = transaction.Amount,
                BalanceAfter = transaction.BalanceAfter,
                Description = transaction.Description,
                MemberId = transaction.MemberId,
                MemberUserId = transaction.MemberUserId,
                PaymentMethod = transaction.PaymentMethod,
                PaymentReference = transaction.PaymentReference,
                Vendor = transaction.Vendor,
                ExpenseDate = transaction.ExpenseDate,
                PeriodStart = transaction.PeriodStart,
                PeriodEnd = transaction.PeriodEnd,
                ReferenceNumber = transaction.ReferenceNumber,
                ExternalReferenceId = transaction.ExternalReferenceId,
                RecordedByUserId = transaction.RecordedByUserId,
                RecordedByName = user != null ? $"{user.FirstName} {user.LastName}".Trim() : "",
                Notes = transaction.Notes,
                CreatedAt = transaction.CreatedAt,
                UpdatedAt = transaction.UpdatedAt,
                Attachments = new List<ClubFinanceAttachmentDto>()
            }
        });
    }

    // PUT: /clubs/{clubId}/finance/transactions/{id}
    [HttpPut("transactions/{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ClubFinanceTransactionDto>>> UpdateTransaction(
        int clubId,
        int id,
        [FromBody] UpdateClubFinanceTransactionDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<ClubFinanceTransactionDto> { Success = false, Message = "Unauthorized" });

        var (isMember, canEdit, _) = await GetClubPermissions(clubId, userId.Value);
        if (!isMember)
            return Forbid();
        if (!canEdit)
            return Forbid();

        var transaction = await _context.ClubFinanceTransactions
            .Include(t => t.Account)
            .Include(t => t.RecordedBy)
            .Where(t => t.Id == id && t.Account != null && t.Account.ClubId == clubId)
            .FirstOrDefaultAsync();

        if (transaction == null)
            return NotFound(new ApiResponse<ClubFinanceTransactionDto> { Success = false, Message = "Transaction not found" });

        if (transaction.IsVoided)
            return BadRequest(new ApiResponse<ClubFinanceTransactionDto> { Success = false, Message = "Cannot update voided transaction" });

        // Update editable fields (not amount or type - those require voiding)
        if (dto.Description != null) transaction.Description = dto.Description;
        if (dto.PaymentMethod != null) transaction.PaymentMethod = dto.PaymentMethod;
        if (dto.PaymentReference != null) transaction.PaymentReference = dto.PaymentReference;
        if (dto.Vendor != null) transaction.Vendor = dto.Vendor;
        if (dto.ExpenseDate.HasValue) transaction.ExpenseDate = dto.ExpenseDate;
        if (dto.PeriodStart.HasValue) transaction.PeriodStart = dto.PeriodStart;
        if (dto.PeriodEnd.HasValue) transaction.PeriodEnd = dto.PeriodEnd;
        if (dto.ReferenceNumber != null) transaction.ReferenceNumber = dto.ReferenceNumber;
        if (dto.Notes != null) transaction.Notes = dto.Notes;
        transaction.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<ClubFinanceTransactionDto>
        {
            Success = true,
            Data = new ClubFinanceTransactionDto
            {
                Id = transaction.Id,
                AccountId = transaction.AccountId,
                ClubId = clubId,
                TransactionType = transaction.TransactionType,
                Category = transaction.Category,
                Amount = transaction.Amount,
                BalanceAfter = transaction.BalanceAfter,
                Description = transaction.Description,
                RecordedByUserId = transaction.RecordedByUserId,
                RecordedByName = transaction.RecordedBy != null ? $"{transaction.RecordedBy.FirstName} {transaction.RecordedBy.LastName}".Trim() : "",
                CreatedAt = transaction.CreatedAt,
                UpdatedAt = transaction.UpdatedAt
            }
        });
    }

    // POST: /clubs/{clubId}/finance/transactions/{id}/void
    [HttpPost("transactions/{id}/void")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> VoidTransaction(
        int clubId,
        int id,
        [FromBody] VoidClubFinanceTransactionDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        var (isMember, canEdit, _) = await GetClubPermissions(clubId, userId.Value);
        if (!isMember)
            return Forbid();
        if (!canEdit)
            return Forbid();

        var transaction = await _context.ClubFinanceTransactions
            .Include(t => t.Account)
            .Where(t => t.Id == id && t.Account != null && t.Account.ClubId == clubId)
            .FirstOrDefaultAsync();

        if (transaction == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Transaction not found" });

        if (transaction.IsVoided)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Transaction already voided" });

        // Reverse the transaction effect
        var account = transaction.Account!;
        if (transaction.TransactionType == "Income")
        {
            account.CurrentBalance -= transaction.Amount;
            account.TotalIncome -= transaction.Amount;
        }
        else
        {
            account.CurrentBalance += transaction.Amount;
            account.TotalExpenses -= transaction.Amount;
        }
        account.UpdatedAt = DateTime.UtcNow;

        transaction.IsVoided = true;
        transaction.VoidedByUserId = userId.Value;
        transaction.VoidedAt = DateTime.UtcNow;
        transaction.VoidReason = dto.Reason;
        transaction.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object> { Success = true, Message = "Transaction voided successfully" });
    }

    // POST: /clubs/{clubId}/finance/transactions/{id}/attachments
    [HttpPost("transactions/{id}/attachments")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ClubFinanceAttachmentDto>>> AddAttachment(
        int clubId,
        int id,
        [FromBody] CreateClubFinanceAttachmentDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<ClubFinanceAttachmentDto> { Success = false, Message = "Unauthorized" });

        var (isMember, canEdit, _) = await GetClubPermissions(clubId, userId.Value);
        if (!isMember)
            return Forbid();
        if (!canEdit)
            return Forbid();

        var transaction = await _context.ClubFinanceTransactions
            .Include(t => t.Account)
            .Where(t => t.Id == id && t.Account != null && t.Account.ClubId == clubId)
            .FirstOrDefaultAsync();

        if (transaction == null)
            return NotFound(new ApiResponse<ClubFinanceAttachmentDto> { Success = false, Message = "Transaction not found" });

        var attachment = new ClubFinanceTransactionAttachment
        {
            TransactionId = id,
            FileName = dto.FileName,
            FileUrl = dto.FileUrl,
            FileType = dto.FileType,
            FileSize = dto.FileSize,
            Description = dto.Description,
            UploadedByUserId = userId.Value
        };

        _context.ClubFinanceTransactionAttachments.Add(attachment);
        await _context.SaveChangesAsync();

        var user = await _context.Users.FindAsync(userId.Value);

        return Ok(new ApiResponse<ClubFinanceAttachmentDto>
        {
            Success = true,
            Data = new ClubFinanceAttachmentDto
            {
                Id = attachment.Id,
                TransactionId = attachment.TransactionId,
                FileName = attachment.FileName,
                FileUrl = attachment.FileUrl,
                FileType = attachment.FileType,
                FileSize = attachment.FileSize,
                Description = attachment.Description,
                UploadedByUserId = attachment.UploadedByUserId,
                UploadedByName = user != null ? $"{user.FirstName} {user.LastName}".Trim() : "",
                CreatedAt = attachment.CreatedAt
            }
        });
    }

    // DELETE: /clubs/{clubId}/finance/transactions/{transactionId}/attachments/{attachmentId}
    [HttpDelete("transactions/{transactionId}/attachments/{attachmentId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> DeleteAttachment(
        int clubId,
        int transactionId,
        int attachmentId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Unauthorized" });

        var (isMember, canEdit, _) = await GetClubPermissions(clubId, userId.Value);
        if (!isMember)
            return Forbid();
        if (!canEdit)
            return Forbid();

        var attachment = await _context.ClubFinanceTransactionAttachments
            .Include(a => a.Transaction)
            .ThenInclude(t => t!.Account)
            .Where(a => a.Id == attachmentId &&
                       a.TransactionId == transactionId &&
                       a.Transaction != null &&
                       a.Transaction.Account != null &&
                       a.Transaction.Account.ClubId == clubId)
            .FirstOrDefaultAsync();

        if (attachment == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Attachment not found" });

        _context.ClubFinanceTransactionAttachments.Remove(attachment);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object> { Success = true, Message = "Attachment deleted" });
    }

    // GET: /clubs/{clubId}/finance/member-payments
    [HttpGet("member-payments")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<MemberPaymentSummaryDto>>>> GetMemberPayments(int clubId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<List<MemberPaymentSummaryDto>> { Success = false, Message = "Unauthorized" });

        var (isMember, _, _) = await GetClubPermissions(clubId, userId.Value);
        if (!isMember)
            return Forbid();

        var account = await _context.ClubFinanceAccounts
            .Where(a => a.ClubId == clubId)
            .FirstOrDefaultAsync();

        if (account == null)
        {
            return Ok(new ApiResponse<List<MemberPaymentSummaryDto>>
            {
                Success = true,
                Data = new List<MemberPaymentSummaryDto>()
            });
        }

        // Get all member payments
        var memberPayments = await _context.ClubFinanceTransactions
            .Include(t => t.MemberUser)
            .Where(t => t.AccountId == account.Id &&
                       t.TransactionType == "Income" &&
                       t.MemberUserId.HasValue &&
                       !t.IsVoided)
            .GroupBy(t => t.MemberUserId!.Value)
            .Select(g => new MemberPaymentSummaryDto
            {
                MemberUserId = g.Key,
                MemberName = g.First().MemberUser != null ? $"{g.First().MemberUser!.FirstName} {g.First().MemberUser.LastName}".Trim() : "",
                MemberEmail = g.First().MemberUser != null ? g.First().MemberUser!.Email : null,
                TotalPaid = g.Sum(t => t.Amount),
                LastPaymentDate = g.Max(t => t.CreatedAt),
                PaidThrough = g.Max(t => t.PeriodEnd),
                PaymentCount = g.Count()
            })
            .OrderByDescending(m => m.LastPaymentDate)
            .ToListAsync();

        return Ok(new ApiResponse<List<MemberPaymentSummaryDto>>
        {
            Success = true,
            Data = memberPayments
        });
    }

    // GET: /clubs/{clubId}/finance/members - Get club members for dropdown
    [HttpGet("members")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetMembers(int clubId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<List<object>> { Success = false, Message = "Unauthorized" });

        var (isMember, canEdit, _) = await GetClubPermissions(clubId, userId.Value);
        if (!isMember)
            return Forbid();
        if (!canEdit)
            return Forbid();

        var members = await _context.ClubMembers
            .Include(m => m.User)
            .Where(m => m.ClubId == clubId && m.IsActive)
            .Select(m => new
            {
                MemberId = m.Id,
                UserId = m.UserId,
                Name = m.User != null ? $"{m.User.FirstName} {m.User.LastName}".Trim() : "",
                Email = m.User != null ? m.User.Email : null,
                Role = m.Role
            })
            .OrderBy(m => m.Name)
            .ToListAsync();

        return Ok(new ApiResponse<List<object>> { Success = true, Data = members.Cast<object>().ToList() });
    }
}
