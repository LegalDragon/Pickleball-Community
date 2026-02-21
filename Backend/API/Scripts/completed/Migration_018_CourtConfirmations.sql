-- Migration 018: Court Confirmations
-- Adds the CourtConfirmations table for user feedback on court information
-- This allows users to confirm or update court details like name, court count, lights, fees, etc.

PRINT 'Starting Migration 018: Court Confirmations';

-- Create CourtConfirmations table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CourtConfirmations')
BEGIN
    PRINT 'Creating CourtConfirmations table...';

    CREATE TABLE CourtConfirmations (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CourtId INT NOT NULL,
        UserId INT NOT NULL,

        -- Name confirmation
        NameConfirmed BIT NULL,
        SuggestedName NVARCHAR(100) NULL,

        -- Court count confirmations
        ConfirmedIndoorCount INT NULL,
        ConfirmedOutdoorCount INT NULL,
        ConfirmedCoveredCount INT NULL,

        -- Lights confirmation
        HasLights BIT NULL,

        -- Fee information
        HasFee BIT NULL,
        FeeAmount NVARCHAR(50) NULL,
        FeeNotes NVARCHAR(200) NULL,

        -- Hours
        Hours NVARCHAR(500) NULL,

        -- Rating (1-5)
        Rating INT NULL,

        -- Additional notes
        Notes NVARCHAR(1000) NULL,

        -- Amenities (comma-separated)
        Amenities NVARCHAR(500) NULL,

        -- Surface type
        SurfaceType NVARCHAR(50) NULL,

        -- Timestamps
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        -- Foreign key constraints
        CONSTRAINT FK_CourtConfirmations_Courts FOREIGN KEY (CourtId) REFERENCES Courts(Court_ID) ON DELETE CASCADE,
        CONSTRAINT FK_CourtConfirmations_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,

        -- Ensure one confirmation per user per court
        CONSTRAINT UQ_CourtConfirmations_Court_User UNIQUE (CourtId, UserId),

        -- Validate rating is 1-5
        CONSTRAINT CHK_CourtConfirmations_Rating CHECK (Rating IS NULL OR (Rating >= 1 AND Rating <= 5))
    );

    PRINT 'CourtConfirmations table created successfully.';
END
ELSE
BEGIN
    PRINT 'CourtConfirmations table already exists.';
END

-- Create indexes for faster queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CourtConfirmations_CourtId')
BEGIN
    PRINT 'Creating index on CourtId...';
    CREATE INDEX IX_CourtConfirmations_CourtId ON CourtConfirmations(CourtId);
    PRINT 'Index created successfully.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CourtConfirmations_UserId')
BEGIN
    PRINT 'Creating index on UserId...';
    CREATE INDEX IX_CourtConfirmations_UserId ON CourtConfirmations(UserId);
    PRINT 'Index created successfully.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CourtConfirmations_UpdatedAt')
BEGIN
    PRINT 'Creating index on UpdatedAt for sorting...';
    CREATE INDEX IX_CourtConfirmations_UpdatedAt ON CourtConfirmations(UpdatedAt DESC);
    PRINT 'Index created successfully.';
END

PRINT 'Migration 018 completed successfully.';
