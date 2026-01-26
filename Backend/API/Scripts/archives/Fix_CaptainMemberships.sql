-- Fix script for captains who are missing membership records or have wrong status
-- This can cause join requests to not be visible to captains

-- =====================================================
-- 1. FIX: Update captain memberships to Accepted status
-- =====================================================
PRINT '=== FIXING CAPTAIN MEMBERSHIPS WITH WRONG STATUS ==='

UPDATE eum
SET eum.InviteStatus = 'Accepted'
OUTPUT
    INSERTED.UnitId,
    INSERTED.UserId,
    'Updated to Accepted' AS Action
FROM EventUnitMembers eum
INNER JOIN EventUnits eu ON eum.UnitId = eu.Id
WHERE eum.UserId = eu.CaptainUserId
  AND eum.InviteStatus != 'Accepted';

PRINT 'Updated captain memberships to Accepted status'

-- =====================================================
-- 2. FIX: Create missing captain membership records
-- =====================================================
PRINT ''
PRINT '=== CREATING MISSING CAPTAIN MEMBERSHIPS ==='

INSERT INTO EventUnitMembers (UnitId, UserId, Role, InviteStatus, CreatedAt)
OUTPUT
    INSERTED.UnitId,
    INSERTED.UserId,
    'Created new membership' AS Action
SELECT
    eu.Id AS UnitId,
    eu.CaptainUserId AS UserId,
    'Captain' AS Role,
    'Accepted' AS InviteStatus,
    GETDATE() AS CreatedAt
FROM EventUnits eu
WHERE eu.CaptainUserId IS NOT NULL
  AND eu.Status != 'Cancelled'
  AND NOT EXISTS (
    SELECT 1 FROM EventUnitMembers eum
    WHERE eum.UnitId = eu.Id AND eum.UserId = eu.CaptainUserId
  );

PRINT 'Created missing captain memberships'

-- =====================================================
-- 3. VERIFY: Show all pending join requests after fix
-- =====================================================
PRINT ''
PRINT '=== VERIFICATION: PENDING JOIN REQUESTS ==='

SELECT
    eujr.Id AS RequestId,
    eu.Name AS UnitName,
    e.Title AS EventTitle,
    u.FirstName + ' ' + u.LastName AS RequesterName,
    captain.FirstName + ' ' + captain.LastName AS CaptainName,
    eum.InviteStatus AS CaptainMembershipStatus
FROM EventUnitJoinRequests eujr
INNER JOIN EventUnits eu ON eujr.UnitId = eu.Id
INNER JOIN Events e ON eu.EventId = e.Id
INNER JOIN Users u ON eujr.UserId = u.Id
LEFT JOIN Users captain ON eu.CaptainUserId = captain.Id
LEFT JOIN EventUnitMembers eum ON eum.UnitId = eu.Id AND eum.UserId = eu.CaptainUserId
WHERE eujr.Status = 'Pending';
