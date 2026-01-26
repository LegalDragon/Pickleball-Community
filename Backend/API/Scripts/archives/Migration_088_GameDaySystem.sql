-- Migration_088_GameDaySystem.sql
-- Game Day Execution System: Check-ins, Waivers, Spectator Subscriptions, and Game Queue

PRINT 'Starting Migration_088_GameDaySystem.sql';

-- =====================================================
-- 1. Add waiver fields to EventUnitMember
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'WaiverSignedAt')
BEGIN
    ALTER TABLE EventUnitMembers ADD WaiverSignedAt DATETIME NULL;
    PRINT 'Added WaiverSignedAt to EventUnitMembers';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'WaiverDocumentId')
BEGIN
    ALTER TABLE EventUnitMembers ADD WaiverDocumentId INT NULL;
    PRINT 'Added WaiverDocumentId to EventUnitMembers';
END

-- =====================================================
-- 2. Create EventWaiver table for event-specific waivers
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EventWaivers')
BEGIN
    CREATE TABLE EventWaivers (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventId INT NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        Version INT NOT NULL DEFAULT 1,
        IsRequired BIT NOT NULL DEFAULT 1,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedByUserId INT NULL,
        CONSTRAINT FK_EventWaivers_Event FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE CASCADE
    );
    PRINT 'Created EventWaivers table';
END

-- =====================================================
-- 3. Create SpectatorSubscriptions table
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SpectatorSubscriptions')
BEGIN
    CREATE TABLE SpectatorSubscriptions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        EventId INT NOT NULL,
        -- Subscription type: Game, Player, Unit, Division, Event
        SubscriptionType NVARCHAR(20) NOT NULL,
        -- The ID of the entity being subscribed to (GameId, UserId, UnitId, DivisionId)
        TargetId INT NULL,
        -- Notification preferences
        NotifyOnGameQueued BIT NOT NULL DEFAULT 1,
        NotifyOnGameStarted BIT NOT NULL DEFAULT 1,
        NotifyOnScoreUpdate BIT NOT NULL DEFAULT 1,
        NotifyOnGameFinished BIT NOT NULL DEFAULT 1,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_SpectatorSubscriptions_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT FK_SpectatorSubscriptions_Event FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE CASCADE
    );

    CREATE INDEX IX_SpectatorSubscriptions_User ON SpectatorSubscriptions(UserId);
    CREATE INDEX IX_SpectatorSubscriptions_Event ON SpectatorSubscriptions(EventId);
    CREATE INDEX IX_SpectatorSubscriptions_Target ON SpectatorSubscriptions(SubscriptionType, TargetId);

    PRINT 'Created SpectatorSubscriptions table';
END

-- =====================================================
-- 4. Create GameQueue table for court queue management
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'GameQueues')
BEGIN
    CREATE TABLE GameQueues (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventId INT NOT NULL,
        TournamentCourtId INT NOT NULL,
        GameId INT NOT NULL,
        QueuePosition INT NOT NULL DEFAULT 0,
        -- Status: Queued, Current, Completed, Skipped
        Status NVARCHAR(20) NOT NULL DEFAULT 'Queued',
        QueuedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CalledAt DATETIME NULL,
        StartedAt DATETIME NULL,
        CompletedAt DATETIME NULL,
        QueuedByUserId INT NULL,
        Notes NVARCHAR(500) NULL,
        CONSTRAINT FK_GameQueues_Event FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE CASCADE,
        CONSTRAINT FK_GameQueues_Court FOREIGN KEY (TournamentCourtId) REFERENCES TournamentCourts(Id),
        CONSTRAINT FK_GameQueues_Game FOREIGN KEY (GameId) REFERENCES EventGames(Id),
        CONSTRAINT FK_GameQueues_QueuedBy FOREIGN KEY (QueuedByUserId) REFERENCES Users(Id)
    );

    CREATE INDEX IX_GameQueues_Court ON GameQueues(TournamentCourtId, Status);
    CREATE INDEX IX_GameQueues_Event ON GameQueues(EventId, Status);
    CREATE UNIQUE INDEX IX_GameQueues_Game ON GameQueues(GameId) WHERE Status != 'Skipped';

    PRINT 'Created GameQueues table';
END

