using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Controllers.Base;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class EventStaffController : EventControllerBase
{
    private readonly ILogger<EventStaffController> _logger;

    public EventStaffController(
        ApplicationDbContext context,
        ILogger<EventStaffController> logger)
        : base(context)
    {
        _logger = logger;
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
                CanFullyManageEvent = r.CanFullyManageEvent,
                AllowSelfRegistration = r.AllowSelfRegistration,
                SortOrder = r.SortOrder,
                IsActive = r.IsActive
            })
            .ToListAsync();

        return Ok(new ApiResponse<List<EventStaffRoleDto>> { Success = true, Data = roles });
    }

    /// <summary>
    /// Admin creates a global staff role (template available for all events)
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpPost("roles/global")]
    public async Task<ActionResult<ApiResponse<EventStaffRoleDto>>> CreateGlobalStaffRole(
        [FromBody] CreateEventStaffRoleDto dto)
    {
        var role = new EventStaffRole
        {
            EventId = null, // Global role
            Name = dto.Name,
            Description = dto.Description,
            CanManageSchedule = dto.CanManageSchedule,
            CanManageCourts = dto.CanManageCourts,
            CanRecordScores = dto.CanRecordScores,
            CanCheckInPlayers = dto.CanCheckInPlayers,
            CanManageLineups = dto.CanManageLineups,
            CanViewAllData = dto.CanViewAllData,
            CanFullyManageEvent = dto.CanFullyManageEvent,
            AllowSelfRegistration = dto.AllowSelfRegistration,
            SortOrder = dto.SortOrder
        };

        _context.EventStaffRoles.Add(role);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Admin created global staff role: {RoleName}", role.Name);

        return Ok(new ApiResponse<EventStaffRoleDto>
        {
            Success = true,
            Data = MapRoleToDto(role)
        });
    }

    /// <summary>
    /// Admin updates a global staff role
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpPut("roles/global/{roleId}")]
    public async Task<ActionResult<ApiResponse<EventStaffRoleDto>>> UpdateGlobalStaffRole(
        int roleId,
        [FromBody] CreateEventStaffRoleDto dto)
    {
        var role = await _context.EventStaffRoles
            .FirstOrDefaultAsync(r => r.Id == roleId && r.EventId == null);

        if (role == null)
            return NotFound(new ApiResponse<EventStaffRoleDto> { Success = false, Message = "Global role not found" });

        role.Name = dto.Name;
        role.Description = dto.Description;
        role.CanManageSchedule = dto.CanManageSchedule;
        role.CanManageCourts = dto.CanManageCourts;
        role.CanRecordScores = dto.CanRecordScores;
        role.CanCheckInPlayers = dto.CanCheckInPlayers;
        role.CanManageLineups = dto.CanManageLineups;
        role.CanViewAllData = dto.CanViewAllData;
        role.CanFullyManageEvent = dto.CanFullyManageEvent;
        role.AllowSelfRegistration = dto.AllowSelfRegistration;
        role.SortOrder = dto.SortOrder;
        role.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Admin updated global staff role: {RoleId} - {RoleName}", role.Id, role.Name);

        return Ok(new ApiResponse<EventStaffRoleDto>
        {
            Success = true,
            Data = MapRoleToDto(role)
        });
    }

    /// <summary>
    /// Admin deletes (soft-deletes) a global staff role
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpDelete("roles/global/{roleId}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteGlobalStaffRole(int roleId)
    {
        var role = await _context.EventStaffRoles
            .FirstOrDefaultAsync(r => r.Id == roleId && r.EventId == null);

        if (role == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Global role not found" });

        // Check if any staff are using this role
        var staffUsingRole = await _context.EventStaff
            .AnyAsync(s => s.RoleId == roleId);

        if (staffUsingRole)
        {
            // Soft delete - keep for historical records
            role.IsActive = false;
            role.UpdatedAt = DateTime.Now;
        }
        else
        {
            // Hard delete if no staff using it
            _context.EventStaffRoles.Remove(role);
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Admin deleted global staff role: {RoleId} - {RoleName}", roleId, role.Name);

        return Ok(new ApiResponse<bool> { Success = true, Data = true });
    }

    private static EventStaffRoleDto MapRoleToDto(EventStaffRole r)
    {
        return new EventStaffRoleDto
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
            CanFullyManageEvent = r.CanFullyManageEvent,
            AllowSelfRegistration = r.AllowSelfRegistration,
            SortOrder = r.SortOrder,
            IsActive = r.IsActive
        };
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
                CanFullyManageEvent = r.CanFullyManageEvent,
                AllowSelfRegistration = r.AllowSelfRegistration,
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
            CanFullyManageEvent = dto.CanFullyManageEvent,
            AllowSelfRegistration = dto.AllowSelfRegistration,
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
            CanFullyManageEvent = role.CanFullyManageEvent,
            AllowSelfRegistration = role.AllowSelfRegistration,
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
                CanViewAllData = s.Role != null && s.Role.CanViewAllData,
                CanFullyManageEvent = s.Role != null && s.Role.CanFullyManageEvent
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
            return Unauthorized(new ApiResponse<EventStaffDto> { Success = false, Message = "User not authenticated" });

        // Check if already registered
        var existing = await _context.EventStaff
            .FirstOrDefaultAsync(s => s.EventId == eventId && s.UserId == userId.Value);

        if (existing != null)
            return BadRequest(new ApiResponse<EventStaffDto> { Success = false, Message = "You are already registered as staff for this event" });

        // Validate role if provided
        if (dto.RoleId.HasValue)
        {
            var role = await _context.EventStaffRoles.FindAsync(dto.RoleId.Value);
            if (role == null || (!role.IsActive) || (role.EventId != null && role.EventId != eventId))
                return BadRequest(new ApiResponse<EventStaffDto> { Success = false, Message = "Invalid role selected" });
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
            return BadRequest(new ApiResponse<EventStaffDto> { Success = false, Message = "User is already registered as staff for this event" });

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
            return NotFound(new ApiResponse<EventStaffDto> { Success = false, Message = "Staff assignment not found" });

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
            return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

        var staff = await _context.EventStaff
            .FirstOrDefaultAsync(s => s.Id == staffId && s.EventId == eventId);

        if (staff == null)
            return NotFound(new ApiResponse<bool> { Success = false, Message = "Staff assignment not found" });

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
            return Unauthorized(new ApiResponse<EventStaffDto?> { Success = false, Message = "User not authenticated" });

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
    /// Get staff dashboard data for current user based on their permissions
    /// </summary>
    [Authorize]
    [HttpGet("event/{eventId}/dashboard")]
    public async Task<ActionResult<ApiResponse<StaffDashboardDto>>> GetStaffDashboard(int eventId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<StaffDashboardDto> { Success = false, Message = "User not authenticated" });

        // Get staff assignment with role
        var staff = await _context.EventStaff
            .Include(s => s.Role)
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.EventId == eventId && s.UserId == userId.Value && s.Status == "Active");

        var isOrganizer = await IsEventOrganizerAsync(eventId);
        var isAdmin = await IsAdminAsync();

        // Build permissions object
        var permissions = new StaffPermissionsDto
        {
            CanManageSchedule = isOrganizer || isAdmin || (staff?.Role?.CanManageSchedule ?? false),
            CanManageCourts = isOrganizer || isAdmin || (staff?.Role?.CanManageCourts ?? false),
            CanRecordScores = isOrganizer || isAdmin || (staff?.Role?.CanRecordScores ?? false),
            CanCheckInPlayers = isOrganizer || isAdmin || (staff?.Role?.CanCheckInPlayers ?? false),
            CanManageLineups = isOrganizer || isAdmin || (staff?.Role?.CanManageLineups ?? false),
            CanViewAllData = isOrganizer || isAdmin || (staff?.Role?.CanViewAllData ?? false),
            CanFullyManageEvent = isOrganizer || isAdmin || (staff?.Role?.CanFullyManageEvent ?? false),
            IsOrganizer = isOrganizer,
            IsAdmin = isAdmin
        };

        // If no permissions at all, return empty dashboard
        if (!permissions.CanManageSchedule && !permissions.CanManageCourts &&
            !permissions.CanRecordScores && !permissions.CanCheckInPlayers &&
            !permissions.CanManageLineups && !permissions.CanViewAllData)
        {
            return Ok(new ApiResponse<StaffDashboardDto>
            {
                Success = true,
                Data = new StaffDashboardDto
                {
                    RoleName = staff?.Role?.Name,
                    UserName = staff?.User != null ? $"{staff.User.FirstName} {staff.User.LastName}" : null,
                    Permissions = permissions
                }
            });
        }

        var dashboard = new StaffDashboardDto
        {
            RoleName = isOrganizer ? "Event Organizer" : (isAdmin ? "Admin" : staff?.Role?.Name),
            UserName = staff?.User != null ? $"{staff.User.FirstName} {staff.User.LastName}" : null,
            Permissions = permissions
        };

        // Get event info
        var evt = await _context.Events.FindAsync(eventId);
        if (evt != null)
        {
            dashboard.EventName = evt.Name;
            dashboard.EventDate = evt.StartDate;
        }

        // Load data based on permissions
        if (permissions.CanRecordScores || permissions.CanViewAllData)
        {
            // Get encounters awaiting scores (InProgress or scheduled)
            var scoringEncounters = await _context.EventEncounters
                .Where(e => e.Event!.Id == eventId &&
                           (e.Status == "InProgress" || e.Status == "Scheduled" || e.Status == "Ready"))
                .Include(e => e.Unit1)
                .Include(e => e.Unit2)
                .Include(e => e.TournamentCourt)
                .Include(e => e.Division)
                .OrderBy(e => e.EstimatedStartTime ?? e.ScheduledTime)
                .Take(20)
                .Select(e => new EncounterSummaryDto
                {
                    Id = e.Id,
                    Unit1Name = e.Unit1 != null ? e.Unit1.UnitName : "TBD",
                    Unit2Name = e.Unit2 != null ? e.Unit2.UnitName : "TBD",
                    CourtLabel = e.TournamentCourt != null ? e.TournamentCourt.CourtLabel : null,
                    DivisionName = e.Division != null ? e.Division.Name : null,
                    Status = e.Status,
                    ScheduledTime = e.EstimatedStartTime ?? e.ScheduledTime,
                    RoundNumber = e.RoundNumber
                })
                .ToListAsync();

            dashboard.ScoringEncounters = scoringEncounters;
        }

        if (permissions.CanCheckInPlayers || permissions.CanViewAllData)
        {
            // Get registrations awaiting check-in
            var pendingCheckIns = await _context.EventRegistrations
                .Where(r => r.EventId == eventId &&
                           r.Status == "Approved" &&
                           r.CheckedIn != true)
                .Include(r => r.User)
                .Include(r => r.Division)
                .OrderBy(r => r.Division!.Name)
                .ThenBy(r => r.User!.LastName)
                .Take(50)
                .Select(r => new CheckInItemDto
                {
                    RegistrationId = r.Id,
                    UserId = r.UserId,
                    UserName = r.User != null ? $"{r.User.FirstName} {r.User.LastName}" : "Unknown",
                    DivisionName = r.Division != null ? r.Division.Name : null,
                    DivisionId = r.DivisionId
                })
                .ToListAsync();

            dashboard.PendingCheckIns = pendingCheckIns;

            // Get check-in stats
            var totalApproved = await _context.EventRegistrations
                .CountAsync(r => r.EventId == eventId && r.Status == "Approved");
            var checkedIn = await _context.EventRegistrations
                .CountAsync(r => r.EventId == eventId && r.Status == "Approved" && r.CheckedIn == true);

            dashboard.CheckInStats = new CheckInStatsDto
            {
                TotalApproved = totalApproved,
                CheckedIn = checkedIn,
                Remaining = totalApproved - checkedIn
            };
        }

        if (permissions.CanManageCourts || permissions.CanViewAllData)
        {
            // Get court status
            var courts = await _context.TournamentCourts
                .Where(c => c.EventId == eventId && c.IsActive)
                .OrderBy(c => c.SortOrder)
                .Select(c => new CourtStatusDto
                {
                    CourtId = c.Id,
                    CourtLabel = c.CourtLabel,
                    Status = c.Status,
                    LocationDescription = c.LocationDescription,
                    CurrentEncounterId = _context.EventEncounters
                        .Where(e => e.TournamentCourtId == c.Id && e.Status == "InProgress")
                        .Select(e => (int?)e.Id)
                        .FirstOrDefault(),
                    CurrentMatchDescription = _context.EventEncounters
                        .Where(e => e.TournamentCourtId == c.Id && e.Status == "InProgress")
                        .Select(e => (e.Unit1 != null ? e.Unit1.UnitName : "TBD") + " vs " + (e.Unit2 != null ? e.Unit2.UnitName : "TBD"))
                        .FirstOrDefault()
                })
                .ToListAsync();

            dashboard.CourtStatuses = courts;
        }

        if (permissions.CanManageSchedule || permissions.CanViewAllData)
        {
            // Get upcoming encounters
            var upcomingEncounters = await _context.EventEncounters
                .Where(e => e.Event!.Id == eventId &&
                           (e.Status == "Scheduled" || e.Status == "Ready"))
                .Include(e => e.Unit1)
                .Include(e => e.Unit2)
                .Include(e => e.TournamentCourt)
                .Include(e => e.Division)
                .OrderBy(e => e.EstimatedStartTime ?? e.ScheduledTime)
                .Take(30)
                .Select(e => new EncounterSummaryDto
                {
                    Id = e.Id,
                    Unit1Name = e.Unit1 != null ? e.Unit1.UnitName : "TBD",
                    Unit2Name = e.Unit2 != null ? e.Unit2.UnitName : "TBD",
                    CourtLabel = e.TournamentCourt != null ? e.TournamentCourt.CourtLabel : null,
                    DivisionName = e.Division != null ? e.Division.Name : null,
                    Status = e.Status,
                    ScheduledTime = e.EstimatedStartTime ?? e.ScheduledTime,
                    RoundNumber = e.RoundNumber
                })
                .ToListAsync();

            dashboard.UpcomingEncounters = upcomingEncounters;

            // Get schedule stats by division
            var divisionStats = await _context.EventDivisions
                .Where(d => d.EventId == eventId)
                .Select(d => new DivisionScheduleStatsDto
                {
                    DivisionId = d.Id,
                    DivisionName = d.Name,
                    TotalEncounters = _context.EventEncounters.Count(e => e.DivisionId == d.Id),
                    CompletedEncounters = _context.EventEncounters.Count(e => e.DivisionId == d.Id && e.Status == "Completed"),
                    InProgressEncounters = _context.EventEncounters.Count(e => e.DivisionId == d.Id && e.Status == "InProgress")
                })
                .ToListAsync();

            dashboard.DivisionStats = divisionStats;
        }

        return Ok(new ApiResponse<StaffDashboardDto> { Success = true, Data = dashboard });
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
            "fullymanageevent" => staff.Role.CanFullyManageEvent,
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
            CanViewAllData = s.Role?.CanViewAllData ?? false,
            CanFullyManageEvent = s.Role?.CanFullyManageEvent ?? false
        };
    }
}
