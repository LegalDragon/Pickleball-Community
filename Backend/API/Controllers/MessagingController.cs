using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Hubs;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class MessagingController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<MessagingController> _logger;
    private readonly IHubContext<ChatHub> _hubContext;

    public MessagingController(
        ApplicationDbContext context,
        ILogger<MessagingController> logger,
        IHubContext<ChatHub> hubContext)
    {
        _context = context;
        _logger = logger;
        _hubContext = hubContext;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    // GET: /messaging/conversations - Get user's conversations
    [HttpGet("conversations")]
    public async Task<ActionResult<ApiResponse<List<ConversationListDto>>>> GetConversations()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<ConversationListDto>> { Success = false, Message = "User not authenticated" });

            var conversations = await _context.ConversationParticipants
                .Include(cp => cp.Conversation)
                    .ThenInclude(c => c!.Messages.OrderByDescending(m => m.SentAt).Take(1))
                        .ThenInclude(m => m.Sender)
                .Include(cp => cp.Conversation)
                    .ThenInclude(c => c!.Participants)
                        .ThenInclude(p => p.User)
                .Include(cp => cp.Conversation)
                    .ThenInclude(c => c!.Club)
                .Where(cp => cp.UserId == userId.Value && !cp.Conversation!.IsDeleted)
                .OrderByDescending(cp => cp.Conversation!.LastMessageAt ?? cp.Conversation.CreatedAt)
                .Select(cp => new
                {
                    Conversation = cp.Conversation,
                    Participant = cp,
                    UnreadCount = _context.Messages
                        .Count(m => m.ConversationId == cp.ConversationId &&
                                   m.SentAt > (cp.LastReadAt ?? DateTime.MinValue) &&
                                   m.SenderId != userId.Value &&
                                   !m.IsDeleted)
                })
                .ToListAsync();

            var result = conversations.Select(c =>
            {
                var lastMessage = c.Conversation!.Messages.FirstOrDefault();
                var otherParticipant = c.Conversation.Type == "Direct"
                    ? c.Conversation.Participants.FirstOrDefault(p => p.UserId != userId.Value)
                    : null;

                return new ConversationListDto
                {
                    Id = c.Conversation.Id,
                    Type = c.Conversation.Type,
                    Name = c.Conversation.Name,
                    DisplayName = c.Conversation.Type == "Direct" && otherParticipant?.User != null
                        ? Utility.FormatName(otherParticipant.User.LastName, otherParticipant.User.FirstName)
                        : c.Conversation.Type == "Club" && c.Conversation.Club != null
                            ? c.Conversation.Club.Name
                            : c.Conversation.Name,
                    DisplayAvatar = c.Conversation.Type == "Direct" && otherParticipant?.User != null
                        ? otherParticipant.User.ProfileImageUrl
                        : c.Conversation.Type == "Club" && c.Conversation.Club != null
                            ? c.Conversation.Club.LogoUrl
                            : null,
                    ClubId = c.Conversation.ClubId,
                    LastMessageAt = c.Conversation.LastMessageAt,
                    UnreadCount = c.UnreadCount,
                    LastMessagePreview = lastMessage != null && !lastMessage.IsDeleted
                        ? lastMessage.Content.Length > 50
                            ? lastMessage.Content.Substring(0, 50) + "..."
                            : lastMessage.Content
                        : null,
                    LastMessageSenderName = lastMessage?.Sender != null
                        ? Utility.FormatName(lastMessage.Sender.LastName, lastMessage.Sender.FirstName)
                        : null,
                    ParticipantCount = c.Conversation.Participants.Count,
                    IsMuted = c.Participant.IsMuted
                };
            }).ToList();

            return Ok(new ApiResponse<List<ConversationListDto>> { Success = true, Data = result });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching conversations");
            return StatusCode(500, new ApiResponse<List<ConversationListDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /messaging/conversations/{id} - Get conversation details
    [HttpGet("conversations/{id}")]
    public async Task<ActionResult<ApiResponse<ConversationDto>>> GetConversation(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ConversationDto> { Success = false, Message = "User not authenticated" });

            // Check if user is a participant
            var isParticipant = await _context.ConversationParticipants
                .AnyAsync(cp => cp.ConversationId == id && cp.UserId == userId.Value);

            if (!isParticipant)
                return Forbid();

            var conversation = await _context.Conversations
                .Include(c => c.Participants)
                    .ThenInclude(p => p.User)
                .Include(c => c.Club)
                .Include(c => c.Messages.OrderByDescending(m => m.SentAt).Take(1))
                    .ThenInclude(m => m.Sender)
                .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);

            if (conversation == null)
                return NotFound(new ApiResponse<ConversationDto> { Success = false, Message = "Conversation not found" });

            var lastMessage = conversation.Messages.FirstOrDefault();
            var unreadCount = await _context.Messages
                .CountAsync(m => m.ConversationId == id &&
                                m.SentAt > (_context.ConversationParticipants
                                    .Where(cp => cp.ConversationId == id && cp.UserId == userId.Value)
                                    .Select(cp => cp.LastReadAt)
                                    .FirstOrDefault() ?? DateTime.MinValue) &&
                                m.SenderId != userId.Value &&
                                !m.IsDeleted);

            var dto = new ConversationDto
            {
                Id = conversation.Id,
                Type = conversation.Type,
                Name = conversation.Name,
                ClubId = conversation.ClubId,
                ClubName = conversation.Club?.Name,
                CreatedAt = conversation.CreatedAt,
                LastMessageAt = conversation.LastMessageAt,
                UnreadCount = unreadCount,
                LastMessage = lastMessage != null ? MapToMessageDto(lastMessage, userId.Value) : null,
                Participants = conversation.Participants.Select(p => new ConversationParticipantDto
                {
                    UserId = p.UserId,
                    DisplayName = p.User != null ? Utility.FormatName(p.User.LastName, p.User.FirstName) : null,
                    Avatar = p.User?.ProfileImageUrl,
                    Role = p.Role,
                    JoinedAt = p.JoinedAt,
                    IsOnline = false // TODO: Implement online status with SignalR
                }).ToList()
            };

            return Ok(new ApiResponse<ConversationDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching conversation {ConversationId}", id);
            return StatusCode(500, new ApiResponse<ConversationDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /messaging/conversations/direct - Create or get direct conversation
    [HttpPost("conversations/direct")]
    public async Task<ActionResult<ApiResponse<ConversationDto>>> CreateDirectConversation([FromBody] CreateDirectConversationRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ConversationDto> { Success = false, Message = "User not authenticated" });

            if (request.OtherUserId == userId.Value)
                return BadRequest(new ApiResponse<ConversationDto> { Success = false, Message = "Cannot create conversation with yourself" });

            // Check if other user exists and allows direct messages
            var otherUser = await _context.Users.FindAsync(request.OtherUserId);
            if (otherUser == null)
                return NotFound(new ApiResponse<ConversationDto> { Success = false, Message = "User not found" });

            if (!otherUser.AllowDirectMessages)
                return BadRequest(new ApiResponse<ConversationDto> { Success = false, Message = "User does not accept direct messages" });

            // Check if conversation already exists between these two users
            var existingConversation = await _context.Conversations
                .Include(c => c.Participants)
                .Where(c => c.Type == "Direct" && !c.IsDeleted)
                .Where(c => c.Participants.Count == 2 &&
                           c.Participants.Any(p => p.UserId == userId.Value) &&
                           c.Participants.Any(p => p.UserId == request.OtherUserId))
                .FirstOrDefaultAsync();

            if (existingConversation != null)
            {
                return await GetConversation(existingConversation.Id);
            }

            // Create new conversation
            var conversation = new Conversation
            {
                Type = "Direct"
            };

            _context.Conversations.Add(conversation);
            await _context.SaveChangesAsync();

            // Add participants
            var participants = new List<ConversationParticipant>
            {
                new() { ConversationId = conversation.Id, UserId = userId.Value, Role = "Member" },
                new() { ConversationId = conversation.Id, UserId = request.OtherUserId, Role = "Member" }
            };

            _context.ConversationParticipants.AddRange(participants);
            await _context.SaveChangesAsync();

            // Send initial message if provided
            if (!string.IsNullOrWhiteSpace(request.InitialMessage))
            {
                var message = new Message
                {
                    ConversationId = conversation.Id,
                    SenderId = userId.Value,
                    Content = request.InitialMessage,
                    MessageType = "Text"
                };

                _context.Messages.Add(message);
                conversation.LastMessageAt = DateTime.Now;
                await _context.SaveChangesAsync();
            }

            return await GetConversation(conversation.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating direct conversation");
            return StatusCode(500, new ApiResponse<ConversationDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /messaging/conversations/group - Create group conversation
    [HttpPost("conversations/group")]
    public async Task<ActionResult<ApiResponse<ConversationDto>>> CreateGroupConversation([FromBody] CreateGroupConversationRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ConversationDto> { Success = false, Message = "User not authenticated" });

            // Verify all participants exist (check each individually to avoid OPENJSON issues)
            var participantIdsSet = request.ParticipantUserIds.ToHashSet();
            var validUserIds = new List<int>();
            foreach (var participantId in participantIdsSet)
            {
                if (await _context.Users.AnyAsync(u => u.Id == participantId))
                    validUserIds.Add(participantId);
            }

            if (validUserIds.Count != participantIdsSet.Count)
                return BadRequest(new ApiResponse<ConversationDto> { Success = false, Message = "Some users not found" });

            // Create conversation
            var conversation = new Conversation
            {
                Type = "FriendGroup",
                Name = request.Name
            };

            _context.Conversations.Add(conversation);
            await _context.SaveChangesAsync();

            // Add creator as admin
            var participants = new List<ConversationParticipant>
            {
                new() { ConversationId = conversation.Id, UserId = userId.Value, Role = "Admin" }
            };

            // Add other participants
            foreach (var participantId in request.ParticipantUserIds.Where(id => id != userId.Value))
            {
                participants.Add(new ConversationParticipant
                {
                    ConversationId = conversation.Id,
                    UserId = participantId,
                    Role = "Member"
                });
            }

            _context.ConversationParticipants.AddRange(participants);
            await _context.SaveChangesAsync();

            return await GetConversation(conversation.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating group conversation");
            return StatusCode(500, new ApiResponse<ConversationDto> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /messaging/conversations/{id}/messages - Get messages with pagination
    [HttpGet("conversations/{id}/messages")]
    public async Task<ActionResult<ApiResponse<ConversationMessagesResponse>>> GetMessages(
        int id,
        [FromQuery] int? beforeMessageId = null,
        [FromQuery] int limit = 50)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ConversationMessagesResponse> { Success = false, Message = "User not authenticated" });

            // Check if user is a participant
            var isParticipant = await _context.ConversationParticipants
                .AnyAsync(cp => cp.ConversationId == id && cp.UserId == userId.Value);

            if (!isParticipant)
                return Forbid();

            limit = Math.Min(limit, 100); // Max 100 messages per request

            var query = _context.Messages
                .Include(m => m.Sender)
                .Include(m => m.ReplyToMessage)
                    .ThenInclude(r => r!.Sender)
                .Where(m => m.ConversationId == id);

            if (beforeMessageId.HasValue)
            {
                query = query.Where(m => m.Id < beforeMessageId.Value);
            }

            var messages = await query
                .OrderByDescending(m => m.SentAt)
                .Take(limit + 1) // Take one extra to check if there are more
                .ToListAsync();

            var hasMore = messages.Count > limit;
            if (hasMore)
            {
                messages = messages.Take(limit).ToList();
            }

            var messageDtos = messages
                .OrderBy(m => m.SentAt)
                .Select(m => MapToMessageDto(m, userId.Value))
                .ToList();

            var response = new ConversationMessagesResponse
            {
                Messages = messageDtos,
                HasMore = hasMore,
                NextCursor = hasMore ? messages.Last().Id : null
            };

            return Ok(new ApiResponse<ConversationMessagesResponse> { Success = true, Data = response });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching messages for conversation {ConversationId}", id);
            return StatusCode(500, new ApiResponse<ConversationMessagesResponse> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /messaging/conversations/{id}/messages - Send message
    [HttpPost("conversations/{id}/messages")]
    public async Task<ActionResult<ApiResponse<MessageDto>>> SendMessage(int id, [FromBody] SendMessageRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<MessageDto> { Success = false, Message = "User not authenticated" });

            // Check if user is a participant
            var participant = await _context.ConversationParticipants
                .FirstOrDefaultAsync(cp => cp.ConversationId == id && cp.UserId == userId.Value);

            if (participant == null)
                return Forbid();

            var conversation = await _context.Conversations.FindAsync(id);
            if (conversation == null || conversation.IsDeleted)
                return NotFound(new ApiResponse<MessageDto> { Success = false, Message = "Conversation not found" });

            // Validate reply message if provided
            if (request.ReplyToMessageId.HasValue)
            {
                var replyMessage = await _context.Messages
                    .AnyAsync(m => m.Id == request.ReplyToMessageId.Value && m.ConversationId == id);

                if (!replyMessage)
                    return BadRequest(new ApiResponse<MessageDto> { Success = false, Message = "Reply message not found" });
            }

            var message = new Message
            {
                ConversationId = id,
                SenderId = userId.Value,
                Content = request.Content,
                MessageType = request.MessageType,
                ReplyToMessageId = request.ReplyToMessageId
            };

            _context.Messages.Add(message);

            // Update conversation last message time
            conversation.LastMessageAt = DateTime.Now;
            conversation.UpdatedAt = DateTime.Now;

            // Update sender's last read time
            participant.LastReadAt = DateTime.Now;

            await _context.SaveChangesAsync();

            // Load sender for response
            await _context.Entry(message).Reference(m => m.Sender).LoadAsync();
            if (request.ReplyToMessageId.HasValue)
            {
                await _context.Entry(message).Reference(m => m.ReplyToMessage).LoadAsync();
                if (message.ReplyToMessage != null)
                {
                    await _context.Entry(message.ReplyToMessage).Reference(m => m.Sender).LoadAsync();
                }
            }

            var dto = MapToMessageDto(message, userId.Value);

            // Broadcast via SignalR
            var notification = new NewMessageNotification
            {
                ConversationId = id,
                Message = dto
            };
            await _hubContext.Clients.Group($"conversation_{id}")
                .SendAsync("ReceiveMessage", notification);

            return Ok(new ApiResponse<MessageDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending message to conversation {ConversationId}", id);
            return StatusCode(500, new ApiResponse<MessageDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /messaging/messages/{id} - Edit message
    [HttpPut("messages/{id}")]
    public async Task<ActionResult<ApiResponse<MessageDto>>> EditMessage(int id, [FromBody] SendMessageRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<MessageDto> { Success = false, Message = "User not authenticated" });

            var message = await _context.Messages
                .Include(m => m.Sender)
                .FirstOrDefaultAsync(m => m.Id == id);

            if (message == null || message.IsDeleted)
                return NotFound(new ApiResponse<MessageDto> { Success = false, Message = "Message not found" });

            if (message.SenderId != userId.Value)
                return Forbid();

            message.Content = request.Content;
            message.EditedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            var dto = MapToMessageDto(message, userId.Value);

            // Broadcast edit via SignalR
            await _hubContext.Clients.Group($"conversation_{message.ConversationId}")
                .SendAsync("MessageEdited", dto);

            return Ok(new ApiResponse<MessageDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error editing message {MessageId}", id);
            return StatusCode(500, new ApiResponse<MessageDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /messaging/messages/{id} - Delete message
    [HttpDelete("messages/{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteMessage(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var message = await _context.Messages.FindAsync(id);

            if (message == null || message.IsDeleted)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Message not found" });

            if (message.SenderId != userId.Value)
            {
                // Check if user is conversation admin
                var isAdmin = await _context.ConversationParticipants
                    .AnyAsync(cp => cp.ConversationId == message.ConversationId &&
                                   cp.UserId == userId.Value &&
                                   cp.Role == "Admin");

                if (!isAdmin)
                    return Forbid();
            }

            message.IsDeleted = true;
            var conversationId = message.ConversationId;
            message.Content = ""; // Clear content for privacy

            await _context.SaveChangesAsync();

            // Broadcast delete via SignalR
            await _hubContext.Clients.Group($"conversation_{conversationId}")
                .SendAsync("MessageDeleted", new { MessageId = id, ConversationId = conversationId });

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Message deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting message {MessageId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /messaging/conversations/{id}/read - Mark conversation as read
    [HttpPost("conversations/{id}/read")]
    public async Task<ActionResult<ApiResponse<bool>>> MarkAsRead(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var participant = await _context.ConversationParticipants
                .FirstOrDefaultAsync(cp => cp.ConversationId == id && cp.UserId == userId.Value);

            if (participant == null)
                return Forbid();

            participant.LastReadAt = DateTime.Now;
            await _context.SaveChangesAsync();

            // Get user info for broadcast
            var user = await _context.Users.FindAsync(userId.Value);

            // Broadcast read receipt via SignalR
            var readNotification = new MessageReadNotification
            {
                ConversationId = id,
                MessageId = 0, // All messages
                UserId = userId.Value,
                UserName = user != null ? Utility.FormatName(user.LastName, user.FirstName) : null,
                ReadAt = participant.LastReadAt.Value
            };
            await _hubContext.Clients.Group($"conversation_{id}")
                .SendAsync("MessageRead", readNotification);

            return Ok(new ApiResponse<bool> { Success = true, Data = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking conversation {ConversationId} as read", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /messaging/conversations/{id} - Update conversation (name)
    [HttpPut("conversations/{id}")]
    public async Task<ActionResult<ApiResponse<ConversationDto>>> UpdateConversation(int id, [FromBody] UpdateConversationRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ConversationDto> { Success = false, Message = "User not authenticated" });

            // Check if user is admin of the conversation
            var isAdmin = await _context.ConversationParticipants
                .AnyAsync(cp => cp.ConversationId == id && cp.UserId == userId.Value && cp.Role == "Admin");

            if (!isAdmin)
                return Forbid();

            var conversation = await _context.Conversations.FindAsync(id);
            if (conversation == null || conversation.IsDeleted)
                return NotFound(new ApiResponse<ConversationDto> { Success = false, Message = "Conversation not found" });

            if (conversation.Type == "Direct")
                return BadRequest(new ApiResponse<ConversationDto> { Success = false, Message = "Cannot rename direct conversations" });

            if (request.Name != null)
            {
                conversation.Name = request.Name;
                conversation.UpdatedAt = DateTime.Now;
                await _context.SaveChangesAsync();
            }

            return await GetConversation(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating conversation {ConversationId}", id);
            return StatusCode(500, new ApiResponse<ConversationDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /messaging/conversations/{id}/mute - Mute/unmute conversation
    [HttpPut("conversations/{id}/mute")]
    public async Task<ActionResult<ApiResponse<bool>>> MuteConversation(int id, [FromBody] MuteConversationRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var participant = await _context.ConversationParticipants
                .FirstOrDefaultAsync(cp => cp.ConversationId == id && cp.UserId == userId.Value);

            if (participant == null)
                return Forbid();

            participant.IsMuted = request.IsMuted;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = request.IsMuted ? "Conversation muted" : "Conversation unmuted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error muting conversation {ConversationId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /messaging/conversations/{id}/leave - Leave conversation
    [HttpPost("conversations/{id}/leave")]
    public async Task<ActionResult<ApiResponse<bool>>> LeaveConversation(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var participant = await _context.ConversationParticipants
                .FirstOrDefaultAsync(cp => cp.ConversationId == id && cp.UserId == userId.Value);

            if (participant == null)
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Not a participant of this conversation" });

            var conversation = await _context.Conversations
                .Include(c => c.Participants)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (conversation == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Conversation not found" });

            // Cannot leave direct conversations - they stay inactive
            if (conversation.Type == "Direct")
            {
                return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Left conversation" });
            }

            // If last admin, either transfer or delete
            if (participant.Role == "Admin")
            {
                var adminCount = conversation.Participants.Count(p => p.Role == "Admin");
                if (adminCount == 1 && conversation.Participants.Count > 1)
                {
                    // Transfer admin to next oldest member
                    var nextAdmin = conversation.Participants
                        .Where(p => p.UserId != userId.Value)
                        .OrderBy(p => p.JoinedAt)
                        .FirstOrDefault();

                    if (nextAdmin != null)
                    {
                        nextAdmin.Role = "Admin";
                    }
                }
            }

            _context.ConversationParticipants.Remove(participant);

            // If no participants left, mark conversation as deleted
            if (conversation.Participants.Count <= 1)
            {
                conversation.IsDeleted = true;
            }

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Left conversation" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error leaving conversation {ConversationId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /messaging/conversations/{id}/participants - Add participants
    [HttpPost("conversations/{id}/participants")]
    public async Task<ActionResult<ApiResponse<ConversationDto>>> AddParticipants(int id, [FromBody] AddParticipantsRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ConversationDto> { Success = false, Message = "User not authenticated" });

            // Check if user is admin
            var isAdmin = await _context.ConversationParticipants
                .AnyAsync(cp => cp.ConversationId == id && cp.UserId == userId.Value && cp.Role == "Admin");

            if (!isAdmin)
                return Forbid();

            var conversation = await _context.Conversations.FindAsync(id);
            if (conversation == null || conversation.IsDeleted)
                return NotFound(new ApiResponse<ConversationDto> { Success = false, Message = "Conversation not found" });

            if (conversation.Type == "Direct")
                return BadRequest(new ApiResponse<ConversationDto> { Success = false, Message = "Cannot add participants to direct conversations" });

            // Get existing participants
            var existingParticipantIds = await _context.ConversationParticipants
                .Where(cp => cp.ConversationId == id)
                .Select(cp => cp.UserId)
                .ToListAsync();

            // Add new participants
            foreach (var newUserId in request.UserIds.Where(uid => !existingParticipantIds.Contains(uid)))
            {
                var userExists = await _context.Users.AnyAsync(u => u.Id == newUserId);
                if (userExists)
                {
                    _context.ConversationParticipants.Add(new ConversationParticipant
                    {
                        ConversationId = id,
                        UserId = newUserId,
                        Role = "Member"
                    });
                }
            }

            await _context.SaveChangesAsync();

            return await GetConversation(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding participants to conversation {ConversationId}", id);
            return StatusCode(500, new ApiResponse<ConversationDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /messaging/conversations/{id}/participants/{participantUserId} - Remove participant
    [HttpDelete("conversations/{id}/participants/{participantUserId}")]
    public async Task<ActionResult<ApiResponse<bool>>> RemoveParticipant(int id, int participantUserId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            // Check if user is admin
            var isAdmin = await _context.ConversationParticipants
                .AnyAsync(cp => cp.ConversationId == id && cp.UserId == userId.Value && cp.Role == "Admin");

            if (!isAdmin)
                return Forbid();

            var participant = await _context.ConversationParticipants
                .FirstOrDefaultAsync(cp => cp.ConversationId == id && cp.UserId == participantUserId);

            if (participant == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Participant not found" });

            // Cannot remove yourself as admin if you're the only admin
            if (participantUserId == userId.Value && participant.Role == "Admin")
            {
                var adminCount = await _context.ConversationParticipants
                    .CountAsync(cp => cp.ConversationId == id && cp.Role == "Admin");

                if (adminCount == 1)
                    return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot remove the only admin" });
            }

            _context.ConversationParticipants.Remove(participant);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Participant removed" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing participant from conversation {ConversationId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /messaging/settings - Get user's messaging settings
    [HttpGet("settings")]
    public async Task<ActionResult<ApiResponse<MessagingSettingsDto>>> GetSettings()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<MessagingSettingsDto> { Success = false, Message = "User not authenticated" });

            var user = await _context.Users.FindAsync(userId.Value);
            if (user == null)
                return NotFound(new ApiResponse<MessagingSettingsDto> { Success = false, Message = "User not found" });

            var settings = new MessagingSettingsDto
            {
                AllowDirectMessages = user.AllowDirectMessages,
                AllowClubMessages = user.AllowClubMessages
            };

            return Ok(new ApiResponse<MessagingSettingsDto> { Success = true, Data = settings });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching messaging settings");
            return StatusCode(500, new ApiResponse<MessagingSettingsDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /messaging/settings - Update user's messaging settings
    [HttpPut("settings")]
    public async Task<ActionResult<ApiResponse<MessagingSettingsDto>>> UpdateSettings([FromBody] UpdateMessagingSettingsRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<MessagingSettingsDto> { Success = false, Message = "User not authenticated" });

            var user = await _context.Users.FindAsync(userId.Value);
            if (user == null)
                return NotFound(new ApiResponse<MessagingSettingsDto> { Success = false, Message = "User not found" });

            if (request.AllowDirectMessages.HasValue)
                user.AllowDirectMessages = request.AllowDirectMessages.Value;

            if (request.AllowClubMessages.HasValue)
                user.AllowClubMessages = request.AllowClubMessages.Value;

            await _context.SaveChangesAsync();

            var settings = new MessagingSettingsDto
            {
                AllowDirectMessages = user.AllowDirectMessages,
                AllowClubMessages = user.AllowClubMessages
            };

            return Ok(new ApiResponse<MessagingSettingsDto> { Success = true, Data = settings, Message = "Settings updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating messaging settings");
            return StatusCode(500, new ApiResponse<MessagingSettingsDto> { Success = false, Message = "An error occurred" });
        }
    }

    // Helper method to map Message entity to MessageDto
    private static MessageDto MapToMessageDto(Message message, int currentUserId)
    {
        return new MessageDto
        {
            Id = message.Id,
            ConversationId = message.ConversationId,
            SenderId = message.SenderId,
            SenderName = message.Sender != null ? Utility.FormatName(message.Sender.LastName, message.Sender.FirstName) : null,
            SenderAvatar = message.Sender?.ProfileImageUrl,
            Content = message.IsDeleted ? "[Message deleted]" : message.Content,
            MessageType = message.MessageType,
            ReplyToMessageId = message.ReplyToMessageId,
            ReplyToMessage = message.ReplyToMessage != null ? new MessageDto
            {
                Id = message.ReplyToMessage.Id,
                ConversationId = message.ReplyToMessage.ConversationId,
                SenderId = message.ReplyToMessage.SenderId,
                SenderName = message.ReplyToMessage.Sender != null
                    ? Utility.FormatName(message.ReplyToMessage.Sender.LastName, message.ReplyToMessage.Sender.FirstName)
                    : null,
                Content = message.ReplyToMessage.IsDeleted ? "[Message deleted]" : message.ReplyToMessage.Content,
                MessageType = message.ReplyToMessage.MessageType,
                CreatedAt = message.ReplyToMessage.SentAt,
                IsDeleted = message.ReplyToMessage.IsDeleted,
                IsOwn = message.ReplyToMessage.SenderId == currentUserId
            } : null,
            CreatedAt = message.SentAt,
            EditedAt = message.EditedAt,
            IsDeleted = message.IsDeleted,
            IsOwn = message.SenderId == currentUserId
        };
    }
}
