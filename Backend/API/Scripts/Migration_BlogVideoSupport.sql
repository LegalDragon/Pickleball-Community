-- Migration: Add Video Support to Blog Posts (Vlog Feature)
-- Date: 2026-02-12

-- Add PostType column (0 = Blog, 1 = Vlog)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'BlogPosts') AND name = 'PostType')
BEGIN
    ALTER TABLE BlogPosts ADD PostType INT NOT NULL DEFAULT 0;
    PRINT 'Added PostType column to BlogPosts';
END

-- Add VideoUrl column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'BlogPosts') AND name = 'VideoUrl')
BEGIN
    ALTER TABLE BlogPosts ADD VideoUrl NVARCHAR(500) NULL;
    PRINT 'Added VideoUrl column to BlogPosts';
END

-- Add VideoAssetId column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'BlogPosts') AND name = 'VideoAssetId')
BEGIN
    ALTER TABLE BlogPosts ADD VideoAssetId INT NULL;
    PRINT 'Added VideoAssetId column to BlogPosts';
END

-- Create index for filtering by PostType
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_BlogPosts_PostType')
BEGIN
    CREATE NONCLUSTERED INDEX IX_BlogPosts_PostType ON BlogPosts(PostType);
    PRINT 'Created index IX_BlogPosts_PostType';
END

PRINT 'Blog Video Support migration completed';
