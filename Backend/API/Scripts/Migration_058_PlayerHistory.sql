-- Migration_058_PlayerHistory.sql
-- Creates tables for player awards and rating history tracking
-- Game history is derived from existing EventGamePlayer data

PRINT 'Starting Migration_058_PlayerHistory...'

-- =====================================================
-- PlayerAwards Table
-- Stores badges, league points, notable finishes, etc.
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PlayerAwards')
BEGIN
    CREATE TABLE PlayerAwards (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,

        -- Award Type: Badge, LeaguePoints, NotableFinish, Achievement, Milestone
        AwardType NVARCHAR(50) NOT NULL,

        -- Award details
        Title NVARCHAR(200) NOT NULL,
        Description NVARCHAR(1000) NULL,

        -- Optional icon/image
        IconUrl NVARCHAR(500) NULL,
        BadgeColor NVARCHAR(50) NULL, -- gold, silver, bronze, blue, green, etc.

        -- Points value (for league points or point-based awards)
        PointsValue INT NULL,

        -- Context references (optional - links to where award was earned)
        EventId INT NULL,
        DivisionId INT NULL,
        LeagueId INT NULL,
        ClubId INT NULL,
        SeasonId INT NULL,

        -- For notable finishes: 1st, 2nd, 3rd, etc.
        PlacementRank INT NULL,

        -- Metadata
        AwardedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        AwardedBySystem BIT NOT NULL DEFAULT 1, -- true if auto-awarded by system
        AwardedByUserId INT NULL, -- if manually awarded

        -- For expiring awards (like seasonal badges)
        ExpiresAt DATETIME2 NULL,
        IsActive BIT NOT NULL DEFAULT 1,

        Notes NVARCHAR(500) NULL,

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_PlayerAwards_User FOREIGN KEY (UserId) REFERENCES Users(Id),
        CONSTRAINT FK_PlayerAwards_Event FOREIGN KEY (EventId) REFERENCES Events(Id),
        CONSTRAINT FK_PlayerAwards_Division FOREIGN KEY (DivisionId) REFERENCES EventDivisions(Id),
        CONSTRAINT FK_PlayerAwards_League FOREIGN KEY (LeagueId) REFERENCES Leagues(Id),
        CONSTRAINT FK_PlayerAwards_Club FOREIGN KEY (ClubId) REFERENCES Clubs(Id),
        CONSTRAINT FK_PlayerAwards_AwardedBy FOREIGN KEY (AwardedByUserId) REFERENCES Users(Id)
    );
    PRINT 'Created PlayerAwards table'
END
ELSE
BEGIN
    PRINT 'PlayerAwards table already exists'
END
GO

-- Indexes for PlayerAwards
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PlayerAwards_UserId')
BEGIN
    CREATE INDEX IX_PlayerAwards_UserId ON PlayerAwards(UserId);
    PRINT 'Created IX_PlayerAwards_UserId index'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PlayerAwards_AwardType')
BEGIN
    CREATE INDEX IX_PlayerAwards_AwardType ON PlayerAwards(AwardType);
    PRINT 'Created IX_PlayerAwards_AwardType index'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PlayerAwards_AwardedAt')
BEGIN
    CREATE INDEX IX_PlayerAwards_AwardedAt ON PlayerAwards(AwardedAt DESC);
    PRINT 'Created IX_PlayerAwards_AwardedAt index'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PlayerAwards_EventId')
BEGIN
    CREATE INDEX IX_PlayerAwards_EventId ON PlayerAwards(EventId) WHERE EventId IS NOT NULL;
    PRINT 'Created IX_PlayerAwards_EventId index'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PlayerAwards_LeagueId')
BEGIN
    CREATE INDEX IX_PlayerAwards_LeagueId ON PlayerAwards(LeagueId) WHERE LeagueId IS NOT NULL;
    PRINT 'Created IX_PlayerAwards_LeagueId index'
END
GO

-- =====================================================
-- PlayerRatingHistory Table
-- Tracks rating changes over time from peer reviews and system calculations
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PlayerRatingHistory')
BEGIN
    CREATE TABLE PlayerRatingHistory (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,

        -- Rating value (e.g., 3.5, 4.0)
        Rating DECIMAL(4,2) NOT NULL,

        -- Previous rating for tracking change
        PreviousRating DECIMAL(4,2) NULL,

        -- Rating change (+/- amount)
        RatingChange DECIMAL(4,2) NULL,

        -- Type: PeerReview, SystemCalculated, Official, SelfRated, Imported
        RatingType NVARCHAR(50) NOT NULL,

        -- Source description (e.g., "Based on 5 games", "Peer review by 3 players")
        Source NVARCHAR(200) NULL,

        -- Confidence/weight (0-100, higher = more reliable)
        Confidence INT NULL,

        -- Context references
        EventId INT NULL,
        GameId INT NULL, -- If rating changed due to a specific game
        PeerReviewId INT NULL, -- Link to peer review if applicable

        -- Who/what triggered this rating
        CalculatedBySystem BIT NOT NULL DEFAULT 1,
        UpdatedByUserId INT NULL, -- If manually updated by admin

        EffectiveDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        Notes NVARCHAR(500) NULL,

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_PlayerRatingHistory_User FOREIGN KEY (UserId) REFERENCES Users(Id),
        CONSTRAINT FK_PlayerRatingHistory_Event FOREIGN KEY (EventId) REFERENCES Events(Id),
        CONSTRAINT FK_PlayerRatingHistory_Game FOREIGN KEY (GameId) REFERENCES EventGames(Id),
        CONSTRAINT FK_PlayerRatingHistory_UpdatedBy FOREIGN KEY (UpdatedByUserId) REFERENCES Users(Id)
    );
    PRINT 'Created PlayerRatingHistory table'
END
ELSE
BEGIN
    PRINT 'PlayerRatingHistory table already exists'
END
GO

-- Indexes for PlayerRatingHistory
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PlayerRatingHistory_UserId')
BEGIN
    CREATE INDEX IX_PlayerRatingHistory_UserId ON PlayerRatingHistory(UserId);
    PRINT 'Created IX_PlayerRatingHistory_UserId index'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PlayerRatingHistory_RatingType')
BEGIN
    CREATE INDEX IX_PlayerRatingHistory_RatingType ON PlayerRatingHistory(RatingType);
    PRINT 'Created IX_PlayerRatingHistory_RatingType index'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PlayerRatingHistory_EffectiveDate')
BEGIN
    CREATE INDEX IX_PlayerRatingHistory_EffectiveDate ON PlayerRatingHistory(EffectiveDate DESC);
    PRINT 'Created IX_PlayerRatingHistory_EffectiveDate index'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PlayerRatingHistory_UserId_EffectiveDate')
BEGIN
    CREATE INDEX IX_PlayerRatingHistory_UserId_EffectiveDate ON PlayerRatingHistory(UserId, EffectiveDate DESC);
    PRINT 'Created IX_PlayerRatingHistory_UserId_EffectiveDate index'
END
GO

PRINT 'Migration_058_PlayerHistory completed successfully'
GO
