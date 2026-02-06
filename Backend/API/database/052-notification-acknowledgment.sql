-- Add acknowledgment fields to Notifications table
-- Allows sending push notifications that require user confirmation

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Notifications') AND name = 'RequiresAcknowledgment')
BEGIN
    ALTER TABLE Notifications ADD RequiresAcknowledgment BIT NOT NULL DEFAULT 0;
    PRINT 'Added RequiresAcknowledgment column to Notifications';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Notifications') AND name = 'AcknowledgedAt')
BEGIN
    ALTER TABLE Notifications ADD AcknowledgedAt DATETIME2 NULL;
    PRINT 'Added AcknowledgedAt column to Notifications';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Notifications') AND name = 'AcknowledgmentToken')
BEGIN
    ALTER TABLE Notifications ADD AcknowledgmentToken NVARCHAR(64) NULL;
    PRINT 'Added AcknowledgmentToken column to Notifications';
END
GO

-- Index for looking up notifications by token
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Notifications_AcknowledgmentToken' AND object_id = OBJECT_ID('Notifications'))
BEGIN
    CREATE INDEX IX_Notifications_AcknowledgmentToken ON Notifications(AcknowledgmentToken) WHERE AcknowledgmentToken IS NOT NULL;
    PRINT 'Created index on AcknowledgmentToken';
END
GO
