-- Migration 044: Import Pickleball Venues
-- Imports well-known pickleball venues, checking for duplicates by GPS coordinates

PRINT 'Starting Migration 044: Import Pickleball Venues'
GO

-- Helper function to check if venue exists within ~50 meters of given coordinates
-- Using a simple coordinate comparison (0.0005 degrees ≈ 55 meters at equator)
DECLARE @CoordTolerance FLOAT = 0.0005;

-- 1. Plantation Central Park (Pickleball Courts)
IF NOT EXISTS (
    SELECT 1 FROM Venues
    WHERE ABS(TRY_CAST(GPSLat AS FLOAT) - 26.127818) < @CoordTolerance
      AND ABS(TRY_CAST(GPSLng AS FLOAT) - (-80.2716685)) < @CoordTolerance
)
BEGIN
    INSERT INTO Venues (Name, Addr1, City, State, Zip, Country, GPSLat, GPSLng, OutdoorNum, Lights)
    VALUES (
        'Plantation Central Park (Pickleball Courts)',
        '9151 NW 2nd St',
        'Plantation',
        'FL',
        '33324',
        'USA',
        '26.127818',
        '-80.2716685',
        8, -- Estimated outdoor courts
        'Y'
    );
    PRINT 'Added: Plantation Central Park (Pickleball Courts)'
END
ELSE
BEGIN
    PRINT 'Skipped (duplicate): Plantation Central Park'
END
GO

-- 2. East Naples Community Park (USOP National Pickleball Center / US Open venue)
DECLARE @CoordTolerance FLOAT = 0.0005;
IF NOT EXISTS (
    SELECT 1 FROM Venues
    WHERE ABS(TRY_CAST(GPSLat AS FLOAT) - 26.106159682) < @CoordTolerance
      AND ABS(TRY_CAST(GPSLng AS FLOAT) - (-81.763739921)) < @CoordTolerance
)
BEGIN
    INSERT INTO Venues (Name, Addr1, City, State, Zip, Country, GPSLat, GPSLng, OutdoorNum, Lights)
    VALUES (
        'East Naples Community Park (USOP National Pickleball Center)',
        '3500 Thomasson Dr',
        'Naples',
        'FL',
        '34112',
        'USA',
        '26.106159682',
        '-81.763739921',
        64, -- Major tournament venue
        'Y'
    );
    PRINT 'Added: East Naples Community Park (USOP National Pickleball Center)'
END
ELSE
BEGIN
    PRINT 'Skipped (duplicate): East Naples Community Park'
END
GO

-- 3. Barnes Tennis Center (USA Pickleball Nationals venue)
DECLARE @CoordTolerance FLOAT = 0.0005;
IF NOT EXISTS (
    SELECT 1 FROM Venues
    WHERE ABS(TRY_CAST(GPSLat AS FLOAT) - 32.7543638) < @CoordTolerance
      AND ABS(TRY_CAST(GPSLng AS FLOAT) - (-117.2348861)) < @CoordTolerance
)
BEGIN
    INSERT INTO Venues (Name, Addr1, City, State, Zip, Country, GPSLat, GPSLng, OutdoorNum, Lights)
    VALUES (
        'Barnes Tennis Center (USA Pickleball Nationals)',
        '4490 W Point Loma Blvd',
        'San Diego',
        'CA',
        '92107',
        'USA',
        '32.7543638',
        '-117.2348861',
        24, -- Major tournament venue
        'Y'
    );
    PRINT 'Added: Barnes Tennis Center (USA Pickleball Nationals)'
END
ELSE
BEGIN
    PRINT 'Skipped (duplicate): Barnes Tennis Center'
END
GO

-- 4. The Fort (Fort Lauderdale Pickleball Club)
DECLARE @CoordTolerance FLOAT = 0.0005;
IF NOT EXISTS (
    SELECT 1 FROM Venues
    WHERE ABS(TRY_CAST(GPSLat AS FLOAT) - 26.0817592) < @CoordTolerance
      AND ABS(TRY_CAST(GPSLng AS FLOAT) - (-80.1510102)) < @CoordTolerance
)
BEGIN
    INSERT INTO Venues (Name, Addr1, City, State, Zip, Country, GPSLat, GPSLng, IndoorNum, Lights)
    VALUES (
        'The Fort (Fort Lauderdale Pickleball Club)',
        '891 Southwest 34th Street',
        'Fort Lauderdale',
        'FL',
        '33315',
        'USA',
        '26.0817592',
        '-80.1510102',
        12, -- Indoor facility
        'Y'
    );
    PRINT 'Added: The Fort (Fort Lauderdale Pickleball Club)'
