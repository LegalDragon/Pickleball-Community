-- Migration 093: Populate HelpTopics with comprehensive content
-- This updates all help topics with detailed, user-friendly content

PRINT 'Starting Migration 093: Populate HelpTopics Content'

-- ==========================================
-- EVENTS CATEGORY
-- ==========================================

UPDATE HelpTopics SET Content =
'Creating an event is simple:

1. **Select a Venue** - Choose from suggested venues or search for one
2. **Set Event Details** - Name, description, type, and thumbnail image
3. **Choose Dates** - Set start/end dates and times
4. **Configure Fees** - Set registration fees and payment model
5. **Add Divisions** - Create skill-based divisions for players

Your event starts as a **Draft** until you publish it. This lets you perfect all details before players can register.

**Tips:**
- Add a compelling description with event rules
- Upload an eye-catching poster image
- Set clear contact information for questions'
WHERE TopicCode = 'event.create';

UPDATE HelpTopics SET Content =
'Event types categorize your event and help players find relevant competitions:

- **Tournament** - Competitive bracket-style play with winners
- **Round Robin** - Everyone plays everyone in their division
- **League** - Ongoing series over multiple weeks/months
- **Social/Open Play** - Casual drop-in sessions
- **Clinic** - Instructional sessions with coaches
- **Ladder** - Challenge-based ranking system

The event type determines the icon and color shown on event cards, helping players quickly identify what kind of event it is.'
WHERE TopicCode = 'event.eventType';

UPDATE HelpTopics SET Content =
'Control who can see and register for your event:

- **Public** - Anyone can find and register for your event
- **Private** - Only people with a direct link can view and register
- **Club Only** - Restricted to members of a specific club

Private events are perfect for:
- Club-exclusive tournaments
- Invitation-only competitions
- Testing event setup before going public'
WHERE TopicCode = 'event.visibility';

UPDATE HelpTopics SET Content =
'The registration deadline controls when players can sign up:

- Set a deadline to close registration before the event starts
- This gives you time to finalize brackets and schedules
- Players cannot register after this date/time

**Best Practices:**
- Allow at least 24-48 hours before event start
- For tournaments, close registration 2-3 days early to seed brackets
- Consider time zones if you have out-of-area participants'
WHERE TopicCode = 'event.registrationDeadline';

UPDATE HelpTopics SET Content =
'Set clear refund policies for your event:

**Common Policies:**
- Full refund until X days before event
- Partial refund (50%) within X days of event
- No refunds after registration closes
- Transferable registrations (player can find replacement)

**Tips:**
- Be clear and specific in your policy
- Include how refunds are processed (same payment method, credit, etc.)
- Consider offering credits for future events instead of cash refunds'
WHERE TopicCode = 'event.refundPolicy';

UPDATE HelpTopics SET Content =
'Waitlists help manage divisions that reach capacity:

**How it works:**
1. When a division fills up, new registrants join the waitlist
2. If someone withdraws, the first waitlisted player is notified
3. They have a limited time to claim the spot

**Settings:**
- Enable/disable waitlist per division
- Set maximum waitlist size
- Configure notification preferences

Waitlisted players appear with a "Waitlist" badge in registrations.'
WHERE TopicCode = 'event.waitlist';

UPDATE HelpTopics SET Content =
'Event notifications keep participants informed:

**Automatic Notifications:**
- Registration confirmation
- Partner invitation accepted/declined
- Payment reminders
- Schedule updates
- Event reminders (day before)

**Organizer Broadcasts:**
- Send messages to all registrants
- Announce schedule changes
- Share parking/check-in instructions
- Post-event follow-ups

Players can manage notification preferences in their profile settings.'
WHERE TopicCode = 'event.notifications';

-- ==========================================
-- DIVISIONS CATEGORY
-- ==========================================

UPDATE HelpTopics SET Content =
'Divisions organize players by skill level and format:

**To create a division:**
1. Select the team format (Singles, Doubles, Mixed)
2. Choose skill level range (e.g., 3.5-4.0)
3. Set maximum teams/pairs allowed
4. Configure entry fee if different from event fee

