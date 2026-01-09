-- Migration 031: Court Types
-- Adds court type categorization (Public, Private, Commercial, etc.)

PRINT 'Starting Migration 031: Court Types'
GO

-- Create CourtTypes table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CourtTypes')
BEGIN
    CREATE TABLE CourtTypes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(50) NOT NULL,
        Description NVARCHAR(200) NULL,
        Icon NVARCHAR(50) NULL,
        Color NVARCHAR(20) NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    )
    PRINT 'Created CourtTypes table'
END
ELSE
BEGIN
    PRINT 'CourtTypes table already exists'
END
GO

-- Add index on SortOrder
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CourtTypes_SortOrder' AND object_id = OBJECT_ID('CourtTypes'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_CourtTypes_SortOrder ON CourtTypes(SortOrder)
    PRINT 'Created index IX_CourtTypes_SortOrder'
END
GO

-- Add CourtTypeId column to Courts table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Courts') AND name = 'CourtTypeId')
BEGIN
    ALTER TABLE Courts ADD CourtTypeId INT NULL
    PRINT 'Added CourtTypeId column to Courts table'
END
ELSE
BEGIN
    PRINT 'CourtTypeId column already exists in Courts table'
END
GO

-- Add foreign key constraint
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Courts_CourtTypes')
BEGIN
    ALTER TABLE Courts
    ADD CONSTRAINT FK_Courts_CourtTypes
    FOREIGN KEY (CourtTypeId) REFERENCES CourtTypes(Id)
    ON DELETE SET NULL
    PRINT 'Added foreign key FK_Courts_CourtTypes'
END
ELSE
BEGIN
    PRINT 'Foreign key FK_Courts_CourtTypes already exists'
END
GO

-- Add index on CourtTypeId
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Courts_CourtTypeId' AND object_id = OBJECT_ID('Courts'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Courts_CourtTypeId ON Courts(CourtTypeId)
    PRINT 'Created index IX_Courts_CourtTypeId'
END
GO

-- Seed default court types
IF NOT EXISTS (SELECT * FROM CourtTypes WHERE Name = 'Public')
BEGIN
    INSERT INTO CourtTypes (Name, Description, Icon, Color, SortOrder, IsActive, CreatedAt, UpdatedAt)
    VALUES
        ('Public', 'Public courts open to everyone, often in parks or recreation centers', 'Users', 'green', 1, 1, GETUTCDATE(), GETUTCDATE()),
        ('Private', 'Private courts with restricted access, typically member-only', 'Lock', 'blue', 2, 1, GETUTCDATE(), GETUTCDATE()),
        ('Mixed-Use', 'Courts that serve both public and private purposes with varying access times', 'Shuffle', 'purple', 3, 1, GETUTCDATE(), GETUTCDATE()),
        ('Commercial', 'Courts at commercial facilities, gyms, or pay-to-play venues', 'Building2', 'orange', 4, 1, GETUTCDATE(), GETUTCDATE()),
        ('Community', 'Community-owned courts, often managed by HOAs or neighborhood associations', 'Home', 'teal', 5, 1, GETUTCDATE(), GETUTCDATE()),
        ('School/University', 'Courts located at educational institutions', 'GraduationCap', 'indigo', 6, 1, GETUTCDATE(), GETUTCDATE()),
        ('Resort/Hotel', 'Courts at resorts, hotels, or vacation properties', 'Palmtree', 'yellow', 7, 1, GETUTCDATE(), GETUTCDATE())
    PRINT 'Seeded default court types'
END
ELSE
BEGIN
    PRINT 'Court types already seeded'
END
GO

PRINT 'Migration 031: Court Types completed'
GO
