-- CheckPoolAssignments.sql
-- Check pool assignments for an entire event
-- Usage: Replace @EventId with your event ID

DECLARE @EventId INT = 1; -- <-- CHANGE THIS TO YOUR EVENT ID

-- Get event info
SELECT
    e.Id AS EventId,
    e.Name AS EventName,
    e.TournamentStatus
FROM Events e
WHERE e.Id = @EventId;

-- Show all units with their pool assignments, grouped by division
SELECT
    d.Name AS DivisionName,
    d.Id AS DivisionId,
    d.PoolCount AS DivisionPoolCount,
    COALESCE(u.PoolName, 'Pool ' + CAST(u.PoolNumber AS VARCHAR), 'Unassigned') AS Pool,
    u.PoolNumber,
    u.UnitNumber AS Seed,
    u.Name AS TeamName,
    -- Calculate what pool SHOULD be based on UnitNumber (for comparison)
    CASE
        WHEN u.UnitNumber IS NOT NULL AND u.UnitNumber > 0
        THEN ((u.UnitNumber - 1) % COALESCE(d.PoolCount, 2)) + 1
        ELSE NULL
    END AS CalculatedPoolNumber,
    -- Flag if there's a mismatch
    CASE
        WHEN u.UnitNumber IS NOT NULL AND u.UnitNumber > 0
             AND u.PoolNumber IS NOT NULL
             AND u.PoolNumber != ((u.UnitNumber - 1) % COALESCE(d.PoolCount, 2)) + 1
        THEN 'MISMATCH!'
        ELSE ''
    END AS PoolMismatch,
    -- Player names
    STUFF((
        SELECT ', ' + COALESCE(usr.FirstName + ' ' + usr.LastName, '[Unknown]')
        FROM EventUnitMembers m
        LEFT JOIN Users usr ON m.UserId = usr.Id
        WHERE m.UnitId = u.Id AND m.InviteStatus = 'Accepted'
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS Players,
    u.Status AS UnitStatus,
    u.MatchesWon,
    u.MatchesLost
FROM EventUnits u
INNER JOIN EventDivisions d ON u.DivisionId = d.Id
WHERE d.EventId = @EventId
  AND u.Status != 'Cancelled'
ORDER BY
    d.Name,
    u.PoolNumber,
    u.UnitNumber;

-- Summary: Count units per pool per division
SELECT
    d.Name AS DivisionName,
    COALESCE(u.PoolName, 'Pool ' + CAST(u.PoolNumber AS VARCHAR), 'Unassigned') AS Pool,
    u.PoolNumber,
    COUNT(*) AS UnitCount,
    STRING_AGG(CAST(u.UnitNumber AS VARCHAR), ', ') AS Seeds  -- Note: ORDER not guaranteed in SQL Server < 2022
FROM EventUnits u
INNER JOIN EventDivisions d ON u.DivisionId = d.Id
WHERE d.EventId = @EventId
  AND u.Status != 'Cancelled'
GROUP BY d.Name, u.PoolName, u.PoolNumber
ORDER BY d.Name, u.PoolNumber;

-- Check for any pool mismatches (units in wrong pool based on UnitNumber)
SELECT
    'POOL MISMATCH DETECTED' AS Warning,
    d.Name AS DivisionName,
    u.UnitNumber AS Seed,
    u.Name AS TeamName,
    u.PoolNumber AS CurrentPool,
    ((u.UnitNumber - 1) % COALESCE(d.PoolCount, 2)) + 1 AS ExpectedPool,
    u.PoolName AS CurrentPoolName,
    'Pool ' + CHAR(64 + ((u.UnitNumber - 1) % COALESCE(d.PoolCount, 2)) + 1) AS ExpectedPoolName
FROM EventUnits u
INNER JOIN EventDivisions d ON u.DivisionId = d.Id
WHERE d.EventId = @EventId
  AND u.Status != 'Cancelled'
  AND u.UnitNumber IS NOT NULL
  AND u.UnitNumber > 0
  AND u.PoolNumber IS NOT NULL
  AND u.PoolNumber != ((u.UnitNumber - 1) % COALESCE(d.PoolCount, 2)) + 1
ORDER BY d.Name, u.UnitNumber;

-- Check encounters to see what pool they're assigned to vs units
SELECT
    d.Name AS DivisionName,
    enc.RoundName AS EncounterPool,
    enc.RoundNumber AS EncounterPoolNumber,
    enc.MatchNumber,
    enc.Unit1Number AS Unit1Seed,
    u1.PoolNumber AS Unit1ActualPool,
    u1.Name AS Unit1Name,
    enc.Unit2Number AS Unit2Seed,
    u2.PoolNumber AS Unit2ActualPool,
    u2.Name AS Unit2Name,
    enc.Status AS EncounterStatus
FROM EventEncounters enc
INNER JOIN EventDivisions d ON enc.DivisionId = d.Id
LEFT JOIN EventUnits u1 ON enc.Unit1Id = u1.Id
LEFT JOIN EventUnits u2 ON enc.Unit2Id = u2.Id
WHERE d.EventId = @EventId
  AND enc.RoundType = 'Pool'
ORDER BY d.Name, enc.RoundNumber, enc.MatchNumber;
