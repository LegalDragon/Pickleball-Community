-- Migration 050: Leagues with hierarchical structure
-- Creates tables for leagues, league managers, league clubs, and club join requests

PRINT 'Starting Migration 050: Leagues'

-- Create Leagues table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Leagues')
BEGIN
    CREATE TABLE Leagues (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(1000) NULL,
        Scope NVARCHAR(20) NOT NULL DEFAULT 'Local', -- National, Regional, State, District, Local
        AvatarUrl NVARCHAR(500) NULL,
        BannerUrl NVARCHAR(500) NULL,
        Website NVARCHAR(500) NULL,
        ContactEmail NVARCHAR(255) NULL,
        ParentLeagueId INT NULL,
        State NVARCHAR(50) NULL,
        Region NVARCHAR(100) NULL,
        Country NVARCHAR(50) NULL DEFAULT 'USA',
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Leagues_ParentLeague FOREIGN KEY (ParentLeagueId) REFERENCES Leagues(Id)
    )
    PRINT 'Created Leagues table'
END
ELSE
    PRINT 'Leagues table already exists'

-- Create index on ParentLeagueId for hierarchy queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Leagues_ParentLeagueId')
BEGIN
    CREATE INDEX IX_Leagues_ParentLeagueId ON Leagues(ParentLeagueId)
    PRINT 'Created index IX_Leagues_ParentLeagueId'
END

-- Create index on Scope for filtering
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Leagues_Scope')
BEGIN
    CREATE INDEX IX_Leagues_Scope ON Leagues(Scope) WHERE IsActive = 1
    PRINT 'Created index IX_Leagues_Scope'
END

-- Create LeagueManagers table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'LeagueManagers')
BEGIN
    CREATE TABLE LeagueManagers (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        LeagueId INT NOT NULL,
        UserId INT NOT NULL,
        Role NVARCHAR(50) NOT NULL DEFAULT 'Admin', -- President, Vice President, Director, Secretary, Treasurer, Admin, Moderator
        Title NVARCHAR(100) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_LeagueManagers_League FOREIGN KEY (LeagueId) REFERENCES Leagues(Id) ON DELETE CASCADE,
        CONSTRAINT FK_LeagueManagers_User FOREIGN KEY (UserId) REFERENCES Users(Id),
        CONSTRAINT UQ_LeagueManagers_LeagueUser UNIQUE (LeagueId, UserId)
    )
    PRINT 'Created LeagueManagers table'
END
ELSE
    PRINT 'LeagueManagers table already exists'

-- Create index on UserId for user's leagues lookup
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LeagueManagers_UserId')
BEGIN
    CREATE INDEX IX_LeagueManagers_UserId ON LeagueManagers(UserId) WHERE IsActive = 1
    PRINT 'Created index IX_LeagueManagers_UserId'
END

-- Create LeagueClubs table (clubs that belong to a league)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'LeagueClubs')
BEGIN
    CREATE TABLE LeagueClubs (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        LeagueId INT NOT NULL,
        ClubId INT NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'Active', -- Active, Suspended, Inactive
        JoinedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        ExpiresAt DATETIME2 NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_LeagueClubs_League FOREIGN KEY (LeagueId) REFERENCES Leagues(Id) ON DELETE CASCADE,
        CONSTRAINT FK_LeagueClubs_Club FOREIGN KEY (ClubId) REFERENCES Clubs(Id) ON DELETE CASCADE,
        CONSTRAINT UQ_LeagueClubs_LeagueClub UNIQUE (LeagueId, ClubId)
    )
    PRINT 'Created LeagueClubs table'
END
ELSE
    PRINT 'LeagueClubs table already exists'

-- Create index on ClubId for club's leagues lookup
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LeagueClubs_ClubId')
BEGIN
    CREATE INDEX IX_LeagueClubs_ClubId ON LeagueClubs(ClubId)
    PRINT 'Created index IX_LeagueClubs_ClubId'
END

-- Create LeagueClubRequests table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'LeagueClubRequests')
BEGIN
    CREATE TABLE LeagueClubRequests (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        LeagueId INT NOT NULL,
        ClubId INT NOT NULL,
        RequestedByUserId INT NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending, Approved, Rejected
        Message NVARCHAR(1000) NULL,
        ResponseMessage NVARCHAR(1000) NULL,
        ProcessedByUserId INT NULL,
        ProcessedAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_LeagueClubRequests_League FOREIGN KEY (LeagueId) REFERENCES Leagues(Id) ON DELETE CASCADE,
        CONSTRAINT FK_LeagueClubRequests_Club FOREIGN KEY (ClubId) REFERENCES Clubs(Id) ON DELETE CASCADE,
        CONSTRAINT FK_LeagueClubRequests_RequestedBy FOREIGN KEY (RequestedByUserId) REFERENCES Users(Id),
        CONSTRAINT FK_LeagueClubRequests_ProcessedBy FOREIGN KEY (ProcessedByUserId) REFERENCES Users(Id)
    )
    PRINT 'Created LeagueClubRequests table'
END
ELSE
    PRINT 'LeagueClubRequests table already exists'

-- Create index for pending requests lookup
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LeagueClubRequests_Status')
BEGIN
    CREATE INDEX IX_LeagueClubRequests_Status ON LeagueClubRequests(LeagueId, Status) WHERE Status = 'Pending'
    PRINT 'Created index IX_LeagueClubRequests_Status'
END

-- Create index on ClubId for club's requests lookup
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LeagueClubRequests_ClubId')
BEGIN
    CREATE INDEX IX_LeagueClubRequests_ClubId ON LeagueClubRequests(ClubId)
    PRINT 'Created index IX_LeagueClubRequests_ClubId'
END

-- Seed some example scope values (for reference)
-- National: Top-level national organization
-- Regional: Multi-state regions (e.g., Southeast, Northwest)
-- State: State-level organization
-- District: Sub-state districts or metro areas
-- Local: City or county level

PRINT 'Migration 050: Leagues completed successfully'
