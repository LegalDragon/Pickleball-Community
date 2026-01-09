using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Tracks player rating changes over time from peer reviews and system calculations
/// </summary>
public class PlayerRatingHistory
{
    public int Id { get; set; }

    public int UserId { get; set; }

    /// <summary>
    /// Rating value (e.g., 3.5, 4.0)
    /// </summary>
    [Column(TypeName = "decimal(4,2)")]
    public decimal Rating { get; set; }

    /// <summary>
    /// Previous rating for tracking change
    /// </summary>
    [Column(TypeName = "decimal(4,2)")]
    public decimal? PreviousRating { get; set; }

    /// <summary>
    /// Rating change (+/- amount)
    /// </summary>
    [Column(TypeName = "decimal(4,2)")]
    public decimal? RatingChange { get; set; }

    /// <summary>
    /// Type: PeerReview, SystemCalculated, Official, SelfRated, Imported
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string RatingType { get; set; } = string.Empty;

    /// <summary>
    /// Source description (e.g., "Based on 5 games", "Peer review by 3 players")
    /// </summary>
    [MaxLength(200)]
    public string? Source { get; set; }

    /// <summary>
    /// Confidence/weight (0-100, higher = more reliable)
    /// </summary>
    public int? Confidence { get; set; }

    // Context references
    public int? EventId { get; set; }
    public int? GameId { get; set; }
    public int? PeerReviewId { get; set; }

    public bool CalculatedBySystem { get; set; } = true;
    public int? UpdatedByUserId { get; set; }

    public DateTime EffectiveDate { get; set; } = DateTime.Now;

    [MaxLength(500)]
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("UserId")]
    public User? User { get; set; }

    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("GameId")]
    public EventGame? Game { get; set; }

    [ForeignKey("UpdatedByUserId")]
    public User? UpdatedBy { get; set; }
}
