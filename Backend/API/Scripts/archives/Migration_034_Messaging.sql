-- Migration 034: Messaging System
-- Adds tables for direct messaging and group chats (clubs/friends)
-- SignalR-ready with real-time support

PRINT 'Starting Migration 034: Messaging System'

-- Conversations table (supports DM, Friend groups, Club chats)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Conversations')
BEGIN
    CREATE TABLE Conversations (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        -- Type: 'Direct' (1-on-1), 'FriendGroup' (custom group), 'Club' (club chat)
        Type NVARCHAR(20) NOT NULL DEFAULT 'Direct',
        Name NVARCHAR(100) NULL, -- For group chats
        -- For Club chats, reference the club
        ClubId INT NULL,
        -- For tracking
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        LastMessageAt DATETIME2 NULL,
        -- Soft delete
        IsDeleted BIT NOT NULL DEFAULT 0,

        CONSTRAINT FK_Conversations_Club FOREIGN KEY (ClubId) REFERENCES Clubs(Id) ON DELETE SET NULL
    )
    PRINT 'Created Conversations table'
END
ELSE
    PRINT 'Conversations table already exists'

-- Conversation Participants
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ConversationParticipants')
BEGIN
    CREATE TABLE ConversationParticipants (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ConversationId INT NOT NULL,
        UserId INT NOT NULL,
        -- Role in conversation: 'Admin', 'Member'
        Role NVARCHAR(20) NOT NULL DEFAULT 'Member',
        -- Chat preferences
        IsMuted BIT NOT NULL DEFAULT 0,
        -- Tracking
        JoinedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        LastReadAt DATETIME2 NULL,
        -- Left the conversation (for groups)
        LeftAt DATETIME2 NULL,

        CONSTRAINT FK_ConversationParticipants_Conversation FOREIGN KEY (ConversationId) REFERENCES Conversations(Id) ON DELETE CASCADE,
        CONSTRAINT FK_ConversationParticipants_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT UQ_ConversationParticipants_User UNIQUE (ConversationId, UserId)
    )
    PRINT 'Created ConversationParticipants table'

    CREATE INDEX IX_ConversationParticipants_UserId ON ConversationParticipants(UserId)
    CREATE INDEX IX_ConversationParticipants_ConversationId ON ConversationParticipants(ConversationId)
END
ELSE
    PRINT 'ConversationParticipants table already exists'

-- Messages table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Messages')
BEGIN
    CREATE TABLE Messages (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ConversationId INT NOT NULL,
        SenderId INT NOT NULL,
        Content NVARCHAR(4000) NOT NULL,
        -- Message type: 'Text', 'Image', 'System' (join/leave notifications)
        MessageType NVARCHAR(20) NOT NULL DEFAULT 'Text',
        -- For replies
        ReplyToMessageId INT NULL,
        -- Timestamps
        SentAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        EditedAt DATETIME2 NULL,
        -- Soft delete
        IsDeleted BIT NOT NULL DEFAULT 0,
        DeletedAt DATETIME2 NULL,

        CONSTRAINT FK_Messages_Conversation FOREIGN KEY (ConversationId) REFERENCES Conversations(Id) ON DELETE CASCADE,
        CONSTRAINT FK_Messages_Sender FOREIGN KEY (SenderId) REFERENCES Users(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_Messages_ReplyTo FOREIGN KEY (ReplyToMessageId) REFERENCES Messages(Id) ON DELETE NO ACTION
    )
    PRINT 'Created Messages table'

    CREATE INDEX IX_Messages_ConversationId ON Messages(ConversationId)
    CREATE INDEX IX_Messages_SenderId ON Messages(SenderId)
    CREATE INDEX IX_Messages_SentAt ON Messages(ConversationId, SentAt DESC)
END
ELSE
    PRINT 'Messages table already exists'

-- Message read receipts (optional - for showing who read the message)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MessageReadReceipts')
BEGIN
    CREATE TABLE MessageReadReceipts (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        MessageId INT NOT NULL,
        UserId INT NOT NULL,
        ReadAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_MessageReadReceipts_Message FOREIGN KEY (MessageId) REFERENCES Messages(Id) ON DELETE CASCADE,
        CONSTRAINT FK_MessageReadReceipts_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT UQ_MessageReadReceipts UNIQUE (MessageId, UserId)
    )
    PRINT 'Created MessageReadReceipts table'

    CREATE INDEX IX_MessageReadReceipts_MessageId ON MessageReadReceipts(MessageId)
END
ELSE
    PRINT 'MessageReadReceipts table already exists'

-- User chat settings (opt-in for DMs)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'AllowDirectMessages')
BEGIN
    ALTER TABLE Users ADD AllowDirectMessages BIT NOT NULL DEFAULT 1
    PRINT 'Added AllowDirectMessages column to Users'
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'AllowClubMessages')
BEGIN
    ALTER TABLE Users ADD AllowClubMessages BIT NOT NULL DEFAULT 1
    PRINT 'Added AllowClubMessages column to Users'
END

-- Club chat settings
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Clubs') AND name = 'ChatEnabled')
BEGIN
    ALTER TABLE Clubs ADD ChatEnabled BIT NOT NULL DEFAULT 0
    PRINT 'Added ChatEnabled column to Clubs (opt-in for club owners)'
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Clubs') AND name = 'ChatConversationId')
BEGIN
    ALTER TABLE Clubs ADD ChatConversationId INT NULL
    PRINT 'Added ChatConversationId column to Clubs'

    -- Add foreign key
    ALTER TABLE Clubs ADD CONSTRAINT FK_Clubs_ChatConversation FOREIGN KEY (ChatConversationId) REFERENCES Conversations(Id) ON DELETE SET NULL
END

PRINT 'Migration 034: Messaging System completed successfully'
