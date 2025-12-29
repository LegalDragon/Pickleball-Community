using Microsoft.EntityFrameworkCore;
using Pickleball.College.Database;
using Pickleball.College.Models.DTOs;
using Pickleball.College.Models.Entities;

namespace Pickleball.College.Services;

public class VideoReviewService : IVideoReviewService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<VideoReviewService> _logger;

    public VideoReviewService(ApplicationDbContext context, ILogger<VideoReviewService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<VideoReviewRequestDto> CreateRequestAsync(int studentId, CreateVideoReviewRequest request)
    {
        // Validate coach if specified
        if (request.CoachId.HasValue)
        {
            var coach = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.CoachId.Value && u.Role == "Coach");
            if (coach == null)
            {
                throw new ArgumentException("Coach not found");
            }
        }

        // Require either a video URL or an external link
        if (string.IsNullOrEmpty(request.VideoUrl) && string.IsNullOrEmpty(request.ExternalVideoLink))
        {
            throw new ArgumentException("Either a video URL or external video link is required");
        }

        var videoRequest = new VideoReviewRequest
        {
            StudentId = studentId,
            CoachId = request.CoachId,
            Title = request.Title,
            Description = request.Description,
            VideoUrl = request.VideoUrl ?? string.Empty,
            ExternalVideoLink = request.ExternalVideoLink,
            OfferedPrice = request.OfferedPrice,
            Status = "Open"
        };

        _context.VideoReviewRequests.Add(videoRequest);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Video review request {RequestId} created by student {StudentId}", videoRequest.Id, studentId);

        return await MapToDto(videoRequest);
    }

    public async Task<VideoReviewRequestDto> UpdateRequestAsync(int studentId, int requestId, UpdateVideoReviewRequest request)
    {
        var videoRequest = await _context.VideoReviewRequests
            .Include(v => v.Student)
            .FirstOrDefaultAsync(v => v.Id == requestId && v.StudentId == studentId);

        if (videoRequest == null)
        {
            throw new ArgumentException("Request not found");
        }

        // Only allow editing if status is Open or PendingStudentApproval
        if (videoRequest.Status != "Open" && videoRequest.Status != "PendingStudentApproval")
        {
            throw new InvalidOperationException("Can only edit requests that are open or pending approval");
        }

        videoRequest.Title = request.Title;
        videoRequest.Description = request.Description;
        if (!string.IsNullOrEmpty(request.VideoUrl))
        {
            videoRequest.VideoUrl = request.VideoUrl;
        }
        videoRequest.ExternalVideoLink = request.ExternalVideoLink;
        videoRequest.OfferedPrice = request.OfferedPrice;
        videoRequest.UpdatedAt = DateTime.UtcNow;

        // If editing resets any proposal
        if (videoRequest.Status == "PendingStudentApproval")
        {
            videoRequest.Status = "Open";
            videoRequest.ProposedByCoachId = null;
            videoRequest.ProposedPrice = null;
            videoRequest.ProposalNote = null;
            videoRequest.ProposedAt = null;
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Video review request {RequestId} updated by student {StudentId}", requestId, studentId);

        return await MapToDto(videoRequest);
    }

    public async Task<List<VideoReviewRequestDto>> GetStudentRequestsAsync(int studentId)
    {
        var requests = await _context.VideoReviewRequests
            .Include(v => v.Student)
            .Include(v => v.TargetCoach)
            .Include(v => v.AcceptedByCoach)
            .Where(v => v.StudentId == studentId)
            .OrderByDescending(v => v.CreatedAt)
            .ToListAsync();

        return requests.Select(r => MapToDtoSync(r)).ToList();
    }

    public async Task<bool> CancelRequestAsync(int studentId, int requestId)
    {
        var request = await _context.VideoReviewRequests
            .FirstOrDefaultAsync(v => v.Id == requestId && v.StudentId == studentId);

        if (request == null) return false;

        if (request.Status != "Open" && request.Status != "PendingStudentApproval")
        {
            throw new InvalidOperationException("Can only cancel open or pending requests");
        }

        request.Status = "Cancelled";
        request.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return true;
    }

    // Coach proposes a price/note for an open request
    public async Task<VideoReviewRequestDto> ProposeAsync(int coachId, int requestId, CoachProposalRequest proposal)
    {
        var request = await _context.VideoReviewRequests
            .Include(v => v.Student)
            .FirstOrDefaultAsync(v => v.Id == requestId);

        if (request == null)
        {
            throw new ArgumentException("Request not found");
        }

        if (request.Status != "Open")
        {
            throw new InvalidOperationException("Can only propose on open requests");
        }

        // Check if request is targeted at a specific coach
        if (request.CoachId.HasValue && request.CoachId.Value != coachId)
        {
            throw new InvalidOperationException("This request is for a specific coach");
        }

        request.ProposedByCoachId = coachId;
        request.ProposedPrice = proposal.ProposedPrice;
        request.ProposalNote = proposal.Note;
        request.ProposedAt = DateTime.UtcNow;
        request.Status = "PendingStudentApproval";
        request.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Coach {CoachId} proposed ${Price} for request {RequestId}", coachId, proposal.ProposedPrice, requestId);

        return await MapToDto(request);
    }

    // Student accepts a coach's proposal
    public async Task<VideoReviewRequestDto> AcceptProposalAsync(int studentId, int requestId)
    {
        var request = await _context.VideoReviewRequests
            .Include(v => v.Student)
            .Include(v => v.ProposedByCoach)
            .FirstOrDefaultAsync(v => v.Id == requestId && v.StudentId == studentId);

        if (request == null)
        {
            throw new ArgumentException("Request not found");
        }

        if (request.Status != "PendingStudentApproval")
        {
            throw new InvalidOperationException("No pending proposal to accept");
        }

        request.AcceptedByCoachId = request.ProposedByCoachId;
        request.Status = "Accepted";
        request.AcceptedAt = DateTime.UtcNow;
        request.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Student {StudentId} accepted proposal from coach {CoachId} for request {RequestId}",
            studentId, request.AcceptedByCoachId, requestId);

        return await MapToDto(request);
    }

    // Student declines a proposal (request goes back to Open)
    public async Task<VideoReviewRequestDto> DeclineProposalAsync(int studentId, int requestId)
    {
        var request = await _context.VideoReviewRequests
            .Include(v => v.Student)
            .FirstOrDefaultAsync(v => v.Id == requestId && v.StudentId == studentId);

        if (request == null)
        {
            throw new ArgumentException("Request not found");
        }

        if (request.Status != "PendingStudentApproval")
        {
            throw new InvalidOperationException("No pending proposal to decline");
        }

        request.ProposedByCoachId = null;
        request.ProposedPrice = null;
        request.ProposalNote = null;
        request.ProposedAt = null;
        request.Status = "Open";
        request.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Student {StudentId} declined proposal for request {RequestId}", studentId, requestId);

        return await MapToDto(request);
    }

    public async Task<List<VideoReviewRequestDto>> GetOpenRequestsAsync(int? coachId = null)
    {
        var query = _context.VideoReviewRequests
            .Include(v => v.Student)
            .Include(v => v.TargetCoach)
            .Where(v => v.Status == "Open");

        if (coachId.HasValue)
        {
            // Include open requests targeted at this coach OR open to all coaches
            query = query.Where(v => v.CoachId == null || v.CoachId == coachId.Value);
        }
        else
        {
            // Only globally open requests
            query = query.Where(v => v.CoachId == null);
        }

        var requests = await query
            .OrderByDescending(v => v.OfferedPrice)
            .ThenByDescending(v => v.CreatedAt)
            .ToListAsync();

        return requests.Select(r => MapToDtoSync(r)).ToList();
    }

    public async Task<List<VideoReviewRequestDto>> GetCoachRequestsAsync(int coachId)
    {
        var requests = await _context.VideoReviewRequests
            .Include(v => v.Student)
            .Include(v => v.TargetCoach)
            .Include(v => v.AcceptedByCoach)
            .Where(v => v.AcceptedByCoachId == coachId || v.CoachId == coachId)
            .OrderByDescending(v => v.CreatedAt)
            .ToListAsync();

        return requests.Select(r => MapToDtoSync(r)).ToList();
    }

    public async Task<VideoReviewRequestDto> AcceptRequestAsync(int coachId, int requestId)
    {
        var request = await _context.VideoReviewRequests
            .Include(v => v.Student)
            .FirstOrDefaultAsync(v => v.Id == requestId);

        if (request == null)
        {
            throw new ArgumentException("Request not found");
        }

        if (request.Status != "Open")
        {
            throw new InvalidOperationException("Request is no longer available");
        }

        // Check if request is targeted at a specific coach
        if (request.CoachId.HasValue && request.CoachId.Value != coachId)
        {
            throw new InvalidOperationException("This request is for a specific coach");
        }

        request.AcceptedByCoachId = coachId;
        request.Status = "Accepted";
        request.AcceptedAt = DateTime.UtcNow;
        request.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Video review request {RequestId} accepted by coach {CoachId}", requestId, coachId);

        return await MapToDto(request);
    }

    public async Task<VideoReviewRequestDto> CompleteReviewAsync(int coachId, CompleteVideoReviewRequest request)
    {
        var videoRequest = await _context.VideoReviewRequests
            .Include(v => v.Student)
            .Include(v => v.AcceptedByCoach)
            .FirstOrDefaultAsync(v => v.Id == request.RequestId);

        if (videoRequest == null)
        {
            throw new ArgumentException("Request not found");
        }

        if (videoRequest.AcceptedByCoachId != coachId)
        {
            throw new InvalidOperationException("You are not assigned to this review");
        }

        if (videoRequest.Status != "Accepted")
        {
            throw new InvalidOperationException("Request must be in Accepted status to complete");
        }

        videoRequest.ReviewVideoUrl = request.ReviewVideoUrl;
        videoRequest.ReviewNotes = request.ReviewNotes;
        videoRequest.Status = "Completed";
        videoRequest.CompletedAt = DateTime.UtcNow;
        videoRequest.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Video review request {RequestId} completed by coach {CoachId}", request.RequestId, coachId);

        return await MapToDto(videoRequest);
    }

    public async Task<VideoReviewRequestDto?> GetRequestAsync(int requestId)
    {
        var request = await _context.VideoReviewRequests
            .Include(v => v.Student)
            .Include(v => v.TargetCoach)
            .Include(v => v.AcceptedByCoach)
            .FirstOrDefaultAsync(v => v.Id == requestId);

        if (request == null) return null;

        return await MapToDto(request);
    }

    private async Task<VideoReviewRequestDto> MapToDto(VideoReviewRequest request)
    {
        var student = request.Student ?? await _context.Users.FindAsync(request.StudentId);
        var targetCoach = request.TargetCoach ?? (request.CoachId.HasValue ? await _context.Users.FindAsync(request.CoachId.Value) : null);
        var acceptedCoach = request.AcceptedByCoach ?? (request.AcceptedByCoachId.HasValue ? await _context.Users.FindAsync(request.AcceptedByCoachId.Value) : null);
        var proposedByCoach = request.ProposedByCoach ?? (request.ProposedByCoachId.HasValue ? await _context.Users.FindAsync(request.ProposedByCoachId.Value) : null);

        return new VideoReviewRequestDto
        {
            Id = request.Id,
            StudentId = request.StudentId,
            StudentName = student != null ? $"{student.FirstName} {student.LastName}" : "Unknown",
            StudentAvatar = student?.ProfileImageUrl,
            CoachId = request.CoachId,
            CoachName = targetCoach != null ? $"{targetCoach.FirstName} {targetCoach.LastName}" : null,
            Title = request.Title,
            Description = request.Description,
            VideoUrl = request.VideoUrl,
            ExternalVideoLink = request.ExternalVideoLink,
            OfferedPrice = request.OfferedPrice,
            Status = request.Status,
            // Proposal fields
            ProposedByCoachId = request.ProposedByCoachId,
            ProposedByCoachName = proposedByCoach != null ? $"{proposedByCoach.FirstName} {proposedByCoach.LastName}" : null,
            ProposedByCoachAvatar = proposedByCoach?.ProfileImageUrl,
            ProposedPrice = request.ProposedPrice,
            ProposalNote = request.ProposalNote,
            ProposedAt = request.ProposedAt,
            // Accepted fields
            AcceptedByCoachId = request.AcceptedByCoachId,
            AcceptedByCoachName = acceptedCoach != null ? $"{acceptedCoach.FirstName} {acceptedCoach.LastName}" : null,
            ReviewVideoUrl = request.ReviewVideoUrl,
            ReviewNotes = request.ReviewNotes,
            AcceptedAt = request.AcceptedAt,
            CompletedAt = request.CompletedAt,
            CreatedAt = request.CreatedAt
        };
    }

    private VideoReviewRequestDto MapToDtoSync(VideoReviewRequest request)
    {
        return new VideoReviewRequestDto
        {
            Id = request.Id,
            StudentId = request.StudentId,
            StudentName = request.Student != null ? $"{request.Student.FirstName} {request.Student.LastName}" : "Unknown",
            StudentAvatar = request.Student?.ProfileImageUrl,
            CoachId = request.CoachId,
            CoachName = request.TargetCoach != null ? $"{request.TargetCoach.FirstName} {request.TargetCoach.LastName}" : null,
            Title = request.Title,
            Description = request.Description,
            VideoUrl = request.VideoUrl,
            ExternalVideoLink = request.ExternalVideoLink,
            OfferedPrice = request.OfferedPrice,
            Status = request.Status,
            // Proposal fields
            ProposedByCoachId = request.ProposedByCoachId,
            ProposedByCoachName = request.ProposedByCoach != null ? $"{request.ProposedByCoach.FirstName} {request.ProposedByCoach.LastName}" : null,
            ProposedByCoachAvatar = request.ProposedByCoach?.ProfileImageUrl,
            ProposedPrice = request.ProposedPrice,
            ProposalNote = request.ProposalNote,
            ProposedAt = request.ProposedAt,
            // Accepted fields
            AcceptedByCoachId = request.AcceptedByCoachId,
            AcceptedByCoachName = request.AcceptedByCoach != null ? $"{request.AcceptedByCoach.FirstName} {request.AcceptedByCoach.LastName}" : null,
            ReviewVideoUrl = request.ReviewVideoUrl,
            ReviewNotes = request.ReviewNotes,
            AcceptedAt = request.AcceptedAt,
            CompletedAt = request.CompletedAt,
            CreatedAt = request.CreatedAt
        };
    }
}
