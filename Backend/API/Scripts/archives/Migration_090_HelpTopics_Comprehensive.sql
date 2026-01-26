-- Migration 090: Comprehensive Help Topics
-- Adds thorough help content throughout the application

PRINT 'Migration 090: Adding comprehensive help topics...'

-- ============================================================================
-- EVENTS CATEGORY - Event Creation and Management
-- ============================================================================

-- Event Basics
IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'event.create')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'event.create',
        'Creating an Event',
        'Events are how you organize pickleball play. There are three types:

- **Tournament**: Competitive play with brackets, pools, and prizes
- **Game Day**: Casual organized play sessions (round robin, open play)
- **League**: Ongoing competition over multiple weeks

Each event can have multiple divisions based on skill level, age group, or format (singles, doubles, mixed).',
        'Events',
        10
    )
    PRINT 'Added help topic: event.create'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'event.eventType')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'event.eventType',
        'Event Type',
        'Choose the type of event you''re organizing:

- **Tournament**: Competitive brackets with elimination rounds
- **Game Day**: Social play with flexible scheduling
- **League Play**: Ongoing competition with standings

The event type determines available features and how registrations work.',
        'Events',
        11
    )
    PRINT 'Added help topic: event.eventType'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'event.visibility')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'event.visibility',
        'Event Visibility',
        'Control who can see and register for your event:

- **Public**: Anyone can view and register
- **Club Members Only**: Only members of your club can register
- **Invite Only**: Players need an invitation link to register

You can change visibility at any time before the event starts.',
        'Events',
        12
    )
    PRINT 'Added help topic: event.visibility'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'event.registrationDeadline')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'event.registrationDeadline',
        'Registration Deadline',
        'Set when registration closes:

- **Date**: Last day players can register
- **Time**: Exact cutoff time on the deadline date

After the deadline:
- No new registrations accepted
- Players cannot change divisions
- Waitlist is frozen

You can manually add players after the deadline if needed.',
        'Events',
        13
    )
    PRINT 'Added help topic: event.registrationDeadline'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'event.refundPolicy')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'event.refundPolicy',
        'Refund Policy',
        'Define your event''s refund rules:

- **Full Refund Until**: Last date for 100% refund
- **Partial Refund Until**: Last date for partial refund (specify percentage)
- **No Refunds After**: Date after which no refunds are given

Clearly communicate your policy to avoid disputes. Refunds are processed through the original payment method.',
        'Events',
        14
    )
    PRINT 'Added help topic: event.refundPolicy'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'event.waitlist')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'event.waitlist',
        'Waitlist',
        'When a division is full, players join the waitlist:

- Players are added in order of registration
- When a spot opens, the first waitlisted player is notified
- They have 24 hours to confirm before the spot goes to the next person
- Waitlisted players can withdraw without penalty

You can manually promote waitlisted players at any time.',
        'Events',
        15
    )
    PRINT 'Added help topic: event.waitlist'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'event.notifications')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'event.notifications',
        'Event Notifications',
        'Automatic notifications keep players informed:

- **Registration Confirmation**: Sent when players register
- **Division Assignment**: When players are placed in divisions
- **Schedule Released**: When match schedules are published
- **Match Reminders**: Before scheduled matches
- **Score Updates**: When match results are posted

You can customize notification templates in Event Settings.',
        'Events',
        16
    )
    PRINT 'Added help topic: event.notifications'
END

-- ============================================================================
-- DIVISIONS CATEGORY - Division Configuration
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'division.create')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'division.create',
        'Creating Divisions',
        'Divisions organize players by skill level, age, or format:

**Naming**: Use clear names like "3.5 Mixed Doubles" or "Open Singles"

**Skill Brackets**: Set min/max skill ratings to auto-filter registrations

**Age Groups**: Optional age restrictions (Senior 50+, Junior, etc.)

**Format**: Singles, Doubles, or Mixed Doubles

You can create multiple divisions for the same skill level (Pool A, Pool B) for large events.',
        'Divisions',
        20
    )
    PRINT 'Added help topic: division.create'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'division.teamUnit')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'division.teamUnit',
        'Team Unit',
        'Define how players register for this division:

- **Single**: Individual registration (used for singles play)
- **Pair/Doubles**: Two players register as a team (doubles/mixed)
- **Team (3+)**: Larger teams for team-based formats

