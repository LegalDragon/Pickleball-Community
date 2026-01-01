namespace Pickleball.Community.Models.DTOs;

// Event list item
public class EventDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int EventTypeId { get; set; }
    public string? EventTypeName { get; set; }
    public string? EventTypeIcon { get; set; }
    public string? EventTypeColor { get; set; }
    public bool AllowMultipleDivisions { get; set; } = true;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public DateTime? RegistrationOpenDate { get; set; }
    public DateTime? RegistrationCloseDate { get; set; }
    public bool IsPublished { get; set; }
    public bool IsPrivate { get; set; }
    public string? VenueName { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? PosterImageUrl { get; set; }
    public decimal RegistrationFee { get; set; }
    public decimal PerDivisionFee { get; set; }
    public int? MaxParticipants { get; set; }
    public int RegisteredCount { get; set; }
    public int DivisionCount { get; set; }
    public double? Distance { get; set; }
    public int OrganizedByUserId { get; set; }
    public string? OrganizerName { get; set; }
    public int? OrganizedByClubId { get; set; }
    public string? ClubName { get; set; }
    public DateTime CreatedAt { get; set; }
}

// Event detail view
public class EventDetailDto : EventDto
{
    public string? BannerImageUrl { get; set; }
    public string? Address { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public int? CourtId { get; set; }
    public string? CourtName { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }

    // User's relationship
    public bool IsOrganizer { get; set; }
    public bool IsRegistered { get; set; }
    public List<int> RegisteredDivisionIds { get; set; } = new();

    public List<EventDivisionDto> Divisions { get; set; } = new();
}

// Event division
public class EventDivisionDto
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    // New structure
    public int? TeamUnitId { get; set; }
    public string? TeamUnitName { get; set; }
    public int? AgeGroupId { get; set; }
    public string? AgeGroupName { get; set; }
    public decimal? MinSkillRating { get; set; }
    public decimal? MaxSkillRating { get; set; }
    public int? MaxUnits { get; set; }

    // Legacy fields (for backward compatibility)
    public int TeamSize { get; set; } = 1;
    public string? SkillLevelMin { get; set; }
    public string? SkillLevelMax { get; set; }
    public string? Gender { get; set; }
    public string? AgeGroup { get; set; }
    public int? MaxTeams { get; set; }

    public decimal? DivisionFee { get; set; }
    public int SortOrder { get; set; }
    public int RegisteredCount { get; set; }
    public int LookingForPartnerCount { get; set; }

    // Rewards
    public List<DivisionRewardDto> Rewards { get; set; } = new();
}

// Division with registrations
public class DivisionDetailDto : EventDivisionDto
{
    public List<EventRegistrationDto> Registrations { get; set; } = new();
    public List<PartnerRequestDto> PartnerRequests { get; set; } = new();
}

// Event registration
public class EventRegistrationDto
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int DivisionId { get; set; }
    public string? DivisionName { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? UserProfileImageUrl { get; set; }
    public string? UserExperienceLevel { get; set; }
    public int? TeamId { get; set; }
    public string? TeamName { get; set; }
    public string PaymentStatus { get; set; } = "Pending";
    public decimal AmountPaid { get; set; }
    public string Status { get; set; } = "Registered";
    public DateTime RegisteredAt { get; set; }
    public DateTime? CheckedInAt { get; set; }
}

// Update registration request (for organizers)
public class UpdateRegistrationDto
{
    public string? PaymentStatus { get; set; }
    public decimal? AmountPaid { get; set; }
    public int? TeamId { get; set; }
    public string? TeamName { get; set; }
    public string? Status { get; set; }
    public bool? CheckedIn { get; set; }
}

