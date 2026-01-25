-- Migration 131: Add HasCustomName flag for EventUnits
-- Tracks whether captain has set a custom team name
-- For pairs (size=2): if false, display name is computed from member first names

PRINT 'Migration 131: Adding HasCustomName column to EventUnits'

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnits') AND name = 'HasCustomName')
BEGIN
    ALTER TABLE EventUnits ADD HasCustomName BIT NOT NULL DEFAULT 0;
    PRINT 'Added HasCustomName column to EventUnits'
END
ELSE
BEGIN
    PRINT 'HasCustomName column already exists'
END

GO

PRINT 'Migration 131 completed successfully'
