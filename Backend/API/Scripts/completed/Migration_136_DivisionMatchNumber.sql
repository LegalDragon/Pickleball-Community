-- Migration 136: Add DivisionMatchNumber for sequential match numbering within a division
-- This allows referencing matches by number: "Match #1", "Match #5", etc.

PRINT 'Starting Migration 136: DivisionMatchNumber';

-- Add DivisionMatchNumber column to EventEncounters
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'DivisionMatchNumber')
BEGIN
    ALTER TABLE EventEncounters ADD DivisionMatchNumber INT NULL;
    PRINT 'Added DivisionMatchNumber column to EventEncounters';
END
ELSE
BEGIN
    PRINT 'DivisionMatchNumber column already exists';
END

GO

-- Create stored procedure to assign DivisionMatchNumber to all encounters in a division
CREATE OR ALTER PROCEDURE sp_AssignDivisionMatchNumbers
    @DivisionId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Assign sequential numbers based on logical order:
    -- 1. Phase order (PhaseId, with NULL phases last for backward compatibility)
    -- 2. Pool (PoolId for pool play)
    -- 3. Round number
    -- 4. Encounter number within round
    -- 5. Then by Id as final tiebreaker

    ;WITH NumberedEncounters AS (
        SELECT
            Id,
            ROW_NUMBER() OVER (
                ORDER BY
                    ISNULL(PhaseId, 999999),
                    ISNULL(PoolId, 999999),
                    RoundNumber,
                    EncounterNumber,
                    Id
            ) AS MatchNum
        FROM EventEncounters
        WHERE DivisionId = @DivisionId
    )
    UPDATE e
    SET e.DivisionMatchNumber = ne.MatchNum
    FROM EventEncounters e
    INNER JOIN NumberedEncounters ne ON e.Id = ne.Id;

    SELECT @@ROWCOUNT AS EncountersUpdated;
END

GO

PRINT 'Created sp_AssignDivisionMatchNumbers stored procedure';

-- Create stored procedure to get division match statistics
CREATE OR ALTER PROCEDURE sp_GetDivisionMatchStats
    @DivisionId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        d.Id AS DivisionId,
        d.Name AS DivisionName,
        COUNT(DISTINCT e.Id) AS TotalEncounters,
        COUNT(DISTINCT em.Id) AS TotalMatches,
        COUNT(DISTINCT eg.Id) AS TotalGames,
        COUNT(DISTINCT CASE WHEN e.Status = 'Completed' THEN e.Id END) AS CompletedEncounters,
        COUNT(DISTINCT CASE WHEN em.Status = 'Completed' THEN em.Id END) AS CompletedMatches,
        COUNT(DISTINCT CASE WHEN eg.Status = 'Completed' THEN eg.Id END) AS CompletedGames
    FROM EventDivisions d
    LEFT JOIN EventEncounters e ON e.DivisionId = d.Id
    LEFT JOIN EncounterMatches em ON em.EncounterId = e.Id
    LEFT JOIN EventGames eg ON eg.EncounterMatchId = em.Id
    WHERE d.Id = @DivisionId
    GROUP BY d.Id, d.Name;
END

GO

PRINT 'Created sp_GetDivisionMatchStats stored procedure';

-- Backfill existing encounters with DivisionMatchNumber
PRINT 'Backfilling DivisionMatchNumber for existing encounters...';

DECLARE @DivisionId INT;
DECLARE @UpdatedCount INT = 0;

DECLARE division_cursor CURSOR FOR
SELECT DISTINCT DivisionId FROM EventEncounters WHERE DivisionMatchNumber IS NULL;

OPEN division_cursor;
FETCH NEXT FROM division_cursor INTO @DivisionId;

WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC sp_AssignDivisionMatchNumbers @DivisionId = @DivisionId;
    SET @UpdatedCount = @UpdatedCount + 1;
    FETCH NEXT FROM division_cursor INTO @DivisionId;
END

CLOSE division_cursor;
DEALLOCATE division_cursor;

PRINT CONCAT('Backfilled DivisionMatchNumber for ', @UpdatedCount, ' divisions');

GO

PRINT 'Migration 136 completed successfully';
