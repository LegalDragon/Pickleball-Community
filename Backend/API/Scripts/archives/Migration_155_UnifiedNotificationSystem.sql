-- Migration 155: Unified Notification System
-- Creates tables for global notification event types, templates, and logging
-- Supports Email, SMS (via FXNotification), and WebPush (local)

SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- =====================================================
-- 1. NotificationEventTypes - Global event definitions
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NotificationEventTypes')
BEGIN
    CREATE TABLE NotificationEventTypes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventKey NVARCHAR(100) NOT NULL,
        Category NVARCHAR(50) NOT NULL,           -- 'System', 'Tournament', 'League'
        DisplayName NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500) NULL,
        AvailableMergeFields NVARCHAR(MAX) NULL,  -- JSON array of field names
        IsActive BIT NOT NULL DEFAULT 1,
        SortOrder INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        
        CONSTRAINT UQ_NotificationEventTypes_EventKey UNIQUE (EventKey)
    );
    
    CREATE INDEX IX_NotificationEventTypes_Category ON NotificationEventTypes(Category);
    CREATE INDEX IX_NotificationEventTypes_IsActive ON NotificationEventTypes(IsActive);
    
    PRINT 'Created NotificationEventTypes table';
END
GO

-- =====================================================
-- 2. NotificationChannelTemplates - Templates per event/channel
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NotificationChannelTemplates')
BEGIN
    CREATE TABLE NotificationChannelTemplates (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventTypeId INT NOT NULL,
        Channel NVARCHAR(50) NOT NULL,            -- 'Email', 'SMS', 'Push', 'WhatsApp'
        Name NVARCHAR(200) NOT NULL,
        FXTaskCode NVARCHAR(50) NULL,             -- For FXNotification (Email/SMS)
        Subject NVARCHAR(500) NULL,               -- For Email/Push title
        Body NVARCHAR(MAX) NOT NULL,              -- Template with {{mergeFields}}
        IsActive BIT NOT NULL DEFAULT 1,
        IsTestMode BIT NOT NULL DEFAULT 1,        -- When true, logs only (no send)
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NULL,
        CreatedByUserId INT NULL,
        
        CONSTRAINT FK_NotificationChannelTemplates_EventType 
            FOREIGN KEY (EventTypeId) REFERENCES NotificationEventTypes(Id) ON DELETE CASCADE,
        CONSTRAINT FK_NotificationChannelTemplates_CreatedBy
            FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id) ON DELETE SET NULL
    );
    
    CREATE INDEX IX_NotificationChannelTemplates_EventTypeId ON NotificationChannelTemplates(EventTypeId);
    CREATE INDEX IX_NotificationChannelTemplates_Channel ON NotificationChannelTemplates(Channel);
    CREATE INDEX IX_NotificationChannelTemplates_IsActive ON NotificationChannelTemplates(IsActive);
    
    PRINT 'Created NotificationChannelTemplates table';
END
GO

-- =====================================================
-- 3. NotificationLogs - Audit trail for all notifications
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NotificationLogs')
BEGIN
    CREATE TABLE NotificationLogs (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TemplateId INT NULL,
        EventTypeKey NVARCHAR(100) NOT NULL,
        Channel NVARCHAR(50) NOT NULL,
        RecipientUserId INT NULL,
        RecipientContact NVARCHAR(255) NULL,      -- email/phone number
        MergedSubject NVARCHAR(500) NULL,
        MergedBody NVARCHAR(MAX) NULL,
        ContextJson NVARCHAR(MAX) NULL,           -- Original context data
        Status NVARCHAR(50) NOT NULL,             -- 'Test', 'Queued', 'Sent', 'Failed'
        FXNotificationId NVARCHAR(100) NULL,      -- Tracking ID from FXNotification
        ErrorMessage NVARCHAR(MAX) NULL,
        RelatedObjectType NVARCHAR(50) NULL,      -- 'Event', 'Division', 'User', etc.
        RelatedObjectId INT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        
        CONSTRAINT FK_NotificationLogs_Template
            FOREIGN KEY (TemplateId) REFERENCES NotificationChannelTemplates(Id) ON DELETE SET NULL,
        CONSTRAINT FK_NotificationLogs_RecipientUser
            FOREIGN KEY (RecipientUserId) REFERENCES Users(Id) ON DELETE SET NULL
    );
    
    CREATE INDEX IX_NotificationLogs_EventTypeKey ON NotificationLogs(EventTypeKey);
    CREATE INDEX IX_NotificationLogs_Channel ON NotificationLogs(Channel);
    CREATE INDEX IX_NotificationLogs_Status ON NotificationLogs(Status);
    CREATE INDEX IX_NotificationLogs_RecipientUserId ON NotificationLogs(RecipientUserId);
    CREATE INDEX IX_NotificationLogs_CreatedAt ON NotificationLogs(CreatedAt DESC);
    CREATE INDEX IX_NotificationLogs_RelatedObject ON NotificationLogs(RelatedObjectType, RelatedObjectId);
    
    PRINT 'Created NotificationLogs table';
