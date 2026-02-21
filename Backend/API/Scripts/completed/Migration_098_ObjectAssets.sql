-- Migration 098: Create ObjectTypes, ObjectAssetTypes, and ObjectAssets tables
-- Generalized asset system for all objects in the system

PRINT 'Starting Migration 098: ObjectAssets System'
GO

-- Create ObjectTypes table
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ObjectTypes')
BEGIN
    PRINT 'Creating ObjectTypes table...'
    CREATE TABLE ObjectTypes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(50) NOT NULL,
        DisplayName NVARCHAR(100) NOT NULL,
        TableName NVARCHAR(100) NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    )
    PRINT 'ObjectTypes table created'
END
GO

-- Create ObjectAssetTypes table
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ObjectAssetTypes')
BEGIN
    PRINT 'Creating ObjectAssetTypes table...'
    CREATE TABLE ObjectAssetTypes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ObjectTypeId INT NOT NULL,
        TypeName NVARCHAR(50) NOT NULL,
        DisplayName NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        IconName NVARCHAR(50) NULL,
        ColorClass NVARCHAR(50) NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        IsSystem BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_ObjectAssetTypes_ObjectTypes FOREIGN KEY (ObjectTypeId) REFERENCES ObjectTypes(Id)
    )
    PRINT 'ObjectAssetTypes table created'
END
GO

-- Create ObjectAssets table
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ObjectAssets')
BEGIN
    PRINT 'Creating ObjectAssets table...'
    CREATE TABLE ObjectAssets (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ObjectTypeId INT NOT NULL,
        ObjectAssetTypeId INT NOT NULL,
        ObjectId INT NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        FileUrl NVARCHAR(500) NOT NULL,
        FileName NVARCHAR(200) NOT NULL,
        FileType NVARCHAR(50) NULL,
        FileSize INT NULL,
        IsPublic BIT NOT NULL DEFAULT 1,
        SortOrder INT NOT NULL DEFAULT 0,
        UploadedByUserId INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NULL,
        CONSTRAINT FK_ObjectAssets_ObjectTypes FOREIGN KEY (ObjectTypeId) REFERENCES ObjectTypes(Id),
        CONSTRAINT FK_ObjectAssets_ObjectAssetTypes FOREIGN KEY (ObjectAssetTypeId) REFERENCES ObjectAssetTypes(Id),
        CONSTRAINT FK_ObjectAssets_Users FOREIGN KEY (UploadedByUserId) REFERENCES Users(Id)
    )

    -- Create index for efficient lookup by object
    CREATE INDEX IX_ObjectAssets_ObjectType_ObjectId ON ObjectAssets(ObjectTypeId, ObjectId)
    PRINT 'ObjectAssets table created'
END
GO

-- Seed ObjectTypes
IF NOT EXISTS (SELECT 1 FROM ObjectTypes WHERE Name = 'Event')
BEGIN
    PRINT 'Seeding ObjectTypes...'
    INSERT INTO ObjectTypes (Name, DisplayName, TableName, SortOrder) VALUES
        ('Event', 'Event', 'Events', 1),
        ('Club', 'Club', 'Clubs', 2),
        ('Venue', 'Venue', 'Venues', 3),
        ('League', 'League', 'Leagues', 4),
        ('User', 'User Profile', 'Users', 5)
    PRINT 'ObjectTypes seeded'
END
GO

-- Seed ObjectAssetTypes for Events
DECLARE @EventTypeId INT = (SELECT Id FROM ObjectTypes WHERE Name = 'Event')
IF @EventTypeId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ObjectAssetTypes WHERE ObjectTypeId = @EventTypeId AND TypeName = 'waiver')
BEGIN
    PRINT 'Seeding ObjectAssetTypes for Events...'
    INSERT INTO ObjectAssetTypes (ObjectTypeId, TypeName, DisplayName, Description, IconName, ColorClass, SortOrder, IsSystem) VALUES
        (@EventTypeId, 'waiver', 'Waiver', 'Liability and consent forms', 'Shield', 'red', 1, 1),
        (@EventTypeId, 'map', 'Map', 'Venue and court layouts', 'Map', 'green', 2, 1),
        (@EventTypeId, 'rules', 'Rules', 'Event rules and guidelines', 'BookOpen', 'purple', 3, 1),
        (@EventTypeId, 'contacts', 'Contacts', 'Emergency and staff contacts', 'Phone', 'blue', 4, 1),
        (@EventTypeId, 'other', 'Other', 'Other event documents', 'FileText', 'gray', 5, 1)
    PRINT 'Event asset types seeded'
END
GO

