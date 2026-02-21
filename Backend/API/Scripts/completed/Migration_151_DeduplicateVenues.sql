-- Migration 151: Deduplicate Venues
-- Finds venues within ~50 meters of each other and rejects the worse duplicates
-- Keeps the venue with: real name > verified > more data > higher rating

PRINT 'Starting Migration 151: Deduplicate Venues'
GO

-- First, let's see what we're dealing with
DECLARE @DuplicateClusters TABLE (
    ClusterId INT,
    VenueId INT,
    Name NVARCHAR(200),
    Latitude FLOAT,
    Longitude FLOAT,
    DataQuality TINYINT,
    VerificationCount INT,
    HasRealName BIT,
    HasCourts BIT,
    Score INT
);

-- Find all venues with valid coordinates
WITH VenuesWithCoords AS (
    SELECT 
        Id AS VenueId,
        Name,
        CASE WHEN ISNUMERIC(GPSLat) = 1 THEN CAST(GPSLat AS FLOAT) ELSE NULL END AS Latitude,
        CASE WHEN ISNUMERIC(GPSLng) = 1 THEN CAST(GPSLng AS FLOAT) ELSE NULL END AS Longitude,
        DataQuality,
        VerificationCount,
        CASE WHEN Name IS NOT NULL AND Name != '' AND Name != 'Unnamed' AND Name != 'Unnamed Venue' THEN 1 ELSE 0 END AS HasRealName,
        CASE WHEN ISNULL(Indoor_Num, 0) + ISNULL(Outdoor_Num, 0) + ISNULL(Covered_Num, 0) > 0 THEN 1 ELSE 0 END AS HasCourts
    FROM Venues
    WHERE DataQuality < 3  -- Not already rejected
),
-- Find duplicate pairs (within ~50 meters ≈ 0.00045 degrees at equator)
DuplicatePairs AS (
    SELECT 
        v1.VenueId AS VenueId1,
        v2.VenueId AS VenueId2,
        v1.Name AS Name1,
        v2.Name AS Name2,
        v1.Latitude,
        v1.Longitude
    FROM VenuesWithCoords v1
    JOIN VenuesWithCoords v2 ON v1.VenueId < v2.VenueId
    WHERE v1.Latitude IS NOT NULL 
      AND v1.Longitude IS NOT NULL
      AND v2.Latitude IS NOT NULL
      AND v2.Longitude IS NOT NULL
      AND ABS(v1.Latitude - v2.Latitude) < 0.00045
      AND ABS(v1.Longitude - v2.Longitude) < 0.00045
)
SELECT 
    COUNT(*) AS DuplicatePairsFound
FROM DuplicatePairs;
GO

-- Now let's do the actual deduplication
-- Score each venue: higher score = better venue to keep
-- Score components:
--   +100 if has real name
--   +50 if verified (VerificationCount > 0)
--   +25 if DataQuality = 1 (Confirmed)
--   +10 if has court counts
--   +VerificationCount (raw count as tiebreaker)

WITH VenuesWithCoords AS (
    SELECT 
        Id AS VenueId,
        Name,
        CASE WHEN ISNUMERIC(GPSLat) = 1 THEN CAST(GPSLat AS FLOAT) ELSE NULL END AS Latitude,
        CASE WHEN ISNUMERIC(GPSLng) = 1 THEN CAST(GPSLng AS FLOAT) ELSE NULL END AS Longitude,
        DataQuality,
        VerificationCount,
        CASE WHEN Name IS NOT NULL AND LTRIM(RTRIM(Name)) != '' AND Name != 'Unnamed' AND Name != 'Unnamed Venue' THEN 1 ELSE 0 END AS HasRealName,
        CASE WHEN ISNULL(Indoor_Num, 0) + ISNULL(Outdoor_Num, 0) + ISNULL(Covered_Num, 0) > 0 THEN 1 ELSE 0 END AS HasCourts,
        -- Calculate score
        CASE WHEN Name IS NOT NULL AND LTRIM(RTRIM(Name)) != '' AND Name != 'Unnamed' AND Name != 'Unnamed Venue' THEN 100 ELSE 0 END
        + CASE WHEN VerificationCount > 0 THEN 50 ELSE 0 END
        + CASE WHEN DataQuality = 1 THEN 25 ELSE 0 END
        + CASE WHEN ISNULL(Indoor_Num, 0) + ISNULL(Outdoor_Num, 0) + ISNULL(Covered_Num, 0) > 0 THEN 10 ELSE 0 END
        + ISNULL(VerificationCount, 0)
        AS Score
    FROM Venues
    WHERE DataQuality < 3  -- Not already rejected
),
-- Find duplicate pairs
DuplicatePairs AS (
    SELECT 
        v1.VenueId AS VenueId1,
        v1.Name AS Name1,
        v1.Score AS Score1,
        v2.VenueId AS VenueId2,
        v2.Name AS Name2,
        v2.Score AS Score2
    FROM VenuesWithCoords v1
    JOIN VenuesWithCoords v2 ON v1.VenueId < v2.VenueId
    WHERE v1.Latitude IS NOT NULL 
      AND v1.Longitude IS NOT NULL
      AND v2.Latitude IS NOT NULL
      AND v2.Longitude IS NOT NULL
      AND ABS(v1.Latitude - v2.Latitude) < 0.00045
      AND ABS(v1.Longitude - v2.Longitude) < 0.00045
),
-- Determine which venue to reject (lower score loses)
VenuesToReject AS (
    SELECT 
        CASE WHEN Score1 >= Score2 THEN VenueId2 ELSE VenueId1 END AS RejectVenueId,
        CASE WHEN Score1 >= Score2 THEN Name2 ELSE Name1 END AS RejectName,
        CASE WHEN Score1 >= Score2 THEN VenueId1 ELSE VenueId2 END AS KeepVenueId,
        CASE WHEN Score1 >= Score2 THEN Name1 ELSE Name2 END AS KeepName
    FROM DuplicatePairs
)
-- Show what will be rejected
SELECT 
    RejectVenueId,
    RejectName AS [Rejecting],
    KeepVenueId,
    KeepName AS [Keeping]
