-- Migration 091: User Social Media Links
-- Allows users to link multiple social media profiles

PRINT 'Migration 091: Creating UserSocialLinks table...'

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserSocialLinks')
BEGIN
    CREATE TABLE UserSocialLinks (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        Platform NVARCHAR(50) NOT NULL,  -- Twitter, Instagram, Facebook, LinkedIn, YouTube, TikTok, Website, Other
        Url NVARCHAR(500) NOT NULL,
        DisplayName NVARCHAR(100) NULL,  -- Optional custom display name
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_UserSocialLinks_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
    )
    PRINT 'Created UserSocialLinks table'

    -- Index for efficient user lookup
    CREATE INDEX IX_UserSocialLinks_UserId ON UserSocialLinks(UserId)
    PRINT 'Created index on UserId'

    -- Index for sorting
    CREATE INDEX IX_UserSocialLinks_SortOrder ON UserSocialLinks(UserId, SortOrder)
    PRINT 'Created index on SortOrder'

    -- Unique constraint: one link per platform per user
    CREATE UNIQUE INDEX IX_UserSocialLinks_UserPlatform ON UserSocialLinks(UserId, Platform) WHERE IsActive = 1
    PRINT 'Created unique index on UserId + Platform for active links'
END
ELSE
BEGIN
    PRINT 'UserSocialLinks table already exists'
END

PRINT 'Migration 091 completed successfully'
