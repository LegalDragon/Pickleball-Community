-- Migration 042: Rename Courts to Venues
-- Renames Courts table and related entities to Venues to avoid confusion with tournament courts
-- Tournament courts are numbered courts at a venue (Court 1, Court 2, etc.)
-- Venues are the facilities that have pickleball courts

PRINT 'Starting Migration 042: Rename Courts to Venues'
GO

-- =============================================
-- Step 1: Drop Foreign Key Constraints
-- =============================================

-- Drop FK from Courts to CourtTypes
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Courts_CourtTypes')
BEGIN
    ALTER TABLE Courts DROP CONSTRAINT FK_Courts_CourtTypes
    PRINT 'Dropped FK_Courts_CourtTypes'
END
GO

-- Drop FK from CourtConfirmations to Courts
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_CourtConfirmations_Courts')
BEGIN
    ALTER TABLE CourtConfirmations DROP CONSTRAINT FK_CourtConfirmations_Courts
    PRINT 'Dropped FK_CourtConfirmations_Courts'
END
GO

-- Drop FK from CourtConfirmations to Users
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_CourtConfirmations_Users')
BEGIN
    ALTER TABLE CourtConfirmations DROP CONSTRAINT FK_CourtConfirmations_Users
    PRINT 'Dropped FK_CourtConfirmations_Users'
END
GO

-- Drop FK from CourtAssets to Courts
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_CourtAssets_Courts')
BEGIN
    ALTER TABLE CourtAssets DROP CONSTRAINT FK_CourtAssets_Courts
    PRINT 'Dropped FK_CourtAssets_Courts'
END
GO

-- Drop FK from CourtAssets to Users
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_CourtAssets_Users')
BEGIN
    ALTER TABLE CourtAssets DROP CONSTRAINT FK_CourtAssets_Users
    PRINT 'Dropped FK_CourtAssets_Users'
END
GO

-- Drop FK from CourtAssetLikes to CourtAssets
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_CourtAssetLikes_CourtAssets')
BEGIN
    ALTER TABLE CourtAssetLikes DROP CONSTRAINT FK_CourtAssetLikes_CourtAssets
    PRINT 'Dropped FK_CourtAssetLikes_CourtAssets'
END
GO

-- Drop FK from CourtAssetLikes to Users
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_CourtAssetLikes_Users')
BEGIN
    ALTER TABLE CourtAssetLikes DROP CONSTRAINT FK_CourtAssetLikes_Users
    PRINT 'Dropped FK_CourtAssetLikes_Users'
END
GO

-- Drop FK from CourtGeoCodes to Courts
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_CourtGeoCodes_Courts')
BEGIN
    ALTER TABLE CourtGeoCodes DROP CONSTRAINT FK_CourtGeoCodes_Courts
    PRINT 'Dropped FK_CourtGeoCodes_Courts'
END
GO

-- Drop FK from Events to Courts (VenueId references Courts)
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Events_Courts')
BEGIN
    ALTER TABLE Events DROP CONSTRAINT FK_Events_Courts
    PRINT 'Dropped FK_Events_Courts'
END
GO

IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Events_Venues')
BEGIN
    ALTER TABLE Events DROP CONSTRAINT FK_Events_Venues
    PRINT 'Dropped FK_Events_Venues'
END
GO

-- Drop FK from TournamentCourts to Courts
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_TournamentCourts_Courts')
BEGIN
    ALTER TABLE TournamentCourts DROP CONSTRAINT FK_TournamentCourts_Courts
    PRINT 'Dropped FK_TournamentCourts_Courts'
END
GO

IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_TournamentCourts_Venues')
BEGIN
    ALTER TABLE TournamentCourts DROP CONSTRAINT FK_TournamentCourts_Venues
    PRINT 'Dropped FK_TournamentCourts_Venues'
END
GO

-- =============================================
-- Step 2: Drop Indexes
-- =============================================

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Courts_CourtTypeId' AND object_id = OBJECT_ID('Courts'))
BEGIN
    DROP INDEX IX_Courts_CourtTypeId ON Courts
    PRINT 'Dropped IX_Courts_CourtTypeId'
END
GO

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CourtTypes_SortOrder' AND object_id = OBJECT_ID('CourtTypes'))
BEGIN
    DROP INDEX IX_CourtTypes_SortOrder ON CourtTypes
    PRINT 'Dropped IX_CourtTypes_SortOrder'
END
GO

