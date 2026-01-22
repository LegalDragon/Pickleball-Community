-- Migration 114: Phase-Based Scheduling Enhancements
-- Adds bracket progression, pools, court groups, awards, and advancement rules
-- for comprehensive multi-phase tournament scheduling with court assignments

PRINT 'Starting Migration 114 - Phase-Based Scheduling Enhancements'
GO

-- =====================================================
-- 1. EventEncounters - Bracket Progression Fields
-- =====================================================

-- WinnerNextEncounterId: The encounter the winner advances to
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'WinnerNextEncounterId')
BEGIN
    ALTER TABLE EventEncounters ADD WinnerNextEncounterId INT NULL
    PRINT 'Added WinnerNextEncounterId to EventEncounters'
END
GO

-- LoserNextEncounterId: The encounter the loser advances to (double elimination)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'LoserNextEncounterId')
BEGIN
    ALTER TABLE EventEncounters ADD LoserNextEncounterId INT NULL
    PRINT 'Added LoserNextEncounterId to EventEncounters'
END
GO

-- WinnerSlotPosition: Which slot (1 or 2) in the next encounter (1=Unit1, 2=Unit2)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'WinnerSlotPosition')
BEGIN
    ALTER TABLE EventEncounters ADD WinnerSlotPosition INT NULL
    PRINT 'Added WinnerSlotPosition to EventEncounters'
END
GO

-- LoserSlotPosition: Which slot in the loser bracket
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'LoserSlotPosition')
BEGIN
    ALTER TABLE EventEncounters ADD LoserSlotPosition INT NULL
    PRINT 'Added LoserSlotPosition to EventEncounters'
END
GO

-- PoolId: Reference to PhasePool for multi-pool phases
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'PoolId')
BEGIN
    ALTER TABLE EventEncounters ADD PoolId INT NULL
    PRINT 'Added PoolId to EventEncounters'
END
GO

-- EncounterLabel: Display label like "Match 1", "SF1", "Final"
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'EncounterLabel')
BEGIN
    ALTER TABLE EventEncounters ADD EncounterLabel NVARCHAR(50) NULL
    PRINT 'Added EncounterLabel to EventEncounters'
END
GO

-- EstimatedStartTime: Calculated start time based on court/sequence
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'EstimatedStartTime')
BEGIN
    ALTER TABLE EventEncounters ADD EstimatedStartTime DATETIME NULL
    PRINT 'Added EstimatedStartTime to EventEncounters'
END
GO

-- =====================================================
-- 2. PhasePools - Pools within a phase
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PhasePools')
BEGIN
    CREATE TABLE PhasePools (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        PhaseId INT NOT NULL,

        -- Pool identification
        PoolName NVARCHAR(20) NOT NULL,           -- "A", "B", "C" or "1", "2", "3"
        PoolOrder INT NOT NULL DEFAULT 1,          -- Display/processing order

        -- Pool size tracking
        SlotCount INT NOT NULL DEFAULT 4,          -- Number of slots in this pool

        -- Status
        Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',  -- Pending, InProgress, Completed

        -- Timestamps
        CreatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_PhasePools_Phase FOREIGN KEY (PhaseId)
            REFERENCES DivisionPhases(Id) ON DELETE CASCADE
    )

    CREATE INDEX IX_PhasePools_PhaseId ON PhasePools(PhaseId)
    CREATE UNIQUE INDEX IX_PhasePools_PhasePoolName ON PhasePools(PhaseId, PoolName)

    PRINT 'Created PhasePools table'
END
GO

-- =====================================================
-- 3. PhasePoolSlots - Links slots to pools
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PhasePoolSlots')
BEGIN
    CREATE TABLE PhasePoolSlots (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        PoolId INT NOT NULL,
        SlotId INT NOT NULL,

        -- Position within pool (for seeding/ordering)
        PoolPosition INT NOT NULL DEFAULT 1,

        CONSTRAINT FK_PhasePoolSlots_Pool FOREIGN KEY (PoolId)
            REFERENCES PhasePools(Id) ON DELETE CASCADE,
        CONSTRAINT FK_PhasePoolSlots_Slot FOREIGN KEY (SlotId)
            REFERENCES PhaseSlots(Id) ON DELETE NO ACTION
    )

    CREATE INDEX IX_PhasePoolSlots_PoolId ON PhasePoolSlots(PoolId)
    CREATE UNIQUE INDEX IX_PhasePoolSlots_PoolSlot ON PhasePoolSlots(PoolId, SlotId)

    PRINT 'Created PhasePoolSlots table'
END
GO

