-- Migration 097: Add DocumentType column to EventWaivers table
-- Supports different document types: waiver, map, rules, contacts

PRINT 'Starting Migration 097: Add DocumentType to EventWaivers'
GO

-- Add DocumentType column to EventWaivers if it doesn't exist
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'EventWaivers' AND COLUMN_NAME = 'DocumentType'
)
BEGIN
    PRINT 'Adding DocumentType column to EventWaivers...'
    ALTER TABLE EventWaivers ADD DocumentType NVARCHAR(50) NOT NULL DEFAULT 'waiver'
    PRINT 'DocumentType column added'
END
ELSE
BEGIN
    PRINT 'DocumentType column already exists'
END
GO

-- Update any existing records that might have NULL DocumentType
UPDATE EventWaivers SET DocumentType = 'waiver' WHERE DocumentType IS NULL
PRINT 'Updated existing records to have default DocumentType'
GO

PRINT 'Migration 097 completed successfully'
GO
