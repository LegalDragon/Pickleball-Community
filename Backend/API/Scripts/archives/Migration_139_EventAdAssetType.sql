-- Migration 139: Add 'ad' asset type for events (sponsors/advertisements)
-- This allows TDs to upload sponsor images/ads that display on the public event page

PRINT 'Migration 139: Adding ad/sponsor asset type for events...'

-- Get the Event object type ID
DECLARE @EventTypeId INT
SELECT @EventTypeId = Id FROM ObjectTypes WHERE Name = 'Event'

IF @EventTypeId IS NULL
BEGIN
    PRINT 'Event object type not found. Skipping migration.'
    RETURN
END

-- Add 'ad' asset type if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM ObjectAssetTypes WHERE ObjectTypeId = @EventTypeId AND TypeName = 'ad')
BEGIN
    PRINT 'Adding ad/sponsor asset type for Events...'
    INSERT INTO ObjectAssetTypes (ObjectTypeId, TypeName, DisplayName, Description, IconName, ColorClass, SortOrder, IsSystem)
    VALUES (@EventTypeId, 'ad', 'Sponsor/Ad', 'Sponsor logos and advertisements', 'Image', 'orange', 10, 1)
    PRINT 'Added ad/sponsor asset type'
END
ELSE
BEGIN
    PRINT 'Ad/sponsor asset type already exists'
END

-- Add LinkUrl column to ObjectAssets if it doesn't exist (for clickable ads)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ObjectAssets') AND name = 'LinkUrl')
BEGIN
    PRINT 'Adding LinkUrl column to ObjectAssets...'
    ALTER TABLE ObjectAssets ADD LinkUrl NVARCHAR(500) NULL
    PRINT 'Added LinkUrl column'
END
ELSE
BEGIN
    PRINT 'LinkUrl column already exists'
END

PRINT 'Migration 139 completed successfully'
GO