-- =============================================
-- Step 3: Rename Tables
-- =============================================

-- Rename Courts to Venues
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Courts') AND NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Venues')
BEGIN
    EXEC sp_rename 'Courts', 'Venues'
    PRINT 'Renamed Courts table to Venues'
END
GO

-- Rename CourtTypes to VenueTypes
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'CourtTypes') AND NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VenueTypes')
BEGIN
    EXEC sp_rename 'CourtTypes', 'VenueTypes'
    PRINT 'Renamed CourtTypes table to VenueTypes'
END
GO

-- Rename CourtConfirmations to VenueConfirmations
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'CourtConfirmations') AND NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VenueConfirmations')
BEGIN
    EXEC sp_rename 'CourtConfirmations', 'VenueConfirmations'
    PRINT 'Renamed CourtConfirmations table to VenueConfirmations'
END
GO

-- Rename CourtAssets to VenueAssets
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'CourtAssets') AND NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VenueAssets')
BEGIN
    EXEC sp_rename 'CourtAssets', 'VenueAssets'
    PRINT 'Renamed CourtAssets table to VenueAssets'
END
GO

-- Rename CourtAssetLikes to VenueAssetLikes
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'CourtAssetLikes') AND NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VenueAssetLikes')
BEGIN
    EXEC sp_rename 'CourtAssetLikes', 'VenueAssetLikes'
    PRINT 'Renamed CourtAssetLikes table to VenueAssetLikes'
END
GO

-- Rename CourtGeoCodes to VenueGeoCodes
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'CourtGeoCodes') AND NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VenueGeoCodes')
BEGIN
    EXEC sp_rename 'CourtGeoCodes', 'VenueGeoCodes'
    PRINT 'Renamed CourtGeoCodes table to VenueGeoCodes'
END
GO

-- =============================================
-- Step 4: Rename Columns (CourtId -> VenueId in related tables)
-- =============================================

-- Rename CourtId to VenueId in VenueConfirmations
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VenueConfirmations') AND name = 'CourtId')
   AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VenueConfirmations') AND name = 'VenueId')
BEGIN
    EXEC sp_rename 'VenueConfirmations.CourtId', 'VenueId', 'COLUMN'
    PRINT 'Renamed VenueConfirmations.CourtId to VenueId'
END
GO

-- Rename CourtId to VenueId in VenueAssets
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VenueAssets') AND name = 'CourtId')
   AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VenueAssets') AND name = 'VenueId')
BEGIN
    EXEC sp_rename 'VenueAssets.CourtId', 'VenueId', 'COLUMN'
    PRINT 'Renamed VenueAssets.CourtId to VenueId'
END
GO

-- Rename CourtAssetId to VenueAssetId in VenueAssetLikes
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VenueAssetLikes') AND name = 'CourtAssetId')
   AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VenueAssetLikes') AND name = 'VenueAssetId')
BEGIN
    EXEC sp_rename 'VenueAssetLikes.CourtAssetId', 'VenueAssetId', 'COLUMN'
    PRINT 'Renamed VenueAssetLikes.CourtAssetId to VenueAssetId'
END
GO

-- Rename CourtId to VenueId in VenueGeoCodes
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VenueGeoCodes') AND name = 'CourtId')
   AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('VenueGeoCodes') AND name = 'VenueId')
BEGIN
    EXEC sp_rename 'VenueGeoCodes.CourtId', 'VenueId', 'COLUMN'
    PRINT 'Renamed VenueGeoCodes.CourtId to VenueId'
END
GO

-- Rename CourtTypeId to VenueTypeId in Venues table
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Venues') AND name = 'CourtTypeId')
   AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Venues') AND name = 'VenueTypeId')
BEGIN
    EXEC sp_rename 'Venues.CourtTypeId', 'VenueTypeId', 'COLUMN'
    PRINT 'Renamed Venues.CourtTypeId to VenueTypeId'
END
GO

-- =============================================
-- Step 5: Recreate Indexes
-- =============================================

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Venues_VenueTypeId' AND object_id = OBJECT_ID('Venues'))
   AND EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Venues') AND name = 'VenueTypeId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Venues_VenueTypeId ON Venues(VenueTypeId)
    PRINT 'Created IX_Venues_VenueTypeId'
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_VenueTypes_SortOrder' AND object_id = OBJECT_ID('VenueTypes'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_VenueTypes_SortOrder ON VenueTypes(SortOrder)
    PRINT 'Created IX_VenueTypes_SortOrder'
