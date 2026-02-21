-- Migration 132: Lineup Locking for Encounters
-- Adds fields to track when each unit has locked their lineup for an encounter
-- Lineup visibility rules: regular users only see lineups when both units have locked

PRINT 'Starting Migration 132: Lineup Locking'

-- Add lineup locking fields to EventEncounters
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'Unit1LineupLocked')
BEGIN
    ALTER TABLE EventEncounters ADD Unit1LineupLocked BIT NOT NULL DEFAULT 0
    PRINT 'Added Unit1LineupLocked column'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'Unit2LineupLocked')
BEGIN
    ALTER TABLE EventEncounters ADD Unit2LineupLocked BIT NOT NULL DEFAULT 0
    PRINT 'Added Unit2LineupLocked column'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'Unit1LineupLockedAt')
BEGIN
    ALTER TABLE EventEncounters ADD Unit1LineupLockedAt DATETIME2 NULL
    PRINT 'Added Unit1LineupLockedAt column'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'Unit2LineupLockedAt')
BEGIN
    ALTER TABLE EventEncounters ADD Unit2LineupLockedAt DATETIME2 NULL
    PRINT 'Added Unit2LineupLockedAt column'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'Unit1LineupLockedByUserId')
BEGIN
    ALTER TABLE EventEncounters ADD Unit1LineupLockedByUserId INT NULL
    PRINT 'Added Unit1LineupLockedByUserId column'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'Unit2LineupLockedByUserId')
BEGIN
    ALTER TABLE EventEncounters ADD Unit2LineupLockedByUserId INT NULL
    PRINT 'Added Unit2LineupLockedByUserId column'
END

PRINT 'Migration 132 completed successfully'
GO
