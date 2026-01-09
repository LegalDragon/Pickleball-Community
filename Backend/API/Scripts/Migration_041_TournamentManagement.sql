-- Migration 041: Tournament Management System
-- Adds EventUnits, EventUnitMembers, EventMatches, EventGames, EventGamePlayers,
-- TournamentCourts, ScoreFormats tables for comprehensive tournament management

PRINT 'Starting Migration 041: Tournament Management System...'

-- ============================================
-- Create ScoreFormats table (scoring configuration)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ScoreFormats')
BEGIN
    PRINT 'Creating ScoreFormats table...'
    CREATE TABLE ScoreFormats (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,

        -- Scoring type: Classic (side-out) or Rally (rally scoring)
        ScoringType NVARCHAR(20) NOT NULL DEFAULT 'Rally', -- Classic, Rally

        -- Points to win
        MaxPoints INT NOT NULL DEFAULT 11,

        -- Win by margin (1 or 2)
        WinByMargin INT NOT NULL DEFAULT 2,

        -- Switch ends at midpoint
        SwitchEndsAtMidpoint BIT NOT NULL DEFAULT 0,
        MidpointScore INT NULL, -- If null, calculated as MaxPoints/2

        -- Time limit (optional)
        TimeLimitMinutes INT NULL,

        -- For tiebreaker games
        IsTiebreaker BIT NOT NULL DEFAULT 0,

        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        IsDefault BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    )
    CREATE INDEX IX_ScoreFormats_SortOrder ON ScoreFormats(SortOrder)
    PRINT 'ScoreFormats table created successfully.'
END
ELSE
    PRINT 'ScoreFormats table already exists.'

-- Seed default score formats
IF NOT EXISTS (SELECT 1 FROM ScoreFormats WHERE Id = 1)
BEGIN
    PRINT 'Seeding default score formats...'
    SET IDENTITY_INSERT ScoreFormats ON
    INSERT INTO ScoreFormats (Id, Name, Description, ScoringType, MaxPoints, WinByMargin, SwitchEndsAtMidpoint, MidpointScore, IsTiebreaker, SortOrder, IsActive, IsDefault)
    VALUES
        (1, 'Standard Rally (11-2)', 'Rally scoring to 11, win by 2', 'Rally', 11, 2, 1, 6, 0, 1, 1, 1),
        (2, 'Tournament Rally (15-2)', 'Rally scoring to 15, win by 2', 'Rally', 15, 2, 1, 8, 0, 2, 1, 0),
        (3, 'Championship Rally (21-2)', 'Rally scoring to 21, win by 2', 'Rally', 21, 2, 1, 11, 0, 3, 1, 0),
        (4, 'Classic Side-Out (11-2)', 'Traditional side-out scoring to 11', 'Classic', 11, 2, 1, 6, 0, 4, 1, 0),
        (5, 'Tiebreaker (15-2)', 'Tiebreaker game to 15', 'Rally', 15, 2, 1, 8, 1, 5, 1, 0),
        (6, 'Quick Rally (7-1)', 'Quick game to 7, win by 1', 'Rally', 7, 1, 0, NULL, 0, 6, 1, 0)
    SET IDENTITY_INSERT ScoreFormats OFF
    PRINT 'Default score formats seeded.'
END

