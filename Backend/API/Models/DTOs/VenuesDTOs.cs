namespace Pickleball.Community.Models.DTOs;

public class VenueDto
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? County { get; set; }
    public string? State { get; set; }
    public string? Zip { get; set; }
    public string? Country { get; set; }
    public string? Phone { get; set; }
    public string? Website { get; set; }
    public string? Email { get; set; }
    public int? IndoorNum { get; set; }
    public int? OutdoorNum { get; set; }
    public int? CoveredNum { get; set; }
    public bool HasLights { get; set; }
    public int? VenueTypeId { get; set; }
    public string? VenueTypeName { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? Distance { get; set; } // Calculated distance from user
    public VenueAggregatedInfoDto? AggregatedInfo { get; set; }
}

public class VenueAggregatedInfoDto
{
    public int ConfirmationCount { get; set; }
    public double? AverageRating { get; set; }
    public int? MostConfirmedIndoorCount { get; set; }
    public int? MostConfirmedOutdoorCount { get; set; }
    public bool? MostConfirmedHasLights { get; set; }
    public bool? MostConfirmedHasFee { get; set; }
    public string? CommonFeeAmount { get; set; }
    public string? CommonHours { get; set; }
    public string? CommonSurfaceType { get; set; }
    public List<string>? CommonAmenities { get; set; }
    public int NotACourtCount { get; set; } // Number of users who flagged this as not a venue
    public string? MostSuggestedName { get; set; } // Most commonly suggested name
    public string? MostConfirmedAddress { get; set; }
    public string? MostConfirmedCity { get; set; }
    public string? MostConfirmedState { get; set; }
    public string? MostConfirmedCountry { get; set; }
}

public class VenueDetailDto : VenueDto
{
    public List<VenueConfirmationDto>? RecentConfirmations { get; set; }
    public VenueConfirmationDto? MyConfirmation { get; set; }
    public List<VenueAssetDto>? TopAssets { get; set; }
}

public class VenueConfirmationDto
{
    public int Id { get; set; }
    public int VenueId { get; set; }
    public int UserId { get; set; }
    public string? UserName { get; set; }
    public string? UserProfileImageUrl { get; set; }
    public bool? NameConfirmed { get; set; }
    public string? SuggestedName { get; set; }
    public bool? NotACourt { get; set; }
    public int? ConfirmedIndoorCount { get; set; }
    public int? ConfirmedOutdoorCount { get; set; }
    public int? ConfirmedCoveredCount { get; set; }
    public bool? HasLights { get; set; }
    public bool? HasFee { get; set; }
    public string? FeeAmount { get; set; }
    public string? FeeNotes { get; set; }
    public string? Hours { get; set; }
    public int? Rating { get; set; }
    public string? Notes { get; set; }
    public List<string>? Amenities { get; set; }
    public string? SurfaceType { get; set; }
    public string? ConfirmedAddress { get; set; }
    public string? ConfirmedCity { get; set; }
    public string? ConfirmedState { get; set; }
    public string? ConfirmedCountry { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class SubmitVenueConfirmationDto
{
    public bool? NameConfirmed { get; set; }
    public string? SuggestedName { get; set; }
    public bool? NotACourt { get; set; }
    public int? ConfirmedIndoorCount { get; set; }
    public int? ConfirmedOutdoorCount { get; set; }
    public int? ConfirmedCoveredCount { get; set; }
    public bool? HasLights { get; set; }
    public bool? HasFee { get; set; }
    public string? FeeAmount { get; set; }
    public string? FeeNotes { get; set; }
    public string? Hours { get; set; }
    public int? Rating { get; set; }
    public string? Notes { get; set; }
    public List<string>? Amenities { get; set; }
    public string? SurfaceType { get; set; }
    public string? ConfirmedAddress { get; set; }
    public string? ConfirmedCity { get; set; }
    public string? ConfirmedState { get; set; }
    public string? ConfirmedCountry { get; set; }
}

public class VenueSearchRequest
{
    public string? Query { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? RadiusMiles { get; set; } = 100;
    public string? Country { get; set; }
    public string? State { get; set; }
    public string? City { get; set; }
    public int? VenueTypeId { get; set; }
    public bool? HasLights { get; set; }
    public bool? IsIndoor { get; set; }
    public string? SortBy { get; set; }  // 'match', 'distance', 'name', 'rating'
    public string? SortOrder { get; set; } = "asc";  // 'asc' or 'desc'
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

/// <summary>
/// DTO for location dropdown items with venue counts
/// </summary>
public class LocationCountDto
{
    public string Name { get; set; } = string.Empty;
    public int Count { get; set; }
}

// Venue Asset DTOs
public class VenueAssetDto
{
    public int Id { get; set; }
    public int VenueId { get; set; }
    public int UserId { get; set; }
    public string? UserName { get; set; }
    public string? UserProfileImageUrl { get; set; }
    public string AssetType { get; set; } = string.Empty; // 'image' or 'video'
    public string AssetUrl { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public string? Description { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public int LikeCount { get; set; }
    public int DislikeCount { get; set; }
    public bool? UserLiked { get; set; } // null = not voted, true = liked, false = disliked
    public bool IsOwner { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class UploadVenueAssetDto
{
    public string AssetType { get; set; } = "image"; // 'image' or 'video'
    public string AssetUrl { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public string? Description { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public long? FileSizeBytes { get; set; }
    public string? MimeType { get; set; }
}

public class VenueAssetLikeDto
{
    public bool IsLike { get; set; } // true = like, false = dislike
}

// Check nearby venues request/response
public class CheckNearbyVenuesRequest
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double RadiusYards { get; set; } = 200;
}

public class NearbyVenuesResponse
{
    public List<NearbyVenueDto> NearbyVenues { get; set; } = new();
    public bool HasDuplicates => NearbyVenues.Count > 0;
}

public class NearbyVenueDto
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double DistanceYards { get; set; }
    public int? IndoorNum { get; set; }
    public int? OutdoorNum { get; set; }
    public bool HasLights { get; set; }
}

// Add new venue request
public class AddVenueRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Addr1 { get; set; }
    public string? Addr2 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Zip { get; set; }
    public string? Country { get; set; }
    public string? Phone { get; set; }
    public string? Website { get; set; }
    public string? Email { get; set; }
    public int? IndoorNum { get; set; }
    public int? OutdoorNum { get; set; }
    public int? CoveredNum { get; set; }
    public bool HasLights { get; set; }
    public int? VenueTypeId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}

// Top venues for event creation (returned by sp_GetTopVenuesForUser)
public class TopVenueForEventDto
{
    public int VenueId { get; set; }
    public string? VenueName { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? Address { get; set; }
    public string? Zip { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public int? IndoorCourts { get; set; }
    public int? OutdoorCourts { get; set; }
    public bool HasLights { get; set; }
    public string? VenueTypeName { get; set; }
    public double? DistanceMiles { get; set; }
    public int PriorityScore { get; set; }
}
