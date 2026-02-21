-- Migration 130: Cities Table
-- Creates a Cities table linked to ProvinceStates for dynamic city autocomplete
-- Cities are added automatically when users enter new city names

PRINT 'Starting Migration 130: Cities Table';

-- Create Cities table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Cities')
BEGIN
    CREATE TABLE Cities (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ProvinceStateId INT NOT NULL,
        Name NVARCHAR(200) NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CreatedByUserId INT NULL,
        CONSTRAINT FK_Cities_ProvinceStates FOREIGN KEY (ProvinceStateId)
            REFERENCES ProvinceStates(Id) ON DELETE CASCADE,
        CONSTRAINT FK_Cities_Users FOREIGN KEY (CreatedByUserId)
            REFERENCES Users(Id) ON DELETE SET NULL
    );
    PRINT 'Created Cities table';

    -- Create indexes for performance
    CREATE INDEX IX_Cities_ProvinceStateId ON Cities(ProvinceStateId);
    CREATE INDEX IX_Cities_Name ON Cities(Name);
    CREATE UNIQUE INDEX IX_Cities_ProvinceStateId_Name ON Cities(ProvinceStateId, Name)
        WHERE IsActive = 1;
    PRINT 'Created indexes on Cities table';
END
ELSE
BEGIN
    PRINT 'Cities table already exists';
END

PRINT 'Migration 130 completed successfully';
