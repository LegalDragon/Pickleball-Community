-- =============================================
-- PHASE 1: Restore Users from Feb 5 Backup
-- Database: PickleballCommunity
-- Source: PickleballCommunity2 (restored backup)
-- Date: 2026-02-20
-- =============================================

USE PickleballCommunity;
GO

-- Step 1: Check current state
PRINT 'Current Users count in PickleballCommunity:';
SELECT COUNT(*) AS CurrentUserCount FROM Users;

PRINT 'Users count in backup (PickleballCommunity2):';
SELECT COUNT(*) AS BackupUserCount FROM PickleballCommunity2.dbo.Users;

-- Step 2: Check if Users table exists and has correct schema
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Users')
BEGIN
    PRINT 'ERROR: Users table does not exist! Run migrations first.';
    RETURN;
END

-- Step 3: Check what columns exist in backup vs current
PRINT 'Columns in PickleballCommunity2.Users:';
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM PickleballCommunity2.INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Users'
ORDER BY ORDINAL_POSITION;

-- Step 4: Insert users from backup
-- Using dynamic column list based on what exists in both tables
PRINT 'Restoring users from backup...';

INSERT INTO PickleballCommunity.dbo.Users (
    Id, Email, PasswordHash, Role, FirstName, LastName, RefreshToken, Bio, ProfileImageUrl,
    Gender, DateOfBirth, Phone, Address, City, [State], ZipCode, Country,
    Handedness, ExperienceLevel, PlayingStyle, PaddleBrand, PaddleModel,
    YearsPlaying, TournamentLevel, FavoriteShot, IntroVideo,
    CreatedAt, UpdatedAt, IsActive
)
SELECT 
    Id, Email, PasswordHash, Role, FirstName, LastName, RefreshToken, Bio, ProfileImageUrl,
    Gender, DateOfBirth, Phone, Address, City, [State], ZipCode, Country,
    Handedness, ExperienceLevel, PlayingStyle, PaddleBrand, PaddleModel,
    YearsPlaying, TournamentLevel, FavoriteShot, IntroVideo,
    CreatedAt, UpdatedAt, IsActive
FROM PickleballCommunity2.dbo.Users
WHERE Id NOT IN (SELECT Id FROM PickleballCommunity.dbo.Users);

PRINT 'Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' users from backup';

-- Step 5: Verify
PRINT 'Final Users count:';
SELECT COUNT(*) AS FinalUserCount FROM Users;

PRINT 'Phase 1 complete!';
GO
