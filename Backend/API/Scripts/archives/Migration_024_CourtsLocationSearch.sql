-- Migration 024: Courts Location Search Stored Procedures
-- Creates procedures for getting countries and states for court search dropdowns
-- with counts, sorted by popularity

PRINT 'Starting Migration 024: Courts Location Search Stored Procedures'
GO

-- =============================================
-- Procedure: GetCourtCountries
-- Returns countries with court counts, sorted by count descending
-- =============================================
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'GetCourtCountries')
BEGIN
    DROP PROCEDURE GetCourtCountries
    PRINT 'Dropped existing GetCourtCountries procedure'
END
GO

CREATE PROCEDURE GetCourtCountries
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        Country = ISNULL(Country, 'Unknown'),
        CourtCount = COUNT(*)
    FROM Courts
    GROUP BY Country
    ORDER BY
        COUNT(*) DESC,
        ISNULL(Country, 'Unknown') ASC
END
GO

PRINT 'Created GetCourtCountries procedure'
GO

-- =============================================
-- Procedure: GetCourtStatesByCountry
-- Returns states for a given country with court counts
-- Sorted by count descending, then alphabetically
-- =============================================
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'GetCourtStatesByCountry')
BEGIN
    DROP PROCEDURE GetCourtStatesByCountry
    PRINT 'Dropped existing GetCourtStatesByCountry procedure'
END
GO

CREATE PROCEDURE GetCourtStatesByCountry
    @Country NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    -- Handle null/empty country parameter - treat as 'Unknown'
    DECLARE @SearchCountry NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Country)), '')

    SELECT
        State = ISNULL(State, 'Unknown'),
        CourtCount = COUNT(*)
    FROM Courts
    WHERE (
          (@SearchCountry IS NULL AND Country IS NULL)
          OR (@SearchCountry = 'Unknown' AND Country IS NULL)
          OR Country = @SearchCountry
      )
    GROUP BY State
    ORDER BY
        COUNT(*) DESC,
        ISNULL(State, 'Unknown') ASC
END
GO

PRINT 'Created GetCourtStatesByCountry procedure'
GO

-- =============================================
-- Procedure: GetCourtCitiesByState
-- Returns cities for a given country/state with court counts
-- Sorted by count descending, then alphabetically
-- =============================================
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'GetCourtCitiesByState')
BEGIN
    DROP PROCEDURE GetCourtCitiesByState
    PRINT 'Dropped existing GetCourtCitiesByState procedure'
END
GO

CREATE PROCEDURE GetCourtCitiesByState
    @Country NVARCHAR(100),
    @State NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    -- Handle null/empty parameters - treat as 'Unknown'
    DECLARE @SearchCountry NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Country)), '')
    DECLARE @SearchState NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@State)), '')

    SELECT
        City = ISNULL(City, 'Unknown'),
        CourtCount = COUNT(*)
    FROM Courts
    WHERE (
          (@SearchCountry IS NULL AND Country IS NULL)
          OR (@SearchCountry = 'Unknown' AND Country IS NULL)
          OR Country = @SearchCountry
      )
      AND (
          (@SearchState IS NULL AND State IS NULL)
          OR (@SearchState = 'Unknown' AND State IS NULL)
          OR State = @SearchState
      )
    GROUP BY City
    ORDER BY
        COUNT(*) DESC,
        ISNULL(City, 'Unknown') ASC
END
GO

PRINT 'Created GetCourtCitiesByState procedure'
GO

-- =============================================
-- Procedure: GetCourtLocationStats
-- Returns complete location hierarchy with counts
-- Useful for pre-loading location data
-- =============================================
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'GetCourtLocationStats')
BEGIN
    DROP PROCEDURE GetCourtLocationStats
    PRINT 'Dropped existing GetCourtLocationStats procedure'
END
GO

CREATE PROCEDURE GetCourtLocationStats
AS
BEGIN
    SET NOCOUNT ON;

    -- Return countries
    SELECT
        Country = ISNULL(Country, 'Unknown'),
        CourtCount = COUNT(*)
    FROM Courts
    GROUP BY Country
    ORDER BY
        COUNT(*) DESC,
        ISNULL(Country, 'Unknown') ASC

    -- Return country-state combinations
    SELECT
        Country = ISNULL(Country, 'Unknown'),
        State = ISNULL(State, 'Unknown'),
        CourtCount = COUNT(*)
    FROM Courts
    GROUP BY Country, State
    ORDER BY
        ISNULL(Country, 'Unknown') ASC,
        COUNT(*) DESC,
        ISNULL(State, 'Unknown') ASC
END
GO

PRINT 'Created GetCourtLocationStats procedure'
GO

PRINT 'Migration 024 completed successfully'
GO
