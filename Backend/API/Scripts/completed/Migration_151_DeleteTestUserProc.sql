-- Migration Script: Create sp_DeleteTestUser stored procedure
-- Date: 2025-02-06
-- Description: Deletes a test user from PickleballCommunity and FuntimeIdentity databases
-- IMPORTANT: ExternalLogins in FuntimeIdentity has ON DELETE CASCADE, so deleting from FuntimeIdentity.Users handles it automatically

USE PickleballCommunity;
GO

-- Drop existing procedure if exists
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_DeleteTestUser')
    DROP PROCEDURE sp_DeleteTestUser;
GO

-- Required for tables with indexed views, filtered indexes, computed columns
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

CREATE PROCEDURE sp_DeleteTestUser
    @UserId INT,
    @DryRun BIT = 1,  -- Default to dry run for safety
    @Verbose BIT = 1   -- Show what would be/was deleted
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Validate user exists
    IF NOT EXISTS (SELECT 1 FROM Users WHERE Id = @UserId)
    BEGIN
        RAISERROR('User with Id %d does not exist in PickleballCommunity.', 16, 1, @UserId);
        RETURN -1;
    END

    -- Get user info for confirmation
    DECLARE @Email NVARCHAR(255), @FirstName NVARCHAR(100), @LastName NVARCHAR(100);
    SELECT @Email = Email, @FirstName = FirstName, @LastName = LastName
    FROM Users WHERE Id = @UserId;

    IF @Verbose = 1
    BEGIN
        PRINT '========================================';
        PRINT 'User to delete:';
        PRINT '  Id: ' + CAST(@UserId AS VARCHAR);
        PRINT '  Email: ' + ISNULL(@Email, '(null)');
        PRINT '  Name: ' + ISNULL(@FirstName, '') + ' ' + ISNULL(@LastName, '');
        PRINT '  Mode: ' + CASE WHEN @DryRun = 1 THEN 'DRY RUN (no changes)' ELSE 'LIVE DELETE' END;
        PRINT '========================================';
    END

    BEGIN TRY
        IF @DryRun = 0
            BEGIN TRANSACTION;

        -- =============================================
        -- STEP 1: Delete/Update records that reference Users
        -- Order matters - delete from leaf tables first
        -- =============================================

        -- Tables with SET NULL behavior (set to NULL instead of delete)
        IF @Verbose = 1 PRINT 'Setting NULL on nullable FK columns...';

        IF @DryRun = 0
        BEGIN
            -- Assets (UploadedBy can be NULL)
            UPDATE Assets SET UploadedBy = NULL WHERE UploadedBy = @UserId;
            
            -- Event staff assigned by
            UPDATE EventStaff SET AssignedByUserId = NULL WHERE AssignedByUserId = @UserId;
            
            -- Event check-ins checked by
            UPDATE EventCheckIns SET CheckedInByUserId = NULL WHERE CheckedInByUserId = @UserId;
            
            -- Club finance transactions (ApprovedByUserId and VoidedByUserId are nullable, RecordedByUserId is NOT NULL)
            UPDATE ClubFinanceTransactions SET ApprovedByUserId = NULL WHERE ApprovedByUserId = @UserId;
            UPDATE ClubFinanceTransactions SET VoidedByUserId = NULL WHERE VoidedByUserId = @UserId;
            -- For RecordedByUserId (NOT NULL), we delete the transaction
            DELETE FROM ClubFinanceTransactionAttachments WHERE TransactionId IN (SELECT Id FROM ClubFinanceTransactions WHERE RecordedByUserId = @UserId);
            DELETE FROM ClubFinanceTransactions WHERE RecordedByUserId = @UserId;
            
            -- Club grant transactions (ApprovedByUserId and VoidedByUserId are nullable, ProcessedByUserId is NOT NULL)
            UPDATE ClubGrantTransactions SET ApprovedByUserId = NULL WHERE ApprovedByUserId = @UserId;
            UPDATE ClubGrantTransactions SET VoidedByUserId = NULL WHERE VoidedByUserId = @UserId;
            -- For ProcessedByUserId (NOT NULL), delete the transaction and its attachments
            DELETE FROM GrantTransactionAttachments WHERE TransactionId IN (SELECT Id FROM ClubGrantTransactions WHERE ProcessedByUserId = @UserId);
            DELETE FROM ClubGrantTransactions WHERE ProcessedByUserId = @UserId;
            
            -- Division phases locked by
            UPDATE DivisionPhases SET LockedByUserId = NULL WHERE LockedByUserId = @UserId;
            
            -- Event notification templates
            UPDATE EventNotificationTemplates SET CreatedByUserId = NULL WHERE CreatedByUserId = @UserId;
            UPDATE EventNotificationTemplates SET UpdatedByUserId = NULL WHERE UpdatedByUserId = @UserId;
            
            -- Event match lineups (submitted by)
            UPDATE EventMatchLineups SET SubmittedByUserId = NULL WHERE SubmittedByUserId = @UserId;
            
            -- Event game score history (ChangedByUserId is NOT NULL, so delete)
            DELETE FROM EventGameScoreHistory WHERE ChangedByUserId = @UserId;
            
            -- InstaGame matches
            UPDATE InstaGameMatches SET ScoreConfirmedByUserId = NULL WHERE ScoreConfirmedByUserId = @UserId;
            UPDATE InstaGameMatches SET ScoreSubmittedByUserId = NULL WHERE ScoreSubmittedByUserId = @UserId;
            
            -- Phase slots
            UPDATE PhaseSlots SET ResolvedByUserId = NULL WHERE ResolvedByUserId = @UserId;
            
            -- Player awards (awarded by)
            UPDATE PlayerAwards SET AwardedByUserId = NULL WHERE AwardedByUserId = @UserId;
            
            -- Player rating history (updated by)
            UPDATE PlayerRatingHistory SET UpdatedByUserId = NULL WHERE UpdatedByUserId = @UserId;
            
            -- League club requests (processed by)
            UPDATE LeagueClubRequests SET ProcessedByUserId = NULL WHERE ProcessedByUserId = @UserId;
            
            -- Video review requests (accepted by)
            IF OBJECT_ID('VideoReviewRequests', 'U') IS NOT NULL
                UPDATE VideoReviewRequests SET AcceptedByCoachId = NULL WHERE AcceptedByCoachId = @UserId;
            
            -- Release notes (UpdatedByUserId is nullable, CreatedByUserId is NOT NULL)
            UPDATE ReleaseNotes SET UpdatedByUserId = NULL WHERE UpdatedByUserId = @UserId;
            DELETE FROM UserDismissedReleases WHERE ReleaseNoteId IN (SELECT Id FROM ReleaseNotes WHERE CreatedByUserId = @UserId);
            DELETE FROM ReleaseNotes WHERE CreatedByUserId = @UserId;
            
            -- Game history (RecordedById is NOT NULL, so delete)
            DELETE FROM GameHistory WHERE RecordedById = @UserId;
            
            -- Object assets (UploadedByUserId is NOT NULL, so delete instead of update)
            DELETE FROM ObjectAssets WHERE UploadedByUserId = @UserId;
            
            -- Club documents (UploadedByUserId is NOT NULL)
            DELETE FROM ClubDocuments WHERE UploadedByUserId = @UserId;
            
            -- Event documents (UploadedByUserId is NOT NULL)
            DELETE FROM EventDocuments WHERE UploadedByUserId = @UserId;
            
            -- Grant transaction attachments (UploadedByUserId is NOT NULL) - also deleted above for ProcessedByUserId
            DELETE FROM GrantTransactionAttachments WHERE UploadedByUserId = @UserId;
        END
        ELSE
        BEGIN
            -- Dry run - just show counts
            SELECT 'Assets (UploadedBy)' AS [Table], COUNT(*) AS [RowsAffected] FROM Assets WHERE UploadedBy = @UserId
            UNION ALL SELECT 'EventStaff (AssignedBy)', COUNT(*) FROM EventStaff WHERE AssignedByUserId = @UserId
            UNION ALL SELECT 'ClubFinanceTransactions (ApprovedBy)', COUNT(*) FROM ClubFinanceTransactions WHERE ApprovedByUserId = @UserId
            UNION ALL SELECT 'ClubFinanceTransactions (RecordedBy)', COUNT(*) FROM ClubFinanceTransactions WHERE RecordedByUserId = @UserId
            UNION ALL SELECT 'ClubFinanceTransactions (VoidedBy)', COUNT(*) FROM ClubFinanceTransactions WHERE VoidedByUserId = @UserId;
        END

        -- =============================================
        -- STEP 2: Delete from child tables (order by dependency depth)
        -- =============================================
        IF @Verbose = 1 PRINT 'Deleting from child tables...';

        -- Level 1: Direct children
        DECLARE @DeletedCount INT;

        -- Message-related (cascade should handle most, but be explicit)
        IF OBJECT_ID('MessageReadReceipts', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM MessageReadReceipts WHERE UserId = @UserId;
            ELSE
                SELECT 'MessageReadReceipts' AS [Table], COUNT(*) AS [ToDelete] FROM MessageReadReceipts WHERE UserId = @UserId;
        END

        IF OBJECT_ID('Messages', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM Messages WHERE SenderId = @UserId;
            ELSE
                SELECT 'Messages' AS [Table], COUNT(*) AS [ToDelete] FROM Messages WHERE SenderId = @UserId;
        END

        IF OBJECT_ID('ConversationParticipants', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM ConversationParticipants WHERE UserId = @UserId;
            ELSE
                SELECT 'ConversationParticipants' AS [Table], COUNT(*) AS [ToDelete] FROM ConversationParticipants WHERE UserId = @UserId;
        END

        -- Friend requests (both directions)
        IF OBJECT_ID('FriendRequests', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
            BEGIN
                DELETE FROM FriendRequests WHERE SenderId = @UserId;
                DELETE FROM FriendRequests WHERE RecipientId = @UserId;
            END
            ELSE
                SELECT 'FriendRequests' AS [Table], COUNT(*) AS [ToDelete] FROM FriendRequests WHERE SenderId = @UserId OR RecipientId = @UserId;
        END

        -- User subscriptions and preferences
        IF OBJECT_ID('PushSubscriptions', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM PushSubscriptions WHERE UserId = @UserId;
            ELSE
                SELECT 'PushSubscriptions' AS [Table], COUNT(*) AS [ToDelete] FROM PushSubscriptions WHERE UserId = @UserId;
        END

        IF OBJECT_ID('SpectatorSubscriptions', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM SpectatorSubscriptions WHERE UserId = @UserId;
            ELSE
                SELECT 'SpectatorSubscriptions' AS [Table], COUNT(*) AS [ToDelete] FROM SpectatorSubscriptions WHERE UserId = @UserId;
        END

        IF OBJECT_ID('UserDismissedReleases', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM UserDismissedReleases WHERE UserId = @UserId;
            ELSE
                SELECT 'UserDismissedReleases' AS [Table], COUNT(*) AS [ToDelete] FROM UserDismissedReleases WHERE UserId = @UserId;
        END

        IF OBJECT_ID('UserSocialLinks', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM UserSocialLinks WHERE UserId = @UserId;
            ELSE
                SELECT 'UserSocialLinks' AS [Table], COUNT(*) AS [ToDelete] FROM UserSocialLinks WHERE UserId = @UserId;
        END

        -- Activity logs
        IF OBJECT_ID('ActivityLogs', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM ActivityLogs WHERE UserId = @UserId;
            ELSE
                SELECT 'ActivityLogs' AS [Table], COUNT(*) AS [ToDelete] FROM ActivityLogs WHERE UserId = @UserId;
        END

        -- Blog
        IF OBJECT_ID('BlogComments', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM BlogComments WHERE UserId = @UserId;
            ELSE
                SELECT 'BlogComments' AS [Table], COUNT(*) AS [ToDelete] FROM BlogComments WHERE UserId = @UserId;
        END

        IF OBJECT_ID('BlogPosts', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM BlogPosts WHERE AuthorId = @UserId;
            ELSE
                SELECT 'BlogPosts' AS [Table], COUNT(*) AS [ToDelete] FROM BlogPosts WHERE AuthorId = @UserId;
        END

        -- Ratings and tags
        IF OBJECT_ID('Ratings', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM Ratings WHERE UserId = @UserId;
            ELSE
                SELECT 'Ratings' AS [Table], COUNT(*) AS [ToDelete] FROM Ratings WHERE UserId = @UserId;
        END

        -- ObjectTags has ON DELETE SET NULL for CreatedByUserId, so nothing to do manually

        -- Player certifications and evaluations
        IF OBJECT_ID('PlayerCertifications', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM PlayerCertifications WHERE PlayerId = @UserId;
            ELSE
                SELECT 'PlayerCertifications' AS [Table], COUNT(*) AS [ToDelete] FROM PlayerCertifications WHERE PlayerId = @UserId;
        END

        IF OBJECT_ID('PlayerEvaluations', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
            BEGIN
                DELETE FROM PlayerEvaluations WHERE PlayerId = @UserId;
                DELETE FROM PlayerEvaluations WHERE EvaluatorId = @UserId;
            END
            ELSE
                SELECT 'PlayerEvaluations' AS [Table], COUNT(*) AS [ToDelete] FROM PlayerEvaluations WHERE PlayerId = @UserId OR EvaluatorId = @UserId;
        END

        IF OBJECT_ID('PlayerAwards', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM PlayerAwards WHERE UserId = @UserId;
            ELSE
                SELECT 'PlayerAwards' AS [Table], COUNT(*) AS [ToDelete] FROM PlayerAwards WHERE UserId = @UserId;
        END

        IF OBJECT_ID('PlayerRatingHistory', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM PlayerRatingHistory WHERE UserId = @UserId;
            ELSE
                SELECT 'PlayerRatingHistory' AS [Table], COUNT(*) AS [ToDelete] FROM PlayerRatingHistory WHERE UserId = @UserId;
        END

        -- Court confirmations and assets
        IF OBJECT_ID('CourtAssetLikes', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM CourtAssetLikes WHERE UserId = @UserId;
            ELSE
                SELECT 'CourtAssetLikes' AS [Table], COUNT(*) AS [ToDelete] FROM CourtAssetLikes WHERE UserId = @UserId;
        END

        IF OBJECT_ID('CourtAssets', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM CourtAssets WHERE UserId = @UserId;
            ELSE
                SELECT 'CourtAssets' AS [Table], COUNT(*) AS [ToDelete] FROM CourtAssets WHERE UserId = @UserId;
        END

        IF OBJECT_ID('CourtConfirmations', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM CourtConfirmations WHERE UserId = @UserId;
            ELSE
                SELECT 'CourtConfirmations' AS [Table], COUNT(*) AS [ToDelete] FROM CourtConfirmations WHERE UserId = @UserId;
        END

        -- Video reviews
        IF OBJECT_ID('VideoReviewRequests', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
            BEGIN
                DELETE FROM VideoReviewRequests WHERE StudentId = @UserId;
                DELETE FROM VideoReviewRequests WHERE CoachId = @UserId;
            END
            ELSE
                SELECT 'VideoReviewRequests' AS [Table], COUNT(*) AS [ToDelete] FROM VideoReviewRequests WHERE StudentId = @UserId OR CoachId = @UserId;
        END

        -- Course purchases
        IF OBJECT_ID('CoursePurchases', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM CoursePurchases WHERE StudentId = @UserId;
            ELSE
                SELECT 'CoursePurchases' AS [Table], COUNT(*) AS [ToDelete] FROM CoursePurchases WHERE StudentId = @UserId;
        END

        IF OBJECT_ID('Courses', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM Courses WHERE CoachId = @UserId;
            ELSE
                SELECT 'Courses' AS [Table], COUNT(*) AS [ToDelete] FROM Courses WHERE CoachId = @UserId;
        END

        -- Material purchases
        IF OBJECT_ID('MaterialPurchases', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM MaterialPurchases WHERE StudentId = @UserId;
            ELSE
                SELECT 'MaterialPurchases' AS [Table], COUNT(*) AS [ToDelete] FROM MaterialPurchases WHERE StudentId = @UserId;
        END

        IF OBJECT_ID('TrainingMaterials', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM TrainingMaterials WHERE CoachId = @UserId;
            ELSE
                SELECT 'TrainingMaterials' AS [Table], COUNT(*) AS [ToDelete] FROM TrainingMaterials WHERE CoachId = @UserId;
        END

        -- Training sessions
        IF OBJECT_ID('TrainingSessions', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
            BEGIN
                DELETE FROM TrainingSessions WHERE CoachId = @UserId;
                DELETE FROM TrainingSessions WHERE StudentId = @UserId;
            END
            ELSE
                SELECT 'TrainingSessions' AS [Table], COUNT(*) AS [ToDelete] FROM TrainingSessions WHERE CoachId = @UserId OR StudentId = @UserId;
        END

        -- Event-related
        IF OBJECT_ID('EventGamePlayers', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM EventGamePlayers WHERE UserId = @UserId;
            ELSE
                SELECT 'EventGamePlayers' AS [Table], COUNT(*) AS [ToDelete] FROM EventGamePlayers WHERE UserId = @UserId;
        END

        IF OBJECT_ID('EventMatchLineups', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM EventMatchLineups WHERE UserId = @UserId;
            ELSE
                SELECT 'EventMatchLineups' AS [Table], COUNT(*) AS [ToDelete] FROM EventMatchLineups WHERE UserId = @UserId;
        END

        IF OBJECT_ID('EventCheckIns', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM EventCheckIns WHERE UserId = @UserId;
            ELSE
                SELECT 'EventCheckIns' AS [Table], COUNT(*) AS [ToDelete] FROM EventCheckIns WHERE UserId = @UserId;
        END

        IF OBJECT_ID('EventStaff', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM EventStaff WHERE UserId = @UserId;
            ELSE
                SELECT 'EventStaff' AS [Table], COUNT(*) AS [ToDelete] FROM EventStaff WHERE UserId = @UserId;
        END

        IF OBJECT_ID('EventUnitJoinRequests', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM EventUnitJoinRequests WHERE UserId = @UserId;
            ELSE
                SELECT 'EventUnitJoinRequests' AS [Table], COUNT(*) AS [ToDelete] FROM EventUnitJoinRequests WHERE UserId = @UserId;
        END

        IF OBJECT_ID('EventUnitMembers', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM EventUnitMembers WHERE UserId = @UserId;
            ELSE
                SELECT 'EventUnitMembers' AS [Table], COUNT(*) AS [ToDelete] FROM EventUnitMembers WHERE UserId = @UserId;
        END

        -- Update EventUnits captain to NULL (if allowed) or delete
        IF OBJECT_ID('EventUnits', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                UPDATE EventUnits SET CaptainUserId = NULL WHERE CaptainUserId = @UserId;
            ELSE
                SELECT 'EventUnits (Captain)' AS [Table], COUNT(*) AS [ToUpdate] FROM EventUnits WHERE CaptainUserId = @UserId;
        END

        -- InstaGame related
        IF OBJECT_ID('InstaGamePlayers', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM InstaGamePlayers WHERE UserId = @UserId;
            ELSE
                SELECT 'InstaGamePlayers' AS [Table], COUNT(*) AS [ToDelete] FROM InstaGamePlayers WHERE UserId = @UserId;
        END

        IF OBJECT_ID('InstaGames', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM InstaGames WHERE CreatorId = @UserId;
            ELSE
                SELECT 'InstaGames' AS [Table], COUNT(*) AS [ToDelete] FROM InstaGames WHERE CreatorId = @UserId;
        END

        -- Game queues
        IF OBJECT_ID('GameQueues', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM GameQueues WHERE QueuedByUserId = @UserId;
            ELSE
                SELECT 'GameQueues' AS [Table], COUNT(*) AS [ToDelete] FROM GameQueues WHERE QueuedByUserId = @UserId;
        END

        IF OBJECT_ID('GameDayPlayerStatuses', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM GameDayPlayerStatuses WHERE UserId = @UserId;
            ELSE
                SELECT 'GameDayPlayerStatuses' AS [Table], COUNT(*) AS [ToDelete] FROM GameDayPlayerStatuses WHERE UserId = @UserId;
        END

        -- Club memberships and management
        IF OBJECT_ID('ClubFinanceTransactions', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM ClubFinanceTransactions WHERE MemberUserId = @UserId;
            ELSE
                SELECT 'ClubFinanceTransactions (Member)' AS [Table], COUNT(*) AS [ToDelete] FROM ClubFinanceTransactions WHERE MemberUserId = @UserId;
        END

        IF OBJECT_ID('GrantManagers', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
            BEGIN
                DELETE FROM GrantManagers WHERE UserId = @UserId;
                DELETE FROM GrantManagers WHERE CreatedByUserId = @UserId;
            END
            ELSE
                SELECT 'GrantManagers' AS [Table], COUNT(*) AS [ToDelete] FROM GrantManagers WHERE UserId = @UserId OR CreatedByUserId = @UserId;
        END

        IF OBJECT_ID('LeagueManagers', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM LeagueManagers WHERE UserId = @UserId;
            ELSE
                SELECT 'LeagueManagers' AS [Table], COUNT(*) AS [ToDelete] FROM LeagueManagers WHERE UserId = @UserId;
        END

        IF OBJECT_ID('LeagueClubRequests', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM LeagueClubRequests WHERE RequestedByUserId = @UserId;
            ELSE
                SELECT 'LeagueClubRequests' AS [Table], COUNT(*) AS [ToDelete] FROM LeagueClubRequests WHERE RequestedByUserId = @UserId;
        END

        -- Site content
        IF OBJECT_ID('SiteContent', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                UPDATE SiteContent SET LastUpdatedByUserId = NULL WHERE LastUpdatedByUserId = @UserId;
            ELSE
                SELECT 'SiteContent' AS [Table], COUNT(*) AS [ToUpdate] FROM SiteContent WHERE LastUpdatedByUserId = @UserId;
        END

        -- Coach profile
        IF OBJECT_ID('CoachProfiles', 'U') IS NOT NULL
        BEGIN
            IF @DryRun = 0
                DELETE FROM CoachProfiles WHERE UserId = @UserId;
            ELSE
                SELECT 'CoachProfiles' AS [Table], COUNT(*) AS [ToDelete] FROM CoachProfiles WHERE UserId = @UserId;
        END

        -- =============================================
        -- STEP 3: Delete from Users table
        -- =============================================
        IF @Verbose = 1 PRINT 'Deleting from PickleballCommunity.Users...';

        IF @DryRun = 0
            DELETE FROM Users WHERE Id = @UserId;
        ELSE
            SELECT 'Users (PickleballCommunity)' AS [Table], 1 AS [ToDelete];

        -- =============================================
        -- STEP 4: Delete from FuntimeIdentity.Users (cascades to ExternalLogins)
        -- =============================================
        IF @Verbose = 1 PRINT 'Deleting from FuntimeIdentity.Users (cascades to ExternalLogins)...';

        IF EXISTS (SELECT 1 FROM FuntimeIdentity.dbo.Users WHERE Id = @UserId)
        BEGIN
            IF @DryRun = 0
                DELETE FROM FuntimeIdentity.dbo.Users WHERE Id = @UserId;
            ELSE
            BEGIN
                SELECT 'Users (FuntimeIdentity)' AS [Table], 1 AS [ToDelete];
                SELECT 'ExternalLogins (FuntimeIdentity - CASCADE)' AS [Table], COUNT(*) AS [ToDelete]
                FROM FuntimeIdentity.dbo.ExternalLogins WHERE UserId = @UserId;
            END
        END
        ELSE
        BEGIN
            IF @Verbose = 1 PRINT 'User not found in FuntimeIdentity.Users (may have been deleted already)';
        END

        -- =============================================
        -- COMMIT
        -- =============================================
        IF @DryRun = 0
        BEGIN
            COMMIT TRANSACTION;
            IF @Verbose = 1 PRINT 'User deleted successfully!';
        END
        ELSE
        BEGIN
            IF @Verbose = 1 PRINT 'DRY RUN complete - no changes made. Run with @DryRun=0 to delete.';
        END

        RETURN 0;

    END TRY
    BEGIN CATCH
        IF @DryRun = 0 AND @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();

        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
        RETURN -1;
    END CATCH
END
GO

PRINT 'sp_DeleteTestUser procedure created successfully!';
PRINT '';
PRINT 'Usage:';
PRINT '  -- Dry run (preview what would be deleted):';
PRINT '  EXEC sp_DeleteTestUser @UserId = 123;';
PRINT '';
PRINT '  -- Actually delete:';
PRINT '  EXEC sp_DeleteTestUser @UserId = 123, @DryRun = 0;';
PRINT '';
PRINT '  -- Silent mode:';
PRINT '  EXEC sp_DeleteTestUser @UserId = 123, @DryRun = 0, @Verbose = 0;';
GO
