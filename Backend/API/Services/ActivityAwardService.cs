using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Services;

public interface IActivityAwardService
{
    Task GrantAddedFriendAwardAsync(int userId1, int userId2);
    Task CheckFriendMilestonesAsync(int userId);
    Task GrantJoinedClubAwardAsync(int userId, int clubId, string clubName);
    Task GrantCreatedClubAwardAsync(int userId, int clubId, string clubName);
    Task GrantJoinedEventAwardAsync(int userId, int eventId, string eventName);
    Task GrantCreatedEventAwardAsync(int userId, int eventId, string eventName);
}

public class ActivityAwardService : IActivityAwardService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ActivityAwardService> _logger;

    // Award type constants
    private const string AwardTypeAchievement = "Achievement";
    private const string AwardTypeMilestone = "Milestone";

    // Award title constants
    private const string TitleFirstFriend = "First Friend";
    private const string TitleFiveFriends = "Social Butterfly";
    private const string TitleTenFriends = "Life of the Party";
    private const string TitleTwentyFiveFriends = "Community Connector";
    private const string TitleFiftyFriends = "Networking Pro";
    private const string TitleFirstClub = "First Club";
    private const string TitleJoinedClub = "Club Member";
    private const string TitleCreatedClub = "Club Founder";
    private const string TitleFirstEvent = "First Event";
    private const string TitleJoinedEvent = "Event Participant";
    private const string TitleCreatedEvent = "Event Organizer";

    public ActivityAwardService(ApplicationDbContext context, ILogger<ActivityAwardService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Grant "First Friend" award to both users when they become friends
    /// </summary>
    public async Task GrantAddedFriendAwardAsync(int userId1, int userId2)
    {
        try
        {
            // Check and grant for user1
            await GrantFirstFriendIfNotExistsAsync(userId1);

            // Check and grant for user2
            await GrantFirstFriendIfNotExistsAsync(userId2);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error granting friend awards for users {User1} and {User2}", userId1, userId2);
        }
    }

    private async Task GrantFirstFriendIfNotExistsAsync(int userId)
    {
        // Check if user already has the "First Friend" award
        var hasAward = await _context.PlayerAwards
            .AnyAsync(a => a.UserId == userId && a.Title == TitleFirstFriend);

        if (hasAward) return;

        var award = new PlayerAward
        {
            UserId = userId,
            AwardType = AwardTypeAchievement,
            Title = TitleFirstFriend,
            Description = "Made your first friend in the community!",
            IconUrl = "/images/awards/first-friend.png",
            BadgeColor = "green",
            AwardedBySystem = true,
            IsActive = true
        };

        _context.PlayerAwards.Add(award);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Granted '{Award}' award to user {UserId}", TitleFirstFriend, userId);
    }

    /// <summary>
    /// Check and grant friend milestone awards (5, 10, 25, 50 friends)
    /// </summary>
    public async Task CheckFriendMilestonesAsync(int userId)
    {
        try
        {
            // Count user's friends
            var friendCount = await _context.Friendships
                .CountAsync(f => f.UserId1 == userId || f.UserId2 == userId);

            // Check each milestone
            if (friendCount >= 5)
                await GrantMilestoneIfNotExistsAsync(userId, TitleFiveFriends, "Connected with 5 friends!", "blue", 5);

            if (friendCount >= 10)
                await GrantMilestoneIfNotExistsAsync(userId, TitleTenFriends, "Connected with 10 friends!", "purple", 10);

            if (friendCount >= 25)
                await GrantMilestoneIfNotExistsAsync(userId, TitleTwentyFiveFriends, "Connected with 25 friends!", "gold", 25);

            if (friendCount >= 50)
                await GrantMilestoneIfNotExistsAsync(userId, TitleFiftyFriends, "Connected with 50 friends!", "platinum", 50);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking friend milestones for user {UserId}", userId);
        }
    }

    private async Task GrantMilestoneIfNotExistsAsync(int userId, string title, string description, string badgeColor, int pointsValue)
    {
        var hasAward = await _context.PlayerAwards
            .AnyAsync(a => a.UserId == userId && a.Title == title);

        if (hasAward) return;

        var award = new PlayerAward
        {
            UserId = userId,
            AwardType = AwardTypeMilestone,
            Title = title,
            Description = description,
            IconUrl = $"/images/awards/{title.ToLower().Replace(" ", "-")}.png",
            BadgeColor = badgeColor,
            PointsValue = pointsValue,
            AwardedBySystem = true,
            IsActive = true
        };

        _context.PlayerAwards.Add(award);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Granted milestone '{Award}' to user {UserId}", title, userId);
    }

    /// <summary>
    /// Grant award when user joins a club
    /// </summary>
    public async Task GrantJoinedClubAwardAsync(int userId, int clubId, string clubName)
    {
        try
        {
            // First, check and grant "First Club" achievement if this is user's first club
            await GrantFirstClubIfNotExistsAsync(userId, clubName);

            // Check if user already has an award for joining this specific club
            var hasAward = await _context.PlayerAwards
                .AnyAsync(a => a.UserId == userId && a.Title == TitleJoinedClub && a.ClubId == clubId);

            if (hasAward) return;

            var award = new PlayerAward
            {
                UserId = userId,
                AwardType = AwardTypeAchievement,
                Title = TitleJoinedClub,
                Description = $"Joined {clubName}",
                IconUrl = "/images/awards/club-member.png",
                BadgeColor = "blue",
                ClubId = clubId,
                AwardedBySystem = true,
                IsActive = true
            };

            _context.PlayerAwards.Add(award);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Granted '{Award}' to user {UserId} for club {ClubId}", TitleJoinedClub, userId, clubId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error granting joined club award to user {UserId} for club {ClubId}", userId, clubId);
        }
    }

    private async Task GrantFirstClubIfNotExistsAsync(int userId, string clubName)
    {
        // Check if user already has the "First Club" award
        var hasAward = await _context.PlayerAwards
            .AnyAsync(a => a.UserId == userId && a.Title == TitleFirstClub);

        if (hasAward) return;

        var award = new PlayerAward
        {
            UserId = userId,
            AwardType = AwardTypeAchievement,
            Title = TitleFirstClub,
            Description = $"Joined your first club: {clubName}",
            IconUrl = "/images/awards/first-club.png",
            BadgeColor = "green",
            AwardedBySystem = true,
            IsActive = true
        };

        _context.PlayerAwards.Add(award);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Granted '{Award}' award to user {UserId}", TitleFirstClub, userId);
    }

    /// <summary>
    /// Grant award when user creates a club
    /// </summary>
    public async Task GrantCreatedClubAwardAsync(int userId, int clubId, string clubName)
    {
        try
        {
            // First, check and grant "First Club" achievement (creator is also a member)
            await GrantFirstClubIfNotExistsAsync(userId, clubName);

            // Check if user already has an award for creating this specific club
            var hasAward = await _context.PlayerAwards
                .AnyAsync(a => a.UserId == userId && a.Title == TitleCreatedClub && a.ClubId == clubId);

            if (hasAward) return;

            var award = new PlayerAward
            {
                UserId = userId,
                AwardType = AwardTypeAchievement,
                Title = TitleCreatedClub,
                Description = $"Founded {clubName}",
                IconUrl = "/images/awards/club-founder.png",
                BadgeColor = "gold",
                ClubId = clubId,
                PointsValue = 10,
                AwardedBySystem = true,
                IsActive = true
            };

            _context.PlayerAwards.Add(award);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Granted '{Award}' to user {UserId} for creating club {ClubId}", TitleCreatedClub, userId, clubId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error granting created club award to user {UserId} for club {ClubId}", userId, clubId);
        }
    }

    /// <summary>
    /// Grant award when user joins/registers for an event
    /// </summary>
    public async Task GrantJoinedEventAwardAsync(int userId, int eventId, string eventName)
    {
        try
        {
            // First, check and grant "First Event" achievement if this is user's first event
            await GrantFirstEventIfNotExistsAsync(userId, eventName);

            // Check if user already has an award for joining this specific event
            var hasAward = await _context.PlayerAwards
                .AnyAsync(a => a.UserId == userId && a.Title == TitleJoinedEvent && a.EventId == eventId);

            if (hasAward) return;

            var award = new PlayerAward
            {
                UserId = userId,
                AwardType = AwardTypeAchievement,
                Title = TitleJoinedEvent,
                Description = $"Registered for {eventName}",
                IconUrl = "/images/awards/event-participant.png",
                BadgeColor = "green",
                EventId = eventId,
                AwardedBySystem = true,
                IsActive = true
            };

            _context.PlayerAwards.Add(award);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Granted '{Award}' to user {UserId} for event {EventId}", TitleJoinedEvent, userId, eventId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error granting joined event award to user {UserId} for event {EventId}", userId, eventId);
        }
    }

    private async Task GrantFirstEventIfNotExistsAsync(int userId, string eventName)
    {
        // Check if user already has the "First Event" award
        var hasAward = await _context.PlayerAwards
            .AnyAsync(a => a.UserId == userId && a.Title == TitleFirstEvent);

        if (hasAward) return;

        var award = new PlayerAward
        {
            UserId = userId,
            AwardType = AwardTypeAchievement,
            Title = TitleFirstEvent,
            Description = $"Joined your first event: {eventName}",
            IconUrl = "/images/awards/first-event.png",
            BadgeColor = "green",
            AwardedBySystem = true,
            IsActive = true
        };

        _context.PlayerAwards.Add(award);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Granted '{Award}' award to user {UserId}", TitleFirstEvent, userId);
    }

    /// <summary>
    /// Grant award when user creates an event
    /// </summary>
    public async Task GrantCreatedEventAwardAsync(int userId, int eventId, string eventName)
    {
        try
        {
            // First, check and grant "First Event" achievement (organizer participates too)
            await GrantFirstEventIfNotExistsAsync(userId, eventName);

            // Check if user already has an award for creating this specific event
            var hasAward = await _context.PlayerAwards
                .AnyAsync(a => a.UserId == userId && a.Title == TitleCreatedEvent && a.EventId == eventId);

            if (hasAward) return;

            var award = new PlayerAward
            {
                UserId = userId,
                AwardType = AwardTypeAchievement,
                Title = TitleCreatedEvent,
                Description = $"Organized {eventName}",
                IconUrl = "/images/awards/event-organizer.png",
                BadgeColor = "purple",
                EventId = eventId,
                PointsValue = 10,
                AwardedBySystem = true,
                IsActive = true
            };

            _context.PlayerAwards.Add(award);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Granted '{Award}' to user {UserId} for creating event {EventId}", TitleCreatedEvent, userId, eventId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error granting created event award to user {UserId} for event {EventId}", userId, eventId);
        }
    }
}
