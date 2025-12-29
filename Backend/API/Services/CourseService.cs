using Microsoft.EntityFrameworkCore;
using Pickleball.College.Database;
using Pickleball.College.Models.DTOs;
using Pickleball.College.Models.Entities;

namespace Pickleball.College.Services;

public class CourseService : ICourseService
{
    private readonly ApplicationDbContext _context;
    private readonly IStripeService _stripeService;

    public CourseService(ApplicationDbContext context, IStripeService stripeService)
    {
        _context = context;
        _stripeService = stripeService;
    }

    public async Task<CourseDto> CreateCourseAsync(int coachId, CreateCourseRequest request, string? thumbnailUrl)
    {
        var course = new Course
        {
            CoachId = coachId,
            Title = request.Title,
            Description = request.Description,
            ThumbnailUrl = thumbnailUrl ?? request.ThumbnailUrl,
            Price = request.Price,
            IsPublished = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Courses.Add(course);
        await _context.SaveChangesAsync();

        return await GetCourseAsync(course.Id);
    }

    public async Task<CourseDto> UpdateCourseAsync(int courseId, int coachId, UpdateCourseRequest request, string? thumbnailUrl)
    {
        var course = await _context.Courses
            .FirstOrDefaultAsync(c => c.Id == courseId && c.CoachId == coachId);

        if (course == null)
        {
            throw new ArgumentException("Course not found or unauthorized");
        }

        course.Title = request.Title;
        course.Description = request.Description;
        course.Price = request.Price;
        course.UpdatedAt = DateTime.UtcNow;

        if (!string.IsNullOrEmpty(thumbnailUrl))
        {
            course.ThumbnailUrl = thumbnailUrl;
        }
        else if (!string.IsNullOrEmpty(request.ThumbnailUrl))
        {
            course.ThumbnailUrl = request.ThumbnailUrl;
        }

        await _context.SaveChangesAsync();

        return await GetCourseAsync(courseId);
    }

    public async Task<CourseDto> GetCourseAsync(int courseId)
    {
        var course = await _context.Courses
            .Include(c => c.Coach)
            .Include(c => c.CourseMaterials)
            .Where(c => c.Id == courseId)
            .FirstOrDefaultAsync();

        if (course == null)
        {
            throw new ArgumentException("Course not found");
        }

        return MapToDto(course);
    }

    public async Task<CourseDto> GetCourseWithMaterialsAsync(int courseId, int? userId = null)
    {
        var course = await _context.Courses
            .Include(c => c.Coach)
            .Include(c => c.CourseMaterials)
                .ThenInclude(cm => cm.Material)
                    .ThenInclude(m => m.Coach)
            .Where(c => c.Id == courseId)
            .FirstOrDefaultAsync();

        if (course == null)
        {
            throw new ArgumentException("Course not found");
        }

        // Check if user has purchased this course
        bool hasPurchased = false;
        if (userId.HasValue)
        {
            hasPurchased = await _context.CoursePurchases
                .AnyAsync(cp => cp.CourseId == courseId && cp.StudentId == userId.Value);
        }

        return MapToDtoWithMaterials(course, hasPurchased, userId);
    }

    public async Task<List<CourseDto>> GetCoachCoursesAsync(int coachId)
    {
        var courses = await _context.Courses
            .Include(c => c.Coach)
            .Include(c => c.CourseMaterials)
            .Where(c => c.CoachId == coachId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        return courses.Select(c => MapToDto(c)).ToList();
    }

    public async Task<List<CourseDto>> GetPublishedCoursesAsync(int? userId = null)
    {
        var courses = await _context.Courses
            .Include(c => c.Coach)
            .Include(c => c.CourseMaterials)
            .Where(c => c.IsPublished)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        // Get purchased course IDs for the user
        var purchasedCourseIds = new HashSet<int>();
        if (userId.HasValue)
        {
            purchasedCourseIds = (await _context.CoursePurchases
                .Where(cp => cp.StudentId == userId.Value)
                .Select(cp => cp.CourseId)
                .ToListAsync())
                .ToHashSet();
        }

        return courses.Select(c => MapToDto(c, purchasedCourseIds.Contains(c.Id))).ToList();
    }

    public async Task<CourseDto> TogglePublishAsync(int courseId, int coachId)
    {
        var course = await _context.Courses
            .FirstOrDefaultAsync(c => c.Id == courseId && c.CoachId == coachId);

        if (course == null)
        {
            throw new ArgumentException("Course not found or unauthorized");
        }

        course.IsPublished = !course.IsPublished;
        course.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return await GetCourseAsync(courseId);
    }

    public async Task DeleteCourseAsync(int courseId, int coachId)
    {
        var course = await _context.Courses
            .FirstOrDefaultAsync(c => c.Id == courseId && c.CoachId == coachId);

        if (course == null)
        {
            throw new ArgumentException("Course not found or unauthorized");
        }

        _context.Courses.Remove(course);
        await _context.SaveChangesAsync();
    }

    // Course Materials
    public async Task<CourseMaterialDto> AddMaterialToCourseAsync(int courseId, int coachId, AddCourseMaterialRequest request)
    {
        var course = await _context.Courses
            .FirstOrDefaultAsync(c => c.Id == courseId && c.CoachId == coachId);

        if (course == null)
        {
            throw new ArgumentException("Course not found or unauthorized");
        }

        // Verify material belongs to the same coach
        var material = await _context.TrainingMaterials
            .FirstOrDefaultAsync(m => m.Id == request.MaterialId && m.CoachId == coachId);

        if (material == null)
        {
            throw new ArgumentException("Material not found or unauthorized");
        }

        // Check if material is already in course
        var existing = await _context.CourseMaterials
            .AnyAsync(cm => cm.CourseId == courseId && cm.MaterialId == request.MaterialId);

        if (existing)
        {
            throw new ArgumentException("Material is already in this course");
        }

        var courseMaterial = new CourseMaterial
        {
            CourseId = courseId,
            MaterialId = request.MaterialId,
            SortOrder = request.SortOrder,
            IsPreview = request.IsPreview
        };

        _context.CourseMaterials.Add(courseMaterial);
        await _context.SaveChangesAsync();

        return await GetCourseMaterialDtoAsync(courseMaterial.Id);
    }

    public async Task<CourseMaterialDto> UpdateCourseMaterialAsync(int courseId, int courseMaterialId, int coachId, UpdateCourseMaterialRequest request)
    {
        var courseMaterial = await _context.CourseMaterials
            .Include(cm => cm.Course)
            .FirstOrDefaultAsync(cm => cm.Id == courseMaterialId && cm.CourseId == courseId && cm.Course.CoachId == coachId);

        if (courseMaterial == null)
        {
            throw new ArgumentException("Course material not found or unauthorized");
        }

        courseMaterial.SortOrder = request.SortOrder;
        courseMaterial.IsPreview = request.IsPreview;
        await _context.SaveChangesAsync();

        return await GetCourseMaterialDtoAsync(courseMaterialId);
    }

    public async Task RemoveMaterialFromCourseAsync(int courseId, int courseMaterialId, int coachId)
    {
        var courseMaterial = await _context.CourseMaterials
            .Include(cm => cm.Course)
            .FirstOrDefaultAsync(cm => cm.Id == courseMaterialId && cm.CourseId == courseId && cm.Course.CoachId == coachId);

        if (courseMaterial == null)
        {
            throw new ArgumentException("Course material not found or unauthorized");
        }

        _context.CourseMaterials.Remove(courseMaterial);
        await _context.SaveChangesAsync();
    }

    public async Task ReorderCourseMaterialsAsync(int courseId, int coachId, ReorderCourseMaterialsRequest request)
    {
        var course = await _context.Courses
            .Include(c => c.CourseMaterials)
            .FirstOrDefaultAsync(c => c.Id == courseId && c.CoachId == coachId);

        if (course == null)
        {
            throw new ArgumentException("Course not found or unauthorized");
        }

        foreach (var item in request.Materials)
        {
            var courseMaterial = course.CourseMaterials.FirstOrDefault(cm => cm.Id == item.CourseMaterialId);
            if (courseMaterial != null)
            {
                courseMaterial.SortOrder = item.SortOrder;
                courseMaterial.IsPreview = item.IsPreview;
            }
        }

        await _context.SaveChangesAsync();
    }

    // Purchases
    public async Task<bool> HasPurchasedCourseAsync(int courseId, int studentId)
    {
        return await _context.CoursePurchases
            .AnyAsync(cp => cp.CourseId == courseId && cp.StudentId == studentId);
    }

    public async Task<PurchaseResult> PurchaseCourseAsync(int courseId, int studentId)
    {
        var course = await _context.Courses
            .Include(c => c.Coach)
            .FirstOrDefaultAsync(c => c.Id == courseId);

        if (course == null)
        {
            throw new ArgumentException("Course not found");
        }

        // Check if already purchased
        if (await HasPurchasedCourseAsync(courseId, studentId))
        {
            throw new ArgumentException("Course already purchased");
        }

        string? paymentIntentId = null;
        string? clientSecret = null;

        // Try to create Stripe payment intent, fall back to demo mode if Stripe is not configured
        try
        {
            var paymentIntent = await _stripeService.CreatePaymentIntentAsync(course.Price, $"Purchase of course: {course.Title}");
            paymentIntentId = paymentIntent.Id;
            clientSecret = paymentIntent.ClientSecret;
        }
        catch (Exception ex)
        {
            // Stripe not configured - use demo mode
            Console.WriteLine($"Stripe not available ({ex.Message}), using demo purchase mode");
            paymentIntentId = $"demo_{Guid.NewGuid():N}";
            clientSecret = "demo_mode";
        }

        // Create purchase record
        var purchase = new CoursePurchase
        {
            CourseId = courseId,
            StudentId = studentId,
            PurchasePrice = course.Price,
            PlatformFee = course.Price * 0.15m,
            CoachEarnings = course.Price * 0.85m,
            StripePaymentIntentId = paymentIntentId,
            PurchasedAt = DateTime.UtcNow
        };

        _context.CoursePurchases.Add(purchase);
        await _context.SaveChangesAsync();

        return new PurchaseResult
        {
            ClientSecret = clientSecret,
            PurchaseId = purchase.Id,
            Amount = course.Price
        };
    }

    // Helper methods
    private CourseDto MapToDto(Course course, bool hasPurchased = false)
    {
        return new CourseDto
        {
            Id = course.Id,
            CoachId = course.CoachId,
            Title = course.Title,
            Description = course.Description,
            ThumbnailUrl = course.ThumbnailUrl,
            Price = course.Price,
            IsPublished = course.IsPublished,
            HasPurchased = hasPurchased,
            CreatedAt = course.CreatedAt,
            Coach = new CoachDto
            {
                Id = course.CoachId,
                FirstName = course.Coach.FirstName,
                LastName = course.Coach.LastName,
                ProfileImageUrl = course.Coach.ProfileImageUrl
            },
            MaterialCount = course.CourseMaterials.Count,
            PreviewCount = course.CourseMaterials.Count(cm => cm.IsPreview)
        };
    }

    private CourseDto MapToDtoWithMaterials(Course course, bool hasPurchased, int? userId)
    {
        var dto = MapToDto(course, hasPurchased);
        dto.Materials = course.CourseMaterials
            .OrderBy(cm => cm.SortOrder)
            .Select(cm => new CourseMaterialDto
            {
                Id = cm.Id,
                MaterialId = cm.MaterialId,
                SortOrder = cm.SortOrder,
                IsPreview = cm.IsPreview,
                Material = new MaterialDto
                {
                    Id = cm.Material.Id,
                    CoachId = cm.Material.CoachId,
                    Title = cm.Material.Title,
                    Description = cm.Material.Description,
                    ContentType = cm.Material.ContentType,
                    Price = cm.Material.Price,
                    ThumbnailUrl = cm.Material.ThumbnailUrl,
                    // Only include video/content URLs if preview or purchased or is coach
                    VideoUrl = (cm.IsPreview || hasPurchased || cm.Material.CoachId == userId) ? cm.Material.VideoUrl : null,
                    ExternalLink = (cm.IsPreview || hasPurchased || cm.Material.CoachId == userId) ? cm.Material.ExternalLink : null,
                    IsPublished = cm.Material.IsPublished,
                    CreatedAt = cm.Material.CreatedAt,
                    Coach = new CoachDto
                    {
                        Id = cm.Material.CoachId,
                        FirstName = cm.Material.Coach.FirstName,
                        LastName = cm.Material.Coach.LastName,
                        ProfileImageUrl = cm.Material.Coach.ProfileImageUrl
                    }
                }
            })
            .ToList();

        return dto;
    }

    private async Task<CourseMaterialDto> GetCourseMaterialDtoAsync(int courseMaterialId)
    {
        var cm = await _context.CourseMaterials
            .Include(cm => cm.Material)
                .ThenInclude(m => m.Coach)
            .FirstOrDefaultAsync(cm => cm.Id == courseMaterialId);

        if (cm == null)
        {
            throw new ArgumentException("Course material not found");
        }

        return new CourseMaterialDto
        {
            Id = cm.Id,
            MaterialId = cm.MaterialId,
            SortOrder = cm.SortOrder,
            IsPreview = cm.IsPreview,
            Material = new MaterialDto
            {
                Id = cm.Material.Id,
                CoachId = cm.Material.CoachId,
                Title = cm.Material.Title,
                Description = cm.Material.Description,
                ContentType = cm.Material.ContentType,
                Price = cm.Material.Price,
                ThumbnailUrl = cm.Material.ThumbnailUrl,
                VideoUrl = cm.Material.VideoUrl,
                ExternalLink = cm.Material.ExternalLink,
                IsPublished = cm.Material.IsPublished,
                CreatedAt = cm.Material.CreatedAt,
                Coach = new CoachDto
                {
                    Id = cm.Material.CoachId,
                    FirstName = cm.Material.Coach.FirstName,
                    LastName = cm.Material.Coach.LastName,
                    ProfileImageUrl = cm.Material.Coach.ProfileImageUrl
                }
            }
        };
    }
}
