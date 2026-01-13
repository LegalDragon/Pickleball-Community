using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.DTOs;

public class TagDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class ObjectTagDto
{
    public int Id { get; set; }
    public int TagId { get; set; }
    public string TagName { get; set; } = string.Empty;
    public string ObjectType { get; set; } = string.Empty;
    public int ObjectId { get; set; }
    public int? UserId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AddTagRequest
{
    [Required]
    public string ObjectType { get; set; } = string.Empty;

    [Required]
    public int ObjectId { get; set; }

    [Required]
    [StringLength(50, MinimumLength = 1)]
    public string TagName { get; set; } = string.Empty;
}

public class RemoveTagRequest
{
    [Required]
    public string ObjectType { get; set; } = string.Empty;

    [Required]
    public int ObjectId { get; set; }

    [Required]
    public int TagId { get; set; }
}

public class CommonTagDto
{
    public int TagId { get; set; }
    public string TagName { get; set; } = string.Empty;
    public int UsageCount { get; set; }
}
