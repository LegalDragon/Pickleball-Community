-- Migration 126: Fee Type Simplification
-- Simplifies fee types to be name-only templates
-- Modifies DivisionFees to use DivisionId=0 for event-level fees
-- FeeTypeId becomes required reference for all fees

PRINT 'Starting Migration 126: Fee Type Simplification'

-- =====================================================
-- Step 1: Drop default constraints on EventFeeTypes columns
-- =====================================================

-- Drop default constraint on DefaultAmount (dynamically find name)
DECLARE @ConstraintName NVARCHAR(200)
SELECT @ConstraintName = dc.name
FROM sys.default_constraints dc
INNER JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE c.object_id = OBJECT_ID(N'[dbo].[EventFeeTypes]') AND c.name = 'DefaultAmount'

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE [dbo].[EventFeeTypes] DROP CONSTRAINT [' + @ConstraintName + ']')
    PRINT 'Dropped default constraint on DefaultAmount'
END
GO

-- =====================================================
-- Step 2: Remove unnecessary columns from EventFeeTypes
-- =====================================================

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EventFeeTypes]') AND name = 'DefaultAmount')
BEGIN
    ALTER TABLE [dbo].[EventFeeTypes] DROP COLUMN [DefaultAmount];
    PRINT 'Removed DefaultAmount column from EventFeeTypes'
END
ELSE
BEGIN
    PRINT 'DefaultAmount column already removed from EventFeeTypes'
END
GO

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EventFeeTypes]') AND name = 'AvailableFrom')
BEGIN
    ALTER TABLE [dbo].[EventFeeTypes] DROP COLUMN [AvailableFrom];
    PRINT 'Removed AvailableFrom column from EventFeeTypes'
END
ELSE
BEGIN
    PRINT 'AvailableFrom column already removed from EventFeeTypes'
END
GO

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EventFeeTypes]') AND name = 'AvailableUntil')
BEGIN
    ALTER TABLE [dbo].[EventFeeTypes] DROP COLUMN [AvailableUntil];
    PRINT 'Removed AvailableUntil column from EventFeeTypes'
END
ELSE
BEGIN
    PRINT 'AvailableUntil column already removed from EventFeeTypes'
END
GO

-- =====================================================
-- Step 3: Drop constraints and indexes on DivisionFees
-- =====================================================

-- Drop the old check constraint
IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_DivisionFees_HasParent')
BEGIN
    ALTER TABLE [dbo].[DivisionFees] DROP CONSTRAINT [CK_DivisionFees_HasParent];
    PRINT 'Dropped CK_DivisionFees_HasParent constraint'
END
GO

-- Drop the old FK constraint on DivisionId
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_DivisionFees_EventDivisions')
BEGIN
    ALTER TABLE [dbo].[DivisionFees] DROP CONSTRAINT [FK_DivisionFees_EventDivisions];
    PRINT 'Dropped FK_DivisionFees_EventDivisions constraint'
END
GO

-- Drop index on DivisionId (need to drop before altering column)
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DivisionFees_DivisionId' AND object_id = OBJECT_ID(N'[dbo].[DivisionFees]'))
BEGIN
    DROP INDEX [IX_DivisionFees_DivisionId] ON [dbo].[DivisionFees];
    PRINT 'Dropped index IX_DivisionFees_DivisionId'
END
GO

-- Drop index on EventId (need to drop before altering column)
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DivisionFees_EventId' AND object_id = OBJECT_ID(N'[dbo].[DivisionFees]'))
BEGIN
    DROP INDEX [IX_DivisionFees_EventId] ON [dbo].[DivisionFees];
    PRINT 'Dropped index IX_DivisionFees_EventId'
END
GO

-- =====================================================
-- Step 4: Create fee types for orphaned fees (fees without FeeTypeId)
-- This ensures all fees can reference a fee type
-- =====================================================

-- For each event that has fees without FeeTypeId, create fee types from the fee names
INSERT INTO [dbo].[EventFeeTypes] ([EventId], [Name], [Description], [IsActive], [SortOrder], [CreatedAt])
SELECT DISTINCT
    df.EventId,
    df.Name,
    df.Description,
    1, -- IsActive
    0, -- SortOrder
    GETUTCDATE()
