-- Migration 111: Add CheckInStatus and CheckInRequestedAt columns to EventUnitMembers
-- Allows tracking of player self-check-in requests before admin approval

PRINT 'Starting Migration 111 - Check-In Status'

-- Add CheckInStatus column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'CheckInStatus')
BEGIN
    ALTER TABLE EventUnitMembers ADD CheckInStatus NVARCHAR(20) NOT NULL DEFAULT 'None'
    PRINT 'Added CheckInStatus column to EventUnitMembers'
END
ELSE
BEGIN
    PRINT 'CheckInStatus column already exists'
END

-- Add CheckInRequestedAt column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'CheckInRequestedAt')
BEGIN
    ALTER TABLE EventUnitMembers ADD CheckInRequestedAt DATETIME NULL
    PRINT 'Added CheckInRequestedAt column to EventUnitMembers'
END
ELSE
BEGIN
    PRINT 'CheckInRequestedAt column already exists'
END

PRINT 'Migration 111 completed'
