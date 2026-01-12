-- Migration_076_BackfillJoinRequestMembers.sql
-- Creates EventUnitMember records for existing pending join requests
-- that don't already have corresponding membership records.
-- This backfills data after the feature change that creates membership records
-- when join requests are submitted (for early payment support).

PRINT 'Starting Migration_076_BackfillJoinRequestMembers...'

-- Insert EventUnitMember records for pending join requests that don't have them
INSERT INTO EventUnitMembers (UnitId, UserId, Role, InviteStatus, InvitedAt, RespondedAt, IsCheckedIn, CheckedInAt, CreatedAt)
SELECT
    jr.UnitId,
    jr.UserId,
    'Player' AS Role,
    'PendingJoinRequest' AS InviteStatus,
    NULL AS InvitedAt,
    NULL AS RespondedAt,
    0 AS IsCheckedIn,
    NULL AS CheckedInAt,
    jr.CreatedAt  -- Use the join request's created date for consistency
FROM EventUnitJoinRequests jr
WHERE jr.Status = 'Pending'
  AND NOT EXISTS (
    SELECT 1
    FROM EventUnitMembers m
    WHERE m.UnitId = jr.UnitId
      AND m.UserId = jr.UserId
  )

DECLARE @RowsInserted INT = @@ROWCOUNT
PRINT 'Inserted ' + CAST(@RowsInserted AS VARCHAR(10)) + ' EventUnitMember records for existing pending join requests.'

PRINT 'Migration_076_BackfillJoinRequestMembers completed.'
