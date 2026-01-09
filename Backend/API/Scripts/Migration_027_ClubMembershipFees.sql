-- Migration 027: Add membership fee fields to Clubs and validity fields to ClubMembers
-- Allows clubs to specify membership fees and payment instructions
-- Tracks member roles and membership expiration dates

PRINT 'Starting Migration 027: Club Membership Fees and Member Validity';
GO

-- Add membership fee fields to Clubs table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clubs') AND name = 'HasMembershipFee')
BEGIN
    ALTER TABLE dbo.Clubs ADD HasMembershipFee BIT NOT NULL DEFAULT 0;
    PRINT 'Added HasMembershipFee column to Clubs';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clubs') AND name = 'MembershipFeeAmount')
BEGIN
    ALTER TABLE dbo.Clubs ADD MembershipFeeAmount NVARCHAR(100) NULL;
    PRINT 'Added MembershipFeeAmount column to Clubs';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clubs') AND name = 'MembershipFeePeriod')
BEGIN
    -- Period: monthly, yearly, quarterly, one-time, etc.
    ALTER TABLE dbo.Clubs ADD MembershipFeePeriod NVARCHAR(50) NULL;
    PRINT 'Added MembershipFeePeriod column to Clubs';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Clubs') AND name = 'PaymentInstructions')
BEGIN
    ALTER TABLE dbo.Clubs ADD PaymentInstructions NVARCHAR(2000) NULL;
    PRINT 'Added PaymentInstructions column to Clubs';
END
GO

-- Add membership validity field to ClubMembers table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ClubMembers') AND name = 'MembershipValidTo')
BEGIN
    ALTER TABLE dbo.ClubMembers ADD MembershipValidTo DATETIME2 NULL;
    PRINT 'Added MembershipValidTo column to ClubMembers';
END
GO

-- Add MembershipNotes for tracking payment status, notes about member
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ClubMembers') AND name = 'MembershipNotes')
BEGIN
    ALTER TABLE dbo.ClubMembers ADD MembershipNotes NVARCHAR(500) NULL;
    PRINT 'Added MembershipNotes column to ClubMembers';
END
GO

-- Add Title for custom roles like "Treasurer", "Secretary", etc.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ClubMembers') AND name = 'Title')
BEGIN
    ALTER TABLE dbo.ClubMembers ADD Title NVARCHAR(100) NULL;
    PRINT 'Added Title column to ClubMembers';
END
GO

PRINT 'Migration 027 completed successfully';
GO
