namespace Pickleball.Community.Models.Entities;

public class ProvinceState
{
    public int Id { get; set; }
    public int CountryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;  // State/province abbreviation
    public string? Type { get; set; }                  // State, Province, Territory, Region, etc.
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation properties
    public Country? Country { get; set; }
    public ICollection<City> Cities { get; set; } = new List<City>();
}