For doubles, players can register with a partner or use "Looking for Partner" to be matched.',
        'Divisions',
        21
    )
    PRINT 'Added help topic: division.teamUnit'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'division.skillRange')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'division.skillRange',
        'Skill Range',
        'Set skill level requirements for this division:

- **Minimum Skill**: Lowest skill rating allowed
- **Maximum Skill**: Highest skill rating allowed

Players outside this range cannot register unless manually added. Skill ratings use the standard 2.0-6.0+ scale.

Leave blank for "Open" divisions with no restrictions.',
        'Divisions',
        22
    )
    PRINT 'Added help topic: division.skillRange'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'division.maxTeams')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'division.maxTeams',
        'Maximum Teams/Players',
        'Limit registrations for this division:

- Prevents overcrowding
- Enables waitlist when full
- Helps with court scheduling

**Recommended sizes**:
- Round Robin: 4-8 teams per pool
- Single Elimination: 8, 16, or 32 teams
- Double Elimination: 8-16 teams

Leave blank for unlimited registrations.',
        'Divisions',
        23
    )
    PRINT 'Added help topic: division.maxTeams'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'division.seeding')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'division.seeding',
        'Seeding',
        'How teams are ordered for bracket placement:

- **By Skill Rating**: Higher-rated players get top seeds
- **By Registration Order**: First registered = #1 seed
- **Random**: Randomly assign seeds
- **Manual**: You assign seeds manually

Good seeding prevents top players from meeting in early rounds. For fairness, skilled players should be spread across the bracket.',
        'Divisions',
        24
    )
    PRINT 'Added help topic: division.seeding'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'division.pools')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'division.pools',
        'Pool Play',
        'Divide large divisions into smaller groups:

**How it works**:
- Teams are divided into pools (A, B, C, etc.)
- Everyone in a pool plays each other (round robin)
- Top teams from each pool advance to playoffs

**Pool sizes**:
- 4 teams = 3 games each (recommended)
- 5 teams = 4 games each
- 6+ teams = gets long, consider more pools

Set "Teams advancing per pool" to control playoff bracket size.',
        'Divisions',
        25
    )
    PRINT 'Added help topic: division.pools'
END

-- ============================================================================
-- SCORING CATEGORY - Game Formats and Scoring
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'scoring.rallyScoring')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'scoring.rallyScoring',
        'Rally Scoring',
        'In rally scoring, a point is scored on every rally regardless of who served:

**Advantages**:
- Games have predictable length
- More exciting finish
- Easier for spectators to follow

**Common formats**:
- **Rally to 11, win by 2**: Standard recreational
- **Rally to 15, win by 2**: Tournament standard
- **Rally to 21, win by 2**: Traditional/championship

Most modern tournaments use rally scoring for better time management.',
        'Scoring',
        30
    )
    PRINT 'Added help topic: scoring.rallyScoring'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'scoring.sideOutScoring')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'scoring.sideOutScoring',
        'Side-Out Scoring',
        'Traditional pickleball scoring where only the serving team can score:

**How it works**:
- Serving team scores if they win the rally
- Receiving team wins rally = side out (serve changes)
- In doubles, both partners serve before side out

**Standard format**: First to 11, win by 2

Games take longer and can be unpredictable in length. Still popular in recreational play.',
        'Scoring',
        31
    )
    PRINT 'Added help topic: scoring.sideOutScoring'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'scoring.winByTwo')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'scoring.winByTwo',
        'Win By Two',
        'When enabled, you must win by a 2-point margin:

**Example (game to 11, win by 2)**:
- 11-9 = Game over (2-point lead)
- 11-10 = Continue playing
- 12-10 = Game over

**Optional cap**: Set a maximum score (e.g., 15) where win-by-2 ends and first to cap wins.

Disable win-by-2 for strict time limits.',
        'Scoring',
        32
    )
    PRINT 'Added help topic: scoring.winByTwo'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'scoring.tiebreaker')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'scoring.tiebreaker',
        'Tiebreaker Rules',
        'When teams are tied in standings, tiebreakers determine ranking:

**Order of tiebreakers**:
1. **Head-to-head**: Winner of their direct match
2. **Point differential**: Total points scored minus points allowed
3. **Points scored**: Higher total points wins
4. **Points allowed**: Fewer points allowed wins

