using Microsoft.EntityFrameworkCore;
using Pickleball.Community.API.Models.DTOs;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using System.Security.Cryptography;

namespace Pickleball.Community.Services;

public interface IPlayerCertificationService
{
    // Knowledge Levels (Admin)
    Task<List<KnowledgeLevelDto>> GetKnowledgeLevelsAsync(bool activeOnly = true);
    Task<KnowledgeLevelDto?> GetKnowledgeLevelAsync(int id);
    Task<KnowledgeLevelDto> CreateKnowledgeLevelAsync(CreateKnowledgeLevelDto dto);
    Task<KnowledgeLevelDto?> UpdateKnowledgeLevelAsync(int id, UpdateKnowledgeLevelDto dto);
    Task<bool> DeleteKnowledgeLevelAsync(int id);

    // Skill Groups (Admin)
    Task<List<SkillGroupDto>> GetSkillGroupsAsync(bool activeOnly = true);
    Task<SkillGroupDto?> GetSkillGroupAsync(int id);
    Task<SkillGroupDto> CreateSkillGroupAsync(CreateSkillGroupDto dto);
    Task<SkillGroupDto?> UpdateSkillGroupAsync(int id, UpdateSkillGroupDto dto);
    Task<bool> DeleteSkillGroupAsync(int id);

    // Skill Areas (Admin)
    Task<List<SkillAreaDto>> GetSkillAreasAsync(bool activeOnly = true);
    Task<SkillAreaDto?> GetSkillAreaAsync(int id);
    Task<SkillAreaDto> CreateSkillAreaAsync(CreateSkillAreaDto dto);
    Task<SkillAreaDto?> UpdateSkillAreaAsync(int id, UpdateSkillAreaDto dto);
    Task<bool> DeleteSkillAreaAsync(int id);

    // Certification Requests (Student)
    Task<CertificationRequestDto> CreateRequestAsync(int studentId, CreateCertificationRequestDto dto, string baseUrl);
    Task<CertificationRequestDto?> GetOrCreateActiveRequestAsync(int studentId, string baseUrl);
    Task<List<CertificationRequestDto>> GetStudentRequestsAsync(int studentId, string baseUrl);
    Task<CertificationRequestDto?> GetRequestAsync(int requestId, int studentId, string baseUrl);
    Task<CertificationRequestDto?> UpdateRequestAsync(int requestId, int studentId, UpdateCertificationRequestDto dto, string baseUrl);
    Task<bool> DeactivateRequestAsync(int requestId, int studentId);

    // Invitations (Student)
    Task<InvitablePeersDto> GetInvitablePeersAsync(int studentId);
    Task<List<CertificationInvitationDto>> GetInvitationsAsync(int requestId, int studentId);
    Task<int> InvitePeersAsync(int requestId, int studentId, InvitePeersDto dto);

    // Pending Reviews (Invited User)
    Task<List<PendingReviewInvitationDto>> GetMyPendingReviewsAsync(int userId, string baseUrl);

    // Review Page (Public)
    Task<ReviewPageInfoDto> GetReviewPageInfoAsync(string token, int? currentUserId);
    Task<bool> SubmitReviewAsync(string token, SubmitReviewDto dto, int? currentUserId);

    // Certificate View (Student)
    Task<CertificateSummaryDto?> GetCertificateSummaryAsync(int studentId);
}

public class PlayerCertificationService : IPlayerCertificationService
{
    private readonly ApplicationDbContext _context;
    private readonly INotificationService _notificationService;

