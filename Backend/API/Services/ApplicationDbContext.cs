using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Database;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }

    // Theme and Asset Management
    public DbSet<ThemeSettings> ThemeSettings { get; set; }
    public DbSet<ThemePreset> ThemePresets { get; set; }
    public DbSet<ActivityLog> ActivityLogs { get; set; }
    public DbSet<Asset> Assets { get; set; }

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

    // Friends
    public DbSet<FriendRequest> FriendRequests { get; set; }
    public DbSet<Friendship> Friendships { get; set; }

    // Courts
    public DbSet<Court> Courts { get; set; }
    public DbSet<CourtType> CourtTypes { get; set; }
    public DbSet<CourtGeoCode> CourtGeoCodes { get; set; }
    public DbSet<GeoCodeType> GeoCodeTypes { get; set; }
    public DbSet<CourtConfirmation> CourtConfirmations { get; set; }
    public DbSet<CourtAsset> CourtAssets { get; set; }
    public DbSet<CourtAssetLike> CourtAssetLikes { get; set; }

    // Events
    public DbSet<EventType> EventTypes { get; set; }
    public DbSet<Event> Events { get; set; }
    public DbSet<EventDivision> EventDivisions { get; set; }
    public DbSet<EventRegistration> EventRegistrations { get; set; }
    public DbSet<EventPartnerRequest> EventPartnerRequests { get; set; }
    public DbSet<TeamUnit> TeamUnits { get; set; }
    public DbSet<AgeGroup> AgeGroups { get; set; }
    public DbSet<DivisionReward> DivisionRewards { get; set; }

    // Clubs
    public DbSet<Club> Clubs { get; set; }
    public DbSet<ClubMember> ClubMembers { get; set; }
    public DbSet<ClubJoinRequest> ClubJoinRequests { get; set; }
    public DbSet<ClubNotification> ClubNotifications { get; set; }
    public DbSet<ClubMemberRole> ClubMemberRoles { get; set; }

    // Blog
    public DbSet<BlogCategory> BlogCategories { get; set; }
    public DbSet<BlogPost> BlogPosts { get; set; }
    public DbSet<BlogComment> BlogComments { get; set; }

    // Messaging
    public DbSet<Conversation> Conversations { get; set; }
    public DbSet<ConversationParticipant> ConversationParticipants { get; set; }
    public DbSet<Message> Messages { get; set; }
    public DbSet<MessageReadReceipt> MessageReadReceipts { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            // UserId comes from shared auth service - not auto-generated
            entity.Property(u => u.Id).ValueGeneratedNever();
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.Role).HasConversion<string>();
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

        // Court configuration
        modelBuilder.Entity<Court>(entity =>
        {
            entity.HasKey(c => c.CourtId);
            entity.HasMany(c => c.GeoCodes)
                  .WithOne(g => g.Court)
                  .HasForeignKey(g => g.CourtId);
            entity.HasMany(c => c.Confirmations)
                  .WithOne(cc => cc.Court)
                  .HasForeignKey(cc => cc.CourtId);
            entity.HasOne(c => c.CourtType)
                  .WithMany()
                  .HasForeignKey(c => c.CourtTypeId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // Court Type configuration
        modelBuilder.Entity<CourtType>(entity =>
        {
            entity.Property(ct => ct.Name).IsRequired().HasMaxLength(50);
            entity.HasIndex(ct => ct.SortOrder);
        });

        // Court GeoCode configuration
        modelBuilder.Entity<CourtGeoCode>(entity =>
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

        // Court Confirmation configuration
        modelBuilder.Entity<CourtConfirmation>(entity =>
        {
            entity.HasOne(cc => cc.User)
                  .WithMany()
                  .HasForeignKey(cc => cc.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(cc => new { cc.CourtId, cc.UserId }).IsUnique();
            entity.HasIndex(cc => cc.CourtId);
        });

        modelBuilder.Entity<CourtAsset>(entity =>
        {
            entity.HasOne(ca => ca.Court)
                  .WithMany()
                  .HasForeignKey(ca => ca.CourtId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(ca => ca.User)
                  .WithMany()
                  .HasForeignKey(ca => ca.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(ca => ca.CourtId);
            entity.HasIndex(ca => ca.UserId);
            entity.HasIndex(ca => ca.CreatedAt);
        });

        modelBuilder.Entity<CourtAssetLike>(entity =>
        {
            entity.HasOne(cal => cal.Asset)
                  .WithMany(a => a.Likes)
                  .HasForeignKey(cal => cal.AssetId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(cal => cal.User)
                  .WithMany()
                  .HasForeignKey(cal => cal.UserId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasIndex(cal => new { cal.AssetId, cal.UserId }).IsUnique();
            entity.HasIndex(cal => cal.AssetId);
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
    }
}