END
GO

-- =============================================
-- Step 6: Recreate Foreign Key Constraints
-- =============================================

-- FK from Venues to VenueTypes
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Venues_VenueTypes')
   AND EXISTS (SELECT * FROM sys.tables WHERE name = 'VenueTypes')
   AND EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Venues') AND name = 'VenueTypeId')
BEGIN
    ALTER TABLE Venues
    ADD CONSTRAINT FK_Venues_VenueTypes
    FOREIGN KEY (VenueTypeId) REFERENCES VenueTypes(Id)
    ON DELETE SET NULL
    PRINT 'Created FK_Venues_VenueTypes'
END
GO

-- FK from VenueConfirmations to Venues
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_VenueConfirmations_Venues')
   AND EXISTS (SELECT * FROM sys.tables WHERE name = 'VenueConfirmations')
BEGIN
    ALTER TABLE VenueConfirmations
    ADD CONSTRAINT FK_VenueConfirmations_Venues
    FOREIGN KEY (VenueId) REFERENCES Venues(Id)
    ON DELETE CASCADE
    PRINT 'Created FK_VenueConfirmations_Venues'
END
GO

-- FK from VenueConfirmations to Users
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_VenueConfirmations_Users')
   AND EXISTS (SELECT * FROM sys.tables WHERE name = 'VenueConfirmations')
BEGIN
    ALTER TABLE VenueConfirmations
    ADD CONSTRAINT FK_VenueConfirmations_Users
    FOREIGN KEY (UserId) REFERENCES Users(Id)
    ON DELETE CASCADE
    PRINT 'Created FK_VenueConfirmations_Users'
END
GO

-- FK from VenueAssets to Venues
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_VenueAssets_Venues')
   AND EXISTS (SELECT * FROM sys.tables WHERE name = 'VenueAssets')
BEGIN
    ALTER TABLE VenueAssets
    ADD CONSTRAINT FK_VenueAssets_Venues
    FOREIGN KEY (VenueId) REFERENCES Venues(Id)
    ON DELETE CASCADE
    PRINT 'Created FK_VenueAssets_Venues'
END
GO

-- FK from VenueAssets to Users
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_VenueAssets_Users')
   AND EXISTS (SELECT * FROM sys.tables WHERE name = 'VenueAssets')
BEGIN
    ALTER TABLE VenueAssets
    ADD CONSTRAINT FK_VenueAssets_Users
    FOREIGN KEY (UserId) REFERENCES Users(Id)
    ON DELETE NO ACTION
    PRINT 'Created FK_VenueAssets_Users'
END
GO

-- FK from VenueAssetLikes to VenueAssets
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_VenueAssetLikes_VenueAssets')
   AND EXISTS (SELECT * FROM sys.tables WHERE name = 'VenueAssetLikes')
BEGIN
    ALTER TABLE VenueAssetLikes
    ADD CONSTRAINT FK_VenueAssetLikes_VenueAssets
    FOREIGN KEY (VenueAssetId) REFERENCES VenueAssets(Id)
    ON DELETE CASCADE
    PRINT 'Created FK_VenueAssetLikes_VenueAssets'
END
GO

-- FK from VenueAssetLikes to Users
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_VenueAssetLikes_Users')
   AND EXISTS (SELECT * FROM sys.tables WHERE name = 'VenueAssetLikes')
BEGIN
    ALTER TABLE VenueAssetLikes
    ADD CONSTRAINT FK_VenueAssetLikes_Users
    FOREIGN KEY (UserId) REFERENCES Users(Id)
    ON DELETE NO ACTION
    PRINT 'Created FK_VenueAssetLikes_Users'
END
GO

-- FK from VenueGeoCodes to Venues
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_VenueGeoCodes_Venues')
   AND EXISTS (SELECT * FROM sys.tables WHERE name = 'VenueGeoCodes')
BEGIN
    ALTER TABLE VenueGeoCodes
    ADD CONSTRAINT FK_VenueGeoCodes_Venues
    FOREIGN KEY (VenueId) REFERENCES Venues(Id)
    ON DELETE CASCADE
    PRINT 'Created FK_VenueGeoCodes_Venues'
END
GO

-- FK from Events to Venues
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Events_Venues')
   AND EXISTS (SELECT * FROM sys.tables WHERE name = 'Events')
   AND EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'VenueId')
