-- Migration 053: Site Content for editable pages
-- This allows admins to edit content for pages like Features, About, etc.

PRINT 'Creating SiteContent table...';

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SiteContent')
BEGIN
    CREATE TABLE SiteContent (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ContentKey NVARCHAR(50) NOT NULL UNIQUE,
        Title NVARCHAR(200) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        LastUpdatedByUserId INT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NULL,
        CONSTRAINT FK_SiteContent_User FOREIGN KEY (LastUpdatedByUserId) REFERENCES Users(Id)
    );

    CREATE UNIQUE INDEX IX_SiteContent_ContentKey ON SiteContent(ContentKey);

    PRINT 'SiteContent table created successfully.';
END
ELSE
BEGIN
    PRINT 'SiteContent table already exists.';
END

-- Seed initial Features content
PRINT 'Seeding initial Features content...';

IF NOT EXISTS (SELECT 1 FROM SiteContent WHERE ContentKey = 'features')
BEGIN
    INSERT INTO SiteContent (ContentKey, Title, Content, CreatedAt)
    VALUES (
        'features',
        'Pickleball Community Features',
        N'# Welcome to Pickleball Community

Your all-in-one platform for connecting with fellow pickleball enthusiasts, improving your game, and growing the sport.

## Core Features

### Player Profiles
Create your personalized player profile showcasing your skill level, playing style, preferred equipment, and availability. Connect with players who match your skill level and playing preferences.

### Skill Certification System
Get your skills certified through our peer-reviewed rating system. Receive feedback from fellow players and coaches to track your improvement over time.

- **Peer Reviews**: Get honest assessments from players you''ve played with
- **Skill Categories**: Serves, returns, dinks, volleys, and more
- **Weighted Ratings**: Reviews from certified players carry more weight

### Clubs & Organizations
Join local pickleball clubs or create your own. Manage memberships, organize events, and build your pickleball community.

- **Club Management**: Roles, membership tracking, and communications
- **League Affiliation**: Connect with regional and national organizations
- **Documents & Resources**: Share important club documents with members

### Find Courts & Venues
Discover pickleball courts near you with our comprehensive venue database.

- **Location Search**: Find courts by city, state, or GPS location
- **Court Details**: Number of courts, surface type, amenities
- **User Reviews**: See what other players think about venues

### Events & Tournaments
Stay informed about upcoming events in your area. Register for tournaments, social play sessions, and clinics.

### Friends & Messaging
Connect with other players, send friend requests, and chat directly within the app.

- **Real-time Messaging**: Instant communication with other players
- **Group Chats**: Coordinate with multiple players at once
- **Friend Management**: Build your pickleball network

### Mobile-First Design
Access all features from your phone with our Progressive Web App (PWA). Install it on your home screen for a native app-like experience.

## Getting Started

1. **Create Your Profile**: Sign up and fill out your player profile
2. **Find Players**: Search for players in your area or skill level
3. **Join a Club**: Connect with local clubs and organizations
4. **Start Playing**: Use the venue finder to locate courts near you
5. **Get Certified**: Play matches and receive skill certifications

## Tips for New Users

- **Complete Your Profile**: A detailed profile helps you connect with the right players
- **Be Active**: Participate in clubs, attend events, and engage with the community
- **Give Reviews**: Help others improve by providing honest skill assessments
- **Stay Updated**: Check the blog for tips, news, and community updates

---

*Have questions? Check out our [FAQ](/faq) or contact the community administrators.*',
        GETUTCDATE()
    );
    PRINT 'Features content seeded successfully.';
END
ELSE
BEGIN
    PRINT 'Features content already exists.';
END

PRINT 'Migration 053 completed.';
