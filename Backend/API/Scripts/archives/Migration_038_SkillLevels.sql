-- Migration 038: Add SkillLevels table and EventDivision.SkillLevelId
-- This adds admin-managed skill levels for event divisions

PRINT 'Starting Migration 038: SkillLevels';

-- Create SkillLevels table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SkillLevels')
BEGIN
    CREATE TABLE SkillLevels (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(50) NOT NULL,
        Description NVARCHAR(200) NULL,
        Value DECIMAL(4,2) NULL,
        Icon NVARCHAR(50) NULL,
        Color NVARCHAR(20) NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT 'Created SkillLevels table';

    -- Create index on SortOrder
    CREATE INDEX IX_SkillLevels_SortOrder ON SkillLevels(SortOrder);
    PRINT 'Created index on SkillLevels.SortOrder';
END
ELSE
BEGIN
    PRINT 'SkillLevels table already exists';
END

-- Insert default skill levels if not exists
IF NOT EXISTS (SELECT 1 FROM SkillLevels WHERE Name = '2.0')
BEGIN
    INSERT INTO SkillLevels (Name, Description, Value, SortOrder, IsActive, CreatedAt, UpdatedAt)
    VALUES
        ('2.0', 'Beginner', 2.0, 1, 1, GETUTCDATE(), GETUTCDATE()),
        ('2.5', 'Beginner+', 2.5, 2, 1, GETUTCDATE(), GETUTCDATE()),
        ('3.0', 'Intermediate', 3.0, 3, 1, GETUTCDATE(), GETUTCDATE()),
        ('3.5', 'Intermediate+', 3.5, 4, 1, GETUTCDATE(), GETUTCDATE()),
        ('4.0', 'Advanced', 4.0, 5, 1, GETUTCDATE(), GETUTCDATE()),
        ('4.5', 'Advanced+', 4.5, 6, 1, GETUTCDATE(), GETUTCDATE()),
        ('5.0', 'Expert', 5.0, 7, 1, GETUTCDATE(), GETUTCDATE()),
        ('5.5+', 'Pro/Tour', 5.5, 8, 1, GETUTCDATE(), GETUTCDATE()),
        ('Open', 'All skill levels welcome', NULL, 9, 1, GETUTCDATE(), GETUTCDATE());
    PRINT 'Inserted default skill levels';
END
ELSE
BEGIN
    PRINT 'Default skill levels already exist';
END

-- Add SkillLevelId column to EventDivisions if not exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('EventDivisions') AND name = 'SkillLevelId')
BEGIN
    ALTER TABLE EventDivisions ADD SkillLevelId INT NULL;
    PRINT 'Added SkillLevelId column to EventDivisions';

    -- Add foreign key constraint
    ALTER TABLE EventDivisions
    ADD CONSTRAINT FK_EventDivisions_SkillLevel
    FOREIGN KEY (SkillLevelId) REFERENCES SkillLevels(Id)
    ON DELETE SET NULL;
    PRINT 'Added foreign key constraint for SkillLevelId';
END
ELSE
BEGIN
    PRINT 'EventDivisions.SkillLevelId column already exists';
END

PRINT 'Completed Migration 038: SkillLevels';
