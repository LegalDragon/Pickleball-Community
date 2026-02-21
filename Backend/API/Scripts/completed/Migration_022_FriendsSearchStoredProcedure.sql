-- Migration 022: Friends Search Stored Procedure
-- Creates stored procedure for searching users (for friends feature)
-- Uses LIKE for SQL Server compatible case-insensitive search

PRINT 'Starting Migration 022: Friends Search Stored Procedure';
GO

-- =============================================
-- Stored Procedure: sp_SearchUsersForFriends
-- Searches users by first name, last name, city, state
-- excluding self, and returns friendship/pending request status
-- =============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_SearchUsersForFriends]') AND type in (N'P', N'PC'))
BEGIN
    DROP PROCEDURE [dbo].[sp_SearchUsersForFriends];
    PRINT 'Dropped existing sp_SearchUsersForFriends procedure';
END
GO

CREATE PROCEDURE [dbo].[sp_SearchUsersForFriends]
    @CurrentUserId INT,
    @FirstName NVARCHAR(100) = NULL,
    @LastName NVARCHAR(100) = NULL,
    @City NVARCHAR(100) = NULL,
    @State NVARCHAR(100) = NULL,
    @MaxResults INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    -- Prepare search patterns for LIKE (only if parameter has value)
    DECLARE @FirstNamePattern NVARCHAR(102) = CASE WHEN @FirstName IS NOT NULL AND LEN(@FirstName) > 0 THEN '%' + @FirstName + '%' ELSE NULL END;
    DECLARE @LastNamePattern NVARCHAR(102) = CASE WHEN @LastName IS NOT NULL AND LEN(@LastName) > 0 THEN '%' + @LastName + '%' ELSE NULL END;
    DECLARE @CityPattern NVARCHAR(102) = CASE WHEN @City IS NOT NULL AND LEN(@City) > 0 THEN '%' + @City + '%' ELSE NULL END;
    DECLARE @StatePattern NVARCHAR(102) = CASE WHEN @State IS NOT NULL AND LEN(@State) > 0 THEN '%' + @State + '%' ELSE NULL END;

    -- Return search results with friendship status
    SELECT TOP (@MaxResults)
        u.Id,
        LTRIM(RTRIM(ISNULL(u.FirstName, '') + ' ' + ISNULL(u.LastName, ''))) AS Name,
        u.ProfileImageUrl,
        u.ExperienceLevel,
        CASE
            WHEN u.City IS NOT NULL AND u.State IS NOT NULL THEN u.City + ', ' + u.State
            WHEN u.City IS NOT NULL THEN u.City
            WHEN u.State IS NOT NULL THEN u.State
            ELSE NULL
        END AS Location,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM Friendships f
                WHERE (f.UserId1 = @CurrentUserId AND f.UserId2 = u.Id)
                   OR (f.UserId1 = u.Id AND f.UserId2 = @CurrentUserId)
            ) THEN 1
            ELSE 0
        END AS IsFriend,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM FriendRequests fr
                WHERE ((fr.SenderId = @CurrentUserId AND fr.RecipientId = u.Id)
                    OR (fr.SenderId = u.Id AND fr.RecipientId = @CurrentUserId))
                  AND fr.Status = 'Pending'
            ) THEN 1
            ELSE 0
        END AS HasPendingRequest
    FROM Users u
    WHERE u.Id != @CurrentUserId
      AND u.IsActive = 1
      AND (@FirstNamePattern IS NULL OR u.FirstName LIKE @FirstNamePattern)
      AND (@LastNamePattern IS NULL OR u.LastName LIKE @LastNamePattern)
      AND (@CityPattern IS NULL OR u.City LIKE @CityPattern)
      AND (@StatePattern IS NULL OR u.State LIKE @StatePattern)
    ORDER BY
        u.FirstName,
        u.LastName;
END
GO

PRINT 'Created sp_SearchUsersForFriends procedure';
GO

-- =============================================
-- Stored Procedure: sp_GetFriendsList
-- Gets all friends for a user
-- =============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_GetFriendsList]') AND type in (N'P', N'PC'))
BEGIN
    DROP PROCEDURE [dbo].[sp_GetFriendsList];
    PRINT 'Dropped existing sp_GetFriendsList procedure';
END
GO

