-- Migration 118: Add email/phone verification status and profile visibility preferences
-- Author: Claude
-- Date: 2026-01-22
-- Description: Adds fields to track email/phone verification status (synced from Funtime-Shared)
--              and user preferences for showing email/phone in public profile

PRINT 'Starting Migration 118: User Verification and Visibility fields'

-- Add EmailVerified column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'EmailVerified')
BEGIN
    ALTER TABLE Users ADD EmailVerified BIT NOT NULL DEFAULT 0
    PRINT 'Added EmailVerified column to Users table'
END
ELSE
BEGIN
    PRINT 'EmailVerified column already exists'
END

-- Add PhoneVerified column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PhoneVerified')
BEGIN
    ALTER TABLE Users ADD PhoneVerified BIT NOT NULL DEFAULT 0
    PRINT 'Added PhoneVerified column to Users table'
END
ELSE
BEGIN
    PRINT 'PhoneVerified column already exists'
END

-- Add ShowEmailInProfile column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'ShowEmailInProfile')
BEGIN
    ALTER TABLE Users ADD ShowEmailInProfile BIT NOT NULL DEFAULT 0
    PRINT 'Added ShowEmailInProfile column to Users table'
END
ELSE
BEGIN
    PRINT 'ShowEmailInProfile column already exists'
END

-- Add ShowPhoneInProfile column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'ShowPhoneInProfile')
BEGIN
    ALTER TABLE Users ADD ShowPhoneInProfile BIT NOT NULL DEFAULT 0
    PRINT 'Added ShowPhoneInProfile column to Users table'
END
ELSE
BEGIN
    PRINT 'ShowPhoneInProfile column already exists'
END

PRINT 'Migration 118 completed successfully'
