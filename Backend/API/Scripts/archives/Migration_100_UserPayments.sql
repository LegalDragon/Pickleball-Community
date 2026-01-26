-- Migration 100: Create UserPayments table
-- Generic payment records for users supporting multiple payment types:
-- EventRegistration, ClubMembership, SiteMembership, Donation, Other

PRINT 'Starting Migration 100 - UserPayments Table'

-- Create UserPayments table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserPayments')
BEGIN
    CREATE TABLE UserPayments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        PaymentType NVARCHAR(50) NOT NULL DEFAULT 'EventRegistration',
        RelatedObjectId INT NULL,
        SecondaryObjectId INT NULL,
        TertiaryObjectId INT NULL,
        Description NVARCHAR(200) NULL,
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

        CONSTRAINT FK_UserPayments_Users FOREIGN KEY (UserId)
            REFERENCES Users(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_UserPayments_VerifiedBy FOREIGN KEY (VerifiedByUserId)
            REFERENCES Users(Id) ON DELETE NO ACTION
    )
    PRINT 'Created UserPayments table'
END
ELSE
    PRINT 'UserPayments table already exists'

-- Create indexes for common queries
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserPayments_UserId' AND object_id = OBJECT_ID('UserPayments'))
BEGIN
    CREATE INDEX IX_UserPayments_UserId ON UserPayments(UserId)
    PRINT 'Created index IX_UserPayments_UserId'
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserPayments_PaymentType' AND object_id = OBJECT_ID('UserPayments'))
BEGIN
    CREATE INDEX IX_UserPayments_PaymentType ON UserPayments(PaymentType)
    PRINT 'Created index IX_UserPayments_PaymentType'
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserPayments_RelatedObjectId' AND object_id = OBJECT_ID('UserPayments'))
BEGIN
    CREATE INDEX IX_UserPayments_RelatedObjectId ON UserPayments(PaymentType, RelatedObjectId) WHERE RelatedObjectId IS NOT NULL
    PRINT 'Created index IX_UserPayments_RelatedObjectId'
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserPayments_Status' AND object_id = OBJECT_ID('UserPayments'))
BEGIN
    CREATE INDEX IX_UserPayments_Status ON UserPayments(Status)
    PRINT 'Created index IX_UserPayments_Status'
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserPayments_ReferenceId' AND object_id = OBJECT_ID('UserPayments'))
BEGIN
    CREATE INDEX IX_UserPayments_ReferenceId ON UserPayments(ReferenceId) WHERE ReferenceId IS NOT NULL
    PRINT 'Created index IX_UserPayments_ReferenceId'
END

-- Backfill existing payment data from EventUnitMembers
-- This preserves existing payment records by copying them to the new table
PRINT 'Backfilling existing payments from EventUnitMembers...'

INSERT INTO UserPayments (UserId, PaymentType, RelatedObjectId, SecondaryObjectId, TertiaryObjectId, Description, Amount, PaymentProofUrl, PaymentReference, ReferenceId, Status, IsApplied, AppliedAt, CreatedAt, UpdatedAt)
SELECT
    m.UserId,
    'EventRegistration' AS PaymentType,
    u.EventId AS RelatedObjectId,
    m.UnitId AS SecondaryObjectId,
    m.Id AS TertiaryObjectId,
    CONCAT('Event registration - ', e.Name) AS Description,
    m.AmountPaid AS Amount,
    m.PaymentProofUrl,
    m.PaymentReference,
    m.ReferenceId,
    CASE
        WHEN m.HasPaid = 1 THEN 'Verified'
        WHEN m.PaymentProofUrl IS NOT NULL THEN 'PendingVerification'
        ELSE 'Pending'
    END AS Status,
    m.HasPaid AS IsApplied,
    m.PaidAt AS AppliedAt,
    COALESCE(m.PaidAt, m.CreatedAt) AS CreatedAt,
    COALESCE(m.PaidAt, m.CreatedAt) AS UpdatedAt
FROM EventUnitMembers m
INNER JOIN EventUnits u ON m.UnitId = u.Id
INNER JOIN Events e ON u.EventId = e.Id
WHERE (m.AmountPaid > 0 OR m.PaymentProofUrl IS NOT NULL OR m.PaymentReference IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM UserPayments up
    WHERE up.PaymentType = 'EventRegistration'
      AND up.RelatedObjectId = u.EventId
      AND up.SecondaryObjectId = m.UnitId
      AND up.UserId = m.UserId
  )

DECLARE @BackfilledCount INT = @@ROWCOUNT
PRINT CONCAT('Backfilled ', @BackfilledCount, ' payment records from EventUnitMembers')

