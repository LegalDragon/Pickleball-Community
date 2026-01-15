using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Event document (waiver, map, rules, contacts)
/// </summary>
public class EventWaiver
{
    public int Id { get; set; }

    public int EventId { get; set; }

    /// <summary>
    /// Document type: waiver, map, rules, contacts
    /// </summary>
    [MaxLength(50)]
    public string DocumentType { get; set; } = "waiver";

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Version number for tracking waiver updates
    /// </summary>
    public int Version { get; set; } = 1;

    /// <summary>
    /// Whether signing this waiver is required to participate
    /// </summary>
    public bool IsRequired { get; set; } = true;

    /// <summary>
    /// Whether this waiver requires parent/guardian signature for minors
    /// </summary>
    public bool RequiresMinorWaiver { get; set; } = false;

    /// <summary>
    /// Age threshold below which parent/guardian signature is needed
    /// </summary>
    public int MinorAgeThreshold { get; set; } = 18;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
    public int? CreatedByUserId { get; set; }

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("CreatedByUserId")]
    public User? CreatedBy { get; set; }
}
