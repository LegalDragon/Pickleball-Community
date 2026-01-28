-- Migration 119: Add RoleCategory to EventStaffRoles
-- Author: Claude
-- Date: 2026-01-22
-- Description: Adds RoleCategory field to distinguish between different types of roles
--              (Staff, Spectator, Volunteer, VIP, Media, etc.)
--              This allows spectators to be managed through the same staff system.

PRINT 'Starting Migration 119: Staff Role Category'

-- Add RoleCategory column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventStaffRoles') AND name = 'RoleCategory')
BEGIN
    ALTER TABLE EventStaffRoles ADD RoleCategory NVARCHAR(50) NOT NULL DEFAULT 'Staff'
    PRINT 'Added RoleCategory column to EventStaffRoles table'
END
ELSE
BEGIN
    PRINT 'RoleCategory column already exists'
END

-- Create a default Spectator role if it doesn't exist (global template)
IF NOT EXISTS (SELECT 1 FROM EventStaffRoles WHERE Name = 'Spectator' AND EventId IS NULL)
BEGIN
    INSERT INTO EventStaffRoles (
        EventId, Name, Description, RoleCategory,
        CanManageSchedule, CanManageCourts, CanRecordScores,
        CanCheckInPlayers, CanManageLineups, CanViewAllData, CanFullyManageEvent,
        AllowSelfRegistration, SortOrder, IsActive, CreatedAt, UpdatedAt
    ) VALUES (
        NULL, 'Spectator', 'Event spectator/attendee - no staff permissions', 'Spectator',
        0, 0, 0, 0, 0, 0, 0,
        1, 100, 1, GETDATE(), GETDATE()
    )
    PRINT 'Created default Spectator role template'
END
ELSE
BEGIN
    -- Update existing Spectator role to have correct category
    UPDATE EventStaffRoles
    SET RoleCategory = 'Spectator', UpdatedAt = GETDATE()
    WHERE Name = 'Spectator' AND EventId IS NULL
    PRINT 'Updated existing Spectator role with RoleCategory'
END

PRINT 'Migration 119 completed successfully'