BEGIN
    ALTER TABLE Events
    ADD CONSTRAINT FK_Events_Venues
    FOREIGN KEY (VenueId) REFERENCES Venues(Id)
    ON DELETE SET NULL
    PRINT 'Created FK_Events_Venues'
END
GO

-- FK from TournamentCourts to Venues
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_TournamentCourts_Venues')
   AND EXISTS (SELECT * FROM sys.tables WHERE name = 'TournamentCourts')
   AND EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TournamentCourts') AND name = 'VenueId')
BEGIN
    ALTER TABLE TournamentCourts
    ADD CONSTRAINT FK_TournamentCourts_Venues
    FOREIGN KEY (VenueId) REFERENCES Venues(Id)
    ON DELETE CASCADE
    PRINT 'Created FK_TournamentCourts_Venues'
END
GO

-- =============================================
-- Step 7: Update/Recreate Stored Procedures
-- =============================================

-- Drop old stored procedures (they reference old table names)
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_SearchCourts')
BEGIN
    DROP PROCEDURE sp_SearchCourts
    PRINT 'Dropped sp_SearchCourts'
END
GO

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetCourtDetail')
BEGIN
    DROP PROCEDURE sp_GetCourtDetail
    PRINT 'Dropped sp_GetCourtDetail'
END
GO

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetCourtStates')
BEGIN
    DROP PROCEDURE sp_GetCourtStates
    PRINT 'Dropped sp_GetCourtStates'
END
GO

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'GetCourtCountries')
BEGIN
    DROP PROCEDURE GetCourtCountries
    PRINT 'Dropped GetCourtCountries'
END
GO

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'GetCourtStatesByCountry')
BEGIN
    DROP PROCEDURE GetCourtStatesByCountry
    PRINT 'Dropped GetCourtStatesByCountry'
END
GO

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'GetCourtCitiesByState')
BEGIN
    DROP PROCEDURE GetCourtCitiesByState
    PRINT 'Dropped GetCourtCitiesByState'
END
GO

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetTopCourtsForUser')
BEGIN
    DROP PROCEDURE sp_GetTopCourtsForUser
    PRINT 'Dropped sp_GetTopCourtsForUser'
END
GO

-- Create sp_SearchVenues
CREATE PROCEDURE sp_SearchVenues
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
            ISNULL(agg.ConfirmationCount, 0) AS ConfirmationCount,
            agg.AverageRating,
            agg.NotACourtCount,
            agg.MostSuggestedName
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
    )
    SELECT *,
        (SELECT COUNT(*) FROM VenueResults
         WHERE @RadiusMiles IS NULL OR Distance IS NULL OR Distance <= @RadiusMiles) AS TotalCount
    FROM VenueResults
    WHERE @RadiusMiles IS NULL OR Distance IS NULL OR Distance <= @RadiusMiles
    ORDER BY
        CASE WHEN Distance IS NOT NULL THEN Distance ELSE 999999 END ASC,
        Name ASC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
PRINT 'Created sp_SearchVenues'
GO

