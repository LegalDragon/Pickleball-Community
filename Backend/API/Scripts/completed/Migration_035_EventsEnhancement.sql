-- Migration 035: Events Enhancement
-- Adds TeamUnits, AgeGroups, DivisionRewards tables
-- Updates EventTypes, Events, and EventDivisions

PRINT 'Starting Migration 035: Events Enhancement...'

-- ============================================
-- Create TeamUnits table
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TeamUnits')
BEGIN
    PRINT 'Creating TeamUnits table...'
    CREATE TABLE TeamUnits (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        MaleCount INT NOT NULL DEFAULT 0,
        FemaleCount INT NOT NULL DEFAULT 0,
        UnisexCount INT NOT NULL DEFAULT 0,
        Icon NVARCHAR(50) NULL,
        Color NVARCHAR(20) NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    )
    CREATE INDEX IX_TeamUnits_SortOrder ON TeamUnits(SortOrder)
    PRINT 'TeamUnits table created successfully.'
END
ELSE
    PRINT 'TeamUnits table already exists.'

-- Seed default team units
IF NOT EXISTS (SELECT 1 FROM TeamUnits WHERE Id = 1)
BEGIN
    PRINT 'Seeding default team units...'
    SET IDENTITY_INSERT TeamUnits ON
    INSERT INTO TeamUnits (Id, Name, Description, MaleCount, FemaleCount, UnisexCount, SortOrder, IsActive, CreatedAt, UpdatedAt)
    VALUES
        (1, 'Men''s Singles', 'Single male player', 1, 0, 0, 1, 1, '2024-01-01', '2024-01-01'),
        (2, 'Women''s Singles', 'Single female player', 0, 1, 0, 2, 1, '2024-01-01', '2024-01-01'),
        (3, 'Open Singles', 'Single player of any gender', 0, 0, 1, 3, 1, '2024-01-01', '2024-01-01'),
        (4, 'Men''s Doubles', 'Two male players', 2, 0, 0, 4, 1, '2024-01-01', '2024-01-01'),
        (5, 'Women''s Doubles', 'Two female players', 0, 2, 0, 5, 1, '2024-01-01', '2024-01-01'),
        (6, 'Mixed Doubles', 'One male and one female player', 1, 1, 0, 6, 1, '2024-01-01', '2024-01-01'),
        (7, 'Open Doubles', 'Two players of any gender', 0, 0, 2, 7, 1, '2024-01-01', '2024-01-01')
    SET IDENTITY_INSERT TeamUnits OFF
    PRINT 'Default team units seeded.'
END

-- ============================================
-- Create AgeGroups table
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AgeGroups')
BEGIN
    PRINT 'Creating AgeGroups table...'
    CREATE TABLE AgeGroups (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        MinAge INT NULL,
        MaxAge INT NULL,
        Icon NVARCHAR(50) NULL,
        Color NVARCHAR(20) NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    )
    CREATE INDEX IX_AgeGroups_SortOrder ON AgeGroups(SortOrder)
    PRINT 'AgeGroups table created successfully.'
END
ELSE
    PRINT 'AgeGroups table already exists.'

-- Seed default age groups
IF NOT EXISTS (SELECT 1 FROM AgeGroups WHERE Id = 1)
BEGIN
    PRINT 'Seeding default age groups...'
    SET IDENTITY_INSERT AgeGroups ON
    INSERT INTO AgeGroups (Id, Name, Description, MinAge, MaxAge, SortOrder, IsActive, CreatedAt, UpdatedAt)
    VALUES
        (1, 'Open', 'All ages welcome', NULL, NULL, 1, 1, '2024-01-01', '2024-01-01'),
        (2, 'Junior (Under 18)', 'Players under 18 years old', NULL, 17, 2, 1, '2024-01-01', '2024-01-01'),
        (3, 'Adult (18-49)', 'Players 18-49 years old', 18, 49, 3, 1, '2024-01-01', '2024-01-01'),
        (4, 'Senior 50+', 'Players 50 years and older', 50, NULL, 4, 1, '2024-01-01', '2024-01-01'),
        (5, 'Senior 60+', 'Players 60 years and older', 60, NULL, 5, 1, '2024-01-01', '2024-01-01'),
        (6, 'Senior 70+', 'Players 70 years and older', 70, NULL, 6, 1, '2024-01-01', '2024-01-01')
    SET IDENTITY_INSERT AgeGroups OFF
    PRINT 'Default age groups seeded.'
END

-- ============================================
-- Create DivisionRewards table
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'DivisionRewards')
BEGIN
    PRINT 'Creating DivisionRewards table...'
    CREATE TABLE DivisionRewards (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        DivisionId INT NOT NULL,
        Placement INT NOT NULL,
        RewardType NVARCHAR(50) NOT NULL DEFAULT 'Medal',
        CashAmount DECIMAL(10,2) NULL,
        Description NVARCHAR(200) NULL,
        Icon NVARCHAR(50) NULL,
        Color NVARCHAR(20) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CONSTRAINT FK_DivisionRewards_Division FOREIGN KEY (DivisionId) REFERENCES EventDivisions(Id) ON DELETE CASCADE
    )
    CREATE INDEX IX_DivisionRewards_DivisionId_Placement ON DivisionRewards(DivisionId, Placement)
    PRINT 'DivisionRewards table created successfully.'
END
ELSE
    PRINT 'DivisionRewards table already exists.'

-- ============================================
-- Update EventTypes table
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EventTypes' AND COLUMN_NAME = 'AllowMultipleDivisions')
BEGIN
    PRINT 'Adding AllowMultipleDivisions column to EventTypes...'
    ALTER TABLE EventTypes ADD AllowMultipleDivisions BIT NOT NULL DEFAULT 1
    PRINT 'AllowMultipleDivisions column added.'
