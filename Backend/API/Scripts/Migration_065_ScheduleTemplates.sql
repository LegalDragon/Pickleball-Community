-- Migration 065: Schedule Templates and Match Slots
-- Adds schedule type configuration, match slot templates for team events,
-- and lineup submission system

PRINT 'Starting Migration 065: Schedule Templates and Match Slots'
GO

-- ============================================
-- Add ScheduleType to EventDivisions (enhance existing BracketType)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EventDivisions' AND COLUMN_NAME = 'ScheduleType')
BEGIN
    PRINT 'Adding ScheduleType column to EventDivisions...'
    ALTER TABLE EventDivisions ADD ScheduleType NVARCHAR(30) NULL
    -- RoundRobin, RoundRobinPlayoff, SingleElimination, DoubleElimination, RandomPairing
    PRINT 'ScheduleType column added.'
END
GO

-- Add ScheduleStatus to track generation state
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EventDivisions' AND COLUMN_NAME = 'ScheduleStatus')
BEGIN
    PRINT 'Adding ScheduleStatus column to EventDivisions...'
    ALTER TABLE EventDivisions ADD ScheduleStatus NVARCHAR(20) NOT NULL DEFAULT 'NotGenerated'
    -- NotGenerated, TemplateReady, UnitsAssigned, Finalized
    PRINT 'ScheduleStatus column added.'
END
GO

-- Add PoolSize (target size for auto pool creation)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EventDivisions' AND COLUMN_NAME = 'PoolSize')
BEGIN
    PRINT 'Adding PoolSize column to EventDivisions...'
    ALTER TABLE EventDivisions ADD PoolSize INT NULL -- Target number of units per pool
    PRINT 'PoolSize column added.'
END
GO

-- ============================================
-- Create MatchSlotTypes table (types of sub-matches within a team match)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MatchSlotTypes')
BEGIN
    PRINT 'Creating MatchSlotTypes table...'
    CREATE TABLE MatchSlotTypes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(50) NOT NULL,           -- "Men's Doubles", "Women's Doubles", "Mixed Doubles", "Singles"
        Code NVARCHAR(20) NOT NULL,           -- "MD", "WD", "MX", "MS", "WS"
        Description NVARCHAR(200) NULL,

        -- Player requirements
        PlayersPerSide INT NOT NULL DEFAULT 2, -- 1 for singles, 2 for doubles
        RequiredGender NVARCHAR(10) NULL,      -- NULL (any), Male, Female, Mixed

        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    )
    PRINT 'MatchSlotTypes table created.'
END
GO

-- Seed default match slot types
IF NOT EXISTS (SELECT 1 FROM MatchSlotTypes WHERE Code = 'MD')
BEGIN
    PRINT 'Seeding default match slot types...'
    INSERT INTO MatchSlotTypes (Name, Code, Description, PlayersPerSide, RequiredGender, SortOrder)
    VALUES
        ('Men''s Doubles', 'MD', 'Two male players per side', 2, 'Male', 1),
        ('Women''s Doubles', 'WD', 'Two female players per side', 2, 'Female', 2),
        ('Mixed Doubles', 'MX', 'One male and one female per side', 2, 'Mixed', 3),
        ('Men''s Singles', 'MS', 'One male player per side', 1, 'Male', 4),
        ('Women''s Singles', 'WS', 'One female player per side', 1, 'Female', 5),
        ('Open Doubles', 'OD', 'Any two players per side', 2, NULL, 6),
        ('Open Singles', 'OS', 'Any one player per side', 1, NULL, 7)
    PRINT 'Default match slot types seeded.'
END
GO

