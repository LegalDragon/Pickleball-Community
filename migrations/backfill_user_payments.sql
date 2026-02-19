-- Migration: Backfill UserPayments for legacy payments
-- Date: 2026-02-18
-- Issue: Members marked as paid before fc9aa34 don't have UserPayment records
-- Safety: Creates backup tables before any modifications

-- ============================================
-- STEP 1: Create backup tables
-- ============================================

-- Backup members that will be affected (HasPaid=1 but no PaymentId)
SELECT m.*
INTO EventUnitMembers_Backup_20260218
FROM EventUnitMembers m
INNER JOIN EventUnits u ON m.UnitId = u.Id
WHERE m.HasPaid = 1 
  AND m.PaymentId IS NULL
  AND u.Status != 'Cancelled';

-- Show count of affected records
SELECT COUNT(*) AS OrphanPaymentsCount FROM EventUnitMembers_Backup_20260218;

-- ============================================
-- STEP 2: Preview what will be inserted (DRY RUN)
-- ============================================

SELECT 
    m.UserId,
    'EventRegistration' AS PaymentType,
    u.EventId AS RelatedObjectId,
    m.UnitId AS SecondaryObjectId,
    m.Id AS TertiaryObjectId,
    'Event registration - ' + ISNULL(e.Name, 'Unknown') AS Description,
    m.AmountPaid AS Amount,
    m.PaymentProofUrl,
    m.PaymentReference,
    m.ReferenceId,
    m.PaymentMethod,
    CASE 
        WHEN m.PaymentProofUrl IS NOT NULL THEN 'PendingVerification'
        ELSE 'Pending'
    END AS Status,
    1 AS IsApplied,
    m.PaidAt AS AppliedAt,
    ISNULL(m.PaidAt, GETDATE()) AS CreatedAt,
    GETDATE() AS UpdatedAt,
    m.Id AS SourceMemberId -- For tracking
FROM EventUnitMembers m
INNER JOIN EventUnits u ON m.UnitId = u.Id
INNER JOIN Events e ON u.EventId = e.Id
WHERE m.HasPaid = 1 
  AND m.PaymentId IS NULL
  AND u.Status != 'Cancelled'
ORDER BY e.Id, u.Id, m.Id;

-- ============================================
-- STEP 3: Insert missing UserPayment records
-- Run this only after reviewing Step 2 results
-- ============================================

/*
-- UNCOMMENT TO EXECUTE:

INSERT INTO UserPayments (
    UserId,
    PaymentType,
    RelatedObjectId,
    SecondaryObjectId,
    TertiaryObjectId,
    Description,
    Amount,
    PaymentProofUrl,
    PaymentReference,
    ReferenceId,
    PaymentMethod,
    Status,
    IsApplied,
    AppliedAt,
    CreatedAt,
    UpdatedAt
)
SELECT 
    m.UserId,
    'EventRegistration',
    u.EventId,
    m.UnitId,
    m.Id,
    'Event registration - ' + ISNULL(e.Name, 'Unknown') + ' (backfilled)',
    m.AmountPaid,
    m.PaymentProofUrl,
    m.PaymentReference,
    ISNULL(m.ReferenceId, 'E' + CAST(u.EventId AS VARCHAR) + '-U' + CAST(m.UnitId AS VARCHAR) + '-P' + CAST(m.UserId AS VARCHAR)),
    m.PaymentMethod,
    CASE 
        WHEN m.PaymentProofUrl IS NOT NULL THEN 'PendingVerification'
        ELSE 'Pending'
    END,
    1,
    m.PaidAt,
    ISNULL(m.PaidAt, GETDATE()),
    GETDATE()
FROM EventUnitMembers m
INNER JOIN EventUnits u ON m.UnitId = u.Id
INNER JOIN Events e ON u.EventId = e.Id
WHERE m.HasPaid = 1 
  AND m.PaymentId IS NULL
  AND u.Status != 'Cancelled';

-- Show how many were inserted
SELECT @@ROWCOUNT AS InsertedPayments;

*/

-- ============================================
-- STEP 4: Link members to their new UserPayment records
-- Run after Step 3
-- ============================================

/*
-- UNCOMMENT TO EXECUTE:

UPDATE m
SET m.PaymentId = p.Id
FROM EventUnitMembers m
INNER JOIN EventUnits u ON m.UnitId = u.Id
INNER JOIN UserPayments p ON 
    p.PaymentType = 'EventRegistration'
    AND p.RelatedObjectId = u.EventId
    AND p.SecondaryObjectId = m.UnitId
    AND p.TertiaryObjectId = m.Id
    AND p.UserId = m.UserId
WHERE m.HasPaid = 1 
  AND m.PaymentId IS NULL
  AND u.Status != 'Cancelled';

-- Show how many were updated
SELECT @@ROWCOUNT AS UpdatedMembers;

*/

-- ============================================
-- STEP 5: Verify results
-- ============================================

-- Check for any remaining orphans (should be 0 after migration)
SELECT COUNT(*) AS RemainingOrphans
FROM EventUnitMembers m
INNER JOIN EventUnits u ON m.UnitId = u.Id
WHERE m.HasPaid = 1 
  AND m.PaymentId IS NULL
  AND u.Status != 'Cancelled';

-- ============================================
-- ROLLBACK (if needed)
-- ============================================

/*
-- To rollback, uncomment and run:

-- 1. Delete the new UserPayments (they have 'backfilled' in description)
DELETE FROM UserPayments WHERE Description LIKE '%backfilled%';

-- 2. Reset PaymentId on members
UPDATE m
SET m.PaymentId = NULL
FROM EventUnitMembers m
INNER JOIN EventUnitMembers_Backup_20260218 b ON m.Id = b.Id;

-- 3. Drop backup table when confident
-- DROP TABLE EventUnitMembers_Backup_20260218;

*/
