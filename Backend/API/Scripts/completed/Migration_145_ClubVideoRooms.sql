-- Migration 145: Club Video Rooms
-- Add ClubId and IsClubRoom to VideoRooms for persistent club video rooms

-- Add ClubId to VideoRooms
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('VideoRooms') AND name = 'ClubId')
BEGIN
    ALTER TABLE VideoRooms ADD ClubId INT NULL;
    ALTER TABLE VideoRooms ADD CONSTRAINT FK_VideoRooms_ClubId FOREIGN KEY (ClubId) REFERENCES Clubs(Id);
    PRINT 'Added ClubId to VideoRooms';
END

-- Add index
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VideoRooms_ClubId')
BEGIN
    CREATE INDEX IX_VideoRooms_ClubId ON VideoRooms(ClubId) WHERE ClubId IS NOT NULL;
END

-- Add IsClubRoom flag (persistent rooms don't auto-expire)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('VideoRooms') AND name = 'IsClubRoom')
BEGIN
    ALTER TABLE VideoRooms ADD IsClubRoom BIT NOT NULL DEFAULT 0;
    PRINT 'Added IsClubRoom to VideoRooms';
END