// Partner request
public class PartnerRequestDto
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int DivisionId { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? UserProfileImageUrl { get; set; }
    public string? UserExperienceLevel { get; set; }
    public string? UserLocation { get; set; }
    public string? Message { get; set; }
    public bool IsLookingForPartner { get; set; }
    public int? RequestedByUserId { get; set; }
    public string? RequestedByUserName { get; set; }
    public string Status { get; set; } = "Open";
    public DateTime CreatedAt { get; set; }
}

// Create event request
public class CreateEventDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int EventTypeId { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public DateTime? RegistrationOpenDate { get; set; }
    public DateTime? RegistrationCloseDate { get; set; }
    public bool IsPrivate { get; set; } = false;
    public int? CourtId { get; set; }
    public string? VenueName { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? PosterImageUrl { get; set; }
    public string? BannerImageUrl { get; set; }
    public decimal RegistrationFee { get; set; } = 0;
    public decimal PerDivisionFee { get; set; } = 0;
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public int? OrganizedByClubId { get; set; }
    public int? MaxParticipants { get; set; }
    public List<CreateEventDivisionDto> Divisions { get; set; } = new();
}

// Create division
public class CreateEventDivisionDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    // New structure
    public int? TeamUnitId { get; set; }
    public int? AgeGroupId { get; set; }
    public decimal? MinSkillRating { get; set; }
    public decimal? MaxSkillRating { get; set; }
    public int? MaxUnits { get; set; }

    // Legacy fields (for backward compatibility)
    public int TeamSize { get; set; } = 1;
    public string? SkillLevelMin { get; set; }
    public string? SkillLevelMax { get; set; }
    public string? Gender { get; set; }
    public string? AgeGroup { get; set; }
    public int? MaxTeams { get; set; }

    public decimal? DivisionFee { get; set; }
    public int SortOrder { get; set; } = 0;

    // Rewards to create with this division
    public List<CreateDivisionRewardDto> Rewards { get; set; } = new();
}

// Update event request
public class UpdateEventDto : CreateEventDto
{
    public bool IsPublished { get; set; }
    public new List<UpdateEventDivisionDto> Divisions { get; set; } = new();
}

// Update division (includes ID for existing divisions)
public class UpdateEventDivisionDto : CreateEventDivisionDto
{
    public int? Id { get; set; }
}

// Event search request
public class EventSearchRequest
{
    public string? Query { get; set; }
    public int? EventTypeId { get; set; }
    public string? Country { get; set; }
    public string? State { get; set; }
    public string? City { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? RadiusMiles { get; set; } = 100;
    public DateTime? StartDateFrom { get; set; }
    public DateTime? StartDateTo { get; set; }
    public bool? IsUpcoming { get; set; } = true;
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

// Register for event
public class RegisterForEventDto
{
    public int DivisionId { get; set; }
    public string? TeamName { get; set; }
    public int? PartnerId { get; set; } // For doubles - partner user ID
}

// Partner request
public class CreatePartnerRequestDto
{
    public int DivisionId { get; set; }
    public string? Message { get; set; }
}

// Request to join someone looking for partner
public class JoinPartnerRequestDto
{
    public int PartnerRequestId { get; set; }
    public string? Message { get; set; }
}

// Accept/reject partner request
public class ReviewPartnerRequestDto
{
    public bool Accept { get; set; }
}

// My events response
public class MyEventsDto
{
    public List<EventDto> EventsIOrganize { get; set; } = new();
    public List<EventRegistrationSummaryDto> EventsImRegisteredFor { get; set; } = new();
}

// Registration summary for my events
public class EventRegistrationSummaryDto
{
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public string? VenueName { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? PosterImageUrl { get; set; }
    public List<string> RegisteredDivisions { get; set; } = new();
    public string PaymentStatus { get; set; } = "Pending";
    public string Status { get; set; } = "Registered";
}

// Featured events for home page
public class FeaturedEventsDto
{
    public List<EventDto> UpcomingEvents { get; set; } = new();
    public List<EventDto> PopularEvents { get; set; } = new();
    public List<EventDto> RecentPastEvents { get; set; } = new();
}
