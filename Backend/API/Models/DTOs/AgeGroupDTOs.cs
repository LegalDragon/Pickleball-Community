namespace Pickleball.Community.Models.DTOs;

public class AgeGroupDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? MinAge { get; set; }
    public int? MaxAge { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class CreateAgeGroupDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? MinAge { get; set; }
    public int? MaxAge { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public int SortOrder { get; set; } = 0;
}

public class UpdateAgeGroupDto : CreateAgeGroupDto
{
    public bool IsActive { get; set; } = true;
}