For 3+ way ties, apply each tiebreaker until one team separates, then restart from top for remaining tied teams.',
        'Scoring',
        33
    )
    PRINT 'Added help topic: scoring.tiebreaker'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'scoring.timeCap')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'scoring.timeCap',
        'Time Cap',
        'Limit game length to stay on schedule:

**Soft cap**: Warning when time is running out, finish current rally

**Hard cap**: Game ends immediately, current score is final

**Cap winner rules**:
- Higher score wins (even if below target)
- Ties may allow one more point (win by 1)

Use time caps for large events with tight schedules.',
        'Scoring',
        34
    )
    PRINT 'Added help topic: scoring.timeCap'
END

-- ============================================================================
-- REGISTRATION CATEGORY - Player Registration
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'registration.process')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'registration.process',
        'Registration Process',
        'How to register for events:

1. **Find Event**: Browse events or use event link
2. **Choose Division**: Select skill-appropriate division
3. **Add Partner** (doubles): Enter partner''s name/email
4. **Pay**: Complete payment (if required)
5. **Confirm**: Receive confirmation email

Your registration is pending until payment clears and partner confirms (if applicable).',
        'Registration',
        40
    )
    PRINT 'Added help topic: registration.process'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'registration.partnerInvite')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'registration.partnerInvite',
        'Partner Invitations',
        'For doubles events, invite your partner:

**If partner has account**:
- Search by name or email
- They''ll receive notification to confirm

**If partner doesn''t have account**:
- Enter their email
- They''ll receive invite to create account and confirm

Your registration is "pending partner" until they accept. If they decline, you''re moved to "Looking for Partner" list.',
        'Registration',
        41
    )
    PRINT 'Added help topic: registration.partnerInvite'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'registration.payment')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'registration.payment',
        'Payment',
        'Complete payment to finalize registration:

**Payment methods**: Credit card, debit card

**Payment timing**:
- **Per Player**: Each player pays their portion
- **Per Team**: One person pays for the team

**Receipts**: Emailed automatically after payment

Registration isn''t confirmed until payment clears. Unpaid registrations may be cancelled before deadline.',
        'Registration',
        42
    )
    PRINT 'Added help topic: registration.payment'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'registration.withdrawl')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'registration.withdrawl',
        'Withdrawing from Events',
        'To withdraw from an event:

1. Go to your event registration
2. Click "Withdraw" button
3. Confirm withdrawal

**Refund eligibility** depends on event policy:
- Check refund deadline before withdrawing
- Partial refunds may apply after certain dates
- No refunds may apply close to event date

Your partner will be notified and can find a new partner.',
        'Registration',
        43
    )
    PRINT 'Added help topic: registration.withdrawl'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'registration.divisionChange')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'registration.divisionChange',
        'Changing Divisions',
        'Request a division change before registration closes:

1. Contact event organizer
2. They''ll move you if space available
3. Price differences may apply

**When you can''t change**:
- After registration deadline
- Once schedule is published
- If new division is full

Plan carefully when registering to avoid the hassle.',
        'Registration',
        44
    )
    PRINT 'Added help topic: registration.divisionChange'
END

-- ============================================================================
-- CLUBS CATEGORY - Club Management
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'club.create')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'club.create',
        'Creating a Club',
        'Start your own pickleball club:

1. **Name your club**: Choose a unique, memorable name
2. **Add description**: What makes your club special?
3. **Set location**: Primary playing venue
4. **Club type**: Social, competitive, or both
5. **Membership model**: Free or paid

As club creator, you''re the owner with full admin rights. Invite others as co-admins to help manage.',
        'Clubs',
        50
    )
    PRINT 'Added help topic: club.create'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'club.membership')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'club.membership',
        'Club Membership',
        'Join clubs to participate in their events:

**Member benefits**:
- Access to club-only events
- Member pricing on events
- Club communications and updates
- Connect with other members

**Membership types**:
- **Free**: Anyone can join
- **Paid**: Annual or monthly dues
- **Invite-only**: Requires admin approval

Some clubs have multiple tiers with different benefits.',
        'Clubs',
        51
    )
    PRINT 'Added help topic: club.membership'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'club.roles')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'club.roles',
        'Club Roles',
        'Different roles have different permissions:

- **Owner**: Full control, can delete club, assign admins
- **Admin**: Manage events, members, settings (can''t delete club)
- **Event Manager**: Create and manage events only
- **Member**: Participate in club activities
- **Guest**: Limited access, typically for non-members

