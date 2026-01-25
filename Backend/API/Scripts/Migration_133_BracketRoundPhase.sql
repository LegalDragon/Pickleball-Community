-- Migration 133: BracketRound Phase Type Support
-- Adds support for fine-grained bracket phases (Semifinal, Final as separate phases)
-- with consolation matches and snake seeding from pools
-- Run: sqlcmd -S localhost -d PickleballCommunity -i Migration_133_BracketRoundPhase.sql

PRINT 'Starting Migration 133: BracketRound Phase Type Support';

-- Add IncludeConsolation column to DivisionPhases
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DivisionPhases') AND name = 'IncludeConsolation')
BEGIN
    ALTER TABLE DivisionPhases ADD IncludeConsolation BIT NOT NULL DEFAULT 0;
    PRINT 'Added IncludeConsolation column to DivisionPhases';
END
ELSE
    PRINT 'IncludeConsolation column already exists';

-- Add SeedingStrategy column to DivisionPhases
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DivisionPhases') AND name = 'SeedingStrategy')
BEGIN
    ALTER TABLE DivisionPhases ADD SeedingStrategy NVARCHAR(30) NULL DEFAULT 'Snake';
    PRINT 'Added SeedingStrategy column to DivisionPhases';
END
ELSE
    PRINT 'SeedingStrategy column already exists';

PRINT 'Migration 133 completed successfully';
GO
