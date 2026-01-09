-- Migration 023: Clubs and Events
-- Creates tables for club management and event management features
-- Includes clubs, club members, join requests, notifications
-- Events, divisions, registrations, and partner requests

PRINT 'Starting Migration 023: Clubs and Events';
GO

-- =============================================
-- CLUBS
-- =============================================

-- Clubs table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Clubs')
BEGIN
    CREATE TABLE [dbo].[Clubs] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [Name] NVARCHAR(100) NOT NULL,
        [Description] NVARCHAR(500) NULL,
        [LogoUrl] NVARCHAR(500) NULL,
        [BannerUrl] NVARCHAR(500) NULL,
        [Address] NVARCHAR(200) NULL,
        [City] NVARCHAR(100) NULL,
        [State] NVARCHAR(100) NULL,
        [Country] NVARCHAR(100) NULL,
        [PostalCode] NVARCHAR(20) NULL,
        [Latitude] FLOAT NULL,
        [Longitude] FLOAT NULL,
        [Website] NVARCHAR(100) NULL,
        [Email] NVARCHAR(100) NULL,
        [Phone] NVARCHAR(20) NULL,
        [IsPublic] BIT NOT NULL DEFAULT 1,
        [RequiresApproval] BIT NOT NULL DEFAULT 1,
        [InviteCode] NVARCHAR(50) NULL,
        [CreatedByUserId] INT NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [IsActive] BIT NOT NULL DEFAULT 1,
        CONSTRAINT [FK_Clubs_Users_CreatedByUserId] FOREIGN KEY ([CreatedByUserId]) REFERENCES [dbo].[Users]([Id])
    );
    PRINT 'Created Clubs table';

    CREATE INDEX [IX_Clubs_CreatedByUserId] ON [dbo].[Clubs]([CreatedByUserId]);
    CREATE INDEX [IX_Clubs_City] ON [dbo].[Clubs]([City]);
    CREATE INDEX [IX_Clubs_State] ON [dbo].[Clubs]([State]);
    CREATE INDEX [IX_Clubs_Country] ON [dbo].[Clubs]([Country]);
    CREATE INDEX [IX_Clubs_InviteCode] ON [dbo].[Clubs]([InviteCode]);
    CREATE INDEX [IX_Clubs_IsActive] ON [dbo].[Clubs]([IsActive]);
    PRINT 'Created indexes for Clubs table';
END
ELSE
BEGIN
    PRINT 'Clubs table already exists';
END
GO

-- ClubMembers table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ClubMembers')
BEGIN
    CREATE TABLE [dbo].[ClubMembers] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [ClubId] INT NOT NULL,
        [UserId] INT NOT NULL,
        [Role] NVARCHAR(20) NOT NULL DEFAULT 'Member',
        [JoinedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [IsActive] BIT NOT NULL DEFAULT 1,
        CONSTRAINT [FK_ClubMembers_Clubs] FOREIGN KEY ([ClubId]) REFERENCES [dbo].[Clubs]([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_ClubMembers_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]),
        CONSTRAINT [UQ_ClubMembers_ClubUser] UNIQUE ([ClubId], [UserId])
    );
    PRINT 'Created ClubMembers table';

    CREATE INDEX [IX_ClubMembers_ClubId] ON [dbo].[ClubMembers]([ClubId]);
    CREATE INDEX [IX_ClubMembers_UserId] ON [dbo].[ClubMembers]([UserId]);
    CREATE INDEX [IX_ClubMembers_Role] ON [dbo].[ClubMembers]([Role]);
    PRINT 'Created indexes for ClubMembers table';
END
ELSE
BEGIN
    PRINT 'ClubMembers table already exists';
END
GO

-- ClubJoinRequests table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ClubJoinRequests')
BEGIN
    CREATE TABLE [dbo].[ClubJoinRequests] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [ClubId] INT NOT NULL,
        [UserId] INT NOT NULL,
        [Message] NVARCHAR(500) NULL,
        [Status] NVARCHAR(20) NOT NULL DEFAULT 'Pending',
        [ReviewedByUserId] INT NULL,
        [ReviewedAt] DATETIME2 NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [FK_ClubJoinRequests_Clubs] FOREIGN KEY ([ClubId]) REFERENCES [dbo].[Clubs]([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_ClubJoinRequests_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]),
        CONSTRAINT [FK_ClubJoinRequests_ReviewedBy] FOREIGN KEY ([ReviewedByUserId]) REFERENCES [dbo].[Users]([Id])
    );
    PRINT 'Created ClubJoinRequests table';

    CREATE INDEX [IX_ClubJoinRequests_ClubId] ON [dbo].[ClubJoinRequests]([ClubId]);
    CREATE INDEX [IX_ClubJoinRequests_UserId] ON [dbo].[ClubJoinRequests]([UserId]);
    CREATE INDEX [IX_ClubJoinRequests_Status] ON [dbo].[ClubJoinRequests]([Status]);
    PRINT 'Created indexes for ClubJoinRequests table';
