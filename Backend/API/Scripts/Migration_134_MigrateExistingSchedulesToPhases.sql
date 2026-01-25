-- Migration 134: Migrate Existing Schedules to Phase-Based Format
-- Converts legacy EventEncounters (without PhaseId) to the new phase-based structure:
-- 1. Creates a default DivisionPhase for each division with existing encounters
-- 2. Creates PhaseSlots for each unit participating in the division
-- 3. Links encounters to the phase and slots
-- This migration is idempotent and safe to run multiple times.

PRINT 'Starting Migration 134 - Migrate Existing Schedules to Phases'

-- =====================================================
-- Step 1: Create DivisionPhases for divisions that have
--         encounters without a PhaseId
-- =====================================================

PRINT 'Step 1: Creating DivisionPhases for legacy schedules...'

-- Find all divisions that have encounters without a PhaseId
-- and don't already have a phase created
INSERT INTO DivisionPhases (
    DivisionId,
    PhaseOrder,
    PhaseType,
    Name,
    Description,
    IncomingSlotCount,
    AdvancingSlotCount,
    Status,
    RankingCriteria,
    ReseedOption,
    Settings,
    BestOf,
    ScoreFormatId,
    PoolCount,
    IsManuallyLocked,
    CreatedAt,
    UpdatedAt
)
SELECT DISTINCT
    d.Id AS DivisionId,
    1 AS PhaseOrder,  -- First (and only) phase for migrated schedules
    CASE
        WHEN d.ScheduleType = 'RoundRobin' THEN 'RoundRobin'
        WHEN d.ScheduleType = 'RoundRobinPlayoff' THEN 'RoundRobin'
        WHEN d.ScheduleType = 'SingleElimination' THEN 'SingleElimination'
        WHEN d.ScheduleType = 'DoubleElimination' THEN 'DoubleElimination'
        WHEN d.ScheduleType = 'Hybrid' THEN 'RoundRobin'
        WHEN d.ScheduleType = 'RandomPairing' THEN 'RoundRobin'
        ELSE 'RoundRobin'
    END AS PhaseType,
    CASE
        WHEN d.ScheduleType = 'RoundRobin' THEN 'Round Robin'
        WHEN d.ScheduleType = 'RoundRobinPlayoff' THEN 'Pool Play'
        WHEN d.ScheduleType = 'SingleElimination' THEN 'Bracket'
        WHEN d.ScheduleType = 'DoubleElimination' THEN 'Double Elimination Bracket'
        WHEN d.ScheduleType = 'Hybrid' THEN 'Round Robin'
        WHEN d.ScheduleType = 'RandomPairing' THEN 'Random Pairing'
        ELSE 'Main Draw'
    END AS Name,
    'Migrated from legacy schedule format' AS Description,
    (SELECT COUNT(DISTINCT u.Id)
     FROM EventUnits u
     WHERE u.DivisionId = d.Id AND u.IsActive = 1) AS IncomingSlotCount,
    0 AS AdvancingSlotCount,  -- Legacy phases don't advance to another phase
    CASE
        WHEN d.ScheduleStatus = 'Finalized' THEN 'Completed'
        WHEN d.ScheduleStatus = 'UnitsAssigned' THEN 'InProgress'
        WHEN d.ScheduleStatus = 'TemplateReady' THEN 'Pending'
        ELSE 'Pending'
    END AS Status,
    '{"primary":"wins","secondary":"point_diff","tertiary":"head_to_head"}' AS RankingCriteria,
    'PreserveSeeds' AS ReseedOption,
    NULL AS Settings,
    d.GamesPerMatch AS BestOf,
    d.DefaultScoreFormatId AS ScoreFormatId,
    ISNULL(d.PoolCount, 1) AS PoolCount,
    0 AS IsManuallyLocked,
    GETUTCDATE() AS CreatedAt,
    GETUTCDATE() AS UpdatedAt
FROM EventDivisions d
WHERE EXISTS (
    -- Has encounters without a PhaseId
    SELECT 1 FROM EventEncounters e
    WHERE e.DivisionId = d.Id AND e.PhaseId IS NULL
)
AND NOT EXISTS (
    -- Doesn't already have a phase
    SELECT 1 FROM DivisionPhases p WHERE p.DivisionId = d.Id
)
AND d.IsActive = 1

DECLARE @PhasesCreated INT = @@ROWCOUNT
PRINT 'Created ' + CAST(@PhasesCreated AS VARCHAR(10)) + ' DivisionPhases'

-- =====================================================
-- Step 2: Create PhaseSlots for each unit in the division
-- =====================================================

PRINT 'Step 2: Creating PhaseSlots for units in migrated divisions...'

-- Create a slot for each unit that appears in encounters
-- Use Unit1Number or Unit2Number as the seed position if available
-- Otherwise, use a ROW_NUMBER() based on when they first appear

