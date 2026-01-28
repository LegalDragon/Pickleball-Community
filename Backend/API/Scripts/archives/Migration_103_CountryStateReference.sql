-- Migration 103: Country and State Reference Tables
-- Creates normalized reference tables for countries and states/provinces
-- Includes data for USA, Canada, and China

PRINT 'Starting Migration 103: Country/State Reference Tables'

-- Create Countries table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Countries')
BEGIN
    CREATE TABLE Countries (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Code2 CHAR(2) NOT NULL,           -- ISO 3166-1 alpha-2
        Code3 CHAR(3) NOT NULL,           -- ISO 3166-1 alpha-3
        NumericCode CHAR(3) NULL,         -- ISO 3166-1 numeric
        PhoneCode NVARCHAR(10) NULL,      -- International dialing code
        IsActive BIT NOT NULL DEFAULT 1,
        SortOrder INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
    )

    CREATE UNIQUE INDEX IX_Countries_Code2 ON Countries(Code2)
    CREATE UNIQUE INDEX IX_Countries_Code3 ON Countries(Code3)
    CREATE INDEX IX_Countries_Name ON Countries(Name)

    PRINT 'Created Countries table'
END
ELSE
    PRINT 'Countries table already exists'

-- Create ProvinceStates table (states, provinces, regions)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ProvinceStates')
BEGIN
    CREATE TABLE ProvinceStates (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CountryId INT NOT NULL,
        Name NVARCHAR(100) NOT NULL,
        Code NVARCHAR(10) NOT NULL,       -- State/province abbreviation
        Type NVARCHAR(50) NULL,           -- State, Province, Territory, Region, etc.
        IsActive BIT NOT NULL DEFAULT 1,
        SortOrder INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_ProvinceStates_Country FOREIGN KEY (CountryId)
            REFERENCES Countries(Id) ON DELETE CASCADE
    )

    CREATE INDEX IX_ProvinceStates_CountryId ON ProvinceStates(CountryId)
    CREATE UNIQUE INDEX IX_ProvinceStates_CountryCode ON ProvinceStates(CountryId, Code)
    CREATE INDEX IX_ProvinceStates_Name ON ProvinceStates(Name)

    PRINT 'Created ProvinceStates table'
END
ELSE
    PRINT 'ProvinceStates table already exists'

-- Insert Countries (if not already populated)
IF NOT EXISTS (SELECT 1 FROM Countries WHERE Code2 = 'US')
BEGIN
    PRINT 'Inserting country data...'

    INSERT INTO Countries (Name, Code2, Code3, NumericCode, PhoneCode, SortOrder) VALUES
    ('United States', 'US', 'USA', '840', '+1', 1),
    ('Canada', 'CA', 'CAN', '124', '+1', 2),
    ('China', 'CN', 'CHN', '156', '+86', 3),
    ('Mexico', 'MX', 'MEX', '484', '+52', 4)

    PRINT 'Inserted 4 countries'
END

-- Get Country IDs
DECLARE @USId INT = (SELECT Id FROM Countries WHERE Code2 = 'US')
DECLARE @CAId INT = (SELECT Id FROM Countries WHERE Code2 = 'CA')
DECLARE @CNId INT = (SELECT Id FROM Countries WHERE Code2 = 'CN')

