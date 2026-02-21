-- Migration Script: Change IDs from UNIQUEIDENTIFIER to INT and Add Theme Management Tables
-- WARNING: This migration will drop and recreate tables. Backup your data first!
-- Date: 2025-12-09

USE PickleballCommunity;
GO

-- =============================================
-- STEP 1: Drop existing foreign key constraints
-- =============================================
PRINT 'Dropping foreign key constraints...';

IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_CoachProfiles_Users')
    ALTER TABLE CoachProfiles DROP CONSTRAINT FK_CoachProfiles_Users;

IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_TrainingMaterials_Users')
    ALTER TABLE TrainingMaterials DROP CONSTRAINT FK_TrainingMaterials_Users;

IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_MaterialPurchases_Users')
    ALTER TABLE MaterialPurchases DROP CONSTRAINT FK_MaterialPurchases_Users;

IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_MaterialPurchases_Materials')
    ALTER TABLE MaterialPurchases DROP CONSTRAINT FK_MaterialPurchases_Materials;

IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_TrainingSessions_Coach')
    ALTER TABLE TrainingSessions DROP CONSTRAINT FK_TrainingSessions_Coach;

IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_TrainingSessions_Student')
    ALTER TABLE TrainingSessions DROP CONSTRAINT FK_TrainingSessions_Student;

IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_TrainingSessions_Material')
    ALTER TABLE TrainingSessions DROP CONSTRAINT FK_TrainingSessions_Material;

-- Drop any unnamed foreign keys
DECLARE @sql NVARCHAR(MAX) = '';
SELECT @sql += 'ALTER TABLE ' + OBJECT_NAME(parent_object_id) + ' DROP CONSTRAINT ' + name + ';' + CHAR(13)
FROM sys.foreign_keys
WHERE referenced_object_id IN (
    OBJECT_ID('Users'),
    OBJECT_ID('CoachProfiles'),
    OBJECT_ID('TrainingMaterials'),
    OBJECT_ID('MaterialPurchases'),
    OBJECT_ID('TrainingSessions')
);
IF @sql <> ''
    EXEC sp_executesql @sql;
GO

-- =============================================
-- STEP 2: Drop existing tables (backup data first!)
-- =============================================
PRINT 'Dropping existing tables...';

IF OBJECT_ID('TrainingSessions', 'U') IS NOT NULL DROP TABLE TrainingSessions;
IF OBJECT_ID('MaterialPurchases', 'U') IS NOT NULL DROP TABLE MaterialPurchases;
IF OBJECT_ID('TrainingMaterials', 'U') IS NOT NULL DROP TABLE TrainingMaterials;
IF OBJECT_ID('CoachProfiles', 'U') IS NOT NULL DROP TABLE CoachProfiles;
IF OBJECT_ID('ActivityLogs', 'U') IS NOT NULL DROP TABLE ActivityLogs;
IF OBJECT_ID('ThemePresets', 'U') IS NOT NULL DROP TABLE ThemePresets;
IF OBJECT_ID('ThemeSettings', 'U') IS NOT NULL DROP TABLE ThemeSettings;
IF OBJECT_ID('Users', 'U') IS NOT NULL DROP TABLE Users;
GO

-- =============================================
-- STEP 3: Create tables with INT IDs
-- =============================================
PRINT 'Creating Users table...';

CREATE TABLE Users (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Email NVARCHAR(255) NOT NULL,
    PasswordHash NVARCHAR(MAX),
    Role NVARCHAR(50) NOT NULL DEFAULT 'Student',
    FirstName NVARCHAR(100),
    LastName NVARCHAR(100),
    RefreshToken NVARCHAR(MAX),
    Bio NVARCHAR(MAX),
    ProfileImageUrl NVARCHAR(500),
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    IsActive BIT NOT NULL DEFAULT 1,

    CONSTRAINT UQ_Users_Email UNIQUE (Email),
    CONSTRAINT CK_Users_Role CHECK (Role IN ('Coach', 'Student', 'Admin'))
);
GO

PRINT 'Creating CoachProfiles table...';

CREATE TABLE CoachProfiles (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    HourlyRate DECIMAL(10,2),
    CertificationLevel NVARCHAR(100),
    YearsExperience INT,
    IsVerified BIT NOT NULL DEFAULT 0,
    StripeAccountId NVARCHAR(255),
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_CoachProfiles_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_CoachProfiles_UserId UNIQUE (UserId)
);
GO

PRINT 'Creating TrainingMaterials table...';

