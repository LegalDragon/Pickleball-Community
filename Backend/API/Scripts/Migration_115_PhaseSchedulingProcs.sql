-- Migration 115: Phase Scheduling Stored Procedures
-- Provides stored procedures for bracket progression, slot resolution, and time calculations

PRINT 'Starting Migration 115 - Phase Scheduling Stored Procedures'
GO

-- =====================================================
-- 1. sp_AdvanceWinner - Move winner to next encounter
-- =====================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_AdvanceWinner')
    DROP PROCEDURE sp_AdvanceWinner
GO

CREATE PROCEDURE sp_AdvanceWinner
    @EncounterId INT,
    @WinnerUnitId INT = NULL  -- If null, determines from scores
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Unit1Id INT, @Unit2Id INT, @Unit1Score INT, @Unit2Score INT
    DECLARE @WinnerNextId INT, @WinnerSlotPos INT
    DECLARE @ActualWinnerId INT

    -- Get encounter info
    SELECT
        @Unit1Id = Unit1Id,
        @Unit2Id = Unit2Id,
        @Unit1Score = Unit1EncounterScore,
        @Unit2Score = Unit2EncounterScore,
        @WinnerNextId = WinnerNextEncounterId,
        @WinnerSlotPos = WinnerSlotPosition
    FROM EventEncounters
    WHERE Id = @EncounterId

    IF @Unit1Id IS NULL AND @Unit2Id IS NULL
    BEGIN
        RAISERROR('Encounter units not resolved', 16, 1)
        RETURN
    END

    -- Determine winner
    IF @WinnerUnitId IS NOT NULL
        SET @ActualWinnerId = @WinnerUnitId
    ELSE IF @Unit1Score > @Unit2Score
        SET @ActualWinnerId = @Unit1Id
    ELSE IF @Unit2Score > @Unit1Score
        SET @ActualWinnerId = @Unit2Id
    ELSE
    BEGIN
        RAISERROR('Cannot determine winner - scores are tied', 16, 1)
        RETURN
    END

    -- Update current encounter
    UPDATE EventEncounters
    SET WinnerUnitId = @ActualWinnerId,
        Status = 'Completed',
        CompletedAt = GETUTCDATE(),
        UpdatedAt = GETUTCDATE()
    WHERE Id = @EncounterId

    -- Advance to next encounter if set
    IF @WinnerNextId IS NOT NULL AND @WinnerSlotPos IS NOT NULL
    BEGIN
        IF @WinnerSlotPos = 1
            UPDATE EventEncounters
            SET Unit1Id = @ActualWinnerId,
                UpdatedAt = GETUTCDATE()
            WHERE Id = @WinnerNextId
        ELSE
            UPDATE EventEncounters
            SET Unit2Id = @ActualWinnerId,
                UpdatedAt = GETUTCDATE()
            WHERE Id = @WinnerNextId

        -- Check if next encounter is ready (both units assigned)
        DECLARE @NextUnit1 INT, @NextUnit2 INT
        SELECT @NextUnit1 = Unit1Id, @NextUnit2 = Unit2Id
        FROM EventEncounters WHERE Id = @WinnerNextId

        IF @NextUnit1 IS NOT NULL AND @NextUnit2 IS NOT NULL
        BEGIN
            UPDATE EventEncounters
            SET Status = 'Ready',
                UpdatedAt = GETUTCDATE()
            WHERE Id = @WinnerNextId AND Status = 'Scheduled'
        END
    END

    SELECT @ActualWinnerId AS WinnerId, @WinnerNextId AS NextEncounterId
END
GO

PRINT 'Created sp_AdvanceWinner'
GO

-- =====================================================
-- 2. sp_AdvanceLoser - Move loser to loser bracket (double elim)
-- =====================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_AdvanceLoser')
    DROP PROCEDURE sp_AdvanceLoser
GO

