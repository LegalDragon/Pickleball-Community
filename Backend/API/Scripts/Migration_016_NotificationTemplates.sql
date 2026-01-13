-- Migration Script: Notification Templates
-- Date: 2026-01-13
-- Description: Adds NotificationTemplates table for managing notification message defaults

USE PickleballCollege;
GO

PRINT 'Starting Migration_016_NotificationTemplates...';
PRINT '';

-- =============================================
-- STEP 1: Create NotificationTemplates table
-- =============================================
PRINT 'Creating NotificationTemplates table...';

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('NotificationTemplates') AND type = 'U')
BEGIN
    CREATE TABLE NotificationTemplates (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        -- Template identification
        TemplateKey NVARCHAR(100) NOT NULL,
        Name NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500) NULL,
        Category NVARCHAR(100) NOT NULL DEFAULT 'General',

        -- Message content
        Subject NVARCHAR(500) NOT NULL,
        Body NVARCHAR(MAX) NOT NULL,

        -- Available placeholders (JSON array of placeholder names)
        Placeholders NVARCHAR(MAX) NULL,

        -- Status
        IsActive BIT NOT NULL DEFAULT 1,
        IsSystem BIT NOT NULL DEFAULT 0,

        -- Audit fields
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CreatedByUserId INT NULL,
        UpdatedByUserId INT NULL
    );
    PRINT '  Created NotificationTemplates table';
END
ELSE
BEGIN
    PRINT '  NotificationTemplates table already exists';
END
GO

-- =============================================
-- STEP 2: Create unique constraint on TemplateKey
-- =============================================
PRINT '';
PRINT 'Creating unique constraint on TemplateKey...';

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_NotificationTemplates_TemplateKey' AND object_id = OBJECT_ID('NotificationTemplates'))
BEGIN
    CREATE UNIQUE INDEX UQ_NotificationTemplates_TemplateKey ON NotificationTemplates(TemplateKey);
    PRINT '  Created unique index on TemplateKey';
END
ELSE
BEGIN
    PRINT '  Unique index on TemplateKey already exists';
END
GO

-- =============================================
-- STEP 3: Create indexes
-- =============================================
PRINT '';
PRINT 'Creating indexes...';

-- Index on Category
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_NotificationTemplates_Category' AND object_id = OBJECT_ID('NotificationTemplates'))
BEGIN
    CREATE INDEX IX_NotificationTemplates_Category ON NotificationTemplates(Category);
    PRINT '  Created index on Category';
END
ELSE
BEGIN
    PRINT '  Index IX_NotificationTemplates_Category already exists';
END

-- Index on IsActive
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_NotificationTemplates_IsActive' AND object_id = OBJECT_ID('NotificationTemplates'))
BEGIN
    CREATE INDEX IX_NotificationTemplates_IsActive ON NotificationTemplates(IsActive);
    PRINT '  Created index on IsActive';
END
ELSE
BEGIN
    PRINT '  Index IX_NotificationTemplates_IsActive already exists';
END
GO

-- =============================================
-- STEP 4: Seed default notification templates
-- =============================================
PRINT '';
PRINT 'Seeding default notification templates...';

-- Welcome Email
IF NOT EXISTS (SELECT 1 FROM NotificationTemplates WHERE TemplateKey = 'welcome_email')
BEGIN
    INSERT INTO NotificationTemplates (TemplateKey, Name, Description, Category, Subject, Body, Placeholders, IsSystem)
    VALUES (
        'welcome_email',
        'Welcome Email',
        'Sent to new users after registration',
        'Account',
        'Welcome to {{OrganizationName}}, {{FirstName}}!',
        'Hi {{FirstName}},

Welcome to {{OrganizationName}}! We''re excited to have you join our pickleball community.

Here''s what you can do next:
- Complete your profile
- Browse our training materials
- Connect with coaches
- Start improving your game!

If you have any questions, feel free to reach out to our support team.

Best regards,
The {{OrganizationName}} Team',
        '["FirstName", "LastName", "Email", "OrganizationName"]',
        1
    );
    PRINT '  Inserted welcome_email template';
END

-- Password Reset
IF NOT EXISTS (SELECT 1 FROM NotificationTemplates WHERE TemplateKey = 'password_reset')
BEGIN
    INSERT INTO NotificationTemplates (TemplateKey, Name, Description, Category, Subject, Body, Placeholders, IsSystem)
    VALUES (
        'password_reset',
        'Password Reset',
        'Sent when user requests a password reset',
        'Account',
        'Reset Your {{OrganizationName}} Password',
        'Hi {{FirstName}},

We received a request to reset your password for your {{OrganizationName}} account.

Click the link below to reset your password:
{{ResetLink}}

This link will expire in {{ExpirationHours}} hours.

If you didn''t request this password reset, please ignore this email or contact support if you have concerns.

Best regards,
The {{OrganizationName}} Team',
        '["FirstName", "Email", "ResetLink", "ExpirationHours", "OrganizationName"]',
        1
    );
    PRINT '  Inserted password_reset template';