;WITH UnitsInEncounters AS (
    -- Get all unique units from encounters, with their assigned seed numbers
    SELECT DISTINCT
        e.DivisionId,
        u.Id AS UnitId,
        -- Try to get the seed number from encounters (Unit1Number when this unit is Unit1)
        MIN(CASE WHEN e.Unit1Id = u.Id THEN e.Unit1Number ELSE NULL END) AS SeedNumber1,
        MIN(CASE WHEN e.Unit2Id = u.Id THEN e.Unit2Number ELSE NULL END) AS SeedNumber2
    FROM EventEncounters e
    INNER JOIN EventUnits u ON u.Id = e.Unit1Id OR u.Id = e.Unit2Id
    WHERE e.PhaseId IS NULL
      AND u.IsActive = 1
    GROUP BY e.DivisionId, u.Id
),
UnitsWithSeeds AS (
    SELECT
        u.DivisionId,
        u.UnitId,
        COALESCE(u.SeedNumber1, u.SeedNumber2, ROW_NUMBER() OVER (PARTITION BY u.DivisionId ORDER BY u.UnitId)) AS SlotNumber
    FROM UnitsInEncounters u
)
INSERT INTO PhaseSlots (
    PhaseId,
    SlotType,
    SlotNumber,
    UnitId,
    SourceType,
    SourceEncounterId,
    SourcePhaseId,
    SourceRank,
    SourcePoolName,
    PlaceholderLabel,
    IsResolved,
    ResolvedAt,
    WasManuallyResolved,
    ResolvedByUserId,
    ResolutionNotes,
    CreatedAt,
    UpdatedAt
)
SELECT
    p.Id AS PhaseId,
    'Incoming' AS SlotType,
    u.SlotNumber,
    u.UnitId,
    'Seeded' AS SourceType,
    NULL AS SourceEncounterId,
    NULL AS SourcePhaseId,
    NULL AS SourceRank,
    NULL AS SourcePoolName,
    'Seed ' + CAST(u.SlotNumber AS VARCHAR(10)) AS PlaceholderLabel,
    1 AS IsResolved,  -- Already resolved since unit is assigned
    GETUTCDATE() AS ResolvedAt,
    0 AS WasManuallyResolved,
    NULL AS ResolvedByUserId,
    'Migrated from legacy schedule' AS ResolutionNotes,
    GETUTCDATE() AS CreatedAt,
    GETUTCDATE() AS UpdatedAt
FROM UnitsWithSeeds u
INNER JOIN DivisionPhases p ON p.DivisionId = u.DivisionId AND p.PhaseOrder = 1
WHERE NOT EXISTS (
    -- Don't create duplicate slots
    SELECT 1 FROM PhaseSlots ps
    WHERE ps.PhaseId = p.Id AND ps.UnitId = u.UnitId
)

DECLARE @SlotsCreated INT = @@ROWCOUNT
PRINT 'Created ' + CAST(@SlotsCreated AS VARCHAR(10)) + ' PhaseSlots'

-- =====================================================
-- Step 3: Update EventEncounters with PhaseId
-- =====================================================

PRINT 'Step 3: Updating EventEncounters with PhaseId...'

UPDATE e
SET
    e.PhaseId = p.Id,
    e.UpdatedAt = GETUTCDATE()
FROM EventEncounters e
INNER JOIN DivisionPhases p ON p.DivisionId = e.DivisionId AND p.PhaseOrder = 1
WHERE e.PhaseId IS NULL

DECLARE @EncountersUpdatedPhase INT = @@ROWCOUNT
PRINT 'Updated ' + CAST(@EncountersUpdatedPhase AS VARCHAR(10)) + ' encounters with PhaseId'

-- =====================================================
-- Step 4: Update EventEncounters with Unit1SlotId and Unit2SlotId
-- =====================================================

PRINT 'Step 4: Linking encounters to slots...'

-- Update Unit1SlotId
UPDATE e
SET
    e.Unit1SlotId = ps.Id,
    e.UpdatedAt = GETUTCDATE()
FROM EventEncounters e
INNER JOIN DivisionPhases p ON p.Id = e.PhaseId
INNER JOIN PhaseSlots ps ON ps.PhaseId = p.Id AND ps.UnitId = e.Unit1Id
WHERE e.Unit1SlotId IS NULL
  AND e.Unit1Id IS NOT NULL

DECLARE @Slot1Updated INT = @@ROWCOUNT
PRINT 'Updated ' + CAST(@Slot1Updated AS VARCHAR(10)) + ' encounters with Unit1SlotId'

-- Update Unit2SlotId
UPDATE e
SET
    e.Unit2SlotId = ps.Id,
    e.UpdatedAt = GETUTCDATE()
