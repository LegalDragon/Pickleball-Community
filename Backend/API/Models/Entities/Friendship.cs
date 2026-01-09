using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class Friendship
{
    public int Id { get; set; }

    [Required]
    public int UserId1 { get; set; } // Always the smaller UserId

    [Required]
    public int UserId2 { get; set; } // Always the larger UserId

    public DateTime FriendsSince { get; set; } = DateTime.Now;

    public int? OriginatingRequestId { get; set; }

    [ForeignKey("UserId1")]
    public User? User1 { get; set; }

    [ForeignKey("UserId2")]
    public User? User2 { get; set; }

    [ForeignKey("OriginatingRequestId")]
    public FriendRequest? OriginatingRequest { get; set; }
}
