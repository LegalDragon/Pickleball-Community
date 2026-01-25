using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace Pickleball.Community.Services;

public interface IGeocodingService
{
    Task<(double Latitude, double Longitude)?> GeocodeAddressAsync(string? city, string? state, string? country);
}

public class GeocodingService : IGeocodingService
{
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly ILogger<GeocodingService> _logger;
    private static readonly SemaphoreSlim _rateLimiter = new(1, 1);
    private static DateTime _lastRequestTime = DateTime.MinValue;

    public GeocodingService(HttpClient httpClient, IMemoryCache cache, ILogger<GeocodingService> logger)
    {
        _httpClient = httpClient;
        _cache = cache;
        _logger = logger;

        // Set User-Agent as required by Nominatim
        if (!_httpClient.DefaultRequestHeaders.Contains("User-Agent"))
        {
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "PickleballCommunity/1.0");
        }
    }

    public async Task<(double Latitude, double Longitude)?> GeocodeAddressAsync(string? city, string? state, string? country)
    {
        if (string.IsNullOrWhiteSpace(city) && string.IsNullOrWhiteSpace(state))
            return null;

        var addressParts = new[] { city, state, country }.Where(p => !string.IsNullOrWhiteSpace(p));
        var addressKey = string.Join(",", addressParts);

        // Check cache first
        if (_cache.TryGetValue($"geocode:{addressKey}", out (double Lat, double Lng) cached))
        {
            return (cached.Lat, cached.Lng);
        }

        try
        {
            // Rate limiting - Nominatim requires max 1 request per second
            await _rateLimiter.WaitAsync();
            try
            {
                var timeSinceLastRequest = DateTime.UtcNow - _lastRequestTime;
                if (timeSinceLastRequest.TotalMilliseconds < 1100)
                {
                    await Task.Delay(1100 - (int)timeSinceLastRequest.TotalMilliseconds);
                }

                var encodedAddress = Uri.EscapeDataString(string.Join(", ", addressParts));
                var url = $"https://nominatim.openstreetmap.org/search?format=json&q={encodedAddress}&limit=1";

                var response = await _httpClient.GetAsync(url);
                _lastRequestTime = DateTime.UtcNow;

                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync();
                    var results = JsonSerializer.Deserialize<List<NominatimResult>>(json, new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });

                    if (results != null && results.Count > 0)
                    {
                        if (double.TryParse(results[0].Lat, out var lat) && double.TryParse(results[0].Lon, out var lng))
                        {
                            // Cache for 24 hours
                            _cache.Set($"geocode:{addressKey}", (lat, lng), TimeSpan.FromHours(24));
                            _logger.LogDebug("Geocoded '{Address}' to ({Lat}, {Lng})", addressKey, lat, lng);
                            return (lat, lng);
                        }
                    }
                }
            }
            finally
            {
                _rateLimiter.Release();
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to geocode address: {Address}", addressKey);
        }

        return null;
    }

    private class NominatimResult
    {
        public string? Lat { get; set; }
        public string? Lon { get; set; }
    }
}