CREATE TABLE TrainingMaterials (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    CoachId INT NOT NULL,
    Title NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX),
    ContentType NVARCHAR(50) NOT NULL DEFAULT 'Document',
    Price DECIMAL(10,2) NOT NULL DEFAULT 0,
    IsPublished BIT NOT NULL DEFAULT 0,
    ThumbnailUrl NVARCHAR(500),
    VideoUrl NVARCHAR(500),
    ExternalLink NVARCHAR(500),
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_TrainingMaterials_Users FOREIGN KEY (CoachId) REFERENCES Users(Id) ON DELETE NO ACTION,
    CONSTRAINT CK_TrainingMaterials_ContentType CHECK (ContentType IN ('Document', 'Video', 'Image', 'Text', 'Mixed'))
);
GO

PRINT 'Creating MaterialPurchases table...';

CREATE TABLE MaterialPurchases (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    StudentId INT NOT NULL,
    MaterialId INT NOT NULL,
    PurchasePrice DECIMAL(10,2) NOT NULL,
    PlatformFee DECIMAL(10,2) NOT NULL,
    CoachEarnings DECIMAL(10,2) NOT NULL,
    StripePaymentIntentId NVARCHAR(255),
    PurchasedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_MaterialPurchases_Users FOREIGN KEY (StudentId) REFERENCES Users(Id) ON DELETE NO ACTION,
    CONSTRAINT FK_MaterialPurchases_Materials FOREIGN KEY (MaterialId) REFERENCES TrainingMaterials(Id) ON DELETE NO ACTION
);
GO

PRINT 'Creating TrainingSessions table...';

CREATE TABLE TrainingSessions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    CoachId INT NOT NULL,
    StudentId INT NOT NULL,
    MaterialId INT NULL,
    SessionType NVARCHAR(50) NOT NULL DEFAULT 'Online',
    ScheduledAt DATETIME2 NOT NULL,
    DurationMinutes INT NOT NULL,
    Price DECIMAL(10,2) NOT NULL,
    Status NVARCHAR(50) NOT NULL DEFAULT 'Scheduled',
    MeetingLink NVARCHAR(500),
    Location NVARCHAR(500),
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_TrainingSessions_Coach FOREIGN KEY (CoachId) REFERENCES Users(Id) ON DELETE NO ACTION,
    CONSTRAINT FK_TrainingSessions_Student FOREIGN KEY (StudentId) REFERENCES Users(Id) ON DELETE NO ACTION,
    CONSTRAINT FK_TrainingSessions_Material FOREIGN KEY (MaterialId) REFERENCES TrainingMaterials(Id) ON DELETE NO ACTION,
    CONSTRAINT CK_TrainingSessions_Type CHECK (SessionType IN ('Online', 'Offline')),
    CONSTRAINT CK_TrainingSessions_Status CHECK (Status IN ('Scheduled', 'Completed', 'Cancelled'))
);
GO

-- =============================================
-- STEP 4: Create Theme Management Tables
-- =============================================
PRINT 'Creating ThemeSettings table...';

CREATE TABLE ThemeSettings (
    ThemeId INT IDENTITY(1,1) PRIMARY KEY,
    OrganizationName NVARCHAR(200) NOT NULL DEFAULT 'Pickleball Community',
    LogoUrl NVARCHAR(500),
    FaviconUrl NVARCHAR(500),

    -- Primary colors
    PrimaryColor NVARCHAR(20) NOT NULL DEFAULT '#047857',
    PrimaryDarkColor NVARCHAR(20) NOT NULL DEFAULT '#065f46',
    PrimaryLightColor NVARCHAR(20) NOT NULL DEFAULT '#d1fae5',

    -- Accent colors
    AccentColor NVARCHAR(20) NOT NULL DEFAULT '#f59e0b',
    AccentDarkColor NVARCHAR(20) NOT NULL DEFAULT '#d97706',
    AccentLightColor NVARCHAR(20) NOT NULL DEFAULT '#fef3c7',

    -- Status colors
    SuccessColor NVARCHAR(20) NOT NULL DEFAULT '#10b981',
    ErrorColor NVARCHAR(20) NOT NULL DEFAULT '#ef4444',
    WarningColor NVARCHAR(20) NOT NULL DEFAULT '#f59e0b',
    InfoColor NVARCHAR(20) NOT NULL DEFAULT '#3b82f6',

    -- Text colors
    TextPrimaryColor NVARCHAR(20) NOT NULL DEFAULT '#111827',
    TextSecondaryColor NVARCHAR(20) NOT NULL DEFAULT '#6b7280',
    TextLightColor NVARCHAR(20) NOT NULL DEFAULT '#f9fafb',

    -- Background colors
    BackgroundColor NVARCHAR(20) NOT NULL DEFAULT '#ffffff',
    BackgroundSecondaryColor NVARCHAR(20) NOT NULL DEFAULT '#f3f4f6',

    -- Other colors
    BorderColor NVARCHAR(20) NOT NULL DEFAULT '#e5e7eb',
    ShadowColor NVARCHAR(20) NOT NULL DEFAULT '#00000026',

    -- Typography
    FontFamily NVARCHAR(200) NOT NULL DEFAULT 'Inter, system-ui, sans-serif',
    HeadingFontFamily NVARCHAR(200) NOT NULL DEFAULT 'Playfair Display, serif',

    -- Custom CSS
    CustomCss NVARCHAR(MAX),

    -- Status
    IsActive BIT NOT NULL DEFAULT 1,

    -- Audit fields
    UpdatedBy INT NULL,
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);
GO

