-- Migration Script: Add Tags Tables and Stored Procedure
-- Date: 2025-12-10
-- Description: Adds TagDefinitions, ObjectTags tables, and GetCommonTags stored procedure

USE PickleballCommunity;
GO

-- =============================================
-- STEP 1: Create TagDefinitions table
-- =============================================
PRINT 'Creating TagDefinitions table...';

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TagDefinitions')
BEGIN
    CREATE TABLE TagDefinitions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(50) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT UQ_TagDefinitions_Name UNIQUE (Name)
    );

    CREATE INDEX IX_TagDefinitions_Name ON TagDefinitions(Name);

    PRINT 'TagDefinitions table created successfully.';
END
ELSE
BEGIN
    PRINT 'TagDefinitions table already exists.';
END
GO

-- =============================================
-- STEP 2: Create ObjectTags table
-- =============================================
PRINT 'Creating ObjectTags table...';

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ObjectTags')
BEGIN
    CREATE TABLE ObjectTags (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TagId INT NOT NULL,
        ObjectType NVARCHAR(50) NOT NULL, -- 'Material', 'Course', 'Coach', etc.
        ObjectId INT NOT NULL,
        CreatedByUserId INT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_ObjectTags_TagDefinitions FOREIGN KEY (TagId) REFERENCES TagDefinitions(Id) ON DELETE CASCADE,
        CONSTRAINT FK_ObjectTags_Users FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id) ON DELETE SET NULL,
        CONSTRAINT UQ_ObjectTags_Tag_Object UNIQUE (TagId, ObjectType, ObjectId)
    );

    CREATE INDEX IX_ObjectTags_TagId ON ObjectTags(TagId);
    CREATE INDEX IX_ObjectTags_Object ON ObjectTags(ObjectType, ObjectId);
    CREATE INDEX IX_ObjectTags_CreatedByUserId ON ObjectTags(CreatedByUserId);

    PRINT 'ObjectTags table created successfully.';
END
ELSE
BEGIN
    PRINT 'ObjectTags table already exists.';
END
GO

-- =============================================
-- STEP 3: Create GetCommonTags stored procedure
-- =============================================
PRINT 'Creating GetCommonTags stored procedure...';

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'GetCommonTags')
BEGIN
    DROP PROCEDURE GetCommonTags;
END
GO

CREATE PROCEDURE GetCommonTags
    @ObjectType NVARCHAR(50),
    @ObjectId INT,
    @Limit INT = 10
AS
BEGIN
    SET NOCOUNT ON;

    -- Return the most commonly used tags for this object type
    -- Excludes tags already on the specified object
    SELECT TOP (@Limit)
        t.Id AS TagId,
        t.Name AS TagName,
        COUNT(ot.Id) AS UsageCount
    FROM TagDefinitions t
    INNER JOIN ObjectTags ot ON t.Id = ot.TagId
    WHERE ot.ObjectType = @ObjectType
      AND NOT EXISTS (
          SELECT 1 FROM ObjectTags ot2
          WHERE ot2.TagId = t.Id
            AND ot2.ObjectType = @ObjectType
            AND ot2.ObjectId = @ObjectId
      )
    GROUP BY t.Id, t.Name
    ORDER BY COUNT(ot.Id) DESC, t.Name ASC;
END
GO

PRINT 'GetCommonTags stored procedure created successfully.';
GO

-- =============================================
-- STEP 4: Verify tables were created
-- =============================================
PRINT '';
PRINT 'Verifying table creation...';

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'TagDefinitions')
    PRINT 'TagDefinitions table exists';
ELSE
    PRINT 'TagDefinitions table NOT found';

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ObjectTags')
    PRINT 'ObjectTags table exists';
ELSE
    PRINT 'ObjectTags table NOT found';

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'GetCommonTags')
    PRINT 'GetCommonTags procedure exists';
ELSE
    PRINT 'GetCommonTags procedure NOT found';

PRINT '';
PRINT 'Migration_007_Tags completed.';
GO
