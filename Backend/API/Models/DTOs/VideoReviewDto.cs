namespace Pickleball.College.Models.DTOs;

public class VideoReviewRequestDto
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string? StudentAvatar { get; set; }
    public int? CoachId { get; set; }
    public string? CoachName { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string VideoUrl { get; set; } = string.Empty;
    public string? ExternalVideoLink { get; set; }
    public decimal OfferedPrice { get; set; }
    public string Status { get; set; } = string.Empty;

    // Bidding/Proposal fields
    public int? ProposedByCoachId { get; set; }
    public string? ProposedByCoachName { get; set; }
    public string? ProposedByCoachAvatar { get; set; }
    public decimal? ProposedPrice { get; set; }
    public string? ProposalNote { get; set; }
    public DateTime? ProposedAt { get; set; }

    public int? AcceptedByCoachId { get; set; }
    public string? AcceptedByCoachName { get; set; }
    public string? ReviewVideoUrl { get; set; }
    public string? ReviewNotes { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateVideoReviewRequest
{
    public int? CoachId { get; set; }  // Null for open requests
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? VideoUrl { get; set; }  // Uploaded video URL
    public string? ExternalVideoLink { get; set; }  // YouTube/Vimeo/etc link
    public decimal OfferedPrice { get; set; }
}

public class UpdateVideoReviewRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? VideoUrl { get; set; }
    public string? ExternalVideoLink { get; set; }
    public decimal OfferedPrice { get; set; }
}

public class CoachProposalRequest
{
    public decimal ProposedPrice { get; set; }
    public string? Note { get; set; }
}

public class AcceptVideoReviewRequest
{
    public int RequestId { get; set; }
}

public class CompleteVideoReviewRequest
{
    public int RequestId { get; set; }
    public string? ReviewVideoUrl { get; set; }
    public string? ReviewNotes { get; set; }
}

// Session request DTOs
public class SessionRequestDto
{
    public int Id { get; set; }
    public int CoachId { get; set; }
    public string CoachName { get; set; } = string.Empty;
    public string? CoachAvatar { get; set; }
    public int StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string SessionType { get; set; } = string.Empty;
    public DateTime RequestedAt { get; set; }
    public int DurationMinutes { get; set; }
    public decimal Price { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? MeetingLink { get; set; }
    public string? Location { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }

    // Coach proposal fields
    public DateTime? ProposedScheduledAt { get; set; }
    public int? ProposedDurationMinutes { get; set; }
    public decimal? ProposedPrice { get; set; }
    public string? ProposedLocation { get; set; }
    public string? ProposalNote { get; set; }
    public DateTime? ProposedAt { get; set; }
}

public class CreateSessionRequest
{
    public int CoachId { get; set; }
    public string SessionType { get; set; } = "Online";
    public DateTime RequestedAt { get; set; }
    public int DurationMinutes { get; set; } = 60;
    public string? Notes { get; set; }
}

public class ConfirmSessionRequest
{
    public int SessionId { get; set; }
    public decimal Price { get; set; }
    public string? MeetingLink { get; set; }
    public string? Location { get; set; }
}

public class SessionProposalRequest
{
    public DateTime? ProposedScheduledAt { get; set; }
    public int? ProposedDurationMinutes { get; set; }
    public decimal? ProposedPrice { get; set; }
    public string? ProposedLocation { get; set; }
    public string? Note { get; set; }
}

// Coach search result DTO
public class CoachSearchResultDto
{
    public int Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public string? Bio { get; set; }
    public decimal? HourlyRate { get; set; }
    public string? CertificationLevel { get; set; }
    public int? YearsExperience { get; set; }
    public bool IsVerified { get; set; }
    public double AverageRating { get; set; }
    public int TotalRatings { get; set; }
    public List<string> Tags { get; set; } = new();
}
