-- Migration Script: Add Blog Posts Support
-- Date: 2025-12-14
-- Description: Creates BlogPosts table for coach blogging feature

USE PickleballCollege;
GO

PRINT 'Starting Migration_012_BlogPosts...';
PRINT '';

-- =============================================
-- STEP 1: Create BlogPosts table
-- =============================================
PRINT 'Creating BlogPosts table...';

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('BlogPosts') AND type = 'U')
BEGIN
    CREATE TABLE BlogPosts (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Title NVARCHAR(200) NOT NULL,
        Slug NVARCHAR(500) NOT NULL,
        Summary NVARCHAR(500) NULL,
        Content NVARCHAR(MAX) NOT NULL,
        FeaturedImageUrl NVARCHAR(500) NULL,
        Category NVARCHAR(100) NULL,
        Tags NVARCHAR(500) NULL,
        AuthorId INT NOT NULL,
        IsPublished BIT NOT NULL DEFAULT 0,
        PublishedAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        ViewCount INT NOT NULL DEFAULT 0,

        CONSTRAINT FK_BlogPosts_Author FOREIGN KEY (AuthorId)
            REFERENCES Users(Id) ON DELETE NO ACTION
    );
    PRINT '  Created BlogPosts table';
END
ELSE
BEGIN
    PRINT '  BlogPosts table already exists';
END
GO

-- =============================================
-- STEP 2: Create indexes
-- =============================================
PRINT '';
PRINT 'Creating indexes...';

-- Unique index on Slug
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_BlogPosts_Slug' AND object_id = OBJECT_ID('BlogPosts'))
BEGIN
    CREATE UNIQUE INDEX IX_BlogPosts_Slug ON BlogPosts(Slug);
    PRINT '  Created unique index on Slug';
END
ELSE
BEGIN
    PRINT '  Index IX_BlogPosts_Slug already exists';
END

-- Index on AuthorId
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_BlogPosts_AuthorId' AND object_id = OBJECT_ID('BlogPosts'))
BEGIN
    CREATE INDEX IX_BlogPosts_AuthorId ON BlogPosts(AuthorId);
    PRINT '  Created index on AuthorId';
END
ELSE
BEGIN
    PRINT '  Index IX_BlogPosts_AuthorId already exists';
END

-- Index on IsPublished
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_BlogPosts_IsPublished' AND object_id = OBJECT_ID('BlogPosts'))
BEGIN
    CREATE INDEX IX_BlogPosts_IsPublished ON BlogPosts(IsPublished);
    PRINT '  Created index on IsPublished';
END
ELSE
BEGIN
    PRINT '  Index IX_BlogPosts_IsPublished already exists';
END

-- Index on PublishedAt
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_BlogPosts_PublishedAt' AND object_id = OBJECT_ID('BlogPosts'))
BEGIN
    CREATE INDEX IX_BlogPosts_PublishedAt ON BlogPosts(PublishedAt);
    PRINT '  Created index on PublishedAt';
END
ELSE
BEGIN
    PRINT '  Index IX_BlogPosts_PublishedAt already exists';
END

-- Index on Category
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_BlogPosts_Category' AND object_id = OBJECT_ID('BlogPosts'))
BEGIN
    CREATE INDEX IX_BlogPosts_Category ON BlogPosts(Category);
    PRINT '  Created index on Category';
END
ELSE
BEGIN
    PRINT '  Index IX_BlogPosts_Category already exists';
END
GO

-- =============================================
-- STEP 3: Verify changes
-- =============================================
PRINT '';
PRINT 'Verifying changes...';

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('BlogPosts') AND type = 'U')
    PRINT '  BlogPosts table exists';
ELSE
    PRINT '  ERROR: BlogPosts table NOT found';

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_BlogPosts_Slug' AND object_id = OBJECT_ID('BlogPosts'))
    PRINT '  IX_BlogPosts_Slug index exists';
ELSE
    PRINT '  ERROR: IX_BlogPosts_Slug index NOT found';

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_BlogPosts_AuthorId' AND object_id = OBJECT_ID('BlogPosts'))
    PRINT '  IX_BlogPosts_AuthorId index exists';
ELSE
    PRINT '  ERROR: IX_BlogPosts_AuthorId index NOT found';

PRINT '';
PRINT 'Migration_012_BlogPosts completed.';
GO
