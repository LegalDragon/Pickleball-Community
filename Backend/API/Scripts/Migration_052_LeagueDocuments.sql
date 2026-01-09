-- Migration: Add LeagueDocuments table for league document attachments
-- Date: 2026-01-05

PRINT 'Starting Migration_052_LeagueDocuments...';

-- Create LeagueDocuments table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LeagueDocuments')
BEGIN
    CREATE TABLE LeagueDocuments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        LeagueId INT NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Description NVARCHAR(1000) NULL,
        FileUrl NVARCHAR(500) NOT NULL,
        FileName NVARCHAR(255) NULL,
        FileType NVARCHAR(100) NULL,
        FileSize BIGINT NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsPublic BIT NOT NULL DEFAULT 1,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UploadedByUserId INT NULL,

        CONSTRAINT FK_LeagueDocuments_Leagues FOREIGN KEY (LeagueId)
            REFERENCES Leagues(Id) ON DELETE CASCADE,
        CONSTRAINT FK_LeagueDocuments_Users FOREIGN KEY (UploadedByUserId)
            REFERENCES Users(Id) ON DELETE SET NULL
    );

    PRINT 'Created LeagueDocuments table';

    -- Add indexes
    CREATE INDEX IX_LeagueDocuments_LeagueId ON LeagueDocuments(LeagueId);
    CREATE INDEX IX_LeagueDocuments_SortOrder ON LeagueDocuments(LeagueId, SortOrder);

    PRINT 'Created indexes for LeagueDocuments';
END
ELSE
BEGIN
    PRINT 'LeagueDocuments table already exists';
END

PRINT 'Migration_052_LeagueDocuments completed successfully';
