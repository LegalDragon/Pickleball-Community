-- Migration 075: InstaGame - Spontaneous Pickup Game Sessions
-- Adds InstaGames, InstaGamePlayers, InstaGameMatches, InstaGameQueue tables
-- for managing real-time pickup games with Popcorn, Gauntlet, and Manual scheduling

PRINT 'Starting Migration 075: InstaGame System...'

-- ============================================
-- Create InstaGames table (core session entity)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'InstaGames')
BEGIN
    PRINT 'Creating InstaGames table...'
    CREATE TABLE InstaGames (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CreatorId INT NOT NULL,
        VenueId INT NULL,
        CourtId INT NULL,

        -- Session info
        Name NVARCHAR(100) NOT NULL,
        JoinCode NVARCHAR(10) NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'Lobby', -- Lobby, Active, Paused, Completed, Cancelled

        -- Scheduling method
        SchedulingMethod NVARCHAR(20) NOT NULL DEFAULT 'Manual', -- Manual, Popcorn, Gauntlet

        -- Game configuration
        ScoreFormatId INT NULL,
        MaxPlayers INT NULL, -- NULL = unlimited
        TeamSize INT NOT NULL DEFAULT 2, -- 1=singles, 2=doubles

        -- Location (if no venue selected)
        CustomLocationName NVARCHAR(200) NULL,
        Latitude DECIMAL(9,6) NULL,
        Longitude DECIMAL(9,6) NULL,

        -- Timestamps
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        StartedAt DATETIME2 NULL,
        EndedAt DATETIME2 NULL,

        CONSTRAINT FK_InstaGames_Creator FOREIGN KEY (CreatorId) REFERENCES Users(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_InstaGames_Venue FOREIGN KEY (VenueId) REFERENCES Venues(Id) ON DELETE SET NULL,
        CONSTRAINT FK_InstaGames_ScoreFormat FOREIGN KEY (ScoreFormatId) REFERENCES ScoreFormats(Id) ON DELETE SET NULL
    )
    CREATE UNIQUE INDEX IX_InstaGames_JoinCode ON InstaGames(JoinCode)
    CREATE INDEX IX_InstaGames_Status ON InstaGames(Status)
    CREATE INDEX IX_InstaGames_CreatorId ON InstaGames(CreatorId)
    CREATE INDEX IX_InstaGames_Location ON InstaGames(Latitude, Longitude) WHERE Latitude IS NOT NULL
    CREATE INDEX IX_InstaGames_CreatedAt ON InstaGames(CreatedAt DESC)
    PRINT 'InstaGames table created successfully.'
END
ELSE
    PRINT 'InstaGames table already exists.'

-- ============================================
-- Create InstaGamePlayers table (players in a session)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'InstaGamePlayers')
BEGIN
    PRINT 'Creating InstaGamePlayers table...'
    CREATE TABLE InstaGamePlayers (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        InstaGameId INT NOT NULL,
        UserId INT NOT NULL,

        -- Player state
        Status NVARCHAR(20) NOT NULL DEFAULT 'Available', -- Available, Playing, Resting, Left
        IsOrganizer BIT NOT NULL DEFAULT 0, -- Can manage games

        -- Stats for this session
        GamesPlayed INT NOT NULL DEFAULT 0,
        GamesWon INT NOT NULL DEFAULT 0,
        PointsScored INT NOT NULL DEFAULT 0,
        PointsAgainst INT NOT NULL DEFAULT 0,

        -- Gauntlet specific - win streak tracking
        CurrentWinStreak INT NOT NULL DEFAULT 0,
        MaxWinStreak INT NOT NULL DEFAULT 0,

        -- Queue position (for scheduling)
        QueuePosition INT NULL,
        QueuedAt DATETIME2 NULL,

        JoinedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        LeftAt DATETIME2 NULL,

        CONSTRAINT FK_InstaGamePlayers_InstaGame FOREIGN KEY (InstaGameId) REFERENCES InstaGames(Id) ON DELETE CASCADE,
        CONSTRAINT FK_InstaGamePlayers_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE NO ACTION,
        CONSTRAINT UQ_InstaGamePlayers_GameUser UNIQUE (InstaGameId, UserId)
    )
    CREATE INDEX IX_InstaGamePlayers_InstaGameId ON InstaGamePlayers(InstaGameId)
    CREATE INDEX IX_InstaGamePlayers_UserId ON InstaGamePlayers(UserId)
    CREATE INDEX IX_InstaGamePlayers_Status ON InstaGamePlayers(InstaGameId, Status)
    CREATE INDEX IX_InstaGamePlayers_QueuePosition ON InstaGamePlayers(InstaGameId, QueuePosition) WHERE QueuePosition IS NOT NULL
    PRINT 'InstaGamePlayers table created successfully.'
