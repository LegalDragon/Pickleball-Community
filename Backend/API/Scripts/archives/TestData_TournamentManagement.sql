-- Test Data Script for Tournament Management
-- Usage: Set @EventId to your target event, then run this script
-- This script is idempotent and will clean up existing test data before inserting

PRINT '=================================================='
PRINT 'Tournament Management Test Data Script'
PRINT '=================================================='

-- ============================================
-- CONFIGURATION - SET YOUR EVENT ID HERE
-- ============================================
DECLARE @EventId INT = 1  -- <-- CHANGE THIS TO YOUR EVENT ID

-- ============================================
-- Validate Event Exists
-- ============================================
IF NOT EXISTS (SELECT 1 FROM Events WHERE Id = @EventId)
BEGIN
    PRINT 'ERROR: Event with ID ' + CAST(@EventId AS NVARCHAR(10)) + ' does not exist!'
    PRINT 'Please create an event first or specify a valid EventId.'
    RETURN
END

DECLARE @EventName NVARCHAR(200)
SELECT @EventName = Name FROM Events WHERE Id = @EventId
PRINT 'Target Event: ' + @EventName + ' (ID: ' + CAST(@EventId AS NVARCHAR(10)) + ')'

-- ============================================
-- Get or Create Test Users (need at least 16 for a good bracket)
-- ============================================
PRINT ''
PRINT 'Setting up test users...'

-- Create a temp table for test user IDs
DECLARE @TestUsers TABLE (Id INT, RowNum INT)

-- Get existing users (up to 16)
INSERT INTO @TestUsers (Id, RowNum)
SELECT TOP 16 Id, ROW_NUMBER() OVER (ORDER BY Id) as RowNum
FROM Users
WHERE IsActive = 1
ORDER BY Id

DECLARE @UserCount INT = (SELECT COUNT(*) FROM @TestUsers)
PRINT 'Found ' + CAST(@UserCount AS NVARCHAR(10)) + ' existing users for test data'

IF @UserCount < 4
BEGIN
    PRINT 'WARNING: Need at least 4 users for meaningful test data. Found only ' + CAST(@UserCount AS NVARCHAR(10))
    PRINT 'Creating placeholder users is not possible - please ensure you have at least 4 registered users.'
    RETURN
END

-- ============================================
-- Clean Up Existing Test Data for this Event
-- ============================================
PRINT ''
PRINT 'Cleaning up existing tournament data for event...'

-- Delete in correct order due to foreign keys
DELETE FROM EventGamePlayers WHERE GameId IN (SELECT g.Id FROM EventGames g INNER JOIN EventMatches m ON g.MatchId = m.Id WHERE m.EventId = @EventId)
DELETE FROM EventGames WHERE MatchId IN (SELECT Id FROM EventMatches WHERE EventId = @EventId)
DELETE FROM EventMatches WHERE EventId = @EventId
DELETE FROM EventUnitMembers WHERE UnitId IN (SELECT Id FROM EventUnits WHERE EventId = @EventId)
DELETE FROM EventUnitJoinRequests WHERE UnitId IN (SELECT Id FROM EventUnits WHERE EventId = @EventId)
DELETE FROM EventUnits WHERE EventId = @EventId
DELETE FROM TournamentCourts WHERE EventId = @EventId

PRINT 'Existing tournament data cleaned up.'

-- ============================================
-- Ensure Event Has At Least One Division
-- ============================================
DECLARE @DivisionId INT

IF NOT EXISTS (SELECT 1 FROM EventDivisions WHERE EventId = @EventId AND IsActive = 1)
BEGIN
    PRINT ''
    PRINT 'Creating default division for event...'

    -- TeamUnitId 2 = 'pair' (doubles), TeamSize 2, MaxTeams 16, DivisionFee 25.00
    INSERT INTO EventDivisions (EventId, Name, Description, TeamSize, TeamUnitId, MaxTeams, DivisionFee, SkillLevelId, AgeGroupId, PoolCount, BracketType, GamesPerMatch, SortOrder, IsActive)
    VALUES (@EventId, 'Open Doubles', 'Open division for all skill levels', 2, 2, 16, 25.00, NULL, NULL, 2, 'RoundRobin', 3, 0, 1)

    SET @DivisionId = SCOPE_IDENTITY()
    PRINT 'Created division: Open Doubles (ID: ' + CAST(@DivisionId AS NVARCHAR(10)) + ')'
