-- Migration 025: Add Country filter to sp_SearchCourts
-- Allows filtering courts by country in the full search

PRINT 'Starting Migration 025: Add Country filter to sp_SearchCourts';
GO

-- Drop and recreate the stored procedure with Country parameter
IF OBJECT_ID('dbo.sp_SearchCourts', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_SearchCourts;
GO

-- Updated stored procedure to search courts (includes Country filter)
CREATE PROCEDURE dbo.sp_SearchCourts
    @Query NVARCHAR(100) = NULL,
    @Country NVARCHAR(20) = NULL,
    @State NVARCHAR(50) = NULL,
    @City NVARCHAR(50) = NULL,
    @HasLights BIT = NULL,
    @IsIndoor BIT = NULL,
    @UserLat FLOAT = NULL,
    @UserLng FLOAT = NULL,
    @RadiusMiles FLOAT = NULL,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    DECLARE @NotACourtThreshold INT = 3; -- Courts with this many "not a court" votes are hidden

    -- Handle 'Unknown' country/state as NULL
    DECLARE @SearchCountry NVARCHAR(20) = CASE WHEN @Country = 'Unknown' THEN NULL ELSE @Country END;
    DECLARE @SearchState NVARCHAR(50) = CASE WHEN @State = 'Unknown' THEN NULL ELSE @State END;

    ;WITH NotACourtCounts AS (
        -- Count how many users flagged each court as "not a court"
        SELECT CourtId, COUNT(*) AS NotACourtCount
        FROM CourtConfirmations
        WHERE NotACourt = 1
        GROUP BY CourtId
    ),
    CourtsWithDistance AS (
        SELECT
            c.Id,
            c.Name,
            c.Addr1,
            c.Addr2,
            c.City,
            c.County,
            c.State,
            c.ZIP,
            c.Country,
            c.Phone,
            c.WWW AS Website,
            c.EMail AS Email,
            c.Indoor_Num,
            c.Outdoor_Num,
            c.Covered_Num,
            c.Lights,
            c.GPSLat,
            c.GPSLng,
            ISNULL(nac.NotACourtCount, 0) AS NotACourtCount,
            CASE
                WHEN @UserLat IS NOT NULL AND @UserLng IS NOT NULL
                     AND c.GPSLat IS NOT NULL AND c.GPSLng IS NOT NULL
                     AND TRY_CAST(c.GPSLat AS FLOAT) IS NOT NULL
                     AND TRY_CAST(c.GPSLng AS FLOAT) IS NOT NULL
                THEN dbo.fn_CalculateDistanceMiles(
                    @UserLat,
                    @UserLng,
                    TRY_CAST(c.GPSLat AS FLOAT),
                    TRY_CAST(c.GPSLng AS FLOAT)
                )
                ELSE NULL
            END AS Distance
        FROM Courts c
        LEFT JOIN NotACourtCounts nac ON c.Id = nac.CourtId
        WHERE
            -- Exclude courts flagged as "not a court" by 3+ users
            ISNULL(nac.NotACourtCount, 0) < @NotACourtThreshold
            -- Country filter (handle NULL matching)
            AND (@Country IS NULL OR
                 (@SearchCountry IS NULL AND c.Country IS NULL) OR
                 c.Country = @SearchCountry)
            -- State filter (handle NULL matching)
            AND (@State IS NULL OR
                 (@SearchState IS NULL AND c.State IS NULL) OR
                 c.State = @SearchState)
            -- City filter (case-insensitive)
            AND (@City IS NULL OR c.City LIKE '%' + @City + '%')
            -- Lights filter
            AND (@HasLights IS NULL OR @HasLights = 0 OR c.Lights = 'Y')
            -- Indoor filter
            AND (@IsIndoor IS NULL OR @IsIndoor = 0 OR c.Indoor_Num > 0)
            -- Text search
            AND (@Query IS NULL OR
                 c.Name LIKE '%' + @Query + '%' OR
                 c.City LIKE '%' + @Query + '%' OR
                 c.Addr1 LIKE '%' + @Query + '%')
    ),
    FilteredCourts AS (
        SELECT *
        FROM CourtsWithDistance
        WHERE
            @UserLat IS NULL OR @UserLng IS NULL OR @RadiusMiles IS NULL
            OR Distance IS NULL OR Distance <= @RadiusMiles
    ),
    TotalCount AS (
        SELECT COUNT(*) AS Total FROM FilteredCourts
    )
    SELECT
        fc.Id AS CourtId,
        fc.Name,
        LTRIM(RTRIM(COALESCE(fc.Addr1, '') + ' ' + COALESCE(fc.Addr2, ''))) AS Address,
        fc.City,
        fc.County,
        fc.State,
        fc.ZIP AS Zip,
        fc.Country,
        fc.Phone,
        fc.Website,
        fc.Email,
        fc.Indoor_Num AS IndoorNum,
        fc.Outdoor_Num AS OutdoorNum,
        fc.Covered_Num AS CoveredNum,
        CASE WHEN fc.Lights = 'Y' THEN 1 ELSE 0 END AS HasLights,
        TRY_CAST(fc.GPSLat AS FLOAT) AS Latitude,
        TRY_CAST(fc.GPSLng AS FLOAT) AS Longitude,
        fc.Distance,
        tc.Total AS TotalCount,
        fc.NotACourtCount,
        -- Aggregated confirmation data
        (SELECT COUNT(*) FROM CourtConfirmations cc WHERE cc.CourtId = fc.Id) AS ConfirmationCount,
        (SELECT AVG(CAST(cc.Rating AS FLOAT)) FROM CourtConfirmations cc WHERE cc.CourtId = fc.Id AND cc.Rating IS NOT NULL) AS AverageRating,
        -- Most suggested name
        (SELECT TOP 1 SuggestedName
         FROM CourtConfirmations
         WHERE CourtId = fc.Id AND SuggestedName IS NOT NULL AND SuggestedName != ''
         GROUP BY SuggestedName
         ORDER BY COUNT(*) DESC) AS MostSuggestedName
    FROM FilteredCourts fc
    CROSS JOIN TotalCount tc
    ORDER BY
        CASE WHEN fc.Distance IS NOT NULL THEN fc.Distance ELSE 999999 END ASC,
        fc.Name ASC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO

PRINT 'Updated sp_SearchCourts procedure with Country filter';
GO

PRINT 'Migration 025 completed successfully';
GO
