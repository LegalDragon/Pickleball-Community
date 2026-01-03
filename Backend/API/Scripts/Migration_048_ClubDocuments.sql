-- Migration 048: Club Documents
-- Allows club admins to upload and manage documents for club members

PRINT 'Starting Migration 048: Club Documents'

-- Create ClubDocuments table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ClubDocuments')
BEGIN
    CREATE TABLE ClubDocuments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ClubId INT NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Description NVARCHAR(1000) NULL,
        FileUrl NVARCHAR(500) NOT NULL,
        FileName NVARCHAR(255) NULL,
        FileType NVARCHAR(20) NOT NULL DEFAULT 'Other',
        MimeType NVARCHAR(100) NULL,
        FileSizeBytes BIGINT NULL,
        Visibility NVARCHAR(20) NOT NULL DEFAULT 'Member',
        SortOrder INT NOT NULL DEFAULT 0,
        UploadedByUserId INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        IsActive BIT NOT NULL DEFAULT 1,
        CONSTRAINT FK_ClubDocuments_Club FOREIGN KEY (ClubId) REFERENCES Clubs(Id),
        CONSTRAINT FK_ClubDocuments_User FOREIGN KEY (UploadedByUserId) REFERENCES Users(Id)
    )
    PRINT 'Created ClubDocuments table'
END
ELSE
BEGIN
    PRINT 'ClubDocuments table already exists'
END

-- Create index on ClubId for faster lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ClubDocuments_ClubId')
BEGIN
    CREATE INDEX IX_ClubDocuments_ClubId ON ClubDocuments(ClubId)
    PRINT 'Created index IX_ClubDocuments_ClubId'
END

-- Create index on Visibility for filtering
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ClubDocuments_Visibility')
BEGIN
    CREATE INDEX IX_ClubDocuments_Visibility ON ClubDocuments(ClubId, Visibility, IsActive)
    PRINT 'Created index IX_ClubDocuments_Visibility'
END

PRINT 'Migration 048 completed successfully'