**Tips:**
- Name divisions clearly (e.g., "Mixed Doubles 3.5")
- Consider age groups for senior events
- Allow some skill overlap for competitive balance'
WHERE TopicCode = 'division.create';

UPDATE HelpTopics SET Content =
'Team unit defines how players compete:

- **Singles** - 1 player per side
- **Doubles** - 2 players per team (same gender)
- **Mixed Doubles** - 2 players per team (male + female)
- **Team** - 3+ players rotating in

The team unit determines:
- How registrations are counted
- Partner invitation requirements
- Bracket/pool structure
- How fees are calculated (per person vs per team)'
WHERE TopicCode = 'division.teamUnit';

UPDATE HelpTopics SET Content =
'Skill ranges ensure competitive balance:

**DUPR/UTPR Ratings:**
- 2.0-2.5: Beginner
- 3.0-3.5: Intermediate
- 4.0-4.5: Advanced
- 5.0+: Professional

**Best Practices:**
- Allow 0.5 overlap between divisions (3.0-3.5, 3.5-4.0)
- Consider combined ratings for doubles (e.g., 7.0-8.0 combined)
- Self-rating works for casual events; verified ratings for competitive

Players outside the skill range will see a warning but can still register unless restricted.'
WHERE TopicCode = 'division.skillRange';

UPDATE HelpTopics SET Content =
'Maximum teams/pairs limits division size:

**Considerations:**
- Court availability and time constraints
- Desired number of games per team
- Format (round robin needs fewer teams than brackets)

**Recommendations by Format:**
- Round Robin: 4-8 teams (everyone plays everyone)
- Single Elimination: 8, 16, or 32 for clean brackets
- Double Elimination: 8-16 teams
- Pool Play + Bracket: 12-24 teams

When max is reached, additional registrations go to the waitlist.'
WHERE TopicCode = 'division.maxTeams';

UPDATE HelpTopics SET Content =
'Seeding determines initial placement in brackets/pools:

**Seeding Methods:**
- **By Rating** - Highest rated players get top seeds
- **By Registration Order** - First to register gets top seed
- **Random** - Randomized seeding
- **Manual** - Organizer sets seeds manually

**Why Seeding Matters:**
- Prevents top players from meeting in early rounds
- Creates more competitive finals
- Rewards higher-skilled players with easier early matchups

Seeds can be adjusted manually before publishing the schedule.'
WHERE TopicCode = 'division.seeding';

UPDATE HelpTopics SET Content =
'Pool play divides teams into smaller groups:

**How Pools Work:**
1. Teams are divided into pools of 3-5 teams
2. Each team plays everyone in their pool (round robin)
3. Top finishers advance to elimination brackets

**Pool Configuration:**
- Number of pools (2, 4, or 8 typically)
- Teams per pool (3-5 recommended)
- How many advance (top 1, top 2, etc.)

**Benefits:**
- Guarantees minimum number of games
- More accurate seeding for playoffs
- Better for larger divisions'
WHERE TopicCode = 'division.pools';

-- ==========================================
-- SCORING CATEGORY
-- ==========================================

UPDATE HelpTopics SET Content =
'Rally scoring awards a point on every rally, regardless of who served:

**How it works:**
- Every rally results in a point for the winning side
- Games are typically played to 21 or 15
- Win by 2 (or use a cap at 25/17)

**Advantages:**
- Faster, more predictable game times
- Easier for spectators to follow
- Better for time-limited events

**Used In:**
- MLP (Major League Pickleball)
- Many recreational tournaments
- Time-capped events'
WHERE TopicCode = 'scoring.rallyScoring';

UPDATE HelpTopics SET Content =
'Side-out scoring only awards points to the serving team:

**Traditional Rules:**
- Only the serving team can score
- Games typically to 11, win by 2
- In doubles, both partners serve before side-out (except at game start)

**Score Calling:**
- Three numbers in doubles: Server score - Receiver score - Server number
- Example: "4-2-1" means serving team has 4, receiving has 2, first server

**Advantages:**
- Traditional pickleball format
- More strategic serving decisions
- Familiar to experienced players'
WHERE TopicCode = 'scoring.sideOutScoring';

