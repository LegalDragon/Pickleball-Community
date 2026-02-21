-- Migration 121: Event Unit Member Waivers Junction Table
-- Tracks each waiver signed by a member for proper audit trail
-- Supports multiple waivers per event with individual signatures

PRINT 'Starting Migration 121: EventUnitMemberWaivers'

-- =====================================================
-- Create EventUnitMemberWaivers junction table
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EventUnitMemberWaivers]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[EventUnitMemberWaivers] (
        [Id] INT IDENTITY(1,1) NOT NULL,
        [EventUnitMemberId] INT NOT NULL,
        [WaiverId] INT NOT NULL, -- ObjectAsset ID
        [SignedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        -- Signature data
        [SignatureAssetUrl] NVARCHAR(500) NULL, -- URL to signature image
        [SignedPdfUrl] NVARCHAR(500) NULL, -- URL to individual signed waiver PDF
        [WaiverSignature] NVARCHAR(200) NULL, -- Typed signature (full name)

        -- Signer info
        [SignerRole] NVARCHAR(20) NOT NULL DEFAULT 'Participant', -- Participant, Parent, Guardian
        [ParentGuardianName] NVARCHAR(200) NULL,
        [EmergencyPhone] NVARCHAR(30) NULL,

        -- Legal record
        [SignerEmail] NVARCHAR(255) NULL,
        [SignerIpAddress] NVARCHAR(50) NULL,

        -- Waiver version at time of signing
        [WaiverTitle] NVARCHAR(200) NULL,
        [WaiverVersion] INT NULL,

        CONSTRAINT [PK_EventUnitMemberWaivers] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_EventUnitMemberWaivers_EventUnitMembers] FOREIGN KEY ([EventUnitMemberId])
            REFERENCES [dbo].[EventUnitMembers] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created EventUnitMemberWaivers table'
END
ELSE
BEGIN
    PRINT 'EventUnitMemberWaivers table already exists'
END
GO

-- Create index for faster lookups by member
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EventUnitMemberWaivers_EventUnitMemberId')
BEGIN
    CREATE INDEX [IX_EventUnitMemberWaivers_EventUnitMemberId] ON [dbo].[EventUnitMemberWaivers] ([EventUnitMemberId]);
    PRINT 'Created index IX_EventUnitMemberWaivers_EventUnitMemberId'
END
GO

-- Create index for faster lookups by waiver
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EventUnitMemberWaivers_WaiverId')
BEGIN
    CREATE INDEX [IX_EventUnitMemberWaivers_WaiverId] ON [dbo].[EventUnitMemberWaivers] ([WaiverId]);
    PRINT 'Created index IX_EventUnitMemberWaivers_WaiverId'
END
GO

-- Create unique index to prevent duplicate signatures
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EventUnitMemberWaivers_MemberWaiver_Unique')
BEGIN
    CREATE UNIQUE INDEX [IX_EventUnitMemberWaivers_MemberWaiver_Unique]
        ON [dbo].[EventUnitMemberWaivers] ([EventUnitMemberId], [WaiverId]);
    PRINT 'Created unique index IX_EventUnitMemberWaivers_MemberWaiver_Unique'
END
GO

-- =====================================================
-- Add MergedWaiverPdfUrl to EventUnitMembers
-- Stores the combined PDF of all signed waivers
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EventUnitMembers]') AND name = 'MergedWaiverPdfUrl')
BEGIN
    ALTER TABLE [dbo].[EventUnitMembers]
    ADD [MergedWaiverPdfUrl] NVARCHAR(500) NULL;
    PRINT 'Added MergedWaiverPdfUrl column to EventUnitMembers'
END
GO

PRINT 'Migration 121: EventUnitMemberWaivers completed successfully'
GO
