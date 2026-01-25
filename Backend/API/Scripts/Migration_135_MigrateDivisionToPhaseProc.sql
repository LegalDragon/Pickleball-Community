-- Migration 135: Stored Procedure for On-Demand Division Migration
-- Creates sp_MigrateDivisionToPhase which can be called from application code
-- to migrate a single division to the phase-based format.

PRINT 'Starting Migration 135 - Migrate Division to Phase Stored Procedure'

-- =====================================================
-- sp_MigrateDivisionToPhase
-- Migrates a single division to the phase-based format
-- =====================================================

IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'sp_MigrateDivisionToPhase')
BEGIN
    DROP PROCEDURE sp_MigrateDivisionToPhase
    PRINT 'Dropped existing sp_MigrateDivisionToPhase'
END
GO

CREATE PROCEDURE sp_MigrateDivisionToPhase
    @DivisionId INT,
    @PhaseId INT OUTPUT,
    @SlotsCreated INT OUTPUT,
    @EncountersUpdated INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NewPhaseId INT = NULL
    SET @PhaseId = NULL
    SET @SlotsCreated = 0
    SET @EncountersUpdated = 0

    -- Check if division exists
    IF NOT EXISTS (SELECT 1 FROM EventDivisions WHERE Id = @DivisionId)
    BEGIN
        RAISERROR('Division %d does not exist', 16, 1, @DivisionId)
        RETURN
    END

    -- Check if already migrated (has a phase)
    SELECT @NewPhaseId = Id
    FROM DivisionPhases
    WHERE DivisionId = @DivisionId AND PhaseOrder = 1

    IF @NewPhaseId IS NOT NULL
    BEGIN
        -- Already has a phase, just return its ID
        SET @PhaseId = @NewPhaseId

        -- Update any encounters without PhaseId
        UPDATE e
        SET e.PhaseId = @NewPhaseId, e.UpdatedAt = GETUTCDATE()
        FROM EventEncounters e
        WHERE e.DivisionId = @DivisionId AND e.PhaseId IS NULL

        SET @EncountersUpdated = @@ROWCOUNT
        RETURN
    END

    -- Check if division has encounters
    IF NOT EXISTS (SELECT 1 FROM EventEncounters WHERE DivisionId = @DivisionId)
    BEGIN
        -- No encounters, nothing to migrate
        RETURN
    END

    BEGIN TRANSACTION

    BEGIN TRY
        -- Get division info for phase creation
        DECLARE @ScheduleType NVARCHAR(30)
        DECLARE @ScheduleStatus NVARCHAR(20)
        DECLARE @GamesPerMatch INT
        DECLARE @ScoreFormatId INT
        DECLARE @PoolCount INT

        SELECT
            @ScheduleType = ScheduleType,
            @ScheduleStatus = ScheduleStatus,
            @GamesPerMatch = GamesPerMatch,
            @ScoreFormatId = DefaultScoreFormatId,
            @PoolCount = ISNULL(PoolCount, 1)
        FROM EventDivisions
        WHERE Id = @DivisionId

        -- Create the DivisionPhase
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
            BestOf,
            ScoreFormatId,
            PoolCount,
            IsManuallyLocked,
            CreatedAt,
            UpdatedAt
        )
        VALUES (
            @DivisionId,
            1,
            CASE
                WHEN @ScheduleType = 'RoundRobin' THEN 'RoundRobin'
                WHEN @ScheduleType = 'RoundRobinPlayoff' THEN 'RoundRobin'
                WHEN @ScheduleType = 'SingleElimination' THEN 'SingleElimination'
                WHEN @ScheduleType = 'DoubleElimination' THEN 'DoubleElimination'
                WHEN @ScheduleType = 'Hybrid' THEN 'RoundRobin'
                WHEN @ScheduleType = 'RandomPairing' THEN 'RoundRobin'
                ELSE 'RoundRobin'
            END,
            CASE
                WHEN @ScheduleType = 'RoundRobin' THEN 'Round Robin'
                WHEN @ScheduleType = 'RoundRobinPlayoff' THEN 'Pool Play'
                WHEN @ScheduleType = 'SingleElimination' THEN 'Bracket'
                WHEN @ScheduleType = 'DoubleElimination' THEN 'Double Elimination Bracket'
                WHEN @ScheduleType = 'Hybrid' THEN 'Round Robin'
                WHEN @ScheduleType = 'RandomPairing' THEN 'Random Pairing'
                ELSE 'Main Draw'
            END,
            'Migrated from legacy schedule format',
            0, -- Will update after creating slots
            0,
            CASE
                WHEN @ScheduleStatus = 'Finalized' THEN 'Completed'
                WHEN @ScheduleStatus = 'UnitsAssigned' THEN 'InProgress'
                WHEN @ScheduleStatus = 'TemplateReady' THEN 'Pending'
                ELSE 'Pending'
            END,
            '{"primary":"wins","secondary":"point_diff","tertiary":"head_to_head"}',
            'PreserveSeeds',
            @GamesPerMatch,
            @ScoreFormatId,
            @PoolCount,
            0,
            GETUTCDATE(),
            GETUTCDATE()
        )

        SET @NewPhaseId = SCOPE_IDENTITY()
        SET @PhaseId = @NewPhaseId

        -- Create PhaseSlots for each unit
        ;WITH UnitsInEncounters AS (
            SELECT DISTINCT
                u.Id AS UnitId,
                MIN(CASE WHEN e.Unit1Id = u.Id THEN e.Unit1Number ELSE NULL END) AS SeedNumber1,
                MIN(CASE WHEN e.Unit2Id = u.Id THEN e.Unit2Number ELSE NULL END) AS SeedNumber2
            FROM EventEncounters e
            INNER JOIN EventUnits u ON u.Id = e.Unit1Id OR u.Id = e.Unit2Id
            WHERE e.DivisionId = @DivisionId
              AND u.Status NOT IN ('Cancelled', 'Waitlisted')
            GROUP BY u.Id
        ),
        UnitsWithSeeds AS (
            SELECT
                u.UnitId,
                COALESCE(u.SeedNumber1, u.SeedNumber2, ROW_NUMBER() OVER (ORDER BY u.UnitId)) AS SlotNumber
            FROM UnitsInEncounters u
        )
        INSERT INTO PhaseSlots (
            PhaseId,
            SlotType,
            SlotNumber,
            UnitId,
            SourceType,
            PlaceholderLabel,
            IsResolved,
            ResolvedAt,
            WasManuallyResolved,
            ResolutionNotes,
            CreatedAt,
            UpdatedAt
        )
        SELECT
            @NewPhaseId,
            'Incoming',
            u.SlotNumber,
            u.UnitId,
            'Seeded',
            'Seed ' + CAST(u.SlotNumber AS VARCHAR(10)),
            1,
            GETUTCDATE(),
            0,
            'Migrated from legacy schedule',
            GETUTCDATE(),
            GETUTCDATE()
        FROM UnitsWithSeeds u

        SET @SlotsCreated = @@ROWCOUNT

        -- Update IncomingSlotCount
        UPDATE DivisionPhases
        SET IncomingSlotCount = @SlotsCreated, UpdatedAt = GETUTCDATE()
        WHERE Id = @NewPhaseId

        -- Update encounters with PhaseId
        UPDATE EventEncounters
        SET PhaseId = @NewPhaseId, UpdatedAt = GETUTCDATE()
        WHERE DivisionId = @DivisionId AND PhaseId IS NULL

        SET @EncountersUpdated = @@ROWCOUNT

        -- Link encounters to slots (Unit1SlotId)
        UPDATE e
        SET e.Unit1SlotId = ps.Id, e.UpdatedAt = GETUTCDATE()
        FROM EventEncounters e
        INNER JOIN PhaseSlots ps ON ps.PhaseId = @NewPhaseId AND ps.UnitId = e.Unit1Id
        WHERE e.PhaseId = @NewPhaseId
          AND e.Unit1SlotId IS NULL
          AND e.Unit1Id IS NOT NULL

        -- Link encounters to slots (Unit2SlotId)
        UPDATE e
        SET e.Unit2SlotId = ps.Id, e.UpdatedAt = GETUTCDATE()
        FROM EventEncounters e
        INNER JOIN PhaseSlots ps ON ps.PhaseId = @NewPhaseId AND ps.UnitId = e.Unit2Id
        WHERE e.PhaseId = @NewPhaseId
          AND e.Unit2SlotId IS NULL
          AND e.Unit2Id IS NOT NULL

        -- Create PhasePools if there are pool-based encounters
        ;WITH DistinctPools AS (
            SELECT DISTINCT RoundName AS PoolName
            FROM EventEncounters
            WHERE PhaseId = @NewPhaseId
              AND RoundType = 'Pool'
              AND RoundName IS NOT NULL
              AND RoundName LIKE 'Pool%'
        )
        INSERT INTO PhasePools (PhaseId, PoolName, PoolOrder, CreatedAt, UpdatedAt)
        SELECT
            @NewPhaseId,
            PoolName,
            ROW_NUMBER() OVER (ORDER BY PoolName),
            GETUTCDATE(),
            GETUTCDATE()
        FROM DistinctPools

        -- Link encounters to pools
        UPDATE e
        SET e.PoolId = pp.Id, e.UpdatedAt = GETUTCDATE()
        FROM EventEncounters e
        INNER JOIN PhasePools pp ON pp.PhaseId = @NewPhaseId AND pp.PoolName = e.RoundName
        WHERE e.PhaseId = @NewPhaseId
          AND e.PoolId IS NULL
          AND e.RoundType = 'Pool'
          AND e.RoundName IS NOT NULL

        COMMIT TRANSACTION
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION

        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE()
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY()
        DECLARE @ErrorState INT = ERROR_STATE()

        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState)
    END CATCH
