using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Services;

public interface IVideoRoomService
{
    Task<VideoRoomCreatedResponse> CreateRoomAsync(CreateVideoRoomRequest request, int? userId, string? userName, string baseUrl);
    Task<VideoRoomDto?> GetRoomByCodeAsync(string roomCode);
    Task<List<VideoRoomDto>> GetActiveRoomsAsync();
    Task<JoinVideoRoomResponse> ValidateJoinAsync(string roomCode, JoinVideoRoomRequest request);
    Task<bool> EndRoomAsync(string roomCode, int? userId);
    Task<bool> LockRoomAsync(string roomCode, int? userId, bool locked);
    string HashPasscode(string passcode);
    bool VerifyPasscode(string passcode, string hash);
    Task<VideoRoomDto> GetOrCreateClubRoomAsync(int clubId, int? userId, string? userName, string baseUrl);
    Task<bool> IsClubMemberAsync(int clubId, int userId);
}

public class VideoRoomService : IVideoRoomService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<VideoRoomService> _logger;

    public VideoRoomService(ApplicationDbContext context, ILogger<VideoRoomService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<VideoRoomCreatedResponse> CreateRoomAsync(
        CreateVideoRoomRequest request, int? userId, string? userName, string baseUrl)
    {
        // Generate room code
        var roomCode = GenerateRoomCode();

        // Ensure unique
        while (await _context.VideoRooms.AnyAsync(r => r.RoomCode == roomCode))
        {
            roomCode = GenerateRoomCode();
        }

        // Generate or use custom passcode
        var passcode = string.IsNullOrWhiteSpace(request.Passcode)
            ? GeneratePasscode()
            : request.Passcode;

        var room = new VideoRoom
        {
            RoomCode = roomCode,
            Name = request.Name,
            PasscodeHash = HashPasscode(passcode),
            CreatedBy = userId,
            CreatorName = userName,
            MaxParticipants = request.MaxParticipants > 0 ? request.MaxParticipants : 6,
            IsActive = true,
            ClubId = request.ClubId,
            IsClubRoom = request.ClubId.HasValue,
            CreatedAt = DateTime.UtcNow
        };

        _context.VideoRooms.Add(room);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Video room created: {RoomCode} by user {UserId}", roomCode, userId);

        return new VideoRoomCreatedResponse
        {
            RoomId = room.RoomId,
            RoomCode = room.RoomCode,
            Name = room.Name,
            Passcode = passcode,
            ShareLink = $"{baseUrl}/rooms/{room.RoomCode}",
            MaxParticipants = room.MaxParticipants,
            CreatedAt = room.CreatedAt
        };
    }

    public async Task<VideoRoomDto?> GetRoomByCodeAsync(string roomCode)
    {
        var room = await _context.VideoRooms
            .Include(r => r.Club)
            .FirstOrDefaultAsync(r => r.RoomCode == roomCode && r.IsActive);

        if (room == null) return null;

        return new VideoRoomDto
        {
            RoomId = room.RoomId,
            RoomCode = room.RoomCode,
            Name = room.Name,
            CreatorName = room.CreatorName,
            MaxParticipants = room.MaxParticipants,
            IsActive = room.IsActive,
            IsLocked = room.IsLocked,
            ParticipantCount = 0, // Will be filled from hub tracking
            CreatedAt = room.CreatedAt,
            ClubId = room.ClubId,
            ClubName = room.Club?.Name,
            IsClubRoom = room.IsClubRoom
        };
    }

    public async Task<List<VideoRoomDto>> GetActiveRoomsAsync()
    {
        return await _context.VideoRooms
            .Include(r => r.Club)
            .Where(r => r.IsActive)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new VideoRoomDto
            {
                RoomId = r.RoomId,
                RoomCode = r.RoomCode,
                Name = r.Name,
                CreatorName = r.CreatorName,
                MaxParticipants = r.MaxParticipants,
                IsActive = r.IsActive,
                IsLocked = r.IsLocked,
                ParticipantCount = 0,
                CreatedAt = r.CreatedAt,
                ClubId = r.ClubId,
                ClubName = r.Club != null ? r.Club.Name : null,
                IsClubRoom = r.IsClubRoom
            })
            .ToListAsync();
    }

    public async Task<JoinVideoRoomResponse> ValidateJoinAsync(string roomCode, JoinVideoRoomRequest request)
    {
        var room = await _context.VideoRooms
            .Include(r => r.Club)
            .FirstOrDefaultAsync(r => r.RoomCode == roomCode);

        if (room == null)
        {
            return new JoinVideoRoomResponse { Success = false, Error = "Room not found" };
        }

        if (!room.IsActive)
        {
            return new JoinVideoRoomResponse { Success = false, Error = "Room has ended" };
        }

        if (room.IsLocked)
        {
            return new JoinVideoRoomResponse { Success = false, Error = "Room is locked" };
        }

        if (!VerifyPasscode(request.Passcode, room.PasscodeHash))
        {
            return new JoinVideoRoomResponse { Success = false, Error = "Invalid passcode" };
        }

        return new JoinVideoRoomResponse
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
        };
    }

    public async Task<bool> EndRoomAsync(string roomCode, int? userId)
    {
        var room = await _context.VideoRooms
            .FirstOrDefaultAsync(r => r.RoomCode == roomCode && r.IsActive);

        if (room == null) return false;

        // Only creator can end the room
        if (room.CreatedBy != null && room.CreatedBy != userId)
        {
            return false;
        }

        room.IsActive = false;
        room.EndedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Video room ended: {RoomCode} by user {UserId}", roomCode, userId);
        return true;
    }

    public async Task<bool> LockRoomAsync(string roomCode, int? userId, bool locked)
    {
        var room = await _context.VideoRooms
            .FirstOrDefaultAsync(r => r.RoomCode == roomCode && r.IsActive);

        if (room == null) return false;

        if (room.CreatedBy != null && room.CreatedBy != userId)
        {
            return false;
        }

        room.IsLocked = locked;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Video room {Action}: {RoomCode}", locked ? "locked" : "unlocked", roomCode);
        return true;
    }

    public string HashPasscode(string passcode)
    {
        using var sha256 = SHA256.Create();
        var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(passcode));
        return Convert.ToBase64String(hashedBytes);
    }

    public bool VerifyPasscode(string passcode, string hash)
    {
        return HashPasscode(passcode) == hash;
    }

    private static string GenerateRoomCode()
    {
        const string chars = "abcdefghjkmnpqrstuvwxyz23456789";
        var random = RandomNumberGenerator.Create();
        var bytes = new byte[6];
        random.GetBytes(bytes);
        var code = new char[6];
        for (int i = 0; i < 6; i++)
        {
            code[i] = chars[bytes[i] % chars.Length];
        }
        return new string(code);
    }

    private static string GeneratePasscode()
    {
        var random = RandomNumberGenerator.Create();
        var bytes = new byte[4];
        random.GetBytes(bytes);
        var num = BitConverter.ToUInt32(bytes, 0) % 1000000;
        return num.ToString("D6");
    }

    public async Task<VideoRoomDto> GetOrCreateClubRoomAsync(int clubId, int? userId, string? userName, string baseUrl)
    {
        // Look for existing active club room
        var existingRoom = await _context.VideoRooms
            .Include(r => r.Club)
            .FirstOrDefaultAsync(r => r.ClubId == clubId && r.IsClubRoom && r.IsActive);

        if (existingRoom != null)
        {
            return new VideoRoomDto
            {
                RoomId = existingRoom.RoomId,
                RoomCode = existingRoom.RoomCode,
                Name = existingRoom.Name,
                CreatorName = existingRoom.CreatorName,
                MaxParticipants = existingRoom.MaxParticipants,
                IsActive = existingRoom.IsActive,
                IsLocked = existingRoom.IsLocked,
                ParticipantCount = 0,
                CreatedAt = existingRoom.CreatedAt,
                ClubId = existingRoom.ClubId,
                ClubName = existingRoom.Club?.Name,
                IsClubRoom = existingRoom.IsClubRoom
            };
        }

        // Get club name
        var club = await _context.Clubs.FindAsync(clubId);
        if (club == null)
        {
            throw new InvalidOperationException("Club not found");
        }

        // Create new persistent club room
        var roomCode = GenerateRoomCode();
        while (await _context.VideoRooms.AnyAsync(r => r.RoomCode == roomCode))
        {
            roomCode = GenerateRoomCode();
        }

        var passcode = GeneratePasscode();

        var room = new VideoRoom
        {
            RoomCode = roomCode,
            Name = $"{club.Name}'s Room",
            PasscodeHash = HashPasscode(passcode),
            CreatedBy = userId,
            CreatorName = userName,
            MaxParticipants = 0, // Unlimited for club rooms
            IsActive = true,
            IsClubRoom = true,
            ClubId = clubId,
            CreatedAt = DateTime.UtcNow
        };

        _context.VideoRooms.Add(room);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Club video room created: {RoomCode} for club {ClubId}", roomCode, clubId);

        return new VideoRoomDto
        {
            RoomId = room.RoomId,
            RoomCode = room.RoomCode,
            Name = room.Name,
            CreatorName = room.CreatorName,
            MaxParticipants = room.MaxParticipants,
            IsActive = room.IsActive,
            IsLocked = room.IsLocked,
            ParticipantCount = 0,
            CreatedAt = room.CreatedAt,
            ClubId = room.ClubId,
            ClubName = club.Name,
            IsClubRoom = room.IsClubRoom
        };
    }

    public async Task<bool> IsClubMemberAsync(int clubId, int userId)
    {
        return await _context.ClubMembers
            .AnyAsync(m => m.ClubId == clubId && m.UserId == userId && m.IsActive);
    }
}
