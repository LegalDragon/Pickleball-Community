-- Migration 101: Add Live Drawing State to EventDivisions
-- Enables real-time drawing with SignalR broadcast to spectators

PRINT 'Adding drawing state columns to EventDivisions...'

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventDivisions') AND name = 'DrawingInProgress')
BEGIN
    ALTER TABLE EventDivisions ADD DrawingInProgress BIT NOT NULL DEFAULT 0;
    PRINT 'Added DrawingInProgress column'
END
ELSE
BEGIN
    PRINT 'DrawingInProgress column already exists'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventDivisions') AND name = 'DrawingStartedAt')
BEGIN
    ALTER TABLE EventDivisions ADD DrawingStartedAt DATETIME NULL;
    PRINT 'Added DrawingStartedAt column'
END
ELSE
BEGIN
    PRINT 'DrawingStartedAt column already exists'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventDivisions') AND name = 'DrawingByUserId')
BEGIN
    ALTER TABLE EventDivisions ADD DrawingByUserId INT NULL;
    PRINT 'Added DrawingByUserId column'
END
ELSE
BEGIN
    PRINT 'DrawingByUserId column already exists'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventDivisions') AND name = 'DrawingSequence')
BEGIN
    ALTER TABLE EventDivisions ADD DrawingSequence INT NOT NULL DEFAULT 0;
    PRINT 'Added DrawingSequence column'
END
ELSE
BEGIN
    PRINT 'DrawingSequence column already exists'
END

PRINT 'Migration 101 complete'
