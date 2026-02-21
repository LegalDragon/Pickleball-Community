-- Migration 141: Phase-specific Match Settings
-- Allows different BestOf/ScoreFormat settings per phase and match format combination
-- e.g., Pool play = 1 game, Semifinals = Best of 3, Finals = Best of 5

PRINT 'Starting Migration 141: PhaseMatchSettings...'

-- Create PhaseMatchSettings table
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'PhaseMatchSettings'
)
BEGIN
    CREATE TABLE PhaseMatchSettings (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        PhaseId INT NOT NULL,
        MatchFormatId INT NULL,  -- NULL means applies to all matches (or single-match encounters)
        BestOf INT NOT NULL DEFAULT 1,
        ScoreFormatId INT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_PhaseMatchSettings_Phase FOREIGN KEY (PhaseId)
            REFERENCES DivisionPhases(Id) ON DELETE CASCADE,
        CONSTRAINT FK_PhaseMatchSettings_MatchFormat FOREIGN KEY (MatchFormatId)
            REFERENCES EncounterMatchFormats(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_PhaseMatchSettings_ScoreFormat FOREIGN KEY (ScoreFormatId)
            REFERENCES ScoreFormats(Id) ON DELETE SET NULL,
        CONSTRAINT UQ_PhaseMatchSettings_PhaseFormat UNIQUE (PhaseId, MatchFormatId)
    );

    PRINT 'Created PhaseMatchSettings table'
END
ELSE
BEGIN
    PRINT 'PhaseMatchSettings table already exists'
END

-- Create index for faster lookups
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_PhaseMatchSettings_PhaseId' AND object_id = OBJECT_ID('PhaseMatchSettings')
)
BEGIN
    CREATE INDEX IX_PhaseMatchSettings_PhaseId ON PhaseMatchSettings(PhaseId);
    PRINT 'Created index IX_PhaseMatchSettings_PhaseId'
END

PRINT 'Migration 141 completed successfully'
