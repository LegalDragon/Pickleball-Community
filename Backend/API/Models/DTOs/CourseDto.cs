namespace Pickleball.College.Models.DTOs;

public class CourseDto
{
    public int Id { get; set; }
    public int CoachId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public decimal Price { get; set; }
    public bool IsPublished { get; set; }
    public bool HasPurchased { get; set; }
    public DateTime CreatedAt { get; set; }
    public CoachDto Coach { get; set; } = null!;
    public List<CourseMaterialDto> Materials { get; set; } = new();
    public int MaterialCount { get; set; }
    public int PreviewCount { get; set; }
}

public class CourseMaterialDto
{
    public int Id { get; set; }
    public int MaterialId { get; set; }
    public int SortOrder { get; set; }
    public bool IsPreview { get; set; }
    public MaterialDto Material { get; set; } = null!;
}

public class CreateCourseRequest
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public decimal Price { get; set; }
    public IFormFile? ThumbnailFile { get; set; }
}

public class UpdateCourseRequest
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public decimal Price { get; set; }
    public IFormFile? ThumbnailFile { get; set; }
}

public class AddCourseMaterialRequest
{
    public int MaterialId { get; set; }
    public int SortOrder { get; set; }
    public bool IsPreview { get; set; }
}

public class UpdateCourseMaterialRequest
{
    public int SortOrder { get; set; }
    public bool IsPreview { get; set; }
}

public class ReorderCourseMaterialsRequest
{
    public List<MaterialOrderItem> Materials { get; set; } = new();
}

public class MaterialOrderItem
{
    public int CourseMaterialId { get; set; }
    public int SortOrder { get; set; }
    public bool IsPreview { get; set; }
}
