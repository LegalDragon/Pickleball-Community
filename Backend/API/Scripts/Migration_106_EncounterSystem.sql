-- Migration_106_EncounterSystem.sql
-- Restructures tournament system to support multi-match encounters
-- Renames EventMatches -> EventEncounters, adds EncounterMatches layer

PRINT 'Starting Migration 106 - Encounter System';

-- =====================================================
-- PHASE 1: Add new columns to EventDivisions
-- =====================================================
PRINT 'Adding encounter settings to EventDivisions...';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventDivisions') AND name = 'MatchesPerEncounter')
BEGIN
    ALTER TABLE EventDivisions ADD MatchesPerEncounter INT NOT NULL DEFAULT 1;
    PRINT '  Added MatchesPerEncounter column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventDivisions') AND name = 'AllowPlayerReuseInEncounter')
BEGIN
    ALTER TABLE EventDivisions ADD AllowPlayerReuseInEncounter BIT NOT NULL DEFAULT 1;
    PRINT '  Added AllowPlayerReuseInEncounter column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventDivisions') AND name = 'AllowLineupChangePerEncounter')
BEGIN
    ALTER TABLE EventDivisions ADD AllowLineupChangePerEncounter BIT NOT NULL DEFAULT 1;
    PRINT '  Added AllowLineupChangePerEncounter column';
END

-- =====================================================
-- PHASE 2: Create EncounterMatchFormats table
-- =====================================================
PRINT 'Creating EncounterMatchFormats table...';

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('EncounterMatchFormats') AND type = 'U')
BEGIN
    CREATE TABLE EncounterMatchFormats (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        DivisionId INT NOT NULL,
        MatchOrder INT NOT NULL DEFAULT 1,
        Name NVARCHAR(100) NOT NULL,

        -- Player requirements per side
        MaleCount INT NOT NULL DEFAULT 0,
        FemaleCount INT NOT NULL DEFAULT 0,
        UnisexCount INT NOT NULL DEFAULT 2,  -- Default: 2 players any gender (doubles)

        -- Game settings
        GamesPerMatch INT NOT NULL DEFAULT 1,  -- 1, 3, or 5 (best-of)
        ScoreFormatId INT NULL,

        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_EncounterMatchFormats_Division FOREIGN KEY (DivisionId)
            REFERENCES EventDivisions(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EncounterMatchFormats_ScoreFormat FOREIGN KEY (ScoreFormatId)
            REFERENCES ScoreFormats(Id)
    );

    CREATE INDEX IX_EncounterMatchFormats_DivisionId ON EncounterMatchFormats(DivisionId);
    PRINT '  Created EncounterMatchFormats table';
END

-- =====================================================
-- PHASE 3: Rename EventMatches to EventEncounters
-- =====================================================
PRINT 'Renaming EventMatches to EventEncounters...';

-- Check if table needs renaming
IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('EventMatches') AND type = 'U')
   AND NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('EventEncounters') AND type = 'U')
BEGIN
    -- Drop foreign key constraints first
    DECLARE @sql NVARCHAR(MAX) = '';

    SELECT @sql = @sql + 'ALTER TABLE [' + OBJECT_NAME(parent_object_id) + '] DROP CONSTRAINT [' + name + '];' + CHAR(13)
    FROM sys.foreign_keys
    WHERE referenced_object_id = OBJECT_ID('EventMatches');

    IF LEN(@sql) > 0
    BEGIN
        EXEC sp_executesql @sql;
        PRINT '  Dropped foreign key constraints referencing EventMatches';
    END

    -- Rename the table
    EXEC sp_rename 'EventMatches', 'EventEncounters';
    PRINT '  Renamed EventMatches to EventEncounters';

    -- Rename primary key constraint if exists
    IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'PK_EventMatches')
    BEGIN
        EXEC sp_rename 'PK_EventMatches', 'PK_EventEncounters', 'OBJECT';
    END
END

-- Add encounter-level score columns
IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('EventEncounters') AND type = 'U')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'Unit1EncounterScore')
    BEGIN
        ALTER TABLE EventEncounters ADD Unit1EncounterScore INT NOT NULL DEFAULT 0;
        PRINT '  Added Unit1EncounterScore column';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'Unit2EncounterScore')
    BEGIN
        ALTER TABLE EventEncounters ADD Unit2EncounterScore INT NOT NULL DEFAULT 0;
        PRINT '  Added Unit2EncounterScore column';
    END
END