-- Insert US States (if not already populated)
IF NOT EXISTS (SELECT 1 FROM ProvinceStates WHERE CountryId = @USId)
BEGIN
    PRINT 'Inserting US states...'

    INSERT INTO ProvinceStates (CountryId, Name, Code, Type, SortOrder) VALUES
    (@USId, 'Alabama', 'AL', 'State', 1),
    (@USId, 'Alaska', 'AK', 'State', 2),
    (@USId, 'Arizona', 'AZ', 'State', 3),
    (@USId, 'Arkansas', 'AR', 'State', 4),
    (@USId, 'California', 'CA', 'State', 5),
    (@USId, 'Colorado', 'CO', 'State', 6),
    (@USId, 'Connecticut', 'CT', 'State', 7),
    (@USId, 'Delaware', 'DE', 'State', 8),
    (@USId, 'Florida', 'FL', 'State', 9),
    (@USId, 'Georgia', 'GA', 'State', 10),
    (@USId, 'Hawaii', 'HI', 'State', 11),
    (@USId, 'Idaho', 'ID', 'State', 12),
    (@USId, 'Illinois', 'IL', 'State', 13),
    (@USId, 'Indiana', 'IN', 'State', 14),
    (@USId, 'Iowa', 'IA', 'State', 15),
    (@USId, 'Kansas', 'KS', 'State', 16),
    (@USId, 'Kentucky', 'KY', 'State', 17),
    (@USId, 'Louisiana', 'LA', 'State', 18),
    (@USId, 'Maine', 'ME', 'State', 19),
    (@USId, 'Maryland', 'MD', 'State', 20),
    (@USId, 'Massachusetts', 'MA', 'State', 21),
    (@USId, 'Michigan', 'MI', 'State', 22),
    (@USId, 'Minnesota', 'MN', 'State', 23),
    (@USId, 'Mississippi', 'MS', 'State', 24),
    (@USId, 'Missouri', 'MO', 'State', 25),
    (@USId, 'Montana', 'MT', 'State', 26),
    (@USId, 'Nebraska', 'NE', 'State', 27),
    (@USId, 'Nevada', 'NV', 'State', 28),
    (@USId, 'New Hampshire', 'NH', 'State', 29),
    (@USId, 'New Jersey', 'NJ', 'State', 30),
    (@USId, 'New Mexico', 'NM', 'State', 31),
    (@USId, 'New York', 'NY', 'State', 32),
    (@USId, 'North Carolina', 'NC', 'State', 33),
    (@USId, 'North Dakota', 'ND', 'State', 34),
    (@USId, 'Ohio', 'OH', 'State', 35),
    (@USId, 'Oklahoma', 'OK', 'State', 36),
    (@USId, 'Oregon', 'OR', 'State', 37),
    (@USId, 'Pennsylvania', 'PA', 'State', 38),
    (@USId, 'Rhode Island', 'RI', 'State', 39),
    (@USId, 'South Carolina', 'SC', 'State', 40),
    (@USId, 'South Dakota', 'SD', 'State', 41),
    (@USId, 'Tennessee', 'TN', 'State', 42),
    (@USId, 'Texas', 'TX', 'State', 43),
    (@USId, 'Utah', 'UT', 'State', 44),
    (@USId, 'Vermont', 'VT', 'State', 45),
    (@USId, 'Virginia', 'VA', 'State', 46),
    (@USId, 'Washington', 'WA', 'State', 47),
    (@USId, 'West Virginia', 'WV', 'State', 48),
    (@USId, 'Wisconsin', 'WI', 'State', 49),
    (@USId, 'Wyoming', 'WY', 'State', 50),
    -- US Territories
    (@USId, 'District of Columbia', 'DC', 'Federal District', 51),
    (@USId, 'Puerto Rico', 'PR', 'Territory', 52),
    (@USId, 'Guam', 'GU', 'Territory', 53),
    (@USId, 'U.S. Virgin Islands', 'VI', 'Territory', 54),
    (@USId, 'American Samoa', 'AS', 'Territory', 55),
    (@USId, 'Northern Mariana Islands', 'MP', 'Territory', 56)

    PRINT 'Inserted 56 US states and territories'
END

-- Insert Canadian Provinces (if not already populated)
IF NOT EXISTS (SELECT 1 FROM ProvinceStates WHERE CountryId = @CAId)
BEGIN
    PRINT 'Inserting Canadian provinces...'

    INSERT INTO ProvinceStates (CountryId, Name, Code, Type, SortOrder) VALUES
    (@CAId, 'Alberta', 'AB', 'Province', 1),
    (@CAId, 'British Columbia', 'BC', 'Province', 2),
    (@CAId, 'Manitoba', 'MB', 'Province', 3),
    (@CAId, 'New Brunswick', 'NB', 'Province', 4),
    (@CAId, 'Newfoundland and Labrador', 'NL', 'Province', 5),
    (@CAId, 'Nova Scotia', 'NS', 'Province', 6),
    (@CAId, 'Ontario', 'ON', 'Province', 7),
    (@CAId, 'Prince Edward Island', 'PE', 'Province', 8),
    (@CAId, 'Quebec', 'QC', 'Province', 9),
    (@CAId, 'Saskatchewan', 'SK', 'Province', 10),
    -- Canadian Territories
    (@CAId, 'Northwest Territories', 'NT', 'Territory', 11),
    (@CAId, 'Nunavut', 'NU', 'Territory', 12),
    (@CAId, 'Yukon', 'YT', 'Territory', 13)

    PRINT 'Inserted 13 Canadian provinces and territories'
