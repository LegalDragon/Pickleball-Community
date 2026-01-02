-- Migration 044: Import Pickleball Venues
-- Imports well-known pickleball venues, updating existing ones if GPS matches

PRINT 'Starting Migration 044: Import Pickleball Venues'
GO

-- Helper: coordinate tolerance (0.0005 degrees ≈ 55 meters at equator)
DECLARE @CoordTolerance FLOAT = 0.0005;
DECLARE @ExistingId INT;

-- 1. Plantation Central Park (Pickleball Courts)
SELECT @ExistingId = Id FROM Venues
WHERE ABS(TRY_CAST(GPSLat AS FLOAT) - 26.127818) < @CoordTolerance
  AND ABS(TRY_CAST(GPSLng AS FLOAT) - (-80.2716685)) < @CoordTolerance;

IF @ExistingId IS NOT NULL
BEGIN
    UPDATE Venues SET
        Name = 'Plantation Central Park (Pickleball Courts)',
        Addr1 = '9151 NW 2nd St',
        City = 'Plantation',
        State = 'FL',
        Zip = '33324',
        Country = 'USA'
    WHERE Id = @ExistingId;
    PRINT 'Updated: Plantation Central Park (Pickleball Courts)'
END
ELSE
BEGIN
    INSERT INTO Venues (Name, Addr1, City, State, Zip, Country, GPSLat, GPSLng, Outdoor_Num, Lights)
    VALUES (
        'Plantation Central Park (Pickleball Courts)',
        '9151 NW 2nd St',
        'Plantation',
        'FL',
        '33324',
        'USA',
        '26.127818',
        '-80.2716685',
        8,
        'Y'
    );
    PRINT 'Added: Plantation Central Park (Pickleball Courts)'
END
GO

-- 2. East Naples Community Park (USOP National Pickleball Center / US Open venue)
DECLARE @CoordTolerance FLOAT = 0.0005;
DECLARE @ExistingId INT;

SELECT @ExistingId = Id FROM Venues
WHERE ABS(TRY_CAST(GPSLat AS FLOAT) - 26.106159682) < @CoordTolerance
  AND ABS(TRY_CAST(GPSLng AS FLOAT) - (-81.763739921)) < @CoordTolerance;

IF @ExistingId IS NOT NULL
BEGIN
    UPDATE Venues SET
        Name = 'East Naples Community Park (USOP National Pickleball Center)',
        Addr1 = '3500 Thomasson Dr',
        City = 'Naples',
        State = 'FL',
        Zip = '34112',
        Country = 'USA'
    WHERE Id = @ExistingId;
    PRINT 'Updated: East Naples Community Park (USOP National Pickleball Center)'
END
ELSE
BEGIN
    INSERT INTO Venues (Name, Addr1, City, State, Zip, Country, GPSLat, GPSLng, Outdoor_Num, Lights)
    VALUES (
        'East Naples Community Park (USOP National Pickleball Center)',
        '3500 Thomasson Dr',
        'Naples',
        'FL',
        '34112',
        'USA',
        '26.106159682',
        '-81.763739921',
        64,
        'Y'
    );
    PRINT 'Added: East Naples Community Park (USOP National Pickleball Center)'
END
GO

-- 3. Barnes Tennis Center (USA Pickleball Nationals venue)
DECLARE @CoordTolerance FLOAT = 0.0005;
DECLARE @ExistingId INT;

SELECT @ExistingId = Id FROM Venues
WHERE ABS(TRY_CAST(GPSLat AS FLOAT) - 32.7543638) < @CoordTolerance
  AND ABS(TRY_CAST(GPSLng AS FLOAT) - (-117.2348861)) < @CoordTolerance;

IF @ExistingId IS NOT NULL
BEGIN
    UPDATE Venues SET
        Name = 'Barnes Tennis Center (USA Pickleball Nationals)',
        Addr1 = '4490 W Point Loma Blvd',
        City = 'San Diego',
        State = 'CA',
        Zip = '92107',
        Country = 'USA'
    WHERE Id = @ExistingId;
    PRINT 'Updated: Barnes Tennis Center (USA Pickleball Nationals)'