-- ============================================
-- Create DivisionMatchSlots table (slots defined for a division's team matches)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'DivisionMatchSlots')
BEGIN
    PRINT 'Creating DivisionMatchSlots table...'
    CREATE TABLE DivisionMatchSlots (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        DivisionId INT NOT NULL,
        MatchSlotTypeId INT NOT NULL,

        -- Slot order within the match
        SlotNumber INT NOT NULL DEFAULT 1,

        -- Custom name override (e.g., "Line 1", "Court 1 Match")
        CustomName NVARCHAR(50) NULL,

        -- Game configuration for this slot
        BestOf INT NOT NULL DEFAULT 1,        -- 1, 3, or 5
        ScoreFormatId INT NULL,

        -- Points contributed to team total (for team scoring)
        PointValue INT NOT NULL DEFAULT 1,

        IsRequired BIT NOT NULL DEFAULT 1,    -- Must this slot be played?

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_DivisionMatchSlots_Division FOREIGN KEY (DivisionId) REFERENCES EventDivisions(Id) ON DELETE CASCADE,
        CONSTRAINT FK_DivisionMatchSlots_SlotType FOREIGN KEY (MatchSlotTypeId) REFERENCES MatchSlotTypes(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_DivisionMatchSlots_ScoreFormat FOREIGN KEY (ScoreFormatId) REFERENCES ScoreFormats(Id) ON DELETE SET NULL
    )
    CREATE INDEX IX_DivisionMatchSlots_DivisionId ON DivisionMatchSlots(DivisionId)
    PRINT 'DivisionMatchSlots table created.'
END
GO

-- ============================================
-- Create EventMatchSlots table (actual sub-matches within an EventMatch)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EventMatchSlots')
BEGIN
    PRINT 'Creating EventMatchSlots table...'
    CREATE TABLE EventMatchSlots (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventMatchId INT NOT NULL,
        DivisionMatchSlotId INT NOT NULL,

        -- Slot number (copied from template)
        SlotNumber INT NOT NULL,

        -- Winner of this slot
        WinnerUnitId INT NULL,

        -- Status
        Status NVARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending, Ready, InProgress, Completed

        -- Timing
        StartedAt DATETIME2 NULL,
        CompletedAt DATETIME2 NULL,

        -- Court assignment for this specific slot
        TournamentCourtId INT NULL,

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_EventMatchSlots_EventMatch FOREIGN KEY (EventMatchId) REFERENCES EventMatches(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EventMatchSlots_DivisionSlot FOREIGN KEY (DivisionMatchSlotId) REFERENCES DivisionMatchSlots(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventMatchSlots_Winner FOREIGN KEY (WinnerUnitId) REFERENCES EventUnits(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventMatchSlots_Court FOREIGN KEY (TournamentCourtId) REFERENCES TournamentCourts(Id) ON DELETE NO ACTION
    )
    CREATE INDEX IX_EventMatchSlots_EventMatchId ON EventMatchSlots(EventMatchId)
    PRINT 'EventMatchSlots table created.'
END
GO

-- ============================================
-- Create EventMatchLineups table (player assignments for each slot)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EventMatchLineups')
BEGIN
    PRINT 'Creating EventMatchLineups table...'
    CREATE TABLE EventMatchLineups (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventMatchSlotId INT NOT NULL,
        UnitId INT NOT NULL,
        UserId INT NOT NULL,

        -- Position within the slot (1 or 2 for doubles)
        Position INT NOT NULL DEFAULT 1,

        -- Lineup submission tracking
        SubmittedByUserId INT NULL,
        SubmittedAt DATETIME2 NULL,

        -- Confirmed by opponent or admin
        IsConfirmed BIT NOT NULL DEFAULT 0,
        ConfirmedAt DATETIME2 NULL,

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_EventMatchLineups_Slot FOREIGN KEY (EventMatchSlotId) REFERENCES EventMatchSlots(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EventMatchLineups_Unit FOREIGN KEY (UnitId) REFERENCES EventUnits(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventMatchLineups_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventMatchLineups_SubmittedBy FOREIGN KEY (SubmittedByUserId) REFERENCES Users(Id) ON DELETE NO ACTION,
        CONSTRAINT UQ_EventMatchLineups_SlotUnitPosition UNIQUE (EventMatchSlotId, UnitId, Position)
    )
    CREATE INDEX IX_EventMatchLineups_SlotId ON EventMatchLineups(EventMatchSlotId)
    CREATE INDEX IX_EventMatchLineups_UnitId ON EventMatchLineups(UnitId)
    PRINT 'EventMatchLineups table created.'
END
GO

-- ============================================
-- Add PoolName to EventMatches for round robin identification
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EventMatches' AND COLUMN_NAME = 'PoolName')
BEGIN
    PRINT 'Adding PoolName column to EventMatches...'
    ALTER TABLE EventMatches ADD PoolName NVARCHAR(50) NULL
    PRINT 'PoolName column added.'
END
GO

-- ============================================
-- Create stored procedure to generate Round Robin schedule template
-- ============================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GenerateRoundRobinSchedule')
    DROP PROCEDURE sp_GenerateRoundRobinSchedule
GO

CREATE PROCEDURE sp_GenerateRoundRobinSchedule
    @DivisionId INT,
    @UnitCount INT,           -- Expected number of units (for placeholder generation)
    @PoolCount INT = 1        -- Number of pools to split units into
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @EventId INT, @UnitsPerPool INT, @PoolNum INT, @RoundNum INT
    DECLARE @i INT, @j INT, @MatchNum INT

    -- Get event ID
    SELECT @EventId = EventId FROM EventDivisions WHERE Id = @DivisionId

    IF @EventId IS NULL
    BEGIN
        RAISERROR('Division not found', 16, 1)
        RETURN
    END

    -- Calculate units per pool
    SET @UnitsPerPool = CEILING(CAST(@UnitCount AS FLOAT) / @PoolCount)

    -- Clear existing matches for this division
    DELETE FROM EventMatches WHERE DivisionId = @DivisionId

    PRINT 'Generating Round Robin schedule for ' + CAST(@UnitCount AS VARCHAR) + ' units in ' + CAST(@PoolCount AS VARCHAR) + ' pools'

    SET @MatchNum = 1
    SET @PoolNum = 1

    WHILE @PoolNum <= @PoolCount
    BEGIN
        DECLARE @PoolStart INT = (@PoolNum - 1) * @UnitsPerPool + 1
        DECLARE @PoolEnd INT = CASE
            WHEN @PoolNum = @PoolCount THEN @UnitCount
            ELSE @PoolNum * @UnitsPerPool
        END
        DECLARE @PoolSize INT = @PoolEnd - @PoolStart + 1
        DECLARE @PoolLetter CHAR(1) = CHAR(64 + @PoolNum) -- A, B, C, etc.

        PRINT 'Pool ' + @PoolLetter + ': Units ' + CAST(@PoolStart AS VARCHAR) + ' to ' + CAST(@PoolEnd AS VARCHAR)

        -- Generate round robin for this pool
        -- For N teams, need N-1 rounds (or N rounds if odd, with bye)
        DECLARE @Rounds INT = CASE WHEN @PoolSize % 2 = 0 THEN @PoolSize - 1 ELSE @PoolSize END

        SET @RoundNum = 1
        WHILE @RoundNum <= @Rounds
        BEGIN
            SET @i = @PoolStart
            WHILE @i < @PoolEnd
            BEGIN
                SET @j = @i + 1
                WHILE @j <= @PoolEnd
                BEGIN
                    -- Create match between unit @i and unit @j
                    INSERT INTO EventMatches (
                        EventId, DivisionId, RoundType, RoundNumber, RoundName,
                        MatchNumber, Unit1Number, Unit2Number, Status, PoolName
                    )
                    VALUES (
                        @EventId, @DivisionId, 'Pool', @RoundNum, 'Pool ' + @PoolLetter + ' Round ' + CAST(@RoundNum AS VARCHAR),
                        @MatchNum, @i, @j, 'Scheduled', 'Pool ' + @PoolLetter
                    )
                    SET @MatchNum = @MatchNum + 1
                    SET @j = @j + 1
                END
                SET @i = @i + 1
            END
            SET @RoundNum = @RoundNum + 1
        END

        SET @PoolNum = @PoolNum + 1
    END

    -- Update division status
    UPDATE EventDivisions
    SET ScheduleStatus = 'TemplateReady',
        PoolCount = @PoolCount
    WHERE Id = @DivisionId

    SELECT
        @MatchNum - 1 AS TotalMatches,
        @PoolCount AS PoolCount,
        @UnitsPerPool AS UnitsPerPool
END
GO

PRINT 'sp_GenerateRoundRobinSchedule created.'
GO

-- ============================================
-- Create stored procedure to generate Single Elimination bracket
-- ============================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GenerateSingleEliminationBracket')
    DROP PROCEDURE sp_GenerateSingleEliminationBracket
GO

CREATE PROCEDURE sp_GenerateSingleEliminationBracket
    @DivisionId INT,
    @UnitCount INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @EventId INT, @TotalRounds INT, @BracketSize INT
    DECLARE @Round INT, @MatchesInRound INT, @Position INT, @MatchNum INT

    -- Get event ID
    SELECT @EventId = EventId FROM EventDivisions WHERE Id = @DivisionId

    -- Calculate bracket size (next power of 2)
    SET @BracketSize = 1
    WHILE @BracketSize < @UnitCount
        SET @BracketSize = @BracketSize * 2

    -- Calculate rounds needed
    SET @TotalRounds = LOG(@BracketSize) / LOG(2)

    -- Clear existing matches
    DELETE FROM EventMatches WHERE DivisionId = @DivisionId

    PRINT 'Generating Single Elimination bracket for ' + CAST(@UnitCount AS VARCHAR) + ' units (' + CAST(@BracketSize AS VARCHAR) + ' bracket size)'

    SET @MatchNum = 1
    SET @Round = 1

    WHILE @Round <= @TotalRounds
    BEGIN
        SET @MatchesInRound = @BracketSize / POWER(2, @Round)
        SET @Position = 1

        DECLARE @RoundName NVARCHAR(50) = CASE
            WHEN @Round = @TotalRounds THEN 'Final'
            WHEN @Round = @TotalRounds - 1 THEN 'Semifinal'
            WHEN @Round = @TotalRounds - 2 THEN 'Quarterfinal'
            ELSE 'Round ' + CAST(@Round AS VARCHAR)
        END

        WHILE @Position <= @MatchesInRound
        BEGIN
            DECLARE @Unit1Num INT = NULL, @Unit2Num INT = NULL

            -- First round: assign unit numbers
            IF @Round = 1
            BEGIN
                SET @Unit1Num = (@Position - 1) * 2 + 1
                SET @Unit2Num = (@Position - 1) * 2 + 2
                -- Handle byes: if unit number > actual units, it's a bye
                IF @Unit1Num > @UnitCount SET @Unit1Num = NULL
                IF @Unit2Num > @UnitCount SET @Unit2Num = NULL
            END

            INSERT INTO EventMatches (
                EventId, DivisionId, RoundType, RoundNumber, RoundName,
                MatchNumber, BracketPosition, Unit1Number, Unit2Number, Status
            )
            VALUES (
                @EventId, @DivisionId, 'Bracket', @Round, @RoundName,
                @MatchNum, @Position, @Unit1Num, @Unit2Num, 'Scheduled'
            )

            SET @MatchNum = @MatchNum + 1
            SET @Position = @Position + 1
        END

        SET @Round = @Round + 1
    END

    -- Update division status
    UPDATE EventDivisions
    SET ScheduleStatus = 'TemplateReady',
        ScheduleType = 'SingleElimination'
    WHERE Id = @DivisionId

    SELECT
        @MatchNum - 1 AS TotalMatches,
        @TotalRounds AS TotalRounds,
        @BracketSize AS BracketSize
END
GO

PRINT 'sp_GenerateSingleEliminationBracket created.'
GO

-- ============================================
-- Create stored procedure to generate Double Elimination bracket
-- ============================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GenerateDoubleEliminationBracket')
    DROP PROCEDURE sp_GenerateDoubleEliminationBracket
GO

CREATE PROCEDURE sp_GenerateDoubleEliminationBracket
    @DivisionId INT,
    @UnitCount INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @EventId INT, @BracketSize INT, @WinnersRounds INT, @LosersRounds INT
    DECLARE @Round INT, @MatchesInRound INT, @Position INT, @MatchNum INT

    SELECT @EventId = EventId FROM EventDivisions WHERE Id = @DivisionId

    -- Calculate bracket size
    SET @BracketSize = 1
    WHILE @BracketSize < @UnitCount
        SET @BracketSize = @BracketSize * 2

    SET @WinnersRounds = LOG(@BracketSize) / LOG(2)
    SET @LosersRounds = (@WinnersRounds - 1) * 2

    DELETE FROM EventMatches WHERE DivisionId = @DivisionId

    PRINT 'Generating Double Elimination bracket for ' + CAST(@UnitCount AS VARCHAR) + ' units'

    SET @MatchNum = 1

    -- Winners bracket
    SET @Round = 1
    WHILE @Round <= @WinnersRounds
    BEGIN
        SET @MatchesInRound = @BracketSize / POWER(2, @Round)
        SET @Position = 1

        WHILE @Position <= @MatchesInRound
        BEGIN
            DECLARE @Unit1Num INT = NULL, @Unit2Num INT = NULL

            IF @Round = 1
            BEGIN
                SET @Unit1Num = (@Position - 1) * 2 + 1
                SET @Unit2Num = (@Position - 1) * 2 + 2
                IF @Unit1Num > @UnitCount SET @Unit1Num = NULL
                IF @Unit2Num > @UnitCount SET @Unit2Num = NULL
            END

            INSERT INTO EventMatches (
                EventId, DivisionId, RoundType, RoundNumber, RoundName,
                MatchNumber, BracketPosition, Unit1Number, Unit2Number, Status
            )
            VALUES (
                @EventId, @DivisionId, 'Winners', @Round,
                'Winners Round ' + CAST(@Round AS VARCHAR),
                @MatchNum, @Position, @Unit1Num, @Unit2Num, 'Scheduled'
            )

            SET @MatchNum = @MatchNum + 1
            SET @Position = @Position + 1
        END
        SET @Round = @Round + 1
    END

    -- Losers bracket (simplified - actual positions need more complex logic)
    SET @Round = 1
    WHILE @Round <= @LosersRounds
    BEGIN
        SET @MatchesInRound = @BracketSize / POWER(2, CEILING(@Round / 2.0) + 1)
        IF @MatchesInRound < 1 SET @MatchesInRound = 1
        SET @Position = 1

        WHILE @Position <= @MatchesInRound
        BEGIN
            INSERT INTO EventMatches (
                EventId, DivisionId, RoundType, RoundNumber, RoundName,
                MatchNumber, BracketPosition, Status
            )
            VALUES (
                @EventId, @DivisionId, 'Losers', @Round,
                'Losers Round ' + CAST(@Round AS VARCHAR),
                @MatchNum, @Position, 'Scheduled'
            )
            SET @MatchNum = @MatchNum + 1
            SET @Position = @Position + 1
        END
        SET @Round = @Round + 1
    END

    -- Grand Final (potentially 2 matches)
    INSERT INTO EventMatches (EventId, DivisionId, RoundType, RoundNumber, RoundName, MatchNumber, BracketPosition, Status)
    VALUES (@EventId, @DivisionId, 'Final', 1, 'Grand Final', @MatchNum, 1, 'Scheduled')
    SET @MatchNum = @MatchNum + 1

    INSERT INTO EventMatches (EventId, DivisionId, RoundType, RoundNumber, RoundName, MatchNumber, BracketPosition, Status)
    VALUES (@EventId, @DivisionId, 'Final', 2, 'Grand Final (If Needed)', @MatchNum, 1, 'Scheduled')

    UPDATE EventDivisions
    SET ScheduleStatus = 'TemplateReady',
        ScheduleType = 'DoubleElimination'
    WHERE Id = @DivisionId

    SELECT @MatchNum AS TotalMatches
END
GO

PRINT 'sp_GenerateDoubleEliminationBracket created.'
GO

-- ============================================
-- Create stored procedure to generate Round Robin + Playoff schedule
-- ============================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GenerateRoundRobinPlayoffSchedule')
    DROP PROCEDURE sp_GenerateRoundRobinPlayoffSchedule
GO

CREATE PROCEDURE sp_GenerateRoundRobinPlayoffSchedule
    @DivisionId INT,
    @UnitCount INT,
    @PoolCount INT = 2,
    @AdvancePerPool INT = 2  -- How many from each pool advance to playoffs
AS
BEGIN
    SET NOCOUNT ON;

    -- First generate round robin pools
    EXEC sp_GenerateRoundRobinSchedule @DivisionId, @UnitCount, @PoolCount

    DECLARE @EventId INT, @MatchNum INT, @PlayoffSize INT
    SELECT @EventId = EventId FROM EventDivisions WHERE Id = @DivisionId

    -- Get next match number
    SELECT @MatchNum = ISNULL(MAX(MatchNumber), 0) + 1 FROM EventMatches WHERE DivisionId = @DivisionId

    -- Calculate playoff bracket size
    SET @PlayoffSize = @PoolCount * @AdvancePerPool

    -- Generate playoff bracket (simplified - semifinals and final)
    IF @PlayoffSize >= 4
    BEGIN
        -- Semifinals
        INSERT INTO EventMatches (EventId, DivisionId, RoundType, RoundNumber, RoundName, MatchNumber, BracketPosition, Status)
        VALUES
            (@EventId, @DivisionId, 'Playoff', 1, 'Semifinal 1', @MatchNum, 1, 'Scheduled'),
            (@EventId, @DivisionId, 'Playoff', 1, 'Semifinal 2', @MatchNum + 1, 2, 'Scheduled')
        SET @MatchNum = @MatchNum + 2

        -- Final
        INSERT INTO EventMatches (EventId, DivisionId, RoundType, RoundNumber, RoundName, MatchNumber, BracketPosition, Status)
        VALUES (@EventId, @DivisionId, 'Final', 2, 'Final', @MatchNum, 1, 'Scheduled')

        -- 3rd place match (optional)
        INSERT INTO EventMatches (EventId, DivisionId, RoundType, RoundNumber, RoundName, MatchNumber, BracketPosition, Status)
        VALUES (@EventId, @DivisionId, 'Playoff', 2, '3rd Place Match', @MatchNum + 1, 2, 'Scheduled')
    END
    ELSE IF @PlayoffSize >= 2
    BEGIN
        -- Just a final
        INSERT INTO EventMatches (EventId, DivisionId, RoundType, RoundNumber, RoundName, MatchNumber, BracketPosition, Status)
        VALUES (@EventId, @DivisionId, 'Final', 1, 'Final', @MatchNum, 1, 'Scheduled')
    END

    UPDATE EventDivisions
    SET ScheduleType = 'RoundRobinPlayoff',
        PlayoffFromPools = @AdvancePerPool
    WHERE Id = @DivisionId

    SELECT 'Round Robin + Playoff schedule generated' AS Result
END
GO

PRINT 'sp_GenerateRoundRobinPlayoffSchedule created.'
GO

-- ============================================
-- Create stored procedure to create match slots from template
-- ============================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_CreateMatchSlotsFromTemplate')
    DROP PROCEDURE sp_CreateMatchSlotsFromTemplate
GO

CREATE PROCEDURE sp_CreateMatchSlotsFromTemplate
    @EventMatchId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @DivisionId INT
    SELECT @DivisionId = DivisionId FROM EventMatches WHERE Id = @EventMatchId

    -- Create slots from division template
    INSERT INTO EventMatchSlots (EventMatchId, DivisionMatchSlotId, SlotNumber, Status)
    SELECT
        @EventMatchId,
        dms.Id,
        dms.SlotNumber,
        'Pending'
    FROM DivisionMatchSlots dms
    WHERE dms.DivisionId = @DivisionId
    ORDER BY dms.SlotNumber

    SELECT @@ROWCOUNT AS SlotsCreated
END
GO

PRINT 'sp_CreateMatchSlotsFromTemplate created.'
GO

PRINT 'Migration 065: Schedule Templates and Match Slots completed successfully.'
GO