END
GO

PRINT 'Created sp_MigrateDivisionToPhase stored procedure'

-- =====================================================
-- sp_EnsureDivisionHasPhase
-- Simpler version that just ensures a phase exists
-- Returns the phase ID (creates if needed)
-- =====================================================

IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'sp_EnsureDivisionHasPhase')
BEGIN
    DROP PROCEDURE sp_EnsureDivisionHasPhase
    PRINT 'Dropped existing sp_EnsureDivisionHasPhase'
END
GO

CREATE PROCEDURE sp_EnsureDivisionHasPhase
    @DivisionId INT,
    @PhaseId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    -- Check if phase already exists
    SELECT @PhaseId = Id
    FROM DivisionPhases
    WHERE DivisionId = @DivisionId AND PhaseOrder = 1

    IF @PhaseId IS NOT NULL
        RETURN

    -- Migrate the division
    DECLARE @SlotsCreated INT
    DECLARE @EncountersUpdated INT

    EXEC sp_MigrateDivisionToPhase
        @DivisionId = @DivisionId,
        @PhaseId = @PhaseId OUTPUT,
        @SlotsCreated = @SlotsCreated OUTPUT,
        @EncountersUpdated = @EncountersUpdated OUTPUT
END
GO

PRINT 'Created sp_EnsureDivisionHasPhase stored procedure'

