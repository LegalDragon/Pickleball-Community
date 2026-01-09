-- Migration 063: Add AllowMultipleDivisions column to Events table
-- This allows per-event control of whether players can register for multiple divisions

PRINT 'Starting Migration 063: Event AllowMultipleDivisions...'

-- Add AllowMultipleDivisions column to Events table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'AllowMultipleDivisions')
BEGIN
    ALTER TABLE Events ADD AllowMultipleDivisions BIT NOT NULL DEFAULT 1
    PRINT 'Added AllowMultipleDivisions column to Events table'
END
ELSE
BEGIN
    PRINT 'AllowMultipleDivisions column already exists in Events table'
END

PRINT 'Migration 063 completed successfully'