END
ELSE
BEGIN
    PRINT 'ClubJoinRequests table already exists';
END
GO

-- ClubNotifications table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ClubNotifications')
BEGIN
    CREATE TABLE [dbo].[ClubNotifications] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [ClubId] INT NOT NULL,
        [SentByUserId] INT NOT NULL,
        [Title] NVARCHAR(200) NOT NULL,
        [Message] NVARCHAR(MAX) NOT NULL,
        [SentAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [FK_ClubNotifications_Clubs] FOREIGN KEY ([ClubId]) REFERENCES [dbo].[Clubs]([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_ClubNotifications_Users] FOREIGN KEY ([SentByUserId]) REFERENCES [dbo].[Users]([Id])
    );
    PRINT 'Created ClubNotifications table';

    CREATE INDEX [IX_ClubNotifications_ClubId] ON [dbo].[ClubNotifications]([ClubId]);
    CREATE INDEX [IX_ClubNotifications_SentAt] ON [dbo].[ClubNotifications]([SentAt] DESC);
    PRINT 'Created indexes for ClubNotifications table';
END
ELSE
BEGIN
    PRINT 'ClubNotifications table already exists';
END
GO

-- =============================================
-- EVENTS
-- =============================================

-- Events table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Events')
BEGIN
    CREATE TABLE [dbo].[Events] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [Name] NVARCHAR(200) NOT NULL,
        [Description] NVARCHAR(2000) NULL,
        [EventTypeId] INT NOT NULL,
        [StartDate] DATETIME2 NOT NULL,
        [EndDate] DATETIME2 NOT NULL,
        [RegistrationOpenDate] DATETIME2 NULL,
        [RegistrationCloseDate] DATETIME2 NULL,
        [IsPublished] BIT NOT NULL DEFAULT 0,
        [CourtId] INT NULL,
        [VenueName] NVARCHAR(200) NULL,
        [Address] NVARCHAR(300) NULL,
        [City] NVARCHAR(100) NULL,
        [State] NVARCHAR(100) NULL,
        [Country] NVARCHAR(100) NULL,
        [Latitude] FLOAT NULL,
        [Longitude] FLOAT NULL,
        [PosterImageUrl] NVARCHAR(500) NULL,
        [BannerImageUrl] NVARCHAR(500) NULL,
        [RegistrationFee] DECIMAL(10,2) NOT NULL DEFAULT 0,
        [PerDivisionFee] DECIMAL(10,2) NOT NULL DEFAULT 0,
        [ContactEmail] NVARCHAR(100) NULL,
        [ContactPhone] NVARCHAR(20) NULL,
        [OrganizedByUserId] INT NOT NULL,
        [OrganizedByClubId] INT NULL,
        [MaxParticipants] INT NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [IsActive] BIT NOT NULL DEFAULT 1,
        CONSTRAINT [FK_Events_EventTypes] FOREIGN KEY ([EventTypeId]) REFERENCES [dbo].[EventTypes]([Id]),
        CONSTRAINT [FK_Events_Courts] FOREIGN KEY ([CourtId]) REFERENCES [dbo].[Courts]([Id]),
        CONSTRAINT [FK_Events_Users] FOREIGN KEY ([OrganizedByUserId]) REFERENCES [dbo].[Users]([Id]),
        CONSTRAINT [FK_Events_Clubs] FOREIGN KEY ([OrganizedByClubId]) REFERENCES [dbo].[Clubs]([Id])
    );
    PRINT 'Created Events table';

    CREATE INDEX [IX_Events_EventTypeId] ON [dbo].[Events]([EventTypeId]);
    CREATE INDEX [IX_Events_StartDate] ON [dbo].[Events]([StartDate]);
    CREATE INDEX [IX_Events_EndDate] ON [dbo].[Events]([EndDate]);
    CREATE INDEX [IX_Events_IsPublished] ON [dbo].[Events]([IsPublished]);
    CREATE INDEX [IX_Events_City] ON [dbo].[Events]([City]);
    CREATE INDEX [IX_Events_State] ON [dbo].[Events]([State]);
    CREATE INDEX [IX_Events_Country] ON [dbo].[Events]([Country]);
    CREATE INDEX [IX_Events_OrganizedByUserId] ON [dbo].[Events]([OrganizedByUserId]);
    CREATE INDEX [IX_Events_OrganizedByClubId] ON [dbo].[Events]([OrganizedByClubId]);
    CREATE INDEX [IX_Events_IsActive] ON [dbo].[Events]([IsActive]);
    PRINT 'Created indexes for Events table';
END
ELSE
BEGIN
    PRINT 'Events table already exists';
END
GO

