namespace Pickleball.Community.Models.DTOs;

public class CourtDto
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
    public int? CourtTypeId { get; set; }
    public string? CourtTypeName { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? Distance { get; set; } // Calculated distance from user
    public CourtAggregatedInfoDto? AggregatedInfo { get; set; }
}

public class CourtAggregatedInfoDto
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
    public int NotACourtCount { get; set; } // Number of users who flagged this as not a court
    public string? MostSuggestedName { get; set; } // Most commonly suggested name
    public string? MostConfirmedAddress { get; set; }
    public string? MostConfirmedCity { get; set; }
    public string? MostConfirmedState { get; set; }
    public string? MostConfirmedCountry { get; set; }
}

public class CourtDetailDto : CourtDto
{
    public List<CourtConfirmationDto>? RecentConfirmations { get; set; }
    public CourtConfirmationDto? MyConfirmation { get; set; }
    public List<CourtAssetDto>? TopAssets { get; set; }
}

public class CourtConfirmationDto
{
    public int Id { get; set; }
    public int CourtId { get; set; }
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

public class SubmitCourtConfirmationDto
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

public class CourtSearchRequest
{
    public string? Query { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? RadiusMiles { get; set; } = 100;
    public string? Country { get; set; }
    public string? State { get; set; }
    public string? City { get; set; }
    public int? CourtTypeId { get; set; }
    public bool? HasLights { get; set; }
    public bool? IsIndoor { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

/// <summary>
/// DTO for location dropdown items with court counts
/// </summary>
public class LocationCountDto
{
    public string Name { get; set; } = string.Empty;
    public int Count { get; set; }
}

// Court Asset DTOs
public class CourtAssetDto
{
    public int Id { get; set; }
    public int CourtId { get; set; }
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

public class UploadCourtAssetDto
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

public class CourtAssetLikeDto
{
    public bool IsLike { get; set; } // true = like, false = dislike
}

// Check nearby courts request/response
public class CheckNearbyCourtsRequest
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double RadiusYards { get; set; } = 200;
}

public class NearbyCourtsResponse
{
    public List<NearbyCourtDto> NearbyCourts { get; set; } = new();
    public bool HasDuplicates => NearbyCourts.Count > 0;
}

public class NearbyCourtDto
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

// Add new court request
public class AddCourtRequest
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
    public int? CourtTypeId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}

// Top courts for event creation (returned by sp_GetTopCourtsForUser)
public class TopCourtForEventDto
{
    public int CourtId { get; set; }
    public string? CourtName { get; set; }
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
    public string? CourtTypeName { get; set; }
    public double? DistanceMiles { get; set; }
    public int PriorityScore { get; set; }
}