CREATE PROCEDURE sp_AdvanceLoser
    @EncounterId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Unit1Id INT, @Unit2Id INT, @WinnerUnitId INT
    DECLARE @LoserNextId INT, @LoserSlotPos INT
    DECLARE @LoserUnitId INT

    -- Get encounter info
    SELECT
        @Unit1Id = Unit1Id,
        @Unit2Id = Unit2Id,
        @WinnerUnitId = WinnerUnitId,
        @LoserNextId = LoserNextEncounterId,
        @LoserSlotPos = LoserSlotPosition
    FROM EventEncounters
    WHERE Id = @EncounterId

    IF @WinnerUnitId IS NULL
    BEGIN
        RAISERROR('Winner not determined yet', 16, 1)
        RETURN
    END

    IF @LoserNextId IS NULL
    BEGIN
        -- No loser bracket advancement configured
        SELECT NULL AS LoserId, NULL AS NextEncounterId
        RETURN
    END

    -- Determine loser
    SET @LoserUnitId = CASE WHEN @WinnerUnitId = @Unit1Id THEN @Unit2Id ELSE @Unit1Id END

    -- Advance loser to loser bracket
    IF @LoserSlotPos = 1
        UPDATE EventEncounters
        SET Unit1Id = @LoserUnitId,
            UpdatedAt = GETUTCDATE()
        WHERE Id = @LoserNextId
    ELSE
        UPDATE EventEncounters
        SET Unit2Id = @LoserUnitId,
            UpdatedAt = GETUTCDATE()
        WHERE Id = @LoserNextId

    -- Check if loser bracket encounter is ready
    DECLARE @NextUnit1 INT, @NextUnit2 INT
    SELECT @NextUnit1 = Unit1Id, @NextUnit2 = Unit2Id
    FROM EventEncounters WHERE Id = @LoserNextId

    IF @NextUnit1 IS NOT NULL AND @NextUnit2 IS NOT NULL
    BEGIN
        UPDATE EventEncounters
        SET Status = 'Ready',
            UpdatedAt = GETUTCDATE()
        WHERE Id = @LoserNextId AND Status = 'Scheduled'
    END

    SELECT @LoserUnitId AS LoserId, @LoserNextId AS NextEncounterId
END
GO

PRINT 'Created sp_AdvanceLoser'
GO

-- =====================================================
-- 3. sp_ResolvePhaseSlots - Apply advancement rules from previous phase
-- =====================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_ResolvePhaseSlots')
    DROP PROCEDURE sp_ResolvePhaseSlots
GO

