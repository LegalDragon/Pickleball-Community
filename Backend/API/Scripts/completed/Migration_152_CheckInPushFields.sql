-- Migration Script: Add push check-in fields to EventUnitMembers
-- Date: 2025-02-06
-- Description: Fields to track push notification check-in flow

USE PickleballCommunity;
GO

-- Add columns for push check-in tracking
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'CheckInPushSentAt')
BEGIN
    ALTER TABLE EventUnitMembers ADD CheckInPushSentAt DATETIME2 NULL;
    PRINT 'Added CheckInPushSentAt column';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'CheckInPushToken')
BEGIN
    ALTER TABLE EventUnitMembers ADD CheckInPushToken NVARCHAR(255) NULL;
    PRINT 'Added CheckInPushToken column';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'CheckInPushConfirmedAt')
BEGIN
    ALTER TABLE EventUnitMembers ADD CheckInPushConfirmedAt DATETIME2 NULL;
    PRINT 'Added CheckInPushConfirmedAt column';
END
GO

PRINT 'Migration 152 (CheckInPushFields) completed!';
GO
