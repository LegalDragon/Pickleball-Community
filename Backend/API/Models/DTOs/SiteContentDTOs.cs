namespace Pickleball.Community.Models.DTOs;

public class SiteContentDto
{
    public int Id { get; set; }
    public string ContentKey { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? LastUpdatedByUserName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class UpdateSiteContentRequest
{
    public string? Title { get; set; }
    public string? Content { get; set; }
}
