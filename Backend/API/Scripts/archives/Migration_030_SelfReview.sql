-- Migration 030: Add IsSelfReview column to PlayerCertificationReviews
-- This allows players to submit self-assessments which can be compared with peer reviews

PRINT 'Starting Migration 030: Self Review Support'

-- Add IsSelfReview column to PlayerCertificationReviews
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('PlayerCertificationReviews')
    AND name = 'IsSelfReview'
)
BEGIN
    ALTER TABLE PlayerCertificationReviews
    ADD IsSelfReview BIT NOT NULL DEFAULT 0;

    PRINT 'Added IsSelfReview column to PlayerCertificationReviews'
END
ELSE
BEGIN
    PRINT 'IsSelfReview column already exists'
END

PRINT 'Migration 030 completed successfully'
