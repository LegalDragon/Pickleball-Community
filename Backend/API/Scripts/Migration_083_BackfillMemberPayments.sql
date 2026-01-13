-- Migration 083: Backfill individual member payment status from unit-level payments
-- Parses ReferenceId (format: E{eventId}-U{unitId}-P{playerId}) to identify payer
-- Also copies PaymentProofUrl to the member who submitted the payment

PRINT 'Starting Migration 083 - Backfill Member Payments'

-- Step 0: Add PaymentProofUrl column to EventUnitMembers if not exists
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'PaymentProofUrl')
BEGIN
    ALTER TABLE EventUnitMembers ADD PaymentProofUrl NVARCHAR(500) NULL
    PRINT 'Added PaymentProofUrl column to EventUnitMembers'
END

-- Step 1: For units with parseable ReferenceId, mark the specific player who paid
;WITH ParsedPayments AS (
    SELECT
        u.Id AS UnitId,
        u.PaidAt,
        u.PaymentStatus,
        u.ReferenceId,
        u.PaymentProofUrl,
        -- Extract PlayerId from ReferenceId format: E{eventId}-U{unitId}-P{playerId}
        CASE
            WHEN u.ReferenceId LIKE 'E%-U%-P%'
            THEN TRY_CAST(
                SUBSTRING(
                    u.ReferenceId,
                    CHARINDEX('-P', u.ReferenceId) + 2,
                    LEN(u.ReferenceId)
                ) AS INT
            )
            ELSE NULL
        END AS PayerUserId
    FROM EventUnits u
    WHERE u.PaymentStatus IN ('Paid', 'PendingVerification', 'Partial')
      AND u.ReferenceId IS NOT NULL
      AND u.ReferenceId LIKE 'E%-U%-P%'
)
UPDATE m
SET
    m.HasPaid = 1,
    m.PaidAt = COALESCE(m.PaidAt, p.PaidAt, GETDATE()),
    m.PaymentProofUrl = p.PaymentProofUrl
FROM EventUnitMembers m
INNER JOIN ParsedPayments p ON m.UnitId = p.UnitId AND m.UserId = p.PayerUserId
WHERE m.HasPaid = 0
  AND p.PayerUserId IS NOT NULL

DECLARE @SpecificPlayerCount INT = @@ROWCOUNT
PRINT CONCAT('Marked ', @SpecificPlayerCount, ' specific payers as paid (from ReferenceId)')

-- Step 2: For fully paid units WITHOUT parseable ReferenceId, mark ALL members as paid
-- Copy proof URL to all members (since we don't know who specifically paid)
UPDATE m
SET
    m.HasPaid = 1,
    m.PaidAt = COALESCE(m.PaidAt, u.PaidAt, GETDATE()),
    m.PaymentProofUrl = u.PaymentProofUrl
FROM EventUnitMembers m
INNER JOIN EventUnits u ON m.UnitId = u.Id
WHERE u.PaymentStatus = 'Paid'
  AND m.HasPaid = 0
  AND (u.ReferenceId IS NULL OR u.ReferenceId NOT LIKE 'E%-U%-P%')

DECLARE @AllMembersCount INT = @@ROWCOUNT
PRINT CONCAT('Marked ', @AllMembersCount, ' members as paid (from fully paid units without ReferenceId)')

-- Step 3: Summary report
SELECT
    'Summary' AS Report,
    (SELECT COUNT(*) FROM EventUnitMembers WHERE HasPaid = 1) AS TotalMembersPaid,
    (SELECT COUNT(*) FROM EventUnitMembers WHERE PaymentProofUrl IS NOT NULL) AS MembersWithProofUrl,
    (SELECT COUNT(*) FROM EventUnits WHERE PaymentStatus = 'Paid') AS TotalUnitsPaid

PRINT 'Migration 083 completed successfully'