END
ELSE
    PRINT 'InstaGamePlayers table already exists.'

-- ============================================
-- Create InstaGameMatches table (individual games within session)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'InstaGameMatches')
BEGIN
    PRINT 'Creating InstaGameMatches table...'
    CREATE TABLE InstaGameMatches (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        InstaGameId INT NOT NULL,

        -- Match info
        MatchNumber INT NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending, Ready, InProgress, Completed, Cancelled

        -- Teams (JSON array of player IDs for flexibility)
        Team1PlayerIds NVARCHAR(200) NOT NULL, -- JSON: [1,2] for doubles
        Team2PlayerIds NVARCHAR(200) NOT NULL,

        -- Scores
        Team1Score INT NOT NULL DEFAULT 0,
        Team2Score INT NOT NULL DEFAULT 0,
        WinningTeam INT NULL, -- 1 or 2

        -- Score confirmation (optional)
        ScoreSubmittedByUserId INT NULL,
        ScoreSubmittedAt DATETIME2 NULL,
        ScoreConfirmedByUserId INT NULL,
        ScoreConfirmedAt DATETIME2 NULL,

        -- Timestamps
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        StartedAt DATETIME2 NULL,
        CompletedAt DATETIME2 NULL,

        CONSTRAINT FK_InstaGameMatches_InstaGame FOREIGN KEY (InstaGameId) REFERENCES InstaGames(Id) ON DELETE CASCADE,
        CONSTRAINT FK_InstaGameMatches_SubmittedBy FOREIGN KEY (ScoreSubmittedByUserId) REFERENCES Users(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_InstaGameMatches_ConfirmedBy FOREIGN KEY (ScoreConfirmedByUserId) REFERENCES Users(Id) ON DELETE NO ACTION
    )
    CREATE INDEX IX_InstaGameMatches_InstaGameId ON InstaGameMatches(InstaGameId)
    CREATE INDEX IX_InstaGameMatches_Status ON InstaGameMatches(Status)
    CREATE INDEX IX_InstaGameMatches_MatchNumber ON InstaGameMatches(InstaGameId, MatchNumber)
    PRINT 'InstaGameMatches table created successfully.'
END
ELSE
    PRINT 'InstaGameMatches table already exists.'

-- ============================================
-- Create InstaGameQueue table (upcoming team pairings)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'InstaGameQueue')
BEGIN
    PRINT 'Creating InstaGameQueue table...'
    CREATE TABLE InstaGameQueue (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        InstaGameId INT NOT NULL,

        Position INT NOT NULL, -- Queue order
        Team1PlayerIds NVARCHAR(200) NOT NULL, -- JSON array of user IDs
        Team2PlayerIds NVARCHAR(200) NULL, -- NULL for challenge queue where team2 TBD

        QueueType NVARCHAR(20) NOT NULL DEFAULT 'Standard', -- Standard, Challenge, Winner, Loser
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_InstaGameQueue_InstaGame FOREIGN KEY (InstaGameId) REFERENCES InstaGames(Id) ON DELETE CASCADE
    )
    CREATE INDEX IX_InstaGameQueue_Position ON InstaGameQueue(InstaGameId, Position)
    CREATE INDEX IX_InstaGameQueue_QueueType ON InstaGameQueue(InstaGameId, QueueType)
    PRINT 'InstaGameQueue table created successfully.'
END
ELSE
    PRINT 'InstaGameQueue table already exists.'

-- ============================================
-- Create stored procedure for generating join codes
-- ============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_GenerateInstaGameJoinCode]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[sp_GenerateInstaGameJoinCode]
GO

