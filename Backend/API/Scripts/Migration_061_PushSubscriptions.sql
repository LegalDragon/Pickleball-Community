-- Migration 061: Push Subscriptions for Web Push Notifications
-- This table stores Web Push notification subscriptions for users
-- Each user can have multiple subscriptions (one per device/browser)

PRINT 'Starting Migration 061: Push Subscriptions'

-- Create PushSubscriptions table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PushSubscriptions')
BEGIN
    CREATE TABLE PushSubscriptions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        Endpoint NVARCHAR(500) NOT NULL,
        P256dh NVARCHAR(500) NOT NULL,
        Auth NVARCHAR(500) NOT NULL,
        UserAgent NVARCHAR(500) NULL,
        DeviceName NVARCHAR(100) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        LastUsedAt DATETIME2 NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CONSTRAINT FK_PushSubscriptions_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
    )
    PRINT 'Created PushSubscriptions table'
END
ELSE
BEGIN
    PRINT 'PushSubscriptions table already exists'
END

-- Create index on UserId for faster lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PushSubscriptions_UserId' AND object_id = OBJECT_ID('PushSubscriptions'))
BEGIN
    CREATE INDEX IX_PushSubscriptions_UserId ON PushSubscriptions(UserId)
    PRINT 'Created index IX_PushSubscriptions_UserId'
END

-- Create unique index on Endpoint to prevent duplicate subscriptions
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PushSubscriptions_Endpoint' AND object_id = OBJECT_ID('PushSubscriptions'))
BEGIN
    CREATE UNIQUE INDEX IX_PushSubscriptions_Endpoint ON PushSubscriptions(Endpoint)
    PRINT 'Created unique index IX_PushSubscriptions_Endpoint'
END

-- Create index on IsActive for filtering active subscriptions
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PushSubscriptions_IsActive' AND object_id = OBJECT_ID('PushSubscriptions'))
BEGIN
    CREATE INDEX IX_PushSubscriptions_IsActive ON PushSubscriptions(IsActive) WHERE IsActive = 1
    PRINT 'Created filtered index IX_PushSubscriptions_IsActive'
END

PRINT 'Migration 061 completed successfully'
