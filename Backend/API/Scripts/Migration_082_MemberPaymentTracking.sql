-- Migration 082: Add per-member payment tracking to EventUnitMembers
-- This allows tracking which individual players have paid, not just the whole unit

PRINT 'Starting Migration 082 - Member Payment Tracking'

-- Add HasPaid column to EventUnitMembers
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'HasPaid')
BEGIN
    ALTER TABLE EventUnitMembers ADD HasPaid BIT NOT NULL DEFAULT 0
    PRINT 'Added HasPaid column to EventUnitMembers'
END
ELSE
    PRINT 'HasPaid column already exists'

-- Add PaidAt column to EventUnitMembers
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'PaidAt')
BEGIN
    ALTER TABLE EventUnitMembers ADD PaidAt DATETIME2 NULL
    PRINT 'Added PaidAt column to EventUnitMembers'
END
ELSE
    PRINT 'PaidAt column already exists'

-- Backfill: If unit has any payment submitted (Paid, PendingVerification, or Partial), mark all members as paid
UPDATE m
SET m.HasPaid = 1, m.PaidAt = COALESCE(u.PaidAt, u.UpdatedAt, GETDATE())
FROM EventUnitMembers m
INNER JOIN EventUnits u ON m.UnitId = u.Id
WHERE u.PaymentStatus IN ('Paid', 'PendingVerification', 'Partial')
  AND m.HasPaid = 0

DECLARE @BackfilledCount INT = @@ROWCOUNT
PRINT CONCAT('Backfilled ', @BackfilledCount, ' members from units with payment submitted')

PRINT 'Migration 082 completed successfully'
