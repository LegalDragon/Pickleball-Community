-- Migration 060: Create HeroVideos table for multiple hero videos
-- Allows admins to configure multiple hero videos with activation/deactivation

PRINT 'Starting Migration 060: HeroVideos'
GO

-- Create HeroVideos table
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'HeroVideos')
BEGIN
    CREATE TABLE HeroVideos (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ThemeId INT NOT NULL,
        VideoUrl NVARCHAR(500) NOT NULL,
        ThumbnailUrl NVARCHAR(500) NULL,
        Title NVARCHAR(200) NULL,
        Description NVARCHAR(500) NULL,
        VideoType NVARCHAR(50) NOT NULL DEFAULT 'upload',
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        DisplayDuration INT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CreatedBy INT NULL,
        UpdatedBy INT NULL,
        CONSTRAINT FK_HeroVideos_ThemeSettings FOREIGN KEY (ThemeId) REFERENCES ThemeSettings(ThemeId) ON DELETE CASCADE
    )
    PRINT 'Created HeroVideos table'
END
GO

-- Create index for faster lookups by theme
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_HeroVideos_ThemeId')
BEGIN
    CREATE INDEX IX_HeroVideos_ThemeId ON HeroVideos(ThemeId)
    PRINT 'Created index IX_HeroVideos_ThemeId'
END
GO

-- Create index for active videos sorted by order
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_HeroVideos_Active_SortOrder')
BEGIN
    CREATE INDEX IX_HeroVideos_Active_SortOrder ON HeroVideos(ThemeId, IsActive, SortOrder)
    PRINT 'Created index IX_HeroVideos_Active_SortOrder'
END
GO

-- Migrate existing hero video from ThemeSettings to HeroVideos table
-- This preserves any existing hero video configuration
IF EXISTS (SELECT 1 FROM ThemeSettings WHERE HeroVideoUrl IS NOT NULL AND HeroVideoUrl != '')
BEGIN
    INSERT INTO HeroVideos (ThemeId, VideoUrl, ThumbnailUrl, VideoType, SortOrder, IsActive, CreatedAt, UpdatedAt)
    SELECT
        ThemeId,
        HeroVideoUrl,
        HeroVideoThumbnailUrl,
        CASE
            WHEN HeroVideoUrl LIKE '%youtube.com%' OR HeroVideoUrl LIKE '%youtu.be%' THEN 'youtube'
            WHEN HeroVideoUrl LIKE 'http%' THEN 'external'
            ELSE 'upload'
        END,
        0,
        1,
        GETUTCDATE(),
        GETUTCDATE()
    FROM ThemeSettings
    WHERE HeroVideoUrl IS NOT NULL AND HeroVideoUrl != ''
    AND NOT EXISTS (SELECT 1 FROM HeroVideos WHERE ThemeId = ThemeSettings.ThemeId)

    PRINT 'Migrated existing hero videos from ThemeSettings'
END
GO

PRINT 'Completed Migration 060: HeroVideos'
GO