Assign roles carefully - admins can make significant changes.',
        'Clubs',
        52
    )
    PRINT 'Added help topic: club.roles'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'club.events')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'club.events',
        'Club Events',
        'Clubs can host events for their members:

**Club-only events**: Only members can register
**Member pricing**: Discounted rates for members
**Club rankings**: Track member performance across events

To host an event:
1. Go to your club dashboard
2. Click "Create Event"
3. Set visibility and pricing

Club events appear on members'' dashboards automatically.',
        'Clubs',
        53
    )
    PRINT 'Added help topic: club.events'
END

-- ============================================================================
-- LEAGUES CATEGORY - League Management
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'league.overview')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'league.overview',
        'League Overview',
        'Leagues provide organized ongoing competition:

**Structure**:
- Multiple clubs join a league
- Regular matches over a season (weeks/months)
- Standings track team performance
- Playoffs at season end

**Benefits**:
- Consistent competition
- Skill development
- Community building
- Inter-club rivalries

Leagues can span geographic regions or skill levels.',
        'Leagues',
        60
    )
    PRINT 'Added help topic: league.overview'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'league.standings')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'league.standings',
        'League Standings',
        'How league standings are calculated:

**Points system** (typical):
- Win: 3 points
- Tie: 1 point
- Loss: 0 points

**Tiebreakers**:
1. Head-to-head record
2. Point differential
3. Total points scored
4. Random draw

Standings update automatically after each match is scored.',
        'Leagues',
        61
    )
    PRINT 'Added help topic: league.standings'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'league.schedule')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'league.schedule',
        'League Schedule',
        'League schedules are set for the entire season:

**Schedule types**:
- **Single Round Robin**: Play each team once
- **Double Round Robin**: Play each team twice (home/away)
- **Custom**: Flexible scheduling

**Match scheduling**:
- Matches have specific dates and times
- Home team provides venue
- Both teams must confirm scores

View your upcoming matches on your league dashboard.',
        'Leagues',
        62
    )
    PRINT 'Added help topic: league.schedule'
END

-- ============================================================================
-- PROFILE CATEGORY - Player Profiles
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'profile.skillRating')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'profile.skillRating',
        'Skill Rating',
        'Your skill rating represents your playing ability:

**Rating scale** (2.0 to 6.0+):
- **2.0-2.5**: Beginner
- **3.0-3.5**: Intermediate
- **4.0-4.5**: Advanced
- **5.0+**: Expert/Pro

**How it''s determined**:
- Self-assessment when you join
- Peer reviews from other players
- Tournament results (coming soon)

Accurate ratings ensure fair competition. Be honest in self-assessment!',
        'Profile',
        70
    )
    PRINT 'Added help topic: profile.skillRating'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'profile.certification')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'profile.certification',
        'Player Certification',
        'Get your skill level certified through peer reviews:

**How it works**:
1. Play with others regularly
2. They rate your skills in different areas
3. After multiple reviews, you earn certification

**Skill areas rated**:
- Serves and returns
- Dinks and drops
- Volleys
- Court positioning
- Strategy and consistency

Certification helps match you with appropriate opponents.',
        'Profile',
        71
    )
    PRINT 'Added help topic: profile.certification'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'profile.equipment')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'profile.equipment',
        'Equipment Profile',
        'Share your paddle and equipment preferences:

**Paddle info**:
- Brand and model
- Weight and grip size
- Surface type (carbon, fiberglass, etc.)

**Ball preference**: Indoor vs outdoor

**Why share this?**
- Help others with equipment choices
- Find players with similar setups
- Equipment recommendations

Your equipment profile is visible on your public profile.',
        'Profile',
        72
    )
    PRINT 'Added help topic: profile.equipment'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'profile.playStyle')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'profile.playStyle',
        'Play Style',
        'Describe your playing style:

**Play types**:
- **Power player**: Strong drives and smashes
- **Soft game**: Dinks and drops specialist
- **All-around**: Balanced game
- **Defensive**: Patient, forces errors

**Preferred position** (doubles):
- Left side (forehand middle)
- Right side (backhand middle)
- Either side

Helps partners understand your game.',
        'Profile',
        73
    )
    PRINT 'Added help topic: profile.playStyle'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'profile.availability')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'profile.availability',
        'Play Availability',
        'Let others know when you''re available to play:

