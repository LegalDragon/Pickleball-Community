using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using System.Data;
using System.Security.Claims;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Services;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class FriendsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<FriendsController> _logger;
    private readonly INotificationService _notificationService;

    public FriendsController(
        ApplicationDbContext context,
        ILogger<FriendsController> logger,
        INotificationService notificationService)
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

    // GET: /friends - Get all friends
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<FriendDto>>>> GetFriends()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<FriendDto>> { Success = false, Message = "User not authenticated" });

            // Try stored procedure first
            try
            {
                var friends = await GetFriendsWithStoredProcedure(userId.Value);
                return Ok(new ApiResponse<List<FriendDto>> { Success = true, Data = friends });
            }
            catch (Exception spEx)
            {
                _logger.LogWarning(spEx, "Stored procedure sp_GetFriendsList not available, falling back to LINQ");
            }

            // Fallback to LINQ
            var friendships = await _context.Friendships
                .Include(f => f.User1)
                .Include(f => f.User2)
                .Where(f => f.UserId1 == userId.Value || f.UserId2 == userId.Value)
                .ToListAsync();

            var friendsList = friendships.Select(f =>
            {
                var friendUser = f.UserId1 == userId.Value ? f.User2 : f.User1;
                return new FriendDto
                {
                    Id = f.Id,
                    FriendUserId = friendUser!.Id,
                    Name = $"{friendUser.FirstName} {friendUser.LastName}".Trim(),
                    ProfileImageUrl = friendUser.ProfileImageUrl,
                    ExperienceLevel = friendUser.ExperienceLevel,
                    PlayingStyle = friendUser.PlayingStyle,
                    Location = !string.IsNullOrEmpty(friendUser.City) && !string.IsNullOrEmpty(friendUser.State)
                        ? $"{friendUser.City}, {friendUser.State}"
                        : friendUser.City ?? friendUser.State,
                    PaddleBrand = friendUser.PaddleBrand,
                    FriendsSince = f.FriendsSince
                };
            }).ToList();

            return Ok(new ApiResponse<List<FriendDto>> { Success = true, Data = friendsList });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching friends");
            return StatusCode(500, new ApiResponse<List<FriendDto>> { Success = false, Message = "An error occurred" });
        }
    }

    private async Task<List<FriendDto>> GetFriendsWithStoredProcedure(int userId)
    {
        var results = new List<FriendDto>();
        var connectionString = _context.Database.GetConnectionString();

        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();

        using var command = new SqlCommand("sp_GetFriendsList", connection);
        command.CommandType = CommandType.StoredProcedure;
        command.Parameters.AddWithValue("@CurrentUserId", userId);

        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            results.Add(new FriendDto
            {
                Id = reader.GetInt32(reader.GetOrdinal("Id")),
                FriendUserId = reader.GetInt32(reader.GetOrdinal("FriendUserId")),
                Name = reader.IsDBNull(reader.GetOrdinal("Name")) ? "" : reader.GetString(reader.GetOrdinal("Name")),
                ProfileImageUrl = reader.IsDBNull(reader.GetOrdinal("ProfileImageUrl")) ? null : reader.GetString(reader.GetOrdinal("ProfileImageUrl")),
                ExperienceLevel = reader.IsDBNull(reader.GetOrdinal("ExperienceLevel")) ? null : reader.GetString(reader.GetOrdinal("ExperienceLevel")),
                PlayingStyle = reader.IsDBNull(reader.GetOrdinal("PlayingStyle")) ? null : reader.GetString(reader.GetOrdinal("PlayingStyle")),
                Location = reader.IsDBNull(reader.GetOrdinal("Location")) ? null : reader.GetString(reader.GetOrdinal("Location")),
                PaddleBrand = reader.IsDBNull(reader.GetOrdinal("PaddleBrand")) ? null : reader.GetString(reader.GetOrdinal("PaddleBrand")),
                FriendsSince = reader.GetDateTime(reader.GetOrdinal("FriendsSince"))
            });
        }

        return results;
    }

    // GET: /friends/search - Search for players by first name, last name, city, state, email, or phone
    [HttpGet("search")]
    public async Task<ActionResult<ApiResponse<List<PlayerSearchResultDto>>>> SearchPlayers(
        [FromQuery] string? firstName,
        [FromQuery] string? lastName,
        [FromQuery] string? city,
        [FromQuery] string? state,
        [FromQuery] string? email,
        [FromQuery] string? phone)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<PlayerSearchResultDto>> { Success = false, Message = "User not authenticated" });

            // Check if at least one search parameter is provided
            if (string.IsNullOrWhiteSpace(firstName) && string.IsNullOrWhiteSpace(lastName) &&
                string.IsNullOrWhiteSpace(city) && string.IsNullOrWhiteSpace(state) &&
                string.IsNullOrWhiteSpace(email) && string.IsNullOrWhiteSpace(phone))
                return Ok(new ApiResponse<List<PlayerSearchResultDto>> { Success = true, Data = new List<PlayerSearchResultDto>() });

            // Get existing friend user IDs
            var friendUserIds = await _context.Friendships
                .Where(f => f.UserId1 == userId.Value || f.UserId2 == userId.Value)
                .Select(f => f.UserId1 == userId.Value ? f.UserId2 : f.UserId1)
                .ToListAsync();

            // Get users with pending requests
            var pendingRequestUserIds = await _context.FriendRequests
                .Where(fr => (fr.SenderId == userId.Value || fr.RecipientId == userId.Value) && fr.Status == "Pending")
                .Select(fr => fr.SenderId == userId.Value ? fr.RecipientId : fr.SenderId)
                .ToListAsync();

            // Build query
            var query = _context.Users.Where(u => u.Id != userId.Value && u.IsActive);

            // Email and phone use exact match for privacy
            if (!string.IsNullOrWhiteSpace(email))
                query = query.Where(u => u.Email != null && u.Email.ToLower() == email.ToLower().Trim());

            if (!string.IsNullOrWhiteSpace(phone))
            {
                // Normalize phone by removing non-digits for comparison
                var normalizedPhone = new string(phone.Where(char.IsDigit).ToArray());
                query = query.Where(u => u.Phone != null && u.Phone.Replace("-", "").Replace(" ", "").Replace("(", "").Replace(")", "").Replace("+", "") == normalizedPhone);
            }

            // Name and location use partial match
            if (!string.IsNullOrWhiteSpace(firstName))
                query = query.Where(u => EF.Functions.Like(u.FirstName ?? "", $"%{firstName}%"));

            if (!string.IsNullOrWhiteSpace(lastName))
                query = query.Where(u => EF.Functions.Like(u.LastName ?? "", $"%{lastName}%"));

            if (!string.IsNullOrWhiteSpace(city))
                query = query.Where(u => EF.Functions.Like(u.City ?? "", $"%{city}%"));

            if (!string.IsNullOrWhiteSpace(state))
                query = query.Where(u => EF.Functions.Like(u.State ?? "", $"%{state}%"));

            var usersData = await query.Take(20).ToListAsync();

            var usersList = usersData.Select(u => new PlayerSearchResultDto
            {
                Id = u.Id,
                Name = $"{u.FirstName} {u.LastName}".Trim(),
                ProfileImageUrl = u.ProfileImageUrl,
                ExperienceLevel = u.ExperienceLevel,
                Location = !string.IsNullOrEmpty(u.City) && !string.IsNullOrEmpty(u.State)
                    ? $"{u.City}, {u.State}"
                    : u.City ?? u.State,
                IsFriend = friendUserIds.Contains(u.Id),
                HasPendingRequest = pendingRequestUserIds.Contains(u.Id)
            }).ToList();

            return Ok(new ApiResponse<List<PlayerSearchResultDto>> { Success = true, Data = usersList });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching players");
            return StatusCode(500, new ApiResponse<List<PlayerSearchResultDto>> { Success = false, Message = "An error occurred" });
        }
    }

    private async Task<List<PlayerSearchResultDto>> SearchPlayersWithStoredProcedure(
        int userId, string? firstName, string? lastName, string? city, string? state)
    {
        var results = new List<PlayerSearchResultDto>();
        var connectionString = _context.Database.GetConnectionString();

        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();

        using var command = new SqlCommand("sp_SearchUsersForFriends", connection);
        command.CommandType = CommandType.StoredProcedure;
        command.Parameters.AddWithValue("@CurrentUserId", userId);
        command.Parameters.AddWithValue("@FirstName", (object?)firstName ?? DBNull.Value);
        command.Parameters.AddWithValue("@LastName", (object?)lastName ?? DBNull.Value);
        command.Parameters.AddWithValue("@City", (object?)city ?? DBNull.Value);
        command.Parameters.AddWithValue("@State", (object?)state ?? DBNull.Value);
        command.Parameters.AddWithValue("@MaxResults", 20);

        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            results.Add(new PlayerSearchResultDto
            {
                Id = reader.GetInt32(reader.GetOrdinal("Id")),
                Name = reader.IsDBNull(reader.GetOrdinal("Name")) ? "" : reader.GetString(reader.GetOrdinal("Name")),
                ProfileImageUrl = reader.IsDBNull(reader.GetOrdinal("ProfileImageUrl")) ? null : reader.GetString(reader.GetOrdinal("ProfileImageUrl")),
                ExperienceLevel = reader.IsDBNull(reader.GetOrdinal("ExperienceLevel")) ? null : reader.GetString(reader.GetOrdinal("ExperienceLevel")),
                Location = reader.IsDBNull(reader.GetOrdinal("Location")) ? null : reader.GetString(reader.GetOrdinal("Location")),
                IsFriend = reader.GetInt32(reader.GetOrdinal("IsFriend")) == 1,
                HasPendingRequest = reader.GetInt32(reader.GetOrdinal("HasPendingRequest")) == 1
            });
        }

        return results;
    }

    // GET: /friends/requests/pending - Get pending friend requests received
    [HttpGet("requests/pending")]
    public async Task<ActionResult<ApiResponse<List<FriendRequestDto>>>> GetPendingRequests()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<FriendRequestDto>> { Success = false, Message = "User not authenticated" });

            // Try stored procedure first
            try
            {
                var requests = await GetPendingRequestsWithStoredProcedure(userId.Value);
                return Ok(new ApiResponse<List<FriendRequestDto>> { Success = true, Data = requests });
            }
            catch (Exception spEx)
            {
                _logger.LogWarning(spEx, "Stored procedure sp_GetPendingFriendRequests not available, falling back to LINQ");
            }

            // Fallback to LINQ
            var pendingData = await _context.FriendRequests
                .Include(fr => fr.Sender)
                .Where(fr => fr.RecipientId == userId.Value && fr.Status == "Pending")
                .OrderByDescending(fr => fr.CreatedAt)
                .ToListAsync();

            var pendingList = pendingData.Select(fr => new FriendRequestDto
            {
                Id = fr.Id,
                Status = fr.Status,
                Message = fr.Message,
                CreatedAt = fr.CreatedAt,
                Sender = new UserSummaryDto
                {
                    Id = fr.Sender!.Id,
                    Name = $"{fr.Sender.FirstName} {fr.Sender.LastName}".Trim(),
                    ProfileImageUrl = fr.Sender.ProfileImageUrl,
                    ExperienceLevel = fr.Sender.ExperienceLevel,
                    PlayingStyle = fr.Sender.PlayingStyle,
                    Location = !string.IsNullOrEmpty(fr.Sender.City) && !string.IsNullOrEmpty(fr.Sender.State)
                        ? $"{fr.Sender.City}, {fr.Sender.State}"
                        : fr.Sender.City ?? fr.Sender.State
                }
            }).ToList();

            return Ok(new ApiResponse<List<FriendRequestDto>> { Success = true, Data = pendingList });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching pending requests");
            return StatusCode(500, new ApiResponse<List<FriendRequestDto>> { Success = false, Message = "An error occurred" });
        }
    }

    private async Task<List<FriendRequestDto>> GetPendingRequestsWithStoredProcedure(int userId)
    {
        var results = new List<FriendRequestDto>();
        var connectionString = _context.Database.GetConnectionString();

        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();

        using var command = new SqlCommand("sp_GetPendingFriendRequests", connection);
        command.CommandType = CommandType.StoredProcedure;
        command.Parameters.AddWithValue("@CurrentUserId", userId);

        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            results.Add(new FriendRequestDto
            {
                Id = reader.GetInt32(reader.GetOrdinal("Id")),
                Status = reader.GetString(reader.GetOrdinal("Status")),
                Message = reader.IsDBNull(reader.GetOrdinal("Message")) ? null : reader.GetString(reader.GetOrdinal("Message")),
                CreatedAt = reader.GetDateTime(reader.GetOrdinal("CreatedAt")),
                Sender = new UserSummaryDto
                {
                    Id = reader.GetInt32(reader.GetOrdinal("SenderId")),
                    Name = reader.IsDBNull(reader.GetOrdinal("SenderName")) ? "" : reader.GetString(reader.GetOrdinal("SenderName")),
                    ProfileImageUrl = reader.IsDBNull(reader.GetOrdinal("SenderProfileImageUrl")) ? null : reader.GetString(reader.GetOrdinal("SenderProfileImageUrl")),
                    ExperienceLevel = reader.IsDBNull(reader.GetOrdinal("SenderExperienceLevel")) ? null : reader.GetString(reader.GetOrdinal("SenderExperienceLevel")),
                    PlayingStyle = reader.IsDBNull(reader.GetOrdinal("SenderPlayingStyle")) ? null : reader.GetString(reader.GetOrdinal("SenderPlayingStyle")),
                    Location = reader.IsDBNull(reader.GetOrdinal("SenderLocation")) ? null : reader.GetString(reader.GetOrdinal("SenderLocation"))
                }
            });
        }

        return results;
    }

    // GET: /friends/requests/sent - Get sent friend requests awaiting response
    [HttpGet("requests/sent")]
    public async Task<ActionResult<ApiResponse<List<FriendRequestDto>>>> GetSentRequests()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<FriendRequestDto>> { Success = false, Message = "User not authenticated" });

            // Try stored procedure first
            try
            {
                var requests = await GetSentRequestsWithStoredProcedure(userId.Value);
                return Ok(new ApiResponse<List<FriendRequestDto>> { Success = true, Data = requests });
            }
            catch (Exception spEx)
            {
                _logger.LogWarning(spEx, "Stored procedure sp_GetSentFriendRequests not available, falling back to LINQ");
            }

            // Fallback to LINQ
            var sentData = await _context.FriendRequests
                .Include(fr => fr.Recipient)
                .Where(fr => fr.SenderId == userId.Value && fr.Status == "Pending")
                .OrderByDescending(fr => fr.CreatedAt)
                .ToListAsync();

            var sentList = sentData.Select(fr => new FriendRequestDto
            {
                Id = fr.Id,
                Status = fr.Status,
                Message = fr.Message,
                CreatedAt = fr.CreatedAt,
                Recipient = new UserSummaryDto
                {
                    Id = fr.Recipient!.Id,
                    Name = $"{fr.Recipient.FirstName} {fr.Recipient.LastName}".Trim(),
                    ProfileImageUrl = fr.Recipient.ProfileImageUrl,
                    ExperienceLevel = fr.Recipient.ExperienceLevel,
                    PlayingStyle = fr.Recipient.PlayingStyle,
                    Location = !string.IsNullOrEmpty(fr.Recipient.City) && !string.IsNullOrEmpty(fr.Recipient.State)
                        ? $"{fr.Recipient.City}, {fr.Recipient.State}"
                        : fr.Recipient.City ?? fr.Recipient.State
                }
            }).ToList();

            return Ok(new ApiResponse<List<FriendRequestDto>> { Success = true, Data = sentList });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching sent requests");
            return StatusCode(500, new ApiResponse<List<FriendRequestDto>> { Success = false, Message = "An error occurred" });
        }
    }

    private async Task<List<FriendRequestDto>> GetSentRequestsWithStoredProcedure(int userId)
    {
        var results = new List<FriendRequestDto>();
        var connectionString = _context.Database.GetConnectionString();

        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();

        using var command = new SqlCommand("sp_GetSentFriendRequests", connection);
        command.CommandType = CommandType.StoredProcedure;
        command.Parameters.AddWithValue("@CurrentUserId", userId);

        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            results.Add(new FriendRequestDto
            {
                Id = reader.GetInt32(reader.GetOrdinal("Id")),
                Status = reader.GetString(reader.GetOrdinal("Status")),
                Message = reader.IsDBNull(reader.GetOrdinal("Message")) ? null : reader.GetString(reader.GetOrdinal("Message")),
                CreatedAt = reader.GetDateTime(reader.GetOrdinal("CreatedAt")),
                Recipient = new UserSummaryDto
                {
                    Id = reader.GetInt32(reader.GetOrdinal("RecipientId")),
                    Name = reader.IsDBNull(reader.GetOrdinal("RecipientName")) ? "" : reader.GetString(reader.GetOrdinal("RecipientName")),
                    ProfileImageUrl = reader.IsDBNull(reader.GetOrdinal("RecipientProfileImageUrl")) ? null : reader.GetString(reader.GetOrdinal("RecipientProfileImageUrl")),
                    ExperienceLevel = reader.IsDBNull(reader.GetOrdinal("RecipientExperienceLevel")) ? null : reader.GetString(reader.GetOrdinal("RecipientExperienceLevel")),
                    PlayingStyle = reader.IsDBNull(reader.GetOrdinal("RecipientPlayingStyle")) ? null : reader.GetString(reader.GetOrdinal("RecipientPlayingStyle")),
                    Location = reader.IsDBNull(reader.GetOrdinal("RecipientLocation")) ? null : reader.GetString(reader.GetOrdinal("RecipientLocation"))
                }
            });
        }

        return results;
    }

    // POST: /friends/requests - Send a friend request
    [HttpPost("requests")]
    public async Task<ActionResult<ApiResponse<FriendRequestDto>>> SendFriendRequest([FromBody] SendFriendRequestDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<FriendRequestDto> { Success = false, Message = "User not authenticated" });

            if (dto.RecipientId == userId.Value)
                return BadRequest(new ApiResponse<FriendRequestDto> { Success = false, Message = "Cannot send friend request to yourself" });

            // Check if recipient exists
            var recipient = await _context.Users.FindAsync(dto.RecipientId);
            if (recipient == null)
                return NotFound(new ApiResponse<FriendRequestDto> { Success = false, Message = "User not found" });

            // Check if already friends
            var existingFriendship = await _context.Friendships
                .AnyAsync(f => (f.UserId1 == Math.Min(userId.Value, dto.RecipientId) &&
                               f.UserId2 == Math.Max(userId.Value, dto.RecipientId)));
            if (existingFriendship)
                return BadRequest(new ApiResponse<FriendRequestDto> { Success = false, Message = "Already friends with this user" });

            // Check for existing pending request
            var existingRequest = await _context.FriendRequests
                .FirstOrDefaultAsync(fr =>
                    ((fr.SenderId == userId.Value && fr.RecipientId == dto.RecipientId) ||
                     (fr.SenderId == dto.RecipientId && fr.RecipientId == userId.Value)) &&
                    fr.Status == "Pending");

            if (existingRequest != null)
            {
                if (existingRequest.SenderId == dto.RecipientId)
                    return BadRequest(new ApiResponse<FriendRequestDto> { Success = false, Message = "This user has already sent you a friend request" });
                return BadRequest(new ApiResponse<FriendRequestDto> { Success = false, Message = "Friend request already sent" });
            }

            var request = new FriendRequest
            {
                SenderId = userId.Value,
                RecipientId = dto.RecipientId,
                Message = dto.Message,
                Status = "Pending"
            };

            _context.FriendRequests.Add(request);
            await _context.SaveChangesAsync();

            // Get sender's name for notification
            var sender = await _context.Users.FindAsync(userId.Value);
            var senderName = sender != null ? $"{sender.FirstName} {sender.LastName}".Trim() : "Someone";

            // Send notification to recipient
            await _notificationService.CreateAndSendAsync(
                dto.RecipientId,
                "FriendRequest",
                "New Friend Request",
                $"{senderName} wants to be your friend",
                "/friends",
                "FriendRequest",
                request.Id
            );

            return Ok(new ApiResponse<FriendRequestDto>
            {
                Success = true,
                Message = "Friend request sent",
                Data = new FriendRequestDto { Id = request.Id, Status = request.Status, CreatedAt = request.CreatedAt }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending friend request");
            return StatusCode(500, new ApiResponse<FriendRequestDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /friends/requests/{id}/accept - Accept a friend request
    [HttpPost("requests/{id}/accept")]
    public async Task<ActionResult<ApiResponse<object>>> AcceptRequest(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<object> { Success = false, Message = "User not authenticated" });

            var request = await _context.FriendRequests.FindAsync(id);
            if (request == null)
                return NotFound(new ApiResponse<object> { Success = false, Message = "Request not found" });

            if (request.RecipientId != userId.Value)
                return Forbid();

            if (request.Status != "Pending")
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Request is no longer pending" });

            request.Status = "Accepted";
            request.RespondedAt = DateTime.UtcNow;

            // Create friendship (ensure UserId1 < UserId2 for uniqueness)
            var friendship = new Friendship
            {
                UserId1 = Math.Min(request.SenderId, request.RecipientId),
                UserId2 = Math.Max(request.SenderId, request.RecipientId),
                OriginatingRequestId = request.Id
            };

            _context.Friendships.Add(friendship);
            await _context.SaveChangesAsync();

            // Get acceptor's name for notification
            var acceptor = await _context.Users.FindAsync(userId.Value);
            var acceptorName = acceptor != null ? $"{acceptor.FirstName} {acceptor.LastName}".Trim() : "Someone";

            // Send notification to original sender that their request was accepted
            await _notificationService.CreateAndSendAsync(
                request.SenderId,
                "FriendRequestAccepted",
                "Friend Request Accepted",
                $"{acceptorName} accepted your friend request",
                $"/users/{userId.Value}",
                "User",
                userId.Value
            );

            return Ok(new ApiResponse<object> { Success = true, Message = "Friend request accepted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error accepting friend request");
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /friends/requests/{id}/reject - Reject a friend request
    [HttpPost("requests/{id}/reject")]
    public async Task<ActionResult<ApiResponse<object>>> RejectRequest(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<object> { Success = false, Message = "User not authenticated" });

            var request = await _context.FriendRequests.FindAsync(id);
            if (request == null)
                return NotFound(new ApiResponse<object> { Success = false, Message = "Request not found" });

            if (request.RecipientId != userId.Value)
                return Forbid();

            if (request.Status != "Pending")
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Request is no longer pending" });

            request.Status = "Rejected";
            request.RespondedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object> { Success = true, Message = "Friend request rejected" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rejecting friend request");
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /friends/requests/{id} - Cancel a sent friend request
    [HttpDelete("requests/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> CancelRequest(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<object> { Success = false, Message = "User not authenticated" });

            var request = await _context.FriendRequests.FindAsync(id);
            if (request == null)
                return NotFound(new ApiResponse<object> { Success = false, Message = "Request not found" });

            if (request.SenderId != userId.Value)
                return Forbid();

            if (request.Status != "Pending")
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Request is no longer pending" });

            request.Status = "Cancelled";
            request.RespondedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object> { Success = true, Message = "Friend request cancelled" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling friend request");
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /friends/{id} - Remove a friend
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> RemoveFriend(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<object> { Success = false, Message = "User not authenticated" });

            var friendship = await _context.Friendships.FindAsync(id);
            if (friendship == null)
                return NotFound(new ApiResponse<object> { Success = false, Message = "Friendship not found" });

            if (friendship.UserId1 != userId.Value && friendship.UserId2 != userId.Value)
                return Forbid();

            _context.Friendships.Remove(friendship);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object> { Success = true, Message = "Friend removed" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing friend");
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }
}
