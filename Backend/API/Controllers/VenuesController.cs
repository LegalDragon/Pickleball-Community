using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using System.Data;
using System.Security.Claims;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class VenuesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<VenuesController> _logger;

    public VenuesController(ApplicationDbContext context, ILogger<VenuesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    // GET: /venues/search - Search for venues using stored procedure
    [HttpGet("search")]
    public async Task<ActionResult<ApiResponse<PagedResult<VenueDto>>>> SearchVenues([FromQuery] VenueSearchRequest request)
    {
        try
        {
            var venues = new List<VenueDto>();
            int totalCount = 0;

            var connection = _context.Database.GetDbConnection();
            await connection.OpenAsync();

            try
            {
                using var command = connection.CreateCommand();
                command.CommandText = "sp_SearchVenues";
                command.CommandType = CommandType.StoredProcedure;

                // Add parameters
                command.Parameters.Add(new SqlParameter("@Query", SqlDbType.NVarChar, 100) { Value = (object?)request.Query ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@Country", SqlDbType.NVarChar, 20) { Value = (object?)request.Country ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@State", SqlDbType.NVarChar, 50) { Value = (object?)request.State ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@City", SqlDbType.NVarChar, 50) { Value = (object?)request.City ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@HasLights", SqlDbType.Bit) { Value = request.HasLights.HasValue && request.HasLights.Value ? true : DBNull.Value });
                command.Parameters.Add(new SqlParameter("@IsIndoor", SqlDbType.Bit) { Value = request.IsIndoor.HasValue && request.IsIndoor.Value ? true : DBNull.Value });
                command.Parameters.Add(new SqlParameter("@UserLat", SqlDbType.Float) { Value = (object?)request.Latitude ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@UserLng", SqlDbType.Float) { Value = (object?)request.Longitude ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@RadiusMiles", SqlDbType.Float) { Value = (object?)request.RadiusMiles ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@VenueTypeId", SqlDbType.Int) { Value = (object?)request.VenueTypeId ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@SortBy", SqlDbType.NVarChar, 20) { Value = (object?)request.SortBy ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@SortOrder", SqlDbType.NVarChar, 4) { Value = (object?)request.SortOrder ?? "asc" });
                command.Parameters.Add(new SqlParameter("@Page", SqlDbType.Int) { Value = request.Page });
                command.Parameters.Add(new SqlParameter("@PageSize", SqlDbType.Int) { Value = request.PageSize });

                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var venue = new VenueDto
                    {
                        Id = reader.GetInt32(reader.GetOrdinal("VenueId")),
                        Name = reader.IsDBNull(reader.GetOrdinal("Name")) ? null : reader.GetString(reader.GetOrdinal("Name")),
                        Address = reader.IsDBNull(reader.GetOrdinal("Address")) ? null : reader.GetString(reader.GetOrdinal("Address")),
                        City = reader.IsDBNull(reader.GetOrdinal("City")) ? null : reader.GetString(reader.GetOrdinal("City")),
                        County = reader.IsDBNull(reader.GetOrdinal("County")) ? null : reader.GetString(reader.GetOrdinal("County")),
                        State = reader.IsDBNull(reader.GetOrdinal("State")) ? null : reader.GetString(reader.GetOrdinal("State")),
                        Zip = reader.IsDBNull(reader.GetOrdinal("Zip")) ? null : reader.GetString(reader.GetOrdinal("Zip")),
                        Country = reader.IsDBNull(reader.GetOrdinal("Country")) ? null : reader.GetString(reader.GetOrdinal("Country")),
                        Phone = reader.IsDBNull(reader.GetOrdinal("Phone")) ? null : reader.GetString(reader.GetOrdinal("Phone")),
                        Website = reader.IsDBNull(reader.GetOrdinal("Website")) ? null : reader.GetString(reader.GetOrdinal("Website")),
                        Email = reader.IsDBNull(reader.GetOrdinal("Email")) ? null : reader.GetString(reader.GetOrdinal("Email")),
                        IndoorNum = reader.IsDBNull(reader.GetOrdinal("IndoorNum")) ? null : reader.GetInt32(reader.GetOrdinal("IndoorNum")),
                        OutdoorNum = reader.IsDBNull(reader.GetOrdinal("OutdoorNum")) ? null : reader.GetInt32(reader.GetOrdinal("OutdoorNum")),
                        CoveredNum = reader.IsDBNull(reader.GetOrdinal("CoveredNum")) ? null : reader.GetInt32(reader.GetOrdinal("CoveredNum")),
                        HasLights = reader.GetInt32(reader.GetOrdinal("HasLights")) == 1,
                        Latitude = reader.IsDBNull(reader.GetOrdinal("Latitude")) ? null : reader.GetDouble(reader.GetOrdinal("Latitude")),
                        Longitude = reader.IsDBNull(reader.GetOrdinal("Longitude")) ? null : reader.GetDouble(reader.GetOrdinal("Longitude")),
                        Distance = reader.IsDBNull(reader.GetOrdinal("Distance")) ? null : reader.GetDouble(reader.GetOrdinal("Distance")),
                        AggregatedInfo = new VenueAggregatedInfoDto
                        {
                            ConfirmationCount = reader.GetInt32(reader.GetOrdinal("ConfirmationCount")),
                            AverageRating = reader.IsDBNull(reader.GetOrdinal("AverageRating")) ? null : reader.GetDouble(reader.GetOrdinal("AverageRating")),
                            NotACourtCount = reader.IsDBNull(reader.GetOrdinal("NotACourtCount")) ? 0 : reader.GetInt32(reader.GetOrdinal("NotACourtCount")),
                            MostSuggestedName = reader.IsDBNull(reader.GetOrdinal("MostSuggestedName")) ? null : reader.GetString(reader.GetOrdinal("MostSuggestedName"))
                        }
                    };

                    totalCount = reader.GetInt32(reader.GetOrdinal("TotalCount"));
                    venues.Add(venue);
                }
            }
            finally
            {
                await connection.CloseAsync();
            }

            return Ok(new ApiResponse<PagedResult<VenueDto>>
            {
                Success = true,
                Data = new PagedResult<VenueDto>
                {
                    Items = venues,
                    TotalCount = totalCount,
                    Page = request.Page,
                    PageSize = request.PageSize
                }
            });
        }
        catch (SqlException ex) when (ex.Message.Contains("Could not find stored procedure"))
        {
            // Stored procedure not created yet - fall back to LINQ
            _logger.LogWarning("Stored procedure sp_SearchVenues not found, falling back to LINQ query");
            return await SearchVenuesLinq(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching venues");
            return StatusCode(500, new ApiResponse<PagedResult<VenueDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // Fallback LINQ-based search (used when stored procedure doesn't exist)
    private async Task<ActionResult<ApiResponse<PagedResult<VenueDto>>>> SearchVenuesLinq(VenueSearchRequest request)
    {
        var query = _context.Venues.AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Country))
        {
            var searchCountry = request.Country == "Unknown" ? null : request.Country;
            query = query.Where(v => searchCountry == null ? v.Country == null : v.Country == searchCountry);
        }

        if (!string.IsNullOrWhiteSpace(request.State))
        {
            var searchState = request.State == "Unknown" ? null : request.State;
            query = query.Where(v => searchState == null ? v.State == null : v.State == searchState);
        }

        if (!string.IsNullOrWhiteSpace(request.City))
        {
            var cityPattern = $"%{request.City}%";
            query = query.Where(v => v.City != null && EF.Functions.Like(v.City, cityPattern));
        }

        if (request.HasLights.HasValue && request.HasLights.Value)
            query = query.Where(v => v.Lights == "Y");

        if (request.IsIndoor.HasValue && request.IsIndoor.Value)
            query = query.Where(v => v.IndoorNum > 0);

        if (request.VenueTypeId.HasValue)
            query = query.Where(v => v.VenueTypeId == request.VenueTypeId.Value);

        if (!string.IsNullOrWhiteSpace(request.Query))
        {
            var searchPattern = $"%{request.Query}%";
            query = query.Where(v =>
                (v.Name != null && EF.Functions.Like(v.Name, searchPattern)) ||
                (v.City != null && EF.Functions.Like(v.City, searchPattern)) ||
                (v.Addr1 != null && EF.Functions.Like(v.Addr1, searchPattern)));
        }

        var venues = await query.ToListAsync();

        List<(Venue venue, double? distance)> venuesWithDistance;
        if (request.Latitude.HasValue && request.Longitude.HasValue)
        {
            venuesWithDistance = venues
                .Select(v =>
                {
                    double? distance = null;
                    if (double.TryParse(v.GpsLat, out var lat) && double.TryParse(v.GpsLng, out var lng))
                        distance = CalculateDistance(request.Latitude.Value, request.Longitude.Value, lat, lng);
                    return (venue: v, distance);
                })
                .Where(x => !request.RadiusMiles.HasValue || x.distance == null || x.distance <= request.RadiusMiles.Value)
                .OrderBy(x => x.distance ?? double.MaxValue)
                .ToList();
        }
        else
        {
            venuesWithDistance = venues.Select(v => (venue: v, distance: (double?)null)).ToList();
        }

        var totalCount = venuesWithDistance.Count;
        var pagedVenues = venuesWithDistance
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToList();

        var venueDtos = pagedVenues.Select(x => new VenueDto
        {
            Id = x.venue.VenueId,
            Name = x.venue.Name,
            Address = string.Join(" ", new[] { x.venue.Addr1, x.venue.Addr2 }.Where(a => !string.IsNullOrEmpty(a))),
            City = x.venue.City,
            County = x.venue.County,
            State = x.venue.State,
            Zip = x.venue.Zip,
            Country = x.venue.Country,
            Phone = x.venue.Phone,
            Website = x.venue.Website,
            Email = x.venue.Email,
            IndoorNum = x.venue.IndoorNum,
            OutdoorNum = x.venue.OutdoorNum,
            CoveredNum = x.venue.CoveredNum,
            HasLights = x.venue.Lights == "Y",
            Latitude = double.TryParse(x.venue.GpsLat, out var lat) ? lat : null,
            Longitude = double.TryParse(x.venue.GpsLng, out var lng) ? lng : null,
            Distance = x.distance,
            AggregatedInfo = new VenueAggregatedInfoDto { ConfirmationCount = 0 }
        }).ToList();

        return Ok(new ApiResponse<PagedResult<VenueDto>>
        {
            Success = true,
            Data = new PagedResult<VenueDto>
            {
                Items = venueDtos,
                TotalCount = totalCount,
                Page = request.Page,
                PageSize = request.PageSize
            }
        });
    }

    // GET: /venues/{id} - Get venue details using stored procedure
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<VenueDetailDto>>> GetVenue(int id, [FromQuery] double? userLat, [FromQuery] double? userLng)
    {
        try
        {
            VenueDetailDto? dto = null;
            var recentConfirmations = new List<VenueConfirmationDto>();
            VenueAggregatedInfoDto aggregatedInfo = new() { ConfirmationCount = 0 };

            var connection = _context.Database.GetDbConnection();
            await connection.OpenAsync();

            try
            {
                using var command = connection.CreateCommand();
                command.CommandText = "sp_GetVenueDetail";
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add(new SqlParameter("@VenueId", SqlDbType.Int) { Value = id });
                command.Parameters.Add(new SqlParameter("@UserLat", SqlDbType.Float) { Value = (object?)userLat ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@UserLng", SqlDbType.Float) { Value = (object?)userLng ?? DBNull.Value });

                using var reader = await command.ExecuteReaderAsync();

                // First result set: Venue basic info
                if (await reader.ReadAsync())
                {
                    dto = new VenueDetailDto
                    {
                        Id = reader.GetInt32(reader.GetOrdinal("VenueId")),
                        Name = reader.IsDBNull(reader.GetOrdinal("Name")) ? null : reader.GetString(reader.GetOrdinal("Name")),
                        Address = reader.IsDBNull(reader.GetOrdinal("Address")) ? null : reader.GetString(reader.GetOrdinal("Address")),
                        City = reader.IsDBNull(reader.GetOrdinal("City")) ? null : reader.GetString(reader.GetOrdinal("City")),
                        County = reader.IsDBNull(reader.GetOrdinal("County")) ? null : reader.GetString(reader.GetOrdinal("County")),
                        State = reader.IsDBNull(reader.GetOrdinal("State")) ? null : reader.GetString(reader.GetOrdinal("State")),
                        Zip = reader.IsDBNull(reader.GetOrdinal("Zip")) ? null : reader.GetString(reader.GetOrdinal("Zip")),
                        Country = reader.IsDBNull(reader.GetOrdinal("Country")) ? null : reader.GetString(reader.GetOrdinal("Country")),
                        Phone = reader.IsDBNull(reader.GetOrdinal("Phone")) ? null : reader.GetString(reader.GetOrdinal("Phone")),
                        Website = reader.IsDBNull(reader.GetOrdinal("Website")) ? null : reader.GetString(reader.GetOrdinal("Website")),
                        Email = reader.IsDBNull(reader.GetOrdinal("Email")) ? null : reader.GetString(reader.GetOrdinal("Email")),
                        IndoorNum = reader.IsDBNull(reader.GetOrdinal("IndoorNum")) ? null : reader.GetInt32(reader.GetOrdinal("IndoorNum")),
                        OutdoorNum = reader.IsDBNull(reader.GetOrdinal("OutdoorNum")) ? null : reader.GetInt32(reader.GetOrdinal("OutdoorNum")),
                        CoveredNum = reader.IsDBNull(reader.GetOrdinal("CoveredNum")) ? null : reader.GetInt32(reader.GetOrdinal("CoveredNum")),
                        HasLights = reader.GetInt32(reader.GetOrdinal("HasLights")) == 1,
                        Latitude = reader.IsDBNull(reader.GetOrdinal("Latitude")) ? null : reader.GetDouble(reader.GetOrdinal("Latitude")),
                        Longitude = reader.IsDBNull(reader.GetOrdinal("Longitude")) ? null : reader.GetDouble(reader.GetOrdinal("Longitude")),
                        Distance = reader.IsDBNull(reader.GetOrdinal("Distance")) ? null : reader.GetDouble(reader.GetOrdinal("Distance"))
                    };
                }

                if (dto == null)
                    return NotFound(new ApiResponse<VenueDetailDto> { Success = false, Message = "Venue not found" });

                // Second result set: Aggregated confirmation data
                if (await reader.NextResultAsync() && await reader.ReadAsync())
                {
                    aggregatedInfo = new VenueAggregatedInfoDto
                    {
                        ConfirmationCount = reader.GetInt32(reader.GetOrdinal("ConfirmationCount")),
                        AverageRating = reader.IsDBNull(reader.GetOrdinal("AverageRating")) ? null : reader.GetDouble(reader.GetOrdinal("AverageRating")),
                        NotACourtCount = reader.IsDBNull(reader.GetOrdinal("NotACourtCount")) ? 0 : reader.GetInt32(reader.GetOrdinal("NotACourtCount")),
                        MostSuggestedName = reader.IsDBNull(reader.GetOrdinal("MostSuggestedName")) ? null : reader.GetString(reader.GetOrdinal("MostSuggestedName")),
                        MostConfirmedIndoorCount = reader.IsDBNull(reader.GetOrdinal("MostConfirmedIndoorCount")) ? null : reader.GetInt32(reader.GetOrdinal("MostConfirmedIndoorCount")),
                        MostConfirmedOutdoorCount = reader.IsDBNull(reader.GetOrdinal("MostConfirmedOutdoorCount")) ? null : reader.GetInt32(reader.GetOrdinal("MostConfirmedOutdoorCount")),
                        MostConfirmedHasLights = reader.IsDBNull(reader.GetOrdinal("MostConfirmedHasLights")) ? null : reader.GetInt32(reader.GetOrdinal("MostConfirmedHasLights")) == 1,
                        MostConfirmedHasFee = reader.IsDBNull(reader.GetOrdinal("MostConfirmedHasFee")) ? null : reader.GetInt32(reader.GetOrdinal("MostConfirmedHasFee")) == 1,
                        CommonFeeAmount = reader.IsDBNull(reader.GetOrdinal("CommonFeeAmount")) ? null : reader.GetString(reader.GetOrdinal("CommonFeeAmount")),
                        CommonHours = reader.IsDBNull(reader.GetOrdinal("CommonHours")) ? null : reader.GetString(reader.GetOrdinal("CommonHours")),
                        CommonSurfaceType = reader.IsDBNull(reader.GetOrdinal("CommonSurfaceType")) ? null : reader.GetString(reader.GetOrdinal("CommonSurfaceType"))
                    };
                }

                // Third result set: Recent confirmations
                if (await reader.NextResultAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        var confirmation = new VenueConfirmationDto
                        {
                            Id = reader.GetInt32(reader.GetOrdinal("Id")),
                            VenueId = reader.GetInt32(reader.GetOrdinal("VenueId")),
                            UserId = reader.GetInt32(reader.GetOrdinal("UserId")),
                            UserName = reader.IsDBNull(reader.GetOrdinal("UserName")) ? null : reader.GetString(reader.GetOrdinal("UserName")),
                            UserProfileImageUrl = reader.IsDBNull(reader.GetOrdinal("UserProfileImageUrl")) ? null : reader.GetString(reader.GetOrdinal("UserProfileImageUrl")),
                            NameConfirmed = reader.IsDBNull(reader.GetOrdinal("NameConfirmed")) ? null : reader.GetBoolean(reader.GetOrdinal("NameConfirmed")),
                            SuggestedName = reader.IsDBNull(reader.GetOrdinal("SuggestedName")) ? null : reader.GetString(reader.GetOrdinal("SuggestedName")),
                            NotACourt = reader.IsDBNull(reader.GetOrdinal("NotACourt")) ? null : reader.GetBoolean(reader.GetOrdinal("NotACourt")),
                            ConfirmedIndoorCount = reader.IsDBNull(reader.GetOrdinal("ConfirmedIndoorCount")) ? null : reader.GetInt32(reader.GetOrdinal("ConfirmedIndoorCount")),
                            ConfirmedOutdoorCount = reader.IsDBNull(reader.GetOrdinal("ConfirmedOutdoorCount")) ? null : reader.GetInt32(reader.GetOrdinal("ConfirmedOutdoorCount")),
                            ConfirmedCoveredCount = reader.IsDBNull(reader.GetOrdinal("ConfirmedCoveredCount")) ? null : reader.GetInt32(reader.GetOrdinal("ConfirmedCoveredCount")),
                            HasLights = reader.IsDBNull(reader.GetOrdinal("HasLights")) ? null : reader.GetBoolean(reader.GetOrdinal("HasLights")),
                            HasFee = reader.IsDBNull(reader.GetOrdinal("HasFee")) ? null : reader.GetBoolean(reader.GetOrdinal("HasFee")),
                            FeeAmount = reader.IsDBNull(reader.GetOrdinal("FeeAmount")) ? null : reader.GetString(reader.GetOrdinal("FeeAmount")),
                            FeeNotes = reader.IsDBNull(reader.GetOrdinal("FeeNotes")) ? null : reader.GetString(reader.GetOrdinal("FeeNotes")),
                            Hours = reader.IsDBNull(reader.GetOrdinal("Hours")) ? null : reader.GetString(reader.GetOrdinal("Hours")),
                            Rating = reader.IsDBNull(reader.GetOrdinal("Rating")) ? null : reader.GetInt32(reader.GetOrdinal("Rating")),
                            Notes = reader.IsDBNull(reader.GetOrdinal("Notes")) ? null : reader.GetString(reader.GetOrdinal("Notes")),
                            SurfaceType = reader.IsDBNull(reader.GetOrdinal("SurfaceType")) ? null : reader.GetString(reader.GetOrdinal("SurfaceType")),
                            Amenities = reader.IsDBNull(reader.GetOrdinal("Amenities")) ? null : reader.GetString(reader.GetOrdinal("Amenities"))?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList(),
                            CreatedAt = reader.GetDateTime(reader.GetOrdinal("CreatedAt")),
                            UpdatedAt = reader.GetDateTime(reader.GetOrdinal("UpdatedAt"))
                        };
                        recentConfirmations.Add(confirmation);
                    }
                }

                dto.AggregatedInfo = aggregatedInfo;
                dto.RecentConfirmations = recentConfirmations;

                // Get current user's confirmation if authenticated
                var userId = GetCurrentUserId();
                if (userId.HasValue)
                {
                    dto.MyConfirmation = recentConfirmations.FirstOrDefault(c => c.UserId == userId.Value);
                }
            }
            finally
            {
                await connection.CloseAsync();
            }

            return Ok(new ApiResponse<VenueDetailDto> { Success = true, Data = dto });
        }
        catch (SqlException ex) when (ex.Message.Contains("Could not find stored procedure"))
        {
            // Stored procedure not created yet - fall back to LINQ
            _logger.LogWarning("Stored procedure sp_GetVenueDetail not found, falling back to LINQ query");
            return await GetVenueLinq(id, userLat, userLng);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching venue {VenueId}", id);
            return StatusCode(500, new ApiResponse<VenueDetailDto> { Success = false, Message = "An error occurred" });
        }
    }

    // Fallback LINQ-based get venue (used when stored procedure doesn't exist)
    private async Task<ActionResult<ApiResponse<VenueDetailDto>>> GetVenueLinq(int id, double? userLat, double? userLng)
    {
        var venue = await _context.Venues.FindAsync(id);
        if (venue == null)
            return NotFound(new ApiResponse<VenueDetailDto> { Success = false, Message = "Venue not found" });

        List<VenueConfirmation> confirmations = new();
        try
        {
            confirmations = await _context.VenueConfirmations
                .Include(vc => vc.User)
                .Where(vc => vc.VenueId == id)
                .OrderByDescending(vc => vc.UpdatedAt)
                .ToListAsync();
        }
        catch { /* Table may not exist */ }

        double? distance = null;
        if (userLat.HasValue && userLng.HasValue &&
            double.TryParse(venue.GpsLat, out var lat) && double.TryParse(venue.GpsLng, out var lng))
        {
            distance = CalculateDistance(userLat.Value, userLng.Value, lat, lng);
        }

        var userId = GetCurrentUserId();
        var dto = new VenueDetailDto
        {
            Id = venue.VenueId,
            Name = venue.Name,
            Address = string.Join(" ", new[] { venue.Addr1, venue.Addr2 }.Where(a => !string.IsNullOrEmpty(a))),
            City = venue.City,
            County = venue.County,
            State = venue.State,
            Zip = venue.Zip,
            Country = venue.Country,
            Phone = venue.Phone,
            Website = venue.Website,
            Email = venue.Email,
            IndoorNum = venue.IndoorNum,
            OutdoorNum = venue.OutdoorNum,
            CoveredNum = venue.CoveredNum,
            HasLights = venue.Lights == "Y",
            Latitude = double.TryParse(venue.GpsLat, out var venueLat) ? venueLat : null,
            Longitude = double.TryParse(venue.GpsLng, out var venueLng) ? venueLng : null,
            Distance = distance,
            AggregatedInfo = GetAggregatedInfo(confirmations),
            RecentConfirmations = confirmations.Take(10).Select(vc => MapToConfirmationDto(vc)).ToList(),
            MyConfirmation = userId.HasValue
                ? confirmations.Where(vc => vc.UserId == userId.Value).Select(vc => MapToConfirmationDto(vc)).FirstOrDefault()
                : null
        };

        return Ok(new ApiResponse<VenueDetailDto> { Success = true, Data = dto });
    }

    // POST: /venues/{id}/confirmations - Submit or update venue confirmation
    [HttpPost("{id}/confirmations")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<VenueConfirmationDto>>> SubmitConfirmation(int id, [FromBody] SubmitVenueConfirmationDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<VenueConfirmationDto> { Success = false, Message = "User not authenticated" });

            var venue = await _context.Venues.FindAsync(id);
            if (venue == null)
                return NotFound(new ApiResponse<VenueConfirmationDto> { Success = false, Message = "Venue not found" });

            // If venue has no name (or placeholder name) and a new name is suggested, update it immediately
            var hasNoName = string.IsNullOrWhiteSpace(venue.Name) || venue.Name == "Unnamed Venue" || venue.Name == "Unnamed";
            if (hasNoName && !string.IsNullOrWhiteSpace(dto.SuggestedName))
            {
                venue.Name = dto.SuggestedName;
                // Clear the suggested name since it's being applied directly
                dto.SuggestedName = null;
                dto.NameConfirmed = true;
            }

            var existingConfirmation = await _context.VenueConfirmations
                .FirstOrDefaultAsync(vc => vc.VenueId == id && vc.UserId == userId.Value);

            if (existingConfirmation != null)
            {
                existingConfirmation.NameConfirmed = dto.NameConfirmed ?? existingConfirmation.NameConfirmed;
                existingConfirmation.SuggestedName = dto.SuggestedName ?? existingConfirmation.SuggestedName;
                existingConfirmation.NotACourt = dto.NotACourt ?? existingConfirmation.NotACourt;
                existingConfirmation.ConfirmedIndoorCount = dto.ConfirmedIndoorCount ?? existingConfirmation.ConfirmedIndoorCount;
                existingConfirmation.ConfirmedOutdoorCount = dto.ConfirmedOutdoorCount ?? existingConfirmation.ConfirmedOutdoorCount;
                existingConfirmation.ConfirmedCoveredCount = dto.ConfirmedCoveredCount ?? existingConfirmation.ConfirmedCoveredCount;
                existingConfirmation.HasLights = dto.HasLights ?? existingConfirmation.HasLights;
                existingConfirmation.HasFee = dto.HasFee ?? existingConfirmation.HasFee;
                existingConfirmation.FeeAmount = dto.FeeAmount ?? existingConfirmation.FeeAmount;
                existingConfirmation.FeeNotes = dto.FeeNotes ?? existingConfirmation.FeeNotes;
                existingConfirmation.Hours = dto.Hours ?? existingConfirmation.Hours;
                existingConfirmation.Rating = dto.Rating ?? existingConfirmation.Rating;
                existingConfirmation.Notes = dto.Notes ?? existingConfirmation.Notes;
                existingConfirmation.SurfaceType = dto.SurfaceType ?? existingConfirmation.SurfaceType;
                existingConfirmation.ConfirmedAddress = dto.ConfirmedAddress ?? existingConfirmation.ConfirmedAddress;
                existingConfirmation.ConfirmedCity = dto.ConfirmedCity ?? existingConfirmation.ConfirmedCity;
                existingConfirmation.ConfirmedState = dto.ConfirmedState ?? existingConfirmation.ConfirmedState;
                existingConfirmation.ConfirmedCountry = dto.ConfirmedCountry ?? existingConfirmation.ConfirmedCountry;
                if (dto.Amenities != null)
                    existingConfirmation.Amenities = string.Join(",", dto.Amenities);
                existingConfirmation.UpdatedAt = DateTime.Now;

                await _context.SaveChangesAsync();

                return Ok(new ApiResponse<VenueConfirmationDto>
                {
                    Success = true,
                    Message = "Confirmation updated",
                    Data = MapToConfirmationDto(existingConfirmation)
                });
            }
            else
            {
                var confirmation = new VenueConfirmation
                {
                    VenueId = id,
                    UserId = userId.Value,
                    NameConfirmed = dto.NameConfirmed,
                    SuggestedName = dto.SuggestedName,
                    NotACourt = dto.NotACourt,
                    ConfirmedIndoorCount = dto.ConfirmedIndoorCount,
                    ConfirmedOutdoorCount = dto.ConfirmedOutdoorCount,
                    ConfirmedCoveredCount = dto.ConfirmedCoveredCount,
                    HasLights = dto.HasLights,
                    HasFee = dto.HasFee,
                    FeeAmount = dto.FeeAmount,
                    FeeNotes = dto.FeeNotes,
                    Hours = dto.Hours,
                    Rating = dto.Rating,
                    Notes = dto.Notes,
                    SurfaceType = dto.SurfaceType,
                    ConfirmedAddress = dto.ConfirmedAddress,
                    ConfirmedCity = dto.ConfirmedCity,
                    ConfirmedState = dto.ConfirmedState,
                    ConfirmedCountry = dto.ConfirmedCountry,
                    Amenities = dto.Amenities != null ? string.Join(",", dto.Amenities) : null
                };

                _context.VenueConfirmations.Add(confirmation);
                await _context.SaveChangesAsync();

                return Ok(new ApiResponse<VenueConfirmationDto>
                {
                    Success = true,
                    Message = "Confirmation submitted",
                    Data = MapToConfirmationDto(confirmation)
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting venue confirmation");
            return StatusCode(500, new ApiResponse<VenueConfirmationDto> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /venues/{id}/confirmations - Get all confirmations for a venue
    [HttpGet("{id}/confirmations")]
    public async Task<ActionResult<ApiResponse<List<VenueConfirmationDto>>>> GetConfirmations(int id)
    {
        try
        {
            var confirmations = await _context.VenueConfirmations
                .Include(vc => vc.User)
                .Where(vc => vc.VenueId == id)
                .OrderByDescending(vc => vc.UpdatedAt)
                .ToListAsync();

            var dtos = confirmations.Select(vc => MapToConfirmationDto(vc)).ToList();
            return Ok(new ApiResponse<List<VenueConfirmationDto>> { Success = true, Data = dtos });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching venue confirmations");
            return StatusCode(500, new ApiResponse<List<VenueConfirmationDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /venues/countries - Get countries with venue counts
    [HttpGet("countries")]
    public async Task<ActionResult<ApiResponse<List<LocationCountDto>>>> GetCountries()
    {
        try
        {
            var countries = new List<LocationCountDto>();

            var connection = _context.Database.GetDbConnection();
            await connection.OpenAsync();

            try
            {
                using var command = connection.CreateCommand();
                command.CommandText = "GetVenueCountries";
                command.CommandType = CommandType.StoredProcedure;

                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    countries.Add(new LocationCountDto
                    {
                        Name = reader.GetString(reader.GetOrdinal("Country")),
                        Count = reader.GetInt32(reader.GetOrdinal("VenueCount"))
                    });
                }
            }
            finally
            {
                await connection.CloseAsync();
            }

            return Ok(new ApiResponse<List<LocationCountDto>> { Success = true, Data = countries });
        }
        catch (SqlException ex) when (ex.Message.Contains("Could not find stored procedure"))
        {
            // Fallback to LINQ
            _logger.LogWarning("Stored procedure GetVenueCountries not found, falling back to LINQ");
            var countries = await _context.Venues
                .GroupBy(v => v.Country ?? "Unknown")
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

    // GET: /venues/countries/{country}/states - Get states for a country with venue counts
    [HttpGet("countries/{country}/states")]
    public async Task<ActionResult<ApiResponse<List<LocationCountDto>>>> GetStatesByCountry(string country)
    {
        try
        {
            var states = new List<LocationCountDto>();

            var connection = _context.Database.GetDbConnection();
            await connection.OpenAsync();

            try
            {
                using var command = connection.CreateCommand();
                command.CommandText = "GetVenueStatesByCountry";
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add(new SqlParameter("@Country", SqlDbType.NVarChar, 100) { Value = country });

                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    states.Add(new LocationCountDto
                    {
                        Name = reader.GetString(reader.GetOrdinal("State")),
                        Count = reader.GetInt32(reader.GetOrdinal("VenueCount"))
                    });
                }
            }
            finally
            {
                await connection.CloseAsync();
            }

            return Ok(new ApiResponse<List<LocationCountDto>> { Success = true, Data = states });
        }
        catch (SqlException ex) when (ex.Message.Contains("Could not find stored procedure"))
        {
            // Fallback to LINQ
            _logger.LogWarning("Stored procedure GetVenueStatesByCountry not found, falling back to LINQ");
            var searchCountry = country == "Unknown" ? null : country;
            var states = await _context.Venues
                .Where(v => searchCountry == null ? v.Country == null : v.Country == searchCountry)
                .GroupBy(v => v.State ?? "Unknown")
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

    // GET: /venues/countries/{country}/states/{state}/cities - Get cities for a state with venue counts
    [HttpGet("countries/{country}/states/{state}/cities")]
    public async Task<ActionResult<ApiResponse<List<LocationCountDto>>>> GetCitiesByState(string country, string state)
    {
        try
        {
            var cities = new List<LocationCountDto>();

            var connection = _context.Database.GetDbConnection();
            await connection.OpenAsync();

            try
            {
                using var command = connection.CreateCommand();
                command.CommandText = "GetVenueCitiesByState";
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add(new SqlParameter("@Country", SqlDbType.NVarChar, 100) { Value = country });
                command.Parameters.Add(new SqlParameter("@State", SqlDbType.NVarChar, 100) { Value = state });

                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    cities.Add(new LocationCountDto
                    {
                        Name = reader.GetString(reader.GetOrdinal("City")),
                        Count = reader.GetInt32(reader.GetOrdinal("VenueCount"))
                    });
                }
            }
            finally
            {
                await connection.CloseAsync();
            }

            return Ok(new ApiResponse<List<LocationCountDto>> { Success = true, Data = cities });
        }
        catch (SqlException ex) when (ex.Message.Contains("Could not find stored procedure"))
        {
            // Fallback to LINQ
            _logger.LogWarning("Stored procedure GetVenueCitiesByState not found, falling back to LINQ");
            var searchCountry = country == "Unknown" ? null : country;
            var searchState = state == "Unknown" ? null : state;
            var cities = await _context.Venues
                .Where(v => (searchCountry == null ? v.Country == null : v.Country == searchCountry)
                    && (searchState == null ? v.State == null : v.State == searchState))
                .GroupBy(v => v.City ?? "Unknown")
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

    // GET: /venues/states - Get list of states with venues using stored procedure
    [HttpGet("states")]
    public async Task<ActionResult<ApiResponse<List<string>>>> GetStates()
    {
        try
        {
            var states = new List<string>();

            var connection = _context.Database.GetDbConnection();
            await connection.OpenAsync();

            try
            {
                using var command = connection.CreateCommand();
                command.CommandText = "sp_GetVenueStates";
                command.CommandType = CommandType.StoredProcedure;

                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    if (!reader.IsDBNull(0))
                        states.Add(reader.GetString(0));
                }
            }
            finally
            {
                await connection.CloseAsync();
            }

            return Ok(new ApiResponse<List<string>> { Success = true, Data = states });
        }
        catch (SqlException ex) when (ex.Message.Contains("Could not find stored procedure"))
        {
            // Stored procedure not created yet - fall back to LINQ
            _logger.LogWarning("Stored procedure sp_GetVenueStates not found, falling back to LINQ query");
            var states = await _context.Venues
                .Where(v => v.State != null && v.State != "")
                .Select(v => v.State!)
                .Distinct()
                .OrderBy(s => s)
                .ToListAsync();

            return Ok(new ApiResponse<List<string>> { Success = true, Data = states });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching states");
            return StatusCode(500, new ApiResponse<List<string>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /venues/check-nearby - Check for nearby venues within specified radius
    [HttpPost("check-nearby")]
    public async Task<ActionResult<ApiResponse<NearbyVenuesResponse>>> CheckNearbyVenues([FromBody] CheckNearbyVenuesRequest request)
    {
        try
        {
            // Convert yards to miles for distance calculation (1 mile = 1760 yards)
            var radiusMiles = request.RadiusYards / 1760.0;

            // Get all venues with coordinates
            var venues = await _context.Venues.ToListAsync();

            var nearbyVenues = venues
                .Select(v =>
                {
                    if (!double.TryParse(v.GpsLat, out var lat) || !double.TryParse(v.GpsLng, out var lng))
                        return null;

                    var distanceMiles = CalculateDistance(request.Latitude, request.Longitude, lat, lng);
                    var distanceYards = distanceMiles * 1760;

                    if (distanceYards > request.RadiusYards)
                        return null;

                    return new NearbyVenueDto
                    {
                        Id = v.VenueId,
                        Name = v.Name,
                        Address = string.Join(" ", new[] { v.Addr1, v.Addr2 }.Where(a => !string.IsNullOrEmpty(a))),
                        City = v.City,
                        State = v.State,
                        Country = v.Country,
                        Latitude = lat,
                        Longitude = lng,
                        DistanceYards = Math.Round(distanceYards, 1),
                        IndoorNum = v.IndoorNum,
                        OutdoorNum = v.OutdoorNum,
                        HasLights = v.Lights == "Y"
                    };
                })
                .Where(v => v != null)
                .OrderBy(v => v!.DistanceYards)
                .ToList();

            return Ok(new ApiResponse<NearbyVenuesResponse>
            {
                Success = true,
                Data = new NearbyVenuesResponse
                {
                    NearbyVenues = nearbyVenues!
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking for nearby venues");
            return StatusCode(500, new ApiResponse<NearbyVenuesResponse> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /venues - Add a new venue
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ApiResponse<VenueDto>>> AddVenue([FromBody] AddVenueRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<VenueDto> { Success = false, Message = "User not authenticated" });

            // Validate required fields
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new ApiResponse<VenueDto> { Success = false, Message = "Venue name is required" });

            if (request.Latitude == 0 && request.Longitude == 0)
                return BadRequest(new ApiResponse<VenueDto> { Success = false, Message = "Valid location coordinates are required" });

            // Create the venue
            var venue = new Venue
            {
                Name = request.Name,
                Addr1 = request.Addr1,
                Addr2 = request.Addr2,
                City = request.City,
                State = request.State,
                Zip = request.Zip,
                Country = request.Country,
                Phone = request.Phone,
                Website = request.Website,
                Email = request.Email,
                IndoorNum = request.IndoorNum ?? 0,
                OutdoorNum = request.OutdoorNum ?? 0,
                CoveredNum = request.CoveredNum ?? 0,
                Lights = request.HasLights ? "Y" : "N",
                VenueTypeId = request.VenueTypeId,
                GpsLat = request.Latitude.ToString(),
                GpsLng = request.Longitude.ToString(),
                AdminUid = userId.Value
            };

            _context.Venues.Add(venue);
            await _context.SaveChangesAsync();

            // Load venue type name if applicable
            string? venueTypeName = null;
            if (venue.VenueTypeId.HasValue)
            {
                var venueType = await _context.VenueTypes.FindAsync(venue.VenueTypeId.Value);
                venueTypeName = venueType?.Name;
            }

            var dto = new VenueDto
            {
                Id = venue.VenueId,
                Name = venue.Name,
                Address = string.Join(" ", new[] { venue.Addr1, venue.Addr2 }.Where(a => !string.IsNullOrEmpty(a))),
                City = venue.City,
                State = venue.State,
                Zip = venue.Zip,
                Country = venue.Country,
                Phone = venue.Phone,
                Website = venue.Website,
                Email = venue.Email,
                IndoorNum = venue.IndoorNum,
                OutdoorNum = venue.OutdoorNum,
                CoveredNum = venue.CoveredNum,
                HasLights = venue.Lights == "Y",
                VenueTypeId = venue.VenueTypeId,
                VenueTypeName = venueTypeName,
                Latitude = request.Latitude,
                Longitude = request.Longitude,
                AggregatedInfo = new VenueAggregatedInfoDto { ConfirmationCount = 0 }
            };

            _logger.LogInformation("User {UserId} added venue {VenueId}: {VenueName}", userId.Value, venue.VenueId, venue.Name);

            return Ok(new ApiResponse<VenueDto>
            {
                Success = true,
                Message = "Venue added successfully",
                Data = dto
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding venue");
            return StatusCode(500, new ApiResponse<VenueDto> { Success = false, Message = "An error occurred" });
        }
    }

    // Helper method to calculate distance (fallback)
    private static double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 3959;
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

    // Helper for LINQ fallback
    private static VenueAggregatedInfoDto GetAggregatedInfo(List<VenueConfirmation> confirmations)
    {
        if (confirmations.Count == 0)
            return new VenueAggregatedInfoDto { ConfirmationCount = 0 };

        return new VenueAggregatedInfoDto
        {
            ConfirmationCount = confirmations.Count,
            AverageRating = confirmations.Where(c => c.Rating.HasValue).Any()
                ? confirmations.Where(c => c.Rating.HasValue).Average(c => c.Rating!.Value)
                : null,
            MostConfirmedIndoorCount = confirmations.Where(c => c.ConfirmedIndoorCount.HasValue).GroupBy(c => c.ConfirmedIndoorCount).OrderByDescending(g => g.Count()).FirstOrDefault()?.Key,
            MostConfirmedOutdoorCount = confirmations.Where(c => c.ConfirmedOutdoorCount.HasValue).GroupBy(c => c.ConfirmedOutdoorCount).OrderByDescending(g => g.Count()).FirstOrDefault()?.Key,
            MostConfirmedHasLights = confirmations.Where(c => c.HasLights.HasValue).Count(c => c.HasLights == true) > confirmations.Where(c => c.HasLights.HasValue).Count(c => c.HasLights == false) ? true : confirmations.Where(c => c.HasLights.HasValue).Count(c => c.HasLights == false) > 0 ? false : null,
            MostConfirmedHasFee = confirmations.Where(c => c.HasFee.HasValue).Count(c => c.HasFee == true) > confirmations.Where(c => c.HasFee.HasValue).Count(c => c.HasFee == false) ? true : confirmations.Where(c => c.HasFee.HasValue).Count(c => c.HasFee == false) > 0 ? false : null,
            CommonFeeAmount = confirmations.Where(c => !string.IsNullOrEmpty(c.FeeAmount)).GroupBy(c => c.FeeAmount).OrderByDescending(g => g.Count()).FirstOrDefault()?.Key,
            CommonHours = confirmations.Where(c => !string.IsNullOrEmpty(c.Hours)).GroupBy(c => c.Hours).OrderByDescending(g => g.Count()).FirstOrDefault()?.Key,
            CommonSurfaceType = confirmations.Where(c => !string.IsNullOrEmpty(c.SurfaceType)).GroupBy(c => c.SurfaceType).OrderByDescending(g => g.Count()).FirstOrDefault()?.Key
        };
    }

    private static VenueConfirmationDto MapToConfirmationDto(VenueConfirmation vc)
    {
        return new VenueConfirmationDto
        {
            Id = vc.Id,
            VenueId = vc.VenueId,
            UserId = vc.UserId,
            UserName = vc.User != null ? $"{vc.User.FirstName} {vc.User.LastName}".Trim() : null,
            UserProfileImageUrl = vc.User?.ProfileImageUrl,
            NameConfirmed = vc.NameConfirmed,
            SuggestedName = vc.SuggestedName,
            NotACourt = vc.NotACourt,
            ConfirmedIndoorCount = vc.ConfirmedIndoorCount,
            ConfirmedOutdoorCount = vc.ConfirmedOutdoorCount,
            ConfirmedCoveredCount = vc.ConfirmedCoveredCount,
            HasLights = vc.HasLights,
            HasFee = vc.HasFee,
            FeeAmount = vc.FeeAmount,
            FeeNotes = vc.FeeNotes,
            Hours = vc.Hours,
            Rating = vc.Rating,
            Notes = vc.Notes,
            SurfaceType = vc.SurfaceType,
            ConfirmedAddress = vc.ConfirmedAddress,
            ConfirmedCity = vc.ConfirmedCity,
            ConfirmedState = vc.ConfirmedState,
            ConfirmedCountry = vc.ConfirmedCountry,
            Amenities = vc.Amenities?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList(),
            CreatedAt = vc.CreatedAt,
            UpdatedAt = vc.UpdatedAt
        };
    }

    // GET: /venues/top-for-events - Get top venues for event creation based on user history and location
    [HttpGet("top-for-events")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<TopVenueForEventDto>>>> GetTopVenuesForEvents(
        [FromQuery] double? latitude = null,
        [FromQuery] double? longitude = null,
        [FromQuery] int topN = 10)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<TopVenueForEventDto>> { Success = false, Message = "User not authenticated" });

            var venues = new List<TopVenueForEventDto>();

            var connection = _context.Database.GetDbConnection();
            await connection.OpenAsync();

            try
            {
                using var command = connection.CreateCommand();
                command.CommandText = "sp_GetTopVenuesForUser";
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add(new SqlParameter("@UserId", SqlDbType.Int) { Value = userId.Value });
                command.Parameters.Add(new SqlParameter("@Latitude", SqlDbType.Float) { Value = (object?)latitude ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@Longitude", SqlDbType.Float) { Value = (object?)longitude ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@TopN", SqlDbType.Int) { Value = topN });

                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    venues.Add(new TopVenueForEventDto
                    {
                        VenueId = reader.GetInt32(reader.GetOrdinal("VenueId")),
                        VenueName = reader.IsDBNull(reader.GetOrdinal("VenueName")) ? null : reader.GetString(reader.GetOrdinal("VenueName")),
                        City = reader.IsDBNull(reader.GetOrdinal("City")) ? null : reader.GetString(reader.GetOrdinal("City")),
                        State = reader.IsDBNull(reader.GetOrdinal("State")) ? null : reader.GetString(reader.GetOrdinal("State")),
                        Country = reader.IsDBNull(reader.GetOrdinal("Country")) ? null : reader.GetString(reader.GetOrdinal("Country")),
                        Address = reader.IsDBNull(reader.GetOrdinal("Address")) ? null : reader.GetString(reader.GetOrdinal("Address")),
                        Zip = reader.IsDBNull(reader.GetOrdinal("Zip")) ? null : reader.GetString(reader.GetOrdinal("Zip")),
                        Latitude = reader.IsDBNull(reader.GetOrdinal("Latitude")) ? null : reader.GetDouble(reader.GetOrdinal("Latitude")),
                        Longitude = reader.IsDBNull(reader.GetOrdinal("Longitude")) ? null : reader.GetDouble(reader.GetOrdinal("Longitude")),
                        IndoorCourts = reader.IsDBNull(reader.GetOrdinal("IndoorCourts")) ? null : reader.GetInt32(reader.GetOrdinal("IndoorCourts")),
                        OutdoorCourts = reader.IsDBNull(reader.GetOrdinal("OutdoorCourts")) ? null : reader.GetInt32(reader.GetOrdinal("OutdoorCourts")),
                        HasLights = !reader.IsDBNull(reader.GetOrdinal("HasLights")) && reader.GetString(reader.GetOrdinal("HasLights")) == "Y",
                        VenueTypeName = reader.IsDBNull(reader.GetOrdinal("VenueTypeName")) ? null : reader.GetString(reader.GetOrdinal("VenueTypeName")),
                        DistanceMiles = reader.IsDBNull(reader.GetOrdinal("DistanceMiles")) ? null : reader.GetDouble(reader.GetOrdinal("DistanceMiles")),
                        PriorityScore = reader.GetInt32(reader.GetOrdinal("PriorityScore"))
                    });
                }
            }
            finally
            {
                await connection.CloseAsync();
            }

            return Ok(new ApiResponse<List<TopVenueForEventDto>> { Success = true, Data = venues });
        }
        catch (SqlException ex) when (ex.Message.Contains("Could not find stored procedure"))
        {
            _logger.LogWarning("Stored procedure sp_GetTopVenuesForUser not found, falling back to empty list");
            return Ok(new ApiResponse<List<TopVenueForEventDto>>
            {
                Success = true,
                Data = new List<TopVenueForEventDto>(),
                Message = "Please run migration 042 to enable this feature"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching top venues for events");
            return StatusCode(500, new ApiResponse<List<TopVenueForEventDto>> { Success = false, Message = "An error occurred" });
        }
    }
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
}
