-- Migration_107_EncounterSystemColumns.sql
-- Adds missing columns to Encounter system tables
-- Must run after Migration_106_EncounterSystem.sql

PRINT 'Starting Migration 107 - Encounter System Missing Columns';

-- =====================================================
-- PHASE 1: Add missing columns to EventEncounters
-- =====================================================
PRINT 'Adding missing columns to EventEncounters...';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'EncounterNumber')
BEGIN
    ALTER TABLE EventEncounters ADD EncounterNumber INT NOT NULL DEFAULT 1;
    PRINT '  Added EncounterNumber column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'IsPlayoffQualifier')
BEGIN
    ALTER TABLE EventEncounters ADD IsPlayoffQualifier BIT NOT NULL DEFAULT 0;
    PRINT '  Added IsPlayoffQualifier column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'PlayoffAdvancePosition')
BEGIN
    ALTER TABLE EventEncounters ADD PlayoffAdvancePosition INT NULL;
    PRINT '  Added PlayoffAdvancePosition column';
END

-- =====================================================
-- PHASE 2: Add missing columns to EncounterMatchFormats
-- =====================================================
PRINT 'Adding missing columns to EncounterMatchFormats...';

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('EncounterMatchFormats') AND type = 'U')
BEGIN
    -- Rename MatchOrder to MatchNumber if needed
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatchFormats') AND name = 'MatchOrder')
       AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatchFormats') AND name = 'MatchNumber')
    BEGIN
        EXEC sp_rename 'EncounterMatchFormats.MatchOrder', 'MatchNumber', 'COLUMN';
        PRINT '  Renamed MatchOrder to MatchNumber';
    END

    -- Add MatchNumber if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatchFormats') AND name = 'MatchNumber')
    BEGIN
        ALTER TABLE EncounterMatchFormats ADD MatchNumber INT NOT NULL DEFAULT 1;
        PRINT '  Added MatchNumber column';
    END

    -- Rename GamesPerMatch to BestOf if needed
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatchFormats') AND name = 'GamesPerMatch')
       AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatchFormats') AND name = 'BestOf')
    BEGIN
        EXEC sp_rename 'EncounterMatchFormats.GamesPerMatch', 'BestOf', 'COLUMN';
        PRINT '  Renamed GamesPerMatch to BestOf';
    END

    -- Add BestOf if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatchFormats') AND name = 'BestOf')
    BEGIN
        ALTER TABLE EncounterMatchFormats ADD BestOf INT NOT NULL DEFAULT 1;
        PRINT '  Added BestOf column';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatchFormats') AND name = 'SortOrder')
    BEGIN
        ALTER TABLE EncounterMatchFormats ADD SortOrder INT NOT NULL DEFAULT 0;
        PRINT '  Added SortOrder column';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatchFormats') AND name = 'IsActive')
    BEGIN
        ALTER TABLE EncounterMatchFormats ADD IsActive BIT NOT NULL DEFAULT 1;
        PRINT '  Added IsActive column';
    END
END

