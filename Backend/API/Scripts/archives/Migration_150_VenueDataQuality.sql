-- Migration 150: Venue Data Quality & Crowdsource Verification
-- Adds DataQuality tracking, auto-flag stored procedure, needs-verification SP,
-- and updates sp_SearchVenues to support DataQuality filtering

PRINT 'Starting Migration 150: Venue Data Quality & Crowdsource Verification'
GO

-- ============================================================
-- Phase 1: Add DataQuality columns to Venues table
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Venues') AND name = 'DataQuality')
BEGIN
    ALTER TABLE Venues ADD DataQuality TINYINT NOT NULL DEFAULT 0;
    PRINT 'Added DataQuality column to Venues (0=Unverified, 1=Confirmed, 2=Flagged, 3=Rejected)'
END
ELSE
    PRINT 'DataQuality column already exists'
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Venues') AND name = 'LastVerifiedAt')
BEGIN
    ALTER TABLE Venues ADD LastVerifiedAt DATETIME NULL;
    PRINT 'Added LastVerifiedAt column to Venues'
END
ELSE
    PRINT 'LastVerifiedAt column already exists'
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Venues') AND name = 'VerificationCount')
BEGIN
    ALTER TABLE Venues ADD VerificationCount INT NOT NULL DEFAULT 0;
    PRINT 'Added VerificationCount column to Venues'
END
ELSE
    PRINT 'VerificationCount column already exists'
GO

-- Add index on DataQuality for filtering
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Venues_DataQuality' AND object_id = OBJECT_ID('Venues'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Venues_DataQuality ON Venues (DataQuality) INCLUDE (LastVerifiedAt, VerificationCount);
    PRINT 'Created index IX_Venues_DataQuality'
END
GO

-- ============================================================
-- Phase 1 & 4: Auto-Flag Stored Procedure
-- ============================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_AutoFlagVenues')
    DROP PROCEDURE sp_AutoFlagVenues
GO

CREATE PROCEDURE sp_AutoFlagVenues
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @FlaggedCount INT = 0;

    -- Flag venues with no name or placeholder name
    UPDATE Venues
    SET DataQuality = 2  -- Flagged
    WHERE DataQuality = 0  -- Only flag Unverified venues
      AND (Name IS NULL OR LTRIM(RTRIM(Name)) = '' OR Name = 'Unnamed' OR Name = 'Unnamed Venue');
    SET @FlaggedCount = @FlaggedCount + @@ROWCOUNT;

    -- Flag venues with no GPS coordinates
    UPDATE Venues
    SET DataQuality = 2
    WHERE DataQuality = 0
      AND (GPSLat IS NULL OR GPSLng IS NULL
           OR LTRIM(RTRIM(GPSLat)) = '' OR LTRIM(RTRIM(GPSLng)) = ''
           OR TRY_CAST(GPSLat AS FLOAT) IS NULL OR TRY_CAST(GPSLng AS FLOAT) IS NULL);
    SET @FlaggedCount = @FlaggedCount + @@ROWCOUNT;

    -- Flag venues with 0 indoor + 0 outdoor courts
    UPDATE Venues
    SET DataQuality = 2
    WHERE DataQuality = 0
      AND (ISNULL(Indoor_Num, 0) = 0 AND ISNULL(Outdoor_Num, 0) = 0 AND ISNULL(Covered_Num, 0) = 0);
    SET @FlaggedCount = @FlaggedCount + @@ROWCOUNT;

    -- Flag venues with GPS coordinates in the ocean
    -- Basic check: latitude not between -90 and 90, longitude not between -180 and 180
    -- Also flag coordinates at exactly 0,0 (null island)
    UPDATE Venues
    SET DataQuality = 2
    WHERE DataQuality = 0
      AND TRY_CAST(GPSLat AS FLOAT) IS NOT NULL
      AND TRY_CAST(GPSLng AS FLOAT) IS NOT NULL
      AND (
          -- Null Island (0,0)
          (ABS(TRY_CAST(GPSLat AS FLOAT)) < 0.1 AND ABS(TRY_CAST(GPSLng AS FLOAT)) < 0.1)
          -- Out of range
          OR TRY_CAST(GPSLat AS FLOAT) > 90 OR TRY_CAST(GPSLat AS FLOAT) < -90
          OR TRY_CAST(GPSLng AS FLOAT) > 180 OR TRY_CAST(GPSLng AS FLOAT) < -180
      );
    SET @FlaggedCount = @FlaggedCount + @@ROWCOUNT;

    SELECT @FlaggedCount AS TotalFlagged;
    PRINT 'Auto-flagged ' + CAST(@FlaggedCount AS VARCHAR) + ' venues'
