namespace Pickleball.Community.Models.DTOs;

public class TeamUnitDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? UnitCode { get; set; }
    public string? Description { get; set; }
    public int MaleCount { get; set; }
    public int FemaleCount { get; set; }
    public int UnisexCount { get; set; }
    public int TotalPlayers { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class CreateTeamUnitDto
{
    public string Name { get; set; } = string.Empty;
    public string? UnitCode { get; set; }
    public string? Description { get; set; }
    public int MaleCount { get; set; }
    public int FemaleCount { get; set; }
    public int UnisexCount { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public int SortOrder { get; set; } = 0;
}

public class UpdateTeamUnitDto : CreateTeamUnitDto
{
    public bool IsActive { get; set; } = true;
}
