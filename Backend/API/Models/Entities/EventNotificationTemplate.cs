namespace Pickleball.Community.Models.Entities;

public class EventNotificationTemplate
{
    public int Id { get; set; }
    public int? EventId { get; set; } // NULL = default template, otherwise event-specific

    // Template type
    public string NotificationType { get; set; } = string.Empty;
    // Types: 'MatchScheduled', 'MatchStarting', 'MatchComplete', 'ScoreUpdated', 'CheckInReminder', 'BracketAdvance'

    // Template content
    public string Subject { get; set; } = string.Empty;
    public string MessageTemplate { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    // Navigation properties
    public Event? Event { get; set; }
    public User? CreatedBy { get; set; }
    public User? UpdatedBy { get; set; }
}

// Static class for notification type constants
public static class NotificationTypes
{
    public const string MatchScheduled = "MatchScheduled";
    public const string MatchStarting = "MatchStarting";
    public const string MatchComplete = "MatchComplete";
    public const string ScoreUpdated = "ScoreUpdated";
    public const string CheckInReminder = "CheckInReminder";
    public const string BracketAdvance = "BracketAdvance";

    public static readonly string[] All = new[]
    {
        MatchScheduled,
        MatchStarting,
        MatchComplete,
        ScoreUpdated,
        CheckInReminder,
        BracketAdvance
    };

    public static string GetDescription(string type) => type switch
    {
        MatchScheduled => "Sent when a match is assigned to a court",
        MatchStarting => "Sent when a match is about to start",
        MatchComplete => "Sent when a match has finished",
        ScoreUpdated => "Sent when the score is updated during a match",
        CheckInReminder => "Sent to remind players to check in",
        BracketAdvance => "Sent when a player advances in the bracket",
        _ => "Unknown notification type"
    };
}
