-- Migration 020: Add NotACourt flag and update stored procedures
-- Allows users to flag locations as no longer pickleball courts
-- Courts with 3+ "not a court" votes are hidden from search results

PRINT 'Starting Migration 020: NotACourt and Name Suggestions';

-- Add NotACourt column to CourtConfirmations if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CourtConfirmations') AND name = 'NotACourt')
BEGIN
    PRINT 'Adding NotACourt column to CourtConfirmations...';
    ALTER TABLE CourtConfirmations ADD NotACourt BIT NULL;
    PRINT 'NotACourt column added successfully.';
END
ELSE
BEGIN
    PRINT 'NotACourt column already exists.';
END
GO

-- Drop and recreate stored procedures with updated logic

IF OBJECT_ID('dbo.sp_SearchCourts', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_SearchCourts;
GO

IF OBJECT_ID('dbo.sp_GetCourtDetail', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetCourtDetail;
GO

-- Updated stored procedure to search courts (excludes courts with 3+ "not a court" votes)
CREATE PROCEDURE dbo.sp_SearchCourts
    @Query NVARCHAR(100) = NULL,
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

    ;WITH NotACourtCounts AS (
        -- Count how many users flagged each court as "not a court"
        SELECT CourtId, COUNT(*) AS NotACourtCount
        FROM CourtConfirmations
        WHERE NotACourt = 1
        GROUP BY CourtId
    ),
    CourtsWithDistance AS (
        SELECT
            c.Court_ID,
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
        LEFT JOIN NotACourtCounts nac ON c.Court_ID = nac.CourtId
        WHERE
            -- Exclude courts flagged as "not a court" by 3+ users
            ISNULL(nac.NotACourtCount, 0) < @NotACourtThreshold
            -- State filter
            AND (@State IS NULL OR c.State = @State)
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
        fc.Court_ID AS CourtId,
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
        (SELECT COUNT(*) FROM CourtConfirmations cc WHERE cc.CourtId = fc.Court_ID) AS ConfirmationCount,
        (SELECT AVG(CAST(cc.Rating AS FLOAT)) FROM CourtConfirmations cc WHERE cc.CourtId = fc.Court_ID AND cc.Rating IS NOT NULL) AS AverageRating,
        -- Most suggested name
        (SELECT TOP 1 SuggestedName
         FROM CourtConfirmations
         WHERE CourtId = fc.Court_ID AND SuggestedName IS NOT NULL AND SuggestedName != ''
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

PRINT 'Updated sp_SearchCourts procedure';

-- Updated stored procedure to get court details
CREATE PROCEDURE dbo.sp_GetCourtDetail
    @CourtId INT,
    @UserLat FLOAT = NULL,
    @UserLng FLOAT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Get court basic info
    SELECT
        c.Court_ID AS CourtId,
        c.Name,
        LTRIM(RTRIM(COALESCE(c.Addr1, '') + ' ' + COALESCE(c.Addr2, ''))) AS Address,
        c.City,
        c.County,
        c.State,
        c.ZIP AS Zip,
        c.Country,
        c.Phone,
        c.WWW AS Website,
        c.EMail AS Email,
        c.Indoor_Num AS IndoorNum,
        c.Outdoor_Num AS OutdoorNum,
        c.Covered_Num AS CoveredNum,
        CASE WHEN c.Lights = 'Y' THEN 1 ELSE 0 END AS HasLights,
        TRY_CAST(c.GPSLat AS FLOAT) AS Latitude,
        TRY_CAST(c.GPSLng AS FLOAT) AS Longitude,
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
    WHERE c.Court_ID = @CourtId;

    -- Get aggregated confirmation data (including NotACourt count and suggested names)
    SELECT
        COUNT(*) AS ConfirmationCount,
        AVG(CAST(Rating AS FLOAT)) AS AverageRating,
        -- Not a court count
        SUM(CASE WHEN NotACourt = 1 THEN 1 ELSE 0 END) AS NotACourtCount,
        -- Most suggested name
        (SELECT TOP 1 SuggestedName
         FROM CourtConfirmations
         WHERE CourtId = @CourtId AND SuggestedName IS NOT NULL AND SuggestedName != ''
         GROUP BY SuggestedName
         ORDER BY COUNT(*) DESC) AS MostSuggestedName,
        -- Most common indoor count
        (SELECT TOP 1 ConfirmedIndoorCount
         FROM CourtConfirmations
         WHERE CourtId = @CourtId AND ConfirmedIndoorCount IS NOT NULL
         GROUP BY ConfirmedIndoorCount
         ORDER BY COUNT(*) DESC) AS MostConfirmedIndoorCount,
        -- Most common outdoor count
        (SELECT TOP 1 ConfirmedOutdoorCount
         FROM CourtConfirmations
         WHERE CourtId = @CourtId AND ConfirmedOutdoorCount IS NOT NULL
         GROUP BY ConfirmedOutdoorCount
         ORDER BY COUNT(*) DESC) AS MostConfirmedOutdoorCount,
        -- Most common has lights (majority vote)
        CASE
            WHEN SUM(CASE WHEN HasLights = 1 THEN 1 ELSE 0 END) > SUM(CASE WHEN HasLights = 0 THEN 1 ELSE 0 END) THEN 1
            WHEN SUM(CASE WHEN HasLights = 0 THEN 1 ELSE 0 END) > SUM(CASE WHEN HasLights = 1 THEN 1 ELSE 0 END) THEN 0
            ELSE NULL
        END AS MostConfirmedHasLights,
        -- Most common has fee (majority vote)
        CASE
            WHEN SUM(CASE WHEN HasFee = 1 THEN 1 ELSE 0 END) > SUM(CASE WHEN HasFee = 0 THEN 1 ELSE 0 END) THEN 1
            WHEN SUM(CASE WHEN HasFee = 0 THEN 1 ELSE 0 END) > SUM(CASE WHEN HasFee = 1 THEN 1 ELSE 0 END) THEN 0
            ELSE NULL
        END AS MostConfirmedHasFee,
        -- Most common fee amount
        (SELECT TOP 1 FeeAmount
         FROM CourtConfirmations
         WHERE CourtId = @CourtId AND FeeAmount IS NOT NULL AND FeeAmount != ''
         GROUP BY FeeAmount
         ORDER BY COUNT(*) DESC) AS CommonFeeAmount,
        -- Most common hours
        (SELECT TOP 1 Hours
         FROM CourtConfirmations
         WHERE CourtId = @CourtId AND Hours IS NOT NULL AND Hours != ''
         GROUP BY Hours
         ORDER BY COUNT(*) DESC) AS CommonHours,
        -- Most common surface type
        (SELECT TOP 1 SurfaceType
         FROM CourtConfirmations
         WHERE CourtId = @CourtId AND SurfaceType IS NOT NULL AND SurfaceType != ''
         GROUP BY SurfaceType
         ORDER BY COUNT(*) DESC) AS CommonSurfaceType
    FROM CourtConfirmations
    WHERE CourtId = @CourtId;

    -- Get recent confirmations (top 10)
    SELECT TOP 10
        cc.Id,
        cc.CourtId,
        cc.UserId,
        LTRIM(RTRIM(COALESCE(u.FirstName, '') + ' ' + COALESCE(u.LastName, ''))) AS UserName,
        u.ProfileImageUrl AS UserProfileImageUrl,
        cc.NameConfirmed,
        cc.SuggestedName,
        cc.NotACourt,
        cc.ConfirmedIndoorCount,
        cc.ConfirmedOutdoorCount,
        cc.ConfirmedCoveredCount,
        cc.HasLights,
        cc.HasFee,
        cc.FeeAmount,
        cc.FeeNotes,
        cc.Hours,
        cc.Rating,
        cc.Notes,
        cc.SurfaceType,
        cc.Amenities,
        cc.CreatedAt,
        cc.UpdatedAt
    FROM CourtConfirmations cc
    LEFT JOIN Users u ON cc.UserId = u.Id
    WHERE cc.CourtId = @CourtId
    ORDER BY cc.UpdatedAt DESC;
END;
GO

PRINT 'Updated sp_GetCourtDetail procedure';

PRINT 'Migration 020 completed successfully.';