END
GO

PRINT 'Created/updated sp_AutoFlagVenues'
GO

-- ============================================================
-- Phase 3: Needs Verification Stored Procedure
-- ============================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetNeedsVerification')
    DROP PROCEDURE sp_GetNeedsVerification
GO

CREATE PROCEDURE sp_GetNeedsVerification
    @UserLat FLOAT = NULL,
    @UserLng FLOAT = NULL,
    @RadiusMiles FLOAT = 50,
    @MaxResults INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (@MaxResults)
        v.Id AS VenueId,
        v.Name,
        CONCAT(v.Addr1, CASE WHEN v.Addr2 IS NOT NULL AND v.Addr2 != '' THEN ' ' + v.Addr2 ELSE '' END) AS Address,
        v.City,
        v.State,
        v.Country,
        v.Indoor_Num AS IndoorNum,
        v.Outdoor_Num AS OutdoorNum,
        CASE WHEN v.Lights = 'Y' THEN 1 ELSE 0 END AS HasLights,
        TRY_CAST(v.GPSLat AS FLOAT) AS Latitude,
        TRY_CAST(v.GPSLng AS FLOAT) AS Longitude,
        v.DataQuality,
        v.VerificationCount,
        v.LastVerifiedAt,
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
        (SELECT COUNT(*) FROM Venues v2
         WHERE v2.DataQuality = 0 AND v2.VerificationCount = 0) AS TotalUnverifiedCount
    FROM Venues v
    WHERE
        -- Unverified with 0 confirmations OR not verified in 6+ months
        (
            (v.DataQuality = 0 AND v.VerificationCount = 0)
            OR (v.LastVerifiedAt IS NOT NULL AND v.LastVerifiedAt < DATEADD(MONTH, -6, GETDATE()))
        )
        -- Exclude rejected
        AND v.DataQuality <> 3
        -- Has valid coordinates for distance calc
        AND TRY_CAST(v.GPSLat AS FLOAT) IS NOT NULL
        AND TRY_CAST(v.GPSLng AS FLOAT) IS NOT NULL
        -- Within radius if location provided
        AND (
            @UserLat IS NULL OR @UserLng IS NULL
            OR 3959 * ACOS(
                COS(RADIANS(@UserLat)) * COS(RADIANS(TRY_CAST(v.GPSLat AS FLOAT))) *
                COS(RADIANS(TRY_CAST(v.GPSLng AS FLOAT)) - RADIANS(@UserLng)) +
                SIN(RADIANS(@UserLat)) * SIN(RADIANS(TRY_CAST(v.GPSLat AS FLOAT)))
            ) <= @RadiusMiles
        )
    ORDER BY
        CASE
            WHEN @UserLat IS NOT NULL AND @UserLng IS NOT NULL
                 AND TRY_CAST(v.GPSLat AS FLOAT) IS NOT NULL
                 AND TRY_CAST(v.GPSLng AS FLOAT) IS NOT NULL
            THEN 3959 * ACOS(
                COS(RADIANS(@UserLat)) * COS(RADIANS(TRY_CAST(v.GPSLat AS FLOAT))) *
                COS(RADIANS(TRY_CAST(v.GPSLng AS FLOAT)) - RADIANS(@UserLng)) +
                SIN(RADIANS(@UserLat)) * SIN(RADIANS(TRY_CAST(v.GPSLat AS FLOAT)))
            )
            ELSE 999999
        END ASC
END
GO

PRINT 'Created/updated sp_GetNeedsVerification'
GO