**Set your schedule**:
- Days of the week
- Morning, afternoon, evening
- Preferred venues

**Benefits**:
- Find players with matching schedules
- Get invited to pickup games
- Organize regular playing sessions

Update regularly for best results.',
        'Profile',
        74
    )
    PRINT 'Added help topic: profile.availability'
END

-- ============================================================================
-- VENUES CATEGORY - Venue Management
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'venue.add')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'venue.add',
        'Adding a Venue',
        'Add pickleball courts to our database:

**Required info**:
- Venue name and address
- Number of courts
- Indoor/outdoor
- Surface type

**Optional info**:
- Photos
- Hours of operation
- Amenities (restrooms, lighting, etc.)
- Contact information

Anyone can add venues. Admins verify submissions.',
        'Venues',
        80
    )
    PRINT 'Added help topic: venue.add'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'venue.courtTypes')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'venue.courtTypes',
        'Court Types',
        'Different court surfaces play differently:

**Indoor surfaces**:
- Hardwood (gym floors)
- Sport court (rubber/plastic tiles)
- Concrete with coating

**Outdoor surfaces**:
- Asphalt
- Concrete
- Synthetic turf

**Considerations**:
- Ball bounce varies by surface
- Grip/traction differences
- Weather protection (indoor)

Choose events at surfaces you enjoy playing on.',
        'Venues',
        81
    )
    PRINT 'Added help topic: venue.courtTypes'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'venue.amenities')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'venue.amenities',
        'Venue Amenities',
        'Common venue amenities:

**Essential**:
- Restrooms
- Water fountains
- Parking
- Lighting (for evening play)

**Nice to have**:
- Shaded seating
- Pro shop
- Food/drinks
- Locker rooms
- Equipment rental

Check amenities before traveling to a new venue.',
        'Venues',
        82
    )
    PRINT 'Added help topic: venue.amenities'
END

-- ============================================================================
-- CERTIFICATION/REVIEW CATEGORY - Player Reviews
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'review.giving')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'review.giving',
        'Giving Player Reviews',
        'Help others by providing honest skill assessments:

**When to review**:
- After playing with someone multiple times
- When you''ve seen their full range of skills
- At their request

**How to rate**:
- Rate each skill area honestly (1-5 scale)
- Be constructive, not harsh
- Consider their experience level

Your reviews help create fair competition for everyone.',
        'Certification',
        90
    )
    PRINT 'Added help topic: review.giving'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'review.skillAreas')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'review.skillAreas',
        'Skill Areas',
        'Rate players in these areas:

**Serves**: Power, placement, consistency
**Returns**: Depth, variety, under pressure
**Dinks**: Soft game, patience, placement
**Volleys**: Reflexes, put-aways, stability
**Drops**: Third shot drops, resets, touch
**Drives**: Power, accuracy, timing
**Positioning**: Court awareness, movement
**Strategy**: Point construction, adaptability

Rate what you''ve observed. Leave blank if unsure.',
        'Certification',
        91
    )
    PRINT 'Added help topic: review.skillAreas'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'review.weights')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'review.weights',
        'Reviewer Weights',
        'Some reviews carry more weight:

**Factors that increase weight**:
- Reviewer has verified skill level
- Reviewer has given many accurate reviews
- Reviewer plays at similar skill level
- Multiple play sessions together

**Lower weight for**:
- New accounts with few reviews
- Significantly different skill levels
- Single play session

This prevents gaming the system.',
        'Certification',
        92
    )
    PRINT 'Added help topic: review.weights'
END

-- ============================================================================
-- INSTA-GAME CATEGORY - Quick Play Sessions
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'instagame.create')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'instagame.create',
        'Creating an Insta-Game',
        'Insta-Games are quick, informal play sessions:

**How to create**:
1. Choose venue and time
2. Set skill level range
3. Set number of spots
4. Publish!

**Features**:
- Real-time player notifications
- Auto-matchmaking
- Instant scheduling

Perfect for spontaneous play when you want a quick game.',
        'InstaGame',
        100
    )
    PRINT 'Added help topic: instagame.create'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'instagame.join')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'instagame.join',
        'Joining an Insta-Game',
        'Find and join pickup games:

**Finding games**:
- Browse nearby games
- Filter by skill level
- Filter by time

**Joining**:
1. Click "Join" on available game
2. Confirm your spot
3. Show up and play!