CREATE PROCEDURE [dbo].[sp_GetFriendsList]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        f.Id,
        CASE
            WHEN f.UserId1 = @CurrentUserId THEN f.UserId2
            ELSE f.UserId1
        END AS FriendUserId,
        LTRIM(RTRIM(ISNULL(u.FirstName, '') + ' ' + ISNULL(u.LastName, ''))) AS Name,
        u.ProfileImageUrl,
        u.ExperienceLevel,
        u.PlayingStyle,
        CASE
            WHEN u.City IS NOT NULL AND u.State IS NOT NULL THEN u.City + ', ' + u.State
            WHEN u.City IS NOT NULL THEN u.City
            WHEN u.State IS NOT NULL THEN u.State
            ELSE NULL
        END AS Location,
        u.PaddleBrand,
        f.FriendsSince
    FROM Friendships f
    INNER JOIN Users u ON u.Id = CASE
        WHEN f.UserId1 = @CurrentUserId THEN f.UserId2
        ELSE f.UserId1
    END
    WHERE f.UserId1 = @CurrentUserId OR f.UserId2 = @CurrentUserId
    ORDER BY f.FriendsSince DESC;
END
GO

PRINT 'Created sp_GetFriendsList procedure';
GO

-- =============================================
-- Stored Procedure: sp_GetPendingFriendRequests
-- Gets pending friend requests received by user
-- =============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_GetPendingFriendRequests]') AND type in (N'P', N'PC'))
BEGIN
    DROP PROCEDURE [dbo].[sp_GetPendingFriendRequests];
    PRINT 'Dropped existing sp_GetPendingFriendRequests procedure';
END
GO

CREATE PROCEDURE [dbo].[sp_GetPendingFriendRequests]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        fr.Id,
        fr.Status,
        fr.Message,
        fr.CreatedAt,
        u.Id AS SenderId,
        LTRIM(RTRIM(ISNULL(u.FirstName, '') + ' ' + ISNULL(u.LastName, ''))) AS SenderName,
        u.ProfileImageUrl AS SenderProfileImageUrl,
        u.ExperienceLevel AS SenderExperienceLevel,
        u.PlayingStyle AS SenderPlayingStyle,
        CASE
            WHEN u.City IS NOT NULL AND u.State IS NOT NULL THEN u.City + ', ' + u.State
            WHEN u.City IS NOT NULL THEN u.City
            WHEN u.State IS NOT NULL THEN u.State
            ELSE NULL
        END AS SenderLocation
    FROM FriendRequests fr
    INNER JOIN Users u ON u.Id = fr.SenderId
    WHERE fr.RecipientId = @CurrentUserId
      AND fr.Status = 'Pending'
    ORDER BY fr.CreatedAt DESC;
END
GO

PRINT 'Created sp_GetPendingFriendRequests procedure';
GO

-- =============================================
-- Stored Procedure: sp_GetSentFriendRequests
-- Gets sent friend requests awaiting response
-- =============================================
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_GetSentFriendRequests]') AND type in (N'P', N'PC'))
BEGIN
    DROP PROCEDURE [dbo].[sp_GetSentFriendRequests];
    PRINT 'Dropped existing sp_GetSentFriendRequests procedure';
END
GO

CREATE PROCEDURE [dbo].[sp_GetSentFriendRequests]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        fr.Id,
        fr.Status,
        fr.Message,
        fr.CreatedAt,
        u.Id AS RecipientId,
        LTRIM(RTRIM(ISNULL(u.FirstName, '') + ' ' + ISNULL(u.LastName, ''))) AS RecipientName,
        u.ProfileImageUrl AS RecipientProfileImageUrl,
        u.ExperienceLevel AS RecipientExperienceLevel,
        u.PlayingStyle AS RecipientPlayingStyle,
        CASE
            WHEN u.City IS NOT NULL AND u.State IS NOT NULL THEN u.City + ', ' + u.State
            WHEN u.City IS NOT NULL THEN u.City
            WHEN u.State IS NOT NULL THEN u.State
            ELSE NULL
        END AS RecipientLocation
    FROM FriendRequests fr
    INNER JOIN Users u ON u.Id = fr.RecipientId
    WHERE fr.SenderId = @CurrentUserId
      AND fr.Status = 'Pending'
    ORDER BY fr.CreatedAt DESC;
END
GO

PRINT 'Created sp_GetSentFriendRequests procedure';
GO

PRINT 'Migration 022 completed successfully';
GO
