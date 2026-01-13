-- Diagnostic script to find pending join requests
-- Run this to identify any pending requests that might not be visible

-- =====================================================
-- 1. CLUB JOIN REQUESTS
-- Shows all pending club join requests
-- =====================================================
PRINT '=== PENDING CLUB JOIN REQUESTS ==='
SELECT
    cjr.Id AS RequestId,
    cjr.ClubId,
    c.Name AS ClubName,
    cjr.UserId AS RequesterUserId,
    u.FirstName + ' ' + u.LastName AS RequesterName,
    cjr.Message,
    cjr.Status,
    cjr.CreatedAt,
    -- Show who can approve (club admins/moderators)
    (SELECT STRING_AGG(CONCAT(admin.FirstName, ' ', admin.LastName, ' (', cm.Role, ')'), ', ')
     FROM ClubMembers cm
     INNER JOIN Users admin ON cm.UserId = admin.Id
     WHERE cm.ClubId = cjr.ClubId AND cm.Role IN ('Admin', 'Moderator') AND cm.IsActive = 1
    ) AS CanApprove
FROM ClubJoinRequests cjr
INNER JOIN Clubs c ON cjr.ClubId = c.Id
INNER JOIN Users u ON cjr.UserId = u.Id
WHERE cjr.Status = 'Pending'
ORDER BY cjr.CreatedAt DESC;

-- =====================================================
-- 2. EVENT UNIT JOIN REQUESTS (Tournament/Team Requests)
-- Shows all pending event unit join requests
-- =====================================================
PRINT ''
PRINT '=== PENDING EVENT UNIT JOIN REQUESTS ==='
SELECT
    eujr.Id AS RequestId,
    eujr.UnitId,
    eu.Name AS UnitName,
    e.Title AS EventTitle,
    d.Name AS DivisionName,
    eujr.UserId AS RequesterUserId,
    u.FirstName + ' ' + u.LastName AS RequesterName,
    eujr.Message,
    eujr.Status,
    eujr.CreatedAt,
    -- Show the captain who can approve
    eu.CaptainUserId,
    captain.FirstName + ' ' + captain.LastName AS CaptainName,
    -- Check if captain has accepted membership
    (SELECT eum.InviteStatus FROM EventUnitMembers eum
     WHERE eum.UnitId = eu.Id AND eum.UserId = eu.CaptainUserId) AS CaptainMembershipStatus
FROM EventUnitJoinRequests eujr
INNER JOIN EventUnits eu ON eujr.UnitId = eu.Id
INNER JOIN Events e ON eu.EventId = e.Id
INNER JOIN EventDivisions d ON eu.DivisionId = d.Id
INNER JOIN Users u ON eujr.UserId = u.Id
LEFT JOIN Users captain ON eu.CaptainUserId = captain.Id
WHERE eujr.Status = 'Pending'
ORDER BY eujr.CreatedAt DESC;

-- =====================================================
-- 3. POTENTIAL ISSUE: Captains without Accepted status
-- This could cause join requests to not be visible
-- =====================================================
PRINT ''
PRINT '=== POTENTIAL ISSUE: CAPTAINS WITHOUT ACCEPTED MEMBERSHIP ==='
SELECT
    eu.Id AS UnitId,
    eu.Name AS UnitName,
    e.Title AS EventTitle,
    eu.CaptainUserId,
    captain.FirstName + ' ' + captain.LastName AS CaptainName,
    eum.InviteStatus AS CaptainMembershipStatus,
    (SELECT COUNT(*) FROM EventUnitJoinRequests WHERE UnitId = eu.Id AND Status = 'Pending') AS PendingRequestCount
FROM EventUnits eu
INNER JOIN Events e ON eu.EventId = e.Id
LEFT JOIN Users captain ON eu.CaptainUserId = captain.Id
LEFT JOIN EventUnitMembers eum ON eum.UnitId = eu.Id AND eum.UserId = eu.CaptainUserId
WHERE eu.Status != 'Cancelled'
  AND (eum.InviteStatus IS NULL OR eum.InviteStatus != 'Accepted')
  AND eu.CaptainUserId IS NOT NULL
ORDER BY e.Title, eu.Name;

-- =====================================================
-- 4. LEAGUE CLUB REQUESTS
-- Shows all pending league club requests
-- =====================================================
PRINT ''
PRINT '=== PENDING LEAGUE CLUB REQUESTS ==='
SELECT
    lcr.Id AS RequestId,
    lcr.LeagueId,
    l.Name AS LeagueName,
    lcr.ClubId,
    c.Name AS ClubName,
    lcr.RequestedByUserId,
    u.FirstName + ' ' + u.LastName AS RequestedByName,
    lcr.Message,
    lcr.Status,
    lcr.CreatedAt
FROM LeagueClubRequests lcr
INNER JOIN Leagues l ON lcr.LeagueId = l.Id
INNER JOIN Clubs c ON lcr.ClubId = c.Id
INNER JOIN Users u ON lcr.RequestedByUserId = u.Id
WHERE lcr.Status = 'Pending'
ORDER BY lcr.CreatedAt DESC;
