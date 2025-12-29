-- Migration Script: Add ContentTypes Table
-- Date: 2025-12-09
-- Description: Creates ContentTypes table for dynamic material type configuration

USE PickleballCollege;
GO

-- =============================================
-- Create ContentTypes Table
-- =============================================
PRINT 'Creating ContentTypes table...';

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ContentTypes')
BEGIN
    CREATE TABLE ContentTypes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(50) NOT NULL,
        Code NVARCHAR(50) NOT NULL,
        Icon NVARCHAR(100) NOT NULL DEFAULT '',
        Prompt NVARCHAR(500) NOT NULL DEFAULT '',
        AllowedExtensions NVARCHAR(500) NOT NULL DEFAULT '',
        MaxFileSizeMB INT NOT NULL DEFAULT 100,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );

    -- Create unique index on Code
    CREATE UNIQUE INDEX IX_ContentTypes_Code ON ContentTypes(Code);

    PRINT 'Created ContentTypes table';
END
ELSE
BEGIN
    PRINT 'ContentTypes table already exists';
END
GO

-- =============================================
-- Seed ContentTypes Data
-- =============================================
PRINT 'Seeding ContentTypes data...';

-- Video
IF NOT EXISTS (SELECT * FROM ContentTypes WHERE Code = 'Video')
BEGIN
    INSERT INTO ContentTypes (Name, Code, Icon, Prompt, AllowedExtensions, MaxFileSizeMB, SortOrder, IsActive, CreatedAt)
    VALUES ('Video', 'Video', 'Video', 'Upload a video file or paste a YouTube/TikTok link', '.mp4,.mov,.avi,.wmv,.webm,.mkv', 500, 1, 1, GETUTCDATE());
    PRINT 'Inserted Video content type';
END

-- Image
IF NOT EXISTS (SELECT * FROM ContentTypes WHERE Code = 'Image')
BEGIN
    INSERT INTO ContentTypes (Name, Code, Icon, Prompt, AllowedExtensions, MaxFileSizeMB, SortOrder, IsActive, CreatedAt)
    VALUES ('Image', 'Image', 'Image', 'Upload an image file (PNG, JPG, WebP)', '.jpg,.jpeg,.png,.gif,.webp,.svg', 10, 2, 1, GETUTCDATE());
    PRINT 'Inserted Image content type';
END

-- Document
IF NOT EXISTS (SELECT * FROM ContentTypes WHERE Code = 'Document')
BEGIN
    INSERT INTO ContentTypes (Name, Code, Icon, Prompt, AllowedExtensions, MaxFileSizeMB, SortOrder, IsActive, CreatedAt)
    VALUES ('Document', 'Document', 'FileText', 'Upload a document file (PDF, Word, PowerPoint)', '.pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx', 50, 3, 1, GETUTCDATE());
    PRINT 'Inserted Document content type';
END

-- Audio
IF NOT EXISTS (SELECT * FROM ContentTypes WHERE Code = 'Audio')
BEGIN
    INSERT INTO ContentTypes (Name, Code, Icon, Prompt, AllowedExtensions, MaxFileSizeMB, SortOrder, IsActive, CreatedAt)
    VALUES ('Audio', 'Audio', 'Music', 'Upload an audio file (MP3, WAV, M4A)', '.mp3,.wav,.m4a,.ogg,.flac,.aac', 100, 4, 1, GETUTCDATE());
    PRINT 'Inserted Audio content type';
END

-- External Link
IF NOT EXISTS (SELECT * FROM ContentTypes WHERE Code = 'Link')
BEGIN
    INSERT INTO ContentTypes (Name, Code, Icon, Prompt, AllowedExtensions, MaxFileSizeMB, SortOrder, IsActive, CreatedAt)
    VALUES ('External Link', 'Link', 'Link', 'Paste an external URL (YouTube, TikTok, or any video link)', '', 0, 5, 1, GETUTCDATE());
    PRINT 'Inserted Link content type';
END
GO

PRINT 'Migration 004 (ContentTypes) completed successfully!';
GO
