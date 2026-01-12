namespace API.Models.DTOs;

// Category DTOs
public class FeedbackCategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public int EntryCount { get; set; }
}

public class CreateFeedbackCategoryDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
}

public class UpdateFeedbackCategoryDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

// Entry DTOs
public class FeedbackEntryDto
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? UserEmail { get; set; }
    public string? UserName { get; set; }
    public int? UserId { get; set; }
    public string Status { get; set; } = "New";
    public string? AdminNotes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateFeedbackEntryDto
{
    public int CategoryId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? UserEmail { get; set; }
    public string? UserName { get; set; }
}

public class UpdateFeedbackEntryDto
{
    public string Status { get; set; } = string.Empty;
    public string? AdminNotes { get; set; }
}
