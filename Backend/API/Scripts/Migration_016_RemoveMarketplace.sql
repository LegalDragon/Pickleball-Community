-- Migration_016_RemoveMarketplace.sql
-- Remove marketplace and coach publishing related tables
-- This migration supports the pivot from coaching marketplace to community site

PRINT 'Starting Migration_016_RemoveMarketplace...'

-- Drop foreign key constraints first (in dependency order)
PRINT 'Dropping foreign key constraints...'

-- CoursePurchases FK
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_CoursePurchases_Courses_CourseId')
BEGIN
    ALTER TABLE CoursePurchases DROP CONSTRAINT FK_CoursePurchases_Courses_CourseId
    PRINT 'Dropped FK_CoursePurchases_Courses_CourseId'
END

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_CoursePurchases_Users_StudentId')
BEGIN
    ALTER TABLE CoursePurchases DROP CONSTRAINT FK_CoursePurchases_Users_StudentId
    PRINT 'Dropped FK_CoursePurchases_Users_StudentId'
END

-- CourseMaterials FK
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_CourseMaterials_Courses_CourseId')
BEGIN
    ALTER TABLE CourseMaterials DROP CONSTRAINT FK_CourseMaterials_Courses_CourseId
    PRINT 'Dropped FK_CourseMaterials_Courses_CourseId'
END

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_CourseMaterials_TrainingMaterials_MaterialId')
BEGIN
    ALTER TABLE CourseMaterials DROP CONSTRAINT FK_CourseMaterials_TrainingMaterials_MaterialId
    PRINT 'Dropped FK_CourseMaterials_TrainingMaterials_MaterialId'
END

-- MaterialPurchases FK
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_MaterialPurchases_Users_StudentId')
BEGIN
    ALTER TABLE MaterialPurchases DROP CONSTRAINT FK_MaterialPurchases_Users_StudentId
    PRINT 'Dropped FK_MaterialPurchases_Users_StudentId'
END

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_MaterialPurchases_TrainingMaterials_MaterialId')
BEGIN
    ALTER TABLE MaterialPurchases DROP CONSTRAINT FK_MaterialPurchases_TrainingMaterials_MaterialId
    PRINT 'Dropped FK_MaterialPurchases_TrainingMaterials_MaterialId'
END

-- Courses FK
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Courses_Users_CoachId')
BEGIN
    ALTER TABLE Courses DROP CONSTRAINT FK_Courses_Users_CoachId
    PRINT 'Dropped FK_Courses_Users_CoachId'
END

-- TrainingMaterials FK
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_TrainingMaterials_Users_CoachId')
BEGIN
    ALTER TABLE TrainingMaterials DROP CONSTRAINT FK_TrainingMaterials_Users_CoachId
    PRINT 'Dropped FK_TrainingMaterials_Users_CoachId'
END

-- TrainingSessions FK
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_TrainingSessions_Users_CoachId')
BEGIN
    ALTER TABLE TrainingSessions DROP CONSTRAINT FK_TrainingSessions_Users_CoachId
    PRINT 'Dropped FK_TrainingSessions_Users_CoachId'
END

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_TrainingSessions_Users_StudentId')
BEGIN
    ALTER TABLE TrainingSessions DROP CONSTRAINT FK_TrainingSessions_Users_StudentId
    PRINT 'Dropped FK_TrainingSessions_Users_StudentId'
END

-- VideoReviewRequests FK
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_VideoReviewRequests_Users_StudentId')
BEGIN
    ALTER TABLE VideoReviewRequests DROP CONSTRAINT FK_VideoReviewRequests_Users_StudentId
    PRINT 'Dropped FK_VideoReviewRequests_Users_StudentId'
END

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_VideoReviewRequests_Users_CoachId')
BEGIN
    ALTER TABLE VideoReviewRequests DROP CONSTRAINT FK_VideoReviewRequests_Users_CoachId
    PRINT 'Dropped FK_VideoReviewRequests_Users_CoachId'
END

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_VideoReviewRequests_Users_AcceptedByCoachId')
BEGIN
    ALTER TABLE VideoReviewRequests DROP CONSTRAINT FK_VideoReviewRequests_Users_AcceptedByCoachId
    PRINT 'Dropped FK_VideoReviewRequests_Users_AcceptedByCoachId'
END

-- BlogPosts FK
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_BlogPosts_Users_AuthorId')
BEGIN
    ALTER TABLE BlogPosts DROP CONSTRAINT FK_BlogPosts_Users_AuthorId
    PRINT 'Dropped FK_BlogPosts_Users_AuthorId'
END

-- CoachProfiles FK
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_CoachProfiles_Users_UserId')
BEGIN
    ALTER TABLE CoachProfiles DROP CONSTRAINT FK_CoachProfiles_Users_UserId
    PRINT 'Dropped FK_CoachProfiles_Users_UserId'
END

-- Drop tables in dependency order
PRINT 'Dropping marketplace tables...'

IF OBJECT_ID('dbo.CoursePurchases', 'U') IS NOT NULL
BEGIN
    DROP TABLE CoursePurchases
    PRINT 'Dropped table: CoursePurchases'
END

IF OBJECT_ID('dbo.CourseMaterials', 'U') IS NOT NULL
BEGIN
    DROP TABLE CourseMaterials
    PRINT 'Dropped table: CourseMaterials'
END

IF OBJECT_ID('dbo.MaterialPurchases', 'U') IS NOT NULL
BEGIN
    DROP TABLE MaterialPurchases
    PRINT 'Dropped table: MaterialPurchases'
END

IF OBJECT_ID('dbo.Courses', 'U') IS NOT NULL
BEGIN
    DROP TABLE Courses
    PRINT 'Dropped table: Courses'
END

IF OBJECT_ID('dbo.TrainingMaterials', 'U') IS NOT NULL
BEGIN
    DROP TABLE TrainingMaterials
    PRINT 'Dropped table: TrainingMaterials'
END

IF OBJECT_ID('dbo.TrainingSessions', 'U') IS NOT NULL
BEGIN
    DROP TABLE TrainingSessions
    PRINT 'Dropped table: TrainingSessions'
END

IF OBJECT_ID('dbo.VideoReviewRequests', 'U') IS NOT NULL
BEGIN
    DROP TABLE VideoReviewRequests
    PRINT 'Dropped table: VideoReviewRequests'
END

IF OBJECT_ID('dbo.BlogPosts', 'U') IS NOT NULL
BEGIN
    DROP TABLE BlogPosts
    PRINT 'Dropped table: BlogPosts'
END

IF OBJECT_ID('dbo.CoachProfiles', 'U') IS NOT NULL
BEGIN
    DROP TABLE CoachProfiles
    PRINT 'Dropped table: CoachProfiles'
END

PRINT 'Migration_016_RemoveMarketplace completed successfully!'