CREATE PROCEDURE [dbo].[sp_GenerateInstaGameJoinCode]
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Code NVARCHAR(10)
    DECLARE @Chars NVARCHAR(32) = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' -- No confusing chars (0/O, 1/I/L)
    DECLARE @Attempts INT = 0
    DECLARE @MaxAttempts INT = 100

    WHILE @Attempts < @MaxAttempts
    BEGIN
        -- Generate 4 random characters
        SET @Code = 'G-' +
            SUBSTRING(@Chars, ABS(CHECKSUM(NEWID())) % 32 + 1, 1) +
            SUBSTRING(@Chars, ABS(CHECKSUM(NEWID())) % 32 + 1, 1) +
            SUBSTRING(@Chars, ABS(CHECKSUM(NEWID())) % 32 + 1, 1) +
            SUBSTRING(@Chars, ABS(CHECKSUM(NEWID())) % 32 + 1, 1)

        -- Check if code is unique
        IF NOT EXISTS (SELECT 1 FROM InstaGames WHERE JoinCode = @Code)
        BEGIN
            SELECT @Code AS JoinCode
            RETURN
        END

        SET @Attempts = @Attempts + 1
    END

    -- Fallback: use timestamp-based code
    SET @Code = 'G-' + RIGHT(CONVERT(VARCHAR(20), ABS(CHECKSUM(NEWID()))), 4)
    SELECT @Code AS JoinCode
END
GO

PRINT 'sp_GenerateInstaGameJoinCode stored procedure created.'

-- ============================================
-- Create stored procedure for Popcorn scheduling
-- After each game: Winners split, each pairs with a loser
-- ============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_InstaGame_PopcornNextMatch]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[sp_InstaGame_PopcornNextMatch]
GO

CREATE PROCEDURE [dbo].[sp_InstaGame_PopcornNextMatch]
    @InstaGameId INT,
    @LastMatchId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TeamSize INT
    DECLARE @Team1Json NVARCHAR(200)
    DECLARE @Team2Json NVARCHAR(200)

    SELECT @TeamSize = TeamSize FROM InstaGames WHERE Id = @InstaGameId

    -- If there's a last match, use winners/losers for rotation
    IF @LastMatchId IS NOT NULL
    BEGIN
        DECLARE @Team1PlayerIds NVARCHAR(200), @Team2PlayerIds NVARCHAR(200), @WinningTeam INT
        SELECT @Team1PlayerIds = Team1PlayerIds, @Team2PlayerIds = Team2PlayerIds, @WinningTeam = WinningTeam
        FROM InstaGameMatches WHERE Id = @LastMatchId

        IF @WinningTeam IS NOT NULL AND @TeamSize = 2
        BEGIN
            -- Popcorn rotation: W1+L1 vs W2+L2 (winners split up)
            -- Parse JSON arrays using OPENJSON
            DECLARE @W1 INT, @W2 INT, @L1 INT, @L2 INT
            DECLARE @WinnersJson NVARCHAR(200), @LosersJson NVARCHAR(200)

            IF @WinningTeam = 1
            BEGIN
                SET @WinnersJson = @Team1PlayerIds
                SET @LosersJson = @Team2PlayerIds
            END
            ELSE
            BEGIN
                SET @WinnersJson = @Team2PlayerIds
                SET @LosersJson = @Team1PlayerIds
            END

            -- Get first and second player from winners
            SELECT @W1 = CAST(value AS INT) FROM OPENJSON(@WinnersJson) WHERE [key] = '0'
            SELECT @W2 = CAST(value AS INT) FROM OPENJSON(@WinnersJson) WHERE [key] = '1'

            -- Get first and second player from losers
            SELECT @L1 = CAST(value AS INT) FROM OPENJSON(@LosersJson) WHERE [key] = '0'
            SELECT @L2 = CAST(value AS INT) FROM OPENJSON(@LosersJson) WHERE [key] = '1'

            -- New teams: W1+L1 vs W2+L2
            SET @Team1Json = '[' + CAST(@W1 AS NVARCHAR(20)) + ',' + CAST(@L1 AS NVARCHAR(20)) + ']'
            SET @Team2Json = '[' + CAST(@W2 AS NVARCHAR(20)) + ',' + CAST(@L2 AS NVARCHAR(20)) + ']'

            SELECT @Team1Json AS Team1PlayerIds, @Team2Json AS Team2PlayerIds
            RETURN
        END
    END

    -- Fallback: Get available players and form random teams
    DECLARE @AvailablePlayers TABLE (UserId INT, RowNum INT)
    INSERT INTO @AvailablePlayers
    SELECT UserId, ROW_NUMBER() OVER (ORDER BY NEWID()) AS RowNum
    FROM InstaGamePlayers
    WHERE InstaGameId = @InstaGameId AND Status = 'Available'

    IF (SELECT COUNT(*) FROM @AvailablePlayers) >= @TeamSize * 2
    BEGIN
        IF @TeamSize = 1
        BEGIN
            SELECT @Team1Json = '[' + CAST((SELECT UserId FROM @AvailablePlayers WHERE RowNum = 1) AS NVARCHAR(20)) + ']'
            SELECT @Team2Json = '[' + CAST((SELECT UserId FROM @AvailablePlayers WHERE RowNum = 2) AS NVARCHAR(20)) + ']'
        END
        ELSE IF @TeamSize = 2
        BEGIN
            SET @Team1Json = '[' +
                CAST((SELECT UserId FROM @AvailablePlayers WHERE RowNum = 1) AS NVARCHAR(20)) + ',' +
                CAST((SELECT UserId FROM @AvailablePlayers WHERE RowNum = 2) AS NVARCHAR(20)) + ']'
            SET @Team2Json = '[' +
                CAST((SELECT UserId FROM @AvailablePlayers WHERE RowNum = 3) AS NVARCHAR(20)) + ',' +
                CAST((SELECT UserId FROM @AvailablePlayers WHERE RowNum = 4) AS NVARCHAR(20)) + ']'
        END

        SELECT @Team1Json AS Team1PlayerIds, @Team2Json AS Team2PlayerIds
    END
    ELSE
    BEGIN
        SELECT NULL AS Team1PlayerIds, NULL AS Team2PlayerIds
    END