-- =====================================================
-- 4. PhaseAdvancementRules - Mapping between phases
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PhaseAdvancementRules')
BEGIN
    CREATE TABLE PhaseAdvancementRules (
        Id INT IDENTITY(1,1) PRIMARY KEY,

        -- Source phase and position
        SourcePhaseId INT NOT NULL,
        SourcePoolId INT NULL,                     -- NULL for overall phase ranking
        SourceRank INT NOT NULL,                   -- 1 = 1st place, 2 = 2nd, etc.

        -- Target phase and slot
        TargetPhaseId INT NOT NULL,
        TargetSlotNumber INT NOT NULL,             -- Which incoming slot in target phase

        -- Description for display
        Description NVARCHAR(200) NULL,            -- "Pool A 1st -> Semifinal Slot 1"

        -- Processing order (for complex advancement scenarios)
        ProcessOrder INT NOT NULL DEFAULT 1,

        CreatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_PhaseAdvancementRules_SourcePhase FOREIGN KEY (SourcePhaseId)
            REFERENCES DivisionPhases(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_PhaseAdvancementRules_SourcePool FOREIGN KEY (SourcePoolId)
            REFERENCES PhasePools(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_PhaseAdvancementRules_TargetPhase FOREIGN KEY (TargetPhaseId)
            REFERENCES DivisionPhases(Id) ON DELETE CASCADE
    )

    CREATE INDEX IX_PhaseAdvancementRules_SourcePhase ON PhaseAdvancementRules(SourcePhaseId)
    CREATE INDEX IX_PhaseAdvancementRules_TargetPhase ON PhaseAdvancementRules(TargetPhaseId)

    PRINT 'Created PhaseAdvancementRules table'
END
GO

-- =====================================================
-- 5. DivisionAwards - Placement awards
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DivisionAwards')
BEGIN
    CREATE TABLE DivisionAwards (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        DivisionId INT NOT NULL,

        -- Position and naming
        Position INT NOT NULL,                     -- 1, 2, 3, 4...
        AwardName NVARCHAR(100) NOT NULL,          -- "Gold", "Silver", "Bronze", "4th Place"
        AwardDescription NVARCHAR(500) NULL,       -- "Division Champion", "Runner-up"

        -- Award details
        PrizeValue NVARCHAR(100) NULL,             -- "$500", "Gift Card", etc.
        BadgeImageUrl NVARCHAR(500) NULL,          -- Medal/badge image

        -- Styling
        ColorCode NVARCHAR(20) NULL,               -- "#FFD700" for gold
        IconName NVARCHAR(50) NULL,                -- "trophy", "medal", etc.

        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,

        CreatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_DivisionAwards_Division FOREIGN KEY (DivisionId)
            REFERENCES EventDivisions(Id) ON DELETE CASCADE
    )

    CREATE INDEX IX_DivisionAwards_DivisionId ON DivisionAwards(DivisionId)
    CREATE UNIQUE INDEX IX_DivisionAwards_DivisionPosition ON DivisionAwards(DivisionId, Position)

    PRINT 'Created DivisionAwards table'
END
GO

-- =====================================================
-- 6. CourtGroups - Logical grouping of courts
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CourtGroups')
BEGIN
    CREATE TABLE CourtGroups (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventId INT NOT NULL,

        -- Group identification
        GroupName NVARCHAR(100) NOT NULL,          -- "Courts 1-4", "Championship Courts", "Warm-up Area"
        GroupCode NVARCHAR(20) NULL,               -- "A", "B", "CHAMP"
        Description NVARCHAR(500) NULL,

        -- Location info
        LocationArea NVARCHAR(100) NULL,           -- "North Side", "Indoor", "Main Arena"

        -- Capacity
        CourtCount INT NOT NULL DEFAULT 0,         -- Auto-calculated from assigned courts

        -- Priority/preference
        Priority INT NOT NULL DEFAULT 0,           -- Higher = preferred for important matches

        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,

        CreatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_CourtGroups_Event FOREIGN KEY (EventId)
            REFERENCES Events(Id) ON DELETE CASCADE
    )

    CREATE INDEX IX_CourtGroups_EventId ON CourtGroups(EventId)

    PRINT 'Created CourtGroups table'
END
GO

-- =====================================================
-- 7. TournamentCourts - Add CourtGroupId
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TournamentCourts') AND name = 'CourtGroupId')
BEGIN
    ALTER TABLE TournamentCourts ADD CourtGroupId INT NULL
    PRINT 'Added CourtGroupId to TournamentCourts'
END
GO

-- Add FK constraint for CourtGroupId
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_TournamentCourts_CourtGroup')
BEGIN
    ALTER TABLE TournamentCourts
    ADD CONSTRAINT FK_TournamentCourts_CourtGroup FOREIGN KEY (CourtGroupId)
        REFERENCES CourtGroups(Id) ON DELETE SET NULL
    PRINT 'Added FK_TournamentCourts_CourtGroup constraint'
END
GO

-- =====================================================
-- 8. DivisionPhases - Add timing and pool fields
-- =====================================================

-- PoolCount: Number of pools in this phase
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DivisionPhases') AND name = 'PoolCount')
BEGIN
    ALTER TABLE DivisionPhases ADD PoolCount INT NOT NULL DEFAULT 1
    PRINT 'Added PoolCount to DivisionPhases'
END
GO

-- StartTime: When this phase is scheduled to begin
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DivisionPhases') AND name = 'StartTime')
BEGIN
    ALTER TABLE DivisionPhases ADD StartTime DATETIME NULL
    PRINT 'Added StartTime to DivisionPhases'
END
GO

-- EstimatedEndTime: Calculated based on matches and duration
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DivisionPhases') AND name = 'EstimatedEndTime')
BEGIN
    ALTER TABLE DivisionPhases ADD EstimatedEndTime DATETIME NULL
    PRINT 'Added EstimatedEndTime to DivisionPhases'
END
GO

-- EstimatedMatchDurationMinutes: Override for this phase
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DivisionPhases') AND name = 'EstimatedMatchDurationMinutes')
BEGIN
    ALTER TABLE DivisionPhases ADD EstimatedMatchDurationMinutes INT NULL
    PRINT 'Added EstimatedMatchDurationMinutes to DivisionPhases'
END
GO

-- =====================================================
-- 9. DivisionCourtAssignments - Assign court groups to divisions/phases
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DivisionCourtAssignments')
BEGIN
    CREATE TABLE DivisionCourtAssignments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        DivisionId INT NOT NULL,
        PhaseId INT NULL,                          -- NULL = applies to entire division
        CourtGroupId INT NOT NULL,

        -- Priority within division (lower = higher priority)
        Priority INT NOT NULL DEFAULT 0,

        -- Time restrictions (optional)
        ValidFromTime TIME NULL,                   -- Court group available from this time
        ValidToTime TIME NULL,                     -- Court group available until this time

        IsActive BIT NOT NULL DEFAULT 1,

        CreatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_DivisionCourtAssignments_Division FOREIGN KEY (DivisionId)
            REFERENCES EventDivisions(Id) ON DELETE CASCADE,
        CONSTRAINT FK_DivisionCourtAssignments_Phase FOREIGN KEY (PhaseId)
            REFERENCES DivisionPhases(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_DivisionCourtAssignments_CourtGroup FOREIGN KEY (CourtGroupId)
            REFERENCES CourtGroups(Id) ON DELETE CASCADE
    )

    CREATE INDEX IX_DivisionCourtAssignments_Division ON DivisionCourtAssignments(DivisionId)
    CREATE INDEX IX_DivisionCourtAssignments_Phase ON DivisionCourtAssignments(PhaseId)
    CREATE INDEX IX_DivisionCourtAssignments_CourtGroup ON DivisionCourtAssignments(CourtGroupId)

    PRINT 'Created DivisionCourtAssignments table'
END
GO

-- =====================================================
-- 10. Add FK constraints to EventEncounters
-- =====================================================

-- FK for WinnerNextEncounterId
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EventEncounters_WinnerNext')
BEGIN
    ALTER TABLE EventEncounters
    ADD CONSTRAINT FK_EventEncounters_WinnerNext FOREIGN KEY (WinnerNextEncounterId)
        REFERENCES EventEncounters(Id) ON DELETE NO ACTION
    PRINT 'Added FK_EventEncounters_WinnerNext constraint'
END
GO

-- FK for LoserNextEncounterId
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EventEncounters_LoserNext')
BEGIN
    ALTER TABLE EventEncounters
    ADD CONSTRAINT FK_EventEncounters_LoserNext FOREIGN KEY (LoserNextEncounterId)
        REFERENCES EventEncounters(Id) ON DELETE NO ACTION
    PRINT 'Added FK_EventEncounters_LoserNext constraint'
END
GO

-- FK for PoolId
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EventEncounters_Pool')
BEGIN
    ALTER TABLE EventEncounters
    ADD CONSTRAINT FK_EventEncounters_Pool FOREIGN KEY (PoolId)
        REFERENCES PhasePools(Id) ON DELETE NO ACTION
    PRINT 'Added FK_EventEncounters_Pool constraint'
END
GO

-- =====================================================
-- 11. Create indexes for new columns
-- =====================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventEncounters_WinnerNextEncounterId')
BEGIN
    CREATE INDEX IX_EventEncounters_WinnerNextEncounterId ON EventEncounters(WinnerNextEncounterId)
    PRINT 'Created IX_EventEncounters_WinnerNextEncounterId index'
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventEncounters_LoserNextEncounterId')
BEGIN
    CREATE INDEX IX_EventEncounters_LoserNextEncounterId ON EventEncounters(LoserNextEncounterId)
    PRINT 'Created IX_EventEncounters_LoserNextEncounterId index'
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventEncounters_PoolId')
BEGIN
    CREATE INDEX IX_EventEncounters_PoolId ON EventEncounters(PoolId)
    PRINT 'Created IX_EventEncounters_PoolId index'
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventEncounters_EstimatedStartTime')
BEGIN
    CREATE INDEX IX_EventEncounters_EstimatedStartTime ON EventEncounters(EstimatedStartTime)
    PRINT 'Created IX_EventEncounters_EstimatedStartTime index'
END
GO

PRINT 'Migration 114 - Phase-Based Scheduling Enhancements completed successfully'
GO