END

-- Session Confirmed
IF NOT EXISTS (SELECT 1 FROM NotificationTemplates WHERE TemplateKey = 'session_confirmed')
BEGIN
    INSERT INTO NotificationTemplates (TemplateKey, Name, Description, Category, Subject, Body, Placeholders, IsSystem)
    VALUES (
        'session_confirmed',
        'Session Confirmed',
        'Sent when a training session is confirmed',
        'Sessions',
        'Your Training Session is Confirmed!',
        'Hi {{StudentName}},

Great news! Your training session with {{CoachName}} has been confirmed.

Session Details:
- Date: {{SessionDate}}
- Time: {{SessionTime}}
- Duration: {{Duration}} minutes
- Type: {{SessionType}}
- Location: {{Location}}

{{#if Notes}}
Notes from your coach:
{{Notes}}
{{/if}}

We look forward to seeing you there!

Best regards,
The {{OrganizationName}} Team',
        '["StudentName", "CoachName", "SessionDate", "SessionTime", "Duration", "SessionType", "Location", "Notes", "OrganizationName"]',
        1
    );
    PRINT '  Inserted session_confirmed template';
END

-- Session Cancelled
IF NOT EXISTS (SELECT 1 FROM NotificationTemplates WHERE TemplateKey = 'session_cancelled')
BEGIN
    INSERT INTO NotificationTemplates (TemplateKey, Name, Description, Category, Subject, Body, Placeholders, IsSystem)
    VALUES (
        'session_cancelled',
        'Session Cancelled',
        'Sent when a training session is cancelled',
        'Sessions',
        'Training Session Cancelled',
        'Hi {{RecipientName}},

Unfortunately, your training session has been cancelled.

Original Session Details:
- Date: {{SessionDate}}
- Time: {{SessionTime}}
- With: {{OtherPartyName}}

{{#if CancellationReason}}
Reason: {{CancellationReason}}
{{/if}}

If you have any questions, please don''t hesitate to reach out.

Best regards,
The {{OrganizationName}} Team',
        '["RecipientName", "SessionDate", "SessionTime", "OtherPartyName", "CancellationReason", "OrganizationName"]',
        1
    );
    PRINT '  Inserted session_cancelled template';
END

-- Material Purchased
IF NOT EXISTS (SELECT 1 FROM NotificationTemplates WHERE TemplateKey = 'material_purchased')
BEGIN
    INSERT INTO NotificationTemplates (TemplateKey, Name, Description, Category, Subject, Body, Placeholders, IsSystem)
    VALUES (
        'material_purchased',
        'Material Purchased',
        'Sent when a user purchases training material',
        'Purchases',
        'Your Purchase Confirmation - {{MaterialTitle}}',
        'Hi {{BuyerName}},

Thank you for your purchase!

Purchase Details:
- Material: {{MaterialTitle}}
- Coach: {{CoachName}}
- Price: ${{Price}}
- Date: {{PurchaseDate}}

You can access your purchased material in your library at any time.

Happy learning!

Best regards,
The {{OrganizationName}} Team',
        '["BuyerName", "MaterialTitle", "CoachName", "Price", "PurchaseDate", "OrganizationName"]',
        1
    );
    PRINT '  Inserted material_purchased template';
END

-- Course Purchased
IF NOT EXISTS (SELECT 1 FROM NotificationTemplates WHERE TemplateKey = 'course_purchased')
BEGIN
    INSERT INTO NotificationTemplates (TemplateKey, Name, Description, Category, Subject, Body, Placeholders, IsSystem)
    VALUES (
        'course_purchased',
        'Course Purchased',
        'Sent when a user purchases a course',
        'Purchases',
        'Welcome to {{CourseTitle}}!',
        'Hi {{BuyerName}},

Thank you for enrolling in {{CourseTitle}}!

Course Details:
- Course: {{CourseTitle}}
- Instructor: {{CoachName}}
- Materials: {{MaterialCount}} lessons
- Price: ${{Price}}

You now have access to all course materials. Start learning today!

Best regards,
The {{OrganizationName}} Team',
        '["BuyerName", "CourseTitle", "CoachName", "MaterialCount", "Price", "OrganizationName"]',
        1
    );
    PRINT '  Inserted course_purchased template';
END

-- Video Review Request
IF NOT EXISTS (SELECT 1 FROM NotificationTemplates WHERE TemplateKey = 'video_review_request')
BEGIN
    INSERT INTO NotificationTemplates (TemplateKey, Name, Description, Category, Subject, Body, Placeholders, IsSystem)
    VALUES (
        'video_review_request',
        'Video Review Request',
        'Sent to coach when they receive a video review request',
        'Video Reviews',
        'New Video Review Request from {{StudentName}}',
        'Hi {{CoachName}},

You have received a new video review request.

Request Details:
- From: {{StudentName}}
- Title: {{RequestTitle}}
- Budget: ${{Budget}}
- Submitted: {{SubmittedDate}}

{{#if Description}}
Description:
{{Description}}
{{/if}}

Please log in to review and respond to this request.

Best regards,
The {{OrganizationName}} Team',
        '["CoachName", "StudentName", "RequestTitle", "Budget", "SubmittedDate", "Description", "OrganizationName"]',
        1
    );
    PRINT '  Inserted video_review_request template';
END

-- Video Review Completed
IF NOT EXISTS (SELECT 1 FROM NotificationTemplates WHERE TemplateKey = 'video_review_completed')
BEGIN
    INSERT INTO NotificationTemplates (TemplateKey, Name, Description, Category, Subject, Body, Placeholders, IsSystem)
    VALUES (
        'video_review_completed',
        'Video Review Completed',
        'Sent to student when their video review is completed',
        'Video Reviews',
        'Your Video Review is Ready!',
        'Hi {{StudentName}},

Great news! {{CoachName}} has completed your video review.

Review Details:
- Title: {{RequestTitle}}
- Coach: {{CoachName}}
- Completed: {{CompletedDate}}

Log in to view your personalized feedback and recommendations.

Best regards,
The {{OrganizationName}} Team',
        '["StudentName", "CoachName", "RequestTitle", "CompletedDate", "OrganizationName"]',
        1
    );
    PRINT '  Inserted video_review_completed template';
END

-- Certification Review Request
IF NOT EXISTS (SELECT 1 FROM NotificationTemplates WHERE TemplateKey = 'certification_review_request')
BEGIN
    INSERT INTO NotificationTemplates (TemplateKey, Name, Description, Category, Subject, Body, Placeholders, IsSystem)
    VALUES (
        'certification_review_request',
        'Certification Review Request',
        'Sent to reviewers to rate a player',
        'Certification',
        '{{PlayerName}} wants your rating!',
        'Hi there,

{{PlayerName}} has requested your help in their player certification process.

They would like you to rate their pickleball skills based on your experience playing with or watching them.

Click the link below to submit your rating:
{{ReviewLink}}

This link is unique to you and will expire in {{ExpirationDays}} days.

Thank you for helping improve our community!

Best regards,
The {{OrganizationName}} Team',
        '["PlayerName", "ReviewLink", "ExpirationDays", "OrganizationName"]',
        1
    );
    PRINT '  Inserted certification_review_request template';
END

-- New Coach Signup
IF NOT EXISTS (SELECT 1 FROM NotificationTemplates WHERE TemplateKey = 'coach_signup_notification')
BEGIN
    INSERT INTO NotificationTemplates (TemplateKey, Name, Description, Category, Subject, Body, Placeholders, IsSystem)
    VALUES (
        'coach_signup_notification',
        'Coach Signup Notification',
        'Sent to admin when a new coach signs up',
        'Admin',
        'New Coach Registration: {{CoachName}}',
        'A new coach has registered on {{OrganizationName}}.

Coach Details:
- Name: {{CoachName}}
- Email: {{Email}}
- Registration Date: {{RegistrationDate}}

Please review their profile and approve if appropriate.

Best regards,
{{OrganizationName}} System',
        '["CoachName", "Email", "RegistrationDate", "OrganizationName"]',
        1
    );
    PRINT '  Inserted coach_signup_notification template';
END

GO

-- =============================================
-- STEP 5: Verify changes
-- =============================================
PRINT '';
PRINT 'Verifying changes...';

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('NotificationTemplates') AND type = 'U')
    PRINT '  NotificationTemplates table exists';
ELSE
    PRINT '  ERROR: NotificationTemplates table NOT found';

DECLARE @TemplateCount INT;
SELECT @TemplateCount = COUNT(*) FROM NotificationTemplates;
PRINT '  Total templates: ' + CAST(@TemplateCount AS VARCHAR(10));

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_NotificationTemplates_TemplateKey' AND object_id = OBJECT_ID('NotificationTemplates'))
    PRINT '  Unique index on TemplateKey exists';
ELSE
    PRINT '  ERROR: Unique index on TemplateKey NOT found';

PRINT '';
PRINT 'Migration_016_NotificationTemplates completed.';
GO
