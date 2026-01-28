-- Migration_138_TreasurerRole.sql
-- Adds CanManagePayments permission and creates Treasurer role

PRINT 'Starting Migration 138: Treasurer Role and Payment Permission'
GO

-- Add CanManagePayments column to EventStaffRoles
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('EventStaffRoles') AND name = 'CanManagePayments')
BEGIN
    PRINT 'Adding CanManagePayments column to EventStaffRoles'
    ALTER TABLE EventStaffRoles ADD CanManagePayments BIT NOT NULL DEFAULT 0
    PRINT 'Added CanManagePayments column'
END
ELSE
BEGIN
    PRINT 'CanManagePayments column already exists'
END
GO

-- Update Tournament Director role to have all permissions including CanManagePayments
UPDATE EventStaffRoles
SET CanManagePayments = 1,
    CanFullyManageEvent = 1,
    CanManageSchedule = 1,
    CanManageCourts = 1,
    CanRecordScores = 1,
    CanCheckInPlayers = 1,
    CanManageLineups = 1,
    CanViewAllData = 1,
    UpdatedAt = GETDATE()
WHERE Name = 'Tournament Director' AND EventId IS NULL
PRINT 'Updated Tournament Director role with all permissions'
GO

-- Update Event Admin role to have all permissions including CanManagePayments
UPDATE EventStaffRoles
SET CanManagePayments = 1,
    UpdatedAt = GETDATE()
WHERE Name = 'Event Admin' AND EventId IS NULL
PRINT 'Updated Event Admin role with CanManagePayments'
GO

-- Create Treasurer role if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM EventStaffRoles WHERE Name = 'Treasurer' AND EventId IS NULL)
BEGIN
    PRINT 'Creating Treasurer global role'
    INSERT INTO EventStaffRoles (
        EventId, Name, Description, RoleCategory,
        CanManageSchedule, CanManageCourts, CanRecordScores,
        CanCheckInPlayers, CanManageLineups, CanViewAllData,
        CanManagePayments, CanFullyManageEvent,
        AllowSelfRegistration, SortOrder, IsActive, CreatedAt, UpdatedAt
    )
    VALUES (
        NULL, -- Global role
        'Treasurer',
        'Manages payments, refunds, and financial records for the event',
        'Staff',
        0, -- CanManageSchedule
        0, -- CanManageCourts
        0, -- CanRecordScores
        0, -- CanCheckInPlayers
        0, -- CanManageLineups
        1, -- CanViewAllData (needs to see player info for payments)
        1, -- CanManagePayments
        0, -- CanFullyManageEvent
        0, -- AllowSelfRegistration (admin assign only)
        15, -- SortOrder (after TD and before volunteers)
        1, -- IsActive
        GETDATE(),
        GETDATE()
    )
    PRINT 'Created Treasurer role'
END
ELSE
BEGIN
    PRINT 'Treasurer role already exists'
END
GO

PRINT 'Migration 138 completed: Treasurer Role and Payment Permission'
GO
