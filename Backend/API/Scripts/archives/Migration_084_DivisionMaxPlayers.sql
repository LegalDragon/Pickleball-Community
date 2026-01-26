-- Migration 084: Add MaxPlayers to EventDivisions
-- This allows organizers to set a max player count independent of team units (useful for incomplete teams)

PRINT 'Starting Migration 084: Add MaxPlayers to EventDivisions'

-- Add MaxPlayers column to EventDivisions table
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'EventDivisions' AND COLUMN_NAME = 'MaxPlayers'
)
BEGIN
    ALTER TABLE EventDivisions ADD MaxPlayers INT NULL;
    PRINT 'Added MaxPlayers column to EventDivisions table'
END
ELSE
BEGIN
    PRINT 'MaxPlayers column already exists in EventDivisions table'
END

PRINT 'Migration 084 completed successfully'
GO
