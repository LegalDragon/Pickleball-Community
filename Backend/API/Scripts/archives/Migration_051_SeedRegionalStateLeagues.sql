-- Migration 051: Seed Regional and State Leagues under UCAN
-- Creates regional leagues and state leagues following USA geographic structure

PRINT 'Starting Migration 051: Seed Regional and State Leagues'

-- Ensure UCAN exists and get its ID
DECLARE @UCANId INT
SELECT @UCANId = Id FROM Leagues WHERE Name = 'UCAN' AND Scope = 'National' AND IsActive = 1

IF @UCANId IS NULL
BEGIN
    PRINT 'ERROR: UCAN national league not found. Please create it first.'
    RETURN
END

PRINT 'Found UCAN with Id: ' + CAST(@UCANId AS VARCHAR(10))

-- ============================================================================
-- Create Regional Leagues
-- ============================================================================

DECLARE @WestId INT, @MountainId INT, @MidwestId INT, @SouthwestId INT, @SoutheastId INT, @NortheastId INT

-- West Region
IF NOT EXISTS (SELECT 1 FROM Leagues WHERE Name = 'UCAN West Region' AND ParentLeagueId = @UCANId)
BEGIN
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, Region, Country, SortOrder)
    VALUES ('UCAN West Region', 'Western United States region covering CA, NV, OR, WA, AK, HI', 'Regional', @UCANId, 'West', 'USA', 1)
    SET @WestId = SCOPE_IDENTITY()
    PRINT 'Created West Region'
END
ELSE
BEGIN
    SELECT @WestId = Id FROM Leagues WHERE Name = 'UCAN West Region' AND ParentLeagueId = @UCANId
    PRINT 'West Region already exists'
END

-- Mountain Region
IF NOT EXISTS (SELECT 1 FROM Leagues WHERE Name = 'UCAN Mountain Region' AND ParentLeagueId = @UCANId)
BEGIN
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, Region, Country, SortOrder)
    VALUES ('UCAN Mountain Region', 'Mountain states region covering AZ, CO, ID, MT, NM, UT, WY', 'Regional', @UCANId, 'Mountain', 'USA', 2)
    SET @MountainId = SCOPE_IDENTITY()
    PRINT 'Created Mountain Region'
END
ELSE
BEGIN
    SELECT @MountainId = Id FROM Leagues WHERE Name = 'UCAN Mountain Region' AND ParentLeagueId = @UCANId
    PRINT 'Mountain Region already exists'
END

-- Midwest Region
IF NOT EXISTS (SELECT 1 FROM Leagues WHERE Name = 'UCAN Midwest Region' AND ParentLeagueId = @UCANId)
BEGIN
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, Region, Country, SortOrder)
    VALUES ('UCAN Midwest Region', 'Midwest region covering IA, IL, IN, KS, MI, MN, MO, NE, ND, OH, SD, WI', 'Regional', @UCANId, 'Midwest', 'USA', 3)
    SET @MidwestId = SCOPE_IDENTITY()
    PRINT 'Created Midwest Region'
END
ELSE
BEGIN
    SELECT @MidwestId = Id FROM Leagues WHERE Name = 'UCAN Midwest Region' AND ParentLeagueId = @UCANId
    PRINT 'Midwest Region already exists'
END

-- Southwest Region
IF NOT EXISTS (SELECT 1 FROM Leagues WHERE Name = 'UCAN Southwest Region' AND ParentLeagueId = @UCANId)
BEGIN
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, Region, Country, SortOrder)
    VALUES ('UCAN Southwest Region', 'Southwest region covering AR, LA, OK, TX', 'Regional', @UCANId, 'Southwest', 'USA', 4)
    SET @SouthwestId = SCOPE_IDENTITY()
    PRINT 'Created Southwest Region'
END
ELSE
BEGIN
    SELECT @SouthwestId = Id FROM Leagues WHERE Name = 'UCAN Southwest Region' AND ParentLeagueId = @UCANId
    PRINT 'Southwest Region already exists'
END

-- Southeast Region
IF NOT EXISTS (SELECT 1 FROM Leagues WHERE Name = 'UCAN Southeast Region' AND ParentLeagueId = @UCANId)
BEGIN
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, Region, Country, SortOrder)
    VALUES ('UCAN Southeast Region', 'Southeast region covering AL, FL, GA, KY, MS, NC, SC, TN, VA, WV', 'Regional', @UCANId, 'Southeast', 'USA', 5)
    SET @SoutheastId = SCOPE_IDENTITY()
    PRINT 'Created Southeast Region'
