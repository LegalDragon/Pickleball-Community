using System.ComponentModel.DataAnnotations;

namespace Pickleball.College.Models.Entities;

public class Course
{
    public int Id { get; set; }
    public int CoachId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string Description { get; set; } = string.Empty;

    public string? ThumbnailUrl { get; set; }

    [Range(0, 10000)]
    public decimal Price { get; set; }

    public bool IsPublished { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User Coach { get; set; } = null!;
    public ICollection<CourseMaterial> CourseMaterials { get; set; } = new List<CourseMaterial>();
    public ICollection<CoursePurchase> Purchases { get; set; } = new List<CoursePurchase>();
}

public class CourseMaterial
{
    public int Id { get; set; }
    public int CourseId { get; set; }
    public int MaterialId { get; set; }

    public int SortOrder { get; set; }
    public bool IsPreview { get; set; }

    // Navigation properties
    public Course Course { get; set; } = null!;
    public TrainingMaterial Material { get; set; } = null!;
}

public class CoursePurchase
{
    public int Id { get; set; }
    public int CourseId { get; set; }
    public int StudentId { get; set; }

    public decimal PurchasePrice { get; set; }
    public decimal PlatformFee { get; set; }
    public decimal CoachEarnings { get; set; }

    public string? StripePaymentIntentId { get; set; }
    public DateTime PurchasedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Course Course { get; set; } = null!;
    public User Student { get; set; } = null!;
}
