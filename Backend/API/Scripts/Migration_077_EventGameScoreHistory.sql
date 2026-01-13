-- Migration 077: Event Game Score History
-- Adds audit trail for score changes to track all modifications

PRINT 'Starting Migration 077: Event Game Score History'

-- Create EventGameScoreHistory table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EventGameScoreHistory')
BEGIN
    CREATE TABLE EventGameScoreHistory (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        GameId INT NOT NULL,

        -- What changed
        ChangeType NVARCHAR(50) NOT NULL, -- 'ScoreSubmitted', 'ScoreConfirmed', 'ScoreDisputed', 'ScoreEdited', 'ScoreReset'

        -- Score values at time of change
        Unit1Score INT NOT NULL,
        Unit2Score INT NOT NULL,

        -- Previous values (for edits)
        PreviousUnit1Score INT NULL,
        PreviousUnit2Score INT NULL,

        -- Who made the change
        ChangedByUserId INT NOT NULL,
        ChangedByUnitId INT NULL, -- If submitted by a player unit

        -- Additional context
        Reason NVARCHAR(500) NULL, -- For disputes or admin overrides
        IsAdminOverride BIT NOT NULL DEFAULT 0,

        -- IP address for security auditing
        IpAddress NVARCHAR(45) NULL,

        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),

        -- Foreign keys
        CONSTRAINT FK_EventGameScoreHistory_GameId FOREIGN KEY (GameId) REFERENCES EventGames(Id),
        CONSTRAINT FK_EventGameScoreHistory_ChangedByUserId FOREIGN KEY (ChangedByUserId) REFERENCES Users(Id),
        CONSTRAINT FK_EventGameScoreHistory_ChangedByUnitId FOREIGN KEY (ChangedByUnitId) REFERENCES EventUnits(Id)
    )

    PRINT 'Created EventGameScoreHistory table'
END
ELSE
BEGIN
    PRINT 'EventGameScoreHistory table already exists'
END

-- Create index for fast lookups by game
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EventGameScoreHistory_GameId')
BEGIN
    CREATE INDEX IX_EventGameScoreHistory_GameId ON EventGameScoreHistory(GameId)
    PRINT 'Created index IX_EventGameScoreHistory_GameId'
END

-- Create index for audit queries by user
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EventGameScoreHistory_ChangedByUserId')
BEGIN
    CREATE INDEX IX_EventGameScoreHistory_ChangedByUserId ON EventGameScoreHistory(ChangedByUserId)
    PRINT 'Created index IX_EventGameScoreHistory_ChangedByUserId'
END

-- Create index for time-based queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EventGameScoreHistory_CreatedAt')
BEGIN
    CREATE INDEX IX_EventGameScoreHistory_CreatedAt ON EventGameScoreHistory(CreatedAt DESC)
    PRINT 'Created index IX_EventGameScoreHistory_CreatedAt'
END

-- Stored procedure to log score changes
CREATE OR ALTER PROCEDURE sp_LogGameScoreChange
    @GameId INT,
    @ChangeType NVARCHAR(50),
    @Unit1Score INT,
    @Unit2Score INT,
    @PreviousUnit1Score INT = NULL,
    @PreviousUnit2Score INT = NULL,
    @ChangedByUserId INT,
    @ChangedByUnitId INT = NULL,
    @Reason NVARCHAR(500) = NULL,
    @IsAdminOverride BIT = 0,
    @IpAddress NVARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO EventGameScoreHistory (
        GameId,
        ChangeType,
        Unit1Score,
        Unit2Score,
        PreviousUnit1Score,
        PreviousUnit2Score,
        ChangedByUserId,
        ChangedByUnitId,
        Reason,
        IsAdminOverride,
        IpAddress,
        CreatedAt
    )
    VALUES (
        @GameId,
        @ChangeType,
        @Unit1Score,
        @Unit2Score,
        @PreviousUnit1Score,
        @PreviousUnit2Score,
        @ChangedByUserId,
        @ChangedByUnitId,
        @Reason,
        @IsAdminOverride,
        @IpAddress,
        GETDATE()
    )

    SELECT SCOPE_IDENTITY() AS NewHistoryId
END
GO

PRINT 'Created stored procedure sp_LogGameScoreChange'

-- Stored procedure to get score history for a game
CREATE OR ALTER PROCEDURE sp_GetGameScoreHistory
    @GameId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        h.Id,
        h.GameId,
        h.ChangeType,
        h.Unit1Score,
        h.Unit2Score,
        h.PreviousUnit1Score,
        h.PreviousUnit2Score,
        h.ChangedByUserId,
        h.ChangedByUnitId,
        h.Reason,
        h.IsAdminOverride,
        h.IpAddress,
        h.CreatedAt,
        u.Username AS ChangedByUsername,
        u.FirstName AS ChangedByFirstName,
        u.LastName AS ChangedByLastName
    FROM EventGameScoreHistory h
    INNER JOIN Users u ON h.ChangedByUserId = u.Id
    WHERE h.GameId = @GameId
    ORDER BY h.CreatedAt DESC
END
GO

PRINT 'Created stored procedure sp_GetGameScoreHistory'

PRINT 'Migration 077 completed successfully'
