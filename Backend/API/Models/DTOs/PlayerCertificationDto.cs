using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.API.Models.DTOs;

// Knowledge Level DTOs
public class KnowledgeLevelDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class CreateKnowledgeLevelDto
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
}

public class UpdateKnowledgeLevelDto
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

// Skill Group DTOs
public class SkillGroupDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Weight { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public List<SkillAreaDto> SkillAreas { get; set; } = new();
}

public class CreateSkillGroupDto
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [Range(0, 100)]
    public int Weight { get; set; } = 100;

    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
}

public class UpdateSkillGroupDto
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [Range(0, 100)]
    public int Weight { get; set; }

    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

// Skill Area DTOs
public class SkillAreaDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Category { get; set; }
    public int? SkillGroupId { get; set; }
    public string? SkillGroupName { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class CreateSkillAreaDto
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(50)]
    public string? Category { get; set; }

    public int? SkillGroupId { get; set; }

    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
}

public class UpdateSkillAreaDto
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(50)]
    public string? Category { get; set; }

    public int? SkillGroupId { get; set; }

    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

// Certification Request DTOs
public class CertificationRequestDto
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string? StudentProfileImageUrl { get; set; }
    public string Token { get; set; } = string.Empty;
    public string? Message { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public int ReviewCount { get; set; }
    public string ShareableUrl { get; set; } = string.Empty;
}

public class CreateCertificationRequestDto
{
    [MaxLength(1000)]
    public string? Message { get; set; }

    public DateTime? ExpiresAt { get; set; }
}

// Review DTOs
public class CertificationReviewDto
{
    public int Id { get; set; }
    public int RequestId { get; set; }
    public string ReviewerName { get; set; } = string.Empty;
    public string? ReviewerEmail { get; set; }
    public int KnowledgeLevelId { get; set; }
    public string KnowledgeLevelName { get; set; } = string.Empty;
    public bool IsAnonymous { get; set; }
    public string? Comments { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<CertificationScoreDto> Scores { get; set; } = new();
}

public class SubmitReviewDto
{
    [Required]
    [MaxLength(100)]
    public string ReviewerName { get; set; } = string.Empty;

    [MaxLength(200)]
    [EmailAddress]
    public string? ReviewerEmail { get; set; }

    [Required]
    public int KnowledgeLevelId { get; set; }

    public bool IsAnonymous { get; set; } = false;

    [MaxLength(2000)]
    public string? Comments { get; set; }

    [Required]
    public List<SkillScoreDto> Scores { get; set; } = new();
}

public class SkillScoreDto
{
    [Required]
    public int SkillAreaId { get; set; }

    [Required]
    [Range(1, 10)]
    public int Score { get; set; }
}

public class CertificationScoreDto
{
    public int Id { get; set; }
    public int SkillAreaId { get; set; }
    public string SkillAreaName { get; set; } = string.Empty;
    public string? SkillAreaCategory { get; set; }
    public int Score { get; set; }
}

// Certificate Summary DTOs
public class CertificateSummaryDto
{
    public int RequestId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string? StudentProfileImageUrl { get; set; }
    public int TotalReviews { get; set; }
    public double OverallAverageScore { get; set; }
    public double WeightedOverallScore { get; set; }
    public List<SkillGroupScoreSummaryDto> GroupScores { get; set; } = new();
    public List<SkillAverageSummaryDto> SkillAverages { get; set; } = new();
    public List<CertificationReviewSummaryDto> Reviews { get; set; } = new();
    public DateTime LastUpdated { get; set; }
}

public class SkillGroupScoreSummaryDto
{
    public int GroupId { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public int Weight { get; set; }
    public double AverageScore { get; set; }
    public double WeightedContribution { get; set; }
    public List<SkillAverageSummaryDto> SkillAverages { get; set; } = new();
}

public class SkillAverageSummaryDto
{
    public int SkillAreaId { get; set; }
    public string SkillAreaName { get; set; } = string.Empty;
    public string? Category { get; set; }
    public int? SkillGroupId { get; set; }
    public string? SkillGroupName { get; set; }
    public double AverageScore { get; set; }
    public int ReviewCount { get; set; }
}

public class CertificationReviewSummaryDto
{
    public int Id { get; set; }
    public string ReviewerDisplayName { get; set; } = string.Empty; // "Anonymous" if anonymous
    public string KnowledgeLevelName { get; set; } = string.Empty;
    public string? Comments { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<CertificationScoreDto> Scores { get; set; } = new();
}

// Review Page Info (what reviewers see)
public class ReviewPageInfoDto
{
    public int RequestId { get; set; }
    public string PlayerName { get; set; } = string.Empty;
    public string? PlayerProfileImageUrl { get; set; }
    public string? Message { get; set; }
    public bool IsValid { get; set; }
    public string? ErrorMessage { get; set; }
    public List<KnowledgeLevelDto> KnowledgeLevels { get; set; } = new();
    public List<SkillAreaDto> SkillAreas { get; set; } = new();
}
