-- Migration 113: Division Phases and Slot-Based Scheduling
-- Implements multi-phase tournament support:
-- 1. DivisionPhases - Tournament phases (Pool Play, Quarterfinals, etc.)
-- 2. PhaseSlots - Placeholder-based unit assignment for pre-built schedules
-- 3. EventEncounters extensions - Phase and slot references

PRINT 'Starting Migration 113 - Division Phases and Slot-Based Scheduling'

-- =====================================================
-- 1. DivisionPhases (tournament phases within divisions)
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DivisionPhases')
BEGIN
    CREATE TABLE DivisionPhases (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        DivisionId INT NOT NULL,
        -- Phase ordering
        PhaseOrder INT NOT NULL DEFAULT 1,
        -- Phase configuration
        PhaseType NVARCHAR(30) NOT NULL DEFAULT 'RoundRobin',  -- RoundRobin, SingleElimination, DoubleElimination, Swiss, Pools, Bracket
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        -- Slot counts
        IncomingSlotCount INT NOT NULL DEFAULT 0,  -- Units entering this phase
        AdvancingSlotCount INT NOT NULL DEFAULT 0, -- Units advancing to next phase
        -- Status
        Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',  -- Pending, InProgress, Completed, Locked
        -- Ranking configuration (JSON)
        RankingCriteria NVARCHAR(1000) NULL,  -- {"primary":"wins","secondary":"point_diff","tertiary":"head_to_head"}
        -- Reseeding between phases
        ReseedOption NVARCHAR(30) NULL DEFAULT 'PreserveSeeds',  -- PreserveSeeds, ReseedByStandings, Random
        -- Phase-type specific settings (JSON)
        Settings NVARCHAR(2000) NULL,  -- {"consolation":true,"third_place_match":true}
        -- Overrides
        BestOf INT NULL,  -- Override division default
        ScoreFormatId INT NULL,
        -- Lock state
        IsManuallyLocked BIT NOT NULL DEFAULT 0,
        LockedAt DATETIME NULL,
        LockedByUserId INT NULL,
        -- Timestamps
        CreatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
        -- Constraints
        CONSTRAINT FK_DivisionPhases_Division FOREIGN KEY (DivisionId) REFERENCES EventDivisions(Id) ON DELETE CASCADE,
        CONSTRAINT FK_DivisionPhases_ScoreFormat FOREIGN KEY (ScoreFormatId) REFERENCES ScoreFormats(Id) ON DELETE SET NULL,
        CONSTRAINT FK_DivisionPhases_LockedBy FOREIGN KEY (LockedByUserId) REFERENCES Users(Id) ON DELETE NO ACTION
    )
    PRINT 'Created DivisionPhases table'

    -- Indexes
    CREATE INDEX IX_DivisionPhases_DivisionId ON DivisionPhases(DivisionId)
    CREATE INDEX IX_DivisionPhases_Status ON DivisionPhases(Status)
    CREATE UNIQUE INDEX IX_DivisionPhases_DivisionOrder ON DivisionPhases(DivisionId, PhaseOrder)
    PRINT 'Created indexes on DivisionPhases'
END
ELSE
BEGIN
    PRINT 'DivisionPhases table already exists'
END