END

-- Insert Chinese Provinces (if not already populated)
IF NOT EXISTS (SELECT 1 FROM ProvinceStates WHERE CountryId = @CNId)
BEGIN
    PRINT 'Inserting Chinese provinces...'

    INSERT INTO ProvinceStates (CountryId, Name, Code, Type, SortOrder) VALUES
    -- Municipalities (directly under central government)
    (@CNId, 'Beijing', 'BJ', 'Municipality', 1),
    (@CNId, 'Tianjin', 'TJ', 'Municipality', 2),
    (@CNId, 'Shanghai', 'SH', 'Municipality', 3),
    (@CNId, 'Chongqing', 'CQ', 'Municipality', 4),
    -- Provinces
    (@CNId, 'Anhui', 'AH', 'Province', 5),
    (@CNId, 'Fujian', 'FJ', 'Province', 6),
    (@CNId, 'Gansu', 'GS', 'Province', 7),
    (@CNId, 'Guangdong', 'GD', 'Province', 8),
    (@CNId, 'Guizhou', 'GZ', 'Province', 9),
    (@CNId, 'Hainan', 'HI', 'Province', 10),
    (@CNId, 'Hebei', 'HE', 'Province', 11),
    (@CNId, 'Heilongjiang', 'HL', 'Province', 12),
    (@CNId, 'Henan', 'HA', 'Province', 13),
    (@CNId, 'Hubei', 'HB', 'Province', 14),
    (@CNId, 'Hunan', 'HN', 'Province', 15),
    (@CNId, 'Jiangsu', 'JS', 'Province', 16),
    (@CNId, 'Jiangxi', 'JX', 'Province', 17),
    (@CNId, 'Jilin', 'JL', 'Province', 18),
    (@CNId, 'Liaoning', 'LN', 'Province', 19),
    (@CNId, 'Qinghai', 'QH', 'Province', 20),
    (@CNId, 'Shaanxi', 'SN', 'Province', 21),
    (@CNId, 'Shandong', 'SD', 'Province', 22),
    (@CNId, 'Shanxi', 'SX', 'Province', 23),
    (@CNId, 'Sichuan', 'SC', 'Province', 24),
    (@CNId, 'Yunnan', 'YN', 'Province', 25),
    (@CNId, 'Zhejiang', 'ZJ', 'Province', 26),
    -- Autonomous Regions
    (@CNId, 'Guangxi', 'GX', 'Autonomous Region', 27),
    (@CNId, 'Inner Mongolia', 'NM', 'Autonomous Region', 28),
    (@CNId, 'Ningxia', 'NX', 'Autonomous Region', 29),
    (@CNId, 'Tibet', 'XZ', 'Autonomous Region', 30),
    (@CNId, 'Xinjiang', 'XJ', 'Autonomous Region', 31),
    -- Special Administrative Regions
    (@CNId, 'Hong Kong', 'HK', 'SAR', 32),
    (@CNId, 'Macau', 'MO', 'SAR', 33),
    -- Taiwan (disputed, but included for completeness)
    (@CNId, 'Taiwan', 'TW', 'Province', 34)

    PRINT 'Inserted 34 Chinese provinces and regions'
END

-- Create view for easy lookups
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_CountryStates')
    DROP VIEW vw_CountryStates
GO

CREATE VIEW vw_CountryStates AS
SELECT
    ps.Id AS StateId,
    ps.Name AS StateName,
    ps.Code AS StateCode,
    ps.Type AS StateType,
    c.Id AS CountryId,
    c.Name AS CountryName,
    c.Code2 AS CountryCode2,
    c.Code3 AS CountryCode3,
    c.PhoneCode
FROM ProvinceStates ps
INNER JOIN Countries c ON ps.CountryId = c.Id
WHERE ps.IsActive = 1 AND c.IsActive = 1
GO

