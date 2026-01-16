-- Migration 104: Add Object References to Notifications
-- Adds ViewUrl template to ObjectTypes and Primary/Secondary/Tertiary object references to Notifications
-- This allows notifications to link to specific objects in the system

PRINT 'Starting Migration 104: Notification Object References';

-- =============================================
-- Add ViewUrl to ObjectTypes table
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ObjectTypes') AND name = 'ViewUrl')
BEGIN
    ALTER TABLE ObjectTypes ADD ViewUrl NVARCHAR(500) NULL;
    PRINT 'Added ViewUrl column to ObjectTypes table';
END
ELSE
BEGIN
    PRINT 'ViewUrl column already exists in ObjectTypes table';
END
GO

-- Update ObjectTypes with default ViewUrl templates
-- These use {id} as a placeholder that will be replaced with the actual object ID
UPDATE ObjectTypes SET ViewUrl = '/events/{id}' WHERE Name = 'Event' AND ViewUrl IS NULL;
UPDATE ObjectTypes SET ViewUrl = '/clubs/{id}' WHERE Name = 'Club' AND ViewUrl IS NULL;
UPDATE ObjectTypes SET ViewUrl = '/venues/{id}' WHERE Name = 'Venue' AND ViewUrl IS NULL;
UPDATE ObjectTypes SET ViewUrl = '/leagues/{id}' WHERE Name = 'League' AND ViewUrl IS NULL;
UPDATE ObjectTypes SET ViewUrl = '/players/{id}' WHERE Name = 'User' AND ViewUrl IS NULL;
PRINT 'Set default ViewUrl templates for ObjectTypes';
GO

-- =============================================
-- Add Primary Object Reference to Notifications
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Notifications') AND name = 'PrimaryObjectTypeId')
BEGIN
    ALTER TABLE Notifications ADD PrimaryObjectTypeId INT NULL;
    PRINT 'Added PrimaryObjectTypeId column to Notifications table';
END
ELSE
BEGIN
    PRINT 'PrimaryObjectTypeId column already exists in Notifications table';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Notifications') AND name = 'PrimaryObjectId')
BEGIN
    ALTER TABLE Notifications ADD PrimaryObjectId INT NULL;
    PRINT 'Added PrimaryObjectId column to Notifications table';
END
ELSE
BEGIN
    PRINT 'PrimaryObjectId column already exists in Notifications table';
END
GO

-- =============================================
-- Add Secondary Object Reference to Notifications
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Notifications') AND name = 'SecondaryObjectTypeId')
BEGIN
    ALTER TABLE Notifications ADD SecondaryObjectTypeId INT NULL;
    PRINT 'Added SecondaryObjectTypeId column to Notifications table';
END
ELSE
BEGIN
    PRINT 'SecondaryObjectTypeId column already exists in Notifications table';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Notifications') AND name = 'SecondaryObjectId')
BEGIN
    ALTER TABLE Notifications ADD SecondaryObjectId INT NULL;
    PRINT 'Added SecondaryObjectId column to Notifications table';
END
ELSE
BEGIN
    PRINT 'SecondaryObjectId column already exists in Notifications table';
END
GO

-- =============================================
-- Add Tertiary Object Reference to Notifications
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Notifications') AND name = 'TertiaryObjectTypeId')
BEGIN
    ALTER TABLE Notifications ADD TertiaryObjectTypeId INT NULL;
    PRINT 'Added TertiaryObjectTypeId column to Notifications table';
END
ELSE
BEGIN
    PRINT 'TertiaryObjectTypeId column already exists in Notifications table';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Notifications') AND name = 'TertiaryObjectId')
BEGIN
    ALTER TABLE Notifications ADD TertiaryObjectId INT NULL;
    PRINT 'Added TertiaryObjectId column to Notifications table';
END
ELSE
BEGIN
    PRINT 'TertiaryObjectId column already exists in Notifications table';
END
GO

-- =============================================
-- Add Foreign Key Constraints
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Notifications_PrimaryObjectType')
BEGIN
    ALTER TABLE Notifications
    ADD CONSTRAINT FK_Notifications_PrimaryObjectType
    FOREIGN KEY (PrimaryObjectTypeId) REFERENCES ObjectTypes(Id);
    PRINT 'Added FK_Notifications_PrimaryObjectType constraint';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Notifications_SecondaryObjectType')
BEGIN
    ALTER TABLE Notifications
    ADD CONSTRAINT FK_Notifications_SecondaryObjectType
    FOREIGN KEY (SecondaryObjectTypeId) REFERENCES ObjectTypes(Id);
    PRINT 'Added FK_Notifications_SecondaryObjectType constraint';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Notifications_TertiaryObjectType')
BEGIN
    ALTER TABLE Notifications
    ADD CONSTRAINT FK_Notifications_TertiaryObjectType
    FOREIGN KEY (TertiaryObjectTypeId) REFERENCES ObjectTypes(Id);
    PRINT 'Added FK_Notifications_TertiaryObjectType constraint';
END
GO

-- =============================================
-- Add Indexes for Performance
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Notifications_PrimaryObjectType')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Notifications_PrimaryObjectType
    ON Notifications(PrimaryObjectTypeId, PrimaryObjectId)
    WHERE PrimaryObjectTypeId IS NOT NULL;
    PRINT 'Created IX_Notifications_PrimaryObjectType index';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Notifications_SecondaryObjectType')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Notifications_SecondaryObjectType
    ON Notifications(SecondaryObjectTypeId, SecondaryObjectId)
    WHERE SecondaryObjectTypeId IS NOT NULL;
    PRINT 'Created IX_Notifications_SecondaryObjectType index';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Notifications_TertiaryObjectType')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Notifications_TertiaryObjectType
    ON Notifications(TertiaryObjectTypeId, TertiaryObjectId)
    WHERE TertiaryObjectTypeId IS NOT NULL;
    PRINT 'Created IX_Notifications_TertiaryObjectType index';
END
GO

PRINT 'Completed Migration 104: Notification Object References';
