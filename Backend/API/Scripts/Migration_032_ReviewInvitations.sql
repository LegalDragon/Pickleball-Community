-- Migration 032: Review Visibility and Invitations
-- Adds visibility settings and invitation tracking for peer reviews

PRINT 'Starting Migration 032: Review Visibility and Invitations'
GO

-- Add Visibility column to PlayerCertificationRequests
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('PlayerCertificationRequests') AND name = 'Visibility')
BEGIN
    ALTER TABLE PlayerCertificationRequests ADD Visibility INT NOT NULL DEFAULT 0
    PRINT 'Added Visibility column to PlayerCertificationRequests'
END
ELSE
BEGIN
    PRINT 'Visibility column already exists in PlayerCertificationRequests'
END
GO

-- Create PlayerCertificationInvitations table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PlayerCertificationInvitations')
BEGIN
    CREATE TABLE PlayerCertificationInvitations (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RequestId INT NOT NULL,
        InvitedUserId INT NOT NULL,
        HasReviewed BIT NOT NULL DEFAULT 0,
        InvitedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        ReviewedAt DATETIME2 NULL,
        CONSTRAINT FK_PlayerCertificationInvitations_Request FOREIGN KEY (RequestId)
            REFERENCES PlayerCertificationRequests(Id) ON DELETE CASCADE,
        CONSTRAINT FK_PlayerCertificationInvitations_User FOREIGN KEY (InvitedUserId)
            REFERENCES Users(Id) ON DELETE CASCADE
    )
    PRINT 'Created PlayerCertificationInvitations table'
END
ELSE
BEGIN
    PRINT 'PlayerCertificationInvitations table already exists'
END
GO

-- Add indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PlayerCertificationInvitations_RequestId' AND object_id = OBJECT_ID('PlayerCertificationInvitations'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_PlayerCertificationInvitations_RequestId
    ON PlayerCertificationInvitations(RequestId)
    PRINT 'Created index IX_PlayerCertificationInvitations_RequestId'
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PlayerCertificationInvitations_InvitedUserId' AND object_id = OBJECT_ID('PlayerCertificationInvitations'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_PlayerCertificationInvitations_InvitedUserId
    ON PlayerCertificationInvitations(InvitedUserId)
    PRINT 'Created index IX_PlayerCertificationInvitations_InvitedUserId'
END
GO

-- Add unique constraint to prevent duplicate invitations
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UX_PlayerCertificationInvitations_Request_User' AND object_id = OBJECT_ID('PlayerCertificationInvitations'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_PlayerCertificationInvitations_Request_User
    ON PlayerCertificationInvitations(RequestId, InvitedUserId)
    PRINT 'Created unique index UX_PlayerCertificationInvitations_Request_User'
END
GO

-- Add ReviewerId column to PlayerCertificationReviews for tracking logged-in reviewers
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('PlayerCertificationReviews') AND name = 'ReviewerId')
BEGIN
    ALTER TABLE PlayerCertificationReviews ADD ReviewerId INT NULL
    PRINT 'Added ReviewerId column to PlayerCertificationReviews'
END
ELSE
BEGIN
    PRINT 'ReviewerId column already exists in PlayerCertificationReviews'
END
GO

-- Add foreign key for ReviewerId
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_PlayerCertificationReviews_Reviewer')
BEGIN
    ALTER TABLE PlayerCertificationReviews
    ADD CONSTRAINT FK_PlayerCertificationReviews_Reviewer
    FOREIGN KEY (ReviewerId) REFERENCES Users(Id)
    ON DELETE SET NULL
    PRINT 'Added foreign key FK_PlayerCertificationReviews_Reviewer'
END
GO

-- Add index on ReviewerId
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PlayerCertificationReviews_ReviewerId' AND object_id = OBJECT_ID('PlayerCertificationReviews'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_PlayerCertificationReviews_ReviewerId
    ON PlayerCertificationReviews(ReviewerId)
    PRINT 'Created index IX_PlayerCertificationReviews_ReviewerId'
END
GO

PRINT 'Migration 032: Review Visibility and Invitations completed'
GO
