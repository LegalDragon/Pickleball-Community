namespace Pickleball.Community.Models.DTOs;

// Response DTO for release notes
public class ReleaseNoteDto
{
    public int Id { get; set; }
    public string Version { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime ReleaseDate { get; set; }
    public bool IsActive { get; set; }
    public bool IsMajor { get; set; }
    public bool IsTest { get; set; } // Test mode - only visible to admins
    public DateTime CreatedAt { get; set; }
    public string? CreatedByName { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedByName { get; set; }
}

// DTO for creating a new release note
public class CreateReleaseNoteDto
{
    public string Version { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime? ReleaseDate { get; set; }
    public bool IsMajor { get; set; } = false;
    public bool IsTest { get; set; } = false; // Create in test mode
}

// DTO for updating a release note
public class UpdateReleaseNoteDto
{
    public string? Version { get; set; }
    public string? Title { get; set; }
    public string? Content { get; set; }
    public DateTime? ReleaseDate { get; set; }
    public bool? IsActive { get; set; }
    public bool? IsMajor { get; set; }
    public bool? IsTest { get; set; } // Toggle test mode
}

// DTO for user-facing release notes (includes dismiss status)
public class UserReleaseNoteDto
{
    public int Id { get; set; }
    public string Version { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime ReleaseDate { get; set; }
    public bool IsMajor { get; set; }
    public bool IsTest { get; set; } // Indicates test mode (only shown to admins)
    public bool IsDismissed { get; set; }
}
