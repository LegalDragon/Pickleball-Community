-- Migration 021: Event Types
-- Creates the EventTypes table and seeds initial event types

PRINT 'Starting Migration 021: Event Types';

-- Create EventTypes table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EventTypes')
BEGIN
    PRINT 'Creating EventTypes table...';

    CREATE TABLE EventTypes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(50) NOT NULL,
        Description NVARCHAR(200) NULL,
        Icon NVARCHAR(50) NULL,
        Color NVARCHAR(20) NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT UQ_EventTypes_Name UNIQUE (Name)
    );

    PRINT 'EventTypes table created successfully.';
END
ELSE
BEGIN
    PRINT 'EventTypes table already exists.';
END
GO

-- Create index on Name for faster lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EventTypes_Name')
BEGIN
    PRINT 'Creating index on Name...';
    CREATE INDEX IX_EventTypes_Name ON EventTypes(Name);
    PRINT 'Index created successfully.';
END

-- Create index on SortOrder for ordering
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EventTypes_SortOrder')
BEGIN
    PRINT 'Creating index on SortOrder...';
    CREATE INDEX IX_EventTypes_SortOrder ON EventTypes(SortOrder, IsActive);
    PRINT 'Index created successfully.';
END
GO

-- Seed initial event types if table is empty
IF NOT EXISTS (SELECT 1 FROM EventTypes)
BEGIN
    PRINT 'Seeding initial event types...';

    INSERT INTO EventTypes (Name, Description, Icon, Color, SortOrder, IsActive)
    VALUES
        ('Tournament', 'Competitive tournament play with brackets and prizes', 'trophy', 'yellow', 1, 1),
        ('Rec Play', 'Casual recreational play for all skill levels', 'users', 'green', 2, 1),
        ('Clinic', 'Instructional sessions led by coaches or experienced players', 'book-open', 'blue', 3, 1),
        ('Mini-Match', 'Short competitive matches, usually best of 3 games', 'zap', 'purple', 4, 1),
        ('Party', 'Social events with pickleball and festivities', 'party-popper', 'pink', 5, 1);

    PRINT 'Initial event types seeded successfully.';
END
ELSE
BEGIN
    PRINT 'Event types already exist, skipping seed data.';
END
GO

PRINT 'Migration 021 completed successfully.';
