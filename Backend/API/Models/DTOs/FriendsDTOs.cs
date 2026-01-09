namespace Pickleball.Community.Models.DTOs;

public class FriendDto
{
    public int Id { get; set; }
    public int FriendUserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public string? ExperienceLevel { get; set; }
    public string? PlayingStyle { get; set; }
    public string? Location { get; set; }
    public string? PaddleBrand { get; set; }
    public double? SkillLevel { get; set; }
    public DateTime FriendsSince { get; set; }
}

public class FriendRequestDto
{
    public int Id { get; set; }
    public string Status { get; set; } = "Pending";
    public string? Message { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? RespondedAt { get; set; }
    public UserSummaryDto Sender { get; set; } = new();
    public UserSummaryDto Recipient { get; set; } = new();
}

public class UserSummaryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public string? ExperienceLevel { get; set; }
    public string? PlayingStyle { get; set; }
    public string? Location { get; set; }
    public double? SkillLevel { get; set; }
}

public class PlayerSearchResultDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public string? ExperienceLevel { get; set; }
    public string? Location { get; set; }
    public double? SkillLevel { get; set; }
    public bool IsFriend { get; set; }
    public bool HasPendingRequest { get; set; }
}

public class SendFriendRequestDto
{
    public int RecipientId { get; set; }
    public string? Message { get; set; }
}
