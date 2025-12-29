-- Migration Script: Add Session Proposal Support
-- Date: 2025-12-10
-- Description: Adds proposal columns to TrainingSessions table for coach counter-proposals

USE PickleballCollege;
GO

PRINT 'Starting Migration_011_SessionProposals...';
PRINT '';

-- =============================================
-- STEP 1: Add new columns to TrainingSessions
-- =============================================
PRINT 'Adding proposal columns to TrainingSessions...';

-- Add ProposedScheduledAt column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TrainingSessions') AND name = 'ProposedScheduledAt')
BEGIN
    ALTER TABLE TrainingSessions ADD ProposedScheduledAt DATETIME2 NULL;
    PRINT '  Added ProposedScheduledAt column';
END
ELSE
BEGIN
    PRINT '  ProposedScheduledAt column already exists';
END

-- Add ProposedDurationMinutes column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TrainingSessions') AND name = 'ProposedDurationMinutes')
BEGIN
    ALTER TABLE TrainingSessions ADD ProposedDurationMinutes INT NULL;
    PRINT '  Added ProposedDurationMinutes column';
END
ELSE
BEGIN
    PRINT '  ProposedDurationMinutes column already exists';
END

-- Add ProposedPrice column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TrainingSessions') AND name = 'ProposedPrice')
BEGIN
    ALTER TABLE TrainingSessions ADD ProposedPrice DECIMAL(10,2) NULL;
    PRINT '  Added ProposedPrice column';
END
ELSE
BEGIN
    PRINT '  ProposedPrice column already exists';
END

-- Add ProposedLocation column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TrainingSessions') AND name = 'ProposedLocation')
BEGIN
    ALTER TABLE TrainingSessions ADD ProposedLocation NVARCHAR(200) NULL;
    PRINT '  Added ProposedLocation column';
END
ELSE
BEGIN
    PRINT '  ProposedLocation column already exists';
END

-- Add ProposalNote column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TrainingSessions') AND name = 'ProposalNote')
BEGIN
    ALTER TABLE TrainingSessions ADD ProposalNote NVARCHAR(500) NULL;
    PRINT '  Added ProposalNote column';
END
ELSE
BEGIN
    PRINT '  ProposalNote column already exists';
END

-- Add ProposedAt column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TrainingSessions') AND name = 'ProposedAt')
BEGIN
    ALTER TABLE TrainingSessions ADD ProposedAt DATETIME2 NULL;
    PRINT '  Added ProposedAt column';
END
ELSE
BEGIN
    PRINT '  ProposedAt column already exists';
END

GO

-- =============================================
-- STEP 2: Update Status constraint to include new status
-- =============================================
PRINT '';
PRINT 'Updating Status constraint...';

-- Drop existing constraint if it exists
IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_TrainingSessions_Status')
BEGIN
    ALTER TABLE TrainingSessions DROP CONSTRAINT CK_TrainingSessions_Status;
    PRINT '  Dropped existing Status constraint';
END

-- Add new constraint with PendingStudentApproval status
ALTER TABLE TrainingSessions ADD CONSTRAINT CK_TrainingSessions_Status
    CHECK (Status IN ('Pending', 'PendingStudentApproval', 'Confirmed', 'Completed', 'Cancelled'));
PRINT '  Added updated Status constraint with PendingStudentApproval';

GO

-- =============================================
-- STEP 3: Verify changes
-- =============================================
PRINT '';
PRINT 'Verifying changes...';

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TrainingSessions') AND name = 'ProposedScheduledAt')
    PRINT '  ProposedScheduledAt column exists';
ELSE
    PRINT '  ERROR: ProposedScheduledAt column NOT found';

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TrainingSessions') AND name = 'ProposedDurationMinutes')
    PRINT '  ProposedDurationMinutes column exists';
ELSE
    PRINT '  ERROR: ProposedDurationMinutes column NOT found';

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TrainingSessions') AND name = 'ProposedPrice')
    PRINT '  ProposedPrice column exists';
ELSE
    PRINT '  ERROR: ProposedPrice column NOT found';

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TrainingSessions') AND name = 'ProposedLocation')
    PRINT '  ProposedLocation column exists';
ELSE
    PRINT '  ERROR: ProposedLocation column NOT found';

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TrainingSessions') AND name = 'ProposalNote')
    PRINT '  ProposalNote column exists';
ELSE
    PRINT '  ERROR: ProposalNote column NOT found';

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TrainingSessions') AND name = 'ProposedAt')
    PRINT '  ProposedAt column exists';
ELSE
    PRINT '  ERROR: ProposedAt column NOT found';

PRINT '';
PRINT 'Migration_011_SessionProposals completed.';
GO
