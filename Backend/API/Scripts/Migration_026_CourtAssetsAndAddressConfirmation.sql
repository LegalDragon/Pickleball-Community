-- Migration 026: Court Assets and Address Confirmation
-- Adds ability to confirm court address and upload images/videos

PRINT 'Starting Migration 026: Court Assets and Address Confirmation';
GO

-- Add address confirmation fields to CourtConfirmations
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CourtConfirmations') AND name = 'ConfirmedAddress')
BEGIN
    PRINT 'Adding address confirmation fields to CourtConfirmations...';
    ALTER TABLE CourtConfirmations ADD ConfirmedAddress NVARCHAR(200) NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CourtConfirmations') AND name = 'ConfirmedCity')
BEGIN
    ALTER TABLE CourtConfirmations ADD ConfirmedCity NVARCHAR(100) NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CourtConfirmations') AND name = 'ConfirmedState')
BEGIN
    ALTER TABLE CourtConfirmations ADD ConfirmedState NVARCHAR(100) NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CourtConfirmations') AND name = 'ConfirmedCountry')
BEGIN
    ALTER TABLE CourtConfirmations ADD ConfirmedCountry NVARCHAR(100) NULL;
END
GO

PRINT 'Address confirmation fields added to CourtConfirmations.';

-- Create CourtAssets table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CourtAssets')
BEGIN
    PRINT 'Creating CourtAssets table...';
    CREATE TABLE CourtAssets (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CourtId INT NOT NULL,
        UserId INT NOT NULL,
        AssetType NVARCHAR(20) NOT NULL, -- 'image' or 'video'
        AssetUrl NVARCHAR(500) NOT NULL,
        ThumbnailUrl NVARCHAR(500) NULL,
        Description NVARCHAR(500) NULL,
        Width INT NULL,
        Height INT NULL,
        FileSizeBytes BIGINT NULL,
        MimeType NVARCHAR(100) NULL,
        IsApproved BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_CourtAssets_Courts FOREIGN KEY (CourtId) REFERENCES Courts(Id) ON DELETE CASCADE,
        CONSTRAINT FK_CourtAssets_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
    );

    CREATE INDEX IX_CourtAssets_CourtId ON CourtAssets(CourtId);
    CREATE INDEX IX_CourtAssets_UserId ON CourtAssets(UserId);
    CREATE INDEX IX_CourtAssets_CreatedAt ON CourtAssets(CreatedAt DESC);

    PRINT 'CourtAssets table created.';
END
GO

-- Create CourtAssetLikes table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CourtAssetLikes')
BEGIN
    PRINT 'Creating CourtAssetLikes table...';
    CREATE TABLE CourtAssetLikes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        AssetId INT NOT NULL,
        UserId INT NOT NULL,
        IsLike BIT NOT NULL, -- 1 = like, 0 = dislike
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_CourtAssetLikes_Assets FOREIGN KEY (AssetId) REFERENCES CourtAssets(Id) ON DELETE CASCADE,
        CONSTRAINT FK_CourtAssetLikes_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE NO ACTION,
        CONSTRAINT UQ_CourtAssetLikes_Asset_User UNIQUE (AssetId, UserId)
    );

    CREATE INDEX IX_CourtAssetLikes_AssetId ON CourtAssetLikes(AssetId);
    CREATE INDEX IX_CourtAssetLikes_UserId ON CourtAssetLikes(UserId);

    PRINT 'CourtAssetLikes table created.';
END
GO

PRINT 'Migration 026 completed successfully.';
GO