END
ELSE
BEGIN
    PRINT 'Skipped (duplicate): The Fort'
END
GO

-- 5. Holiday Park (Pickleball Courts)
DECLARE @CoordTolerance FLOAT = 0.0005;
IF NOT EXISTS (
    SELECT 1 FROM Venues
    WHERE ABS(TRY_CAST(GPSLat AS FLOAT) - 26.133963) < @CoordTolerance
      AND ABS(TRY_CAST(GPSLng AS FLOAT) - (-80.132745)) < @CoordTolerance
)
BEGIN
    INSERT INTO Venues (Name, Addr1, City, State, Zip, Country, GPSLat, GPSLng, OutdoorNum, Lights)
    VALUES (
        'Holiday Park (Pickleball Courts)',
        '1150 G Harold Martin Dr',
        'Fort Lauderdale',
        'FL',
        '33304',
        'USA',
        '26.133963',
        '-80.132745',
        6, -- Estimated courts
        'Y'
    );
    PRINT 'Added: Holiday Park (Pickleball Courts)'
END
ELSE
BEGIN
    PRINT 'Skipped (duplicate): Holiday Park'
END
GO

-- 6. George English Park (Pickleball Courts)
DECLARE @CoordTolerance FLOAT = 0.0005;
IF NOT EXISTS (
    SELECT 1 FROM Venues
    WHERE ABS(TRY_CAST(GPSLat AS FLOAT) - 26.14054) < @CoordTolerance
      AND ABS(TRY_CAST(GPSLng AS FLOAT) - (-80.11586)) < @CoordTolerance
)
BEGIN
    INSERT INTO Venues (Name, Addr1, City, State, Zip, Country, GPSLat, GPSLng, OutdoorNum, Lights)
    VALUES (
        'George English Park (Pickleball Courts)',
        '1101 Bayview Dr',
        'Fort Lauderdale',
        'FL',
        '33304',
        'USA',
        '26.14054',
        '-80.11586',
        4, -- Estimated courts
        'Y'
    );
    PRINT 'Added: George English Park (Pickleball Courts)'
END
ELSE
BEGIN
    PRINT 'Skipped (duplicate): George English Park'
END
GO

-- 7. Benenson Park (Pickleball Courts)
DECLARE @CoordTolerance FLOAT = 0.0005;
IF NOT EXISTS (
    SELECT 1 FROM Venues
    WHERE ABS(TRY_CAST(GPSLat AS FLOAT) - 26.1035359) < @CoordTolerance
      AND ABS(TRY_CAST(GPSLng AS FLOAT) - (-80.190198)) < @CoordTolerance
)
BEGIN
    INSERT INTO Venues (Name, Addr1, City, State, Zip, Country, GPSLat, GPSLng, OutdoorNum, Lights)
    VALUES (
        'Benenson Park (Pickleball Courts)',
        '1330 SW 33rd Terrace',
        'Fort Lauderdale',
        'FL',
        '33312',
        'USA',
        '26.1035359',
        '-80.190198',
        4, -- Estimated courts
        'Y'
    );
    PRINT 'Added: Benenson Park (Pickleball Courts)'
END
ELSE
BEGIN
    PRINT 'Skipped (duplicate): Benenson Park'
END
GO

-- 8. Pictona at Holly Hill
DECLARE @CoordTolerance FLOAT = 0.0005;
IF NOT EXISTS (
    SELECT 1 FROM Venues
    WHERE ABS(TRY_CAST(GPSLat AS FLOAT) - 29.244535) < @CoordTolerance
      AND ABS(TRY_CAST(GPSLng AS FLOAT) - (-81.04128)) < @CoordTolerance
)
BEGIN
    INSERT INTO Venues (Name, Addr1, City, State, Zip, Country, GPSLat, GPSLng, OutdoorNum, CoveredNum, Lights)
    VALUES (
        'Pictona at Holly Hill',
        '1060 Ridgewood Ave',
        'Holly Hill',
        'FL',
        '32117',
        'USA',
        '29.244535',
        '-81.04128',
        24, -- Major dedicated pickleball facility
        8,  -- Some covered courts
        'Y'
    );
    PRINT 'Added: Pictona at Holly Hill'
END
ELSE
BEGIN
    PRINT 'Skipped (duplicate): Pictona at Holly Hill'
END
GO

PRINT 'Migration 044: Import Pickleball Venues completed'
GO
