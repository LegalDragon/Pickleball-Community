-- Create Database
IF NOT EXISTS(SELECT * FROM sys.databases WHERE name = 'PickleballCollege')
BEGIN
    CREATE DATABASE PickleballCollege;
END
GO

USE PickleballCollege;
GO

-- Users table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
BEGIN
    CREATE TABLE Users (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        Email NVARCHAR(255) UNIQUE NOT NULL,
        PasswordHash NVARCHAR(MAX) NOT NULL,
        Role NVARCHAR(50) NOT NULL CHECK (Role IN ('Coach', 'Student', 'Admin')),
        FirstName NVARCHAR(100) NOT NULL,
        LastName NVARCHAR(100) NOT NULL,
        Bio NVARCHAR(MAX),
        ProfileImageUrl NVARCHAR(500),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2 DEFAULT GETDATE(),
        IsActive BIT DEFAULT 1
    );
END
GO

-- Coach profiles
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CoachProfiles' AND xtype='U')
BEGIN
    CREATE TABLE CoachProfiles (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        UserId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES Users(Id),
        HourlyRate DECIMAL(10,2),
        CertificationLevel NVARCHAR(100),
        YearsExperience INT,
        IsVerified BIT DEFAULT 0,
        StripeAccountId NVARCHAR(255),
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
END
GO

-- Training materials
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TrainingMaterials' AND xtype='U')
BEGIN
    CREATE TABLE TrainingMaterials (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        CoachId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES Users(Id),
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX),
        ContentType NVARCHAR(50) NOT NULL CHECK (ContentType IN ('Text', 'Image', 'Video', 'Mixed')),
        Content NVARCHAR(MAX),
        Price DECIMAL(10,2) NOT NULL DEFAULT 0,
        IsPublished BIT DEFAULT 0,
        ThumbnailUrl NVARCHAR(500),
        VideoUrl NVARCHAR(500),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2 DEFAULT GETDATE()
    );
END
GO

-- Material purchases
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MaterialPurchases' AND xtype='U')
BEGIN
    CREATE TABLE MaterialPurchases (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        StudentId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES Users(Id),
        MaterialId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES TrainingMaterials(Id),
        PurchasePrice DECIMAL(10,2) NOT NULL,
        PlatformFee DECIMAL(10,2) NOT NULL,
        CoachEarnings DECIMAL(10,2) NOT NULL,
        StripePaymentIntentId NVARCHAR(255),
        PurchasedAt DATETIME2 DEFAULT GETDATE()
    );
END
GO

-- Training sessions
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TrainingSessions' AND xtype='U')
BEGIN
    CREATE TABLE TrainingSessions (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        CoachId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES Users(Id),
        StudentId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES Users(Id),
        MaterialId UNIQUEIDENTIFIER FOREIGN KEY REFERENCES TrainingMaterials(Id),
        SessionType NVARCHAR(50) NOT NULL CHECK (SessionType IN ('Online', 'Offline')),
        ScheduledAt DATETIME2 NOT NULL,
        DurationMinutes INT NOT NULL,
        Price DECIMAL(10,2) NOT NULL,
        Status NVARCHAR(50) DEFAULT 'Scheduled' CHECK (Status IN ('Scheduled', 'Completed', 'Cancelled')),
        MeetingLink NVARCHAR(500),
        Location NVARCHAR(500),
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
END
GO

-- Create initial admin user (password: Admin123!)
IF NOT EXISTS (SELECT * FROM Users WHERE Email = 'admin@pickleball.college')
BEGIN
    INSERT INTO Users (Id, Email, PasswordHash, Role, FirstName, LastName, Bio)
    VALUES (
        NEWID(),
        'admin@pickleball.college',
        '.eBz.7Q7QZ7QZ7QZ7QZ7QZ7QZ7QZ7QZ7QZ', -- This is a hashed version of 'Admin123!'
        'Admin',
        'System',
        'Admin',
        'System Administrator Account'
    );
END
GO

PRINT 'Database setup completed successfully!';
