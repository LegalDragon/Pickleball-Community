-- Migration 129: Add stored procedure for validating event registrations
-- This validates all registration data and returns issues found

PRINT 'Creating sp_ValidateEventRegistrations stored procedure...'
GO

CREATE OR ALTER PROCEDURE sp_ValidateEventRegistrations
    @EventId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Temp table to hold validation results
    CREATE TABLE #ValidationResults (
        Category NVARCHAR(50),
        Severity NVARCHAR(20), -- Error, Warning, Info
        DivisionId INT NULL,
        DivisionName NVARCHAR(200) NULL,
        UnitId INT NULL,
        UnitName NVARCHAR(200) NULL,
        UserId INT NULL,
        UserName NVARCHAR(200) NULL,
        Message NVARCHAR(500)
    );

    -- Check for incomplete teams (missing players)
    INSERT INTO #ValidationResults (Category, Severity, DivisionId, DivisionName, UnitId, UnitName, Message)
    SELECT
        'Incomplete Team',
        'Warning',
        d.Id,
        d.Name,
        u.Id,
        u.Name,
        'Team has ' + CAST(COUNT(m.Id) AS NVARCHAR(10)) + ' of ' + CAST(COALESCE(tu.MaleCount + tu.FemaleCount + tu.UnisexCount, d.TeamSize) AS NVARCHAR(10)) + ' required players'
    FROM EventUnits u
    INNER JOIN EventDivisions d ON u.DivisionId = d.Id
    LEFT JOIN TeamUnits tu ON d.TeamUnitId = tu.Id
    LEFT JOIN EventUnitMembers m ON u.Id = m.UnitId AND m.InviteStatus = 'Accepted'
    WHERE u.EventId = @EventId
        AND u.Status NOT IN ('Cancelled')
        AND COALESCE(tu.MaleCount + tu.FemaleCount + tu.UnisexCount, d.TeamSize) > 1
    GROUP BY d.Id, d.Name, u.Id, u.Name, tu.MaleCount, tu.FemaleCount, tu.UnisexCount, d.TeamSize
    HAVING COUNT(m.Id) < COALESCE(tu.MaleCount + tu.FemaleCount + tu.UnisexCount, d.TeamSize);

    -- Check for missing waivers
    DECLARE @WaiverCount INT;
    SELECT @WaiverCount = COUNT(*)
    FROM ObjectAssets oa
    INNER JOIN ObjectAssetTypes oat ON oa.ObjectAssetTypeId = oat.Id
    WHERE oa.ObjectId = @EventId
        AND LOWER(oat.TypeName) = 'waiver';

    IF @WaiverCount > 0
    BEGIN
        INSERT INTO #ValidationResults (Category, Severity, DivisionId, DivisionName, UnitId, UnitName, UserId, UserName, Message)
        SELECT
            'Missing Waiver',
            'Warning',
            d.Id,
            d.Name,
            u.Id,
            u.Name,
            usr.Id,
            LTRIM(RTRIM(COALESCE(usr.LastName, '') + ', ' + COALESCE(usr.FirstName, ''))),
            'Player has not signed the waiver (' + CAST(@WaiverCount - COALESCE(wc.SignedCount, 0) AS NVARCHAR(10)) + ' unsigned)'
        FROM EventUnits u
        INNER JOIN EventDivisions d ON u.DivisionId = d.Id
        INNER JOIN EventUnitMembers m ON u.Id = m.UnitId AND m.InviteStatus = 'Accepted'
        INNER JOIN Users usr ON m.UserId = usr.Id
        LEFT JOIN (
            SELECT EventUnitMemberId, COUNT(*) AS SignedCount
            FROM EventUnitMemberWaivers
            GROUP BY EventUnitMemberId
        ) wc ON m.Id = wc.EventUnitMemberId
        WHERE u.EventId = @EventId
            AND u.Status NOT IN ('Cancelled')
            AND COALESCE(wc.SignedCount, 0) < @WaiverCount;
    END

    -- Check for missing payments (where fee > 0)
    INSERT INTO #ValidationResults (Category, Severity, DivisionId, DivisionName, UnitId, UnitName, UserId, UserName, Message)
    SELECT
        'Missing Payment',
        'Warning',
        d.Id,
        d.Name,
        u.Id,
        u.Name,
        usr.Id,
        LTRIM(RTRIM(COALESCE(usr.LastName, '') + ', ' + COALESCE(usr.FirstName, ''))),
        'Player has not paid (Fee: $' + CAST(COALESCE(d.DivisionFee, 0) AS NVARCHAR(20)) + ')'
    FROM EventUnits u
    INNER JOIN EventDivisions d ON u.DivisionId = d.Id
    INNER JOIN EventUnitMembers m ON u.Id = m.UnitId AND m.InviteStatus = 'Accepted'
    INNER JOIN Users usr ON m.UserId = usr.Id
    WHERE u.EventId = @EventId
        AND u.Status NOT IN ('Cancelled')
        AND d.DivisionFee > 0
        AND m.HasPaid = 0;

    -- Check for pending partner invites
    INSERT INTO #ValidationResults (Category, Severity, DivisionId, DivisionName, UnitId, UnitName, UserId, UserName, Message)
    SELECT
        'Pending Invite',
        'Warning',
        d.Id,
        d.Name,
        u.Id,
        u.Name,
        usr.Id,
        LTRIM(RTRIM(COALESCE(usr.LastName, '') + ', ' + COALESCE(usr.FirstName, ''))),
        'Partner invitation is still pending (invited ' +
            CASE WHEN m.InvitedAt IS NOT NULL
                THEN CAST(DATEDIFF(day, m.InvitedAt, GETDATE()) AS NVARCHAR(10)) + ' days ago'
                ELSE 'unknown time'
            END + ')'
    FROM EventUnits u
    INNER JOIN EventDivisions d ON u.DivisionId = d.Id
    INNER JOIN EventUnitMembers m ON u.Id = m.UnitId AND m.InviteStatus = 'Pending'
    INNER JOIN Users usr ON m.UserId = usr.Id
    WHERE u.EventId = @EventId
        AND u.Status NOT IN ('Cancelled');

    -- Check for orphaned units (no accepted members)
    INSERT INTO #ValidationResults (Category, Severity, DivisionId, DivisionName, UnitId, UnitName, Message)
    SELECT
        'Orphaned Unit',
        'Error',
        d.Id,
        d.Name,
        u.Id,
        u.Name,
        'Unit has no accepted members - should be cleaned up'
    FROM EventUnits u
    INNER JOIN EventDivisions d ON u.DivisionId = d.Id
    LEFT JOIN EventUnitMembers m ON u.Id = m.UnitId AND m.InviteStatus = 'Accepted'
    WHERE u.EventId = @EventId
        AND u.Status NOT IN ('Cancelled')
    GROUP BY d.Id, d.Name, u.Id, u.Name
    HAVING COUNT(m.Id) = 0;

    -- Check for duplicate registrations (same user in multiple units for same division)
    INSERT INTO #ValidationResults (Category, Severity, DivisionId, DivisionName, UserId, UserName, Message)
    SELECT
        'Duplicate Registration',
        'Error',
        d.Id,
        d.Name,
        usr.Id,
        LTRIM(RTRIM(COALESCE(usr.LastName, '') + ', ' + COALESCE(usr.FirstName, ''))),
        'Player is registered in ' + CAST(COUNT(u.Id) AS NVARCHAR(10)) + ' units for the same division'
    FROM EventUnits u
    INNER JOIN EventDivisions d ON u.DivisionId = d.Id
    INNER JOIN EventUnitMembers m ON u.Id = m.UnitId AND m.InviteStatus = 'Accepted'
    INNER JOIN Users usr ON m.UserId = usr.Id
    WHERE u.EventId = @EventId
        AND u.Status NOT IN ('Cancelled')
    GROUP BY d.Id, d.Name, usr.Id, usr.LastName, usr.FirstName
    HAVING COUNT(u.Id) > 1;

    -- Check for units over capacity (too many players)
    INSERT INTO #ValidationResults (Category, Severity, DivisionId, DivisionName, UnitId, UnitName, Message)
    SELECT
        'Over Capacity',
        'Error',
        d.Id,
        d.Name,
        u.Id,
        u.Name,
        'Team has ' + CAST(COUNT(m.Id) AS NVARCHAR(10)) + ' players but only ' + CAST(COALESCE(tu.MaleCount + tu.FemaleCount + tu.UnisexCount, d.TeamSize) AS NVARCHAR(10)) + ' allowed'
    FROM EventUnits u
    INNER JOIN EventDivisions d ON u.DivisionId = d.Id
    LEFT JOIN TeamUnits tu ON d.TeamUnitId = tu.Id
    LEFT JOIN EventUnitMembers m ON u.Id = m.UnitId AND m.InviteStatus = 'Accepted'
    WHERE u.EventId = @EventId
        AND u.Status NOT IN ('Cancelled')
    GROUP BY d.Id, d.Name, u.Id, u.Name, tu.MaleCount, tu.FemaleCount, tu.UnisexCount, d.TeamSize
    HAVING COUNT(m.Id) > COALESCE(tu.MaleCount + tu.FemaleCount + tu.UnisexCount, d.TeamSize);

    -- Check for not checked in (event day validation)
    INSERT INTO #ValidationResults (Category, Severity, DivisionId, DivisionName, UnitId, UnitName, UserId, UserName, Message)
    SELECT
        'Not Checked In',
        'Info',
        d.Id,
        d.Name,
        u.Id,
        u.Name,
        usr.Id,
        LTRIM(RTRIM(COALESCE(usr.LastName, '') + ', ' + COALESCE(usr.FirstName, ''))),
        'Player has not checked in'
    FROM EventUnits u
    INNER JOIN EventDivisions d ON u.DivisionId = d.Id
    INNER JOIN EventUnitMembers m ON u.Id = m.UnitId AND m.InviteStatus = 'Accepted'
    INNER JOIN Users usr ON m.UserId = usr.Id
    WHERE u.EventId = @EventId
        AND u.Status NOT IN ('Cancelled')
        AND m.IsCheckedIn = 0;

    -- Return summary counts
    SELECT
        Category,
        Severity,
        COUNT(*) AS IssueCount
    FROM #ValidationResults
    GROUP BY Category, Severity
    ORDER BY
        CASE Severity WHEN 'Error' THEN 1 WHEN 'Warning' THEN 2 ELSE 3 END,
        Category;

    -- Return all issues
    SELECT
        Category,
        Severity,
        DivisionId,
        DivisionName,
        UnitId,
        UnitName,
        UserId,
        UserName,
        Message
    FROM #ValidationResults
    ORDER BY
        CASE Severity WHEN 'Error' THEN 1 WHEN 'Warning' THEN 2 ELSE 3 END,
        Category,
        DivisionName,
        UnitName,
        UserName;

    DROP TABLE #ValidationResults;
END
GO

PRINT 'sp_ValidateEventRegistrations created successfully'
GO
