-- Migration 054: Seed Sample Blog Posts about Pickleball Techniques and Tactics
-- Creates categories and sample blog posts for new users to read

PRINT 'Seeding sample blog categories and posts...';

-- First, ensure we have blog categories
IF NOT EXISTS (SELECT 1 FROM BlogCategories WHERE Slug = 'techniques')
BEGIN
    INSERT INTO BlogCategories (Name, Slug, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('Techniques', 'techniques', 'Master the fundamental and advanced techniques of pickleball', 1, 1, GETUTCDATE());
    PRINT 'Created Techniques category';
END

IF NOT EXISTS (SELECT 1 FROM BlogCategories WHERE Slug = 'tactics')
BEGIN
    INSERT INTO BlogCategories (Name, Slug, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('Tactics', 'tactics', 'Strategic insights to outsmart your opponents', 1, 2, GETUTCDATE());
    PRINT 'Created Tactics category';
END

IF NOT EXISTS (SELECT 1 FROM BlogCategories WHERE Slug = 'drills')
BEGIN
    INSERT INTO BlogCategories (Name, Slug, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('Drills', 'drills', 'Practice drills to improve your game', 1, 3, GETUTCDATE());
    PRINT 'Created Drills category';
END

IF NOT EXISTS (SELECT 1 FROM BlogCategories WHERE Slug = 'strategy')
BEGIN
    INSERT INTO BlogCategories (Name, Slug, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('Strategy', 'strategy', 'Game plans and strategic thinking for competitive play', 1, 4, GETUTCDATE());
    PRINT 'Created Strategy category';
END

IF NOT EXISTS (SELECT 1 FROM BlogCategories WHERE Slug = 'beginners')
BEGIN
    INSERT INTO BlogCategories (Name, Slug, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('Beginners', 'beginners', 'Getting started with pickleball - tips for new players', 1, 5, GETUTCDATE());
    PRINT 'Created Beginners category';
END

-- Get category IDs
DECLARE @TechniquesId INT = (SELECT Id FROM BlogCategories WHERE Slug = 'techniques');
DECLARE @TacticsId INT = (SELECT Id FROM BlogCategories WHERE Slug = 'tactics');
DECLARE @DrillsId INT = (SELECT Id FROM BlogCategories WHERE Slug = 'drills');
DECLARE @StrategyId INT = (SELECT Id FROM BlogCategories WHERE Slug = 'strategy');
DECLARE @BeginnersId INT = (SELECT Id FROM BlogCategories WHERE Slug = 'beginners');

-- Get a valid author ID (first admin or first user)
DECLARE @AuthorId INT = (SELECT TOP 1 Id FROM Users WHERE Role = 'Admin' ORDER BY Id);
IF @AuthorId IS NULL
    SET @AuthorId = (SELECT TOP 1 Id FROM Users ORDER BY Id);

-- Only proceed if we have an author
IF @AuthorId IS NOT NULL
BEGIN
    PRINT 'Using author ID: ' + CAST(@AuthorId AS VARCHAR(10));

    -- Blog Post 1: The Third Shot Drop
    IF NOT EXISTS (SELECT 1 FROM BlogPosts WHERE Slug = 'mastering-the-third-shot-drop')
    BEGIN
        INSERT INTO BlogPosts (Title, Slug, Excerpt, Content, AuthorId, CategoryId, Status, PublishedAt, ViewCount, AllowComments, CreatedAt)
        VALUES (
            'Mastering the Third Shot Drop: The Most Important Shot in Pickleball',
            'mastering-the-third-shot-drop',
            'Learn why the third shot drop is considered the most crucial shot in pickleball and how to execute it consistently.',
            N'# Mastering the Third Shot Drop

The third shot drop is widely considered the most important shot in pickleball. It''s the great equalizer that allows the serving team to transition from the baseline to the kitchen line.

## Why Is It So Important?

After serving (shot 1) and the return (shot 2), the serving team faces a critical decision. The returning team has already moved to the kitchen line, giving them a significant positional advantage. The third shot drop neutralizes this advantage.

## The Mechanics

### Grip
Use a continental grip or slightly toward eastern forehand. Keep your grip pressure light - about 4 out of 10.

### Stance
- Feet shoulder-width apart
- Knees slightly bent
- Weight on the balls of your feet

### The Swing
1. **Preparation**: Paddle back early, below the ball
2. **Contact**: Hit the ball out in front, below waist height
3. **Follow-through**: Lift through the ball with an open paddle face
4. **Finish**: Paddle finishes around shoulder height

## Common Mistakes

1. **Hitting too hard**: The drop should arc softly over the net
2. **Flat paddle face**: Open the face to create the necessary arc
3. **Poor footwork**: Get to the ball early and set your feet
4. **No follow-through**: The lifting motion is essential

## Practice Drill

**Target Practice**
1. Place a target (towel or cone) in the kitchen
2. Practice dropping balls from mid-court
3. Aim for 7 out of 10 landing in the kitchen
4. Gradually move back as you improve

## When to Use It

The third shot drop isn''t always the right choice:
- **Use it** when opponents are at the kitchen line
- **Drive instead** if opponents are slow getting to the net
- **Lob** if opponents are crowding the kitchen

## Final Tips

- Practice with purpose, not just repetition
- Film yourself to check your form
- Start slow and build consistency before adding pace
- Remember: a good drop beats a great drive

Master this shot, and you''ll immediately improve your game!',
            @AuthorId,
            @TechniquesId,
            1, -- Published
            GETUTCDATE(),
            0,
            1,
            GETUTCDATE()
        );
        PRINT 'Created blog post: Mastering the Third Shot Drop';
    END

    -- Blog Post 2: Dinking Strategy
    IF NOT EXISTS (SELECT 1 FROM BlogPosts WHERE Slug = 'dinking-strategy-winning-the-soft-game')
    BEGIN
        INSERT INTO BlogPosts (Title, Slug, Excerpt, Content, AuthorId, CategoryId, Status, PublishedAt, ViewCount, AllowComments, CreatedAt)
        VALUES (
            'Dinking Strategy: Winning the Soft Game',
            'dinking-strategy-winning-the-soft-game',
            'Discover how to dominate the kitchen with effective dinking strategies and patterns.',
            N'# Dinking Strategy: Winning the Soft Game

The dink is the foundation of high-level pickleball. While power players might win games at lower levels, consistent dinkers dominate competitive play.

## What Is a Dink?

A dink is a soft shot hit from the kitchen (non-volley zone) that lands in your opponent''s kitchen. The goal is to keep the ball low, preventing attackable shots.

## The Four Pillars of Great Dinking

### 1. Consistency
A missed dink is a lost point. Focus on:
- Getting 20 dinks in a row before trying anything fancy
- Using proper technique over trying to be clever
- Resetting when under pressure

### 2. Placement
Where you dink matters more than how hard:
- **Cross-court dinks**: Safest option, more margin for error
- **Down-the-line dinks**: Creates angles but riskier
- **Middle dinks**: Causes confusion between opponents

### 3. Patience
The dink battle is a war of attrition:
- Wait for the attackable ball
- Don''t force winners
- Let your opponents make mistakes

### 4. Variation
Keep opponents guessing:
- Change pace occasionally
- Vary depth (short vs. deep in kitchen)
- Mix in topspin and backspin

## Dinking Patterns That Win

### The Cross-Court Exchange
Start every dink rally cross-court. It''s the safest pattern and gives you time to read the game.

### The Pull and Push
1. Dink cross-court to move opponent wide
2. Quick dink down the line to open court
3. Finish to the middle

### The Reset Pattern
When pressured:
1. Block to the middle
2. Soft cross-court dink
3. Reestablish position

## Reading Your Opponent

Watch for these signs:
- **High paddle** = They want to attack
- **Leaning forward** = Expecting short ball
- **Weight on heels** = Susceptible to drops at feet

## Common Dinking Mistakes

1. Standing too upright (bend those knees!)
2. Using too much wrist (use your shoulder)
3. Hitting every dink the same way
4. Trying to win the point with a dink

## The Mental Game

Dinking is as much mental as physical:
- Stay calm during long rallies
- Don''t get frustrated by patient opponents
- Trust the process

Remember: The best dinkers in the world aren''t trying to hit winners - they''re waiting for opportunities.',
            @AuthorId,
            @TacticsId,
            1, -- Published
            GETUTCDATE(),
            0,
            1,
            GETUTCDATE()
        );
        PRINT 'Created blog post: Dinking Strategy';
    END

    -- Blog Post 3: Serve and Return Fundamentals
    IF NOT EXISTS (SELECT 1 FROM BlogPosts WHERE Slug = 'serve-and-return-fundamentals')
    BEGIN
        INSERT INTO BlogPosts (Title, Slug, Excerpt, Content, AuthorId, CategoryId, Status, PublishedAt, ViewCount, AllowComments, CreatedAt)
        VALUES (
            'Serve and Return Fundamentals: Starting Every Point Right',
            'serve-and-return-fundamentals',
            'Master the basics of serving and returning to gain an advantage from the very first shot.',
            N'# Serve and Return Fundamentals

Every pickleball point starts with a serve and return. While these shots might seem simple, mastering them gives you an immediate advantage.

## The Serve

### Legal Requirements
- Underhand motion (paddle below wrist)
- Contact below waist
- Both feet behind baseline
- Ball struck in the air or after one bounce (drop serve)

### Serve Types

**1. The Deep Serve**
- Target: Within 2 feet of baseline
- Purpose: Push opponent back, make return difficult
- Best for: Players who struggle moving backward

**2. The Power Serve**
- Low and fast
- Target: Opponent''s backhand
- Risk: Higher chance of faults

**3. The Soft Serve**
- High arc, lands deep
- Purpose: Changes timing
- Useful: Against aggressive returners

**4. The Body Serve**
- Directly at the opponent
- Forces awkward returns
- Effective against players with slow feet

### Serve Placement Strategy

| Target | When to Use |
|--------|-------------|
| Deep backhand | Default safe serve |
| Wide forehand | Pull opponent off court |
| At the body | Against quick players |
| Short angle | Surprise variation |

## The Return

The return is the most underrated shot in pickleball. A good return sets up everything that follows.

### Return Priorities

1. **Get it in** - A missed return is a free point
2. **Get it deep** - Push the server back
3. **Get to the kitchen** - Start moving immediately

### Return Techniques

**The Deep Return**
- Default return choice
- Target: Deep middle or backhand
- Follow your shot to the kitchen

**The Soft Angle Return**
- Use against charging opponents
- Low over the net
- Creates difficult third shot

**The Lob Return**
- Over aggressive net rushers
- High and deep
- Buy time to get positioned

## Footwork After Contact

### After Serving
- Split step as opponent contacts
- Ready position
- Prepare for third shot

### After Returning
- Contact and GO
- Move through the shot
- Arrive at kitchen before the third shot

## Practice Drill: Serve and Dash

1. Serve deep
2. Partner catches (no return)
3. Practice your split step timing
4. Repeat 20 times each side

## Common Mistakes

**Serving**
- Trying too hard for aces
- Inconsistent toss
- Not varying placement

**Returning**
- Standing too close to baseline
- Flat-footed at contact
- Not moving forward after return

## Key Takeaways

1. Consistency beats power on serves
2. Deep returns are winning returns
3. Footwork determines success
4. Practice both sides equally

Master these fundamentals and you''ll start every point with confidence!',
            @AuthorId,
            @TechniquesId,
            1, -- Published
            GETUTCDATE(),
            0,
            1,
            GETUTCDATE()
        );
        PRINT 'Created blog post: Serve and Return Fundamentals';
    END

    -- Blog Post 4: Doubles Communication
    IF NOT EXISTS (SELECT 1 FROM BlogPosts WHERE Slug = 'doubles-communication-playing-as-a-team')
    BEGIN
        INSERT INTO BlogPosts (Title, Slug, Excerpt, Content, AuthorId, CategoryId, Status, PublishedAt, ViewCount, AllowComments, CreatedAt)
        VALUES (
            'Doubles Communication: Playing as a Team',
            'doubles-communication-playing-as-a-team',
            'Learn the essential communication skills that separate good doubles teams from great ones.',
            N'# Doubles Communication: Playing as a Team

In doubles pickleball, communication is the difference between two individuals and a cohesive team. The best partnerships aren''t always the most skilled - they''re the best communicators.

## The Basics: What to Call

### "Mine" and "Yours"
The most important calls in doubles:
- Call EARLY - as soon as you commit
- Call LOUD - your partner needs to hear
- Call ONCE - repeated calls create confusion

### "Switch" and "Stay"
When balls go down the middle:
- **Switch**: Cross to cover the open court
- **Stay**: Remain in your position
- Discuss preferences BEFORE the game

### "Bounce" and "No"
Help your partner with:
- **Bounce**: Let it bounce (going out)
- **No**: Don''t hit it (your ball or going out)

## Pre-Point Communication

### Before Each Point
Quick confirmations:
- "I''m serving to the backhand"
- "Stacking on this side"
- "Watch for the lob"

### Between Points
- Discuss what''s working
- Adjust strategy if needed
- Stay positive and encouraging

## Positioning Communication

### Moving Together
Great teams move as one unit:
- Shift left and right together
- Maintain proper spacing (about 10 feet apart)
- Call out when you''re pulled wide

### The Middle Ball Protocol
Decide who takes middle balls:
- **Forehand takes it**: Most common approach
- **Stronger player takes it**: In competitive settings
- **Whoever calls it**: If both have forehands

## Non-Verbal Communication

### Hand Signals
Used by the net player on serves:
- Behind the back
- Indicate poach or stay
- Common signals:
  - Fist = Stay
  - Open hand = Poach
  - Finger point = Fake poach

### Eye Contact
A quick look can communicate:
- "I''ve got this one"
- "Be ready"
- "Great shot!"

## Positive Communication

### Encouraging Phrases
- "Good try!"
- "We''ll get the next one"
- "Nice reset"
- "Great patience"

### What to Avoid
- Blame or criticism
- Sighing or negative body language
- Coaching during points
- Arguing about calls

## Building Chemistry

### Practice Together
- Develop consistent patterns
- Learn each other''s tendencies
- Build trust through repetition

### Post-Game Review
- What worked well?
- What needs improvement?
- Any communication breakdowns?

## Common Communication Problems

1. **Both going for middle balls** - Establish protocol
2. **Neither going for middle balls** - Someone must be decisive
3. **Conflicting calls** - First call wins
4. **Silent partner** - Encourage them to speak up

## Advanced Team Tactics

### The Erne Call
When partner should attempt an Erne:
- "Go!" or "Erne!"
- Only when clearly set up

### Poach Coordination
- Pre-arranged signals
- Verbal: "I''m going"
- Post-poach: Call "Switch!" or "Stay!"

## Final Tips

1. Over-communicate at first, then find your balance
2. Have difficult conversations off the court
3. Celebrate successes together
4. Take responsibility for your mistakes
5. Trust your partner''s calls

Remember: Two 4.0 players who communicate well will often beat two 4.5 players who don''t!',
            @AuthorId,
            @StrategyId,
            1, -- Published
            GETUTCDATE(),
            0,
            1,
            GETUTCDATE()
        );
        PRINT 'Created blog post: Doubles Communication';
    END

    -- Blog Post 5: Kitchen Line Dominance
    IF NOT EXISTS (SELECT 1 FROM BlogPosts WHERE Slug = 'kitchen-line-dominance')
    BEGIN
        INSERT INTO BlogPosts (Title, Slug, Excerpt, Content, AuthorId, CategoryId, Status, PublishedAt, ViewCount, AllowComments, CreatedAt)
        VALUES (
            'Kitchen Line Dominance: Controlling the Net',
            'kitchen-line-dominance',
            'Learn how to establish and maintain control at the kitchen line to dominate your opponents.',
            N'# Kitchen Line Dominance: Controlling the Net

The kitchen line is the most valuable real estate on a pickleball court. The team that controls it usually wins. Here''s how to establish and maintain that control.

## Why the Kitchen Line Matters

From the kitchen line, you can:
- Cut off angles
- Attack weak shots
- Apply constant pressure
- Force opponents into errors

## Getting to the Kitchen

### The Approach
1. **After the return**: Move as you hit
2. **Split step**: Stop as opponent contacts ball
3. **Stay low**: Knees bent, paddle ready
4. **Small steps**: Adjust quickly at the end

### The Split Step
This is crucial for kitchen line play:
- Both feet land simultaneously
- Weight on balls of feet
- Slight knee bend
- Paddle up and ready

## Positioning at the Kitchen

### Optimal Stance
- Toes at the kitchen line (not in it!)
- Knees bent, athletic position
- Paddle at chest height
- Weight slightly forward

### Court Coverage
- Cover your half plus middle
- Stay aware of partner''s position
- Don''t overcommit to one side

## Offensive Kitchen Play

### Attacking the High Ball
When you get an attackable ball:
- Step into the shot
- Aim at opponent''s feet
- Use topspin for control
- Follow your shot with eyes

### The Speed-Up
Changing pace effectively:
- Wait for the right ball (above net level)
- Target the shoulder or hip
- Commit fully - no half attempts
- Be ready for the counter

### Angles and Placement
Creating winners:
- Sharp cross-court angles
- Down the line when opponent is wide
- At the feet when opponents are back

## Defensive Kitchen Play

### The Block
When under attack:
- Soft hands
- Paddle face slightly open
- Absorb the pace
- Reset to the kitchen

### The Reset
Getting out of trouble:
- Dink it back soft and low
- Aim for the middle
- Buy time to recover
- Don''t try to do too much

## Common Kitchen Mistakes

1. **Standing too upright**
   - Bend those knees!
   - Lower center of gravity

2. **Reaching instead of moving**
   - Take small shuffle steps
   - Get your body behind the ball

3. **Paddle too low**
   - Keep it at chest height
   - Ready for volleys

4. **Backing off the line**
   - Hold your ground
   - Step back only if lobbed

## Drills for Kitchen Mastery

### Skinny Singles
- Play using only half the court
- Focus on dinking and resets
- Great for touch development

### Rapid Fire Volleys
- Partner feeds fast balls
- Practice blocks and resets
- Build reflexes and soft hands

### King/Queen of the Kitchen
- Dinking competition
- Point ends when ball pops up
- Winner stays, challenger rotates in

## The Mental Game at the Kitchen

### Patience
- Don''t rush the attack
- Wait for the right opportunity
- Trust the dink

### Confidence
- Own your space
- Be assertive
- Believe in your shots

### Focus
- Watch the ball, not opponents
- Stay present
- One shot at a time

## Final Thoughts

Kitchen line dominance is about:
1. Getting there efficiently
2. Being ready when you arrive
3. Knowing when to attack vs. reset
4. Never giving up position voluntarily

Master the kitchen, master the game!',
            @AuthorId,
            @TacticsId,
            1, -- Published
            GETUTCDATE(),
            0,
            1,
            GETUTCDATE()
        );
        PRINT 'Created blog post: Kitchen Line Dominance';
    END

    -- Blog Post 6: Essential Drills
    IF NOT EXISTS (SELECT 1 FROM BlogPosts WHERE Slug = 'five-essential-drills-for-rapid-improvement')
    BEGIN
        INSERT INTO BlogPosts (Title, Slug, Excerpt, Content, AuthorId, CategoryId, Status, PublishedAt, ViewCount, AllowComments, CreatedAt)
        VALUES (
            'Five Essential Drills for Rapid Improvement',
            'five-essential-drills-for-rapid-improvement',
            'Practice with purpose using these five drills that will quickly elevate your pickleball game.',
            N'# Five Essential Drills for Rapid Improvement

Want to improve faster? Stop just playing games and start practicing with purpose. These five drills target the shots that matter most.

## Drill 1: The Dink Cross-Court Rally

**Purpose**: Build consistency and touch

**Setup**:
- Two players at diagonal kitchen corners
- One ball

**Execution**:
1. Cross-court dinks only
2. Count consecutive successful dinks
3. Goal: 50 in a row without errors

**Progressions**:
- Add targets (hoops or towels)
- Vary spin (topspin, backspin)
- Increase pace slightly

**Time**: 10 minutes each diagonal

---

## Drill 2: Third Shot Drop Targets

**Purpose**: Develop reliable drops

**Setup**:
- Feeder at kitchen with basket of balls
- Dropper at baseline
- Target in the kitchen (towel or hoop)

**Execution**:
1. Feeder hits deep ball
2. Dropper executes third shot drop
3. Aim for target
4. Track success rate

**Goals**:
- Beginner: 5/10 in kitchen
- Intermediate: 7/10 in kitchen
- Advanced: 8/10 hitting target

**Time**: 15 minutes, then switch roles

---

## Drill 3: Transition Zone Survival

**Purpose**: Handle attacks while moving forward

**Setup**:
- One player at kitchen (attacker)
- One player at baseline (defender)
- Balls ready

**Execution**:
1. Defender hits third shot
2. Attacker drives or dinks
3. Defender moves forward, resets
4. Point plays out
5. Defender earns point by reaching kitchen

**Focus Points**:
- Split step timing
- Soft hands on resets
- Forward movement between shots

**Time**: 10 points, then switch

---

## Drill 4: Speed-Up and Counter

**Purpose**: Improve reactions and hands

**Setup**:
- Both players at kitchen line
- Starting with cooperative dinks

**Execution**:
1. Dink rally (5-10 shots)
2. Either player can speed up
3. Point plays out
4. Winner determined by first error

**Rules**:
- No lobs
- Speed-ups must be attackable balls
- Practice both initiating and countering

**Time**: Play to 11, then reset

---

## Drill 5: Serve and Return Deep

**Purpose**: Consistency on first two shots

**Setup**:
- Normal doubles positions
- Target zones marked (last 3 feet of court)

**Execution**:
1. Serve must land in target zone
2. Return must land in target zone
3. Point plays out normally
4. Bonus point for hitting targets

**Scoring**:
- Normal point: 1 point
- Target hit: 2 points

**Time**: Games to 15

---

## Practice Schedule

### 30-Minute Quick Session
- Dink rally: 10 min
- Third shot drops: 10 min
- Free play applying skills: 10 min

### 60-Minute Full Session
- Warm-up dinks: 10 min
- Third shot drops: 15 min
- Transition drill: 15 min
- Speed-up counters: 10 min
- Games with focus: 10 min

### Weekly Plan
| Day | Focus |
|-----|-------|
| Monday | Dinking and touch |
| Wednesday | Third shots and transitions |
| Friday | Volleys and hands |
| Weekend | Games and competition |

## Tips for Effective Practice

1. **Quality over quantity** - 20 focused minutes beats 60 mindless ones
2. **Track progress** - Keep notes on success rates
3. **Practice weaknesses** - It''s not fun, but it''s necessary
4. **Find a practice partner** - Consistent drilling requires commitment
5. **Video yourself** - Review form and identify issues

## Common Practice Mistakes

- Playing games instead of drilling
- Not keeping score or tracking progress
- Practicing only what you''re good at
- Going through motions without focus
- Skipping warm-up

## Final Thoughts

Improvement in pickleball is directly proportional to purposeful practice. These five drills cover the most important shots in the game. Commit to regular practice, track your progress, and watch your game transform!',
            @AuthorId,
            @DrillsId,
            1, -- Published
            GETUTCDATE(),
            0,
            1,
            GETUTCDATE()
        );
        PRINT 'Created blog post: Five Essential Drills';
    END

    -- Blog Post 7: Beginner's Guide
    IF NOT EXISTS (SELECT 1 FROM BlogPosts WHERE Slug = 'complete-beginners-guide-to-pickleball')
    BEGIN
        INSERT INTO BlogPosts (Title, Slug, Excerpt, Content, AuthorId, CategoryId, Status, PublishedAt, ViewCount, AllowComments, CreatedAt)
        VALUES (
            'The Complete Beginner''s Guide to Pickleball',
            'complete-beginners-guide-to-pickleball',
            'Everything you need to know to start playing pickleball, from rules to equipment to basic strategy.',
            N'# The Complete Beginner''s Guide to Pickleball

Welcome to the fastest-growing sport in America! Whether you''re picking up a paddle for the first time or transitioning from another racquet sport, this guide will get you playing confidently.

## What Is Pickleball?

Pickleball combines elements of tennis, badminton, and ping pong. It''s played on a badminton-sized court with a modified tennis net, using solid paddles and a perforated plastic ball.

### Why People Love It
- Easy to learn
- Great exercise
- Highly social
- All ages can play together
- Less running than tennis

## The Court

### Dimensions
- 20 feet wide × 44 feet long
- Same size for singles and doubles
- 7-foot non-volley zone ("kitchen") on each side

### Key Areas
1. **Baseline**: Back line where you serve from
2. **Kitchen**: 7 feet from net, no volleys allowed here
3. **Service courts**: Right and left boxes behind kitchen
4. **Centerline**: Divides service courts

## Equipment Basics

### The Paddle
- Solid face (no strings)
- Materials: Wood, composite, or graphite
- Beginner recommendation: Mid-weight composite

### The Ball
- Perforated plastic (like a wiffle ball)
- Indoor balls: 26 holes, softer
- Outdoor balls: 40 holes, harder

### Shoes
- Court shoes with lateral support
- Tennis or volleyball shoes work well
- Avoid running shoes (no lateral support)

## Basic Rules

### Serving
1. Underhand only
2. Contact below waist
3. Serve diagonally to opposite court
4. Ball must clear net and land in service court
5. Only one serve attempt (unlike tennis)

### The Two-Bounce Rule
- Ball must bounce once on each side before volleys are allowed
- Serve bounces, return bounces, then volleys are legal

### The Kitchen (Non-Volley Zone)
- Cannot volley (hit ball in air) while in kitchen
- Can enter kitchen to play a bounced ball
- Momentum cannot carry you in after a volley

### Scoring
- Games to 11, win by 2
- Only serving team can score
- In doubles, both players serve before side-out

### The Score Call
"Server score - Receiver score - Server number"
Example: "4-2-1" means:
- Serving team has 4
- Receiving team has 2
- First server is serving

## Basic Shots

### The Serve
- Stand behind baseline
- Drop or toss ball
- Underhand swing, contact below waist
- Aim deep in service court

### The Return
- Let serve bounce (two-bounce rule)
- Hit deep to push server back
- Move toward kitchen after contact

### The Dink
- Soft shot from kitchen to kitchen
- Barely clears the net
- Lands in opponent''s kitchen

### The Volley
- Hit ball before it bounces
- Cannot be done in kitchen
- Used for put-aways and pressure

## Basic Strategy for Beginners

### Priority 1: Get to the Kitchen
The team at the kitchen line has a huge advantage. Work to get there and stay there.

### Priority 2: Keep the Ball Low
High balls get attacked. Low balls are harder to handle.

### Priority 3: Be Consistent
Don''t try fancy shots. Just get the ball back.

## Common Beginner Mistakes

1. **Standing in no-man''s land** (between kitchen and baseline)
2. **Trying to hit winners** too early
3. **Not moving to the kitchen** after the return
4. **Stepping in the kitchen** to volley
5. **Hitting too hard** instead of placing shots

## Etiquette

### Before Playing
- Introduce yourself
- Clarify skill levels
- Discuss any injuries or limitations

### During Play
- Call balls out clearly
- Give opponents benefit of doubt
- Don''t coach unless asked
- Say "nice shot" for good plays

### After Playing
- Tap paddles at net
- Thank your partner and opponents
- Pick up stray balls

## Finding Places to Play

- Local recreation centers
- YMCA/YWCA facilities
- Tennis courts with temporary lines
- Dedicated pickleball facilities
- School gymnasiums

## Next Steps

1. **Take a lesson** - Most facilities offer beginner clinics
2. **Watch videos** - Visual learning helps tremendously
3. **Play regularly** - Consistency builds skills
4. **Find your community** - Join local groups and leagues
5. **Have fun!** - It''s a game, enjoy it

Welcome to pickleball - you''re going to love it!',
            @AuthorId,
            @BeginnersId,
            1, -- Published
            GETUTCDATE(),
            0,
            1,
            GETUTCDATE()
        );
        PRINT 'Created blog post: Complete Beginner''s Guide';
    END

    PRINT 'Sample blog posts seeding completed!';
END
ELSE
BEGIN
    PRINT 'No valid author found. Skipping blog post creation.';
END

PRINT 'Migration 054 completed.';