-- ============================================================
-- Update sp_SearchVenues to add DataQuality filter & exclude Rejected
-- ============================================================

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
    @DataQuality TINYINT = NULL,  -- NULL = exclude rejected only; specific value = filter to that value
    @SortBy NVARCHAR(20) = 'match',
    @SortOrder NVARCHAR(4) = 'asc',
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    DECLARE @QueryLower NVARCHAR(100) = LOWER(LTRIM(RTRIM(@Query)));

    ;WITH VenueResults AS (
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
            v.DataQuality,
            v.LastVerifiedAt,
            v.VerificationCount,
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
            -- Match score for search relevance
            CASE
                WHEN @QueryLower IS NULL OR @QueryLower = '' THEN 7
                WHEN v.Name IS NOT NULL AND LOWER(v.Name) LIKE @QueryLower + '%' THEN 1
                WHEN v.Name IS NOT NULL AND LOWER(v.Name) LIKE '%' + @QueryLower + '%' THEN 2
                WHEN v.Addr1 IS NOT NULL AND LOWER(v.Addr1) LIKE @QueryLower + '%' THEN 3
                WHEN v.Addr1 IS NOT NULL AND LOWER(v.Addr1) LIKE '%' + @QueryLower + '%' THEN 4
                WHEN v.City IS NOT NULL AND LOWER(v.City) LIKE @QueryLower + '%' THEN 5
                WHEN v.City IS NOT NULL AND LOWER(v.City) LIKE '%' + @QueryLower + '%' THEN 6
                ELSE 7
            END AS MatchScore,
            -- Aggregated info
            ISNULL(agg.ConfirmationCount, 0) AS ConfirmationCount,
            agg.AverageRating,
            agg.NotACourtCount,
            agg.MostSuggestedName,
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
            -- DataQuality filter: NULL = exclude Rejected (3), specific value = exact match
            AND (
                (@DataQuality IS NULL AND v.DataQuality <> 3)
                OR (@DataQuality IS NOT NULL AND v.DataQuality = @DataQuality)
            )
    )
    SELECT *,
        (SELECT COUNT(*) FROM VenueResults
         WHERE @RadiusMiles IS NULL OR Distance IS NULL OR Distance <= @RadiusMiles) AS TotalCount
    FROM VenueResults
    WHERE @RadiusMiles IS NULL OR Distance IS NULL OR Distance <= @RadiusMiles
    ORDER BY
        CASE WHEN @SortBy = 'match' THEN MatchScore END ASC,
        CASE WHEN @SortBy = 'match' THEN IsVerified END DESC,
        CASE WHEN @SortBy = 'match' THEN Name END ASC,
        CASE WHEN @SortBy = 'distance' AND @SortOrder = 'asc' THEN ISNULL(Distance, 999999) END ASC,
        CASE WHEN @SortBy = 'distance' AND @SortOrder = 'desc' THEN ISNULL(Distance, 999999) END DESC,
        CASE WHEN @SortBy = 'name' AND @SortOrder = 'asc' THEN Name END ASC,
        CASE WHEN @SortBy = 'name' AND @SortOrder = 'desc' THEN Name END DESC,
        CASE WHEN @SortBy = 'rating' AND @SortOrder = 'asc' THEN ISNULL(AverageRating, 0) END ASC,
        CASE WHEN @SortBy = 'rating' AND @SortOrder = 'desc' THEN ISNULL(AverageRating, 0) END DESC,
        CASE WHEN @SortBy IS NULL OR @SortBy = '' THEN ISNULL(Distance, 999999) END ASC,
        CASE WHEN @SortBy IS NULL OR @SortBy = '' THEN Name END ASC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO

PRINT 'Created sp_SearchVenues with DataQuality filter'
GO

-- ============================================================
-- Update sp_GetVenueDetail to return DataQuality fields
-- ============================================================

-- Get current sp_GetVenueDetail definition and recreate with new fields
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetVenueDetail')
BEGIN
    DROP PROCEDURE sp_GetVenueDetail
    PRINT 'Dropped existing sp_GetVenueDetail'
END
GO

