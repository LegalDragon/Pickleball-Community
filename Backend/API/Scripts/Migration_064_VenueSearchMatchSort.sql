-- Migration 064: Add Match Sort to Venue Search
-- Adds @SortBy parameter to sp_SearchVenues with 'match' option for search relevance sorting
-- Priority: name starts with > name contains > address starts with > address contains > city starts with > city contains

PRINT 'Starting Migration 064: Add Match Sort to Venue Search'
GO

-- Drop and recreate sp_SearchVenues with match sorting support
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_SearchVenues')
BEGIN
    DROP PROCEDURE sp_SearchVenues
    PRINT 'Dropped existing sp_SearchVenues'
END
GO

CREATE PROCEDURE sp_SearchVenues
    @Query NVARCHAR(100) = NULL,
    @Country NVARCHAR(20) = NULL,
    @State NVARCHAR(50) = NULL,
    @City NVARCHAR(50) = NULL,
    @HasLights BIT = NULL,
    @IsIndoor BIT = NULL,
    @VenueTypeId INT = NULL,
    @UserLat FLOAT = NULL,
    @UserLng FLOAT = NULL,
    @RadiusMiles FLOAT = NULL,
    @SortBy NVARCHAR(20) = 'match',  -- 'match', 'distance', 'name', 'rating'
    @SortOrder NVARCHAR(4) = 'asc',  -- 'asc' or 'desc'
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    DECLARE @QueryLower NVARCHAR(100) = LOWER(LTRIM(RTRIM(@Query)));

    -- Debug output
    PRINT 'sp_SearchVenues called with:'
    PRINT '  @Query: ' + ISNULL(@Query, 'NULL')
    PRINT '  @SortBy: ' + ISNULL(@SortBy, 'NULL')
    PRINT '  @QueryLower: ' + ISNULL(@QueryLower, 'NULL');

    WITH VenueResults AS (
        SELECT
            v.Id AS VenueId,
            v.Name,
            CONCAT(v.Addr1, CASE WHEN v.Addr2 IS NOT NULL AND v.Addr2 != '' THEN ' ' + v.Addr2 ELSE '' END) AS Address,
            v.City,
            v.County,
            v.State,
            v.ZIP AS Zip,
            v.Country,
            v.Phone,
            v.WWW AS Website,
            v.EMail AS Email,
            v.Indoor_Num AS IndoorNum,
            v.Outdoor_Num AS OutdoorNum,
            v.Covered_Num AS CoveredNum,
            CASE WHEN v.Lights = 'Y' THEN 1 ELSE 0 END AS HasLights,
            TRY_CAST(v.GPSLat AS FLOAT) AS Latitude,
            TRY_CAST(v.GPSLng AS FLOAT) AS Longitude,
            v.VenueTypeId,
            -- Distance calculation
            CASE
                WHEN @UserLat IS NOT NULL AND @UserLng IS NOT NULL
                     AND TRY_CAST(v.GPSLat AS FLOAT) IS NOT NULL
                     AND TRY_CAST(v.GPSLng AS FLOAT) IS NOT NULL
                THEN 3959 * ACOS(
                    COS(RADIANS(@UserLat)) * COS(RADIANS(TRY_CAST(v.GPSLat AS FLOAT))) *
                    COS(RADIANS(TRY_CAST(v.GPSLng AS FLOAT)) - RADIANS(@UserLng)) +
                    SIN(RADIANS(@UserLat)) * SIN(RADIANS(TRY_CAST(v.GPSLat AS FLOAT)))
                )
                ELSE NULL
            END AS Distance,
            -- Match score for search relevance (lower is better)
            CASE
                WHEN @QueryLower IS NULL OR @QueryLower = '' THEN 7
                WHEN v.Name IS NOT NULL AND LOWER(v.Name) LIKE @QueryLower + '%' THEN 1  -- name starts with
                WHEN v.Name IS NOT NULL AND LOWER(v.Name) LIKE '%' + @QueryLower + '%' THEN 2  -- name contains
                WHEN v.Addr1 IS NOT NULL AND LOWER(v.Addr1) LIKE @QueryLower + '%' THEN 3  -- address starts with
                WHEN v.Addr1 IS NOT NULL AND LOWER(v.Addr1) LIKE '%' + @QueryLower + '%' THEN 4  -- address contains
                WHEN v.City IS NOT NULL AND LOWER(v.City) LIKE @QueryLower + '%' THEN 5  -- city starts with
                WHEN v.City IS NOT NULL AND LOWER(v.City) LIKE '%' + @QueryLower + '%' THEN 6  -- city contains
                ELSE 7  -- no match
            END AS MatchScore,
            -- Aggregated info
            ISNULL(agg.ConfirmationCount, 0) AS ConfirmationCount,
            agg.AverageRating,
            agg.NotACourtCount,
            agg.MostSuggestedName,
            -- Is verified (has confirmations)
            CASE WHEN ISNULL(agg.ConfirmationCount, 0) > 0 THEN 1 ELSE 0 END AS IsVerified
        FROM Venues v
        LEFT JOIN (
            SELECT
                VenueId,
                COUNT(*) AS ConfirmationCount,
                AVG(CAST(Rating AS FLOAT)) AS AverageRating,
                SUM(CASE WHEN NotACourt = 1 THEN 1 ELSE 0 END) AS NotACourtCount,
                (SELECT TOP 1 SuggestedName FROM VenueConfirmations vc2
                 WHERE vc2.VenueId = vc.VenueId AND SuggestedName IS NOT NULL
                 GROUP BY SuggestedName ORDER BY COUNT(*) DESC) AS MostSuggestedName
            FROM VenueConfirmations vc
            GROUP BY VenueId
        ) agg ON v.Id = agg.VenueId
        WHERE
            (@Query IS NULL OR v.Name LIKE '%' + @Query + '%' OR v.City LIKE '%' + @Query + '%' OR v.Addr1 LIKE '%' + @Query + '%')
            AND (@Country IS NULL OR (@Country = 'Unknown' AND v.Country IS NULL) OR v.Country = @Country)
            AND (@State IS NULL OR (@State = 'Unknown' AND v.State IS NULL) OR v.State = @State)
            AND (@City IS NULL OR v.City LIKE '%' + @City + '%')
            AND (@HasLights IS NULL OR (@HasLights = 1 AND v.Lights = 'Y'))
            AND (@IsIndoor IS NULL OR (@IsIndoor = 1 AND v.Indoor_Num > 0))
            AND (@VenueTypeId IS NULL OR v.VenueTypeId = @VenueTypeId)
    )
    SELECT *,
        (SELECT COUNT(*) FROM VenueResults
         WHERE @RadiusMiles IS NULL OR Distance IS NULL OR Distance <= @RadiusMiles) AS TotalCount
    FROM VenueResults
    WHERE @RadiusMiles IS NULL OR Distance IS NULL OR Distance <= @RadiusMiles
    ORDER BY
        -- Match sort: by match score, then verified, then name
        CASE WHEN @SortBy = 'match' THEN MatchScore END ASC,
        CASE WHEN @SortBy = 'match' THEN IsVerified END DESC,
        CASE WHEN @SortBy = 'match' THEN Name END ASC,
        -- Distance sort
        CASE WHEN @SortBy = 'distance' AND @SortOrder = 'asc' THEN ISNULL(Distance, 999999) END ASC,
        CASE WHEN @SortBy = 'distance' AND @SortOrder = 'desc' THEN ISNULL(Distance, 999999) END DESC,
        -- Name sort
        CASE WHEN @SortBy = 'name' AND @SortOrder = 'asc' THEN Name END ASC,
        CASE WHEN @SortBy = 'name' AND @SortOrder = 'desc' THEN Name END DESC,
        -- Rating sort
        CASE WHEN @SortBy = 'rating' AND @SortOrder = 'asc' THEN ISNULL(AverageRating, 0) END ASC,
        CASE WHEN @SortBy = 'rating' AND @SortOrder = 'desc' THEN ISNULL(AverageRating, 0) END DESC,
        -- Default sort (distance if available, else name)
        CASE WHEN @SortBy IS NULL OR @SortBy = '' THEN ISNULL(Distance, 999999) END ASC,
        CASE WHEN @SortBy IS NULL OR @SortBy = '' THEN Name END ASC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO

PRINT 'Created sp_SearchVenues with match sorting support'
GO

PRINT 'Migration 064 completed successfully'
GO
