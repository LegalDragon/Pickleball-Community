namespace Pickleball.Community.Models.DTOs;

// Category DTOs
public class FaqCategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public List<FaqEntryDto> Entries { get; set; } = new();
}

public class CreateFaqCategoryDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public int SortOrder { get; set; } = 0;
}

public class UpdateFaqCategoryDto : CreateFaqCategoryDto
{
    public bool IsActive { get; set; } = true;
}

// Entry DTOs
public class FaqEntryDto
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public string Question { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class CreateFaqEntryDto
{
    public int CategoryId { get; set; }
    public string Question { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
    public int SortOrder { get; set; } = 0;
}

public class UpdateFaqEntryDto : CreateFaqEntryDto
{
    public bool IsActive { get; set; } = true;
}
