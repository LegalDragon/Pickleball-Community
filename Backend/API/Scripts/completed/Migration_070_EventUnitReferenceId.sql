-- Migration 070: Add ReferenceId to EventUnits
-- System-generated reference ID for matching payments (E{eventId}-U{unitId})

PRINT 'Migration 070: Adding ReferenceId to EventUnits'

-- Add ReferenceId column to EventUnits
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnits') AND name = 'ReferenceId')
BEGIN
    ALTER TABLE EventUnits ADD ReferenceId NVARCHAR(50) NULL;
    PRINT 'Added ReferenceId column to EventUnits'
END
ELSE
BEGIN
    PRINT 'ReferenceId column already exists in EventUnits'
END

-- Populate ReferenceId for existing units that have payment proof or payment reference
UPDATE EventUnits
SET ReferenceId = CONCAT('E', EventId, '-U', Id)
WHERE ReferenceId IS NULL
  AND (PaymentProofUrl IS NOT NULL OR PaymentReference IS NOT NULL);

PRINT 'Migration 070 complete'
GO
