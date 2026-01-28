-- Migration 029: Hero Videos for Home Page
-- Allows admins to manage hero section videos/images on the home page

PRINT 'Starting Migration 029: Hero Videos...'

-- Add hero video fields to ThemeSettings
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.ThemeSettings') AND name = 'HeroVideoUrl')
BEGIN
    ALTER TABLE dbo.ThemeSettings ADD HeroVideoUrl NVARCHAR(500) NULL;
    PRINT 'Added HeroVideoUrl column'
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.ThemeSettings') AND name = 'HeroVideoThumbnailUrl')
BEGIN
    ALTER TABLE dbo.ThemeSettings ADD HeroVideoThumbnailUrl NVARCHAR(500) NULL;
    PRINT 'Added HeroVideoThumbnailUrl column'
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.ThemeSettings') AND name = 'HeroImageUrl')
BEGIN
    ALTER TABLE dbo.ThemeSettings ADD HeroImageUrl NVARCHAR(500) NULL;
    PRINT 'Added HeroImageUrl column'
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.ThemeSettings') AND name = 'HeroTitle')
BEGIN
    ALTER TABLE dbo.ThemeSettings ADD HeroTitle NVARCHAR(200) NULL;
    PRINT 'Added HeroTitle column'
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.ThemeSettings') AND name = 'HeroSubtitle')
BEGIN
    ALTER TABLE dbo.ThemeSettings ADD HeroSubtitle NVARCHAR(500) NULL;
    PRINT 'Added HeroSubtitle column'
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.ThemeSettings') AND name = 'HeroCtaText')
BEGIN
    ALTER TABLE dbo.ThemeSettings ADD HeroCtaText NVARCHAR(100) NULL;
    PRINT 'Added HeroCtaText column'
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.ThemeSettings') AND name = 'HeroCtaLink')
BEGIN
    ALTER TABLE dbo.ThemeSettings ADD HeroCtaLink NVARCHAR(200) NULL;
    PRINT 'Added HeroCtaLink column'
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.ThemeSettings') AND name = 'HeroSecondaryCtaText')
BEGIN
    ALTER TABLE dbo.ThemeSettings ADD HeroSecondaryCtaText NVARCHAR(100) NULL;
    PRINT 'Added HeroSecondaryCtaText column'
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.ThemeSettings') AND name = 'HeroSecondaryCtaLink')
BEGIN
    ALTER TABLE dbo.ThemeSettings ADD HeroSecondaryCtaLink NVARCHAR(200) NULL;
    PRINT 'Added HeroSecondaryCtaLink column'
END

-- Set default hero content
UPDATE dbo.ThemeSettings
SET HeroTitle = 'Your Pickleball Community Awaits',
    HeroSubtitle = 'Connect with players, find courts, join clubs, and get certified. The ultimate platform for pickleball enthusiasts.',
    HeroCtaText = 'Find Courts',
    HeroCtaLink = '/courts',
    HeroSecondaryCtaText = 'Join a Club',
    HeroSecondaryCtaLink = '/clubs'
WHERE HeroTitle IS NULL;

PRINT 'Migration 029 completed successfully!'
