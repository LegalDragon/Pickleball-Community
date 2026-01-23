-- Migration 122: Court Scheduling Enhancements
-- Adds fields for court pre-assignment, schedule publishing, and staff registration

PRINT 'Starting Migration 122: Court Scheduling Enhancements'

-- =====================================================
-- Add schedule publishing fields to EventDivisions
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EventDivisions]') AND name = 'SchedulePublishedAt')
BEGIN
    ALTER TABLE [dbo].[EventDivisions]
    ADD [SchedulePublishedAt] DATETIME2 NULL;
    PRINT 'Added SchedulePublishedAt column to EventDivisions'
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EventDivisions]') AND name = 'SchedulePublishedByUserId')
BEGIN
    ALTER TABLE [dbo].[EventDivisions]
    ADD [SchedulePublishedByUserId] INT NULL;
    PRINT 'Added SchedulePublishedByUserId column to EventDivisions'
END
GO

-- =====================================================
-- Add assignment mode fields to DivisionCourtAssignments
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[DivisionCourtAssignments]') AND name = 'AssignmentMode')
BEGIN
    ALTER TABLE [dbo].[DivisionCourtAssignments]
    ADD [AssignmentMode] NVARCHAR(20) NOT NULL DEFAULT 'Default';
    PRINT 'Added AssignmentMode column to DivisionCourtAssignments'
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[DivisionCourtAssignments]') AND name = 'PoolName')
BEGIN
    ALTER TABLE [dbo].[DivisionCourtAssignments]
    ADD [PoolName] NVARCHAR(50) NULL;
    PRINT 'Added PoolName column to DivisionCourtAssignments'
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[DivisionCourtAssignments]') AND name = 'MatchFormatId')
BEGIN
    ALTER TABLE [dbo].[DivisionCourtAssignments]
    ADD [MatchFormatId] INT NULL;
    PRINT 'Added MatchFormatId column to DivisionCourtAssignments'
END
GO

-- =====================================================
-- Add schedule time fields to EventEncounters for time blocks
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EventEncounters]') AND name = 'EstimatedDurationMinutes')
BEGIN
    ALTER TABLE [dbo].[EventEncounters]
    ADD [EstimatedDurationMinutes] INT NULL;
    PRINT 'Added EstimatedDurationMinutes column to EventEncounters'
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EventEncounters]') AND name = 'EstimatedEndTime')
BEGIN
    ALTER TABLE [dbo].[EventEncounters]
    ADD [EstimatedEndTime] DATETIME2 NULL;
    PRINT 'Added EstimatedEndTime column to EventEncounters'
END
GO

-- =====================================================
-- Add schedule publish fields to Events
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Events]') AND name = 'SchedulePublishedAt')
BEGIN
    ALTER TABLE [dbo].[Events]
    ADD [SchedulePublishedAt] DATETIME2 NULL;
    PRINT 'Added SchedulePublishedAt column to Events'
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Events]') AND name = 'SchedulePublishedByUserId')
BEGIN
    ALTER TABLE [dbo].[Events]
    ADD [SchedulePublishedByUserId] INT NULL;
    PRINT 'Added SchedulePublishedByUserId column to Events'
END
GO

-- =====================================================
-- Add staff registration fields if not exist
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EventStaff]') AND name = 'PreferredRoles')
BEGIN
    ALTER TABLE [dbo].[EventStaff]
    ADD [PreferredRoles] NVARCHAR(500) NULL; -- JSON array of preferred role IDs
    PRINT 'Added PreferredRoles column to EventStaff'
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EventStaff]') AND name = 'ContactPhone')
BEGIN
    ALTER TABLE [dbo].[EventStaff]
    ADD [ContactPhone] NVARCHAR(30) NULL;
    PRINT 'Added ContactPhone column to EventStaff'
END
GO

-- =====================================================
-- Add event-level schedule validation
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Events]') AND name = 'ScheduleValidatedAt')
BEGIN
    ALTER TABLE [dbo].[Events]
    ADD [ScheduleValidatedAt] DATETIME2 NULL;
    PRINT 'Added ScheduleValidatedAt column to Events'
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Events]') AND name = 'ScheduleConflictCount')
BEGIN
    ALTER TABLE [dbo].[Events]
    ADD [ScheduleConflictCount] INT NULL DEFAULT 0;
    PRINT 'Added ScheduleConflictCount column to Events'
END
GO

-- =====================================================
-- Create index for efficient court assignment queries
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DivisionCourtAssignments_CourtGroup_Mode')
BEGIN
    CREATE INDEX [IX_DivisionCourtAssignments_CourtGroup_Mode]
    ON [dbo].[DivisionCourtAssignments] ([CourtGroupId], [AssignmentMode]);
    PRINT 'Created index IX_DivisionCourtAssignments_CourtGroup_Mode'
END
GO

-- =====================================================
-- Create index for encounter time queries
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EventEncounters_EstimatedTime')
BEGIN
    CREATE INDEX [IX_EventEncounters_EstimatedTime]
    ON [dbo].[EventEncounters] ([EstimatedStartTime], [EstimatedEndTime])
    WHERE [EstimatedStartTime] IS NOT NULL;
    PRINT 'Created index IX_EventEncounters_EstimatedTime'
END
GO

PRINT 'Migration 122: Court Scheduling Enhancements completed successfully'
GO