-- =====================================================
-- 5. Create EventCheckIn table for tracking check-ins
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EventCheckIns')
BEGIN
    CREATE TABLE EventCheckIns (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventId INT NOT NULL,
        UserId INT NOT NULL,
        -- Check-in method: QRCode, Manual, Self
        CheckInMethod NVARCHAR(20) NOT NULL DEFAULT 'Self',
        CheckedInByUserId INT NULL,
        CheckedInAt DATETIME NOT NULL DEFAULT GETDATE(),
        Notes NVARCHAR(500) NULL,
        IpAddress NVARCHAR(50) NULL,
        CONSTRAINT FK_EventCheckIns_Event FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EventCheckIns_User FOREIGN KEY (UserId) REFERENCES Users(Id),
        CONSTRAINT FK_EventCheckIns_CheckedBy FOREIGN KEY (CheckedInByUserId) REFERENCES Users(Id)
    );

    CREATE UNIQUE INDEX IX_EventCheckIns_EventUser ON EventCheckIns(EventId, UserId);

    PRINT 'Created EventCheckIns table';
END

-- =====================================================
-- 6. Add EventMatch fields for playoff advancement
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventMatches') AND name = 'IsPlayoffQualifier')
BEGIN
    ALTER TABLE EventMatches ADD IsPlayoffQualifier BIT NOT NULL DEFAULT 0;
    PRINT 'Added IsPlayoffQualifier to EventMatches';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventMatches') AND name = 'PlayoffAdvancePosition')
BEGIN
    ALTER TABLE EventMatches ADD PlayoffAdvancePosition INT NULL;
    PRINT 'Added PlayoffAdvancePosition to EventMatches';
END

-- =====================================================
-- 7. Add EventUnit fields for playoff tracking
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnits') AND name = 'PoolRank')
BEGIN
    ALTER TABLE EventUnits ADD PoolRank INT NULL;
    PRINT 'Added PoolRank to EventUnits';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnits') AND name = 'OverallRank')
BEGIN
    ALTER TABLE EventUnits ADD OverallRank INT NULL;
    PRINT 'Added OverallRank to EventUnits';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnits') AND name = 'AdvancedToPlayoff')
BEGIN
    ALTER TABLE EventUnits ADD AdvancedToPlayoff BIT NOT NULL DEFAULT 0;
    PRINT 'Added AdvancedToPlayoff to EventUnits';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnits') AND name = 'ManuallyAdvanced')
BEGIN
    ALTER TABLE EventUnits ADD ManuallyAdvanced BIT NOT NULL DEFAULT 0;
    PRINT 'Added ManuallyAdvanced to EventUnits';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnits') AND name = 'FinalPlacement')
BEGIN
    ALTER TABLE EventUnits ADD FinalPlacement INT NULL;
    PRINT 'Added FinalPlacement to EventUnits';
END
GO

