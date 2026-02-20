-- Migration: Add EventCourtScheduleBlocks table for Master Schedule System
-- Date: 2026-02-20
-- Author: Claude (automated)
-- Description: Creates table for master schedule blocks enabling TDs to plan
--              which divisions run on which courts at what times, with dependencies.

-- Check if table already exists
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EventCourtScheduleBlocks')
BEGIN
    CREATE TABLE EventCourtScheduleBlocks (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        
        -- Event and Division references
        EventId INT NOT NULL,
        DivisionId INT NOT NULL,
        PhaseId INT NULL,
        
        -- Phase type for display (e.g., "RR", "QF", "SF", "Bronze", "Gold")
        PhaseType NVARCHAR(30) NULL,
        
        -- Human-readable label for the block
        BlockLabel NVARCHAR(100) NULL,
        
        -- Courts assigned to this block (JSON array of court IDs)
        CourtIdsJson NVARCHAR(500) NULL,
        
        -- Schedule times
        StartTime DATETIME2 NOT NULL,
        EndTime DATETIME2 NOT NULL,
        
        -- Dependency (handoff) support
        DependsOnBlockId INT NULL,
        DependencyBufferMinutes INT NOT NULL DEFAULT 0,
        
        -- Ordering and metadata
        SortOrder INT NOT NULL DEFAULT 0,
        Notes NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        
        -- Scheduling info
        EstimatedMatchDurationMinutes INT NULL,
        EncounterCount INT NULL,
        LastScheduledAt DATETIME2 NULL,
        
        -- Audit fields
        CreatedByUserId INT NULL,
        UpdatedByUserId INT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Foreign keys
        CONSTRAINT FK_EventCourtScheduleBlocks_Events FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EventCourtScheduleBlocks_EventDivisions FOREIGN KEY (DivisionId) REFERENCES EventDivisions(Id),
        CONSTRAINT FK_EventCourtScheduleBlocks_DivisionPhases FOREIGN KEY (PhaseId) REFERENCES DivisionPhases(Id),
        CONSTRAINT FK_EventCourtScheduleBlocks_DependsOnBlock FOREIGN KEY (DependsOnBlockId) REFERENCES EventCourtScheduleBlocks(Id),
        CONSTRAINT FK_EventCourtScheduleBlocks_CreatedByUser FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id),
        CONSTRAINT FK_EventCourtScheduleBlocks_UpdatedByUser FOREIGN KEY (UpdatedByUserId) REFERENCES Users(Id)
    );

    -- Index for fast event lookup
    CREATE INDEX IX_EventCourtScheduleBlocks_EventId ON EventCourtScheduleBlocks(EventId);
    
    -- Index for division filtering
    CREATE INDEX IX_EventCourtScheduleBlocks_DivisionId ON EventCourtScheduleBlocks(DivisionId);
    
    -- Index for phase filtering
    CREATE INDEX IX_EventCourtScheduleBlocks_PhaseId ON EventCourtScheduleBlocks(PhaseId) WHERE PhaseId IS NOT NULL;
    
    -- Index for ordering
    CREATE INDEX IX_EventCourtScheduleBlocks_SortOrder ON EventCourtScheduleBlocks(EventId, SortOrder);
    
    -- Index for dependency lookups
    CREATE INDEX IX_EventCourtScheduleBlocks_DependsOnBlockId ON EventCourtScheduleBlocks(DependsOnBlockId) WHERE DependsOnBlockId IS NOT NULL;

    PRINT 'Created EventCourtScheduleBlocks table with indexes';
END
ELSE
BEGIN
    PRINT 'EventCourtScheduleBlocks table already exists - skipping';
END
GO
