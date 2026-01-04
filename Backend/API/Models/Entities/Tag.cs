namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Represents a unique tag name in the system
/// </summary>
public class TagDefinition
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ObjectTag> ObjectTags { get; set; } = new List<ObjectTag>();
}

/// <summary>
/// Represents a tag applied to an object (polymorphic)
/// </summary>
public class ObjectTag
{
    public int Id { get; set; }
    public int TagId { get; set; }

    // Polymorphic: Material, Course, Coach, etc.
    public string ObjectType { get; set; } = string.Empty;
    public int ObjectId { get; set; }

    public int? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public TagDefinition Tag { get; set; } = null!;
    public User? CreatedByUser { get; set; }
}
