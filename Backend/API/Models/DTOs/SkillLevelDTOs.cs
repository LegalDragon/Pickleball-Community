namespace Pickleball.Community.Models.DTOs;

public class SkillLevelDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal? Value { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class CreateSkillLevelDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal? Value { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public int SortOrder { get; set; } = 0;
}

public class UpdateSkillLevelDto : CreateSkillLevelDto
{
    public bool IsActive { get; set; } = true;
}
