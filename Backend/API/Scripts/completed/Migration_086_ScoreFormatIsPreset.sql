-- Migration 086: Add IsPreset column to ScoreFormats
-- This distinguishes global preset formats from event-specific custom formats

PRINT 'Starting Migration 086: ScoreFormat IsPreset column'
GO

-- Add IsPreset column (default TRUE for existing records as they are global presets)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ScoreFormats') AND name = 'IsPreset')
BEGIN
    ALTER TABLE ScoreFormats ADD IsPreset BIT NOT NULL CONSTRAINT DF_ScoreFormats_IsPreset DEFAULT 1;
    PRINT 'Added IsPreset column to ScoreFormats'
END
GO

-- Add EventId column for event-specific formats (NULL means global preset)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ScoreFormats') AND name = 'EventId')
BEGIN
    ALTER TABLE ScoreFormats ADD EventId INT NULL;
    PRINT 'Added EventId column to ScoreFormats'

    -- Add foreign key constraint
    ALTER TABLE ScoreFormats ADD CONSTRAINT FK_ScoreFormats_Event
        FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE SET NULL;
    PRINT 'Added FK constraint for EventId'
END
GO

-- Create index for faster lookup by preset status
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ScoreFormats_IsPreset')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ScoreFormats_IsPreset ON ScoreFormats(IsPreset) INCLUDE (IsActive, SortOrder);
    PRINT 'Created index IX_ScoreFormats_IsPreset'
END
GO

-- Create index for event-specific formats
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ScoreFormats_EventId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ScoreFormats_EventId ON ScoreFormats(EventId) WHERE EventId IS NOT NULL;
    PRINT 'Created index IX_ScoreFormats_EventId'
END
GO

PRINT 'Migration 086 completed successfully'
GO
