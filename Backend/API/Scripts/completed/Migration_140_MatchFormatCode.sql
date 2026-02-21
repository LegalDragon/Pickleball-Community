-- Migration 140: Add Code field to EncounterMatchFormats
-- Adds a short code (MD, WD, XD, etc.) to identify match formats
-- Used to create identifiers like: Encounter 1 - MD - Game 1

PRINT 'Starting Migration 140: MatchFormatCode...'

-- Add Code column to EncounterMatchFormats
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'EncounterMatchFormats' AND COLUMN_NAME = 'Code'
)
BEGIN
    ALTER TABLE EncounterMatchFormats ADD Code NVARCHAR(10) NOT NULL DEFAULT '';
    PRINT 'Added Code column to EncounterMatchFormats'
END
ELSE
BEGIN
    PRINT 'Code column already exists in EncounterMatchFormats'
END

-- Update existing records with default codes based on name patterns
UPDATE EncounterMatchFormats
SET Code = CASE
    WHEN Name LIKE '%Men%Doubles%' THEN 'MD'
    WHEN Name LIKE '%Women%Doubles%' THEN 'WD'
    WHEN Name LIKE '%Mixed%' THEN 'XD'
    WHEN Name LIKE '%Men%Singles%' THEN 'MS'
    WHEN Name LIKE '%Women%Singles%' THEN 'WS'
    WHEN Name LIKE '%Singles%' THEN 'S'
    WHEN Name LIKE '%Doubles%' THEN 'D'
    ELSE 'M' + CAST(MatchNumber AS VARCHAR(2))
END
WHERE Code = '' OR Code IS NULL;

PRINT 'Updated existing EncounterMatchFormats with default codes'

PRINT 'Migration 140 completed successfully'
