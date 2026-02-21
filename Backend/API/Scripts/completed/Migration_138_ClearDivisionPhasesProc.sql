-- Migration 138: Clear Division Phases Stored Procedure
-- Creates procedure to clear all phase-related data for a division
-- Avoids EF Core OPENJSON query issues with Contains()

PRINT 'Starting Migration 138: Clear Division Phases Procedure...'

-- =====================================================
-- Stored Procedure: sp_ClearDivisionPhases
-- Clears all phases, slots, pools, encounters, and advancement rules
-- for a given division in the correct FK order
-- =====================================================

CREATE OR ALTER PROCEDURE sp_ClearDivisionPhases
    @DivisionId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @DeletedPhases INT = 0;
    DECLARE @DeletedSlots INT = 0;
    DECLARE @DeletedPools INT = 0;
    DECLARE @DeletedEncounters INT = 0;
    DECLARE @DeletedRules INT = 0;

    -- Get phase IDs for this division
    DECLARE @PhaseIds TABLE (Id INT);
    INSERT INTO @PhaseIds (Id)
    SELECT Id FROM DivisionPhases WHERE DivisionId = @DivisionId;

    -- Exit early if no phases
    IF NOT EXISTS (SELECT 1 FROM @PhaseIds)
    BEGIN
        SELECT 0 AS DeletedPhases, 0 AS DeletedSlots, 0 AS DeletedPools,
               0 AS DeletedEncounters, 0 AS DeletedRules;
        RETURN;
    END

    -- Delete advancement rules (reference phases)
    DELETE FROM PhaseAdvancementRules
    WHERE SourcePhaseId IN (SELECT Id FROM @PhaseIds)
       OR TargetPhaseId IN (SELECT Id FROM @PhaseIds);
    SET @DeletedRules = @@ROWCOUNT;

    -- Delete encounters (reference phases)
    DELETE FROM EventEncounters
    WHERE PhaseId IN (SELECT Id FROM @PhaseIds);
    SET @DeletedEncounters = @@ROWCOUNT;

    -- Delete phase pool slots (reference pools)
    DELETE FROM PhasePoolSlots
    WHERE PoolId IN (SELECT Id FROM PhasePools WHERE PhaseId IN (SELECT Id FROM @PhaseIds));

    -- Delete pools (reference phases)
    DELETE FROM PhasePools
    WHERE PhaseId IN (SELECT Id FROM @PhaseIds);
    SET @DeletedPools = @@ROWCOUNT;

    -- Delete slots (reference phases)
    DELETE FROM PhaseSlots
    WHERE PhaseId IN (SELECT Id FROM @PhaseIds);
    SET @DeletedSlots = @@ROWCOUNT;

    -- Delete phases
    DELETE FROM DivisionPhases
    WHERE DivisionId = @DivisionId;
    SET @DeletedPhases = @@ROWCOUNT;

    -- Return counts
    SELECT @DeletedPhases AS DeletedPhases,
           @DeletedSlots AS DeletedSlots,
           @DeletedPools AS DeletedPools,
           @DeletedEncounters AS DeletedEncounters,
           @DeletedRules AS DeletedRules;
END
GO

PRINT 'Created sp_ClearDivisionPhases procedure'
PRINT 'Migration 138 completed successfully'