CREATE PROCEDURE sp_ResolvePhaseSlots
    @PhaseId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RulesApplied INT = 0
    DECLARE @RuleId INT, @SourcePhaseId INT, @SourcePoolId INT, @SourceRank INT
    DECLARE @TargetSlotNumber INT, @ResolvedUnitId INT

    -- Get advancement rules for this phase
    DECLARE rule_cursor CURSOR FOR
        SELECT Id, SourcePhaseId, SourcePoolId, SourceRank, TargetSlotNumber
        FROM PhaseAdvancementRules
        WHERE TargetPhaseId = @PhaseId
        ORDER BY ProcessOrder

    OPEN rule_cursor
    FETCH NEXT FROM rule_cursor INTO @RuleId, @SourcePhaseId, @SourcePoolId, @SourceRank, @TargetSlotNumber

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @ResolvedUnitId = NULL

        -- Resolve unit based on source phase standings
        IF @SourcePoolId IS NOT NULL
        BEGIN
            -- Get from specific pool standings
            ;WITH PoolStandings AS (
                SELECT
                    eu.Id AS UnitId,
                    SUM(CASE WHEN e.WinnerUnitId = eu.Id THEN 1 ELSE 0 END) AS Wins,
                    SUM(CASE WHEN e.WinnerUnitId IS NOT NULL AND e.WinnerUnitId != eu.Id THEN 1 ELSE 0 END) AS Losses,
                    SUM(CASE WHEN e.Unit1Id = eu.Id THEN e.Unit1EncounterScore ELSE e.Unit2EncounterScore END) AS PointsFor,
                    SUM(CASE WHEN e.Unit1Id = eu.Id THEN e.Unit2EncounterScore ELSE e.Unit1EncounterScore END) AS PointsAgainst,
                    ROW_NUMBER() OVER (ORDER BY
                        SUM(CASE WHEN e.WinnerUnitId = eu.Id THEN 1 ELSE 0 END) DESC,
                        SUM(CASE WHEN e.Unit1Id = eu.Id THEN e.Unit1EncounterScore ELSE e.Unit2EncounterScore END) -
                        SUM(CASE WHEN e.Unit1Id = eu.Id THEN e.Unit2EncounterScore ELSE e.Unit1EncounterScore END) DESC
                    ) AS Rank
                FROM EventUnits eu
                INNER JOIN PhasePoolSlots pps ON pps.SlotId IN (
                    SELECT Id FROM PhaseSlots WHERE UnitId = eu.Id
                )
                INNER JOIN PhasePools pp ON pp.Id = pps.PoolId AND pp.Id = @SourcePoolId
                LEFT JOIN EventEncounters e ON e.PoolId = @SourcePoolId
                    AND (e.Unit1Id = eu.Id OR e.Unit2Id = eu.Id)
                    AND e.Status = 'Completed'
                GROUP BY eu.Id
            )
            SELECT @ResolvedUnitId = UnitId FROM PoolStandings WHERE Rank = @SourceRank
        END
        ELSE
        BEGIN
            -- Get from overall phase standings
            ;WITH PhaseStandings AS (
                SELECT
                    eu.Id AS UnitId,
                    SUM(CASE WHEN e.WinnerUnitId = eu.Id THEN 1 ELSE 0 END) AS Wins,
                    ROW_NUMBER() OVER (ORDER BY
                        SUM(CASE WHEN e.WinnerUnitId = eu.Id THEN 1 ELSE 0 END) DESC
                    ) AS Rank
                FROM EventUnits eu
                INNER JOIN PhaseSlots ps ON ps.UnitId = eu.Id AND ps.PhaseId = @SourcePhaseId
                LEFT JOIN EventEncounters e ON e.PhaseId = @SourcePhaseId
                    AND (e.Unit1Id = eu.Id OR e.Unit2Id = eu.Id)
                    AND e.Status = 'Completed'
                GROUP BY eu.Id
            )
            SELECT @ResolvedUnitId = UnitId FROM PhaseStandings WHERE Rank = @SourceRank
        END

        -- Update target slot
        IF @ResolvedUnitId IS NOT NULL
        BEGIN
            UPDATE PhaseSlots
            SET UnitId = @ResolvedUnitId,
                IsResolved = 1,
                ResolvedAt = GETUTCDATE(),
                UpdatedAt = GETUTCDATE()
            WHERE PhaseId = @PhaseId
                AND SlotType = 'Incoming'
                AND SlotNumber = @TargetSlotNumber

            -- Also update encounters using this slot
            UPDATE EventEncounters
            SET Unit1Id = @ResolvedUnitId, UpdatedAt = GETUTCDATE()
            WHERE Unit1SlotId IN (
                SELECT Id FROM PhaseSlots
                WHERE PhaseId = @PhaseId AND SlotNumber = @TargetSlotNumber AND SlotType = 'Incoming'
            )

            UPDATE EventEncounters
            SET Unit2Id = @ResolvedUnitId, UpdatedAt = GETUTCDATE()
            WHERE Unit2SlotId IN (
                SELECT Id FROM PhaseSlots
                WHERE PhaseId = @PhaseId AND SlotNumber = @TargetSlotNumber AND SlotType = 'Incoming'
            )

            SET @RulesApplied = @RulesApplied + 1
        END

        FETCH NEXT FROM rule_cursor INTO @RuleId, @SourcePhaseId, @SourcePoolId, @SourceRank, @TargetSlotNumber
    END

    CLOSE rule_cursor
    DEALLOCATE rule_cursor

    SELECT @RulesApplied AS RulesApplied
END
GO

PRINT 'Created sp_ResolvePhaseSlots'
GO

-- =====================================================
-- 4. sp_CalculateEncounterTimes - Calculate estimated start times
-- =====================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_CalculateEncounterTimes')
    DROP PROCEDURE sp_CalculateEncounterTimes
GO

