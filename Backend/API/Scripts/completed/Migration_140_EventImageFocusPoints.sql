-- Migration 140: Add focus point fields for event logo and banner images
-- Focus points allow admins to specify the focal point of images for responsive cropping
-- Values are percentages (0-100) where 50,50 is center

PRINT 'Migration 140: Adding event image focus point fields...'

-- Add focus point fields for poster/logo image
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'PosterFocusX')
BEGIN
    ALTER TABLE Events ADD PosterFocusX DECIMAL(5,2) NULL DEFAULT 50;
    PRINT 'Added PosterFocusX column'
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'PosterFocusY')
BEGIN
    ALTER TABLE Events ADD PosterFocusY DECIMAL(5,2) NULL DEFAULT 50;
    PRINT 'Added PosterFocusY column'
END

-- Add focus point fields for banner image
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'BannerFocusX')
BEGIN
    ALTER TABLE Events ADD BannerFocusX DECIMAL(5,2) NULL DEFAULT 50;
    PRINT 'Added BannerFocusX column'
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'BannerFocusY')
BEGIN
    ALTER TABLE Events ADD BannerFocusY DECIMAL(5,2) NULL DEFAULT 50;
    PRINT 'Added BannerFocusY column'
END

PRINT 'Migration 140 completed successfully'
