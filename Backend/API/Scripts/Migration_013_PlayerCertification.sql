-- Migration Script: Player Certification Feature
-- Date: 2025-12-14
-- Description: Creates tables for player skill certification with peer reviews

USE PickleballCommunity;
GO

PRINT 'Starting Migration_013_PlayerCertification...';
PRINT '';

-- =============================================
-- STEP 1: Create KnowledgeLevels table
-- =============================================
PRINT 'Creating KnowledgeLevels table...';

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('KnowledgeLevels') AND type = 'U')
BEGIN
    CREATE TABLE KnowledgeLevels (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT '  Created KnowledgeLevels table';
END
ELSE
BEGIN
    PRINT '  KnowledgeLevels table already exists';
END
GO

-- =============================================
-- STEP 2: Create SkillAreas table
-- =============================================
PRINT 'Creating SkillAreas table...';

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('SkillAreas') AND type = 'U')
BEGIN
    CREATE TABLE SkillAreas (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        Category NVARCHAR(100) NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT '  Created SkillAreas table';
END
ELSE
BEGIN
    PRINT '  SkillAreas table already exists';
END
GO

-- =============================================
-- STEP 3: Create PlayerCertificationRequests table
-- =============================================
PRINT 'Creating PlayerCertificationRequests table...';

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('PlayerCertificationRequests') AND type = 'U')
BEGIN
    CREATE TABLE PlayerCertificationRequests (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        StudentId INT NOT NULL,
        Token NVARCHAR(64) NOT NULL,
        Message NVARCHAR(1000) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        ExpiresAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_PlayerCertificationRequests_Student FOREIGN KEY (StudentId)
            REFERENCES Users(Id) ON DELETE CASCADE
    );
    PRINT '  Created PlayerCertificationRequests table';
END
ELSE
BEGIN
    PRINT '  PlayerCertificationRequests table already exists';
END
GO

-- =============================================
-- STEP 4: Create PlayerCertificationReviews table
-- =============================================
PRINT 'Creating PlayerCertificationReviews table...';

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('PlayerCertificationReviews') AND type = 'U')
BEGIN
    CREATE TABLE PlayerCertificationReviews (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RequestId INT NOT NULL,
        ReviewerName NVARCHAR(200) NULL,
        ReviewerEmail NVARCHAR(200) NULL,
        KnowledgeLevelId INT NOT NULL,
        IsAnonymous BIT NOT NULL DEFAULT 0,
        Comments NVARCHAR(2000) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_PlayerCertificationReviews_Request FOREIGN KEY (RequestId)
            REFERENCES PlayerCertificationRequests(Id) ON DELETE CASCADE,
        CONSTRAINT FK_PlayerCertificationReviews_KnowledgeLevel FOREIGN KEY (KnowledgeLevelId)
            REFERENCES KnowledgeLevels(Id) ON DELETE NO ACTION
    );
    PRINT '  Created PlayerCertificationReviews table';
END
ELSE
BEGIN
    PRINT '  PlayerCertificationReviews table already exists';
END
GO

-- =============================================
-- STEP 5: Create PlayerCertificationScores table
-- =============================================
PRINT 'Creating PlayerCertificationScores table...';

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('PlayerCertificationScores') AND type = 'U')
BEGIN
    CREATE TABLE PlayerCertificationScores (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ReviewId INT NOT NULL,
        SkillAreaId INT NOT NULL,
        Score INT NOT NULL,

        CONSTRAINT FK_PlayerCertificationScores_Review FOREIGN KEY (ReviewId)
            REFERENCES PlayerCertificationReviews(Id) ON DELETE CASCADE,
        CONSTRAINT FK_PlayerCertificationScores_SkillArea FOREIGN KEY (SkillAreaId)
            REFERENCES SkillAreas(Id) ON DELETE NO ACTION,
        CONSTRAINT CK_PlayerCertificationScores_Score CHECK (Score >= 1 AND Score <= 10)
    );
    PRINT '  Created PlayerCertificationScores table';
END
ELSE
BEGIN
    PRINT '  PlayerCertificationScores table already exists';
END
GO

-- =============================================
-- STEP 6: Create indexes
-- =============================================
PRINT '';
PRINT 'Creating indexes...';

-- Unique index on Token
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PlayerCertificationRequests_Token' AND object_id = OBJECT_ID('PlayerCertificationRequests'))
BEGIN
    CREATE UNIQUE INDEX IX_PlayerCertificationRequests_Token ON PlayerCertificationRequests(Token);
    PRINT '  Created unique index on Token';
END
ELSE
BEGIN
    PRINT '  Index IX_PlayerCertificationRequests_Token already exists';
END

-- Index on StudentId
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PlayerCertificationRequests_StudentId' AND object_id = OBJECT_ID('PlayerCertificationRequests'))
BEGIN
    CREATE INDEX IX_PlayerCertificationRequests_StudentId ON PlayerCertificationRequests(StudentId);
    PRINT '  Created index on StudentId';
END
ELSE
BEGIN
    PRINT '  Index IX_PlayerCertificationRequests_StudentId already exists';
END

