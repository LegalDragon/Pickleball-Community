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
    Task<List<CertificationRequestDto>> GetStudentRequestsAsync(int studentId, string baseUrl);
    Task<CertificationRequestDto?> GetRequestAsync(int requestId, int studentId, string baseUrl);
    Task<bool> DeactivateRequestAsync(int requestId, int studentId);

    // Review Page (Public)
    Task<ReviewPageInfoDto> GetReviewPageInfoAsync(string token);
    Task<bool> SubmitReviewAsync(string token, SubmitReviewDto dto);

    // Certificate View (Student)
    Task<CertificateSummaryDto?> GetCertificateSummaryAsync(int studentId);
}

public class PlayerCertificationService : IPlayerCertificationService
{
    private readonly ApplicationDbContext _context;

    public PlayerCertificationService(ApplicationDbContext context)
    {
        _context = context;
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
        entity.UpdatedAt = DateTime.UtcNow;

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
            entity.UpdatedAt = DateTime.UtcNow;
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
        entity.UpdatedAt = DateTime.UtcNow;

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
            entity.UpdatedAt = DateTime.UtcNow;
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
        entity.UpdatedAt = DateTime.UtcNow;

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
            entity.UpdatedAt = DateTime.UtcNow;
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

        var entity = new PlayerCertificationRequest
        {
            StudentId = studentId,
            Token = token,
            Message = dto.Message,
            ExpiresAt = dto.ExpiresAt,
            IsActive = true
        };

        _context.PlayerCertificationRequests.Add(entity);
        await _context.SaveChangesAsync();

        // Reload with student
        await _context.Entry(entity).Reference(r => r.Student).LoadAsync();

        return MapToRequestDto(entity, baseUrl);
    }

    public async Task<List<CertificationRequestDto>> GetStudentRequestsAsync(int studentId, string baseUrl)
    {
        var requests = await _context.PlayerCertificationRequests
            .Include(r => r.Student)
            .Include(r => r.Reviews)
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
            .FirstOrDefaultAsync(r => r.Id == requestId && r.StudentId == studentId);

        return request == null ? null : MapToRequestDto(request, baseUrl);
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

    #region Review Page

    public async Task<ReviewPageInfoDto> GetReviewPageInfoAsync(string token)
    {
        var request = await _context.PlayerCertificationRequests
            .Include(r => r.Student)
            .FirstOrDefaultAsync(r => r.Token == token);

        if (request == null)
        {
            return new ReviewPageInfoDto
            {
                IsValid = false,
                ErrorMessage = "Invalid review link"
            };
        }

        if (!request.IsActive)
        {
            return new ReviewPageInfoDto
            {
                IsValid = false,
                ErrorMessage = "This review link is no longer active"
            };
        }

        if (request.ExpiresAt.HasValue && request.ExpiresAt.Value < DateTime.UtcNow)
        {
            return new ReviewPageInfoDto
            {
                IsValid = false,
                ErrorMessage = "This review link has expired"
            };
        }

        var knowledgeLevels = await GetKnowledgeLevelsAsync(true);
        var skillAreas = await GetSkillAreasAsync(true);

        return new ReviewPageInfoDto
        {
            RequestId = request.Id,
            PlayerName = $"{request.Student.FirstName} {request.Student.LastName}",
            PlayerProfileImageUrl = request.Student.ProfileImageUrl,
            Message = request.Message,
            IsValid = true,
            KnowledgeLevels = knowledgeLevels,
            SkillAreas = skillAreas
        };
    }

    public async Task<bool> SubmitReviewAsync(string token, SubmitReviewDto dto)
    {
        var request = await _context.PlayerCertificationRequests
            .FirstOrDefaultAsync(r => r.Token == token && r.IsActive);

        if (request == null) return false;

        if (request.ExpiresAt.HasValue && request.ExpiresAt.Value < DateTime.UtcNow)
            return false;

        var review = new PlayerCertificationReview
        {
            RequestId = request.Id,
            ReviewerName = dto.ReviewerName,
            ReviewerEmail = dto.ReviewerEmail,
            KnowledgeLevelId = dto.KnowledgeLevelId,
            IsAnonymous = dto.IsAnonymous,
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

        await _context.SaveChangesAsync();
        return true;
    }

    #endregion

    #region Certificate View

    public async Task<CertificateSummaryDto?> GetCertificateSummaryAsync(int studentId)
    {
        var student = await _context.Users.FindAsync(studentId);
        if (student == null) return null;

        var reviews = await _context.PlayerCertificationReviews
            .Include(r => r.Request)
            .Include(r => r.KnowledgeLevel)
            .Include(r => r.Scores)
                .ThenInclude(s => s.SkillArea)
                    .ThenInclude(sa => sa.SkillGroup)
            .Where(r => r.Request.StudentId == studentId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        // Get all skill groups for weighted calculation
        var skillGroups = await _context.SkillGroups
            .Where(g => g.IsActive)
            .OrderBy(g => g.SortOrder)
            .ToListAsync();

        if (!reviews.Any())
        {
            return new CertificateSummaryDto
            {
                StudentName = $"{student.FirstName} {student.LastName}",
                StudentProfileImageUrl = student.ProfileImageUrl,
                TotalReviews = 0,
                OverallAverageScore = 0,
                WeightedOverallScore = 0,
                GroupScores = new List<SkillGroupScoreSummaryDto>(),
                SkillAverages = new List<SkillAverageSummaryDto>(),
                Reviews = new List<CertificationReviewSummaryDto>(),
                LastUpdated = DateTime.UtcNow
            };
        }

        // Calculate skill averages
        var allScores = reviews.SelectMany(r => r.Scores).ToList();
        var skillAverages = allScores
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

        var overallAverage = allScores.Any() ? Math.Round(allScores.Average(s => s.Score), 1) : 0;

        // Calculate weighted group scores
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
            var ungroupedWeight = 100 - totalWeight; // Remaining weight goes to ungrouped
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

        // Calculate final weighted score (scaled to 10)
        var weightedOverallScore = totalWeight > 0
            ? Math.Round((weightedTotal / totalWeight) * 10, 1)
            : overallAverage;

        var reviewSummaries = reviews.Select(r => new CertificationReviewSummaryDto
        {
            Id = r.Id,
            ReviewerDisplayName = r.IsAnonymous ? "Anonymous" : r.ReviewerName,
            KnowledgeLevelName = r.KnowledgeLevel.Name,
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
            TotalReviews = reviews.Count,
            OverallAverageScore = overallAverage,
            WeightedOverallScore = weightedOverallScore,
            GroupScores = groupScores,
            SkillAverages = skillAverages,
            Reviews = reviewSummaries,
            LastUpdated = reviews.Max(r => r.CreatedAt)
        };
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
        IsActive = entity.IsActive,
        CreatedAt = entity.CreatedAt,
        ExpiresAt = entity.ExpiresAt,
        ReviewCount = entity.Reviews?.Count ?? 0,
        ShareableUrl = $"{baseUrl}/review/{entity.Token}"
    };

    #endregion
}