-- Create sp_GetVenueDetail
CREATE PROCEDURE sp_GetVenueDetail
    @VenueId INT,
    @UserLat FLOAT = NULL,
    @UserLng FLOAT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Result set 1: Venue basic info
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

    -- Result set 2: Aggregated confirmation data
    SELECT
        COUNT(*) AS ConfirmationCount,
        AVG(CAST(Rating AS FLOAT)) AS AverageRating,
        SUM(CASE WHEN NotACourt = 1 THEN 1 ELSE 0 END) AS NotACourtCount,
        (SELECT TOP 1 SuggestedName FROM VenueConfirmations
         WHERE VenueId = @VenueId AND SuggestedName IS NOT NULL
         GROUP BY SuggestedName ORDER BY COUNT(*) DESC) AS MostSuggestedName,
        (SELECT TOP 1 ConfirmedIndoorCount FROM VenueConfirmations
         WHERE VenueId = @VenueId AND ConfirmedIndoorCount IS NOT NULL
         GROUP BY ConfirmedIndoorCount ORDER BY COUNT(*) DESC) AS MostConfirmedIndoorCount,
        (SELECT TOP 1 ConfirmedOutdoorCount FROM VenueConfirmations
         WHERE VenueId = @VenueId AND ConfirmedOutdoorCount IS NOT NULL
         GROUP BY ConfirmedOutdoorCount ORDER BY COUNT(*) DESC) AS MostConfirmedOutdoorCount,
        CASE WHEN SUM(CASE WHEN HasLights = 1 THEN 1 ELSE 0 END) > SUM(CASE WHEN HasLights = 0 THEN 1 ELSE 0 END) THEN 1 ELSE 0 END AS MostConfirmedHasLights,
        CASE WHEN SUM(CASE WHEN HasFee = 1 THEN 1 ELSE 0 END) > SUM(CASE WHEN HasFee = 0 THEN 1 ELSE 0 END) THEN 1 ELSE 0 END AS MostConfirmedHasFee,
        (SELECT TOP 1 FeeAmount FROM VenueConfirmations
         WHERE VenueId = @VenueId AND FeeAmount IS NOT NULL
         GROUP BY FeeAmount ORDER BY COUNT(*) DESC) AS CommonFeeAmount,
        (SELECT TOP 1 Hours FROM VenueConfirmations
         WHERE VenueId = @VenueId AND Hours IS NOT NULL
         GROUP BY Hours ORDER BY COUNT(*) DESC) AS CommonHours,
        (SELECT TOP 1 SurfaceType FROM VenueConfirmations
         WHERE VenueId = @VenueId AND SurfaceType IS NOT NULL
         GROUP BY SurfaceType ORDER BY COUNT(*) DESC) AS CommonSurfaceType
    FROM VenueConfirmations
    WHERE VenueId = @VenueId;

    -- Result set 3: Recent confirmations
    SELECT TOP 10
        vc.Id,
        vc.VenueId,
        vc.UserId,
        CONCAT(u.FirstName, ' ', u.LastName) AS UserName,
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
PRINT 'Created sp_GetVenueDetail'
GO

-- Create sp_GetVenueStates
CREATE PROCEDURE sp_GetVenueStates
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DISTINCT State
    FROM Venues
    WHERE State IS NOT NULL AND State != ''
    ORDER BY State;
END
GO
PRINT 'Created sp_GetVenueStates'
GO

-- Create GetVenueCountries
CREATE PROCEDURE GetVenueCountries
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        ISNULL(Country, 'Unknown') AS Country,
        COUNT(*) AS VenueCount
    FROM Venues
    GROUP BY Country
    ORDER BY COUNT(*) DESC, ISNULL(Country, 'Unknown');
END
GO
PRINT 'Created GetVenueCountries'
GO

-- Create GetVenueStatesByCountry
CREATE PROCEDURE GetVenueStatesByCountry
    @Country NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        ISNULL(State, 'Unknown') AS State,
        COUNT(*) AS VenueCount
    FROM Venues
    WHERE (@Country = 'Unknown' AND Country IS NULL) OR Country = @Country
    GROUP BY State
    ORDER BY COUNT(*) DESC, ISNULL(State, 'Unknown');
END
GO
PRINT 'Created GetVenueStatesByCountry'
GO

-- Create GetVenueCitiesByState
CREATE PROCEDURE GetVenueCitiesByState
    @Country NVARCHAR(100),
    @State NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        ISNULL(City, 'Unknown') AS City,
        COUNT(*) AS VenueCount
    FROM Venues
    WHERE ((@Country = 'Unknown' AND Country IS NULL) OR Country = @Country)
      AND ((@State = 'Unknown' AND State IS NULL) OR State = @State)
    GROUP BY City
    ORDER BY COUNT(*) DESC, ISNULL(City, 'Unknown');
END
GO
PRINT 'Created GetVenueCitiesByState'
GO

-- Create sp_GetTopVenuesForUser
CREATE PROCEDURE sp_GetTopVenuesForUser
    @UserId INT,
    @Latitude FLOAT = NULL,
    @Longitude FLOAT = NULL,
    @TopN INT = 10
