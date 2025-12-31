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
public class EventsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<EventsController> _logger;

    public EventsController(ApplicationDbContext context, ILogger<EventsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    // GET: /events/search - Search for events
    [HttpGet("search")]
    public async Task<ActionResult<ApiResponse<PagedResult<EventDto>>>> SearchEvents([FromQuery] EventSearchRequest request)
    {
        try
        {
            var query = _context.Events
                .Include(e => e.EventType)
                .Include(e => e.OrganizedBy)
                .Include(e => e.OrganizedByClub)
                .Include(e => e.Divisions)
                .Include(e => e.Registrations)
                .Where(e => e.IsActive && e.IsPublished)
                .AsQueryable();

            // Apply filters
            if (!string.IsNullOrWhiteSpace(request.Query))
            {
                var searchPattern = $"%{request.Query}%";
                query = query.Where(e =>
                    EF.Functions.Like(e.Name, searchPattern) ||
                    (e.Description != null && EF.Functions.Like(e.Description, searchPattern)) ||
                    (e.VenueName != null && EF.Functions.Like(e.VenueName, searchPattern)));
            }

            if (request.EventTypeId.HasValue)
            {
                query = query.Where(e => e.EventTypeId == request.EventTypeId.Value);
            }

            if (!string.IsNullOrWhiteSpace(request.Country))
            {
                var countryPattern = $"%{request.Country}%";
                query = query.Where(e => e.Country != null && EF.Functions.Like(e.Country, countryPattern));
            }

            if (!string.IsNullOrWhiteSpace(request.State))
            {
                var statePattern = $"%{request.State}%";
                query = query.Where(e => e.State != null && EF.Functions.Like(e.State, statePattern));
            }

            if (!string.IsNullOrWhiteSpace(request.City))
            {
                var cityPattern = $"%{request.City}%";
                query = query.Where(e => e.City != null && EF.Functions.Like(e.City, cityPattern));
            }

            if (request.StartDateFrom.HasValue)
            {
                query = query.Where(e => e.StartDate >= request.StartDateFrom.Value);
            }

            if (request.StartDateTo.HasValue)
            {
                query = query.Where(e => e.StartDate <= request.StartDateTo.Value);
            }

            if (request.IsUpcoming == true)
            {
                query = query.Where(e => e.StartDate >= DateTime.UtcNow);
            }

            // Get events with counts
            var events = await query.ToListAsync();

            // Apply distance filter if coordinates provided
            List<(Event evt, double? distance)> eventsWithDistance;
            if (request.Latitude.HasValue && request.Longitude.HasValue)
            {
                eventsWithDistance = events
                    .Select(e =>
                    {
                        double? distance = null;
                        if (e.Latitude.HasValue && e.Longitude.HasValue)
                            distance = CalculateDistance(request.Latitude.Value, request.Longitude.Value, e.Latitude.Value, e.Longitude.Value);
                        return (evt: e, distance);
                    })
                    .Where(x => !request.RadiusMiles.HasValue || x.distance == null || x.distance <= request.RadiusMiles.Value)
                    .OrderBy(x => x.evt.StartDate)
                    .ThenBy(x => x.distance ?? double.MaxValue)
                    .ToList();
            }
            else
            {
                eventsWithDistance = events
                    .Select(e => (evt: e, distance: (double?)null))
                    .OrderBy(x => x.evt.StartDate)
                    .ToList();
            }

            var totalCount = eventsWithDistance.Count;
            var pagedEvents = eventsWithDistance
                .Skip((request.Page - 1) * request.PageSize)
                .Take(request.PageSize)
                .ToList();

            var eventDtos = pagedEvents.Select(x => MapToEventDto(x.evt, x.distance)).ToList();

            return Ok(new ApiResponse<PagedResult<EventDto>>
            {
                Success = true,
                Data = new PagedResult<EventDto>
                {
                    Items = eventDtos,
                    TotalCount = totalCount,
                    Page = request.Page,
                    PageSize = request.PageSize
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching events");
            return StatusCode(500, new ApiResponse<PagedResult<EventDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /events/featured - Get featured events for home page
    [HttpGet("featured")]
    public async Task<ActionResult<ApiResponse<FeaturedEventsDto>>> GetFeaturedEvents([FromQuery] int limit = 6, [FromQuery] int pastDays = 7)
    {
        try
        {
            var now = DateTime.UtcNow;
            var pastCutoff = now.AddDays(-pastDays);

            // Upcoming events
            var upcomingEvents = await _context.Events
                .Include(e => e.EventType)
                .Include(e => e.OrganizedBy)
                .Include(e => e.Divisions)
                .Include(e => e.Registrations)
                .Where(e => e.IsActive && e.IsPublished && e.StartDate >= now)
                .OrderBy(e => e.StartDate)
                .Take(limit)
                .ToListAsync();

            // Popular events (most registrations)
            var popularEvents = await _context.Events
                .Include(e => e.EventType)
                .Include(e => e.OrganizedBy)
                .Include(e => e.Divisions)
                .Include(e => e.Registrations)
                .Where(e => e.IsActive && e.IsPublished && e.StartDate >= now)
                .OrderByDescending(e => e.Registrations.Count)
                .Take(limit)
                .ToListAsync();

            // Recent past events (events that ended within the past X days)
            var recentPastEvents = await _context.Events
                .Include(e => e.EventType)
                .Include(e => e.OrganizedBy)
                .Include(e => e.Divisions)
                .Include(e => e.Registrations)
                .Where(e => e.IsActive && e.IsPublished && e.StartDate < now && e.StartDate >= pastCutoff)
                .OrderByDescending(e => e.StartDate)
                .Take(limit)
                .ToListAsync();

            return Ok(new ApiResponse<FeaturedEventsDto>
            {
                Success = true,
                Data = new FeaturedEventsDto
                {
                    UpcomingEvents = upcomingEvents.Select(e => MapToEventDto(e, null)).ToList(),
                    PopularEvents = popularEvents.Select(e => MapToEventDto(e, null)).ToList(),
                    RecentPastEvents = recentPastEvents.Select(e => MapToEventDto(e, null)).ToList()
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching featured events");
            return StatusCode(500, new ApiResponse<FeaturedEventsDto> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /events/{id} - Get event details
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<EventDetailDto>>> GetEvent(int id)
    {
        try
        {
            var evt = await _context.Events
                .Include(e => e.EventType)
                .Include(e => e.OrganizedBy)
                .Include(e => e.OrganizedByClub)
                .Include(e => e.Court)
                .Include(e => e.Divisions.Where(d => d.IsActive))
                    .ThenInclude(d => d.Registrations)
                .Include(e => e.Divisions.Where(d => d.IsActive))
                    .ThenInclude(d => d.PartnerRequests.Where(p => p.Status == "Open"))
                .Include(e => e.Divisions.Where(d => d.IsActive))
                    .ThenInclude(d => d.TeamUnit)
                .Include(e => e.Divisions.Where(d => d.IsActive))
                    .ThenInclude(d => d.AgeGroupEntity)
                .Include(e => e.Divisions.Where(d => d.IsActive))
                    .ThenInclude(d => d.Rewards)
                .Include(e => e.Registrations)
                .FirstOrDefaultAsync(e => e.Id == id && e.IsActive);

            if (evt == null)
                return NotFound(new ApiResponse<EventDetailDto> { Success = false, Message = "Event not found" });

            var userId = GetCurrentUserId();

            var dto = new EventDetailDto
            {
                Id = evt.Id,
                Name = evt.Name,
                Description = evt.Description,
                EventTypeId = evt.EventTypeId,
                EventTypeName = evt.EventType?.Name,
                EventTypeIcon = evt.EventType?.Icon,
                EventTypeColor = evt.EventType?.Color,
                AllowMultipleDivisions = evt.EventType?.AllowMultipleDivisions ?? true,
                StartDate = evt.StartDate,
                EndDate = evt.EndDate,
                RegistrationOpenDate = evt.RegistrationOpenDate,
                RegistrationCloseDate = evt.RegistrationCloseDate,
                IsPublished = evt.IsPublished,
                IsPrivate = evt.IsPrivate,
                VenueName = evt.VenueName,
                Address = evt.Address,
                City = evt.City,
                State = evt.State,
                Country = evt.Country,
                Latitude = evt.Latitude,
                Longitude = evt.Longitude,
                CourtId = evt.CourtId,
                CourtName = evt.Court?.Name,
                PosterImageUrl = evt.PosterImageUrl,
                BannerImageUrl = evt.BannerImageUrl,
                RegistrationFee = evt.RegistrationFee,
                PerDivisionFee = evt.PerDivisionFee,
                ContactEmail = evt.ContactEmail,
                ContactPhone = evt.ContactPhone,
                MaxParticipants = evt.MaxParticipants,
                RegisteredCount = evt.Registrations.Count,
                DivisionCount = evt.Divisions.Count(d => d.IsActive),
                OrganizedByUserId = evt.OrganizedByUserId,
                OrganizerName = evt.OrganizedBy != null ? $"{evt.OrganizedBy.FirstName} {evt.OrganizedBy.LastName}".Trim() : null,
                OrganizedByClubId = evt.OrganizedByClubId,
                ClubName = evt.OrganizedByClub?.Name,
                CreatedAt = evt.CreatedAt,
                IsOrganizer = userId.HasValue && evt.OrganizedByUserId == userId.Value,
                IsRegistered = userId.HasValue && evt.Registrations.Any(r => r.UserId == userId.Value),
                RegisteredDivisionIds = userId.HasValue
                    ? evt.Registrations.Where(r => r.UserId == userId.Value).Select(r => r.DivisionId).ToList()
                    : new List<int>(),
                Divisions = evt.Divisions
                    .Where(d => d.IsActive)
                    .OrderBy(d => d.SortOrder)
                    .Select(d => new EventDivisionDto
                    {
                        Id = d.Id,
                        EventId = d.EventId,
                        Name = d.Name,
                        Description = d.Description,
                        // New fields
                        TeamUnitId = d.TeamUnitId,
                        TeamUnitName = d.TeamUnit?.Name,
                        AgeGroupId = d.AgeGroupId,
                        AgeGroupName = d.AgeGroupEntity?.Name,
                        MinSkillRating = d.MinSkillRating,
                        MaxSkillRating = d.MaxSkillRating,
                        MaxUnits = d.MaxUnits,
                        // Legacy fields
                        TeamSize = d.TeamSize,
                        SkillLevelMin = d.SkillLevelMin,
                        SkillLevelMax = d.SkillLevelMax,
                        Gender = d.Gender,
                        AgeGroup = d.AgeGroup,
                        MaxTeams = d.MaxTeams,
                        DivisionFee = d.DivisionFee,
                        SortOrder = d.SortOrder,
                        RegisteredCount = d.Registrations.Count,
                        LookingForPartnerCount = d.PartnerRequests.Count(p => p.IsLookingForPartner && p.Status == "Open"),
                        Rewards = d.Rewards.Where(r => r.IsActive).OrderBy(r => r.Placement).Select(r => new DivisionRewardDto
                        {
                            Id = r.Id,
                            DivisionId = r.DivisionId,
                            Placement = r.Placement,
                            RewardType = r.RewardType,
                            CashAmount = r.CashAmount,
                            Description = r.Description,
                            Icon = r.Icon,
                            Color = r.Color,
                            IsActive = r.IsActive
                        }).ToList()
                    }).ToList()
            };

            return Ok(new ApiResponse<EventDetailDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching event {EventId}", id);
            return StatusCode(500, new ApiResponse<EventDetailDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /events - Create a new event
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ApiResponse<EventDetailDto>>> CreateEvent([FromBody] CreateEventDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<EventDetailDto> { Success = false, Message = "User not authenticated" });

            var evt = new Event
            {
                Name = dto.Name,
                Description = dto.Description,
                EventTypeId = dto.EventTypeId,
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                RegistrationOpenDate = dto.RegistrationOpenDate,
                RegistrationCloseDate = dto.RegistrationCloseDate,
                IsPrivate = dto.IsPrivate,
                CourtId = dto.CourtId,
                VenueName = dto.VenueName,
                Address = dto.Address,
                City = dto.City,
                State = dto.State,
                Country = dto.Country,
                Latitude = dto.Latitude,
                Longitude = dto.Longitude,
                PosterImageUrl = dto.PosterImageUrl,
                BannerImageUrl = dto.BannerImageUrl,
                RegistrationFee = dto.RegistrationFee,
                PerDivisionFee = dto.PerDivisionFee,
                ContactEmail = dto.ContactEmail,
                ContactPhone = dto.ContactPhone,
                OrganizedByUserId = userId.Value,
                OrganizedByClubId = dto.OrganizedByClubId,
                MaxParticipants = dto.MaxParticipants
            };

            _context.Events.Add(evt);
            await _context.SaveChangesAsync();

            // Add divisions
            var sortOrder = 0;
            foreach (var divDto in dto.Divisions)
            {
                var division = new EventDivision
                {
                    EventId = evt.Id,
                    Name = divDto.Name,
                    Description = divDto.Description,
                    // New fields
                    TeamUnitId = divDto.TeamUnitId,
                    AgeGroupId = divDto.AgeGroupId,
                    MinSkillRating = divDto.MinSkillRating,
                    MaxSkillRating = divDto.MaxSkillRating,
                    MaxUnits = divDto.MaxUnits,
                    // Legacy fields
                    TeamSize = divDto.TeamSize,
                    SkillLevelMin = divDto.SkillLevelMin,
                    SkillLevelMax = divDto.SkillLevelMax,
                    Gender = divDto.Gender,
                    AgeGroup = divDto.AgeGroup,
                    MaxTeams = divDto.MaxTeams,
                    DivisionFee = divDto.DivisionFee,
                    SortOrder = divDto.SortOrder > 0 ? divDto.SortOrder : sortOrder++
                };
                _context.EventDivisions.Add(division);
                await _context.SaveChangesAsync();

                // Add rewards for this division
                foreach (var rewardDto in divDto.Rewards)
                {
                    var reward = new DivisionReward
                    {
                        DivisionId = division.Id,
                        Placement = rewardDto.Placement,
                        RewardType = rewardDto.RewardType,
                        CashAmount = rewardDto.CashAmount,
                        Description = rewardDto.Description,
                        Icon = rewardDto.Icon,
                        Color = rewardDto.Color
                    };
                    _context.DivisionRewards.Add(reward);
                }
            }
            await _context.SaveChangesAsync();

            return await GetEvent(evt.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating event");
            return StatusCode(500, new ApiResponse<EventDetailDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /events/{id} - Update event
    [HttpPut("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<EventDetailDto>>> UpdateEvent(int id, [FromBody] UpdateEventDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<EventDetailDto> { Success = false, Message = "User not authenticated" });

            var evt = await _context.Events
                .Include(e => e.Divisions)
                .FirstOrDefaultAsync(e => e.Id == id && e.IsActive);

            if (evt == null)
                return NotFound(new ApiResponse<EventDetailDto> { Success = false, Message = "Event not found" });

            // Check if user is organizer
            if (evt.OrganizedByUserId != userId.Value)
                return Forbid();

            evt.Name = dto.Name;
            evt.Description = dto.Description;
            evt.EventTypeId = dto.EventTypeId;
            evt.StartDate = dto.StartDate;
            evt.EndDate = dto.EndDate;
            evt.RegistrationOpenDate = dto.RegistrationOpenDate;
            evt.RegistrationCloseDate = dto.RegistrationCloseDate;
            evt.IsPublished = dto.IsPublished;
            evt.IsPrivate = dto.IsPrivate;
            evt.CourtId = dto.CourtId;
            evt.VenueName = dto.VenueName;
            evt.Address = dto.Address;
            evt.City = dto.City;
            evt.State = dto.State;
            evt.Country = dto.Country;
            evt.Latitude = dto.Latitude;
            evt.Longitude = dto.Longitude;
            evt.PosterImageUrl = dto.PosterImageUrl;
            evt.BannerImageUrl = dto.BannerImageUrl;
            evt.RegistrationFee = dto.RegistrationFee;
            evt.PerDivisionFee = dto.PerDivisionFee;
            evt.ContactEmail = dto.ContactEmail;
            evt.ContactPhone = dto.ContactPhone;
            evt.MaxParticipants = dto.MaxParticipants;
            evt.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return await GetEvent(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating event {EventId}", id);
            return StatusCode(500, new ApiResponse<EventDetailDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /events/{id}/publish - Publish event
    [HttpPost("{id}/publish")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> PublishEvent(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var evt = await _context.Events.FindAsync(id);
            if (evt == null || !evt.IsActive)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

            if (evt.OrganizedByUserId != userId.Value)
                return Forbid();

            evt.IsPublished = true;
            evt.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Event published" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error publishing event");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /events/{id} - Delete event (soft delete)
    [HttpDelete("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteEvent(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var evt = await _context.Events.FindAsync(id);
            if (evt == null || !evt.IsActive)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

            if (evt.OrganizedByUserId != userId.Value)
                return Forbid();

            evt.IsActive = false;
            evt.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Event deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting event");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /events/{id}/register - Register for an event division
    [HttpPost("{id}/register")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<EventRegistrationDto>>> RegisterForEvent(int id, [FromBody] RegisterForEventDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<EventRegistrationDto> { Success = false, Message = "User not authenticated" });

            var evt = await _context.Events.FindAsync(id);
            if (evt == null || !evt.IsActive || !evt.IsPublished)
                return NotFound(new ApiResponse<EventRegistrationDto> { Success = false, Message = "Event not found" });

            // Check registration period
            var now = DateTime.UtcNow;
            if (evt.RegistrationOpenDate.HasValue && now < evt.RegistrationOpenDate.Value)
                return BadRequest(new ApiResponse<EventRegistrationDto> { Success = false, Message = "Registration has not opened yet" });

            if (evt.RegistrationCloseDate.HasValue && now > evt.RegistrationCloseDate.Value)
                return BadRequest(new ApiResponse<EventRegistrationDto> { Success = false, Message = "Registration has closed" });

            var division = await _context.EventDivisions.FindAsync(dto.DivisionId);
            if (division == null || division.EventId != id || !division.IsActive)
                return NotFound(new ApiResponse<EventRegistrationDto> { Success = false, Message = "Division not found" });

            // Check if already registered
            var existingReg = await _context.EventRegistrations
                .FirstOrDefaultAsync(r => r.EventId == id && r.DivisionId == dto.DivisionId && r.UserId == userId.Value);

            if (existingReg != null && existingReg.Status != "Cancelled")
                return BadRequest(new ApiResponse<EventRegistrationDto> { Success = false, Message = "Already registered for this division" });

            // Calculate fee
            var fee = evt.RegistrationFee + (division.DivisionFee ?? evt.PerDivisionFee);

            var registration = new EventRegistration
            {
                EventId = id,
                DivisionId = dto.DivisionId,
                UserId = userId.Value,
                TeamName = dto.TeamName,
                AmountPaid = 0,
                PaymentStatus = fee > 0 ? "Pending" : "Paid",
                Status = "Registered"
            };

            _context.EventRegistrations.Add(registration);
            await _context.SaveChangesAsync();

            var user = await _context.Users.FindAsync(userId.Value);

            return Ok(new ApiResponse<EventRegistrationDto>
            {
                Success = true,
                Data = new EventRegistrationDto
                {
                    Id = registration.Id,
                    EventId = registration.EventId,
                    DivisionId = registration.DivisionId,
                    UserId = registration.UserId,
                    UserName = user != null ? $"{user.FirstName} {user.LastName}".Trim() : "",
                    TeamName = registration.TeamName,
                    PaymentStatus = registration.PaymentStatus,
                    AmountPaid = registration.AmountPaid,
                    Status = registration.Status,
                    RegisteredAt = registration.RegisteredAt
                },
                Message = "Registration successful"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error registering for event");
            return StatusCode(500, new ApiResponse<EventRegistrationDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /events/{id}/register/{divisionId} - Cancel registration
    [HttpDelete("{id}/register/{divisionId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> CancelRegistration(int id, int divisionId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var registration = await _context.EventRegistrations
                .FirstOrDefaultAsync(r => r.EventId == id && r.DivisionId == divisionId && r.UserId == userId.Value);

            if (registration == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Registration not found" });

            registration.Status = "Cancelled";
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Registration cancelled" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling registration");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /events/{id}/divisions/{divisionId}/registrations - Get division registrations
    [HttpGet("{id}/divisions/{divisionId}/registrations")]
    public async Task<ActionResult<ApiResponse<List<EventRegistrationDto>>>> GetDivisionRegistrations(int id, int divisionId)
    {
        try
        {
            var registrations = await _context.EventRegistrations
                .Include(r => r.User)
                .Where(r => r.EventId == id && r.DivisionId == divisionId && r.Status != "Cancelled")
                .OrderBy(r => r.RegisteredAt)
                .Select(r => new EventRegistrationDto
                {
                    Id = r.Id,
                    EventId = r.EventId,
                    DivisionId = r.DivisionId,
                    UserId = r.UserId,
                    UserName = r.User != null ? (r.User.FirstName + " " + r.User.LastName).Trim() : "",
                    UserProfileImageUrl = r.User != null ? r.User.ProfileImageUrl : null,
                    UserExperienceLevel = r.User != null ? r.User.ExperienceLevel : null,
                    TeamId = r.TeamId,
                    TeamName = r.TeamName,
                    PaymentStatus = r.PaymentStatus,
                    AmountPaid = r.AmountPaid,
                    Status = r.Status,
                    RegisteredAt = r.RegisteredAt,
                    CheckedInAt = r.CheckedInAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<EventRegistrationDto>> { Success = true, Data = registrations });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching registrations");
            return StatusCode(500, new ApiResponse<List<EventRegistrationDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /events/{id}/partner-request - Create looking for partner request
    [HttpPost("{id}/partner-request")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PartnerRequestDto>>> CreatePartnerRequest(int id, [FromBody] CreatePartnerRequestDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<PartnerRequestDto> { Success = false, Message = "User not authenticated" });

            var division = await _context.EventDivisions.FindAsync(dto.DivisionId);
            if (division == null || division.EventId != id || !division.IsActive)
                return NotFound(new ApiResponse<PartnerRequestDto> { Success = false, Message = "Division not found" });

            // Check if already has open request
            var existingRequest = await _context.EventPartnerRequests
                .FirstOrDefaultAsync(r => r.DivisionId == dto.DivisionId && r.UserId == userId.Value && r.Status == "Open");

            if (existingRequest != null)
                return BadRequest(new ApiResponse<PartnerRequestDto> { Success = false, Message = "Already have an open partner request" });

            var request = new EventPartnerRequest
            {
                EventId = id,
                DivisionId = dto.DivisionId,
                UserId = userId.Value,
                Message = dto.Message,
                IsLookingForPartner = true,
                Status = "Open"
            };

            _context.EventPartnerRequests.Add(request);
            await _context.SaveChangesAsync();

            var user = await _context.Users.FindAsync(userId.Value);

            return Ok(new ApiResponse<PartnerRequestDto>
            {
                Success = true,
                Data = new PartnerRequestDto
                {
                    Id = request.Id,
                    EventId = request.EventId,
                    DivisionId = request.DivisionId,
                    UserId = request.UserId,
                    UserName = user != null ? $"{user.FirstName} {user.LastName}".Trim() : "",
                    UserProfileImageUrl = user?.ProfileImageUrl,
                    UserExperienceLevel = user?.ExperienceLevel,
                    Message = request.Message,
                    IsLookingForPartner = request.IsLookingForPartner,
                    Status = request.Status,
                    CreatedAt = request.CreatedAt
                },
                Message = "Partner request created"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating partner request");
            return StatusCode(500, new ApiResponse<PartnerRequestDto> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /events/{id}/divisions/{divisionId}/partner-requests - Get partner requests
    [HttpGet("{id}/divisions/{divisionId}/partner-requests")]
    public async Task<ActionResult<ApiResponse<List<PartnerRequestDto>>>> GetPartnerRequests(int id, int divisionId)
    {
        try
        {
            var requests = await _context.EventPartnerRequests
                .Include(r => r.User)
                .Include(r => r.RequestedBy)
                .Where(r => r.DivisionId == divisionId && r.IsLookingForPartner && r.Status == "Open")
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new PartnerRequestDto
                {
                    Id = r.Id,
                    EventId = r.EventId,
                    DivisionId = r.DivisionId,
                    UserId = r.UserId,
                    UserName = r.User != null ? (r.User.FirstName + " " + r.User.LastName).Trim() : "",
                    UserProfileImageUrl = r.User != null ? r.User.ProfileImageUrl : null,
                    UserExperienceLevel = r.User != null ? r.User.ExperienceLevel : null,
                    UserLocation = r.User != null ? GetUserLocationStatic(r.User.City, r.User.State) : null,
                    Message = r.Message,
                    IsLookingForPartner = r.IsLookingForPartner,
                    Status = r.Status,
                    CreatedAt = r.CreatedAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<PartnerRequestDto>> { Success = true, Data = requests });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching partner requests");
            return StatusCode(500, new ApiResponse<List<PartnerRequestDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /events/partner-request/{requestId} - Cancel partner request
    [HttpDelete("partner-request/{requestId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> CancelPartnerRequest(int requestId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var request = await _context.EventPartnerRequests.FindAsync(requestId);
            if (request == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Request not found" });

            if (request.UserId != userId.Value)
                return Forbid();

            request.Status = "Closed";
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Partner request cancelled" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling partner request");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /events/my - Get my events
    [HttpGet("my")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<MyEventsDto>>> GetMyEvents()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<MyEventsDto> { Success = false, Message = "User not authenticated" });

            // Events I organize
            var eventsIOrganize = await _context.Events
                .Include(e => e.EventType)
                .Include(e => e.Divisions)
                .Include(e => e.Registrations)
                .Where(e => e.OrganizedByUserId == userId.Value && e.IsActive)
                .OrderByDescending(e => e.StartDate)
                .ToListAsync();

            // Events I'm registered for
            var myRegistrations = await _context.EventRegistrations
                .Include(r => r.Event)
                    .ThenInclude(e => e!.EventType)
                .Include(r => r.Division)
                .Where(r => r.UserId == userId.Value && r.Status != "Cancelled" && r.Event != null && r.Event.IsActive)
                .ToListAsync();

            var registrationSummaries = myRegistrations
                .GroupBy(r => r.EventId)
                .Select(g => new EventRegistrationSummaryDto
                {
                    EventId = g.Key,
                    EventName = g.First().Event!.Name,
                    StartDate = g.First().Event!.StartDate,
                    VenueName = g.First().Event!.VenueName,
                    City = g.First().Event!.City,
                    State = g.First().Event!.State,
                    PosterImageUrl = g.First().Event!.PosterImageUrl,
                    RegisteredDivisions = g.Select(r => r.Division?.Name ?? "").ToList(),
                    PaymentStatus = g.All(r => r.PaymentStatus == "Paid") ? "Paid" : "Pending",
                    Status = g.First().Status
                })
                .OrderBy(s => s.StartDate)
                .ToList();

            return Ok(new ApiResponse<MyEventsDto>
            {
                Success = true,
                Data = new MyEventsDto
                {
                    EventsIOrganize = eventsIOrganize.Select(e => MapToEventDto(e, null)).ToList(),
                    EventsImRegisteredFor = registrationSummaries
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching my events");
            return StatusCode(500, new ApiResponse<MyEventsDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /events/{id}/divisions - Add division to event
    [HttpPost("{id}/divisions")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<EventDivisionDto>>> AddDivision(int id, [FromBody] CreateEventDivisionDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<EventDivisionDto> { Success = false, Message = "User not authenticated" });

            var evt = await _context.Events.FindAsync(id);
            if (evt == null || !evt.IsActive)
                return NotFound(new ApiResponse<EventDivisionDto> { Success = false, Message = "Event not found" });

            if (evt.OrganizedByUserId != userId.Value)
                return Forbid();

            var maxSortOrder = await _context.EventDivisions
                .Where(d => d.EventId == id)
                .MaxAsync(d => (int?)d.SortOrder) ?? -1;

            var division = new EventDivision
            {
                EventId = id,
                Name = dto.Name,
                Description = dto.Description,
                // New fields
                TeamUnitId = dto.TeamUnitId,
                AgeGroupId = dto.AgeGroupId,
                MinSkillRating = dto.MinSkillRating,
                MaxSkillRating = dto.MaxSkillRating,
                MaxUnits = dto.MaxUnits,
                // Legacy fields
                TeamSize = dto.TeamSize,
                SkillLevelMin = dto.SkillLevelMin,
                SkillLevelMax = dto.SkillLevelMax,
                Gender = dto.Gender,
                AgeGroup = dto.AgeGroup,
                MaxTeams = dto.MaxTeams,
                DivisionFee = dto.DivisionFee,
                SortOrder = dto.SortOrder > 0 ? dto.SortOrder : maxSortOrder + 1
            };

            _context.EventDivisions.Add(division);
            await _context.SaveChangesAsync();

            // Add rewards for this division
            foreach (var rewardDto in dto.Rewards)
            {
                var reward = new DivisionReward
                {
                    DivisionId = division.Id,
                    Placement = rewardDto.Placement,
                    RewardType = rewardDto.RewardType,
                    CashAmount = rewardDto.CashAmount,
                    Description = rewardDto.Description,
                    Icon = rewardDto.Icon,
                    Color = rewardDto.Color
                };
                _context.DivisionRewards.Add(reward);
            }
            await _context.SaveChangesAsync();

            // Load team unit and age group for response
            var teamUnit = dto.TeamUnitId.HasValue ? await _context.TeamUnits.FindAsync(dto.TeamUnitId.Value) : null;
            var ageGroup = dto.AgeGroupId.HasValue ? await _context.AgeGroups.FindAsync(dto.AgeGroupId.Value) : null;

            return Ok(new ApiResponse<EventDivisionDto>
            {
                Success = true,
                Data = new EventDivisionDto
                {
                    Id = division.Id,
                    EventId = division.EventId,
                    Name = division.Name,
                    Description = division.Description,
                    // New fields
                    TeamUnitId = division.TeamUnitId,
                    TeamUnitName = teamUnit?.Name,
                    AgeGroupId = division.AgeGroupId,
                    AgeGroupName = ageGroup?.Name,
                    MinSkillRating = division.MinSkillRating,
                    MaxSkillRating = division.MaxSkillRating,
                    MaxUnits = division.MaxUnits,
                    // Legacy fields
                    TeamSize = division.TeamSize,
                    SkillLevelMin = division.SkillLevelMin,
                    SkillLevelMax = division.SkillLevelMax,
                    Gender = division.Gender,
                    AgeGroup = division.AgeGroup,
                    MaxTeams = division.MaxTeams,
                    DivisionFee = division.DivisionFee,
                    SortOrder = division.SortOrder,
                    RegisteredCount = 0,
                    LookingForPartnerCount = 0,
                    Rewards = dto.Rewards.Select((r, i) => new DivisionRewardDto
                    {
                        Id = i + 1, // Placeholder - actual IDs are in the database
                        DivisionId = division.Id,
                        Placement = r.Placement,
                        RewardType = r.RewardType,
                        CashAmount = r.CashAmount,
                        Description = r.Description,
                        Icon = r.Icon,
                        Color = r.Color,
                        IsActive = true
                    }).ToList()
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding division");
            return StatusCode(500, new ApiResponse<EventDivisionDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /events/{id}/divisions/{divisionId} - Remove division
    [HttpDelete("{id}/divisions/{divisionId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> RemoveDivision(int id, int divisionId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var evt = await _context.Events.FindAsync(id);
            if (evt == null || !evt.IsActive)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

            if (evt.OrganizedByUserId != userId.Value)
                return Forbid();

            var division = await _context.EventDivisions
                .Include(d => d.Registrations)
                .FirstOrDefaultAsync(d => d.Id == divisionId && d.EventId == id);

            if (division == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Division not found" });

            if (division.Registrations.Any(r => r.Status != "Cancelled"))
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot delete division with active registrations" });

            division.IsActive = false;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Division deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting division");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // Helper methods
    private EventDto MapToEventDto(Event evt, double? distance)
    {
        return new EventDto
        {
            Id = evt.Id,
            Name = evt.Name,
            Description = evt.Description,
            EventTypeId = evt.EventTypeId,
            EventTypeName = evt.EventType?.Name,
            EventTypeIcon = evt.EventType?.Icon,
            EventTypeColor = evt.EventType?.Color,
            AllowMultipleDivisions = evt.EventType?.AllowMultipleDivisions ?? true,
            StartDate = evt.StartDate,
            EndDate = evt.EndDate,
            RegistrationOpenDate = evt.RegistrationOpenDate,
            RegistrationCloseDate = evt.RegistrationCloseDate,
            IsPublished = evt.IsPublished,
            IsPrivate = evt.IsPrivate,
            VenueName = evt.VenueName,
            City = evt.City,
            State = evt.State,
            Country = evt.Country,
            PosterImageUrl = evt.PosterImageUrl,
            RegistrationFee = evt.RegistrationFee,
            PerDivisionFee = evt.PerDivisionFee,
            MaxParticipants = evt.MaxParticipants,
            RegisteredCount = evt.Registrations?.Count ?? 0,
            DivisionCount = evt.Divisions?.Count(d => d.IsActive) ?? 0,
            Distance = distance,
            OrganizedByUserId = evt.OrganizedByUserId,
            OrganizerName = evt.OrganizedBy != null ? $"{evt.OrganizedBy.FirstName} {evt.OrganizedBy.LastName}".Trim() : null,
            OrganizedByClubId = evt.OrganizedByClubId,
            ClubName = evt.OrganizedByClub?.Name,
            CreatedAt = evt.CreatedAt
        };
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
