-- Migration Script: Add User Profile Fields
-- Date: 2025-12-09
-- Description: Adds basic info and pickleball profile fields to Users table

USE PickleballCommunity;
GO

-- =============================================
-- Add Basic Info Fields to Users Table
-- =============================================
PRINT 'Adding basic info fields to Users table...';

-- Gender
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Gender')
BEGIN
    ALTER TABLE Users ADD Gender NVARCHAR(20) NULL;
    PRINT 'Added Gender column';
END

-- DateOfBirth
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'DateOfBirth')
BEGIN
    ALTER TABLE Users ADD DateOfBirth DATE NULL;
    PRINT 'Added DateOfBirth column';
END

-- Phone
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Phone')
BEGIN
    ALTER TABLE Users ADD Phone NVARCHAR(20) NULL;
    PRINT 'Added Phone column';
END

-- Address
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Address')
BEGIN
    ALTER TABLE Users ADD Address NVARCHAR(200) NULL;
    PRINT 'Added Address column';
END

-- City
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'City')
BEGIN
    ALTER TABLE Users ADD City NVARCHAR(100) NULL;
    PRINT 'Added City column';
END

-- State
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'State')
BEGIN
    ALTER TABLE Users ADD [State] NVARCHAR(100) NULL;
    PRINT 'Added State column';
END

-- ZipCode
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'ZipCode')
BEGIN
    ALTER TABLE Users ADD ZipCode NVARCHAR(20) NULL;
    PRINT 'Added ZipCode column';
END

-- Country
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Country')
BEGIN
    ALTER TABLE Users ADD Country NVARCHAR(100) NULL;
    PRINT 'Added Country column';
END
GO

-- =============================================
-- Add Pickleball Info Fields to Users Table
-- =============================================
PRINT 'Adding pickleball info fields to Users table...';

-- Handedness
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Handedness')
BEGIN
    ALTER TABLE Users ADD Handedness NVARCHAR(10) NULL;
    PRINT 'Added Handedness column';
END

-- ExperienceLevel
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'ExperienceLevel')
BEGIN
    ALTER TABLE Users ADD ExperienceLevel NVARCHAR(100) NULL;
    PRINT 'Added ExperienceLevel column';
END

-- PlayingStyle
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PlayingStyle')
BEGIN
    ALTER TABLE Users ADD PlayingStyle NVARCHAR(100) NULL;
    PRINT 'Added PlayingStyle column';
END

-- PaddleBrand
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PaddleBrand')
BEGIN
    ALTER TABLE Users ADD PaddleBrand NVARCHAR(100) NULL;
    PRINT 'Added PaddleBrand column';
END

-- PaddleModel
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PaddleModel')
BEGIN
    ALTER TABLE Users ADD PaddleModel NVARCHAR(100) NULL;
    PRINT 'Added PaddleModel column';
END

-- YearsPlaying
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'YearsPlaying')
BEGIN
    ALTER TABLE Users ADD YearsPlaying INT NULL;
    PRINT 'Added YearsPlaying column';
END

-- TournamentLevel
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'TournamentLevel')
BEGIN
    ALTER TABLE Users ADD TournamentLevel NVARCHAR(100) NULL;
    PRINT 'Added TournamentLevel column';
END

-- FavoriteShot
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'FavoriteShot')
BEGIN
    ALTER TABLE Users ADD FavoriteShot NVARCHAR(100) NULL;
    PRINT 'Added FavoriteShot column';
END

-- IntroVideo
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'IntroVideo')
BEGIN
    ALTER TABLE Users ADD IntroVideo NVARCHAR(500) NULL;
    PRINT 'Added IntroVideo column';
END
GO

PRINT 'Migration 003 (User Profile Fields) completed successfully!';
GO
