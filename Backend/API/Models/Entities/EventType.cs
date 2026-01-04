using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Event types that can be selected when creating events
/// </summary>
public class EventType
{
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Description { get; set; }

    [MaxLength(50)]
    public string? Icon { get; set; } // Icon name for frontend display

    [MaxLength(20)]
    public string? Color { get; set; } // Color code for UI

    /// <summary>
    /// Whether this event type allows multiple divisions.
    /// For some event types (like casual play), only one division is allowed.
    /// </summary>
    public bool AllowMultipleDivisions { get; set; } = true;

    public int SortOrder { get; set; } = 0;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
