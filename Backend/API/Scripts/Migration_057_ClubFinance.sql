-- Migration_057_ClubFinance.sql
-- Club-level financial tracking for membership dues, expenses, etc.

PRINT 'Starting Migration_057_ClubFinance...'
GO

-- Table: ClubFinanceAccounts
-- Tracks the financial balance for each club
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ClubFinanceAccounts')
BEGIN
    PRINT 'Creating ClubFinanceAccounts table...'
    CREATE TABLE ClubFinanceAccounts (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ClubId INT NOT NULL,
        CurrentBalance DECIMAL(18,2) NOT NULL DEFAULT 0,
        TotalIncome DECIMAL(18,2) NOT NULL DEFAULT 0,
        TotalExpenses DECIMAL(18,2) NOT NULL DEFAULT 0,
        Notes NVARCHAR(MAX) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_ClubFinanceAccounts_Club FOREIGN KEY (ClubId) REFERENCES Clubs(Id),
        CONSTRAINT UQ_ClubFinanceAccounts_Club UNIQUE (ClubId)
    );

    CREATE INDEX IX_ClubFinanceAccounts_ClubId ON ClubFinanceAccounts(ClubId);
    PRINT 'ClubFinanceAccounts table created.'
END
GO

-- Table: ClubFinanceTransactions
-- Records all income and expenses for club accounts
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ClubFinanceTransactions')
BEGIN
    PRINT 'Creating ClubFinanceTransactions table...'
    CREATE TABLE ClubFinanceTransactions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        AccountId INT NOT NULL,
        TransactionType NVARCHAR(20) NOT NULL, -- 'Income' or 'Expense'
        Category NVARCHAR(50) NOT NULL, -- 'MembershipDue', 'EventFee', 'Equipment', 'Venue', 'Supplies', 'Other'
        Amount DECIMAL(18,2) NOT NULL,
        BalanceAfter DECIMAL(18,2) NOT NULL, -- Running balance after this transaction
        Description NVARCHAR(500) NOT NULL,

        -- Member payment fields (for dues, event fees, etc.)
        MemberId INT NULL, -- ClubMembers.Id if payment from a member
        MemberUserId INT NULL, -- The user who made the payment
        PaymentMethod NVARCHAR(50) NULL, -- 'Cash', 'Check', 'Card', 'Venmo', 'Zelle', 'Other'
        PaymentReference NVARCHAR(100) NULL, -- Check number, transaction ID, etc.

        -- Expense fields
        Vendor NVARCHAR(200) NULL,
        ExpenseDate DATE NULL,

        -- Period tracking (e.g., for membership dues)
        PeriodStart DATE NULL,
        PeriodEnd DATE NULL,

        -- Reference fields
        ReferenceNumber NVARCHAR(100) NULL,
        ExternalReferenceId NVARCHAR(100) NULL,

        -- Audit fields
        RecordedByUserId INT NOT NULL,
        ApprovedByUserId INT NULL,
        Notes NVARCHAR(MAX) NULL,
        IsVoided BIT NOT NULL DEFAULT 0,
        VoidedByUserId INT NULL,
        VoidedAt DATETIME2 NULL,
        VoidReason NVARCHAR(500) NULL,

        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_ClubFinanceTransactions_Account FOREIGN KEY (AccountId) REFERENCES ClubFinanceAccounts(Id),
        CONSTRAINT FK_ClubFinanceTransactions_Member FOREIGN KEY (MemberId) REFERENCES ClubMembers(Id),
        CONSTRAINT FK_ClubFinanceTransactions_MemberUser FOREIGN KEY (MemberUserId) REFERENCES Users(Id),
        CONSTRAINT FK_ClubFinanceTransactions_RecordedBy FOREIGN KEY (RecordedByUserId) REFERENCES Users(Id),
        CONSTRAINT FK_ClubFinanceTransactions_ApprovedBy FOREIGN KEY (ApprovedByUserId) REFERENCES Users(Id),
        CONSTRAINT FK_ClubFinanceTransactions_VoidedBy FOREIGN KEY (VoidedByUserId) REFERENCES Users(Id),
        CONSTRAINT CK_ClubFinanceTransactions_Type CHECK (TransactionType IN ('Income', 'Expense')),
        CONSTRAINT CK_ClubFinanceTransactions_Category CHECK (Category IN ('MembershipDue', 'EventFee', 'Sponsorship', 'Donation', 'Equipment', 'Venue', 'Supplies', 'Insurance', 'Marketing', 'Prize', 'Refund', 'Other'))
    );

    CREATE INDEX IX_ClubFinanceTransactions_AccountId ON ClubFinanceTransactions(AccountId);
    CREATE INDEX IX_ClubFinanceTransactions_TransactionType ON ClubFinanceTransactions(TransactionType);
    CREATE INDEX IX_ClubFinanceTransactions_Category ON ClubFinanceTransactions(Category);
    CREATE INDEX IX_ClubFinanceTransactions_MemberId ON ClubFinanceTransactions(MemberId);
    CREATE INDEX IX_ClubFinanceTransactions_CreatedAt ON ClubFinanceTransactions(CreatedAt DESC);
    PRINT 'ClubFinanceTransactions table created.'
END
GO

-- Table: ClubFinanceTransactionAttachments
-- Supporting documents (receipts, invoices, proof of payment)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ClubFinanceTransactionAttachments')
BEGIN
    PRINT 'Creating ClubFinanceTransactionAttachments table...'
    CREATE TABLE ClubFinanceTransactionAttachments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TransactionId INT NOT NULL,
        FileName NVARCHAR(255) NOT NULL,
        FileUrl NVARCHAR(500) NOT NULL,
        FileType NVARCHAR(100) NULL,
        FileSize BIGINT NULL,
        Description NVARCHAR(500) NULL,
        UploadedByUserId INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_ClubFinanceTransactionAttachments_Transaction FOREIGN KEY (TransactionId) REFERENCES ClubFinanceTransactions(Id),
        CONSTRAINT FK_ClubFinanceTransactionAttachments_UploadedBy FOREIGN KEY (UploadedByUserId) REFERENCES Users(Id)
    );

    CREATE INDEX IX_ClubFinanceTransactionAttachments_TransactionId ON ClubFinanceTransactionAttachments(TransactionId);
    PRINT 'ClubFinanceTransactionAttachments table created.'
END
GO

PRINT 'Migration_057_ClubFinance completed successfully!'
GO
