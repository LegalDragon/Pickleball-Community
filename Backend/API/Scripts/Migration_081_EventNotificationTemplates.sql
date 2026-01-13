-- Migration 081: Event Notification Templates
-- Allows customization of notification messages for event running

PRINT 'Starting Migration 081: Event Notification Templates'

-- Create EventNotificationTemplates table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EventNotificationTemplates')
BEGIN
    CREATE TABLE EventNotificationTemplates (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventId INT NULL, -- NULL = default template, otherwise event-specific

        -- Template type
        NotificationType NVARCHAR(50) NOT NULL,
        -- Types: 'MatchScheduled', 'MatchStarting', 'MatchComplete', 'ScoreUpdated', 'CheckInReminder', 'BracketAdvance'

        -- Template content
        Subject NVARCHAR(200) NOT NULL,
        MessageTemplate NVARCHAR(MAX) NOT NULL,

        -- Placeholders available (for reference):
        -- {PlayerName}, {PlayerFirstName}, {OpponentName}, {CourtName}, {CourtNumber}
        -- {MatchTime}, {EventName}, {DivisionName}, {RoundName}
        -- {Score}, {WinnerName}, {LoserName}, {Unit1Score}, {Unit2Score}

        IsActive BIT NOT NULL DEFAULT 1,

        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        CreatedByUserId INT NULL,
        UpdatedByUserId INT NULL,

        -- Foreign keys
        CONSTRAINT FK_EventNotificationTemplates_EventId FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE CASCADE,
        CONSTRAINT FK_EventNotificationTemplates_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id),
        CONSTRAINT FK_EventNotificationTemplates_UpdatedBy FOREIGN KEY (UpdatedByUserId) REFERENCES Users(Id)
    )

    PRINT 'Created EventNotificationTemplates table'
END
ELSE
BEGIN
    PRINT 'EventNotificationTemplates table already exists'
END

-- Create index for fast lookups by event
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EventNotificationTemplates_EventId')
BEGIN
    CREATE INDEX IX_EventNotificationTemplates_EventId ON EventNotificationTemplates(EventId)
    PRINT 'Created index IX_EventNotificationTemplates_EventId'
END

-- Create index for template type
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EventNotificationTemplates_NotificationType')
BEGIN
    CREATE INDEX IX_EventNotificationTemplates_NotificationType ON EventNotificationTemplates(NotificationType)
    PRINT 'Created index IX_EventNotificationTemplates_NotificationType'
END

-- Insert default templates (global, EventId = NULL)
IF NOT EXISTS (SELECT 1 FROM EventNotificationTemplates WHERE EventId IS NULL AND NotificationType = 'MatchScheduled')
BEGIN
    INSERT INTO EventNotificationTemplates (EventId, NotificationType, Subject, MessageTemplate, IsActive)
    VALUES
    (NULL, 'MatchScheduled', 'Match Scheduled - {EventName}',
     'Hi {PlayerFirstName}! Your match has been scheduled.\n\nCourt: {CourtName}\nTime: {MatchTime}\nOpponent: {OpponentName}\nDivision: {DivisionName}\n\nPlease report to your court on time. Good luck!', 1),

    (NULL, 'MatchStarting', 'Match Starting Now - Court {CourtNumber}',
     'Hi {PlayerFirstName}! Your match is starting NOW!\n\nCourt: {CourtName}\nOpponent: {OpponentName}\n\nPlease report to your court immediately.', 1),

    (NULL, 'MatchComplete', 'Match Complete - {EventName}',
     'Hi {PlayerFirstName}! Your match has been completed.\n\nFinal Score: {Unit1Score} - {Unit2Score}\nResult: {Result}\n\nThank you for playing!', 1),

    (NULL, 'ScoreUpdated', 'Score Updated - {EventName}',
     'Hi {PlayerFirstName}! The score for your match has been updated.\n\nCurrent Score: {Unit1Score} - {Unit2Score}\nCourt: {CourtName}', 1),

    (NULL, 'CheckInReminder', 'Check-In Reminder - {EventName}',
     'Hi {PlayerFirstName}! Don''t forget to check in for {EventName}.\n\nDivision: {DivisionName}\nYour matches will begin soon. Please check in at the registration desk.', 1),

    (NULL, 'BracketAdvance', 'Congratulations! You Advanced - {EventName}',
     'Congratulations {PlayerFirstName}! You have advanced in the bracket!\n\nEvent: {EventName}\nDivision: {DivisionName}\nNext Round: {RoundName}\n\nStay tuned for your next match assignment.', 1)

    PRINT 'Inserted default notification templates'
END
ELSE
BEGIN
    PRINT 'Default notification templates already exist'
END

PRINT 'Migration 081 completed successfully'