END
ELSE
BEGIN
    INSERT INTO Venues (Name, Addr1, City, State, Zip, Country, GPSLat, GPSLng, Outdoor_Num, Lights)
    VALUES (
        'Barnes Tennis Center (USA Pickleball Nationals)',
        '4490 W Point Loma Blvd',
        'San Diego',
        'CA',
        '92107',
        'USA',
        '32.7543638',
        '-117.2348861',
        24,
        'Y'
    );
    PRINT 'Added: Barnes Tennis Center (USA Pickleball Nationals)'
END
GO

-- 4. The Fort (Fort Lauderdale Pickleball Club)
DECLARE @CoordTolerance FLOAT = 0.0005;
DECLARE @ExistingId INT;

SELECT @ExistingId = Id FROM Venues
WHERE ABS(TRY_CAST(GPSLat AS FLOAT) - 26.0817592) < @CoordTolerance
  AND ABS(TRY_CAST(GPSLng AS FLOAT) - (-80.1510102)) < @CoordTolerance;

IF @ExistingId IS NOT NULL
BEGIN
    UPDATE Venues SET
        Name = 'The Fort (Fort Lauderdale Pickleball Club)',
        Addr1 = '891 Southwest 34th Street',
        City = 'Fort Lauderdale',
        State = 'FL',
        Zip = '33315',
        Country = 'USA'
    WHERE Id = @ExistingId;
    PRINT 'Updated: The Fort (Fort Lauderdale Pickleball Club)'
END
ELSE
BEGIN
    INSERT INTO Venues (Name, Addr1, City, State, Zip, Country, GPSLat, GPSLng, Indoor_Num, Lights)
    VALUES (
        'The Fort (Fort Lauderdale Pickleball Club)',
        '891 Southwest 34th Street',
        'Fort Lauderdale',
        'FL',
        '33315',
        'USA',
        '26.0817592',
        '-80.1510102',
        12,
        'Y'
    );
    PRINT 'Added: The Fort (Fort Lauderdale Pickleball Club)'
END
GO

-- 5. Holiday Park (Pickleball Courts)
DECLARE @CoordTolerance FLOAT = 0.0005;
DECLARE @ExistingId INT;

SELECT @ExistingId = Id FROM Venues
WHERE ABS(TRY_CAST(GPSLat AS FLOAT) - 26.133963) < @CoordTolerance
  AND ABS(TRY_CAST(GPSLng AS FLOAT) - (-80.132745)) < @CoordTolerance;

IF @ExistingId IS NOT NULL
BEGIN
    UPDATE Venues SET
        Name = 'Holiday Park (Pickleball Courts)',
        Addr1 = '1150 G Harold Martin Dr',
        City = 'Fort Lauderdale',
        State = 'FL',
        Zip = '33304',
        Country = 'USA'
    WHERE Id = @ExistingId;
    PRINT 'Updated: Holiday Park (Pickleball Courts)'
END
ELSE
BEGIN
    INSERT INTO Venues (Name, Addr1, City, State, Zip, Country, GPSLat, GPSLng, Outdoor_Num, Lights)
    VALUES (
        'Holiday Park (Pickleball Courts)',
        '1150 G Harold Martin Dr',
        'Fort Lauderdale',
        'FL',
        '33304',
        'USA',
        '26.133963',
        '-80.132745',
        6,
        'Y'
    );
    PRINT 'Added: Holiday Park (Pickleball Courts)'
END
GO

-- 6. George English Park (Pickleball Courts)
DECLARE @CoordTolerance FLOAT = 0.0005;
DECLARE @ExistingId INT;

