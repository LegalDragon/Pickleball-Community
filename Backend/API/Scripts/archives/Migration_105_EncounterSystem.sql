-- Migration 105: Encounter System for Team League Format
-- This migration adds support for team league encounters where teams meet
-- and play multiple matches (e.g., Men's Doubles, Women's Doubles, Mixed Doubles)
-- within a single encounter.

PRINT 'Starting Migration 105: Encounter System'

-- =====================================================
-- Add encounter configuration fields to EventDivisions
-- =====================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventDivisions') AND name = 'MatchesPerEncounter')
BEGIN
    ALTER TABLE EventDivisions ADD MatchesPerEncounter INT NULL;
    PRINT 'Added MatchesPerEncounter to EventDivisions'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventDivisions') AND name = 'AllowPlayerReuseInEncounter')
BEGIN
    ALTER TABLE EventDivisions ADD AllowPlayerReuseInEncounter BIT NOT NULL DEFAULT 0;
    PRINT 'Added AllowPlayerReuseInEncounter to EventDivisions'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventDivisions') AND name = 'AllowLineupChangePerEncounter')
BEGIN
    ALTER TABLE EventDivisions ADD AllowLineupChangePerEncounter BIT NOT NULL DEFAULT 0;
    PRINT 'Added AllowLineupChangePerEncounter to EventDivisions'
END

