using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Links a user to a specific match within an encounter.
/// Used for lineup management in team scrimmage format.
/// </summary>
public class EncounterMatchPlayer
{
    public int Id { get; set; }

    public int MatchId { get; set; }
    public int UserId { get; set; }

    /// <summary>
    /// Which side/unit this player is on (1 or 2)
    /// </summary>
    public int UnitSide { get; set; }

    /// <summary>
    /// Player's gender for validation: M, F, or NULL (unknown/other)
    /// </summary>
    [MaxLength(1)]
    public string? Gender { get; set; }

    /// <summary>
    /// Whether this player is a substitute (not in original lineup)
    /// </summary>
    public bool IsSubstitute { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("MatchId")]
    public EncounterMatch? Match { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }
}
