-- Migration 127: Bulk Court/Time Assignment Stored Procedure
-- OPTIONAL: This stored procedure is for future optimization only.
-- The feature works without it using raw SQL updates in C#.
-- REQUIRES: SQL Server 2016+ for JSON support

PRINT 'Migration 127: Checking SQL Server version for JSON support...'

-- Check if JSON functions are available (SQL Server 2016+)
IF (SELECT SERVERPROPERTY('ProductMajorVersion')) >= 13
BEGIN
    PRINT 'SQL Server 2016+ detected. Creating sp_BulkAssignCourtsAndTimes...'

    -- Drop if exists, then create (for SQL Server 2014 compatibility in syntax)
    IF OBJECT_ID('sp_BulkAssignCourtsAndTimes', 'P') IS NOT NULL
        DROP PROCEDURE sp_BulkAssignCourtsAndTimes;
END
ELSE
BEGIN
    PRINT 'SQL Server version < 2016. Skipping JSON-based stored procedure.'
    PRINT 'The bulk court/time assignment feature will use raw SQL updates instead.'
END
GO

-- Only create if SQL Server 2016+
IF (SELECT SERVERPROPERTY('ProductMajorVersion')) >= 13
BEGIN
    EXEC('
    CREATE PROCEDURE sp_BulkAssignCourtsAndTimes
        @EventId INT,
        @AssignmentsJson NVARCHAR(MAX)
    AS
    BEGIN
        SET NOCOUNT ON;

        -- Parse JSON assignments and update encounters
        -- JSON format: [{"EncounterId": 1, "CourtId": 2, "ScheduledTime": "2024-01-15T10:00:00", "EstimatedStartTime": "2024-01-15T10:00:00"}, ...]

        DECLARE @Now DATETIME = GETDATE();
        DECLARE @UpdatedCount INT = 0;

        -- Create temp table from JSON
        SELECT
            JSON_VALUE(j.value, ''$.EncounterId'') AS EncounterId,
            JSON_VALUE(j.value, ''$.CourtId'') AS CourtId,
            JSON_VALUE(j.value, ''$.ScheduledTime'') AS ScheduledTime,
            JSON_VALUE(j.value, ''$.EstimatedStartTime'') AS EstimatedStartTime
        INTO #Assignments
        FROM OPENJSON(@AssignmentsJson) j;

        -- Update encounters
        UPDATE e
        SET
            e.TournamentCourtId = CAST(a.CourtId AS INT),
            e.ScheduledTime = CASE WHEN a.ScheduledTime IS NOT NULL THEN CAST(a.ScheduledTime AS DATETIME2) ELSE e.ScheduledTime END,
            e.EstimatedStartTime = CASE WHEN a.EstimatedStartTime IS NOT NULL THEN CAST(a.EstimatedStartTime AS DATETIME2) ELSE e.EstimatedStartTime END,
            e.UpdatedAt = @Now
        FROM EventEncounters e
        INNER JOIN #Assignments a ON e.Id = CAST(a.EncounterId AS INT)
        WHERE e.EventId = @EventId;

        SET @UpdatedCount = @@ROWCOUNT;

        DROP TABLE #Assignments;

        -- Return count
        SELECT @UpdatedCount AS Value;
    END
    ')
    PRINT 'Stored procedure sp_BulkAssignCourtsAndTimes created successfully.'
END
GO

PRINT 'Migration 127 completed.'
