-- Fix: Order encounters by PhaseOrder (logical flow) instead of PhaseId (database ID)
-- This ensures Draw phase encounters come first, then follow advancement rules through phases

CREATE OR ALTER PROCEDURE sp_AssignDivisionMatchNumbers
    @DivisionId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Assign sequential numbers based on logical order:
    -- 1. Phase order (PhaseOrder from DivisionPhases, with NULL phases last)
    -- 2. Pool (PoolId for pool play)
    -- 3. Round number
    -- 4. Encounter number within round
    -- 5. Then by Id as final tiebreaker

    ;WITH NumberedEncounters AS (
        SELECT
            e.Id,
            ROW_NUMBER() OVER (
                ORDER BY
                    ISNULL(p.PhaseOrder, 999999),  -- Use PhaseOrder for logical flow
                    ISNULL(e.PoolId, 999999),
                    e.RoundNumber,
                    e.EncounterNumber,
                    e.Id
            ) AS MatchNum
        FROM EventEncounters e
        LEFT JOIN DivisionPhases p ON e.PhaseId = p.Id
        WHERE e.DivisionId = @DivisionId
    )
    UPDATE e
    SET e.DivisionMatchNumber = ne.MatchNum
    FROM EventEncounters e
    INNER JOIN NumberedEncounters ne ON e.Id = ne.Id;

    SELECT @@ROWCOUNT AS EncountersUpdated;
END

GO

PRINT 'Updated sp_AssignDivisionMatchNumbers to use PhaseOrder for logical flow ordering';
