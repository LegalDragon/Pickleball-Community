using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

[Table("VenueGeoCodes")]
public class VenueGeoCode
{
    [Key]
    [Column("GEO_ID")]
    public int GeoId { get; set; }

    [Column("VenueId")]
    public int? VenueId { get; set; }

    [Column("GEOCodeType_ID")]
    public int? GeoCodeTypeId { get; set; }

    [Column("SName")]
    [MaxLength(100)]
    public string? ShortName { get; set; }

    [Column("LName")]
    [MaxLength(200)]
    public string? LongName { get; set; }

    [Column("DT_Code")]
    public DateTime? DateCoded { get; set; }

    [ForeignKey("VenueId")]
    public Venue? Venue { get; set; }

    [ForeignKey("GeoCodeTypeId")]
    public GeoCodeType? GeoCodeType { get; set; }
}
