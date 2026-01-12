-- Migration 040: Feedback System
-- Creates tables for feedback categories and entries

PRINT 'Starting Migration 040: Feedback System';

-- Create FeedbackCategories table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FeedbackCategories')
BEGIN
    CREATE TABLE FeedbackCategories (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        Icon NVARCHAR(50) NULL,
        Color NVARCHAR(50) NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT 'Created FeedbackCategories table';
END
ELSE
BEGIN
    PRINT 'FeedbackCategories table already exists';
END
GO

-- Create FeedbackEntries table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FeedbackEntries')
BEGIN
    CREATE TABLE FeedbackEntries (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CategoryId INT NOT NULL,
        Subject NVARCHAR(200) NOT NULL,
        Message NVARCHAR(MAX) NOT NULL,
        UserEmail NVARCHAR(255) NULL,
        UserName NVARCHAR(100) NULL,
        UserId INT NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'New',
        AdminNotes NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_FeedbackEntries_Category FOREIGN KEY (CategoryId)
            REFERENCES FeedbackCategories(Id) ON DELETE CASCADE,
        CONSTRAINT FK_FeedbackEntries_User FOREIGN KEY (UserId)
            REFERENCES Users(Id) ON DELETE SET NULL
    );
    PRINT 'Created FeedbackEntries table';
END
ELSE
BEGIN
    PRINT 'FeedbackEntries table already exists';
END
GO

-- Create indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FeedbackCategories_SortOrder')
BEGIN
    CREATE INDEX IX_FeedbackCategories_SortOrder ON FeedbackCategories(SortOrder);
    PRINT 'Created IX_FeedbackCategories_SortOrder index';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FeedbackEntries_CategoryId')
BEGIN
    CREATE INDEX IX_FeedbackEntries_CategoryId ON FeedbackEntries(CategoryId);
    PRINT 'Created IX_FeedbackEntries_CategoryId index';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FeedbackEntries_Status')
BEGIN
    CREATE INDEX IX_FeedbackEntries_Status ON FeedbackEntries(Status);
    PRINT 'Created IX_FeedbackEntries_Status index';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FeedbackEntries_CreatedAt')
BEGIN
    CREATE INDEX IX_FeedbackEntries_CreatedAt ON FeedbackEntries(CreatedAt);
    PRINT 'Created IX_FeedbackEntries_CreatedAt index';
END
GO

-- Seed default feedback categories
IF NOT EXISTS (SELECT 1 FROM FeedbackCategories WHERE Name = 'Bug Report')
BEGIN
    INSERT INTO FeedbackCategories (Name, Description, Icon, Color, SortOrder, IsActive)
    VALUES
        ('Bug Report', 'Report a bug or technical issue', 'Bug', 'red', 1, 1),
        ('Feature Request', 'Suggest a new feature or improvement', 'Lightbulb', 'yellow', 2, 1),
        ('General Feedback', 'Share your thoughts and suggestions', 'MessageSquare', 'blue', 3, 1),
        ('Account Issue', 'Problems with your account or login', 'User', 'orange', 4, 1),
        ('Other', 'Anything else not covered above', 'HelpCircle', 'gray', 5, 1);
    PRINT 'Inserted default feedback categories';
END
ELSE
BEGIN
    PRINT 'Default feedback categories already exist';
END
GO

PRINT 'Migration 040 completed successfully';
