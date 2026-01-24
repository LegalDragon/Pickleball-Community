namespace Pickleball.Community.Models.DTOs;

public class CountryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code2 { get; set; } = string.Empty;
    public string Code3 { get; set; } = string.Empty;
    public string? PhoneCode { get; set; }
}

public class ProvinceStateDto
{
    public int Id { get; set; }
    public int CountryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Type { get; set; }
}

public class CountryWithStatesDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code2 { get; set; } = string.Empty;
    public string Code3 { get; set; } = string.Empty;
    public string? PhoneCode { get; set; }
    public List<ProvinceStateDto> States { get; set; } = new();
}

public class CityDto
{
    public int Id { get; set; }
    public int ProvinceStateId { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class CreateCityDto
{
    public string Name { get; set; } = string.Empty;
}
