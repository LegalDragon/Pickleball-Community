-- Migration_148_GameDayPlayerStatus.sql
-- Adds player status tracking table for Game Day fairness algorithm
-- and score confirmation fields to EventGames
-- Date: 2026-01-27

PRINT 'Starting Migration_148_GameDayPlayerStatus...'

-- =====================================================
-- 1. GameDayPlayerStatus table
-- Tracks per-player status during a Game Day event
-- =====================================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'GameDayPlayerStatuses')
BEGIN
    CREATE TABLE GameDayPlayerStatuses (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventId INT NOT NULL,
        UserId INT NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'Available',  -- Available, Playing, Resting, SittingOut
        GamesSinceLastPlay INT NOT NULL DEFAULT 0,
        ConsecutiveGames INT NOT NULL DEFAULT 0,
        TotalGamesPlayed INT NOT NULL DEFAULT 0,
        LastPlayedAt DATETIME2 NULL,
        QueuePosition INT NULL,
        QueuedAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_GameDayPlayerStatuses_Events FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE CASCADE,
        CONSTRAINT FK_GameDayPlayerStatuses_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE NO ACTION
    );

    CREATE UNIQUE INDEX IX_GameDayPlayerStatuses_EventId_UserId
        ON GameDayPlayerStatuses (EventId, UserId);

    CREATE INDEX IX_GameDayPlayerStatuses_EventId_Status
        ON GameDayPlayerStatuses (EventId, Status);

    CREATE INDEX IX_GameDayPlayerStatuses_EventId_QueuePosition
        ON GameDayPlayerStatuses (EventId, QueuePosition)
        WHERE QueuePosition IS NOT NULL;

    PRINT 'Created GameDayPlayerStatuses table with indexes.'
END
ELSE
BEGIN
    PRINT 'GameDayPlayerStatuses table already exists, skipping.'
END
GO

-- =====================================================
-- 2. Add Team1ScoreConfirmed, Team2ScoreConfirmed to EventGames
-- =====================================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'EventGames' AND COLUMN_NAME = 'Team1ScoreConfirmed')
BEGIN
    ALTER TABLE EventGames ADD Team1ScoreConfirmed BIT NOT NULL DEFAULT 0;
    PRINT 'Added Team1ScoreConfirmed to EventGames.'
END
ELSE
BEGIN
    PRINT 'Team1ScoreConfirmed already exists on EventGames, skipping.'
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'EventGames' AND COLUMN_NAME = 'Team2ScoreConfirmed')
BEGIN
    ALTER TABLE EventGames ADD Team2ScoreConfirmed BIT NOT NULL DEFAULT 0;
    PRINT 'Added Team2ScoreConfirmed to EventGames.'
END
ELSE
BEGIN
    PRINT 'Team2ScoreConfirmed already exists on EventGames, skipping.'
END
GO

PRINT 'Migration_148_GameDayPlayerStatus completed successfully.'
GO