AS
BEGIN
    SET NOCOUNT ON;

    WITH VenueScores AS (
        SELECT
            v.Id AS VenueId,
            v.Name AS VenueName,
            v.City,
            v.State,
            v.Country,
            CONCAT(v.Addr1, CASE WHEN v.Addr2 IS NOT NULL AND v.Addr2 != '' THEN ' ' + v.Addr2 ELSE '' END) AS Address,
            v.ZIP AS Zip,
            TRY_CAST(v.GPSLat AS FLOAT) AS Latitude,
            TRY_CAST(v.GPSLng AS FLOAT) AS Longitude,
            v.Indoor_Num AS IndoorCourts,
            v.Outdoor_Num AS OutdoorCourts,
            v.Lights AS HasLights,
            vt.Name AS VenueTypeName,
            -- Distance calculation
            CASE
                WHEN @Latitude IS NOT NULL AND @Longitude IS NOT NULL
                     AND TRY_CAST(v.GPSLat AS FLOAT) IS NOT NULL
                     AND TRY_CAST(v.GPSLng AS FLOAT) IS NOT NULL
                THEN 3959 * ACOS(
                    COS(RADIANS(@Latitude)) * COS(RADIANS(TRY_CAST(v.GPSLat AS FLOAT))) *
                    COS(RADIANS(TRY_CAST(v.GPSLng AS FLOAT)) - RADIANS(@Longitude)) +
                    SIN(RADIANS(@Latitude)) * SIN(RADIANS(TRY_CAST(v.GPSLat AS FLOAT)))
                )
                ELSE NULL
            END AS DistanceMiles,
            -- Priority score
            (
                -- Events created at this venue
                ISNULL((SELECT COUNT(*) * 10 FROM Events e WHERE e.VenueId = v.Id AND e.CreatedByUserId = @UserId), 0) +
                -- Events attended at this venue
                ISNULL((SELECT COUNT(*) * 5 FROM EventRegistrations er
                        INNER JOIN Events e ON er.EventId = e.Id
                        WHERE e.VenueId = v.Id AND er.UserId = @UserId), 0) +
                -- Venue confirmations by user
                ISNULL((SELECT COUNT(*) * 3 FROM VenueConfirmations vc WHERE vc.VenueId = v.Id AND vc.UserId = @UserId), 0) +
                -- Distance bonus (closer = higher priority)
                CASE
                    WHEN @Latitude IS NOT NULL AND @Longitude IS NOT NULL
                         AND TRY_CAST(v.GPSLat AS FLOAT) IS NOT NULL
                         AND TRY_CAST(v.GPSLng AS FLOAT) IS NOT NULL
                    THEN CASE
                        WHEN 3959 * ACOS(
                            COS(RADIANS(@Latitude)) * COS(RADIANS(TRY_CAST(v.GPSLat AS FLOAT))) *
                            COS(RADIANS(TRY_CAST(v.GPSLng AS FLOAT)) - RADIANS(@Longitude)) +
                            SIN(RADIANS(@Latitude)) * SIN(RADIANS(TRY_CAST(v.GPSLat AS FLOAT)))
                        ) <= 5 THEN 20
                        WHEN 3959 * ACOS(
                            COS(RADIANS(@Latitude)) * COS(RADIANS(TRY_CAST(v.GPSLat AS FLOAT))) *
                            COS(RADIANS(TRY_CAST(v.GPSLng AS FLOAT)) - RADIANS(@Longitude)) +
                            SIN(RADIANS(@Latitude)) * SIN(RADIANS(TRY_CAST(v.GPSLat AS FLOAT)))
                        ) <= 10 THEN 15
                        WHEN 3959 * ACOS(
                            COS(RADIANS(@Latitude)) * COS(RADIANS(TRY_CAST(v.GPSLat AS FLOAT))) *
                            COS(RADIANS(TRY_CAST(v.GPSLng AS FLOAT)) - RADIANS(@Longitude)) +
                            SIN(RADIANS(@Latitude)) * SIN(RADIANS(TRY_CAST(v.GPSLat AS FLOAT)))
                        ) <= 25 THEN 10
                        WHEN 3959 * ACOS(
                            COS(RADIANS(@Latitude)) * COS(RADIANS(TRY_CAST(v.GPSLat AS FLOAT))) *
                            COS(RADIANS(TRY_CAST(v.GPSLng AS FLOAT)) - RADIANS(@Longitude)) +
                            SIN(RADIANS(@Latitude)) * SIN(RADIANS(TRY_CAST(v.GPSLat AS FLOAT)))
                        ) <= 50 THEN 5
                        ELSE 0
                    END
                    ELSE 0
                END
            ) AS PriorityScore
        FROM Venues v
        LEFT JOIN VenueTypes vt ON v.VenueTypeId = vt.Id
    )
    SELECT TOP (@TopN) *
    FROM VenueScores
    ORDER BY PriorityScore DESC, DistanceMiles ASC;
END
GO
PRINT 'Created sp_GetTopVenuesForUser'
GO

PRINT 'Migration 042: Rename Courts to Venues completed'
GO
