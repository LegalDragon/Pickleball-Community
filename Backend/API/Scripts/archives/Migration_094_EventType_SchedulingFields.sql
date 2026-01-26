-- Migration Script: Add DivisionMax and ScheduleType to EventTypes
-- Date: 2026-01-14
-- Description: Adds scheduling configuration fields to EventTypes for consistent event execution flows

PRINT 'Starting Migration_094_EventType_SchedulingFields...';
PRINT '';

-- =============================================
-- STEP 1: Add DivisionMax column
-- =============================================
PRINT 'Adding DivisionMax column...';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('EventTypes') AND name = 'DivisionMax')
BEGIN
    ALTER TABLE EventTypes ADD DivisionMax INT NULL;
    PRINT '  Added DivisionMax column (NULL = Unlimited)';
END
ELSE
BEGIN
    PRINT '  DivisionMax column already exists';
END
GO

-- =============================================
-- STEP 2: Add ScheduleType column
-- =============================================
PRINT 'Adding ScheduleType column...';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('EventTypes') AND name = 'ScheduleType')
BEGIN
    ALTER TABLE EventTypes ADD ScheduleType NVARCHAR(50) NULL;
    PRINT '  Added ScheduleType column';
END
ELSE
BEGIN
    PRINT '  ScheduleType column already exists';
END
GO

-- =============================================
-- STEP 3: Update existing event types with defaults
-- =============================================
PRINT '';
PRINT 'Updating existing event types with default values...';

-- Tournament: Unlimited divisions, PrePlanned scheduling
UPDATE EventTypes
SET DivisionMax = NULL, ScheduleType = 'PrePlanned'
WHERE Name = 'Tournament' AND ScheduleType IS NULL;

-- Rec Play: 1 division max, Manual Only scheduling
UPDATE EventTypes
SET DivisionMax = 1, ScheduleType = 'Manual Only'
WHERE Name = 'Rec Play' AND ScheduleType IS NULL;

-- Clinic: Unlimited divisions, Manual Only scheduling
UPDATE EventTypes
SET DivisionMax = NULL, ScheduleType = 'Manual Only'
WHERE Name = 'Clinic' AND ScheduleType IS NULL;

-- Mini-Match: 1 division max, Dynamic scheduling
UPDATE EventTypes
SET DivisionMax = 1, ScheduleType = 'Dynamic'
WHERE Name = 'Mini-Match' AND ScheduleType IS NULL;

-- Party: Unlimited divisions, no scheduling
UPDATE EventTypes
SET DivisionMax = NULL, ScheduleType = 'None'
WHERE Name = 'Party' AND ScheduleType IS NULL;

-- Set default for any others not matched
UPDATE EventTypes
SET ScheduleType = 'Manual Only'
WHERE ScheduleType IS NULL;

PRINT '  Updated existing event types';
GO

PRINT '';
PRINT 'Migration_094_EventType_SchedulingFields completed successfully!';
GO
