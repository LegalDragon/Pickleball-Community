-- Migration 117: Add Event Admin permission and self-registration flag to staff roles
-- Date: 2026-01-22

PRINT 'Migration 117: Adding staff role permission fields...'

-- Add CanFullyManageEvent column to EventStaffRoles
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventStaffRoles') AND name = 'CanFullyManageEvent')
BEGIN
    ALTER TABLE EventStaffRoles ADD CanFullyManageEvent BIT NOT NULL DEFAULT 0
    PRINT 'Added CanFullyManageEvent column to EventStaffRoles'
END
ELSE
BEGIN
    PRINT 'CanFullyManageEvent column already exists'
END

-- Add AllowSelfRegistration column to EventStaffRoles
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventStaffRoles') AND name = 'AllowSelfRegistration')
BEGIN
    ALTER TABLE EventStaffRoles ADD AllowSelfRegistration BIT NOT NULL DEFAULT 1
    PRINT 'Added AllowSelfRegistration column to EventStaffRoles'
END
ELSE
BEGIN
    PRINT 'AllowSelfRegistration column already exists'
END

-- Insert default global staff roles if none exist
IF NOT EXISTS (SELECT 1 FROM EventStaffRoles WHERE EventId IS NULL)
BEGIN
    PRINT 'Creating default global staff roles...'

    -- Event Admin - Full access like the organizer
    INSERT INTO EventStaffRoles (EventId, Name, Description, CanManageSchedule, CanManageCourts, CanRecordScores, CanCheckInPlayers, CanManageLineups, CanViewAllData, CanFullyManageEvent, AllowSelfRegistration, SortOrder, IsActive, CreatedAt, UpdatedAt)
    VALUES (NULL, 'Event Admin', 'Full event management access - same permissions as organizer', 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, GETDATE(), GETDATE())

    -- Tournament Director - Can manage schedule and courts
    INSERT INTO EventStaffRoles (EventId, Name, Description, CanManageSchedule, CanManageCourts, CanRecordScores, CanCheckInPlayers, CanManageLineups, CanViewAllData, CanFullyManageEvent, AllowSelfRegistration, SortOrder, IsActive, CreatedAt, UpdatedAt)
    VALUES (NULL, 'Tournament Director', 'Manages schedule, courts, and overall tournament flow', 1, 1, 1, 1, 1, 1, 0, 0, 2, 1, GETDATE(), GETDATE())

    -- Court Monitor - Can record scores
    INSERT INTO EventStaffRoles (EventId, Name, Description, CanManageSchedule, CanManageCourts, CanRecordScores, CanCheckInPlayers, CanManageLineups, CanViewAllData, CanFullyManageEvent, AllowSelfRegistration, SortOrder, IsActive, CreatedAt, UpdatedAt)
    VALUES (NULL, 'Court Monitor', 'Records scores and monitors court activity', 0, 0, 1, 0, 0, 0, 0, 1, 3, 1, GETDATE(), GETDATE())

    -- Check-in Staff - Can check in players
    INSERT INTO EventStaffRoles (EventId, Name, Description, CanManageSchedule, CanManageCourts, CanRecordScores, CanCheckInPlayers, CanManageLineups, CanViewAllData, CanFullyManageEvent, AllowSelfRegistration, SortOrder, IsActive, CreatedAt, UpdatedAt)
    VALUES (NULL, 'Check-in Staff', 'Handles player check-in at registration desk', 0, 0, 0, 1, 0, 1, 0, 1, 4, 1, GETDATE(), GETDATE())

    -- Volunteer - General volunteer with minimal permissions
    INSERT INTO EventStaffRoles (EventId, Name, Description, CanManageSchedule, CanManageCourts, CanRecordScores, CanCheckInPlayers, CanManageLineups, CanViewAllData, CanFullyManageEvent, AllowSelfRegistration, SortOrder, IsActive, CreatedAt, UpdatedAt)
    VALUES (NULL, 'Volunteer', 'General volunteer helper', 0, 0, 0, 0, 0, 0, 0, 1, 5, 1, GETDATE(), GETDATE())

    PRINT 'Created 5 default global staff roles'
END
ELSE
BEGIN
    PRINT 'Global staff roles already exist - skipping default creation'
END

PRINT 'Migration 117 completed successfully'
