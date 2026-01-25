namespace Pickleball.Community.Models.Entities;

public class City
{
    public int Id { get; set; }
    public int ProvinceStateId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedByUserId { get; set; }

    // Navigation properties
    public ProvinceState? ProvinceState { get; set; }
    public User? CreatedByUser { get; set; }
}
