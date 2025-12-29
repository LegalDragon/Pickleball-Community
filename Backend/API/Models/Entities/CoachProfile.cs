namespace Pickleball.College.Models.Entities;

public class CoachProfile
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public decimal? HourlyRate { get; set; }
    public string? CertificationLevel { get; set; }
    public int? YearsExperience { get; set; }
    public bool IsVerified { get; set; }
    public string? StripeAccountId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public User User { get; set; } = null!;
}
