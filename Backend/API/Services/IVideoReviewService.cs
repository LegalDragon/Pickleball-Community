using Pickleball.College.Models.DTOs;

namespace Pickleball.College.Services;

public interface IVideoReviewService
{
    // Student operations
    Task<VideoReviewRequestDto> CreateRequestAsync(int studentId, CreateVideoReviewRequest request);
    Task<VideoReviewRequestDto> UpdateRequestAsync(int studentId, int requestId, UpdateVideoReviewRequest request);
    Task<List<VideoReviewRequestDto>> GetStudentRequestsAsync(int studentId);
    Task<bool> CancelRequestAsync(int studentId, int requestId);

    // Bidding/Proposal operations
    Task<VideoReviewRequestDto> ProposeAsync(int coachId, int requestId, CoachProposalRequest proposal);
    Task<VideoReviewRequestDto> AcceptProposalAsync(int studentId, int requestId);
    Task<VideoReviewRequestDto> DeclineProposalAsync(int studentId, int requestId);

    // Coach operations
    Task<List<VideoReviewRequestDto>> GetOpenRequestsAsync(int? coachId = null);
    Task<List<VideoReviewRequestDto>> GetCoachRequestsAsync(int coachId);
    Task<VideoReviewRequestDto> AcceptRequestAsync(int coachId, int requestId);
    Task<VideoReviewRequestDto> CompleteReviewAsync(int coachId, CompleteVideoReviewRequest request);

    // Common
    Task<VideoReviewRequestDto?> GetRequestAsync(int requestId);
}