CREATE PROCEDURE sp_CalculateEncounterTimes
    @PhaseId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @StartTime DATETIME, @MatchDuration INT, @RestTime INT
    DECLARE @DivisionId INT

    -- Get phase and division info
    SELECT
        @StartTime = dp.StartTime,
        @MatchDuration = COALESCE(dp.EstimatedMatchDurationMinutes, ed.EstimatedMatchDurationMinutes, 20),
        @RestTime = COALESCE(ed.MinRestTimeMinutes, 15),
        @DivisionId = dp.DivisionId
    FROM DivisionPhases dp
    INNER JOIN EventDivisions ed ON ed.Id = dp.DivisionId
    WHERE dp.Id = @PhaseId

    IF @StartTime IS NULL
    BEGIN
        RAISERROR('Phase start time not set', 16, 1)
        RETURN
    END

    -- Calculate times per court
    ;WITH EncounterSequence AS (
        SELECT
            e.Id,
            e.TournamentCourtId,
            ROW_NUMBER() OVER (PARTITION BY e.TournamentCourtId ORDER BY e.RoundNumber, e.EncounterNumber) AS CourtSequence
        FROM EventEncounters e
        WHERE e.PhaseId = @PhaseId AND e.TournamentCourtId IS NOT NULL
    )
    UPDATE e
    SET EstimatedStartTime = DATEADD(MINUTE, (es.CourtSequence - 1) * @MatchDuration, @StartTime),
        UpdatedAt = GETUTCDATE()
    FROM EventEncounters e
    INNER JOIN EncounterSequence es ON es.Id = e.Id

    -- Update phase end time
    UPDATE DivisionPhases
    SET EstimatedEndTime = (
        SELECT MAX(DATEADD(MINUTE, @MatchDuration, EstimatedStartTime))
        FROM EventEncounters
        WHERE PhaseId = @PhaseId AND EstimatedStartTime IS NOT NULL
    ),
    UpdatedAt = GETUTCDATE()
    WHERE Id = @PhaseId

    SELECT
        (SELECT COUNT(*) FROM EventEncounters WHERE PhaseId = @PhaseId AND EstimatedStartTime IS NOT NULL) AS EncountersUpdated,
        (SELECT EstimatedEndTime FROM DivisionPhases WHERE Id = @PhaseId) AS PhaseEndTime
END
GO

PRINT 'Created sp_CalculateEncounterTimes'
GO

-- =====================================================
-- 5. sp_GetPhaseStandings - Get standings for a phase or pool
-- =====================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetPhaseStandings')
    DROP PROCEDURE sp_GetPhaseStandings
GO

CREATE PROCEDURE sp_GetPhaseStandings
    @PhaseId INT,
    @PoolId INT = NULL  -- NULL for overall phase standings
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH UnitStats AS (
        SELECT
            eu.Id AS UnitId,
            eu.Name AS UnitName,
            COUNT(DISTINCT e.Id) AS MatchesPlayed,
            SUM(CASE WHEN e.WinnerUnitId = eu.Id THEN 1 ELSE 0 END) AS Wins,
            SUM(CASE WHEN e.WinnerUnitId IS NOT NULL AND e.WinnerUnitId != eu.Id AND
                (e.Unit1Id = eu.Id OR e.Unit2Id = eu.Id) THEN 1 ELSE 0 END) AS Losses,
            SUM(CASE WHEN e.Unit1Id = eu.Id THEN e.Unit1EncounterScore ELSE e.Unit2EncounterScore END) AS PointsFor,
            SUM(CASE WHEN e.Unit1Id = eu.Id THEN e.Unit2EncounterScore ELSE e.Unit1EncounterScore END) AS PointsAgainst
        FROM PhaseSlots ps
        INNER JOIN EventUnits eu ON eu.Id = ps.UnitId
        LEFT JOIN EventEncounters e ON e.PhaseId = @PhaseId
            AND (e.Unit1Id = eu.Id OR e.Unit2Id = eu.Id)
            AND e.Status = 'Completed'
            AND (@PoolId IS NULL OR e.PoolId = @PoolId)
        WHERE ps.PhaseId = @PhaseId
            AND ps.SlotType = 'Incoming'
            AND ps.IsResolved = 1
            AND (@PoolId IS NULL OR ps.Id IN (
                SELECT pps.SlotId FROM PhasePoolSlots pps WHERE pps.PoolId = @PoolId
            ))
        GROUP BY eu.Id, eu.Name
    )
    SELECT
        ROW_NUMBER() OVER (ORDER BY Wins DESC, (PointsFor - PointsAgainst) DESC, PointsFor DESC) AS Rank,
        UnitId,
        UnitName,
        MatchesPlayed,
        Wins,
        Losses,
        PointsFor,
        PointsAgainst,
        PointsFor - PointsAgainst AS PointDifferential
    FROM UnitStats
    ORDER BY Rank
END
GO

PRINT 'Created sp_GetPhaseStandings'
GO

PRINT 'Migration 115 - Phase Scheduling Stored Procedures completed successfully'
GO
