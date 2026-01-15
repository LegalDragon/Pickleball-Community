-- Migration 100: Create EventPayments table
-- Stores payment records separately from registration records to prevent data loss
-- when registrations are removed

PRINT 'Starting Migration 100 - EventPayments Table'

-- Create EventPayments table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EventPayments')
BEGIN
    CREATE TABLE EventPayments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventId INT NOT NULL,
        UserId INT NOT NULL,
        UnitId INT NULL,
        MemberId INT NULL,
        Amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        PaymentProofUrl NVARCHAR(500) NULL,
        PaymentReference NVARCHAR(100) NULL,
        ReferenceId NVARCHAR(50) NULL,
        PaymentMethod NVARCHAR(50) NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
        VerifiedByUserId INT NULL,
        VerifiedAt DATETIME2 NULL,
        Notes NVARCHAR(500) NULL,
        IsApplied BIT NOT NULL DEFAULT 0,
        AppliedAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_EventPayments_Events FOREIGN KEY (EventId)
            REFERENCES Events(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EventPayments_Users FOREIGN KEY (UserId)
            REFERENCES Users(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventPayments_Units FOREIGN KEY (UnitId)
            REFERENCES EventUnits(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventPayments_Members FOREIGN KEY (MemberId)
            REFERENCES EventUnitMembers(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_EventPayments_VerifiedBy FOREIGN KEY (VerifiedByUserId)
            REFERENCES Users(Id) ON DELETE NO ACTION
    )
    PRINT 'Created EventPayments table'
END
ELSE
    PRINT 'EventPayments table already exists'

-- Create indexes for common queries
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventPayments_EventId' AND object_id = OBJECT_ID('EventPayments'))
BEGIN
    CREATE INDEX IX_EventPayments_EventId ON EventPayments(EventId)
    PRINT 'Created index IX_EventPayments_EventId'
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventPayments_UserId' AND object_id = OBJECT_ID('EventPayments'))
BEGIN
    CREATE INDEX IX_EventPayments_UserId ON EventPayments(UserId)
    PRINT 'Created index IX_EventPayments_UserId'
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventPayments_UnitId' AND object_id = OBJECT_ID('EventPayments'))
BEGIN
    CREATE INDEX IX_EventPayments_UnitId ON EventPayments(UnitId) WHERE UnitId IS NOT NULL
    PRINT 'Created index IX_EventPayments_UnitId'
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventPayments_Status' AND object_id = OBJECT_ID('EventPayments'))
BEGIN
    CREATE INDEX IX_EventPayments_Status ON EventPayments(Status)
    PRINT 'Created index IX_EventPayments_Status'
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EventPayments_ReferenceId' AND object_id = OBJECT_ID('EventPayments'))
BEGIN
    CREATE INDEX IX_EventPayments_ReferenceId ON EventPayments(ReferenceId) WHERE ReferenceId IS NOT NULL
    PRINT 'Created index IX_EventPayments_ReferenceId'
END

-- Backfill existing payment data from EventUnitMembers
-- This preserves existing payment records by copying them to the new table
PRINT 'Backfilling existing payments from EventUnitMembers...'

INSERT INTO EventPayments (EventId, UserId, UnitId, MemberId, Amount, PaymentProofUrl, PaymentReference, ReferenceId, Status, IsApplied, AppliedAt, CreatedAt, UpdatedAt)
SELECT
    u.EventId,
    m.UserId,
    m.UnitId,
    m.Id AS MemberId,
    m.AmountPaid,
    m.PaymentProofUrl,
    m.PaymentReference,
    m.ReferenceId,
    CASE
        WHEN m.HasPaid = 1 THEN 'Verified'
        WHEN m.PaymentProofUrl IS NOT NULL THEN 'Pending'
        ELSE 'Pending'
    END AS Status,
    m.HasPaid AS IsApplied,
    m.PaidAt AS AppliedAt,
    COALESCE(m.PaidAt, m.CreatedAt) AS CreatedAt,
    COALESCE(m.PaidAt, m.CreatedAt) AS UpdatedAt
FROM EventUnitMembers m
INNER JOIN EventUnits u ON m.UnitId = u.Id
WHERE m.AmountPaid > 0 OR m.PaymentProofUrl IS NOT NULL OR m.PaymentReference IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM EventPayments ep
    WHERE ep.MemberId = m.Id AND ep.UserId = m.UserId
  )

DECLARE @BackfilledCount INT = @@ROWCOUNT
PRINT CONCAT('Backfilled ', @BackfilledCount, ' payment records from EventUnitMembers')

PRINT 'Migration 100 completed successfully'