END
GO

-- =====================================================
-- 4. Seed default event types
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM NotificationEventTypes WHERE EventKey = 'user.registered')
BEGIN
    INSERT INTO NotificationEventTypes (EventKey, Category, DisplayName, Description, AvailableMergeFields, SortOrder) VALUES
    -- System events
    ('user.registered', 'System', 'User Registration', 'Triggered when a new user registers', 
     '["userName", "userEmail", "firstName", "lastName", "registrationDate"]', 10),
    ('user.password_changed', 'System', 'Password Changed', 'Triggered when user changes password',
     '["userName", "userEmail", "changeDate"]', 20),
    ('user.email_verified', 'System', 'Email Verified', 'Triggered when user verifies email',
     '["userName", "userEmail"]', 30),
    ('user.password_reset_requested', 'System', 'Password Reset Requested', 'Triggered when user requests password reset',
     '["userName", "userEmail", "resetLink", "expiresAt"]', 40),

    -- Tournament registration events
    ('tournament.registration_submitted', 'Tournament', 'Registration Submitted', 'When registration is submitted (pending payment)',
     '["playerName", "partnerName", "eventName", "divisionName", "amount", "paymentInstructions"]', 100),
    ('tournament.registration_confirmed', 'Tournament', 'Registration Confirmed', 'When registration is fully confirmed',
     '["playerName", "partnerName", "eventName", "divisionName", "registrationDate", "eventDate", "venueName"]', 110),
    ('tournament.payment_received', 'Tournament', 'Payment Received', 'When payment is received/verified',
     '["playerName", "eventName", "divisionName", "amount", "paymentDate", "paymentMethod"]', 120),
    ('tournament.registration_cancelled', 'Tournament', 'Registration Cancelled', 'When registration is cancelled',
     '["playerName", "eventName", "divisionName", "refundAmount", "cancellationReason"]', 130),
    ('tournament.waitlist_promoted', 'Tournament', 'Promoted from Waitlist', 'When moved from waitlist to registered',
     '["playerName", "eventName", "divisionName", "paymentDeadline"]', 140),

    -- Tournament schedule events
    ('tournament.schedule_published', 'Tournament', 'Schedule Published', 'When tournament schedule is published',
     '["playerName", "eventName", "firstMatchTime", "courtName", "scheduleLink"]', 200),
    ('tournament.match_scheduled', 'Tournament', 'Match Scheduled', 'When a specific match is scheduled',
     '["playerName", "partnerName", "opponentNames", "matchTime", "courtName", "eventName", "roundName"]', 210),
    ('tournament.match_reminder', 'Tournament', 'Match Reminder', 'Reminder before upcoming match',
     '["playerName", "partnerName", "opponentNames", "matchTime", "courtName", "eventName", "minutesUntil"]', 220),
    ('tournament.match_result', 'Tournament', 'Match Result Posted', 'When match result is entered',
     '["playerName", "result", "score", "eventName", "roundName", "nextMatchInfo"]', 230),
    ('tournament.bracket_updated', 'Tournament', 'Bracket Updated', 'When bracket advances',
     '["playerName", "eventName", "divisionName", "currentRound", "nextOpponent", "nextMatchTime"]', 240),

    -- Tournament completion events
    ('tournament.event_completed', 'Tournament', 'Event Completed', 'When tournament/division finishes',
     '["playerName", "eventName", "divisionName", "finalPlacement", "totalTeams"]', 300),
    ('tournament.results_published', 'Tournament', 'Results Published', 'When final results are published',
     '["eventName", "divisionName", "resultsLink"]', 310),

    -- League events
    ('league.match_scheduled', 'League', 'League Match Scheduled', 'When league match is scheduled',
     '["playerName", "opponentName", "matchTime", "location", "leagueName", "weekNumber"]', 400),
    ('league.match_reminder', 'League', 'League Match Reminder', 'Reminder before league match',
     '["playerName", "opponentName", "matchTime", "location", "leagueName"]', 410),
    ('league.standings_updated', 'League', 'Standings Updated', 'When league standings change',
     '["playerName", "leagueName", "currentRank", "wins", "losses"]', 420);
    
    PRINT 'Seeded default notification event types';
