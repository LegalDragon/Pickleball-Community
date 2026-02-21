-- Migration 147: Fix Rec Play ScheduleType
-- Migration 094 incorrectly set Rec Play to 'Manual Only' which prevents
-- Popcorn/Gauntlet scheduling buttons from showing in GameDayManage.jsx
-- (line 777 gates on scheduleType === 'Dynamic')

PRINT 'Migration 147: Fixing Rec Play ScheduleType...';

UPDATE EventTypes
SET ScheduleType = 'Dynamic'
WHERE Name = 'Rec Play' AND ScheduleType = 'Manual Only';

IF @@ROWCOUNT > 0
    PRINT '  Updated Rec Play → Dynamic scheduling';
ELSE
    PRINT '  Rec Play already has correct ScheduleType (or not found)';

-- Also ensure Mini-Match stays Dynamic (it was correct in 094 but verify)
UPDATE EventTypes
SET ScheduleType = 'Dynamic'
WHERE Name = 'Mini-Match' AND ScheduleType != 'Dynamic';

IF @@ROWCOUNT > 0
    PRINT '  Updated Mini-Match → Dynamic scheduling';

PRINT 'Migration 147 complete.';
GO