-- =====================================================
-- PHASE 4: Create EncounterMatches table
-- =====================================================
PRINT 'Creating EncounterMatches table...';

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('EncounterMatches') AND type = 'U')
BEGIN
    CREATE TABLE EncounterMatches (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EncounterId INT NOT NULL,
        FormatId INT NULL,  -- NULL for simple encounters (MatchesPerEncounter=1)
        MatchOrder INT NOT NULL DEFAULT 1,

        -- Match-level scoring (games won if best-of)
        Unit1Score INT NOT NULL DEFAULT 0,
        Unit2Score INT NOT NULL DEFAULT 0,
        WinnerUnitId INT NULL,

        -- Handicap for gender shortage
        Unit1HandicapPoints INT NOT NULL DEFAULT 0,
        Unit2HandicapPoints INT NOT NULL DEFAULT 0,
        HandicapReason NVARCHAR(200) NULL,

        Status NVARCHAR(20) NOT NULL DEFAULT 'Scheduled',
        StartedAt DATETIME NULL,
        CompletedAt DATETIME NULL,

        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_EncounterMatches_Encounter FOREIGN KEY (EncounterId)
            REFERENCES EventEncounters(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EncounterMatches_Format FOREIGN KEY (FormatId)
            REFERENCES EncounterMatchFormats(Id),
        CONSTRAINT FK_EncounterMatches_Winner FOREIGN KEY (WinnerUnitId)
            REFERENCES EventUnits(Id)
    );

    CREATE INDEX IX_EncounterMatches_EncounterId ON EncounterMatches(EncounterId);
    PRINT '  Created EncounterMatches table';
END

-- =====================================================
-- PHASE 5: Create EncounterMatchPlayers table
-- =====================================================
PRINT 'Creating EncounterMatchPlayers table...';

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('EncounterMatchPlayers') AND type = 'U')
BEGIN
    CREATE TABLE EncounterMatchPlayers (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        MatchId INT NOT NULL,
        UserId INT NOT NULL,
        UnitSide INT NOT NULL,  -- 1 or 2
        Gender NVARCHAR(1) NULL,  -- M, F, or NULL
        IsSubstitute BIT NOT NULL DEFAULT 0,

        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_EncounterMatchPlayers_Match FOREIGN KEY (MatchId)
            REFERENCES EncounterMatches(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EncounterMatchPlayers_User FOREIGN KEY (UserId)
            REFERENCES Users(Id)
    );

    CREATE INDEX IX_EncounterMatchPlayers_MatchId ON EncounterMatchPlayers(MatchId);
    CREATE INDEX IX_EncounterMatchPlayers_UserId ON EncounterMatchPlayers(UserId);
    PRINT '  Created EncounterMatchPlayers table';
END

-- =====================================================
-- PHASE 6: Update EventGames to reference EncounterMatches
-- =====================================================
PRINT 'Updating EventGames foreign key...';

-- Add EncounterMatchId column to EventGames
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventGames') AND name = 'EncounterMatchId')
BEGIN
    -- Add new column (nullable initially for migration)
    ALTER TABLE EventGames ADD EncounterMatchId INT NULL;
    PRINT '  Added EncounterMatchId column to EventGames';
END

-- =====================================================
-- PHASE 7: Migrate existing data
-- =====================================================
PRINT 'Migrating existing match data to encounter structure...';

-- Create EncounterMatches for existing EventEncounters that don't have any
INSERT INTO EncounterMatches (EncounterId, MatchOrder, Status, CreatedAt, UpdatedAt)
SELECT e.Id, 1, e.Status, e.CreatedAt, e.UpdatedAt
FROM EventEncounters e
WHERE NOT EXISTS (SELECT 1 FROM EncounterMatches em WHERE em.EncounterId = e.Id);

PRINT '  Created EncounterMatches for existing encounters';

-- Update EventGames to point to the new EncounterMatches
-- (MatchId currently points to EventEncounters, need to map to EncounterMatches)
UPDATE g
SET g.EncounterMatchId = em.Id
FROM EventGames g
INNER JOIN EncounterMatches em ON em.EncounterId = g.MatchId AND em.MatchOrder = 1
WHERE g.EncounterMatchId IS NULL;

PRINT '  Updated EventGames to reference EncounterMatches';

-- =====================================================
-- PHASE 8: Create indexes
-- =====================================================
PRINT 'Creating additional indexes...';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventEncounters_DivisionId' AND object_id = OBJECT_ID('EventEncounters'))
BEGIN
    CREATE INDEX IX_EventEncounters_DivisionId ON EventEncounters(DivisionId);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventEncounters_Unit1Id' AND object_id = OBJECT_ID('EventEncounters'))
BEGIN
    CREATE INDEX IX_EventEncounters_Unit1Id ON EventEncounters(Unit1Id);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventEncounters_Unit2Id' AND object_id = OBJECT_ID('EventEncounters'))
BEGIN
    CREATE INDEX IX_EventEncounters_Unit2Id ON EventEncounters(Unit2Id);
END

PRINT 'Migration 106 completed successfully';
