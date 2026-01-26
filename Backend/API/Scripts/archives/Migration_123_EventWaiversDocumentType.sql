-- Migration 123: Add DocumentType column to EventWaivers table
-- Supports different document types: waiver, map, rules, contacts, other

PRINT 'Starting Migration 123: Add DocumentType to EventWaivers'
GO

-- Add DocumentType column to EventWaivers if it doesn't exist
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('EventWaivers') AND name = 'DocumentType'
)
BEGIN
    PRINT 'Adding DocumentType column to EventWaivers...'
    ALTER TABLE EventWaivers ADD DocumentType NVARCHAR(50) NULL DEFAULT 'waiver'
    PRINT 'DocumentType column added'
END
ELSE
BEGIN
    PRINT 'DocumentType column already exists on EventWaivers'
END
GO

-- Update any existing records to have default DocumentType
UPDATE EventWaivers SET DocumentType = 'waiver' WHERE DocumentType IS NULL
PRINT 'Updated existing records to have default DocumentType'
GO

PRINT 'Migration 123 completed successfully'
GO
