-- Migration 124: Event Fees
-- Extends DivisionFees table to support event-level fees
-- Uses DivisionId = NULL and EventId for event fees

PRINT 'Starting Migration 124: Event Fees'

-- =====================================================
-- Add EventId column to DivisionFees
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[DivisionFees]') AND name = 'EventId')
BEGIN
    ALTER TABLE [dbo].[DivisionFees]
    ADD [EventId] INT NULL;
    PRINT 'Added EventId column to DivisionFees'
END
ELSE
BEGIN
    PRINT 'EventId column already exists in DivisionFees'
END
GO

-- =====================================================
-- Make DivisionId nullable (for event-level fees)
-- =====================================================
-- First drop the existing foreign key constraint
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_DivisionFees_EventDivisions')
BEGIN
    ALTER TABLE [dbo].[DivisionFees] DROP CONSTRAINT [FK_DivisionFees_EventDivisions];
    PRINT 'Dropped FK_DivisionFees_EventDivisions constraint'
END
GO

-- Check if column is NOT NULL and alter it
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[DivisionFees]') AND name = 'DivisionId' AND is_nullable = 0)
BEGIN
    ALTER TABLE [dbo].[DivisionFees]
    ALTER COLUMN [DivisionId] INT NULL;
    PRINT 'Made DivisionId column nullable'
END
ELSE
BEGIN
    PRINT 'DivisionId column is already nullable'
END
GO

-- Re-add the foreign key constraint (now allows NULL)
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_DivisionFees_EventDivisions')
BEGIN
    ALTER TABLE [dbo].[DivisionFees]
    ADD CONSTRAINT [FK_DivisionFees_EventDivisions]
    FOREIGN KEY ([DivisionId]) REFERENCES [dbo].[EventDivisions] ([Id]) ON DELETE CASCADE;
    PRINT 'Re-added FK_DivisionFees_EventDivisions constraint'
END
GO

-- Add foreign key for EventId
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_DivisionFees_Events')
BEGIN
    ALTER TABLE [dbo].[DivisionFees]
    ADD CONSTRAINT [FK_DivisionFees_Events]
    FOREIGN KEY ([EventId]) REFERENCES [dbo].[Events] ([Id]) ON DELETE NO ACTION;
    PRINT 'Added FK_DivisionFees_Events constraint'
END
GO

-- =====================================================
-- Backfill EventId for existing division fees
-- =====================================================
UPDATE df
SET df.EventId = ed.EventId
FROM [dbo].[DivisionFees] df
INNER JOIN [dbo].[EventDivisions] ed ON df.DivisionId = ed.Id
WHERE df.EventId IS NULL AND df.DivisionId IS NOT NULL;
PRINT 'Backfilled EventId for existing division fees'
GO

-- =====================================================
-- Create index for event-level fee lookups
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DivisionFees_EventId')
BEGIN
    CREATE INDEX [IX_DivisionFees_EventId] ON [dbo].[DivisionFees] ([EventId]);
    PRINT 'Created index IX_DivisionFees_EventId'
END
GO

-- =====================================================
-- Add check constraint to ensure either DivisionId or EventId is set
-- (but not both NULL)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_DivisionFees_HasParent')
BEGIN
    ALTER TABLE [dbo].[DivisionFees]
    ADD CONSTRAINT [CK_DivisionFees_HasParent]
    CHECK (DivisionId IS NOT NULL OR EventId IS NOT NULL);
    PRINT 'Added CK_DivisionFees_HasParent constraint'
END
GO

PRINT 'Migration 124: Event Fees completed successfully'
GO
