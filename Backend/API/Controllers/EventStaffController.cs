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
public class EventStaffController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<EventStaffController> _logger;

    public EventStaffController(
        ApplicationDbContext context,
        ILogger<EventStaffController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private async Task<bool> IsAdminAsync()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return false;

        var user = await _context.Users.FindAsync(userId.Value);
        return user?.Role == "Admin";
    }

    private async Task<bool> IsEventOrganizerAsync(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return false;

        var ev = await _context.Events.FindAsync(eventId);
        return ev?.OrganizedByUserId == userId.Value;
    }

    private async Task<bool> CanManageEventAsync(int eventId)
    {
        return await IsAdminAsync() || await IsEventOrganizerAsync(eventId);
    }

    // ============================================
    // Staff Roles
    // ============================================

    /// <summary>
    /// Get global staff roles (available as templates for all events)
    /// </summary>
    [HttpGet("roles/global")]
    public async Task<ActionResult<ApiResponse<List<EventStaffRoleDto>>>> GetGlobalStaffRoles()
    {
        var roles = await _context.EventStaffRoles
            .Where(r => r.EventId == null && r.IsActive)
            .OrderBy(r => r.SortOrder)
            .Select(r => new EventStaffRoleDto
            {
                Id = r.Id,
                EventId = r.EventId,
                Name = r.Name,
                Description = r.Description,
                CanManageSchedule = r.CanManageSchedule,
                CanManageCourts = r.CanManageCourts,
                CanRecordScores = r.CanRecordScores,
                CanCheckInPlayers = r.CanCheckInPlayers,
                CanManageLineups = r.CanManageLineups,
                CanViewAllData = r.CanViewAllData,
                SortOrder = r.SortOrder,
                IsActive = r.IsActive
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<EventStaffRoleDto>> { Success = true, Data = roles });
    }

    /// <summary>
    /// Get staff roles for a specific event (includes global + event-specific)
    /// </summary>
    [HttpGet("event/{eventId}/roles")]
    public async Task<ActionResult<ApiResponse<List<EventStaffRoleDto>>>> GetEventStaffRoles(int eventId)
    {
        var roles = await _context.EventStaffRoles
            .Where(r => (r.EventId == null || r.EventId == eventId) && r.IsActive)
            .OrderBy(r => r.EventId == null ? 0 : 1) // Global first
            .ThenBy(r => r.SortOrder)
            .Select(r => new EventStaffRoleDto
            {
                Id = r.Id,
                EventId = r.EventId,
                Name = r.Name,
                Description = r.Description,
                CanManageSchedule = r.CanManageSchedule,
                CanManageCourts = r.CanManageCourts,
                CanRecordScores = r.CanRecordScores,
                CanCheckInPlayers = r.CanCheckInPlayers,
                CanManageLineups = r.CanManageLineups,
                CanViewAllData = r.CanViewAllData,
                SortOrder = r.SortOrder,
                IsActive = r.IsActive
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<EventStaffRoleDto>> { Success = true, Data = roles });
    }

    /// <summary>
    /// Create a custom staff role for an event
    /// </summary>
    [Authorize]
    [HttpPost("event/{eventId}/roles")]
    public async Task<ActionResult<ApiResponse<EventStaffRoleDto>>> CreateEventStaffRole(
        int eventId,
        [FromBody] CreateEventStaffRoleDto dto)
    {
        if (!await CanManageEventAsync(eventId))
            return Forbid();

        var role = new EventStaffRole
        {
            EventId = eventId,
            Name = dto.Name,
            Description = dto.Description,
            CanManageSchedule = dto.CanManageSchedule,
            CanManageCourts = dto.CanManageCourts,
            CanRecordScores = dto.CanRecordScores,
            CanCheckInPlayers = dto.CanCheckInPlayers,
            CanManageLineups = dto.CanManageLineups,
            CanViewAllData = dto.CanViewAllData,
            SortOrder = dto.SortOrder
        };

        _context.EventStaffRoles.Add(role);
        await _context.SaveChangesAsync();

        var result = new EventStaffRoleDto
        {
            Id = role.Id,
            EventId = role.EventId,
            Name = role.Name,
            Description = role.Description,
            CanManageSchedule = role.CanManageSchedule,
            CanManageCourts = role.CanManageCourts,
            CanRecordScores = role.CanRecordScores,
            CanCheckInPlayers = role.CanCheckInPlayers,
            CanManageLineups = role.CanManageLineups,
            CanViewAllData = role.CanViewAllData,
            SortOrder = role.SortOrder,
            IsActive = role.IsActive
        };

        return Ok(new ApiResponse<EventStaffRoleDto> { Success = true, Data = result });
    }

    // ============================================
    // Staff Management
    // ============================================

    /// <summary>
    /// Get all staff for an event
    /// </summary>
    [HttpGet("event/{eventId}")]
    public async Task<ActionResult<ApiResponse<List<EventStaffDto>>>> GetEventStaff(int eventId)
    {
        var staff = await _context.EventStaff
            .Where(s => s.EventId == eventId)
            .Include(s => s.User)
            .Include(s => s.Role)
            .Include(s => s.AssignedBy)
            .OrderByDescending(s => s.Priority)
            .ThenBy(s => s.Role != null ? s.Role.SortOrder : 999)
            .ThenBy(s => s.CreatedAt)
            .Select(s => new EventStaffDto
            {
                Id = s.Id,
                EventId = s.EventId,
                UserId = s.UserId,
                UserName = s.User != null ? s.User.FirstName + " " + s.User.LastName : null,
                UserEmail = s.User != null ? s.User.Email : null,
                UserProfileImageUrl = s.User != null ? s.User.ProfileImageUrl : null,
                RoleId = s.RoleId,
                RoleName = s.Role != null ? s.Role.Name : null,
                IsSelfRegistered = s.IsSelfRegistered,
                Status = s.Status,
                Priority = s.Priority,
                AvailableFrom = s.AvailableFrom,
                AvailableTo = s.AvailableTo,
                SelfRegistrationNotes = s.SelfRegistrationNotes,
                AdminNotes = s.AdminNotes,
                AssignedByUserId = s.AssignedByUserId,
                AssignedByUserName = s.AssignedBy != null ? s.AssignedBy.FirstName + " " + s.AssignedBy.LastName : null,
                AssignedAt = s.AssignedAt,
                CreatedAt = s.CreatedAt,
                UpdatedAt = s.UpdatedAt,
                CanManageSchedule = s.Role != null && s.Role.CanManageSchedule,
                CanManageCourts = s.Role != null && s.Role.CanManageCourts,
                CanRecordScores = s.Role != null && s.Role.CanRecordScores,
                CanCheckInPlayers = s.Role != null && s.Role.CanCheckInPlayers,
                CanManageLineups = s.Role != null && s.Role.CanManageLineups,
                CanViewAllData = s.Role != null && s.Role.CanViewAllData
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<EventStaffDto>> { Success = true, Data = staff });
    }

    /// <summary>
    /// Self-register as staff for an event (creates pending request)
    /// </summary>
    [Authorize]
    [HttpPost("event/{eventId}/self-register")]
    public async Task<ActionResult<ApiResponse<EventStaffDto>>> SelfRegisterAsStaff(
        int eventId,
        [FromBody] CreateEventStaffSelfRegistrationDto dto)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<EventStaffDto> { Success = false, Error = "User not authenticated" });

        // Check if already registered
        var existing = await _context.EventStaff
            .FirstOrDefaultAsync(s => s.EventId == eventId && s.UserId == userId.Value);

        if (existing != null)
            return BadRequest(new ApiResponse<EventStaffDto> { Success = false, Error = "You are already registered as staff for this event" });

        // Validate role if provided
        if (dto.RoleId.HasValue)
        {
            var role = await _context.EventStaffRoles.FindAsync(dto.RoleId.Value);
            if (role == null || (!role.IsActive) || (role.EventId != null && role.EventId != eventId))
                return BadRequest(new ApiResponse<EventStaffDto> { Success = false, Error = "Invalid role selected" });
        }

        var staff = new EventStaff
        {
            EventId = eventId,
            UserId = userId.Value,
            RoleId = dto.RoleId,
            IsSelfRegistered = true,
            Status = "Pending",
            Priority = 0,
            AvailableFrom = dto.AvailableFrom,
            AvailableTo = dto.AvailableTo,
            SelfRegistrationNotes = dto.Notes
        };

        _context.EventStaff.Add(staff);
        await _context.SaveChangesAsync();

        // Load related data
        await _context.Entry(staff).Reference(s => s.User).LoadAsync();
        await _context.Entry(staff).Reference(s => s.Role).LoadAsync();

        var result = MapToDto(staff);
        return Ok(new ApiResponse<EventStaffDto> { Success = true, Data = result });
    }

    /// <summary>
    /// Admin assigns a user as staff
    /// </summary>
    [Authorize]
    [HttpPost("event/{eventId}")]
    public async Task<ActionResult<ApiResponse<EventStaffDto>>> AssignStaff(
        int eventId,
        [FromBody] CreateEventStaffDto dto)
    {
        if (!await CanManageEventAsync(eventId))
            return Forbid();

        var adminUserId = GetUserId()!.Value;

        // Check if already registered
        var existing = await _context.EventStaff
            .FirstOrDefaultAsync(s => s.EventId == eventId && s.UserId == dto.UserId);

        if (existing != null)
            return BadRequest(new ApiResponse<EventStaffDto> { Success = false, Error = "User is already registered as staff for this event" });

        var staff = new EventStaff
        {
            EventId = eventId,
            UserId = dto.UserId,
            RoleId = dto.RoleId,
            IsSelfRegistered = false,
            Status = dto.Status,
            Priority = dto.Priority,
            AvailableFrom = dto.AvailableFrom,
            AvailableTo = dto.AvailableTo,
            AdminNotes = dto.AdminNotes,
            AssignedByUserId = adminUserId,
            AssignedAt = DateTime.Now
        };

        _context.EventStaff.Add(staff);
        await _context.SaveChangesAsync();

        // Load related data
        await _context.Entry(staff).Reference(s => s.User).LoadAsync();
        await _context.Entry(staff).Reference(s => s.Role).LoadAsync();
        await _context.Entry(staff).Reference(s => s.AssignedBy).LoadAsync();

        var result = MapToDto(staff);
        return Ok(new ApiResponse<EventStaffDto> { Success = true, Data = result });
    }

    /// <summary>
    /// Admin updates a staff assignment (role, priority, status, etc.)
    /// </summary>
    [Authorize]
    [HttpPut("event/{eventId}/staff/{staffId}")]
    public async Task<ActionResult<ApiResponse<EventStaffDto>>> UpdateStaff(
        int eventId,
        int staffId,
        [FromBody] UpdateEventStaffDto dto)
    {
        if (!await CanManageEventAsync(eventId))
            return Forbid();

        var staff = await _context.EventStaff
            .Include(s => s.User)
            .Include(s => s.Role)
            .FirstOrDefaultAsync(s => s.Id == staffId && s.EventId == eventId);

        if (staff == null)
            return NotFound(new ApiResponse<EventStaffDto> { Success = false, Error = "Staff assignment not found" });

        var adminUserId = GetUserId()!.Value;

        // Update fields
        if (dto.RoleId.HasValue)
            staff.RoleId = dto.RoleId;
        if (dto.Status != null)
            staff.Status = dto.Status;
        if (dto.Priority.HasValue)
            staff.Priority = dto.Priority.Value;
        if (dto.AvailableFrom.HasValue)
            staff.AvailableFrom = dto.AvailableFrom;
        if (dto.AvailableTo.HasValue)
            staff.AvailableTo = dto.AvailableTo;
        if (dto.AdminNotes != null)
            staff.AdminNotes = dto.AdminNotes;

        // If changing status to Active/Approved, record who approved
        if (dto.Status == "Active" || dto.Status == "Approved")
        {
            staff.AssignedByUserId = adminUserId;
            staff.AssignedAt = DateTime.Now;
        }

        staff.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        // Reload role if changed
        await _context.Entry(staff).Reference(s => s.Role).LoadAsync();
        await _context.Entry(staff).Reference(s => s.AssignedBy).LoadAsync();

        var result = MapToDto(staff);
        return Ok(new ApiResponse<EventStaffDto> { Success = true, Data = result });
    }

    /// <summary>
    /// Remove a staff assignment
    /// </summary>
    [Authorize]
    [HttpDelete("event/{eventId}/staff/{staffId}")]
    public async Task<ActionResult<ApiResponse<bool>>> RemoveStaff(int eventId, int staffId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<bool> { Success = false, Error = "User not authenticated" });

        var staff = await _context.EventStaff
            .FirstOrDefaultAsync(s => s.Id == staffId && s.EventId == eventId);

        if (staff == null)
            return NotFound(new ApiResponse<bool> { Success = false, Error = "Staff assignment not found" });

        // Allow self-removal or admin removal
        var isOwn = staff.UserId == userId.Value;
        var canManage = await CanManageEventAsync(eventId);

        if (!isOwn && !canManage)
            return Forbid();

        _context.EventStaff.Remove(staff);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<bool> { Success = true, Data = true });
    }

    /// <summary>
    /// Get current user's staff status for an event
    /// </summary>
    [Authorize]
    [HttpGet("event/{eventId}/my-status")]
    public async Task<ActionResult<ApiResponse<EventStaffDto?>>> GetMyStaffStatus(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<EventStaffDto?> { Success = false, Error = "User not authenticated" });

        var staff = await _context.EventStaff
            .Include(s => s.User)
            .Include(s => s.Role)
            .FirstOrDefaultAsync(s => s.EventId == eventId && s.UserId == userId.Value);

        if (staff == null)
            return Ok(new ApiResponse<EventStaffDto?> { Success = true, Data = null });

        var result = MapToDto(staff);
        return Ok(new ApiResponse<EventStaffDto?> { Success = true, Data = result });
    }

    /// <summary>
    /// Check if current user has specific staff permission for an event
    /// </summary>
    [Authorize]
    [HttpGet("event/{eventId}/has-permission/{permission}")]
    public async Task<ActionResult<ApiResponse<bool>>> HasPermission(int eventId, string permission)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Ok(new ApiResponse<bool> { Success = true, Data = false });

        // Check if organizer or admin (they have all permissions)
        if (await CanManageEventAsync(eventId))
            return Ok(new ApiResponse<bool> { Success = true, Data = true });

        // Check staff role permissions
        var staff = await _context.EventStaff
            .Include(s => s.Role)
            .FirstOrDefaultAsync(s => s.EventId == eventId && s.UserId == userId.Value && s.Status == "Active");

        if (staff?.Role == null)
            return Ok(new ApiResponse<bool> { Success = true, Data = false });

        var hasPermission = permission.ToLower() switch
        {
            "manageschedule" => staff.Role.CanManageSchedule,
            "managecourts" => staff.Role.CanManageCourts,
            "recordscores" => staff.Role.CanRecordScores,
            "checkinplayers" => staff.Role.CanCheckInPlayers,
            "managelineups" => staff.Role.CanManageLineups,
            "viewalldata" => staff.Role.CanViewAllData,
            _ => false
        };

        return Ok(new ApiResponse<bool> { Success = true, Data = hasPermission });
    }

    private static EventStaffDto MapToDto(EventStaff s)
    {
        return new EventStaffDto
        {
            Id = s.Id,
            EventId = s.EventId,
            UserId = s.UserId,
            UserName = s.User != null ? s.User.FirstName + " " + s.User.LastName : null,
            UserEmail = s.User != null ? s.User.Email : null,
            UserProfileImageUrl = s.User != null ? s.User.ProfileImageUrl : null,
            RoleId = s.RoleId,
            RoleName = s.Role != null ? s.Role.Name : null,
            IsSelfRegistered = s.IsSelfRegistered,
            Status = s.Status,
            Priority = s.Priority,
            AvailableFrom = s.AvailableFrom,
            AvailableTo = s.AvailableTo,
            SelfRegistrationNotes = s.SelfRegistrationNotes,
            AdminNotes = s.AdminNotes,
            AssignedByUserId = s.AssignedByUserId,
            AssignedByUserName = s.AssignedBy != null ? s.AssignedBy.FirstName + " " + s.AssignedBy.LastName : null,
            AssignedAt = s.AssignedAt,
            CreatedAt = s.CreatedAt,
            UpdatedAt = s.UpdatedAt,
            CanManageSchedule = s.Role?.CanManageSchedule ?? false,
            CanManageCourts = s.Role?.CanManageCourts ?? false,
            CanRecordScores = s.Role?.CanRecordScores ?? false,
            CanCheckInPlayers = s.Role?.CanCheckInPlayers ?? false,
            CanManageLineups = s.Role?.CanManageLineups ?? false,
            CanViewAllData = s.Role?.CanViewAllData ?? false
        };
    }
}
