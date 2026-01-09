using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class BlogComment
{
    public int Id { get; set; }

    public int PostId { get; set; }

    public int UserId { get; set; }

    [Required]
    [MaxLength(2000)]
    public string Content { get; set; } = string.Empty;

    // For nested/threaded comments
    public int? ParentId { get; set; }

    public bool IsApproved { get; set; } = true;

    public bool IsDeleted { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.Now;

    public DateTime? UpdatedAt { get; set; }

    // Navigation
    [ForeignKey("PostId")]
    public virtual BlogPost? Post { get; set; }

    [ForeignKey("UserId")]
    public virtual User? User { get; set; }

    [ForeignKey("ParentId")]
    public virtual BlogComment? Parent { get; set; }

    public virtual ICollection<BlogComment> Replies { get; set; } = new List<BlogComment>();
}