UPDATE HelpTopics SET Content =
'Win by 2 ensures clear victories:

**Standard Rule:**
- Must win by 2 points
- If score reaches 10-10, play continues until 2-point lead
- Can use a cap to prevent endless games (e.g., cap at 15)

**With Cap:**
- At cap score, next point wins (no win by 2 needed)
- Example: At 14-14 with cap of 15, first to 15 wins

**Without Cap:**
- Games continue indefinitely until 2-point lead
- Can result in very long games (rare but possible)'
WHERE TopicCode = 'scoring.winByTwo';

UPDATE HelpTopics SET Content =
'Tiebreakers determine standings when teams have equal records:

**Common Tiebreakers (in order):**
1. Head-to-head result
2. Point differential (points scored minus points allowed)
3. Points scored (total)
4. Points allowed (fewer is better)
5. Coin flip / random draw

**For Pool Play:**
- Tiebreakers determine who advances to playoffs
- Can affect seeding in elimination rounds

Configure tiebreaker rules in division settings before the event starts.'
WHERE TopicCode = 'scoring.tiebreaker';

UPDATE HelpTopics SET Content =
'Time caps keep events on schedule:

**How Time Caps Work:**
- A time limit is set for each game/match
- When time expires, current rally finishes
- Winner is determined by current score

**Common Settings:**
- 15-20 minutes for rally scoring games
- 20-25 minutes for side-out scoring
- Soft cap: finish current game
- Hard cap: stop immediately

**Tips:**
- Announce time cap rules before matches
- Use visible timers or announcements
- Consider extra time for finals'
WHERE TopicCode = 'scoring.timeCap';

-- ==========================================
-- REGISTRATION CATEGORY
-- ==========================================

UPDATE HelpTopics SET Content =
'Registering for an event is easy:

**Steps:**
1. Find an event and select a division
2. If doubles, invite a partner or join as "Looking for Partner"
3. Complete payment (if required)
4. Receive confirmation email

**Registration Status:**
- **Pending Partner** - Waiting for partner to accept
- **Pending Payment** - Registration held until paid
- **Confirmed** - Fully registered
- **Waitlisted** - Division full, on waitlist

Check "My Events" to see all your registrations and their status.'
WHERE TopicCode = 'registration.process';

UPDATE HelpTopics SET Content =
'Partner invitations for doubles events:

**Inviting a Partner:**
1. Register for a division
2. Search for your partner by name or email
3. Send invitation
4. Partner receives email notification

**Partner Options:**
- Accept invitation to complete team registration
- Decline if unavailable
- Suggest a different division

**Looking for Partner:**
- Register without a partner
- Your name appears in "Looking for Partner" list
- Other players can invite you to join their team

Partners must be registered on the platform to receive invitations.'
WHERE TopicCode = 'registration.partnerInvite';

UPDATE HelpTopics SET Content =
'Payment options and policies:

**Payment Models:**
- **Per Unit** - One payment covers the whole team
- **Per Person** - Each player pays individually

**Payment Methods:**
- Credit/Debit card (Stripe)
- Cash/Check (mark as paid by organizer)
- Venmo/PayPal (manual verification)

**Payment Status:**
- Pending: Payment not yet received
- Partial: Some team members paid
- Paid: Full payment received
- Refunded: Payment returned

Organizers can manually mark payments as received for offline payments.'
WHERE TopicCode = 'registration.payment';

UPDATE HelpTopics SET Content =
'Withdrawing from an event:

**How to Withdraw:**
1. Go to "My Events"
2. Find the event registration
3. Click "Withdraw" button
4. Confirm withdrawal

**Important Notes:**
- Check refund policy before withdrawing
- In doubles, withdrawal affects your partner too
- Withdrawal opens your spot for waitlisted players
- You may be able to transfer to another player instead

**For Partners:**
If your partner withdraws, you can:
- Find a new partner
- Register as "Looking for Partner"
- Withdraw yourself'
WHERE TopicCode = 'registration.withdrawl';

UPDATE HelpTopics SET Content =
'Changing divisions after registration:

**When You Can Change:**
- Before registration deadline
- If new division has space
- Subject to organizer approval