END
ELSE
BEGIN
    SELECT TOP 1 @DivisionId = Id FROM EventDivisions WHERE EventId = @EventId AND IsActive = 1 ORDER BY Id
    PRINT 'Using existing division ID: ' + CAST(@DivisionId AS NVARCHAR(10))
END

-- Get division details (TeamSize determines players per team)
DECLARE @TeamSize INT
SELECT @TeamSize = TeamSize FROM EventDivisions WHERE Id = @DivisionId
SET @TeamSize = ISNULL(@TeamSize, 2)
PRINT 'Division team size: ' + CAST(@TeamSize AS NVARCHAR(10)) + ' players per team'

-- ============================================
-- Create Tournament Courts
-- ============================================
PRINT ''
PRINT 'Creating tournament courts...'

INSERT INTO TournamentCourts (EventId, CourtLabel, Status, LocationDescription, SortOrder, IsActive)
VALUES
    (@EventId, 'Court 1', 'Available', 'Main gym - North side', 1, 1),
    (@EventId, 'Court 2', 'Available', 'Main gym - South side', 2, 1),
    (@EventId, 'Court 3', 'Available', 'Outdoor court A', 3, 1),
    (@EventId, 'Court 4', 'Available', 'Outdoor court B', 4, 1)

PRINT 'Created 4 tournament courts.'

-- ============================================
-- Create Event Units (Teams)
-- ============================================
PRINT ''
PRINT 'Creating event units (teams)...'

DECLARE @NumUnits INT = @UserCount / @TeamSize
IF @NumUnits > 8 SET @NumUnits = 8  -- Cap at 8 teams for manageable test data

DECLARE @TeamNames TABLE (Idx INT, TeamName NVARCHAR(100))
INSERT INTO @TeamNames VALUES
    (1, 'Thunder Smash'),
    (2, 'Dink Dynasty'),
    (3, 'Kitchen Kings'),
    (4, 'Paddle Pros'),
    (5, 'Net Ninjas'),
    (6, 'Rally Rebels'),
    (7, 'Lob Legends'),
    (8, 'Volley Vikings')

DECLARE @i INT = 1
DECLARE @UserId1 INT, @UserId2 INT, @TeamName NVARCHAR(100), @UnitId INT

WHILE @i <= @NumUnits
BEGIN
    -- Get user IDs for this team
    SELECT @UserId1 = Id FROM @TestUsers WHERE RowNum = (@i - 1) * @TeamSize + 1
    SELECT @UserId2 = Id FROM @TestUsers WHERE RowNum = (@i - 1) * @TeamSize + 2
    SELECT @TeamName = TeamName FROM @TeamNames WHERE Idx = @i

    -- Assign to pool (round robin pools)
    DECLARE @PoolNum INT = CASE WHEN @i <= (@NumUnits / 2) THEN 1 ELSE 2 END
    DECLARE @PoolName NVARCHAR(50) = CASE WHEN @PoolNum = 1 THEN 'Pool A' ELSE 'Pool B' END

    -- Create the unit
    INSERT INTO EventUnits (EventId, DivisionId, Name, UnitNumber, PoolNumber, PoolName, Seed, Status, CaptainUserId, MatchesPlayed, MatchesWon, MatchesLost, GamesWon, GamesLost, PointsScored, PointsAgainst, CreatedAt, UpdatedAt)
    VALUES (@EventId, @DivisionId, @TeamName, @i, @PoolNum, @PoolName, @i, 'CheckedIn', @UserId1, 0, 0, 0, 0, 0, 0, 0, GETUTCDATE(), GETUTCDATE())

    SET @UnitId = SCOPE_IDENTITY()

    -- Add team members
    INSERT INTO EventUnitMembers (UnitId, UserId, Role, InviteStatus, IsCheckedIn, CheckedInAt, CreatedAt)
    VALUES (@UnitId, @UserId1, 'Captain', 'Accepted', 1, GETUTCDATE(), GETUTCDATE())

    IF @TeamSize >= 2 AND @UserId2 IS NOT NULL
    BEGIN
        INSERT INTO EventUnitMembers (UnitId, UserId, Role, InviteStatus, IsCheckedIn, CheckedInAt, CreatedAt)
        VALUES (@UnitId, @UserId2, 'Player', 'Accepted', 1, GETUTCDATE(), GETUTCDATE())
    END

    PRINT 'Created team ' + CAST(@i AS NVARCHAR(10)) + ': ' + @TeamName + ' (' + @PoolName + ')'

    SET @i = @i + 1