END
ELSE
BEGIN
    SELECT @SoutheastId = Id FROM Leagues WHERE Name = 'UCAN Southeast Region' AND ParentLeagueId = @UCANId
    PRINT 'Southeast Region already exists'
END

-- Northeast Region
IF NOT EXISTS (SELECT 1 FROM Leagues WHERE Name = 'UCAN Northeast Region' AND ParentLeagueId = @UCANId)
BEGIN
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, Region, Country, SortOrder)
    VALUES ('UCAN Northeast Region', 'Northeast region covering CT, DE, MA, MD, ME, NH, NJ, NY, PA, RI, VT, DC', 'Regional', @UCANId, 'Northeast', 'USA', 6)
    SET @NortheastId = SCOPE_IDENTITY()
    PRINT 'Created Northeast Region'
END
ELSE
BEGIN
    SELECT @NortheastId = Id FROM Leagues WHERE Name = 'UCAN Northeast Region' AND ParentLeagueId = @UCANId
    PRINT 'Northeast Region already exists'
END

-- ============================================================================
-- Create State Leagues - West Region (CA, NV, OR, WA, AK, HI)
-- ============================================================================
PRINT 'Creating West Region state leagues...'

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'CA' AND Scope = 'State' AND ParentLeagueId = @WestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN California', 'California state league', 'State', @WestId, 'CA', 'West', 'USA', 1)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'NV' AND Scope = 'State' AND ParentLeagueId = @WestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Nevada', 'Nevada state league', 'State', @WestId, 'NV', 'West', 'USA', 2)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'OR' AND Scope = 'State' AND ParentLeagueId = @WestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Oregon', 'Oregon state league', 'State', @WestId, 'OR', 'West', 'USA', 3)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'WA' AND Scope = 'State' AND ParentLeagueId = @WestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Washington', 'Washington state league', 'State', @WestId, 'WA', 'West', 'USA', 4)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'AK' AND Scope = 'State' AND ParentLeagueId = @WestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Alaska', 'Alaska state league', 'State', @WestId, 'AK', 'West', 'USA', 5)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'HI' AND Scope = 'State' AND ParentLeagueId = @WestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Hawaii', 'Hawaii state league', 'State', @WestId, 'HI', 'West', 'USA', 6)

PRINT 'West Region states created'

-- ============================================================================
-- Create State Leagues - Mountain Region (AZ, CO, ID, MT, NM, UT, WY)
-- ============================================================================
PRINT 'Creating Mountain Region state leagues...'

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'AZ' AND Scope = 'State' AND ParentLeagueId = @MountainId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Arizona', 'Arizona state league', 'State', @MountainId, 'AZ', 'Mountain', 'USA', 1)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'CO' AND Scope = 'State' AND ParentLeagueId = @MountainId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Colorado', 'Colorado state league', 'State', @MountainId, 'CO', 'Mountain', 'USA', 2)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'ID' AND Scope = 'State' AND ParentLeagueId = @MountainId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Idaho', 'Idaho state league', 'State', @MountainId, 'ID', 'Mountain', 'USA', 3)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'MT' AND Scope = 'State' AND ParentLeagueId = @MountainId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Montana', 'Montana state league', 'State', @MountainId, 'MT', 'Mountain', 'USA', 4)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'NM' AND Scope = 'State' AND ParentLeagueId = @MountainId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN New Mexico', 'New Mexico state league', 'State', @MountainId, 'NM', 'Mountain', 'USA', 5)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'UT' AND Scope = 'State' AND ParentLeagueId = @MountainId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Utah', 'Utah state league', 'State', @MountainId, 'UT', 'Mountain', 'USA', 6)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'WY' AND Scope = 'State' AND ParentLeagueId = @MountainId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Wyoming', 'Wyoming state league', 'State', @MountainId, 'WY', 'Mountain', 'USA', 7)

PRINT 'Mountain Region states created'