**How to Change:**
1. Go to your registration details
2. Click "Change Division"
3. Select new division
4. Confirm (may require additional payment)

**Restrictions:**
- Cannot change after schedule is published
- Partner must agree to change in doubles
- Fee differences may apply
- Some events disable division changes'
WHERE TopicCode = 'registration.divisionChange';

-- ==========================================
-- CLUBS CATEGORY
-- ==========================================

UPDATE HelpTopics SET Content =
'Creating a club brings your community together:

**To Create a Club:**
1. Click "Create Club" button
2. Enter club name and description
3. Add logo and location
4. Set membership options
5. Configure privacy settings

**Club Features:**
- Member directory
- Club events and tournaments
- Document sharing
- Group chat
- Financial tracking
- League affiliations

Start with basic info - you can add more details later!'
WHERE TopicCode = 'club.create';

UPDATE HelpTopics SET Content =
'Club membership options:

**Membership Types:**
- **Open** - Anyone can join instantly
- **Request to Join** - Admin approval required
- **Invite Only** - Members must be invited

**Membership Fees:**
- Set annual/monthly dues
- Track payment status
- Send renewal reminders
- Record payment history

**Member Benefits:**
- Access to club events
- Member-only pricing
- Club chat access
- Document library access
- Voting rights (if enabled)'
WHERE TopicCode = 'club.membership';

UPDATE HelpTopics SET Content =
'Club roles define member permissions:

**Default Roles:**
- **Admin** - Full control, can manage all settings
- **Moderator** - Can manage members and events
- **Member** - Standard access to club features

**Custom Roles:**
- Treasurer, Secretary, Board Member, etc.
- Assign custom icons and colors
- Define specific permissions

**Role Permissions:**
- Manage members
- Create events
- Send notifications
- Access finances
- Edit club info

Admins can assign roles from the Members tab.'
WHERE TopicCode = 'club.roles';

UPDATE HelpTopics SET Content =
'Running events through your club:

**Club Events:**
- Create events linked to your club
- Offer member-only or member-discount pricing
- Use club venue as default location
- Notify all members automatically

**Benefits:**
- Events appear on club page
- Easy member registration
- Track participation
- Build club activity history

**Event Types:**
- Tournaments
- Weekly open play
- Clinics and lessons
- Social gatherings
- League matches'
WHERE TopicCode = 'club.events';

-- ==========================================
-- LEAGUES CATEGORY
-- ==========================================

UPDATE HelpTopics SET Content =
'Leagues provide organized competitive play over time:

**League Structure:**
- Multiple clubs compete over a season
- Regular match schedule
- Standings and rankings
- Playoffs or championship

**League Benefits:**
- Consistent competition
- Track improvement over time
- Build rivalries and community
- Qualify for regional/national events

**Joining a League:**
- Clubs apply to join leagues
- League admins approve membership
- Clubs field teams for competition
- Results affect standings'
WHERE TopicCode = 'league.overview';

UPDATE HelpTopics SET Content =
'League standings track team performance:

**Standings Factors:**
- Wins and losses
- Point differential
- Head-to-head results
- Games won/lost

**Standings Display:**
- Current rank
- Win-loss record
- Points for/against
- Streak (W/L)

**Tiebreakers:**
1. Head-to-head
2. Point differential
3. Points scored
4. Random draw

Standings update automatically after match results are entered.'
WHERE TopicCode = 'league.standings';

UPDATE HelpTopics SET Content =
'League schedules coordinate matches across clubs:

**Schedule Features:**
- Automatic schedule generation
- Home/away rotation
- Venue assignments
- Conflict detection

**Viewing Schedule:**
- Filter by club or division
- See upcoming matches
- View past results
- Download calendar (.ics)

**Schedule Changes:**
- Request reschedules through organizer
- Both teams must agree
- Updates notify all affected players'
WHERE TopicCode = 'league.schedule';

-- ==========================================
-- PROFILE CATEGORY
-- ==========================================

UPDATE HelpTopics SET Content =
'Your skill rating indicates your playing level:

