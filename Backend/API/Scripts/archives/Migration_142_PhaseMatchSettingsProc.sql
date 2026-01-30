-- Migration 142: Stored procedure for PhaseMatchSettings queries
-- Avoids EF Core OPENJSON issues with Contains() on list of IDs

PRINT 'Starting Migration 142: PhaseMatchSettings stored procedures...'

-- Get all phase match settings for a division
IF OBJECT_ID('sp_GetDivisionPhaseMatchSettings', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetDivisionPhaseMatchSettings
GO

CREATE PROCEDURE sp_GetDivisionPhaseMatchSettings
    @DivisionId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Return phase match settings with related data
    SELECT
        pms.Id,
        pms.PhaseId,
        pms.MatchFormatId,
        pms.BestOf,
        pms.ScoreFormatId,
        dp.Name AS PhaseName,
        dp.PhaseType,
        dp.PhaseOrder,
        emf.Name AS MatchFormatName,
        emf.Code AS MatchFormatCode,
        sf.Name AS ScoreFormatName
    FROM PhaseMatchSettings pms
    INNER JOIN DivisionPhases dp ON pms.PhaseId = dp.Id
    LEFT JOIN EncounterMatchFormats emf ON pms.MatchFormatId = emf.Id
    LEFT JOIN ScoreFormats sf ON pms.ScoreFormatId = sf.Id
    WHERE dp.DivisionId = @DivisionId
    ORDER BY dp.PhaseOrder, emf.SortOrder
END
GO

PRINT 'Created sp_GetDivisionPhaseMatchSettings'

PRINT 'Migration 142 completed successfully'
