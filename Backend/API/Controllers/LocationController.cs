using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class LocationController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<LocationController> _logger;

    public LocationController(ApplicationDbContext context, ILogger<LocationController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get all active countries
    /// </summary>
    [HttpGet("countries")]
    public async Task<ActionResult<ApiResponse<List<CountryDto>>>> GetCountries()
    {
        try
        {
            var countries = await _context.Countries
                .Where(c => c.IsActive)
                .OrderBy(c => c.SortOrder)
                .ThenBy(c => c.Name)
                .Select(c => new CountryDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    Code2 = c.Code2,
                    Code3 = c.Code3,
                    PhoneCode = c.PhoneCode
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<CountryDto>>
            {
                Success = true,
                Data = countries
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching countries");
            return StatusCode(500, new ApiResponse<List<CountryDto>>
            {
                Success = false,
                Message = "Error fetching countries"
            });
        }
    }

    /// <summary>
    /// Get states/provinces for a country by country code (2-letter or 3-letter) or ID
    /// </summary>
    [HttpGet("countries/{countryCode}/states")]
    public async Task<ActionResult<ApiResponse<List<ProvinceStateDto>>>> GetStatesByCountry(string countryCode)
    {
        try
        {
            // Try to find country by ID, Code2, Code3, or Name
            var countryQuery = _context.Countries.AsQueryable();

            if (int.TryParse(countryCode, out var countryId))
            {
                countryQuery = countryQuery.Where(c => c.Id == countryId);
            }
            else
            {
                var code = countryCode.ToUpperInvariant();
                countryQuery = countryQuery.Where(c =>
                    c.Code2.ToUpper() == code ||
                    c.Code3.ToUpper() == code ||
                    c.Name.ToUpper() == code);
            }

            var country = await countryQuery.FirstOrDefaultAsync();
            if (country == null)
            {
                return NotFound(new ApiResponse<List<ProvinceStateDto>>
                {
                    Success = false,
                    Message = $"Country '{countryCode}' not found"
                });
            }

            var states = await _context.ProvinceStates
                .Where(s => s.CountryId == country.Id && s.IsActive)
                .OrderBy(s => s.SortOrder)
                .ThenBy(s => s.Name)
                .Select(s => new ProvinceStateDto
                {
                    Id = s.Id,
                    CountryId = s.CountryId,
                    Name = s.Name,
                    Code = s.Code,
                    Type = s.Type
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<ProvinceStateDto>>
            {
                Success = true,
                Data = states
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching states for country {CountryCode}", countryCode);
            return StatusCode(500, new ApiResponse<List<ProvinceStateDto>>
            {
                Success = false,
                Message = "Error fetching states"
            });
        }
    }

    /// <summary>
    /// Get all countries with their states/provinces
    /// </summary>
    [HttpGet("countries-with-states")]
    public async Task<ActionResult<ApiResponse<List<CountryWithStatesDto>>>> GetCountriesWithStates()
    {
        try
        {
            var countries = await _context.Countries
                .Where(c => c.IsActive)
                .OrderBy(c => c.SortOrder)
                .ThenBy(c => c.Name)
                .Include(c => c.ProvinceStates.Where(s => s.IsActive).OrderBy(s => s.SortOrder).ThenBy(s => s.Name))
                .Select(c => new CountryWithStatesDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    Code2 = c.Code2,
                    Code3 = c.Code3,
                    PhoneCode = c.PhoneCode,
                    States = c.ProvinceStates.Select(s => new ProvinceStateDto
                    {
                        Id = s.Id,
                        CountryId = s.CountryId,
                        Name = s.Name,
                        Code = s.Code,
                        Type = s.Type
                    }).ToList()
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<CountryWithStatesDto>>
            {
                Success = true,
                Data = countries
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching countries with states");
            return StatusCode(500, new ApiResponse<List<CountryWithStatesDto>>
            {
                Success = false,
                Message = "Error fetching countries with states"
            });
        }
    }

    /// <summary>
    /// Lookup a state by code within a country
    /// </summary>
    [HttpGet("countries/{countryCode}/states/{stateCode}")]
    public async Task<ActionResult<ApiResponse<ProvinceStateDto>>> GetState(string countryCode, string stateCode)
    {
        try
        {
            // Find country first
            var countryQuery = _context.Countries.AsQueryable();

            if (int.TryParse(countryCode, out var countryId))
            {
                countryQuery = countryQuery.Where(c => c.Id == countryId);
            }
            else
            {
                var code = countryCode.ToUpperInvariant();
                countryQuery = countryQuery.Where(c =>
                    c.Code2.ToUpper() == code ||
                    c.Code3.ToUpper() == code);
            }

            var country = await countryQuery.FirstOrDefaultAsync();
            if (country == null)
            {
                return NotFound(new ApiResponse<ProvinceStateDto>
                {
                    Success = false,
                    Message = $"Country '{countryCode}' not found"
                });
            }

            // Find state
            var stateCodeUpper = stateCode.ToUpperInvariant();
            var state = await _context.ProvinceStates
                .Where(s => s.CountryId == country.Id &&
                           (s.Code.ToUpper() == stateCodeUpper || s.Name.ToUpper() == stateCodeUpper))
                .Select(s => new ProvinceStateDto
                {
                    Id = s.Id,
                    CountryId = s.CountryId,
                    Name = s.Name,
                    Code = s.Code,
                    Type = s.Type
                })
                .FirstOrDefaultAsync();

            if (state == null)
            {
                return NotFound(new ApiResponse<ProvinceStateDto>
                {
                    Success = false,
                    Message = $"State '{stateCode}' not found in {country.Name}"
                });
            }

            return Ok(new ApiResponse<ProvinceStateDto>
            {
                Success = true,
                Data = state
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching state {StateCode} for country {CountryCode}", stateCode, countryCode);
            return StatusCode(500, new ApiResponse<ProvinceStateDto>
            {
                Success = false,
                Message = "Error fetching state"
            });
        }
    }
}