**Rating Systems:**
- **DUPR** - Dynamic Universal Pickleball Rating
- **UTPR** - USA Pickleball Tournament Player Rating
- **Self-Rated** - Personal assessment

**Rating Scale:**
- 2.0-2.5: Beginner
- 3.0-3.5: Intermediate
- 4.0-4.5: Advanced
- 5.0+: Professional/Elite

**Improving Your Rating:**
- Play in rated events
- Compete against higher-rated players
- Consistent performance over time

Your rating helps match you with appropriate competition.'
WHERE TopicCode = 'profile.skillRating';

UPDATE HelpTopics SET Content =
'Skill certification validates your playing ability:

**Certification Process:**
1. Request reviews from players you''ve played with
2. Reviewers rate your skills in different areas
3. System calculates weighted average
4. Certification badge displayed on profile

**Skill Areas Reviewed:**
- Serves and returns
- Dinking and soft game
- Volleys and drives
- Court positioning
- Game strategy

**Benefits:**
- Verified skill level
- Easier partner matching
- Appropriate division placement
- Community recognition'
WHERE TopicCode = 'profile.certification';

UPDATE HelpTopics SET Content =
'Share your equipment preferences:

**Equipment Info:**
- Paddle brand and model
- Ball preference
- Shoes and apparel

**Why Share:**
- Help others find similar gear
- Get recommendations
- Connect with same-paddle players
- Equipment reviews and feedback

**Popular Paddle Brands:**
- Selkirk, Joola, Paddletek
- Engage, Onix, Franklin
- HEAD, Prince, CRBN

Keep your equipment updated to help the community!'
WHERE TopicCode = 'profile.equipment';

UPDATE HelpTopics SET Content =
'Your playing style describes how you compete:

**Common Styles:**
- **Aggressive/Banger** - Power shots, fast pace
- **Defensive/Soft Game** - Dinks, drops, patience
- **All-Rounder** - Balanced approach
- **Strategic** - Placement over power
- **Finesse** - Touch and control

**Why It Matters:**
- Find compatible partners
- Opponents can prepare
- Coaches can tailor instruction
- Better match experiences

Your style may evolve as you improve - update it anytime!'
WHERE TopicCode = 'profile.playStyle';

UPDATE HelpTopics SET Content =
'Set your availability for playing:

**Availability Settings:**
- Days of week you play
- Preferred times (morning, afternoon, evening)
- Open play vs scheduled only
- Travel radius

**Benefits:**
- Get matched for open play sessions
- Partners can find you easier
- Event invitations match your schedule
- League scheduling considers availability

Keep this updated for better match suggestions!'
WHERE TopicCode = 'profile.availability';

-- ==========================================
-- VENUES CATEGORY
-- ==========================================

UPDATE HelpTopics SET Content =
'Add a venue to help players find courts:

**Required Information:**
- Venue name
- Address (for map location)
- Number of courts
- Indoor/outdoor

**Optional Details:**
- Hours of operation
- Contact information
- Website and social media
- Photos
- Amenities

**Verification:**
- New venues are reviewed
- Community can suggest corrections
- Claim ownership for management access

Help grow the court database for your community!'
WHERE TopicCode = 'venue.add';

UPDATE HelpTopics SET Content =
'Court types affect playing experience:

**Surface Types:**
- **Concrete** - Most common outdoor
- **Asphalt** - Outdoor, can be rough
- **Sport Court** - Modular tiles, cushioned
- **Wood** - Indoor gymnasium
- **Polyurethane** - Indoor, professional

**Indoor vs Outdoor:**
- Indoor: Climate controlled, consistent
- Outdoor: Weather dependent, natural light
- Covered: Outdoor with roof protection

**Court Quality:**
- Line visibility
- Surface condition
- Net quality
- Lighting adequacy'
WHERE TopicCode = 'venue.courtTypes';

UPDATE HelpTopics SET Content =
'Venue amenities enhance the playing experience:

**Common Amenities:**
- Restrooms
- Water fountains
- Parking (free/paid)
- Pro shop
- Equipment rental
- Locker rooms
- Seating/spectator area

**Nice to Have:**
- Ball machine
- Coaching available
- Food/beverages
- WiFi
- Air conditioning (indoor)
- Shaded rest areas