END
GO

PRINT 'sp_InstaGame_PopcornNextMatch stored procedure created.'

-- ============================================
-- Create stored procedure for Gauntlet scheduling
-- Winners stay on court, losers go to back of queue
-- ============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_InstaGame_GauntletNextMatch]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[sp_InstaGame_GauntletNextMatch]
GO

CREATE PROCEDURE [dbo].[sp_InstaGame_GauntletNextMatch]
    @InstaGameId INT,
    @LastMatchId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TeamSize INT
    DECLARE @WinnersJson NVARCHAR(200)
    DECLARE @ChallengersJson NVARCHAR(200)

    SELECT @TeamSize = TeamSize FROM InstaGames WHERE Id = @InstaGameId

    -- If there's a last match, winners stay, get next challengers from queue
    IF @LastMatchId IS NOT NULL
    BEGIN
        DECLARE @Team1PlayerIds NVARCHAR(200), @Team2PlayerIds NVARCHAR(200), @WinningTeam INT
        SELECT @Team1PlayerIds = Team1PlayerIds, @Team2PlayerIds = Team2PlayerIds, @WinningTeam = WinningTeam
        FROM InstaGameMatches WHERE Id = @LastMatchId

        IF @WinningTeam IS NOT NULL
        BEGIN
            -- Winners stay
            IF @WinningTeam = 1
                SET @WinnersJson = @Team1PlayerIds
            ELSE
                SET @WinnersJson = @Team2PlayerIds

            -- Get next challengers from available players (not current winners)
            DECLARE @Challengers TABLE (UserId INT, RowNum INT)
            INSERT INTO @Challengers
            SELECT UserId, ROW_NUMBER() OVER (ORDER BY QueuePosition, QueuedAt, JoinedAt) AS RowNum
            FROM InstaGamePlayers
            WHERE InstaGameId = @InstaGameId
                AND Status = 'Available'
                AND UserId NOT IN (
                    SELECT CAST(value AS INT)
                    FROM OPENJSON(@WinnersJson)
                )

            IF (SELECT COUNT(*) FROM @Challengers) >= @TeamSize
            BEGIN
                IF @TeamSize = 1
                BEGIN
                    SELECT @ChallengersJson = '[' + CAST((SELECT UserId FROM @Challengers WHERE RowNum = 1) AS NVARCHAR(20)) + ']'
                END
                ELSE IF @TeamSize = 2
                BEGIN
                    SET @ChallengersJson = '[' +
                        CAST((SELECT UserId FROM @Challengers WHERE RowNum = 1) AS NVARCHAR(20)) + ',' +
                        CAST((SELECT UserId FROM @Challengers WHERE RowNum = 2) AS NVARCHAR(20)) + ']'
                END

                SELECT @WinnersJson AS Team1PlayerIds, @ChallengersJson AS Team2PlayerIds
                RETURN
            END
        END
    END

    -- Fallback: First match or not enough players - get from queue order
    DECLARE @AvailablePlayers TABLE (UserId INT, RowNum INT)
    INSERT INTO @AvailablePlayers
    SELECT UserId, ROW_NUMBER() OVER (ORDER BY QueuePosition, QueuedAt, JoinedAt) AS RowNum
    FROM InstaGamePlayers
    WHERE InstaGameId = @InstaGameId AND Status = 'Available'

    IF (SELECT COUNT(*) FROM @AvailablePlayers) >= @TeamSize * 2
    BEGIN
        IF @TeamSize = 1
        BEGIN
            SELECT @WinnersJson = '[' + CAST((SELECT UserId FROM @AvailablePlayers WHERE RowNum = 1) AS NVARCHAR(20)) + ']'
            SELECT @ChallengersJson = '[' + CAST((SELECT UserId FROM @AvailablePlayers WHERE RowNum = 2) AS NVARCHAR(20)) + ']'
        END
        ELSE IF @TeamSize = 2
        BEGIN
            SET @WinnersJson = '[' +
                CAST((SELECT UserId FROM @AvailablePlayers WHERE RowNum = 1) AS NVARCHAR(20)) + ',' +
                CAST((SELECT UserId FROM @AvailablePlayers WHERE RowNum = 2) AS NVARCHAR(20)) + ']'
            SET @ChallengersJson = '[' +
                CAST((SELECT UserId FROM @AvailablePlayers WHERE RowNum = 3) AS NVARCHAR(20)) + ',' +
                CAST((SELECT UserId FROM @AvailablePlayers WHERE RowNum = 4) AS NVARCHAR(20)) + ']'
        END

        SELECT @WinnersJson AS Team1PlayerIds, @ChallengersJson AS Team2PlayerIds
    END
    ELSE
    BEGIN
        SELECT NULL AS Team1PlayerIds, NULL AS Team2PlayerIds
    END
