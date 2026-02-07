-- Migration: Add scheduling columns to EventGames and EventEncounters
-- Run this on production database

-- Add columns to EventGames
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventGames') AND name = 'ScheduledStartTime')
BEGIN
    ALTER TABLE EventGames ADD ScheduledStartTime DATETIME2 NULL;
    PRINT 'Added ScheduledStartTime to EventGames';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventGames') AND name = 'ScheduledEndTime')
BEGIN
    ALTER TABLE EventGames ADD ScheduledEndTime DATETIME2 NULL;
    PRINT 'Added ScheduledEndTime to EventGames';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventGames') AND name = 'EstimatedDurationMinutes')
BEGIN
    ALTER TABLE EventGames ADD EstimatedDurationMinutes INT NULL;
    PRINT 'Added EstimatedDurationMinutes to EventGames';
END

-- Add column to EventEncounters
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'EstimatedDurationMinutes')
BEGIN
    ALTER TABLE EventEncounters ADD EstimatedDurationMinutes INT NULL;
    PRINT 'Added EstimatedDurationMinutes to EventEncounters';
END

PRINT 'Migration complete';
