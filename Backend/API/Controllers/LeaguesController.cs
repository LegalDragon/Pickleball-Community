using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Services;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class LeaguesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<LeaguesController> _logger;
    private readonly INotificationService _notificationService;

    public LeaguesController(ApplicationDbContext context, ILogger<LeaguesController> logger, INotificationService notificationService)
    {
        _context = context;
        _logger = logger;
        _notificationService = notificationService;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private async Task<bool> IsAdminAsync()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return false;
        var user = await _context.Users.FindAsync(userId.Value);
        return user?.Role == "Admin";
    }

    private async Task<bool> CanManageLeagueAsync(int leagueId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return false;

        // Check if admin
        if (await IsAdminAsync()) return true;

        // Check if user is a manager of this league
        return await _context.LeagueManagers
            .AnyAsync(m => m.LeagueId == leagueId && m.UserId == userId.Value && m.IsActive);
    }

    private bool IsLocalRequest()
    {
        var connection = HttpContext.Connection;
        var remoteIp = connection.RemoteIpAddress;

        if (remoteIp == null) return false;

        // Check for localhost (IPv4 and IPv6)
        if (System.Net.IPAddress.IsLoopback(remoteIp)) return true;

        // Check for local network (same as local IP)
        var localIp = connection.LocalIpAddress;
        if (localIp != null && remoteIp.Equals(localIp)) return true;

        return false;
    }

    // GET: /leagues - Search/list leagues
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<LeagueDto>>>> GetLeagues([FromQuery] LeagueSearchRequest request)
    {
        try
        {
            var query = _context.Leagues
                .Include(l => l.ParentLeague)
                .Where(l => l.IsActive)
                .AsQueryable();

            // Apply filters
            if (!string.IsNullOrWhiteSpace(request.Query))
            {
                var searchPattern = $"%{request.Query}%";
                query = query.Where(l =>
                    EF.Functions.Like(l.Name, searchPattern) ||
                    (l.Description != null && EF.Functions.Like(l.Description, searchPattern)));
            }

            if (!string.IsNullOrWhiteSpace(request.Scope))
                query = query.Where(l => l.Scope == request.Scope);

            if (!string.IsNullOrWhiteSpace(request.State))
                query = query.Where(l => l.State == request.State);

            if (!string.IsNullOrWhiteSpace(request.Region))
                query = query.Where(l => l.Region == request.Region);

            if (!string.IsNullOrWhiteSpace(request.Country))
                query = query.Where(l => l.Country == request.Country);

            if (request.ParentLeagueId.HasValue)
                query = query.Where(l => l.ParentLeagueId == request.ParentLeagueId.Value);

            if (request.RootOnly == true)
                query = query.Where(l => l.ParentLeagueId == null);

            // Get total count
            var totalCount = await query.CountAsync();

            // Get paginated results with counts
            var leagues = await query
                .OrderBy(l => l.SortOrder)
                .ThenBy(l => l.Name)
                .Skip((request.Page - 1) * request.PageSize)
                .Take(request.PageSize)
                .Select(l => new LeagueDto
                {
                    Id = l.Id,
                    Name = l.Name,
                    Description = l.Description,
                    Scope = l.Scope,
                    AvatarUrl = l.AvatarUrl,
                    State = l.State,
                    Region = l.Region,
                    Country = l.Country,
                    ParentLeagueId = l.ParentLeagueId,
                    ParentLeagueName = l.ParentLeague != null ? l.ParentLeague.Name : null,
                    ChildLeagueCount = l.ChildLeagues.Count(c => c.IsActive),
                    ClubCount = l.Clubs.Count(c => c.Status == "Active"),
                    ManagerCount = l.Managers.Count(m => m.IsActive),
                    CreatedAt = l.CreatedAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<PagedResult<LeagueDto>>
            {
                Success = true,
                Data = new PagedResult<LeagueDto>
                {
                    Items = leagues,
                    TotalCount = totalCount,
                    Page = request.Page,
                    PageSize = request.PageSize
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting leagues");
            return StatusCode(500, new ApiResponse<PagedResult<LeagueDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /leagues/my-managed - Get leagues where current user is a manager
    [HttpGet("my-managed")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<ManagedLeagueDto>>>> GetMyManagedLeagues()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<ManagedLeagueDto>> { Success = false, Message = "Not authenticated" });

            // Get all leagues where user is an active manager
            var managedLeagues = await _context.LeagueManagers
                .Include(m => m.League)
                .Where(m => m.UserId == userId.Value && m.IsActive && m.League.IsActive)
                .Select(m => m.League)
                .ToListAsync();

            var result = new List<ManagedLeagueDto>();

            foreach (var league in managedLeagues)
            {
                // Find root league by traversing up the hierarchy
                var rootLeague = league;
                while (rootLeague.ParentLeagueId.HasValue)
                {
                    rootLeague = await _context.Leagues.FindAsync(rootLeague.ParentLeagueId.Value);
                    if (rootLeague == null) break;
                }

                result.Add(new ManagedLeagueDto
                {
                    LeagueId = league.Id,
                    LeagueName = league.Name,
                    LeagueScope = league.Scope,
                    LeagueAvatarUrl = league.AvatarUrl,
                    RootLeagueId = rootLeague?.Id ?? league.Id,
                    RootLeagueName = rootLeague?.Name ?? league.Name,
                    RootLeagueAvatarUrl = rootLeague?.AvatarUrl ?? league.AvatarUrl
                });
            }

            return Ok(new ApiResponse<List<ManagedLeagueDto>> { Success = true, Data = result });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting managed leagues");
            return StatusCode(500, new ApiResponse<List<ManagedLeagueDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /leagues/{id} - Get league details
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<LeagueDetailDto>>> GetLeague(int id)
    {
        try
        {
            var league = await _context.Leagues
                .Include(l => l.ParentLeague)
                .Include(l => l.ChildLeagues.Where(c => c.IsActive))
                .Include(l => l.Managers.Where(m => m.IsActive))
                    .ThenInclude(m => m.User)
                .Include(l => l.Clubs.Where(c => c.Status == "Active"))
                    .ThenInclude(c => c.Club)
                .Include(l => l.ClubRequests.Where(r => r.Status == "Pending"))
                    .ThenInclude(r => r.Club)
                .Include(l => l.ClubRequests.Where(r => r.Status == "Pending"))
                    .ThenInclude(r => r.RequestedBy)
                .Include(l => l.Documents.Where(d => d.IsActive))
                    .ThenInclude(d => d.UploadedBy)
                .FirstOrDefaultAsync(l => l.Id == id);

            if (league == null)
                return NotFound(new ApiResponse<LeagueDetailDto> { Success = false, Message = "League not found" });

            var userId = GetCurrentUserId();
            var canManage = await CanManageLeagueAsync(id);

            // Build breadcrumb path (includes current league at the end)
            var breadcrumbs = await BuildBreadcrumbsAsync(league);

            // Get parent league IDs (exclude current league) in root-first order
            var parentLeagueIds = breadcrumbs.Where(b => b.Id != league.Id).Select(b => b.Id).ToList();
            var allDocuments = new List<LeagueDocumentDto>();

            // Add parent leagues' documents first (public only, in root-to-parent order)
            // Note: Query each parent individually to avoid OPENJSON compatibility issues with older SQL Server
            if (parentLeagueIds.Any())
            {
                var parentDocuments = new List<LeagueDocument>();
                foreach (var parentId in parentLeagueIds)
                {
                    var docs = await _context.LeagueDocuments
                        .Include(d => d.League)
                        .Include(d => d.UploadedBy)
                        .Where(d => d.LeagueId == parentId && d.IsActive && d.IsPublic)
                        .ToListAsync();
                    parentDocuments.AddRange(docs);
                }

                // Sort by hierarchy (root first) then by sort order within each league
                var sortedParentDocs = parentDocuments
                    .OrderBy(d => parentLeagueIds.IndexOf(d.LeagueId))
                    .ThenBy(d => d.SortOrder)
                    .Select(d => new LeagueDocumentDto
                    {
                        Id = d.Id,
                        LeagueId = d.LeagueId,
                        LeagueName = d.League?.Name,
                        Title = d.Title,
                        Description = d.Description,
                        FileUrl = d.FileUrl,
                        FileName = d.FileName,
                        FileType = d.FileType,
                        FileSize = d.FileSize,
                        SortOrder = d.SortOrder,
                        IsPublic = d.IsPublic,
                        IsActive = d.IsActive,
                        CreatedAt = d.CreatedAt,
                        UploadedByUserId = d.UploadedByUserId,
                        UploadedByName = d.UploadedBy != null ? Utility.FormatName(d.UploadedBy.LastName, d.UploadedBy.FirstName) : null
                    });

                allDocuments.AddRange(sortedParentDocs);
            }

            // Add current league's documents last
            allDocuments.AddRange(league.Documents
                .Where(d => d.IsActive && (d.IsPublic || canManage))
                .OrderBy(d => d.SortOrder)
                .Select(d => new LeagueDocumentDto
                {
                    Id = d.Id,
                    LeagueId = d.LeagueId,
                    LeagueName = league.Name,
                    Title = d.Title,
                    Description = d.Description,
                    FileUrl = d.FileUrl,
                    FileName = d.FileName,
                    FileType = d.FileType,
                    FileSize = d.FileSize,
                    SortOrder = d.SortOrder,
                    IsPublic = d.IsPublic,
                    IsActive = d.IsActive,
                    CreatedAt = d.CreatedAt,
                    UploadedByUserId = d.UploadedByUserId,
                    UploadedByName = d.UploadedBy != null ? Utility.FormatName(d.UploadedBy.LastName, d.UploadedBy.FirstName) : null
                }));

            // Documents are already in correct order: parent docs (root first) then current league docs
            var sortedDocuments = allDocuments;

            var dto = new LeagueDetailDto
            {
                Id = league.Id,
                Name = league.Name,
                Description = league.Description,
                Scope = league.Scope,
                AvatarUrl = league.AvatarUrl,
                BannerUrl = league.BannerUrl,
                Website = league.Website,
                ContactEmail = league.ContactEmail,
                State = league.State,
                Region = league.Region,
                Country = league.Country,
                ParentLeagueId = league.ParentLeagueId,
                ParentLeagueName = league.ParentLeague?.Name,
                SortOrder = league.SortOrder,
                IsActive = league.IsActive,
                ChildLeagueCount = league.ChildLeagues.Count,
                ClubCount = league.Clubs.Count,
                ManagerCount = league.Managers.Count,
                CreatedAt = league.CreatedAt,
                Breadcrumbs = breadcrumbs,
                CanManage = canManage,
                ChildLeagues = league.ChildLeagues.OrderBy(c => c.SortOrder).Select(c => new LeagueDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    Description = c.Description,
                    Scope = c.Scope,
                    AvatarUrl = c.AvatarUrl,
                    State = c.State,
                    Region = c.Region,
                    Country = c.Country,
                    ParentLeagueId = c.ParentLeagueId,
                    CreatedAt = c.CreatedAt
                }).ToList(),
                Managers = league.Managers
                    .OrderBy(m => GetRoleSortOrder(m.Role))
                    .ThenBy(m => Utility.FormatName(m.User?.LastName, m.User?.FirstName))
                    .Select(m => new LeagueManagerDto
                {
                    Id = m.Id,
                    LeagueId = m.LeagueId,
                    UserId = m.UserId,
                    UserName = Utility.FormatName(m.User?.LastName, m.User?.FirstName),
                    UserProfileImageUrl = m.User?.ProfileImageUrl,
                    Role = m.Role,
                    Title = m.Title,
                    IsActive = m.IsActive,
                    CreatedAt = m.CreatedAt
                }).ToList(),
                Clubs = league.Clubs.Select(c => new LeagueClubDto
                {
                    Id = c.Id,
                    LeagueId = c.LeagueId,
                    ClubId = c.ClubId,
                    ClubName = c.Club?.Name ?? "Unknown",
                    ClubLogoUrl = c.Club?.LogoUrl,
                    ClubCity = c.Club?.City,
                    ClubState = c.Club?.State,
                    ClubMemberCount = c.Club?.Members.Count(m => m.IsActive) ?? 0,
                    Status = c.Status,
                    JoinedAt = c.JoinedAt,
                    ExpiresAt = c.ExpiresAt,
                    Notes = c.Notes
                }).ToList(),
                Documents = sortedDocuments
            };

            // Only include pending requests if user can manage
            if (canManage)
            {
                dto.PendingRequests = league.ClubRequests.Select(r => new LeagueClubRequestDto
                {
                    Id = r.Id,
                    LeagueId = r.LeagueId,
                    LeagueName = league.Name,
                    ClubId = r.ClubId,
                    ClubName = r.Club?.Name ?? "Unknown",
                    ClubLogoUrl = r.Club?.LogoUrl,
                    ClubCity = r.Club?.City,
                    ClubState = r.Club?.State,
                    RequestedByUserId = r.RequestedByUserId,
                    RequestedByName = Utility.FormatName(r.RequestedBy?.LastName, r.RequestedBy?.FirstName),
                    Status = r.Status,
                    Message = r.Message,
                    CreatedAt = r.CreatedAt
                }).ToList();

                // Get current user's role if they are a manager
                if (userId.HasValue)
                {
                    var userManager = league.Managers.FirstOrDefault(m => m.UserId == userId.Value);
                    dto.CurrentUserRole = userManager?.Role;
                }
            }

            return Ok(new ApiResponse<LeagueDetailDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting league {LeagueId}", id);
            return StatusCode(500, new ApiResponse<LeagueDetailDto> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /leagues/tree - Get hierarchy tree
    [HttpGet("tree")]
    public async Task<ActionResult<ApiResponse<List<LeagueTreeNodeDto>>>> GetLeagueTree([FromQuery] string? scope = null)
    {
        try
        {
            // Get all active leagues
            var leagues = await _context.Leagues
                .Where(l => l.IsActive)
                .Select(l => new LeagueFlatNode
                {
                    Id = l.Id,
                    Name = l.Name,
                    Scope = l.Scope,
                    AvatarUrl = l.AvatarUrl,
                    ParentLeagueId = l.ParentLeagueId,
                    SortOrder = l.SortOrder,
                    ClubCount = l.Clubs.Count(c => c.Status == "Active")
                })
                .ToListAsync();

            // Build tree starting from root nodes
            var rootNodes = leagues
                .Where(l => l.ParentLeagueId == null)
                .OrderBy(l => l.SortOrder)
                .ThenBy(l => l.Name)
                .Select(l => BuildTreeNode(l, leagues))
                .ToList();

            return Ok(new ApiResponse<List<LeagueTreeNodeDto>> { Success = true, Data = rootNodes });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting league tree");
            return StatusCode(500, new ApiResponse<List<LeagueTreeNodeDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // Helper class for building tree
    private class LeagueFlatNode
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Scope { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public int? ParentLeagueId { get; set; }
        public int SortOrder { get; set; }
        public int ClubCount { get; set; }
    }

    private LeagueTreeNodeDto BuildTreeNode(LeagueFlatNode node, List<LeagueFlatNode> allLeagues)
    {
        var children = allLeagues
            .Where(l => l.ParentLeagueId == node.Id)
            .OrderBy(l => l.SortOrder)
            .ThenBy(l => l.Name)
            .Select(l => BuildTreeNode(l, allLeagues))
            .ToList();

        return new LeagueTreeNodeDto
        {
            Id = node.Id,
            Name = node.Name,
            Scope = node.Scope,
            AvatarUrl = node.AvatarUrl,
            ClubCount = node.ClubCount,
            Children = children
        };
    }

    // POST: /leagues - Create league (admin only, local server only)
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ApiResponse<LeagueDto>>> CreateLeague([FromBody] CreateLeagueDto request)
    {
        try
        {
            // League creation is restricted to local server only
            if (!IsLocalRequest())
                return StatusCode(403, new ApiResponse<LeagueDto> { Success = false, Message = "League creation is only available from the local server" });

            if (!await IsAdminAsync())
                return Forbid();

            // Validate parent league if specified
            if (request.ParentLeagueId.HasValue)
            {
                var parentExists = await _context.Leagues.AnyAsync(l => l.Id == request.ParentLeagueId.Value && l.IsActive);
                if (!parentExists)
                    return BadRequest(new ApiResponse<LeagueDto> { Success = false, Message = "Parent league not found" });
            }

            var league = new League
            {
                Name = request.Name,
                Description = request.Description,
                Scope = request.Scope,
                AvatarUrl = request.AvatarUrl,
                BannerUrl = request.BannerUrl,
                Website = request.Website,
                ContactEmail = request.ContactEmail,
                ParentLeagueId = request.ParentLeagueId,
                State = request.State,
                Region = request.Region,
                Country = request.Country ?? "USA",
                SortOrder = request.SortOrder,
                IsActive = true,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            _context.Leagues.Add(league);
            await _context.SaveChangesAsync();

            // Add current user as admin manager
            var userId = GetCurrentUserId();
            if (userId.HasValue)
            {
                var manager = new LeagueManager
                {
                    LeagueId = league.Id,
                    UserId = userId.Value,
                    Role = "Admin",
                    Title = "Administrator",
                    IsActive = true,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };
                _context.LeagueManagers.Add(manager);
                await _context.SaveChangesAsync();
            }

            var dto = new LeagueDto
            {
                Id = league.Id,
                Name = league.Name,
                Description = league.Description,
                Scope = league.Scope,
                AvatarUrl = league.AvatarUrl,
                State = league.State,
                Region = league.Region,
                Country = league.Country,
                ParentLeagueId = league.ParentLeagueId,
                CreatedAt = league.CreatedAt
            };

            return CreatedAtAction(nameof(GetLeague), new { id = league.Id },
                new ApiResponse<LeagueDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating league");
            return StatusCode(500, new ApiResponse<LeagueDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /leagues/{id} - Update league
    [HttpPut("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<LeagueDto>>> UpdateLeague(int id, [FromBody] UpdateLeagueDto request)
    {
        try
        {
            if (!await CanManageLeagueAsync(id))
                return Forbid();

            var league = await _context.Leagues.FindAsync(id);
            if (league == null)
                return NotFound(new ApiResponse<LeagueDto> { Success = false, Message = "League not found" });

            // Validate parent league if changing
            if (request.ParentLeagueId.HasValue && request.ParentLeagueId != league.ParentLeagueId)
            {
                // Prevent setting self as parent
                if (request.ParentLeagueId == id)
                    return BadRequest(new ApiResponse<LeagueDto> { Success = false, Message = "League cannot be its own parent" });

                // Check parent exists
                var parentExists = await _context.Leagues.AnyAsync(l => l.Id == request.ParentLeagueId.Value && l.IsActive);
                if (!parentExists)
                    return BadRequest(new ApiResponse<LeagueDto> { Success = false, Message = "Parent league not found" });

                // Prevent circular reference
                if (await WouldCreateCircularReferenceAsync(id, request.ParentLeagueId.Value))
                    return BadRequest(new ApiResponse<LeagueDto> { Success = false, Message = "This would create a circular reference" });
            }

            league.Name = request.Name;
            league.Description = request.Description;
            league.Scope = request.Scope;
            league.AvatarUrl = request.AvatarUrl;
            league.BannerUrl = request.BannerUrl;
            league.Website = request.Website;
            league.ContactEmail = request.ContactEmail;
            league.ParentLeagueId = request.ParentLeagueId;
            league.State = request.State;
            league.Region = request.Region;
            league.Country = request.Country ?? "USA";
            league.SortOrder = request.SortOrder;
            league.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            var dto = new LeagueDto
            {
                Id = league.Id,
                Name = league.Name,
                Description = league.Description,
                Scope = league.Scope,
                AvatarUrl = league.AvatarUrl,
                State = league.State,
                Region = league.Region,
                Country = league.Country,
                ParentLeagueId = league.ParentLeagueId,
                CreatedAt = league.CreatedAt
            };

            return Ok(new ApiResponse<LeagueDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating league {LeagueId}", id);
            return StatusCode(500, new ApiResponse<LeagueDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /leagues/{id} - Deactivate league (admin only)
    [HttpDelete("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> DeleteLeague(int id)
    {
        try
        {
            if (!await IsAdminAsync())
                return Forbid();

            var league = await _context.Leagues
                .Include(l => l.ChildLeagues)
                .FirstOrDefaultAsync(l => l.Id == id);

            if (league == null)
                return NotFound(new ApiResponse<object> { Success = false, Message = "League not found" });

            // Check if there are active child leagues
            if (league.ChildLeagues.Any(c => c.IsActive))
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Cannot delete league with active child leagues" });

            // Soft delete
            league.IsActive = false;
            league.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object> { Success = true, Message = "League deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting league {LeagueId}", id);
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /leagues/{id}/managers - Add manager
    [HttpPost("{id}/managers")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<LeagueManagerDto>>> AddManager(int id, [FromBody] ManageLeagueManagerDto request)
    {
        try
        {
            if (!await CanManageLeagueAsync(id))
                return Forbid();

            var league = await _context.Leagues.FindAsync(id);
            if (league == null)
                return NotFound(new ApiResponse<LeagueManagerDto> { Success = false, Message = "League not found" });

            // Check user exists
            var user = await _context.Users.FindAsync(request.UserId);
            if (user == null)
                return BadRequest(new ApiResponse<LeagueManagerDto> { Success = false, Message = "User not found" });

            // Check if already a manager
            var existing = await _context.LeagueManagers
                .FirstOrDefaultAsync(m => m.LeagueId == id && m.UserId == request.UserId);

            if (existing != null)
            {
                // Reactivate if inactive
                if (!existing.IsActive)
                {
                    existing.IsActive = true;
                    existing.Role = request.Role;
                    existing.Title = request.Title;
                    existing.UpdatedAt = DateTime.Now;
                    await _context.SaveChangesAsync();
                }
                else
                {
                    return BadRequest(new ApiResponse<LeagueManagerDto> { Success = false, Message = "User is already a manager" });
                }

                var existingDto = new LeagueManagerDto
                {
                    Id = existing.Id,
                    LeagueId = existing.LeagueId,
                    UserId = existing.UserId,
                    UserName = Utility.FormatName(user.LastName, user.FirstName),
                    UserProfileImageUrl = user.ProfileImageUrl,
                    Role = existing.Role,
                    Title = existing.Title,
                    IsActive = existing.IsActive,
                    CreatedAt = existing.CreatedAt
                };

                return Ok(new ApiResponse<LeagueManagerDto> { Success = true, Data = existingDto });
            }

            var manager = new LeagueManager
            {
                LeagueId = id,
                UserId = request.UserId,
                Role = request.Role,
                Title = request.Title,
                IsActive = true,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            _context.LeagueManagers.Add(manager);
            await _context.SaveChangesAsync();

            var dto = new LeagueManagerDto
            {
                Id = manager.Id,
                LeagueId = manager.LeagueId,
                UserId = manager.UserId,
                UserName = Utility.FormatName(user.LastName, user.FirstName),
                UserProfileImageUrl = user.ProfileImageUrl,
                Role = manager.Role,
                Title = manager.Title,
                IsActive = manager.IsActive,
                CreatedAt = manager.CreatedAt
            };

            return Ok(new ApiResponse<LeagueManagerDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding manager to league {LeagueId}", id);
            return StatusCode(500, new ApiResponse<LeagueManagerDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /leagues/{id}/managers/{managerId} - Update manager role
    [HttpPut("{id}/managers/{managerId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<LeagueManagerDto>>> UpdateManager(int id, int managerId, [FromBody] ManageLeagueManagerDto request)
    {
        try
        {
            if (!await CanManageLeagueAsync(id))
                return Forbid();

            var manager = await _context.LeagueManagers
                .Include(m => m.User)
                .FirstOrDefaultAsync(m => m.Id == managerId && m.LeagueId == id);

            if (manager == null)
                return NotFound(new ApiResponse<LeagueManagerDto> { Success = false, Message = "Manager not found" });

            manager.Role = request.Role;
            manager.Title = request.Title;
            manager.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            var dto = new LeagueManagerDto
            {
                Id = manager.Id,
                LeagueId = manager.LeagueId,
                UserId = manager.UserId,
                UserName = Utility.FormatName(manager.User?.LastName, manager.User?.FirstName),
                UserProfileImageUrl = manager.User?.ProfileImageUrl,
                Role = manager.Role,
                Title = manager.Title,
                IsActive = manager.IsActive,
                CreatedAt = manager.CreatedAt
            };

            return Ok(new ApiResponse<LeagueManagerDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating manager {ManagerId} in league {LeagueId}", managerId, id);
            return StatusCode(500, new ApiResponse<LeagueManagerDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /leagues/{id}/managers/{managerId} - Remove manager
    [HttpDelete("{id}/managers/{managerId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> RemoveManager(int id, int managerId)
    {
        try
        {
            if (!await CanManageLeagueAsync(id))
                return Forbid();

            var manager = await _context.LeagueManagers
                .FirstOrDefaultAsync(m => m.Id == managerId && m.LeagueId == id);

            if (manager == null)
                return NotFound(new ApiResponse<object> { Success = false, Message = "Manager not found" });

            // Prevent removing yourself if you're the last admin
            var userId = GetCurrentUserId();
            if (manager.UserId == userId)
            {
                var otherAdmins = await _context.LeagueManagers
                    .CountAsync(m => m.LeagueId == id && m.UserId != userId && m.IsActive);

                if (otherAdmins == 0)
                    return BadRequest(new ApiResponse<object> { Success = false, Message = "Cannot remove yourself as the last manager" });
            }

            // Soft delete
            manager.IsActive = false;
            manager.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object> { Success = true, Message = "Manager removed" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing manager {ManagerId} from league {LeagueId}", managerId, id);
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /leagues/{id}/clubs/request - Club requests to join (from club admin)
    [HttpPost("{id}/clubs/request")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<LeagueClubRequestDto>>> RequestJoinLeague(int id, [FromBody] RequestJoinLeagueDto request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<LeagueClubRequestDto> { Success = false, Message = "Not authenticated" });

            var league = await _context.Leagues.FindAsync(id);
            if (league == null || !league.IsActive)
                return NotFound(new ApiResponse<LeagueClubRequestDto> { Success = false, Message = "League not found" });

            // Use clubId from request body (RequestJoinLeagueDto should include ClubId)
            // For now, we'll need to pass the club ID - let me check if we need to add it
            var clubId = request.LeagueId; // This is a bit confusing - the DTO has LeagueId but we're in context of a club requesting
            // Actually let's look at the DTO again - RequestJoinLeagueDto has LeagueId and Message
            // We need the clubId to be passed. Let me check if there's a query param option

            // Actually, looking at the request route and typical use case:
            // The club admin would be requesting for their club to join
            // We should get the club ID from a query param or we should check which clubs the user can manage

            return BadRequest(new ApiResponse<LeagueClubRequestDto>
            {
                Success = false,
                Message = "Please use /clubs/{clubId}/leagues/request endpoint instead"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error requesting to join league {LeagueId}", id);
            return StatusCode(500, new ApiResponse<LeagueClubRequestDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubs/{clubId}/leagues/{leagueId}/request - Club requests to join
    [HttpPost("/clubs/{clubId}/leagues/{leagueId}/request")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<LeagueClubRequestDto>>> ClubRequestJoinLeague(int clubId, int leagueId, [FromBody] RequestJoinLeagueDto request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<LeagueClubRequestDto> { Success = false, Message = "Not authenticated" });

            // Check club exists and user is site admin or club admin
            var isSiteAdmin = await IsAdminAsync();
            var clubMember = await _context.ClubMembers
                .Include(m => m.Club)
                .FirstOrDefaultAsync(m => m.ClubId == clubId && m.UserId == userId.Value && m.IsActive);

            if (!isSiteAdmin && (clubMember == null || clubMember.Role != "Admin"))
                return Forbid();

            var league = await _context.Leagues
                .Include(l => l.ChildLeagues)
                .FirstOrDefaultAsync(l => l.Id == leagueId);
            if (league == null || !league.IsActive)
                return NotFound(new ApiResponse<LeagueClubRequestDto> { Success = false, Message = "League not found" });

            // Check if league is an end-node (no active children) - clubs can only join end-node leagues
            var hasActiveChildren = league.ChildLeagues.Any(c => c.IsActive);
            if (hasActiveChildren)
                return BadRequest(new ApiResponse<LeagueClubRequestDto>
                {
                    Success = false,
                    Message = "Clubs can only join end-level leagues (leagues without sub-leagues). Please select a specific sub-league to join."
                });

            // Check if already a member
            var existingMembership = await _context.LeagueClubs
                .AnyAsync(lc => lc.LeagueId == leagueId && lc.ClubId == clubId && lc.Status == "Active");

            if (existingMembership)
                return BadRequest(new ApiResponse<LeagueClubRequestDto> { Success = false, Message = "Club is already a member of this league" });

            // Check if there's a pending request
            var existingRequest = await _context.LeagueClubRequests
                .FirstOrDefaultAsync(r => r.LeagueId == leagueId && r.ClubId == clubId && r.Status == "Pending");

            if (existingRequest != null)
                return BadRequest(new ApiResponse<LeagueClubRequestDto> { Success = false, Message = "A request is already pending" });

            // Check if club is already a member of any league in the same hierarchy
            var (isAlreadyMember, existingLeagueName) = await IsClubMemberOfSameHierarchyAsync(clubId, leagueId);
            if (isAlreadyMember)
                return BadRequest(new ApiResponse<LeagueClubRequestDto>
                {
                    Success = false,
                    Message = $"Club is already a member of '{existingLeagueName}' in the same league hierarchy. A club can only belong to one league under the same root."
                });

            var clubRequest = new LeagueClubRequest
            {
                LeagueId = leagueId,
                ClubId = clubId,
                RequestedByUserId = userId.Value,
                Status = "Pending",
                Message = request.Message,
                CreatedAt = DateTime.Now
            };

            _context.LeagueClubRequests.Add(clubRequest);
            await _context.SaveChangesAsync();

            // Notify league managers about the join request
            var leagueManagerIds = await _context.LeagueManagers
                .Where(m => m.LeagueId == leagueId && m.IsActive)
                .Select(m => m.UserId)
                .ToListAsync();

            if (leagueManagerIds.Any())
            {
                var clubName = clubMember.Club?.Name ?? "A club";
                await _notificationService.CreateAndSendToUsersAsync(
                    leagueManagerIds,
                    "LeagueJoinRequest",
                    "New League Join Request",
                    $"{clubName} wants to join {league.Name}",
                    $"/leagues?id={leagueId}&tab=requests",
                    "LeagueClubRequest",
                    clubRequest.Id
                );
            }

            var dto = new LeagueClubRequestDto
            {
                Id = clubRequest.Id,
                LeagueId = leagueId,
                LeagueName = league.Name,
                ClubId = clubId,
                ClubName = clubMember.Club?.Name ?? "Unknown",
                ClubLogoUrl = clubMember.Club?.LogoUrl,
                ClubCity = clubMember.Club?.City,
                ClubState = clubMember.Club?.State,
                RequestedByUserId = userId.Value,
                Status = clubRequest.Status,
                Message = clubRequest.Message,
                CreatedAt = clubRequest.CreatedAt
            };

            return Ok(new ApiResponse<LeagueClubRequestDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error requesting to join league {LeagueId} from club {ClubId}", leagueId, clubId);
            return StatusCode(500, new ApiResponse<LeagueClubRequestDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /leagues/{id}/requests/{requestId}/process - Process join request
    [HttpPost("{id}/requests/{requestId}/process")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<LeagueClubDto>>> ProcessJoinRequest(int id, int requestId, [FromBody] ProcessClubRequestDto request)
    {
        try
        {
            if (!await CanManageLeagueAsync(id))
                return Forbid();

            var clubRequest = await _context.LeagueClubRequests
                .Include(r => r.Club)
                .FirstOrDefaultAsync(r => r.Id == requestId && r.LeagueId == id && r.Status == "Pending");

            if (clubRequest == null)
                return NotFound(new ApiResponse<LeagueClubDto> { Success = false, Message = "Request not found or already processed" });

            var userId = GetCurrentUserId();

            clubRequest.Status = request.Approve ? "Approved" : "Rejected";
            clubRequest.ResponseMessage = request.ResponseMessage;
            clubRequest.ProcessedByUserId = userId;
            clubRequest.ProcessedAt = DateTime.Now;

            LeagueClubDto? resultDto = null;

            if (request.Approve)
            {
                // Check if club is already a member of any league in the same hierarchy
                // (in case they joined another league while the request was pending)
                var (isAlreadyMember, existingLeagueName) = await IsClubMemberOfSameHierarchyAsync(clubRequest.ClubId, id);
                if (isAlreadyMember)
                {
                    // Auto-reject the request since they can't join
                    clubRequest.Status = "Rejected";
                    clubRequest.ResponseMessage = $"Club is already a member of '{existingLeagueName}' in the same league hierarchy. A club can only belong to one league under the same root.";
                    await _context.SaveChangesAsync();

                    return BadRequest(new ApiResponse<LeagueClubDto>
                    {
                        Success = false,
                        Message = clubRequest.ResponseMessage
                    });
                }

                // Add club to league
                var leagueClub = new LeagueClub
                {
                    LeagueId = id,
                    ClubId = clubRequest.ClubId,
                    Status = "Active",
                    JoinedAt = DateTime.Now,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };

                _context.LeagueClubs.Add(leagueClub);
                await _context.SaveChangesAsync();

                resultDto = new LeagueClubDto
                {
                    Id = leagueClub.Id,
                    LeagueId = leagueClub.LeagueId,
                    ClubId = leagueClub.ClubId,
                    ClubName = clubRequest.Club?.Name ?? "Unknown",
                    ClubLogoUrl = clubRequest.Club?.LogoUrl,
                    ClubCity = clubRequest.Club?.City,
                    ClubState = clubRequest.Club?.State,
                    Status = leagueClub.Status,
                    JoinedAt = leagueClub.JoinedAt
                };
            }
            else
            {
                await _context.SaveChangesAsync();
            }

            // Notify the club admins about the decision
            var clubAdminIds = await _context.ClubMembers
                .Where(m => m.ClubId == clubRequest.ClubId && m.IsActive && m.Role == "Admin")
                .Select(m => m.UserId)
                .ToListAsync();

            // Get league name for notification
            var leagueName = await _context.Leagues
                .Where(l => l.Id == id)
                .Select(l => l.Name)
                .FirstOrDefaultAsync() ?? "the league";

            var clubName = clubRequest.Club?.Name ?? "Your club";

            if (clubAdminIds.Any())
            {
                if (request.Approve)
                {
                    await _notificationService.CreateAndSendToUsersAsync(
                        clubAdminIds,
                        "LeagueJoinApproved",
                        "League Membership Approved!",
                        $"{clubName} has been accepted into {leagueName}",
                        $"/leagues?id={id}",
                        "League",
                        id
                    );
                }
                else
                {
                    await _notificationService.CreateAndSendToUsersAsync(
                        clubAdminIds,
                        "LeagueJoinRejected",
                        "League Request Update",
                        $"{clubName}'s request to join {leagueName} was not approved",
                        $"/clubs?id={clubRequest.ClubId}",
                        "Club",
                        clubRequest.ClubId
                    );
                }
            }

            return Ok(new ApiResponse<LeagueClubDto>
            {
                Success = true,
                Data = resultDto,
                Message = request.Approve ? "Club approved" : "Request rejected"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing request {RequestId} for league {LeagueId}", requestId, id);
            return StatusCode(500, new ApiResponse<LeagueClubDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /leagues/{id}/clubs/{clubMembershipId} - Update club membership
    [HttpPut("{id}/clubs/{clubMembershipId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<LeagueClubDto>>> UpdateClubMembership(int id, int clubMembershipId, [FromBody] UpdateLeagueClubDto request)
    {
        try
        {
            if (!await CanManageLeagueAsync(id))
                return Forbid();

            var leagueClub = await _context.LeagueClubs
                .Include(lc => lc.Club)
                .FirstOrDefaultAsync(lc => lc.Id == clubMembershipId && lc.LeagueId == id);

            if (leagueClub == null)
                return NotFound(new ApiResponse<LeagueClubDto> { Success = false, Message = "Club membership not found" });

            leagueClub.Status = request.Status;
            leagueClub.ExpiresAt = request.ExpiresAt;
            leagueClub.Notes = request.Notes;
            leagueClub.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            var dto = new LeagueClubDto
            {
                Id = leagueClub.Id,
                LeagueId = leagueClub.LeagueId,
                ClubId = leagueClub.ClubId,
                ClubName = leagueClub.Club?.Name ?? "Unknown",
                ClubLogoUrl = leagueClub.Club?.LogoUrl,
                ClubCity = leagueClub.Club?.City,
                ClubState = leagueClub.Club?.State,
                Status = leagueClub.Status,
                JoinedAt = leagueClub.JoinedAt,
                ExpiresAt = leagueClub.ExpiresAt,
                Notes = leagueClub.Notes
            };

            return Ok(new ApiResponse<LeagueClubDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating club membership {MembershipId} in league {LeagueId}", clubMembershipId, id);
            return StatusCode(500, new ApiResponse<LeagueClubDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /leagues/{id}/clubs/{clubMembershipId} - Remove club from league
    [HttpDelete("{id}/clubs/{clubMembershipId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> RemoveClub(int id, int clubMembershipId)
    {
        try
        {
            if (!await CanManageLeagueAsync(id))
                return Forbid();

            var leagueClub = await _context.LeagueClubs
                .FirstOrDefaultAsync(lc => lc.Id == clubMembershipId && lc.LeagueId == id);

            if (leagueClub == null)
                return NotFound(new ApiResponse<object> { Success = false, Message = "Club membership not found" });

            // Set to inactive rather than delete
            leagueClub.Status = "Inactive";
            leagueClub.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object> { Success = true, Message = "Club removed from league" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing club membership {MembershipId} from league {LeagueId}", clubMembershipId, id);
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /clubs/{clubId}/leagues - Get leagues a club belongs to
    [HttpGet("/clubs/{clubId}/leagues")]
    public async Task<ActionResult<ApiResponse<List<LeagueDto>>>> GetClubLeagues(int clubId)
    {
        try
        {
            var leagueClubs = await _context.LeagueClubs
                .Include(lc => lc.League)
                    .ThenInclude(l => l!.ParentLeague)
                .Where(lc => lc.ClubId == clubId && lc.Status == "Active" && lc.League!.IsActive)
                .ToListAsync();

            var leagues = new List<LeagueDto>();

            foreach (var lc in leagueClubs)
            {
                var league = lc.League!;

                // Find root league by traversing up the hierarchy
                var rootLeague = await FindRootLeagueAsync(league);

                leagues.Add(new LeagueDto
                {
                    Id = league.Id,
                    Name = league.Name,
                    Description = league.Description,
                    Scope = league.Scope,
                    AvatarUrl = league.AvatarUrl,
                    State = league.State,
                    Region = league.Region,
                    Country = league.Country,
                    ParentLeagueId = league.ParentLeagueId,
                    ParentLeagueName = league.ParentLeague?.Name,
                    RootLeagueId = rootLeague?.Id,
                    RootLeagueName = rootLeague?.Name,
                    RootLeagueAvatarUrl = rootLeague?.AvatarUrl,
                    CreatedAt = league.CreatedAt
                });
            }

            return Ok(new ApiResponse<List<LeagueDto>> { Success = true, Data = leagues });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting leagues for club {ClubId}", clubId);
            return StatusCode(500, new ApiResponse<List<LeagueDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // Helper to find the root (top-level) league in hierarchy
    private async Task<League?> FindRootLeagueAsync(League league)
    {
        var current = league;
        while (current.ParentLeagueId.HasValue)
        {
            current = await _context.Leagues.FindAsync(current.ParentLeagueId.Value);
            if (current == null) break;
        }
        // Return null if this league itself is the root (no hierarchy display needed)
        return current?.Id != league.Id ? current : null;
    }

    // Helper to get sort order for manager roles (lower = higher priority)
    private static int GetRoleSortOrder(string role)
    {
        return role?.ToLower() switch
        {
            "president" => 1,
            "vice president" => 2,
            "director" => 3,
            "secretary" => 4,
            "treasurer" => 5,
            "admin" => 6,
            "moderator" => 7,
            _ => 99 // Unknown roles at the end
        };
    }

    // Helper method to build breadcrumbs
    private async Task<List<LeagueBreadcrumbDto>> BuildBreadcrumbsAsync(League league)
    {
        var breadcrumbs = new List<LeagueBreadcrumbDto>();
        var current = league;

        // Build path from current to root
        while (current != null)
        {
            breadcrumbs.Insert(0, new LeagueBreadcrumbDto
            {
                Id = current.Id,
                Name = current.Name,
                Scope = current.Scope
            });

            if (current.ParentLeagueId.HasValue && current.ParentLeague == null)
            {
                current = await _context.Leagues.FindAsync(current.ParentLeagueId.Value);
            }
            else
            {
                current = current.ParentLeague;
            }
        }

        return breadcrumbs;
    }

    // Helper to check for circular reference
    private async Task<bool> WouldCreateCircularReferenceAsync(int leagueId, int proposedParentId)
    {
        var currentId = proposedParentId;
        var visited = new HashSet<int> { leagueId };

        while (currentId != 0)
        {
            if (visited.Contains(currentId))
                return true;

            visited.Add(currentId);

            var parent = await _context.Leagues
                .Where(l => l.Id == currentId)
                .Select(l => l.ParentLeagueId)
                .FirstOrDefaultAsync();

            currentId = parent ?? 0;
        }

        return false;
    }

    // Helper to get the root league ID (returns the league itself if it's the root)
    private async Task<int> GetRootLeagueIdAsync(int leagueId)
    {
        var currentId = leagueId;
        var maxIterations = 100; // Prevent infinite loops
        var iterations = 0;

        while (iterations < maxIterations)
        {
            iterations++;
            var parentId = await _context.Leagues
                .Where(l => l.Id == currentId)
                .Select(l => l.ParentLeagueId)
                .FirstOrDefaultAsync();

            if (!parentId.HasValue)
                return currentId; // This is the root

            currentId = parentId.Value;
        }

        return currentId;
    }

    // Helper to get all league IDs under a root (including the root itself)
    private async Task<HashSet<int>> GetAllLeaguesUnderRootAsync(int rootLeagueId)
    {
        var result = new HashSet<int>();
        var toProcess = new Queue<int>();
        toProcess.Enqueue(rootLeagueId);

        var maxIterations = 1000;
        var iterations = 0;

        while (toProcess.Count > 0 && iterations < maxIterations)
        {
            iterations++;
            var currentId = toProcess.Dequeue();

            if (result.Contains(currentId))
                continue;

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

    // Helper to check if a club is already a member of any league in the same hierarchy
    private async Task<(bool IsMember, string? ExistingLeagueName)> IsClubMemberOfSameHierarchyAsync(int clubId, int leagueId)
    {
        // Get the root league for the target league
        var rootLeagueId = await GetRootLeagueIdAsync(leagueId);

        // Get all leagues under this root
        var allLeaguesInHierarchy = await GetAllLeaguesUnderRootAsync(rootLeagueId);

        // Check if the club is already a member of any of these leagues
        var existingMembership = await _context.LeagueClubs
            .Include(lc => lc.League)
            .Where(lc => lc.ClubId == clubId && lc.Status == "Active")
            .ToListAsync();

        var conflictingMembership = existingMembership
            .FirstOrDefault(lc => allLeaguesInHierarchy.Contains(lc.LeagueId));

        if (conflictingMembership != null)
        {
            return (true, conflictingMembership.League?.Name ?? "Unknown League");
        }

        return (false, null);
    }

    // =====================
    // DOCUMENT ENDPOINTS
    // =====================

    // POST: /leagues/{id}/documents - Add document
    [HttpPost("{id}/documents")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<LeagueDocumentDto>>> AddDocument(int id, [FromBody] CreateLeagueDocumentDto request)
    {
        try
        {
            if (!await CanManageLeagueAsync(id))
                return Forbid();

            var league = await _context.Leagues.FindAsync(id);
            if (league == null || !league.IsActive)
                return NotFound(new ApiResponse<LeagueDocumentDto> { Success = false, Message = "League not found" });

            var userId = GetCurrentUserId();

            // Get next sort order
            var maxSortOrder = await _context.LeagueDocuments
                .Where(d => d.LeagueId == id && d.IsActive)
                .MaxAsync(d => (int?)d.SortOrder) ?? 0;

            var document = new LeagueDocument
            {
                LeagueId = id,
                Title = request.Title,
                Description = request.Description,
                FileUrl = request.FileUrl,
                FileName = request.FileName,
                FileType = request.FileType,
                FileSize = request.FileSize,
                SortOrder = request.SortOrder > 0 ? request.SortOrder : maxSortOrder + 1,
                IsPublic = request.IsPublic,
                IsActive = true,
                UploadedByUserId = userId,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            _context.LeagueDocuments.Add(document);
            await _context.SaveChangesAsync();

            var user = userId.HasValue ? await _context.Users.FindAsync(userId.Value) : null;

            var dto = new LeagueDocumentDto
            {
                Id = document.Id,
                LeagueId = document.LeagueId,
                Title = document.Title,
                Description = document.Description,
                FileUrl = document.FileUrl,
                FileName = document.FileName,
                FileType = document.FileType,
                FileSize = document.FileSize,
                SortOrder = document.SortOrder,
                IsPublic = document.IsPublic,
                IsActive = document.IsActive,
                CreatedAt = document.CreatedAt,
                UploadedByUserId = document.UploadedByUserId,
                UploadedByName = user != null ? Utility.FormatName(user.LastName, user.FirstName) : null
            };

            return Ok(new ApiResponse<LeagueDocumentDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding document to league {LeagueId}", id);
            return StatusCode(500, new ApiResponse<LeagueDocumentDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /leagues/{id}/documents/{documentId} - Update document
    [HttpPut("{id}/documents/{documentId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<LeagueDocumentDto>>> UpdateDocument(int id, int documentId, [FromBody] CreateLeagueDocumentDto request)
    {
        try
        {
            if (!await CanManageLeagueAsync(id))
                return Forbid();

            var document = await _context.LeagueDocuments
                .Include(d => d.UploadedBy)
                .FirstOrDefaultAsync(d => d.Id == documentId && d.LeagueId == id);

            if (document == null)
                return NotFound(new ApiResponse<LeagueDocumentDto> { Success = false, Message = "Document not found" });

            document.Title = request.Title;
            document.Description = request.Description;
            document.FileUrl = request.FileUrl;
            document.FileName = request.FileName;
            document.FileType = request.FileType;
            document.FileSize = request.FileSize;
            document.SortOrder = request.SortOrder;
            document.IsPublic = request.IsPublic;
            document.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            var dto = new LeagueDocumentDto
            {
                Id = document.Id,
                LeagueId = document.LeagueId,
                Title = document.Title,
                Description = document.Description,
                FileUrl = document.FileUrl,
                FileName = document.FileName,
                FileType = document.FileType,
                FileSize = document.FileSize,
                SortOrder = document.SortOrder,
                IsPublic = document.IsPublic,
                IsActive = document.IsActive,
                CreatedAt = document.CreatedAt,
                UploadedByUserId = document.UploadedByUserId,
                UploadedByName = document.UploadedBy != null ? Utility.FormatName(document.UploadedBy.LastName, document.UploadedBy.FirstName) : null
            };

            return Ok(new ApiResponse<LeagueDocumentDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating document {DocumentId} in league {LeagueId}", documentId, id);
            return StatusCode(500, new ApiResponse<LeagueDocumentDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /leagues/{id}/documents/{documentId} - Remove document
    [HttpDelete("{id}/documents/{documentId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> DeleteDocument(int id, int documentId)
    {
        try
        {
            if (!await CanManageLeagueAsync(id))
                return Forbid();

            var document = await _context.LeagueDocuments
                .FirstOrDefaultAsync(d => d.Id == documentId && d.LeagueId == id);

            if (document == null)
                return NotFound(new ApiResponse<object> { Success = false, Message = "Document not found" });

            // Soft delete
            document.IsActive = false;
            document.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object> { Success = true, Message = "Document deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting document {DocumentId} from league {LeagueId}", documentId, id);
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /leagues/{id}/documents/reorder - Reorder documents
    [HttpPut("{id}/documents/reorder")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> ReorderDocuments(int id, [FromBody] UpdateDocumentOrderDto request)
    {
        try
        {
            if (!await CanManageLeagueAsync(id))
                return Forbid();

            var documents = await _context.LeagueDocuments
                .Where(d => d.LeagueId == id && d.IsActive && request.DocumentIds.Contains(d.Id))
                .ToListAsync();

            for (int i = 0; i < request.DocumentIds.Count; i++)
            {
                var doc = documents.FirstOrDefault(d => d.Id == request.DocumentIds[i]);
                if (doc != null)
                {
                    doc.SortOrder = i + 1;
                    doc.UpdatedAt = DateTime.Now;
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object> { Success = true, Message = "Documents reordered" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reordering documents for league {LeagueId}", id);
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /leagues/{id}/avatar - Upload avatar (accepts URL)
    [HttpPost("{id}/avatar")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<LeagueDto>>> UpdateAvatar(int id, [FromBody] UpdateAvatarDto request)
    {
        try
        {
            if (!await CanManageLeagueAsync(id))
                return Forbid();

            var league = await _context.Leagues.FindAsync(id);
            if (league == null || !league.IsActive)
                return NotFound(new ApiResponse<LeagueDto> { Success = false, Message = "League not found" });

            league.AvatarUrl = request.AvatarUrl;
            league.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            var dto = new LeagueDto
            {
                Id = league.Id,
                Name = league.Name,
                AvatarUrl = league.AvatarUrl,
                Scope = league.Scope
            };

            return Ok(new ApiResponse<LeagueDto> { Success = true, Data = dto, Message = "Avatar updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating avatar for league {LeagueId}", id);
            return StatusCode(500, new ApiResponse<LeagueDto> { Success = false, Message = "An error occurred" });
        }
    }
}

// DTO for avatar update
public class UpdateAvatarDto
{
    public string? AvatarUrl { get; set; }
}
