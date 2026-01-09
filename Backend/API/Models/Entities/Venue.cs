using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

[Table("Venues")]
public class Venue
{
    [Key]
    [Column("Id")]
    public int VenueId { get; set; }

    [MaxLength(50)]
    public string? Name { get; set; }

    [MaxLength(50)]
    public string? Addr1 { get; set; }

    [MaxLength(50)]
    public string? Addr2 { get; set; }

    [MaxLength(50)]
    public string? City { get; set; }

    [MaxLength(50)]
    public string? County { get; set; }

    [MaxLength(50)]
    public string? State { get; set; }

    [Column("ZIP")]
    [MaxLength(15)]
    public string? Zip { get; set; }

    [Column("ZIP4")]
    [MaxLength(5)]
    public string? Zip4 { get; set; }

    [MaxLength(20)]
    public string? Country { get; set; }

    [Column("Admin_UID")]
    public int? AdminUid { get; set; }

    [MaxLength(12)]
    public string? Phone { get; set; }

    [Column("WWW")]
    [MaxLength(50)]
    public string? Website { get; set; }

    [Column("EMail")]
    [MaxLength(50)]
    public string? Email { get; set; }

    [Column("Indoor_Num")]
    public int? IndoorNum { get; set; }

    [Column("Outdoor_Num")]
    public int? OutdoorNum { get; set; }

    [Column("Covered_Num")]
    public int? CoveredNum { get; set; }

    [MaxLength(1)]
    public string? Lights { get; set; }

    [Column("GPSLat")]
    [MaxLength(50)]
    public string? GpsLat { get; set; }

    [Column("GPSLng")]
    [MaxLength(50)]
    public string? GpsLng { get; set; }

    [Column("GPSLat2")]
    [MaxLength(50)]
    public string? GpsLat2 { get; set; }

    [Column("GPSLng2")]
    [MaxLength(50)]
    public string? GpsLng2 { get; set; }

    [Column("VenueTypeId")]
    public int? VenueTypeId { get; set; }

    // Navigation properties
    public VenueType? VenueType { get; set; }
    public ICollection<VenueGeoCode>? GeoCodes { get; set; }
    public ICollection<VenueConfirmation>? Confirmations { get; set; }
}