Check amenities when planning events or visiting new venues!'
WHERE TopicCode = 'venue.amenities';

-- ==========================================
-- REVIEWS CATEGORY
-- ==========================================

UPDATE HelpTopics SET Content =
'Review players you''ve competed with:

**How to Review:**
1. Go to a player''s profile
2. Click "Write Review"
3. Rate skill areas (1-5 stars)
4. Add optional comments
5. Submit review

**Review Guidelines:**
- Be honest and constructive
- Base ratings on actual play experience
- Consider their stated skill level
- Focus on skills, not personality

**Review Ethics:**
- Only review players you''ve played with
- No revenge or fake reviews
- Update if player improves significantly'
WHERE TopicCode = 'review.giving';

UPDATE HelpTopics SET Content =
'Skill areas evaluated in reviews:

**Technical Skills:**
- **Serves** - Consistency, placement, power
- **Returns** - Depth, accuracy, variety
- **Dinks** - Control, patience, placement
- **Drives** - Power, accuracy, timing
- **Volleys** - Reflexes, positioning, touch

**Game Skills:**
- **Court Positioning** - Where they stand
- **Shot Selection** - Right shot for situation
- **Strategy** - Game plan execution
- **Consistency** - Unforced errors
- **Mental Game** - Composure, focus

Rate each area based on observed performance.'
WHERE TopicCode = 'review.skillAreas';

UPDATE HelpTopics SET Content =
'Review weights customize certification:

**How Weights Work:**
- Each skill area has a weight (importance)
- Higher weighted areas count more
- Weights configured by admins

**Default Weights:**
- Core skills (serves, dinks): Higher weight
- Specialty skills (erne, ATP): Lower weight
- Consistency: High weight
- Power: Medium weight

**Why Weights Matter:**
- Reflects what matters most in your community
- Allows emphasis on fundamentals
- Can be adjusted for different play styles'
WHERE TopicCode = 'review.weights';

-- ==========================================
-- INSTAGAME CATEGORY
-- ==========================================

UPDATE HelpTopics SET Content =
'Create an InstaGame for spontaneous play:

**Quick Setup:**
1. Select a venue
2. Set date and time
3. Choose skill level range
4. Set player limit
5. Post it!

**InstaGame Features:**
- Instant notifications to nearby players
- Quick RSVPs
- Chat with confirmed players
- Automatic reminders

**Best For:**
- Last-minute court availability
- Finding practice partners
- Filling open spots
- Casual play sessions

Games appear to players in your area who match the skill level.'
WHERE TopicCode = 'instagame.create';

UPDATE HelpTopics SET Content =
'Join an InstaGame near you:

**Finding Games:**
- Browse nearby InstaGames
- Filter by skill level
- Check time and location
- See who''s already joined

**Joining:**
1. Click "Join" on any open game
2. You''ll be notified of updates
3. Chat with other players
4. Show up and play!

**Etiquette:**
- Only join if you can commit
- Cancel early if plans change
- Arrive on time
- Bring appropriate gear'
WHERE TopicCode = 'instagame.join';

-- ==========================================
-- FRIENDS CATEGORY
-- ==========================================

UPDATE HelpTopics SET Content =
'Connect with other players:

**Finding Friends:**
- Search by name or email
- Browse event participants
- Check "People You May Know"
- Scan QR codes at events

**Friend Requests:**
1. Visit a player''s profile
2. Click "Add Friend"
3. They receive a notification
4. Once accepted, you''re connected

**Friend Benefits:**
- See their activity and events
- Send direct messages
- Easier partner invitations
- Appear in their network'
WHERE TopicCode = 'friends.connect';

UPDATE HelpTopics SET Content =
'Message friends and connections:

**Messaging Features:**
- Direct messages to friends
- Group chats for events/clubs
- Photo and link sharing
- Read receipts

**Starting a Conversation:**
1. Go to Messages or friend''s profile
2. Click "Message"
3. Type and send

**Notifications:**
- Push notifications for new messages
- Email digest option
- In-app badge counts

