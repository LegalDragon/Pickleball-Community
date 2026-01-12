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
    public string Visibility { get; set; } = "Anyone"; // Anyone, Members, InvitedOnly
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public int ReviewCount { get; set; }
    public int InvitationCount { get; set; }
    public string ShareableUrl { get; set; } = string.Empty;
}

public class CreateCertificationRequestDto
{
    [MaxLength(1000)]
    public string? Message { get; set; }

    /// <summary>
    /// Visibility setting: Anyone, Members, InvitedOnly
    /// </summary>
    public string Visibility { get; set; } = "Anyone";

    public DateTime? ExpiresAt { get; set; }
}

public class UpdateCertificationRequestDto
{
    [MaxLength(1000)]
    public string? Message { get; set; }

    /// <summary>
    /// Visibility setting: Anyone, Members, InvitedOnly
    /// </summary>
    public string? Visibility { get; set; }
}

// Invitation DTOs
public class CertificationInvitationDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public bool HasReviewed { get; set; }
    public DateTime InvitedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
}

public class InvitePeersDto
{
    /// <summary>
    /// List of user IDs to invite
    /// </summary>
    public List<int> UserIds { get; set; } = new();
}

public class InvitablePeersDto
{
    public List<InvitableUserDto> Friends { get; set; } = new();
    public List<ClubWithMembersDto> Clubs { get; set; } = new();
}

public class InvitableUserDto
{
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public bool AlreadyInvited { get; set; }
    public bool HasReviewed { get; set; }
}

public class ClubWithMembersDto
{
    public int ClubId { get; set; }
    public string ClubName { get; set; } = string.Empty;
    public List<InvitableUserDto> Members { get; set; } = new();
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

    /// <summary>
    /// Knowledge level ID (not required for self-reviews)
    /// </summary>
    public int? KnowledgeLevelId { get; set; }

    public bool IsAnonymous { get; set; } = false;

    /// <summary>
    /// Whether this is a self-review (player reviewing themselves)
    /// </summary>
    public bool IsSelfReview { get; set; } = false;

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
    public int PeerReviewCount { get; set; }
    public bool HasSelfReview { get; set; }
    public double OverallAverageScore { get; set; }
    public double WeightedOverallScore { get; set; }
    public List<SkillGroupScoreSummaryDto> GroupScores { get; set; } = new();
    public List<SkillAverageSummaryDto> SkillAverages { get; set; } = new();
    public List<CertificationReviewSummaryDto> Reviews { get; set; } = new();

    /// <summary>
    /// Self-review scores (if available) for comparison
    /// </summary>
    public SelfReviewSummaryDto? SelfReview { get; set; }

    /// <summary>
    /// Available knowledge levels for filtering
    /// </summary>
    public List<KnowledgeLevelDto> KnowledgeLevels { get; set; } = new();

    public DateTime LastUpdated { get; set; }
}

public class SelfReviewSummaryDto
{
    public int ReviewId { get; set; }
    public DateTime CreatedAt { get; set; }
    public double OverallAverageScore { get; set; }
    public double WeightedOverallScore { get; set; }
    public List<SkillGroupScoreSummaryDto> GroupScores { get; set; } = new();
    public List<SkillAverageSummaryDto> SkillAverages { get; set; } = new();
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
    public string ReviewerDisplayName { get; set; } = string.Empty; // "Anonymous" if anonymous, "Self Review" if self
    public string KnowledgeLevelName { get; set; } = string.Empty;
    public bool IsSelfReview { get; set; }
    public string? Comments { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<CertificationScoreDto> Scores { get; set; } = new();
}

// Review Page Info (what reviewers see)
public class ReviewPageInfoDto
{
    public int RequestId { get; set; }
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = string.Empty;
    public string? PlayerProfileImageUrl { get; set; }
    public string? Message { get; set; }
    public string Visibility { get; set; } = "Anyone";
    public bool IsValid { get; set; }
    public bool CanReview { get; set; } = true; // Whether current user can submit a review
    public string? ErrorMessage { get; set; }
    public List<KnowledgeLevelDto> KnowledgeLevels { get; set; } = new();
    public List<SkillAreaDto> SkillAreas { get; set; } = new();
}

// Pending Review Invitation (for users who were invited to review others)
public class PendingReviewInvitationDto
{
    public int InvitationId { get; set; }
    public int RequestId { get; set; }

    /// <summary>
    /// The player who is requesting the review
    /// </summary>
    public int StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string? StudentProfileImageUrl { get; set; }

    /// <summary>
    /// Optional message from the player
    /// </summary>
    public string? Message { get; set; }

    /// <summary>
    /// The review token for accessing the review page
    /// </summary>
    public string ReviewToken { get; set; } = string.Empty;

    /// <summary>
    /// URL to submit the review
    /// </summary>
    public string ReviewUrl { get; set; } = string.Empty;

    public DateTime InvitedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
}