-- Index on RequestId for Reviews
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PlayerCertificationReviews_RequestId' AND object_id = OBJECT_ID('PlayerCertificationReviews'))
BEGIN
    CREATE INDEX IX_PlayerCertificationReviews_RequestId ON PlayerCertificationReviews(RequestId);
    PRINT '  Created index on Reviews.RequestId';
END
ELSE
BEGIN
    PRINT '  Index IX_PlayerCertificationReviews_RequestId already exists';
END

-- Index on ReviewId for Scores
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PlayerCertificationScores_ReviewId' AND object_id = OBJECT_ID('PlayerCertificationScores'))
BEGIN
    CREATE INDEX IX_PlayerCertificationScores_ReviewId ON PlayerCertificationScores(ReviewId);
    PRINT '  Created index on Scores.ReviewId';
END
ELSE
BEGIN
    PRINT '  Index IX_PlayerCertificationScores_ReviewId already exists';
END

-- Index on SkillAreaId for Scores
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PlayerCertificationScores_SkillAreaId' AND object_id = OBJECT_ID('PlayerCertificationScores'))
BEGIN
    CREATE INDEX IX_PlayerCertificationScores_SkillAreaId ON PlayerCertificationScores(SkillAreaId);
    PRINT '  Created index on Scores.SkillAreaId';
END
ELSE
BEGIN
    PRINT '  Index IX_PlayerCertificationScores_SkillAreaId already exists';
END
GO

-- =============================================
-- STEP 7: Insert default Knowledge Levels
-- =============================================
PRINT '';
PRINT 'Inserting default Knowledge Levels...';

IF NOT EXISTS (SELECT 1 FROM KnowledgeLevels)
BEGIN
    INSERT INTO KnowledgeLevels (Name, Description, SortOrder, IsActive) VALUES
    ('Just met', 'I have only met this player briefly', 1, 1),
    ('Played a few times', 'I have played with this player a few times', 2, 1),
    ('Regular play partner', 'I play with this player regularly', 3, 1),
    ('Coached or observed extensively', 'I have coached this player or observed them extensively', 4, 1);
    PRINT '  Inserted 4 default knowledge levels';
END
ELSE
BEGIN
    PRINT '  Knowledge levels already exist, skipping seed data';
END
GO

-- =============================================
-- STEP 8: Insert default Skill Areas
-- =============================================
PRINT '';
PRINT 'Inserting default Skill Areas...';

IF NOT EXISTS (SELECT 1 FROM SkillAreas)
BEGIN
    INSERT INTO SkillAreas (Name, Description, Category, SortOrder, IsActive) VALUES
    ('Forehand Drive', 'Power and accuracy of forehand groundstrokes', 'Groundstrokes', 1, 1),
    ('Backhand Drive', 'Power and accuracy of backhand groundstrokes', 'Groundstrokes', 2, 1),
    ('Volley', 'Net play volleys and punch shots', 'Net Play', 3, 1),
    ('Dink', 'Soft game and dink exchanges at the kitchen', 'Net Play', 4, 1),
    ('Serve', 'Serve consistency, placement, and variety', 'Serve & Return', 5, 1),
    ('Return of Serve', 'Return placement and depth', 'Serve & Return', 6, 1),
    ('Third Shot Drop', 'Ability to execute third shot drops', 'Transition', 7, 1),
    ('Lob', 'Offensive and defensive lob execution', 'Specialty Shots', 8, 1),
    ('Overhead', 'Overhead smash power and placement', 'Specialty Shots', 9, 1),
    ('Court Movement', 'Footwork, positioning, and court coverage', 'Athleticism', 10, 1),
    ('Game Strategy', 'Shot selection, pattern recognition, and tactical awareness', 'Mental Game', 11, 1);
    PRINT '  Inserted 11 default skill areas';
END
ELSE
BEGIN
    PRINT '  Skill areas already exist, skipping seed data';
END
GO

-- =============================================
-- STEP 9: Verify changes
-- =============================================
PRINT '';
PRINT 'Verifying changes...';

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('KnowledgeLevels') AND type = 'U')
    PRINT '  KnowledgeLevels table exists';
ELSE
    PRINT '  ERROR: KnowledgeLevels table NOT found';

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('SkillAreas') AND type = 'U')
    PRINT '  SkillAreas table exists';
ELSE
    PRINT '  ERROR: SkillAreas table NOT found';

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('PlayerCertificationRequests') AND type = 'U')
    PRINT '  PlayerCertificationRequests table exists';
ELSE
    PRINT '  ERROR: PlayerCertificationRequests table NOT found';

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('PlayerCertificationReviews') AND type = 'U')
    PRINT '  PlayerCertificationReviews table exists';
ELSE
    PRINT '  ERROR: PlayerCertificationReviews table NOT found';

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('PlayerCertificationScores') AND type = 'U')
    PRINT '  PlayerCertificationScores table exists';
ELSE
    PRINT '  ERROR: PlayerCertificationScores table NOT found';

SELECT 'KnowledgeLevels' AS TableName, COUNT(*) AS RowCount FROM KnowledgeLevels
UNION ALL
SELECT 'SkillAreas', COUNT(*) FROM SkillAreas;

PRINT '';
PRINT 'Migration_013_PlayerCertification completed.';
GO
