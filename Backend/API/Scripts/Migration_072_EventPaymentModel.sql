-- Migration: Add PaymentModel to Events table
-- This allows organizers to specify if the fee is charged per unit or per person (registration)

PRINT 'Starting Migration_072_EventPaymentModel...';

-- Add PaymentModel column to Events table
-- Values: 'per_unit' (team pays once), 'per_person' (each player pays)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Events') AND name = 'PaymentModel'
)
BEGIN
    ALTER TABLE Events ADD PaymentModel NVARCHAR(20) NULL;
    PRINT 'Added PaymentModel column to Events table';
END
ELSE
BEGIN
    PRINT 'PaymentModel column already exists in Events table';
END

-- Set default value for existing events (assume per_unit which matches current behavior)
UPDATE Events
SET PaymentModel = 'per_unit'
WHERE PaymentModel IS NULL;

PRINT 'Migration_072_EventPaymentModel completed successfully';