FROM VenuesToReject
ORDER BY KeepName, RejectName;
GO

-- Actually reject the duplicates
PRINT 'Rejecting duplicate venues...'

DECLARE @RejectedCount INT = 0;

WITH VenuesWithCoords AS (
    SELECT 
        Id AS VenueId,
        Name,
        CASE WHEN ISNUMERIC(GPSLat) = 1 THEN CAST(GPSLat AS FLOAT) ELSE NULL END AS Latitude,
        CASE WHEN ISNUMERIC(GPSLng) = 1 THEN CAST(GPSLng AS FLOAT) ELSE NULL END AS Longitude,
        DataQuality,
        VerificationCount,
        -- Calculate score
        CASE WHEN Name IS NOT NULL AND LTRIM(RTRIM(Name)) != '' AND Name != 'Unnamed' AND Name != 'Unnamed Venue' THEN 100 ELSE 0 END
        + CASE WHEN VerificationCount > 0 THEN 50 ELSE 0 END
        + CASE WHEN DataQuality = 1 THEN 25 ELSE 0 END
        + CASE WHEN ISNULL(Indoor_Num, 0) + ISNULL(Outdoor_Num, 0) + ISNULL(Covered_Num, 0) > 0 THEN 10 ELSE 0 END
        + ISNULL(VerificationCount, 0)
        AS Score
    FROM Venues
    WHERE DataQuality < 3
),
DuplicatePairs AS (
    SELECT 
        v1.VenueId AS VenueId1,
        v1.Score AS Score1,
        v2.VenueId AS VenueId2,
        v2.Score AS Score2
    FROM VenuesWithCoords v1
    JOIN VenuesWithCoords v2 ON v1.VenueId < v2.VenueId
    WHERE v1.Latitude IS NOT NULL 
      AND v1.Longitude IS NOT NULL
      AND v2.Latitude IS NOT NULL
      AND v2.Longitude IS NOT NULL
      AND ABS(v1.Latitude - v2.Latitude) < 0.00045
      AND ABS(v1.Longitude - v2.Longitude) < 0.00045
),
VenuesToReject AS (
    SELECT DISTINCT
        CASE WHEN Score1 >= Score2 THEN VenueId2 ELSE VenueId1 END AS RejectVenueId
    FROM DuplicatePairs
)
UPDATE Venues
SET DataQuality = 3  -- Rejected
WHERE Id IN (SELECT RejectVenueId FROM VenuesToReject);

SET @RejectedCount = @@ROWCOUNT;
PRINT 'Rejected ' + CAST(@RejectedCount AS VARCHAR) + ' duplicate venues';
GO

-- Also reject venues with obviously bad data that weren't caught before
PRINT 'Rejecting venues with bad data...'

-- Venues at exactly 0,0 (null island)
UPDATE Venues
SET DataQuality = 3
WHERE DataQuality < 3
  AND ISNUMERIC(GPSLat) = 1 AND ISNUMERIC(GPSLng) = 1
  AND ABS(CAST(GPSLat AS FLOAT)) < 0.1 
  AND ABS(CAST(GPSLng AS FLOAT)) < 0.1;

PRINT 'Rejected ' + CAST(@@ROWCOUNT AS VARCHAR) + ' venues at null island (0,0)';
GO

-- Summary
SELECT 
    DataQuality,
    CASE DataQuality 
        WHEN 0 THEN 'Unverified'
        WHEN 1 THEN 'Confirmed'
        WHEN 2 THEN 'Flagged'
        WHEN 3 THEN 'Rejected'
    END AS Status,
    COUNT(*) AS VenueCount
FROM Venues
GROUP BY DataQuality
ORDER BY DataQuality;
GO

PRINT 'Migration 151 completed successfully'
GO
