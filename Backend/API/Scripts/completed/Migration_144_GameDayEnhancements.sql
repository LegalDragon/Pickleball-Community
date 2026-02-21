-- Migration_144_GameDayEnhancements.sql
-- Adds stored procedures for Game Day management improvements:
--   1. sp_GetEventProgressSummary - Cross-division tournament progress
--   2. sp_GetGameDayActivityFeed - Real-time activity feed for TD dashboard
--   3. sp_GetCourtUtilizationStats - Court usage metrics
--   4. sp_BatchUpdateGameStatus - Batch game status transitions
-- Date: 2026-01-23

PRINT 'Starting Migration_144_GameDayEnhancements...'

-- =====================================================
-- 1. sp_GetEventProgressSummary
-- Returns division-level progress with phase breakdown
-- =====================================================
PRINT 'Creating sp_GetEventProgressSummary...'
GO

CREATE OR ALTER PROCEDURE sp_GetEventProgressSummary
    @EventId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Division-level summary with encounter counts
    SELECT
        d.Id AS DivisionId,
        d.Name AS DivisionName,
        d.SortOrder,
        COUNT(e.Id) AS TotalEncounters,
        SUM(CASE WHEN e.Status = 'Completed' THEN 1 ELSE 0 END) AS CompletedEncounters,
        SUM(CASE WHEN e.Status = 'InProgress' OR e.Status = 'Playing' THEN 1 ELSE 0 END) AS InProgressEncounters,
        SUM(CASE WHEN e.Status = 'Scheduled' OR e.Status = 'Ready' THEN 1 ELSE 0 END) AS PendingEncounters,
        SUM(CASE WHEN e.Status = 'Bye' THEN 1 ELSE 0 END) AS ByeEncounters,
        CASE WHEN COUNT(e.Id) > 0
            THEN CAST(SUM(CASE WHEN e.Status = 'Completed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(e.Id) * 100
            ELSE 0 END AS CompletionPercentage,
        MIN(e.EstimatedStartTime) AS EarliestStartTime,
        MAX(e.EstimatedEndTime) AS LatestEndTime
    FROM EventDivisions d
    LEFT JOIN EventEncounters e ON e.DivisionId = d.Id AND e.Status != 'Cancelled'
    WHERE d.EventId = @EventId AND d.IsActive = 1
    GROUP BY d.Id, d.Name, d.SortOrder
    ORDER BY d.SortOrder;

    -- Phase-level breakdown
    SELECT
        dp.Id AS PhaseId,
        dp.DivisionId,
        dp.Name AS PhaseName,
        dp.PhaseType,
        dp.PhaseOrder,
        COUNT(e.Id) AS TotalEncounters,
        SUM(CASE WHEN e.Status = 'Completed' THEN 1 ELSE 0 END) AS CompletedEncounters,
        SUM(CASE WHEN e.Status = 'InProgress' OR e.Status = 'Playing' THEN 1 ELSE 0 END) AS InProgressEncounters,
        dp.StartTime AS PhaseStartTime,
        dp.EstimatedEndTime AS PhaseEndTime
    FROM DivisionPhases dp
    LEFT JOIN EventEncounters e ON e.PhaseId = dp.Id AND e.Status != 'Cancelled'
    INNER JOIN EventDivisions d ON dp.DivisionId = d.Id
    WHERE d.EventId = @EventId AND d.IsActive = 1
    GROUP BY dp.Id, dp.DivisionId, dp.Name, dp.PhaseType, dp.PhaseOrder, dp.StartTime, dp.EstimatedEndTime
    ORDER BY dp.DivisionId, dp.PhaseOrder;
END
GO

-- =====================================================
-- 2. sp_GetGameDayActivityFeed
-- Returns recent game day events (score updates, completions, etc.)
-- =====================================================
PRINT 'Creating sp_GetGameDayActivityFeed...'
GO

CREATE OR ALTER PROCEDURE sp_GetGameDayActivityFeed
    @EventId INT,
    @Limit INT = 50,
    @SinceUtc DATETIME2 = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Combine multiple activity sources into a single feed
    ;WITH Activities AS (
        -- Game completions
        SELECT
            'GameCompleted' AS ActivityType,
            g.Id AS ReferenceId,
            g.FinishedAt AS ActivityTime,
            CONCAT(u1.Name, ' vs ', u2.Name, ' - Game ', g.GameNumber,
                   ' finished (', g.Unit1Score, '-', g.Unit2Score, ')') AS Description,
            enc.DivisionId,
            d.Name AS DivisionName,
            g.TournamentCourtId AS CourtId,
            tc.CourtLabel
        FROM EventGames g
        INNER JOIN EncounterMatches em ON g.EncounterMatchId = em.Id
        INNER JOIN EventEncounters enc ON em.EncounterId = enc.Id
        INNER JOIN EventDivisions d ON enc.DivisionId = d.Id
        LEFT JOIN EventUnits u1 ON enc.Unit1Id = u1.Id
        LEFT JOIN EventUnits u2 ON enc.Unit2Id = u2.Id
        LEFT JOIN TournamentCourts tc ON g.TournamentCourtId = tc.Id
        WHERE enc.EventId = @EventId
          AND g.Status = 'Finished'
          AND g.FinishedAt IS NOT NULL
          AND (@SinceUtc IS NULL OR g.FinishedAt > @SinceUtc)

        UNION ALL

        -- Match completions
        SELECT
            'MatchCompleted' AS ActivityType,
            enc.Id AS ReferenceId,
            enc.CompletedAt AS ActivityTime,
            CONCAT(u1.Name, ' defeated ', u2.Name,
                   ' (', enc.RoundName, ')') AS Description,
            enc.DivisionId,
            d.Name AS DivisionName,
            NULL AS CourtId,
            NULL AS CourtLabel
        FROM EventEncounters enc
        INNER JOIN EventDivisions d ON enc.DivisionId = d.Id
        LEFT JOIN EventUnits u1 ON enc.WinnerUnitId = u1.Id
        LEFT JOIN EventUnits u2 ON (
            CASE WHEN enc.WinnerUnitId = enc.Unit1Id THEN enc.Unit2Id ELSE enc.Unit1Id END
        ) = u2.Id
        WHERE enc.EventId = @EventId
          AND enc.Status = 'Completed'
          AND enc.CompletedAt IS NOT NULL
          AND enc.WinnerUnitId IS NOT NULL
          AND (@SinceUtc IS NULL OR enc.CompletedAt > @SinceUtc)

        UNION ALL

        -- Game starts
        SELECT
            'GameStarted' AS ActivityType,
            g.Id AS ReferenceId,
            g.StartedAt AS ActivityTime,
            CONCAT(u1.Name, ' vs ', u2.Name, ' started on ', tc.CourtLabel) AS Description,
            enc.DivisionId,
            d.Name AS DivisionName,
            g.TournamentCourtId AS CourtId,
            tc.CourtLabel
        FROM EventGames g
        INNER JOIN EncounterMatches em ON g.EncounterMatchId = em.Id
        INNER JOIN EventEncounters enc ON em.EncounterId = enc.Id
        INNER JOIN EventDivisions d ON enc.DivisionId = d.Id
        LEFT JOIN EventUnits u1 ON enc.Unit1Id = u1.Id
        LEFT JOIN EventUnits u2 ON enc.Unit2Id = u2.Id
        LEFT JOIN TournamentCourts tc ON g.TournamentCourtId = tc.Id
        WHERE enc.EventId = @EventId
          AND g.StartedAt IS NOT NULL
          AND (@SinceUtc IS NULL OR g.StartedAt > @SinceUtc)

        UNION ALL

        -- Player check-ins
        SELECT
            'PlayerCheckedIn' AS ActivityType,
            m.UserId AS ReferenceId,
            m.CheckedInAt AS ActivityTime,
            CONCAT(u.FirstName, ' ', u.LastName, ' checked in for ', d.Name) AS Description,
            eu.DivisionId,
            d.Name AS DivisionName,
            NULL AS CourtId,
            NULL AS CourtLabel
        FROM EventUnitMembers m
        INNER JOIN EventUnits eu ON m.UnitId = eu.Id
        INNER JOIN EventDivisions d ON eu.DivisionId = d.Id
        INNER JOIN Users u ON m.UserId = u.Id
        WHERE eu.EventId = @EventId
          AND m.IsCheckedIn = 1
          AND m.CheckedInAt IS NOT NULL
          AND (@SinceUtc IS NULL OR m.CheckedInAt > @SinceUtc)
    )
    SELECT TOP(@Limit)
        ActivityType,
        ReferenceId,
        ActivityTime,
        Description,
        DivisionId,
        DivisionName,
        CourtId,
        CourtLabel
    FROM Activities
    WHERE ActivityTime IS NOT NULL
    ORDER BY ActivityTime DESC;
END
GO

-- =====================================================
-- 3. sp_GetCourtUtilizationStats
-- Returns court usage metrics for the event
-- =====================================================
PRINT 'Creating sp_GetCourtUtilizationStats...'
GO

CREATE OR ALTER PROCEDURE sp_GetCourtUtilizationStats
    @EventId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        tc.Id AS CourtId,
        tc.CourtLabel,
        tc.Status,
        tc.SortOrder,
        tc.CurrentGameId,
        -- Count games played on this court
        COUNT(DISTINCT g.Id) AS TotalGamesPlayed,
        SUM(CASE WHEN g.Status = 'Finished' THEN 1 ELSE 0 END) AS CompletedGames,
        SUM(CASE WHEN g.Status IN ('Playing', 'Started', 'InProgress') THEN 1 ELSE 0 END) AS ActiveGames,
        SUM(CASE WHEN g.Status = 'Queued' THEN 1 ELSE 0 END) AS QueuedGames,
        -- Average game duration in minutes
        AVG(CASE WHEN g.Status = 'Finished' AND g.StartedAt IS NOT NULL AND g.FinishedAt IS NOT NULL
            THEN DATEDIFF(MINUTE, g.StartedAt, g.FinishedAt) ELSE NULL END) AS AvgGameDurationMinutes,
        -- Total playing time
        SUM(CASE WHEN g.Status = 'Finished' AND g.StartedAt IS NOT NULL AND g.FinishedAt IS NOT NULL
            THEN DATEDIFF(MINUTE, g.StartedAt, g.FinishedAt) ELSE 0 END) AS TotalPlayingMinutes,
        -- Current game info
        cg.StartedAt AS CurrentGameStartedAt,
        cg.Status AS CurrentGameStatus
    FROM TournamentCourts tc
    LEFT JOIN EventGames g ON g.TournamentCourtId = tc.Id
    LEFT JOIN EventGames cg ON tc.CurrentGameId = cg.Id
    WHERE tc.EventId = @EventId AND tc.IsActive = 1
    GROUP BY tc.Id, tc.CourtLabel, tc.Status, tc.SortOrder, tc.CurrentGameId,
             cg.StartedAt, cg.Status
    ORDER BY tc.SortOrder;
END
GO

-- =====================================================
-- 4. sp_BatchUpdateGameStatus
-- Batch update game status (e.g., start all queued games)
-- =====================================================
PRINT 'Creating sp_BatchUpdateGameStatus...'
GO

CREATE OR ALTER PROCEDURE sp_BatchUpdateGameStatus
    @EventId INT,
    @GameIds NVARCHAR(MAX), -- Comma-separated game IDs
    @NewStatus NVARCHAR(50),
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Parse comma-separated IDs
    DECLARE @GameIdTable TABLE (GameId INT);
    INSERT INTO @GameIdTable (GameId)
    SELECT CAST(value AS INT)
    FROM STRING_SPLIT(@GameIds, ',')
    WHERE ISNUMERIC(value) = 1;

    -- Validate all games belong to this event
    DECLARE @InvalidCount INT;
    SELECT @InvalidCount = COUNT(*)
    FROM @GameIdTable gt
    LEFT JOIN EventGames g ON gt.GameId = g.Id
    LEFT JOIN EncounterMatches em ON g.EncounterMatchId = em.Id
    LEFT JOIN EventEncounters enc ON em.EncounterId = enc.Id
    WHERE enc.EventId IS NULL OR enc.EventId != @EventId;

    IF @InvalidCount > 0
    BEGIN
        SELECT 0 AS UpdatedCount, 'Some games do not belong to this event' AS Message;
        RETURN;
    END

    -- Update games
    DECLARE @UpdatedCount INT = 0;

    IF @NewStatus = 'Playing'
    BEGIN
        UPDATE g
        SET g.Status = 'Playing',
            g.StartedAt = GETDATE(),
            g.UpdatedAt = GETDATE()
        FROM EventGames g
        INNER JOIN @GameIdTable gt ON g.Id = gt.GameId
        WHERE g.Status = 'Queued';

        SET @UpdatedCount = @@ROWCOUNT;
    END
    ELSE IF @NewStatus = 'Queued'
    BEGIN
        UPDATE g
        SET g.Status = 'Queued',
            g.QueuedAt = GETDATE(),
            g.UpdatedAt = GETDATE()
        FROM EventGames g
        INNER JOIN @GameIdTable gt ON g.Id = gt.GameId
        WHERE g.Status IN ('Ready', 'Scheduled', 'Pending');

        SET @UpdatedCount = @@ROWCOUNT;
    END

    SELECT @UpdatedCount AS UpdatedCount, 'Success' AS Message;
END
GO

PRINT 'Migration_144_GameDayEnhancements completed successfully.'
GO
