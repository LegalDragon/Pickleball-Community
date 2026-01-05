using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.Entities;

public class GrantManager
{
    public int Id { get; set; }

    [Required]
    public int UserId { get; set; }

    public int? LeagueId { get; set; } // NULL means site-wide access

    [Required]
    [MaxLength(50)]
    public string Role { get; set; } = "Manager"; // Admin, Manager, Viewer

    public bool CanRecordDonations { get; set; } = true;
    public bool CanIssueFees { get; set; } = false;
    public bool CanIssueGrants { get; set; } = false;
    public bool CanVoidTransactions { get; set; } = false;
    public bool CanManageManagers { get; set; } = false;

    public bool IsActive { get; set; } = true;

    [Required]
    public int CreatedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User? User { get; set; }
    public League? League { get; set; }
    public User? CreatedBy { get; set; }
}
