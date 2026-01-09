-- Migration Script: Add Course Management Tables
-- Date: 2025-12-10
-- Description: Adds Courses, CourseMaterials, and CoursePurchases tables
--              to support course bundling of training materials

USE PickleballCommunity;
GO

-- =============================================
-- STEP 1: Create Courses table
-- =============================================
PRINT 'Creating Courses table...';

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Courses')
BEGIN
    CREATE TABLE Courses (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CoachId INT NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Description NVARCHAR(2000),
        ThumbnailUrl NVARCHAR(500),
        Price DECIMAL(10,2) NOT NULL DEFAULT 0,
        IsPublished BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_Courses_Users FOREIGN KEY (CoachId) REFERENCES Users(Id) ON DELETE NO ACTION
    );

    CREATE INDEX IX_Courses_CoachId ON Courses(CoachId);
    CREATE INDEX IX_Courses_IsPublished ON Courses(IsPublished);

    PRINT 'Courses table created successfully.';
END
ELSE
BEGIN
    PRINT 'Courses table already exists.';
END
GO

-- =============================================
-- STEP 2: Create CourseMaterials junction table
-- =============================================
PRINT 'Creating CourseMaterials table...';

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CourseMaterials')
BEGIN
    CREATE TABLE CourseMaterials (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CourseId INT NOT NULL,
        MaterialId INT NOT NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsPreview BIT NOT NULL DEFAULT 0,

        CONSTRAINT FK_CourseMaterials_Courses FOREIGN KEY (CourseId) REFERENCES Courses(Id) ON DELETE CASCADE,
        CONSTRAINT FK_CourseMaterials_Materials FOREIGN KEY (MaterialId) REFERENCES TrainingMaterials(Id) ON DELETE NO ACTION,
        CONSTRAINT UQ_CourseMaterials_CourseId_MaterialId UNIQUE (CourseId, MaterialId)
    );

    CREATE INDEX IX_CourseMaterials_CourseId ON CourseMaterials(CourseId);
    CREATE INDEX IX_CourseMaterials_MaterialId ON CourseMaterials(MaterialId);
    CREATE INDEX IX_CourseMaterials_SortOrder ON CourseMaterials(CourseId, SortOrder);

    PRINT 'CourseMaterials table created successfully.';
END
ELSE
BEGIN
    PRINT 'CourseMaterials table already exists.';
END
GO

-- =============================================
-- STEP 3: Create CoursePurchases table
-- =============================================
PRINT 'Creating CoursePurchases table...';

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CoursePurchases')
BEGIN
    CREATE TABLE CoursePurchases (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CourseId INT NOT NULL,
        StudentId INT NOT NULL,
        PurchasePrice DECIMAL(10,2) NOT NULL,
        PlatformFee DECIMAL(10,2) NOT NULL,
        CoachEarnings DECIMAL(10,2) NOT NULL,
        StripePaymentIntentId NVARCHAR(255),
        PurchasedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_CoursePurchases_Courses FOREIGN KEY (CourseId) REFERENCES Courses(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_CoursePurchases_Users FOREIGN KEY (StudentId) REFERENCES Users(Id) ON DELETE NO ACTION,
        CONSTRAINT UQ_CoursePurchases_CourseId_StudentId UNIQUE (CourseId, StudentId)
    );

    CREATE INDEX IX_CoursePurchases_CourseId ON CoursePurchases(CourseId);
    CREATE INDEX IX_CoursePurchases_StudentId ON CoursePurchases(StudentId);
    CREATE INDEX IX_CoursePurchases_PurchasedAt ON CoursePurchases(PurchasedAt);

    PRINT 'CoursePurchases table created successfully.';
END
ELSE
BEGIN
    PRINT 'CoursePurchases table already exists.';
END
GO

-- =============================================
-- STEP 4: Verify tables were created
-- =============================================
PRINT '';
PRINT 'Verifying table creation...';

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Courses')
    PRINT '✓ Courses table exists';
ELSE
    PRINT '✗ Courses table NOT found';

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'CourseMaterials')
    PRINT '✓ CourseMaterials table exists';
ELSE
    PRINT '✗ CourseMaterials table NOT found';

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'CoursePurchases')
    PRINT '✓ CoursePurchases table exists';
ELSE
    PRINT '✗ CoursePurchases table NOT found';

PRINT '';
PRINT 'Migration_005_Courses completed.';
GO
