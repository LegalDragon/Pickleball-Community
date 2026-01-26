-- Migration 087: Add ShortCode column to ScoreMethods
-- Short code for compact display (e.g., "Rally", "Classic", "MLP")

PRINT 'Starting Migration 087: ScoreMethod ShortCode column'
GO

-- Add ShortCode column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ScoreMethods') AND name = 'ShortCode')
BEGIN
    ALTER TABLE ScoreMethods ADD ShortCode NVARCHAR(20) NULL;
    PRINT 'Added ShortCode column to ScoreMethods'
END
GO

-- Populate ShortCode for existing records based on Name
UPDATE ScoreMethods SET ShortCode = 'Rally' WHERE Name LIKE '%Rally%' AND ShortCode IS NULL;
UPDATE ScoreMethods SET ShortCode = 'Classic' WHERE Name LIKE '%Classic%' AND ShortCode IS NULL;
UPDATE ScoreMethods SET ShortCode = 'MLP' WHERE Name LIKE '%MLP%' AND ShortCode IS NULL;
UPDATE ScoreMethods SET ShortCode = 'UPA' WHERE Name LIKE '%UPA%' AND ShortCode IS NULL;
PRINT 'Populated ShortCode for existing records'
GO

PRINT 'Migration 087 completed successfully'
GO
