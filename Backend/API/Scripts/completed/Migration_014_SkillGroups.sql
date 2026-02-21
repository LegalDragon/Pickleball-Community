-- Migration Script: Skill Groups with Weighted Scoring
-- Date: 2025-12-14
-- Description: Adds SkillGroups table and links SkillAreas to groups for weighted certification scoring

USE PickleballCommunity;
GO

PRINT 'Starting Migration_014_SkillGroups...';
PRINT '';

-- =============================================
-- STEP 1: Create SkillGroups table
-- =============================================
PRINT 'Creating SkillGroups table...';

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('SkillGroups') AND type = 'U')
BEGIN
    CREATE TABLE SkillGroups (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        Weight INT NOT NULL DEFAULT 100 CHECK (Weight >= 0 AND Weight <= 100),
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT '  Created SkillGroups table';
END
ELSE
BEGIN
    PRINT '  SkillGroups table already exists';
END
GO

-- =============================================
-- STEP 2: Add SkillGroupId column to SkillAreas
-- =============================================
PRINT '';
PRINT 'Adding SkillGroupId to SkillAreas...';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('SkillAreas') AND name = 'SkillGroupId')
BEGIN
    ALTER TABLE SkillAreas ADD SkillGroupId INT NULL;

    ALTER TABLE SkillAreas ADD CONSTRAINT FK_SkillAreas_SkillGroup
        FOREIGN KEY (SkillGroupId) REFERENCES SkillGroups(Id) ON DELETE SET NULL;

    PRINT '  Added SkillGroupId column with foreign key';
END
ELSE
BEGIN
    PRINT '  SkillGroupId column already exists';
END
GO

-- =============================================
-- STEP 3: Create indexes
-- =============================================
PRINT '';
PRINT 'Creating indexes...';

-- Index on SortOrder for SkillGroups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SkillGroups_SortOrder' AND object_id = OBJECT_ID('SkillGroups'))
BEGIN
    CREATE INDEX IX_SkillGroups_SortOrder ON SkillGroups(SortOrder);
    PRINT '  Created index on SkillGroups.SortOrder';
END
ELSE
BEGIN
    PRINT '  Index IX_SkillGroups_SortOrder already exists';
END

-- Index on SkillGroupId for SkillAreas
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SkillAreas_SkillGroupId' AND object_id = OBJECT_ID('SkillAreas'))
BEGIN
    CREATE INDEX IX_SkillAreas_SkillGroupId ON SkillAreas(SkillGroupId);
    PRINT '  Created index on SkillAreas.SkillGroupId';
END
ELSE
BEGIN
    PRINT '  Index IX_SkillAreas_SkillGroupId already exists';
END
GO

-- =============================================
-- STEP 4: Verify changes
-- =============================================
PRINT '';
PRINT 'Verifying changes...';

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('SkillGroups') AND type = 'U')
    PRINT '  SkillGroups table exists';
ELSE
    PRINT '  ERROR: SkillGroups table NOT found';

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('SkillAreas') AND name = 'SkillGroupId')
    PRINT '  SkillAreas.SkillGroupId column exists';
ELSE
    PRINT '  ERROR: SkillAreas.SkillGroupId column NOT found';

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SkillGroups_SortOrder' AND object_id = OBJECT_ID('SkillGroups'))
    PRINT '  IX_SkillGroups_SortOrder index exists';
ELSE
    PRINT '  ERROR: IX_SkillGroups_SortOrder index NOT found';

PRINT '';
PRINT 'Migration_014_SkillGroups completed.';
GO
