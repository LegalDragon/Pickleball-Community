-- Migration 049: Score Methods
-- Adds admin-configurable scoring method types for event divisions

PRINT 'Starting Migration 049: Score Methods'

-- Create ScoreMethods table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ScoreMethods')
BEGIN
    CREATE TABLE ScoreMethods (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(1000) NULL,
        BaseType NVARCHAR(20) NOT NULL DEFAULT 'Rally',
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        IsDefault BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    )
    PRINT 'Created ScoreMethods table'
END
ELSE
BEGIN
    PRINT 'ScoreMethods table already exists'
END

-- Create indexes for ScoreMethods
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ScoreMethods_SortOrder')
BEGIN
    CREATE INDEX IX_ScoreMethods_SortOrder ON ScoreMethods(SortOrder)
    PRINT 'Created index IX_ScoreMethods_SortOrder'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ScoreMethods_IsActive')
BEGIN
    CREATE INDEX IX_ScoreMethods_IsActive ON ScoreMethods(IsActive)
    PRINT 'Created index IX_ScoreMethods_IsActive'
END

-- Add ScoreMethodId column to ScoreFormats
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ScoreFormats') AND name = 'ScoreMethodId')
BEGIN
    ALTER TABLE ScoreFormats ADD ScoreMethodId INT NULL
    PRINT 'Added ScoreMethodId column to ScoreFormats'
END

-- Add CapAfter column to ScoreFormats
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ScoreFormats') AND name = 'CapAfter')
BEGIN
    ALTER TABLE ScoreFormats ADD CapAfter INT NOT NULL DEFAULT 0
    PRINT 'Added CapAfter column to ScoreFormats'
END

-- Add foreign key for ScoreMethodId
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ScoreFormats_ScoreMethod')
BEGIN
    ALTER TABLE ScoreFormats ADD CONSTRAINT FK_ScoreFormats_ScoreMethod
        FOREIGN KEY (ScoreMethodId) REFERENCES ScoreMethods(Id) ON DELETE SET NULL
    PRINT 'Created foreign key FK_ScoreFormats_ScoreMethod'
END

-- Insert default score methods
IF NOT EXISTS (SELECT * FROM ScoreMethods WHERE Name = 'Rally Score')
BEGIN
    INSERT INTO ScoreMethods (Name, Description, BaseType, SortOrder, IsActive, IsDefault) VALUES
    ('Rally Score', 'Rally scoring where a point is scored on every serve. Games are typically played to 11, win by 2.', 'Rally', 1, 1, 1)
    PRINT 'Inserted Rally Score method'
END

IF NOT EXISTS (SELECT * FROM ScoreMethods WHERE Name = 'Classic Side Out Score')
BEGIN
    INSERT INTO ScoreMethods (Name, Description, BaseType, SortOrder, IsActive, IsDefault) VALUES
    ('Classic Side Out Score', 'Traditional side-out scoring where only the serving team can score points. Games are typically played to 11, win by 2.', 'Classic', 2, 1, 0)
    PRINT 'Inserted Classic Side Out Score method'
END

IF NOT EXISTS (SELECT * FROM ScoreMethods WHERE Name = 'UPA Rally Score')
BEGIN
    INSERT INTO ScoreMethods (Name, Description, BaseType, SortOrder, IsActive, IsDefault) VALUES
    ('UPA Rally Score', 'USA Pickleball Association rally scoring format. Rally scoring with specific timeout and freeze rules as defined by UPA tournament guidelines.', 'Rally', 3, 1, 0)
    PRINT 'Inserted UPA Rally Score method'
END

IF NOT EXISTS (SELECT * FROM ScoreMethods WHERE Name = 'MLP Rally Score')
BEGIN
    INSERT INTO ScoreMethods (Name, Description, BaseType, SortOrder, IsActive, IsDefault) VALUES
    ('MLP Rally Score', 'Major League Pickleball rally scoring format. Games played to 21 with rally scoring and specific freeze rules.', 'Rally', 4, 1, 0)
    PRINT 'Inserted MLP Rally Score method'
END

PRINT 'Migration 049 completed successfully'
