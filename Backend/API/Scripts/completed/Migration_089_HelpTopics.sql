-- Migration 089: Create HelpTopics table for dynamic contextual help
-- Allows admins to create help content that appears throughout the application

PRINT 'Migration 089: Creating HelpTopics table...'

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'HelpTopics')
BEGIN
    CREATE TABLE HelpTopics (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TopicCode NVARCHAR(100) NOT NULL,
        Title NVARCHAR(200) NULL,
        Content NVARCHAR(MAX) NOT NULL,
        Category NVARCHAR(50) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        SortOrder INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        CreatedByUserId INT NULL,
        UpdatedByUserId INT NULL
    )
    PRINT 'Created HelpTopics table'

    -- Create unique index on TopicCode
    CREATE UNIQUE INDEX IX_HelpTopics_TopicCode ON HelpTopics(TopicCode)
    PRINT 'Created unique index on TopicCode'

    -- Create index on Category for filtering
    CREATE INDEX IX_HelpTopics_Category ON HelpTopics(Category) WHERE Category IS NOT NULL
    PRINT 'Created index on Category'
END
ELSE
BEGIN
    PRINT 'HelpTopics table already exists'
END

-- Insert some initial help topics
IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'division.gamesPerMatch')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'division.gamesPerMatch',
        'Games per Match',
        'Choose how many games make up a match:
- **Single Game**: One game determines the winner
- **Best of 3**: First to win 2 games wins the match
- **Best of 5**: First to win 3 games wins the match

For tournaments, Best of 3 is most common. Finals often use Best of 3 or Best of 5.',
        'Events',
        1
    )
    PRINT 'Added help topic: division.gamesPerMatch'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'division.scheduleType')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'division.scheduleType',
        'Schedule Type',
        'Choose how matches are organized:
- **Round Robin**: Every team plays every other team. Best for smaller groups.
- **Round Robin + Playoff**: Pool play followed by elimination bracket for top teams.
- **Single Elimination**: Lose once and you''re out. Quick format for large brackets.
- **Double Elimination**: Must lose twice to be eliminated. More games, fairer results.
- **Random Pairing**: Random matchups each round. Good for recreational play.',
        'Events',
        2
    )
    PRINT 'Added help topic: division.scheduleType'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'division.defaultScoreFormat')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'division.defaultScoreFormat',
        'Default Game Format',
        'Select the scoring format for games in this division. This sets the default for new games - individual games can be changed later.

Common formats:
- **Rally scoring to 11** (win by 2): Standard recreational format
- **Rally scoring to 15** (win by 2): Used in some tournaments
- **Rally scoring to 21** (win by 2): Traditional format',
        'Events',
        3
    )
    PRINT 'Added help topic: division.defaultScoreFormat'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'event.paymentModel')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'event.paymentModel',
        'Payment Model',
        'Choose how registration fees are charged:
- **Per Unit/Team**: Each team pays one fee regardless of team size
- **Per Player**: Each player pays individually

Example: For doubles with $20 fee:
- Per Unit: Team pays $20 total
- Per Player: Each player pays $20 ($40 per team)',
        'Events',
        4
    )
    PRINT 'Added help topic: event.paymentModel'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'registration.lookingForPartner')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'registration.lookingForPartner',
        'Looking for Partner',
        'Don''t have a partner yet? No problem!

1. Register for the division
2. Mark yourself as "Looking for Partner"
3. Other players looking for partners will see you
4. Once matched, you''ll both be notified

You can also browse other players looking for partners and send them a request.',
        'Registration',
        1
    )
    PRINT 'Added help topic: registration.lookingForPartner'
END

PRINT 'Migration 089 completed successfully'
