-- Migration 045: Add Icon column to ClubMemberRoles
-- Allows administrators to assign Lucide icons to club member roles

PRINT 'Adding Icon column to ClubMemberRoles...'

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME = 'ClubMemberRoles' AND COLUMN_NAME = 'Icon')
BEGIN
    ALTER TABLE ClubMemberRoles
    ADD Icon NVARCHAR(50) NULL;
    PRINT 'Icon column added to ClubMemberRoles'
END
ELSE
BEGIN
    PRINT 'Icon column already exists in ClubMemberRoles'
END

-- Set default icons for common system roles
UPDATE ClubMemberRoles SET Icon = 'Crown' WHERE Name = 'Admin' AND Icon IS NULL;
UPDATE ClubMemberRoles SET Icon = 'Users' WHERE Name = 'Member' AND Icon IS NULL;
UPDATE ClubMemberRoles SET Icon = 'Shield' WHERE Name = 'Moderator' AND Icon IS NULL;
UPDATE ClubMemberRoles SET Icon = 'DollarSign' WHERE Name = 'Treasurer' AND Icon IS NULL;

PRINT 'Migration 045 completed successfully'
GO
