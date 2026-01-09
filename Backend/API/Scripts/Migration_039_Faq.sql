-- Migration 039: Add FAQ tables (FaqCategories and FaqEntries)
-- This adds FAQ functionality for users to view help content

PRINT 'Starting Migration 039: FAQ';

-- Create FaqCategories table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FaqCategories')
BEGIN
    CREATE TABLE FaqCategories (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        Icon NVARCHAR(50) NULL,
        Color NVARCHAR(20) NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT 'Created FaqCategories table';

    -- Create index on SortOrder
    CREATE INDEX IX_FaqCategories_SortOrder ON FaqCategories(SortOrder);
    PRINT 'Created index on FaqCategories.SortOrder';
END
ELSE
BEGIN
    PRINT 'FaqCategories table already exists';
END

-- Create FaqEntries table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FaqEntries')
BEGIN
    CREATE TABLE FaqEntries (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CategoryId INT NOT NULL,
        Question NVARCHAR(500) NOT NULL,
        Answer NVARCHAR(MAX) NOT NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_FaqEntries_Category FOREIGN KEY (CategoryId)
            REFERENCES FaqCategories(Id) ON DELETE CASCADE
    );
    PRINT 'Created FaqEntries table';

    -- Create indexes
    CREATE INDEX IX_FaqEntries_CategoryId ON FaqEntries(CategoryId);
    CREATE INDEX IX_FaqEntries_SortOrder ON FaqEntries(SortOrder);
    PRINT 'Created indexes on FaqEntries';
END
ELSE
BEGIN
    PRINT 'FaqEntries table already exists';
END

-- Insert sample FAQ data if not exists
IF NOT EXISTS (SELECT 1 FROM FaqCategories WHERE Name = 'Getting Started')
BEGIN
    INSERT INTO FaqCategories (Name, Description, Icon, Color, SortOrder, IsActive, CreatedAt, UpdatedAt)
    VALUES
        ('Getting Started', 'Basic information for new users', 'help-circle', 'blue', 1, 1, GETUTCDATE(), GETUTCDATE()),
        ('Events', 'Questions about events and registration', 'calendar', 'green', 2, 1, GETUTCDATE(), GETUTCDATE()),
        ('Player Certification', 'Questions about skill ratings and certification', 'award', 'purple', 3, 1, GETUTCDATE(), GETUTCDATE()),
        ('Account & Profile', 'Managing your account settings', 'user', 'orange', 4, 1, GETUTCDATE(), GETUTCDATE());
    PRINT 'Inserted default FAQ categories';

    -- Insert sample entries
    DECLARE @GettingStartedId INT = (SELECT Id FROM FaqCategories WHERE Name = 'Getting Started');
    DECLARE @EventsId INT = (SELECT Id FROM FaqCategories WHERE Name = 'Events');
    DECLARE @CertificationId INT = (SELECT Id FROM FaqCategories WHERE Name = 'Player Certification');
    DECLARE @AccountId INT = (SELECT Id FROM FaqCategories WHERE Name = 'Account & Profile');

    INSERT INTO FaqEntries (CategoryId, Question, Answer, SortOrder, IsActive, CreatedAt, UpdatedAt)
    VALUES
        (@GettingStartedId, 'How do I create an account?', 'Click the "Register" button in the top navigation bar. You can sign up with your email address or use phone number authentication.', 1, 1, GETUTCDATE(), GETUTCDATE()),
        (@GettingStartedId, 'Is the app free to use?', 'Yes! Basic features like finding courts, viewing events, and connecting with other players are completely free.', 2, 1, GETUTCDATE(), GETUTCDATE()),
        (@EventsId, 'How do I register for an event?', 'Navigate to the Events page, find an event you are interested in, and click "Register". You may need to select a division if the event has multiple skill levels.', 1, 1, GETUTCDATE(), GETUTCDATE()),
        (@EventsId, 'Can I cancel my event registration?', 'Yes, you can cancel your registration from the event details page before the registration deadline. Refund policies vary by event organizer.', 2, 1, GETUTCDATE(), GETUTCDATE()),
        (@CertificationId, 'What is player certification?', 'Player certification is a peer-reviewed skill rating system. Other players rate your skills across different areas to determine your overall rating.', 1, 1, GETUTCDATE(), GETUTCDATE()),
        (@CertificationId, 'How do I get certified?', 'Go to your dashboard and request a certification. You will need to invite at least 3 players who have played with you to review your skills.', 2, 1, GETUTCDATE(), GETUTCDATE()),
        (@AccountId, 'How do I update my profile?', 'Click on your profile picture in the navigation bar and select "Profile". From there you can edit your information, equipment, and preferences.', 1, 1, GETUTCDATE(), GETUTCDATE()),
        (@AccountId, 'How do I change my password?', 'Go to your Profile settings and look for the security or password section. You can change your password there.', 2, 1, GETUTCDATE(), GETUTCDATE());
    PRINT 'Inserted sample FAQ entries';
END
ELSE
BEGIN
    PRINT 'Sample FAQ data already exists';
END

PRINT 'Completed Migration 039: FAQ';
