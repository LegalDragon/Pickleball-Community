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
public class ClubsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ClubsController> _logger;
    private readonly INotificationService _notificationService;
    private readonly IActivityAwardService _activityAwardService;
    private readonly IEmailNotificationService _emailService;
    private readonly IGeocodingService _geocodingService;

    public ClubsController(
        ApplicationDbContext context,
        ILogger<ClubsController> logger,
        INotificationService notificationService,
        IActivityAwardService activityAwardService,
        IEmailNotificationService emailService,
        IGeocodingService geocodingService)
    {
        _context = context;
        _logger = logger;
        _notificationService = notificationService;
        _activityAwardService = activityAwardService;
        _emailService = emailService;
        _geocodingService = geocodingService;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    // Check if current user is a site admin
    private async Task<bool> IsSiteAdminAsync()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return false;

        var user = await _context.Users.FindAsync(userId.Value);
        return user?.Role?.ToLower() == "admin";
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

    // GET: /clubs/recent - Get recently created clubs (public, for home page marquee)
    [HttpGet("recent")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<List<RecentClubDto>>>> GetRecentClubs([FromQuery] int count = 20, [FromQuery] int days = 30)
    {
        try
        {
            // Limit to reasonable range
            count = Math.Clamp(count, 5, 50);
            days = Math.Clamp(days, 1, 365);

            var cutoffDate = DateTime.Now.AddDays(-days);

            var recentClubs = await _context.Clubs
                .Where(c => c.IsActive && c.IsPublic && c.CreatedAt >= cutoffDate)
                .OrderByDescending(c => c.CreatedAt)
                .Take(count)
                .Select(c => new RecentClubDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    LogoUrl = c.LogoUrl,
                    City = c.City,
                    State = c.State,
                    MemberCount = c.Members.Count(m => m.IsActive),
                    CreatedAt = c.CreatedAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<RecentClubDto>>
            {
                Success = true,
                Data = recentClubs
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching recent clubs");
            return StatusCode(500, new ApiResponse<List<RecentClubDto>>
            {
                Success = false,
                Message = "An error occurred while fetching recent clubs"
            });
        }
    }

    // GET: /clubs/search - Search for clubs
    [HttpGet("search")]
    public async Task<ActionResult<ApiResponse<PagedResult<ClubDto>>>> SearchClubs([FromQuery] ClubSearchRequest request)
    {
        try
        {
            var query = _context.Clubs
                .Include(c => c.HomeVenue)
                .Where(c => c.IsActive && c.IsPublic)
                .AsQueryable();

            // Apply filters
            if (!string.IsNullOrWhiteSpace(request.Query))
            {
                var searchPattern = $"%{request.Query}%";
                query = query.Where(c =>
                    EF.Functions.Like(c.Name, searchPattern) ||
                    (c.Description != null && EF.Functions.Like(c.Description, searchPattern)));
            }

            if (!string.IsNullOrWhiteSpace(request.Country))
            {
                var countryPattern = $"%{request.Country}%";
                query = query.Where(c => c.Country != null && EF.Functions.Like(c.Country, countryPattern));
            }

            if (!string.IsNullOrWhiteSpace(request.State))
            {
                var statePattern = $"%{request.State}%";
                query = query.Where(c => c.State != null && EF.Functions.Like(c.State, statePattern));
            }

            if (!string.IsNullOrWhiteSpace(request.City))
            {
                var cityPattern = $"%{request.City}%";
                query = query.Where(c => c.City != null && EF.Functions.Like(c.City, cityPattern));
            }

            // Get clubs with member count and home venue data
            var clubsWithCount = await query
                .Select(c => new
                {
                    Club = c,
                    HomeVenue = c.HomeVenue,
                    MemberCount = c.Members.Count(m => m.IsActive)
                })
                .ToListAsync();

            // Apply distance filter if coordinates provided
            List<(Club club, Venue? homeVenue, int memberCount, double? distance)> clubsWithDistance;
            if (request.Latitude.HasValue && request.Longitude.HasValue)
            {
                clubsWithDistance = clubsWithCount
                    .Select(x =>
                    {
                        double? distance = null;
                        // Try home venue GPS first, then fall back to club's own coordinates
                        double? clubLat = null;
                        double? clubLng = null;

                        if (x.HomeVenue != null && !string.IsNullOrEmpty(x.HomeVenue.GpsLat) && !string.IsNullOrEmpty(x.HomeVenue.GpsLng))
                        {
                            if (double.TryParse(x.HomeVenue.GpsLat, out var venueLat) && double.TryParse(x.HomeVenue.GpsLng, out var venueLng))
                            {
                                clubLat = venueLat;
                                clubLng = venueLng;
                            }
                        }

                        // Fall back to club's own coordinates if home venue doesn't have GPS
                        if (!clubLat.HasValue || !clubLng.HasValue)
                        {
                            clubLat = x.Club.Latitude;
                            clubLng = x.Club.Longitude;
                        }

                        if (clubLat.HasValue && clubLng.HasValue)
                            distance = CalculateDistance(request.Latitude.Value, request.Longitude.Value, clubLat.Value, clubLng.Value);
                        return (club: x.Club, homeVenue: x.HomeVenue, memberCount: x.MemberCount, distance);
                    })
                    .Where(x => !request.RadiusMiles.HasValue || x.distance == null || x.distance <= request.RadiusMiles.Value)
                    .OrderBy(x => x.distance ?? double.MaxValue)
                    .ToList();
            }
            else
            {
                clubsWithDistance = clubsWithCount
                    .Select(x => (club: x.Club, homeVenue: x.HomeVenue, memberCount: x.MemberCount, distance: (double?)null))
                    .OrderByDescending(x => x.memberCount)
                    .ToList();
            }

            // Apply bounds filter if provided (for map viewport search)
            if (request.MinLat.HasValue && request.MaxLat.HasValue &&
                request.MinLng.HasValue && request.MaxLng.HasValue)
            {
                clubsWithDistance = clubsWithDistance.Where(x =>
                {
                    // Get coordinates from home venue or club
                    double? lat = null, lng = null;
                    if (x.homeVenue != null &&
                        !string.IsNullOrEmpty(x.homeVenue.GpsLat) &&
                        !string.IsNullOrEmpty(x.homeVenue.GpsLng))
                    {
                        double.TryParse(x.homeVenue.GpsLat, out var venueLat);
                        double.TryParse(x.homeVenue.GpsLng, out var venueLng);
                        lat = venueLat;
                        lng = venueLng;
                    }
                    if (!lat.HasValue || !lng.HasValue)
                    {
                        lat = x.club.Latitude;
                        lng = x.club.Longitude;
                    }

                    // Filter by bounds
                    if (!lat.HasValue || !lng.HasValue) return false;
                    return lat.Value >= request.MinLat.Value &&
                           lat.Value <= request.MaxLat.Value &&
                           lng.Value >= request.MinLng.Value &&
                           lng.Value <= request.MaxLng.Value;
                }).ToList();
            }

            var totalCount = clubsWithDistance.Count;
            var pagedClubs = clubsWithDistance
                .Skip((request.Page - 1) * request.PageSize)
                .Take(request.PageSize)
                .ToList();

            var clubDtos = pagedClubs.Select(x => {
                // Get GPS coordinates from home venue
                double? latitude = null;
                double? longitude = null;
                if (x.homeVenue != null &&
                    !string.IsNullOrEmpty(x.homeVenue.GpsLat) &&
                    !string.IsNullOrEmpty(x.homeVenue.GpsLng))
                {
                    if (double.TryParse(x.homeVenue.GpsLat, out var lat) &&
                        double.TryParse(x.homeVenue.GpsLng, out var lng))
                    {
                        latitude = lat;
                        longitude = lng;
                    }
                }

                return new ClubDto
                {
                    Id = x.club.Id,
                    Name = x.club.Name,
                    Description = x.club.Description,
                    LogoUrl = x.club.LogoUrl,
                    City = x.homeVenue?.City ?? x.club.City,
                    State = x.homeVenue?.State ?? x.club.State,
                    Country = x.homeVenue?.Country ?? x.club.Country,
                    Latitude = latitude,
                    Longitude = longitude,
                    IsPublic = x.club.IsPublic,
                    HasMembershipFee = x.club.HasMembershipFee,
                    MembershipFeeAmount = x.club.MembershipFeeAmount,
                    MemberCount = x.memberCount,
                    Distance = x.distance,
                    CreatedAt = x.club.CreatedAt,
                    HomeVenueId = x.club.HomeVenueId,
                    HomeVenueName = x.homeVenue?.Name
                };
            }).ToList();

            // Geocode clubs without coordinates (no home venue and no stored coords)
            // Do this asynchronously and save to DB for future loads
            _ = GeocodeClubsWithoutCoordsAsync(pagedClubs, clubDtos);

            return Ok(new ApiResponse<PagedResult<ClubDto>>
            {
                Success = true,
                Data = new PagedResult<ClubDto>
                {
                    Items = clubDtos,
                    TotalCount = totalCount,
                    Page = request.Page,
                    PageSize = request.PageSize
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching clubs");
            return StatusCode(500, new ApiResponse<PagedResult<ClubDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // Helper: Geocode clubs without coordinates and save to DB (fire-and-forget)
    private async Task GeocodeClubsWithoutCoordsAsync(
        List<(Club club, Venue? homeVenue, int memberCount, double? distance)> pagedClubs,
        List<ClubDto> clubDtos)
    {
        try
        {
            foreach (var (club, homeVenue, _, _) in pagedClubs)
            {
                // Skip if already has coordinates
                if (club.Latitude.HasValue && club.Longitude.HasValue)
                    continue;

                // Skip if home venue provides coordinates
                if (homeVenue != null && !string.IsNullOrEmpty(homeVenue.GpsLat) && !string.IsNullOrEmpty(homeVenue.GpsLng))
                    continue;

                // Skip if no address info
                if (string.IsNullOrWhiteSpace(club.City) && string.IsNullOrWhiteSpace(club.State))
                    continue;

                // Geocode the address
                var coords = await _geocodingService.GeocodeAddressAsync(club.City, club.State, club.Country);
                if (coords.HasValue)
                {
                    // Update the DTO for immediate response
                    var dto = clubDtos.FirstOrDefault(d => d.Id == club.Id);
                    if (dto != null)
                    {
                        dto.Latitude = coords.Value.Latitude;
                        dto.Longitude = coords.Value.Longitude;
                    }

                    // Save to database for future loads
                    var dbClub = await _context.Clubs.FindAsync(club.Id);
                    if (dbClub != null && !dbClub.Latitude.HasValue && !dbClub.Longitude.HasValue)
                    {
                        dbClub.Latitude = coords.Value.Latitude;
                        dbClub.Longitude = coords.Value.Longitude;
                        dbClub.UpdatedAt = DateTime.Now;
                        await _context.SaveChangesAsync();
                        _logger.LogInformation("Geocoded and saved coordinates for club {ClubId}: {Lat}, {Lng}",
                            club.Id, coords.Value.Latitude, coords.Value.Longitude);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error geocoding clubs in background");
        }
    }

    // GET: /clubs/countries - Get countries with club counts
    [HttpGet("countries")]
    public async Task<ActionResult<ApiResponse<List<LocationCountDto>>>> GetCountries()
    {
        try
        {
            var countries = await _context.Clubs
                .Where(c => c.IsActive && c.IsPublic && !string.IsNullOrEmpty(c.Country))
                .GroupBy(c => c.Country!)
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

    // GET: /clubs/countries/{country}/states - Get states for a country with club counts
    [HttpGet("countries/{country}/states")]
    public async Task<ActionResult<ApiResponse<List<LocationCountDto>>>> GetStatesByCountry(string country)
    {
        try
        {
            var states = await _context.Clubs
                .Where(c => c.IsActive && c.IsPublic && c.Country == country && !string.IsNullOrEmpty(c.State))
                .GroupBy(c => c.State!)
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

    // GET: /clubs/countries/{country}/states/{state}/cities - Get cities for a state with club counts
    [HttpGet("countries/{country}/states/{state}/cities")]
    public async Task<ActionResult<ApiResponse<List<LocationCountDto>>>> GetCitiesByState(string country, string state)
    {
        try
        {
            var cities = await _context.Clubs
                .Where(c => c.IsActive && c.IsPublic && c.Country == country && c.State == state && !string.IsNullOrEmpty(c.City))
                .GroupBy(c => c.City!)
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

    // GET: /clubs/{id} - Get club details
    [HttpGet("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ClubDetailDto>>> GetClub(int id)
    {
        try
        {
            // Require profile completion before accessing club details
            if (!await HasCompletedProfileAsync())
            {
                return StatusCode(403, new ApiResponse<ClubDetailDto>
                {
                    Success = false,
                    Message = "Please complete your profile before viewing club details"
                });
            }

            var club = await _context.Clubs
                .Include(c => c.CreatedBy)
                .Include(c => c.HomeVenue)
                .Include(c => c.Members.Where(m => m.IsActive))
                    .ThenInclude(m => m.User)
                .FirstOrDefaultAsync(c => c.Id == id && c.IsActive);

            if (club == null)
                return NotFound(new ApiResponse<ClubDetailDto> { Success = false, Message = "Club not found" });

            var userId = GetCurrentUserId();
            var membership = userId.HasValue
                ? club.Members.FirstOrDefault(m => m.UserId == userId.Value && m.IsActive)
                : null;

            var hasPendingRequest = userId.HasValue && await _context.ClubJoinRequests
                .AnyAsync(r => r.ClubId == id && r.UserId == userId.Value && r.Status == "Pending");

            // Check if user is site admin (can manage any club)
            var isSiteAdmin = await IsSiteAdminAsync();
            var isAdmin = membership?.Role == "Admin" || isSiteAdmin;
            var isModerator = membership?.Role == "Moderator";

            // Use home venue address if no club address specified
            var venueAddress = club.HomeVenue != null
                ? string.Join(" ", new[] { club.HomeVenue.Addr1, club.HomeVenue.Addr2 }.Where(a => !string.IsNullOrEmpty(a)))
                : null;

            var dto = new ClubDetailDto
            {
                Id = club.Id,
                Name = club.Name,
                Description = club.Description,
                LogoUrl = club.LogoUrl,
                BannerUrl = club.BannerUrl,
                Address = club.Address ?? venueAddress,
                City = club.HomeVenue?.City ?? club.City,
                State = club.HomeVenue?.State ?? club.State,
                Country = club.HomeVenue?.Country ?? club.Country,
                PostalCode = club.HomeVenue?.Zip ?? club.PostalCode,
                Latitude = club.HomeVenue != null && double.TryParse(club.HomeVenue.GpsLat, out var lat) ? lat : club.Latitude,
                Longitude = club.HomeVenue != null && double.TryParse(club.HomeVenue.GpsLng, out var lng) ? lng : club.Longitude,
                Website = club.Website,
                Email = club.Email,
                Phone = club.Phone,
                IsPublic = club.IsPublic,
                RequiresApproval = club.RequiresApproval,
                ChatEnabled = club.ChatEnabled,
                InviteCode = isAdmin ? club.InviteCode : null, // Only show to admins
                HasMembershipFee = club.HasMembershipFee,
                MembershipFeeAmount = club.MembershipFeeAmount,
                MembershipFeePeriod = club.MembershipFeePeriod,
                PaymentInstructions = (membership != null || isAdmin) ? club.PaymentInstructions : null, // Only show to members/admins
                MemberCount = club.Members.Count,
                CreatedAt = club.CreatedAt,
                CreatedByUserId = club.CreatedByUserId,
                CreatedByUserName = club.CreatedBy != null ? Utility.FormatName(club.CreatedBy.LastName, club.CreatedBy.FirstName) : null,
                IsMember = membership != null,
                IsAdmin = isAdmin,
                IsModerator = isModerator,
                HasPendingRequest = hasPendingRequest,
                MyMembershipValidTo = membership?.MembershipValidTo,
                MyTitle = membership?.Title,
                HomeVenueId = club.HomeVenueId,
                HomeVenueName = club.HomeVenue?.Name,
                RecentMembers = club.Members
                    .OrderByDescending(m => m.JoinedAt)
                    .Take(10)
                    .Select(m => new ClubMemberDto
                    {
                        Id = m.Id,
                        UserId = m.UserId,
                        Name = m.User != null ? Utility.FormatName(m.User.LastName, m.User.FirstName) : "",
                        ProfileImageUrl = m.User?.ProfileImageUrl,
                        ExperienceLevel = m.User?.ExperienceLevel,
                        Location = GetUserLocation(m.User),
                        Role = m.Role,
                        Title = m.Title,
                        JoinedAt = m.JoinedAt,
                        MembershipValidTo = isAdmin ? m.MembershipValidTo : null, // Only show to admins
                        MembershipNotes = isAdmin ? m.MembershipNotes : null, // Only show to admins
                        IsMembershipExpired = m.MembershipValidTo.HasValue && m.MembershipValidTo.Value < DateTime.Now
                    }).ToList()
            };

            return Ok(new ApiResponse<ClubDetailDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching club {ClubId}", id);
            return StatusCode(500, new ApiResponse<ClubDetailDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubs - Create a new club
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ClubDetailDto>>> CreateClub([FromBody] CreateClubDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ClubDetailDto> { Success = false, Message = "User not authenticated" });

            // Generate unique invite code
            var inviteCode = GenerateInviteCode();

            var club = new Club
            {
                Name = dto.Name,
                Description = dto.Description,
                LogoUrl = dto.LogoUrl,
                BannerUrl = dto.BannerUrl,
                Address = dto.Address,
                City = dto.City,
                State = dto.State,
                Country = dto.Country,
                PostalCode = dto.PostalCode,
                Latitude = dto.Latitude,
                Longitude = dto.Longitude,
                Website = dto.Website,
                Email = dto.Email,
                Phone = dto.Phone,
                IsPublic = dto.IsPublic,
                RequiresApproval = dto.RequiresApproval,
                HasMembershipFee = dto.HasMembershipFee,
                MembershipFeeAmount = dto.MembershipFeeAmount,
                MembershipFeePeriod = dto.MembershipFeePeriod,
                PaymentInstructions = dto.PaymentInstructions,
                HomeVenueId = dto.HomeVenueId,
                InviteCode = inviteCode,
                CreatedByUserId = userId.Value
            };

            _context.Clubs.Add(club);
            await _context.SaveChangesAsync();

            // Add creator as Admin member
            var membership = new ClubMember
            {
                ClubId = club.Id,
                UserId = userId.Value,
                Role = "Admin"
            };

            _context.ClubMembers.Add(membership);
            await _context.SaveChangesAsync();

            // Grant "Club Founder" award
            await _activityAwardService.GrantCreatedClubAwardAsync(userId.Value, club.Id, club.Name);

            // Return the created club
            return await GetClub(club.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating club");
            return StatusCode(500, new ApiResponse<ClubDetailDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /clubs/{id} - Update club
    [HttpPut("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ClubDetailDto>>> UpdateClub(int id, [FromBody] UpdateClubDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ClubDetailDto> { Success = false, Message = "User not authenticated" });

            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<ClubDetailDto> { Success = false, Message = "Club not found" });

            // Check if user is admin or creator (site admins can manage any club)
            var isSiteAdmin = await IsSiteAdminAsync();
            var isAdmin = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive);
            var isCreator = club.CreatedByUserId == userId.Value;

            if (!isAdmin && !isCreator && !isSiteAdmin)
                return Forbid();

            club.Name = dto.Name;
            club.Description = dto.Description;
            club.LogoUrl = dto.LogoUrl;
            club.BannerUrl = dto.BannerUrl;
            club.Address = dto.Address;
            club.City = dto.City;
            club.State = dto.State;
            club.Country = dto.Country;
            club.PostalCode = dto.PostalCode;
            club.Latitude = dto.Latitude;
            club.Longitude = dto.Longitude;
            club.Website = dto.Website;
            club.Email = dto.Email;
            club.Phone = dto.Phone;
            club.IsPublic = dto.IsPublic;
            club.RequiresApproval = dto.RequiresApproval;
            club.HasMembershipFee = dto.HasMembershipFee;
            club.MembershipFeeAmount = dto.MembershipFeeAmount;
            club.MembershipFeePeriod = dto.MembershipFeePeriod;
            club.PaymentInstructions = dto.PaymentInstructions;
            club.HomeVenueId = dto.HomeVenueId;
            club.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return await GetClub(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating club {ClubId}", id);
            return StatusCode(500, new ApiResponse<ClubDetailDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PATCH: /clubs/{id}/coordinates - Update club coordinates (for geocoding cache)
    // Only updates if coordinates are currently null to avoid overwriting user-set values
    [HttpPatch("{id}/coordinates")]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateClubCoordinates(int id, [FromBody] UpdateClubCoordinatesDto dto)
    {
        try
        {
            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Club not found" });

            // Only update if coordinates are currently null (don't overwrite existing values)
            if (club.Latitude.HasValue && club.Longitude.HasValue)
                return Ok(new ApiResponse<bool> { Success = true, Data = false, Message = "Coordinates already set" });

            club.Latitude = dto.Latitude;
            club.Longitude = dto.Longitude;
            club.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Updated coordinates for club {ClubId}: {Lat}, {Lng}", id, dto.Latitude, dto.Longitude);

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Coordinates updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating coordinates for club {ClubId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /clubs/{id} - Deactivate club (soft delete)
    [HttpDelete("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteClub(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Club not found" });

            // Check if user is admin (site admins can manage any club)
            var isSiteAdmin = await IsSiteAdminAsync();
            var isAdmin = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive);

            if (!isAdmin && !isSiteAdmin)
                return Forbid();

            club.IsActive = false;
            club.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Club deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting club {ClubId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubs/{id}/join - Request to join a club
    [HttpPost("{id}/join")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> JoinClub(int id, [FromBody] JoinClubRequestDto? dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Club not found" });

            // Check if already a member
            var existingMembership = await _context.ClubMembers
                .FirstOrDefaultAsync(m => m.ClubId == id && m.UserId == userId.Value);

            if (existingMembership != null && existingMembership.IsActive)
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Already a member of this club" });

            // Check if has pending request
            var existingRequest = await _context.ClubJoinRequests
                .FirstOrDefaultAsync(r => r.ClubId == id && r.UserId == userId.Value && r.Status == "Pending");

            if (existingRequest != null)
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Already have a pending request" });

            // Check if joining via invite code
            var isInvited = !string.IsNullOrEmpty(dto?.InviteCode) && dto.InviteCode == club.InviteCode;

            // If no approval required or has valid invite code, add as member directly
            if (!club.RequiresApproval || isInvited)
            {
                if (existingMembership != null)
                {
                    existingMembership.IsActive = true;
                    existingMembership.JoinedAt = DateTime.Now;
                }
                else
                {
                    var membership = new ClubMember
                    {
                        ClubId = id,
                        UserId = userId.Value,
                        Role = "Member"
                    };
                    _context.ClubMembers.Add(membership);
                }

                await _context.SaveChangesAsync();

                // Add to club chat if enabled and user allows club messages
                await AddUserToClubChatIfEligible(club, userId.Value);

                // Grant "Club Member" award
                await _activityAwardService.GrantJoinedClubAwardAsync(userId.Value, id, club.Name);

                return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Joined club successfully" });
            }

            // Create join request
            var request = new ClubJoinRequest
            {
                ClubId = id,
                UserId = userId.Value,
                Message = dto?.Message
            };

            _context.ClubJoinRequests.Add(request);
            await _context.SaveChangesAsync();

            // Notify club admins about the new join request
            var requester = await _context.Users.FindAsync(userId.Value);
            var requesterName = requester != null ? Utility.FormatName(requester.LastName, requester.FirstName) : "Someone";

            var clubAdminUsers = await _context.ClubMembers
                .Where(m => m.ClubId == id && m.Role == "Admin" && m.IsActive)
                .Select(m => new { m.UserId, m.User!.Email })
                .ToListAsync();

            var clubAdmins = clubAdminUsers.Select(a => a.UserId).ToList();

            if (clubAdmins.Count > 0)
            {
                await _notificationService.CreateAndSendToUsersAsync(
                    clubAdmins,
                    "ClubJoinRequest",
                    "New Club Join Request",
                    $"{requesterName} wants to join {club.Name}",
                    $"/clubs?id={id}&tab=manage",
                    "ClubJoinRequest",
                    request.Id
                );

                // Send email notification to club admins
                var messageSection = !string.IsNullOrEmpty(dto?.Message)
                    ? $"<p><strong>Message from requester:</strong> {System.Net.WebUtility.HtmlEncode(dto.Message)}</p>"
                    : "";

                var emailBody = $@"
<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
    <h2 style='color: #3b82f6;'>New Club Join Request</h2>
    <p><strong>{System.Net.WebUtility.HtmlEncode(requesterName)}</strong> wants to join <strong>{System.Net.WebUtility.HtmlEncode(club.Name)}</strong>.</p>
    {messageSection}
    <p style='margin-top: 20px;'>
        <a href='https://pickleball.community/clubs?id={id}&tab=manage' style='background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;'>Review Request</a>
    </p>
    <p style='margin-top: 20px; color: #666; font-size: 14px;'>
        You can approve or reject this request from the club management page.
    </p>
</div>";

                foreach (var admin in clubAdminUsers.Where(a => !string.IsNullOrEmpty(a.Email)))
                {
                    try
                    {
                        await _emailService.SendSimpleAsync(
                            admin.UserId,
                            admin.Email!,
                            $"New join request for {club.Name}",
                            emailBody
                        );
                    }
                    catch (Exception emailEx)
                    {
                        // Log but don't fail the request if email fails
                        _logger.LogWarning(emailEx, "Failed to send club join request email to admin {UserId}", admin.UserId);
                    }
                }
            }

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Join request submitted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error joining club {ClubId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubs/{id}/leave - Leave a club
    [HttpPost("{id}/leave")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> LeaveClub(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var membership = await _context.ClubMembers
                .FirstOrDefaultAsync(m => m.ClubId == id && m.UserId == userId.Value && m.IsActive);

            if (membership == null)
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Not a member of this club" });

            // Check if last admin
            if (membership.Role == "Admin")
            {
                var adminCount = await _context.ClubMembers
                    .CountAsync(m => m.ClubId == id && m.Role == "Admin" && m.IsActive);

                if (adminCount == 1)
                    return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot leave club as the only admin. Transfer admin rights first." });
            }

            // Remove from club chat if exists
            var club = await _context.Clubs.FindAsync(id);
            if (club?.ChatConversationId.HasValue == true)
            {
                var participant = await _context.ConversationParticipants
                    .FirstOrDefaultAsync(cp => cp.ConversationId == club.ChatConversationId && cp.UserId == userId.Value);
                if (participant != null)
                {
                    _context.ConversationParticipants.Remove(participant);
                }
            }

            membership.IsActive = false;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Left club successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error leaving club {ClubId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /clubs/{id}/members - Get club members
    [HttpGet("{id}/members")]
    public async Task<ActionResult<ApiResponse<List<ClubMemberDto>>>> GetMembers(int id)
    {
        try
        {
            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<List<ClubMemberDto>> { Success = false, Message = "Club not found" });

            var userId = GetCurrentUserId();
            var isSiteAdmin = await IsSiteAdminAsync();
            var isAdmin = isSiteAdmin || (userId.HasValue && await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive));

            var members = await _context.ClubMembers
                .Include(m => m.User)
                .Where(m => m.ClubId == id && m.IsActive)
                .OrderBy(m => m.Role == "Admin" ? 0 : m.Role == "Moderator" ? 1 : 2)
                .ThenBy(m => m.JoinedAt)
                .Select(m => new ClubMemberDto
                {
                    Id = m.Id,
                    UserId = m.UserId,
                    Name = m.User != null ? (m.User.FirstName + " " + m.User.LastName).Trim() : "",
                    ProfileImageUrl = m.User != null ? m.User.ProfileImageUrl : null,
                    ExperienceLevel = m.User != null ? m.User.ExperienceLevel : null,
                    Location = m.User != null ? GetUserLocationStatic(m.User.City, m.User.State) : null,
                    Role = m.Role,
                    Title = m.Title,
                    JoinedAt = m.JoinedAt,
                    MembershipValidTo = m.MembershipValidTo,
                    MembershipNotes = m.MembershipNotes,
                    IsMembershipExpired = m.MembershipValidTo.HasValue && m.MembershipValidTo.Value < DateTime.Now
                })
                .ToListAsync();

            // Hide admin-only fields for non-admins
            if (!isAdmin)
            {
                foreach (var member in members)
                {
                    member.MembershipNotes = null;
                }
            }

            return Ok(new ApiResponse<List<ClubMemberDto>> { Success = true, Data = members });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching club members {ClubId}", id);
            return StatusCode(500, new ApiResponse<List<ClubMemberDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /clubs/{id}/members/{memberId}/role - Update member role
    [HttpPut("{id}/members/{memberId}/role")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateMemberRole(int id, int memberId, [FromBody] UpdateMemberRoleDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            // Check if user is admin (site admins can manage any club)
            var isSiteAdmin = await IsSiteAdminAsync();
            var isAdmin = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive);

            if (!isAdmin && !isSiteAdmin)
                return Forbid();

            var membership = await _context.ClubMembers.FindAsync(memberId);
            if (membership == null || membership.ClubId != id || !membership.IsActive)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Member not found" });

            // Validate role against database (case-insensitive)
            var validRole = await _context.ClubMemberRoles.AnyAsync(r => r.Name.ToLower() == dto.Role.ToLower() && r.IsActive);
            if (!validRole)
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Invalid role" });

            // Cannot demote the last admin
            if (membership.Role == "Admin" && dto.Role != "Admin")
            {
                var adminCount = await _context.ClubMembers
                    .CountAsync(m => m.ClubId == id && m.Role == "Admin" && m.IsActive);

                if (adminCount == 1)
                    return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot demote the only admin" });
            }

            membership.Role = dto.Role;
            membership.Title = dto.Title;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Role updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating member role");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /clubs/{id}/members/{memberId} - Update member details (admin only)
    [HttpPut("{id}/members/{memberId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ClubMemberDto>>> UpdateMember(int id, int memberId, [FromBody] UpdateMemberDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ClubMemberDto> { Success = false, Message = "User not authenticated" });

            // Check if user is admin (site admins can manage any club)
            var isSiteAdmin = await IsSiteAdminAsync();
            var isAdmin = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive);

            if (!isAdmin && !isSiteAdmin)
                return Forbid();

            var membership = await _context.ClubMembers
                .Include(m => m.User)
                .FirstOrDefaultAsync(m => m.Id == memberId && m.ClubId == id && m.IsActive);

            if (membership == null)
                return NotFound(new ApiResponse<ClubMemberDto> { Success = false, Message = "Member not found" });

            // Update fields if provided
            if (!string.IsNullOrEmpty(dto.Role))
            {
                // Validate role against database (case-insensitive)
                var validRole = await _context.ClubMemberRoles.AnyAsync(r => r.Name.ToLower() == dto.Role.ToLower() && r.IsActive);
                if (!validRole)
                    return BadRequest(new ApiResponse<ClubMemberDto> { Success = false, Message = "Invalid role" });

                // Cannot demote the last admin
                if (membership.Role == "Admin" && dto.Role != "Admin")
                {
                    var adminCount = await _context.ClubMembers
                        .CountAsync(m => m.ClubId == id && m.Role == "Admin" && m.IsActive);

                    if (adminCount == 1)
                        return BadRequest(new ApiResponse<ClubMemberDto> { Success = false, Message = "Cannot demote the only admin" });
                }

                membership.Role = dto.Role;
            }

            if (dto.Title != null)
                membership.Title = dto.Title;

            if (dto.MembershipValidTo.HasValue)
                membership.MembershipValidTo = dto.MembershipValidTo;

            if (dto.MembershipNotes != null)
                membership.MembershipNotes = dto.MembershipNotes;

            await _context.SaveChangesAsync();

            var result = new ClubMemberDto
            {
                Id = membership.Id,
                UserId = membership.UserId,
                Name = membership.User != null ? Utility.FormatName(membership.User.LastName, membership.User.FirstName) : "",
                ProfileImageUrl = membership.User?.ProfileImageUrl,
                ExperienceLevel = membership.User?.ExperienceLevel,
                Location = GetUserLocation(membership.User),
                Role = membership.Role,
                Title = membership.Title,
                JoinedAt = membership.JoinedAt,
                MembershipValidTo = membership.MembershipValidTo,
                MembershipNotes = membership.MembershipNotes,
                IsMembershipExpired = membership.MembershipValidTo.HasValue && membership.MembershipValidTo.Value < DateTime.Now
            };

            return Ok(new ApiResponse<ClubMemberDto> { Success = true, Data = result, Message = "Member updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating member");
            return StatusCode(500, new ApiResponse<ClubMemberDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /clubs/{id}/members/{memberId} - Remove member
    [HttpDelete("{id}/members/{memberId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> RemoveMember(int id, int memberId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            // Check if user is site admin, club admin, or moderator
            var isSiteAdmin = await IsSiteAdminAsync();
            var userMembership = await _context.ClubMembers
                .FirstOrDefaultAsync(m => m.ClubId == id && m.UserId == userId.Value && m.IsActive);

            if (!isSiteAdmin && (userMembership == null || (userMembership.Role != "Admin" && userMembership.Role != "Moderator")))
                return Forbid();

            var membership = await _context.ClubMembers.FindAsync(memberId);
            if (membership == null || membership.ClubId != id || !membership.IsActive)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Member not found" });

            // Cannot remove an admin unless you are an admin or site admin
            if (membership.Role == "Admin" && !isSiteAdmin && userMembership?.Role != "Admin")
                return Forbid();

            // Cannot remove yourself
            if (membership.UserId == userId.Value)
                return BadRequest(new ApiResponse<bool> { Success = false, Message = "Cannot remove yourself. Use leave instead." });

            membership.IsActive = false;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Member removed" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing member");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /clubs/{id}/requests - Get pending join requests
    [HttpGet("{id}/requests")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<ClubJoinRequestDto>>>> GetJoinRequests(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<ClubJoinRequestDto>> { Success = false, Message = "User not authenticated" });

            // Check if user is site admin, club admin, or moderator
            var isSiteAdmin = await IsSiteAdminAsync();
            var isAdminOrMod = isSiteAdmin || await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value &&
                    (m.Role == "Admin" || m.Role == "Moderator") && m.IsActive);

            if (!isAdminOrMod)
                return Forbid();

            var requests = await _context.ClubJoinRequests
                .Include(r => r.User)
                .Include(r => r.Club)
                .Where(r => r.ClubId == id && r.Status == "Pending")
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new ClubJoinRequestDto
                {
                    Id = r.Id,
                    ClubId = r.ClubId,
                    ClubName = r.Club != null ? r.Club.Name : "",
                    UserId = r.UserId,
                    UserName = r.User != null ? (r.User.FirstName + " " + r.User.LastName).Trim() : "",
                    UserProfileImageUrl = r.User != null ? r.User.ProfileImageUrl : null,
                    UserExperienceLevel = r.User != null ? r.User.ExperienceLevel : null,
                    UserLocation = r.User != null ? GetUserLocationStatic(r.User.City, r.User.State) : null,
                    Message = r.Message,
                    Status = r.Status,
                    CreatedAt = r.CreatedAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<ClubJoinRequestDto>> { Success = true, Data = requests });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching join requests");
            return StatusCode(500, new ApiResponse<List<ClubJoinRequestDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubs/{id}/requests/{requestId}/review - Approve or reject join request
    [HttpPost("{id}/requests/{requestId}/review")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> ReviewJoinRequest(int id, int requestId, [FromBody] ReviewJoinRequestDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            // Check if user is site admin, club admin, or moderator
            var isSiteAdmin = await IsSiteAdminAsync();
            var isAdminOrMod = isSiteAdmin || await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value &&
                    (m.Role == "Admin" || m.Role == "Moderator") && m.IsActive);

            if (!isAdminOrMod)
                return Forbid();

            var request = await _context.ClubJoinRequests.FindAsync(requestId);
            if (request == null || request.ClubId != id || request.Status != "Pending")
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Request not found" });

            request.Status = dto.Approve ? "Approved" : "Rejected";
            request.ReviewedByUserId = userId.Value;
            request.ReviewedAt = DateTime.Now;

            if (dto.Approve)
            {
                // Add as member
                var existingMembership = await _context.ClubMembers
                    .FirstOrDefaultAsync(m => m.ClubId == id && m.UserId == request.UserId);

                if (existingMembership != null)
                {
                    existingMembership.IsActive = true;
                    existingMembership.JoinedAt = DateTime.Now;
                }
                else
                {
                    var membership = new ClubMember
                    {
                        ClubId = id,
                        UserId = request.UserId,
                        Role = "Member"
                    };
                    _context.ClubMembers.Add(membership);
                }
            }

            await _context.SaveChangesAsync();

            // Get club name for notification
            var club = await _context.Clubs.FindAsync(id);
            var clubName = club?.Name ?? "the club";

            // Notify user about the decision
            if (dto.Approve)
            {
                await _notificationService.CreateAndSendAsync(
                    request.UserId,
                    "ClubJoinApproved",
                    "Welcome to the Club!",
                    $"Your request to join {clubName} has been approved",
                    $"/clubs?id={id}",
                    "Club",
                    id
                );

                // Grant "Club Member" award
                await _activityAwardService.GrantJoinedClubAwardAsync(request.UserId, id, clubName);
            }
            else
            {
                await _notificationService.CreateAndSendAsync(
                    request.UserId,
                    "ClubJoinRejected",
                    "Club Request Update",
                    $"Your request to join {clubName} was not approved",
                    "/clubs",
                    "Club",
                    id
                );
            }

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = dto.Approve ? "Request approved" : "Request rejected" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reviewing join request");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubs/{id}/notifications - Send notification to all members
    [HttpPost("{id}/notifications")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ClubNotificationDto>>> SendNotification(int id, [FromBody] SendClubNotificationDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ClubNotificationDto> { Success = false, Message = "User not authenticated" });

            // Check if user is site admin, club admin, or moderator
            var isSiteAdmin = await IsSiteAdminAsync();
            var isAdminOrMod = isSiteAdmin || await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value &&
                    (m.Role == "Admin" || m.Role == "Moderator") && m.IsActive);

            if (!isAdminOrMod)
                return Forbid();

            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<ClubNotificationDto> { Success = false, Message = "Club not found" });

            var notification = new ClubNotification
            {
                ClubId = id,
                SentByUserId = userId.Value,
                Title = dto.Title,
                Message = dto.Message
            };

            _context.ClubNotifications.Add(notification);
            await _context.SaveChangesAsync();

            var user = await _context.Users.FindAsync(userId.Value);

            return Ok(new ApiResponse<ClubNotificationDto>
            {
                Success = true,
                Data = new ClubNotificationDto
                {
                    Id = notification.Id,
                    ClubId = notification.ClubId,
                    ClubName = club.Name,
                    SentByUserId = notification.SentByUserId,
                    SentByUserName = user != null ? Utility.FormatName(user.LastName, user.FirstName) : "",
                    Title = notification.Title,
                    Message = notification.Message,
                    SentAt = notification.SentAt
                },
                Message = "Notification sent"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending notification");
            return StatusCode(500, new ApiResponse<ClubNotificationDto> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /clubs/{id}/notifications - Get club notifications
    [HttpGet("{id}/notifications")]
    public async Task<ActionResult<ApiResponse<List<ClubNotificationDto>>>> GetNotifications(int id, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        try
        {
            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<List<ClubNotificationDto>> { Success = false, Message = "Club not found" });

            var notifications = await _context.ClubNotifications
                .Include(n => n.SentBy)
                .Include(n => n.Club)
                .Where(n => n.ClubId == id)
                .OrderByDescending(n => n.SentAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(n => new ClubNotificationDto
                {
                    Id = n.Id,
                    ClubId = n.ClubId,
                    ClubName = n.Club != null ? n.Club.Name : "",
                    SentByUserId = n.SentByUserId,
                    SentByUserName = n.SentBy != null ? (n.SentBy.FirstName + " " + n.SentBy.LastName).Trim() : "",
                    Title = n.Title,
                    Message = n.Message,
                    SentAt = n.SentAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<ClubNotificationDto>> { Success = true, Data = notifications });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching notifications");
            return StatusCode(500, new ApiResponse<List<ClubNotificationDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /clubs/my - Get clubs I belong to or manage
    [HttpGet("my")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<MyClubsDto>>> GetMyClubs()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<MyClubsDto> { Success = false, Message = "User not authenticated" });

            var memberships = await _context.ClubMembers
                .Include(m => m.Club)
                .Where(m => m.UserId == userId.Value && m.IsActive && m.Club != null && m.Club.IsActive)
                .ToListAsync();

            var clubsIManage = memberships
                .Where(m => m.Role == "Admin" || m.Role == "Moderator")
                .Select(m => new ClubDto
                {
                    Id = m.Club!.Id,
                    Name = m.Club.Name,
                    Description = m.Club.Description,
                    LogoUrl = m.Club.LogoUrl,
                    City = m.Club.City,
                    State = m.Club.State,
                    Country = m.Club.Country,
                    IsPublic = m.Club.IsPublic,
                    HasMembershipFee = m.Club.HasMembershipFee,
                    MembershipFeeAmount = m.Club.MembershipFeeAmount,
                    MemberCount = _context.ClubMembers.Count(cm => cm.ClubId == m.ClubId && cm.IsActive),
                    CreatedAt = m.Club.CreatedAt
                })
                .ToList();

            var clubsIBelong = memberships
                .Where(m => m.Role == "Member")
                .Select(m => new ClubDto
                {
                    Id = m.Club!.Id,
                    Name = m.Club.Name,
                    Description = m.Club.Description,
                    LogoUrl = m.Club.LogoUrl,
                    City = m.Club.City,
                    State = m.Club.State,
                    Country = m.Club.Country,
                    IsPublic = m.Club.IsPublic,
                    HasMembershipFee = m.Club.HasMembershipFee,
                    MembershipFeeAmount = m.Club.MembershipFeeAmount,
                    MemberCount = _context.ClubMembers.Count(cm => cm.ClubId == m.ClubId && cm.IsActive),
                    CreatedAt = m.Club.CreatedAt
                })
                .ToList();

            var pendingRequests = await _context.ClubJoinRequests
                .Include(r => r.Club)
                .Where(r => r.UserId == userId.Value && r.Status == "Pending" && r.Club != null && r.Club.IsActive)
                .Select(r => new ClubJoinRequestDto
                {
                    Id = r.Id,
                    ClubId = r.ClubId,
                    ClubName = r.Club != null ? r.Club.Name : "",
                    ClubLogoUrl = r.Club != null ? r.Club.LogoUrl : null,
                    Status = r.Status,
                    Message = r.Message,
                    CreatedAt = r.CreatedAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<MyClubsDto>
            {
                Success = true,
                Data = new MyClubsDto
                {
                    ClubsIManage = clubsIManage,
                    ClubsIBelong = clubsIBelong,
                    PendingRequests = pendingRequests
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching my clubs");
            return StatusCode(500, new ApiResponse<MyClubsDto> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /clubs/{id}/invite-link - Get invite link for club
    [HttpGet("{id}/invite-link")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<string>>> GetInviteLink(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<string> { Success = false, Message = "User not authenticated" });

            // Check if user is admin (site admins can manage any club)
            var isSiteAdmin = await IsSiteAdminAsync();
            var isAdmin = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive);

            if (!isAdmin && !isSiteAdmin)
                return Forbid();

            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<string> { Success = false, Message = "Club not found" });

            // Regenerate invite code if doesn't exist
            if (string.IsNullOrEmpty(club.InviteCode))
            {
                club.InviteCode = GenerateInviteCode();
                await _context.SaveChangesAsync();
            }

            return Ok(new ApiResponse<string> { Success = true, Data = club.InviteCode });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting invite link");
            return StatusCode(500, new ApiResponse<string> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubs/{id}/regenerate-invite - Regenerate invite code
    [HttpPost("{id}/regenerate-invite")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<string>>> RegenerateInviteCode(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<string> { Success = false, Message = "User not authenticated" });

            // Check if user is site admin or club admin
            var isSiteAdmin = await IsSiteAdminAsync();
            var isAdmin = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive);

            if (!isAdmin && !isSiteAdmin)
                return Forbid();

            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<string> { Success = false, Message = "Club not found" });

            club.InviteCode = GenerateInviteCode();
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<string> { Success = true, Data = club.InviteCode, Message = "Invite code regenerated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error regenerating invite code");
            return StatusCode(500, new ApiResponse<string> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /clubs/join/{inviteCode} - Get club info by invite code
    [HttpGet("join/{inviteCode}")]
    public async Task<ActionResult<ApiResponse<ClubDto>>> GetClubByInviteCode(string inviteCode)
    {
        try
        {
            var club = await _context.Clubs
                .FirstOrDefaultAsync(c => c.InviteCode == inviteCode && c.IsActive);

            if (club == null)
                return NotFound(new ApiResponse<ClubDto> { Success = false, Message = "Invalid invite code" });

            var memberCount = await _context.ClubMembers
                .CountAsync(m => m.ClubId == club.Id && m.IsActive);

            var dto = new ClubDto
            {
                Id = club.Id,
                Name = club.Name,
                Description = club.Description,
                LogoUrl = club.LogoUrl,
                City = club.City,
                State = club.State,
                Country = club.Country,
                IsPublic = club.IsPublic,
                HasMembershipFee = club.HasMembershipFee,
                MembershipFeeAmount = club.MembershipFeeAmount,
                MemberCount = memberCount,
                CreatedAt = club.CreatedAt
            };

            return Ok(new ApiResponse<ClubDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting club by invite code");
            return StatusCode(500, new ApiResponse<ClubDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubs/{id}/chat/enable - Enable club chat (Admin only)
    [HttpPost("{id}/chat/enable")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> EnableClubChat(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Club not found" });

            // Check if user is site admin or club admin
            var isSiteAdmin = await IsSiteAdminAsync();
            var isAdmin = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive);

            if (!isAdmin && !isSiteAdmin)
                return Forbid();

            if (club.ChatEnabled && club.ChatConversationId.HasValue)
                return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Club chat is already enabled" });

            // Create club conversation if it doesn't exist
            if (!club.ChatConversationId.HasValue)
            {
                var conversation = new Conversation
                {
                    Type = "Club",
                    Name = $"{club.Name} Chat",
                    ClubId = id
                };
                _context.Conversations.Add(conversation);
                await _context.SaveChangesAsync();

                club.ChatConversationId = conversation.Id;

                // Add all existing members who allow club messages to the conversation
                var members = await _context.ClubMembers
                    .Include(m => m.User)
                    .Where(m => m.ClubId == id && m.IsActive && m.User!.AllowClubMessages)
                    .ToListAsync();

                foreach (var member in members)
                {
                    _context.ConversationParticipants.Add(new ConversationParticipant
                    {
                        ConversationId = conversation.Id,
                        UserId = member.UserId,
                        Role = member.Role == "Admin" ? "Admin" : "Member"
                    });
                }
            }

            club.ChatEnabled = true;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Club chat enabled" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error enabling club chat for {ClubId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubs/{id}/chat/disable - Disable club chat (Admin only)
    [HttpPost("{id}/chat/disable")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DisableClubChat(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Club not found" });

            // Check if user is site admin or club admin
            var isSiteAdmin = await IsSiteAdminAsync();
            var isAdmin = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive);

            if (!isAdmin && !isSiteAdmin)
                return Forbid();

            club.ChatEnabled = false;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Club chat disabled" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error disabling club chat for {ClubId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /clubs/{id}/chat - Get club chat conversation ID
    [HttpGet("{id}/chat")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<int?>>> GetClubChat(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<int?> { Success = false, Message = "User not authenticated" });

            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<int?> { Success = false, Message = "Club not found" });

            // Check if user is a member
            var isMember = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.IsActive);

            if (!isMember)
                return Forbid();

            if (!club.ChatEnabled || !club.ChatConversationId.HasValue)
                return Ok(new ApiResponse<int?> { Success = true, Data = null, Message = "Club chat is not enabled" });

            return Ok(new ApiResponse<int?> { Success = true, Data = club.ChatConversationId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting club chat for {ClubId}", id);
            return StatusCode(500, new ApiResponse<int?> { Success = false, Message = "An error occurred" });
        }
    }

    // ===== CLUB DOCUMENTS =====

    // GET: /clubs/{id}/documents - Get club documents
    [HttpGet("{id}/documents")]
    public async Task<ActionResult<ApiResponse<List<ClubDocumentDto>>>> GetDocuments(int id)
    {
        try
        {
            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<List<ClubDocumentDto>> { Success = false, Message = "Club not found" });

            var userId = GetCurrentUserId();

            // Determine user's access level
            string accessLevel = "Public";
            if (userId.HasValue)
            {
                var membership = await _context.ClubMembers
                    .FirstOrDefaultAsync(m => m.ClubId == id && m.UserId == userId.Value && m.IsActive);

                if (membership != null)
                {
                    accessLevel = membership.Role == "Admin" ? "Admin" : "Member";
                }
            }

            // Build visibility filter based on access level using explicit OR conditions
            // (Avoids EF Core OPENJSON issue with list.Contains)
            bool canViewMember = accessLevel == "Member" || accessLevel == "Admin";
            bool canViewAdmin = accessLevel == "Admin";

            var documents = await _context.ClubDocuments
                .Include(d => d.UploadedBy)
                .Where(d => d.ClubId == id && d.IsActive &&
                    (d.Visibility == "Public" ||
                     (canViewMember && d.Visibility == "Member") ||
                     (canViewAdmin && d.Visibility == "Admin")))
                .OrderBy(d => d.SortOrder)
                .ThenByDescending(d => d.CreatedAt)
                .Select(d => new ClubDocumentDto
                {
                    Id = d.Id,
                    ClubId = d.ClubId,
                    Title = d.Title,
                    Description = d.Description,
                    FileUrl = d.FileUrl,
                    FileName = d.FileName,
                    FileType = d.FileType,
                    MimeType = d.MimeType,
                    FileSizeBytes = d.FileSizeBytes,
                    Visibility = d.Visibility,
                    SortOrder = d.SortOrder,
                    UploadedByUserId = d.UploadedByUserId,
                    UploadedByUserName = d.UploadedBy != null ? (d.UploadedBy.FirstName + " " + d.UploadedBy.LastName).Trim() : "",
                    CreatedAt = d.CreatedAt,
                    UpdatedAt = d.UpdatedAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<ClubDocumentDto>> { Success = true, Data = documents });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching club documents for {ClubId}", id);
            return StatusCode(500, new ApiResponse<List<ClubDocumentDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /clubs/{id}/documents - Upload a new document (Admin only)
    [HttpPost("{id}/documents")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ClubDocumentDto>>> CreateDocument(int id, [FromBody] CreateClubDocumentDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ClubDocumentDto> { Success = false, Message = "User not authenticated" });

            var club = await _context.Clubs.FindAsync(id);
            if (club == null || !club.IsActive)
                return NotFound(new ApiResponse<ClubDocumentDto> { Success = false, Message = "Club not found" });

            // Check if user is site admin or club admin
            var isSiteAdmin = await IsSiteAdminAsync();
            var isAdmin = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive);

            if (!isAdmin && !isSiteAdmin)
                return Forbid();

            // Validate visibility
            var validVisibilities = new[] { "Public", "Member", "Admin" };
            if (!validVisibilities.Contains(dto.Visibility))
                return BadRequest(new ApiResponse<ClubDocumentDto> { Success = false, Message = "Invalid visibility value" });

            // Determine file type from mime type or extension
            var fileType = DetermineFileType(dto.MimeType, dto.FileName);

            var document = new ClubDocument
            {
                ClubId = id,
                Title = dto.Title,
                Description = dto.Description,
                FileUrl = dto.FileUrl,
                FileName = dto.FileName,
                FileType = fileType,
                MimeType = dto.MimeType,
                FileSizeBytes = dto.FileSizeBytes,
                Visibility = dto.Visibility,
                SortOrder = dto.SortOrder,
                UploadedByUserId = userId.Value
            };

            _context.ClubDocuments.Add(document);
            await _context.SaveChangesAsync();

            var user = await _context.Users.FindAsync(userId.Value);

            return Ok(new ApiResponse<ClubDocumentDto>
            {
                Success = true,
                Data = new ClubDocumentDto
                {
                    Id = document.Id,
                    ClubId = document.ClubId,
                    Title = document.Title,
                    Description = document.Description,
                    FileUrl = document.FileUrl,
                    FileName = document.FileName,
                    FileType = document.FileType,
                    MimeType = document.MimeType,
                    FileSizeBytes = document.FileSizeBytes,
                    Visibility = document.Visibility,
                    SortOrder = document.SortOrder,
                    UploadedByUserId = document.UploadedByUserId,
                    UploadedByUserName = user != null ? Utility.FormatName(user.LastName, user.FirstName) : "",
                    CreatedAt = document.CreatedAt,
                    UpdatedAt = document.UpdatedAt
                },
                Message = "Document uploaded successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating club document for {ClubId}", id);
            return StatusCode(500, new ApiResponse<ClubDocumentDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /clubs/{id}/documents/{documentId} - Update document (Admin only)
    [HttpPut("{id}/documents/{documentId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ClubDocumentDto>>> UpdateDocument(int id, int documentId, [FromBody] UpdateClubDocumentDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<ClubDocumentDto> { Success = false, Message = "User not authenticated" });

            // Check if user is site admin or club admin
            var isSiteAdmin = await IsSiteAdminAsync();
            var isAdmin = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive);

            if (!isAdmin && !isSiteAdmin)
                return Forbid();

            var document = await _context.ClubDocuments
                .Include(d => d.UploadedBy)
                .FirstOrDefaultAsync(d => d.Id == documentId && d.ClubId == id && d.IsActive);

            if (document == null)
                return NotFound(new ApiResponse<ClubDocumentDto> { Success = false, Message = "Document not found" });

            // Validate visibility if provided
            if (!string.IsNullOrEmpty(dto.Visibility))
            {
                var validVisibilities = new[] { "Public", "Member", "Admin" };
                if (!validVisibilities.Contains(dto.Visibility))
                    return BadRequest(new ApiResponse<ClubDocumentDto> { Success = false, Message = "Invalid visibility value" });
                document.Visibility = dto.Visibility;
            }

            if (!string.IsNullOrEmpty(dto.Title))
                document.Title = dto.Title;

            if (dto.Description != null)
                document.Description = dto.Description;

            if (dto.SortOrder.HasValue)
                document.SortOrder = dto.SortOrder.Value;

            document.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<ClubDocumentDto>
            {
                Success = true,
                Data = new ClubDocumentDto
                {
                    Id = document.Id,
                    ClubId = document.ClubId,
                    Title = document.Title,
                    Description = document.Description,
                    FileUrl = document.FileUrl,
                    FileName = document.FileName,
                    FileType = document.FileType,
                    MimeType = document.MimeType,
                    FileSizeBytes = document.FileSizeBytes,
                    Visibility = document.Visibility,
                    SortOrder = document.SortOrder,
                    UploadedByUserId = document.UploadedByUserId,
                    UploadedByUserName = document.UploadedBy != null ? Utility.FormatName(document.UploadedBy.LastName, document.UploadedBy.FirstName) : "",
                    CreatedAt = document.CreatedAt,
                    UpdatedAt = document.UpdatedAt
                },
                Message = "Document updated successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating club document {DocumentId}", documentId);
            return StatusCode(500, new ApiResponse<ClubDocumentDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /clubs/{id}/documents/{documentId} - Delete document (Admin only)
    [HttpDelete("{id}/documents/{documentId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteDocument(int id, int documentId)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            // Check if user is site admin or club admin
            var isSiteAdmin = await IsSiteAdminAsync();
            var isAdmin = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive);

            if (!isAdmin && !isSiteAdmin)
                return Forbid();

            var document = await _context.ClubDocuments
                .FirstOrDefaultAsync(d => d.Id == documentId && d.ClubId == id && d.IsActive);

            if (document == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Document not found" });

            document.IsActive = false;
            document.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Document deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting club document {DocumentId}", documentId);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /clubs/{id}/documents/reorder - Reorder documents (Admin only)
    [HttpPut("{id}/documents/reorder")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> ReorderDocuments(int id, [FromBody] List<DocumentOrderDto> orders)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<bool> { Success = false, Message = "User not authenticated" });

            // Check if user is site admin or club admin
            var isSiteAdmin = await IsSiteAdminAsync();
            var isAdmin = await _context.ClubMembers
                .AnyAsync(m => m.ClubId == id && m.UserId == userId.Value && m.Role == "Admin" && m.IsActive);

            if (!isAdmin && !isSiteAdmin)
                return Forbid();

            // Load all active documents for this club and filter in-memory to avoid OPENJSON issues
            var documentIdsSet = orders.Select(o => o.DocumentId).ToHashSet();
            var allDocs = await _context.ClubDocuments
                .Where(d => d.ClubId == id && d.IsActive)
                .ToListAsync();
            var documents = allDocs.Where(d => documentIdsSet.Contains(d.Id)).ToList();

            foreach (var order in orders)
            {
                var doc = documents.FirstOrDefault(d => d.Id == order.DocumentId);
                if (doc != null)
                {
                    doc.SortOrder = order.SortOrder;
                    doc.UpdatedAt = DateTime.Now;
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Documents reordered" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reordering club documents for {ClubId}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // Helper methods
    private static string GenerateInviteCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();
        return new string(Enumerable.Repeat(chars, 8).Select(s => s[random.Next(s.Length)]).ToArray());
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

    private static string? GetUserLocation(User? user)
    {
        if (user == null) return null;
        return GetUserLocationStatic(user.City, user.State);
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

    private async Task AddUserToClubChatIfEligible(Club club, int userId)
    {
        // Check if club has chat enabled
        if (!club.ChatEnabled || !club.ChatConversationId.HasValue)
            return;

        // Check if user allows club messages
        var user = await _context.Users.FindAsync(userId);
        if (user == null || !user.AllowClubMessages)
            return;

        // Check if already a participant
        var existingParticipant = await _context.ConversationParticipants
            .AnyAsync(cp => cp.ConversationId == club.ChatConversationId && cp.UserId == userId);

        if (existingParticipant)
            return;

        // Add to conversation
        _context.ConversationParticipants.Add(new ConversationParticipant
        {
            ConversationId = club.ChatConversationId.Value,
            UserId = userId,
            Role = "Member"
        });

        await _context.SaveChangesAsync();
    }

    private static string DetermineFileType(string? mimeType, string? fileName)
    {
        // Check by MIME type first
        if (!string.IsNullOrEmpty(mimeType))
        {
            if (mimeType.StartsWith("image/"))
                return "Image";
            if (mimeType.StartsWith("video/"))
                return "Video";
            if (mimeType == "application/pdf")
                return "PDF";
            if (mimeType.Contains("word") || mimeType.Contains("document") || mimeType.Contains("msword"))
                return "Document";
            if (mimeType.Contains("sheet") || mimeType.Contains("excel"))
                return "Spreadsheet";
            if (mimeType.Contains("presentation") || mimeType.Contains("powerpoint"))
                return "Presentation";
        }

        // Fall back to file extension
        if (!string.IsNullOrEmpty(fileName))
        {
            var ext = Path.GetExtension(fileName).ToLowerInvariant();
            return ext switch
            {
                ".jpg" or ".jpeg" or ".png" or ".gif" or ".webp" or ".svg" or ".bmp" => "Image",
                ".mp4" or ".avi" or ".mov" or ".wmv" or ".webm" or ".mkv" => "Video",
                ".pdf" => "PDF",
                ".doc" or ".docx" or ".odt" or ".rtf" => "Document",
                ".xls" or ".xlsx" or ".ods" or ".csv" => "Spreadsheet",
                ".ppt" or ".pptx" or ".odp" => "Presentation",
                _ => "Other"
            };
        }

        return "Other";
    }
}
