-- Migration 097: Add DocumentType column to EventDocuments table
-- Supports different document types: waiver, map, rules, contacts, other

PRINT 'Starting Migration 097: Add DocumentType to EventDocuments'
GO

-- Add DocumentType column to EventDocuments if it doesn't exist
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'EventDocuments' AND COLUMN_NAME = 'DocumentType'
)
BEGIN
    PRINT 'Adding DocumentType column to EventDocuments...'
    ALTER TABLE EventDocuments ADD DocumentType NVARCHAR(50) NOT NULL DEFAULT 'other'
    PRINT 'DocumentType column added'
END
ELSE
BEGIN
    PRINT 'DocumentType column already exists'
END
GO

-- Update any existing records that might have NULL DocumentType
UPDATE EventDocuments SET DocumentType = 'other' WHERE DocumentType IS NULL
PRINT 'Updated existing records to have default DocumentType'
GO

PRINT 'Migration 097 completed successfully'
GO