SELECT @ExistingId = Id FROM Venues
WHERE ABS(TRY_CAST(GPSLat AS FLOAT) - 26.14054) < @CoordTolerance
  AND ABS(TRY_CAST(GPSLng AS FLOAT) - (-80.11586)) < @CoordTolerance;

IF @ExistingId IS NOT NULL
BEGIN
    UPDATE Venues SET
        Name = 'George English Park (Pickleball Courts)',
        Addr1 = '1101 Bayview Dr',
        City = 'Fort Lauderdale',
        State = 'FL',
        Zip = '33304',
        Country = 'USA'
    WHERE Id = @ExistingId;
    PRINT 'Updated: George English Park (Pickleball Courts)'
END
ELSE
BEGIN
    INSERT INTO Venues (Name, Addr1, City, State, Zip, Country, GPSLat, GPSLng, Outdoor_Num, Lights)
    VALUES (
        'George English Park (Pickleball Courts)',
        '1101 Bayview Dr',
        'Fort Lauderdale',
        'FL',
        '33304',
        'USA',
        '26.14054',
        '-80.11586',
        4,
        'Y'
    );
    PRINT 'Added: George English Park (Pickleball Courts)'
END
GO

-- 7. Benenson Park (Pickleball Courts)
DECLARE @CoordTolerance FLOAT = 0.0005;
DECLARE @ExistingId INT;

SELECT @ExistingId = Id FROM Venues
WHERE ABS(TRY_CAST(GPSLat AS FLOAT) - 26.1035359) < @CoordTolerance
  AND ABS(TRY_CAST(GPSLng AS FLOAT) - (-80.190198)) < @CoordTolerance;

IF @ExistingId IS NOT NULL
BEGIN
    UPDATE Venues SET
        Name = 'Benenson Park (Pickleball Courts)',
        Addr1 = '1330 SW 33rd Terrace',
        City = 'Fort Lauderdale',
        State = 'FL',
        Zip = '33312',
        Country = 'USA'
    WHERE Id = @ExistingId;
    PRINT 'Updated: Benenson Park (Pickleball Courts)'
END
ELSE
BEGIN
    INSERT INTO Venues (Name, Addr1, City, State, Zip, Country, GPSLat, GPSLng, Outdoor_Num, Lights)
    VALUES (
        'Benenson Park (Pickleball Courts)',
        '1330 SW 33rd Terrace',
        'Fort Lauderdale',
        'FL',
        '33312',
        'USA',
        '26.1035359',
        '-80.190198',
        4,
        'Y'
    );
    PRINT 'Added: Benenson Park (Pickleball Courts)'
END
GO

-- 8. Pictona at Holly Hill
DECLARE @CoordTolerance FLOAT = 0.0005;
DECLARE @ExistingId INT;

SELECT @ExistingId = Id FROM Venues
WHERE ABS(TRY_CAST(GPSLat AS FLOAT) - 29.244535) < @CoordTolerance
  AND ABS(TRY_CAST(GPSLng AS FLOAT) - (-81.04128)) < @CoordTolerance;

IF @ExistingId IS NOT NULL
BEGIN
    UPDATE Venues SET
        Name = 'Pictona at Holly Hill',
        Addr1 = '1060 Ridgewood Ave',
        City = 'Holly Hill',
        State = 'FL',
        Zip = '32117',
        Country = 'USA'
    WHERE Id = @ExistingId;
    PRINT 'Updated: Pictona at Holly Hill'
END
ELSE
BEGIN
    INSERT INTO Venues (Name, Addr1, City, State, Zip, Country, GPSLat, GPSLng, Outdoor_Num, Covered_Num, Lights)
    VALUES (
        'Pictona at Holly Hill',
        '1060 Ridgewood Ave',
        'Holly Hill',
        'FL',
        '32117',
        'USA',
        '29.244535',
        '-81.04128',
        24,
        8,
        'Y'
    );
    PRINT 'Added: Pictona at Holly Hill'
END
GO

PRINT 'Migration 044: Import Pickleball Venues completed'
GO
