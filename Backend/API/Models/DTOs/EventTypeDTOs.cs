namespace Pickleball.Community.Models.DTOs;

public class EventTypeDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public bool AllowMultipleDivisions { get; set; } = true;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class CreateEventTypeDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public bool AllowMultipleDivisions { get; set; } = true;
    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
}

public class UpdateEventTypeDto
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public bool? AllowMultipleDivisions { get; set; }
    public int? SortOrder { get; set; }
    public bool? IsActive { get; set; }
}