END

PRINT 'Created ' + CAST(@NumUnits AS NVARCHAR(10)) + ' teams.'

-- ============================================
-- Create Round Robin Matches (Pool Play)
-- ============================================
PRINT ''
PRINT 'Creating round robin matches...'

DECLARE @Units TABLE (Id INT, UnitNumber INT, PoolNumber INT)
INSERT INTO @Units SELECT Id, UnitNumber, PoolNumber FROM EventUnits WHERE EventId = @EventId AND DivisionId = @DivisionId

DECLARE @MatchNum INT = 1
DECLARE @RoundNum INT = 1
DECLARE @Unit1Id INT, @Unit2Id INT, @Unit1Num INT, @Unit2Num INT, @Pool INT

-- Pool A matches
SET @Pool = 1
DECLARE pool_cursor CURSOR FOR
    SELECT u1.Id, u1.UnitNumber, u2.Id, u2.UnitNumber
    FROM @Units u1
    CROSS JOIN @Units u2
    WHERE u1.PoolNumber = @Pool AND u2.PoolNumber = @Pool AND u1.UnitNumber < u2.UnitNumber
    ORDER BY u1.UnitNumber, u2.UnitNumber

OPEN pool_cursor
FETCH NEXT FROM pool_cursor INTO @Unit1Id, @Unit1Num, @Unit2Id, @Unit2Num

WHILE @@FETCH_STATUS = 0
BEGIN
    INSERT INTO EventMatches (EventId, DivisionId, RoundType, RoundNumber, RoundName, MatchNumber, Unit1Number, Unit2Number, Unit1Id, Unit2Id, BestOf, Status, CreatedAt, UpdatedAt)
    VALUES (@EventId, @DivisionId, 'Pool', @RoundNum, 'Pool A', @MatchNum, @Unit1Num, @Unit2Num, @Unit1Id, @Unit2Id, 3, 'Scheduled', GETUTCDATE(), GETUTCDATE())

    SET @MatchNum = @MatchNum + 1
    FETCH NEXT FROM pool_cursor INTO @Unit1Id, @Unit1Num, @Unit2Id, @Unit2Num
END
CLOSE pool_cursor
DEALLOCATE pool_cursor

-- Pool B matches
SET @Pool = 2
DECLARE pool_cursor CURSOR FOR
    SELECT u1.Id, u1.UnitNumber, u2.Id, u2.UnitNumber
    FROM @Units u1
    CROSS JOIN @Units u2
    WHERE u1.PoolNumber = @Pool AND u2.PoolNumber = @Pool AND u1.UnitNumber < u2.UnitNumber
    ORDER BY u1.UnitNumber, u2.UnitNumber

OPEN pool_cursor
FETCH NEXT FROM pool_cursor INTO @Unit1Id, @Unit1Num, @Unit2Id, @Unit2Num

WHILE @@FETCH_STATUS = 0
BEGIN
    INSERT INTO EventMatches (EventId, DivisionId, RoundType, RoundNumber, RoundName, MatchNumber, Unit1Number, Unit2Number, Unit1Id, Unit2Id, BestOf, Status, CreatedAt, UpdatedAt)
    VALUES (@EventId, @DivisionId, 'Pool', @RoundNum, 'Pool B', @MatchNum, @Unit1Num, @Unit2Num, @Unit1Id, @Unit2Id, 3, 'Scheduled', GETUTCDATE(), GETUTCDATE())

    SET @MatchNum = @MatchNum + 1
    FETCH NEXT FROM pool_cursor INTO @Unit1Id, @Unit1Num, @Unit2Id, @Unit2Num
