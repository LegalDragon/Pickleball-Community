-- Migration 043: Add Home Venue to Clubs
-- This adds a HomeVenueId field to link clubs to their home venue

PRINT 'Starting Migration 043: Add Home Venue to Clubs'
GO

-- Add HomeVenueId column to Clubs table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Clubs') AND name = 'HomeVenueId')
BEGIN
    ALTER TABLE Clubs ADD HomeVenueId INT NULL
    PRINT 'Added HomeVenueId column to Clubs'
END
GO

-- Add foreign key constraint
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Clubs_Venues_HomeVenue')
BEGIN
    ALTER TABLE Clubs
    ADD CONSTRAINT FK_Clubs_Venues_HomeVenue
    FOREIGN KEY (HomeVenueId) REFERENCES Venues(Id)
    ON DELETE SET NULL
    PRINT 'Created FK_Clubs_Venues_HomeVenue'
END
GO

-- Create index for HomeVenueId
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Clubs_HomeVenueId' AND object_id = OBJECT_ID('Clubs'))
BEGIN
    CREATE INDEX IX_Clubs_HomeVenueId ON Clubs(HomeVenueId)
    PRINT 'Created index IX_Clubs_HomeVenueId'
END
GO

PRINT 'Migration 043: Add Home Venue to Clubs completed'
GO
