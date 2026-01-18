-- Migration 109: Add seed label columns to EventEncounters
-- These labels store playoff bracket seeding info like "Pool A #1", "Winner SF1"
-- Allows displaying seed structure before actual units are assigned

PRINT 'Starting Migration 109 - Seed Labels'

-- Add Unit1SeedLabel column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'Unit1SeedLabel')
BEGIN
    ALTER TABLE EventEncounters ADD Unit1SeedLabel NVARCHAR(50) NULL
    PRINT 'Added Unit1SeedLabel column to EventEncounters'
END
ELSE
BEGIN
    PRINT 'Unit1SeedLabel column already exists'
END

-- Add Unit2SeedLabel column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventEncounters') AND name = 'Unit2SeedLabel')
BEGIN
    ALTER TABLE EventEncounters ADD Unit2SeedLabel NVARCHAR(50) NULL
    PRINT 'Added Unit2SeedLabel column to EventEncounters'
END
ELSE
BEGIN
    PRINT 'Unit2SeedLabel column already exists'
END

PRINT 'Migration 109 completed'
