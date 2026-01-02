using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.DTOs;

// Conversation DTOs
public class ConversationDto
{
    public int Id { get; set; }
    public string Type { get; set; } = "Direct"; // Direct, FriendGroup, Club
    public string? Name { get; set; }
    public int? ClubId { get; set; }
    public string? ClubName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public int UnreadCount { get; set; }
    public MessageDto? LastMessage { get; set; }
    public List<ConversationParticipantDto> Participants { get; set; } = new();
}

public class ConversationListDto
{
    public int Id { get; set; }
    public string Type { get; set; } = "Direct";
    public string? Name { get; set; }
    public string? DisplayName { get; set; } // For direct chats, show other person's name
    public string? DisplayAvatar { get; set; } // For direct chats, show other person's avatar
    public int? ClubId { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public int UnreadCount { get; set; }
    public string? LastMessagePreview { get; set; }
    public string? LastMessageSenderName { get; set; }
    public int ParticipantCount { get; set; }
    public bool IsMuted { get; set; }
}

public class ConversationParticipantDto
{
    public int UserId { get; set; }
    public string? DisplayName { get; set; }
    public string? Avatar { get; set; }
    public string Role { get; set; } = "Member"; // Admin, Member
    public DateTime JoinedAt { get; set; }
    public bool IsOnline { get; set; }
}

// Message DTOs
public class MessageDto
{
    public int Id { get; set; }
    public int ConversationId { get; set; }
    public int SenderId { get; set; }
    public string? SenderName { get; set; }
    public string? SenderAvatar { get; set; }
    public string Content { get; set; } = string.Empty;
    public string MessageType { get; set; } = "Text"; // Text, Image, System
    public int? ReplyToMessageId { get; set; }
    public MessageDto? ReplyToMessage { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? EditedAt { get; set; }
    public bool IsDeleted { get; set; }
    public bool IsOwn { get; set; } // True if current user sent this message
    public List<MessageReadReceiptDto>? ReadReceipts { get; set; }
}

public class MessageReadReceiptDto
{
    public int UserId { get; set; }
    public string? UserName { get; set; }
    public DateTime ReadAt { get; set; }
}

// Request DTOs
public class SendMessageRequest
{
    [Required]
    [MaxLength(4000)]
    public string Content { get; set; } = string.Empty;

    public string MessageType { get; set; } = "Text";

    public int? ReplyToMessageId { get; set; }
}

public class CreateDirectConversationRequest
{
    [Required]
    public int OtherUserId { get; set; }

    public string? InitialMessage { get; set; }
}

public class CreateGroupConversationRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MinLength(1)]
    public List<int> ParticipantUserIds { get; set; } = new();
}

public class UpdateConversationRequest
{
    [MaxLength(100)]
    public string? Name { get; set; }
}

public class AddParticipantsRequest
{
    [Required]
    [MinLength(1)]
    public List<int> UserIds { get; set; } = new();
}

public class UpdateMessagingSettingsRequest
{
    public bool? AllowDirectMessages { get; set; }
    public bool? AllowClubMessages { get; set; }
}

public class MuteConversationRequest
{
    public bool IsMuted { get; set; }
}

// Response DTOs
public class ConversationMessagesResponse
{
    public List<MessageDto> Messages { get; set; } = new();
    public bool HasMore { get; set; }
    public int? NextCursor { get; set; } // MessageId for cursor-based pagination
}

public class MessagingSettingsDto
{
    public bool AllowDirectMessages { get; set; }
    public bool AllowClubMessages { get; set; }
}

// SignalR DTOs
public class NewMessageNotification
{
    public int ConversationId { get; set; }
    public MessageDto Message { get; set; } = null!;
}

public class MessageReadNotification
{
    public int ConversationId { get; set; }
    public int MessageId { get; set; }
    public int UserId { get; set; }
    public string? UserName { get; set; }
    public DateTime ReadAt { get; set; }
}

public class TypingNotification
{
    public int ConversationId { get; set; }
    public int UserId { get; set; }
    public string? UserName { get; set; }
    public bool IsTyping { get; set; }
}

public class UserOnlineStatusNotification
{
    public int UserId { get; set; }
    public bool IsOnline { get; set; }
    public DateTime? LastSeen { get; set; }
}
