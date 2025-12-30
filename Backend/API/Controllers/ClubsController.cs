using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class ClubsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ClubsController> _logger;

    public ClubsController(ApplicationDbContext context, ILogger<ClubsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    // GET: /clubs/search - Search for clubs
    [HttpGet("search")]
    public async Task<ActionResult<ApiResponse<PagedResult<ClubDto>>>> SearchClubs([FromQuery] ClubSearchRequest request)
    {
        try
        {
            var query = _context.Clubs
                .Where(c => c.IsActive && c.IsPublic)
                .AsQueryable();

            // Apply filters
            if (!string.IsNullOrWhiteSpace(request.Query))
            {
                var searchPattern = $"%{request.Query}%";
                query = query.Where(c =>
                    EF.Functions.Like(c.Name, searchPattern) ||
                    (c.Description != null && EF.Functions.Like(c.Description, searchPattern)));
            }

            if (!string.IsNullOrWhiteSpace(request.Country))
            {
                var countryPattern = $"%{request.Country}%";
                query = query.Where(c => c.Country != null && EF.Functions.Like(c.Country, countryPattern));
            }

            if (!string.IsNullOrWhiteSpace(request.State))
            {
                var statePattern = $"%{request.State}%";
                query = query.Where(c => c.State != null && EF.Functions.Like(c.State, statePattern));
            }

            if (!string.IsNullOrWhiteSpace(request.City))
            {
                var cityPattern = $"%{request.City}%";
                query = query.Where(c => c.City != null && EF.Functions.Like(c.City, cityPattern));
            }

            // Get clubs with member count
            var clubsWithCount = await query
                .Select(c => new
                {
                    Club = c,
                    MemberCount = c.Members.Count(m => m.IsActive)
                })
                .ToListAsync();

            // Apply distance filter if coordinates provided
            List<(Club club, int memberCount, double? distance)> clubsWithDistance;
            if (request.Latitude.HasValue && request.Longitude.HasValue)
            {
                clubsWithDistance = clubsWithCount
                    .Select(x =>
                    {
                        double? distance = null;
                        if (x.Club.Latitude.HasValue && x.Club.Longitude.HasValue)
                            distance = CalculateDistance(request.Latitude.Value, request.Longitude.Value, x.Club.Latitude.Value, x.Club.Longitude.Value);
                        return (club: x.Club, memberCount: x.MemberCount, distance);
                    })
                    .Where(x => !request.RadiusMiles.HasValue || x.distance == null || x.distance <= request.RadiusMiles.Value)
                    .OrderBy(x => x.distance ?? double.MaxValue)
                    .ToList();
            }
            else
            {
                clubsWithDistance = clubsWithCount
                    .Select(x => (club: x.Club, memberCount: x.MemberCount, distance: (double?)null))
                    .OrderByDescending(x => x.memberCount)
                    .ToList();
            }

            var totalCount = clubsWithDistance.Count;
            var pagedClubs = clubsWithDistance
                .Skip((request.Page - 1) * request.PageSize)
                .Take(request.PageSize)
                .ToList();

            var clubDtos = pagedClubs.Select(x => new ClubDto
            {
                Id = x.club.Id,
                Name = x.club.Name,
                Description = x.club.Description,
                LogoUrl = x.club.LogoUrl,
                City = x.club.City,
                State = x.club.State,
                Country = x.club.Country,
                IsPublic = x.club.IsPublic,
                MemberCount = x.memberCount,
                Distance = x.distance,
                CreatedAt = x.club.CreatedAt
            }).ToList();

            return Ok(new ApiResponse<PagedResult<ClubDto>>
            {
                Success = true,
                Data = new PagedResult<ClubDto>
                {
                    Items = clubDtos,
                    TotalCount = totalCount,
                    Page = request.Page,
                    PageSize = request.PageSize
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching clubs");
            return StatusCode(500, new ApiResponse<PagedResult<ClubDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /clubs/{id} - Get club details
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<ClubDetailDto>>> GetClub(int id)
    {
        try
        {
            var club = await _context.Clubs
                .Include(c => c.CreatedBy)
                .Include(c => c.Members.Where(m => m.IsActive))
                    .ThenInclude(m => m.User)
                .FirstOrDefaultAsync(c => c.Id == id && c.IsActive);

            if (club == null)
                return NotFound(new ApiResponse<ClubDetailDto> { Success = false, Message = "Club not found" });

            var userId = GetCurrentUserId();
            var membership = userId.HasValue
                ? club.Members.FirstOrDefault(m => m.UserId == userId.Value && m.IsActive)
                : null;

            var hasPendingRequest = userId.HasValue && await _context.ClubJoinRequests
                .AnyAsync(r => r.ClubId == id && r.UserId == userId.Value && r.Status == "Pending");

            var isAdmin = membership?.Role == "Admin";
            var isModerator = membership?.Role == "Moderator";

            var dto = new ClubDetailDto
            {
                Id = club.Id,
                Name = club.Name,
                Description = club.Description,
                LogoUrl = club.LogoUrl,
                BannerUrl = club.BannerUrl,
                Address = club.Address,
                City = club.City,
                State = club.State,
                Country = club.Country,
                PostalCode = club.PostalCode,
                Latitude = club.Latitude,
                Longitude = club.Longitude,
                Website = club.Website,
                Email = club.Email,
                Phone = club.Phone,
                IsPublic = club.IsPublic,
                RequiresApproval = club.RequiresApproval,
                InviteCode = isAdmin ? club.InviteCode : null, // Only show to admins
                MemberCount = club.Members.Count,
                CreatedAt = club.CreatedAt,
                CreatedByUserId = club.CreatedByUserId,
                CreatedByUserName = club.CreatedBy != null ? $"{club.CreatedBy.FirstName} {club.CreatedBy.LastName}".Trim() : null,
                IsMember = membership != null,
                IsAdmin = isAdmin,
                IsModerator = isModerator,
                HasPendingRequest = hasPendingRequest,
                RecentMembers = club.Members
                    .OrderByDescending(m => m.JoinedAt)
                    .Take(10)
                    .Select(m => new ClubMemberDto
                    {
                        Id = m.Id,
                        UserId = m.UserId,
                        Name = m.User != null ? $"{m.User.FirstName} {m.User.LastName}".Trim() : "",
                        ProfileImageUrl = m.User?.ProfileImageUrl,
                        ExperienceLevel = m.User?.ExperienceLevel,
                        Location = GetUserLocation(m.User),
                        Role = m.Role,
                        JoinedAt = m.JoinedAt
                    }).ToList()
            };

            return Ok(new ApiResponse<ClubDetailDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching club {ClubId}", id);
            return StatusCode(500, new ApiResponse<ClubDetailDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubs - Create a new club
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ClubDetailDto>>> CreateClub([FromBody] CreateClubDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ClubDetailDto> { Success = false, Message = "User not authenticated" });

            // Generate unique invite code
            var inviteCode = GenerateInviteCode();

            var club = new Club
            {
                Name = dto.Name,
                Description = dto.Description,
                LogoUrl = dto.LogoUrl,
                BannerUrl = dto.BannerUrl,
                Address = dto.Address,
                City = dto.City,
                State = dto.State,
                Country = dto.Country,
                PostalCode = dto.PostalCode,
                Latitude = dto.Latitude,
                Longitude = dto.Longitude,
                Website = dto.Website,
                Email = dto.Email,
                Phone = dto.Phone,
                IsPublic = dto.IsPublic,
                RequiresApproval = dto.RequiresApproval,
                InviteCode = inviteCode,
                CreatedByUserId = userId.Value
            };

            _context.Clubs.Add(club);
            await _context.SaveChangesAsync();

            // Add creator as Admin member
            var membership = new ClubMember
            {
                ClubId = club.Id,
                UserId = userId.Value,
                Role = "Admin"
            };

            _context.ClubMembers.Add(membership);
            await _context.SaveChangesAsync();

            // Return the created club
            return await GetClub(club.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating club");
            return StatusCode(500, new ApiResponse<ClubDetailDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /clubs/{id} - Update club
    [HttpPut("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ClubDetailDto>>> UpdateClub(int id, [FromBody] UpdateClubDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ClubDetailDto> { Success = false, Message = "User not authenticated" });

            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<ClubDetailDto> { Success = false, Message = "Club not found" });

            // Check if user is admin
            var isAdmin = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive);

            if (!isAdmin)
                return Forbid();

            club.Name = dto.Name;
            club.Description = dto.Description;
            club.LogoUrl = dto.LogoUrl;
            club.BannerUrl = dto.BannerUrl;
            club.Address = dto.Address;
            club.City = dto.City;
            club.State = dto.State;
            club.Country = dto.Country;
            club.PostalCode = dto.PostalCode;
            club.Latitude = dto.Latitude;
            club.Longitude = dto.Longitude;
            club.Website = dto.Website;
            club.Email = dto.Email;
            club.Phone = dto.Phone;
            club.IsPublic = dto.IsPublic;
            club.RequiresApproval = dto.RequiresApproval;
            club.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return await GetClub(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating club {ClubId}", id);
            return StatusCode(500, new ApiResponse<ClubDetailDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /clubs/{id} - Deactivate club (soft delete)
    [HttpDelete("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteClub(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Club not found" });

            // Check if user is admin
            var isAdmin = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive);

            if (!isAdmin)
                return Forbid();

            club.IsActive = false;
            club.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Club deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting club {ClubId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubs/{id}/join - Request to join a club
    [HttpPost("{id}/join")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> JoinClub(int id, [FromBody] JoinClubRequestDto? dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Club not found" });

            // Check if already a member
            var existingMembership = await _context.ClubMembers
                .FirstOrDefaultAsync(m => m.ClubId == id && m.UserId == userId.Value);

            if (existingMembership != null && existingMembership.IsActive)
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Already a member of this club" });

            // Check if has pending request
            var existingRequest = await _context.ClubJoinRequests
                .FirstOrDefaultAsync(r => r.ClubId == id && r.UserId == userId.Value && r.Status == "Pending");

            if (existingRequest != null)
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Already have a pending request" });

            // Check if joining via invite code
            var isInvited = !string.IsNullOrEmpty(dto?.InviteCode) && dto.InviteCode == club.InviteCode;

            // If no approval required or has valid invite code, add as member directly
            if (!club.RequiresApproval || isInvited)
            {
                if (existingMembership != null)
                {
                    existingMembership.IsActive = true;
                    existingMembership.JoinedAt = DateTime.UtcNow;
                }
                else
                {
                    var membership = new ClubMember
                    {
                        ClubId = id,
                        UserId = userId.Value,
                        Role = "Member"
                    };
                    _context.ClubMembers.Add(membership);
                }

                await _context.SaveChangesAsync();
                return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Joined club successfully" });
            }

            // Create join request
            var request = new ClubJoinRequest
            {
                ClubId = id,
                UserId = userId.Value,
                Message = dto?.Message
            };

            _context.ClubJoinRequests.Add(request);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Join request submitted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error joining club {ClubId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubs/{id}/leave - Leave a club
    [HttpPost("{id}/leave")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> LeaveClub(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var membership = await _context.ClubMembers
                .FirstOrDefaultAsync(m => m.ClubId == id && m.UserId == userId.Value && m.IsActive);

            if (membership == null)
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Not a member of this club" });

            // Check if last admin
            if (membership.Role == "Admin")
            {
                var adminCount = await _context.ClubMembers
                    .CountAsync(m => m.ClubId == id && m.Role == "Admin" && m.IsActive);

                if (adminCount == 1)
                    return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot leave club as the only admin. Transfer admin rights first." });
            }

            membership.IsActive = false;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Left club successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error leaving club {ClubId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /clubs/{id}/members - Get club members
    [HttpGet("{id}/members")]
    public async Task<ActionResult<ApiResponse<List<ClubMemberDto>>>> GetMembers(int id)
    {
        try
        {
            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<List<ClubMemberDto>> { Success = false, Message = "Club not found" });

            var members = await _context.ClubMembers
                .Include(m => m.User)
                .Where(m => m.ClubId == id && m.IsActive)
                .OrderBy(m => m.Role == "Admin" ? 0 : m.Role == "Moderator" ? 1 : 2)
                .ThenBy(m => m.JoinedAt)
                .Select(m => new ClubMemberDto
                {
                    Id = m.Id,
                    UserId = m.UserId,
                    Name = m.User != null ? (m.User.FirstName + " " + m.User.LastName).Trim() : "",
                    ProfileImageUrl = m.User != null ? m.User.ProfileImageUrl : null,
                    ExperienceLevel = m.User != null ? m.User.ExperienceLevel : null,
                    Location = m.User != null ? GetUserLocationStatic(m.User.City, m.User.State) : null,
                    Role = m.Role,
                    JoinedAt = m.JoinedAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<ClubMemberDto>> { Success = true, Data = members });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching club members {ClubId}", id);
            return StatusCode(500, new ApiResponse<List<ClubMemberDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /clubs/{id}/members/{memberId}/role - Update member role
    [HttpPut("{id}/members/{memberId}/role")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateMemberRole(int id, int memberId, [FromBody] UpdateMemberRoleDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            // Check if user is admin
            var isAdmin = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive);

            if (!isAdmin)
                return Forbid();

            var membership = await _context.ClubMembers.FindAsync(memberId);
            if (membership == null || membership.ClubId != id || !membership.IsActive)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Member not found" });

            // Validate role
            if (!new[] { "Admin", "Moderator", "Member" }.Contains(dto.Role))
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Invalid role" });

            // Cannot demote the last admin
            if (membership.Role == "Admin" && dto.Role != "Admin")
            {
                var adminCount = await _context.ClubMembers
                    .CountAsync(m => m.ClubId == id && m.Role == "Admin" && m.IsActive);

                if (adminCount == 1)
                    return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot demote the only admin" });
            }

            membership.Role = dto.Role;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Role updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating member role");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /clubs/{id}/members/{memberId} - Remove member
    [HttpDelete("{id}/members/{memberId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> RemoveMember(int id, int memberId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            // Check if user is admin or moderator
            var userMembership = await _context.ClubMembers
                .FirstOrDefaultAsync(m => m.ClubId == id && m.UserId == userId.Value && m.IsActive);

            if (userMembership == null || (userMembership.Role != "Admin" && userMembership.Role != "Moderator"))
                return Forbid();

            var membership = await _context.ClubMembers.FindAsync(memberId);
            if (membership == null || membership.ClubId != id || !membership.IsActive)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Member not found" });

            // Cannot remove an admin unless you are an admin
            if (membership.Role == "Admin" && userMembership.Role != "Admin")
                return Forbid();

            // Cannot remove yourself
            if (membership.UserId == userId.Value)
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot remove yourself. Use leave instead." });

            membership.IsActive = false;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Member removed" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing member");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /clubs/{id}/requests - Get pending join requests
    [HttpGet("{id}/requests")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<ClubJoinRequestDto>>>> GetJoinRequests(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<ClubJoinRequestDto>> { Success = false, Message = "User not authenticated" });

            // Check if user is admin or moderator
            var isAdminOrMod = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value &&
                    (m.Role == "Admin" || m.Role == "Moderator") && m.IsActive);

            if (!isAdminOrMod)
                return Forbid();

            var requests = await _context.ClubJoinRequests
                .Include(r => r.User)
                .Include(r => r.Club)
                .Where(r => r.ClubId == id && r.Status == "Pending")
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new ClubJoinRequestDto
                {
                    Id = r.Id,
                    ClubId = r.ClubId,
                    ClubName = r.Club != null ? r.Club.Name : "",
                    UserId = r.UserId,
                    UserName = r.User != null ? (r.User.FirstName + " " + r.User.LastName).Trim() : "",
                    UserProfileImageUrl = r.User != null ? r.User.ProfileImageUrl : null,
                    UserExperienceLevel = r.User != null ? r.User.ExperienceLevel : null,
                    UserLocation = r.User != null ? GetUserLocationStatic(r.User.City, r.User.State) : null,
                    Message = r.Message,
                    Status = r.Status,
                    CreatedAt = r.CreatedAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<ClubJoinRequestDto>> { Success = true, Data = requests });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching join requests");
            return StatusCode(500, new ApiResponse<List<ClubJoinRequestDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubs/{id}/requests/{requestId}/review - Approve or reject join request
    [HttpPost("{id}/requests/{requestId}/review")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> ReviewJoinRequest(int id, int requestId, [FromBody] ReviewJoinRequestDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            // Check if user is admin or moderator
            var isAdminOrMod = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value &&
                    (m.Role == "Admin" || m.Role == "Moderator") && m.IsActive);

            if (!isAdminOrMod)
                return Forbid();

            var request = await _context.ClubJoinRequests.FindAsync(requestId);
            if (request == null || request.ClubId != id || request.Status != "Pending")
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Request not found" });

            request.Status = dto.Approve ? "Approved" : "Rejected";
            request.ReviewedByUserId = userId.Value;
            request.ReviewedAt = DateTime.UtcNow;

            if (dto.Approve)
            {
                // Add as member
                var existingMembership = await _context.ClubMembers
                    .FirstOrDefaultAsync(m => m.ClubId == id && m.UserId == request.UserId);

                if (existingMembership != null)
                {
                    existingMembership.IsActive = true;
                    existingMembership.JoinedAt = DateTime.UtcNow;
                }
                else
                {
                    var membership = new ClubMember
                    {
                        ClubId = id,
                        UserId = request.UserId,
                        Role = "Member"
                    };
                    _context.ClubMembers.Add(membership);
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = dto.Approve ? "Request approved" : "Request rejected" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reviewing join request");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubs/{id}/notifications - Send notification to all members
    [HttpPost("{id}/notifications")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ClubNotificationDto>>> SendNotification(int id, [FromBody] SendClubNotificationDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ClubNotificationDto> { Success = false, Message = "User not authenticated" });

            // Check if user is admin or moderator
            var isAdminOrMod = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value &&
                    (m.Role == "Admin" || m.Role == "Moderator") && m.IsActive);

            if (!isAdminOrMod)
                return Forbid();

            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<ClubNotificationDto> { Success = false, Message = "Club not found" });

            var notification = new ClubNotification
            {
                ClubId = id,
                SentByUserId = userId.Value,
                Title = dto.Title,
                Message = dto.Message
            };

            _context.ClubNotifications.Add(notification);
            await _context.SaveChangesAsync();

            var user = await _context.Users.FindAsync(userId.Value);

            return Ok(new ApiResponse<ClubNotificationDto>
            {
                Success = true,
                Data = new ClubNotificationDto
                {
                    Id = notification.Id,
                    ClubId = notification.ClubId,
                    ClubName = club.Name,
                    SentByUserId = notification.SentByUserId,
                    SentByUserName = user != null ? $"{user.FirstName} {user.LastName}".Trim() : "",
                    Title = notification.Title,
                    Message = notification.Message,
                    SentAt = notification.SentAt
                },
                Message = "Notification sent"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending notification");
            return StatusCode(500, new ApiResponse<ClubNotificationDto> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /clubs/{id}/notifications - Get club notifications
    [HttpGet("{id}/notifications")]
    public async Task<ActionResult<ApiResponse<List<ClubNotificationDto>>>> GetNotifications(int id, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        try
        {
            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<List<ClubNotificationDto>> { Success = false, Message = "Club not found" });

            var notifications = await _context.ClubNotifications
                .Include(n => n.SentBy)
                .Include(n => n.Club)
                .Where(n => n.ClubId == id)
                .OrderByDescending(n => n.SentAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(n => new ClubNotificationDto
                {
                    Id = n.Id,
                    ClubId = n.ClubId,
                    ClubName = n.Club != null ? n.Club.Name : "",
                    SentByUserId = n.SentByUserId,
                    SentByUserName = n.SentBy != null ? (n.SentBy.FirstName + " " + n.SentBy.LastName).Trim() : "",
                    Title = n.Title,
                    Message = n.Message,
                    SentAt = n.SentAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<ClubNotificationDto>> { Success = true, Data = notifications });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching notifications");
            return StatusCode(500, new ApiResponse<List<ClubNotificationDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /clubs/my - Get clubs I belong to or manage
    [HttpGet("my")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<MyClubsDto>>> GetMyClubs()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<MyClubsDto> { Success = false, Message = "User not authenticated" });

            var memberships = await _context.ClubMembers
                .Include(m => m.Club)
                .Where(m => m.UserId == userId.Value && m.IsActive && m.Club != null && m.Club.IsActive)
                .ToListAsync();

            var clubsIManage = memberships
                .Where(m => m.Role == "Admin" || m.Role == "Moderator")
                .Select(m => new ClubDto
                {
                    Id = m.Club!.Id,
                    Name = m.Club.Name,
                    Description = m.Club.Description,
                    LogoUrl = m.Club.LogoUrl,
                    City = m.Club.City,
                    State = m.Club.State,
                    Country = m.Club.Country,
                    IsPublic = m.Club.IsPublic,
                    MemberCount = _context.ClubMembers.Count(cm => cm.ClubId == m.ClubId && cm.IsActive),
                    CreatedAt = m.Club.CreatedAt
                })
                .ToList();

            var clubsIBelong = memberships
                .Where(m => m.Role == "Member")
                .Select(m => new ClubDto
                {
                    Id = m.Club!.Id,
                    Name = m.Club.Name,
                    Description = m.Club.Description,
                    LogoUrl = m.Club.LogoUrl,
                    City = m.Club.City,
                    State = m.Club.State,
                    Country = m.Club.Country,
                    IsPublic = m.Club.IsPublic,
                    MemberCount = _context.ClubMembers.Count(cm => cm.ClubId == m.ClubId && cm.IsActive),
                    CreatedAt = m.Club.CreatedAt
                })
                .ToList();

            var pendingRequests = await _context.ClubJoinRequests
                .Include(r => r.Club)
                .Where(r => r.UserId == userId.Value && r.Status == "Pending" && r.Club != null && r.Club.IsActive)
                .Select(r => new ClubJoinRequestDto
                {
                    Id = r.Id,
                    ClubId = r.ClubId,
                    ClubName = r.Club != null ? r.Club.Name : "",
                    Status = r.Status,
                    Message = r.Message,
                    CreatedAt = r.CreatedAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<MyClubsDto>
            {
                Success = true,
                Data = new MyClubsDto
                {
                    ClubsIManage = clubsIManage,
                    ClubsIBelong = clubsIBelong,
                    PendingRequests = pendingRequests
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching my clubs");
            return StatusCode(500, new ApiResponse<MyClubsDto> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /clubs/{id}/invite-link - Get invite link for club
    [HttpGet("{id}/invite-link")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<string>>> GetInviteLink(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<string> { Success = false, Message = "User not authenticated" });

            // Check if user is admin
            var isAdmin = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive);

            if (!isAdmin)
                return Forbid();

            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<string> { Success = false, Message = "Club not found" });

            // Regenerate invite code if doesn't exist
            if (string.IsNullOrEmpty(club.InviteCode))
            {
                club.InviteCode = GenerateInviteCode();
                await _context.SaveChangesAsync();
            }

            return Ok(new ApiResponse<string> { Success = true, Data = club.InviteCode });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting invite link");
            return StatusCode(500, new ApiResponse<string> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubs/{id}/regenerate-invite - Regenerate invite code
    [HttpPost("{id}/regenerate-invite")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<string>>> RegenerateInviteCode(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<string> { Success = false, Message = "User not authenticated" });

            // Check if user is admin
            var isAdmin = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive);

            if (!isAdmin)
                return Forbid();

            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<string> { Success = false, Message = "Club not found" });

            club.InviteCode = GenerateInviteCode();
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<string> { Success = true, Data = club.InviteCode, Message = "Invite code regenerated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error regenerating invite code");
            return StatusCode(500, new ApiResponse<string> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /clubs/join/{inviteCode} - Get club info by invite code
    [HttpGet("join/{inviteCode}")]
    public async Task<ActionResult<ApiResponse<ClubDto>>> GetClubByInviteCode(string inviteCode)
    {
        try
        {
            var club = await _context.Clubs
                .FirstOrDefaultAsync(c => c.InviteCode == inviteCode && c.IsActive);

            if (club == null)
                return NotFound(new ApiResponse<ClubDto> { Success = false, Message = "Invalid invite code" });

            var memberCount = await _context.ClubMembers
                .CountAsync(m => m.ClubId == club.Id && m.IsActive);

            var dto = new ClubDto
            {
                Id = club.Id,
                Name = club.Name,
                Description = club.Description,
                LogoUrl = club.LogoUrl,
                City = club.City,
                State = club.State,
                Country = club.Country,
                IsPublic = club.IsPublic,
                MemberCount = memberCount,
                CreatedAt = club.CreatedAt
            };

            return Ok(new ApiResponse<ClubDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting club by invite code");
            return StatusCode(500, new ApiResponse<ClubDto> { Success = false, Message = "An error occurred" });
        }
    }

    // Helper methods
    private static string GenerateInviteCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();
        return new string(Enumerable.Repeat(chars, 8).Select(s => s[random.Next(s.Length)]).ToArray());
    }

    private static double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 3959; // Earth's radius in miles
        var lat1Rad = lat1 * Math.PI / 180;
        var lat2Rad = lat2 * Math.PI / 180;
        var deltaLat = (lat2 - lat1) * Math.PI / 180;
        var deltaLon = (lon2 - lon1) * Math.PI / 180;

        var a = Math.Sin(deltaLat / 2) * Math.Sin(deltaLat / 2) +
                Math.Cos(lat1Rad) * Math.Cos(lat2Rad) *
                Math.Sin(deltaLon / 2) * Math.Sin(deltaLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

        return R * c;
    }

    private static string? GetUserLocation(User? user)
    {
        if (user == null) return null;
        return GetUserLocationStatic(user.City, user.State);
    }

    private static string? GetUserLocationStatic(string? city, string? state)
    {
        if (!string.IsNullOrEmpty(city) && !string.IsNullOrEmpty(state))
            return $"{city}, {state}";
        if (!string.IsNullOrEmpty(city))
            return city;
        if (!string.IsNullOrEmpty(state))
            return state;
        return null;
    }
}
