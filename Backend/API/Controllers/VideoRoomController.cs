using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Hubs;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Services;
using System.Security.Claims;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class VideoRoomController : ControllerBase
{
    private readonly IVideoRoomService _roomService;
    private readonly ILogger<VideoRoomController> _logger;
    private readonly ApplicationDbContext _context;

    public VideoRoomController(IVideoRoomService roomService, ILogger<VideoRoomController> logger, ApplicationDbContext context)
    {
        _roomService = roomService;
        _logger = logger;
        _context = context;
    }

    /// <summary>
    /// Create a new video room. Requires authentication.
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<VideoRoomCreatedResponse>> CreateRoom([FromBody] CreateVideoRoomRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest("Room name is required");
            }

            var userId = GetCurrentUserId();
            var userName = GetCurrentUserName();

            // Build base URL from request
            var baseUrl = $"{Request.Scheme}://{Request.Host}";

            var result = await _roomService.CreateRoomAsync(request, userId, userName, baseUrl);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating video room");
            return StatusCode(500, "Failed to create room");
        }
    }

    /// <summary>
    /// Get room info by room code (public - no auth required)
    /// </summary>
    [HttpGet("{roomCode}")]
    [AllowAnonymous]
    public async Task<ActionResult<VideoRoomDto>> GetRoom(string roomCode)
    {
        var room = await _roomService.GetRoomByCodeAsync(roomCode);
        if (room == null)
        {
            return NotFound("Room not found or has ended");
        }

        // Add live participant count from hub
        room.ParticipantCount = VideoRoomHub.GetParticipantCount(roomCode);
        return Ok(room);
    }

    /// <summary>
    /// Get all active rooms (requires authentication)
    /// </summary>
    [HttpGet]
    [Authorize]
    public async Task<ActionResult<List<VideoRoomDto>>> GetActiveRooms()
    {
        var rooms = await _roomService.GetActiveRoomsAsync();

        // Fill in live participant counts
        foreach (var room in rooms)
        {
            room.ParticipantCount = VideoRoomHub.GetParticipantCount(room.RoomCode);
        }

        return Ok(rooms);
    }

    /// <summary>
    /// Validate passcode and join a room (public - guests can join)
    /// </summary>
    [HttpPost("{roomCode}/join")]
    [AllowAnonymous]
    public async Task<ActionResult<JoinVideoRoomResponse>> JoinRoom(string roomCode, [FromBody] JoinVideoRoomRequest request)
    {
        try
        {
            var result = await _roomService.ValidateJoinAsync(roomCode, request);

            if (!result.Success)
            {
                return BadRequest(result);
            }

            // Check max participants
            if (result.Room != null && result.Room.MaxParticipants > 0)
            {
                var currentCount = VideoRoomHub.GetParticipantCount(roomCode);
                if (currentCount >= result.Room.MaxParticipants)
                {
                    return BadRequest(new JoinVideoRoomResponse
                    {
                        Success = false,
                        Error = "Room is full"
                    });
                }
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error joining room {RoomCode}", roomCode);
            return StatusCode(500, "Failed to join room");
        }
    }

    /// <summary>
    /// Get participants currently in a room
    /// </summary>
    [HttpGet("{roomCode}/participants")]
    [AllowAnonymous]
    public ActionResult<List<VideoRoomParticipant>> GetParticipants(string roomCode)
    {
        var participants = VideoRoomHub.GetParticipants(roomCode);
        return Ok(participants);
    }

    /// <summary>
    /// End a room (admin only - room creator)
    /// </summary>
    [HttpPost("{roomCode}/end")]
    [Authorize]
    public async Task<ActionResult> EndRoom(string roomCode)
    {
        var userId = GetCurrentUserId();
        var result = await _roomService.EndRoomAsync(roomCode, userId);

        if (!result)
        {
            return BadRequest("Cannot end room. You may not be the creator.");
        }

        return Ok(new { message = "Room ended" });
    }

    /// <summary>
    /// Lock/unlock a room (admin only - room creator)
    /// </summary>
    [HttpPost("{roomCode}/lock")]
    [Authorize]
    public async Task<ActionResult> LockRoom(string roomCode, [FromQuery] bool locked = true)
    {
        var userId = GetCurrentUserId();
        var result = await _roomService.LockRoomAsync(roomCode, userId, locked);

        if (!result)
        {
            return BadRequest("Cannot lock/unlock room. You may not be the creator.");
        }

        return Ok(new { message = locked ? "Room locked" : "Room unlocked" });
    }

    // ========== Club Room Endpoints ==========

    /// <summary>
    /// Get or create the club's persistent video room
    /// </summary>
    [HttpGet("club/{clubId}")]
    [Authorize]
    public async Task<ActionResult<VideoRoomDto>> GetClubRoom(int clubId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            // Verify user is a club member
            var isMember = await _roomService.IsClubMemberAsync(clubId, userId.Value);
            if (!isMember)
                return Forbid();

            var userName = GetCurrentUserName();
            var baseUrl = $"{Request.Scheme}://{Request.Host}";

            var room = await _roomService.GetOrCreateClubRoomAsync(clubId, userId, userName, baseUrl);

            // Add live participant count
            room.ParticipantCount = VideoRoomHub.GetParticipantCount(room.RoomCode);

            return Ok(room);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting club room for club {ClubId}", clubId);
            return StatusCode(500, "Failed to get club room");
        }
    }

    /// <summary>
    /// Invite users to the club's video room
    /// </summary>
    [HttpPost("club/{clubId}/invite")]
    [Authorize]
    public async Task<ActionResult<ClubRoomInviteResponse>> InviteToClubRoom(int clubId, [FromBody] ClubRoomInviteRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            // Verify caller is a club member
            var isMember = await _roomService.IsClubMemberAsync(clubId, userId.Value);
            if (!isMember)
                return Forbid();

            // Get or create the club room
            var userName = GetCurrentUserName();
            var baseUrl = $"{Request.Scheme}://{Request.Host}";
            var room = await _roomService.GetOrCreateClubRoomAsync(clubId, userId, userName, baseUrl);

            // Get club info
            var club = await _context.Clubs.FindAsync(clubId);
            if (club == null)
                return NotFound("Club not found");

            var invitesSent = 0;
            var shareLink = $"{baseUrl}/rooms/{room.RoomCode}";

            // Create notifications for each invited user
            foreach (var invitedUserId in request.UserIds)
            {
                var notification = new ClubNotification
                {
                    ClubId = clubId,
                    SentByUserId = userId.Value,
                    Title = $"Video Room Invite - {club.Name}",
                    Message = string.IsNullOrEmpty(request.Message)
                        ? $"You've been invited to join {club.Name}'s video room! Join here: {shareLink}"
                        : $"{request.Message} - Join here: {shareLink}",
                    SentAt = DateTime.Now
                };

                _context.ClubNotifications.Add(notification);
                invitesSent++;
            }

            if (invitesSent > 0)
            {
                await _context.SaveChangesAsync();
            }

            return Ok(new ClubRoomInviteResponse
            {
                Success = true,
                InvitesSent = invitesSent,
                ShareLink = shareLink
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error inviting users to club room for club {ClubId}", clubId);
            return StatusCode(500, "Failed to send invites");
        }
    }

    /// <summary>
    /// Join a club room without passcode (for club members only)
    /// </summary>
    [HttpPost("{roomCode}/join-club")]
    [Authorize]
    public async Task<ActionResult<JoinVideoRoomResponse>> JoinClubRoom(string roomCode)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            // Find the room
            var room = await _context.VideoRooms
                .Include(r => r.Club)
                .FirstOrDefaultAsync(r => r.RoomCode == roomCode && r.IsActive);

            if (room == null)
                return NotFound(new JoinVideoRoomResponse { Success = false, Error = "Room not found" });

            if (!room.IsClubRoom || room.ClubId == null)
                return BadRequest(new JoinVideoRoomResponse { Success = false, Error = "This is not a club room" });

            // Verify user is a member of the club
            var isMember = await _roomService.IsClubMemberAsync(room.ClubId.Value, userId.Value);
            if (!isMember)
                return Forbid();

            if (room.IsLocked)
                return BadRequest(new JoinVideoRoomResponse { Success = false, Error = "Room is locked" });

            // Check max participants (0 = unlimited)
            if (room.MaxParticipants > 0)
            {
                var currentCount = VideoRoomHub.GetParticipantCount(roomCode);
                if (currentCount >= room.MaxParticipants)
                {
                    return BadRequest(new JoinVideoRoomResponse
                    {
                        Success = false,
                        Error = "Room is full"
                    });
                }
            }

            return Ok(new JoinVideoRoomResponse
            {
                Success = true,
                Room = new VideoRoomDto
                {
                    RoomId = room.RoomId,
                    RoomCode = room.RoomCode,
                    Name = room.Name,
                    CreatorName = room.CreatorName,
                    MaxParticipants = room.MaxParticipants,
                    IsActive = room.IsActive,
                    IsLocked = room.IsLocked,
                    CreatedAt = room.CreatedAt,
                    ClubId = room.ClubId,
                    ClubName = room.Club?.Name,
                    IsClubRoom = room.IsClubRoom
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error joining club room {RoomCode}", roomCode);
            return StatusCode(500, "Failed to join club room");
        }
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private string? GetCurrentUserName()
    {
        return User.FindFirst(ClaimTypes.Name)?.Value
            ?? User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name")?.Value;
    }
}
