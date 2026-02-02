namespace Pickleball.Community.Models.DTOs;

// Request to create a new video room
public class CreateVideoRoomRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Passcode { get; set; } // If null, auto-generate
    public int MaxParticipants { get; set; } = 6;
    public int? ClubId { get; set; }
}

// Response after creating a room
public class VideoRoomCreatedResponse
{
    public int RoomId { get; set; }
    public string RoomCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Passcode { get; set; } = string.Empty; // Plain-text passcode returned only on creation
    public string ShareLink { get; set; } = string.Empty;
    public int MaxParticipants { get; set; }
    public DateTime CreatedAt { get; set; }
}

// Room info for listing/display
public class VideoRoomDto
{
    public int RoomId { get; set; }
    public string RoomCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? CreatorName { get; set; }
    public int MaxParticipants { get; set; }
    public bool IsActive { get; set; }
    public bool IsLocked { get; set; }
    public int ParticipantCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? ClubId { get; set; }
    public string? ClubName { get; set; }
    public bool IsClubRoom { get; set; }
}

// Request to join a room
public class JoinVideoRoomRequest
{
    public string Passcode { get; set; } = string.Empty;
    public string? DisplayName { get; set; } // For guest users
}

// Response after joining
public class JoinVideoRoomResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public VideoRoomDto? Room { get; set; }
    public string? JoinToken { get; set; } // Token to authenticate with SignalR hub
}

// Chat message within a room
public class VideoRoomChatMessage
{
    public string SenderName { get; set; } = string.Empty;
    public string SenderId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

// Participant info broadcast to room
public class VideoRoomParticipant
{
    public string ConnectionId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public int? UserId { get; set; }
    public bool IsCreator { get; set; }
    public bool IsMuted { get; set; }
    public bool IsCameraOff { get; set; }
    public bool IsScreenSharing { get; set; }
}

// WebRTC signaling payloads
public class WebRtcOffer
{
    public string TargetConnectionId { get; set; } = string.Empty;
    public string Sdp { get; set; } = string.Empty;
}

public class WebRtcAnswer
{
    public string TargetConnectionId { get; set; } = string.Empty;
    public string Sdp { get; set; } = string.Empty;
}

public class WebRtcIceCandidate
{
    public string TargetConnectionId { get; set; } = string.Empty;
    public string Candidate { get; set; } = string.Empty;
    public string? SdpMid { get; set; }
    public int? SdpMLineIndex { get; set; }
}

// Club Room DTOs
public class ClubRoomInviteRequest
{
    public List<int> UserIds { get; set; } = new();
    public string? Message { get; set; }
}

public class ClubRoomInviteResponse
{
    public bool Success { get; set; }
    public int InvitesSent { get; set; }
    public string? ShareLink { get; set; }
}
