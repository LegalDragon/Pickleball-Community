-- Migration 127: Court Group Courts Junction Table
-- Allows courts to belong to multiple court groups (many-to-many)
-- =====================================================

PRINT 'Starting Migration 127: Court Group Courts Junction Table...'

-- Create junction table for many-to-many relationship
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CourtGroupCourts')
BEGIN
    PRINT 'Creating CourtGroupCourts junction table...'
    CREATE TABLE CourtGroupCourts (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CourtGroupId INT NOT NULL,
        TournamentCourtId INT NOT NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        -- Use NO ACTION to avoid multiple cascade path errors
        -- Application code handles cleanup when courts/groups are deleted
        CONSTRAINT FK_CourtGroupCourts_CourtGroup FOREIGN KEY (CourtGroupId)
            REFERENCES CourtGroups(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_CourtGroupCourts_TournamentCourt FOREIGN KEY (TournamentCourtId)
            REFERENCES TournamentCourts(Id) ON DELETE NO ACTION,
        CONSTRAINT UQ_CourtGroupCourts_GroupCourt UNIQUE (CourtGroupId, TournamentCourtId)
    );

    CREATE INDEX IX_CourtGroupCourts_CourtGroupId ON CourtGroupCourts(CourtGroupId);
    CREATE INDEX IX_CourtGroupCourts_TournamentCourtId ON CourtGroupCourts(TournamentCourtId);

    PRINT 'CourtGroupCourts table created successfully.'
END
ELSE
BEGIN
    PRINT 'CourtGroupCourts table already exists.'
END

-- Migrate existing data from CourtGroupId column to junction table
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TournamentCourts' AND COLUMN_NAME = 'CourtGroupId')
BEGIN
    PRINT 'Migrating existing court group assignments to junction table...'

    INSERT INTO CourtGroupCourts (CourtGroupId, TournamentCourtId, SortOrder)
    SELECT tc.CourtGroupId, tc.Id, tc.SortOrder
    FROM TournamentCourts tc
    WHERE tc.CourtGroupId IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM CourtGroupCourts cgc
          WHERE cgc.CourtGroupId = tc.CourtGroupId AND cgc.TournamentCourtId = tc.Id
      );

    PRINT 'Migration of existing assignments complete.'
END

-- Drop the obsolete foreign key constraint and column
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_TournamentCourts_CourtGroup')
BEGIN
    PRINT 'Dropping obsolete FK_TournamentCourts_CourtGroup constraint...'
    ALTER TABLE TournamentCourts DROP CONSTRAINT FK_TournamentCourts_CourtGroup;
    PRINT 'Foreign key constraint dropped.'
END

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TournamentCourts' AND COLUMN_NAME = 'CourtGroupId')
BEGIN
    PRINT 'Dropping obsolete CourtGroupId column from TournamentCourts...'
    ALTER TABLE TournamentCourts DROP COLUMN CourtGroupId;
    PRINT 'CourtGroupId column dropped.'
END

PRINT 'Migration 127 completed successfully.'
GO