-- Also backfill from EventUnits where unit-level payment exists but no member records
-- This handles cases where payment was tracked at unit level only
PRINT 'Backfilling unit-level payments that have no member payment records...'

INSERT INTO UserPayments (UserId, PaymentType, RelatedObjectId, SecondaryObjectId, TertiaryObjectId, Description, Amount, PaymentProofUrl, PaymentReference, ReferenceId, Status, IsApplied, AppliedAt, CreatedAt, UpdatedAt)
SELECT DISTINCT
    m.UserId,
    'EventRegistration' AS PaymentType,
    u.EventId AS RelatedObjectId,
    u.Id AS SecondaryObjectId,
    m.Id AS TertiaryObjectId,
    CONCAT('Event registration - ', e.Name) AS Description,
    CASE
        WHEN u.AmountPaid > 0 AND (SELECT COUNT(*) FROM EventUnitMembers WHERE UnitId = u.Id) > 0
        THEN u.AmountPaid / (SELECT COUNT(*) FROM EventUnitMembers WHERE UnitId = u.Id)
        ELSE u.AmountPaid
    END AS Amount,
    u.PaymentProofUrl,
    u.PaymentReference,
    u.ReferenceId,
    CASE
        WHEN u.PaymentStatus = 'Paid' THEN 'Verified'
        WHEN u.PaymentStatus = 'PendingVerification' THEN 'PendingVerification'
        WHEN u.PaymentProofUrl IS NOT NULL THEN 'PendingVerification'
        ELSE 'Pending'
    END AS Status,
    CASE WHEN u.PaymentStatus = 'Paid' THEN 1 ELSE 0 END AS IsApplied,
    u.PaidAt AS AppliedAt,
    COALESCE(u.PaidAt, u.CreatedAt) AS CreatedAt,
    COALESCE(u.PaidAt, u.CreatedAt) AS UpdatedAt
FROM EventUnits u
INNER JOIN EventUnitMembers m ON m.UnitId = u.Id
INNER JOIN Events e ON u.EventId = e.Id
WHERE (u.AmountPaid > 0 OR u.PaymentProofUrl IS NOT NULL OR u.PaymentReference IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM UserPayments up
    WHERE up.PaymentType = 'EventRegistration'
      AND up.RelatedObjectId = u.EventId
      AND up.SecondaryObjectId = u.Id
      AND up.UserId = m.UserId
  )
  -- Only for members who don't have their own payment record
  AND (m.AmountPaid = 0 OR m.AmountPaid IS NULL)
  AND m.PaymentProofUrl IS NULL
  AND m.PaymentReference IS NULL

DECLARE @UnitBackfilledCount INT = @@ROWCOUNT
PRINT CONCAT('Backfilled ', @UnitBackfilledCount, ' unit-level payment records')

-- Drop old EventPayments table if it exists (cleanup)
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EventPayments')
BEGIN
    -- First migrate any data from EventPayments that might not be in UserPayments yet
    INSERT INTO UserPayments (UserId, PaymentType, RelatedObjectId, SecondaryObjectId, TertiaryObjectId, Amount, PaymentProofUrl, PaymentReference, ReferenceId, PaymentMethod, Status, VerifiedByUserId, VerifiedAt, Notes, IsApplied, AppliedAt, CreatedAt, UpdatedAt)
    SELECT
        ep.UserId,
        'EventRegistration',
        ep.EventId,
        ep.UnitId,
        ep.MemberId,
        ep.Amount,
        ep.PaymentProofUrl,
        ep.PaymentReference,
        ep.ReferenceId,
        ep.PaymentMethod,
        ep.Status,
        ep.VerifiedByUserId,
        ep.VerifiedAt,
        ep.Notes,
        ep.IsApplied,
        ep.AppliedAt,
        ep.CreatedAt,
        ep.UpdatedAt
    FROM EventPayments ep
    WHERE NOT EXISTS (
        SELECT 1 FROM UserPayments up
        WHERE up.PaymentType = 'EventRegistration'
          AND up.RelatedObjectId = ep.EventId
          AND up.SecondaryObjectId = ep.UnitId
          AND up.UserId = ep.UserId
    )

    DECLARE @MigratedFromOld INT = @@ROWCOUNT
    PRINT CONCAT('Migrated ', @MigratedFromOld, ' records from old EventPayments table')

    DROP TABLE EventPayments
    PRINT 'Dropped old EventPayments table'
END

PRINT 'Migration 100 completed successfully'