FROM [dbo].[DivisionFees] df
WHERE df.FeeTypeId IS NULL
  AND df.EventId IS NOT NULL
  AND df.Name IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM [dbo].[EventFeeTypes] eft
      WHERE eft.EventId = df.EventId AND eft.Name = df.Name
  );
PRINT 'Created fee types for orphaned fees'
GO

-- Update orphaned fees to reference their newly created fee types
UPDATE df
SET df.FeeTypeId = eft.Id
FROM [dbo].[DivisionFees] df
INNER JOIN [dbo].[EventFeeTypes] eft ON df.EventId = eft.EventId AND df.Name = eft.Name
WHERE df.FeeTypeId IS NULL;
PRINT 'Linked orphaned fees to their fee types'
GO

-- =====================================================
-- Step 5: Convert NULL DivisionId to 0 for event-level fees
-- =====================================================

UPDATE [dbo].[DivisionFees]
SET [DivisionId] = 0
WHERE [DivisionId] IS NULL;
PRINT 'Converted NULL DivisionId to 0 for event-level fees'
GO

-- =====================================================
-- Step 6: Make DivisionId NOT NULL with default 0
-- =====================================================

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[DivisionFees]') AND name = 'DivisionId' AND is_nullable = 1)
BEGIN
    ALTER TABLE [dbo].[DivisionFees]
    ALTER COLUMN [DivisionId] INT NOT NULL;
    PRINT 'Made DivisionId NOT NULL'
END
GO

-- Add default constraint
IF NOT EXISTS (SELECT * FROM sys.default_constraints WHERE name = 'DF_DivisionFees_DivisionId')
BEGIN
    ALTER TABLE [dbo].[DivisionFees]
    ADD CONSTRAINT [DF_DivisionFees_DivisionId] DEFAULT 0 FOR [DivisionId];
    PRINT 'Added default constraint DF_DivisionFees_DivisionId'
END
GO

-- =====================================================
-- Step 7: Make EventId NOT NULL (was nullable)
-- =====================================================

-- First ensure all rows have EventId set
UPDATE df
SET df.EventId = ed.EventId
FROM [dbo].[DivisionFees] df
INNER JOIN [dbo].[EventDivisions] ed ON df.DivisionId = ed.Id
WHERE df.EventId IS NULL AND df.DivisionId > 0;
GO

-- Now make it NOT NULL
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[DivisionFees]') AND name = 'EventId' AND is_nullable = 1)
BEGIN
    ALTER TABLE [dbo].[DivisionFees]
    ALTER COLUMN [EventId] INT NOT NULL;
    PRINT 'Made EventId NOT NULL'
END
GO

-- =====================================================
-- Step 8: Add new constraints and indexes
-- =====================================================

-- Check constraint for DivisionId >= 0
IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_DivisionFees_DivisionId')
BEGIN
    ALTER TABLE [dbo].[DivisionFees]
    ADD CONSTRAINT [CK_DivisionFees_DivisionId]
    CHECK (DivisionId >= 0);
    PRINT 'Added CK_DivisionFees_DivisionId constraint'
END
GO

-- Recreate index on EventId
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DivisionFees_EventId' AND object_id = OBJECT_ID(N'[dbo].[DivisionFees]'))
BEGIN
    CREATE INDEX [IX_DivisionFees_EventId] ON [dbo].[DivisionFees] ([EventId]);
    PRINT 'Created index IX_DivisionFees_EventId'
END
GO

-- Create composite index for efficient lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DivisionFees_EventId_DivisionId')
BEGIN
    CREATE INDEX [IX_DivisionFees_EventId_DivisionId]
    ON [dbo].[DivisionFees] ([EventId], [DivisionId]);
    PRINT 'Created index IX_DivisionFees_EventId_DivisionId'
END
GO

PRINT 'Migration 126: Fee Type Simplification completed successfully'
GO
