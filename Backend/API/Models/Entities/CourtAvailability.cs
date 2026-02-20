using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Defines availability windows for courts during an event.
/// Can be event-level defaults (TournamentCourtId = null) or court-specific overrides.
/// </summary>
public class CourtAvailability
{
    public int Id { get; set; }

    /// <summary>
    /// The event this availability belongs to
    /// </summary>
    public int EventId { get; set; }

    /// <summary>
    /// Specific court this applies to. 
    /// NULL = event default for all courts without specific overrides.
    /// </summary>
    public int? TournamentCourtId { get; set; }

    /// <summary>
    /// Day number within the event (1, 2, 3... for multi-day events).
    /// Day 1 = event start date.
    /// </summary>
    public int DayNumber { get; set; } = 1;

    /// <summary>
    /// Time of day when court becomes available (e.g., 08:00:00 for 8 AM)
    /// </summary>
    public TimeSpan AvailableFrom { get; set; } = new TimeSpan(8, 0, 0);

    /// <summary>
    /// Time of day when court closes (e.g., 18:00:00 for 6 PM)
    /// </summary>
    public TimeSpan AvailableTo { get; set; } = new TimeSpan(18, 0, 0);

    /// <summary>
    /// Optional notes (e.g., "Closes early for awards ceremony")
    /// </summary>
    [MaxLength(500)]
    public string? Notes { get; set; }

    /// <summary>
    /// Whether this availability is active
    /// </summary>
    public bool IsActive { get; set; } = true;

    // Audit fields
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation properties
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("TournamentCourtId")]
    public TournamentCourt? TournamentCourt { get; set; }

    [ForeignKey("CreatedByUserId")]
    public User? CreatedBy { get; set; }

    [ForeignKey("UpdatedByUserId")]
    public User? UpdatedBy { get; set; }

    // ============================================
    // Helper Methods
    // ============================================

    /// <summary>
    /// Checks if a given time falls within this availability window
    /// </summary>
    public bool IsTimeAvailable(TimeSpan time)
    {
        return time >= AvailableFrom && time < AvailableTo;
    }

    /// <summary>
    /// Checks if a given DateTime falls within this availability window
    /// (checks both day number and time of day)
    /// </summary>
    public bool IsDateTimeAvailable(DateTime dateTime, DateTime eventStartDate)
    {
        var dayNum = (dateTime.Date - eventStartDate.Date).Days + 1;
        if (dayNum != DayNumber) return false;
        return IsTimeAvailable(dateTime.TimeOfDay);
    }

    /// <summary>
    /// Gets the absolute DateTime for when availability starts on the event day
    /// </summary>
    public DateTime GetAbsoluteStartTime(DateTime eventStartDate)
    {
        return eventStartDate.Date.AddDays(DayNumber - 1).Add(AvailableFrom);
    }

    /// <summary>
    /// Gets the absolute DateTime for when availability ends on the event day
    /// </summary>
    public DateTime GetAbsoluteEndTime(DateTime eventStartDate)
    {
        return eventStartDate.Date.AddDays(DayNumber - 1).Add(AvailableTo);
    }
}
