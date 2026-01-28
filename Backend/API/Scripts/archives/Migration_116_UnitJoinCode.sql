-- Migration 116: Add JoinMethod and JoinCode to EventUnits
-- Supports two ways for partners to join a team:
-- 1. Approval-based: Captain approves join requests (existing flow)
-- 2. Code-based: Captain shares a code with their partner for direct joining

PRINT 'Starting Migration 116 - Unit Join Code'
GO

-- Add JoinMethod column (Approval or Code)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnits') AND name = 'JoinMethod')
BEGIN
    ALTER TABLE EventUnits ADD JoinMethod NVARCHAR(20) NOT NULL DEFAULT 'Approval'
    PRINT 'Added JoinMethod to EventUnits'
END
GO

-- Add JoinCode column (short code for code-based joining)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnits') AND name = 'JoinCode')
BEGIN
    ALTER TABLE EventUnits ADD JoinCode NVARCHAR(10) NULL
    PRINT 'Added JoinCode to EventUnits'
END
GO

-- Create index on JoinCode for fast lookups
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventUnits_JoinCode' AND object_id = OBJECT_ID('EventUnits'))
BEGIN
    CREATE INDEX IX_EventUnits_JoinCode ON EventUnits(JoinCode) WHERE JoinCode IS NOT NULL
    PRINT 'Created IX_EventUnits_JoinCode index'
END
GO

PRINT 'Migration 116 - Unit Join Code completed successfully'
GO
