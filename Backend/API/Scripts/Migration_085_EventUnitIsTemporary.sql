-- Migration 085: Add IsTemporary to EventUnits
-- This allows tracking of temporary units created for ad-hoc games (popcorn/gauntlet scheduling)

PRINT 'Starting Migration 085: Add IsTemporary to EventUnits'

-- Add IsTemporary column to EventUnits table
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'EventUnits' AND COLUMN_NAME = 'IsTemporary'
)
BEGIN
    ALTER TABLE EventUnits ADD IsTemporary BIT NOT NULL DEFAULT 0;
    PRINT 'Added IsTemporary column to EventUnits table'
END
ELSE
BEGIN
    PRINT 'IsTemporary column already exists in EventUnits table'
END

PRINT 'Migration 085 completed successfully'
GO
