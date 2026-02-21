-- Migration_056_ClubGrants.sql
-- Club Grant/Donation tracking system for leagues

PRINT 'Starting Migration_056_ClubGrants...'
GO

-- Table: ClubGrantAccounts
-- Tracks the grant balance for each club within a league
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ClubGrantAccounts')
BEGIN
    PRINT 'Creating ClubGrantAccounts table...'
    CREATE TABLE ClubGrantAccounts (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ClubId INT NOT NULL,
        LeagueId INT NOT NULL,
        CurrentBalance DECIMAL(18,2) NOT NULL DEFAULT 0,
        TotalCredits DECIMAL(18,2) NOT NULL DEFAULT 0,
        TotalDebits DECIMAL(18,2) NOT NULL DEFAULT 0,
        Notes NVARCHAR(MAX) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_ClubGrantAccounts_Club FOREIGN KEY (ClubId) REFERENCES Clubs(Id),
        CONSTRAINT FK_ClubGrantAccounts_League FOREIGN KEY (LeagueId) REFERENCES Leagues(Id),
        CONSTRAINT UQ_ClubGrantAccounts_ClubLeague UNIQUE (ClubId, LeagueId)
    );

    CREATE INDEX IX_ClubGrantAccounts_ClubId ON ClubGrantAccounts(ClubId);
    CREATE INDEX IX_ClubGrantAccounts_LeagueId ON ClubGrantAccounts(LeagueId);
    PRINT 'ClubGrantAccounts table created.'
END
GO

-- Table: ClubGrantTransactions
-- Records all credits (donations) and debits (grants, fees) for club accounts
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ClubGrantTransactions')
BEGIN
    PRINT 'Creating ClubGrantTransactions table...'
    CREATE TABLE ClubGrantTransactions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        AccountId INT NOT NULL,
        TransactionType NVARCHAR(20) NOT NULL, -- 'Credit' or 'Debit'
        Category NVARCHAR(50) NOT NULL, -- 'Donation', 'Grant', 'Fee', 'Adjustment'
        Amount DECIMAL(18,2) NOT NULL,
        BalanceAfter DECIMAL(18,2) NOT NULL, -- Running balance after this transaction
        Description NVARCHAR(500) NOT NULL,

        -- Donation-specific fields
        DonorName NVARCHAR(200) NULL,
        DonorEmail NVARCHAR(255) NULL,
        DonorPhone NVARCHAR(50) NULL,
        DonationDate DATE NULL,

        -- Fee-specific fields
        FeeReason NVARCHAR(200) NULL,

        -- Grant-specific fields
        GrantPurpose NVARCHAR(500) NULL,

        -- Reference fields
        ReferenceNumber NVARCHAR(100) NULL,
        ExternalReferenceId NVARCHAR(100) NULL, -- e.g., payment processor ID

        -- Audit fields
        ProcessedByUserId INT NOT NULL,
        ApprovedByUserId INT NULL,
        Notes NVARCHAR(MAX) NULL,
        IsVoided BIT NOT NULL DEFAULT 0,
        VoidedByUserId INT NULL,
        VoidedAt DATETIME2 NULL,
        VoidReason NVARCHAR(500) NULL,

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_ClubGrantTransactions_Account FOREIGN KEY (AccountId) REFERENCES ClubGrantAccounts(Id),
        CONSTRAINT FK_ClubGrantTransactions_ProcessedBy FOREIGN KEY (ProcessedByUserId) REFERENCES Users(Id),
        CONSTRAINT FK_ClubGrantTransactions_ApprovedBy FOREIGN KEY (ApprovedByUserId) REFERENCES Users(Id),
        CONSTRAINT FK_ClubGrantTransactions_VoidedBy FOREIGN KEY (VoidedByUserId) REFERENCES Users(Id),
        CONSTRAINT CK_ClubGrantTransactions_Type CHECK (TransactionType IN ('Credit', 'Debit')),
        CONSTRAINT CK_ClubGrantTransactions_Category CHECK (Category IN ('Donation', 'Grant', 'Fee', 'Adjustment', 'Refund'))
    );

    CREATE INDEX IX_ClubGrantTransactions_AccountId ON ClubGrantTransactions(AccountId);
    CREATE INDEX IX_ClubGrantTransactions_TransactionType ON ClubGrantTransactions(TransactionType);
    CREATE INDEX IX_ClubGrantTransactions_Category ON ClubGrantTransactions(Category);
    CREATE INDEX IX_ClubGrantTransactions_CreatedAt ON ClubGrantTransactions(CreatedAt DESC);
    CREATE INDEX IX_ClubGrantTransactions_DonorName ON ClubGrantTransactions(DonorName);
    PRINT 'ClubGrantTransactions table created.'
END
GO

-- Table: GrantManagers
-- Users with access to the grant management system
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'GrantManagers')
BEGIN
    PRINT 'Creating GrantManagers table...'
    CREATE TABLE GrantManagers (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        LeagueId INT NULL, -- NULL means access to all leagues (site-wide)
        Role NVARCHAR(50) NOT NULL DEFAULT 'Manager', -- 'Admin', 'Manager', 'Viewer'
        CanRecordDonations BIT NOT NULL DEFAULT 1,
        CanIssueFees BIT NOT NULL DEFAULT 0,
        CanIssueGrants BIT NOT NULL DEFAULT 0,
        CanVoidTransactions BIT NOT NULL DEFAULT 0,
        CanManageManagers BIT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedByUserId INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_GrantManagers_User FOREIGN KEY (UserId) REFERENCES Users(Id),
        CONSTRAINT FK_GrantManagers_League FOREIGN KEY (LeagueId) REFERENCES Leagues(Id),
        CONSTRAINT FK_GrantManagers_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id),
        CONSTRAINT UQ_GrantManagers_UserLeague UNIQUE (UserId, LeagueId),
        CONSTRAINT CK_GrantManagers_Role CHECK (Role IN ('Admin', 'Manager', 'Viewer'))
    );

    CREATE INDEX IX_GrantManagers_UserId ON GrantManagers(UserId);
    CREATE INDEX IX_GrantManagers_LeagueId ON GrantManagers(LeagueId);
    PRINT 'GrantManagers table created.'
END
GO

-- Table: GrantTransactionAttachments
-- Supporting documents for transactions (receipts, approval letters, etc.)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'GrantTransactionAttachments')
BEGIN
    PRINT 'Creating GrantTransactionAttachments table...'
    CREATE TABLE GrantTransactionAttachments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TransactionId INT NOT NULL,
        FileName NVARCHAR(255) NOT NULL,
        FileUrl NVARCHAR(500) NOT NULL,
        FileType NVARCHAR(100) NULL,
        FileSize BIGINT NULL,
        Description NVARCHAR(500) NULL,
        UploadedByUserId INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_GrantTransactionAttachments_Transaction FOREIGN KEY (TransactionId) REFERENCES ClubGrantTransactions(Id),
        CONSTRAINT FK_GrantTransactionAttachments_UploadedBy FOREIGN KEY (UploadedByUserId) REFERENCES Users(Id)
    );

    CREATE INDEX IX_GrantTransactionAttachments_TransactionId ON GrantTransactionAttachments(TransactionId);
    PRINT 'GrantTransactionAttachments table created.'
END
GO

PRINT 'Migration_056_ClubGrants completed successfully!'
GO
