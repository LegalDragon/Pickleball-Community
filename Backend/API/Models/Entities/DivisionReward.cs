using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Rewards for top finishers in event divisions.
/// Examples: 1st place gets $500 cash, 2nd place gets gold medal, etc.
/// </summary>
public class DivisionReward
{
    public int Id { get; set; }

    [Required]
    public int DivisionId { get; set; }

    /// <summary>
    /// Placement position (1 = 1st place, 2 = 2nd place, etc.)
    /// </summary>
    [Required]
    public int Placement { get; set; }

    /// <summary>
    /// Type of reward: Cash, Medal, Trophy, Certificate, Other
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string RewardType { get; set; } = "Medal";

    /// <summary>
    /// For cash rewards, the amount
    /// </summary>
    [Column(TypeName = "decimal(10,2)")]
    public decimal? CashAmount { get; set; }

    /// <summary>
    /// Description of the reward (e.g., "Gold Medal", "Championship Trophy", "Gift Card")
    /// </summary>
    [MaxLength(200)]
    public string? Description { get; set; }

    [MaxLength(50)]
    public string? Icon { get; set; }

    [MaxLength(20)]
    public string? Color { get; set; }

    public bool IsActive { get; set; } = true;

    // Navigation
    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }
}

public static class RewardTypes
{
    public const string Cash = "Cash";
    public const string Medal = "Medal";
    public const string Trophy = "Trophy";
    public const string Certificate = "Certificate";
    public const string Other = "Other";
}
