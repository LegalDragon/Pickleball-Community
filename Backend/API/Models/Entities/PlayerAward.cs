using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Player awards including badges, league points, notable finishes, achievements
/// </summary>
public class PlayerAward
{
    public int Id { get; set; }

    public int UserId { get; set; }

    /// <summary>
    /// Award Type: Badge, LeaguePoints, NotableFinish, Achievement, Milestone
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string AwardType { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [MaxLength(500)]
    public string? IconUrl { get; set; }

    /// <summary>
    /// Badge color: gold, silver, bronze, blue, green, etc.
    /// </summary>
    [MaxLength(50)]
    public string? BadgeColor { get; set; }

    /// <summary>
    /// Points value for point-based awards
    /// </summary>
    public int? PointsValue { get; set; }

    // Context references
    public int? EventId { get; set; }
    public int? DivisionId { get; set; }
    public int? LeagueId { get; set; }
    public int? ClubId { get; set; }
    public int? SeasonId { get; set; }

    /// <summary>
    /// For notable finishes: 1st, 2nd, 3rd, etc.
    /// </summary>
    public int? PlacementRank { get; set; }

    public DateTime AwardedAt { get; set; } = DateTime.Now;
    public bool AwardedBySystem { get; set; } = true;
    public int? AwardedByUserId { get; set; }

    /// <summary>
    /// For expiring awards (like seasonal badges)
    /// </summary>
    public DateTime? ExpiresAt { get; set; }
    public bool IsActive { get; set; } = true;

    [MaxLength(500)]
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("UserId")]
    public User? User { get; set; }

    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }

    [ForeignKey("LeagueId")]
    public League? League { get; set; }

    [ForeignKey("ClubId")]
    public Club? Club { get; set; }

    [ForeignKey("AwardedByUserId")]
    public User? AwardedBy { get; set; }
}
