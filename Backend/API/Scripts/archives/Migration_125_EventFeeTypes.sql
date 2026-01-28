-- Migration 125: Event Fee Types
-- Creates EventFeeTypes table for defining fee type templates at event level
-- Adds FeeTypeId to DivisionFees for referencing fee types

PRINT 'Starting Migration 125: Event Fee Types'

-- =====================================================
-- Create EventFeeTypes table
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EventFeeTypes]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[EventFeeTypes] (
        [Id] INT IDENTITY(1,1) NOT NULL,
        [EventId] INT NOT NULL,
        [Name] NVARCHAR(100) NOT NULL,
        [Description] NVARCHAR(500) NULL,
        [DefaultAmount] DECIMAL(10,2) NOT NULL DEFAULT 0,
        [AvailableFrom] DATETIME2 NULL,
        [AvailableUntil] DATETIME2 NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [SortOrder] INT NOT NULL DEFAULT 0,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] DATETIME2 NULL,
        CONSTRAINT [PK_EventFeeTypes] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_EventFeeTypes_Events] FOREIGN KEY ([EventId])
            REFERENCES [dbo].[Events] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created EventFeeTypes table'
END
ELSE
BEGIN
    PRINT 'EventFeeTypes table already exists'
END
GO

-- Create index for faster lookups by event
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EventFeeTypes_EventId')
BEGIN
    CREATE INDEX [IX_EventFeeTypes_EventId] ON [dbo].[EventFeeTypes] ([EventId]);
    PRINT 'Created index IX_EventFeeTypes_EventId'
END
GO

-- =====================================================
-- Add FeeTypeId to DivisionFees
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[DivisionFees]') AND name = 'FeeTypeId')
BEGIN
    ALTER TABLE [dbo].[DivisionFees]
    ADD [FeeTypeId] INT NULL;
    PRINT 'Added FeeTypeId column to DivisionFees'
END
ELSE
BEGIN
    PRINT 'FeeTypeId column already exists in DivisionFees'
END
GO

-- Add foreign key constraint for FeeTypeId
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_DivisionFees_EventFeeTypes')
BEGIN
    ALTER TABLE [dbo].[DivisionFees]
    ADD CONSTRAINT [FK_DivisionFees_EventFeeTypes]
    FOREIGN KEY ([FeeTypeId]) REFERENCES [dbo].[EventFeeTypes] ([Id]) ON DELETE NO ACTION;
    PRINT 'Added FK_DivisionFees_EventFeeTypes constraint'
END
GO

-- Create index for FeeTypeId lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DivisionFees_FeeTypeId')
BEGIN
    CREATE INDEX [IX_DivisionFees_FeeTypeId] ON [dbo].[DivisionFees] ([FeeTypeId]);
    PRINT 'Created index IX_DivisionFees_FeeTypeId'
END
GO

PRINT 'Migration 125: Event Fee Types completed successfully'
GO