END
CLOSE pool_cursor
DEALLOCATE pool_cursor

DECLARE @PoolMatchCount INT = @MatchNum - 1
PRINT 'Created ' + CAST(@PoolMatchCount AS NVARCHAR(10)) + ' pool play matches.'

-- ============================================
-- Create Bracket Matches (Semifinals + Final)
-- ============================================
PRINT ''
PRINT 'Creating bracket matches (semifinals + final)...'

-- Semifinal 1: Pool A #1 vs Pool B #2
INSERT INTO EventMatches (EventId, DivisionId, RoundType, RoundNumber, RoundName, MatchNumber, BracketPosition, BestOf, Status, Notes, CreatedAt, UpdatedAt)
VALUES (@EventId, @DivisionId, 'Bracket', 1, 'Semifinal 1', @MatchNum, 1, 3, 'Scheduled', 'Pool A #1 vs Pool B #2', GETUTCDATE(), GETUTCDATE())
SET @MatchNum = @MatchNum + 1

-- Semifinal 2: Pool B #1 vs Pool A #2
INSERT INTO EventMatches (EventId, DivisionId, RoundType, RoundNumber, RoundName, MatchNumber, BracketPosition, BestOf, Status, Notes, CreatedAt, UpdatedAt)
VALUES (@EventId, @DivisionId, 'Bracket', 1, 'Semifinal 2', @MatchNum, 2, 3, 'Scheduled', 'Pool B #1 vs Pool A #2', GETUTCDATE(), GETUTCDATE())
SET @MatchNum = @MatchNum + 1

-- Final
INSERT INTO EventMatches (EventId, DivisionId, RoundType, RoundNumber, RoundName, MatchNumber, BracketPosition, BestOf, Status, Notes, CreatedAt, UpdatedAt)
VALUES (@EventId, @DivisionId, 'Final', 2, 'Championship Final', @MatchNum, 1, 3, 'Scheduled', 'Winners of Semifinals', GETUTCDATE(), GETUTCDATE())

PRINT 'Created 3 bracket matches (2 semifinals + 1 final).'

-- ============================================
-- Create Games for Each Match
-- ============================================
PRINT ''
PRINT 'Creating games for each match...'

DECLARE @MatchId INT, @BestOf INT, @GameNum INT

DECLARE match_cursor CURSOR FOR
    SELECT Id, BestOf FROM EventMatches WHERE EventId = @EventId

OPEN match_cursor
FETCH NEXT FROM match_cursor INTO @MatchId, @BestOf

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @GameNum = 1
    WHILE @GameNum <= @BestOf
    BEGIN
        INSERT INTO EventGames (MatchId, GameNumber, ScoreFormatId, Unit1Score, Unit2Score, Status, CreatedAt, UpdatedAt)
        VALUES (@MatchId, @GameNum, 1, 0, 0, 'New', GETUTCDATE(), GETUTCDATE())

        SET @GameNum = @GameNum + 1
    END

    FETCH NEXT FROM match_cursor INTO @MatchId, @BestOf
END
CLOSE match_cursor
DEALLOCATE match_cursor

DECLARE @GameCount INT = (SELECT COUNT(*) FROM EventGames WHERE MatchId IN (SELECT Id FROM EventMatches WHERE EventId = @EventId))
PRINT 'Created ' + CAST(@GameCount AS NVARCHAR(10)) + ' games.'

-- ============================================
-- Update Event Tournament Status
-- ============================================
PRINT ''
PRINT 'Updating event tournament status...'

UPDATE Events
SET TournamentStatus = 'ScheduleReady',
    UpdatedAt = GETUTCDATE()
WHERE Id = @EventId

PRINT 'Event tournament status set to: ScheduleReady'

