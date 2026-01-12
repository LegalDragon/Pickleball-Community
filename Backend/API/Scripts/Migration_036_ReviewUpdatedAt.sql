-- Migration 036: Add UpdatedAt column to PlayerCertificationReviews
-- This tracks when a review was last updated (for repeat reviewer logic)

PRINT 'Starting Migration 036: Review UpdatedAt column'
GO

-- Add UpdatedAt column to PlayerCertificationReviews
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('PlayerCertificationReviews')
    AND name = 'UpdatedAt'
)
BEGIN
    ALTER TABLE PlayerCertificationReviews
    ADD UpdatedAt DATETIME2 NULL;

    PRINT 'Added UpdatedAt column to PlayerCertificationReviews'
END
ELSE
BEGIN
    PRINT 'UpdatedAt column already exists on PlayerCertificationReviews'
END
GO

PRINT 'Migration 036 completed successfully'
GO
