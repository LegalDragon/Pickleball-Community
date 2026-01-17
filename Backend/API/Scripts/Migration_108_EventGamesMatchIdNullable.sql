-- Migration_108_EventGamesMatchIdNullable.sql
-- Makes the legacy MatchId column nullable in EventGames table
-- The new Encounter-Match-Game hierarchy uses EncounterMatchId instead

PRINT 'Starting Migration 108 - Make EventGames.MatchId nullable';

-- =====================================================
-- PHASE 1: Make MatchId nullable
-- =====================================================
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventGames') AND name = 'MatchId')
BEGIN
    -- Check if column is currently NOT NULL
    IF EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('EventGames')
        AND name = 'MatchId'
        AND is_nullable = 0
    )
    BEGIN
        PRINT 'Making MatchId column nullable...';

        -- First, drop the foreign key constraint if it exists
        IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EventGames_Match')
        BEGIN
            ALTER TABLE EventGames DROP CONSTRAINT FK_EventGames_Match;
            PRINT '  Dropped FK_EventGames_Match constraint';
        END

        -- Drop any index on MatchId
        IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventGames_MatchId' AND object_id = OBJECT_ID('EventGames'))
        BEGIN
            DROP INDEX IX_EventGames_MatchId ON EventGames;
            PRINT '  Dropped IX_EventGames_MatchId index';
        END

        -- Alter column to be nullable
        ALTER TABLE EventGames ALTER COLUMN MatchId INT NULL;
        PRINT '  Made MatchId column nullable';

        -- Note: We don't recreate the FK_EventGames_Match constraint because:
        -- 1. The MatchId column is deprecated in favor of EncounterMatchId
        -- 2. The table structure has changed (EventMatches -> EventEncounters hierarchy)
        -- The EncounterMatchId column has the proper FK to EncounterMatches table
        PRINT '  Legacy MatchId FK not recreated (deprecated in favor of EncounterMatchId)';
    END
    ELSE
    BEGIN
        PRINT 'MatchId column is already nullable';
    END
END
ELSE
BEGIN
    PRINT 'MatchId column does not exist in EventGames';
END

-- =====================================================
-- PHASE 2: Ensure EncounterMatchId exists and has proper constraint
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventGames') AND name = 'EncounterMatchId')
BEGIN
    PRINT 'Adding EncounterMatchId column...';
    ALTER TABLE EventGames ADD EncounterMatchId INT NULL;
    PRINT '  Added EncounterMatchId column';
END

-- Add foreign key for EncounterMatchId if not exists
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EventGames_EncounterMatch')
BEGIN
    ALTER TABLE EventGames ADD CONSTRAINT FK_EventGames_EncounterMatch
        FOREIGN KEY (EncounterMatchId) REFERENCES EncounterMatches(Id) ON DELETE CASCADE;
    PRINT '  Added FK_EventGames_EncounterMatch constraint';
END

-- Add index for EncounterMatchId if not exists
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventGames_EncounterMatchId' AND object_id = OBJECT_ID('EventGames'))
BEGIN
    CREATE INDEX IX_EventGames_EncounterMatchId ON EventGames(EncounterMatchId);
    PRINT '  Created IX_EventGames_EncounterMatchId index';
END

PRINT 'Migration 108 completed successfully';
