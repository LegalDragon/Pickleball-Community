using Pickleball.College.Models.DTOs;
using Pickleball.College.Models.Entities;

namespace Pickleball.College.Services;

public interface IMaterialService
{
    Task<MaterialDto> CreateMaterialAsync(int coachId, CreateMaterialRequest request, string? videoUrl, string? thumbnailUrl);
    Task<MaterialDto> UpdateMaterialAsync(int materialId, int coachId, UpdateMaterialRequest request, string? videoUrl, string? thumbnailUrl);
    Task<PurchaseResult> PurchaseMaterialAsync(int studentId, int materialId);
    Task<List<MaterialDto>> GetPublishedMaterialsAsync(int? userId = null);
    Task<List<MaterialDto>> GetCoachMaterialsAsync(int coachId);
    Task<MaterialDto> GetMaterialAsync(int materialId, int? userId = null);
    Task<MaterialDto> TogglePublishAsync(int materialId, int coachId);
}

public interface IFileStorageService
{
    Task<string> UploadFileAsync(IFormFile file, string containerName);
    Task DeleteFileAsync(string fileUrl);
}

public interface IStripeService
{
    Task<Stripe.PaymentIntent> CreatePaymentIntentAsync(decimal amount, string description);
    Task<string> CreateCoachAccountAsync(string email);
    Task<bool> ProcessPayoutAsync(string coachStripeAccountId, decimal amount);
}

public interface IAuthService
{
    Task<User?> AuthenticateAsync(string email, string password);
    Task<User?> FastAuthenticateAsync(string token);
    Task<User> RegisterAsync(RegisterRequest request);
    string GenerateJwtToken(User user);
    Task<User?> UpdateRoleAsync(int userId, string role);
}

public interface ISessionService
{
    Task<TrainingSession> ScheduleSessionAsync(SessionRequest request, int studentId);
    Task<List<TrainingSession>> GetCoachSessionsAsync(int coachId);
    Task<List<TrainingSession>> GetStudentSessionsAsync(int studentId);
    Task<bool> CancelSessionAsync(int sessionId, int userId);
    Task<TrainingSession> RequestSessionAsync(CreateSessionRequest request, int studentId);
    Task<TrainingSession> ConfirmSessionAsync(ConfirmSessionRequest request, int coachId);
    Task<List<TrainingSession>> GetPendingSessionsAsync(int coachId);

    // Session proposal methods (coach counter-proposes changes)
    Task<TrainingSession> ProposeSessionChangesAsync(int sessionId, int coachId, SessionProposalRequest proposal);
    Task<TrainingSession> AcceptSessionProposalAsync(int sessionId, int studentId);
    Task<TrainingSession> DeclineSessionProposalAsync(int sessionId, int studentId);
    Task<List<TrainingSession>> GetSessionsWithProposalsAsync(int studentId);
}

public interface ICourseService
{
    // Course CRUD
    Task<CourseDto> CreateCourseAsync(int coachId, CreateCourseRequest request, string? thumbnailUrl);
    Task<CourseDto> UpdateCourseAsync(int courseId, int coachId, UpdateCourseRequest request, string? thumbnailUrl);
    Task<CourseDto> GetCourseAsync(int courseId);
    Task<CourseDto> GetCourseWithMaterialsAsync(int courseId, int? userId = null);
    Task<List<CourseDto>> GetCoachCoursesAsync(int coachId);
    Task<List<CourseDto>> GetPublishedCoursesAsync(int? userId = null);
    Task<CourseDto> TogglePublishAsync(int courseId, int coachId);
    Task DeleteCourseAsync(int courseId, int coachId);

    // Course Materials
    Task<CourseMaterialDto> AddMaterialToCourseAsync(int courseId, int coachId, AddCourseMaterialRequest request);
    Task<CourseMaterialDto> UpdateCourseMaterialAsync(int courseId, int courseMaterialId, int coachId, UpdateCourseMaterialRequest request);
    Task RemoveMaterialFromCourseAsync(int courseId, int courseMaterialId, int coachId);
    Task ReorderCourseMaterialsAsync(int courseId, int coachId, ReorderCourseMaterialsRequest request);

    // Purchases
    Task<bool> HasPurchasedCourseAsync(int courseId, int studentId);
    Task<PurchaseResult> PurchaseCourseAsync(int courseId, int studentId);
}
