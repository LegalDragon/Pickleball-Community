-- Migration 100: Add PaymentId to EventUnitMembers
-- Links each registration to the UserPayment record that covered it

PRINT 'Adding PaymentId column to EventUnitMembers...'

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'PaymentId')
BEGIN
    ALTER TABLE EventUnitMembers ADD PaymentId INT NULL;
    PRINT 'Added PaymentId column to EventUnitMembers'
END
ELSE
BEGIN
    PRINT 'PaymentId column already exists in EventUnitMembers'
END

-- Add foreign key constraint
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EventUnitMembers_UserPayments')
BEGIN
    ALTER TABLE EventUnitMembers
    ADD CONSTRAINT FK_EventUnitMembers_UserPayments
    FOREIGN KEY (PaymentId) REFERENCES UserPayments(Id);
    PRINT 'Added foreign key constraint FK_EventUnitMembers_UserPayments'
END
ELSE
BEGIN
    PRINT 'Foreign key FK_EventUnitMembers_UserPayments already exists'
END

-- Create index for faster lookups
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventUnitMembers_PaymentId' AND object_id = OBJECT_ID('EventUnitMembers'))
BEGIN
    CREATE INDEX IX_EventUnitMembers_PaymentId ON EventUnitMembers(PaymentId);
    PRINT 'Created index IX_EventUnitMembers_PaymentId'
END

PRINT 'Migration 100 complete'