**Privacy:**
- Control who can message you
- Block unwanted contacts
- Report inappropriate messages'
WHERE TopicCode = 'friends.messaging';

-- ==========================================
-- ADMIN CATEGORY
-- ==========================================

UPDATE HelpTopics SET Content =
'User management for administrators:

**User Functions:**
- View all registered users
- Edit user profiles
- Assign admin/moderator roles
- Suspend or ban accounts
- Reset passwords

**User Search:**
- Search by name or email
- Filter by role or status
- Sort by join date or activity

**Best Practices:**
- Document reasons for any actions
- Use bans sparingly
- Communicate with users before suspending
- Regular audits of admin accounts'
WHERE TopicCode = 'admin.users';

UPDATE HelpTopics SET Content =
'Customize your site''s appearance:

**Theme Settings:**
- Primary and secondary colors
- Logo and favicon
- Hero images and videos
- Button styles

**Branding:**
- Organization name
- Tagline/slogan
- Social media links
- Contact information

**Presets:**
- Save theme configurations
- Quick switch between themes
- Seasonal or event themes
- Dark/light mode support'
WHERE TopicCode = 'admin.theme';

UPDATE HelpTopics SET Content =
'Manage system notifications:

**Notification Types:**
- Email templates
- Push notification settings
- In-app alerts
- SMS (if enabled)

**Template Management:**
- Edit notification text
- Add dynamic variables
- Preview before sending
- Enable/disable by type

**Broadcast Messages:**
- Send to all users
- Target specific groups
- Schedule future sends
- Track delivery and opens'
WHERE TopicCode = 'admin.notifications';

UPDATE HelpTopics SET Content =
'Manage contextual help content:

**Help Topics:**
- Each topic has a unique code
- Content supports basic formatting
- Topics are categorized
- Can be enabled/disabled

**Adding Topics:**
1. Click "Add Topic"
2. Set topic code (e.g., "event.create")
3. Write helpful content
4. Assign category
5. Save and activate

**Best Practices:**
- Keep content concise
- Use bullet points for steps
- Update when features change
- Test help icons in context'
WHERE TopicCode = 'admin.helpTopics';

UPDATE HelpTopics SET Content =
'Configure game scoring formats:

**Score Formats:**
- Rally scoring vs side-out
- Points to win (11, 15, 21)
- Win by 2 requirement
- Time caps

**Creating Formats:**
1. Name the format
2. Set scoring type
3. Configure win conditions
4. Set as default or optional

**Usage:**
- Assign to events
- Set per division
- Override for specific matches
- Display in schedules'
WHERE TopicCode = 'admin.gameFormats';

UPDATE HelpTopics SET Content =
'Manage event type categories:

**Event Types:**
- Tournament, League, Round Robin
- Social, Clinic, Ladder
- Custom types for your community

**Configuration:**
- Name and description
- Icon selection
- Color theme
- Default settings

**Best Practices:**
- Keep types distinct and clear
- Use consistent icons
- Limit to 8-10 types
- Archive unused types'
WHERE TopicCode = 'admin.eventTypes';

UPDATE HelpTopics SET Content =
'Configure skill level options:

**Standard Levels:**
- 2.0, 2.5, 3.0, 3.5
- 4.0, 4.5, 5.0, 5.5+

**Customization:**
- Add intermediate levels
- Create age-based levels
- Define level descriptions
- Set display order

**Usage:**
- Event division filtering
- Player matching
- Registration restrictions
- Leaderboard groupings'
WHERE TopicCode = 'admin.skillLevels';

UPDATE HelpTopics SET Content =
'Manage player certification system:

**Certification Settings:**
- Minimum reviews required
- Review expiration period
- Skill area weights
- Badge display options

**Administration:**
- View certification queue
- Override ratings if needed
- Handle disputes
- Generate reports

**Quality Control:**
- Monitor review patterns
- Flag suspicious activity
- Maintain rating integrity'
WHERE TopicCode = 'admin.certification';

-- ==========================================
-- GAMEDAY CATEGORY
-- ==========================================

UPDATE HelpTopics SET Content =
'Game Day Management overview:

**Features:**
- Real-time court status
- Live scoring
- Player check-in
- Match scheduling

