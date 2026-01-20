-- Migration 112: Event Staff System and Division Court Blocks
-- Implements:
-- 1. Staff self-registration with admin override
-- 2. Division-to-court pre-allocation with priority order
-- 3. Scheduling constraints (minimum rest time between matches)

PRINT 'Starting Migration 112 - Event Staff and Court Blocks'

-- =====================================================
-- 1. Event Staff Roles (configurable roles per event)
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EventStaffRoles')
BEGIN
    CREATE TABLE EventStaffRoles (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventId INT NULL,  -- NULL = global/default role template
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        -- Permissions flags
        CanManageSchedule BIT NOT NULL DEFAULT 0,
        CanManageCourts BIT NOT NULL DEFAULT 0,
        CanRecordScores BIT NOT NULL DEFAULT 0,
        CanCheckInPlayers BIT NOT NULL DEFAULT 0,
        CanManageLineups BIT NOT NULL DEFAULT 0,
        CanViewAllData BIT NOT NULL DEFAULT 0,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_EventStaffRoles_Event FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE CASCADE
    )
    PRINT 'Created EventStaffRoles table'

    -- Create index on EventId
    CREATE INDEX IX_EventStaffRoles_EventId ON EventStaffRoles(EventId)
    PRINT 'Created index on EventStaffRoles.EventId'

    -- Seed default global roles
    INSERT INTO EventStaffRoles (EventId, Name, Description, CanManageSchedule, CanManageCourts, CanRecordScores, CanCheckInPlayers, CanManageLineups, CanViewAllData, SortOrder)
    VALUES
        (NULL, 'Tournament Director', 'Full control over event operations', 1, 1, 1, 1, 1, 1, 1),
        (NULL, 'Court Manager', 'Manages court assignments and game flow', 0, 1, 1, 0, 0, 1, 2),
        (NULL, 'Score Keeper', 'Records game scores', 0, 0, 1, 0, 0, 0, 3),
        (NULL, 'Check-In Staff', 'Handles player check-in', 0, 0, 0, 1, 0, 0, 4),
        (NULL, 'Lineup Manager', 'Manages team lineups for matches', 0, 0, 0, 0, 1, 0, 5),
        (NULL, 'Volunteer', 'General event assistance', 0, 0, 0, 0, 0, 0, 6)
    PRINT 'Seeded default global staff roles'
END
ELSE
BEGIN
    PRINT 'EventStaffRoles table already exists'
END

-- =====================================================
-- 2. Event Staff (staff assignments with self-registration)
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EventStaff')
BEGIN
    CREATE TABLE EventStaff (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventId INT NOT NULL,
        UserId INT NOT NULL,
        RoleId INT NULL,  -- Reference to EventStaffRoles
        -- Registration tracking
        IsSelfRegistered BIT NOT NULL DEFAULT 0,  -- True if user registered themselves
        Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',  -- Pending, Approved, Active, Declined, Removed
        -- Priority for role assignment (admin can set)
        Priority INT NOT NULL DEFAULT 0,  -- Higher = more preferred for assignments
        -- Availability
        AvailableFrom DATETIME NULL,  -- Optional: when they're available
        AvailableTo DATETIME NULL,
        -- Notes
        SelfRegistrationNotes NVARCHAR(500) NULL,  -- Notes from the volunteer
        AdminNotes NVARCHAR(500) NULL,  -- Notes from admin
        -- Assignment tracking
        AssignedByUserId INT NULL,  -- Who approved/assigned this staff
        AssignedAt DATETIME NULL,
        -- Timestamps
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_EventStaff_Event FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EventStaff_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventStaff_Role FOREIGN KEY (RoleId) REFERENCES EventStaffRoles(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventStaff_AssignedBy FOREIGN KEY (AssignedByUserId) REFERENCES Users(Id) ON DELETE NO ACTION
    )
    PRINT 'Created EventStaff table'

    -- Create indexes
    CREATE INDEX IX_EventStaff_EventId ON EventStaff(EventId)
    CREATE INDEX IX_EventStaff_UserId ON EventStaff(UserId)
    CREATE INDEX IX_EventStaff_Status ON EventStaff(Status)
    CREATE UNIQUE INDEX IX_EventStaff_EventUser ON EventStaff(EventId, UserId)
    PRINT 'Created indexes on EventStaff'
END
ELSE
BEGIN
    PRINT 'EventStaff table already exists'
END

-- =====================================================
-- 3. Division Court Blocks (court pre-allocation)
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DivisionCourtBlocks')
BEGIN
    CREATE TABLE DivisionCourtBlocks (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        DivisionId INT NOT NULL,
        TournamentCourtId INT NOT NULL,
        -- Priority order (lower = higher priority, used first)
        Priority INT NOT NULL DEFAULT 0,
        -- Intended timing
        IntendedStartTime DATETIME NULL,
        IntendedEndTime DATETIME NULL,
        -- Notes for organizers
        Notes NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_DivisionCourtBlocks_Division FOREIGN KEY (DivisionId) REFERENCES EventDivisions(Id) ON DELETE CASCADE,
        CONSTRAINT FK_DivisionCourtBlocks_Court FOREIGN KEY (TournamentCourtId) REFERENCES TournamentCourts(Id) ON DELETE NO ACTION
    )
    PRINT 'Created DivisionCourtBlocks table'

    -- Create indexes
    CREATE INDEX IX_DivisionCourtBlocks_DivisionId ON DivisionCourtBlocks(DivisionId)
    CREATE INDEX IX_DivisionCourtBlocks_CourtId ON DivisionCourtBlocks(TournamentCourtId)
    CREATE INDEX IX_DivisionCourtBlocks_Priority ON DivisionCourtBlocks(DivisionId, Priority)
    CREATE UNIQUE INDEX IX_DivisionCourtBlocks_DivisionCourt ON DivisionCourtBlocks(DivisionId, TournamentCourtId)
    PRINT 'Created indexes on DivisionCourtBlocks'
END
ELSE
BEGIN
    PRINT 'DivisionCourtBlocks table already exists'
END

-- =====================================================
-- 4. Add scheduling constraints to EventDivisions
-- =====================================================

-- MinRestTimeMinutes: Minimum rest time between matches for the same team/unit
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventDivisions') AND name = 'MinRestTimeMinutes')
BEGIN
    ALTER TABLE EventDivisions ADD MinRestTimeMinutes INT NULL DEFAULT 15
    PRINT 'Added MinRestTimeMinutes column to EventDivisions (default 15 minutes)'
END
ELSE
BEGIN
    PRINT 'MinRestTimeMinutes column already exists in EventDivisions'
END

-- EstimatedMatchDurationMinutes: Helps with scheduling calculations
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventDivisions') AND name = 'EstimatedMatchDurationMinutes')
BEGIN
    ALTER TABLE EventDivisions ADD EstimatedMatchDurationMinutes INT NULL DEFAULT 20
    PRINT 'Added EstimatedMatchDurationMinutes column to EventDivisions (default 20 minutes)'
END
ELSE
BEGIN
    PRINT 'EstimatedMatchDurationMinutes column already exists in EventDivisions'
END

PRINT 'Migration 112 completed successfully'
