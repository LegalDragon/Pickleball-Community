-- Migration: Add timing columns to DivisionPhases for court scheduling
-- These columns support the PhaseCourtScheduler component

PRINT 'Adding timing columns to DivisionPhases...'

-- GameDurationMinutes: Estimated duration of each game in minutes
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DivisionPhases') AND name = 'GameDurationMinutes')
BEGIN
    ALTER TABLE DivisionPhases ADD GameDurationMinutes INT NULL;
    PRINT 'Added GameDurationMinutes column'
END

-- ChangeoverMinutes: Time between games on the same court
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DivisionPhases') AND name = 'ChangeoverMinutes')
BEGIN
    ALTER TABLE DivisionPhases ADD ChangeoverMinutes INT NOT NULL DEFAULT 2;
    PRINT 'Added ChangeoverMinutes column'
END

-- MatchBufferMinutes: Buffer time between matches
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DivisionPhases') AND name = 'MatchBufferMinutes')
BEGIN
    ALTER TABLE DivisionPhases ADD MatchBufferMinutes INT NOT NULL DEFAULT 5;
    PRINT 'Added MatchBufferMinutes column'
END

PRINT 'Migration complete'
