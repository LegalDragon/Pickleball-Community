-- Migration 120: Division Fees
-- Allows event admins to define multiple fee options per division
-- Users can select which fee applies when registering

PRINT 'Starting Migration 120: Division Fees'

-- =====================================================
-- Create DivisionFees table
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DivisionFees]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[DivisionFees] (
        [Id] INT IDENTITY(1,1) NOT NULL,
        [DivisionId] INT NOT NULL,
        [Name] NVARCHAR(100) NOT NULL,
        [Description] NVARCHAR(500) NULL,
        [Amount] DECIMAL(10,2) NOT NULL DEFAULT 0,
        [IsDefault] BIT NOT NULL DEFAULT 0,
        [AvailableFrom] DATETIME2 NULL,
        [AvailableUntil] DATETIME2 NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [SortOrder] INT NOT NULL DEFAULT 0,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] DATETIME2 NULL,
        CONSTRAINT [PK_DivisionFees] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_DivisionFees_EventDivisions] FOREIGN KEY ([DivisionId])
            REFERENCES [dbo].[EventDivisions] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created DivisionFees table'
END
ELSE
BEGIN
    PRINT 'DivisionFees table already exists'
END
GO

-- Create index for faster lookups by division
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DivisionFees_DivisionId')
BEGIN
    CREATE INDEX [IX_DivisionFees_DivisionId] ON [dbo].[DivisionFees] ([DivisionId]);
    PRINT 'Created index IX_DivisionFees_DivisionId'
END
GO

-- =====================================================
-- Add SelectedFeeId to EventRegistrations
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EventRegistrations]') AND name = 'SelectedFeeId')
BEGIN
    ALTER TABLE [dbo].[EventRegistrations]
    ADD [SelectedFeeId] INT NULL;
    PRINT 'Added SelectedFeeId column to EventRegistrations'
END
GO

-- Add foreign key constraint
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_EventRegistrations_DivisionFees')
BEGIN
    ALTER TABLE [dbo].[EventRegistrations]
    ADD CONSTRAINT [FK_EventRegistrations_DivisionFees]
    FOREIGN KEY ([SelectedFeeId]) REFERENCES [dbo].[DivisionFees] ([Id]);
    PRINT 'Added FK_EventRegistrations_DivisionFees constraint'
END
GO

-- =====================================================
-- Add SelectedFeeId to EventUnitMembers (for team registrations)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EventUnitMembers]') AND name = 'SelectedFeeId')
BEGIN
    ALTER TABLE [dbo].[EventUnitMembers]
    ADD [SelectedFeeId] INT NULL;
    PRINT 'Added SelectedFeeId column to EventUnitMembers'
END
GO

-- Add foreign key constraint
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_EventUnitMembers_DivisionFees')
BEGIN
    ALTER TABLE [dbo].[EventUnitMembers]
    ADD CONSTRAINT [FK_EventUnitMembers_DivisionFees]
    FOREIGN KEY ([SelectedFeeId]) REFERENCES [dbo].[DivisionFees] ([Id]);
    PRINT 'Added FK_EventUnitMembers_DivisionFees constraint'
END
GO

PRINT 'Migration 120: Division Fees completed successfully'
GO
