-- Migration 037: Create stored procedure for getting top courts for event creation
-- Returns top 10 courts based on user history, preferences, and GPS location

PRINT 'Starting Migration 037: Top Courts for Events procedure'
GO

IF OBJECT_ID('dbo.sp_GetTopCourtsForUser', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetTopCourtsForUser;
GO

CREATE PROCEDURE dbo.sp_GetTopCourtsForUser
    @UserId INT,
    @Latitude FLOAT = NULL,
    @Longitude FLOAT = NULL,
    @TopN INT = 10
AS
BEGIN
    SET NOCOUNT ON;

    -- Calculate distance if GPS coordinates provided
    -- Using Haversine formula approximation for miles
    DECLARE @EarthRadiusMiles FLOAT = 3959.0;

    SELECT TOP (@TopN)
        c.Id AS CourtId,
        c.Name AS CourtName,
        c.City,
        c.State,
        c.Country,
        c.Addr1 AS Address,
        c.[ZIP] AS Zip,
        CAST(c.GPSLat AS FLOAT) AS Latitude,
        CAST(c.GPSLng AS FLOAT) AS Longitude,
        c.Indoor_Num AS IndoorCourts,
        c.Outdoor_Num AS OutdoorCourts,
        c.Lights AS HasLights,
        ct.Name AS CourtTypeName,
        -- Calculate distance if GPS provided
        CASE
            WHEN @Latitude IS NOT NULL AND @Longitude IS NOT NULL
                 AND c.GPSLat IS NOT NULL AND c.GPSLng IS NOT NULL
                 AND TRY_CAST(c.GPSLat AS FLOAT) IS NOT NULL
                 AND TRY_CAST(c.GPSLng AS FLOAT) IS NOT NULL
            THEN @EarthRadiusMiles * 2 * ASIN(SQRT(
                POWER(SIN((RADIANS(TRY_CAST(c.GPSLat AS FLOAT)) - RADIANS(@Latitude)) / 2), 2) +
                COS(RADIANS(@Latitude)) * COS(RADIANS(TRY_CAST(c.GPSLat AS FLOAT))) *
                POWER(SIN((RADIANS(TRY_CAST(c.GPSLng AS FLOAT)) - RADIANS(@Longitude)) / 2), 2)
            ))
            ELSE NULL
        END AS DistanceMiles,
        -- Priority score: combination of user history, confirmations, and distance
        (
            -- Events previously organized at this court by user (highest priority)
            ISNULL((SELECT COUNT(*) * 100 FROM Events e WHERE e.CourtId = c.Id AND e.OrganizedByUserId = @UserId), 0) +
            -- Events user registered for at this court
            ISNULL((SELECT COUNT(*) * 50 FROM EventRegistrations er
                    INNER JOIN Events e ON er.EventId = e.Id
                    WHERE e.CourtId = c.Id AND er.UserId = @UserId), 0) +
            -- User's confirmation of this court
            ISNULL((SELECT COUNT(*) * 30 FROM CourtConfirmations cc WHERE cc.CourtId = c.Id AND cc.UserId = @UserId), 0) +
            -- General court popularity (events count)
            ISNULL((SELECT COUNT(*) * 5 FROM Events e WHERE e.CourtId = c.Id AND e.IsActive = 1), 0) +
            -- Total confirmations (popularity indicator)
            ISNULL((SELECT COUNT(*) FROM CourtConfirmations cc WHERE cc.CourtId = c.Id), 0) +
            -- Distance bonus (closer = higher priority, max 50 points)
            CASE
                WHEN @Latitude IS NOT NULL AND @Longitude IS NOT NULL
                     AND c.GPSLat IS NOT NULL AND c.GPSLng IS NOT NULL
                     AND TRY_CAST(c.GPSLat AS FLOAT) IS NOT NULL
                     AND TRY_CAST(c.GPSLng AS FLOAT) IS NOT NULL
                THEN 50 - (
                    CASE
                        WHEN (@EarthRadiusMiles * 2 * ASIN(SQRT(
                            POWER(SIN((RADIANS(TRY_CAST(c.GPSLat AS FLOAT)) - RADIANS(@Latitude)) / 2), 2) +
                            COS(RADIANS(@Latitude)) * COS(RADIANS(TRY_CAST(c.GPSLat AS FLOAT))) *
                            POWER(SIN((RADIANS(TRY_CAST(c.GPSLng AS FLOAT)) - RADIANS(@Longitude)) / 2), 2)
                        )) / 2) > 50 THEN 50
                        ELSE (@EarthRadiusMiles * 2 * ASIN(SQRT(
                            POWER(SIN((RADIANS(TRY_CAST(c.GPSLat AS FLOAT)) - RADIANS(@Latitude)) / 2), 2) +
                            COS(RADIANS(@Latitude)) * COS(RADIANS(TRY_CAST(c.GPSLat AS FLOAT))) *
                            POWER(SIN((RADIANS(TRY_CAST(c.GPSLng AS FLOAT)) - RADIANS(@Longitude)) / 2), 2)
                        )) / 2)
                    END
                )  -- 100 miles = 0 bonus, 0 miles = 50 bonus
                ELSE 0
            END
        ) AS PriorityScore
    FROM Courts c
    LEFT JOIN CourtTypes ct ON c.CourtTypeId = ct.Id
    WHERE c.Name IS NOT NULL
      AND LEN(LTRIM(RTRIM(c.Name))) > 0
    ORDER BY
        -- First, courts with user history
        CASE WHEN EXISTS(SELECT 1 FROM Events e WHERE e.CourtId = c.Id AND e.OrganizedByUserId = @UserId) THEN 0 ELSE 1 END,
        -- Then by priority score
        (
            ISNULL((SELECT COUNT(*) * 100 FROM Events e WHERE e.CourtId = c.Id AND e.OrganizedByUserId = @UserId), 0) +
            ISNULL((SELECT COUNT(*) * 50 FROM EventRegistrations er
                    INNER JOIN Events e ON er.EventId = e.Id
                    WHERE e.CourtId = c.Id AND er.UserId = @UserId), 0) +
            ISNULL((SELECT COUNT(*) * 30 FROM CourtConfirmations cc WHERE cc.CourtId = c.Id AND cc.UserId = @UserId), 0) +
            ISNULL((SELECT COUNT(*) * 5 FROM Events e WHERE e.CourtId = c.Id AND e.IsActive = 1), 0) +
            ISNULL((SELECT COUNT(*) FROM CourtConfirmations cc WHERE cc.CourtId = c.Id), 0) +
            CASE
                WHEN @Latitude IS NOT NULL AND @Longitude IS NOT NULL
                     AND c.GPSLat IS NOT NULL AND c.GPSLng IS NOT NULL
                     AND TRY_CAST(c.GPSLat AS FLOAT) IS NOT NULL
                     AND TRY_CAST(c.GPSLng AS FLOAT) IS NOT NULL
                THEN 50 - (
                    CASE
                        WHEN (@EarthRadiusMiles * 2 * ASIN(SQRT(
                            POWER(SIN((RADIANS(TRY_CAST(c.GPSLat AS FLOAT)) - RADIANS(@Latitude)) / 2), 2) +
                            COS(RADIANS(@Latitude)) * COS(RADIANS(TRY_CAST(c.GPSLat AS FLOAT))) *
                            POWER(SIN((RADIANS(TRY_CAST(c.GPSLng AS FLOAT)) - RADIANS(@Longitude)) / 2), 2)
                        )) / 2) > 50 THEN 50
                        ELSE (@EarthRadiusMiles * 2 * ASIN(SQRT(
                            POWER(SIN((RADIANS(TRY_CAST(c.GPSLat AS FLOAT)) - RADIANS(@Latitude)) / 2), 2) +
                            COS(RADIANS(@Latitude)) * COS(RADIANS(TRY_CAST(c.GPSLat AS FLOAT))) *
                            POWER(SIN((RADIANS(TRY_CAST(c.GPSLng AS FLOAT)) - RADIANS(@Longitude)) / 2), 2)
                        )) / 2)
                    END
                )
                ELSE 0
            END
        ) DESC,
        -- Finally by distance if GPS provided
        CASE
            WHEN @Latitude IS NOT NULL AND @Longitude IS NOT NULL
                 AND c.GPSLat IS NOT NULL AND c.GPSLng IS NOT NULL
                 AND TRY_CAST(c.GPSLat AS FLOAT) IS NOT NULL
                 AND TRY_CAST(c.GPSLng AS FLOAT) IS NOT NULL
            THEN @EarthRadiusMiles * 2 * ASIN(SQRT(
                POWER(SIN((RADIANS(TRY_CAST(c.GPSLat AS FLOAT)) - RADIANS(@Latitude)) / 2), 2) +
                COS(RADIANS(@Latitude)) * COS(RADIANS(TRY_CAST(c.GPSLat AS FLOAT))) *
                POWER(SIN((RADIANS(TRY_CAST(c.GPSLng AS FLOAT)) - RADIANS(@Longitude)) / 2), 2)
            ))
            ELSE 999999
        END ASC,
        c.Name ASC;
END
GO

PRINT 'Created sp_GetTopCourtsForUser procedure'
GO

PRINT 'Migration 037 completed successfully'
GO
