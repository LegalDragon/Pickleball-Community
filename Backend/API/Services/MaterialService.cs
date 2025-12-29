using Microsoft.EntityFrameworkCore;
using Pickleball.College.Database;
using Pickleball.College.Models.DTOs;
using Pickleball.College.Models.Entities;

namespace Pickleball.College.Services;

public class MaterialService : IMaterialService
{
    private readonly ApplicationDbContext _context;
    private readonly IStripeService _stripeService;

    public MaterialService(ApplicationDbContext context, IStripeService stripeService)
    {
        _context = context;
        _stripeService = stripeService;
    }

    public async Task<MaterialDto> CreateMaterialAsync(int coachId, CreateMaterialRequest request, string? videoUrl, string? thumbnailUrl)
    {
        // Use thumbnailUrl from file upload, or fall back to the URL passed in the request (from asset API)
        var finalThumbnailUrl = thumbnailUrl ?? request.ThumbnailUrl;

        var material = new TrainingMaterial
        {
            CoachId = coachId,
            Title = request.Title,
            Description = request.Description,
            ContentType = request.ContentType,
            Price = request.Price,
            VideoUrl = videoUrl,
            ThumbnailUrl = finalThumbnailUrl,
            ExternalLink = request.ExternalLink,
            IsPublished = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.TrainingMaterials.Add(material);
        await _context.SaveChangesAsync();

        return await GetMaterialDtoAsync(material.Id);
    }

    public async Task<MaterialDto> UpdateMaterialAsync(int materialId, int coachId, UpdateMaterialRequest request, string? videoUrl, string? thumbnailUrl)
    {
        var material = await _context.TrainingMaterials
            .FirstOrDefaultAsync(m => m.Id == materialId && m.CoachId == coachId);

        if (material == null)
        {
            throw new ArgumentException("Material not found or unauthorized");
        }

        // Update basic fields
        material.Title = request.Title;
        material.Description = request.Description;
        material.ContentType = request.ContentType;
        material.Price = request.Price;
        material.ExternalLink = request.ExternalLink;
        material.UpdatedAt = DateTime.UtcNow;

        // Update video URL if provided (from file upload or request)
        if (!string.IsNullOrEmpty(videoUrl))
        {
            material.VideoUrl = videoUrl;
        }
        else if (!string.IsNullOrEmpty(request.VideoUrl))
        {
            material.VideoUrl = request.VideoUrl;
        }

        // Update thumbnail URL if provided (from file upload or request)
        if (!string.IsNullOrEmpty(thumbnailUrl))
        {
            material.ThumbnailUrl = thumbnailUrl;
        }
        else if (!string.IsNullOrEmpty(request.ThumbnailUrl))
        {
            material.ThumbnailUrl = request.ThumbnailUrl;
        }

        await _context.SaveChangesAsync();

        return await GetMaterialDtoAsync(materialId);
    }

    public async Task<PurchaseResult> PurchaseMaterialAsync(int studentId, int materialId)
    {
        var material = await _context.TrainingMaterials
            .Include(m => m.Coach)
            .FirstOrDefaultAsync(m => m.Id == materialId);

        if (material == null)
        {
            throw new ArgumentException("Material not found");
        }

        // Check if already purchased
        var existingPurchase = await _context.MaterialPurchases
            .FirstOrDefaultAsync(p => p.StudentId == studentId && p.MaterialId == materialId);

        if (existingPurchase != null)
        {
            throw new ArgumentException("You have already purchased this material");
        }

        string? paymentIntentId = null;
        string? clientSecret = null;

        // Try to create Stripe payment intent, fall back to demo mode if Stripe is not configured
        try
        {
            var paymentIntent = await _stripeService.CreatePaymentIntentAsync(material.Price, $"Purchase of {material.Title}");
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
        var purchase = new MaterialPurchase
        {
            StudentId = studentId,
            MaterialId = materialId,
            PurchasePrice = material.Price,
            PlatformFee = material.Price * 0.15m, // 15% platform fee
            CoachEarnings = material.Price * 0.85m, // 85% to coach
            StripePaymentIntentId = paymentIntentId,
            PurchasedAt = DateTime.UtcNow
        };

        _context.MaterialPurchases.Add(purchase);
        await _context.SaveChangesAsync();

        return new PurchaseResult
        {
            ClientSecret = clientSecret,
            PurchaseId = purchase.Id,
            Amount = material.Price
        };
    }

    public async Task<List<MaterialDto>> GetPublishedMaterialsAsync(int? userId = null)
    {
        var materials = await _context.TrainingMaterials
            .Where(m => m.IsPublished)
            .Include(m => m.Coach)
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync();

        // Get purchased material IDs for the user
        var purchasedMaterialIds = new HashSet<int>();
        if (userId.HasValue)
        {
            purchasedMaterialIds = (await _context.MaterialPurchases
                .Where(mp => mp.StudentId == userId.Value)
                .Select(mp => mp.MaterialId)
                .ToListAsync())
                .ToHashSet();
        }

        return materials.Select(m => {
            var hasPurchased = purchasedMaterialIds.Contains(m.Id);
            var isOwner = userId.HasValue && m.CoachId == userId.Value;

            return new MaterialDto
            {
                Id = m.Id,
                CoachId = m.CoachId,
                Title = m.Title,
                Description = m.Description,
                ContentType = m.ContentType,
                Price = m.Price,
                ThumbnailUrl = m.ThumbnailUrl,
                // Only return content URLs if user has purchased or is the owner
                VideoUrl = (hasPurchased || isOwner) ? m.VideoUrl : null,
                ExternalLink = (hasPurchased || isOwner) ? m.ExternalLink : null,
                IsPublished = m.IsPublished,
                HasPurchased = hasPurchased,
                CreatedAt = m.CreatedAt,
                Coach = new CoachDto
                {
                    Id = m.CoachId,
                    FirstName = m.Coach.FirstName,
                    LastName = m.Coach.LastName,
                    ProfileImageUrl = m.Coach.ProfileImageUrl
                }
            };
        }).ToList();
    }

    public async Task<List<MaterialDto>> GetCoachMaterialsAsync(int coachId)
    {
        return await _context.TrainingMaterials
            .Where(m => m.CoachId == coachId)
            .Include(m => m.Coach)
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => new MaterialDto
            {
                Id = m.Id,
                CoachId = m.CoachId,
                Title = m.Title,
                Description = m.Description,
                ContentType = m.ContentType,
                Price = m.Price,
                ThumbnailUrl = m.ThumbnailUrl,
                VideoUrl = m.VideoUrl,
                ExternalLink = m.ExternalLink,
                IsPublished = m.IsPublished,
                CreatedAt = m.CreatedAt,
                Coach = new CoachDto
                {
                    Id = m.CoachId,
                    FirstName = m.Coach.FirstName,
                    LastName = m.Coach.LastName,
                    ProfileImageUrl = m.Coach.ProfileImageUrl
                }
            })
            .ToListAsync();
    }

    public async Task<MaterialDto> GetMaterialAsync(int materialId, int? userId = null)
    {
        var material = await _context.TrainingMaterials
            .Where(m => m.Id == materialId)
            .Include(m => m.Coach)
            .FirstOrDefaultAsync() ?? throw new ArgumentException("Material not found");

        // Check if user has purchased this material
        var hasPurchased = false;
        if (userId.HasValue)
        {
            hasPurchased = await _context.MaterialPurchases
                .AnyAsync(mp => mp.MaterialId == materialId && mp.StudentId == userId.Value);
        }

        var isOwner = userId.HasValue && material.CoachId == userId.Value;

        return new MaterialDto
        {
            Id = material.Id,
            CoachId = material.CoachId,
            Title = material.Title,
            Description = material.Description,
            ContentType = material.ContentType,
            Price = material.Price,
            ThumbnailUrl = material.ThumbnailUrl,
            // Only return content URLs if user has purchased or is the owner
            VideoUrl = (hasPurchased || isOwner) ? material.VideoUrl : null,
            ExternalLink = (hasPurchased || isOwner) ? material.ExternalLink : null,
            IsPublished = material.IsPublished,
            HasPurchased = hasPurchased,
            CreatedAt = material.CreatedAt,
            Coach = new CoachDto
            {
                Id = material.CoachId,
                FirstName = material.Coach.FirstName,
                LastName = material.Coach.LastName,
                ProfileImageUrl = material.Coach.ProfileImageUrl
            }
        };
    }

    private async Task<MaterialDto> GetMaterialDtoAsync(int materialId)
    {
        // This internal method returns full content (used by coaches for their own materials)
        return await _context.TrainingMaterials
            .Where(m => m.Id == materialId)
            .Include(m => m.Coach)
            .Select(m => new MaterialDto
            {
                Id = m.Id,
                CoachId = m.CoachId,
                Title = m.Title,
                Description = m.Description,
                ContentType = m.ContentType,
                Price = m.Price,
                ThumbnailUrl = m.ThumbnailUrl,
                VideoUrl = m.VideoUrl,
                ExternalLink = m.ExternalLink,
                IsPublished = m.IsPublished,
                CreatedAt = m.CreatedAt,
                Coach = new CoachDto
                {
                    Id = m.CoachId,
                    FirstName = m.Coach.FirstName,
                    LastName = m.Coach.LastName,
                    ProfileImageUrl = m.Coach.ProfileImageUrl
                }
            })
            .FirstOrDefaultAsync() ?? throw new ArgumentException("Material not found");
    }

    public async Task<MaterialDto> TogglePublishAsync(int materialId, int coachId)
    {
        var material = await _context.TrainingMaterials
            .FirstOrDefaultAsync(m => m.Id == materialId && m.CoachId == coachId);

        if (material == null)
        {
            throw new ArgumentException("Material not found or unauthorized");
        }

        material.IsPublished = !material.IsPublished;
        material.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return await GetMaterialDtoAsync(materialId);
    }
}
