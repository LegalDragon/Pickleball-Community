-- Migration 080: Add Test Mode to Release Notes
-- Allows admins to test release notes before publishing to all users

PRINT 'Starting Migration 080: Release Notes Test Mode'

-- Add IsTest column to ReleaseNotes
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ReleaseNotes' AND COLUMN_NAME = 'IsTest')
BEGIN
    ALTER TABLE ReleaseNotes ADD IsTest BIT NOT NULL DEFAULT 0
    PRINT 'Added IsTest column to ReleaseNotes'
END
ELSE
BEGIN
    PRINT 'IsTest column already exists'
END

PRINT 'Migration 080 completed successfully'
