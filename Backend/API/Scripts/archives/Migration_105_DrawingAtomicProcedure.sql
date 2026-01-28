-- Migration_105_DrawingAtomicProcedure.sql
-- Adds stored procedure for atomic drawing to prevent duplicate unit numbers
-- This fixes a race condition where concurrent draws could assign the same position number

PRINT 'Starting Migration 105 - Drawing Atomic Procedure';

-- Create stored procedure for atomic drawing
PRINT 'Creating sp_DrawNextUnit stored procedure...';

IF OBJECT_ID('sp_DrawNextUnit', 'P') IS NOT NULL
    DROP PROCEDURE sp_DrawNextUnit;
GO

CREATE PROCEDURE sp_DrawNextUnit
    @DivisionId INT,
    @DrawnUnitId INT OUTPUT,
    @AssignedNumber INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ErrorMessage NVARCHAR(200);

    BEGIN TRANSACTION;

    BEGIN TRY
        -- Lock the division row to prevent concurrent draws
        -- UPDLOCK ensures no other transaction can modify this row
        -- HOLDLOCK (SERIALIZABLE) keeps the lock until transaction completes
        DECLARE @DrawingInProgress BIT;
        DECLARE @CurrentSequence INT;

        SELECT
            @DrawingInProgress = DrawingInProgress,
            @CurrentSequence = DrawingSequence
        FROM EventDivisions WITH (UPDLOCK, HOLDLOCK)
        WHERE Id = @DivisionId;

        -- Validate drawing is in progress
        IF @DrawingInProgress IS NULL
        BEGIN
            SET @ErrorMessage = 'Division not found';
            RAISERROR(@ErrorMessage, 16, 1);
            RETURN -1;
        END

        IF @DrawingInProgress = 0
        BEGIN
            SET @ErrorMessage = 'No drawing in progress';
            RAISERROR(@ErrorMessage, 16, 1);
            RETURN -2;
        END

        -- Get a random undrawn unit
        -- Using NEWID() for random ordering within the locked transaction
        SELECT TOP 1 @DrawnUnitId = Id
        FROM EventUnits WITH (UPDLOCK)
        WHERE DivisionId = @DivisionId
            AND UnitNumber IS NULL
            AND (Status IS NULL OR (Status != 'Cancelled' AND Status != 'Waitlisted'))
        ORDER BY NEWID();

        IF @DrawnUnitId IS NULL
        BEGIN
            SET @ErrorMessage = 'No units remaining to draw';
            RAISERROR(@ErrorMessage, 16, 1);
            RETURN -3;
        END

        -- Atomically increment sequence and assign to unit
        SET @AssignedNumber = @CurrentSequence + 1;

        UPDATE EventDivisions
        SET DrawingSequence = @AssignedNumber,
            UpdatedAt = GETDATE()
        WHERE Id = @DivisionId;

        UPDATE EventUnits
        SET UnitNumber = @AssignedNumber,
            UpdatedAt = GETDATE()
        WHERE Id = @DrawnUnitId;

        COMMIT TRANSACTION;
        RETURN 0;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        -- Re-throw the error
        THROW;
    END CATCH
END;
GO

PRINT 'Migration 105 completed successfully';
