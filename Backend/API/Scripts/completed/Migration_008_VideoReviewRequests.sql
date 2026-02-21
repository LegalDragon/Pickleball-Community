-- Migration: Video Review Requests
-- Purpose: Allow students to upload videos for coach review with pricing

-- Create VideoReviewRequests table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[VideoReviewRequests]') AND type = 'U')
BEGIN
    CREATE TABLE VideoReviewRequests (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        StudentId INT NOT NULL,
        CoachId INT NULL,  -- NULL = open to any coach
        Title NVARCHAR(200) NOT NULL,
        Description NVARCHAR(2000) NULL,
        VideoUrl NVARCHAR(500) NOT NULL,
        OfferedPrice DECIMAL(18,2) NOT NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'Open',  -- Open, Accepted, Completed, Cancelled
        AcceptedByCoachId INT NULL,
        ReviewVideoUrl NVARCHAR(500) NULL,
        ReviewNotes NVARCHAR(2000) NULL,
        AcceptedAt DATETIME2 NULL,
        CompletedAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT FK_VideoReviewRequests_Student FOREIGN KEY (StudentId) REFERENCES Users(Id),
        CONSTRAINT FK_VideoReviewRequests_Coach FOREIGN KEY (CoachId) REFERENCES Users(Id),
        CONSTRAINT FK_VideoReviewRequests_AcceptedBy FOREIGN KEY (AcceptedByCoachId) REFERENCES Users(Id)
    );

    -- Index for finding open requests
    CREATE INDEX IX_VideoReviewRequests_Status ON VideoReviewRequests(Status);

    -- Index for finding requests by student
    CREATE INDEX IX_VideoReviewRequests_StudentId ON VideoReviewRequests(StudentId);

    -- Index for finding requests targeted at specific coach
    CREATE INDEX IX_VideoReviewRequests_CoachId ON VideoReviewRequests(CoachId);
END
GO

-- Add Notes column to TrainingSession for session requests
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TrainingSessions]') AND name = 'Notes')
BEGIN
    ALTER TABLE TrainingSessions ADD Notes NVARCHAR(1000) NULL;
END
GO

-- Add RequestedAt column to distinguish from scheduled time
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TrainingSessions]') AND name = 'RequestedAt')
BEGIN
    ALTER TABLE TrainingSessions ADD RequestedAt DATETIME2 NULL;
END
GO

PRINT 'Migration 008 - VideoReviewRequests completed successfully';