PRINT 'Creating ThemePresets table...';

CREATE TABLE ThemePresets (
    PresetId INT IDENTITY(1,1) PRIMARY KEY,
    PresetName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),

    -- Primary colors
    PrimaryColor NVARCHAR(20) NOT NULL DEFAULT '#047857',
    PrimaryDarkColor NVARCHAR(20) NOT NULL DEFAULT '#065f46',
    PrimaryLightColor NVARCHAR(20) NOT NULL DEFAULT '#d1fae5',

    -- Accent colors
    AccentColor NVARCHAR(20) NOT NULL DEFAULT '#f59e0b',
    AccentDarkColor NVARCHAR(20) NOT NULL DEFAULT '#d97706',
    AccentLightColor NVARCHAR(20) NOT NULL DEFAULT '#fef3c7',

    -- Preview image
    PreviewImage NVARCHAR(500),

    -- Default flag
    IsDefault BIT NOT NULL DEFAULT 0
);
GO

PRINT 'Creating ActivityLogs table...';

CREATE TABLE ActivityLogs (
    LogId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NULL,
    ActivityType NVARCHAR(100) NOT NULL,
    Description NVARCHAR(1000),
    IpAddress NVARCHAR(100),
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_ActivityLogs_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE SET NULL
);
GO

-- =============================================
-- STEP 5: Create Indexes
-- =============================================
PRINT 'Creating indexes...';

CREATE INDEX IX_Users_Email ON Users(Email);
CREATE INDEX IX_Users_Role ON Users(Role);
CREATE INDEX IX_CoachProfiles_UserId ON CoachProfiles(UserId);
CREATE INDEX IX_TrainingMaterials_CoachId ON TrainingMaterials(CoachId);
CREATE INDEX IX_TrainingMaterials_IsPublished ON TrainingMaterials(IsPublished);
CREATE INDEX IX_MaterialPurchases_StudentId ON MaterialPurchases(StudentId);
CREATE INDEX IX_MaterialPurchases_MaterialId ON MaterialPurchases(MaterialId);
CREATE INDEX IX_TrainingSessions_CoachId ON TrainingSessions(CoachId);
CREATE INDEX IX_TrainingSessions_StudentId ON TrainingSessions(StudentId);
CREATE INDEX IX_TrainingSessions_ScheduledAt ON TrainingSessions(ScheduledAt);
CREATE INDEX IX_ThemeSettings_IsActive ON ThemeSettings(IsActive);
CREATE INDEX IX_ActivityLogs_UserId ON ActivityLogs(UserId);
CREATE INDEX IX_ActivityLogs_ActivityType ON ActivityLogs(ActivityType);
CREATE INDEX IX_ActivityLogs_CreatedAt ON ActivityLogs(CreatedAt);
GO

-- =============================================
-- STEP 6: Insert Default Data
-- =============================================
PRINT 'Inserting default data...';

-- Insert default theme
INSERT INTO ThemeSettings (OrganizationName, IsActive)
VALUES ('Pickleball Community', 1);

-- Insert default theme presets
INSERT INTO ThemePresets (PresetName, Description, PrimaryColor, PrimaryDarkColor, PrimaryLightColor, AccentColor, AccentDarkColor, AccentLightColor, IsDefault)
VALUES
('Default Green', 'Default Pickleball Community theme', '#047857', '#065f46', '#d1fae5', '#f59e0b', '#d97706', '#fef3c7', 1),
('Ocean Blue', 'Professional blue theme', '#0369a1', '#075985', '#e0f2fe', '#f59e0b', '#d97706', '#fef3c7', 0),
('Royal Purple', 'Elegant purple theme', '#7c3aed', '#6d28d9', '#ede9fe', '#f59e0b', '#d97706', '#fef3c7', 0),
('Sunset Orange', 'Warm orange theme', '#ea580c', '#c2410c', '#ffedd5', '#0d9488', '#0f766e', '#ccfbf1', 0);

-- Create initial admin user (password needs to be set via application)
-- Password hash for 'Admin123!' using BCrypt
INSERT INTO Users (Email, PasswordHash, Role, FirstName, LastName, Bio, IsActive)
VALUES (
    'admin@pickleball.Community',
    '$2a$11$rBNhFYnvTMOsOGpLgpwMkOQHTP6RoIE6KF.fVxmqFp1FkHKj3.ZWq', -- BCrypt hash for 'Admin123!'
    'Admin',
    'System',
    'Administrator',
    'System Administrator Account',
    1
);
GO

PRINT 'Migration completed successfully!';
GO
