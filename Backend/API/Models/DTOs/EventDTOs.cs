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
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public int? CourtId { get; set; }
    public string? PosterImageUrl { get; set; }
    public decimal RegistrationFee { get; set; }
    public decimal PerDivisionFee { get; set; }
    public string? PriceUnit { get; set; }
    public string? PaymentModel { get; set; }
    public int? MaxParticipants { get; set; }
    public int RegisteredCount { get; set; }
    public int RegisteredPlayerCount { get; set; }
    public int DivisionCount { get; set; }
    public int PrimaryTeamSize { get; set; } = 2; // Most common team size across divisions (1=singles, 2=pairs, 3+=teams)
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
    public string? CourtName { get; set; }
    public string? ContactName { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? PaymentInstructions { get; set; }

    // User's relationship
    public bool IsOrganizer { get; set; }
    public bool IsRegistered { get; set; }
    public List<int> RegisteredDivisionIds { get; set; } = new();
    public List<UserRegistrationInfoDto> MyRegistrations { get; set; } = new();

    /// <summary>
    /// User's pending join requests for units in this event
    /// </summary>
    public List<MyPendingJoinRequestDto> MyPendingJoinRequests { get; set; } = new();

    public List<EventDivisionDto> Divisions { get; set; } = new();
}

/// <summary>
/// Info about a pending join request the user has submitted
/// </summary>
public class MyPendingJoinRequestDto
{
    public int RequestId { get; set; }
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public string? TeamUnitName { get; set; }
    public string? CaptainName { get; set; }
    public string? CaptainProfileImageUrl { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Detailed info about user's registration in a division
/// </summary>
public class UserRegistrationInfoDto
{
    public int UnitId { get; set; }
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public string? TeamUnitName { get; set; }
    public string? SkillLevelName { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;

    // Payment info
    public string PaymentStatus { get; set; } = "Pending";
    public decimal AmountPaid { get; set; }
    public decimal AmountDue { get; set; }
    public string? PaymentProofUrl { get; set; }

    // Partner/team info
    public int RequiredPlayers { get; set; } = 1;
    public bool IsComplete { get; set; } = true;
    public bool NeedsPartner { get; set; } = false;
    public List<PartnerInfoDto> Partners { get; set; } = new();
}

/// <summary>
/// Info about a partner/team member
/// </summary>
public class PartnerInfoDto
{
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public string Role { get; set; } = "Player"; // Captain or Player
    public string InviteStatus { get; set; } = "Accepted"; // Pending, Accepted, Declined
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
    public int? SkillLevelId { get; set; }
    public string? SkillLevelName { get; set; }
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
    public int WaitlistedCount { get; set; }

    // Tournament structure
    public int? DefaultScoreFormatId { get; set; }
    public int? PoolCount { get; set; }
    public int? PoolSize { get; set; }
    public string? ScheduleType { get; set; }
    public string ScheduleStatus { get; set; } = "NotGenerated";
    public string? BracketType { get; set; }
    public int? PlayoffFromPools { get; set; }
    public int GamesPerMatch { get; set; } = 1;

    // Rewards
    public List<DivisionRewardDto> Rewards { get; set; } = new();
}

// DTO for updating a division
public class UpdateDivisionDto
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public int? TeamUnitId { get; set; }
    public int? AgeGroupId { get; set; }
    public int? SkillLevelId { get; set; }
    public int? MaxUnits { get; set; }
    public decimal? DivisionFee { get; set; }

    // Tournament structure
    public int? DefaultScoreFormatId { get; set; }
    public int? PoolCount { get; set; }
    public int? PoolSize { get; set; }
    public string? ScheduleType { get; set; }
    public string? BracketType { get; set; }
    public int? PlayoffFromPools { get; set; }
    public int? GamesPerMatch { get; set; }
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
    public bool AllowMultipleDivisions { get; set; } = true;
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
    public string? PriceUnit { get; set; }
    public string? PaymentModel { get; set; } = "per_unit";
    public string? ContactName { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? PaymentInstructions { get; set; }
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
    public int? SkillLevelId { get; set; }
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
    public string? PaymentInstructions { get; set; }
    public List<string> RegisteredDivisions { get; set; } = new();
    public string PaymentStatus { get; set; } = "Pending";
    public string Status { get; set; } = "Registered";

    /// <summary>
    /// Detailed registration info for each unit the user is in
    /// </summary>
    public List<MyRegistrationUnitDto> Units { get; set; } = new();
}

/// <summary>
/// Detailed info about a unit the user is registered in
/// </summary>
public class MyRegistrationUnitDto
{
    public int UnitId { get; set; }
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = string.Empty;
    public string? TeamUnitName { get; set; }
    public int RequiredPlayers { get; set; } = 1;
    public bool IsComplete { get; set; }
    public bool NeedsPartner { get; set; }
    public string Status { get; set; } = "Registered";

    // Payment info
    public string PaymentStatus { get; set; } = "Pending";
    public decimal AmountDue { get; set; }
    public decimal AmountPaid { get; set; }

    // Team members (including self)
    public List<TeamMemberDto> Members { get; set; } = new();
}

/// <summary>
/// Info about a team member
/// </summary>
public class TeamMemberDto
{
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public string Role { get; set; } = "Player"; // Captain or Player
    public string InviteStatus { get; set; } = "Accepted"; // Pending, Accepted, Declined
    public bool IsCurrentUser { get; set; }
}

// Featured events for home page
public class FeaturedEventsDto
{
    public List<EventDto> UpcomingEvents { get; set; } = new();
    public List<EventDto> PopularEvents { get; set; } = new();
    public List<EventDto> RecentPastEvents { get; set; } = new();
}

// Event document
public class EventDocumentDto
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string? FileType { get; set; }
    public int? FileSize { get; set; }
    public bool IsPublic { get; set; }
    public int SortOrder { get; set; }
    public int UploadedByUserId { get; set; }
    public string? UploadedByUserName { get; set; }
    public DateTime CreatedAt { get; set; }
}

// Create event document
public class CreateEventDocumentDto
{
    public string Title { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string? FileType { get; set; }
    public int? FileSize { get; set; }
    public bool IsPublic { get; set; } = true;
    public int SortOrder { get; set; } = 0;
}

// Update event document
public class UpdateEventDocumentDto
{
    public string? Title { get; set; }
    public bool? IsPublic { get; set; }
    public int? SortOrder { get; set; }
}