END
GO

PRINT 'sp_InstaGame_GauntletNextMatch stored procedure created.'

-- ============================================
-- Create stored procedure for updating player stats after match
-- ============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_InstaGame_UpdatePlayerStats]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[sp_InstaGame_UpdatePlayerStats]
GO

CREATE PROCEDURE [dbo].[sp_InstaGame_UpdatePlayerStats]
    @MatchId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @InstaGameId INT, @Team1PlayerIds NVARCHAR(200), @Team2PlayerIds NVARCHAR(200)
    DECLARE @Team1Score INT, @Team2Score INT, @WinningTeam INT

    SELECT @InstaGameId = InstaGameId,
           @Team1PlayerIds = Team1PlayerIds,
           @Team2PlayerIds = Team2PlayerIds,
           @Team1Score = Team1Score,
           @Team2Score = Team2Score,
           @WinningTeam = WinningTeam
    FROM InstaGameMatches WHERE Id = @MatchId

    IF @WinningTeam IS NULL
        RETURN

    -- Update Team1 players
    UPDATE igp SET
        GamesPlayed = GamesPlayed + 1,
        GamesWon = GamesWon + CASE WHEN @WinningTeam = 1 THEN 1 ELSE 0 END,
        PointsScored = PointsScored + @Team1Score,
        PointsAgainst = PointsAgainst + @Team2Score,
        CurrentWinStreak = CASE WHEN @WinningTeam = 1 THEN CurrentWinStreak + 1 ELSE 0 END,
        MaxWinStreak = CASE WHEN @WinningTeam = 1 AND CurrentWinStreak + 1 > MaxWinStreak THEN CurrentWinStreak + 1 ELSE MaxWinStreak END
    FROM InstaGamePlayers igp
    WHERE igp.InstaGameId = @InstaGameId
        AND igp.UserId IN (SELECT CAST(value AS INT) FROM OPENJSON(@Team1PlayerIds))

    -- Update Team2 players
    UPDATE igp SET
        GamesPlayed = GamesPlayed + 1,
        GamesWon = GamesWon + CASE WHEN @WinningTeam = 2 THEN 1 ELSE 0 END,
        PointsScored = PointsScored + @Team2Score,
        PointsAgainst = PointsAgainst + @Team1Score,
        CurrentWinStreak = CASE WHEN @WinningTeam = 2 THEN CurrentWinStreak + 1 ELSE 0 END,
        MaxWinStreak = CASE WHEN @WinningTeam = 2 AND CurrentWinStreak + 1 > MaxWinStreak THEN CurrentWinStreak + 1 ELSE MaxWinStreak END
    FROM InstaGamePlayers igp
    WHERE igp.InstaGameId = @InstaGameId
        AND igp.UserId IN (SELECT CAST(value AS INT) FROM OPENJSON(@Team2PlayerIds))

    PRINT 'Player stats updated for match ' + CAST(@MatchId AS NVARCHAR(20))