-- EventDivisions table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EventDivisions')
BEGIN
    CREATE TABLE [dbo].[EventDivisions] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [EventId] INT NOT NULL,
        [Name] NVARCHAR(100) NOT NULL,
        [Description] NVARCHAR(500) NULL,
        [TeamSize] INT NOT NULL DEFAULT 1,
        [SkillLevelMin] NVARCHAR(50) NULL,
        [SkillLevelMax] NVARCHAR(50) NULL,
        [Gender] NVARCHAR(20) NULL,
        [AgeGroup] NVARCHAR(20) NULL,
        [MaxTeams] INT NULL,
        [DivisionFee] DECIMAL(10,2) NULL,
        [SortOrder] INT NOT NULL DEFAULT 0,
        [IsActive] BIT NOT NULL DEFAULT 1,
        CONSTRAINT [FK_EventDivisions_Events] FOREIGN KEY ([EventId]) REFERENCES [dbo].[Events]([Id]) ON DELETE CASCADE
    );
    PRINT 'Created EventDivisions table';

    CREATE INDEX [IX_EventDivisions_EventId] ON [dbo].[EventDivisions]([EventId]);
    CREATE INDEX [IX_EventDivisions_Gender] ON [dbo].[EventDivisions]([Gender]);
    CREATE INDEX [IX_EventDivisions_AgeGroup] ON [dbo].[EventDivisions]([AgeGroup]);
    PRINT 'Created indexes for EventDivisions table';
END
ELSE
BEGIN
    PRINT 'EventDivisions table already exists';
END
GO

-- EventRegistrations table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EventRegistrations')
BEGIN
    CREATE TABLE [dbo].[EventRegistrations] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [EventId] INT NOT NULL,
        [DivisionId] INT NOT NULL,
        [UserId] INT NOT NULL,
        [TeamId] INT NULL,
        [TeamName] NVARCHAR(100) NULL,
        [PaymentStatus] NVARCHAR(20) NOT NULL DEFAULT 'Pending',
        [AmountPaid] DECIMAL(10,2) NOT NULL DEFAULT 0,
        [PaidAt] DATETIME2 NULL,
        [PaymentReference] NVARCHAR(100) NULL,
        [Status] NVARCHAR(20) NOT NULL DEFAULT 'Registered',
        [RegisteredAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [CheckedInAt] DATETIME2 NULL,
        CONSTRAINT [FK_EventRegistrations_Events] FOREIGN KEY ([EventId]) REFERENCES [dbo].[Events]([Id]),
        CONSTRAINT [FK_EventRegistrations_Divisions] FOREIGN KEY ([DivisionId]) REFERENCES [dbo].[EventDivisions]([Id]),
        CONSTRAINT [FK_EventRegistrations_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id])
    );
    PRINT 'Created EventRegistrations table';

    CREATE INDEX [IX_EventRegistrations_EventId] ON [dbo].[EventRegistrations]([EventId]);
    CREATE INDEX [IX_EventRegistrations_DivisionId] ON [dbo].[EventRegistrations]([DivisionId]);
    CREATE INDEX [IX_EventRegistrations_UserId] ON [dbo].[EventRegistrations]([UserId]);
    CREATE INDEX [IX_EventRegistrations_TeamId] ON [dbo].[EventRegistrations]([TeamId]);
    CREATE INDEX [IX_EventRegistrations_Status] ON [dbo].[EventRegistrations]([Status]);
    PRINT 'Created indexes for EventRegistrations table';
END
ELSE
BEGIN
    PRINT 'EventRegistrations table already exists';
END
GO

-- EventPartnerRequests table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EventPartnerRequests')
BEGIN
    CREATE TABLE [dbo].[EventPartnerRequests] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [EventId] INT NOT NULL,
        [DivisionId] INT NOT NULL,
        [UserId] INT NOT NULL,
        [Message] NVARCHAR(500) NULL,
        [IsLookingForPartner] BIT NOT NULL DEFAULT 1,
        [RequestedByUserId] INT NULL,
        [Status] NVARCHAR(20) NOT NULL DEFAULT 'Open',
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [FK_EventPartnerRequests_Events] FOREIGN KEY ([EventId]) REFERENCES [dbo].[Events]([Id]),
        CONSTRAINT [FK_EventPartnerRequests_Divisions] FOREIGN KEY ([DivisionId]) REFERENCES [dbo].[EventDivisions]([Id]),
        CONSTRAINT [FK_EventPartnerRequests_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]),
        CONSTRAINT [FK_EventPartnerRequests_RequestedBy] FOREIGN KEY ([RequestedByUserId]) REFERENCES [dbo].[Users]([Id])
    );
    PRINT 'Created EventPartnerRequests table';

    CREATE INDEX [IX_EventPartnerRequests_EventId] ON [dbo].[EventPartnerRequests]([EventId]);
    CREATE INDEX [IX_EventPartnerRequests_DivisionId] ON [dbo].[EventPartnerRequests]([DivisionId]);
    CREATE INDEX [IX_EventPartnerRequests_UserId] ON [dbo].[EventPartnerRequests]([UserId]);
    CREATE INDEX [IX_EventPartnerRequests_Status] ON [dbo].[EventPartnerRequests]([Status]);
    PRINT 'Created indexes for EventPartnerRequests table';
END
ELSE
BEGIN
    PRINT 'EventPartnerRequests table already exists';
END
GO

PRINT 'Migration 023 completed successfully';
GO
