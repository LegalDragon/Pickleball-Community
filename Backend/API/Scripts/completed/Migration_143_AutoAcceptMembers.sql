-- Migration 143: Add AutoAcceptMembers to EventUnits
-- Allows captains to enable auto-acceptance of join requests
-- Date: 2026-01-29

PRINT 'Starting Migration 143: AutoAcceptMembers';

-- Add AutoAcceptMembers column to EventUnits
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('EventUnits') AND name = 'AutoAcceptMembers'
)
BEGIN
    ALTER TABLE EventUnits
    ADD AutoAcceptMembers BIT NOT NULL DEFAULT 0;
    PRINT 'Added AutoAcceptMembers column to EventUnits';
END
ELSE
BEGIN
    PRINT 'AutoAcceptMembers column already exists on EventUnits';
END

PRINT 'Migration 143 completed';
GO