END
GO

PRINT 'sp_InstaGame_UpdatePlayerStats stored procedure created.'

-- ============================================
-- Create stored procedure for finding nearby InstaGames
-- ============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_InstaGame_FindNearby]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[sp_InstaGame_FindNearby]
GO

CREATE PROCEDURE [dbo].[sp_InstaGame_FindNearby]
    @Latitude DECIMAL(9,6),
    @Longitude DECIMAL(9,6),
    @RadiusMiles FLOAT = 10,
    @MaxResults INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    -- Haversine formula for distance calculation
    SELECT TOP (@MaxResults)
        ig.*,
        LTRIM(RTRIM(COALESCE(u.FirstName, '') + ' ' + COALESCE(u.LastName, ''))) AS CreatorName,
        u.ProfileImageUrl AS CreatorAvatarUrl,
        v.Name AS VenueName,
        v.City AS VenueCity,
        v.State AS VenueState,
        (SELECT COUNT(*) FROM InstaGamePlayers WHERE InstaGameId = ig.Id AND Status != 'Left') AS PlayerCount,
        (SELECT COUNT(*) FROM InstaGameMatches WHERE InstaGameId = ig.Id AND Status = 'Completed') AS GamesPlayed,
        -- Distance in miles using Haversine formula
        3959 * ACOS(
            COS(RADIANS(@Latitude)) * COS(RADIANS(COALESCE(ig.Latitude, TRY_CAST(v.GPSLat AS DECIMAL(9,6))))) *
            COS(RADIANS(COALESCE(ig.Longitude, TRY_CAST(v.GPSLng AS DECIMAL(9,6)))) - RADIANS(@Longitude)) +
            SIN(RADIANS(@Latitude)) * SIN(RADIANS(COALESCE(ig.Latitude, TRY_CAST(v.GPSLat AS DECIMAL(9,6)))))
        ) AS DistanceMiles
    FROM InstaGames ig
    LEFT JOIN Users u ON ig.CreatorId = u.Id
    LEFT JOIN Venues v ON ig.VenueId = v.Id
    WHERE ig.Status IN ('Lobby', 'Active', 'Paused')
        AND (ig.Latitude IS NOT NULL OR v.GPSLat IS NOT NULL)
        AND 3959 * ACOS(
            COS(RADIANS(@Latitude)) * COS(RADIANS(COALESCE(ig.Latitude, TRY_CAST(v.GPSLat AS DECIMAL(9,6))))) *
            COS(RADIANS(COALESCE(ig.Longitude, TRY_CAST(v.GPSLng AS DECIMAL(9,6)))) - RADIANS(@Longitude)) +
            SIN(RADIANS(@Latitude)) * SIN(RADIANS(COALESCE(ig.Latitude, TRY_CAST(v.GPSLat AS DECIMAL(9,6)))))
        ) <= @RadiusMiles
    ORDER BY DistanceMiles
END
GO

PRINT 'sp_InstaGame_FindNearby stored procedure created.'

PRINT 'Migration 075: InstaGame System completed successfully.'
