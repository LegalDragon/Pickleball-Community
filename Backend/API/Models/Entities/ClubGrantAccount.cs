using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class ClubGrantAccount
{
    public int Id { get; set; }

    [Required]
    public int ClubId { get; set; }

    [Required]
    public int LeagueId { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal CurrentBalance { get; set; } = 0;

    [Column(TypeName = "decimal(18,2)")]
    public decimal TotalCredits { get; set; } = 0;

    [Column(TypeName = "decimal(18,2)")]
    public decimal TotalDebits { get; set; } = 0;

    public string? Notes { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Club? Club { get; set; }
    public League? League { get; set; }
    public ICollection<ClubGrantTransaction> Transactions { get; set; } = new List<ClubGrantTransaction>();
}
