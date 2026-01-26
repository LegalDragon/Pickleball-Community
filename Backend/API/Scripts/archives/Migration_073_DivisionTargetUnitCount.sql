-- Migration 073: Add TargetUnitCount to EventDivisions
-- This column stores the target number of units/placeholders for schedule generation
-- Allows creating schedules with more slots than registered units (for drawing and byes)

PRINT 'Starting Migration 073: Add TargetUnitCount to EventDivisions'
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventDivisions') AND name = 'TargetUnitCount')
BEGIN
    ALTER TABLE EventDivisions ADD TargetUnitCount INT NULL;
    PRINT 'Added TargetUnitCount column to EventDivisions'
END
ELSE
BEGIN
    PRINT 'TargetUnitCount column already exists in EventDivisions'
END
GO

PRINT 'Migration 073 completed successfully'
GO
