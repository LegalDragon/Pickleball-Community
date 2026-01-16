using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Services;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class EventsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<EventsController> _logger;
    private readonly INotificationService _notificationService;
    private readonly IActivityAwardService _activityAwardService;

    public EventsController(
        ApplicationDbContext context,
        ILogger<EventsController> logger,
        INotificationService notificationService,
        IActivityAwardService activityAwardService)
    {
        _context = context;
        _logger = logger;
        _notificationService = notificationService;
        _activityAwardService = activityAwardService;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private async Task<bool> IsAdminAsync()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return false;

        var user = await _context.Users.FindAsync(userId.Value);
        return user?.Role == "Admin";
    }

    // Check if user has completed their profile (not a "New User")
    private async Task<bool> HasCompletedProfileAsync()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return false;

        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null) return false;

        var fullName = Utility.FormatName(user.LastName, user.FirstName);
        return !fullName.Equals("New User", StringComparison.OrdinalIgnoreCase);
    }

    // GET: /events/search - Search for events
    [HttpGet("search")]
    public async Task<ActionResult<ApiResponse<PagedResult<EventDto>>>> SearchEvents([FromQuery] EventSearchRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();

            var query = _context.Events
                .AsSplitQuery() // Use split queries to avoid cartesian explosion with multiple collections
                .Include(e => e.EventType)
                .Include(e => e.OrganizedBy)
                .Include(e => e.OrganizedByClub)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.Units)
                        .ThenInclude(u => u.Members)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.Units)
                        .ThenInclude(u => u.JoinRequests)
                .Include(e => e.Venue) // Include venue for GPS-based distance calculation
                .Where(e => e.IsActive && e.IsPublished && e.TournamentStatus != "Draft")
                // Filter out private events unless user is organizer, registered, or club member
                .Where(e => !e.IsPrivate ||
                    (userId.HasValue && (
                        e.OrganizedByUserId == userId.Value ||
                        e.Divisions.Any(d => d.Units.Any(u => u.Status != "Cancelled" && !u.IsTemporary && u.Members.Any(m => m.UserId == userId.Value))) ||
                        (e.OrganizedByClubId.HasValue && _context.ClubMembers.Any(cm =>
                            cm.ClubId == e.OrganizedByClubId.Value &&
                            cm.UserId == userId.Value &&
                            cm.IsActive)))))
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
                query = query.Where(e => e.StartDate >= DateTime.Now);
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
                        // Try venue GPS first, then fall back to event's own coordinates
                        double? eventLat = null;
                        double? eventLng = null;

                        if (e.Venue != null && !string.IsNullOrEmpty(e.Venue.GpsLat) && !string.IsNullOrEmpty(e.Venue.GpsLng))
                        {
                            if (double.TryParse(e.Venue.GpsLat, out var venueLat) && double.TryParse(e.Venue.GpsLng, out var venueLng))
                            {
                                eventLat = venueLat;
                                eventLng = venueLng;
                            }
                        }

                        // Fall back to event's own coordinates if venue doesn't have GPS
                        if (!eventLat.HasValue || !eventLng.HasValue)
                        {
                            eventLat = e.Latitude;
                            eventLng = e.Longitude;
                        }

                        if (eventLat.HasValue && eventLng.HasValue)
                            distance = CalculateDistance(request.Latitude.Value, request.Longitude.Value, eventLat.Value, eventLng.Value);
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

    // GET: /events/countries - Get countries with event counts
    [HttpGet("countries")]
    public async Task<ActionResult<ApiResponse<List<LocationCountDto>>>> GetCountries()
    {
        try
        {
            var countries = await _context.Events
                .Where(e => e.IsActive && e.IsPublished && e.TournamentStatus != "Draft" && !string.IsNullOrEmpty(e.Country))
                .GroupBy(e => e.Country!)
                .Select(g => new LocationCountDto { Name = g.Key, Count = g.Count() })
                .OrderByDescending(x => x.Count)
                .ThenBy(x => x.Name)
                .ToListAsync();

            return Ok(new ApiResponse<List<LocationCountDto>> { Success = true, Data = countries });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching countries");
            return StatusCode(500, new ApiResponse<List<LocationCountDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /events/countries/{country}/states - Get states for a country with event counts
    [HttpGet("countries/{country}/states")]
    public async Task<ActionResult<ApiResponse<List<LocationCountDto>>>> GetStatesByCountry(string country)
    {
        try
        {
            var states = await _context.Events
                .Where(e => e.IsActive && e.IsPublished && e.TournamentStatus != "Draft" && e.Country == country && !string.IsNullOrEmpty(e.State))
                .GroupBy(e => e.State!)
                .Select(g => new LocationCountDto { Name = g.Key, Count = g.Count() })
                .OrderByDescending(x => x.Count)
                .ThenBy(x => x.Name)
                .ToListAsync();

            return Ok(new ApiResponse<List<LocationCountDto>> { Success = true, Data = states });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching states for country {Country}", country);
            return StatusCode(500, new ApiResponse<List<LocationCountDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /events/countries/{country}/states/{state}/cities - Get cities for a state with event counts
    [HttpGet("countries/{country}/states/{state}/cities")]
    public async Task<ActionResult<ApiResponse<List<LocationCountDto>>>> GetCitiesByState(string country, string state)
    {
        try
        {
            var cities = await _context.Events
                .Where(e => e.IsActive && e.IsPublished && e.TournamentStatus != "Draft" && e.Country == country && e.State == state && !string.IsNullOrEmpty(e.City))
                .GroupBy(e => e.City!)
                .Select(g => new LocationCountDto { Name = g.Key, Count = g.Count() })
                .OrderByDescending(x => x.Count)
                .ThenBy(x => x.Name)
                .ToListAsync();

            return Ok(new ApiResponse<List<LocationCountDto>> { Success = true, Data = cities });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching cities for {Country}/{State}", country, state);
            return StatusCode(500, new ApiResponse<List<LocationCountDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /events/featured - Get featured events for home page
    [HttpGet("featured")]
    public async Task<ActionResult<ApiResponse<FeaturedEventsDto>>> GetFeaturedEvents([FromQuery] int limit = 6, [FromQuery] int pastDays = 7)
    {
        try
        {
            var now = DateTime.Now;
            var pastCutoff = now.AddDays(-pastDays);

            // Upcoming events
            var upcomingEvents = await _context.Events
                .AsSplitQuery()
                .Include(e => e.EventType)
                .Include(e => e.OrganizedBy)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.Units)
                        .ThenInclude(u => u.Members)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.Units)
                        .ThenInclude(u => u.JoinRequests)
                .Where(e => e.IsActive && e.IsPublished && e.TournamentStatus != "Draft" && e.StartDate >= now)
                .OrderBy(e => e.StartDate)
                .Take(limit)
                .ToListAsync();

            // Popular events (most registrations via Units)
            var popularEvents = await _context.Events
                .AsSplitQuery()
                .Include(e => e.EventType)
                .Include(e => e.OrganizedBy)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.Units)
                        .ThenInclude(u => u.Members)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.Units)
                        .ThenInclude(u => u.JoinRequests)
                .Where(e => e.IsActive && e.IsPublished && e.TournamentStatus != "Draft" && e.StartDate >= now)
                .OrderByDescending(e => e.Divisions.SelectMany(d => d.Units).Count(u => u.Status != "Cancelled"))
                .Take(limit)
                .ToListAsync();

            // Recent past events (events that ended within the past X days)
            var recentPastEvents = await _context.Events
                .AsSplitQuery()
                .Include(e => e.EventType)
                .Include(e => e.OrganizedBy)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.Units)
                        .ThenInclude(u => u.Members)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.Units)
                        .ThenInclude(u => u.JoinRequests)
                .Where(e => e.IsActive && e.IsPublished && e.TournamentStatus != "Draft" && e.StartDate < now && e.StartDate >= pastCutoff)
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

    // GET: /events/{id}/public - Get public event view (no auth required)
    [HttpGet("{id}/public")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<EventPublicViewDto>>> GetEventPublic(int id)
    {
        try
        {
            var evt = await _context.Events
                .AsSplitQuery()
                .Include(e => e.EventType)
                .Include(e => e.OrganizedBy)
                .Include(e => e.OrganizedByClub)
                .Include(e => e.Venue)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.Units.Where(u => u.Status != "Cancelled" && !u.IsTemporary))
                        .ThenInclude(u => u.Members)
                            .ThenInclude(m => m.User)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.TeamUnit)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.AgeGroupEntity)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.SkillLevel)
                .FirstOrDefaultAsync(e => e.Id == id && e.IsActive && e.IsPublished && !e.IsPrivate);

            if (evt == null)
                return NotFound(new ApiResponse<EventPublicViewDto> { Success = false, Message = "Event not found or not public" });

            // Get total counts across all divisions
            var totalRegisteredCount = evt.Divisions.Sum(d =>
                d.Units.Count(u => u.Status != "Cancelled" && !u.IsTemporary));
            var totalRegisteredPlayerCount = evt.Divisions.Sum(d =>
                d.Units.Where(u => u.Status != "Cancelled" && !u.IsTemporary).Sum(u => u.Members.Count));

            // Determine primary team size
            var primaryTeamSize = evt.Divisions.Any()
                ? evt.Divisions
                    .GroupBy(d => d.TeamUnit?.TotalPlayers ?? 1)
                    .OrderByDescending(g => g.Count())
                    .First().Key
                : 2;

            // Get registered players with public info only
            var registeredPlayers = evt.Divisions
                .SelectMany(d => d.Units
                    .Where(u => u.Status != "Cancelled" && !u.IsTemporary)
                    .SelectMany(u => u.Members.Select(m => new RegisteredPlayerPublicDto
                    {
                        UserId = m.UserId,
                        Name = m.User != null ? Utility.FormatName(m.User.LastName, m.User.FirstName) : "",
                        ProfileImageUrl = m.User?.ProfileImageUrl,
                        City = m.User?.City,
                        State = m.User?.State,
                        DivisionName = d.Name,
                        TeamName = u.Name
                    })))
                .DistinctBy(p => p.UserId)
                .ToList();

            var dto = new EventPublicViewDto
            {
                Id = evt.Id,
                Name = evt.Name,
                Description = evt.Description,
                EventTypeId = evt.EventTypeId,
                EventTypeName = evt.EventType?.Name,
                EventTypeIcon = evt.EventType?.Icon,
                EventTypeColor = evt.EventType?.Color,
                StartDate = evt.StartDate,
                EndDate = evt.EndDate,
                RegistrationOpenDate = evt.RegistrationOpenDate,
                RegistrationCloseDate = evt.RegistrationCloseDate,
                IsPublished = evt.IsPublished,
                VenueName = evt.VenueName,
                Address = evt.Address,
                City = evt.City,
                State = evt.State,
                Country = evt.Country,
                Latitude = evt.Latitude,
                Longitude = evt.Longitude,
                CourtId = evt.CourtId,
                PosterImageUrl = evt.PosterImageUrl,
                BannerImageUrl = evt.BannerImageUrl,
                RegistrationFee = evt.RegistrationFee,
                PerDivisionFee = evt.PerDivisionFee,
                PriceUnit = evt.PriceUnit,
                PaymentModel = evt.PaymentModel,
                MaxParticipants = evt.MaxParticipants,
                RegisteredCount = totalRegisteredCount,
                RegisteredPlayerCount = totalRegisteredPlayerCount,
                DivisionCount = evt.Divisions.Count,
                PrimaryTeamSize = primaryTeamSize,
                OrganizerName = evt.OrganizedBy != null ? Utility.FormatName(evt.OrganizedBy.LastName, evt.OrganizedBy.FirstName) : null,
                OrganizedByUserId = evt.OrganizedByUserId,
                OrganizedByClubId = evt.OrganizedByClubId,
                ClubName = evt.OrganizedByClub?.Name,
                ContactName = evt.ContactName,
                ContactEmail = evt.ContactEmail,
                ContactPhone = evt.ContactPhone,
                CreatedAt = evt.CreatedAt,
                TournamentStatus = evt.TournamentStatus,
                Divisions = evt.Divisions.OrderBy(d => d.SortOrder).Select(d => new EventDivisionPublicDto
                {
                    Id = d.Id,
                    Name = d.Name,
                    Description = d.Description,
                    TeamUnitName = d.TeamUnit?.Name,
                    AgeGroupName = d.AgeGroupEntity?.Name,
                    SkillLevelName = d.SkillLevel?.Name,
                    MaxUnits = d.MaxUnits,
                    MaxPlayers = d.MaxPlayers,
                    DivisionFee = d.DivisionFee,
                    RegisteredCount = d.Units.Count(u => u.Status != "Cancelled" && !u.IsTemporary),
                    RegisteredPlayerCount = d.Units.Where(u => u.Status != "Cancelled" && !u.IsTemporary).Sum(u => u.Members.Count),
                    LookingForPartnerCount = d.Units.Count(u => u.Status != "Cancelled" && !u.IsTemporary && u.Members.Count < (d.TeamUnit?.TotalPlayers ?? 1))
                }).ToList(),
                RegisteredPlayers = registeredPlayers
            };

            return Ok(new ApiResponse<EventPublicViewDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching public event {EventId}", id);
            return StatusCode(500, new ApiResponse<EventPublicViewDto> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /events/{id} - Get event details
    [HttpGet("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<EventDetailDto>>> GetEvent(int id)
    {
        try
        {
            // Require profile completion before accessing event details
            if (!await HasCompletedProfileAsync())
            {
                return StatusCode(403, new ApiResponse<EventDetailDto>
                {
                    Success = false,
                    Message = "Please complete your profile before viewing event details"
                });
            }

            // Load event with all related data (avoiding filtered includes that can cause SQL Server issues)
            var evt = await _context.Events
                .AsSplitQuery() // Use split queries to avoid cartesian explosion with multiple collections
                .Include(e => e.EventType)
                .Include(e => e.OrganizedBy)
                .Include(e => e.OrganizedByClub)
                .Include(e => e.Venue)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.Units)
                        .ThenInclude(u => u.Members)
                            .ThenInclude(m => m.User)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.Units)
                        .ThenInclude(u => u.JoinRequests)
                            .ThenInclude(jr => jr.User)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.PartnerRequests)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.TeamUnit)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.AgeGroupEntity)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.SkillLevel)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.Rewards)
                .FirstOrDefaultAsync(e => e.Id == id && e.IsActive);

            if (evt == null)
                return NotFound(new ApiResponse<EventDetailDto> { Success = false, Message = "Event not found" });

            var userId = GetCurrentUserId();
            var isAdmin = await IsAdminAsync();

            // Get user's pending join requests for this event
            var pendingJoinRequests = userId.HasValue
                ? await _context.EventUnitJoinRequests
                    .Include(jr => jr.Unit)
                        .ThenInclude(u => u!.Division)
                            .ThenInclude(d => d!.TeamUnit)
                    .Include(jr => jr.Unit)
                        .ThenInclude(u => u!.Captain)
                    .Where(jr => jr.UserId == userId.Value
                        && jr.Status == "Pending"
                        && jr.Unit != null
                        && jr.Unit.EventId == id)
                    .Select(jr => new MyPendingJoinRequestDto
                    {
                        RequestId = jr.Id,
                        UnitId = jr.UnitId,
                        UnitName = jr.Unit!.Name,
                        DivisionId = jr.Unit.DivisionId,
                        DivisionName = jr.Unit.Division != null ? jr.Unit.Division.Name : "",
                        TeamUnitName = jr.Unit.Division != null ? jr.Unit.Division.TeamUnit!.Name : null,
                        CaptainName = jr.Unit.Captain != null ? Utility.FormatName(jr.Unit.Captain.LastName, jr.Unit.Captain.FirstName) : null,
                        CaptainProfileImageUrl = jr.Unit.Captain != null ? jr.Unit.Captain.ProfileImageUrl : null,
                        Status = jr.Status,
                        CreatedAt = jr.CreatedAt
                    })
                    .ToListAsync()
                : new List<MyPendingJoinRequestDto>();

            var dto = new EventDetailDto
            {
                Id = evt.Id,
                Name = evt.Name,
                Description = evt.Description,
                EventTypeId = evt.EventTypeId,
                EventTypeName = evt.EventType?.Name,
                EventTypeIcon = evt.EventType?.Icon,
                EventTypeColor = evt.EventType?.Color,
                AllowMultipleDivisions = evt.AllowMultipleDivisions,
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
                CourtName = evt.Venue?.Name,
                PosterImageUrl = evt.PosterImageUrl,
                BannerImageUrl = evt.BannerImageUrl,
                RegistrationFee = evt.RegistrationFee,
                PerDivisionFee = evt.PerDivisionFee,
                ContactName = evt.ContactName,
                ContactEmail = evt.ContactEmail,
                ContactPhone = evt.ContactPhone,
                PaymentInstructions = evt.PaymentInstructions,
                MaxParticipants = evt.MaxParticipants,
                RegisteredCount = evt.Divisions.Where(d => d.IsActive).SelectMany(d => d.Units).Count(u => u.Status != "Cancelled"),
                // Player count includes accepted members + pending join requests (UNION)
                RegisteredPlayerCount = evt.Divisions.Where(d => d.IsActive).SelectMany(d => d.Units).Where(u => u.Status != "Cancelled").SelectMany(u => u.Members).Count(m => m.InviteStatus == "Accepted")
                    + evt.Divisions.Where(d => d.IsActive).SelectMany(d => d.Units).Where(u => u.Status != "Cancelled").SelectMany(u => u.JoinRequests).Count(jr => jr.Status == "Pending"),
                DivisionCount = evt.Divisions.Count(d => d.IsActive),
                PrimaryTeamSize = evt.Divisions.Where(d => d.IsActive).GroupBy(d => d.TeamSize).OrderByDescending(g => g.Count()).Select(g => g.Key).FirstOrDefault(),
                OrganizedByUserId = evt.OrganizedByUserId,
                OrganizerName = evt.OrganizedBy != null ? Utility.FormatName(evt.OrganizedBy.LastName, evt.OrganizedBy.FirstName) : null,
                OrganizedByClubId = evt.OrganizedByClubId,
                ClubName = evt.OrganizedByClub?.Name,
                CreatedAt = evt.CreatedAt,
                TournamentStatus = evt.TournamentStatus,
                IsOrganizer = isAdmin || (userId.HasValue && evt.OrganizedByUserId == userId.Value),
                IsRegistered = userId.HasValue && (
                    evt.Divisions.Any(d => d.Units.Any(u => u.Status != "Cancelled" && u.Members.Any(m => m.UserId == userId.Value))) ||
                    pendingJoinRequests.Any()
                ),
                RegisteredDivisionIds = userId.HasValue
                    ? evt.Divisions.Where(d => d.Units.Any(u => u.Status != "Cancelled" && u.Members.Any(m => m.UserId == userId.Value))).Select(d => d.Id)
                        .Union(pendingJoinRequests.Select(p => p.DivisionId))
                        .ToList()
                    : new List<int>(),
                MyRegistrations = userId.HasValue
                    ? evt.Divisions
                        .SelectMany(d => d.Units
                            .Where(u => u.Status != "Cancelled" && u.Members.Any(m => m.UserId == userId.Value))
                            .Select(u => {
                                var requiredPlayers = d.TeamUnit?.TotalPlayers ?? d.TeamSize;
                                var acceptedMembers = u.Members.Count(m => m.InviteStatus == "Accepted");
                                var isComplete = acceptedMembers >= requiredPlayers;
                                return new UserRegistrationInfoDto
                                {
                                    UnitId = u.Id,
                                    DivisionId = d.Id,
                                    DivisionName = d.Name,
                                    DivisionDescription = d.Description,
                                    TeamUnitName = d.TeamUnit?.Name,
                                    SkillLevelName = d.SkillLevel?.Name,
                                    UnitName = u.Name,
                                    Status = u.Status,
                                    PaymentStatus = u.PaymentStatus,
                                    AmountPaid = u.AmountPaid,
                                    AmountDue = evt.RegistrationFee + (d.DivisionFee ?? 0m),
                                    PaymentProofUrl = u.PaymentProofUrl,
                                    RequiredPlayers = requiredPlayers,
                                    IsComplete = isComplete,
                                    NeedsPartner = !isComplete && requiredPlayers > 1,
                                    Partners = u.Members
                                        .Where(m => m.UserId != userId.Value)
                                        .Select(m => new PartnerInfoDto
                                        {
                                            UserId = m.UserId,
                                            Name = m.User != null ? Utility.FormatName(m.User.LastName, m.User.FirstName) : "Unknown",
                                            ProfileImageUrl = m.User?.ProfileImageUrl,
                                            Role = m.Role,
                                            InviteStatus = m.InviteStatus
                                        }).ToList(),
                                    // All members with payment data
                                    Members = u.Members
                                        .Select(m => new TeamMemberDto
                                        {
                                            Id = m.Id,
                                            UserId = m.UserId,
                                            Name = m.User != null ? Utility.FormatName(m.User.LastName, m.User.FirstName) : "Unknown",
                                            ProfileImageUrl = m.User?.ProfileImageUrl,
                                            Role = m.Role,
                                            InviteStatus = m.InviteStatus,
                                            IsCurrentUser = m.UserId == userId.Value,
                                            HasPaid = m.HasPaid,
                                            PaidAt = m.PaidAt,
                                            AmountPaid = m.AmountPaid,
                                            PaymentProofUrl = m.PaymentProofUrl,
                                            PaymentReference = m.PaymentReference,
                                            ReferenceId = m.ReferenceId
                                        }).ToList(),
                                    // Captain info for managing join requests
                                    IsCaptain = u.CaptainUserId == userId.Value,
                                    PendingJoinRequests = u.CaptainUserId == userId.Value
                                        ? (u.JoinRequests ?? new List<EventUnitJoinRequest>())
                                            .Where(jr => jr.Status == "Pending")
                                            .Select(jr => new UnitJoinRequestInfoDto
                                            {
                                                RequestId = jr.Id,
                                                UserId = jr.UserId,
                                                UserName = jr.User != null ? Utility.FormatName(jr.User.LastName, jr.User.FirstName) : "Unknown",
                                                ProfileImageUrl = jr.User?.ProfileImageUrl,
                                                Message = jr.Message,
                                                CreatedAt = jr.CreatedAt
                                            }).ToList()
                                        : new List<UnitJoinRequestInfoDto>()
                                };
                            }))
                        .ToList()
                    : new List<UserRegistrationInfoDto>(),
                MyPendingJoinRequests = pendingJoinRequests,
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
                        SkillLevelId = d.SkillLevelId,
                        SkillLevelName = d.SkillLevel?.Name,
                        MinSkillRating = d.MinSkillRating,
                        MaxSkillRating = d.MaxSkillRating,
                        MaxUnits = d.MaxUnits,
                        MaxPlayers = d.MaxPlayers,
                        // Legacy fields
                        TeamSize = d.TeamSize,
                        SkillLevelMin = d.SkillLevelMin,
                        SkillLevelMax = d.SkillLevelMax,
                        Gender = d.Gender,
                        AgeGroup = d.AgeGroup,
                        MaxTeams = d.MaxTeams,
                        DivisionFee = d.DivisionFee,
                        SortOrder = d.SortOrder,
                        RegisteredCount = d.Units.Count(u => u.Status != "Cancelled"),
                        RegisteredPlayerCount = d.Units.Where(u => u.Status != "Cancelled").SelectMany(u => u.Members).Count(m => m.InviteStatus == "Accepted"),
                        LookingForPartnerCount = d.PartnerRequests.Count(p => p.IsLookingForPartner && p.Status == "Open"),
                        // Tournament structure
                        DefaultScoreFormatId = d.DefaultScoreFormatId,
                        PoolCount = d.PoolCount,
                        PoolSize = d.PoolSize,
                        ScheduleType = d.ScheduleType,
                        ScheduleStatus = d.ScheduleStatus,
                        BracketType = d.BracketType,
                        PlayoffFromPools = d.PlayoffFromPools,
                        GamesPerMatch = d.GamesPerMatch,
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
                // Store dates without timezone conversion
                StartDate = DateTime.SpecifyKind(dto.StartDate, DateTimeKind.Unspecified),
                EndDate = DateTime.SpecifyKind(dto.EndDate, DateTimeKind.Unspecified),
                RegistrationOpenDate = dto.RegistrationOpenDate.HasValue
                    ? DateTime.SpecifyKind(dto.RegistrationOpenDate.Value, DateTimeKind.Unspecified)
                    : null,
                RegistrationCloseDate = dto.RegistrationCloseDate.HasValue
                    ? DateTime.SpecifyKind(dto.RegistrationCloseDate.Value, DateTimeKind.Unspecified)
                    : null,
                IsPrivate = dto.IsPrivate,
                AllowMultipleDivisions = dto.AllowMultipleDivisions,
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
                PriceUnit = dto.PriceUnit,
                PaymentModel = dto.PaymentModel,
                ContactName = dto.ContactName,
                ContactEmail = dto.ContactEmail,
                ContactPhone = dto.ContactPhone,
                PaymentInstructions = dto.PaymentInstructions,
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
                    SkillLevelId = divDto.SkillLevelId,
                    MinSkillRating = divDto.MinSkillRating,
                    MaxSkillRating = divDto.MaxSkillRating,
                    MaxUnits = divDto.MaxUnits,
                    MaxPlayers = divDto.MaxPlayers,
                    // Legacy fields
                    TeamSize = divDto.TeamSize,
                    SkillLevelMin = divDto.SkillLevelMin,
                    SkillLevelMax = divDto.SkillLevelMax,
                    Gender = divDto.Gender,
                    AgeGroup = divDto.AgeGroup,
                    MaxTeams = divDto.MaxTeams,
                    DivisionFee = divDto.DivisionFee,
                    SortOrder = divDto.SortOrder > 0 ? divDto.SortOrder : sortOrder++,
                    // Tournament structure
                    DefaultScoreFormatId = divDto.DefaultScoreFormatId,
                    GamesPerMatch = divDto.GamesPerMatch ?? 1,
                    ScheduleType = divDto.ScheduleType,
                    PoolCount = divDto.PoolCount,
                    PoolSize = divDto.PoolSize,
                    PlayoffFromPools = divDto.PlayoffFromPools
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

            // Grant "Event Organizer" award
            await _activityAwardService.GrantCreatedEventAwardAsync(userId.Value, evt.Id, evt.Name);

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

            // Check if user is organizer or admin
            var isAdmin = await IsAdminAsync();
            if (evt.OrganizedByUserId != userId.Value && !isAdmin)
                return Forbid();

            evt.Name = dto.Name;
            evt.Description = dto.Description;
            evt.EventTypeId = dto.EventTypeId;
            // Store dates without timezone conversion
            evt.StartDate = DateTime.SpecifyKind(dto.StartDate, DateTimeKind.Unspecified);
            evt.EndDate = DateTime.SpecifyKind(dto.EndDate, DateTimeKind.Unspecified);
            evt.RegistrationOpenDate = dto.RegistrationOpenDate.HasValue
                ? DateTime.SpecifyKind(dto.RegistrationOpenDate.Value, DateTimeKind.Unspecified)
                : null;
            evt.RegistrationCloseDate = dto.RegistrationCloseDate.HasValue
                ? DateTime.SpecifyKind(dto.RegistrationCloseDate.Value, DateTimeKind.Unspecified)
                : null;
            evt.IsPublished = dto.IsPublished;
            evt.IsPrivate = dto.IsPrivate;
            evt.AllowMultipleDivisions = dto.AllowMultipleDivisions;
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
            evt.PriceUnit = dto.PriceUnit;
            evt.PaymentModel = dto.PaymentModel;
            evt.ContactName = dto.ContactName;
            evt.ContactEmail = dto.ContactEmail;
            evt.ContactPhone = dto.ContactPhone;
            evt.PaymentInstructions = dto.PaymentInstructions;
            evt.MaxParticipants = dto.MaxParticipants;
            evt.DefaultScoreFormatId = dto.DefaultScoreFormatId;
            evt.UpdatedAt = DateTime.Now;

            // Handle divisions update
            if (dto.Divisions != null)
            {
                // Get existing division IDs from the DTO (divisions with IDs that should be kept)
                var incomingDivisionIds = dto.Divisions
                    .Where(d => d.Id.HasValue)
                    .Select(d => d.Id!.Value)
                    .ToList();

                // Soft delete divisions that are no longer in the list
                // (Hard delete would fail due to FK constraints from registrations, units, etc.)
                var divisionsToRemove = evt.Divisions
                    .Where(d => d.IsActive && !incomingDivisionIds.Contains(d.Id))
                    .ToList();

                foreach (var div in divisionsToRemove)
                {
                    div.IsActive = false;
                }

                // Update existing and add new divisions
                foreach (var divDto in dto.Divisions)
                {
                    if (divDto.Id.HasValue)
                    {
                        // Update existing active division
                        var existingDiv = evt.Divisions.FirstOrDefault(d => d.Id == divDto.Id.Value && d.IsActive);
                        if (existingDiv != null)
                        {
                            existingDiv.Name = divDto.Name;
                            existingDiv.Description = divDto.Description;
                            existingDiv.TeamSize = divDto.TeamSize;
                            existingDiv.MaxTeams = divDto.MaxTeams;
                            existingDiv.DivisionFee = divDto.DivisionFee;
                            existingDiv.TeamUnitId = divDto.TeamUnitId;
                            existingDiv.AgeGroupId = divDto.AgeGroupId;
                            existingDiv.SkillLevelId = divDto.SkillLevelId;
                            existingDiv.MinSkillRating = divDto.MinSkillRating;
                            existingDiv.MaxSkillRating = divDto.MaxSkillRating;
                            existingDiv.MaxUnits = divDto.MaxUnits;
                            existingDiv.MaxPlayers = divDto.MaxPlayers;
                            existingDiv.DefaultScoreFormatId = divDto.DefaultScoreFormatId;
                            existingDiv.GamesPerMatch = divDto.GamesPerMatch ?? 1;
                            existingDiv.ScheduleType = divDto.ScheduleType;
                            existingDiv.PoolCount = divDto.PoolCount;
                            existingDiv.PoolSize = divDto.PoolSize;
                            existingDiv.PlayoffFromPools = divDto.PlayoffFromPools;
                        }
                    }
                    else
                    {
                        // Add new division
                        var newDivision = new EventDivision
                        {
                            EventId = evt.Id,
                            Name = divDto.Name,
                            Description = divDto.Description,
                            TeamSize = divDto.TeamSize,
                            MaxTeams = divDto.MaxTeams,
                            DivisionFee = divDto.DivisionFee,
                            TeamUnitId = divDto.TeamUnitId,
                            AgeGroupId = divDto.AgeGroupId,
                            SkillLevelId = divDto.SkillLevelId,
                            MinSkillRating = divDto.MinSkillRating,
                            MaxSkillRating = divDto.MaxSkillRating,
                            MaxUnits = divDto.MaxUnits,
                            MaxPlayers = divDto.MaxPlayers,
                            SortOrder = divDto.SortOrder,
                            DefaultScoreFormatId = divDto.DefaultScoreFormatId,
                            GamesPerMatch = divDto.GamesPerMatch ?? 1,
                            ScheduleType = divDto.ScheduleType,
                            PoolCount = divDto.PoolCount,
                            PoolSize = divDto.PoolSize,
                            PlayoffFromPools = divDto.PlayoffFromPools
                        };
                        evt.Divisions.Add(newDivision);
                    }
                }
            }

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

            // Check if user is organizer or admin
            var isAdmin = await IsAdminAsync();
            if (evt.OrganizedByUserId != userId.Value && !isAdmin)
                return Forbid();

            evt.IsPublished = true;
            evt.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            // Grant award for publishing event
            await _activityAwardService.GrantPublishedEventAwardAsync(userId.Value, evt.Id, evt.Name);

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Event published successfully!" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error publishing event");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /events/{id}/unpublish - Unpublish event
    [HttpPost("{id}/unpublish")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> UnpublishEvent(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var evt = await _context.Events.FindAsync(id);
            if (evt == null || !evt.IsActive)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

            // Check if user is organizer or admin
            var isAdmin = await IsAdminAsync();
            if (evt.OrganizedByUserId != userId.Value && !isAdmin)
                return Forbid();

            evt.IsPublished = false;
            evt.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Event unpublished" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unpublishing event");
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

            // Check if user is organizer or admin
            var isAdmin = await IsAdminAsync();
            if (evt.OrganizedByUserId != userId.Value && !isAdmin)
                return Forbid();

            // Only allow deletion of draft (unpublished) events
            if (evt.IsPublished)
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Published events cannot be deleted. Unpublish the event first." });

            evt.IsActive = false;
            evt.UpdatedAt = DateTime.Now;
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
            if (evt == null || !evt.IsActive || !evt.IsPublished || evt.TournamentStatus == "Draft")
                return NotFound(new ApiResponse<EventRegistrationDto> { Success = false, Message = "Event not found" });

            // Check registration period
            var now = DateTime.Now;
            if (evt.RegistrationOpenDate.HasValue && now < evt.RegistrationOpenDate.Value)
                return BadRequest(new ApiResponse<EventRegistrationDto> { Success = false, Message = "Registration has not opened yet" });

            if (evt.RegistrationCloseDate.HasValue && now > evt.RegistrationCloseDate.Value)
                return BadRequest(new ApiResponse<EventRegistrationDto> { Success = false, Message = "Registration has closed" });

            var division = await _context.EventDivisions.FindAsync(dto.DivisionId);
            if (division == null || division.EventId != id || !division.IsActive)
                return NotFound(new ApiResponse<EventRegistrationDto> { Success = false, Message = "Division not found" });

            // Check MaxPlayers capacity
            if (division.MaxPlayers.HasValue)
            {
                var currentPlayerCount = await _context.EventRegistrations
                    .CountAsync(r => r.DivisionId == dto.DivisionId && r.Status != "Cancelled");

                if (currentPlayerCount >= division.MaxPlayers.Value)
                {
                    return BadRequest(new ApiResponse<EventRegistrationDto>
                    {
                        Success = false,
                        Message = $"Division '{division.Name}' has reached its maximum capacity of {division.MaxPlayers.Value} players."
                    });
                }
            }

            // Check if already registered for this division
            var existingReg = await _context.EventRegistrations
                .FirstOrDefaultAsync(r => r.EventId == id && r.DivisionId == dto.DivisionId && r.UserId == userId.Value);

            if (existingReg != null && existingReg.Status != "Cancelled")
                return BadRequest(new ApiResponse<EventRegistrationDto> { Success = false, Message = "Already registered for this division" });

            // Check if event allows multiple divisions
            if (!evt.AllowMultipleDivisions)
            {
                // Check if user is already registered for any other division in this event
                var hasOtherRegistration = await _context.EventRegistrations
                    .AnyAsync(r => r.EventId == id && r.UserId == userId.Value && r.Status != "Cancelled");

                if (hasOtherRegistration)
                    return BadRequest(new ApiResponse<EventRegistrationDto> { Success = false, Message = "This event only allows registration for one division" });
            }

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
            var userName = user != null ? Utility.FormatName(user.LastName, user.FirstName) : "Someone";

            // Notify event organizer about new registration (don't notify self)
            if (evt.OrganizedByUserId != userId.Value)
            {
                await _notificationService.CreateAndSendAsync(
                    evt.OrganizedByUserId,
                    "EventRegistration",
                    "New Event Registration",
                    $"{userName} registered for {evt.Name} ({division.Name})",
                    $"/events?id={id}",
                    "EventRegistration",
                    registration.Id
                );
            }

            // Grant "Event Participant" award
            await _activityAwardService.GrantJoinedEventAwardAsync(userId.Value, id, evt.Name);

            return Ok(new ApiResponse<EventRegistrationDto>
            {
                Success = true,
                Data = new EventRegistrationDto
                {
                    Id = registration.Id,
                    EventId = registration.EventId,
                    DivisionId = registration.DivisionId,
                    UserId = registration.UserId,
                    UserName = userName,
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
    // DEPRECATED: Use TournamentController.RegisterForEvent or RequestToJoinUnit instead
    [Obsolete("Use TournamentController endpoints for registration and join requests")]
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
                    UserName = user != null ? Utility.FormatName(user.LastName, user.FirstName) : "",
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
    // DEPRECATED: Use TournamentController.GetEventUnits to get units looking for partners
    [Obsolete("Use TournamentController.GetEventUnits for units looking for partners")]
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
    // DEPRECATED: Use TournamentController.CancelJoinRequest instead
    [Obsolete("Use TournamentController.CancelJoinRequest instead")]
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
                .AsSplitQuery()
                .Include(e => e.EventType)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.Units)
                        .ThenInclude(u => u.Members)
                .Include(e => e.Divisions)
                    .ThenInclude(d => d.Units)
                        .ThenInclude(u => u.JoinRequests)
                .Where(e => e.OrganizedByUserId == userId.Value && e.IsActive)
                .OrderByDescending(e => e.StartDate)
                .ToListAsync();

            // Events I'm registered for (via EventUnitMembers)
            var myMemberships = await _context.EventUnitMembers
                .AsSplitQuery()
                .Include(m => m.Unit)
                    .ThenInclude(u => u!.Event)
                .Include(m => m.Unit)
                    .ThenInclude(u => u!.Division)
                        .ThenInclude(d => d!.TeamUnit)
                .Include(m => m.Unit)
                    .ThenInclude(u => u!.Members)
                        .ThenInclude(mem => mem.User)
                .Where(m => m.UserId == userId.Value && m.Unit != null && m.Unit.Status != "Cancelled" && m.Unit.Event != null && m.Unit.Event.IsActive)
                .ToListAsync();

            var registrationSummaries = myMemberships
                .GroupBy(m => m.Unit!.EventId)
                .Select(g => {
                    var firstUnit = g.First().Unit!;
                    var evt = firstUnit.Event!;

                    // Build unit details for each unit the user is in
                    var units = g.Select(m => {
                        var unit = m.Unit!;
                        var division = unit.Division;
                        var requiredPlayers = division?.TeamUnit?.TotalPlayers ?? division?.TeamSize ?? 1;
                        var acceptedMembers = unit.Members.Count(mem => mem.InviteStatus == "Accepted");
                        var isComplete = acceptedMembers >= requiredPlayers;
                        var amountDue = evt.RegistrationFee + (division?.DivisionFee ?? 0m);

                        // Check for pending invites or join requests
                        var hasPendingInvites = unit.Members.Any(mem => mem.InviteStatus == "Pending");
                        var hasPendingJoinRequests = unit.Members.Any(mem => mem.InviteStatus == "PendingJoinRequest");

                        // Compute registration status
                        string registrationStatus;
                        if (isComplete)
                        {
                            registrationStatus = "Team Complete";
                        }
                        else if (hasPendingInvites || hasPendingJoinRequests)
                        {
                            registrationStatus = "Waiting for Captain Accept";
                        }
                        else
                        {
                            registrationStatus = "Looking for Partner";
                        }

                        return new MyRegistrationUnitDto
                        {
                            UnitId = unit.Id,
                            DivisionId = unit.DivisionId,
                            DivisionName = division?.Name ?? "",
                            TeamUnitName = division?.TeamUnit?.Name,
                            RequiredPlayers = requiredPlayers,
                            IsComplete = isComplete,
                            NeedsPartner = !isComplete && requiredPlayers > 1,
                            Status = unit.Status,
                            RegistrationStatus = registrationStatus,
                            PaymentStatus = unit.PaymentStatus,
                            AmountDue = amountDue,
                            AmountPaid = unit.AmountPaid,
                            DrawingInProgress = division?.DrawingInProgress ?? false,
                            // Filter out duplicate members (those with PendingJoinRequest status that also appear as join requests)
                            Members = unit.Members
                                .GroupBy(mem => mem.UserId)
                                .Select(grp => grp.First()) // Keep only one entry per user
                                .Select(mem => new TeamMemberDto
                                {
                                    Id = mem.Id,
                                    UserId = mem.UserId,
                                    // Name format: "Last, First"
                                    Name = FormatName(mem.User?.LastName, mem.User?.FirstName),
                                    ProfileImageUrl = mem.User?.ProfileImageUrl,
                                    Role = mem.Role,
                                    InviteStatus = mem.InviteStatus,
                                    IsCurrentUser = mem.UserId == userId.Value,
                                    HasPaid = mem.HasPaid,
                                    PaidAt = mem.PaidAt,
                                    AmountPaid = mem.AmountPaid,
                                    PaymentProofUrl = mem.PaymentProofUrl,
                                    PaymentReference = mem.PaymentReference,
                                    ReferenceId = mem.ReferenceId
                                }).ToList()
                        };
                    }).ToList();

                    // Determine overall payment status
                    var overallPaymentStatus = units.All(u => u.PaymentStatus == "Paid") ? "Paid" :
                        units.Any(u => u.PaymentStatus == "Paid" || u.PaymentStatus == "Partial") ? "Partial" : "Pending";

                    return new EventRegistrationSummaryDto
                    {
                        EventId = g.Key,
                        EventName = evt.Name,
                        StartDate = evt.StartDate,
                        VenueName = evt.VenueName,
                        City = evt.City,
                        State = evt.State,
                        PosterImageUrl = evt.PosterImageUrl,
                        PaymentInstructions = evt.PaymentInstructions,
                        RegisteredDivisions = g.Select(m => m.Unit?.Division?.Name ?? "").ToList(),
                        PaymentStatus = overallPaymentStatus,
                        Status = firstUnit.Status,
                        Units = units
                    };
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

            // Check if user is organizer or site admin
            var isAdmin = await IsAdminAsync();
            if (evt.OrganizedByUserId != userId.Value && !isAdmin)
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
                SkillLevelId = dto.SkillLevelId,
                MinSkillRating = dto.MinSkillRating,
                MaxSkillRating = dto.MaxSkillRating,
                MaxUnits = dto.MaxUnits,
                MaxPlayers = dto.MaxPlayers,
                // Legacy fields
                TeamSize = dto.TeamSize,
                SkillLevelMin = dto.SkillLevelMin,
                SkillLevelMax = dto.SkillLevelMax,
                Gender = dto.Gender,
                AgeGroup = dto.AgeGroup,
                MaxTeams = dto.MaxTeams,
                DivisionFee = dto.DivisionFee,
                SortOrder = dto.SortOrder > 0 ? dto.SortOrder : maxSortOrder + 1,
                // Tournament structure
                DefaultScoreFormatId = dto.DefaultScoreFormatId,
                GamesPerMatch = dto.GamesPerMatch ?? 1,
                ScheduleType = dto.ScheduleType,
                PoolCount = dto.PoolCount,
                PoolSize = dto.PoolSize,
                PlayoffFromPools = dto.PlayoffFromPools
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

            // Load team unit, age group, and skill level for response
            var teamUnit = dto.TeamUnitId.HasValue ? await _context.TeamUnits.FindAsync(dto.TeamUnitId.Value) : null;
            var ageGroup = dto.AgeGroupId.HasValue ? await _context.AgeGroups.FindAsync(dto.AgeGroupId.Value) : null;
            var skillLevel = dto.SkillLevelId.HasValue ? await _context.SkillLevels.FindAsync(dto.SkillLevelId.Value) : null;

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
                    SkillLevelId = division.SkillLevelId,
                    SkillLevelName = skillLevel?.Name,
                    MinSkillRating = division.MinSkillRating,
                    MaxSkillRating = division.MaxSkillRating,
                    MaxUnits = division.MaxUnits,
                    MaxPlayers = division.MaxPlayers,
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
                    RegisteredPlayerCount = 0,
                    LookingForPartnerCount = 0,
                    // Tournament structure
                    DefaultScoreFormatId = division.DefaultScoreFormatId,
                    PoolCount = division.PoolCount,
                    PoolSize = division.PoolSize,
                    ScheduleType = division.ScheduleType,
                    ScheduleStatus = division.ScheduleStatus,
                    BracketType = division.BracketType,
                    PlayoffFromPools = division.PlayoffFromPools,
                    GamesPerMatch = division.GamesPerMatch,
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

    // PUT: /events/{id}/divisions/{divisionId} - Update division
    [HttpPut("{id}/divisions/{divisionId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<EventDivisionDto>>> UpdateDivision(int id, int divisionId, [FromBody] UpdateDivisionDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<EventDivisionDto> { Success = false, Message = "User not authenticated" });

            var evt = await _context.Events.FindAsync(id);
            if (evt == null || !evt.IsActive)
                return NotFound(new ApiResponse<EventDivisionDto> { Success = false, Message = "Event not found" });

            // Check if user is organizer or admin
            var user = await _context.Users.FindAsync(userId.Value);
            var isAdmin = user?.Role == "Admin";
            if (evt.OrganizedByUserId != userId.Value && !isAdmin)
                return Forbid();

            var division = await _context.EventDivisions
                .Include(d => d.TeamUnit)
                .Include(d => d.SkillLevel)
                .Include(d => d.AgeGroupEntity)
                .FirstOrDefaultAsync(d => d.Id == divisionId && d.EventId == id && d.IsActive);

            if (division == null)
                return NotFound(new ApiResponse<EventDivisionDto> { Success = false, Message = "Division not found" });

            // Update fields if provided
            if (dto.Name != null) division.Name = dto.Name;
            if (dto.Description != null) division.Description = dto.Description;
            if (dto.TeamUnitId.HasValue) division.TeamUnitId = dto.TeamUnitId;
            if (dto.AgeGroupId.HasValue) division.AgeGroupId = dto.AgeGroupId;
            if (dto.SkillLevelId.HasValue) division.SkillLevelId = dto.SkillLevelId;
            if (dto.MaxUnits.HasValue) division.MaxUnits = dto.MaxUnits;
            if (dto.MaxPlayers.HasValue) division.MaxPlayers = dto.MaxPlayers;
            if (dto.DivisionFee.HasValue) division.DivisionFee = dto.DivisionFee;

            // Tournament structure fields
            if (dto.DefaultScoreFormatId.HasValue) division.DefaultScoreFormatId = dto.DefaultScoreFormatId;
            if (dto.PoolCount.HasValue) division.PoolCount = dto.PoolCount;
            if (dto.PoolSize.HasValue) division.PoolSize = dto.PoolSize;
            if (dto.ScheduleType != null) division.ScheduleType = dto.ScheduleType;
            if (dto.BracketType != null) division.BracketType = dto.BracketType;
            if (dto.PlayoffFromPools.HasValue) division.PlayoffFromPools = dto.PlayoffFromPools;
            if (dto.GamesPerMatch.HasValue) division.GamesPerMatch = dto.GamesPerMatch.Value;

            await _context.SaveChangesAsync();

            // Reload with navigation properties
            await _context.Entry(division).Reference(d => d.TeamUnit).LoadAsync();
            await _context.Entry(division).Reference(d => d.SkillLevel).LoadAsync();
            await _context.Entry(division).Reference(d => d.AgeGroupEntity).LoadAsync();

            var registeredCount = await _context.EventUnits
                .CountAsync(u => u.DivisionId == division.Id && u.Status != "Cancelled");

            var registeredPlayerCount = await _context.EventUnitMembers
                .CountAsync(m => m.Unit != null && m.Unit.DivisionId == division.Id && m.Unit.Status != "Cancelled" && m.InviteStatus == "Accepted");

            return Ok(new ApiResponse<EventDivisionDto>
            {
                Success = true,
                Data = new EventDivisionDto
                {
                    Id = division.Id,
                    EventId = division.EventId,
                    Name = division.Name,
                    Description = division.Description,
                    TeamUnitId = division.TeamUnitId,
                    TeamUnitName = division.TeamUnit?.Name,
                    AgeGroupId = division.AgeGroupId,
                    AgeGroupName = division.AgeGroupEntity?.Name,
                    SkillLevelId = division.SkillLevelId,
                    SkillLevelName = division.SkillLevel?.Name,
                    MaxUnits = division.MaxUnits,
                    MaxPlayers = division.MaxPlayers,
                    DivisionFee = division.DivisionFee,
                    SortOrder = division.SortOrder,
                    RegisteredCount = registeredCount,
                    RegisteredPlayerCount = registeredPlayerCount,
                    // Tournament structure
                    DefaultScoreFormatId = division.DefaultScoreFormatId,
                    PoolCount = division.PoolCount,
                    PoolSize = division.PoolSize,
                    ScheduleType = division.ScheduleType,
                    ScheduleStatus = division.ScheduleStatus,
                    BracketType = division.BracketType,
                    PlayoffFromPools = division.PlayoffFromPools,
                    GamesPerMatch = division.GamesPerMatch
                },
                Message = "Division updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating division {DivisionId}", divisionId);
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

            // Check if user is organizer or site admin
            var isAdmin = await IsAdminAsync();
            if (evt.OrganizedByUserId != userId.Value && !isAdmin)
                return Forbid();

            var division = await _context.EventDivisions
                .Include(d => d.Units)
                .FirstOrDefaultAsync(d => d.Id == divisionId && d.EventId == id);

            if (division == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Division not found" });

            if (division.Units.Any(u => u.Status != "Cancelled"))
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

    // GET: /events/{id}/documents - Get event documents
    [HttpGet("{id}/documents")]
    public async Task<ActionResult<ApiResponse<List<EventDocumentDto>>>> GetEventDocuments(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            var isAdmin = await IsAdminAsync();

            var evt = await _context.Events.FindAsync(id);
            if (evt == null || !evt.IsActive)
                return NotFound(new ApiResponse<List<EventDocumentDto>> { Success = false, Message = "Event not found" });

            // Check if user can see private documents
            var isOrganizer = evt.OrganizedByUserId == userId;
            var isRegistered = userId.HasValue && await _context.EventUnitMembers
                .AnyAsync(m => m.Unit!.EventId == id && m.UserId == userId.Value && m.Unit.Status != "Cancelled");
            var canSeePrivate = isOrganizer || isAdmin || isRegistered;

            var query = _context.EventDocuments
                .Include(d => d.UploadedBy)
                .Where(d => d.EventId == id);

            if (!canSeePrivate)
                query = query.Where(d => d.IsPublic);

            var documents = await query
                .OrderBy(d => d.SortOrder)
                .ThenBy(d => d.CreatedAt)
                .Select(d => new EventDocumentDto
                {
                    Id = d.Id,
                    EventId = d.EventId,
                    DocumentType = d.DocumentType,
                    Title = d.Title,
                    FileUrl = d.FileUrl,
                    FileName = d.FileName,
                    FileType = d.FileType,
                    FileSize = d.FileSize,
                    IsPublic = d.IsPublic,
                    SortOrder = d.SortOrder,
                    UploadedByUserId = d.UploadedByUserId,
                    UploadedByUserName = d.UploadedBy != null ? (d.UploadedBy.FirstName + " " + d.UploadedBy.LastName).Trim() : null,
                    CreatedAt = d.CreatedAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<EventDocumentDto>> { Success = true, Data = documents });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting event documents for event {EventId}", id);
            return StatusCode(500, new ApiResponse<List<EventDocumentDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /events/{id}/documents - Add document to event (organizer/admin only)
    [HttpPost("{id}/documents")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<EventDocumentDto>>> AddEventDocument(int id, [FromBody] CreateEventDocumentDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<EventDocumentDto> { Success = false, Message = "User not authenticated" });

            var evt = await _context.Events.FindAsync(id);
            if (evt == null || !evt.IsActive)
                return NotFound(new ApiResponse<EventDocumentDto> { Success = false, Message = "Event not found" });

            // Check if user is organizer or admin
            var isAdmin = await IsAdminAsync();
            if (evt.OrganizedByUserId != userId.Value && !isAdmin)
                return Forbid();

            var document = new EventDocument
            {
                EventId = id,
                DocumentType = dto.DocumentType,
                Title = dto.Title,
                FileUrl = dto.FileUrl,
                FileName = dto.FileName,
                FileType = dto.FileType,
                FileSize = dto.FileSize,
                IsPublic = dto.IsPublic,
                SortOrder = dto.SortOrder,
                UploadedByUserId = userId.Value,
                CreatedAt = DateTime.UtcNow
            };

            _context.EventDocuments.Add(document);
            await _context.SaveChangesAsync();

            var user = await _context.Users.FindAsync(userId.Value);

            return Ok(new ApiResponse<EventDocumentDto>
            {
                Success = true,
                Data = new EventDocumentDto
                {
                    Id = document.Id,
                    EventId = document.EventId,
                    DocumentType = document.DocumentType,
                    Title = document.Title,
                    FileUrl = document.FileUrl,
                    FileName = document.FileName,
                    FileType = document.FileType,
                    FileSize = document.FileSize,
                    IsPublic = document.IsPublic,
                    SortOrder = document.SortOrder,
                    UploadedByUserId = document.UploadedByUserId,
                    UploadedByUserName = user != null ? (user.FirstName + " " + user.LastName).Trim() : null,
                    CreatedAt = document.CreatedAt
                },
                Message = "Document added successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding document to event {EventId}", id);
            return StatusCode(500, new ApiResponse<EventDocumentDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /events/{id}/documents/{docId} - Update document (organizer/admin only)
    [HttpPut("{id}/documents/{docId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<EventDocumentDto>>> UpdateEventDocument(int id, int docId, [FromBody] UpdateEventDocumentDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<EventDocumentDto> { Success = false, Message = "User not authenticated" });

            var evt = await _context.Events.FindAsync(id);
            if (evt == null || !evt.IsActive)
                return NotFound(new ApiResponse<EventDocumentDto> { Success = false, Message = "Event not found" });

            // Check if user is organizer or admin
            var isAdmin = await IsAdminAsync();
            if (evt.OrganizedByUserId != userId.Value && !isAdmin)
                return Forbid();

            var document = await _context.EventDocuments
                .Include(d => d.UploadedBy)
                .FirstOrDefaultAsync(d => d.Id == docId && d.EventId == id);

            if (document == null)
                return NotFound(new ApiResponse<EventDocumentDto> { Success = false, Message = "Document not found" });

            // Update fields if provided
            if (dto.DocumentType != null) document.DocumentType = dto.DocumentType;
            if (dto.Title != null) document.Title = dto.Title;
            if (dto.IsPublic.HasValue) document.IsPublic = dto.IsPublic.Value;
            if (dto.SortOrder.HasValue) document.SortOrder = dto.SortOrder.Value;
            document.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<EventDocumentDto>
            {
                Success = true,
                Data = new EventDocumentDto
                {
                    Id = document.Id,
                    EventId = document.EventId,
                    DocumentType = document.DocumentType,
                    Title = document.Title,
                    FileUrl = document.FileUrl,
                    FileName = document.FileName,
                    FileType = document.FileType,
                    FileSize = document.FileSize,
                    IsPublic = document.IsPublic,
                    SortOrder = document.SortOrder,
                    UploadedByUserId = document.UploadedByUserId,
                    UploadedByUserName = document.UploadedBy != null ? (document.UploadedBy.FirstName + " " + document.UploadedBy.LastName).Trim() : null,
                    CreatedAt = document.CreatedAt
                },
                Message = "Document updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating document {DocId}", docId);
            return StatusCode(500, new ApiResponse<EventDocumentDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /events/{id}/documents/{docId} - Delete document (organizer/admin only)
    [HttpDelete("{id}/documents/{docId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteEventDocument(int id, int docId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var evt = await _context.Events.FindAsync(id);
            if (evt == null || !evt.IsActive)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Event not found" });

            // Check if user is organizer or admin
            var isAdmin = await IsAdminAsync();
            if (evt.OrganizedByUserId != userId.Value && !isAdmin)
                return Forbid();

            var document = await _context.EventDocuments.FirstOrDefaultAsync(d => d.Id == docId && d.EventId == id);
            if (document == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Document not found" });

            _context.EventDocuments.Remove(document);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Document deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting document {DocId}", docId);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /events/{id}/registrations - Get all registrations for an event (organizer only)
    [HttpGet("{id}/registrations")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<EventRegistrationDto>>>> GetAllEventRegistrations(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<EventRegistrationDto>> { Success = false, Message = "User not authenticated" });

            var evt = await _context.Events.FindAsync(id);
            if (evt == null || !evt.IsActive)
                return NotFound(new ApiResponse<List<EventRegistrationDto>> { Success = false, Message = "Event not found" });

            // Check if user is organizer or site admin
            var isAdmin = await IsAdminAsync();
            if (evt.OrganizedByUserId != userId.Value && !isAdmin)
                return Forbid();

            var registrations = await _context.EventRegistrations
                .Include(r => r.User)
                .Include(r => r.Division)
                .Where(r => r.EventId == id && r.Status != "Cancelled")
                .OrderBy(r => r.Division!.Name)
                .ThenBy(r => r.RegisteredAt)
                .Select(r => new EventRegistrationDto
                {
                    Id = r.Id,
                    EventId = r.EventId,
                    DivisionId = r.DivisionId,
                    DivisionName = r.Division != null ? r.Division.Name : "",
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
            _logger.LogError(ex, "Error fetching event registrations");
            return StatusCode(500, new ApiResponse<List<EventRegistrationDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /events/{id}/registrations/{registrationId} - Update a registration (organizer only)
    [HttpPut("{id}/registrations/{registrationId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<EventRegistrationDto>>> UpdateRegistration(int id, int registrationId, [FromBody] UpdateRegistrationDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<EventRegistrationDto> { Success = false, Message = "User not authenticated" });

            var evt = await _context.Events.FindAsync(id);
            if (evt == null || !evt.IsActive)
                return NotFound(new ApiResponse<EventRegistrationDto> { Success = false, Message = "Event not found" });

            // Check if user is organizer or site admin
            var isAdmin = await IsAdminAsync();
            if (evt.OrganizedByUserId != userId.Value && !isAdmin)
                return Forbid();

            var registration = await _context.EventRegistrations
                .Include(r => r.User)
                .FirstOrDefaultAsync(r => r.Id == registrationId && r.EventId == id);

            if (registration == null)
                return NotFound(new ApiResponse<EventRegistrationDto> { Success = false, Message = "Registration not found" });

            // Update fields
            if (dto.PaymentStatus != null)
                registration.PaymentStatus = dto.PaymentStatus;
            if (dto.AmountPaid.HasValue)
                registration.AmountPaid = dto.AmountPaid.Value;
            if (dto.TeamId.HasValue)
                registration.TeamId = dto.TeamId.Value;
            if (dto.TeamName != null)
                registration.TeamName = dto.TeamName;
            if (dto.Status != null)
                registration.Status = dto.Status;
            if (dto.CheckedIn.HasValue && dto.CheckedIn.Value)
                registration.CheckedInAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<EventRegistrationDto>
            {
                Success = true,
                Data = new EventRegistrationDto
                {
                    Id = registration.Id,
                    EventId = registration.EventId,
                    DivisionId = registration.DivisionId,
                    UserId = registration.UserId,
                    UserName = registration.User != null ? Utility.FormatName(registration.User.LastName, registration.User.FirstName) : "",
                    UserProfileImageUrl = registration.User?.ProfileImageUrl,
                    TeamId = registration.TeamId,
                    TeamName = registration.TeamName,
                    PaymentStatus = registration.PaymentStatus,
                    AmountPaid = registration.AmountPaid,
                    Status = registration.Status,
                    RegisteredAt = registration.RegisteredAt,
                    CheckedInAt = registration.CheckedInAt
                },
                Message = "Registration updated"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating registration");
            return StatusCode(500, new ApiResponse<EventRegistrationDto> { Success = false, Message = "An error occurred" });
        }
    }

    // Helper methods
    private EventDto MapToEventDto(Event evt, double? distance)
    {
        // Try to get coordinates from venue first, then fall back to event's own coordinates
        double? latitude = null;
        double? longitude = null;

        if (evt.Venue != null && !string.IsNullOrEmpty(evt.Venue.GpsLat) && !string.IsNullOrEmpty(evt.Venue.GpsLng))
        {
            if (double.TryParse(evt.Venue.GpsLat, out var venueLat) && double.TryParse(evt.Venue.GpsLng, out var venueLng))
            {
                latitude = venueLat;
                longitude = venueLng;
            }
        }

        // Fall back to event's own coordinates if venue doesn't have GPS
        if (!latitude.HasValue || !longitude.HasValue)
        {
            latitude = evt.Latitude;
            longitude = evt.Longitude;
        }

        return new EventDto
        {
            Id = evt.Id,
            Name = evt.Name,
            Description = evt.Description,
            EventTypeId = evt.EventTypeId,
            EventTypeName = evt.EventType?.Name,
            EventTypeIcon = evt.EventType?.Icon,
            EventTypeColor = evt.EventType?.Color,
            AllowMultipleDivisions = evt.AllowMultipleDivisions,
            StartDate = evt.StartDate,
            EndDate = evt.EndDate,
            RegistrationOpenDate = evt.RegistrationOpenDate,
            RegistrationCloseDate = evt.RegistrationCloseDate,
            IsPublished = evt.IsPublished,
            IsPrivate = evt.IsPrivate,
            VenueName = evt.VenueName ?? evt.Venue?.Name,
            Address = evt.Address ?? evt.Venue?.Addr1,
            City = evt.City,
            State = evt.State,
            Country = evt.Country,
            Latitude = latitude,
            Longitude = longitude,
            CourtId = evt.CourtId,
            PosterImageUrl = evt.PosterImageUrl,
            RegistrationFee = evt.RegistrationFee,
            PerDivisionFee = evt.PerDivisionFee,
            PriceUnit = evt.PriceUnit,
            PaymentModel = evt.PaymentModel,
            MaxParticipants = evt.MaxParticipants,
            RegisteredCount = evt.Divisions?.Where(d => d.IsActive).SelectMany(d => d.Units ?? Enumerable.Empty<EventUnit>()).Count(u => u.Status != "Cancelled") ?? 0,
            // Player count includes accepted members + pending join requests (UNION)
            RegisteredPlayerCount = (evt.Divisions?.Where(d => d.IsActive).SelectMany(d => d.Units ?? Enumerable.Empty<EventUnit>()).Where(u => u.Status != "Cancelled").SelectMany(u => u.Members ?? Enumerable.Empty<EventUnitMember>()).Count(m => m.InviteStatus == "Accepted") ?? 0)
                + (evt.Divisions?.Where(d => d.IsActive).SelectMany(d => d.Units ?? Enumerable.Empty<EventUnit>()).Where(u => u.Status != "Cancelled").SelectMany(u => u.JoinRequests ?? Enumerable.Empty<EventUnitJoinRequest>()).Count(jr => jr.Status == "Pending") ?? 0),
            DivisionCount = evt.Divisions?.Count(d => d.IsActive) ?? 0,
            PrimaryTeamSize = evt.Divisions?.Where(d => d.IsActive).GroupBy(d => d.TeamSize).OrderByDescending(g => g.Count()).Select(g => g.Key).FirstOrDefault() ?? 2,
            Distance = distance,
            OrganizedByUserId = evt.OrganizedByUserId,
            OrganizerName = evt.OrganizedBy != null ? Utility.FormatName(evt.OrganizedBy.LastName, evt.OrganizedBy.FirstName) : null,
            OrganizedByClubId = evt.OrganizedByClubId,
            ClubName = evt.OrganizedByClub?.Name,
            CreatedAt = evt.CreatedAt,
            TournamentStatus = evt.TournamentStatus
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

    /// <summary>
    /// Format name as "Last, First" when both are available
    /// </summary>
    private static string FormatName(string? lastName, string? firstName)
    {
        if (!string.IsNullOrWhiteSpace(lastName) && !string.IsNullOrWhiteSpace(firstName))
            return $"{lastName}, {firstName}";
        if (!string.IsNullOrWhiteSpace(lastName))
            return lastName;
        if (!string.IsNullOrWhiteSpace(firstName))
            return firstName;
        return "Unknown";
    }
}