-- ============================================================================
-- Create State Leagues - Midwest Region (IA, IL, IN, KS, MI, MN, MO, NE, ND, OH, SD, WI)
-- ============================================================================
PRINT 'Creating Midwest Region state leagues...'

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'IA' AND Scope = 'State' AND ParentLeagueId = @MidwestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Iowa', 'Iowa state league', 'State', @MidwestId, 'IA', 'Midwest', 'USA', 1)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'IL' AND Scope = 'State' AND ParentLeagueId = @MidwestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Illinois', 'Illinois state league', 'State', @MidwestId, 'IL', 'Midwest', 'USA', 2)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'IN' AND Scope = 'State' AND ParentLeagueId = @MidwestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Indiana', 'Indiana state league', 'State', @MidwestId, 'IN', 'Midwest', 'USA', 3)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'KS' AND Scope = 'State' AND ParentLeagueId = @MidwestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Kansas', 'Kansas state league', 'State', @MidwestId, 'KS', 'Midwest', 'USA', 4)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'MI' AND Scope = 'State' AND ParentLeagueId = @MidwestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Michigan', 'Michigan state league', 'State', @MidwestId, 'MI', 'Midwest', 'USA', 5)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'MN' AND Scope = 'State' AND ParentLeagueId = @MidwestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Minnesota', 'Minnesota state league', 'State', @MidwestId, 'MN', 'Midwest', 'USA', 6)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'MO' AND Scope = 'State' AND ParentLeagueId = @MidwestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Missouri', 'Missouri state league', 'State', @MidwestId, 'MO', 'Midwest', 'USA', 7)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'NE' AND Scope = 'State' AND ParentLeagueId = @MidwestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Nebraska', 'Nebraska state league', 'State', @MidwestId, 'NE', 'Midwest', 'USA', 8)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'ND' AND Scope = 'State' AND ParentLeagueId = @MidwestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN North Dakota', 'North Dakota state league', 'State', @MidwestId, 'ND', 'Midwest', 'USA', 9)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'OH' AND Scope = 'State' AND ParentLeagueId = @MidwestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Ohio', 'Ohio state league', 'State', @MidwestId, 'OH', 'Midwest', 'USA', 10)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'SD' AND Scope = 'State' AND ParentLeagueId = @MidwestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN South Dakota', 'South Dakota state league', 'State', @MidwestId, 'SD', 'Midwest', 'USA', 11)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'WI' AND Scope = 'State' AND ParentLeagueId = @MidwestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Wisconsin', 'Wisconsin state league', 'State', @MidwestId, 'WI', 'Midwest', 'USA', 12)

PRINT 'Midwest Region states created'

-- ============================================================================
-- Create State Leagues - Southwest Region (AR, LA, OK, TX)
-- ============================================================================
PRINT 'Creating Southwest Region state leagues...'

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'AR' AND Scope = 'State' AND ParentLeagueId = @SouthwestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Arkansas', 'Arkansas state league', 'State', @SouthwestId, 'AR', 'Southwest', 'USA', 1)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'LA' AND Scope = 'State' AND ParentLeagueId = @SouthwestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Louisiana', 'Louisiana state league', 'State', @SouthwestId, 'LA', 'Southwest', 'USA', 2)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'OK' AND Scope = 'State' AND ParentLeagueId = @SouthwestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Oklahoma', 'Oklahoma state league', 'State', @SouthwestId, 'OK', 'Southwest', 'USA', 3)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'TX' AND Scope = 'State' AND ParentLeagueId = @SouthwestId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Texas', 'Texas state league', 'State', @SouthwestId, 'TX', 'Southwest', 'USA', 4)

PRINT 'Southwest Region states created'

-- ============================================================================
-- Create State Leagues - Southeast Region (AL, FL, GA, KY, MS, NC, SC, TN, VA, WV)
-- ============================================================================
PRINT 'Creating Southeast Region state leagues...'

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'AL' AND Scope = 'State' AND ParentLeagueId = @SoutheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Alabama', 'Alabama state league', 'State', @SoutheastId, 'AL', 'Southeast', 'USA', 1)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'FL' AND Scope = 'State' AND ParentLeagueId = @SoutheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Florida', 'Florida state league', 'State', @SoutheastId, 'FL', 'Southeast', 'USA', 2)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'GA' AND Scope = 'State' AND ParentLeagueId = @SoutheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Georgia', 'Georgia state league', 'State', @SoutheastId, 'GA', 'Southeast', 'USA', 3)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'KY' AND Scope = 'State' AND ParentLeagueId = @SoutheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Kentucky', 'Kentucky state league', 'State', @SoutheastId, 'KY', 'Southeast', 'USA', 4)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'MS' AND Scope = 'State' AND ParentLeagueId = @SoutheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Mississippi', 'Mississippi state league', 'State', @SoutheastId, 'MS', 'Southeast', 'USA', 5)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'NC' AND Scope = 'State' AND ParentLeagueId = @SoutheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN North Carolina', 'North Carolina state league', 'State', @SoutheastId, 'NC', 'Southeast', 'USA', 6)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'SC' AND Scope = 'State' AND ParentLeagueId = @SoutheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN South Carolina', 'South Carolina state league', 'State', @SoutheastId, 'SC', 'Southeast', 'USA', 7)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'TN' AND Scope = 'State' AND ParentLeagueId = @SoutheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Tennessee', 'Tennessee state league', 'State', @SoutheastId, 'TN', 'Southeast', 'USA', 8)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'VA' AND Scope = 'State' AND ParentLeagueId = @SoutheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Virginia', 'Virginia state league', 'State', @SoutheastId, 'VA', 'Southeast', 'USA', 9)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'WV' AND Scope = 'State' AND ParentLeagueId = @SoutheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN West Virginia', 'West Virginia state league', 'State', @SoutheastId, 'WV', 'Southeast', 'USA', 10)

