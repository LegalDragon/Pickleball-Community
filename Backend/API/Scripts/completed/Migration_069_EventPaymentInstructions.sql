-- Migration 069: Add PaymentInstructions column to Events table
-- Adds payment instructions field for events (e.g., Venmo, Zelle, PayPal info)

PRINT 'Starting Migration 069: Event PaymentInstructions';

-- Add PaymentInstructions column to Events table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'PaymentInstructions')
BEGIN
    ALTER TABLE Events ADD PaymentInstructions NVARCHAR(1000) NULL;
    PRINT 'Added PaymentInstructions column to Events table';
END
ELSE
BEGIN
    PRINT 'PaymentInstructions column already exists in Events table';
END

PRINT 'Migration 069 completed successfully';
