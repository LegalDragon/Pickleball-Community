namespace Pickleball.Community.Models.Entities;

public class Country
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code2 { get; set; } = string.Empty;  // ISO 3166-1 alpha-2
    public string Code3 { get; set; } = string.Empty;  // ISO 3166-1 alpha-3
    public string? NumericCode { get; set; }           // ISO 3166-1 numeric
    public string? PhoneCode { get; set; }             // International dialing code
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation property
    public ICollection<ProvinceState> ProvinceStates { get; set; } = new List<ProvinceState>();
}
