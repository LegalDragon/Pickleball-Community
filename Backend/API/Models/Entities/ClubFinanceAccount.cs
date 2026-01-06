using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class ClubFinanceAccount
{
    public int Id { get; set; }

    [Required]
    public int ClubId { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal CurrentBalance { get; set; } = 0;

    [Column(TypeName = "decimal(18,2)")]
    public decimal TotalIncome { get; set; } = 0;

    [Column(TypeName = "decimal(18,2)")]
    public decimal TotalExpenses { get; set; } = 0;

    public string? Notes { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Club? Club { get; set; }
    public ICollection<ClubFinanceTransaction> Transactions { get; set; } = new List<ClubFinanceTransaction>();
}