PRINT 'Southeast Region states created'

-- ============================================================================
-- Create State Leagues - Northeast Region (CT, DE, MA, MD, ME, NH, NJ, NY, PA, RI, VT, DC)
-- ============================================================================
PRINT 'Creating Northeast Region state leagues...'

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'CT' AND Scope = 'State' AND ParentLeagueId = @NortheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Connecticut', 'Connecticut state league', 'State', @NortheastId, 'CT', 'Northeast', 'USA', 1)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'DE' AND Scope = 'State' AND ParentLeagueId = @NortheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Delaware', 'Delaware state league', 'State', @NortheastId, 'DE', 'Northeast', 'USA', 2)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'MA' AND Scope = 'State' AND ParentLeagueId = @NortheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Massachusetts', 'Massachusetts state league', 'State', @NortheastId, 'MA', 'Northeast', 'USA', 3)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'MD' AND Scope = 'State' AND ParentLeagueId = @NortheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Maryland', 'Maryland state league', 'State', @NortheastId, 'MD', 'Northeast', 'USA', 4)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'ME' AND Scope = 'State' AND ParentLeagueId = @NortheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Maine', 'Maine state league', 'State', @NortheastId, 'ME', 'Northeast', 'USA', 5)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'NH' AND Scope = 'State' AND ParentLeagueId = @NortheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN New Hampshire', 'New Hampshire state league', 'State', @NortheastId, 'NH', 'Northeast', 'USA', 6)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'NJ' AND Scope = 'State' AND ParentLeagueId = @NortheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN New Jersey', 'New Jersey state league', 'State', @NortheastId, 'NJ', 'Northeast', 'USA', 7)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'NY' AND Scope = 'State' AND ParentLeagueId = @NortheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN New York', 'New York state league', 'State', @NortheastId, 'NY', 'Northeast', 'USA', 8)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'PA' AND Scope = 'State' AND ParentLeagueId = @NortheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Pennsylvania', 'Pennsylvania state league', 'State', @NortheastId, 'PA', 'Northeast', 'USA', 9)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'RI' AND Scope = 'State' AND ParentLeagueId = @NortheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Rhode Island', 'Rhode Island state league', 'State', @NortheastId, 'RI', 'Northeast', 'USA', 10)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'VT' AND Scope = 'State' AND ParentLeagueId = @NortheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Vermont', 'Vermont state league', 'State', @NortheastId, 'VT', 'Northeast', 'USA', 11)

IF NOT EXISTS (SELECT 1 FROM Leagues WHERE State = 'DC' AND Scope = 'State' AND ParentLeagueId = @NortheastId)
    INSERT INTO Leagues (Name, Description, Scope, ParentLeagueId, State, Region, Country, SortOrder)
    VALUES ('UCAN Washington DC', 'Washington DC league', 'State', @NortheastId, 'DC', 'Northeast', 'USA', 12)

PRINT 'Northeast Region states created'

-- ============================================================================
-- Summary
-- ============================================================================
PRINT ''
PRINT '============================================'
PRINT 'Migration 051 Complete - League Hierarchy:'
PRINT '============================================'
PRINT ''

SELECT
    CASE
        WHEN l.Scope = 'National' THEN l.Name
        WHEN l.Scope = 'Regional' THEN '  ├── ' + l.Name
        WHEN l.Scope = 'State' THEN '  │   ├── ' + l.Name + ' (' + l.State + ')'
        ELSE l.Name
    END AS [League Hierarchy],
    l.Scope,
    l.Region,
    l.State
FROM Leagues l
WHERE l.IsActive = 1
ORDER BY
    CASE l.Scope
        WHEN 'National' THEN 1
        WHEN 'Regional' THEN 2
        WHEN 'State' THEN 3
        ELSE 4
    END,
    l.Region,
    l.SortOrder

PRINT ''
PRINT 'Total leagues created:'
SELECT Scope, COUNT(*) as Count FROM Leagues WHERE IsActive = 1 GROUP BY Scope

PRINT ''
PRINT 'Migration 051: Seed Regional and State Leagues completed successfully'