-- =====================================================
-- PHASE 3: Add missing columns to EncounterMatches
-- =====================================================
PRINT 'Adding missing columns to EncounterMatches...';

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('EncounterMatches') AND type = 'U')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatches') AND name = 'TournamentCourtId')
    BEGIN
        ALTER TABLE EncounterMatches ADD TournamentCourtId INT NULL;
        PRINT '  Added TournamentCourtId column';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatches') AND name = 'ScoreSubmittedByUnitId')
    BEGIN
        ALTER TABLE EncounterMatches ADD ScoreSubmittedByUnitId INT NULL;
        PRINT '  Added ScoreSubmittedByUnitId column';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatches') AND name = 'ScoreSubmittedAt')
    BEGIN
        ALTER TABLE EncounterMatches ADD ScoreSubmittedAt DATETIME NULL;
        PRINT '  Added ScoreSubmittedAt column';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatches') AND name = 'ScoreConfirmedByUnitId')
    BEGIN
        ALTER TABLE EncounterMatches ADD ScoreConfirmedByUnitId INT NULL;
        PRINT '  Added ScoreConfirmedByUnitId column';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatches') AND name = 'ScoreConfirmedAt')
    BEGIN
        ALTER TABLE EncounterMatches ADD ScoreConfirmedAt DATETIME NULL;
        PRINT '  Added ScoreConfirmedAt column';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatches') AND name = 'ScoreDisputedAt')
    BEGIN
        ALTER TABLE EncounterMatches ADD ScoreDisputedAt DATETIME NULL;
        PRINT '  Added ScoreDisputedAt column';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatches') AND name = 'ScoreDisputeReason')
    BEGIN
        ALTER TABLE EncounterMatches ADD ScoreDisputeReason NVARCHAR(500) NULL;
        PRINT '  Added ScoreDisputeReason column';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatches') AND name = 'ScheduledTime')
    BEGIN
        ALTER TABLE EncounterMatches ADD ScheduledTime DATETIME NULL;
        PRINT '  Added ScheduledTime column';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatches') AND name = 'Notes')
    BEGIN
        ALTER TABLE EncounterMatches ADD Notes NVARCHAR(500) NULL;
        PRINT '  Added Notes column';
    END

    -- Add foreign key constraints for new columns
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EncounterMatches_TournamentCourt')
    BEGIN
        ALTER TABLE EncounterMatches ADD CONSTRAINT FK_EncounterMatches_TournamentCourt
            FOREIGN KEY (TournamentCourtId) REFERENCES TournamentCourts(Id);
        PRINT '  Added FK_EncounterMatches_TournamentCourt constraint';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EncounterMatches_ScoreSubmittedBy')
    BEGIN
        ALTER TABLE EncounterMatches ADD CONSTRAINT FK_EncounterMatches_ScoreSubmittedBy
            FOREIGN KEY (ScoreSubmittedByUnitId) REFERENCES EventUnits(Id);
        PRINT '  Added FK_EncounterMatches_ScoreSubmittedBy constraint';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EncounterMatches_ScoreConfirmedBy')
    BEGIN
        ALTER TABLE EncounterMatches ADD CONSTRAINT FK_EncounterMatches_ScoreConfirmedBy
            FOREIGN KEY (ScoreConfirmedByUnitId) REFERENCES EventUnits(Id);
        PRINT '  Added FK_EncounterMatches_ScoreConfirmedBy constraint';
    END
END

-- =====================================================
-- PHASE 4: Add missing columns to EncounterMatchPlayers
-- =====================================================
PRINT 'Adding missing columns to EncounterMatchPlayers...';

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('EncounterMatchPlayers') AND type = 'U')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatchPlayers') AND name = 'UnitId')
    BEGIN
        ALTER TABLE EncounterMatchPlayers ADD UnitId INT NOT NULL DEFAULT 0;
        PRINT '  Added UnitId column';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EncounterMatchPlayers') AND name = 'Position')
    BEGIN
        ALTER TABLE EncounterMatchPlayers ADD Position INT NULL;
        PRINT '  Added Position column';
    END

    -- Add foreign key constraint for UnitId
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EncounterMatchPlayers_Unit')
    BEGIN
        ALTER TABLE EncounterMatchPlayers ADD CONSTRAINT FK_EncounterMatchPlayers_Unit
            FOREIGN KEY (UnitId) REFERENCES EventUnits(Id);
        PRINT '  Added FK_EncounterMatchPlayers_Unit constraint';
    END
END

-- =====================================================
-- PHASE 5: Create missing indexes
-- =====================================================
PRINT 'Creating missing indexes...';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EncounterMatchFormats_DivisionId_MatchNumber' AND object_id = OBJECT_ID('EncounterMatchFormats'))
BEGIN
    CREATE INDEX IX_EncounterMatchFormats_DivisionId_MatchNumber ON EncounterMatchFormats(DivisionId, MatchNumber);
    PRINT '  Created IX_EncounterMatchFormats_DivisionId_MatchNumber index';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EncounterMatches_Status' AND object_id = OBJECT_ID('EncounterMatches'))
BEGIN
    CREATE INDEX IX_EncounterMatches_Status ON EncounterMatches(Status);
    PRINT '  Created IX_EncounterMatches_Status index';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EncounterMatches_TournamentCourtId' AND object_id = OBJECT_ID('EncounterMatches'))
BEGIN
    CREATE INDEX IX_EncounterMatches_TournamentCourtId ON EncounterMatches(TournamentCourtId);
    PRINT '  Created IX_EncounterMatches_TournamentCourtId index';
END

PRINT 'Migration 107 completed successfully';
