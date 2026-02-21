-- Migration Script: Add Assets Table for File Management
-- Date: 2025-12-09
-- Description: Creates the Assets table for tracking uploaded files with database-backed asset management

USE PickleballCommunity;
GO

-- =============================================
-- STEP 1: Check if Assets table already exists
-- =============================================
IF OBJECT_ID('Assets', 'U') IS NOT NULL
BEGIN
    PRINT 'Assets table already exists. Skipping creation.';
END
ELSE
BEGIN
    -- =============================================
    -- STEP 2: Create Assets Table
    -- =============================================
    PRINT 'Creating Assets table...';

    CREATE TABLE Assets (
        FileId INT IDENTITY(1,1) PRIMARY KEY,

        -- File information
        FileName NVARCHAR(255) NOT NULL,
        OriginalFileName NVARCHAR(255) NULL,
        ContentType NVARCHAR(100) NULL,
        FileSize BIGINT NOT NULL DEFAULT 0,

        -- Storage information
        StorageProvider NVARCHAR(50) NOT NULL DEFAULT 'local',
        StoragePath NVARCHAR(500) NOT NULL,
        Folder NVARCHAR(100) NOT NULL DEFAULT '',

        -- Object association (for linking assets to entities)
        ObjectType NVARCHAR(100) NULL,
        ObjectId INT NULL,

        -- Audit fields
        UploadedBy INT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        -- Soft delete
        IsDeleted BIT NOT NULL DEFAULT 0,

        -- Foreign key to Users (optional - allows NULL for system uploads)
        CONSTRAINT FK_Assets_Users FOREIGN KEY (UploadedBy) REFERENCES Users(Id) ON DELETE SET NULL
    );

    PRINT 'Assets table created successfully.';

    -- =============================================
    -- STEP 3: Create Indexes for Performance
    -- =============================================
    PRINT 'Creating indexes on Assets table...';

    -- Index for looking up assets by object association
    CREATE INDEX IX_Assets_ObjectType_ObjectId ON Assets(ObjectType, ObjectId) WHERE ObjectType IS NOT NULL;

    -- Index for looking up assets by folder
    CREATE INDEX IX_Assets_Folder ON Assets(Folder);

    -- Index for looking up non-deleted assets
    CREATE INDEX IX_Assets_IsDeleted ON Assets(IsDeleted);

    -- Index for looking up assets by uploader
    CREATE INDEX IX_Assets_UploadedBy ON Assets(UploadedBy) WHERE UploadedBy IS NOT NULL;

    -- Index for looking up assets by creation date
    CREATE INDEX IX_Assets_CreatedAt ON Assets(CreatedAt);

    -- Index for storage provider queries
    CREATE INDEX IX_Assets_StorageProvider ON Assets(StorageProvider);

    PRINT 'Indexes created successfully.';
END
GO

PRINT 'Migration 002 (Assets) completed successfully!';
GO
