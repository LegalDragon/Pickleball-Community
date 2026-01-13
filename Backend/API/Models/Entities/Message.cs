using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

public class Message
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ConversationId { get; set; }

    [Required]
    public int SenderId { get; set; }

    [Required]
    [MaxLength(4000)]
    public string Content { get; set; } = string.Empty;

    [MaxLength(20)]
    public string MessageType { get; set; } = "Text"; // Text, Image, System

    public int? ReplyToMessageId { get; set; }

    public DateTime SentAt { get; set; } = DateTime.Now;
    public DateTime? EditedAt { get; set; }

    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }

    // Navigation properties
    [ForeignKey("ConversationId")]
    public Conversation? Conversation { get; set; }

    [ForeignKey("SenderId")]
    public User? Sender { get; set; }

    [ForeignKey("ReplyToMessageId")]
    public Message? ReplyToMessage { get; set; }

    public ICollection<MessageReadReceipt> ReadReceipts { get; set; } = new List<MessageReadReceipt>();
}

public static class MessageTypes
{
    public const string Text = "Text";
    public const string Image = "Image";
    public const string System = "System";
}
