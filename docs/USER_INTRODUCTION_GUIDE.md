# Pickleball Community - User Introduction Guide

Welcome to Pickleball Community! This guide will walk you through the key features of our platform with step-by-step UI navigation.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Your Player Profile](#2-your-player-profile)
3. [Finding and Joining Events](#3-finding-and-joining-events)
4. [Tournament Day Experience](#4-tournament-day-experience)
5. [Clubs and Community](#5-clubs-and-community)
6. [Venues and Courts](#6-venues-and-courts)
7. [Player Skill Certification](#7-player-skill-certification)
8. [For Event Organizers](#8-for-event-organizers)

---

## 1. Getting Started

### Creating Your Account

**UI Flow:**
```
Homepage → Click "Sign Up" (top right)
    → Enter email/phone
    → Create password
    → Click "Create Account"
    → Check email/SMS for verification code
    → Enter code → Account created!
```

### Installing the App (PWA)

**iPhone UI Flow:**
```
Open Safari → Navigate to pickleball.community
    → Tap Share button (bottom center)
    → Scroll down → Tap "Add to Home Screen"
    → Tap "Add" (top right)
    → App icon appears on home screen
```

**Android UI Flow:**
```
Open Chrome → Navigate to pickleball.community
    → Tap menu (⋮) (top right)
    → Tap "Add to Home Screen"
    → Tap "Add"
    → App icon appears on home screen
```

### Main Navigation

**Navigation Bar (Top):**
```
[Logo] | Events | Venues | Clubs | Blog | FAQ | Feedback | [Profile Menu]
```

**Profile Menu (Click profile icon):**
```
My Profile
My Events
My Clubs
Settings
Sign Out
```

---

## 2. Your Player Profile

### Viewing Your Profile

**UI Flow:**
```
Click Profile Icon (top right) → "My Profile"
```

### Editing Profile Information

**UI Flow:**
```
My Profile → Click "Edit Profile" button
    → Basic Info section:
        - Profile photo (click to upload)
        - First/Last name
        - Location (city, state)
    → Playing Info section:
        - Years playing
        - Skill level dropdown
        - Preferred play style (Singles/Doubles/Mixed)
    → Equipment section:
        - Paddle brand/model
    → Click "Save Changes"
```

### Adding Social Links

**UI Flow:**
```
My Profile → Click "Edit Profile"
    → Scroll to "Social Links" section
    → Click "Add Link"
    → Select platform (Instagram, Facebook, YouTube, etc.)
    → Paste your profile URL
    → Click "Save"
```

### Privacy Settings

**UI Flow:**
```
Profile Icon → "Settings"
    → "Privacy" tab
    → Toggle options:
        - Profile visibility (Public/Friends/Private)
        - Show email to other users
        - Show phone to other users
    → Click "Save"
```

---

## 3. Finding and Joining Events

### Browsing Events

**UI Flow:**
```
Top Navigation → Click "Events"
    → Events List page displays
    → Filter panel (left side or top on mobile):
        - Location: Enter city or "Use my location"
        - Date: Select date range
        - Event Type: Tournament / Game Day / League
        - Skill Level: Select range (e.g., 3.0-4.0)
    → Click "Apply Filters"
    → Browse filtered results
```

### Viewing Event Details

**UI Flow:**
```
Events List → Click on any event card
    → Event Details page shows:
        ┌─────────────────────────────────────┐
        │ Event Name                          │
        │ [Status Badge: Draft/Open/Closed]   │
        │ Date: Feb 1, 2026                   │
        │ Location: Venue Name (linked)       │
        ├─────────────────────────────────────┤
        │ [Register for Event] button         │
        ├─────────────────────────────────────┤
        │ Tabs: Info | Divisions | Documents  │
        └─────────────────────────────────────┘
```

### Registering for an Event

**UI Flow:**
```
Event Details → Click "Register for Event"
    → Registration Modal opens:

    Step 1 - Select Division:
        → View available divisions (e.g., "Open Doubles", "3.5 Mixed")
        → Click division to select
        → Click "Continue"

    Step 2 - Partner Selection (for doubles):
        → Option A: "I have a partner"
            → Search by name or email
            → Select partner from results
        → Option B: "Find me a partner"
            → System will match you
        → Click "Continue"

    Step 3 - Payment (if required):
        → Review fees
        → Enter payment info or select saved method
        → Click "Pay $XX.XX"

    Step 4 - Waiver (if required):
        → Read waiver document
        → Check "I agree" box
        → Sign (type name or draw signature)
        → Click "Submit"

    → Confirmation screen
    → "View My Registration" button
```

### Managing Your Registrations

**UI Flow:**
```
Profile Icon → "My Events"
    → Tabs: Upcoming | Past | Cancelled

    → Click on any registration:
        ┌─────────────────────────────────────┐
        │ Event Name                          │
        │ Division: Open Doubles              │
        │ Partner: John Smith                 │
        │ Status: Confirmed ✓                 │
        │ Payment: Paid ✓                     │
        │ Waiver: Signed ✓                    │
        ├─────────────────────────────────────┤
        │ [View Schedule] [Cancel Registration]│
        └─────────────────────────────────────┘
```

---

## 4. Tournament Day Experience

### Pre-Event: Online Check-in

**UI Flow:**
```
Profile Icon → "My Events"
    → Click on upcoming event
    → Click "Check In" button (available 24hrs before)
    → Confirm your attendance
    → Status changes to "Checked In ✓"
```

### At Event: Viewing Schedule

**UI Flow:**
```
Event Details → "View Schedule" or "View Tournament"
    → Tournament page opens with tabs:

    ┌────────────────────────────────────────────────────┐
    │  Pre-Planning  |  ★ Game Day Execution             │
    ├────────────────────────────────────────────────────┤
    │  Overview | Check-in | Schedule | By Court | ...   │
    └────────────────────────────────────────────────────┘
```

### Schedule Tab - Finding Your Matches

**UI Flow:**
```
Game Day Execution → "Schedule" tab
    → Select your division (if multiple):
        [Open Doubles ▼] [Singles]

    → View sections:
        ┌─────────────────────────────────────┐
        │ ▼ Drawing Results (19 teams)        │
        │   Pool 0: Team list with seeds      │
        └─────────────────────────────────────┘

        ┌─────────────────────────────────────┐
        │ Pool Play Schedule                  │
        │ ─────────────────────────────────── │
        │ Round 1                             │
        │ 9:00 AM | Court 1                   │
        │ #1 Team A vs Team B    [Scheduled]  │
        │ ─────────────────────────────────── │
        │ 9:00 AM | Court 2                   │
        │ #2 Team C vs Team D    [Scheduled]  │
        └─────────────────────────────────────┘
```

### By Court Tab - Court-Centric View

**UI Flow:**
```
Game Day Execution → "By Court" tab
    → Grid of court cards:

    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ 📍 Court 1   │  │ 📍 Court 2   │  │ 📍 Court 3   │
    │ [Available]  │  │ [In Use]     │  │ [Available]  │
    │ 3 matches    │  │ 2 matches    │  │ 4 matches    │
    │──────────────│  │──────────────│  │──────────────│
    │ 9:00 #1      │  │ 9:00 #2      │  │ 9:00 #3      │
    │ Team A vs B  │  │ Team C vs D  │  │ Team E vs F  │
    │ [Scheduled]  │  │ [InProgress] │  │ [Scheduled]  │
    │──────────────│  │──────────────│  │──────────────│
    │ 9:30 #7      │  │ 9:30 #8      │  │ 9:30 #9      │
    │ Team G vs H  │  │ Team I vs J  │  │ Team K vs L  │
    └──────────────┘  └──────────────┘  └──────────────┘
```

### Overview Tab - Tournament Progress

**UI Flow:**
```
Game Day Execution → "Overview" tab
    → Dashboard cards:

    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ Matches     │ │ Completed   │ │ In Progress │
    │    24       │ │    12       │ │     2       │
    └─────────────┘ └─────────────┘ └─────────────┘

    → Current matches section
    → Up next section
    → Live standings (expandable)
```

### Viewing Live Standings

**UI Flow:**
```
Schedule tab → Scroll to "Pool Play Schedule"
    → Click "View Standings" or scroll to standings section

    → Standings table:
    ┌────┬────────────┬────┬────┬────┬─────┐
    │ #  │ Team       │ MW │ ML │ GW │ +/- │
    ├────┼────────────┼────┼────┼────┼─────┤
    │ 1  │ Team A     │ 3  │ 0  │ 6  │ +15 │
    │ 2  │ Team B     │ 2  │ 1  │ 5  │ +8  │
    │ 3  │ Team C     │ 1  │ 2  │ 3  │ -5  │
    └────┴────────────┴────┴────┴────┴─────┘

    Toggle: [By Pool] [All Teams]
    Sort: Click column headers
```

---

## 5. Clubs and Community

### Finding Clubs

**UI Flow:**
```
Top Navigation → Click "Clubs"
    → Clubs List page:

    Search: [Enter club name or location    ] [🔍]

    → Club cards display:
    ┌─────────────────────────────────────┐
    │ [Club Logo]  Club Name              │
    │ 📍 City, State                      │
    │ 👥 45 members                       │
    │ 🏠 Home Venue: Local Courts         │
    │                        [View Club]  │
    └─────────────────────────────────────┘
```

### Viewing Club Details

**UI Flow:**
```
Clubs List → Click "View Club"
    → Club page:

    ┌─────────────────────────────────────┐
    │ Club Name                           │
    │ 📍 Location    👥 Members: 45       │
    ├─────────────────────────────────────┤
    │ [Join Club]  [Contact]              │
    ├─────────────────────────────────────┤
    │ Tabs: About | Events | Members      │
    └─────────────────────────────────────┘

    About tab: Club description, rules, home venue
    Events tab: Club-hosted events
    Members tab: Member list (if visible)
```

### Joining a Club

**UI Flow:**
```
Club Page → Click "Join Club"
    → If open membership:
        → Confirm dialog → Click "Join" → You're a member!

    → If requires approval:
        → Request form appears
        → Enter message (optional)
        → Click "Request to Join"
        → Status: "Pending Approval"
        → Wait for admin approval notification

    → If has membership fee:
        → Review fee details
        → Click "Pay & Join"
        → Complete payment
        → You're a member!
```

### Managing Club Membership

**UI Flow:**
```
Profile Icon → "My Clubs"
    → List of your clubs:

    ┌─────────────────────────────────────┐
    │ Club Name              [Member]     │
    │ Joined: Jan 15, 2026               │
    │ [View Club] [Leave Club]           │
    └─────────────────────────────────────┘
```

---

## 6. Venues and Courts

### Finding Venues

**UI Flow:**
```
Top Navigation → Click "Venues"
    → Venues page with map and list:

    ┌─────────────────────────────────────────────┐
    │ [Map View]                                  │
    │    📍 markers showing venue locations       │
    │                                             │
    ├─────────────────────────────────────────────┤
    │ Search: [City or zip code        ] [🔍]    │
    │ Filter: [Indoor ▼] [# Courts ▼] [Lights ▼] │
    ├─────────────────────────────────────────────┤
    │ List View:                                  │
    │ ┌───────────────────────────────────────┐  │
    │ │ Venue Name                    ⭐ 4.5   │  │
    │ │ 📍 123 Main St, City         8 courts │  │
    │ │ 🏠 Outdoor | Lights | Restrooms       │  │
    │ └───────────────────────────────────────┘  │
    └─────────────────────────────────────────────┘
```

### Viewing Venue Details

**UI Flow:**
```
Venues List → Click on venue
    → Venue Details page:

    ┌─────────────────────────────────────┐
    │ [Venue Photos Carousel]             │
    ├─────────────────────────────────────┤
    │ Venue Name                  ⭐ 4.5  │
    │ 📍 Full address                     │
    │ 🎾 8 courts (6 outdoor, 2 indoor)   │
    │ 💡 Lights available                 │
    │ 🕐 Hours: 6am - 10pm               │
    ├─────────────────────────────────────┤
    │ [Get Directions] [View Events]      │
    ├─────────────────────────────────────┤
    │ Tabs: Info | Events | Reviews       │
    └─────────────────────────────────────┘

    Info tab: Full details, amenities, contact
    Events tab: Upcoming events at this venue
    Reviews tab: User ratings and comments
```

### Adding a Venue Review

**UI Flow:**
```
Venue Details → "Reviews" tab
    → Click "Write a Review"
    → Review form:
        - Star rating (1-5)
        - Review text
        - Add photos (optional)
    → Click "Submit Review"
```

---

## 7. Player Skill Certification

### Viewing Your Skill Rating

**UI Flow:**
```
Profile Icon → "My Profile"
    → Skill Rating section:

    ┌─────────────────────────────────────┐
    │ Your Skill Rating                   │
    │ ┌─────────────────────────────────┐ │
    │ │         ★ 3.5                   │ │
    │ │   Based on 12 peer reviews      │ │
    │ └─────────────────────────────────┘ │
    │ [View Rating History]               │
    └─────────────────────────────────────┘
```

### Rating History

**UI Flow:**
```
My Profile → Click "View Rating History"
    → Rating History page:

    ┌─────────────────────────────────────┐
    │ Rating Over Time [Graph]            │
    │   3.5 ─────────●                    │
    │   3.0 ────●────                     │
    │        Jan  Feb  Mar                │
    ├─────────────────────────────────────┤
    │ Recent Reviews:                     │
    │ John S. rated you 3.5 - Jan 20     │
    │ Mary K. rated you 3.5 - Jan 15     │
    │ Bob T. rated you 3.0 - Jan 10      │
    └─────────────────────────────────────┘
```

### Rating Another Player

**UI Flow:**
```
After playing with someone:
    → View their profile
    → Click "Rate Player"
    → Rating form:
        - Select skill level (2.0 - 5.0)
        - Add comments (optional)
    → Click "Submit Rating"
```

---

## 8. For Event Organizers

### Creating an Event

**UI Flow:**
```
Top Navigation → "Events" → Click "Create Event" (or + button)
    → Event Creation wizard:

    Step 1 - Basic Info:
        - Event name
        - Event type dropdown (Tournament/Game Day/League)
        - Date picker
        - Venue search/select
        → Click "Continue"

    Step 2 - Details:
        - Description (rich text editor)
        - Registration dates (open/close)
        - Max participants
        - Entry fee
        → Click "Continue"

    Step 3 - Documents:
        - Upload waiver (optional)
        - Add event rules (optional)
        → Click "Create Event"

    → Event created! → Redirects to Tournament Management
```

### Tournament Management Interface

**UI Flow:**
```
Event Details → Click "Manage Tournament"
    → Tournament Management page:

    ┌────────────────────────────────────────────────────┐
    │ Event Name                           [Draft ▼]     │
    │ Date | Venue                                       │
    ├────────────────────────────────────────────────────┤
    │  📋 Pre-Planning  |  🎮 Game Day Execution         │
    ├────────────────────────────────────────────────────┤
    │ Pre-Planning tabs:                                 │
    │ Event Info | Divisions | Registrations | Courts   │
    │ Staff | Documents | Payments | Planning           │
    └────────────────────────────────────────────────────┘
```

### Setting Up Divisions

**UI Flow:**
```
Pre-Planning → "Divisions" tab
    → Click "Add Division"
    → Division form:
        - Name (e.g., "Open Doubles", "3.5 Mixed")
        - Format: [Singles ▼] [Doubles ▼] [Mixed ▼]
        - Skill range: Min [3.0 ▼] Max [4.0 ▼]
        - Schedule type: [Round Robin ▼] [Single Elim ▼]
        - Games per match: [1 ▼] [Best of 3 ▼]
        - Points per game: [11 ▼] [15 ▼] [21 ▼]
    → Click "Save Division"

    → Division card appears:
    ┌─────────────────────────────────────┐
    │ Open Doubles            [Edit] [⋮] │
    │ Round Robin | Best of 3            │
    │ 0/16 registered                    │
    │ Status: Accepting Registrations    │
    │ [Generate Schedule] (when ready)   │
    └─────────────────────────────────────┘
```

### Managing Registrations

**UI Flow:**
```
Pre-Planning → "Registrations" tab
    → Filter bar:
        Division: [All ▼]  Status: [All ▼]  Fee Type: [All ▼]

    → Registration list:
    ┌─────────────────────────────────────────────────┐
    │ ☑ Team Name              Division    Status    │
    │   Player 1 + Player 2    Open Dbl    ✓ Paid   │
    │   [Edit] [Cancel] [Move Division]              │
    ├─────────────────────────────────────────────────┤
    │ ☑ Team Name              Division    Status    │
    │   Player 3 + Player 4    Open Dbl    ⚠ Unpaid │
    │   [Edit] [Cancel] [Move Division]              │
    └─────────────────────────────────────────────────┘

    → Click "Add Player" to manually add registration
```

### Setting Up Courts

**UI Flow:**
```
Pre-Planning → "Courts" tab
    → Court Groups section:
        → Click "Add Court Group"
        → Enter group name (e.g., "North Courts")
        → Click "Save"

    → Courts section:
        → Click "Add Courts"
        → Enter number of courts to add
        → Select court group (optional)
        → Click "Add"

    → Court list:
    ┌─────────────────────────────────────┐
    │ Court 1  [North Courts]  [Available]│
    │ Court 2  [North Courts]  [Available]│
    │ Court 3  [South Courts]  [Available]│
    │ Court 4  [South Courts]  [Available]│
    └─────────────────────────────────────┘
```

### Pre-Planning Courts & Times

**UI Flow:**
```
Pre-Planning → "Planning" tab
    → Select division/pool:
        Division: [Open Doubles ▼]  Pool: [All ▼]

    → Unscheduled matches:
        ☑ #1 Team A vs Team B
        ☑ #2 Team C vs Team D
        [Select All] [Clear]

    → Time Configuration:
        Start time: [9:00 AM]
        Game duration: [15] minutes
        Wait between: [5] minutes

    → Court Selection:
        ○ Court Group: [North Courts ▼]
        ● Individual Courts: ☑Court 1 ☑Court 2 ☐Court 3

    → Click "Generate Schedule"

    → Timeline Preview:
    ┌─────────────────────────────────────────────┐
    │ Court 1  │▓▓▓▓│    │▓▓▓▓│    │▓▓▓▓│       │
    │ Court 2  │▓▓▓▓│    │▓▓▓▓│    │▓▓▓▓│       │
    │          9:00  9:30  10:00 10:30 11:00     │
    └─────────────────────────────────────────────┘

    → Click "Save Schedule"
```

### Generating Division Schedule

**UI Flow:**
```
Pre-Planning → "Divisions" tab
    → Find division with enough registrations
    → Click "Generate Schedule"
    → Confirmation dialog:
        "Generate Round Robin schedule for 16 teams?"
        "This will create 120 matches across 15 rounds."
    → Click "Generate"
    → Schedule Status changes to "Schedule Ready"
```

### Conducting the Drawing

**UI Flow:**
```
Pre-Planning → "Divisions" tab
    → Click "Drawing" button on division
    → Drawing Modal opens:

    ┌─────────────────────────────────────────────┐
    │ Drawing for Open Doubles                    │
    │ 16 teams will be assigned to 2 pools        │
    ├─────────────────────────────────────────────┤
    │ Pool A                 │ Pool B             │
    │ ─────────────────────  │ ─────────────────  │
    │ 1. [Empty]             │ 1. [Empty]         │
    │ 2. [Empty]             │ 2. [Empty]         │
    │ ...                    │ ...                │
    ├─────────────────────────────────────────────┤
    │ Unassigned Teams:                           │
    │ [Team A] [Team B] [Team C] ...             │
    │                                             │
    │ [Auto-Draw] [Draw One] [Reset] [Save]      │
    └─────────────────────────────────────────────┘

    → Click "Auto-Draw" for random assignment
    → Or drag teams manually into positions
    → Click "Save" to confirm drawing
```

### Game Day: Player Check-in

**UI Flow:**
```
Game Day Execution → "Check-in" tab
    → Division filter: [All ▼]
    → Search: [Player name...]

    → Player list:
    ┌────────────────────────────────────────────────┐
    │ ☐ John Smith        Open Doubles               │
    │   Partner: Jane Doe                            │
    │   Payment: ✓ Paid   Waiver: ✓ Signed          │
    │   [Check In]                                   │
    ├────────────────────────────────────────────────┤
    │ ✓ Bob Johnson       Open Doubles   [Checked In]│
    │   Partner: Mary Williams                       │
    │   Payment: ✓ Paid   Waiver: ✓ Signed          │
    └────────────────────────────────────────────────┘

    → Click "Check In" for each player as they arrive
    → Status updates to "Checked In" ✓
```

### Game Day: Scoring Matches

**UI Flow:**
```
Game Day Execution → "Schedule" tab
    → Find match to score
    → Click [Edit ✏️] button on match row

    → Score Modal opens:
    ┌─────────────────────────────────────────────┐
    │ Match #1: Team A vs Team B                  │
    │ Court: Court 1                              │
    ├─────────────────────────────────────────────┤
    │ Game 1:  Team A [11] - [7] Team B          │
    │ Game 2:  Team A [9] - [11] Team B          │
    │ Game 3:  Team A [__] - [__] Team B         │
    ├─────────────────────────────────────────────┤
    │ Status: [In Progress ▼]                     │
    │ Court: [Court 1 ▼]                         │
    ├─────────────────────────────────────────────┤
    │ [Cancel]              [Save] [Save & Finish]│
    └─────────────────────────────────────────────┘

    → Enter scores for each game
    → Click "Save & Finish" when match complete
```

### Game Day: By Court Management

**UI Flow:**
```
Game Day Execution → "By Court" tab
    → Court cards with matches:

    ┌──────────────────────────────────────┐
    │ 📍 Court 1            [In Use]       │
    │ 3 matches scheduled                  │
    ├──────────────────────────────────────┤
    │ [✏️] 9:00 #1                         │
    │     Team A vs Team B                 │
    │     11-7, 11-9           [Completed] │
    ├──────────────────────────────────────┤
    │ [✏️] 9:30 #5                         │
    │     Team C vs Team D                 │
    │                          [InProgress]│
    ├──────────────────────────────────────┤
    │ [✏️] 10:00 #9                        │
    │     Team E vs Team F                 │
    │                          [Scheduled] │
    └──────────────────────────────────────┘

    → Click [✏️] to edit any match
    → For organizers/staff: Can edit scores, status, court
```

### Adding Event Staff

**UI Flow:**
```
Pre-Planning → "Staff" tab
    → Click "Add Staff"
    → Search for user by name/email
    → Select staff role:
        ☑ Can Record Scores
        ☑ Can Check-In Players
        ☐ Can Manage Courts
        ☐ Can Manage Schedule
        ☐ Can View All Data
    → Click "Add Staff Member"

    → Staff list:
    ┌─────────────────────────────────────────┐
    │ John Smith          Scorer              │
    │ Permissions: Scores, Check-in           │
    │ [Edit Permissions] [Remove]             │
    └─────────────────────────────────────────┘
```

### Tournament Reset (Testing/Dry Runs)

**UI Flow:**
```
Tournament Management → Click "⋮" menu (top right)
    → Click "Reset Tournament"
    → Warning dialog:
        "This will clear all:
         - Drawing results
         - Game scores
         - Court assignments
         - Match statuses

         Schedule structure will be preserved."
    → Type "RESET" to confirm
    → Click "Reset Tournament"
    → Tournament returns to pre-drawing state
```

---

## Quick Reference

### Tournament Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    TOURNAMENT LIFECYCLE                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CREATE EVENT          2. SETUP                          │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │ Event Info   │    →    │ Divisions    │                 │
│  │ Date/Venue   │         │ Courts       │                 │
│  └──────────────┘         │ Documents    │                 │
│                           └──────────────┘                 │
│                                 ↓                          │
│  3. REGISTRATION          4. PREPARATION                    │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │ Open Reg     │    →    │ Close Reg    │                 │
│  │ Collect Fees │         │ Gen Schedule │                 │
│  │ Sign Waivers │         │ Conduct Draw │                 │
│  └──────────────┘         │ Plan Courts  │                 │
│                           └──────────────┘                 │
│                                 ↓                          │
│  5. GAME DAY              6. COMPLETION                     │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │ Check-in     │    →    │ Finals       │                 │
│  │ Pool Play    │         │ Awards       │                 │
│  │ Record Scores│         │ Results      │                 │
│  │ Playoffs     │         └──────────────┘                 │
│  └──────────────┘                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Search | `/` or `Ctrl+K` |
| Refresh | `F5` or `Ctrl+R` |
| Back | `Backspace` or `Alt+←` |

### Status Badges

| Badge | Meaning |
|-------|---------|
| 🟢 Available | Court is free |
| 🟠 In Use | Match in progress |
| 🔵 Scheduled | Upcoming match |
| 🟢 Completed | Match finished |
| ✓ Checked In | Player has arrived |
| ⚠ Unpaid | Payment pending |

---

## Getting Help

**In-App Help:**
```
Any page → Click [?] help icon
    → Context-sensitive help topics
```

**FAQ:**
```
Top Navigation → "FAQ"
    → Searchable FAQ database
```

**Feedback/Support:**
```
Top Navigation → "Feedback"
    → Submit bug reports or suggestions
```

---

*Last updated: January 2026*
