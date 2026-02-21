-- Migration 149: Add LastActiveAt column to Users table
-- Tracks when users were last active (via SignalR connection)

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'LastActiveAt'
)
BEGIN
    ALTER TABLE Users ADD LastActiveAt DATETIME2 NULL;
    PRINT 'Added LastActiveAt column to Users table';
END
ELSE
BEGIN
    PRINT 'LastActiveAt column already exists on Users table';
END
GO

-- Index for querying/sorting by last active time
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_LastActiveAt' AND object_id = OBJECT_ID('Users'))
BEGIN
    CREATE INDEX IX_Users_LastActiveAt ON Users (LastActiveAt DESC) WHERE LastActiveAt IS NOT NULL;
    PRINT 'Created index IX_Users_LastActiveAt';
END
GO
