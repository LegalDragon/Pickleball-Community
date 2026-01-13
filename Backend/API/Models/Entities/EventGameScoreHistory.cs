using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Audit trail for score changes in event games
/// </summary>
public class EventGameScoreHistory
{
    public int Id { get; set; }

    public int GameId { get; set; }

    /// <summary>
    /// Type of change: ScoreSubmitted, ScoreConfirmed, ScoreDisputed, ScoreEdited, ScoreReset
    /// </summary>
    [MaxLength(50)]
    public string ChangeType { get; set; } = null!;

    /// <summary>
    /// Score values at time of change
    /// </summary>
    public int Unit1Score { get; set; }
    public int Unit2Score { get; set; }

    /// <summary>
    /// Previous values (for edits)
    /// </summary>
    public int? PreviousUnit1Score { get; set; }
    public int? PreviousUnit2Score { get; set; }

    /// <summary>
    /// Who made the change
    /// </summary>
    public int ChangedByUserId { get; set; }
    public int? ChangedByUnitId { get; set; }

    /// <summary>
    /// Reason for the change (for disputes or admin overrides)
    /// </summary>
    [MaxLength(500)]
    public string? Reason { get; set; }

    /// <summary>
    /// Whether this was an admin override
    /// </summary>
    public bool IsAdminOverride { get; set; }

    /// <summary>
    /// IP address for security auditing
    /// </summary>
    [MaxLength(45)]
    public string? IpAddress { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("GameId")]
    public EventGame? Game { get; set; }

    [ForeignKey("ChangedByUserId")]
    public User? ChangedByUser { get; set; }

    [ForeignKey("ChangedByUnitId")]
    public EventUnit? ChangedByUnit { get; set; }
}

/// <summary>
/// Score change types for audit trail
/// </summary>
public static class ScoreChangeType
{
    public const string ScoreSubmitted = "ScoreSubmitted";
    public const string ScoreConfirmed = "ScoreConfirmed";
    public const string ScoreDisputed = "ScoreDisputed";
    public const string ScoreEdited = "ScoreEdited";
    public const string ScoreReset = "ScoreReset";
    public const string AdminOverride = "AdminOverride";
}