    public PlayerCertificationService(ApplicationDbContext context, INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    #region Knowledge Levels

    public async Task<List<KnowledgeLevelDto>> GetKnowledgeLevelsAsync(bool activeOnly = true)
    {
        var query = _context.KnowledgeLevels.AsQueryable();
        if (activeOnly)
            query = query.Where(k => k.IsActive);

        return await query
            .OrderBy(k => k.SortOrder)
            .Select(k => MapToKnowledgeLevelDto(k))
            .ToListAsync();
    }

    public async Task<KnowledgeLevelDto?> GetKnowledgeLevelAsync(int id)
    {
        var entity = await _context.KnowledgeLevels.FindAsync(id);
        return entity == null ? null : MapToKnowledgeLevelDto(entity);
    }

    public async Task<KnowledgeLevelDto> CreateKnowledgeLevelAsync(CreateKnowledgeLevelDto dto)
    {
        var entity = new KnowledgeLevel
        {
            Name = dto.Name,
            Description = dto.Description,
            SortOrder = dto.SortOrder,
            IsActive = dto.IsActive
        };

        _context.KnowledgeLevels.Add(entity);
        await _context.SaveChangesAsync();

        return MapToKnowledgeLevelDto(entity);
    }

    public async Task<KnowledgeLevelDto?> UpdateKnowledgeLevelAsync(int id, UpdateKnowledgeLevelDto dto)
    {
        var entity = await _context.KnowledgeLevels.FindAsync(id);
        if (entity == null) return null;

        entity.Name = dto.Name;
        entity.Description = dto.Description;
        entity.SortOrder = dto.SortOrder;
        entity.IsActive = dto.IsActive;
        entity.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();
        return MapToKnowledgeLevelDto(entity);
    }

    public async Task<bool> DeleteKnowledgeLevelAsync(int id)
    {
        var entity = await _context.KnowledgeLevels.FindAsync(id);
        if (entity == null) return false;

        // Check if in use
        var inUse = await _context.PlayerCertificationReviews.AnyAsync(r => r.KnowledgeLevelId == id);
        if (inUse)
        {
            // Soft delete by deactivating
            entity.IsActive = false;
            entity.UpdatedAt = DateTime.Now;
        }
        else
        {
            _context.KnowledgeLevels.Remove(entity);
        }

        await _context.SaveChangesAsync();
        return true;
    }

    #endregion

    #region Skill Groups

    public async Task<List<SkillGroupDto>> GetSkillGroupsAsync(bool activeOnly = true)
    {
        var query = _context.SkillGroups
            .Include(g => g.SkillAreas.Where(s => !activeOnly || s.IsActive))
            .AsQueryable();

        if (activeOnly)
            query = query.Where(g => g.IsActive);

        var groups = await query
            .OrderBy(g => g.SortOrder)
            .ToListAsync();

        return groups.Select(MapToSkillGroupDto).ToList();
    }

    public async Task<SkillGroupDto?> GetSkillGroupAsync(int id)
    {
        var entity = await _context.SkillGroups
            .Include(g => g.SkillAreas)
            .FirstOrDefaultAsync(g => g.Id == id);
        return entity == null ? null : MapToSkillGroupDto(entity);
    }

    public async Task<SkillGroupDto> CreateSkillGroupAsync(CreateSkillGroupDto dto)
    {
        var entity = new SkillGroup
        {
            Name = dto.Name,
            Description = dto.Description,
            Weight = dto.Weight,
            SortOrder = dto.SortOrder,
            IsActive = dto.IsActive
        };

        _context.SkillGroups.Add(entity);
        await _context.SaveChangesAsync();

        return MapToSkillGroupDto(entity);
    }

    public async Task<SkillGroupDto?> UpdateSkillGroupAsync(int id, UpdateSkillGroupDto dto)
    {
        var entity = await _context.SkillGroups.FindAsync(id);
        if (entity == null) return null;

        entity.Name = dto.Name;
        entity.Description = dto.Description;
        entity.Weight = dto.Weight;
        entity.SortOrder = dto.SortOrder;
        entity.IsActive = dto.IsActive;
        entity.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();
        return MapToSkillGroupDto(entity);
    }

    public async Task<bool> DeleteSkillGroupAsync(int id)
    {
        var entity = await _context.SkillGroups.FindAsync(id);
        if (entity == null) return false;

        // Check if any skill areas reference this group
        var hasSkillAreas = await _context.SkillAreas.AnyAsync(s => s.SkillGroupId == id);
        if (hasSkillAreas)
        {
            // Soft delete by deactivating
            entity.IsActive = false;
            entity.UpdatedAt = DateTime.Now;
        }
        else
        {
            _context.SkillGroups.Remove(entity);
        }

        await _context.SaveChangesAsync();
        return true;
    }

    #endregion

    #region Skill Areas

    public async Task<List<SkillAreaDto>> GetSkillAreasAsync(bool activeOnly = true)
    {
        var query = _context.SkillAreas
            .Include(s => s.SkillGroup)
            .AsQueryable();

        if (activeOnly)
            query = query.Where(s => s.IsActive);

        var areas = await query
            .OrderBy(s => s.SkillGroup != null ? s.SkillGroup.SortOrder : 999)
            .ThenBy(s => s.SortOrder)
            .ToListAsync();

        return areas.Select(MapToSkillAreaDto).ToList();
    }

    public async Task<SkillAreaDto?> GetSkillAreaAsync(int id)
    {
        var entity = await _context.SkillAreas
            .Include(s => s.SkillGroup)
            .FirstOrDefaultAsync(s => s.Id == id);
        return entity == null ? null : MapToSkillAreaDto(entity);
    }

    public async Task<SkillAreaDto> CreateSkillAreaAsync(CreateSkillAreaDto dto)
    {
        var entity = new SkillArea
        {
            Name = dto.Name,
            Description = dto.Description,
            Category = dto.Category,
            SkillGroupId = dto.SkillGroupId,
            SortOrder = dto.SortOrder,
            IsActive = dto.IsActive
        };

        _context.SkillAreas.Add(entity);
        await _context.SaveChangesAsync();

        // Reload with group
        await _context.Entry(entity).Reference(s => s.SkillGroup).LoadAsync();
        return MapToSkillAreaDto(entity);
    }

    public async Task<SkillAreaDto?> UpdateSkillAreaAsync(int id, UpdateSkillAreaDto dto)
    {
        var entity = await _context.SkillAreas.FindAsync(id);
        if (entity == null) return null;

        entity.Name = dto.Name;
        entity.Description = dto.Description;
        entity.Category = dto.Category;
        entity.SkillGroupId = dto.SkillGroupId;
        entity.SortOrder = dto.SortOrder;
        entity.IsActive = dto.IsActive;
        entity.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        // Reload with group
        await _context.Entry(entity).Reference(s => s.SkillGroup).LoadAsync();
        return MapToSkillAreaDto(entity);
    }

    public async Task<bool> DeleteSkillAreaAsync(int id)
    {
        var entity = await _context.SkillAreas.FindAsync(id);
        if (entity == null) return false;

        // Check if in use
        var inUse = await _context.PlayerCertificationScores.AnyAsync(s => s.SkillAreaId == id);
        if (inUse)
        {
            // Soft delete by deactivating
            entity.IsActive = false;
            entity.UpdatedAt = DateTime.Now;
        }
        else
        {
            _context.SkillAreas.Remove(entity);
        }

        await _context.SaveChangesAsync();
        return true;
    }

    #endregion

    #region Certification Requests

    public async Task<CertificationRequestDto> CreateRequestAsync(int studentId, CreateCertificationRequestDto dto, string baseUrl)
    {
        var token = GenerateSecureToken();

        // Parse visibility
        var visibility = ReviewVisibility.Anyone;
        if (Enum.TryParse<ReviewVisibility>(dto.Visibility, true, out var parsed))
            visibility = parsed;

        var entity = new PlayerCertificationRequest
        {
            StudentId = studentId,
            Token = token,
            Message = dto.Message,
            Visibility = visibility,
            ExpiresAt = dto.ExpiresAt,
            IsActive = true
        };

        _context.PlayerCertificationRequests.Add(entity);
        await _context.SaveChangesAsync();

        // Reload with student and invitations
        await _context.Entry(entity).Reference(r => r.Student).LoadAsync();
        await _context.Entry(entity).Collection(r => r.Invitations).LoadAsync();

        return MapToRequestDto(entity, baseUrl);
    }

    public async Task<CertificationRequestDto?> GetOrCreateActiveRequestAsync(int studentId, string baseUrl)
    {
        // Get existing active request or create a new one
        var existingRequest = await _context.PlayerCertificationRequests
            .Include(r => r.Student)
            .Include(r => r.Reviews)
            .Include(r => r.Invitations)
            .FirstOrDefaultAsync(r => r.StudentId == studentId && r.IsActive);

        if (existingRequest != null)
        {
            return MapToRequestDto(existingRequest, baseUrl);
        }

        // Create a new request
        return await CreateRequestAsync(studentId, new CreateCertificationRequestDto(), baseUrl);
    }

    public async Task<List<CertificationRequestDto>> GetStudentRequestsAsync(int studentId, string baseUrl)
    {
        var requests = await _context.PlayerCertificationRequests
            .Include(r => r.Student)
            .Include(r => r.Reviews)
            .Include(r => r.Invitations)
            .Where(r => r.StudentId == studentId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return requests.Select(r => MapToRequestDto(r, baseUrl)).ToList();
    }

    public async Task<CertificationRequestDto?> GetRequestAsync(int requestId, int studentId, string baseUrl)
    {
        var request = await _context.PlayerCertificationRequests
            .Include(r => r.Student)
            .Include(r => r.Reviews)
            .Include(r => r.Invitations)
            .FirstOrDefaultAsync(r => r.Id == requestId && r.StudentId == studentId);

        return request == null ? null : MapToRequestDto(request, baseUrl);
    }

    public async Task<CertificationRequestDto?> UpdateRequestAsync(int requestId, int studentId, UpdateCertificationRequestDto dto, string baseUrl)
    {
        var request = await _context.PlayerCertificationRequests
            .Include(r => r.Student)
            .Include(r => r.Reviews)
            .Include(r => r.Invitations)
            .FirstOrDefaultAsync(r => r.Id == requestId && r.StudentId == studentId);

        if (request == null) return null;

        if (dto.Message != null)
            request.Message = dto.Message;

        if (dto.Visibility != null && Enum.TryParse<ReviewVisibility>(dto.Visibility, true, out var visibility))
            request.Visibility = visibility;

        await _context.SaveChangesAsync();

        return MapToRequestDto(request, baseUrl);
    }

    public async Task<bool> DeactivateRequestAsync(int requestId, int studentId)
    {
        var request = await _context.PlayerCertificationRequests
            .FirstOrDefaultAsync(r => r.Id == requestId && r.StudentId == studentId);

        if (request == null) return false;

        request.IsActive = false;
        await _context.SaveChangesAsync();
        return true;
    }

    #endregion

    #region Invitations

    public async Task<InvitablePeersDto> GetInvitablePeersAsync(int studentId)
    {
        // Get active request for this student
        var request = await _context.PlayerCertificationRequests
            .Include(r => r.Invitations)
            .Include(r => r.Reviews)
            .FirstOrDefaultAsync(r => r.StudentId == studentId && r.IsActive);

        var invitedUserIds = request?.Invitations.Select(i => i.InvitedUserId).ToHashSet() ?? new HashSet<int>();
        var reviewedUserIds = request?.Reviews.Where(r => r.ReviewerId.HasValue).Select(r => r.ReviewerId!.Value).ToHashSet() ?? new HashSet<int>();

        // Get friends
        var friendships = await _context.Friendships
            .Include(f => f.User1)
            .Include(f => f.User2)
            .Where(f => f.UserId1 == studentId || f.UserId2 == studentId)
            .ToListAsync();

        var friends = friendships.Select(f =>
        {
            var friend = f.UserId1 == studentId ? f.User2 : f.User1;
            return new InvitableUserDto
            {
                UserId = friend.Id,
                Name = $"{friend.FirstName} {friend.LastName}",
                ProfileImageUrl = friend.ProfileImageUrl,
                AlreadyInvited = invitedUserIds.Contains(friend.Id),
                HasReviewed = reviewedUserIds.Contains(friend.Id)
            };
        }).ToList();

        // Get clubs where student is a member and their members
        var studentClubIds = await _context.ClubMembers
            .Where(m => m.UserId == studentId)
            .Select(m => m.ClubId)
            .ToListAsync();

        var clubs = new List<ClubWithMembersDto>();
        foreach (var clubId in studentClubIds)
        {
            var club = await _context.Clubs
                .Include(c => c.Members)
                    .ThenInclude(m => m.User)
                .FirstOrDefaultAsync(c => c.Id == clubId);

            if (club != null)
            {
                var members = club.Members
                    .Where(m => m.UserId != studentId) // Exclude self
                    .Select(m => new InvitableUserDto
                    {
                        UserId = m.UserId,
                        Name = $"{m.User.FirstName} {m.User.LastName}",
                        ProfileImageUrl = m.User.ProfileImageUrl,
                        AlreadyInvited = invitedUserIds.Contains(m.UserId),
                        HasReviewed = reviewedUserIds.Contains(m.UserId)
                    })
                    .ToList();

                clubs.Add(new ClubWithMembersDto
                {
                    ClubId = club.Id,
                    ClubName = club.Name,
                    Members = members
                });
            }
        }

        return new InvitablePeersDto
        {
            Friends = friends,
            Clubs = clubs
        };
    }

    public async Task<List<CertificationInvitationDto>> GetInvitationsAsync(int requestId, int studentId)
    {
        var request = await _context.PlayerCertificationRequests
            .FirstOrDefaultAsync(r => r.Id == requestId && r.StudentId == studentId);

        if (request == null) return new List<CertificationInvitationDto>();

        var invitations = await _context.PlayerCertificationInvitations
            .Include(i => i.InvitedUser)
            .Where(i => i.RequestId == requestId)
            .OrderByDescending(i => i.InvitedAt)
            .ToListAsync();

        return invitations.Select(i => new CertificationInvitationDto
        {
            Id = i.Id,
            UserId = i.InvitedUserId,
            UserName = $"{i.InvitedUser.FirstName} {i.InvitedUser.LastName}",
            ProfileImageUrl = i.InvitedUser.ProfileImageUrl,
            HasReviewed = i.HasReviewed,
            InvitedAt = i.InvitedAt,
            ReviewedAt = i.ReviewedAt
        }).ToList();
    }

    public async Task<int> InvitePeersAsync(int requestId, int studentId, InvitePeersDto dto)
    {
        var request = await _context.PlayerCertificationRequests
            .Include(r => r.Invitations)
            .Include(r => r.Student)
            .FirstOrDefaultAsync(r => r.Id == requestId && r.StudentId == studentId);

        if (request == null) return 0;

        var existingInvitedIds = request.Invitations.Select(i => i.InvitedUserId).ToHashSet();
        var newInvitedUserIds = new List<int>();

        foreach (var userId in dto.UserIds)
        {
            if (userId == studentId) continue; // Can't invite self
            if (existingInvitedIds.Contains(userId)) continue; // Already invited

            _context.PlayerCertificationInvitations.Add(new PlayerCertificationInvitation
            {
                RequestId = requestId,
                InvitedUserId = userId,
                InvitedAt = DateTime.Now
            });
            newInvitedUserIds.Add(userId);
        }

        await _context.SaveChangesAsync();

        // Send notifications to newly invited users
        if (newInvitedUserIds.Count > 0)
        {
            var studentName = request.Student != null
                ? $"{request.Student.FirstName} {request.Student.LastName}".Trim()
                : "A player";

            await _notificationService.CreateAndSendToUsersAsync(
                newInvitedUserIds,
                "PeerReviewRequest",
                "Skill Review Request",
                $"{studentName} is asking you to review their pickleball skills",
                $"/review/{request.Token}",
                "CertificationRequest",
                requestId
            );
        }

        return newInvitedUserIds.Count;
    }

    #endregion

    #region Pending Reviews (Invited User)

    public async Task<List<PendingReviewInvitationDto>> GetMyPendingReviewsAsync(int userId, string baseUrl)
    {
        // Get all pending invitations for this user where they haven't reviewed yet
        // and the request is still active and not expired
        var invitations = await _context.PlayerCertificationInvitations
            .Include(i => i.Request)
                .ThenInclude(r => r.Student)
            .Where(i => i.InvitedUserId == userId
                && !i.HasReviewed
                && i.Request.IsActive
                && (!i.Request.ExpiresAt.HasValue || i.Request.ExpiresAt.Value > DateTime.Now))
            .OrderByDescending(i => i.InvitedAt)
            .ToListAsync();

        return invitations.Select(i => new PendingReviewInvitationDto
        {
            InvitationId = i.Id,
            RequestId = i.RequestId,
            StudentId = i.Request.StudentId,
            StudentName = $"{i.Request.Student.FirstName} {i.Request.Student.LastName}",
            StudentProfileImageUrl = i.Request.Student.ProfileImageUrl,
            Message = i.Request.Message,
            ReviewToken = i.Request.Token,
            ReviewUrl = $"{baseUrl}/review/{i.Request.Token}",
            InvitedAt = i.InvitedAt,
            ExpiresAt = i.Request.ExpiresAt
        }).ToList();
    }

    #endregion

    #region Review Page

    public async Task<ReviewPageInfoDto> GetReviewPageInfoAsync(string token, int? currentUserId)
    {
        var request = await _context.PlayerCertificationRequests
            .Include(r => r.Student)
            .Include(r => r.Invitations)
            .FirstOrDefaultAsync(r => r.Token == token);

        if (request == null)
        {
            return new ReviewPageInfoDto
            {
                IsValid = false,
                CanReview = false,
                ErrorMessage = "Invalid review link"
            };
        }

        if (!request.IsActive)
        {
            return new ReviewPageInfoDto
            {
                IsValid = false,
                CanReview = false,
                ErrorMessage = "This review link is no longer active"
            };
        }

        if (request.ExpiresAt.HasValue && request.ExpiresAt.Value < DateTime.Now)
        {
            return new ReviewPageInfoDto
            {
                IsValid = false,
                CanReview = false,
                ErrorMessage = "This review link has expired"
            };
        }

        // Check visibility permissions
        var canReview = await CheckReviewPermissionAsync(request, currentUserId);
        string? visibilityError = null;

        if (!canReview)
        {
            visibilityError = request.Visibility switch
            {
                ReviewVisibility.Members => "Only community members can submit reviews for this player",
                ReviewVisibility.InvitedOnly => "Only invited users can submit reviews for this player",
                _ => null
            };
        }

        var knowledgeLevels = await GetKnowledgeLevelsAsync(true);
        var skillAreas = await GetSkillAreasAsync(true);

        return new ReviewPageInfoDto
        {
            RequestId = request.Id,
            PlayerId = request.StudentId,
            PlayerName = $"{request.Student.FirstName} {request.Student.LastName}",
            PlayerProfileImageUrl = request.Student.ProfileImageUrl,
            Message = request.Message,
            Visibility = request.Visibility.ToString(),
            IsValid = true,
            CanReview = canReview,
            ErrorMessage = visibilityError,
            KnowledgeLevels = knowledgeLevels,
            SkillAreas = skillAreas
        };
    }

    private async Task<bool> CheckReviewPermissionAsync(PlayerCertificationRequest request, int? currentUserId)
    {
        // Anyone can review if visibility is Anyone
        if (request.Visibility == ReviewVisibility.Anyone)
            return true;

        // For Members and InvitedOnly, user must be logged in
        if (!currentUserId.HasValue)
            return false;

        // Self can always review their own request
        if (currentUserId.Value == request.StudentId)
            return true;

        // For Members visibility, check if user exists in our community
        if (request.Visibility == ReviewVisibility.Members)
        {
            var userExists = await _context.Users.AnyAsync(u => u.Id == currentUserId.Value);
            return userExists;
        }

        // For InvitedOnly, check if user is in the invitations list
        if (request.Visibility == ReviewVisibility.InvitedOnly)
        {
            var isInvited = request.Invitations.Any(i => i.InvitedUserId == currentUserId.Value);
            return isInvited;
        }

        return false;
    }

    public async Task<bool> SubmitReviewAsync(string token, SubmitReviewDto dto, int? currentUserId)
    {
        var request = await _context.PlayerCertificationRequests
            .Include(r => r.Invitations)
            .FirstOrDefaultAsync(r => r.Token == token && r.IsActive);

        if (request == null) return false;

        if (request.ExpiresAt.HasValue && request.ExpiresAt.Value < DateTime.Now)
            return false;

        // Check visibility permissions before allowing submission
        var canReview = await CheckReviewPermissionAsync(request, currentUserId);
        if (!canReview) return false;

        // For self-reviews, use a default knowledge level (or first available)
        int knowledgeLevelId;
        if (dto.IsSelfReview)
        {
            // Get default knowledge level for self-review
            var defaultLevel = await _context.KnowledgeLevels
                .Where(k => k.IsActive)
                .OrderBy(k => k.SortOrder)
                .FirstOrDefaultAsync();
            knowledgeLevelId = defaultLevel?.Id ?? 1;
        }
        else
        {
            if (!dto.KnowledgeLevelId.HasValue)
                return false; // Non-self reviews require knowledge level
            knowledgeLevelId = dto.KnowledgeLevelId.Value;
        }

        // Check for existing review from the same reviewer
        // If within 1 month, update existing review; otherwise create new
        var oneMonthAgo = DateTime.Now.AddMonths(-1);
        PlayerCertificationReview? existingReview = null;

        if (currentUserId.HasValue)
        {
            // Find existing review by logged-in user
            existingReview = await _context.PlayerCertificationReviews
                .Include(r => r.Scores)
                .Where(r => r.RequestId == request.Id
                    && r.ReviewerId == currentUserId.Value
                    && r.IsSelfReview == dto.IsSelfReview)
                .OrderByDescending(r => r.CreatedAt)
                .FirstOrDefaultAsync();
        }
        else if (!string.IsNullOrEmpty(dto.ReviewerEmail))
        {
            // Find existing review by email (for anonymous reviewers)
            existingReview = await _context.PlayerCertificationReviews
                .Include(r => r.Scores)
                .Where(r => r.RequestId == request.Id
                    && r.ReviewerId == null
                    && r.ReviewerEmail == dto.ReviewerEmail
                    && r.IsSelfReview == dto.IsSelfReview)
                .OrderByDescending(r => r.CreatedAt)
                .FirstOrDefaultAsync();
        }

        PlayerCertificationReview review;

        if (existingReview != null && existingReview.CreatedAt > oneMonthAgo)
        {
            // Update existing review (less than 1 month old)
            review = existingReview;
            review.ReviewerName = dto.IsSelfReview ? "Self Review" : dto.ReviewerName;
            review.ReviewerEmail = dto.ReviewerEmail;
            review.KnowledgeLevelId = knowledgeLevelId;
            review.IsAnonymous = dto.IsAnonymous;
            review.Comments = dto.Comments;
            review.UpdatedAt = DateTime.Now;

            // Remove existing scores and add new ones
            _context.PlayerCertificationScores.RemoveRange(existingReview.Scores);
            await _context.SaveChangesAsync();

            // Add new scores
            foreach (var scoreDto in dto.Scores)
            {
                var score = new PlayerCertificationScore
                {
                    ReviewId = review.Id,
                    SkillAreaId = scoreDto.SkillAreaId,
                    Score = scoreDto.Score
                };
                _context.PlayerCertificationScores.Add(score);
            }
        }
        else
        {
            // Create new review (no existing or existing is over 1 month old)
            review = new PlayerCertificationReview
            {
                RequestId = request.Id,
                ReviewerId = currentUserId,
                ReviewerName = dto.IsSelfReview ? "Self Review" : dto.ReviewerName,
                ReviewerEmail = dto.ReviewerEmail,
                KnowledgeLevelId = knowledgeLevelId,
                IsAnonymous = dto.IsAnonymous,
                IsSelfReview = dto.IsSelfReview,
                Comments = dto.Comments
            };

            _context.PlayerCertificationReviews.Add(review);
            await _context.SaveChangesAsync();

            // Add scores
            foreach (var scoreDto in dto.Scores)
            {
                var score = new PlayerCertificationScore
                {
                    ReviewId = review.Id,
                    SkillAreaId = scoreDto.SkillAreaId,
                    Score = scoreDto.Score
                };
                _context.PlayerCertificationScores.Add(score);
            }
        }

        // Update invitation status if this user was invited
        if (currentUserId.HasValue)
        {
            var invitation = request.Invitations.FirstOrDefault(i => i.InvitedUserId == currentUserId.Value);
            if (invitation != null)
            {
                invitation.HasReviewed = true;
                invitation.ReviewedAt = DateTime.Now;
            }
        }

        await _context.SaveChangesAsync();

        // Notify student about the new review (unless it's a self-review)
        if (!dto.IsSelfReview)
        {
            var reviewerDisplayName = dto.IsAnonymous
                ? "A peer"
                : (string.IsNullOrEmpty(dto.ReviewerName) ? "Someone" : dto.ReviewerName);

            await _notificationService.CreateAndSendAsync(
                request.StudentId,
                "PeerReviewCompleted",
                "New Skill Review Received",
                $"{reviewerDisplayName} has reviewed your pickleball skills",
                "/member/certification",
                "CertificationReview",
                review.Id
            );
        }

        return true;
    }

    #endregion

    #region Certificate View

    public async Task<CertificateSummaryDto?> GetCertificateSummaryAsync(int studentId)
    {
        var student = await _context.Users.FindAsync(studentId);
        if (student == null) return null;

        var allReviews = await _context.PlayerCertificationReviews
            .Include(r => r.Request)
            .Include(r => r.KnowledgeLevel)
            .Include(r => r.Scores)
                .ThenInclude(s => s.SkillArea)
                    .ThenInclude(sa => sa.SkillGroup)
            .Where(r => r.Request.StudentId == studentId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        // Separate self-review from peer reviews
        var selfReview = allReviews.FirstOrDefault(r => r.IsSelfReview);
        var peerReviews = allReviews.Where(r => !r.IsSelfReview).ToList();

        // Get all skill groups for weighted calculation
        var skillGroups = await _context.SkillGroups
            .Where(g => g.IsActive)
            .OrderBy(g => g.SortOrder)
            .ToListAsync();

        // Get knowledge levels for filtering
        var knowledgeLevels = await GetKnowledgeLevelsAsync(true);

        if (!peerReviews.Any() && selfReview == null)
        {
            return new CertificateSummaryDto
            {
                StudentName = $"{student.FirstName} {student.LastName}",
                StudentProfileImageUrl = student.ProfileImageUrl,
                TotalReviews = 0,
                PeerReviewCount = 0,
                HasSelfReview = false,
                OverallAverageScore = 0,
                WeightedOverallScore = 0,
                GroupScores = new List<SkillGroupScoreSummaryDto>(),
                SkillAverages = new List<SkillAverageSummaryDto>(),
                Reviews = new List<CertificationReviewSummaryDto>(),
                KnowledgeLevels = knowledgeLevels,
                LastUpdated = DateTime.Now
            };
        }

        // Calculate skill averages (peer reviews only for main scores)
        var peerScores = peerReviews.SelectMany(r => r.Scores).ToList();
        var (skillAverages, groupScores, overallAverage, weightedOverallScore) =
            CalculateWeightedScores(peerScores, skillGroups);

        // Calculate self-review scores if available
        SelfReviewSummaryDto? selfReviewSummary = null;
        if (selfReview != null)
        {
            var selfScores = selfReview.Scores.ToList();
            var (selfSkillAverages, selfGroupScores, selfOverallAverage, selfWeightedOverall) =
                CalculateWeightedScores(selfScores, skillGroups);

            selfReviewSummary = new SelfReviewSummaryDto
            {
                ReviewId = selfReview.Id,
                CreatedAt = selfReview.CreatedAt,
                OverallAverageScore = selfOverallAverage,
                WeightedOverallScore = selfWeightedOverall,
                GroupScores = selfGroupScores,
                SkillAverages = selfSkillAverages
            };
        }

        var reviewSummaries = allReviews.Select(r => new CertificationReviewSummaryDto
        {
            Id = r.Id,
            ReviewerDisplayName = r.IsSelfReview ? "Self Review" : (r.IsAnonymous ? "Anonymous" : r.ReviewerName),
            KnowledgeLevelName = r.IsSelfReview ? "Self Assessment" : r.KnowledgeLevel.Name,
            IsSelfReview = r.IsSelfReview,
            Comments = r.Comments,
            CreatedAt = r.CreatedAt,
            Scores = r.Scores.Select(s => new CertificationScoreDto
            {
                Id = s.Id,
                SkillAreaId = s.SkillAreaId,
                SkillAreaName = s.SkillArea.Name,
                SkillAreaCategory = s.SkillArea.Category,
                Score = s.Score
            }).ToList()
        }).ToList();

        return new CertificateSummaryDto
        {
            StudentName = $"{student.FirstName} {student.LastName}",
            StudentProfileImageUrl = student.ProfileImageUrl,
            TotalReviews = allReviews.Count,
            PeerReviewCount = peerReviews.Count,
            HasSelfReview = selfReview != null,
            OverallAverageScore = overallAverage,
            WeightedOverallScore = weightedOverallScore,
            GroupScores = groupScores,
            SkillAverages = skillAverages,
            Reviews = reviewSummaries,
            SelfReview = selfReviewSummary,
            KnowledgeLevels = knowledgeLevels,
            LastUpdated = allReviews.Any() ? allReviews.Max(r => r.CreatedAt) : DateTime.Now
        };
    }

    private (List<SkillAverageSummaryDto> skillAverages, List<SkillGroupScoreSummaryDto> groupScores, double overallAverage, double weightedOverallScore)
        CalculateWeightedScores(List<PlayerCertificationScore> scores, List<SkillGroup> skillGroups)
    {
        if (!scores.Any())
        {
            return (new List<SkillAverageSummaryDto>(), new List<SkillGroupScoreSummaryDto>(), 0, 0);
        }

        var skillAverages = scores
            .GroupBy(s => new {
                s.SkillAreaId,
                s.SkillArea.Name,
                s.SkillArea.Category,
                s.SkillArea.SkillGroupId,
                SkillGroupName = s.SkillArea.SkillGroup?.Name
            })
            .Select(g => new SkillAverageSummaryDto
            {
                SkillAreaId = g.Key.SkillAreaId,
                SkillAreaName = g.Key.Name,
                Category = g.Key.Category,
                SkillGroupId = g.Key.SkillGroupId,
                SkillGroupName = g.Key.SkillGroupName,
                AverageScore = Math.Round(g.Average(s => s.Score), 1),
                ReviewCount = g.Count()
            })
            .OrderBy(s => s.SkillGroupId ?? 999)
            .ThenBy(s => s.SkillAreaId)
            .ToList();

        var overallAverage = scores.Any() ? Math.Round(scores.Average(s => s.Score), 1) : 0;

        var groupScores = new List<SkillGroupScoreSummaryDto>();
        double weightedTotal = 0;
        int totalWeight = 0;

        foreach (var group in skillGroups)
        {
            var groupSkillAverages = skillAverages
                .Where(s => s.SkillGroupId == group.Id)
                .ToList();

            if (groupSkillAverages.Any())
            {
                var groupAverage = Math.Round(groupSkillAverages.Average(s => s.AverageScore), 1);
                var weightedContribution = (groupAverage / 10.0) * group.Weight;

                groupScores.Add(new SkillGroupScoreSummaryDto
                {
                    GroupId = group.Id,
                    GroupName = group.Name,
                    Weight = group.Weight,
                    AverageScore = groupAverage,
                    WeightedContribution = Math.Round(weightedContribution, 1),
                    SkillAverages = groupSkillAverages
                });

                weightedTotal += weightedContribution;
                totalWeight += group.Weight;
            }
        }

        // Handle ungrouped skills
        var ungroupedSkillAverages = skillAverages
            .Where(s => s.SkillGroupId == null)
            .ToList();

        if (ungroupedSkillAverages.Any())
        {
            var ungroupedAverage = Math.Round(ungroupedSkillAverages.Average(s => s.AverageScore), 1);
            var ungroupedWeight = 100 - totalWeight;
            if (ungroupedWeight > 0)
            {
                var weightedContribution = (ungroupedAverage / 10.0) * ungroupedWeight;
                groupScores.Add(new SkillGroupScoreSummaryDto
                {
                    GroupId = 0,
                    GroupName = "Other Skills",
                    Weight = ungroupedWeight,
                    AverageScore = ungroupedAverage,
                    WeightedContribution = Math.Round(weightedContribution, 1),
                    SkillAverages = ungroupedSkillAverages
                });
                weightedTotal += weightedContribution;
                totalWeight += ungroupedWeight;
            }
        }

        var weightedOverallScore = totalWeight > 0
            ? Math.Round((weightedTotal / totalWeight) * 10, 1)
            : overallAverage;

        return (skillAverages, groupScores, overallAverage, weightedOverallScore);
    }

    #endregion

    #region Helpers

    private static string GenerateSecureToken()
    {
        var bytes = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }

    private static KnowledgeLevelDto MapToKnowledgeLevelDto(KnowledgeLevel entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Description = entity.Description,
        SortOrder = entity.SortOrder,
        IsActive = entity.IsActive
    };

    private static SkillGroupDto MapToSkillGroupDto(SkillGroup entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Description = entity.Description,
        Weight = entity.Weight,
        SortOrder = entity.SortOrder,
        IsActive = entity.IsActive,
        SkillAreas = entity.SkillAreas?.Select(MapToSkillAreaDto).ToList() ?? new()
    };

    private static SkillAreaDto MapToSkillAreaDto(SkillArea entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Description = entity.Description,
        Category = entity.Category,
        SkillGroupId = entity.SkillGroupId,
        SkillGroupName = entity.SkillGroup?.Name,
        SortOrder = entity.SortOrder,
        IsActive = entity.IsActive
    };

    private static CertificationRequestDto MapToRequestDto(PlayerCertificationRequest entity, string baseUrl) => new()
    {
        Id = entity.Id,
        StudentId = entity.StudentId,
        StudentName = $"{entity.Student.FirstName} {entity.Student.LastName}",
        StudentProfileImageUrl = entity.Student.ProfileImageUrl,
        Token = entity.Token,
        Message = entity.Message,
        Visibility = entity.Visibility.ToString(),
        IsActive = entity.IsActive,
        CreatedAt = entity.CreatedAt,
        ExpiresAt = entity.ExpiresAt,
        ReviewCount = entity.Reviews?.Count ?? 0,
        InvitationCount = entity.Invitations?.Count ?? 0,
        ShareableUrl = $"{baseUrl}/review/{entity.Token}"
    };

    #endregion
}
