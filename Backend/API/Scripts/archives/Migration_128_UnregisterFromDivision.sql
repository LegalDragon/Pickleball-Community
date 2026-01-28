-- Migration 128: Add stored procedure for unregistering from a division
-- This handles the complex logic of removing join requests, unit members, and units

PRINT 'Creating sp_UnregisterFromDivision stored procedure...'
GO

CREATE OR ALTER PROCEDURE sp_UnregisterFromDivision
    @EventId INT,
    @DivisionId INT,
    @UserId INT,
    @Success BIT OUTPUT,
    @Message NVARCHAR(500) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UnitId INT;
    DECLARE @MemberCount INT;
    DECLARE @IsCaptain BIT;
    DECLARE @HasScheduledMatches BIT;

    -- Find user's unit in this division
    SELECT @UnitId = u.Id
    FROM EventUnits u
    INNER JOIN EventUnitMembers m ON u.Id = m.UnitId
    WHERE m.UserId = @UserId
      AND u.EventId = @EventId
      AND u.DivisionId = @DivisionId
      AND u.Status != 'Cancelled'
      AND m.InviteStatus = 'Accepted';

    IF @UnitId IS NULL
    BEGIN
        SET @Success = 0;
        SET @Message = 'You are not registered for this division';
        RETURN;
    END

    -- Check if tournament has scheduled matches for this unit
    IF EXISTS (
        SELECT 1 FROM EventEncounters
        WHERE DivisionId = @DivisionId
          AND (Unit1Id = @UnitId OR Unit2Id = @UnitId)
          AND Status != 'Cancelled'
    )
    BEGIN
        SET @Success = 0;
        SET @Message = 'Cannot unregister after tournament schedule has been created. Contact the organizer.';
        RETURN;
    END

    -- Check if user is captain
    SELECT @IsCaptain = CASE WHEN CaptainUserId = @UserId THEN 1 ELSE 0 END
    FROM EventUnits
    WHERE Id = @UnitId;

    -- Count accepted members in the unit
    SELECT @MemberCount = COUNT(*)
    FROM EventUnitMembers
    WHERE UnitId = @UnitId AND InviteStatus = 'Accepted';

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Delete join requests made BY this user to any unit in this division
        DELETE jr
        FROM EventUnitJoinRequests jr
        INNER JOIN EventUnits u ON jr.UnitId = u.Id
        WHERE jr.UserId = @UserId
          AND u.EventId = @EventId
          AND u.DivisionId = @DivisionId;

        -- Delete join requests made TO the user's unit (if deleting the whole unit)
        IF @IsCaptain = 1 OR @MemberCount = 1
        BEGIN
            DELETE FROM EventUnitJoinRequests WHERE UnitId = @UnitId;

            -- Delete all unit member waivers
            DELETE w
            FROM EventUnitMemberWaivers w
            INNER JOIN EventUnitMembers m ON w.EventUnitMemberId = m.Id
            WHERE m.UnitId = @UnitId;

            -- Delete all unit members
            DELETE FROM EventUnitMembers WHERE UnitId = @UnitId;

            -- Delete the unit itself
            DELETE FROM EventUnits WHERE Id = @UnitId;

            SET @Message = 'Successfully unregistered and removed team from division';
        END
        ELSE
        BEGIN
            -- Just remove this member
            -- First delete their waiver records
            DELETE w
            FROM EventUnitMemberWaivers w
            INNER JOIN EventUnitMembers m ON w.EventUnitMemberId = m.Id
            WHERE m.UnitId = @UnitId AND m.UserId = @UserId;

            -- Delete the member
            DELETE FROM EventUnitMembers WHERE UnitId = @UnitId AND UserId = @UserId;

            SET @Message = 'Successfully left the team. Your partner has been notified.';
        END

        COMMIT TRANSACTION;
        SET @Success = 1;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        SET @Success = 0;
        SET @Message = 'Error: ' + ERROR_MESSAGE();
    END CATCH
END
GO

PRINT 'sp_UnregisterFromDivision created successfully'
GO
