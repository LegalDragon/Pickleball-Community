using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

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

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;

    // Navigation properties
    [ForeignKey("UserId")]
    public User? User { get; set; }

    public League? League { get; set; }

    [ForeignKey("CreatedByUserId")]
    public User? CreatedBy { get; set; }
}