Cancel promptly if plans change to free the spot for others.',
        'InstaGame',
        101
    )
    PRINT 'Added help topic: instagame.join'
END

-- ============================================================================
-- FRIENDS CATEGORY - Social Features
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'friends.connect')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'friends.connect',
        'Connecting with Players',
        'Build your pickleball network:

**Adding friends**:
- Search by name or email
- Send connection request
- They accept to become friends

**Friend benefits**:
- See their upcoming events
- Easy partner invitations
- Activity feed updates
- Direct messaging

Quality connections lead to better playing experiences.',
        'Friends',
        110
    )
    PRINT 'Added help topic: friends.connect'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'friends.messaging')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'friends.messaging',
        'Messaging',
        'Communicate with other players:

**Message types**:
- Direct messages (1-on-1)
- Group chats (teams, clubs)
- Event discussions

**Notifications**:
- Push notifications for new messages
- Email digests (configurable)

Keep conversations friendly and pickleball-focused!',
        'Friends',
        111
    )
    PRINT 'Added help topic: friends.messaging'
END

-- ============================================================================
-- ADMIN CATEGORY - Admin Features
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'admin.users')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'admin.users',
        'User Management',
        'Manage user accounts and permissions:

**User actions**:
- View all registered users
- Search by name/email
- Change user roles (Admin, User)
- View user activity

**Roles**:
- **Admin**: Full site access, can manage all settings
- **User**: Standard access, can create events if approved

Use role assignments carefully - admins have significant power.',
        'Admin',
        120
    )
    PRINT 'Added help topic: admin.users'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'admin.theme')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'admin.theme',
        'Theme Settings',
        'Customize the site appearance:

**Branding**:
- Logo and favicon
- Site colors (primary, secondary)
- Hero images/videos

**Theme presets**: Quick apply common color schemes

Changes apply immediately site-wide. Test on mobile before saving.',
        'Admin',
        121
    )
    PRINT 'Added help topic: admin.theme'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'admin.notifications')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'admin.notifications',
        'Notification Settings',
        'Configure automated notifications:

**Template types**:
- Registration confirmations
- Event reminders
- Match results
- System announcements

**Variables**: Use placeholders like {playerName}, {eventName} in templates

Test notifications before enabling to ensure they work correctly.',
        'Admin',
        122
    )
    PRINT 'Added help topic: admin.notifications'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'admin.helpTopics')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'admin.helpTopics',
        'Help Topics Management',
        'Manage contextual help throughout the app:

**Managing topics**:
- Create new help topics
- Edit existing content
- Enable/disable topics
- Organize by category

**Best practices**:
- Keep content concise
- Use bullet points
- Update when features change
- Test after changes

Active topics appear as help icons throughout the UI.',
        'Admin',
        123
    )
    PRINT 'Added help topic: admin.helpTopics'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'admin.gameFormats')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'admin.gameFormats',
        'Game Formats',
        'Configure scoring format options:

**Format settings**:
- Points to win
- Win by two (yes/no)
- Max score cap
- Rally vs side-out scoring

**Preset formats**: Standard options like "Rally to 11" or "Traditional to 15"

New formats appear in division settings dropdowns.',
        'Admin',
        124
    )
    PRINT 'Added help topic: admin.gameFormats'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'admin.eventTypes')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'admin.eventTypes',
        'Event Types',
        'Define event type options:

**Default types**:
- Tournament
- Game Day
- League Play
- Social/Open Play

**Custom types**: Add specialized event types for your community

Event types help players find relevant events.',
        'Admin',
        125
    )
    PRINT 'Added help topic: admin.eventTypes'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'admin.skillLevels')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'admin.skillLevels',
        'Skill Levels',
        'Configure skill level definitions:

**Standard scale**: 2.0 to 6.0+ (USAPA/APP standard)

**Each level includes**:
- Numeric rating (e.g., 3.5)
- Name (e.g., "Intermediate")
- Description of skills at that level

Used for division filtering and player matching.',
        'Admin',
        126
    )
    PRINT 'Added help topic: admin.skillLevels'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'admin.certification')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'admin.certification',
        'Certification Settings',
        'Configure the peer review certification system:

**Skill categories**: Define what skills are rated
**Weights**: Set importance of each category
**Requirements**: Reviews needed for certification

Well-configured certification creates accurate skill assessments.',
        'Admin',
        127
    )
    PRINT 'Added help topic: admin.certification'