FROM EventEncounters e
INNER JOIN DivisionPhases p ON p.Id = e.PhaseId
INNER JOIN PhaseSlots ps ON ps.PhaseId = p.Id AND ps.UnitId = e.Unit2Id
WHERE e.Unit2SlotId IS NULL
  AND e.Unit2Id IS NOT NULL

DECLARE @Slot2Updated INT = @@ROWCOUNT
PRINT 'Updated ' + CAST(@Slot2Updated AS VARCHAR(10)) + ' encounters with Unit2SlotId'

-- =====================================================
-- Step 5: Create PhasePools for multi-pool divisions
-- =====================================================

PRINT 'Step 5: Creating PhasePools for multi-pool divisions...'

-- Create pools for divisions with PoolCount > 1
-- Use RoundName from encounters to determine pool names
;WITH DistinctPools AS (
    SELECT DISTINCT
        e.PhaseId,
        e.RoundName AS PoolName
    FROM EventEncounters e
    WHERE e.PhaseId IS NOT NULL
      AND e.RoundType = 'Pool'
      AND e.RoundName IS NOT NULL
      AND e.RoundName LIKE 'Pool%'
)
INSERT INTO PhasePools (
    PhaseId,
    Name,
    SortOrder,
    CreatedAt,
    UpdatedAt
)
SELECT
    dp.PhaseId,
    dp.PoolName,
    ROW_NUMBER() OVER (PARTITION BY dp.PhaseId ORDER BY dp.PoolName) AS SortOrder,
    GETUTCDATE() AS CreatedAt,
    GETUTCDATE() AS UpdatedAt
FROM DistinctPools dp
WHERE NOT EXISTS (
    SELECT 1 FROM PhasePools pp
    WHERE pp.PhaseId = dp.PhaseId AND pp.Name = dp.PoolName
)

DECLARE @PoolsCreated INT = @@ROWCOUNT
PRINT 'Created ' + CAST(@PoolsCreated AS VARCHAR(10)) + ' PhasePools'

-- =====================================================
-- Step 6: Link encounters to pools
-- =====================================================

PRINT 'Step 6: Linking pool encounters to PhasePools...'

UPDATE e
SET
    e.PoolId = pp.Id,
    e.UpdatedAt = GETUTCDATE()
FROM EventEncounters e
INNER JOIN PhasePools pp ON pp.PhaseId = e.PhaseId AND pp.Name = e.RoundName
WHERE e.PoolId IS NULL
  AND e.RoundType = 'Pool'
  AND e.RoundName IS NOT NULL

DECLARE @PoolLinksUpdated INT = @@ROWCOUNT
PRINT 'Linked ' + CAST(@PoolLinksUpdated AS VARCHAR(10)) + ' encounters to pools'

-- =====================================================
-- Step 7: Update IncomingSlotCount on phases
-- =====================================================

PRINT 'Step 7: Updating IncomingSlotCount on phases...'

UPDATE p
SET
    p.IncomingSlotCount = (
        SELECT COUNT(*) FROM PhaseSlots ps
        WHERE ps.PhaseId = p.Id AND ps.SlotType = 'Incoming'
    ),
    p.UpdatedAt = GETUTCDATE()
FROM DivisionPhases p
WHERE p.IncomingSlotCount = 0
  OR p.IncomingSlotCount IS NULL

DECLARE @SlotCountsUpdated INT = @@ROWCOUNT
PRINT 'Updated IncomingSlotCount on ' + CAST(@SlotCountsUpdated AS VARCHAR(10)) + ' phases'

-- =====================================================
-- Summary
-- =====================================================

PRINT ''
PRINT '========================================'
PRINT 'Migration 134 Summary'
PRINT '========================================'

SELECT
    'Total DivisionPhases' AS Metric,
    COUNT(*) AS Value
FROM DivisionPhases
UNION ALL
SELECT
    'Phases with Description = Migrated',
    COUNT(*)
FROM DivisionPhases
WHERE Description LIKE '%Migrated%'
UNION ALL
SELECT
    'Total PhaseSlots',
    COUNT(*)
FROM PhaseSlots
UNION ALL
SELECT
    'Resolved PhaseSlots',
    COUNT(*)
FROM PhaseSlots
WHERE IsResolved = 1
UNION ALL
SELECT
    'EventEncounters with PhaseId',
    COUNT(*)
FROM EventEncounters
WHERE PhaseId IS NOT NULL
UNION ALL
SELECT
    'EventEncounters without PhaseId',
    COUNT(*)
FROM EventEncounters
WHERE PhaseId IS NULL
UNION ALL
SELECT
    'Encounters with Unit1SlotId',
    COUNT(*)
FROM EventEncounters
WHERE Unit1SlotId IS NOT NULL
UNION ALL
SELECT
    'Encounters with PoolId',
    COUNT(*)
FROM EventEncounters
WHERE PoolId IS NOT NULL

PRINT ''
PRINT 'Migration 134 completed successfully'