-- Seed ObjectAssetTypes for Clubs
DECLARE @ClubTypeId INT = (SELECT Id FROM ObjectTypes WHERE Name = 'Club')
IF @ClubTypeId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ObjectAssetTypes WHERE ObjectTypeId = @ClubTypeId AND TypeName = 'logo')
BEGIN
    PRINT 'Seeding ObjectAssetTypes for Clubs...'
    INSERT INTO ObjectAssetTypes (ObjectTypeId, TypeName, DisplayName, Description, IconName, ColorClass, SortOrder, IsSystem) VALUES
        (@ClubTypeId, 'logo', 'Logo', 'Club logo image', 'Image', 'blue', 1, 1),
        (@ClubTypeId, 'banner', 'Banner', 'Club banner image', 'ImageIcon', 'purple', 2, 1),
        (@ClubTypeId, 'document', 'Document', 'Club documents', 'FileText', 'gray', 3, 1)
    PRINT 'Club asset types seeded'
END
GO

-- Seed ObjectAssetTypes for Venues
DECLARE @VenueTypeId INT = (SELECT Id FROM ObjectTypes WHERE Name = 'Venue')
IF @VenueTypeId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ObjectAssetTypes WHERE ObjectTypeId = @VenueTypeId AND TypeName = 'photo')
BEGIN
    PRINT 'Seeding ObjectAssetTypes for Venues...'
    INSERT INTO ObjectAssetTypes (ObjectTypeId, TypeName, DisplayName, Description, IconName, ColorClass, SortOrder, IsSystem) VALUES
        (@VenueTypeId, 'photo', 'Photo', 'Venue photos', 'Camera', 'blue', 1, 1),
        (@VenueTypeId, 'map', 'Map', 'Venue map or layout', 'Map', 'green', 2, 1),
        (@VenueTypeId, 'document', 'Document', 'Venue documents', 'FileText', 'gray', 3, 1)
    PRINT 'Venue asset types seeded'
END
GO

-- Migrate existing EventDocuments to ObjectAssets
DECLARE @EventObjTypeId INT = (SELECT Id FROM ObjectTypes WHERE Name = 'Event')
IF @EventObjTypeId IS NOT NULL AND EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EventDocuments')
BEGIN
    -- Check if migration already done
    IF NOT EXISTS (SELECT 1 FROM ObjectAssets WHERE ObjectTypeId = @EventObjTypeId)
    BEGIN
        PRINT 'Migrating EventDocuments to ObjectAssets...'

        -- Get asset type mappings
        DECLARE @WaiverTypeId INT = (SELECT Id FROM ObjectAssetTypes WHERE ObjectTypeId = @EventObjTypeId AND TypeName = 'waiver')
        DECLARE @MapTypeId INT = (SELECT Id FROM ObjectAssetTypes WHERE ObjectTypeId = @EventObjTypeId AND TypeName = 'map')
        DECLARE @RulesTypeId INT = (SELECT Id FROM ObjectAssetTypes WHERE ObjectTypeId = @EventObjTypeId AND TypeName = 'rules')
        DECLARE @ContactsTypeId INT = (SELECT Id FROM ObjectAssetTypes WHERE ObjectTypeId = @EventObjTypeId AND TypeName = 'contacts')
        DECLARE @OtherTypeId INT = (SELECT Id FROM ObjectAssetTypes WHERE ObjectTypeId = @EventObjTypeId AND TypeName = 'other')

        INSERT INTO ObjectAssets (ObjectTypeId, ObjectAssetTypeId, ObjectId, Title, FileUrl, FileName, FileType, FileSize, IsPublic, SortOrder, UploadedByUserId, CreatedAt, UpdatedAt)
        SELECT
            @EventObjTypeId,
            CASE
                WHEN ed.DocumentType = 'waiver' THEN @WaiverTypeId
                WHEN ed.DocumentType = 'map' THEN @MapTypeId
                WHEN ed.DocumentType = 'rules' THEN @RulesTypeId
                WHEN ed.DocumentType = 'contacts' THEN @ContactsTypeId
                ELSE @OtherTypeId
            END,
            ed.EventId,
            ed.Title,
            ed.FileUrl,
            ed.FileName,
            ed.FileType,
            ed.FileSize,
            ed.IsPublic,
            ed.SortOrder,
            ed.UploadedByUserId,
            ed.CreatedAt,
            ed.UpdatedAt
        FROM EventDocuments ed
        WHERE ed.FileUrl IS NOT NULL AND ed.FileUrl != ''

        PRINT 'EventDocuments migrated to ObjectAssets'
    END
    ELSE
    BEGIN
        PRINT 'EventDocuments already migrated'
    END
END
GO

PRINT 'Migration 098 completed successfully'
GO