END
GO

-- =====================================================
-- 5. Seed sample templates (in test mode)
-- =====================================================
DECLARE @RegistrationConfirmedId INT = (SELECT Id FROM NotificationEventTypes WHERE EventKey = 'tournament.registration_confirmed');
DECLARE @PaymentReceivedId INT = (SELECT Id FROM NotificationEventTypes WHERE EventKey = 'tournament.payment_received');
DECLARE @MatchScheduledId INT = (SELECT Id FROM NotificationEventTypes WHERE EventKey = 'tournament.match_scheduled');

IF @RegistrationConfirmedId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM NotificationChannelTemplates WHERE EventTypeId = @RegistrationConfirmedId)
BEGIN
    -- Email template
    INSERT INTO NotificationChannelTemplates (EventTypeId, Channel, Name, Subject, Body, IsTestMode) VALUES
    (@RegistrationConfirmedId, 'Email', 'Registration Confirmed - Email', 
     'Registration Confirmed: {{eventName}} - {{divisionName}}',
     'Hi {{playerName}},

Your registration for {{eventName}} has been confirmed!

Division: {{divisionName}}
Partner: {{partnerName}}
Event Date: {{eventDate}}
Venue: {{venueName}}

We look forward to seeing you there!

Best regards,
The Tournament Team', 1);

    -- Push template
    INSERT INTO NotificationChannelTemplates (EventTypeId, Channel, Name, Subject, Body, IsTestMode) VALUES
    (@RegistrationConfirmedId, 'Push', 'Registration Confirmed - Push',
     '✅ Registration Confirmed',
     'You''re registered for {{divisionName}} at {{eventName}}!', 1);
     
    PRINT 'Added sample registration confirmed templates';
END

IF @PaymentReceivedId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM NotificationChannelTemplates WHERE EventTypeId = @PaymentReceivedId)
BEGIN
    INSERT INTO NotificationChannelTemplates (EventTypeId, Channel, Name, Subject, Body, IsTestMode) VALUES
    (@PaymentReceivedId, 'Email', 'Payment Received - Email',
     'Payment Received: {{eventName}}',
     'Hi {{playerName}},

We have received your payment of ${{amount}} for {{eventName}}.

Division: {{divisionName}}
Payment Date: {{paymentDate}}
Payment Method: {{paymentMethod}}

Your registration is now complete!

Best regards,
The Tournament Team', 1),
    (@PaymentReceivedId, 'Push', 'Payment Received - Push',
     '💰 Payment Received',
     'Payment of ${{amount}} received for {{eventName}}', 1);
     
    PRINT 'Added sample payment received templates';
END

IF @MatchScheduledId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM NotificationChannelTemplates WHERE EventTypeId = @MatchScheduledId)
BEGIN
    INSERT INTO NotificationChannelTemplates (EventTypeId, Channel, Name, Subject, Body, IsTestMode) VALUES
    (@MatchScheduledId, 'Push', 'Match Scheduled - Push',
     '🏓 Match Scheduled',
     '{{roundName}}: {{matchTime}} on {{courtName}} vs {{opponentNames}}', 1);
     
    PRINT 'Added sample match scheduled template';
END
GO

COMMIT TRANSACTION;
PRINT 'Migration 155 completed successfully';