PRINT 'Created vw_CountryStates view'

-- Create stored procedure to get countries
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetCountries')
    DROP PROCEDURE sp_GetCountries
GO

CREATE PROCEDURE sp_GetCountries
    @ActiveOnly BIT = 1
AS
BEGIN
    SELECT Id, Name, Code2, Code3, NumericCode, PhoneCode, IsActive, SortOrder
    FROM Countries
    WHERE @ActiveOnly = 0 OR IsActive = 1
    ORDER BY SortOrder, Name
END
GO

PRINT 'Created sp_GetCountries stored procedure'

-- Create stored procedure to get states by country
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetStatesByCountry')
    DROP PROCEDURE sp_GetStatesByCountry
GO

CREATE PROCEDURE sp_GetStatesByCountry
    @CountryCode NVARCHAR(10),
    @ActiveOnly BIT = 1
AS
BEGIN
    SELECT ps.Id, ps.Name, ps.Code, ps.Type, ps.IsActive, ps.SortOrder
    FROM ProvinceStates ps
    INNER JOIN Countries c ON ps.CountryId = c.Id
    WHERE (c.Code2 = @CountryCode OR c.Code3 = @CountryCode OR c.Name = @CountryCode)
        AND (@ActiveOnly = 0 OR ps.IsActive = 1)
    ORDER BY ps.SortOrder, ps.Name
END
GO

PRINT 'Created sp_GetStatesByCountry stored procedure'

-- Create stored procedure to normalize country/state values
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_NormalizeLocation')
    DROP PROCEDURE sp_NormalizeLocation
GO

CREATE PROCEDURE sp_NormalizeLocation
    @InputCountry NVARCHAR(100),
    @InputState NVARCHAR(100),
    @NormalizedCountryCode CHAR(2) OUTPUT,
    @NormalizedCountryName NVARCHAR(100) OUTPUT,
    @NormalizedStateCode NVARCHAR(10) OUTPUT,
    @NormalizedStateName NVARCHAR(100) OUTPUT
AS
BEGIN
    -- Try to match country by code or name (case-insensitive, trimmed)
    SET @InputCountry = LTRIM(RTRIM(@InputCountry))
    SET @InputState = LTRIM(RTRIM(@InputState))

    -- Match country
    SELECT TOP 1
        @NormalizedCountryCode = Code2,
        @NormalizedCountryName = Name
    FROM Countries
    WHERE UPPER(Code2) = UPPER(@InputCountry)
       OR UPPER(Code3) = UPPER(@InputCountry)
       OR UPPER(Name) = UPPER(@InputCountry)
       -- Handle common variations
       OR (UPPER(@InputCountry) IN ('USA', 'U.S.', 'U.S.A.', 'UNITED STATES OF AMERICA', 'AMERICA') AND Code2 = 'US')
       OR (UPPER(@InputCountry) IN ('UK', 'GREAT BRITAIN', 'ENGLAND') AND Code2 = 'GB')

    -- If no country match, return inputs as-is
    IF @NormalizedCountryCode IS NULL
    BEGIN
        SET @NormalizedCountryCode = NULL
        SET @NormalizedCountryName = @InputCountry
        SET @NormalizedStateCode = NULL
        SET @NormalizedStateName = @InputState
        RETURN
    END

    -- Match state within the matched country
    DECLARE @CountryId INT = (SELECT Id FROM Countries WHERE Code2 = @NormalizedCountryCode)

    SELECT TOP 1
        @NormalizedStateCode = Code,
        @NormalizedStateName = Name
    FROM ProvinceStates
    WHERE CountryId = @CountryId
      AND (UPPER(Code) = UPPER(@InputState)
           OR UPPER(Name) = UPPER(@InputState)
           -- Handle common variations
           OR (UPPER(@InputState) LIKE '%' + UPPER(Name) + '%')
           OR (UPPER(Name) LIKE '%' + UPPER(@InputState) + '%'))

    -- If no state match, return input state as-is
    IF @NormalizedStateCode IS NULL
    BEGIN
        SET @NormalizedStateCode = NULL
        SET @NormalizedStateName = @InputState
    END
END
GO

PRINT 'Created sp_NormalizeLocation stored procedure'

PRINT 'Migration 103 completed successfully'
