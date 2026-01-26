-- Migration 078: Add timestamp columns to EventDivisions table
-- Also adds columns if not exists for tracking schedule state

PRINT 'Starting Migration 078: Event Division Timestamps'

-- Add CreatedAt column if not exists
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EventDivisions' AND COLUMN_NAME = 'CreatedAt')
BEGIN
    ALTER TABLE EventDivisions ADD CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
    PRINT 'Added CreatedAt column to EventDivisions'
END
ELSE
BEGIN
    PRINT 'CreatedAt column already exists in EventDivisions'
END

-- Add UpdatedAt column if not exists
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EventDivisions' AND COLUMN_NAME = 'UpdatedAt')
BEGIN
    ALTER TABLE EventDivisions ADD UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
    PRINT 'Added UpdatedAt column to EventDivisions'
END
ELSE
BEGIN
    PRINT 'UpdatedAt column already exists in EventDivisions'
END

PRINT 'Migration 078 completed successfully'
