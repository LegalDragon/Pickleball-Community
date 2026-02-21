-- Migration 066: Event Documents
-- Allows admins to attach documents to events with title, privacy setting, and sort order

PRINT 'Starting Migration 066: Event Documents';

-- Create EventDocuments table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EventDocuments')
BEGIN
    CREATE TABLE EventDocuments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventId INT NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        FileUrl NVARCHAR(500) NOT NULL,
        FileName NVARCHAR(200) NOT NULL,
        FileType NVARCHAR(50) NULL,
        FileSize INT NULL,
        IsPublic BIT NOT NULL DEFAULT 1,
        SortOrder INT NOT NULL DEFAULT 0,
        UploadedByUserId INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NULL,
        CONSTRAINT FK_EventDocuments_Events FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EventDocuments_Users FOREIGN KEY (UploadedByUserId) REFERENCES Users(Id)
    );
    PRINT 'Created EventDocuments table';

    -- Create indexes
    CREATE INDEX IX_EventDocuments_EventId ON EventDocuments(EventId);
    CREATE INDEX IX_EventDocuments_EventId_IsPublic ON EventDocuments(EventId, IsPublic);
    PRINT 'Created indexes on EventDocuments';
END
ELSE
BEGIN
    PRINT 'EventDocuments table already exists';
END

PRINT 'Migration 066 completed successfully';