-- ============================================
-- Create Sample In-Progress Data (Optional)
-- ============================================
PRINT ''
PRINT 'Creating sample in-progress match data...'

-- Set first match to InProgress with one game completed
DECLARE @FirstMatchId INT, @FirstGameId INT, @Match1Unit1Id INT, @Match1Unit2Id INT

SELECT TOP 1 @FirstMatchId = Id, @Match1Unit1Id = Unit1Id, @Match1Unit2Id = Unit2Id
FROM EventMatches
WHERE EventId = @EventId AND RoundType = 'Pool'
ORDER BY Id

IF @FirstMatchId IS NOT NULL AND @Match1Unit1Id IS NOT NULL AND @Match1Unit2Id IS NOT NULL
BEGIN
    -- Update match to InProgress
    UPDATE EventMatches SET Status = 'InProgress', StartedAt = DATEADD(MINUTE, -15, GETUTCDATE()), UpdatedAt = GETUTCDATE()
    WHERE Id = @FirstMatchId

    -- Complete first game (11-7 for Unit1)
    SELECT TOP 1 @FirstGameId = Id FROM EventGames WHERE MatchId = @FirstMatchId ORDER BY GameNumber

    UPDATE EventGames
    SET Status = 'Finished',
        Unit1Score = 11,
        Unit2Score = 7,
        WinnerUnitId = @Match1Unit1Id,
        StartedAt = DATEADD(MINUTE, -15, GETUTCDATE()),
        FinishedAt = DATEADD(MINUTE, -5, GETUTCDATE()),
        UpdatedAt = GETUTCDATE()
    WHERE Id = @FirstGameId

    -- Set second game to Playing
    UPDATE EventGames
    SET Status = 'Playing',
        Unit1Score = 6,
        Unit2Score = 4,
        StartedAt = DATEADD(MINUTE, -3, GETUTCDATE()),
        UpdatedAt = GETUTCDATE()
    WHERE MatchId = @FirstMatchId AND GameNumber = 2

    -- Assign first match to Court 1
    DECLARE @Court1Id INT
    SELECT TOP 1 @Court1Id = Id FROM TournamentCourts WHERE EventId = @EventId ORDER BY SortOrder

    IF @Court1Id IS NOT NULL
    BEGIN
        DECLARE @CurrentGameId INT
        SELECT @CurrentGameId = Id FROM EventGames WHERE MatchId = @FirstMatchId AND GameNumber = 2

        UPDATE TournamentCourts SET Status = 'InUse', CurrentGameId = @CurrentGameId WHERE Id = @Court1Id
        UPDATE EventGames SET TournamentCourtId = @Court1Id WHERE Id = @CurrentGameId
        UPDATE EventMatches SET TournamentCourtId = @Court1Id WHERE Id = @FirstMatchId
    END

    PRINT 'Set up in-progress match on Court 1 (Game 1: 11-7, Game 2: 6-4 in progress)'
END

-- ============================================
-- Summary
-- ============================================
PRINT ''
PRINT '=================================================='
PRINT 'TEST DATA SETUP COMPLETE'
PRINT '=================================================='
PRINT ''

SELECT 'Summary' AS [Section],
       (SELECT COUNT(*) FROM TournamentCourts WHERE EventId = @EventId) AS [Courts],
       (SELECT COUNT(*) FROM EventUnits WHERE EventId = @EventId) AS [Teams],
       (SELECT COUNT(*) FROM EventUnitMembers WHERE UnitId IN (SELECT Id FROM EventUnits WHERE EventId = @EventId)) AS [Players],
       (SELECT COUNT(*) FROM EventMatches WHERE EventId = @EventId) AS [Matches],
       (SELECT COUNT(*) FROM EventGames WHERE MatchId IN (SELECT Id FROM EventMatches WHERE EventId = @EventId)) AS [Games]

PRINT ''
PRINT 'You can now test tournament management features:'
PRINT '1. View tournament dashboard for event ID ' + CAST(@EventId AS NVARCHAR(10))
PRINT '2. Manage courts and assign games'
PRINT '3. Submit and confirm scores'
PRINT '4. Track standings and brackets'
PRINT ''