END
ELSE
    PRINT 'AllowMultipleDivisions column already exists in EventTypes.'

-- ============================================
-- Update Events table
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Events' AND COLUMN_NAME = 'IsPrivate')
BEGIN
    PRINT 'Adding IsPrivate column to Events...'
    ALTER TABLE Events ADD IsPrivate BIT NOT NULL DEFAULT 0
    PRINT 'IsPrivate column added.'
END
ELSE
    PRINT 'IsPrivate column already exists in Events.'

-- ============================================
-- Update EventDivisions table
-- ============================================

-- Add TeamUnitId column
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EventDivisions' AND COLUMN_NAME = 'TeamUnitId')
BEGIN
    PRINT 'Adding TeamUnitId column to EventDivisions...'
    ALTER TABLE EventDivisions ADD TeamUnitId INT NULL
    ALTER TABLE EventDivisions ADD CONSTRAINT FK_EventDivisions_TeamUnit FOREIGN KEY (TeamUnitId) REFERENCES TeamUnits(Id) ON DELETE SET NULL
    PRINT 'TeamUnitId column added.'
END
ELSE
    PRINT 'TeamUnitId column already exists in EventDivisions.'

-- Add AgeGroupId column
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EventDivisions' AND COLUMN_NAME = 'AgeGroupId')
BEGIN
    PRINT 'Adding AgeGroupId column to EventDivisions...'
    ALTER TABLE EventDivisions ADD AgeGroupId INT NULL
    ALTER TABLE EventDivisions ADD CONSTRAINT FK_EventDivisions_AgeGroup FOREIGN KEY (AgeGroupId) REFERENCES AgeGroups(Id) ON DELETE SET NULL
    PRINT 'AgeGroupId column added.'
END
ELSE
    PRINT 'AgeGroupId column already exists in EventDivisions.'

-- Add MinSkillRating column
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EventDivisions' AND COLUMN_NAME = 'MinSkillRating')
BEGIN
    PRINT 'Adding MinSkillRating column to EventDivisions...'
    ALTER TABLE EventDivisions ADD MinSkillRating DECIMAL(4,2) NULL
    PRINT 'MinSkillRating column added.'
END
ELSE
    PRINT 'MinSkillRating column already exists in EventDivisions.'

-- Add MaxSkillRating column
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EventDivisions' AND COLUMN_NAME = 'MaxSkillRating')
BEGIN
    PRINT 'Adding MaxSkillRating column to EventDivisions...'
    ALTER TABLE EventDivisions ADD MaxSkillRating DECIMAL(4,2) NULL
    PRINT 'MaxSkillRating column added.'
END
ELSE
    PRINT 'MaxSkillRating column already exists in EventDivisions.'

-- Add MaxUnits column
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EventDivisions' AND COLUMN_NAME = 'MaxUnits')
BEGIN
    PRINT 'Adding MaxUnits column to EventDivisions...'
    ALTER TABLE EventDivisions ADD MaxUnits INT NULL
    PRINT 'MaxUnits column added.'
END
ELSE
    PRINT 'MaxUnits column already exists in EventDivisions.'

-- ============================================
-- Migrate existing division data to new structure
-- ============================================
PRINT 'Migrating existing division data...'

-- Set TeamUnitId based on existing Gender and TeamSize
UPDATE EventDivisions
SET TeamUnitId = CASE
    WHEN Gender = 'Men' AND TeamSize = 1 THEN 1      -- Men's Singles
    WHEN Gender = 'Women' AND TeamSize = 1 THEN 2   -- Women's Singles
    WHEN Gender = 'Open' AND TeamSize = 1 THEN 3    -- Open Singles
    WHEN Gender = 'Men' AND TeamSize = 2 THEN 4     -- Men's Doubles
    WHEN Gender = 'Women' AND TeamSize = 2 THEN 5   -- Women's Doubles
    WHEN Gender = 'Mixed' AND TeamSize = 2 THEN 6   -- Mixed Doubles
    WHEN Gender = 'Open' AND TeamSize = 2 THEN 7    -- Open Doubles
    ELSE NULL
END
WHERE TeamUnitId IS NULL AND Gender IS NOT NULL

-- Set AgeGroupId based on existing AgeGroup string
UPDATE EventDivisions
SET AgeGroupId = CASE
    WHEN AgeGroup = 'Open' THEN 1
    WHEN AgeGroup = 'Junior' THEN 2
    WHEN AgeGroup = 'Adult' THEN 3
    WHEN AgeGroup LIKE '%50%' THEN 4
    WHEN AgeGroup LIKE '%60%' THEN 5
    WHEN AgeGroup LIKE '%70%' THEN 6
    ELSE 1 -- Default to Open
END
WHERE AgeGroupId IS NULL AND AgeGroup IS NOT NULL

-- Copy MaxTeams to MaxUnits
UPDATE EventDivisions
SET MaxUnits = MaxTeams
WHERE MaxUnits IS NULL AND MaxTeams IS NOT NULL

-- Parse SkillLevelMin to MinSkillRating
UPDATE EventDivisions
SET MinSkillRating = TRY_CAST(SkillLevelMin AS DECIMAL(4,2))
WHERE MinSkillRating IS NULL AND SkillLevelMin IS NOT NULL

-- Parse SkillLevelMax to MaxSkillRating
UPDATE EventDivisions
SET MaxSkillRating = TRY_CAST(SkillLevelMax AS DECIMAL(4,2))
WHERE MaxSkillRating IS NULL AND SkillLevelMax IS NOT NULL

PRINT 'Migration 035: Events Enhancement completed successfully.'
