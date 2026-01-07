namespace Pickleball.Community.Models.DTOs;

// League list item
public class LeagueDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Scope { get; set; } = "Local";
    public string? AvatarUrl { get; set; }
    public string? State { get; set; }
    public string? Region { get; set; }
    public string? Country { get; set; }
    public int? ParentLeagueId { get; set; }
    public string? ParentLeagueName { get; set; }
    // Root (top-level) league info for hierarchy display
    public int? RootLeagueId { get; set; }
    public string? RootLeagueName { get; set; }
    public string? RootLeagueAvatarUrl { get; set; }
    public int ChildLeagueCount { get; set; }
    public int ClubCount { get; set; }
    public int ManagerCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

// Managed league info for user menu
public class ManagedLeagueDto
{
    public int LeagueId { get; set; }
    public string LeagueName { get; set; } = string.Empty;
    public string LeagueScope { get; set; } = "Local";
    public string? LeagueAvatarUrl { get; set; }
    public int RootLeagueId { get; set; }
    public string RootLeagueName { get; set; } = string.Empty;
    public string? RootLeagueAvatarUrl { get; set; }
}

// League detail view
public class LeagueDetailDto : LeagueDto
{
    public string? BannerUrl { get; set; }
    public string? Website { get; set; }
    public string? ContactEmail { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public List<LeagueDto> ChildLeagues { get; set; } = new();
    public List<LeagueManagerDto> Managers { get; set; } = new();
    public List<LeagueClubDto> Clubs { get; set; } = new();
    public List<LeagueClubRequestDto> PendingRequests { get; set; } = new();
    public List<LeagueDocumentDto> Documents { get; set; } = new();

    // Hierarchy path (e.g., "USA Pickleball > Southeast Region > Florida")
    public List<LeagueBreadcrumbDto> Breadcrumbs { get; set; } = new();

    // Current user's role in this league (if any)
    public string? CurrentUserRole { get; set; }
    public bool CanManage { get; set; }
}

public class LeagueBreadcrumbDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Scope { get; set; } = string.Empty;
}

// League manager
public class LeagueManagerDto
{
    public int Id { get; set; }
    public int LeagueId { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? UserProfileImageUrl { get; set; }
    public string Role { get; set; } = string.Empty;
    public string? Title { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

// Club in league
public class LeagueClubDto
{
    public int Id { get; set; }
    public int LeagueId { get; set; }
    public int ClubId { get; set; }
    public string ClubName { get; set; } = string.Empty;
    public string? ClubLogoUrl { get; set; }
    public string? ClubCity { get; set; }
    public string? ClubState { get; set; }
    public int ClubMemberCount { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime JoinedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string? Notes { get; set; }
}

// Club join request
public class LeagueClubRequestDto
{
    public int Id { get; set; }
    public int LeagueId { get; set; }
    public string LeagueName { get; set; } = string.Empty;
    public int ClubId { get; set; }
    public string ClubName { get; set; } = string.Empty;
    public string? ClubLogoUrl { get; set; }
    public string? ClubCity { get; set; }
    public string? ClubState { get; set; }
    public int RequestedByUserId { get; set; }
    public string RequestedByName { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public string? Message { get; set; }
    public string? ResponseMessage { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
}

// Create league request
public class CreateLeagueDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Scope { get; set; } = "Local";
    public string? AvatarUrl { get; set; }
    public string? BannerUrl { get; set; }
    public string? Website { get; set; }
    public string? ContactEmail { get; set; }
    public int? ParentLeagueId { get; set; }
    public string? State { get; set; }
    public string? Region { get; set; }
    public string? Country { get; set; }
    public int SortOrder { get; set; } = 0;
}

// Update league request
public class UpdateLeagueDto : CreateLeagueDto
{
}

// Add/update manager request
public class ManageLeagueManagerDto
{
    public int UserId { get; set; }
    public string Role { get; set; } = "Admin";
    public string? Title { get; set; }
}

// Club join request from club side
public class RequestJoinLeagueDto
{
    public int LeagueId { get; set; }
    public string? Message { get; set; }
}

// Process club request (approve/reject)
public class ProcessClubRequestDto
{
    public bool Approve { get; set; }
    public string? ResponseMessage { get; set; }
}

// Update club membership
public class UpdateLeagueClubDto
{
    public string Status { get; set; } = "Active";
    public DateTime? ExpiresAt { get; set; }
    public string? Notes { get; set; }
}

// League hierarchy tree node
public class LeagueTreeNodeDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Scope { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public int ClubCount { get; set; }
    public List<LeagueTreeNodeDto> Children { get; set; } = new();
}

// Search/filter leagues
public class LeagueSearchRequest
{
    public string? Query { get; set; }
    public string? Scope { get; set; }
    public string? State { get; set; }
    public string? Region { get; set; }
    public string? Country { get; set; }
    public int? ParentLeagueId { get; set; }
    public bool? RootOnly { get; set; } // Only return top-level leagues
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

// League document
public class LeagueDocumentDto
{
    public int Id { get; set; }
    public int LeagueId { get; set; }
    public string? LeagueName { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string FileUrl { get; set; } = string.Empty;
    public string? FileName { get; set; }
    public string? FileType { get; set; }
    public long? FileSize { get; set; }
    public int SortOrder { get; set; }
    public bool IsPublic { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? UploadedByUserId { get; set; }
    public string? UploadedByName { get; set; }
}

// Create/Update league document
public class CreateLeagueDocumentDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string FileUrl { get; set; } = string.Empty;
    public string? FileName { get; set; }
    public string? FileType { get; set; }
    public long? FileSize { get; set; }
    public int SortOrder { get; set; } = 0;
    public bool IsPublic { get; set; } = true;
}

// Update document order
public class UpdateDocumentOrderDto
{
    public List<int> DocumentIds { get; set; } = new();
}

// League Role DTO
public class LeagueRoleDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public int SortOrder { get; set; }
    public bool IsSystemRole { get; set; }
    public bool CanManageLeague { get; set; }
    public bool CanManageMembers { get; set; }
    public bool CanManageClubs { get; set; }
    public bool CanManageDocuments { get; set; }
    public bool CanApproveRequests { get; set; }
    public bool IsActive { get; set; }
}

// Create League Role
public class CreateLeagueRoleDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public int SortOrder { get; set; } = 50;
    public bool CanManageLeague { get; set; } = false;
    public bool CanManageMembers { get; set; } = false;
    public bool CanManageClubs { get; set; } = false;
    public bool CanManageDocuments { get; set; } = false;
    public bool CanApproveRequests { get; set; } = false;
    public bool IsActive { get; set; } = true;
}

// Update League Role
public class UpdateLeagueRoleDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public int SortOrder { get; set; }
    public bool CanManageLeague { get; set; }
    public bool CanManageMembers { get; set; }
    public bool CanManageClubs { get; set; }
    public bool CanManageDocuments { get; set; }
    public bool CanApproveRequests { get; set; }
    public bool IsActive { get; set; }
}