-- =====================================================
-- 8. Create stored procedure for getting game day dashboard data
-- =====================================================
IF OBJECT_ID('sp_GetGameDayDashboard', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetGameDayDashboard;
GO
CREATE PROCEDURE sp_GetGameDayDashboard
    @EventId INT,
    @UserId INT = NULL,
    @Role NVARCHAR(20) = 'TD' -- TD, Player, Spectator
AS
BEGIN
    SET NOCOUNT ON;

    -- Event info
    SELECT
        e.Id, e.Name, e.StartDate, e.EndDate, e.TournamentStatus,
        e.VenueName, e.Address, e.City, e.State
    FROM Events e
    WHERE e.Id = @EventId;

    -- Divisions with counts
    SELECT
        d.Id, d.Name, d.ScheduleType,
        (SELECT COUNT(*) FROM EventUnits u WHERE u.DivisionId = d.Id AND u.Status != 'Cancelled') AS UnitCount,
        (SELECT COUNT(*) FROM EventMatches m WHERE m.DivisionId = d.Id) AS MatchCount,
        (SELECT COUNT(*) FROM EventMatches m WHERE m.DivisionId = d.Id AND m.Status = 'Completed') AS CompletedMatchCount
    FROM EventDivisions d
    WHERE d.EventId = @EventId
    ORDER BY d.Name;

    -- Courts with current games
    SELECT
        tc.Id, tc.CourtLabel, tc.SortOrder, tc.Status,
        g.Id AS CurrentGameId,
        g.Status AS CurrentGameStatus,
        m.RoundName,
        u1.Name AS Unit1Name,
        u2.Name AS Unit2Name,
        g.Unit1Score,
        g.Unit2Score
    FROM TournamentCourts tc
    LEFT JOIN EventGames g ON g.TournamentCourtId = tc.Id AND g.Status IN ('Queued', 'Started', 'Playing')
    LEFT JOIN EventMatches m ON g.MatchId = m.Id
    LEFT JOIN EventUnits u1 ON m.Unit1Id = u1.Id
    LEFT JOIN EventUnits u2 ON m.Unit2Id = u2.Id
    WHERE tc.EventId = @EventId AND tc.IsActive = 1
    ORDER BY tc.SortOrder;

    -- If Player, get their specific games
    IF @Role = 'Player' AND @UserId IS NOT NULL
    BEGIN
        SELECT
            g.Id AS GameId,
            g.GameNumber,
            g.Status,
            g.Unit1Score,
            g.Unit2Score,
            g.TournamentCourtId,
            tc.CourtLabel AS CourtName,
            tc.SortOrder,
            m.Id AS MatchId,
            m.RoundType,
            m.RoundName,
            m.ScheduledTime,
            u1.Id AS Unit1Id,
            u1.Name AS Unit1Name,
            u2.Id AS Unit2Id,
            u2.Name AS Unit2Name,
            d.Name AS DivisionName,
            CASE WHEN gp.UnitId = m.Unit1Id THEN 1 ELSE 2 END AS PlayerUnitNumber
        FROM EventGamePlayers gp
        INNER JOIN EventGames g ON gp.GameId = g.Id
        INNER JOIN EventMatches m ON g.MatchId = m.Id
        INNER JOIN EventDivisions d ON m.DivisionId = d.Id
        LEFT JOIN EventUnits u1 ON m.Unit1Id = u1.Id
        LEFT JOIN EventUnits u2 ON m.Unit2Id = u2.Id
        LEFT JOIN TournamentCourts tc ON g.TournamentCourtId = tc.Id
        WHERE gp.UserId = @UserId AND m.EventId = @EventId
        ORDER BY
            CASE g.Status
                WHEN 'Playing' THEN 1
                WHEN 'Started' THEN 2
                WHEN 'Queued' THEN 3
                WHEN 'Ready' THEN 4
                WHEN 'New' THEN 5
                ELSE 6
            END,
            m.ScheduledTime;
    END

    -- Check-in stats
    SELECT
        (SELECT COUNT(DISTINCT um.UserId)
         FROM EventUnitMembers um
         INNER JOIN EventUnits u ON um.UnitId = u.Id
         WHERE u.EventId = @EventId AND um.InviteStatus = 'Accepted') AS TotalPlayers,
        (SELECT COUNT(DISTINCT um.UserId)
         FROM EventUnitMembers um
         INNER JOIN EventUnits u ON um.UnitId = u.Id
         WHERE u.EventId = @EventId AND um.InviteStatus = 'Accepted' AND um.IsCheckedIn = 1) AS CheckedInPlayers,
        (SELECT COUNT(DISTINCT um.UserId)
         FROM EventUnitMembers um
         INNER JOIN EventUnits u ON um.UnitId = u.Id
         WHERE u.EventId = @EventId AND um.InviteStatus = 'Accepted' AND um.WaiverSignedAt IS NOT NULL) AS WaiverSignedPlayers;
END
GO

-- =====================================================
-- 9. Create stored procedure for getting games ready to play
-- =====================================================
IF OBJECT_ID('sp_GetGamesReadyToPlay', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetGamesReadyToPlay;
GO
CREATE PROCEDURE sp_GetGamesReadyToPlay
    @EventId INT,
    @DivisionId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        g.Id AS GameId,
        g.GameNumber,
        g.Status,
        m.Id AS MatchId,
        m.RoundType,
        m.RoundNumber,
        m.RoundName,
        m.ScheduledTime,
        m.BestOf,
        d.Id AS DivisionId,
        d.Name AS DivisionName,
        u1.Id AS Unit1Id,
        u1.Name AS Unit1Name,
        u2.Id AS Unit2Id,
        u2.Name AS Unit2Name,
        -- Check if all players checked in for Unit1
        (SELECT COUNT(*) FROM EventUnitMembers um
         WHERE um.UnitId = u1.Id AND um.InviteStatus = 'Accepted' AND um.IsCheckedIn = 1) AS Unit1CheckedIn,
        (SELECT COUNT(*) FROM EventUnitMembers um
         WHERE um.UnitId = u1.Id AND um.InviteStatus = 'Accepted') AS Unit1TotalPlayers,
        -- Check if all players checked in for Unit2
        (SELECT COUNT(*) FROM EventUnitMembers um
         WHERE um.UnitId = u2.Id AND um.InviteStatus = 'Accepted' AND um.IsCheckedIn = 1) AS Unit2CheckedIn,
        (SELECT COUNT(*) FROM EventUnitMembers um
         WHERE um.UnitId = u2.Id AND um.InviteStatus = 'Accepted') AS Unit2TotalPlayers,
        g.TournamentCourtId,
        tc.CourtLabel AS CourtName,
        tc.SortOrder
    FROM EventGames g
    INNER JOIN EventMatches m ON g.MatchId = m.Id
    INNER JOIN EventDivisions d ON m.DivisionId = d.Id
    LEFT JOIN EventUnits u1 ON m.Unit1Id = u1.Id
    LEFT JOIN EventUnits u2 ON m.Unit2Id = u2.Id
    LEFT JOIN TournamentCourts tc ON g.TournamentCourtId = tc.Id
    WHERE m.EventId = @EventId
        AND g.Status IN ('New', 'Ready')
        AND m.Unit1Id IS NOT NULL
        AND m.Unit2Id IS NOT NULL
        AND (@DivisionId IS NULL OR m.DivisionId = @DivisionId)
    ORDER BY
        m.RoundNumber,
        m.MatchNumber,
        g.GameNumber;
END
GO

-- =====================================================
-- 10. Create stored procedure for scoreboard
-- =====================================================
IF OBJECT_ID('sp_GetScoreboard', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetScoreboard;
GO
CREATE PROCEDURE sp_GetScoreboard
    @EventId INT,
    @DivisionId INT = NULL,
    @RoundType NVARCHAR(20) = NULL, -- Pool, Bracket, Final
    @Status NVARCHAR(20) = NULL, -- Scheduled, InProgress, Completed
    @PageNumber INT = 1,
    @PageSize INT = 50
AS
BEGIN
    SET NOCOUNT ON;

    -- Get total count
    SELECT COUNT(*) AS TotalCount
    FROM EventMatches m
    WHERE m.EventId = @EventId
        AND (@DivisionId IS NULL OR m.DivisionId = @DivisionId)
        AND (@RoundType IS NULL OR m.RoundType = @RoundType)
        AND (@Status IS NULL OR m.Status = @Status);

    -- Get matches (without JSON, games fetched separately)
    ;WITH MatchesCTE AS (
        SELECT
            m.Id AS MatchId,
            m.RoundType,
            m.RoundNumber,
            m.RoundName,
            m.MatchNumber,
            m.BracketPosition,
            m.BestOf,
            m.Status,
            m.ScheduledTime,
            m.StartedAt,
            m.CompletedAt,
            d.Id AS DivisionId,
            d.Name AS DivisionName,
            u1.Id AS Unit1Id,
            u1.Name AS Unit1Name,
            u1.Seed AS Unit1Seed,
            u2.Id AS Unit2Id,
            u2.Name AS Unit2Name,
            u2.Seed AS Unit2Seed,
            m.WinnerUnitId,
            tc.CourtLabel AS CourtName,
            tc.SortOrder,
            ROW_NUMBER() OVER (ORDER BY
                CASE m.Status
                    WHEN 'InProgress' THEN 1
                    WHEN 'Ready' THEN 2
                    WHEN 'Scheduled' THEN 3
                    WHEN 'Completed' THEN 4
                    ELSE 5
                END,
                m.ScheduledTime,
                m.RoundNumber,
                m.MatchNumber) AS RowNum
        FROM EventMatches m
        INNER JOIN EventDivisions d ON m.DivisionId = d.Id
        LEFT JOIN EventUnits u1 ON m.Unit1Id = u1.Id
        LEFT JOIN EventUnits u2 ON m.Unit2Id = u2.Id
        LEFT JOIN TournamentCourts tc ON m.TournamentCourtId = tc.Id
        WHERE m.EventId = @EventId
            AND (@DivisionId IS NULL OR m.DivisionId = @DivisionId)
            AND (@RoundType IS NULL OR m.RoundType = @RoundType)
            AND (@Status IS NULL OR m.Status = @Status)
    )
    SELECT MatchId, RoundType, RoundNumber, RoundName, MatchNumber, BracketPosition, BestOf, Status,
           ScheduledTime, StartedAt, CompletedAt, DivisionId, DivisionName, Unit1Id, Unit1Name, Unit1Seed,
           Unit2Id, Unit2Name, Unit2Seed, WinnerUnitId, CourtName, SortOrder
    FROM MatchesCTE
    WHERE RowNum > ((@PageNumber - 1) * @PageSize) AND RowNum <= (@PageNumber * @PageSize);
END
GO

-- =====================================================
-- 11. Create stored procedure for event results
-- =====================================================
IF OBJECT_ID('sp_GetEventResults', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetEventResults;
GO
CREATE PROCEDURE sp_GetEventResults
    @EventId INT,
    @DivisionId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Division standings
    SELECT
        d.Id AS DivisionId,
        d.Name AS DivisionName,
        u.Id AS UnitId,
        u.Name AS UnitName,
        u.PoolNumber,
        u.PoolName,
        u.PoolRank,
        u.OverallRank,
        u.FinalPlacement,
        u.AdvancedToPlayoff,
        u.MatchesPlayed,
        u.MatchesWon,
        u.MatchesLost,
        u.GamesWon,
        u.GamesLost,
        u.PointsScored,
        u.PointsAgainst,
        u.PointsScored - u.PointsAgainst AS PointDifferential,
        -- Member names (using STUFF/FOR XML PATH for compatibility)
        STUFF((SELECT ' / ' + usr.FirstName + ' ' + usr.LastName
               FROM EventUnitMembers um
               INNER JOIN Users usr ON um.UserId = usr.Id
               WHERE um.UnitId = u.Id AND um.InviteStatus = 'Accepted'
               FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 3, '') AS PlayerNames
    FROM EventUnits u
    INNER JOIN EventDivisions d ON u.DivisionId = d.Id
    WHERE d.EventId = @EventId
        AND u.Status NOT IN ('Cancelled', 'Waitlisted')
        AND (@DivisionId IS NULL OR d.Id = @DivisionId)
    ORDER BY
        d.Name,
        COALESCE(u.FinalPlacement, 999),
        COALESCE(u.OverallRank, 999),
        u.MatchesWon DESC,
        (u.PointsScored - u.PointsAgainst) DESC;
END
GO

-- =====================================================
-- 12. Create stored procedure for player game history
-- =====================================================
IF OBJECT_ID('sp_GetPlayerGameHistory', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetPlayerGameHistory;
GO
CREATE PROCEDURE sp_GetPlayerGameHistory
    @UserId INT,
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    -- Get total count
    SELECT COUNT(*) AS TotalCount
    FROM EventGamePlayers gp
    INNER JOIN EventGames g ON gp.GameId = g.Id
    WHERE gp.UserId = @UserId AND g.Status = 'Finished';

    -- Get game history using ROW_NUMBER for pagination
    ;WITH GameHistoryCTE AS (
        SELECT
            g.Id AS GameId,
            g.GameNumber,
            g.Unit1Score,
            g.Unit2Score,
            g.WinnerUnitId,
            g.StartedAt,
            g.FinishedAt,
            m.Id AS MatchId,
            m.RoundType,
            m.RoundName,
            d.Id AS DivisionId,
            d.Name AS DivisionName,
            e.Id AS EventId,
            e.Name AS EventName,
            e.StartDate AS EventDate,
            u1.Id AS Unit1Id,
            u1.Name AS Unit1Name,
            u2.Id AS Unit2Id,
            u2.Name AS Unit2Name,
            gp.UnitId AS PlayerUnitId,
            CASE WHEN g.WinnerUnitId = gp.UnitId THEN 1 ELSE 0 END AS IsWin,
            tc.CourtLabel AS CourtName,
            ROW_NUMBER() OVER (ORDER BY g.FinishedAt DESC) AS RowNum
        FROM EventGamePlayers gp
        INNER JOIN EventGames g ON gp.GameId = g.Id
        INNER JOIN EventMatches m ON g.MatchId = m.Id
        INNER JOIN EventDivisions d ON m.DivisionId = d.Id
        INNER JOIN Events e ON m.EventId = e.Id
        LEFT JOIN EventUnits u1 ON m.Unit1Id = u1.Id
        LEFT JOIN EventUnits u2 ON m.Unit2Id = u2.Id
        LEFT JOIN TournamentCourts tc ON g.TournamentCourtId = tc.Id
        WHERE gp.UserId = @UserId AND g.Status = 'Finished'
    )
    SELECT GameId, GameNumber, Unit1Score, Unit2Score, WinnerUnitId, StartedAt, FinishedAt,
           MatchId, RoundType, RoundName, DivisionId, DivisionName, EventId, EventName, EventDate,
           Unit1Id, Unit1Name, Unit2Id, Unit2Name, PlayerUnitId, IsWin, CourtName
    FROM GameHistoryCTE
    WHERE RowNum > ((@PageNumber - 1) * @PageSize) AND RowNum <= (@PageNumber * @PageSize);
END
GO

PRINT 'Migration_088_GameDaySystem.sql completed successfully';