END

-- ============================================================================
-- GAME DAY CATEGORY - Game Day Specific
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'gameday.overview')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'gameday.overview',
        'Game Day Overview',
        'Game Days are casual organized play sessions:

**How it works**:
- Sign up for a time slot
- Arrive and check in
- Play rotating games with others
- All skill levels can mix or be grouped

**Common formats**:
- Open play (random pairing)
- Round robin within skill groups
- King/Queen of the court

Great for meeting new players and getting games in!',
        'GameDay',
        130
    )
    PRINT 'Added help topic: gameday.overview'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'gameday.checkIn')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'gameday.checkIn',
        'Game Day Check-In',
        'How check-in works at game days:

1. **Arrive**: Come to the venue at your slot time
2. **Find organizer**: Check in with the person running the event
3. **Get assignment**: You''ll be assigned to starting court/group
4. **Play**: Follow the rotation schedule

Check-in ensures accurate headcount for court assignments. Late arrivals may wait for next rotation.',
        'GameDay',
        131
    )
    PRINT 'Added help topic: gameday.checkIn'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'gameday.rotation')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'gameday.rotation',
        'Court Rotation',
        'How court rotations work:

**Rotation systems**:
- **Paddle stack**: Winners stay, losers rotate off
- **Time-based**: Switch after set time (e.g., 15 min)
- **Match-based**: Play to score, then rotate

**Rotation order**: Usually move to next court number (1→2→3→waiting)

Follow the organizer''s rotation system for fairness.',
        'GameDay',
        132
    )
    PRINT 'Added help topic: gameday.rotation'
END

-- ============================================================================
-- TOURNAMENT CATEGORY - Tournament Specific
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'tournament.brackets')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'tournament.brackets',
        'Tournament Brackets',
        'Understanding bracket formats:

**Single Elimination**:
- Lose once, you''re out
- Fast, dramatic
- Fewer guaranteed games

**Double Elimination**:
- Must lose twice to be eliminated
- Winners and losers brackets
- More forgiving, more games

**Round Robin + Playoff**:
- Everyone plays in pools first
- Top teams advance to bracket
- Best of both worlds

Choose based on time and desired experience.',
        'Tournament',
        140
    )
    PRINT 'Added help topic: tournament.brackets'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'tournament.seeding')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'tournament.seeding',
        'Tournament Seeding',
        'How seeding affects brackets:

**Seed placement**:
- #1 seed plays lowest seed in round 1
- Top seeds are spread across bracket
- Protects higher seeds from early matches

**Bye rounds**: If odd number of teams, top seeds may skip round 1

Good seeding ensures best players meet in finals, not round 1.',
        'Tournament',
        141
    )
    PRINT 'Added help topic: tournament.seeding'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'tournament.medals')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'tournament.medals',
        'Medals and Prizes',
        'Tournament awards and recognition:

**Standard medals**:
- Gold (1st place)
- Silver (2nd place)
- Bronze (3rd place)

**Bronze match**: 3rd/4th place playoff may be optional

Winners receive digital badges on their profile. Physical medals depend on event.',
        'Tournament',
        142
    )
    PRINT 'Added help topic: tournament.medals'
END

-- ============================================================================
-- SCHEDULING CATEGORY - Match Scheduling
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'schedule.matchTimes')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'schedule.matchTimes',
        'Match Times',
        'How match scheduling works:

**Assigned times**: Your matches have specific start times
**Court assignments**: Check which court you''re on
**Buffer time**: Allow time between matches for warmup

**Being late**:
- Grace period varies by event
- Excessive lateness may result in forfeit
- Contact organizer if running late

Check your schedule frequently on event day!',
        'Scheduling',
        150
    )
    PRINT 'Added help topic: schedule.matchTimes'
END

IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'schedule.courtAssignments')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder)
    VALUES (
        'schedule.courtAssignments',
        'Court Assignments',
        'Understanding court assignments:

**Finding your court**:
- Check match schedule for court number
- Courts are usually numbered or lettered
- Some venues have indoor/outdoor sections

**Court changes**: Organizers may move matches due to:
- Earlier match delays
- Court issues
- Weather (outdoor)

Stay near the tournament desk for updates.',
        'Scheduling',
        151
    )
    PRINT 'Added help topic: schedule.courtAssignments'
END

PRINT 'Migration 090 completed: Added comprehensive help topics'
