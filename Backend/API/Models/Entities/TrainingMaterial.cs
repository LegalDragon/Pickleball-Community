using System.ComponentModel.DataAnnotations;

namespace Pickleball.College.Models.Entities;

public class TrainingMaterial
{
    public int Id { get; set; }
    public int CoachId { get; set; }
    
    [Required]
    public string Title { get; set; } = string.Empty;
    
    public string Description { get; set; } = string.Empty;
    
    [Required]
    public string ContentType { get; set; } = "Document";
     
    
    [Range(0, 10000)]
    public decimal Price { get; set; }
    
    public bool IsPublished { get; set; }
    public string? ThumbnailUrl { get; set; }
    public string? VideoUrl { get; set; }
    public string? ExternalLink { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    public User Coach { get; set; } = null!;
    public ICollection<MaterialPurchase> Purchases { get; set; } = new List<MaterialPurchase>();
    public ICollection<TrainingSession> Sessions { get; set; } = new List<TrainingSession>();
    public ICollection<CourseMaterial> CourseMaterials { get; set; } = new List<CourseMaterial>();
}
