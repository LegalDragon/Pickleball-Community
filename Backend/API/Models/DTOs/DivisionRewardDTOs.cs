namespace Pickleball.Community.Models.DTOs;

public class DivisionRewardDto
{
    public int Id { get; set; }
    public int DivisionId { get; set; }
    public int Placement { get; set; }
    public string RewardType { get; set; } = "Medal";
    public decimal? CashAmount { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public bool IsActive { get; set; }
}

public class CreateDivisionRewardDto
{
    public int Placement { get; set; }
    public string RewardType { get; set; } = "Medal";
    public decimal? CashAmount { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
}

public class UpdateDivisionRewardDto : CreateDivisionRewardDto
{
    public bool IsActive { get; set; } = true;
}
