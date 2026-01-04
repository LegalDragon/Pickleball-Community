-- Migration 047: User Notifications
-- Description: Creates the Notifications table for user notifications with delete capability

PRINT 'Starting Migration 047: User Notifications...'

-- ============================================
-- Create Notifications table
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Notifications')
BEGIN
    PRINT 'Creating Notifications table...'
    CREATE TABLE [dbo].[Notifications] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [UserId] INT NOT NULL,
        [Type] NVARCHAR(50) NOT NULL DEFAULT 'General',
        [Title] NVARCHAR(200) NOT NULL,
        [Message] NVARCHAR(1000) NULL,
        [ActionUrl] NVARCHAR(500) NULL,
        [ReferenceType] NVARCHAR(50) NULL,
        [ReferenceId] INT NULL,
        [IsRead] BIT NOT NULL DEFAULT 0,
        [ReadAt] DATETIME2 NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT [FK_Notifications_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_Notifications_UserId] ON [dbo].[Notifications]([UserId]);
    CREATE INDEX [IX_Notifications_UserId_IsRead] ON [dbo].[Notifications]([UserId], [IsRead]);
    CREATE INDEX [IX_Notifications_CreatedAt] ON [dbo].[Notifications]([CreatedAt] DESC);
    CREATE INDEX [IX_Notifications_Type] ON [dbo].[Notifications]([Type]);

    PRINT 'Notifications table created successfully.'
END
ELSE
BEGIN
    PRINT 'Notifications table already exists.'
END
GO

PRINT 'Migration 047: User Notifications completed successfully.'
