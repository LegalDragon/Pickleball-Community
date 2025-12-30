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
    public int MemberCount { get; set; }
    public double? Distance { get; set; } // Calculated distance from user
    public DateTime CreatedAt { get; set; }
}

// Club detail view
public class ClubDetailDto : ClubDto
{
    public string? BannerUrl { get; set; }
    public string? Address { get; set; }
    public string? PostalCode { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? Website { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public bool RequiresApproval { get; set; }
    public string? InviteCode { get; set; } // Only for admins
    public int CreatedByUserId { get; set; }
    public string? CreatedByUserName { get; set; }

    // User's relationship with this club
    public bool IsMember { get; set; }
    public bool IsAdmin { get; set; }
    public bool IsModerator { get; set; }
    public bool HasPendingRequest { get; set; }

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
    public DateTime JoinedAt { get; set; }
}

// Club join request
public class ClubJoinRequestDto
{
    public int Id { get; set; }
    public int ClubId { get; set; }
    public string ClubName { get; set; } = string.Empty;
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
}

// Update club request
public class UpdateClubDto : CreateClubDto
{
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

// Update member role
public class UpdateMemberRoleDto
{
    public string Role { get; set; } = "Member"; // Admin, Moderator, Member
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