**Dashboard Shows:**
- Active games in progress
- Courts available/in use
- Players checked in
- Upcoming matches

**Quick Actions:**
- Start new games
- Update scores
- Reassign courts
- Send announcements

Use this on event day to run smooth operations!'
WHERE TopicCode = 'gameday.overview';

UPDATE HelpTopics SET Content =
'Player check-in on game day:

**Check-In Process:**
1. Players arrive at venue
2. Find them in player list
3. Mark as checked in
4. They appear as available

**Check-In Benefits:**
- Know who''s present
- Accurate game scheduling
- Identify no-shows
- Contact missing players

**Bulk Check-In:**
- QR code scanning
- Self check-in kiosk
- Import from registration

Check-in status appears next to player names.'
WHERE TopicCode = 'gameday.checkIn';

UPDATE HelpTopics SET Content =
'Court rotation and game flow:

**Rotation System:**
- Games assigned to courts automatically
- When game ends, next match starts
- Courts stay utilized efficiently

**Manual Control:**
- Override court assignments
- Hold courts for specific matches
- Skip ahead in queue
- Handle delays

**Best Practices:**
- Keep finals courts reserved
- Allow rest time between games
- Communicate delays promptly
- Have backup court plans'
WHERE TopicCode = 'gameday.rotation';

-- ==========================================
-- TOURNAMENT CATEGORY
-- ==========================================

UPDATE HelpTopics SET Content =
'Tournament bracket formats:

**Single Elimination:**
- Lose once and you''re out
- Fastest to complete
- Best for large fields

**Double Elimination:**
- Must lose twice to be eliminated
- Winners and losers brackets
- More games guaranteed

**Round Robin:**
- Everyone plays everyone
- Most games per team
- Best for skill assessment

**Pool Play + Brackets:**
- Round robin pools first
- Top finishers to brackets
- Balances games and competition'
WHERE TopicCode = 'tournament.brackets';

UPDATE HelpTopics SET Content =
'Tournament seeding explained:

**Seeding Purpose:**
- Top players don''t meet early
- Rewards higher rankings
- Creates exciting finals

**Seeding Methods:**
- By DUPR/rating
- By registration order
- Random draw
- Committee selection

**Bracket Placement:**
- #1 seed vs lowest seed first round
- #2 seed opposite side of bracket
- Separated by quarters, halves

Proper seeding makes tournaments more competitive and fair.'
WHERE TopicCode = 'tournament.seeding';

UPDATE HelpTopics SET Content =
'Medal rounds and awards:

**Standard Medals:**
- Gold: Tournament winner
- Silver: Runner-up/finalist
- Bronze: Third place (may be two)

**Bronze Medal Match:**
- Losers of semifinals play for 3rd
- Optional - can award two bronze
- Popular in larger tournaments

**Recording Results:**
- Enter final standings
- System generates certificates
- Results posted to profiles
- Affects player ratings'
WHERE TopicCode = 'tournament.medals';

-- ==========================================
-- SCHEDULE CATEGORY
-- ==========================================

UPDATE HelpTopics SET Content =
'Setting match times:

**Scheduling Options:**
- Fixed start times
- Rolling schedule (next available)
- Time blocks by round

**Time Estimates:**
- Rally scoring: 15-20 min/game
- Side-out: 20-30 min/game
- Best of 3: 45-60 minutes
- Add buffer between matches

**Display Options:**
- Estimated start times
- "On deck" notifications
- Live schedule updates

Players can view their schedule in the event app.'
WHERE TopicCode = 'schedule.matchTimes';

UPDATE HelpTopics SET Content =
'Assigning courts to matches:

**Assignment Methods:**
- Automatic rotation
- Manual assignment
- Court preferences

**Considerations:**
- Finals on center court
- Streaming court assignments
- Wheelchair accessible courts
- Referee/official positions

**Managing Changes:**
- Drag and drop reassignment
- Notify affected players
- Update digital displays
- Handle equipment moves

Efficient court use keeps tournaments on schedule!'
WHERE TopicCode = 'schedule.courtAssignments';

PRINT 'Migration 093 completed successfully - All HelpTopics content updated'
