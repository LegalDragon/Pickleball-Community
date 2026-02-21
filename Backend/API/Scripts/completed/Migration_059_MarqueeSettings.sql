-- Migration 059: Add Marquee Settings to ThemeSettings
-- Allows admin to configure the home page marquee (show players/clubs, recency, counts, speed)

PRINT 'Starting Migration 059: Marquee Settings'
GO

-- Add MarqueeShowPlayers column
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME = 'ThemeSettings' AND COLUMN_NAME = 'MarqueeShowPlayers')
BEGIN
    ALTER TABLE ThemeSettings ADD MarqueeShowPlayers BIT NOT NULL DEFAULT 1
    PRINT 'Added MarqueeShowPlayers column to ThemeSettings'
END
GO

-- Add MarqueeShowClubs column
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME = 'ThemeSettings' AND COLUMN_NAME = 'MarqueeShowClubs')
BEGIN
    ALTER TABLE ThemeSettings ADD MarqueeShowClubs BIT NOT NULL DEFAULT 1
    PRINT 'Added MarqueeShowClubs column to ThemeSettings'
END
GO

-- Add MarqueeRecentDays column (how many days back to consider "recent")
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME = 'ThemeSettings' AND COLUMN_NAME = 'MarqueeRecentDays')
BEGIN
    ALTER TABLE ThemeSettings ADD MarqueeRecentDays INT NOT NULL DEFAULT 30
    PRINT 'Added MarqueeRecentDays column to ThemeSettings'
END
GO

-- Add MarqueePlayerCount column (max players to show)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME = 'ThemeSettings' AND COLUMN_NAME = 'MarqueePlayerCount')
BEGIN
    ALTER TABLE ThemeSettings ADD MarqueePlayerCount INT NOT NULL DEFAULT 20
    PRINT 'Added MarqueePlayerCount column to ThemeSettings'
END
GO

-- Add MarqueeClubCount column (max clubs to show)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME = 'ThemeSettings' AND COLUMN_NAME = 'MarqueeClubCount')
BEGIN
    ALTER TABLE ThemeSettings ADD MarqueeClubCount INT NOT NULL DEFAULT 15
    PRINT 'Added MarqueeClubCount column to ThemeSettings'
END
GO

-- Add MarqueeSpeed column (animation duration in seconds, higher = slower)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME = 'ThemeSettings' AND COLUMN_NAME = 'MarqueeSpeed')
BEGIN
    ALTER TABLE ThemeSettings ADD MarqueeSpeed INT NOT NULL DEFAULT 40
    PRINT 'Added MarqueeSpeed column to ThemeSettings'
END
GO

PRINT 'Completed Migration 059: Marquee Settings'
GO
