using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Database;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<UserSocialLink> UserSocialLinks { get; set; }

    // Theme and Asset Management
    public DbSet<ThemeSettings> ThemeSettings { get; set; }
    public DbSet<ThemePreset> ThemePresets { get; set; }
    public DbSet<HeroVideo> HeroVideos { get; set; }
    public DbSet<ActivityLog> ActivityLogs { get; set; }
    public DbSet<Asset> Assets { get; set; }

    // Generalized Object Assets
    public DbSet<ObjectType> ObjectTypes { get; set; }
    public DbSet<ObjectAssetType> ObjectAssetTypes { get; set; }
    public DbSet<ObjectAsset> ObjectAssets { get; set; }

    // Content Types
    public DbSet<ContentType> ContentTypes { get; set; }

    // Ratings
    public DbSet<Rating> Ratings { get; set; }

    // Tags
    public DbSet<TagDefinition> TagDefinitions { get; set; }
    public DbSet<ObjectTag> ObjectTags { get; set; }

    // Player Certification
    public DbSet<KnowledgeLevel> KnowledgeLevels { get; set; }
    public DbSet<SkillGroup> SkillGroups { get; set; }
    public DbSet<SkillArea> SkillAreas { get; set; }
    public DbSet<PlayerCertificationRequest> PlayerCertificationRequests { get; set; }
    public DbSet<PlayerCertificationReview> PlayerCertificationReviews { get; set; }
    public DbSet<PlayerCertificationScore> PlayerCertificationScores { get; set; }
    public DbSet<PlayerCertificationInvitation> PlayerCertificationInvitations { get; set; }

    // Notification Templates
    public DbSet<NotificationTemplate> NotificationTemplates { get; set; }

    // Friends
    public DbSet<FriendRequest> FriendRequests { get; set; }
    public DbSet<Friendship> Friendships { get; set; }

    // Venues (places with pickleball courts)
    public DbSet<Venue> Venues { get; set; }
    public DbSet<VenueType> VenueTypes { get; set; }
    public DbSet<VenueGeoCode> VenueGeoCodes { get; set; }
    public DbSet<GeoCodeType> GeoCodeTypes { get; set; }
    public DbSet<VenueConfirmation> VenueConfirmations { get; set; }
    public DbSet<VenueAsset> VenueAssets { get; set; }
    public DbSet<VenueAssetLike> VenueAssetLikes { get; set; }

    // Events
    public DbSet<EventType> EventTypes { get; set; }
    public DbSet<Event> Events { get; set; }
    public DbSet<EventDivision> EventDivisions { get; set; }
    public DbSet<EventRegistration> EventRegistrations { get; set; }
    public DbSet<EventPartnerRequest> EventPartnerRequests { get; set; }
    public DbSet<TeamUnit> TeamUnits { get; set; }
    public DbSet<AgeGroup> AgeGroups { get; set; }
    public DbSet<SkillLevel> SkillLevels { get; set; }
    public DbSet<DivisionReward> DivisionRewards { get; set; }

    // Tournament Management
    public DbSet<ScoreMethod> ScoreMethods { get; set; }
    public DbSet<ScoreFormat> ScoreFormats { get; set; }
    public DbSet<EventUnit> EventUnits { get; set; }
    public DbSet<EventUnitMember> EventUnitMembers { get; set; }
    public DbSet<EventUnitJoinRequest> EventUnitJoinRequests { get; set; }
    public DbSet<EventMatch> EventMatches { get; set; }
    public DbSet<EventGame> EventGames { get; set; }
    public DbSet<EventGamePlayer> EventGamePlayers { get; set; }
    public DbSet<EventGameScoreHistory> EventGameScoreHistories { get; set; }
    public DbSet<TournamentCourt> TournamentCourts { get; set; }
    public DbSet<EventDocument> EventDocuments { get; set; }

    // Clubs
    public DbSet<Club> Clubs { get; set; }
    public DbSet<ClubMember> ClubMembers { get; set; }
    public DbSet<ClubJoinRequest> ClubJoinRequests { get; set; }
    public DbSet<ClubNotification> ClubNotifications { get; set; }
    public DbSet<ClubMemberRole> ClubMemberRoles { get; set; }
    public DbSet<ClubDocument> ClubDocuments { get; set; }

    // Blog
    public DbSet<BlogCategory> BlogCategories { get; set; }
    public DbSet<BlogPost> BlogPosts { get; set; }
    public DbSet<BlogComment> BlogComments { get; set; }

    // Messaging
    public DbSet<Conversation> Conversations { get; set; }
    public DbSet<ConversationParticipant> ConversationParticipants { get; set; }
    public DbSet<Message> Messages { get; set; }
    public DbSet<MessageReadReceipt> MessageReadReceipts { get; set; }

    // FAQ
    public DbSet<FaqCategory> FaqCategories { get; set; }
    public DbSet<FaqEntry> FaqEntries { get; set; }

    // Site Content
    public DbSet<SiteContent> SiteContents { get; set; }

    // Help Topics
    public DbSet<HelpTopic> HelpTopics { get; set; }

    // Feedback
    public DbSet<FeedbackCategory> FeedbackCategories { get; set; }
    public DbSet<FeedbackEntry> FeedbackEntries { get; set; }

    // User Notifications
    public DbSet<Notification> Notifications { get; set; }

    // Leagues
    public DbSet<League> Leagues { get; set; }
    public DbSet<LeagueManager> LeagueManagers { get; set; }
    public DbSet<LeagueClub> LeagueClubs { get; set; }
    public DbSet<LeagueClubRequest> LeagueClubRequests { get; set; }
    public DbSet<LeagueDocument> LeagueDocuments { get; set; }
    public DbSet<LeagueRole> LeagueRoles { get; set; }

    // Grant Management
    public DbSet<ClubGrantAccount> ClubGrantAccounts { get; set; }
    public DbSet<ClubGrantTransaction> ClubGrantTransactions { get; set; }
    public DbSet<GrantManager> GrantManagers { get; set; }
    public DbSet<GrantTransactionAttachment> GrantTransactionAttachments { get; set; }

    // Club Finance (internal club accounting)
    public DbSet<ClubFinanceAccount> ClubFinanceAccounts { get; set; }
    public DbSet<ClubFinanceTransaction> ClubFinanceTransactions { get; set; }
    public DbSet<ClubFinanceTransactionAttachment> ClubFinanceTransactionAttachments { get; set; }

    // Player History
    public DbSet<PlayerAward> PlayerAwards { get; set; }
    public DbSet<PlayerRatingHistory> PlayerRatingHistories { get; set; }

    // Push Notifications
    public DbSet<UserPushSubscription> PushSubscriptions { get; set; }

    // InstaGame (Pickup Games)
    public DbSet<InstaGame> InstaGames { get; set; }
    public DbSet<InstaGamePlayer> InstaGamePlayers { get; set; }
    public DbSet<InstaGameMatch> InstaGameMatches { get; set; }
    public DbSet<InstaGameQueue> InstaGameQueues { get; set; }

    // Release Notes
    public DbSet<ReleaseNote> ReleaseNotes { get; set; }
    public DbSet<UserDismissedRelease> UserDismissedReleases { get; set; }

    // Event Notification Templates
    public DbSet<EventNotificationTemplate> EventNotificationTemplates { get; set; }

    // Game Day System
    public DbSet<EventWaiver> EventWaivers { get; set; }
    public DbSet<EventCheckIn> EventCheckIns { get; set; }
    public DbSet<SpectatorSubscription> SpectatorSubscriptions { get; set; }
    public DbSet<GameQueue> GameQueues { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            // UserId comes from shared auth service - not auto-generated
            entity.Property(u => u.Id).ValueGeneratedNever();
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.Role).HasConversion<string>();
        });

        // User Social Links configuration
        modelBuilder.Entity<UserSocialLink>(entity =>
        {
            entity.Property(s => s.Platform).IsRequired().HasMaxLength(50);
            entity.Property(s => s.Url).IsRequired().HasMaxLength(500);
            entity.Property(s => s.DisplayName).HasMaxLength(100);
            entity.HasIndex(s => s.UserId);
            entity.HasIndex(s => new { s.UserId, s.SortOrder });

            entity.HasOne(s => s.User)
                  .WithMany()
                  .HasForeignKey(s => s.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Theme and Asset Management configuration
        modelBuilder.Entity<ThemeSettings>(entity =>
        {
            entity.HasKey(t => t.ThemeId);
            entity.Property(t => t.OrganizationName).HasMaxLength(200);
        });

        modelBuilder.Entity<ThemePreset>(entity =>
        {
            entity.HasKey(p => p.PresetId);
            entity.Property(p => p.PresetName).HasMaxLength(100);
        });

        modelBuilder.Entity<ActivityLog>(entity =>
        {
            entity.HasKey(a => a.LogId);
            entity.HasOne(a => a.User)
                  .WithMany()
                  .HasForeignKey(a => a.UserId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // Content Types configuration and seed data
        modelBuilder.Entity<ContentType>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.HasIndex(c => c.Code).IsUnique();
            entity.Property(c => c.Name).IsRequired().HasMaxLength(50);
            entity.Property(c => c.Code).IsRequired().HasMaxLength(50);

            entity.HasData(
                new ContentType
                {
                    Id = 1,
                    Name = "Video",
                    Code = "Video",
                    Icon = "Video",
                    Prompt = "Upload a video file or paste a YouTube/TikTok link",
                    AllowedExtensions = ".mp4,.mov,.avi,.wmv,.webm,.mkv",
                    MaxFileSizeMB = 500,
                    SortOrder = 1,
                    IsActive = true,
                    CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
                },
                new ContentType
                {
                    Id = 2,
                    Name = "Image",
                    Code = "Image",
                    Icon = "Image",
                    Prompt = "Upload an image file (PNG, JPG, WebP)",
                    AllowedExtensions = ".jpg,.jpeg,.png,.gif,.webp,.svg",
                    MaxFileSizeMB = 10,
                    SortOrder = 2,
                    IsActive = true,
                    CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
                },
                new ContentType
                {
                    Id = 3,
                    Name = "Document",
                    Code = "Document",
                    Icon = "FileText",
                    Prompt = "Upload a document file (PDF, Word, PowerPoint)",
                    AllowedExtensions = ".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx",
                    MaxFileSizeMB = 50,
                    SortOrder = 3,
                    IsActive = true,
                    CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
                },
                new ContentType
                {
                    Id = 4,
                    Name = "Audio",
                    Code = "Audio",
                    Icon = "Music",
                    Prompt = "Upload an audio file (MP3, WAV, M4A)",
                    AllowedExtensions = ".mp3,.wav,.m4a,.ogg,.flac,.aac",
                    MaxFileSizeMB = 100,
                    SortOrder = 4,
                    IsActive = true,
                    CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
                },
                new ContentType
                {
                    Id = 5,
                    Name = "External Link",
                    Code = "Link",
                    Icon = "Link",
                    Prompt = "Paste an external URL (YouTube, TikTok, or any video link)",
                    AllowedExtensions = "",
                    MaxFileSizeMB = 0,
                    SortOrder = 5,
                    IsActive = true,
                    CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
                }
            );
        });

        // Rating configuration
        modelBuilder.Entity<Rating>(entity =>
        {
            entity.HasOne(r => r.User)
                  .WithMany()
                  .HasForeignKey(r => r.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.Property(r => r.RatableType).IsRequired().HasMaxLength(50);
            entity.Property(r => r.Stars).IsRequired();
            entity.Property(r => r.Review).HasMaxLength(1000);

            // Composite index for unique rating per user per ratable item
            entity.HasIndex(r => new { r.UserId, r.RatableType, r.RatableId }).IsUnique();
            // Index for querying ratings by ratable item
            entity.HasIndex(r => new { r.RatableType, r.RatableId });
        });

        // Tag configuration
        modelBuilder.Entity<TagDefinition>(entity =>
        {
            entity.Property(t => t.Name).IsRequired().HasMaxLength(50);
            entity.HasIndex(t => t.Name).IsUnique();
        });

        modelBuilder.Entity<ObjectTag>(entity =>
        {
            entity.HasOne(ot => ot.Tag)
                  .WithMany(t => t.ObjectTags)
                  .HasForeignKey(ot => ot.TagId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(ot => ot.CreatedByUser)
                  .WithMany()
                  .HasForeignKey(ot => ot.CreatedByUserId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.Property(ot => ot.ObjectType).IsRequired().HasMaxLength(50);

            // Unique constraint: one tag per object
            entity.HasIndex(ot => new { ot.TagId, ot.ObjectType, ot.ObjectId }).IsUnique();
            // Index for querying tags by object
            entity.HasIndex(ot => new { ot.ObjectType, ot.ObjectId });
        });

        // Player Certification configuration
        modelBuilder.Entity<KnowledgeLevel>(entity =>
        {
            entity.Property(k => k.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(k => k.SortOrder);

            // Seed default knowledge levels
            entity.HasData(
                new KnowledgeLevel { Id = 1, Name = "I play with them regularly", SortOrder = 1, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new KnowledgeLevel { Id = 2, Name = "I have played with them a few times", SortOrder = 2, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new KnowledgeLevel { Id = 3, Name = "I watched them play live", SortOrder = 3, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new KnowledgeLevel { Id = 4, Name = "I watched video of them playing", SortOrder = 4, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new KnowledgeLevel { Id = 5, Name = "I coached them", SortOrder = 5, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) }
            );
        });

        modelBuilder.Entity<SkillGroup>(entity =>
        {
            entity.Property(g => g.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(g => g.SortOrder);
        });

        modelBuilder.Entity<SkillArea>(entity =>
        {
            entity.Property(s => s.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(s => s.SortOrder);

            entity.HasOne(s => s.SkillGroup)
                  .WithMany(g => g.SkillAreas)
                  .HasForeignKey(s => s.SkillGroupId)
                  .OnDelete(DeleteBehavior.SetNull);

            // Seed default skill areas
            entity.HasData(
                new SkillArea { Id = 1, Name = "Forehand Drive", Category = "Groundstrokes", SortOrder = 1, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillArea { Id = 2, Name = "Backhand Drive", Category = "Groundstrokes", SortOrder = 2, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillArea { Id = 3, Name = "Forehand Dink", Category = "Soft Game", SortOrder = 3, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillArea { Id = 4, Name = "Backhand Dink", Category = "Soft Game", SortOrder = 4, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillArea { Id = 5, Name = "Volley", Category = "Net Play", SortOrder = 5, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillArea { Id = 6, Name = "Overhead/Smash", Category = "Net Play", SortOrder = 6, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillArea { Id = 7, Name = "Serve", Category = "Serve & Return", SortOrder = 7, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillArea { Id = 8, Name = "Return of Serve", Category = "Serve & Return", SortOrder = 8, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillArea { Id = 9, Name = "Third Shot Drop", Category = "Strategy", SortOrder = 9, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillArea { Id = 10, Name = "Court Positioning", Category = "Strategy", SortOrder = 10, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillArea { Id = 11, Name = "Shot Selection", Category = "Strategy", SortOrder = 11, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillArea { Id = 12, Name = "Consistency", Category = "Overall", SortOrder = 12, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) }
            );
        });

        modelBuilder.Entity<PlayerCertificationRequest>(entity =>
        {
            entity.HasOne(r => r.Student)
                  .WithMany()
                  .HasForeignKey(r => r.StudentId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.Property(r => r.Token).IsRequired().HasMaxLength(64);
            entity.HasIndex(r => r.Token).IsUnique();
            entity.HasIndex(r => r.StudentId);
        });

        modelBuilder.Entity<PlayerCertificationReview>(entity =>
        {
            entity.HasOne(r => r.Request)
                  .WithMany(req => req.Reviews)
                  .HasForeignKey(r => r.RequestId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.KnowledgeLevel)
                  .WithMany()
                  .HasForeignKey(r => r.KnowledgeLevelId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.Property(r => r.ReviewerName).IsRequired().HasMaxLength(100);
            entity.HasIndex(r => r.RequestId);
        });

        modelBuilder.Entity<PlayerCertificationScore>(entity =>
        {
            entity.HasOne(s => s.Review)
                  .WithMany(r => r.Scores)
                  .HasForeignKey(s => s.ReviewId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(s => s.SkillArea)
                  .WithMany()
                  .HasForeignKey(s => s.SkillAreaId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(s => new { s.ReviewId, s.SkillAreaId }).IsUnique();
        });

        // Notification Template configuration
        modelBuilder.Entity<NotificationTemplate>(entity =>
        {
            entity.Property(t => t.TemplateKey).IsRequired().HasMaxLength(100);
            entity.Property(t => t.Name).IsRequired().HasMaxLength(200);
            entity.Property(t => t.Description).HasMaxLength(500);
            entity.Property(t => t.Category).IsRequired().HasMaxLength(100);
            entity.Property(t => t.Subject).IsRequired().HasMaxLength(500);
            entity.Property(t => t.Body).IsRequired();

            entity.HasIndex(t => t.TemplateKey).IsUnique();
            entity.HasIndex(t => t.Category);
            entity.HasIndex(t => t.IsActive);

            entity.HasOne(t => t.CreatedByUser)
                  .WithMany()
                  .HasForeignKey(t => t.CreatedByUserId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(t => t.UpdatedByUser)
                  .WithMany()
                  .HasForeignKey(t => t.UpdatedByUserId)
                  .OnDelete(DeleteBehavior.SetNull);
        });
        // Friend Request configuration
        modelBuilder.Entity<FriendRequest>(entity =>
        {
            entity.HasOne(fr => fr.Sender)
                  .WithMany()
                  .HasForeignKey(fr => fr.SenderId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(fr => fr.Recipient)
                  .WithMany()
                  .HasForeignKey(fr => fr.RecipientId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.Property(fr => fr.Status).IsRequired().HasMaxLength(20);
            entity.HasIndex(fr => new { fr.RecipientId, fr.Status });
            entity.HasIndex(fr => new { fr.SenderId, fr.Status });
        });

        // Friendship configuration
        modelBuilder.Entity<Friendship>(entity =>
        {
            entity.HasOne(f => f.User1)
                  .WithMany()
                  .HasForeignKey(f => f.UserId1)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(f => f.User2)
                  .WithMany()
                  .HasForeignKey(f => f.UserId2)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(f => f.OriginatingRequest)
                  .WithMany()
                  .HasForeignKey(f => f.OriginatingRequestId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(f => new { f.UserId1, f.UserId2 }).IsUnique();
            entity.HasIndex(f => f.UserId1);
            entity.HasIndex(f => f.UserId2);
        });

        // Venue configuration
        modelBuilder.Entity<Venue>(entity =>
        {
            entity.HasKey(v => v.VenueId);
            entity.HasMany(v => v.GeoCodes)
                  .WithOne(g => g.Venue)
                  .HasForeignKey(g => g.VenueId);
            entity.HasMany(v => v.Confirmations)
                  .WithOne(vc => vc.Venue)
                  .HasForeignKey(vc => vc.VenueId);
            entity.HasOne(v => v.VenueType)
                  .WithMany()
                  .HasForeignKey(v => v.VenueTypeId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // Venue Type configuration
        modelBuilder.Entity<VenueType>(entity =>
        {
            entity.Property(vt => vt.Name).IsRequired().HasMaxLength(50);
            entity.HasIndex(vt => vt.SortOrder);
        });

        // Venue GeoCode configuration
        modelBuilder.Entity<VenueGeoCode>(entity =>
        {
            entity.HasKey(g => g.GeoId);
            entity.HasOne(g => g.GeoCodeType)
                  .WithMany()
                  .HasForeignKey(g => g.GeoCodeTypeId);
        });

        // GeoCode Type configuration
        modelBuilder.Entity<GeoCodeType>(entity =>
        {
            entity.HasKey(t => t.GeoCodeTypeId);
        });

        // Venue Confirmation configuration
        modelBuilder.Entity<VenueConfirmation>(entity =>
        {
            entity.HasOne(vc => vc.User)
                  .WithMany()
                  .HasForeignKey(vc => vc.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(vc => new { vc.VenueId, vc.UserId }).IsUnique();
            entity.HasIndex(vc => vc.VenueId);
        });

        modelBuilder.Entity<VenueAsset>(entity =>
        {
            entity.HasOne(va => va.Venue)
                  .WithMany()
                  .HasForeignKey(va => va.VenueId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(va => va.User)
                  .WithMany()
                  .HasForeignKey(va => va.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(va => va.VenueId);
            entity.HasIndex(va => va.UserId);
            entity.HasIndex(va => va.CreatedAt);
        });

        modelBuilder.Entity<VenueAssetLike>(entity =>
        {
            entity.HasOne(val => val.Asset)
                  .WithMany(a => a.Likes)
                  .HasForeignKey(val => val.AssetId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(val => val.User)
                  .WithMany()
                  .HasForeignKey(val => val.UserId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasIndex(val => new { val.AssetId, val.UserId }).IsUnique();
            entity.HasIndex(val => val.AssetId);
        });

        // Club Member Roles configuration
        modelBuilder.Entity<ClubMemberRole>(entity =>
        {
            entity.Property(r => r.Name).IsRequired().HasMaxLength(50);
            entity.HasIndex(r => r.Name).IsUnique();
            entity.HasIndex(r => r.SortOrder);
        });

        // Team Unit configuration
        modelBuilder.Entity<TeamUnit>(entity =>
        {
            entity.Property(u => u.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(u => u.SortOrder);

            // Seed default team units
            entity.HasData(
                new TeamUnit { Id = 1, Name = "Men's Singles", Description = "Single male player", MaleCount = 1, FemaleCount = 0, UnisexCount = 0, SortOrder = 1, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new TeamUnit { Id = 2, Name = "Women's Singles", Description = "Single female player", MaleCount = 0, FemaleCount = 1, UnisexCount = 0, SortOrder = 2, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new TeamUnit { Id = 3, Name = "Open Singles", Description = "Single player of any gender", MaleCount = 0, FemaleCount = 0, UnisexCount = 1, SortOrder = 3, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new TeamUnit { Id = 4, Name = "Men's Doubles", Description = "Two male players", MaleCount = 2, FemaleCount = 0, UnisexCount = 0, SortOrder = 4, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new TeamUnit { Id = 5, Name = "Women's Doubles", Description = "Two female players", MaleCount = 0, FemaleCount = 2, UnisexCount = 0, SortOrder = 5, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new TeamUnit { Id = 6, Name = "Mixed Doubles", Description = "One male and one female player", MaleCount = 1, FemaleCount = 1, UnisexCount = 0, SortOrder = 6, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new TeamUnit { Id = 7, Name = "Open Doubles", Description = "Two players of any gender", MaleCount = 0, FemaleCount = 0, UnisexCount = 2, SortOrder = 7, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) }
            );
        });

        // Age Group configuration
        modelBuilder.Entity<AgeGroup>(entity =>
        {
            entity.Property(a => a.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(a => a.SortOrder);

            // Seed default age groups
            entity.HasData(
                new AgeGroup { Id = 1, Name = "Open", Description = "All ages welcome", MinAge = null, MaxAge = null, SortOrder = 1, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new AgeGroup { Id = 2, Name = "Junior (Under 18)", Description = "Players under 18 years old", MinAge = null, MaxAge = 17, SortOrder = 2, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new AgeGroup { Id = 3, Name = "Adult (18-49)", Description = "Players 18-49 years old", MinAge = 18, MaxAge = 49, SortOrder = 3, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new AgeGroup { Id = 4, Name = "Senior 50+", Description = "Players 50 years and older", MinAge = 50, MaxAge = null, SortOrder = 4, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new AgeGroup { Id = 5, Name = "Senior 60+", Description = "Players 60 years and older", MinAge = 60, MaxAge = null, SortOrder = 5, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new AgeGroup { Id = 6, Name = "Senior 70+", Description = "Players 70 years and older", MinAge = 70, MaxAge = null, SortOrder = 6, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) }
            );
        });

        // Division Reward configuration
        modelBuilder.Entity<DivisionReward>(entity =>
        {
            entity.Property(r => r.RewardType).IsRequired().HasMaxLength(50);
            entity.Property(r => r.Description).HasMaxLength(200);
            entity.HasIndex(r => new { r.DivisionId, r.Placement });

            entity.HasOne(r => r.Division)
                  .WithMany(d => d.Rewards)
                  .HasForeignKey(r => r.DivisionId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Skill Level configuration
        modelBuilder.Entity<SkillLevel>(entity =>
        {
            entity.Property(s => s.Name).IsRequired().HasMaxLength(50);
            entity.HasIndex(s => s.SortOrder);

            // Seed default skill levels
            entity.HasData(
                new SkillLevel { Id = 1, Name = "2.0", Description = "Beginner", Value = 2.0m, SortOrder = 1, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillLevel { Id = 2, Name = "2.5", Description = "Beginner+", Value = 2.5m, SortOrder = 2, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillLevel { Id = 3, Name = "3.0", Description = "Intermediate", Value = 3.0m, SortOrder = 3, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillLevel { Id = 4, Name = "3.5", Description = "Intermediate+", Value = 3.5m, SortOrder = 4, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillLevel { Id = 5, Name = "4.0", Description = "Advanced", Value = 4.0m, SortOrder = 5, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillLevel { Id = 6, Name = "4.5", Description = "Advanced+", Value = 4.5m, SortOrder = 6, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillLevel { Id = 7, Name = "5.0", Description = "Expert", Value = 5.0m, SortOrder = 7, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillLevel { Id = 8, Name = "5.5+", Description = "Pro/Tour", Value = 5.5m, SortOrder = 8, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new SkillLevel { Id = 9, Name = "Open", Description = "All skill levels welcome", Value = null, SortOrder = 9, IsActive = true, CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc) }
            );
        });

        // Event Division configuration (add navigation for new entities)
        modelBuilder.Entity<EventDivision>(entity =>
        {
            entity.HasOne(d => d.TeamUnit)
                  .WithMany()
                  .HasForeignKey(d => d.TeamUnitId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(d => d.AgeGroupEntity)
                  .WithMany()
                  .HasForeignKey(d => d.AgeGroupId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(d => d.SkillLevel)
                  .WithMany()
                  .HasForeignKey(d => d.SkillLevelId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(d => d.DefaultScoreFormat)
                  .WithMany()
                  .HasForeignKey(d => d.DefaultScoreFormatId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // Score Method configuration (admin-managed scoring types)
        modelBuilder.Entity<ScoreMethod>(entity =>
        {
            entity.Property(s => s.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(s => s.SortOrder);
            entity.HasIndex(s => s.IsActive);
        });

        // Score Format configuration
        modelBuilder.Entity<ScoreFormat>(entity =>
        {
            entity.Property(s => s.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(s => s.SortOrder);

            entity.HasOne(s => s.ScoreMethod)
                  .WithMany()
                  .HasForeignKey(s => s.ScoreMethodId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // Event Unit configuration
        modelBuilder.Entity<EventUnit>(entity =>
        {
            entity.Property(u => u.Name).IsRequired().HasMaxLength(100);
            entity.Property(u => u.Status).IsRequired().HasMaxLength(20);
            entity.HasIndex(u => u.EventId);
            entity.HasIndex(u => u.DivisionId);
            entity.HasIndex(u => u.Status);
            entity.HasIndex(u => new { u.DivisionId, u.UnitNumber });

            entity.HasOne(u => u.Event)
                  .WithMany(e => e.Units)
                  .HasForeignKey(u => u.EventId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(u => u.Division)
                  .WithMany(d => d.Units)
                  .HasForeignKey(u => u.DivisionId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(u => u.Captain)
                  .WithMany()
                  .HasForeignKey(u => u.CaptainUserId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // Event Unit Member configuration
        modelBuilder.Entity<EventUnitMember>(entity =>
        {
            entity.Property(m => m.Role).HasMaxLength(20);
            entity.Property(m => m.InviteStatus).HasMaxLength(20);
            entity.HasIndex(m => m.UnitId);
            entity.HasIndex(m => m.UserId);
            entity.HasIndex(m => new { m.UnitId, m.UserId }).IsUnique();

            entity.HasOne(m => m.Unit)
                  .WithMany(u => u.Members)
                  .HasForeignKey(m => m.UnitId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(m => m.User)
                  .WithMany()
                  .HasForeignKey(m => m.UserId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // Event Unit Join Request configuration
        modelBuilder.Entity<EventUnitJoinRequest>(entity =>
        {
            entity.Property(r => r.Status).HasMaxLength(20);
            entity.HasIndex(r => r.UnitId);
            entity.HasIndex(r => r.UserId);
            entity.HasIndex(r => r.Status);

            entity.HasOne(r => r.Unit)
                  .WithMany(u => u.JoinRequests)
                  .HasForeignKey(r => r.UnitId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.User)
                  .WithMany()
                  .HasForeignKey(r => r.UserId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // Tournament Court configuration
        modelBuilder.Entity<TournamentCourt>(entity =>
        {
            entity.Property(c => c.CourtLabel).IsRequired().HasMaxLength(50);
            entity.Property(c => c.Status).HasMaxLength(20);
            entity.HasIndex(c => c.EventId);
            entity.HasIndex(c => c.Status);

            entity.HasOne(c => c.Event)
                  .WithMany(e => e.TournamentCourts)
                  .HasForeignKey(c => c.EventId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(c => c.Venue)
                  .WithMany()
                  .HasForeignKey(c => c.VenueId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(c => c.CurrentGame)
                  .WithMany()
                  .HasForeignKey(c => c.CurrentGameId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // Event Match configuration
        modelBuilder.Entity<EventMatch>(entity =>
        {
            entity.Property(m => m.RoundType).HasMaxLength(20);
            entity.Property(m => m.Status).HasMaxLength(20);
            entity.HasIndex(m => m.EventId);
            entity.HasIndex(m => m.DivisionId);
            entity.HasIndex(m => m.Status);
            entity.HasIndex(m => new { m.DivisionId, m.RoundType, m.RoundNumber });

            entity.HasOne(m => m.Event)
                  .WithMany(e => e.Matches)
                  .HasForeignKey(m => m.EventId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(m => m.Division)
                  .WithMany(d => d.Matches)
                  .HasForeignKey(m => m.DivisionId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(m => m.Unit1)
                  .WithMany()
                  .HasForeignKey(m => m.Unit1Id)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(m => m.Unit2)
                  .WithMany()
                  .HasForeignKey(m => m.Unit2Id)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(m => m.Winner)
                  .WithMany()
                  .HasForeignKey(m => m.WinnerUnitId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(m => m.TournamentCourt)
                  .WithMany()
                  .HasForeignKey(m => m.TournamentCourtId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(m => m.ScoreFormat)
                  .WithMany()
                  .HasForeignKey(m => m.ScoreFormatId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // Event Game configuration
        modelBuilder.Entity<EventGame>(entity =>
        {
            entity.Property(g => g.Status).HasMaxLength(20);
            entity.HasIndex(g => g.MatchId);
            entity.HasIndex(g => g.Status);
            entity.HasIndex(g => g.TournamentCourtId);

            entity.HasOne(g => g.Match)
                  .WithMany(m => m.Games)
                  .HasForeignKey(g => g.MatchId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(g => g.ScoreFormat)
                  .WithMany()
                  .HasForeignKey(g => g.ScoreFormatId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(g => g.Winner)
                  .WithMany()
                  .HasForeignKey(g => g.WinnerUnitId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(g => g.TournamentCourt)
                  .WithMany()
                  .HasForeignKey(g => g.TournamentCourtId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(g => g.ScoreSubmittedBy)
                  .WithMany()
                  .HasForeignKey(g => g.ScoreSubmittedByUnitId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(g => g.ScoreConfirmedBy)
                  .WithMany()
                  .HasForeignKey(g => g.ScoreConfirmedByUnitId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // Event Game Player configuration
        modelBuilder.Entity<EventGamePlayer>(entity =>
        {
            entity.HasIndex(p => p.GameId);
            entity.HasIndex(p => p.UserId);
            entity.HasIndex(p => new { p.GameId, p.UserId }).IsUnique();

            entity.HasOne(p => p.Game)
                  .WithMany(g => g.Players)
                  .HasForeignKey(p => p.GameId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(p => p.User)
                  .WithMany()
                  .HasForeignKey(p => p.UserId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(p => p.Unit)
                  .WithMany()
                  .HasForeignKey(p => p.UnitId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // Event Game Score History configuration (audit trail)
        modelBuilder.Entity<EventGameScoreHistory>(entity =>
        {
            entity.Property(h => h.ChangeType).IsRequired().HasMaxLength(50);
            entity.Property(h => h.Reason).HasMaxLength(500);
            entity.Property(h => h.IpAddress).HasMaxLength(45);
            entity.HasIndex(h => h.GameId);
            entity.HasIndex(h => h.ChangedByUserId);
            entity.HasIndex(h => h.CreatedAt);

            entity.HasOne(h => h.Game)
                  .WithMany()
                  .HasForeignKey(h => h.GameId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(h => h.ChangedByUser)
                  .WithMany()
                  .HasForeignKey(h => h.ChangedByUserId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(h => h.ChangedByUnit)
                  .WithMany()
                  .HasForeignKey(h => h.ChangedByUnitId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // Blog Category configuration
        modelBuilder.Entity<BlogCategory>(entity =>
        {
            entity.Property(c => c.Name).IsRequired().HasMaxLength(100);
            entity.Property(c => c.Slug).IsRequired().HasMaxLength(100);
            entity.HasIndex(c => c.Slug).IsUnique();
            entity.HasIndex(c => c.SortOrder);
        });

        // Blog Post configuration
        modelBuilder.Entity<BlogPost>(entity =>
        {
            entity.Property(p => p.Title).IsRequired().HasMaxLength(200);
            entity.Property(p => p.Slug).IsRequired().HasMaxLength(200);
            entity.Property(p => p.Status).HasConversion<string>();
            entity.HasIndex(p => p.Slug).IsUnique();
            entity.HasIndex(p => p.Status);
            entity.HasIndex(p => p.PublishedAt);

            entity.HasOne(p => p.Author)
                  .WithMany(u => u.BlogPosts)
                  .HasForeignKey(p => p.AuthorId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(p => p.Category)
                  .WithMany(c => c.Posts)
                  .HasForeignKey(p => p.CategoryId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // Blog Comment configuration
        modelBuilder.Entity<BlogComment>(entity =>
        {
            entity.Property(c => c.Content).IsRequired().HasMaxLength(2000);
            entity.HasIndex(c => c.PostId);
            entity.HasIndex(c => c.UserId);
            entity.HasIndex(c => c.CreatedAt);

            entity.HasOne(c => c.Post)
                  .WithMany(p => p.Comments)
                  .HasForeignKey(c => c.PostId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(c => c.User)
                  .WithMany(u => u.BlogComments)
                  .HasForeignKey(c => c.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(c => c.Parent)
                  .WithMany(c => c.Replies)
                  .HasForeignKey(c => c.ParentId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // Messaging configuration
        modelBuilder.Entity<Conversation>(entity =>
        {
            entity.Property(c => c.Type).IsRequired().HasMaxLength(20);
            entity.Property(c => c.Name).HasMaxLength(100);
            entity.HasIndex(c => c.ClubId);
            entity.HasIndex(c => c.LastMessageAt);

            entity.HasOne(c => c.Club)
                  .WithOne(club => club.ChatConversation)
                  .HasForeignKey<Club>(club => club.ChatConversationId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ConversationParticipant>(entity =>
        {
            entity.Property(p => p.Role).HasMaxLength(20);
            entity.HasIndex(p => p.UserId);
            entity.HasIndex(p => p.ConversationId);
            entity.HasIndex(p => new { p.ConversationId, p.UserId }).IsUnique();

            entity.HasOne(p => p.Conversation)
                  .WithMany(c => c.Participants)
                  .HasForeignKey(p => p.ConversationId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(p => p.User)
                  .WithMany()
                  .HasForeignKey(p => p.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Message>(entity =>
        {
            entity.Property(m => m.Content).IsRequired().HasMaxLength(4000);
            entity.Property(m => m.MessageType).HasMaxLength(20);
            entity.HasIndex(m => m.ConversationId);
            entity.HasIndex(m => m.SenderId);
            entity.HasIndex(m => new { m.ConversationId, m.SentAt });

            entity.HasOne(m => m.Conversation)
                  .WithMany(c => c.Messages)
                  .HasForeignKey(m => m.ConversationId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(m => m.Sender)
                  .WithMany()
                  .HasForeignKey(m => m.SenderId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(m => m.ReplyToMessage)
                  .WithMany()
                  .HasForeignKey(m => m.ReplyToMessageId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<MessageReadReceipt>(entity =>
        {
            entity.HasIndex(r => r.MessageId);
            entity.HasIndex(r => new { r.MessageId, r.UserId }).IsUnique();

            entity.HasOne(r => r.Message)
                  .WithMany(m => m.ReadReceipts)
                  .HasForeignKey(r => r.MessageId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.User)
                  .WithMany()
                  .HasForeignKey(r => r.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // FAQ Category configuration
        modelBuilder.Entity<FaqCategory>(entity =>
        {
            entity.Property(c => c.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(c => c.SortOrder);
        });

        // FAQ Entry configuration
        modelBuilder.Entity<FaqEntry>(entity =>
        {
            entity.Property(e => e.Question).IsRequired().HasMaxLength(500);
            entity.Property(e => e.Answer).IsRequired();
            entity.HasIndex(e => e.CategoryId);
            entity.HasIndex(e => e.SortOrder);

            entity.HasOne(e => e.Category)
                  .WithMany(c => c.Entries)
                  .HasForeignKey(e => e.CategoryId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Feedback Category configuration
        modelBuilder.Entity<FeedbackCategory>(entity =>
        {
            entity.Property(c => c.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(c => c.SortOrder);
        });

        // Feedback Entry configuration
        modelBuilder.Entity<FeedbackEntry>(entity =>
        {
            entity.Property(e => e.Subject).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Message).IsRequired();
            entity.Property(e => e.Status).HasMaxLength(50);
            entity.HasIndex(e => e.CategoryId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CreatedAt);

            entity.HasOne(e => e.Category)
                  .WithMany(c => c.Entries)
                  .HasForeignKey(e => e.CategoryId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.User)
                  .WithMany()
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // League configuration
        modelBuilder.Entity<League>(entity =>
        {
            entity.Property(l => l.Name).IsRequired().HasMaxLength(100);
            entity.Property(l => l.Scope).IsRequired().HasMaxLength(20);
            entity.HasIndex(l => l.ParentLeagueId);
            entity.HasIndex(l => l.Scope);
            entity.HasIndex(l => l.IsActive);

            entity.HasOne(l => l.ParentLeague)
                  .WithMany(l => l.ChildLeagues)
                  .HasForeignKey(l => l.ParentLeagueId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // League Manager configuration
        modelBuilder.Entity<LeagueManager>(entity =>
        {
            entity.Property(m => m.Role).IsRequired().HasMaxLength(50);
            entity.HasIndex(m => m.LeagueId);
            entity.HasIndex(m => m.UserId);
            entity.HasIndex(m => new { m.LeagueId, m.UserId }).IsUnique();

            entity.HasOne(m => m.League)
                  .WithMany(l => l.Managers)
                  .HasForeignKey(m => m.LeagueId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(m => m.User)
                  .WithMany()
                  .HasForeignKey(m => m.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // League Club configuration
        modelBuilder.Entity<LeagueClub>(entity =>
        {
            entity.Property(c => c.Status).HasMaxLength(20);
            entity.HasIndex(c => c.LeagueId);
            entity.HasIndex(c => c.ClubId);
            entity.HasIndex(c => new { c.LeagueId, c.ClubId }).IsUnique();

            entity.HasOne(c => c.League)
                  .WithMany(l => l.Clubs)
                  .HasForeignKey(c => c.LeagueId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(c => c.Club)
                  .WithMany()
                  .HasForeignKey(c => c.ClubId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // League Club Request configuration
        modelBuilder.Entity<LeagueClubRequest>(entity =>
        {
            entity.Property(r => r.Status).HasMaxLength(20);
            entity.HasIndex(r => r.LeagueId);
            entity.HasIndex(r => r.ClubId);
            entity.HasIndex(r => r.Status);

            entity.HasOne(r => r.League)
                  .WithMany(l => l.ClubRequests)
                  .HasForeignKey(r => r.LeagueId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.Club)
                  .WithMany()
                  .HasForeignKey(r => r.ClubId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.RequestedBy)
                  .WithMany()
                  .HasForeignKey(r => r.RequestedByUserId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(r => r.ProcessedBy)
                  .WithMany()
                  .HasForeignKey(r => r.ProcessedByUserId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // Club Finance Account configuration
        modelBuilder.Entity<ClubFinanceAccount>(entity =>
        {
            entity.HasIndex(a => a.ClubId).IsUnique();

            entity.HasOne(a => a.Club)
                  .WithMany()
                  .HasForeignKey(a => a.ClubId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Club Finance Transaction configuration
        modelBuilder.Entity<ClubFinanceTransaction>(entity =>
        {
            entity.Property(t => t.TransactionType).IsRequired().HasMaxLength(20);
            entity.Property(t => t.Category).IsRequired().HasMaxLength(50);
            entity.Property(t => t.Description).IsRequired().HasMaxLength(500);
            entity.HasIndex(t => t.AccountId);
            entity.HasIndex(t => t.TransactionType);
            entity.HasIndex(t => t.Category);
            entity.HasIndex(t => t.MemberId);
            entity.HasIndex(t => t.CreatedAt);

            entity.HasOne(t => t.Account)
                  .WithMany(a => a.Transactions)
                  .HasForeignKey(t => t.AccountId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(t => t.Member)
                  .WithMany()
                  .HasForeignKey(t => t.MemberId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(t => t.MemberUser)
                  .WithMany()
                  .HasForeignKey(t => t.MemberUserId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(t => t.RecordedBy)
                  .WithMany()
                  .HasForeignKey(t => t.RecordedByUserId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(t => t.ApprovedBy)
                  .WithMany()
                  .HasForeignKey(t => t.ApprovedByUserId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(t => t.VoidedBy)
                  .WithMany()
                  .HasForeignKey(t => t.VoidedByUserId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // Club Finance Transaction Attachment configuration
        modelBuilder.Entity<ClubFinanceTransactionAttachment>(entity =>
        {
            entity.Property(a => a.FileName).IsRequired().HasMaxLength(255);
            entity.Property(a => a.FileUrl).IsRequired().HasMaxLength(500);
            entity.HasIndex(a => a.TransactionId);

            entity.HasOne(a => a.Transaction)
                  .WithMany(t => t.Attachments)
                  .HasForeignKey(a => a.TransactionId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(a => a.UploadedBy)
                  .WithMany()
                  .HasForeignKey(a => a.UploadedByUserId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // Player Award configuration
        modelBuilder.Entity<PlayerAward>(entity =>
        {
            entity.Property(a => a.AwardType).IsRequired().HasMaxLength(50);
            entity.Property(a => a.Title).IsRequired().HasMaxLength(200);
            entity.HasIndex(a => a.UserId);
            entity.HasIndex(a => a.AwardType);
            entity.HasIndex(a => a.AwardedAt);
            entity.HasIndex(a => a.EventId);
            entity.HasIndex(a => a.LeagueId);

            entity.HasOne(a => a.User)
                  .WithMany()
                  .HasForeignKey(a => a.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(a => a.Event)
                  .WithMany()
                  .HasForeignKey(a => a.EventId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(a => a.Division)
                  .WithMany()
                  .HasForeignKey(a => a.DivisionId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(a => a.League)
                  .WithMany()
                  .HasForeignKey(a => a.LeagueId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(a => a.Club)
                  .WithMany()
                  .HasForeignKey(a => a.ClubId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(a => a.AwardedBy)
                  .WithMany()
                  .HasForeignKey(a => a.AwardedByUserId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // Player Rating History configuration
        modelBuilder.Entity<PlayerRatingHistory>(entity =>
        {
            entity.ToTable("PlayerRatingHistory"); // Map to singular table name
            entity.Property(r => r.RatingType).IsRequired().HasMaxLength(50);
            entity.HasIndex(r => r.UserId);
            entity.HasIndex(r => r.RatingType);
            entity.HasIndex(r => r.EffectiveDate);
            entity.HasIndex(r => new { r.UserId, r.EffectiveDate });

            entity.HasOne(r => r.User)
                  .WithMany()
                  .HasForeignKey(r => r.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.Event)
                  .WithMany()
                  .HasForeignKey(r => r.EventId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(r => r.Game)
                  .WithMany()
                  .HasForeignKey(r => r.GameId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(r => r.UpdatedBy)
                  .WithMany()
                  .HasForeignKey(r => r.UpdatedByUserId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // InstaGame configuration
        modelBuilder.Entity<InstaGame>(entity =>
        {
            entity.Property(g => g.Name).IsRequired().HasMaxLength(100);
            entity.Property(g => g.JoinCode).IsRequired().HasMaxLength(10);
            entity.Property(g => g.Status).IsRequired().HasMaxLength(20);
            entity.Property(g => g.SchedulingMethod).IsRequired().HasMaxLength(20);
            entity.HasIndex(g => g.JoinCode).IsUnique();
            entity.HasIndex(g => g.Status);
            entity.HasIndex(g => g.CreatorId);
            entity.HasIndex(g => g.CreatedAt);

            entity.HasOne(g => g.Creator)
                  .WithMany()
                  .HasForeignKey(g => g.CreatorId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(g => g.Venue)
                  .WithMany()
                  .HasForeignKey(g => g.VenueId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(g => g.ScoreFormat)
                  .WithMany()
                  .HasForeignKey(g => g.ScoreFormatId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // InstaGamePlayer configuration
        modelBuilder.Entity<InstaGamePlayer>(entity =>
        {
            entity.Property(p => p.Status).IsRequired().HasMaxLength(20);
            entity.HasIndex(p => p.InstaGameId);
            entity.HasIndex(p => p.UserId);
            entity.HasIndex(p => new { p.InstaGameId, p.UserId }).IsUnique();
            entity.HasIndex(p => new { p.InstaGameId, p.Status });
            entity.HasIndex(p => new { p.InstaGameId, p.QueuePosition });

            entity.HasOne(p => p.InstaGame)
                  .WithMany(g => g.Players)
                  .HasForeignKey(p => p.InstaGameId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(p => p.User)
                  .WithMany()
                  .HasForeignKey(p => p.UserId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // InstaGameMatch configuration
        modelBuilder.Entity<InstaGameMatch>(entity =>
        {
            entity.Property(m => m.Status).IsRequired().HasMaxLength(20);
            entity.Property(m => m.Team1PlayerIds).IsRequired().HasMaxLength(200);
            entity.Property(m => m.Team2PlayerIds).IsRequired().HasMaxLength(200);
            entity.HasIndex(m => m.InstaGameId);
            entity.HasIndex(m => m.Status);
            entity.HasIndex(m => new { m.InstaGameId, m.MatchNumber });

            entity.HasOne(m => m.InstaGame)
                  .WithMany(g => g.Matches)
                  .HasForeignKey(m => m.InstaGameId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(m => m.ScoreSubmittedBy)
                  .WithMany()
                  .HasForeignKey(m => m.ScoreSubmittedByUserId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(m => m.ScoreConfirmedBy)
                  .WithMany()
                  .HasForeignKey(m => m.ScoreConfirmedByUserId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // InstaGameQueue configuration
        modelBuilder.Entity<InstaGameQueue>(entity =>
        {
            entity.Property(q => q.Team1PlayerIds).IsRequired().HasMaxLength(200);
            entity.Property(q => q.QueueType).IsRequired().HasMaxLength(20);
            entity.HasIndex(q => new { q.InstaGameId, q.Position });
            entity.HasIndex(q => new { q.InstaGameId, q.QueueType });

            entity.HasOne(q => q.InstaGame)
                  .WithMany(g => g.Queue)
                  .HasForeignKey(q => q.InstaGameId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ReleaseNote configuration
        modelBuilder.Entity<ReleaseNote>(entity =>
        {
            entity.Property(r => r.Version).IsRequired().HasMaxLength(50);
            entity.Property(r => r.Title).IsRequired().HasMaxLength(200);
            entity.Property(r => r.Content).IsRequired();
            entity.HasIndex(r => r.ReleaseDate);
            entity.HasIndex(r => r.IsActive);

            entity.HasOne(r => r.CreatedBy)
                  .WithMany()
                  .HasForeignKey(r => r.CreatedByUserId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(r => r.UpdatedBy)
                  .WithMany()
                  .HasForeignKey(r => r.UpdatedByUserId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // UserDismissedRelease configuration
        modelBuilder.Entity<UserDismissedRelease>(entity =>
        {
            entity.HasIndex(d => d.UserId);
            entity.HasIndex(d => new { d.UserId, d.ReleaseNoteId }).IsUnique();

            entity.HasOne(d => d.User)
                  .WithMany()
                  .HasForeignKey(d => d.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(d => d.ReleaseNote)
                  .WithMany(r => r.DismissedByUsers)
                  .HasForeignKey(d => d.ReleaseNoteId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Event Waiver configuration
        modelBuilder.Entity<EventWaiver>(entity =>
        {
            entity.Property(w => w.Title).IsRequired().HasMaxLength(200);
            entity.Property(w => w.Content).IsRequired();
            entity.HasIndex(w => w.EventId);
            entity.HasIndex(w => w.IsActive);

            entity.HasOne(w => w.Event)
                  .WithMany()
                  .HasForeignKey(w => w.EventId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(w => w.CreatedBy)
                  .WithMany()
                  .HasForeignKey(w => w.CreatedByUserId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // Event Check-In configuration
        modelBuilder.Entity<EventCheckIn>(entity =>
        {
            entity.Property(c => c.CheckInMethod).HasMaxLength(20);
            entity.HasIndex(c => c.EventId);
            entity.HasIndex(c => c.UserId);
            entity.HasIndex(c => new { c.EventId, c.UserId }).IsUnique();

            entity.HasOne(c => c.Event)
                  .WithMany()
                  .HasForeignKey(c => c.EventId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(c => c.User)
                  .WithMany()
                  .HasForeignKey(c => c.UserId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(c => c.CheckedInBy)
                  .WithMany()
                  .HasForeignKey(c => c.CheckedInByUserId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // Spectator Subscription configuration
        modelBuilder.Entity<SpectatorSubscription>(entity =>
        {
            entity.Property(s => s.SubscriptionType).IsRequired().HasMaxLength(20);
            entity.HasIndex(s => s.UserId);
            entity.HasIndex(s => s.EventId);
            entity.HasIndex(s => new { s.SubscriptionType, s.TargetId });

            entity.HasOne(s => s.User)
                  .WithMany()
                  .HasForeignKey(s => s.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(s => s.Event)
                  .WithMany()
                  .HasForeignKey(s => s.EventId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Game Queue configuration
        modelBuilder.Entity<GameQueue>(entity =>
        {
            entity.Property(q => q.Status).HasMaxLength(20);
            entity.HasIndex(q => q.EventId);
            entity.HasIndex(q => new { q.TournamentCourtId, q.Status });
            entity.HasIndex(q => q.GameId);

            entity.HasOne(q => q.Event)
                  .WithMany()
                  .HasForeignKey(q => q.EventId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(q => q.TournamentCourt)
                  .WithMany()
                  .HasForeignKey(q => q.TournamentCourtId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(q => q.Game)
                  .WithMany()
                  .HasForeignKey(q => q.GameId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(q => q.QueuedBy)
                  .WithMany()
                  .HasForeignKey(q => q.QueuedByUserId)
                  .OnDelete(DeleteBehavior.NoAction);
        });
    }
}
