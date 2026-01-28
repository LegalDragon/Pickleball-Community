-- Migration 110: Add PaymentMethod column to EventUnitMembers
-- Stores the payment method used (Zelle, Cash, Venmo, etc.)

PRINT 'Adding PaymentMethod column to EventUnitMembers...'

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'PaymentMethod')
BEGIN
    ALTER TABLE EventUnitMembers ADD PaymentMethod NVARCHAR(50) NULL;
    PRINT 'PaymentMethod column added to EventUnitMembers'
END
ELSE
BEGIN
    PRINT 'PaymentMethod column already exists in EventUnitMembers'
END

PRINT 'Migration 110 complete'
GO
