-- Migration 154: Add scheduled times to EventGames for gameday progress tracking
-- Date: 2026-02-06
-- Purpose: Enable per-game scheduling and planned vs actual time comparison

-- Add scheduled time fields to EventGames
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

PRINT 'Migration 154 completed - GameScheduledTimes';
