-- Migration Script: Add Video Review Bidding Support
-- Date: 2025-12-10
-- Description: Adds bidding/proposal columns to VideoReviewRequests table

USE PickleballCollege;
GO

PRINT 'Starting Migration_010_VideoReviewBidding...';
PRINT '';

-- =============================================
-- STEP 1: Add new columns to VideoReviewRequests
-- =============================================
PRINT 'Adding bidding columns to VideoReviewRequests...';

-- Add ExternalVideoLink column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VideoReviewRequests') AND name = 'ExternalVideoLink')
BEGIN
    ALTER TABLE VideoReviewRequests ADD ExternalVideoLink NVARCHAR(500) NULL;
    PRINT '  Added ExternalVideoLink column';
END
ELSE
BEGIN
    PRINT '  ExternalVideoLink column already exists';
END

-- Add ProposedByCoachId column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VideoReviewRequests') AND name = 'ProposedByCoachId')
BEGIN
    ALTER TABLE VideoReviewRequests ADD ProposedByCoachId INT NULL;
    ALTER TABLE VideoReviewRequests ADD CONSTRAINT FK_VideoReviewRequests_ProposedByCoach
        FOREIGN KEY (ProposedByCoachId) REFERENCES Users(Id) ON DELETE NO ACTION;
    PRINT '  Added ProposedByCoachId column with FK';
END
ELSE
BEGIN
    PRINT '  ProposedByCoachId column already exists';
END

-- Add ProposedPrice column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VideoReviewRequests') AND name = 'ProposedPrice')
BEGIN
    ALTER TABLE VideoReviewRequests ADD ProposedPrice DECIMAL(10,2) NULL;
    PRINT '  Added ProposedPrice column';
END
ELSE
BEGIN
    PRINT '  ProposedPrice column already exists';
END

-- Add ProposalNote column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VideoReviewRequests') AND name = 'ProposalNote')
BEGIN
    ALTER TABLE VideoReviewRequests ADD ProposalNote NVARCHAR(1000) NULL;
    PRINT '  Added ProposalNote column';
END
ELSE
BEGIN
    PRINT '  ProposalNote column already exists';
END

-- Add ProposedAt column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VideoReviewRequests') AND name = 'ProposedAt')
BEGIN
    ALTER TABLE VideoReviewRequests ADD ProposedAt DATETIME2 NULL;
    PRINT '  Added ProposedAt column';
END
ELSE
BEGIN
    PRINT '  ProposedAt column already exists';
END

GO

-- =============================================
-- STEP 2: Update Status constraint to include new statuses
-- =============================================
PRINT '';
PRINT 'Updating Status constraint...';

-- Drop existing constraint if it exists
IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_VideoReviewRequests_Status')
BEGIN
    ALTER TABLE VideoReviewRequests DROP CONSTRAINT CK_VideoReviewRequests_Status;
    PRINT '  Dropped existing Status constraint';
END

-- Add new constraint with PendingStudentApproval status
ALTER TABLE VideoReviewRequests ADD CONSTRAINT CK_VideoReviewRequests_Status
    CHECK (Status IN ('Open', 'PendingStudentApproval', 'Accepted', 'InProgress', 'Completed', 'Cancelled'));
PRINT '  Added updated Status constraint with PendingStudentApproval';

GO

-- =============================================
-- STEP 3: Verify changes
-- =============================================
PRINT '';
PRINT 'Verifying changes...';

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VideoReviewRequests') AND name = 'ExternalVideoLink')
    PRINT '  ExternalVideoLink column exists';
ELSE
    PRINT '  ERROR: ExternalVideoLink column NOT found';

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VideoReviewRequests') AND name = 'ProposedByCoachId')
    PRINT '  ProposedByCoachId column exists';
ELSE
    PRINT '  ERROR: ProposedByCoachId column NOT found';

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VideoReviewRequests') AND name = 'ProposedPrice')
    PRINT '  ProposedPrice column exists';
ELSE
    PRINT '  ERROR: ProposedPrice column NOT found';

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VideoReviewRequests') AND name = 'ProposalNote')
    PRINT '  ProposalNote column exists';
ELSE
    PRINT '  ERROR: ProposalNote column NOT found';

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VideoReviewRequests') AND name = 'ProposedAt')
    PRINT '  ProposedAt column exists';
ELSE
    PRINT '  ERROR: ProposedAt column NOT found';

PRINT '';
PRINT 'Migration_010_VideoReviewBidding completed.';
GO
