-- Migration_099_ObjectAssets_FileUrlLength.sql
-- Increase FileUrl column length to accommodate longer shared asset URLs

PRINT 'Starting Migration 099: ObjectAssets FileUrl Length';

-- Alter FileUrl column to allow longer URLs
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ObjectAssets' AND COLUMN_NAME = 'FileUrl')
BEGIN
    PRINT 'Altering ObjectAssets.FileUrl column to NVARCHAR(2000)...';
    ALTER TABLE ObjectAssets ALTER COLUMN FileUrl NVARCHAR(2000) NOT NULL;
    PRINT 'ObjectAssets.FileUrl column altered successfully';
END
ELSE
BEGIN
    PRINT 'ObjectAssets.FileUrl column does not exist - skipping';
END

PRINT 'Migration 099 completed';
