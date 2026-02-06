using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// An individual game within a match
/// A match can have multiple games (e.g., best of 3)
/// </summary>
public class EventGame
{
    public int Id { get; set; }

    /// <summary>
    /// Reference to EncounterMatch - required for all games.
    /// </summary>
    public int EncounterMatchId { get; set; }

    /// <summary>
    /// Game number within match (1, 2, 3...)
    /// </summary>
    public int GameNumber { get; set; } = 1;

    /// <summary>
    /// Score format for this game
    /// </summary>
    public int? ScoreFormatId { get; set; }

    /// <summary>
    /// Current/final scores
    /// </summary>
    public int Unit1Score { get; set; } = 0;
    public int Unit2Score { get; set; } = 0;

    /// <summary>
    /// Winner of this game
    /// </summary>
    public int? WinnerUnitId { get; set; }

    /// <summary>
    /// Game status: New, Ready, Queued, Started, Playing, Finished
    /// - New: Game created but not all players checked in
    /// - Ready: All players checked in, waiting to be assigned
    /// - Queued: Assigned to a court, waiting to start
    /// - Started: Game is about to start
    /// - Playing: Game is in progress
    /// - Finished: Game completed
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = "New";

    /// <summary>
    /// Assigned tournament court
    /// </summary>
    public int? TournamentCourtId { get; set; }

    // =====================================================
    // Scheduling (planned vs actual times)
    // =====================================================

    /// <summary>
    /// Planned/scheduled start time for this game
    /// </summary>
    public DateTime? ScheduledStartTime { get; set; }

    /// <summary>
    /// Planned/scheduled end time for this game
    /// </summary>
    public DateTime? ScheduledEndTime { get; set; }

    /// <summary>
    /// Estimated duration in minutes for this game
    /// </summary>
    public int? EstimatedDurationMinutes { get; set; }

    /// <summary>
    /// When game was assigned to court queue
    /// </summary>
    public DateTime? QueuedAt { get; set; }

    /// <summary>
    /// When game actually started
    /// </summary>
    public DateTime? StartedAt { get; set; }

    /// <summary>
    /// When game finished
    /// </summary>
    public DateTime? FinishedAt { get; set; }

    /// <summary>
    /// Unit that submitted the score
    /// </summary>
    public int? ScoreSubmittedByUnitId { get; set; }
    public DateTime? ScoreSubmittedAt { get; set; }

    /// <summary>
    /// Unit that confirmed the score (must be the other unit)
    /// </summary>
    public int? ScoreConfirmedByUnitId { get; set; }
    public DateTime? ScoreConfirmedAt { get; set; }

    /// <summary>
    /// If score was disputed
    /// </summary>
    public DateTime? ScoreDisputedAt { get; set; }

    [MaxLength(500)]
    public string? ScoreDisputeReason { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    /// <summary>
    /// Team 1 has confirmed the score
    /// </summary>
    public bool Team1ScoreConfirmed { get; set; } = false;

    /// <summary>
    /// Team 2 has confirmed the score
    /// </summary>
    public bool Team2ScoreConfirmed { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("EncounterMatchId")]
    public EncounterMatch? EncounterMatch { get; set; }

    [ForeignKey("ScoreFormatId")]
    public ScoreFormat? ScoreFormat { get; set; }

    [ForeignKey("WinnerUnitId")]
    public EventUnit? Winner { get; set; }

    [ForeignKey("TournamentCourtId")]
    public TournamentCourt? TournamentCourt { get; set; }

    [ForeignKey("ScoreSubmittedByUnitId")]
    public EventUnit? ScoreSubmittedBy { get; set; }

    [ForeignKey("ScoreConfirmedByUnitId")]
    public EventUnit? ScoreConfirmedBy { get; set; }

    public ICollection<EventGamePlayer> Players { get; set; } = new List<EventGamePlayer>();
}

/// <summary>
/// A player participating in a game
/// </summary>
public class EventGamePlayer
{
    public int Id { get; set; }

    public int GameId { get; set; }
    public int UserId { get; set; }
    public int UnitId { get; set; }

    /// <summary>
    /// Position in team for this game (1 or 2 for doubles)
    /// </summary>
    public int? Position { get; set; }

    /// <summary>
    /// Optional: points scored by this player
    /// </summary>
    public int? PointsScored { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("GameId")]
    public EventGame? Game { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }

    [ForeignKey("UnitId")]
    public EventUnit? Unit { get; set; }
}