-- =====================================================
-- Create EncounterMatchFormats table
-- Template for match types within an encounter
-- =====================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EncounterMatchFormats')
BEGIN
    CREATE TABLE EncounterMatchFormats (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        DivisionId INT NOT NULL,
        Name NVARCHAR(100) NOT NULL,
        MatchNumber INT NOT NULL DEFAULT 1,
        MaleCount INT NOT NULL DEFAULT 0,
        FemaleCount INT NOT NULL DEFAULT 0,
        UnisexCount INT NOT NULL DEFAULT 0,
        BestOf INT NOT NULL DEFAULT 1,
        ScoreFormatId INT NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_EncounterMatchFormats_Division FOREIGN KEY (DivisionId)
            REFERENCES EventDivisions(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EncounterMatchFormats_ScoreFormat FOREIGN KEY (ScoreFormatId)
            REFERENCES ScoreFormats(Id) ON DELETE SET NULL
    );

    CREATE INDEX IX_EncounterMatchFormats_DivisionId ON EncounterMatchFormats(DivisionId);
    CREATE INDEX IX_EncounterMatchFormats_SortOrder ON EncounterMatchFormats(DivisionId, SortOrder);

    PRINT 'Created EncounterMatchFormats table'
END

-- =====================================================
-- Create EventEncounters table
-- Scheduled meetings between two units
-- =====================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EventEncounters')
BEGIN
    CREATE TABLE EventEncounters (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventId INT NOT NULL,
        DivisionId INT NOT NULL,

        -- Round information
        RoundType NVARCHAR(20) NOT NULL DEFAULT 'Pool',
        RoundNumber INT NOT NULL DEFAULT 1,
        RoundName NVARCHAR(50) NULL,
        EncounterNumber INT NOT NULL DEFAULT 1,

        -- Unit placeholders (before assignment)
        Unit1Number INT NULL,
        Unit2Number INT NULL,

        -- Actual unit IDs (after assignment)
        Unit1Id INT NULL,
        Unit2Id INT NULL,

        -- Encounter scores (match wins within this encounter)
        Unit1EncounterScore INT NOT NULL DEFAULT 0,
        Unit2EncounterScore INT NOT NULL DEFAULT 0,

        -- Winner
        WinnerUnitId INT NULL,

        -- Status: Scheduled, Ready, InProgress, Completed, Cancelled
        Status NVARCHAR(20) NOT NULL DEFAULT 'Scheduled',

        -- Scheduling
        ScheduledTime DATETIME2 NULL,
        StartedAt DATETIME2 NULL,
        CompletedAt DATETIME2 NULL,

        -- Court assignment (optional)
        TournamentCourtId INT NULL,

        Notes NVARCHAR(500) NULL,

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_EventEncounters_Event FOREIGN KEY (EventId)
            REFERENCES Events(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EventEncounters_Division FOREIGN KEY (DivisionId)
            REFERENCES EventDivisions(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventEncounters_Unit1 FOREIGN KEY (Unit1Id)
            REFERENCES EventUnits(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventEncounters_Unit2 FOREIGN KEY (Unit2Id)
            REFERENCES EventUnits(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventEncounters_Winner FOREIGN KEY (WinnerUnitId)
            REFERENCES EventUnits(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventEncounters_TournamentCourt FOREIGN KEY (TournamentCourtId)
            REFERENCES TournamentCourts(Id) ON DELETE SET NULL
    );

    CREATE INDEX IX_EventEncounters_EventId ON EventEncounters(EventId);
    CREATE INDEX IX_EventEncounters_DivisionId ON EventEncounters(DivisionId);
    CREATE INDEX IX_EventEncounters_Status ON EventEncounters(Status);
    CREATE INDEX IX_EventEncounters_Unit1Id ON EventEncounters(Unit1Id);
    CREATE INDEX IX_EventEncounters_Unit2Id ON EventEncounters(Unit2Id);
    CREATE INDEX IX_EventEncounters_RoundInfo ON EventEncounters(DivisionId, RoundType, RoundNumber);

    PRINT 'Created EventEncounters table'
END

-- =====================================================
-- Create EncounterMatches table
-- Individual matches within an encounter
-- =====================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EncounterMatches')
BEGIN
    CREATE TABLE EncounterMatches (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EncounterId INT NOT NULL,
        FormatId INT NOT NULL,

        -- Scores (game wins if best-of, or single game score)
        Unit1Score INT NOT NULL DEFAULT 0,
        Unit2Score INT NOT NULL DEFAULT 0,

        -- Handicap points (added to final score)
        Unit1HandicapPoints INT NOT NULL DEFAULT 0,
        Unit2HandicapPoints INT NOT NULL DEFAULT 0,

        -- Winner
        WinnerUnitId INT NULL,

        -- Status: New, Ready, InProgress, Completed, Cancelled
        Status NVARCHAR(20) NOT NULL DEFAULT 'New',

        -- Court assignment
        TournamentCourtId INT NULL,

        -- Timing
        ScheduledTime DATETIME2 NULL,
        StartedAt DATETIME2 NULL,
        CompletedAt DATETIME2 NULL,

        -- Score submission workflow
        ScoreSubmittedByUnitId INT NULL,
        ScoreSubmittedAt DATETIME2 NULL,
        ScoreConfirmedByUnitId INT NULL,
        ScoreConfirmedAt DATETIME2 NULL,
        ScoreDisputedAt DATETIME2 NULL,
        ScoreDisputeReason NVARCHAR(500) NULL,

        Notes NVARCHAR(500) NULL,

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_EncounterMatches_Encounter FOREIGN KEY (EncounterId)
            REFERENCES EventEncounters(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EncounterMatches_Format FOREIGN KEY (FormatId)
            REFERENCES EncounterMatchFormats(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EncounterMatches_Winner FOREIGN KEY (WinnerUnitId)
            REFERENCES EventUnits(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EncounterMatches_TournamentCourt FOREIGN KEY (TournamentCourtId)
            REFERENCES TournamentCourts(Id) ON DELETE SET NULL,
        CONSTRAINT FK_EncounterMatches_ScoreSubmittedBy FOREIGN KEY (ScoreSubmittedByUnitId)
            REFERENCES EventUnits(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EncounterMatches_ScoreConfirmedBy FOREIGN KEY (ScoreConfirmedByUnitId)
            REFERENCES EventUnits(Id) ON DELETE NO ACTION
    );

    CREATE INDEX IX_EncounterMatches_EncounterId ON EncounterMatches(EncounterId);
    CREATE INDEX IX_EncounterMatches_FormatId ON EncounterMatches(FormatId);
    CREATE INDEX IX_EncounterMatches_Status ON EncounterMatches(Status);
    CREATE INDEX IX_EncounterMatches_TournamentCourtId ON EncounterMatches(TournamentCourtId);

    PRINT 'Created EncounterMatches table'
END

-- =====================================================
-- Create EncounterMatchPlayers table
-- Players participating in each match
-- =====================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EncounterMatchPlayers')
BEGIN
    CREATE TABLE EncounterMatchPlayers (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        MatchId INT NOT NULL,
        UserId INT NOT NULL,
        UnitId INT NOT NULL,

        -- Which side of the encounter (1 or 2)
        UnitSide INT NOT NULL,

        -- Player's gender for validation against format requirements
        Gender NVARCHAR(10) NULL,

        -- Position within the team (1, 2, etc.)
        Position INT NULL,

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_EncounterMatchPlayers_Match FOREIGN KEY (MatchId)
            REFERENCES EncounterMatches(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EncounterMatchPlayers_User FOREIGN KEY (UserId)
            REFERENCES Users(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EncounterMatchPlayers_Unit FOREIGN KEY (UnitId)
            REFERENCES EventUnits(Id) ON DELETE NO ACTION,
        CONSTRAINT CK_EncounterMatchPlayers_UnitSide CHECK (UnitSide IN (1, 2))
    );

    CREATE INDEX IX_EncounterMatchPlayers_MatchId ON EncounterMatchPlayers(MatchId);
    CREATE INDEX IX_EncounterMatchPlayers_UserId ON EncounterMatchPlayers(UserId);
    CREATE UNIQUE INDEX IX_EncounterMatchPlayers_MatchUser ON EncounterMatchPlayers(MatchId, UserId);

    PRINT 'Created EncounterMatchPlayers table'
END

-- =====================================================
-- Create EncounterMatchGames table
-- Individual games within a match (for best-of-3/5)
-- =====================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EncounterMatchGames')
BEGIN
    CREATE TABLE EncounterMatchGames (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        MatchId INT NOT NULL,
        GameNumber INT NOT NULL DEFAULT 1,

        -- Scores
        Unit1Score INT NOT NULL DEFAULT 0,
        Unit2Score INT NOT NULL DEFAULT 0,

        -- Winner
        WinnerUnitId INT NULL,

        -- Status: New, InProgress, Completed
        Status NVARCHAR(20) NOT NULL DEFAULT 'New',

        -- Score format for this game
        ScoreFormatId INT NULL,

        -- Court assignment
        TournamentCourtId INT NULL,

        -- Timing
        StartedAt DATETIME2 NULL,
        FinishedAt DATETIME2 NULL,

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_EncounterMatchGames_Match FOREIGN KEY (MatchId)
            REFERENCES EncounterMatches(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EncounterMatchGames_Winner FOREIGN KEY (WinnerUnitId)
            REFERENCES EventUnits(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EncounterMatchGames_ScoreFormat FOREIGN KEY (ScoreFormatId)
            REFERENCES ScoreFormats(Id) ON DELETE SET NULL,
        CONSTRAINT FK_EncounterMatchGames_TournamentCourt FOREIGN KEY (TournamentCourtId)
            REFERENCES TournamentCourts(Id) ON DELETE SET NULL
    );

    CREATE INDEX IX_EncounterMatchGames_MatchId ON EncounterMatchGames(MatchId);
    CREATE INDEX IX_EncounterMatchGames_Status ON EncounterMatchGames(Status);
    CREATE UNIQUE INDEX IX_EncounterMatchGames_MatchGameNumber ON EncounterMatchGames(MatchId, GameNumber);

    PRINT 'Created EncounterMatchGames table'
END

PRINT 'Migration 105: Encounter System completed successfully'
