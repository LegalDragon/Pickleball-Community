-- Migration 146: Add DUPR Rating to Users
-- DUPR = Dynamic Universal Pickleball Rating (decimal, e.g. 3.5, 5.0, 6.25)

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'DuprRating')
BEGIN
    ALTER TABLE Users ADD DuprRating DECIMAL(4,2) NULL;
    PRINT 'Added DuprRating to Users';
END
