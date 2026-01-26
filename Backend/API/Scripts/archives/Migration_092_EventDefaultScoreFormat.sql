-- Migration 092: Add DefaultScoreFormatId to Events table
-- This adds a default score format for the entire event

PRINT 'Starting Migration 092: Add DefaultScoreFormatId to Events table'

-- Add DefaultScoreFormatId column to Events table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'DefaultScoreFormatId')
BEGIN
    ALTER TABLE Events ADD DefaultScoreFormatId INT NULL
    PRINT 'Added DefaultScoreFormatId column to Events table'
END
ELSE
BEGIN
    PRINT 'DefaultScoreFormatId column already exists in Events table'
END

-- Add foreign key constraint if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Events_ScoreFormats_DefaultScoreFormatId')
BEGIN
    ALTER TABLE Events
    ADD CONSTRAINT FK_Events_ScoreFormats_DefaultScoreFormatId
    FOREIGN KEY (DefaultScoreFormatId) REFERENCES ScoreFormats(Id)
    PRINT 'Added foreign key constraint FK_Events_ScoreFormats_DefaultScoreFormatId'
END
ELSE
BEGIN
    PRINT 'Foreign key constraint FK_Events_ScoreFormats_DefaultScoreFormatId already exists'
END

PRINT 'Migration 092 completed successfully'
