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
public class CourtsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<CourtsController> _logger;

    public CourtsController(ApplicationDbContext context, ILogger<CourtsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    // GET: /courts/search - Search for courts using stored procedure
    [HttpGet("search")]
    public async Task<ActionResult<ApiResponse<PagedResult<CourtDto>>>> SearchCourts([FromQuery] CourtSearchRequest request)
    {
        try
        {
            var courts = new List<CourtDto>();
            int totalCount = 0;

            var connection = _context.Database.GetDbConnection();
            await connection.OpenAsync();

            try
            {
                using var command = connection.CreateCommand();
                command.CommandText = "sp_SearchCourts";
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
                command.Parameters.Add(new SqlParameter("@Page", SqlDbType.Int) { Value = request.Page });
                command.Parameters.Add(new SqlParameter("@PageSize", SqlDbType.Int) { Value = request.PageSize });

                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var court = new CourtDto
                    {
                        Id = reader.GetInt32(reader.GetOrdinal("CourtId")),
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
                        AggregatedInfo = new CourtAggregatedInfoDto
                        {
                            ConfirmationCount = reader.GetInt32(reader.GetOrdinal("ConfirmationCount")),
                            AverageRating = reader.IsDBNull(reader.GetOrdinal("AverageRating")) ? null : reader.GetDouble(reader.GetOrdinal("AverageRating")),
                            NotACourtCount = reader.IsDBNull(reader.GetOrdinal("NotACourtCount")) ? 0 : reader.GetInt32(reader.GetOrdinal("NotACourtCount")),
                            MostSuggestedName = reader.IsDBNull(reader.GetOrdinal("MostSuggestedName")) ? null : reader.GetString(reader.GetOrdinal("MostSuggestedName"))
                        }
                    };

                    totalCount = reader.GetInt32(reader.GetOrdinal("TotalCount"));
                    courts.Add(court);
                }
            }
            finally
            {
                await connection.CloseAsync();
            }

            return Ok(new ApiResponse<PagedResult<CourtDto>>
            {
                Success = true,
                Data = new PagedResult<CourtDto>
                {
                    Items = courts,
                    TotalCount = totalCount,
                    Page = request.Page,
                    PageSize = request.PageSize
                }
            });
        }
        catch (SqlException ex) when (ex.Message.Contains("Could not find stored procedure"))
        {
            // Stored procedure not created yet - fall back to LINQ
            _logger.LogWarning("Stored procedure sp_SearchCourts not found, falling back to LINQ query");
            return await SearchCourtsLinq(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching courts");
            return StatusCode(500, new ApiResponse<PagedResult<CourtDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // Fallback LINQ-based search (used when stored procedure doesn't exist)
    private async Task<ActionResult<ApiResponse<PagedResult<CourtDto>>>> SearchCourtsLinq(CourtSearchRequest request)
    {
        var query = _context.Courts.AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Country))
        {
            var searchCountry = request.Country == "Unknown" ? null : request.Country;
            query = query.Where(c => searchCountry == null ? c.Country == null : c.Country == searchCountry);
        }

        if (!string.IsNullOrWhiteSpace(request.State))
        {
            var searchState = request.State == "Unknown" ? null : request.State;
            query = query.Where(c => searchState == null ? c.State == null : c.State == searchState);
        }

        if (!string.IsNullOrWhiteSpace(request.City))
        {
            var cityPattern = $"%{request.City}%";
            query = query.Where(c => c.City != null && EF.Functions.Like(c.City, cityPattern));
        }

        if (request.HasLights.HasValue && request.HasLights.Value)
            query = query.Where(c => c.Lights == "Y");

        if (request.IsIndoor.HasValue && request.IsIndoor.Value)
            query = query.Where(c => c.IndoorNum > 0);

        if (request.CourtTypeId.HasValue)
            query = query.Where(c => c.CourtTypeId == request.CourtTypeId.Value);

        if (!string.IsNullOrWhiteSpace(request.Query))
        {
            var searchPattern = $"%{request.Query}%";
            query = query.Where(c =>
                (c.Name != null && EF.Functions.Like(c.Name, searchPattern)) ||
                (c.City != null && EF.Functions.Like(c.City, searchPattern)) ||
                (c.Addr1 != null && EF.Functions.Like(c.Addr1, searchPattern)));
        }

        var courts = await query.ToListAsync();

        List<(Court court, double? distance)> courtsWithDistance;
        if (request.Latitude.HasValue && request.Longitude.HasValue)
        {
            courtsWithDistance = courts
                .Select(c =>
                {
                    double? distance = null;
                    if (double.TryParse(c.GpsLat, out var lat) && double.TryParse(c.GpsLng, out var lng))
                        distance = CalculateDistance(request.Latitude.Value, request.Longitude.Value, lat, lng);
                    return (court: c, distance);
                })
                .Where(x => !request.RadiusMiles.HasValue || x.distance == null || x.distance <= request.RadiusMiles.Value)
                .OrderBy(x => x.distance ?? double.MaxValue)
                .ToList();
        }
        else
        {
            courtsWithDistance = courts.Select(c => (court: c, distance: (double?)null)).ToList();
        }

        var totalCount = courtsWithDistance.Count;
        var pagedCourts = courtsWithDistance
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToList();

        var courtDtos = pagedCourts.Select(x => new CourtDto
        {
            Id = x.court.CourtId,
            Name = x.court.Name,
            Address = string.Join(" ", new[] { x.court.Addr1, x.court.Addr2 }.Where(a => !string.IsNullOrEmpty(a))),
            City = x.court.City,
            County = x.court.County,
            State = x.court.State,
            Zip = x.court.Zip,
            Country = x.court.Country,
            Phone = x.court.Phone,
            Website = x.court.Website,
            Email = x.court.Email,
            IndoorNum = x.court.IndoorNum,
            OutdoorNum = x.court.OutdoorNum,
            CoveredNum = x.court.CoveredNum,
            HasLights = x.court.Lights == "Y",
            Latitude = double.TryParse(x.court.GpsLat, out var lat) ? lat : null,
            Longitude = double.TryParse(x.court.GpsLng, out var lng) ? lng : null,
            Distance = x.distance,
            AggregatedInfo = new CourtAggregatedInfoDto { ConfirmationCount = 0 }
        }).ToList();

        return Ok(new ApiResponse<PagedResult<CourtDto>>
        {
            Success = true,
            Data = new PagedResult<CourtDto>
            {
                Items = courtDtos,
                TotalCount = totalCount,
                Page = request.Page,
                PageSize = request.PageSize
            }
        });
    }

    // GET: /courts/{id} - Get court details using stored procedure
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<CourtDetailDto>>> GetCourt(int id, [FromQuery] double? userLat, [FromQuery] double? userLng)
    {
        try
        {
            CourtDetailDto? dto = null;
            var recentConfirmations = new List<CourtConfirmationDto>();
            CourtAggregatedInfoDto aggregatedInfo = new() { ConfirmationCount = 0 };

            var connection = _context.Database.GetDbConnection();
            await connection.OpenAsync();

            try
            {
                using var command = connection.CreateCommand();
                command.CommandText = "sp_GetCourtDetail";
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add(new SqlParameter("@CourtId", SqlDbType.Int) { Value = id });
                command.Parameters.Add(new SqlParameter("@UserLat", SqlDbType.Float) { Value = (object?)userLat ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@UserLng", SqlDbType.Float) { Value = (object?)userLng ?? DBNull.Value });

                using var reader = await command.ExecuteReaderAsync();

                // First result set: Court basic info
                if (await reader.ReadAsync())
                {
                    dto = new CourtDetailDto
                    {
                        Id = reader.GetInt32(reader.GetOrdinal("CourtId")),
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
                    return NotFound(new ApiResponse<CourtDetailDto> { Success = false, Message = "Court not found" });

                // Second result set: Aggregated confirmation data
                if (await reader.NextResultAsync() && await reader.ReadAsync())
                {
                    aggregatedInfo = new CourtAggregatedInfoDto
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
                        var confirmation = new CourtConfirmationDto
                        {
                            Id = reader.GetInt32(reader.GetOrdinal("Id")),
                            CourtId = reader.GetInt32(reader.GetOrdinal("CourtId")),
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

            return Ok(new ApiResponse<CourtDetailDto> { Success = true, Data = dto });
        }
        catch (SqlException ex) when (ex.Message.Contains("Could not find stored procedure"))
        {
            // Stored procedure not created yet - fall back to LINQ
            _logger.LogWarning("Stored procedure sp_GetCourtDetail not found, falling back to LINQ query");
            return await GetCourtLinq(id, userLat, userLng);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching court {CourtId}", id);
            return StatusCode(500, new ApiResponse<CourtDetailDto> { Success = false, Message = "An error occurred" });
        }
    }

    // Fallback LINQ-based get court (used when stored procedure doesn't exist)
    private async Task<ActionResult<ApiResponse<CourtDetailDto>>> GetCourtLinq(int id, double? userLat, double? userLng)
    {
        var court = await _context.Courts.FindAsync(id);
        if (court == null)
            return NotFound(new ApiResponse<CourtDetailDto> { Success = false, Message = "Court not found" });

        List<CourtConfirmation> confirmations = new();
        try
        {
            confirmations = await _context.CourtConfirmations
                .Include(cc => cc.User)
                .Where(cc => cc.CourtId == id)
                .OrderByDescending(cc => cc.UpdatedAt)
                .ToListAsync();
        }
        catch { /* Table may not exist */ }

        double? distance = null;
        if (userLat.HasValue && userLng.HasValue &&
            double.TryParse(court.GpsLat, out var lat) && double.TryParse(court.GpsLng, out var lng))
        {
            distance = CalculateDistance(userLat.Value, userLng.Value, lat, lng);
        }

        var userId = GetCurrentUserId();
        var dto = new CourtDetailDto
        {
            Id = court.CourtId,
            Name = court.Name,
            Address = string.Join(" ", new[] { court.Addr1, court.Addr2 }.Where(a => !string.IsNullOrEmpty(a))),
            City = court.City,
            County = court.County,
            State = court.State,
            Zip = court.Zip,
            Country = court.Country,
            Phone = court.Phone,
            Website = court.Website,
            Email = court.Email,
            IndoorNum = court.IndoorNum,
            OutdoorNum = court.OutdoorNum,
            CoveredNum = court.CoveredNum,
            HasLights = court.Lights == "Y",
            Latitude = double.TryParse(court.GpsLat, out var courtLat) ? courtLat : null,
            Longitude = double.TryParse(court.GpsLng, out var courtLng) ? courtLng : null,
            Distance = distance,
            AggregatedInfo = GetAggregatedInfo(confirmations),
            RecentConfirmations = confirmations.Take(10).Select(cc => MapToConfirmationDto(cc)).ToList(),
            MyConfirmation = userId.HasValue
                ? confirmations.Where(cc => cc.UserId == userId.Value).Select(cc => MapToConfirmationDto(cc)).FirstOrDefault()
                : null
        };

        return Ok(new ApiResponse<CourtDetailDto> { Success = true, Data = dto });
    }

    // POST: /courts/{id}/confirmations - Submit or update court confirmation
    [HttpPost("{id}/confirmations")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<CourtConfirmationDto>>> SubmitConfirmation(int id, [FromBody] SubmitCourtConfirmationDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<CourtConfirmationDto> { Success = false, Message = "User not authenticated" });

            var court = await _context.Courts.FindAsync(id);
            if (court == null)
                return NotFound(new ApiResponse<CourtConfirmationDto> { Success = false, Message = "Court not found" });

            var existingConfirmation = await _context.CourtConfirmations
                .FirstOrDefaultAsync(cc => cc.CourtId == id && cc.UserId == userId.Value);

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
                existingConfirmation.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(new ApiResponse<CourtConfirmationDto>
                {
                    Success = true,
                    Message = "Confirmation updated",
                    Data = MapToConfirmationDto(existingConfirmation)
                });
            }
            else
            {
                var confirmation = new CourtConfirmation
                {
                    CourtId = id,
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

                _context.CourtConfirmations.Add(confirmation);
                await _context.SaveChangesAsync();

                return Ok(new ApiResponse<CourtConfirmationDto>
                {
                    Success = true,
                    Message = "Confirmation submitted",
                    Data = MapToConfirmationDto(confirmation)
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting court confirmation");
            return StatusCode(500, new ApiResponse<CourtConfirmationDto> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /courts/{id}/confirmations - Get all confirmations for a court
    [HttpGet("{id}/confirmations")]
    public async Task<ActionResult<ApiResponse<List<CourtConfirmationDto>>>> GetConfirmations(int id)
    {
        try
        {
            var confirmations = await _context.CourtConfirmations
                .Include(cc => cc.User)
                .Where(cc => cc.CourtId == id)
                .OrderByDescending(cc => cc.UpdatedAt)
                .ToListAsync();

            var dtos = confirmations.Select(cc => MapToConfirmationDto(cc)).ToList();
            return Ok(new ApiResponse<List<CourtConfirmationDto>> { Success = true, Data = dtos });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching court confirmations");
            return StatusCode(500, new ApiResponse<List<CourtConfirmationDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /courts/countries - Get countries with court counts
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
                command.CommandText = "GetCourtCountries";
                command.CommandType = CommandType.StoredProcedure;

                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    countries.Add(new LocationCountDto
                    {
                        Name = reader.GetString(reader.GetOrdinal("Country")),
                        Count = reader.GetInt32(reader.GetOrdinal("CourtCount"))
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
            _logger.LogWarning("Stored procedure GetCourtCountries not found, falling back to LINQ");
            var countries = await _context.Courts
                .GroupBy(c => c.Country ?? "Unknown")
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

    // GET: /courts/countries/{country}/states - Get states for a country with court counts
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
                command.CommandText = "GetCourtStatesByCountry";
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add(new SqlParameter("@Country", SqlDbType.NVarChar, 100) { Value = country });

                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    states.Add(new LocationCountDto
                    {
                        Name = reader.GetString(reader.GetOrdinal("State")),
                        Count = reader.GetInt32(reader.GetOrdinal("CourtCount"))
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
            _logger.LogWarning("Stored procedure GetCourtStatesByCountry not found, falling back to LINQ");
            var searchCountry = country == "Unknown" ? null : country;
            var states = await _context.Courts
                .Where(c => searchCountry == null ? c.Country == null : c.Country == searchCountry)
                .GroupBy(c => c.State ?? "Unknown")
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

    // GET: /courts/countries/{country}/states/{state}/cities - Get cities for a state with court counts
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
                command.CommandText = "GetCourtCitiesByState";
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add(new SqlParameter("@Country", SqlDbType.NVarChar, 100) { Value = country });
                command.Parameters.Add(new SqlParameter("@State", SqlDbType.NVarChar, 100) { Value = state });

                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    cities.Add(new LocationCountDto
                    {
                        Name = reader.GetString(reader.GetOrdinal("City")),
                        Count = reader.GetInt32(reader.GetOrdinal("CourtCount"))
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
            _logger.LogWarning("Stored procedure GetCourtCitiesByState not found, falling back to LINQ");
            var searchCountry = country == "Unknown" ? null : country;
            var searchState = state == "Unknown" ? null : state;
            var cities = await _context.Courts
                .Where(c => (searchCountry == null ? c.Country == null : c.Country == searchCountry)
                    && (searchState == null ? c.State == null : c.State == searchState))
                .GroupBy(c => c.City ?? "Unknown")
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

    // GET: /courts/states - Get list of states with courts using stored procedure
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
                command.CommandText = "sp_GetCourtStates";
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
            _logger.LogWarning("Stored procedure sp_GetCourtStates not found, falling back to LINQ query");
            var states = await _context.Courts
                .Where(c => c.State != null && c.State != "")
                .Select(c => c.State!)
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

    // POST: /courts/check-nearby - Check for nearby courts within specified radius
    [HttpPost("check-nearby")]
    public async Task<ActionResult<ApiResponse<NearbyCourtsResponse>>> CheckNearbyCourts([FromBody] CheckNearbyCourtsRequest request)
    {
        try
        {
            // Convert yards to miles for distance calculation (1 mile = 1760 yards)
            var radiusMiles = request.RadiusYards / 1760.0;

            // Get all courts with coordinates
            var courts = await _context.Courts.ToListAsync();

            var nearbyCourts = courts
                .Select(c =>
                {
                    if (!double.TryParse(c.GpsLat, out var lat) || !double.TryParse(c.GpsLng, out var lng))
                        return null;

                    var distanceMiles = CalculateDistance(request.Latitude, request.Longitude, lat, lng);
                    var distanceYards = distanceMiles * 1760;

                    if (distanceYards > request.RadiusYards)
                        return null;

                    return new NearbyCourtDto
                    {
                        Id = c.CourtId,
                        Name = c.Name,
                        Address = string.Join(" ", new[] { c.Addr1, c.Addr2 }.Where(a => !string.IsNullOrEmpty(a))),
                        City = c.City,
                        State = c.State,
                        Country = c.Country,
                        Latitude = lat,
                        Longitude = lng,
                        DistanceYards = Math.Round(distanceYards, 1),
                        IndoorNum = c.IndoorNum,
                        OutdoorNum = c.OutdoorNum,
                        HasLights = c.Lights == "Y"
                    };
                })
                .Where(c => c != null)
                .OrderBy(c => c!.DistanceYards)
                .ToList();

            return Ok(new ApiResponse<NearbyCourtsResponse>
            {
                Success = true,
                Data = new NearbyCourtsResponse
                {
                    NearbyCourts = nearbyCourts!
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking for nearby courts");
            return StatusCode(500, new ApiResponse<NearbyCourtsResponse> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /courts - Add a new court
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ApiResponse<CourtDto>>> AddCourt([FromBody] AddCourtRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<CourtDto> { Success = false, Message = "User not authenticated" });

            // Validate required fields
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new ApiResponse<CourtDto> { Success = false, Message = "Court name is required" });

            if (request.Latitude == 0 && request.Longitude == 0)
                return BadRequest(new ApiResponse<CourtDto> { Success = false, Message = "Valid location coordinates are required" });

            // Create the court
            var court = new Court
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
                CourtTypeId = request.CourtTypeId,
                GpsLat = request.Latitude.ToString(),
                GpsLng = request.Longitude.ToString(),
                AdminUid = userId.Value
            };

            _context.Courts.Add(court);
            await _context.SaveChangesAsync();

            // Load court type name if applicable
            string? courtTypeName = null;
            if (court.CourtTypeId.HasValue)
            {
                var courtType = await _context.CourtTypes.FindAsync(court.CourtTypeId.Value);
                courtTypeName = courtType?.Name;
            }

            var dto = new CourtDto
            {
                Id = court.CourtId,
                Name = court.Name,
                Address = string.Join(" ", new[] { court.Addr1, court.Addr2 }.Where(a => !string.IsNullOrEmpty(a))),
                City = court.City,
                State = court.State,
                Zip = court.Zip,
                Country = court.Country,
                Phone = court.Phone,
                Website = court.Website,
                Email = court.Email,
                IndoorNum = court.IndoorNum,
                OutdoorNum = court.OutdoorNum,
                CoveredNum = court.CoveredNum,
                HasLights = court.Lights == "Y",
                CourtTypeId = court.CourtTypeId,
                CourtTypeName = courtTypeName,
                Latitude = request.Latitude,
                Longitude = request.Longitude,
                AggregatedInfo = new CourtAggregatedInfoDto { ConfirmationCount = 0 }
            };

            _logger.LogInformation("User {UserId} added court {CourtId}: {CourtName}", userId.Value, court.CourtId, court.Name);

            return Ok(new ApiResponse<CourtDto>
            {
                Success = true,
                Message = "Court added successfully",
                Data = dto
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding court");
            return StatusCode(500, new ApiResponse<CourtDto> { Success = false, Message = "An error occurred" });
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
    private static CourtAggregatedInfoDto GetAggregatedInfo(List<CourtConfirmation> confirmations)
    {
        if (confirmations.Count == 0)
            return new CourtAggregatedInfoDto { ConfirmationCount = 0 };

        return new CourtAggregatedInfoDto
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

    private static CourtConfirmationDto MapToConfirmationDto(CourtConfirmation cc)
    {
        return new CourtConfirmationDto
        {
            Id = cc.Id,
            CourtId = cc.CourtId,
            UserId = cc.UserId,
            UserName = cc.User != null ? $"{cc.User.FirstName} {cc.User.LastName}".Trim() : null,
            UserProfileImageUrl = cc.User?.ProfileImageUrl,
            NameConfirmed = cc.NameConfirmed,
            SuggestedName = cc.SuggestedName,
            NotACourt = cc.NotACourt,
            ConfirmedIndoorCount = cc.ConfirmedIndoorCount,
            ConfirmedOutdoorCount = cc.ConfirmedOutdoorCount,
            ConfirmedCoveredCount = cc.ConfirmedCoveredCount,
            HasLights = cc.HasLights,
            HasFee = cc.HasFee,
            FeeAmount = cc.FeeAmount,
            FeeNotes = cc.FeeNotes,
            Hours = cc.Hours,
            Rating = cc.Rating,
            Notes = cc.Notes,
            SurfaceType = cc.SurfaceType,
            ConfirmedAddress = cc.ConfirmedAddress,
            ConfirmedCity = cc.ConfirmedCity,
            ConfirmedState = cc.ConfirmedState,
            ConfirmedCountry = cc.ConfirmedCountry,
            Amenities = cc.Amenities?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList(),
            CreatedAt = cc.CreatedAt,
            UpdatedAt = cc.UpdatedAt
        };
    }

    // GET: /courts/top-for-events - Get top courts for event creation based on user history and location
    [HttpGet("top-for-events")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<TopCourtForEventDto>>>> GetTopCourtsForEvents(
        [FromQuery] double? latitude = null,
        [FromQuery] double? longitude = null,
        [FromQuery] int topN = 10)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<TopCourtForEventDto>> { Success = false, Message = "User not authenticated" });

            var courts = new List<TopCourtForEventDto>();

            var connection = _context.Database.GetDbConnection();
            await connection.OpenAsync();

            try
            {
                using var command = connection.CreateCommand();
                command.CommandText = "sp_GetTopCourtsForUser";
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add(new SqlParameter("@UserId", SqlDbType.Int) { Value = userId.Value });
                command.Parameters.Add(new SqlParameter("@Latitude", SqlDbType.Float) { Value = (object?)latitude ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@Longitude", SqlDbType.Float) { Value = (object?)longitude ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@TopN", SqlDbType.Int) { Value = topN });

                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    courts.Add(new TopCourtForEventDto
                    {
                        CourtId = reader.GetInt32(reader.GetOrdinal("CourtId")),
                        CourtName = reader.IsDBNull(reader.GetOrdinal("CourtName")) ? null : reader.GetString(reader.GetOrdinal("CourtName")),
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
                        CourtTypeName = reader.IsDBNull(reader.GetOrdinal("CourtTypeName")) ? null : reader.GetString(reader.GetOrdinal("CourtTypeName")),
                        DistanceMiles = reader.IsDBNull(reader.GetOrdinal("DistanceMiles")) ? null : reader.GetDouble(reader.GetOrdinal("DistanceMiles")),
                        PriorityScore = reader.GetInt32(reader.GetOrdinal("PriorityScore"))
                    });
                }
            }
            finally
            {
                await connection.CloseAsync();
            }

            return Ok(new ApiResponse<List<TopCourtForEventDto>> { Success = true, Data = courts });
        }
        catch (SqlException ex) when (ex.Message.Contains("Could not find stored procedure"))
        {
            _logger.LogWarning("Stored procedure sp_GetTopCourtsForUser not found, falling back to empty list");
            return Ok(new ApiResponse<List<TopCourtForEventDto>>
            {
                Success = true,
                Data = new List<TopCourtForEventDto>(),
                Message = "Please run migration 037 to enable this feature"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching top courts for events");
            return StatusCode(500, new ApiResponse<List<TopCourtForEventDto>> { Success = false, Message = "An error occurred" });
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
