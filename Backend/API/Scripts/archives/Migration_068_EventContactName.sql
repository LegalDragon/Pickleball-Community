-- Migration 068: Add ContactName column to Events table
-- Adds contact person name for events

PRINT 'Starting Migration 068: Event ContactName';

-- Add ContactName column to Events table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'ContactName')
BEGIN
    ALTER TABLE Events ADD ContactName NVARCHAR(100) NULL;
    PRINT 'Added ContactName column to Events table';
END
ELSE
BEGIN
    PRINT 'ContactName column already exists in Events table';
END

PRINT 'Migration 068 completed successfully';
