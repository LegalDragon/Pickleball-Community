-- Migration Script: Add Ratings Table
-- Date: 2025-12-10
-- Description: Adds Ratings table to support 5-star ratings for Materials, Coaches, and Courses

USE PickleballCommunity;
GO

-- =============================================
-- STEP 1: Create Ratings table
-- =============================================
PRINT 'Creating Ratings table...';

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Ratings')
BEGIN
    CREATE TABLE Ratings (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        RatableType NVARCHAR(50) NOT NULL, -- 'Material', 'Coach', 'Course'
        RatableId INT NOT NULL,
        Stars INT NOT NULL CHECK (Stars >= 1 AND Stars <= 5),
        Review NVARCHAR(1000),
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_Ratings_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT UQ_Ratings_User_Ratable UNIQUE (UserId, RatableType, RatableId)
    );

    CREATE INDEX IX_Ratings_UserId ON Ratings(UserId);
    CREATE INDEX IX_Ratings_Ratable ON Ratings(RatableType, RatableId);

    PRINT 'Ratings table created successfully.';
END
ELSE
BEGIN
    PRINT 'Ratings table already exists.';
END
GO

-- =============================================
-- STEP 2: Verify table was created
-- =============================================
PRINT '';
PRINT 'Verifying table creation...';

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Ratings')
    PRINT 'Ratings table exists';
ELSE
    PRINT 'Ratings table NOT found';

PRINT '';
PRINT 'Migration_006_Ratings completed.';
GO
