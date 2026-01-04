-- Migration 033: Blog System
-- Creates tables for blog categories, posts, and comments

PRINT 'Starting Migration 033: Blog System'

-- Add CanWriteBlog column to Users table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'CanWriteBlog')
BEGIN
    ALTER TABLE Users ADD CanWriteBlog BIT NOT NULL DEFAULT 0;
    PRINT 'Added CanWriteBlog column to Users table'
END
ELSE
    PRINT 'CanWriteBlog column already exists'

-- Create BlogCategories table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BlogCategories')
BEGIN
    CREATE TABLE BlogCategories (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Slug NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        SortOrder INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NULL
    );

    CREATE UNIQUE INDEX IX_BlogCategories_Slug ON BlogCategories(Slug);
    CREATE INDEX IX_BlogCategories_SortOrder ON BlogCategories(SortOrder);

    PRINT 'Created BlogCategories table'
END
ELSE
    PRINT 'BlogCategories table already exists'

-- Create BlogPosts table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BlogPosts')
BEGIN
    CREATE TABLE BlogPosts (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Title NVARCHAR(200) NOT NULL,
        Slug NVARCHAR(200) NOT NULL,
        Excerpt NVARCHAR(500) NULL,
        Content NVARCHAR(MAX) NOT NULL,
        FeaturedImageUrl NVARCHAR(500) NULL,
        AuthorId INT NOT NULL,
        CategoryId INT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'Draft',
        PublishedAt DATETIME2 NULL,
        ViewCount INT NOT NULL DEFAULT 0,
        AllowComments BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NULL,
        CONSTRAINT FK_BlogPosts_Author FOREIGN KEY (AuthorId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT FK_BlogPosts_Category FOREIGN KEY (CategoryId) REFERENCES BlogCategories(Id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX IX_BlogPosts_Slug ON BlogPosts(Slug);
    CREATE INDEX IX_BlogPosts_Status ON BlogPosts(Status);
    CREATE INDEX IX_BlogPosts_PublishedAt ON BlogPosts(PublishedAt);
    CREATE INDEX IX_BlogPosts_AuthorId ON BlogPosts(AuthorId);
    CREATE INDEX IX_BlogPosts_CategoryId ON BlogPosts(CategoryId);

    PRINT 'Created BlogPosts table'
END
ELSE
    PRINT 'BlogPosts table already exists'

-- Create BlogComments table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BlogComments')
BEGIN
    CREATE TABLE BlogComments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        PostId INT NOT NULL,
        UserId INT NOT NULL,
        Content NVARCHAR(2000) NOT NULL,
        ParentId INT NULL,
        IsApproved BIT NOT NULL DEFAULT 1,
        IsDeleted BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NULL,
        CONSTRAINT FK_BlogComments_Post FOREIGN KEY (PostId) REFERENCES BlogPosts(Id) ON DELETE CASCADE,
        CONSTRAINT FK_BlogComments_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT FK_BlogComments_Parent FOREIGN KEY (ParentId) REFERENCES BlogComments(Id) ON DELETE NO ACTION
    );

    CREATE INDEX IX_BlogComments_PostId ON BlogComments(PostId);
    CREATE INDEX IX_BlogComments_UserId ON BlogComments(UserId);
    CREATE INDEX IX_BlogComments_CreatedAt ON BlogComments(CreatedAt);

    PRINT 'Created BlogComments table'
END
ELSE
    PRINT 'BlogComments table already exists'

-- Insert default blog category
IF NOT EXISTS (SELECT 1 FROM BlogCategories WHERE Slug = 'general')
BEGIN
    INSERT INTO BlogCategories (Name, Slug, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('General', 'general', 'General pickleball topics and news', 1, 1, GETUTCDATE());
    PRINT 'Inserted default General category'
END

PRINT 'Migration 033: Blog System completed'
