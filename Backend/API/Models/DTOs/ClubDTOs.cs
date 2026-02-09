namespace Pickleball.Community.Models.DTOs;

// Club list item
public class ClubDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? LogoUrl { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public bool IsPublic { get; set; }
    public bool HasMembershipFee { get; set; }
    public string? MembershipFeeAmount { get; set; }
    public int MemberCount { get; set; }
    public double? Distance { get; set; } // Calculated distance from user
    public DateTime CreatedAt { get; set; }

    // GPS coordinates for map view
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    // Home venue
    public int? HomeVenueId { get; set; }
    public string? HomeVenueName { get; set; }
}

// Club detail view
public class ClubDetailDto : ClubDto
{
    public string? BannerUrl { get; set; }
    public string? Address { get; set; }
    public string? PostalCode { get; set; }
    // Latitude/Longitude inherited from ClubDto
    public string? Website { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public bool RequiresApproval { get; set; }
    public bool ChatEnabled { get; set; } // Whether club chat is enabled
    public string? InviteCode { get; set; } // Only for admins
    public int CreatedByUserId { get; set; }
    public string? CreatedByUserName { get; set; }

    // Membership fee details
    public string? MembershipFeePeriod { get; set; }
    public string? PaymentInstructions { get; set; } // Only visible to members/admins

    // User's relationship with this club
    public bool IsMember { get; set; }
    public bool IsAdmin { get; set; }
    public bool IsModerator { get; set; }
    public bool HasPendingRequest { get; set; }

    // Current user's membership info
    public DateTime? MyMembershipValidTo { get; set; }
    public string? MyTitle { get; set; }

    public List<ClubMemberDto>? RecentMembers { get; set; }
}

// Club member
public class ClubMemberDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public string? ExperienceLevel { get; set; }
    public string? Location { get; set; }
    public string Role { get; set; } = "Member";
    public string? Title { get; set; } // Custom title like "Treasurer"
    public DateTime JoinedAt { get; set; }
    public DateTime? MembershipValidTo { get; set; }
    public string? MembershipNotes { get; set; } // Only visible to admins
    public bool IsMembershipExpired { get; set; } // Computed: MembershipValidTo < now
}

// Club join request
public class ClubJoinRequestDto
{
    public int Id { get; set; }
    public int ClubId { get; set; }
    public string ClubName { get; set; } = string.Empty;
    public string? ClubLogoUrl { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? UserProfileImageUrl { get; set; }
    public string? UserExperienceLevel { get; set; }
    public string? UserLocation { get; set; }
    public string? Message { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; }
    public int? ReviewedByUserId { get; set; }
    public string? ReviewedByUserName { get; set; }
    public DateTime? ReviewedAt { get; set; }
}

// Club notification
public class ClubNotificationDto
{
    public int Id { get; set; }
    public int ClubId { get; set; }
    public string ClubName { get; set; } = string.Empty;
    public int SentByUserId { get; set; }
    public string SentByUserName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTime SentAt { get; set; }
}

// Create club request
public class CreateClubDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? LogoUrl { get; set; }
    public string? BannerUrl { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? PostalCode { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? Website { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public bool IsPublic { get; set; } = true;
    public bool RequiresApproval { get; set; } = true;
    public bool HasMembershipFee { get; set; } = false;
    public string? MembershipFeeAmount { get; set; }
    public string? MembershipFeePeriod { get; set; }
    public string? PaymentInstructions { get; set; }
    public int? HomeVenueId { get; set; }
}

// Update club request
public class UpdateClubDto : CreateClubDto
{
}

// Update club coordinates (for geocoding cache)
public class UpdateClubCoordinatesDto
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}

// Club search request
public class ClubSearchRequest
{
    public string? Query { get; set; }
    public string? Country { get; set; }
    public string? State { get; set; }
    public string? City { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? RadiusMiles { get; set; } = 100;
    // Map bounds for viewport-based search
    public double? MinLat { get; set; }
    public double? MaxLat { get; set; }
    public double? MinLng { get; set; }
    public double? MaxLng { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

// Join club request
public class JoinClubRequestDto
{
    public string? Message { get; set; }
    public string? InviteCode { get; set; } // If joining via invite link
}

// Review join request
public class ReviewJoinRequestDto
{
    public bool Approve { get; set; }
}

// Update member role and details
public class UpdateMemberRoleDto
{
    public string Role { get; set; } = "Member"; // Admin, Moderator, Member
    public string? Title { get; set; } // Custom title like "Treasurer"
}

// Update member details (for admins)
public class UpdateMemberDto
{
    public string? Role { get; set; }
    public string? Title { get; set; }
    public DateTime? MembershipValidTo { get; set; }
    public string? MembershipNotes { get; set; }
}

// Send notification
public class SendClubNotificationDto
{
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

// My clubs response
public class MyClubsDto
{
    public List<ClubDto> ClubsIManage { get; set; } = new();
    public List<ClubDto> ClubsIBelong { get; set; } = new();
    public List<ClubJoinRequestDto> PendingRequests { get; set; } = new();
}

// Club Member Role DTO
public class ClubMemberRoleDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public int SortOrder { get; set; }
    public bool IsSystemRole { get; set; }
    public bool CanManageMembers { get; set; }
    public bool CanManageClub { get; set; }
    public bool CanPostAnnouncements { get; set; }
    public bool IsActive { get; set; }
}

// Create Club Member Role
public class CreateClubMemberRoleDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public int SortOrder { get; set; } = 50;
    public bool CanManageMembers { get; set; } = false;
    public bool CanManageClub { get; set; } = false;
    public bool CanPostAnnouncements { get; set; } = false;
    public bool IsActive { get; set; } = true;
}

// Update Club Member Role
public class UpdateClubMemberRoleDto
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public int? SortOrder { get; set; }
    public bool? CanManageMembers { get; set; }
    public bool? CanManageClub { get; set; }
    public bool? CanPostAnnouncements { get; set; }
    public bool? IsActive { get; set; }
}

// Club Document DTO
public class ClubDocumentDto
{
    public int Id { get; set; }
    public int ClubId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string FileUrl { get; set; } = string.Empty;
    public string? FileName { get; set; }
    public string FileType { get; set; } = "Other"; // Image, PDF, Document, Video, Spreadsheet, Presentation, Other
    public string? MimeType { get; set; }
    public long? FileSizeBytes { get; set; }
    public string Visibility { get; set; } = "Member"; // Public, Member, Admin
    public int SortOrder { get; set; }
    public int UploadedByUserId { get; set; }
    public string UploadedByUserName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// Create Club Document
public class CreateClubDocumentDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string FileUrl { get; set; } = string.Empty;
    public string? FileName { get; set; }
    public string? MimeType { get; set; }
    public long? FileSizeBytes { get; set; }
    public string Visibility { get; set; } = "Member"; // Public, Member, Admin
    public int SortOrder { get; set; } = 0;
}

// Update Club Document
public class UpdateClubDocumentDto
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? Visibility { get; set; }
    public int? SortOrder { get; set; }
}

// Document order for reordering
public class DocumentOrderDto
{
    public int DocumentId { get; set; }
    public int SortOrder { get; set; }
}

// Lightweight DTO for recently created clubs marquee
public class RecentClubDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public int MemberCount { get; set; }
    public DateTime CreatedAt { get; set; }
}
