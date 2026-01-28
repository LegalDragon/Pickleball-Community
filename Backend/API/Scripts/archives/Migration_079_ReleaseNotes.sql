-- Migration 079: Release Notes System
-- Allows admins to create release announcements that users can view and dismiss

PRINT 'Starting Migration 079: Release Notes System'

-- Create ReleaseNotes table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ReleaseNotes')
BEGIN
    CREATE TABLE ReleaseNotes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Version NVARCHAR(50) NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        ReleaseDate DATETIME NOT NULL DEFAULT GETDATE(),
        IsActive BIT NOT NULL DEFAULT 1,
        IsMajor BIT NOT NULL DEFAULT 0, -- Major releases are highlighted differently
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedByUserId INT NOT NULL,
        UpdatedAt DATETIME NULL,
        UpdatedByUserId INT NULL,

        CONSTRAINT FK_ReleaseNotes_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id),
        CONSTRAINT FK_ReleaseNotes_UpdatedBy FOREIGN KEY (UpdatedByUserId) REFERENCES Users(Id)
    )

    PRINT 'Created ReleaseNotes table'
END
ELSE
BEGIN
    PRINT 'ReleaseNotes table already exists'
END

-- Create UserDismissedReleases table to track which users have dismissed which releases
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'UserDismissedReleases')
BEGIN
    CREATE TABLE UserDismissedReleases (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        ReleaseNoteId INT NOT NULL,
        DismissedAt DATETIME NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_UserDismissedReleases_User FOREIGN KEY (UserId) REFERENCES Users(Id),
        CONSTRAINT FK_UserDismissedReleases_Release FOREIGN KEY (ReleaseNoteId) REFERENCES ReleaseNotes(Id),
        CONSTRAINT UQ_UserDismissedReleases UNIQUE (UserId, ReleaseNoteId)
    )

    PRINT 'Created UserDismissedReleases table'
END
ELSE
BEGIN
    PRINT 'UserDismissedReleases table already exists'
END

-- Create index for faster lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReleaseNotes_ReleaseDate')
BEGIN
    CREATE INDEX IX_ReleaseNotes_ReleaseDate ON ReleaseNotes(ReleaseDate DESC)
    PRINT 'Created index IX_ReleaseNotes_ReleaseDate'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReleaseNotes_IsActive')
BEGIN
    CREATE INDEX IX_ReleaseNotes_IsActive ON ReleaseNotes(IsActive) WHERE IsActive = 1
    PRINT 'Created index IX_ReleaseNotes_IsActive'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserDismissedReleases_UserId')
BEGIN
    CREATE INDEX IX_UserDismissedReleases_UserId ON UserDismissedReleases(UserId)
    PRINT 'Created index IX_UserDismissedReleases_UserId'
END

PRINT 'Migration 079 completed successfully'