-- =====================================================
-- 2. PhaseSlots (placeholder-based unit assignment)
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PhaseSlots')
BEGIN
    CREATE TABLE PhaseSlots (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        PhaseId INT NOT NULL,
        -- Slot identification
        SlotType NVARCHAR(20) NOT NULL DEFAULT 'Incoming',  -- Incoming, Advancing
        SlotNumber INT NOT NULL DEFAULT 1,  -- Position/seed within slot type
        -- Unit assignment (null until resolved)
        UnitId INT NULL,
        -- Source configuration
        SourceType NVARCHAR(20) NOT NULL DEFAULT 'Seeded',  -- Seeded, WinnerOf, LoserOf, RankFromPhase, Manual, Bye
        SourceEncounterId INT NULL,  -- For WinnerOf/LoserOf
        SourcePhaseId INT NULL,  -- For RankFromPhase
        SourceRank INT NULL,  -- For RankFromPhase (1 = 1st place, 2 = 2nd, etc.)
        SourcePoolName NVARCHAR(20) NULL,  -- For RankFromPhase with pools
        -- Display
        PlaceholderLabel NVARCHAR(100) NULL,  -- "Winner of Match 3", "Pool A #1", "TBD"
        -- Resolution tracking
        IsResolved BIT NOT NULL DEFAULT 0,
        ResolvedAt DATETIME NULL,
        WasManuallyResolved BIT NOT NULL DEFAULT 0,
        ResolvedByUserId INT NULL,
        ResolutionNotes NVARCHAR(500) NULL,
        -- Timestamps
        CreatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
        -- Constraints
        CONSTRAINT FK_PhaseSlots_Phase FOREIGN KEY (PhaseId) REFERENCES DivisionPhases(Id) ON DELETE CASCADE,
        CONSTRAINT FK_PhaseSlots_Unit FOREIGN KEY (UnitId) REFERENCES EventUnits(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_PhaseSlots_SourceEncounter FOREIGN KEY (SourceEncounterId) REFERENCES EventEncounters(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_PhaseSlots_SourcePhase FOREIGN KEY (SourcePhaseId) REFERENCES DivisionPhases(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_PhaseSlots_ResolvedBy FOREIGN KEY (ResolvedByUserId) REFERENCES Users(Id) ON DELETE NO ACTION
    )
    PRINT 'Created PhaseSlots table'

    -- Indexes
    CREATE INDEX IX_PhaseSlots_PhaseId ON PhaseSlots(PhaseId)
    CREATE INDEX IX_PhaseSlots_UnitId ON PhaseSlots(UnitId)
    CREATE INDEX IX_PhaseSlots_SourceEncounterId ON PhaseSlots(SourceEncounterId)
    CREATE INDEX IX_PhaseSlots_SourcePhaseId ON PhaseSlots(SourcePhaseId)
    CREATE INDEX IX_PhaseSlots_IsResolved ON PhaseSlots(IsResolved)
    CREATE UNIQUE INDEX IX_PhaseSlots_PhaseTypeNumber ON PhaseSlots(PhaseId, SlotType, SlotNumber)
    PRINT 'Created indexes on PhaseSlots'
END
ELSE
BEGIN
    PRINT 'PhaseSlots table already exists'
END

-- =====================================================
-- 3. Add Phase and Slot references to EventEncounters
-- =====================================================

-- PhaseId: Reference to DivisionPhase (null for legacy encounters)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'PhaseId')
BEGIN
    ALTER TABLE EventEncounters ADD PhaseId INT NULL
    PRINT 'Added PhaseId column to EventEncounters'
END
ELSE
BEGIN
    PRINT 'PhaseId column already exists in EventEncounters'
END

-- Unit1SlotId: Slot reference for Unit1 (enables placeholder-based scheduling)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'Unit1SlotId')
BEGIN
    ALTER TABLE EventEncounters ADD Unit1SlotId INT NULL
    PRINT 'Added Unit1SlotId column to EventEncounters'
END
ELSE
BEGIN
    PRINT 'Unit1SlotId column already exists in EventEncounters'
END

-- Unit2SlotId: Slot reference for Unit2
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'Unit2SlotId')
BEGIN
    ALTER TABLE EventEncounters ADD Unit2SlotId INT NULL
    PRINT 'Added Unit2SlotId column to EventEncounters'
END
ELSE
BEGIN
    PRINT 'Unit2SlotId column already exists in EventEncounters'
END

-- =====================================================
-- 4. Add Foreign Key constraints to EventEncounters
-- =====================================================

-- FK for PhaseId
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EventEncounters_Phase')
BEGIN
    ALTER TABLE EventEncounters
    ADD CONSTRAINT FK_EventEncounters_Phase FOREIGN KEY (PhaseId) REFERENCES DivisionPhases(Id) ON DELETE NO ACTION
    PRINT 'Added FK_EventEncounters_Phase constraint'
END
ELSE
BEGIN
    PRINT 'FK_EventEncounters_Phase constraint already exists'
END

-- FK for Unit1SlotId
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EventEncounters_Unit1Slot')
BEGIN
    ALTER TABLE EventEncounters
    ADD CONSTRAINT FK_EventEncounters_Unit1Slot FOREIGN KEY (Unit1SlotId) REFERENCES PhaseSlots(Id) ON DELETE NO ACTION
    PRINT 'Added FK_EventEncounters_Unit1Slot constraint'
END
ELSE
BEGIN
    PRINT 'FK_EventEncounters_Unit1Slot constraint already exists'
END

-- FK for Unit2SlotId
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EventEncounters_Unit2Slot')
BEGIN
    ALTER TABLE EventEncounters
    ADD CONSTRAINT FK_EventEncounters_Unit2Slot FOREIGN KEY (Unit2SlotId) REFERENCES PhaseSlots(Id) ON DELETE NO ACTION
    PRINT 'Added FK_EventEncounters_Unit2Slot constraint'
END
ELSE
BEGIN
    PRINT 'FK_EventEncounters_Unit2Slot constraint already exists'
END

-- =====================================================
-- 5. Add indexes to EventEncounters for new columns
-- =====================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventEncounters_PhaseId' AND object_id = OBJECT_ID('EventEncounters'))
BEGIN
    CREATE INDEX IX_EventEncounters_PhaseId ON EventEncounters(PhaseId)
    PRINT 'Created index IX_EventEncounters_PhaseId'
END
ELSE
BEGIN
    PRINT 'Index IX_EventEncounters_PhaseId already exists'
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventEncounters_Unit1SlotId' AND object_id = OBJECT_ID('EventEncounters'))
BEGIN
    CREATE INDEX IX_EventEncounters_Unit1SlotId ON EventEncounters(Unit1SlotId)
    PRINT 'Created index IX_EventEncounters_Unit1SlotId'
END
ELSE
BEGIN
    PRINT 'Index IX_EventEncounters_Unit1SlotId already exists'
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventEncounters_Unit2SlotId' AND object_id = OBJECT_ID('EventEncounters'))
BEGIN
    CREATE INDEX IX_EventEncounters_Unit2SlotId ON EventEncounters(Unit2SlotId)
    PRINT 'Created index IX_EventEncounters_Unit2SlotId'
END
ELSE
BEGIN
    PRINT 'Index IX_EventEncounters_Unit2SlotId already exists'
END

PRINT 'Migration 113 completed successfully'
