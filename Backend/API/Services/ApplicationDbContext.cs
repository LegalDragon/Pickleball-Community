using Microsoft.EntityFrameworkCore;
using Pickleball.College.Models.Entities;

namespace Pickleball.College.Database;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<CoachProfile> CoachProfiles { get; set; }
    public DbSet<TrainingMaterial> TrainingMaterials { get; set; }
    public DbSet<MaterialPurchase> MaterialPurchases { get; set; }
    public DbSet<TrainingSession> TrainingSessions { get; set; }

    // Courses
    public DbSet<Course> Courses { get; set; }
    public DbSet<CourseMaterial> CourseMaterials { get; set; }
    public DbSet<CoursePurchase> CoursePurchases { get; set; }

    // Theme and Asset Management
    public DbSet<ThemeSettings> ThemeSettings { get; set; }
    public DbSet<ThemePreset> ThemePresets { get; set; }
    public DbSet<ActivityLog> ActivityLogs { get; set; }
    public DbSet<Asset> Assets { get; set; }

    // Content Types for Materials
    public DbSet<ContentType> ContentTypes { get; set; }

    // Ratings
    public DbSet<Rating> Ratings { get; set; }

    // Tags
    public DbSet<TagDefinition> TagDefinitions { get; set; }
    public DbSet<ObjectTag> ObjectTags { get; set; }

    // Video Review Requests
    public DbSet<VideoReviewRequest> VideoReviewRequests { get; set; }

    // Blog Posts
    public DbSet<BlogPost> BlogPosts { get; set; }

    // Player Certification
    public DbSet<KnowledgeLevel> KnowledgeLevels { get; set; }
    public DbSet<SkillGroup> SkillGroups { get; set; }
    public DbSet<SkillArea> SkillAreas { get; set; }
    public DbSet<PlayerCertificationRequest> PlayerCertificationRequests { get; set; }
    public DbSet<PlayerCertificationReview> PlayerCertificationReviews { get; set; }
    public DbSet<PlayerCertificationScore> PlayerCertificationScores { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            // UserId comes from shared auth service - not auto-generated
            entity.Property(u => u.Id).ValueGeneratedNever();
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.Role).HasConversion<string>();
        });

        modelBuilder.Entity<TrainingMaterial>(entity =>
        {
            entity.HasOne(tm => tm.Coach)
                  .WithMany(u => u.TrainingMaterials)
                  .HasForeignKey(tm => tm.CoachId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.Property(tm => tm.ContentType).HasConversion<string>();
        });

        modelBuilder.Entity<TrainingSession>(entity =>
        {
            entity.Property(ts => ts.SessionType).HasConversion<string>();
            entity.Property(ts => ts.Status).HasConversion<string>();

            entity.HasOne(ts => ts.Coach)
                  .WithMany(u => u.CoachingSessions)
                  .HasForeignKey(ts => ts.CoachId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(ts => ts.Student)
                  .WithMany(u => u.StudentSessions)
                  .HasForeignKey(ts => ts.StudentId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<MaterialPurchase>(entity =>
        {
            entity.HasOne(mp => mp.Student)
                  .WithMany(u => u.MaterialPurchases)
                  .HasForeignKey(mp => mp.StudentId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(mp => mp.Material)
                  .WithMany(tm => tm.Purchases)
                  .HasForeignKey(mp => mp.MaterialId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<CoachProfile>(entity =>
        {
            entity.HasOne(cp => cp.User)
                  .WithOne(u => u.CoachProfile)
                  .HasForeignKey<CoachProfile>(cp => cp.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Course configuration
        modelBuilder.Entity<Course>(entity =>
        {
            entity.HasOne(c => c.Coach)
                  .WithMany()
                  .HasForeignKey(c => c.CoachId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.Property(c => c.Title).IsRequired().HasMaxLength(200);
            entity.Property(c => c.Description).HasMaxLength(2000);
        });

        modelBuilder.Entity<CourseMaterial>(entity =>
        {
            entity.HasOne(cm => cm.Course)
                  .WithMany(c => c.CourseMaterials)
                  .HasForeignKey(cm => cm.CourseId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(cm => cm.Material)
                  .WithMany(m => m.CourseMaterials)
                  .HasForeignKey(cm => cm.MaterialId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(cm => new { cm.CourseId, cm.MaterialId }).IsUnique();
        });

        modelBuilder.Entity<CoursePurchase>(entity =>
        {
            entity.HasOne(cp => cp.Course)
                  .WithMany(c => c.Purchases)
                  .HasForeignKey(cp => cp.CourseId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(cp => cp.Student)
                  .WithMany()
                  .HasForeignKey(cp => cp.StudentId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(cp => new { cp.CourseId, cp.StudentId }).IsUnique();
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

        // VideoReviewRequest configuration
        modelBuilder.Entity<VideoReviewRequest>(entity =>
        {
            entity.HasOne(v => v.Student)
                  .WithMany()
                  .HasForeignKey(v => v.StudentId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(v => v.TargetCoach)
                  .WithMany()
                  .HasForeignKey(v => v.CoachId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(v => v.AcceptedByCoach)
                  .WithMany()
                  .HasForeignKey(v => v.AcceptedByCoachId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.Property(v => v.Title).IsRequired().HasMaxLength(200);
            entity.Property(v => v.VideoUrl).IsRequired().HasMaxLength(500);
            entity.Property(v => v.Status).IsRequired().HasMaxLength(50);

            // Index for finding open requests
            entity.HasIndex(v => v.Status);
            entity.HasIndex(v => v.StudentId);
            entity.HasIndex(v => v.CoachId);
        });

        // BlogPost configuration
        modelBuilder.Entity<BlogPost>(entity =>
        {
            entity.HasOne(b => b.Author)
                  .WithMany()
                  .HasForeignKey(b => b.AuthorId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.Property(b => b.Title).IsRequired().HasMaxLength(200);
            entity.Property(b => b.Slug).IsRequired().HasMaxLength(500);
            entity.Property(b => b.Content).IsRequired();

            entity.HasIndex(b => b.Slug).IsUnique();
            entity.HasIndex(b => b.AuthorId);
            entity.HasIndex(b => b.IsPublished);
            entity.HasIndex(b => b.PublishedAt);
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
    }
}
