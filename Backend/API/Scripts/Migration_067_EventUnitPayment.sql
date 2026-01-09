-- Migration 067: Add payment tracking fields to EventUnits table
-- This allows tracking payment status and proof for tournament registrations

PRINT 'Starting Migration 067: EventUnit Payment Fields...'

-- Add PaymentStatus column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnits') AND name = 'PaymentStatus')
BEGIN
    ALTER TABLE EventUnits ADD PaymentStatus NVARCHAR(20) NOT NULL DEFAULT 'Pending'
    PRINT 'Added PaymentStatus column to EventUnits table'
END
ELSE
BEGIN
    PRINT 'PaymentStatus column already exists in EventUnits table'
END

-- Add AmountPaid column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnits') AND name = 'AmountPaid')
BEGIN
    ALTER TABLE EventUnits ADD AmountPaid DECIMAL(10,2) NOT NULL DEFAULT 0
    PRINT 'Added AmountPaid column to EventUnits table'
END
ELSE
BEGIN
    PRINT 'AmountPaid column already exists in EventUnits table'
END

-- Add PaymentProofUrl column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnits') AND name = 'PaymentProofUrl')
BEGIN
    ALTER TABLE EventUnits ADD PaymentProofUrl NVARCHAR(500) NULL
    PRINT 'Added PaymentProofUrl column to EventUnits table'
END
ELSE
BEGIN
    PRINT 'PaymentProofUrl column already exists in EventUnits table'
END

-- Add PaidAt column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnits') AND name = 'PaidAt')
BEGIN
    ALTER TABLE EventUnits ADD PaidAt DATETIME2 NULL
    PRINT 'Added PaidAt column to EventUnits table'
END
ELSE
BEGIN
    PRINT 'PaidAt column already exists in EventUnits table'
END

-- Add PaymentReference column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnits') AND name = 'PaymentReference')
BEGIN
    ALTER TABLE EventUnits ADD PaymentReference NVARCHAR(100) NULL
    PRINT 'Added PaymentReference column to EventUnits table'
END
ELSE
BEGIN
    PRINT 'PaymentReference column already exists in EventUnits table'
END

PRINT 'Migration 067 completed successfully'
