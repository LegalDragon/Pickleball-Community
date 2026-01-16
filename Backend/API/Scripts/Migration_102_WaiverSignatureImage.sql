-- Migration 102: Add waiver signature fields to EventUnitMembers
-- Stores URLs for signature image and signed PDF via asset management

PRINT 'Starting Migration 102 - Waiver Signature Assets...'

-- Add SignatureAssetUrl column to EventUnitMembers (URL to drawn signature image)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'SignatureAssetUrl')
BEGIN
    ALTER TABLE EventUnitMembers ADD SignatureAssetUrl NVARCHAR(500) NULL;
    PRINT 'Added SignatureAssetUrl column to EventUnitMembers';
END
ELSE
BEGIN
    PRINT 'SignatureAssetUrl column already exists in EventUnitMembers';
END

-- Add SignedWaiverPdfUrl column (URL to generated PDF of signed waiver)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'SignedWaiverPdfUrl')
BEGIN
    ALTER TABLE EventUnitMembers ADD SignedWaiverPdfUrl NVARCHAR(500) NULL;
    PRINT 'Added SignedWaiverPdfUrl column to EventUnitMembers';
END
ELSE
BEGIN
    PRINT 'SignedWaiverPdfUrl column already exists in EventUnitMembers';
END

-- Add SignerEmail column to track the email address at time of signing (for legal record)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'SignerEmail')
BEGIN
    ALTER TABLE EventUnitMembers ADD SignerEmail NVARCHAR(255) NULL;
    PRINT 'Added SignerEmail column to EventUnitMembers';
END
ELSE
BEGIN
    PRINT 'SignerEmail column already exists in EventUnitMembers';
END

-- Add SignerIpAddress column for legal record
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'SignerIpAddress')
BEGIN
    ALTER TABLE EventUnitMembers ADD SignerIpAddress NVARCHAR(50) NULL;
    PRINT 'Added SignerIpAddress column to EventUnitMembers';
END
ELSE
BEGIN
    PRINT 'SignerIpAddress column already exists in EventUnitMembers';
END

GO

-- Create stored procedure stub for sending waiver signed notification
-- This will be called after waiver is signed to trigger email notification
CREATE OR ALTER PROCEDURE [dbo].[sp_SendWaiverSignedNotification]
    @EventId INT,
    @UserId INT,
    @UserEmail NVARCHAR(255),
    @UserName NVARCHAR(200),
    @EventName NVARCHAR(200),
    @WaiverTitle NVARCHAR(200),
    @SignedAt DATETIME,
    @SignatureAssetUrl NVARCHAR(500),
    @SignedWaiverPdfUrl NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;

    -- TODO: Implement email notification logic here
    -- This procedure should:
    -- 1. Send email to user with signed waiver PDF attached
    -- 2. Send email to event admin/organizer with notification
    -- 3. Log the notification in your notification system

    PRINT 'Waiver signed notification - EventId: ' + CAST(@EventId AS VARCHAR) +
          ', UserId: ' + CAST(@UserId AS VARCHAR) +
          ', Email: ' + @UserEmail;

    -- Placeholder - return success
    SELECT 1 AS Success, 'Notification queued' AS Message;
END
GO

-- Create testing stored procedure that looks up data and calls sp_SendWaiverSignedNotification
CREATE OR ALTER PROCEDURE [dbo].[sp_TestSendWaiverSignedNotification]
    @EventId INT,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserEmail NVARCHAR(255);
    DECLARE @UserName NVARCHAR(200);
    DECLARE @EventName NVARCHAR(200);
    DECLARE @WaiverTitle NVARCHAR(200);
    DECLARE @SignedAt DATETIME;
    DECLARE @SignatureAssetUrl NVARCHAR(500);
    DECLARE @SignedWaiverPdfUrl NVARCHAR(500);

    -- Look up user info
    SELECT @UserEmail = Email, @UserName = CONCAT(FirstName, ' ', LastName)
    FROM Users
    WHERE Id = @UserId;

    IF @UserEmail IS NULL
    BEGIN
        SELECT 0 AS Success, 'User not found' AS Message;
        RETURN;
    END

    -- Look up event name
    SELECT @EventName = Name
    FROM Events
    WHERE Id = @EventId;

    IF @EventName IS NULL
    BEGIN
        SELECT 0 AS Success, 'Event not found' AS Message;
        RETURN;
    END

    -- Look up waiver title (get the first active waiver for the event)
    SELECT TOP 1 @WaiverTitle = Title
    FROM EventWaivers
    WHERE EventId = @EventId AND IsActive = 1
    ORDER BY Id;

    IF @WaiverTitle IS NULL
        SET @WaiverTitle = 'Event Waiver';

    -- Look up signature data from EventUnitMembers
    SELECT TOP 1
        @SignedAt = um.WaiverSignedAt,
        @SignatureAssetUrl = um.SignatureAssetUrl,
        @SignedWaiverPdfUrl = um.SignedWaiverPdfUrl
    FROM EventUnitMembers um
    INNER JOIN EventUnits eu ON um.UnitId = eu.Id
    WHERE eu.EventId = @EventId AND um.UserId = @UserId AND um.WaiverSignedAt IS NOT NULL;

    IF @SignedAt IS NULL
    BEGIN
        SELECT 0 AS Success, 'No signed waiver found for this user in this event' AS Message;
        RETURN;
    END

    -- Call the actual notification procedure
    EXEC sp_SendWaiverSignedNotification
        @EventId = @EventId,
        @UserId = @UserId,
        @UserEmail = @UserEmail,
        @UserName = @UserName,
        @EventName = @EventName,
        @WaiverTitle = @WaiverTitle,
        @SignedAt = @SignedAt,
        @SignatureAssetUrl = @SignatureAssetUrl,
        @SignedWaiverPdfUrl = @SignedWaiverPdfUrl;
END
GO

PRINT 'Migration 102 completed successfully';
