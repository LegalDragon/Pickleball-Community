using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

[Table("GEOCodeTypes")]
public class GeoCodeType
{
    [Key]
    [Column("GEOCodeType_ID")]
    public int GeoCodeTypeId { get; set; }

    [MaxLength(50)]
    public string? TypeName { get; set; }
}
