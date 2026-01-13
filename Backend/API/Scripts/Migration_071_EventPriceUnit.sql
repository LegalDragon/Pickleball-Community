-- Migration: Add PriceUnit to Events table
-- This allows organizers to specify if the fee is per person, per pair, or per team

PRINT 'Starting Migration_071_EventPriceUnit...';

-- Add PriceUnit column to Events table
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Events') AND name = 'PriceUnit'
)
BEGIN
    ALTER TABLE Events ADD PriceUnit NVARCHAR(20) NULL;
    PRINT 'Added PriceUnit column to Events table';
END
ELSE
BEGIN
    PRINT 'PriceUnit column already exists in Events table';
END

-- Set default value for existing events (assume per person)
UPDATE Events
SET PriceUnit = 'person'
WHERE PriceUnit IS NULL AND RegistrationFee > 0;

PRINT 'Migration_071_EventPriceUnit completed successfully';
