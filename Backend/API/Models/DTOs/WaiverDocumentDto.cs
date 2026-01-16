namespace Pickleball.Community.Models.DTOs;

/// <summary>
/// DTO for waiver document data needed for PDF generation
/// </summary>
public class WaiverDocumentDto
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Player's full name for PDF header
    /// </summary>
    public string PlayerName { get; set; } = string.Empty;

    /// <summary>
    /// Reference ID in format E{eventId}-W{waiverId}-M{memberId} for tracking
    /// </summary>
    public string ReferenceId { get; set; } = string.Empty;
}
