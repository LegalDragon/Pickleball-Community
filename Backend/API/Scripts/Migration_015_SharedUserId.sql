-- Migration Script: Update Users table for Shared UserId from Funtime-Shared
-- Date: 2025-12-19
-- Description: Removes IDENTITY from Users.Id to allow UserId from shared auth service
-- The UserId will now come from the Funtime-Shared authentication service

USE PickleballCommunity;
GO

-- =============================================
-- STEP 1: Check if migration is needed
-- =============================================
PRINT 'Checking if Users.Id is still IDENTITY...';

IF EXISTS (
    SELECT 1 FROM sys.identity_columns
    WHERE object_id = OBJECT_ID('Users') AND name = 'Id'
)
BEGIN
    PRINT 'Users.Id is IDENTITY - proceeding with migration...';

    -- =============================================
    -- STEP 2: Create temporary table with new schema
    -- =============================================
    PRINT 'Creating temporary Users table without IDENTITY...';

    CREATE TABLE Users_New (
        Id INT PRIMARY KEY,  -- No IDENTITY - UserId from shared auth
        Email NVARCHAR(255) NOT NULL,
        PasswordHash NVARCHAR(MAX) NULL,  -- Nullable, auth handled by shared service
        Role NVARCHAR(50) NOT NULL DEFAULT 'Student',
        FirstName NVARCHAR(100),
        LastName NVARCHAR(100),
        RefreshToken NVARCHAR(MAX),
        Bio NVARCHAR(MAX),
        ProfileImageUrl NVARCHAR(500),

        -- Basic info fields
        Gender NVARCHAR(20),
        DateOfBirth DATETIME2,
        Phone NVARCHAR(20),
        Address NVARCHAR(200),
        City NVARCHAR(100),
        State NVARCHAR(100),
        ZipCode NVARCHAR(20),
        Country NVARCHAR(100),

        -- Pickleball info fields
        Handedness NVARCHAR(10),
        ExperienceLevel NVARCHAR(100),
        PlayingStyle NVARCHAR(100),
        PaddleBrand NVARCHAR(100),
        PaddleModel NVARCHAR(100),
        YearsPlaying INT,
        TournamentLevel NVARCHAR(100),
        FavoriteShot NVARCHAR(100),
        IntroVideo NVARCHAR(500),

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        IsActive BIT NOT NULL DEFAULT 1,

        CONSTRAINT UQ_Users_New_Email UNIQUE (Email),
        CONSTRAINT CK_Users_New_Role CHECK (Role IN ('Coach', 'Student', 'Admin'))
    );

    -- =============================================
    -- STEP 3: Copy existing data
    -- =============================================
    PRINT 'Copying existing user data...';

    SET IDENTITY_INSERT Users_New OFF;  -- Not needed since no IDENTITY

    INSERT INTO Users_New (
        Id, Email, PasswordHash, Role, FirstName, LastName, RefreshToken, Bio, ProfileImageUrl,
        Gender, DateOfBirth, Phone, Address, City, State, ZipCode, Country,
        Handedness, ExperienceLevel, PlayingStyle, PaddleBrand, PaddleModel,
        YearsPlaying, TournamentLevel, FavoriteShot, IntroVideo,
        CreatedAt, UpdatedAt, IsActive
    )
    SELECT
        Id, Email, PasswordHash, Role, FirstName, LastName, RefreshToken, Bio, ProfileImageUrl,
        Gender, DateOfBirth, Phone, Address, City, State, ZipCode, Country,
        Handedness, ExperienceLevel, PlayingStyle, PaddleBrand, PaddleModel,
        YearsPlaying, TournamentLevel, FavoriteShot, IntroVideo,
        CreatedAt, UpdatedAt, IsActive
    FROM Users;

    PRINT 'Copied ' + CAST(@@ROWCOUNT AS VARCHAR) + ' users';

    -- =============================================
    -- STEP 4: Drop foreign key constraints
    -- =============================================
    PRINT 'Dropping foreign key constraints...';

    IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_CoachProfiles_Users')
        ALTER TABLE CoachProfiles DROP CONSTRAINT FK_CoachProfiles_Users;

    IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_TrainingMaterials_Users')
        ALTER TABLE TrainingMaterials DROP CONSTRAINT FK_TrainingMaterials_Users;

    IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_MaterialPurchases_Users')
        ALTER TABLE MaterialPurchases DROP CONSTRAINT FK_MaterialPurchases_Users;

    IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_TrainingSessions_Coach')
        ALTER TABLE TrainingSessions DROP CONSTRAINT FK_TrainingSessions_Coach;

    IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_TrainingSessions_Student')
        ALTER TABLE TrainingSessions DROP CONSTRAINT FK_TrainingSessions_Student;

    -- Drop FK from Ratings table if exists
    IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Ratings_Users')
        ALTER TABLE Ratings DROP CONSTRAINT FK_Ratings_Users;

    -- Drop FK from Tags table if exists
    IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Tags_Users')
        ALTER TABLE Tags DROP CONSTRAINT FK_Tags_Users;

    -- Drop FK from PlayerCertifications table if exists
    IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_PlayerCertifications_Users')
        ALTER TABLE PlayerCertifications DROP CONSTRAINT FK_PlayerCertifications_Users;

    -- Drop FK from PlayerEvaluations table if exists
    IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_PlayerEvaluations_Users')
        ALTER TABLE PlayerEvaluations DROP CONSTRAINT FK_PlayerEvaluations_Users;

    IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_PlayerEvaluations_Evaluator')
        ALTER TABLE PlayerEvaluations DROP CONSTRAINT FK_PlayerEvaluations_Evaluator;

    -- Drop FK from ReviewRequests table if exists
    IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ReviewRequests_Player')
        ALTER TABLE ReviewRequests DROP CONSTRAINT FK_ReviewRequests_Player;

    -- =============================================
    -- STEP 5: Swap tables
    -- =============================================
    PRINT 'Swapping tables...';

    -- Rename old table
    EXEC sp_rename 'Users', 'Users_Old';

    -- Rename new table to Users
    EXEC sp_rename 'Users_New', 'Users';

    -- Rename constraints
    EXEC sp_rename 'UQ_Users_New_Email', 'UQ_Users_Email', 'OBJECT';
    EXEC sp_rename 'CK_Users_New_Role', 'CK_Users_Role', 'OBJECT';

    -- =============================================
    -- STEP 6: Recreate foreign key constraints
    -- =============================================
    PRINT 'Recreating foreign key constraints...';

    ALTER TABLE CoachProfiles ADD CONSTRAINT FK_CoachProfiles_Users
        FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE;

    ALTER TABLE TrainingMaterials ADD CONSTRAINT FK_TrainingMaterials_Users
        FOREIGN KEY (CoachId) REFERENCES Users(Id) ON DELETE NO ACTION;

    ALTER TABLE MaterialPurchases ADD CONSTRAINT FK_MaterialPurchases_Users
        FOREIGN KEY (StudentId) REFERENCES Users(Id) ON DELETE NO ACTION;

    IF OBJECT_ID('TrainingSessions', 'U') IS NOT NULL
    BEGIN
        ALTER TABLE TrainingSessions ADD CONSTRAINT FK_TrainingSessions_Coach
            FOREIGN KEY (CoachId) REFERENCES Users(Id) ON DELETE NO ACTION;

        ALTER TABLE TrainingSessions ADD CONSTRAINT FK_TrainingSessions_Student
            FOREIGN KEY (StudentId) REFERENCES Users(Id) ON DELETE NO ACTION;
    END

    IF OBJECT_ID('Ratings', 'U') IS NOT NULL
    BEGIN
        ALTER TABLE Ratings ADD CONSTRAINT FK_Ratings_Users
            FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE NO ACTION;
    END

    IF OBJECT_ID('Tags', 'U') IS NOT NULL
    BEGIN
        ALTER TABLE Tags ADD CONSTRAINT FK_Tags_Users
            FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE NO ACTION;
    END

    IF OBJECT_ID('PlayerCertifications', 'U') IS NOT NULL
    BEGIN
        ALTER TABLE PlayerCertifications ADD CONSTRAINT FK_PlayerCertifications_Users
            FOREIGN KEY (PlayerId) REFERENCES Users(Id) ON DELETE NO ACTION;
    END

    IF OBJECT_ID('PlayerEvaluations', 'U') IS NOT NULL
    BEGIN
        ALTER TABLE PlayerEvaluations ADD CONSTRAINT FK_PlayerEvaluations_Users
            FOREIGN KEY (PlayerId) REFERENCES Users(Id) ON DELETE NO ACTION;

        ALTER TABLE PlayerEvaluations ADD CONSTRAINT FK_PlayerEvaluations_Evaluator
            FOREIGN KEY (EvaluatorId) REFERENCES Users(Id) ON DELETE NO ACTION;
    END

    IF OBJECT_ID('ReviewRequests', 'U') IS NOT NULL
    BEGIN
        ALTER TABLE ReviewRequests ADD CONSTRAINT FK_ReviewRequests_Player
            FOREIGN KEY (PlayerId) REFERENCES Users(Id) ON DELETE NO ACTION;
    END

    -- =============================================
    -- STEP 7: Drop old table
    -- =============================================
    PRINT 'Dropping old Users table...';
    DROP TABLE Users_Old;

    PRINT 'Migration completed successfully!';
END
ELSE
BEGIN
    PRINT 'Users.Id is already non-IDENTITY - migration not needed.';
END
GO

PRINT 'Migration 015 (SharedUserId) completed!';
GO