CREATE PROCEDURE sp_GetVenueDetail
    @VenueId INT,
    @UserLat FLOAT = NULL,
    @UserLng FLOAT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- First result set: Venue basic info
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
        v.DataQuality,
        v.LastVerifiedAt,
        v.VerificationCount,
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
        END AS Distance
    FROM Venues v
    WHERE v.Id = @VenueId;

    -- Second result set: Aggregated confirmation data
    SELECT
        COUNT(*) AS ConfirmationCount,
        AVG(CAST(Rating AS FLOAT)) AS AverageRating,
        SUM(CASE WHEN NotACourt = 1 THEN 1 ELSE 0 END) AS NotACourtCount,
        (SELECT TOP 1 SuggestedName FROM VenueConfirmations vc2
         WHERE vc2.VenueId = @VenueId AND SuggestedName IS NOT NULL
         GROUP BY SuggestedName ORDER BY COUNT(*) DESC) AS MostSuggestedName,
        -- Most confirmed counts (mode)
        (SELECT TOP 1 ConfirmedIndoorCount FROM VenueConfirmations vc2
         WHERE vc2.VenueId = @VenueId AND ConfirmedIndoorCount IS NOT NULL
         GROUP BY ConfirmedIndoorCount ORDER BY COUNT(*) DESC) AS MostConfirmedIndoorCount,
        (SELECT TOP 1 ConfirmedOutdoorCount FROM VenueConfirmations vc2
         WHERE vc2.VenueId = @VenueId AND ConfirmedOutdoorCount IS NOT NULL
         GROUP BY ConfirmedOutdoorCount ORDER BY COUNT(*) DESC) AS MostConfirmedOutdoorCount,
        -- Most confirmed lights
        CASE
            WHEN SUM(CASE WHEN HasLights = 1 THEN 1 ELSE 0 END) > SUM(CASE WHEN HasLights = 0 THEN 1 ELSE 0 END) THEN 1
            WHEN SUM(CASE WHEN HasLights = 0 THEN 1 ELSE 0 END) > 0 THEN 0
            ELSE NULL
        END AS MostConfirmedHasLights,
        -- Most confirmed fee
        CASE
            WHEN SUM(CASE WHEN HasFee = 1 THEN 1 ELSE 0 END) > SUM(CASE WHEN HasFee = 0 THEN 1 ELSE 0 END) THEN 1
            WHEN SUM(CASE WHEN HasFee = 0 THEN 1 ELSE 0 END) > 0 THEN 0
            ELSE NULL
        END AS MostConfirmedHasFee,
        (SELECT TOP 1 FeeAmount FROM VenueConfirmations vc2
         WHERE vc2.VenueId = @VenueId AND FeeAmount IS NOT NULL
         GROUP BY FeeAmount ORDER BY COUNT(*) DESC) AS CommonFeeAmount,
        (SELECT TOP 1 Hours FROM VenueConfirmations vc2
         WHERE vc2.VenueId = @VenueId AND Hours IS NOT NULL
         GROUP BY Hours ORDER BY COUNT(*) DESC) AS CommonHours,
        (SELECT TOP 1 SurfaceType FROM VenueConfirmations vc2
         WHERE vc2.VenueId = @VenueId AND SurfaceType IS NOT NULL
         GROUP BY SurfaceType ORDER BY COUNT(*) DESC) AS CommonSurfaceType
    FROM VenueConfirmations
    WHERE VenueId = @VenueId;

    -- Third result set: Recent confirmations
    SELECT TOP 20
        vc.Id,
        vc.VenueId,
        vc.UserId,
        CONCAT(u.LastName, ', ', u.FirstName) AS UserName,
        u.ProfileImageUrl AS UserProfileImageUrl,
        vc.NameConfirmed,
        vc.SuggestedName,
        vc.NotACourt,
        vc.ConfirmedIndoorCount,
        vc.ConfirmedOutdoorCount,
        vc.ConfirmedCoveredCount,
        vc.HasLights,
        vc.HasFee,
        vc.FeeAmount,
        vc.FeeNotes,
        vc.Hours,
        vc.Rating,
        vc.Notes,
        vc.SurfaceType,
        vc.Amenities,
        vc.ConfirmedAddress,
        vc.ConfirmedCity,
        vc.ConfirmedState,
        vc.ConfirmedCountry,
        vc.CreatedAt,
        vc.UpdatedAt
    FROM VenueConfirmations vc
    LEFT JOIN Users u ON vc.UserId = u.Id
    WHERE vc.VenueId = @VenueId
    ORDER BY vc.UpdatedAt DESC;
END
GO

PRINT 'Created sp_GetVenueDetail with DataQuality fields'
GO

-- ============================================================
-- Phase 4: Admin Flagged Venues Stored Procedure
-- ============================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetFlaggedVenues')
    DROP PROCEDURE sp_GetFlaggedVenues
GO

CREATE PROCEDURE sp_GetFlaggedVenues
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Offset INT = (@Page - 1) * @PageSize;

    SELECT
        v.Id AS VenueId,
        v.Name,
        CONCAT(v.Addr1, CASE WHEN v.Addr2 IS NOT NULL AND v.Addr2 != '' THEN ' ' + v.Addr2 ELSE '' END) AS Address,
        v.City,
        v.State,
        v.Country,
        v.DataQuality,
        v.VerificationCount,
        v.LastVerifiedAt,
        TRY_CAST(v.GPSLat AS FLOAT) AS Latitude,
        TRY_CAST(v.GPSLng AS FLOAT) AS Longitude,
        ISNULL(agg.NotACourtCount, 0) AS NotACourtCount,
        ISNULL(agg.ConfirmationCount, 0) AS ConfirmationCount,
        (SELECT COUNT(*) FROM Venues WHERE DataQuality = 2) AS TotalCount
    FROM Venues v
    LEFT JOIN (
        SELECT
            VenueId,
            COUNT(*) AS ConfirmationCount,
            SUM(CASE WHEN NotACourt = 1 THEN 1 ELSE 0 END) AS NotACourtCount
        FROM VenueConfirmations
        GROUP BY VenueId
    ) agg ON v.Id = agg.VenueId
    WHERE v.DataQuality = 2  -- Flagged
    ORDER BY ISNULL(agg.NotACourtCount, 0) DESC, v.Name
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO

PRINT 'Created sp_GetFlaggedVenues'
GO

PRINT 'Migration 150 completed successfully'
GO