-- =====================================================
-- sp_MigrateEventToPhases
-- Migrates all divisions in an event to phase-based format
-- =====================================================

IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'sp_MigrateEventToPhases')
BEGIN
    DROP PROCEDURE sp_MigrateEventToPhases
    PRINT 'Dropped existing sp_MigrateEventToPhases'
END
GO

CREATE PROCEDURE sp_MigrateEventToPhases
    @EventId INT,
    @DivisionsMigrated INT OUTPUT,
    @TotalSlotsCreated INT OUTPUT,
    @TotalEncountersUpdated INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    SET @DivisionsMigrated = 0
    SET @TotalSlotsCreated = 0
    SET @TotalEncountersUpdated = 0

    -- Check if event exists
    IF NOT EXISTS (SELECT 1 FROM Events WHERE Id = @EventId)
    BEGIN
        RAISERROR('Event %d does not exist', 16, 1, @EventId)
        RETURN
    END

    -- Get all active divisions for this event that have encounters
    DECLARE @DivisionIds TABLE (DivisionId INT)

    INSERT INTO @DivisionIds (DivisionId)
    SELECT DISTINCT d.Id
    FROM EventDivisions d
    WHERE d.EventId = @EventId
      AND d.IsActive = 1
      AND EXISTS (SELECT 1 FROM EventEncounters e WHERE e.DivisionId = d.Id)

    -- Process each division
    DECLARE @CurrentDivisionId INT
    DECLARE @PhaseId INT
    DECLARE @SlotsCreated INT
    DECLARE @EncountersUpdated INT

    DECLARE division_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT DivisionId FROM @DivisionIds

    OPEN division_cursor
    FETCH NEXT FROM division_cursor INTO @CurrentDivisionId

    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            EXEC sp_MigrateDivisionToPhase
                @DivisionId = @CurrentDivisionId,
                @PhaseId = @PhaseId OUTPUT,
                @SlotsCreated = @SlotsCreated OUTPUT,
                @EncountersUpdated = @EncountersUpdated OUTPUT

            IF @PhaseId IS NOT NULL
            BEGIN
                SET @DivisionsMigrated = @DivisionsMigrated + 1
                SET @TotalSlotsCreated = @TotalSlotsCreated + ISNULL(@SlotsCreated, 0)
                SET @TotalEncountersUpdated = @TotalEncountersUpdated + ISNULL(@EncountersUpdated, 0)
            END
        END TRY
        BEGIN CATCH
            -- Log error but continue with other divisions
            PRINT 'Error migrating division ' + CAST(@CurrentDivisionId AS VARCHAR(10)) + ': ' + ERROR_MESSAGE()
        END CATCH

        FETCH NEXT FROM division_cursor INTO @CurrentDivisionId
    END

    CLOSE division_cursor
    DEALLOCATE division_cursor
END
GO

PRINT 'Created sp_MigrateEventToPhases stored procedure'

-- =====================================================
-- sp_EnsureEventHasPhases
-- Simpler version that ensures all divisions have phases
-- =====================================================

IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'sp_EnsureEventHasPhases')
BEGIN
    DROP PROCEDURE sp_EnsureEventHasPhases
    PRINT 'Dropped existing sp_EnsureEventHasPhases'
END
GO

CREATE PROCEDURE sp_EnsureEventHasPhases
    @EventId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @DivisionsMigrated INT
    DECLARE @TotalSlotsCreated INT
    DECLARE @TotalEncountersUpdated INT

    EXEC sp_MigrateEventToPhases
        @EventId = @EventId,
        @DivisionsMigrated = @DivisionsMigrated OUTPUT,
        @TotalSlotsCreated = @TotalSlotsCreated OUTPUT,
        @TotalEncountersUpdated = @TotalEncountersUpdated OUTPUT

    -- Return summary as result set
    SELECT
        @EventId AS EventId,
        @DivisionsMigrated AS DivisionsMigrated,
        @TotalSlotsCreated AS SlotsCreated,
        @TotalEncountersUpdated AS EncountersUpdated
END
GO

PRINT 'Created sp_EnsureEventHasPhases stored procedure'

PRINT 'Migration 135 completed successfully'
