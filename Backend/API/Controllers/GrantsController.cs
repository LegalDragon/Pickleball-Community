using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;
using System.Security.Claims;

namespace Pickleball.Community.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class GrantsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<GrantsController> _logger;

    public GrantsController(ApplicationDbContext context, ILogger<GrantsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private async Task<bool> IsSiteAdminAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        return user?.Role == "Admin";
    }

    private async Task<GrantManager?> GetGrantManagerAsync(int userId)
    {
        return await _context.GrantManagers
            .FirstOrDefaultAsync(gm => gm.UserId == userId && gm.IsActive);
    }

    private async Task<GrantPermissionsDto> GetUserPermissionsAsync(int userId)
    {
        var isSiteAdmin = await IsSiteAdminAsync(userId);
        var grantManager = await GetGrantManagerAsync(userId);

        var permissions = new GrantPermissionsDto
        {
            IsSiteAdmin = isSiteAdmin,
            IsGrantManager = grantManager != null || isSiteAdmin,
            CanRecordDonations = isSiteAdmin || (grantManager?.CanRecordDonations ?? false),
            CanIssueFees = isSiteAdmin || (grantManager?.CanIssueFees ?? false),
            CanIssueGrants = isSiteAdmin || (grantManager?.CanIssueGrants ?? false),
            CanVoidTransactions = isSiteAdmin || (grantManager?.CanVoidTransactions ?? false),
            CanManageManagers = isSiteAdmin || (grantManager?.CanManageManagers ?? false)
        };

        if (isSiteAdmin)
        {
            permissions.AccessibleLeagueIds = await _context.Leagues
                .Where(l => l.IsActive)
                .Select(l => l.Id)
                .ToListAsync();
        }
        else if (grantManager != null)
        {
            if (grantManager.LeagueId.HasValue)
            {
                permissions.AccessibleLeagueIds = new List<int> { grantManager.LeagueId.Value };
            }
            else
            {
                // Site-wide grant manager
                permissions.AccessibleLeagueIds = await _context.Leagues
                    .Where(l => l.IsActive)
                    .Select(l => l.Id)
                    .ToListAsync();
            }
        }

        return permissions;
    }

    // GET: /grants/permissions - Get current user's permissions
    [HttpGet("permissions")]
    public async Task<ActionResult<ApiResponse<GrantPermissionsDto>>> GetPermissions()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<GrantPermissionsDto> { Success = false, Message = "User not authenticated" });

            var permissions = await GetUserPermissionsAsync(userId.Value);
            return Ok(new ApiResponse<GrantPermissionsDto> { Success = true, Data = permissions });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting grant permissions");
            return StatusCode(500, new ApiResponse<GrantPermissionsDto> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /grants/accounts - Get all club grant accounts
    [HttpGet("accounts")]
    public async Task<ActionResult<ApiResponse<List<ClubGrantAccountDto>>>> GetAccounts([FromQuery] int? leagueId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<ClubGrantAccountDto>> { Success = false, Message = "User not authenticated" });

            var permissions = await GetUserPermissionsAsync(userId.Value);
            if (!permissions.IsGrantManager)
                return Forbid();

            // Build the set of allowed league IDs
            HashSet<int>? allowedLeagueIds = null;

            // If filtering by a specific league, get its descendants
            if (leagueId.HasValue)
            {
                var descendantIds = await GetDescendantLeagueIdsAsync(leagueId.Value);
                allowedLeagueIds = descendantIds.ToHashSet();

                // If user has limited permissions, intersect with their accessible leagues
                if (!permissions.IsSiteAdmin && permissions.AccessibleLeagueIds.Any())
                {
                    allowedLeagueIds.IntersectWith(permissions.AccessibleLeagueIds);
                }
            }
            else if (!permissions.IsSiteAdmin && permissions.AccessibleLeagueIds.Any())
            {
                // No specific league filter, but user has limited permissions
                allowedLeagueIds = permissions.AccessibleLeagueIds.ToHashSet();
            }

            // Fetch ALL accounts and filter in memory to avoid EF Core CTE issues
            var allAccounts = await _context.ClubGrantAccounts
                .Include(a => a.Club)
                .Include(a => a.League)
                .Where(a => a.IsActive)
                .Select(a => new
                {
                    a.Id,
                    a.ClubId,
                    ClubName = a.Club != null ? a.Club.Name : "",
                    ClubLogoUrl = a.Club != null ? a.Club.LogoUrl : null,
                    a.LeagueId,
                    LeagueName = a.League != null ? a.League.Name : "",
                    a.CurrentBalance,
                    a.TotalCredits,
                    a.TotalDebits,
                    a.Notes,
                    a.IsActive,
                    a.CreatedAt,
                    a.UpdatedAt
                })
                .ToListAsync();

            // Filter in memory
            var accountsRaw = allowedLeagueIds != null
                ? allAccounts.Where(a => allowedLeagueIds.Contains(a.LeagueId)).ToList()
                : allAccounts;

            // Get account IDs for transaction stats
            var accountIds = accountsRaw.Select(a => a.Id).ToHashSet();

            // Fetch ALL transaction stats and filter in memory
            var allTransactionStats = await _context.ClubGrantTransactions
                .Where(t => !t.IsVoided)
                .GroupBy(t => t.AccountId)
                .Select(g => new
                {
                    AccountId = g.Key,
                    Count = g.Count(),
                    LastDate = g.Max(t => t.CreatedAt)
                })
                .ToListAsync();

            var statsDict = allTransactionStats
                .Where(s => accountIds.Contains(s.AccountId))
                .ToDictionary(s => s.AccountId);

            // Combine results
            var accounts = accountsRaw.Select(a => new ClubGrantAccountDto
            {
                Id = a.Id,
                ClubId = a.ClubId,
                ClubName = a.ClubName,
                ClubLogoUrl = a.ClubLogoUrl,
                LeagueId = a.LeagueId,
                LeagueName = a.LeagueName,
                CurrentBalance = a.CurrentBalance,
                TotalCredits = a.TotalCredits,
                TotalDebits = a.TotalDebits,
                Notes = a.Notes,
                IsActive = a.IsActive,
                CreatedAt = a.CreatedAt,
                UpdatedAt = a.UpdatedAt,
                TransactionCount = statsDict.TryGetValue(a.Id, out var stat) ? stat.Count : 0,
                LastTransactionDate = statsDict.TryGetValue(a.Id, out var stat2) ? stat2.LastDate : null
            })
            .OrderBy(a => a.ClubName)
            .ToList();

            return Ok(new ApiResponse<List<ClubGrantAccountDto>> { Success = true, Data = accounts });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching grant accounts");
            return StatusCode(500, new ApiResponse<List<ClubGrantAccountDto>> { Success = false, Message = $"Error: {ex.Message}" });
        }
    }

    // GET: /grants/accounts/summary - Get summary statistics
    [HttpGet("accounts/summary")]
    public async Task<ActionResult<ApiResponse<ClubGrantAccountSummaryDto>>> GetAccountsSummary([FromQuery] int? leagueId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ClubGrantAccountSummaryDto> { Success = false, Message = "User not authenticated" });

            var permissions = await GetUserPermissionsAsync(userId.Value);
            if (!permissions.IsGrantManager)
                return Forbid();

            // Build the set of allowed league IDs
            HashSet<int>? allowedLeagueIds = null;

            if (leagueId.HasValue)
            {
                var descendantIds = await GetDescendantLeagueIdsAsync(leagueId.Value);
                allowedLeagueIds = descendantIds.ToHashSet();

                if (!permissions.IsSiteAdmin && permissions.AccessibleLeagueIds.Any())
                {
                    allowedLeagueIds.IntersectWith(permissions.AccessibleLeagueIds);
                }
            }
            else if (!permissions.IsSiteAdmin && permissions.AccessibleLeagueIds.Any())
            {
                allowedLeagueIds = permissions.AccessibleLeagueIds.ToHashSet();
            }

            // Fetch ALL accounts and filter in memory to avoid EF Core CTE issues
            var allAccounts = await _context.ClubGrantAccounts
                .Select(a => new { a.LeagueId, a.IsActive, a.CurrentBalance, a.TotalCredits, a.TotalDebits })
                .ToListAsync();

            // Filter in memory
            var accounts = allowedLeagueIds != null
                ? allAccounts.Where(a => allowedLeagueIds.Contains(a.LeagueId)).ToList()
                : allAccounts;

            var summary = new ClubGrantAccountSummaryDto
            {
                TotalAccounts = accounts.Count,
                ActiveAccountsCount = accounts.Count(a => a.IsActive),
                TotalBalance = accounts.Where(a => a.IsActive).Sum(a => a.CurrentBalance),
                TotalCreditsAllTime = accounts.Sum(a => a.TotalCredits),
                TotalDebitsAllTime = accounts.Sum(a => a.TotalDebits)
            };

            return Ok(new ApiResponse<ClubGrantAccountSummaryDto> { Success = true, Data = summary });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching accounts summary");
            return StatusCode(500, new ApiResponse<ClubGrantAccountSummaryDto> { Success = false, Message = $"Error: {ex.Message}" });
        }
    }

    // GET: /grants/accounts/{clubId}/{leagueId} - Get specific club's account
    [HttpGet("accounts/{clubId}/{leagueId}")]
    public async Task<ActionResult<ApiResponse<ClubGrantAccountDto>>> GetAccount(int clubId, int leagueId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ClubGrantAccountDto> { Success = false, Message = "User not authenticated" });

            var permissions = await GetUserPermissionsAsync(userId.Value);
            if (!permissions.IsGrantManager)
                return Forbid();

            if (!permissions.IsSiteAdmin && !permissions.AccessibleLeagueIds.Contains(leagueId))
                return Forbid();

            var account = await _context.ClubGrantAccounts
                .Include(a => a.Club)
                .Include(a => a.League)
                .Where(a => a.ClubId == clubId && a.LeagueId == leagueId)
                .Select(a => new ClubGrantAccountDto
                {
                    Id = a.Id,
                    ClubId = a.ClubId,
                    ClubName = a.Club != null ? a.Club.Name : "",
                    ClubLogoUrl = a.Club != null ? a.Club.LogoUrl : null,
                    LeagueId = a.LeagueId,
                    LeagueName = a.League != null ? a.League.Name : "",
                    CurrentBalance = a.CurrentBalance,
                    TotalCredits = a.TotalCredits,
                    TotalDebits = a.TotalDebits,
                    Notes = a.Notes,
                    IsActive = a.IsActive,
                    CreatedAt = a.CreatedAt,
                    UpdatedAt = a.UpdatedAt,
                    TransactionCount = a.Transactions.Count(t => !t.IsVoided),
                    LastTransactionDate = a.Transactions.Where(t => !t.IsVoided).OrderByDescending(t => t.CreatedAt).Select(t => (DateTime?)t.CreatedAt).FirstOrDefault()
                })
                .FirstOrDefaultAsync();

            if (account == null)
                return NotFound(new ApiResponse<ClubGrantAccountDto> { Success = false, Message = "Account not found" });

            return Ok(new ApiResponse<ClubGrantAccountDto> { Success = true, Data = account });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching grant account");
            return StatusCode(500, new ApiResponse<ClubGrantAccountDto> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /grants/transactions - Search transactions
    [HttpGet("transactions")]
    public async Task<ActionResult<ApiResponse<PagedResult<ClubGrantTransactionDto>>>> GetTransactions([FromQuery] TransactionSearchRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<PagedResult<ClubGrantTransactionDto>> { Success = false, Message = "User not authenticated" });

            var permissions = await GetUserPermissionsAsync(userId.Value);
            if (!permissions.IsGrantManager)
                return Forbid();

            // Build the set of allowed league IDs
            HashSet<int>? allowedLeagueIds = null;

            if (request.LeagueId.HasValue)
            {
                var descendantIds = await GetDescendantLeagueIdsAsync(request.LeagueId.Value);
                allowedLeagueIds = descendantIds.ToHashSet();

                if (!permissions.IsSiteAdmin && permissions.AccessibleLeagueIds.Any())
                {
                    allowedLeagueIds.IntersectWith(permissions.AccessibleLeagueIds);
                }
            }
            else if (!permissions.IsSiteAdmin && permissions.AccessibleLeagueIds.Any())
            {
                allowedLeagueIds = permissions.AccessibleLeagueIds.ToHashSet();
            }

            // Fetch ALL account IDs and filter in memory to avoid EF Core CTE issues
            var allAccountMappings = await _context.ClubGrantAccounts
                .Select(a => new { a.Id, a.LeagueId, a.ClubId })
                .ToListAsync();

            // Build allowed account IDs set by filtering in memory
            HashSet<int>? allowedAccountIds = null;
            if (allowedLeagueIds != null && allowedLeagueIds.Count > 0)
            {
                allowedAccountIds = allAccountMappings
                    .Where(a => allowedLeagueIds.Contains(a.LeagueId))
                    .Select(a => a.Id)
                    .ToHashSet();
            }

            // Further filter by club if requested
            if (request.ClubId.HasValue)
            {
                var clubAccountIds = allAccountMappings
                    .Where(a => a.ClubId == request.ClubId.Value)
                    .Select(a => a.Id)
                    .ToHashSet();

                if (allowedAccountIds != null)
                    allowedAccountIds.IntersectWith(clubAccountIds);
                else
                    allowedAccountIds = clubAccountIds;
            }

            // Fetch ALL transactions and filter in memory
            var allTransactions = await _context.ClubGrantTransactions
                .Include(t => t.Account)
                    .ThenInclude(a => a!.Club)
                .Include(t => t.Account)
                    .ThenInclude(a => a!.League)
                .Include(t => t.ProcessedBy)
                .Include(t => t.ApprovedBy)
                .Include(t => t.VoidedBy)
                .ToListAsync();

            // Filter in memory
            var filteredTransactions = allTransactions.AsEnumerable();

            // Apply account filter if needed
            if (allowedAccountIds != null)
            {
                filteredTransactions = filteredTransactions.Where(t => allowedAccountIds.Contains(t.AccountId));
            }

            // Apply remaining filters in memory
            if (!string.IsNullOrEmpty(request.TransactionType))
                filteredTransactions = filteredTransactions.Where(t => t.TransactionType == request.TransactionType);

            if (!string.IsNullOrEmpty(request.Category))
                filteredTransactions = filteredTransactions.Where(t => t.Category == request.Category);

            if (request.DateFrom.HasValue)
                filteredTransactions = filteredTransactions.Where(t => t.CreatedAt >= request.DateFrom.Value);

            if (request.DateTo.HasValue)
                filteredTransactions = filteredTransactions.Where(t => t.CreatedAt <= request.DateTo.Value.AddDays(1));

            if (!string.IsNullOrEmpty(request.DonorName))
                filteredTransactions = filteredTransactions.Where(t => t.DonorName != null && t.DonorName.Contains(request.DonorName));

            if (request.IncludeVoided != true)
                filteredTransactions = filteredTransactions.Where(t => !t.IsVoided);

            // Materialize the filtered list
            var transactionList = filteredTransactions.ToList();
            var totalCount = transactionList.Count;

            // Apply pagination and projection
            var transactions = transactionList
                .OrderByDescending(t => t.CreatedAt)
                .Skip((request.Page - 1) * request.PageSize)
                .Take(request.PageSize)
                .Select(t => new ClubGrantTransactionDto
                {
                    Id = t.Id,
                    AccountId = t.AccountId,
                    ClubId = t.Account?.ClubId ?? 0,
                    ClubName = t.Account?.Club?.Name ?? "",
                    LeagueId = t.Account?.LeagueId ?? 0,
                    LeagueName = t.Account?.League?.Name ?? "",
                    TransactionType = t.TransactionType,
                    Category = t.Category,
                    Amount = t.Amount,
                    BalanceAfter = t.BalanceAfter,
                    Description = t.Description,
                    DonorName = t.DonorName,
                    DonorEmail = t.DonorEmail,
                    DonorPhone = t.DonorPhone,
                    DonationDate = t.DonationDate,
                    FeeReason = t.FeeReason,
                    GrantPurpose = t.GrantPurpose,
                    ReferenceNumber = t.ReferenceNumber,
                    ExternalReferenceId = t.ExternalReferenceId,
                    ProcessedByUserId = t.ProcessedByUserId,
                    ProcessedByName = t.ProcessedBy != null ? $"{t.ProcessedBy.FirstName} {t.ProcessedBy.LastName}".Trim() : "",
                    ApprovedByUserId = t.ApprovedByUserId,
                    ApprovedByName = t.ApprovedBy != null ? $"{t.ApprovedBy.FirstName} {t.ApprovedBy.LastName}".Trim() : null,
                    Notes = t.Notes,
                    IsVoided = t.IsVoided,
                    VoidedByUserId = t.VoidedByUserId,
                    VoidedByName = t.VoidedBy != null ? $"{t.VoidedBy.FirstName} {t.VoidedBy.LastName}".Trim() : null,
                    VoidedAt = t.VoidedAt,
                    VoidReason = t.VoidReason,
                    CreatedAt = t.CreatedAt,
                    UpdatedAt = t.UpdatedAt
                })
                .ToList();

            var result = new PagedResult<ClubGrantTransactionDto>
            {
                Items = transactions,
                TotalCount = totalCount,
                Page = request.Page,
                PageSize = request.PageSize
            };

            return Ok(new ApiResponse<PagedResult<ClubGrantTransactionDto>> { Success = true, Data = result });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching transactions");
            return StatusCode(500, new ApiResponse<PagedResult<ClubGrantTransactionDto>> { Success = false, Message = $"Error: {ex.Message}" });
        }
    }

    // POST: /grants/transactions - Create a transaction
    [HttpPost("transactions")]
    public async Task<ActionResult<ApiResponse<ClubGrantTransactionDto>>> CreateTransaction([FromBody] CreateTransactionDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ClubGrantTransactionDto> { Success = false, Message = "User not authenticated" });

            var permissions = await GetUserPermissionsAsync(userId.Value);
            if (!permissions.IsGrantManager)
                return Forbid();

            if (!permissions.IsSiteAdmin && !permissions.AccessibleLeagueIds.Contains(dto.LeagueId))
                return Forbid();

            // Check specific permissions based on transaction type
            if (dto.Category == "Donation" && !permissions.CanRecordDonations)
                return BadRequest(new ApiResponse<ClubGrantTransactionDto> { Success = false, Message = "You don't have permission to record donations" });

            if (dto.Category == "Fee" && !permissions.CanIssueFees)
                return BadRequest(new ApiResponse<ClubGrantTransactionDto> { Success = false, Message = "You don't have permission to issue fees" });

            if (dto.Category == "Grant" && !permissions.CanIssueGrants)
                return BadRequest(new ApiResponse<ClubGrantTransactionDto> { Success = false, Message = "You don't have permission to issue grants" });

            // Validate transaction type and category
            var validTypes = new[] { "Credit", "Debit" };
            var validCategories = new[] { "Donation", "Grant", "Fee", "Adjustment", "Refund" };

            if (!validTypes.Contains(dto.TransactionType))
                return BadRequest(new ApiResponse<ClubGrantTransactionDto> { Success = false, Message = "Invalid transaction type" });

            if (!validCategories.Contains(dto.Category))
                return BadRequest(new ApiResponse<ClubGrantTransactionDto> { Success = false, Message = "Invalid category" });

            if (dto.Amount <= 0)
                return BadRequest(new ApiResponse<ClubGrantTransactionDto> { Success = false, Message = "Amount must be greater than zero" });

            // Get or create the account
            var account = await _context.ClubGrantAccounts
                .FirstOrDefaultAsync(a => a.ClubId == dto.ClubId && a.LeagueId == dto.LeagueId);

            if (account == null)
            {
                // Verify club and league exist
                var club = await _context.Clubs.FindAsync(dto.ClubId);
                var league = await _context.Leagues.FindAsync(dto.LeagueId);

                if (club == null)
                    return BadRequest(new ApiResponse<ClubGrantTransactionDto> { Success = false, Message = "Club not found" });
                if (league == null)
                    return BadRequest(new ApiResponse<ClubGrantTransactionDto> { Success = false, Message = "League not found" });

                account = new ClubGrantAccount
                {
                    ClubId = dto.ClubId,
                    LeagueId = dto.LeagueId,
                    CurrentBalance = 0,
                    TotalCredits = 0,
                    TotalDebits = 0,
                    IsActive = true
                };
                _context.ClubGrantAccounts.Add(account);
                await _context.SaveChangesAsync();
            }

            // Calculate new balance
            var balanceChange = dto.TransactionType == "Credit" ? dto.Amount : -dto.Amount;
            var newBalance = account.CurrentBalance + balanceChange;

            // Create transaction
            var transaction = new ClubGrantTransaction
            {
                AccountId = account.Id,
                TransactionType = dto.TransactionType,
                Category = dto.Category,
                Amount = dto.Amount,
                BalanceAfter = newBalance,
                Description = dto.Description,
                DonorName = dto.DonorName,
                DonorEmail = dto.DonorEmail,
                DonorPhone = dto.DonorPhone,
                DonationDate = dto.DonationDate,
                FeeReason = dto.FeeReason,
                GrantPurpose = dto.GrantPurpose,
                ReferenceNumber = dto.ReferenceNumber,
                ExternalReferenceId = dto.ExternalReferenceId,
                ProcessedByUserId = userId.Value,
                Notes = dto.Notes
            };

            _context.ClubGrantTransactions.Add(transaction);

            // Update account balance and totals
            account.CurrentBalance = newBalance;
            if (dto.TransactionType == "Credit")
                account.TotalCredits += dto.Amount;
            else
                account.TotalDebits += dto.Amount;
            account.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Reload with navigation properties
            var createdTransaction = await _context.ClubGrantTransactions
                .Include(t => t.Account)
                    .ThenInclude(a => a!.Club)
                .Include(t => t.Account)
                    .ThenInclude(a => a!.League)
                .Include(t => t.ProcessedBy)
                .FirstOrDefaultAsync(t => t.Id == transaction.Id);

            var result = new ClubGrantTransactionDto
            {
                Id = createdTransaction!.Id,
                AccountId = createdTransaction.AccountId,
                ClubId = createdTransaction.Account!.ClubId,
                ClubName = createdTransaction.Account.Club?.Name ?? "",
                LeagueId = createdTransaction.Account.LeagueId,
                LeagueName = createdTransaction.Account.League?.Name ?? "",
                TransactionType = createdTransaction.TransactionType,
                Category = createdTransaction.Category,
                Amount = createdTransaction.Amount,
                BalanceAfter = createdTransaction.BalanceAfter,
                Description = createdTransaction.Description,
                DonorName = createdTransaction.DonorName,
                DonorEmail = createdTransaction.DonorEmail,
                DonorPhone = createdTransaction.DonorPhone,
                DonationDate = createdTransaction.DonationDate,
                FeeReason = createdTransaction.FeeReason,
                GrantPurpose = createdTransaction.GrantPurpose,
                ReferenceNumber = createdTransaction.ReferenceNumber,
                ProcessedByUserId = createdTransaction.ProcessedByUserId,
                ProcessedByName = createdTransaction.ProcessedBy != null ? $"{createdTransaction.ProcessedBy.FirstName} {createdTransaction.ProcessedBy.LastName}".Trim() : "",
                Notes = createdTransaction.Notes,
                CreatedAt = createdTransaction.CreatedAt,
                UpdatedAt = createdTransaction.UpdatedAt
            };

            return Ok(new ApiResponse<ClubGrantTransactionDto> { Success = true, Data = result, Message = "Transaction recorded successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating transaction");
            return StatusCode(500, new ApiResponse<ClubGrantTransactionDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /grants/transactions/{id}/void - Void a transaction
    [HttpPost("transactions/{id}/void")]
    public async Task<ActionResult<ApiResponse<ClubGrantTransactionDto>>> VoidTransaction(int id, [FromBody] VoidTransactionDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ClubGrantTransactionDto> { Success = false, Message = "User not authenticated" });

            var permissions = await GetUserPermissionsAsync(userId.Value);
            if (!permissions.CanVoidTransactions)
                return Forbid();

            var transaction = await _context.ClubGrantTransactions
                .Include(t => t.Account)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (transaction == null)
                return NotFound(new ApiResponse<ClubGrantTransactionDto> { Success = false, Message = "Transaction not found" });

            if (transaction.IsVoided)
                return BadRequest(new ApiResponse<ClubGrantTransactionDto> { Success = false, Message = "Transaction is already voided" });

            if (!permissions.IsSiteAdmin && !permissions.AccessibleLeagueIds.Contains(transaction.Account!.LeagueId))
                return Forbid();

            // Reverse the balance change
            var balanceChange = transaction.TransactionType == "Credit" ? -transaction.Amount : transaction.Amount;
            transaction.Account!.CurrentBalance += balanceChange;

            if (transaction.TransactionType == "Credit")
                transaction.Account.TotalCredits -= transaction.Amount;
            else
                transaction.Account.TotalDebits -= transaction.Amount;

            transaction.Account.UpdatedAt = DateTime.UtcNow;

            // Mark as voided
            transaction.IsVoided = true;
            transaction.VoidedByUserId = userId.Value;
            transaction.VoidedAt = DateTime.UtcNow;
            transaction.VoidReason = dto.Reason;
            transaction.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<ClubGrantTransactionDto> { Success = true, Message = "Transaction voided successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error voiding transaction");
            return StatusCode(500, new ApiResponse<ClubGrantTransactionDto> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /grants/managers - Get grant managers
    [HttpGet("managers")]
    public async Task<ActionResult<ApiResponse<List<GrantManagerDto>>>> GetManagers()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<GrantManagerDto>> { Success = false, Message = "User not authenticated" });

            var permissions = await GetUserPermissionsAsync(userId.Value);
            if (!permissions.CanManageManagers && !permissions.IsSiteAdmin)
                return Forbid();

            var managers = await _context.GrantManagers
                .Include(gm => gm.User)
                .Include(gm => gm.League)
                .Include(gm => gm.CreatedBy)
                .Where(gm => gm.IsActive)
                .Select(gm => new GrantManagerDto
                {
                    Id = gm.Id,
                    UserId = gm.UserId,
                    UserName = gm.User != null ? $"{gm.User.FirstName} {gm.User.LastName}".Trim() : "",
                    UserEmail = gm.User != null ? gm.User.Email : null,
                    UserProfileImageUrl = gm.User != null ? gm.User.ProfileImageUrl : null,
                    LeagueId = gm.LeagueId,
                    LeagueName = gm.League != null ? gm.League.Name : "All Leagues",
                    Role = gm.Role,
                    CanRecordDonations = gm.CanRecordDonations,
                    CanIssueFees = gm.CanIssueFees,
                    CanIssueGrants = gm.CanIssueGrants,
                    CanVoidTransactions = gm.CanVoidTransactions,
                    CanManageManagers = gm.CanManageManagers,
                    IsActive = gm.IsActive,
                    CreatedByUserId = gm.CreatedByUserId,
                    CreatedByName = gm.CreatedBy != null ? $"{gm.CreatedBy.FirstName} {gm.CreatedBy.LastName}".Trim() : "",
                    CreatedAt = gm.CreatedAt
                })
                .OrderBy(gm => gm.UserName)
                .ToListAsync();

            return Ok(new ApiResponse<List<GrantManagerDto>> { Success = true, Data = managers });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching grant managers");
            return StatusCode(500, new ApiResponse<List<GrantManagerDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /grants/managers - Add grant manager
    [HttpPost("managers")]
    public async Task<ActionResult<ApiResponse<GrantManagerDto>>> AddManager([FromBody] CreateGrantManagerDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<GrantManagerDto> { Success = false, Message = "User not authenticated" });

            var permissions = await GetUserPermissionsAsync(userId.Value);
            if (!permissions.CanManageManagers && !permissions.IsSiteAdmin)
                return Forbid();

            // Check if user exists
            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null)
                return BadRequest(new ApiResponse<GrantManagerDto> { Success = false, Message = "User not found" });

            // Check if already a manager
            var existing = await _context.GrantManagers
                .FirstOrDefaultAsync(gm => gm.UserId == dto.UserId && gm.LeagueId == dto.LeagueId && gm.IsActive);

            if (existing != null)
                return BadRequest(new ApiResponse<GrantManagerDto> { Success = false, Message = "User is already a grant manager for this scope" });

            var manager = new GrantManager
            {
                UserId = dto.UserId,
                LeagueId = dto.LeagueId,
                Role = dto.Role,
                CanRecordDonations = dto.CanRecordDonations,
                CanIssueFees = dto.CanIssueFees,
                CanIssueGrants = dto.CanIssueGrants,
                CanVoidTransactions = dto.CanVoidTransactions,
                CanManageManagers = dto.CanManageManagers,
                CreatedByUserId = userId.Value
            };

            _context.GrantManagers.Add(manager);
            await _context.SaveChangesAsync();

            // Reload with navigation properties
            var createdManager = await _context.GrantManagers
                .Include(gm => gm.User)
                .Include(gm => gm.League)
                .Include(gm => gm.CreatedBy)
                .FirstOrDefaultAsync(gm => gm.Id == manager.Id);

            var result = new GrantManagerDto
            {
                Id = createdManager!.Id,
                UserId = createdManager.UserId,
                UserName = createdManager.User != null ? $"{createdManager.User.FirstName} {createdManager.User.LastName}".Trim() : "",
                UserEmail = createdManager.User?.Email,
                UserProfileImageUrl = createdManager.User?.ProfileImageUrl,
                LeagueId = createdManager.LeagueId,
                LeagueName = createdManager.League?.Name ?? "All Leagues",
                Role = createdManager.Role,
                CanRecordDonations = createdManager.CanRecordDonations,
                CanIssueFees = createdManager.CanIssueFees,
                CanIssueGrants = createdManager.CanIssueGrants,
                CanVoidTransactions = createdManager.CanVoidTransactions,
                CanManageManagers = createdManager.CanManageManagers,
                IsActive = createdManager.IsActive,
                CreatedByUserId = createdManager.CreatedByUserId,
                CreatedByName = createdManager.CreatedBy != null ? $"{createdManager.CreatedBy.FirstName} {createdManager.CreatedBy.LastName}".Trim() : "",
                CreatedAt = createdManager.CreatedAt
            };

            return Ok(new ApiResponse<GrantManagerDto> { Success = true, Data = result, Message = "Grant manager added successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding grant manager");
            return StatusCode(500, new ApiResponse<GrantManagerDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /grants/managers/{id} - Update grant manager
    [HttpPut("managers/{id}")]
    public async Task<ActionResult<ApiResponse<GrantManagerDto>>> UpdateManager(int id, [FromBody] UpdateGrantManagerDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<GrantManagerDto> { Success = false, Message = "User not authenticated" });

            var permissions = await GetUserPermissionsAsync(userId.Value);
            if (!permissions.CanManageManagers && !permissions.IsSiteAdmin)
                return Forbid();

            var manager = await _context.GrantManagers.FindAsync(id);
            if (manager == null)
                return NotFound(new ApiResponse<GrantManagerDto> { Success = false, Message = "Grant manager not found" });

            if (dto.Role != null) manager.Role = dto.Role;
            if (dto.CanRecordDonations.HasValue) manager.CanRecordDonations = dto.CanRecordDonations.Value;
            if (dto.CanIssueFees.HasValue) manager.CanIssueFees = dto.CanIssueFees.Value;
            if (dto.CanIssueGrants.HasValue) manager.CanIssueGrants = dto.CanIssueGrants.Value;
            if (dto.CanVoidTransactions.HasValue) manager.CanVoidTransactions = dto.CanVoidTransactions.Value;
            if (dto.CanManageManagers.HasValue) manager.CanManageManagers = dto.CanManageManagers.Value;
            if (dto.IsActive.HasValue) manager.IsActive = dto.IsActive.Value;
            manager.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<GrantManagerDto> { Success = true, Message = "Grant manager updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating grant manager");
            return StatusCode(500, new ApiResponse<GrantManagerDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /grants/managers/{id} - Remove grant manager
    [HttpDelete("managers/{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> RemoveManager(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var permissions = await GetUserPermissionsAsync(userId.Value);
            if (!permissions.CanManageManagers && !permissions.IsSiteAdmin)
                return Forbid();

            var manager = await _context.GrantManagers.FindAsync(id);
            if (manager == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Grant manager not found" });

            manager.IsActive = false;
            manager.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Grant manager removed successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing grant manager");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // =============================================
    // CLUB ADMIN ENDPOINTS (view-only for club admins)
    // =============================================

    /// <summary>
    /// Check if current user is an admin of the specified club
    /// </summary>
    private async Task<bool> IsClubAdminAsync(int userId, int clubId)
    {
        return await _context.ClubMembers
            .AnyAsync(m => m.ClubId == clubId && m.UserId == userId && m.Role == "Admin" && m.IsActive);
    }

    // GET: /grants/club/{clubId}/accounts - Get grant accounts for a specific club (for club admins)
    [HttpGet("club/{clubId}/accounts")]
    public async Task<ActionResult<ApiResponse<List<ClubGrantAccountDto>>>> GetClubAccounts(int clubId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<ClubGrantAccountDto>> { Success = false, Message = "User not authenticated" });

            // Check if user is club admin, grant manager, or site admin
            var isSiteAdmin = await IsSiteAdminAsync(userId.Value);
            var isClubAdmin = await IsClubAdminAsync(userId.Value, clubId);
            var grantManager = await GetGrantManagerAsync(userId.Value);

            if (!isSiteAdmin && !isClubAdmin && grantManager == null)
                return Forbid();

            var accounts = await _context.ClubGrantAccounts
                .Include(a => a.Club)
                .Include(a => a.League)
                .Where(a => a.ClubId == clubId && a.IsActive)
                .Select(a => new ClubGrantAccountDto
                {
                    Id = a.Id,
                    ClubId = a.ClubId,
                    ClubName = a.Club != null ? a.Club.Name : "",
                    ClubLogoUrl = a.Club != null ? a.Club.LogoUrl : null,
                    LeagueId = a.LeagueId,
                    LeagueName = a.League != null ? a.League.Name : "",
                    CurrentBalance = a.CurrentBalance,
                    TotalCredits = a.TotalCredits,
                    TotalDebits = a.TotalDebits,
                    Notes = a.Notes,
                    IsActive = a.IsActive,
                    CreatedAt = a.CreatedAt,
                    UpdatedAt = a.UpdatedAt,
                    TransactionCount = a.Transactions.Count(t => !t.IsVoided),
                    LastTransactionDate = a.Transactions.Where(t => !t.IsVoided).OrderByDescending(t => t.CreatedAt).Select(t => (DateTime?)t.CreatedAt).FirstOrDefault()
                })
                .OrderBy(a => a.LeagueName)
                .ToListAsync();

            return Ok(new ApiResponse<List<ClubGrantAccountDto>> { Success = true, Data = accounts });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching club grant accounts");
            return StatusCode(500, new ApiResponse<List<ClubGrantAccountDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /grants/club/{clubId}/transactions - Get transactions for a specific club (for club admins)
    [HttpGet("club/{clubId}/transactions")]
    public async Task<ActionResult<ApiResponse<PagedResult<ClubGrantTransactionDto>>>> GetClubTransactions(
        int clubId,
        [FromQuery] int? leagueId,
        [FromQuery] string? transactionType,
        [FromQuery] string? category,
        [FromQuery] DateTime? dateFrom,
        [FromQuery] DateTime? dateTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<PagedResult<ClubGrantTransactionDto>> { Success = false, Message = "User not authenticated" });

            // Check if user is club admin, grant manager, or site admin
            var isSiteAdmin = await IsSiteAdminAsync(userId.Value);
            var isClubAdmin = await IsClubAdminAsync(userId.Value, clubId);
            var grantManager = await GetGrantManagerAsync(userId.Value);

            if (!isSiteAdmin && !isClubAdmin && grantManager == null)
                return Forbid();

            var query = _context.ClubGrantTransactions
                .Include(t => t.Account)
                    .ThenInclude(a => a!.Club)
                .Include(t => t.Account)
                    .ThenInclude(a => a!.League)
                .Include(t => t.ProcessedBy)
                .Where(t => t.Account!.ClubId == clubId && !t.IsVoided);

            // Apply filters
            if (leagueId.HasValue)
                query = query.Where(t => t.Account!.LeagueId == leagueId.Value);

            if (!string.IsNullOrEmpty(transactionType))
                query = query.Where(t => t.TransactionType == transactionType);

            if (!string.IsNullOrEmpty(category))
                query = query.Where(t => t.Category == category);

            if (dateFrom.HasValue)
                query = query.Where(t => t.CreatedAt >= dateFrom.Value);

            if (dateTo.HasValue)
                query = query.Where(t => t.CreatedAt <= dateTo.Value.AddDays(1));

            var totalCount = await query.CountAsync();

            var transactions = await query
                .OrderByDescending(t => t.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(t => new ClubGrantTransactionDto
                {
                    Id = t.Id,
                    AccountId = t.AccountId,
                    ClubId = t.Account!.ClubId,
                    ClubName = t.Account.Club != null ? t.Account.Club.Name : "",
                    LeagueId = t.Account.LeagueId,
                    LeagueName = t.Account.League != null ? t.Account.League.Name : "",
                    TransactionType = t.TransactionType,
                    Category = t.Category,
                    Amount = t.Amount,
                    BalanceAfter = t.BalanceAfter,
                    Description = t.Description,
                    DonorName = t.DonorName,
                    DonationDate = t.DonationDate,
                    FeeReason = t.FeeReason,
                    GrantPurpose = t.GrantPurpose,
                    ReferenceNumber = t.ReferenceNumber,
                    ProcessedByUserId = t.ProcessedByUserId,
                    ProcessedByName = t.ProcessedBy != null ? $"{t.ProcessedBy.FirstName} {t.ProcessedBy.LastName}".Trim() : "",
                    Notes = t.Notes,
                    IsVoided = t.IsVoided,
                    CreatedAt = t.CreatedAt,
                    UpdatedAt = t.UpdatedAt
                })
                .ToListAsync();

            var result = new PagedResult<ClubGrantTransactionDto>
            {
                Items = transactions,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };

            return Ok(new ApiResponse<PagedResult<ClubGrantTransactionDto>> { Success = true, Data = result });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching club transactions");
            return StatusCode(500, new ApiResponse<PagedResult<ClubGrantTransactionDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /grants/club/{clubId}/summary - Get summary for a specific club (for club admins)
    [HttpGet("club/{clubId}/summary")]
    public async Task<ActionResult<ApiResponse<ClubGrantAccountSummaryDto>>> GetClubSummary(int clubId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ClubGrantAccountSummaryDto> { Success = false, Message = "User not authenticated" });

            // Check if user is club admin, grant manager, or site admin
            var isSiteAdmin = await IsSiteAdminAsync(userId.Value);
            var isClubAdmin = await IsClubAdminAsync(userId.Value, clubId);
            var grantManager = await GetGrantManagerAsync(userId.Value);

            if (!isSiteAdmin && !isClubAdmin && grantManager == null)
                return Forbid();

            var query = _context.ClubGrantAccounts.Where(a => a.ClubId == clubId);

            var summary = new ClubGrantAccountSummaryDto
            {
                TotalAccounts = await query.CountAsync(),
                ActiveAccountsCount = await query.Where(a => a.IsActive).CountAsync(),
                TotalBalance = await query.Where(a => a.IsActive).SumAsync(a => a.CurrentBalance),
                TotalCreditsAllTime = await query.SumAsync(a => a.TotalCredits),
                TotalDebitsAllTime = await query.SumAsync(a => a.TotalDebits)
            };

            return Ok(new ApiResponse<ClubGrantAccountSummaryDto> { Success = true, Data = summary });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching club grant summary");
            return StatusCode(500, new ApiResponse<ClubGrantAccountSummaryDto> { Success = false, Message = "An error occurred" });
        }
    }

    // =============================================
    // GRANT MANAGER ENDPOINTS (full access)
    // =============================================

    /// <summary>
    /// Get all descendant league IDs (including the starting league) using iterative approach
    /// </summary>
    private async Task<List<int>> GetDescendantLeagueIdsAsync(int leagueId)
    {
        var result = new List<int>();
        var toProcess = new Queue<int>();
        toProcess.Enqueue(leagueId);
        var maxIterations = 1000; // Safety limit to prevent infinite loops
        var iterations = 0;

        while (toProcess.Count > 0 && iterations < maxIterations)
        {
            iterations++;
            var currentId = toProcess.Dequeue();

            if (result.Contains(currentId))
                continue; // Skip if already processed (prevents circular references)

            result.Add(currentId);

            var childIds = await _context.Leagues
                .Where(l => l.ParentLeagueId == currentId && l.IsActive)
                .Select(l => l.Id)
                .ToListAsync();

            foreach (var childId in childIds)
            {
                if (!result.Contains(childId))
                    toProcess.Enqueue(childId);
            }
        }

        return result;
    }

    // GET: /grants/clubs - Get clubs for dropdown (with league filter, includes child leagues)
    [HttpGet("clubs")]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetClubs([FromQuery] int? leagueId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<object>> { Success = false, Message = "User not authenticated" });

            var permissions = await GetUserPermissionsAsync(userId.Value);
            if (!permissions.IsGrantManager)
                return Forbid();

            // Build the set of allowed league IDs
            HashSet<int>? allowedLeagueIds = null;

            if (leagueId.HasValue)
            {
                var descendantIds = await GetDescendantLeagueIdsAsync(leagueId.Value);
                allowedLeagueIds = descendantIds.ToHashSet();

                if (!permissions.IsSiteAdmin && permissions.AccessibleLeagueIds.Any())
                {
                    allowedLeagueIds.IntersectWith(permissions.AccessibleLeagueIds);
                }
            }
            else if (!permissions.IsSiteAdmin && permissions.AccessibleLeagueIds.Any())
            {
                // For non-site-admins, include descendants of their accessible leagues
                var allAccessibleLeagueIds = new HashSet<int>();
                foreach (var accessibleLeagueId in permissions.AccessibleLeagueIds)
                {
                    var descendants = await GetDescendantLeagueIdsAsync(accessibleLeagueId);
                    foreach (var id in descendants)
                    {
                        allAccessibleLeagueIds.Add(id);
                    }
                }
                allowedLeagueIds = allAccessibleLeagueIds;
            }

            // Fetch ALL league clubs and filter in memory to avoid EF Core CTE issues
            var allLeagueClubs = await _context.LeagueClubs
                .Include(lc => lc.Club)
                .Include(lc => lc.League)
                .Where(lc => lc.Status == "Active")
                .ToListAsync();

            // Filter in memory
            var leagueClubs = allowedLeagueIds != null
                ? allLeagueClubs.Where(lc => allowedLeagueIds.Contains(lc.LeagueId)).ToList()
                : allLeagueClubs;

            var clubs = leagueClubs
                .Where(lc => lc.Club != null && lc.Club.IsActive && lc.League != null && lc.League.IsActive)
                .Select(lc => new
                {
                    ClubId = lc.ClubId,
                    ClubName = lc.Club!.Name,
                    LeagueId = lc.LeagueId,
                    LeagueName = lc.League!.Name
                })
                .Distinct()
                .OrderBy(c => c.LeagueName)
                .ThenBy(c => c.ClubName)
                .ToList();

            return Ok(new ApiResponse<List<object>> { Success = true, Data = clubs.Cast<object>().ToList() });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching clubs");
            return StatusCode(500, new ApiResponse<List<object>> { Success = false, Message = $"Error: {ex.Message}" });
        }
    }

    // GET: /grants/leagues - Get leagues for dropdown
    [HttpGet("leagues")]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetLeagues()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<object>> { Success = false, Message = "User not authenticated" });

            var permissions = await GetUserPermissionsAsync(userId.Value);
            if (!permissions.IsGrantManager)
                return Forbid();

            var query = _context.Leagues.Where(l => l.IsActive);

            if (!permissions.IsSiteAdmin && permissions.AccessibleLeagueIds.Any())
            {
                query = query.Where(l => permissions.AccessibleLeagueIds.Contains(l.Id));
            }

            var leagues = await query
                .Select(l => new
                {
                    Id = l.Id,
                    Name = l.Name
                })
                .OrderBy(l => l.Name)
                .ToListAsync();

            return Ok(new ApiResponse<List<object>> { Success = true, Data = leagues.Cast<object>().ToList() });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching leagues");
            return StatusCode(500, new ApiResponse<List<object>> { Success = false, Message = "An error occurred" });
        }
    }
}

/// <summary>
/// Paginated result wrapper for API responses
/// </summary>
public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
}
