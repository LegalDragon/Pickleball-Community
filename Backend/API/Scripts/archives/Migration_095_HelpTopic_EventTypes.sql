-- Migration 095: Add comprehensive Event Types help topic
-- Explains the different event types and their scheduling options

PRINT 'Starting Migration 095: Event Types Help Topic'

-- Insert or update the event.eventTypes help topic
IF NOT EXISTS (SELECT 1 FROM HelpTopics WHERE TopicCode = 'event.eventTypes')
BEGIN
    INSERT INTO HelpTopics (TopicCode, Title, Content, Category, SortOrder, IsActive, CreatedAt)
    VALUES (
        'event.eventTypes',
        'Understanding Event Types',
        'Each event type has different scheduling and management features:

**Tournament**
- Uses brackets and/or pools for competitive play
- Schedule Type: *Brackets/Pools* - Create brackets and round-robin pools before the event
- Best for: Competitive events with elimination rounds

**Rec Play / Open Play**
- Casual drop-in sessions with flexible scheduling
- Schedule Type: *Auto-Schedule* (Popcorn/Gauntlet) - System automatically creates games based on who''s checked in
- Best for: Regular community play sessions

**League**
- Ongoing series over multiple weeks
- Schedule Type: *Manual Games* - Organizer creates matchups manually
- Best for: Season-long competitions with standings

**Social / Mixer**
- Fun events focused on meeting new players
- Schedule Type: *Auto-Schedule* - Rotates partners/opponents automatically
- Best for: Social events and mixers

**Clinic / Training**
- Instructional sessions with coaches
- Schedule Type: *No Schedule* - No game scheduling needed
- Best for: Lessons and skill development

**Schedule Types Explained:**
- **Brackets/Pools**: Pre-plan all matches before event starts
- **Auto-Schedule**: Popcorn (random) or Gauntlet (winners stay) scheduling
- **Manual Games**: TD creates each game individually
- **No Schedule**: Event doesn''t need game scheduling',
        'Events',
        5,
        1,
        GETDATE()
    );
    PRINT 'Inserted new event.eventTypes help topic';
END
ELSE
BEGIN
    UPDATE HelpTopics SET
        Title = 'Understanding Event Types',
        Content = 'Each event type has different scheduling and management features:

**Tournament**
- Uses brackets and/or pools for competitive play
- Schedule Type: *Brackets/Pools* - Create brackets and round-robin pools before the event
- Best for: Competitive events with elimination rounds

**Rec Play / Open Play**
- Casual drop-in sessions with flexible scheduling
- Schedule Type: *Auto-Schedule* (Popcorn/Gauntlet) - System automatically creates games based on who''s checked in
- Best for: Regular community play sessions

**League**
- Ongoing series over multiple weeks
- Schedule Type: *Manual Games* - Organizer creates matchups manually
- Best for: Season-long competitions with standings

**Social / Mixer**
- Fun events focused on meeting new players
- Schedule Type: *Auto-Schedule* - Rotates partners/opponents automatically
- Best for: Social events and mixers

**Clinic / Training**
- Instructional sessions with coaches
- Schedule Type: *No Schedule* - No game scheduling needed
- Best for: Lessons and skill development

**Schedule Types Explained:**
- **Brackets/Pools**: Pre-plan all matches before event starts
- **Auto-Schedule**: Popcorn (random) or Gauntlet (winners stay) scheduling
- **Manual Games**: TD creates each game individually
- **No Schedule**: Event doesn''t need game scheduling',
        UpdatedAt = GETDATE()
    WHERE TopicCode = 'event.eventTypes';
    PRINT 'Updated event.eventTypes help topic';
END

PRINT 'Migration 095 completed successfully'