-- ============================================
-- Create EventUnits table (teams/units registered in a division)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EventUnits')
BEGIN
    PRINT 'Creating EventUnits table...'
    CREATE TABLE EventUnits (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventId INT NOT NULL,
        DivisionId INT NOT NULL,

        -- Unit name (team name or player name for singles)
        Name NVARCHAR(100) NOT NULL,

        -- Random number for bracket placement (assigned when tournament starts)
        UnitNumber INT NULL,

        -- Pool assignment (for round robin)
        PoolNumber INT NULL,
        PoolName NVARCHAR(50) NULL,

        -- Seed (for seeded brackets)
        Seed INT NULL,

        -- Registration/waitlist status
        Status NVARCHAR(20) NOT NULL DEFAULT 'Registered', -- Registered, Confirmed, Waitlisted, Cancelled, CheckedIn
        WaitlistPosition INT NULL,

        -- Captain (who manages this unit)
        CaptainUserId INT NOT NULL,

        -- Stats
        MatchesPlayed INT NOT NULL DEFAULT 0,
        MatchesWon INT NOT NULL DEFAULT 0,
        MatchesLost INT NOT NULL DEFAULT 0,
        GamesWon INT NOT NULL DEFAULT 0,
        GamesLost INT NOT NULL DEFAULT 0,
        PointsScored INT NOT NULL DEFAULT 0,
        PointsAgainst INT NOT NULL DEFAULT 0,

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_EventUnits_Event FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EventUnits_Division FOREIGN KEY (DivisionId) REFERENCES EventDivisions(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventUnits_Captain FOREIGN KEY (CaptainUserId) REFERENCES Users(Id) ON DELETE NO ACTION
    )
    CREATE INDEX IX_EventUnits_EventId ON EventUnits(EventId)
    CREATE INDEX IX_EventUnits_DivisionId ON EventUnits(DivisionId)
    CREATE INDEX IX_EventUnits_Status ON EventUnits(Status)
    CREATE INDEX IX_EventUnits_UnitNumber ON EventUnits(DivisionId, UnitNumber)
    PRINT 'EventUnits table created successfully.'
END
ELSE
    PRINT 'EventUnits table already exists.'

-- ============================================
-- Create EventUnitMembers table (players in each unit)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EventUnitMembers')
BEGIN
    PRINT 'Creating EventUnitMembers table...'
    CREATE TABLE EventUnitMembers (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UnitId INT NOT NULL,
        UserId INT NOT NULL,

        -- Role in team
        Role NVARCHAR(20) NOT NULL DEFAULT 'Player', -- Captain, Player

        -- Invitation status (for team formation)
        InviteStatus NVARCHAR(20) NOT NULL DEFAULT 'Accepted', -- Pending, Accepted, Declined
        InvitedAt DATETIME2 NULL,
        RespondedAt DATETIME2 NULL,

        -- Check-in
        IsCheckedIn BIT NOT NULL DEFAULT 0,
        CheckedInAt DATETIME2 NULL,

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_EventUnitMembers_Unit FOREIGN KEY (UnitId) REFERENCES EventUnits(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EventUnitMembers_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE NO ACTION,
        CONSTRAINT UQ_EventUnitMembers_UnitUser UNIQUE (UnitId, UserId)
    )
    CREATE INDEX IX_EventUnitMembers_UnitId ON EventUnitMembers(UnitId)
    CREATE INDEX IX_EventUnitMembers_UserId ON EventUnitMembers(UserId)
    PRINT 'EventUnitMembers table created successfully.'
END
ELSE
    PRINT 'EventUnitMembers table already exists.'

-- ============================================
-- Create TournamentCourts table (courts available for this event)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TournamentCourts')
BEGIN
    PRINT 'Creating TournamentCourts table...'
    CREATE TABLE TournamentCourts (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventId INT NOT NULL,

        -- Court reference (from Courts table)
        CourtId INT NULL,

        -- Court identifier for this tournament (e.g., "Court 1", "Court A")
        CourtLabel NVARCHAR(50) NOT NULL,

        -- Court status
        Status NVARCHAR(20) NOT NULL DEFAULT 'Available', -- Available, InUse, Maintenance, Closed

        -- Current game being played
        CurrentGameId INT NULL,

        -- Location within venue (optional)
        LocationDescription NVARCHAR(200) NULL,

        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,

        CONSTRAINT FK_TournamentCourts_Event FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TournamentCourts_Court FOREIGN KEY (CourtId) REFERENCES Courts(Id) ON DELETE SET NULL
    )
    CREATE INDEX IX_TournamentCourts_EventId ON TournamentCourts(EventId)
    CREATE INDEX IX_TournamentCourts_Status ON TournamentCourts(Status)
    PRINT 'TournamentCourts table created successfully.'
END
ELSE
    PRINT 'TournamentCourts table already exists.'

-- ============================================
-- Create EventMatches table (scheduled matches)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EventMatches')
BEGIN
    PRINT 'Creating EventMatches table...'
    CREATE TABLE EventMatches (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventId INT NOT NULL,
        DivisionId INT NOT NULL,

        -- Round info
        RoundType NVARCHAR(20) NOT NULL DEFAULT 'Pool', -- Pool, Bracket, Final
        RoundNumber INT NOT NULL DEFAULT 1,
        RoundName NVARCHAR(50) NULL, -- e.g., "Pool A", "Quarterfinal", "Semifinal", "Final"

        -- Match number (within round)
        MatchNumber INT NOT NULL DEFAULT 1,

        -- Bracket position (for elimination brackets)
        BracketPosition INT NULL,

        -- Participating units (using UnitNumber for pre-arranged schedules)
        Unit1Number INT NULL, -- Placeholder before units are assigned
        Unit2Number INT NULL,
        Unit1Id INT NULL,     -- Actual unit after assignment
        Unit2Id INT NULL,

        -- Best of X games
        BestOf INT NOT NULL DEFAULT 1, -- 1, 3, 5

        -- Winner
        WinnerUnitId INT NULL,

        -- Status
        Status NVARCHAR(20) NOT NULL DEFAULT 'Scheduled', -- Scheduled, Ready, InProgress, Completed, Cancelled

        -- Scheduling
        ScheduledTime DATETIME2 NULL,
        StartedAt DATETIME2 NULL,
        CompletedAt DATETIME2 NULL,

        -- Court assignment
        TournamentCourtId INT NULL,

        -- Score format (can override division default)
        ScoreFormatId INT NULL,

        -- Notes
        Notes NVARCHAR(500) NULL,

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_EventMatches_Event FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EventMatches_Division FOREIGN KEY (DivisionId) REFERENCES EventDivisions(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventMatches_Unit1 FOREIGN KEY (Unit1Id) REFERENCES EventUnits(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventMatches_Unit2 FOREIGN KEY (Unit2Id) REFERENCES EventUnits(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventMatches_Winner FOREIGN KEY (WinnerUnitId) REFERENCES EventUnits(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventMatches_Court FOREIGN KEY (TournamentCourtId) REFERENCES TournamentCourts(Id) ON DELETE SET NULL,
        CONSTRAINT FK_EventMatches_ScoreFormat FOREIGN KEY (ScoreFormatId) REFERENCES ScoreFormats(Id) ON DELETE SET NULL
    )
    CREATE INDEX IX_EventMatches_EventId ON EventMatches(EventId)
    CREATE INDEX IX_EventMatches_DivisionId ON EventMatches(DivisionId)
    CREATE INDEX IX_EventMatches_Status ON EventMatches(Status)
    CREATE INDEX IX_EventMatches_RoundType ON EventMatches(DivisionId, RoundType, RoundNumber)
    PRINT 'EventMatches table created successfully.'
END
ELSE
    PRINT 'EventMatches table already exists.'

-- ============================================
-- Create EventGames table (individual games within a match)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EventGames')
BEGIN
    PRINT 'Creating EventGames table...'
    CREATE TABLE EventGames (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        MatchId INT NOT NULL,

        -- Game number within match (1, 2, 3...)
        GameNumber INT NOT NULL DEFAULT 1,

        -- Score format for this game
        ScoreFormatId INT NULL,

        -- Scores
        Unit1Score INT NOT NULL DEFAULT 0,
        Unit2Score INT NOT NULL DEFAULT 0,

        -- Winner
        WinnerUnitId INT NULL,

        -- Status: New, Ready, Queued, Started, Playing, Finished
        Status NVARCHAR(20) NOT NULL DEFAULT 'New',

        -- Court assignment
        TournamentCourtId INT NULL,

        -- Timing
        QueuedAt DATETIME2 NULL,   -- When assigned to a court queue
        StartedAt DATETIME2 NULL,  -- When game actually started
        FinishedAt DATETIME2 NULL,

        -- Score confirmation
        ScoreSubmittedByUnitId INT NULL,
        ScoreSubmittedAt DATETIME2 NULL,
        ScoreConfirmedByUnitId INT NULL,
        ScoreConfirmedAt DATETIME2 NULL,
        ScoreDisputedAt DATETIME2 NULL,
        ScoreDisputeReason NVARCHAR(500) NULL,

        -- Notes
        Notes NVARCHAR(500) NULL,

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_EventGames_Match FOREIGN KEY (MatchId) REFERENCES EventMatches(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EventGames_ScoreFormat FOREIGN KEY (ScoreFormatId) REFERENCES ScoreFormats(Id) ON DELETE SET NULL,
        CONSTRAINT FK_EventGames_Winner FOREIGN KEY (WinnerUnitId) REFERENCES EventUnits(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventGames_Court FOREIGN KEY (TournamentCourtId) REFERENCES TournamentCourts(Id) ON DELETE SET NULL,
        CONSTRAINT FK_EventGames_SubmittedBy FOREIGN KEY (ScoreSubmittedByUnitId) REFERENCES EventUnits(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventGames_ConfirmedBy FOREIGN KEY (ScoreConfirmedByUnitId) REFERENCES EventUnits(Id) ON DELETE NO ACTION
    )
    CREATE INDEX IX_EventGames_MatchId ON EventGames(MatchId)
    CREATE INDEX IX_EventGames_Status ON EventGames(Status)
    CREATE INDEX IX_EventGames_CourtId ON EventGames(TournamentCourtId)
    PRINT 'EventGames table created successfully.'
END
ELSE
    PRINT 'EventGames table already exists.'

-- ============================================
-- Create EventGamePlayers table (players in each game)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EventGamePlayers')
BEGIN
    PRINT 'Creating EventGamePlayers table...'
    CREATE TABLE EventGamePlayers (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        GameId INT NOT NULL,
        UserId INT NOT NULL,
        UnitId INT NOT NULL,

        -- Position in the team for this game
        Position INT NULL, -- 1 or 2 for doubles

        -- Player stats for this game (optional tracking)
        PointsScored INT NULL,

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_EventGamePlayers_Game FOREIGN KEY (GameId) REFERENCES EventGames(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EventGamePlayers_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventGamePlayers_Unit FOREIGN KEY (UnitId) REFERENCES EventUnits(Id) ON DELETE NO ACTION,
        CONSTRAINT UQ_EventGamePlayers_GameUser UNIQUE (GameId, UserId)
    )
    CREATE INDEX IX_EventGamePlayers_GameId ON EventGamePlayers(GameId)
    CREATE INDEX IX_EventGamePlayers_UserId ON EventGamePlayers(UserId)
    PRINT 'EventGamePlayers table created successfully.'
END
ELSE
    PRINT 'EventGamePlayers table already exists.'

-- ============================================
-- Create EventUnitJoinRequests table (requests to join a unit)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EventUnitJoinRequests')
BEGIN
    PRINT 'Creating EventUnitJoinRequests table...'
    CREATE TABLE EventUnitJoinRequests (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UnitId INT NOT NULL,
        UserId INT NOT NULL,

        Message NVARCHAR(500) NULL,

        Status NVARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending, Accepted, Declined

        ResponseMessage NVARCHAR(500) NULL,
        RespondedAt DATETIME2 NULL,

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_EventUnitJoinRequests_Unit FOREIGN KEY (UnitId) REFERENCES EventUnits(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EventUnitJoinRequests_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE NO ACTION
    )
    CREATE INDEX IX_EventUnitJoinRequests_UnitId ON EventUnitJoinRequests(UnitId)
    CREATE INDEX IX_EventUnitJoinRequests_UserId ON EventUnitJoinRequests(UserId)
    CREATE INDEX IX_EventUnitJoinRequests_Status ON EventUnitJoinRequests(Status)
    PRINT 'EventUnitJoinRequests table created successfully.'
END
ELSE
    PRINT 'EventUnitJoinRequests table already exists.'

-- ============================================
-- Add TournamentStatus to Events table
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Events' AND COLUMN_NAME = 'TournamentStatus')
BEGIN
    PRINT 'Adding TournamentStatus column to Events...'
    ALTER TABLE Events ADD TournamentStatus NVARCHAR(20) NOT NULL DEFAULT 'Draft'
    -- Draft, RegistrationOpen, RegistrationClosed, ScheduleReady, Running, Completed, Cancelled
    PRINT 'TournamentStatus column added.'
END
ELSE
    PRINT 'TournamentStatus column already exists in Events.'

-- ============================================
-- Add DefaultScoreFormatId to EventDivisions table
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EventDivisions' AND COLUMN_NAME = 'DefaultScoreFormatId')
BEGIN
    PRINT 'Adding DefaultScoreFormatId column to EventDivisions...'
    ALTER TABLE EventDivisions ADD DefaultScoreFormatId INT NULL
    ALTER TABLE EventDivisions ADD CONSTRAINT FK_EventDivisions_ScoreFormat FOREIGN KEY (DefaultScoreFormatId) REFERENCES ScoreFormats(Id) ON DELETE SET NULL
    PRINT 'DefaultScoreFormatId column added.'
END
ELSE
    PRINT 'DefaultScoreFormatId column already exists in EventDivisions.'

-- ============================================
-- Add PoolCount and BracketType to EventDivisions
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EventDivisions' AND COLUMN_NAME = 'PoolCount')
BEGIN
    PRINT 'Adding tournament structure columns to EventDivisions...'
    ALTER TABLE EventDivisions ADD PoolCount INT NULL -- Number of pools for round robin
    ALTER TABLE EventDivisions ADD BracketType NVARCHAR(20) NULL -- SingleElimination, DoubleElimination, RoundRobin, Hybrid
    ALTER TABLE EventDivisions ADD PlayoffFromPools INT NULL -- How many from each pool advance to playoffs
    ALTER TABLE EventDivisions ADD GamesPerMatch INT NOT NULL DEFAULT 1 -- Best of X
    PRINT 'Tournament structure columns added.'
END
ELSE
    PRINT 'Tournament structure columns already exist in EventDivisions.'

-- ============================================
-- Add foreign key from TournamentCourts.CurrentGameId to EventGames
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'FK_TournamentCourts_CurrentGame')
BEGIN
    PRINT 'Adding FK_TournamentCourts_CurrentGame constraint...'
    ALTER TABLE TournamentCourts ADD CONSTRAINT FK_TournamentCourts_CurrentGame FOREIGN KEY (CurrentGameId) REFERENCES EventGames(Id) ON DELETE SET NULL
    PRINT 'FK_TournamentCourts_CurrentGame constraint added.'
END
ELSE
    PRINT 'FK_TournamentCourts_CurrentGame constraint already exists.'

-- ============================================
-- Add SkillLevelId to EventDivisions if not exists
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EventDivisions' AND COLUMN_NAME = 'SkillLevelId')
BEGIN
    PRINT 'Adding SkillLevelId column to EventDivisions...'
    ALTER TABLE EventDivisions ADD SkillLevelId INT NULL
    -- Check if SkillLevels table exists before adding FK
    IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SkillLevels')
    BEGIN
        ALTER TABLE EventDivisions ADD CONSTRAINT FK_EventDivisions_SkillLevel FOREIGN KEY (SkillLevelId) REFERENCES SkillLevels(Id) ON DELETE SET NULL
    END
    PRINT 'SkillLevelId column added.'
END
ELSE
    PRINT 'SkillLevelId column already exists in EventDivisions.'

-- ============================================
-- Create stored procedure for game status changes
-- (Placeholder for notifications)
-- ============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_OnGameStatusChange]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[sp_OnGameStatusChange]
GO

CREATE PROCEDURE [dbo].[sp_OnGameStatusChange]
    @GameId INT,
    @OldStatus NVARCHAR(20),
    @NewStatus NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    -- Log the status change (can be extended for notifications)
    PRINT 'Game ' + CAST(@GameId AS NVARCHAR(20)) + ' status changed from ' + @OldStatus + ' to ' + @NewStatus

    -- When game is Queued (assigned to court), notify players
    IF @NewStatus = 'Queued'
    BEGIN
        -- TODO: Add notification logic here
        -- INSERT INTO Notifications (UserId, Type, Message, ...)
        -- SELECT UserId, 'GameQueued', 'Your game is ready at Court X'
        -- FROM EventGamePlayers WHERE GameId = @GameId
        PRINT 'Game queued - players should be notified'
    END

    -- When game is Started
    IF @NewStatus = 'Started'
    BEGIN
        PRINT 'Game started'
    END

    -- When game is Finished
    IF @NewStatus = 'Finished'
    BEGIN
        PRINT 'Game finished - update match stats'
    END
END
GO

PRINT 'sp_OnGameStatusChange stored procedure created.'

-- ============================================
-- Create stored procedure for match winner calculation
-- ============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_CalculateMatchWinner]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[sp_CalculateMatchWinner]
GO

CREATE PROCEDURE [dbo].[sp_CalculateMatchWinner]
    @MatchId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @BestOf INT, @Unit1Wins INT, @Unit2Wins INT, @Unit1Id INT, @Unit2Id INT, @WinnerUnitId INT

    -- Get match info
    SELECT @BestOf = BestOf, @Unit1Id = Unit1Id, @Unit2Id = Unit2Id
    FROM EventMatches WHERE Id = @MatchId

    -- Count game wins for each unit
    SELECT @Unit1Wins = COUNT(*) FROM EventGames
    WHERE MatchId = @MatchId AND WinnerUnitId = @Unit1Id AND Status = 'Finished'

    SELECT @Unit2Wins = COUNT(*) FROM EventGames
    WHERE MatchId = @MatchId AND WinnerUnitId = @Unit2Id AND Status = 'Finished'

    -- Determine winner (first to win majority of games)
    DECLARE @WinsNeeded INT = (@BestOf / 2) + 1

    IF @Unit1Wins >= @WinsNeeded
        SET @WinnerUnitId = @Unit1Id
    ELSE IF @Unit2Wins >= @WinsNeeded
        SET @WinnerUnitId = @Unit2Id
    ELSE
        SET @WinnerUnitId = NULL -- Match not yet decided

    -- Update match
    IF @WinnerUnitId IS NOT NULL
    BEGIN
        UPDATE EventMatches
        SET WinnerUnitId = @WinnerUnitId,
            Status = 'Completed',
            CompletedAt = GETUTCDATE(),
            UpdatedAt = GETUTCDATE()
        WHERE Id = @MatchId

        -- Update unit stats
        UPDATE EventUnits SET
            MatchesPlayed = MatchesPlayed + 1,
            MatchesWon = MatchesWon + 1,
            UpdatedAt = GETUTCDATE()
        WHERE Id = @WinnerUnitId

        UPDATE EventUnits SET
            MatchesPlayed = MatchesPlayed + 1,
            MatchesLost = MatchesLost + 1,
            UpdatedAt = GETUTCDATE()
        WHERE Id IN (@Unit1Id, @Unit2Id) AND Id != @WinnerUnitId
    END

    SELECT @WinnerUnitId AS WinnerUnitId, @Unit1Wins AS Unit1Wins, @Unit2Wins AS Unit2Wins
END
GO

PRINT 'sp_CalculateMatchWinner stored procedure created.'

-- ============================================
-- Create stored procedure for assigning random unit numbers
-- ============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_AssignRandomUnitNumbers]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[sp_AssignRandomUnitNumbers]
GO

CREATE PROCEDURE [dbo].[sp_AssignRandomUnitNumbers]
    @DivisionId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Get all confirmed units in random order and assign sequential numbers
    ;WITH RandomizedUnits AS (
        SELECT Id, ROW_NUMBER() OVER (ORDER BY NEWID()) AS NewNumber
        FROM EventUnits
        WHERE DivisionId = @DivisionId AND Status IN ('Registered', 'Confirmed', 'CheckedIn')
    )
    UPDATE eu
    SET UnitNumber = ru.NewNumber, UpdatedAt = GETUTCDATE()
    FROM EventUnits eu
    INNER JOIN RandomizedUnits ru ON eu.Id = ru.Id

    -- Update matches to use actual unit IDs based on unit numbers
    UPDATE em
    SET
        Unit1Id = u1.Id,
        Unit2Id = u2.Id,
        UpdatedAt = GETUTCDATE()
    FROM EventMatches em
    LEFT JOIN EventUnits u1 ON em.DivisionId = u1.DivisionId AND em.Unit1Number = u1.UnitNumber
    LEFT JOIN EventUnits u2 ON em.DivisionId = u2.DivisionId AND em.Unit2Number = u2.UnitNumber
    WHERE em.DivisionId = @DivisionId

    SELECT COUNT(*) AS UnitsAssigned FROM EventUnits WHERE DivisionId = @DivisionId AND UnitNumber IS NOT NULL
END
GO

PRINT 'sp_AssignRandomUnitNumbers stored procedure created.'

PRINT 'Migration 041: Tournament Management System completed successfully.'
