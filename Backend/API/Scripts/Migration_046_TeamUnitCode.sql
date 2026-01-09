-- Migration 046: Add UnitCode column to TeamUnits table
-- This adds a short code field for team units (e.g., "MD" for Men's Doubles, "WS" for Women's Singles)

PRINT 'Starting Migration 046: TeamUnit UnitCode'

-- Add UnitCode column to TeamUnits
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TeamUnits') AND name = 'UnitCode')
BEGIN
    ALTER TABLE TeamUnits ADD UnitCode NVARCHAR(20) NULL
    PRINT 'Added UnitCode column to TeamUnits'
END
ELSE
BEGIN
    PRINT 'UnitCode column already exists in TeamUnits'
END

PRINT 'Migration 046 completed successfully'
