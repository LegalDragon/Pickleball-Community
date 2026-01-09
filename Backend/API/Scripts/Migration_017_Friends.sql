-- Migration_017_Friends.sql
-- Add Friends and FriendRequests tables for community connections
-- Supports friend requests, approvals, and friend relationships

PRINT 'Starting Migration_017_Friends...'

-- Create FriendRequests table (for pending friend requests)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'FriendRequests')
BEGIN
    CREATE TABLE FriendRequests (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SenderId INT NOT NULL,
        RecipientId INT NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending, Accepted, Rejected, Cancelled
        Message NVARCHAR(500) NULL, -- Optional message with request
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        RespondedAt DATETIME2 NULL,

        CONSTRAINT FK_FriendRequests_Sender FOREIGN KEY (SenderId) REFERENCES Users(Id),
        CONSTRAINT FK_FriendRequests_Recipient FOREIGN KEY (RecipientId) REFERENCES Users(Id),
        CONSTRAINT CK_FriendRequests_Status CHECK (Status IN ('Pending', 'Accepted', 'Rejected', 'Cancelled')),
        CONSTRAINT CK_FriendRequests_NotSelf CHECK (SenderId != RecipientId)
    )
    PRINT 'Created table: FriendRequests'

    -- Index for finding pending requests for a user
    CREATE INDEX IX_FriendRequests_RecipientId_Status ON FriendRequests(RecipientId, Status)
    PRINT 'Created index: IX_FriendRequests_RecipientId_Status'

    -- Index for finding sent requests
    CREATE INDEX IX_FriendRequests_SenderId_Status ON FriendRequests(SenderId, Status)
    PRINT 'Created index: IX_FriendRequests_SenderId_Status'

    -- Unique constraint to prevent duplicate pending requests
    CREATE UNIQUE INDEX IX_FriendRequests_Unique_Pending
        ON FriendRequests(SenderId, RecipientId)
        WHERE Status = 'Pending'
    PRINT 'Created unique index: IX_FriendRequests_Unique_Pending'
END
ELSE
BEGIN
    PRINT 'Table FriendRequests already exists, skipping...'
END

-- Create Friendships table (for accepted friendships)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Friendships')
BEGIN
    CREATE TABLE Friendships (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId1 INT NOT NULL, -- Always the smaller UserId for consistency
        UserId2 INT NOT NULL, -- Always the larger UserId for consistency
        FriendsSince DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        OriginatingRequestId INT NULL, -- Reference to the friend request that created this

        CONSTRAINT FK_Friendships_User1 FOREIGN KEY (UserId1) REFERENCES Users(Id),
        CONSTRAINT FK_Friendships_User2 FOREIGN KEY (UserId2) REFERENCES Users(Id),
        CONSTRAINT FK_Friendships_Request FOREIGN KEY (OriginatingRequestId) REFERENCES FriendRequests(Id),
        CONSTRAINT CK_Friendships_OrderedIds CHECK (UserId1 < UserId2),
        CONSTRAINT UQ_Friendships_Users UNIQUE (UserId1, UserId2)
    )
    PRINT 'Created table: Friendships'

    -- Index for finding all friends of a user
    CREATE INDEX IX_Friendships_UserId1 ON Friendships(UserId1)
    CREATE INDEX IX_Friendships_UserId2 ON Friendships(UserId2)
    PRINT 'Created indexes for Friendships'
END
ELSE
BEGIN
    PRINT 'Table Friendships already exists, skipping...'
END

-- Create GameHistory table (for tracking games between friends)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'GameHistory')
BEGIN
    CREATE TABLE GameHistory (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Player1Id INT NOT NULL,
        Player2Id INT NOT NULL,
        Partner1Id INT NULL, -- For doubles
        Partner2Id INT NULL, -- For doubles
        GameType NVARCHAR(20) NOT NULL DEFAULT 'Singles', -- Singles, Doubles
        Player1Score INT NULL,
        Player2Score INT NULL,
        WinnerId INT NULL, -- UserId of winner (Player1Id or Player2Id)
        PlayedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        Location NVARCHAR(200) NULL,
        CourtId INT NULL, -- Reference to Courts table when available
        Notes NVARCHAR(500) NULL,
        RecordedById INT NOT NULL, -- Who recorded this game
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_GameHistory_Player1 FOREIGN KEY (Player1Id) REFERENCES Users(Id),
        CONSTRAINT FK_GameHistory_Player2 FOREIGN KEY (Player2Id) REFERENCES Users(Id),
        CONSTRAINT FK_GameHistory_Partner1 FOREIGN KEY (Partner1Id) REFERENCES Users(Id),
        CONSTRAINT FK_GameHistory_Partner2 FOREIGN KEY (Partner2Id) REFERENCES Users(Id),
        CONSTRAINT FK_GameHistory_RecordedBy FOREIGN KEY (RecordedById) REFERENCES Users(Id),
        CONSTRAINT CK_GameHistory_GameType CHECK (GameType IN ('Singles', 'Doubles'))
    )
    PRINT 'Created table: GameHistory'

    -- Indexes for finding games for a user
    CREATE INDEX IX_GameHistory_Player1Id ON GameHistory(Player1Id)
    CREATE INDEX IX_GameHistory_Player2Id ON GameHistory(Player2Id)
    CREATE INDEX IX_GameHistory_PlayedAt ON GameHistory(PlayedAt DESC)
    PRINT 'Created indexes for GameHistory'
END
ELSE
BEGIN
    PRINT 'Table GameHistory already exists, skipping...'
END

PRINT 'Migration_017_Friends completed successfully!'
