# Pickleball Community

## Overview
Full-stack web application for the pickleball community. Users can connect with friends, join clubs, and get player skill certifications through peer reviews.

## Tech Stack
- **Backend**: ASP.NET Core 8, Entity Framework Core, SQL Server
- **Frontend**: React 18, Vite, TailwindCSS, PWA (VitePWA)

## Directory Structure
- `/Backend/API` - ASP.NET Core Web API
- `/Backend/API/Scripts` - Database migration scripts
- `/Frontend` - React SPA
- `/Deployment` - Deployment scripts

## Database Migrations
Store all database migration scripts in `/Backend/API/Scripts/` with naming convention:
- `Migration_XXX_FeatureName.sql` (e.g., `Migration_014_SkillGroups.sql`)
- Scripts should be idempotent (safe to run multiple times)
- Include `IF NOT EXISTS` checks for tables and columns
- Use `PRINT` statements for progress logging

## Database Best Practices
- **Prefer stored procedures** over complex inline EF Core queries whenever possible
- Stored procedures avoid EF Core query generation issues (e.g., SQL syntax errors with CTEs, `Contains()` on lists)
- Stored procedures provide better performance for complex operations
- Create stored procedures in migration scripts with `CREATE OR ALTER PROCEDURE`
- Call stored procedures from C# using `_context.Database.ExecuteSqlRawAsync()` or `FromSqlRaw()`
- Use stored procedures especially for:
  - Bulk operations (merge, delete multiple records)
  - Complex joins or subqueries
  - Operations with multiple steps that should be atomic
  - Queries with dynamic filtering on lists of IDs

## Commands
- Backend: `dotnet run` in `/Backend/API`
- Frontend: `npm run dev` in `/Frontend`
- Build Frontend: `npm run build` in `/Frontend`

## Deployment
- **Production URL**: https://pickleball.community
- **Backend**: Deployed as IIS virtual application at `/api` path
  - Controllers use `[Route("[controller]")]` without `/api` prefix
  - IIS virtual application provides the `/api` prefix automatically
  - Frontend calls `/api/agegroups` → IIS routes to virtual app → controller handles `/agegroups`
- **Frontend**: Static files served from IIS root

## Mobile-First PWA Design
This app is designed to be installed as a Progressive Web App (PWA) on mobile devices:

### Design Requirements:
- **Mobile-first**: Design for mobile screens first, then scale up to desktop
- **Touch-friendly**: Large tap targets (min 44x44px), proper spacing between interactive elements
- **Responsive**: Use TailwindCSS responsive classes (`sm:`, `md:`, `lg:`) appropriately
- **Fast loading**: Minimize bundle size, lazy load where possible
- **Offline-capable**: Service worker handles caching (configured in VitePWA)

### UI Guidelines:
- Bottom navigation for primary actions on mobile
- Swipe gestures where appropriate
- Pull-to-refresh patterns
- Native-like transitions and animations
- Avoid hover-only interactions (touch devices don't have hover)
- Use `min-h-screen` and proper viewport handling

### PWA Configuration:
- Manifest configured in `vite.config.js` (VitePWA plugin)
- Icons: `/public/icon-192.png` and `/public/icon-512.png`
- Theme color: `#3b82f6` (blue)
- Display mode: `standalone` (appears like native app)

## Key Features
- **Player Certification**: Peer-reviewed skill ratings with weighted skill groups
- **User Profiles**: Detailed pickleball player profiles with equipment, experience, and play style
- **Rating & Tagging**: General purpose rating and tagging system (BlogPost, Club, Court, Event, Player, Coach)
- **Blog System**: Community blog with categories, posts, comments, and ratings
- **Community Features** (planned): Friends, clubs, events, messaging

## Encounter-Match-Game Data Structure (Critical)
The tournament/event system uses a three-tier hierarchy to support both simple tournaments and complex team league formats.

### Hierarchy
```
EventEncounter (top level - scheduled matchup between two units/teams)
  └── EncounterMatch[] (individual matches within the encounter)
        └── EventGame[] (games within each match, e.g., best-of-3)
```

### Entity Details
- **EventEncounter**: A scheduled matchup between Unit1 and Unit2. Contains round info, scheduling, and overall winner.
- **EncounterMatch**: An individual match within an encounter. For simple divisions (`MatchesPerEncounter=1`), there's one match per encounter. For team scrimmages, multiple matches (e.g., Men's Doubles, Women's Doubles, Mixed).
- **EncounterMatchFormat**: Division-level template defining match types (name, gender requirements, best-of settings).
- **EventGame**: An individual game within a match. Tracks scores, court assignments, and game status.

### Use Cases
1. **Simple Tournament** (typical doubles/singles): `MatchesPerEncounter=1`, one EncounterMatch per encounter, 1-3 games per match.
2. **Team Scrimmage/League**: `MatchesPerEncounter=3+`, multiple EncounterMatchFormats define the structure (e.g., Match 1: Men's Doubles, Match 2: Women's Doubles, Match 3: Mixed).

### Navigation Patterns
```csharp
// Get all games from an encounter
var allGames = encounter.Matches.SelectMany(m => m.Games);

// Navigate from game to encounter
var encounter = game.EncounterMatch?.Encounter;
var encounterId = game.EncounterMatch!.EncounterId;

// EF Core Include pattern
.Include(g => g.EncounterMatch)
    .ThenInclude(m => m!.Encounter)
        .ThenInclude(e => e!.Unit1)
```

### Key Entities (in `/Backend/API/Models/Entities/`)
| Entity | DB Table | Purpose |
|--------|----------|---------|
| `EventEncounter.cs` | `EventEncounters` | Scheduled matchup between two units |
| `EncounterMatch.cs` | `EncounterMatches` | Individual match within an encounter |
| `EncounterMatchFormat.cs` | `EncounterMatchFormats` | Division-level template for match types |
| `EventGame.cs` | `EventGames` | Individual game within a match |
| `EncounterMatchPlayer.cs` | `EncounterMatchPlayers` | Player assignments to matches |

Note: C# code may use `_context.EventMatches` which is a backward-compatible alias for `EventEncounters`.

### Migration History (Important)
- **Migration 041**: Created original `EventMatches` table
- **Migration 105**: Created parallel NEW structure (`EventEncounters`, `EncounterMatches`, `EncounterMatchGames`)
- **Migration 106**: RENAMED `EventMatches` → `EventEncounters`, reused `EventGames` with new `EncounterMatchId` FK

**ORPHANED TABLE**: `EncounterMatchGames` was created by Migration 105 but is NOT USED. The application uses `EventGames` instead (via `EncounterMatchId` FK). This table can be safely dropped.

### SQL Migration Notes
- Migrations 041-105 reference `EventMatches` (old table name)
- Migrations 106+ must reference `EventEncounters` (renamed table)

## Phase-Based Tournament Scheduling (Migration 114+)

Multi-phase tournament support allowing divisions to have multiple phases (Pool Play, Semifinals, Finals) with placeholder-based scheduling, bracket progression tracking, and court group assignments.

### Architecture Overview

```
EventDivision
  └── DivisionPhase[] (Pool Play, Semifinals, Finals, etc.)
        ├── PhaseSlot[] (placeholder slots for units entering/advancing)
        ├── PhasePool[] (multiple pools within a phase)
        │     └── PhasePoolSlot[] (assigns slots to specific pools)
        ├── PhaseAdvancementRule[] (maps finishing positions to next phase slots)
        └── EventEncounter[] (scheduled matches with bracket progression)
              ├── WinnerNextEncounter (bracket link for winner)
              └── LoserNextEncounter (bracket link for loser - double elim)

CourtGroup[] (logical groupings of nearby courts)
  └── TournamentCourt[] (individual courts assigned to group)

DivisionCourtAssignment[] (assigns court groups to divisions/phases)
DivisionAward[] (defines placement awards: 1st, 2nd, 3rd, etc.)
```

### Key Concepts

**Placeholder-Based Scheduling**: Schedules are built using PhaseSlots as placeholders before the drawing. Each slot has a `SourceType`:
- `Seeded` - Filled during initial drawing
- `WinnerOf` - Winner of a specific encounter
- `LoserOf` - Loser of a specific encounter (double elimination)
- `RankFromPhase` - Based on standings from previous phase/pool
- `Manual` - Manually assigned by TD
- `Bye` - Slot receives a bye

**Bracket Progression**: EventEncounters track where winners/losers advance:
- `WinnerNextEncounterId` - The encounter the winner advances to
- `LoserNextEncounterId` - The encounter the loser advances to (double elim, consolation)
- `WinnerSlotPosition` / `LoserSlotPosition` - Which position (1 or 2) in the next encounter
- `EncounterLabel` - Display label like "Winner of Match 3" vs "Winner of Match 5"

**Pool Play**: Phases can have multiple pools running in parallel:
- `PhasePool` - Represents a pool (Pool A, Pool B, etc.)
- `PhasePoolSlot` - Links phase slots to specific pools
- Standings calculated per pool, then advancement rules determine which pool positions advance

### New/Modified Entities

| Entity | DB Table | Purpose |
|--------|----------|---------|
| `DivisionPhase.cs` | `DivisionPhases` | Tournament phase configuration (added: `PoolCount`, timing fields) |
| `PhaseSlot.cs` | `PhaseSlots` | Placeholder slots for unit assignment |
| `PhasePool.cs` | `PhasePools` | Pool within a phase |
| `PhasePoolSlot.cs` | `PhasePoolSlots` | Links slots to pools |
| `PhaseAdvancementRule.cs` | `PhaseAdvancementRules` | Defines how units advance between phases |
| `DivisionAward.cs` | `DivisionAwards` | Placement awards (Gold, Silver, Bronze, etc.) |
| `CourtGroup.cs` | `CourtGroups` | Logical grouping of nearby courts |
| `DivisionCourtAssignment.cs` | `DivisionCourtAssignments` | Assigns court groups to divisions/phases |
| `EventEncounter.cs` | `EventEncounters` | Added bracket progression fields |
| `TournamentCourt.cs` | `TournamentCourts` | Added `CourtGroupId` |

### EventEncounter Bracket Fields (Added in Migration 114)

```csharp
// Bracket progression
public int? WinnerNextEncounterId { get; set; }
public int? LoserNextEncounterId { get; set; }
public int? WinnerSlotPosition { get; set; }  // 1 = Unit1, 2 = Unit2
public int? LoserSlotPosition { get; set; }

// Pool reference
public int? PoolId { get; set; }

// Display
public string? EncounterLabel { get; set; }  // "Match 5", "Semifinal 1"
public DateTime? EstimatedStartTime { get; set; }

// Navigation
public EventEncounter? WinnerNextEncounter { get; set; }
public EventEncounter? LoserNextEncounter { get; set; }
public PhasePool? Pool { get; set; }
public ICollection<EventEncounter> WinnerSourceEncounters { get; set; }
public ICollection<EventEncounter> LoserSourceEncounters { get; set; }
```

### API Endpoints

**DivisionPhasesController** (`/divisionphases`):
- `GET /division/{divisionId}` - Get all phases for a division
- `GET /{id}` - Get phase with slots and pools
- `POST` - Create phase
- `PUT /{id}` - Update phase
- `DELETE /{id}` - Delete phase
- `POST /{id}/generate-schedule` - Generate schedule (RoundRobin, SingleElim, DoubleElim)
- `GET /{id}/schedule` - Get encounters for phase
- `POST /{id}/pools` - Create pools for phase
- `POST /{id}/advancement-rules` - Set advancement rules
- `POST /{id}/assign-courts` - Assign court group to phase
- `POST /{id}/auto-assign-courts` - Auto-assign available courts
- `POST /{id}/calculate-times` - Calculate estimated start times

**CourtGroupsController** (`/courtgroups`):
- `GET /event/{eventId}` - Get all court groups for event
- `GET /{id}` - Get court group details
- `POST` - Create court group
- `PUT /{id}` - Update court group
- `DELETE /{id}` - Delete court group
- `POST /{id}/courts` - Assign courts to group
- `POST /event/{eventId}/auto-create` - Auto-create groups by size

### Stored Procedures (Migration 115)

- `sp_AdvanceWinner` - Move winner to next encounter after match completion
- `sp_AdvanceLoser` - Move loser to next encounter (double elimination)
- `sp_ResolvePhaseSlots` - Apply advancement rules to resolve slots
- `sp_CalculateEncounterTimes` - Calculate estimated start times based on court availability
- `sp_GetPhaseStandings` - Get standings for a phase/pool

### Frontend Components

**PhaseManager.jsx** (`/Frontend/src/components/tournament/PhaseManager.jsx`):
- Phase CRUD interface for tournament directors
- Phase type selection (RoundRobin, SingleElimination, DoubleElimination, Swiss, Pools)
- Pool configuration (count, size)
- Slot count configuration (incoming, advancing)
- Schedule generation trigger

**SchedulePreview.jsx** (`/Frontend/src/components/tournament/SchedulePreview.jsx`):
- Displays phase schedules with filtering
- Pool/round/status filters
- List view and Bracket view modes
- Shows placeholder labels before drawing, real units after
- Court and estimated time display

### Schedule Generation Logic

**Round Robin** (circle method):
- For N units, generates N-1 rounds with N/2 matches per round
- Handles odd numbers with byes
- Creates pool-specific schedules when pools > 1

**Single Elimination**:
- Generates bracket encounters with `WinnerNextEncounter` links
- Seeds arranged for 1v8, 4v5, 2v7, 3v6 style matchups
- Labels: "Semifinal 1", "Final", etc.

**Double Elimination**:
- Winner's bracket with `WinnerNextEncounter` links
- Loser's bracket with `LoserNextEncounter` links
- Championship match (winner's bracket champion vs loser's bracket champion)
- Grand final if loser's bracket winner beats winner's bracket champion

### Migration Files

- **Migration_113_DivisionPhases.sql** - Base DivisionPhases and PhaseSlots tables
- **Migration_114_PhaseScheduling.sql** - Bracket progression, pools, court groups, awards
- **Migration_115_PhaseSchedulingProcs.sql** - Stored procedures for advancement and calculations

### Usage Flow

1. **Configure Division**: Set division settings, match formats
2. **Create Phases**: Add phases (Pool Play → Semifinals → Finals)
3. **Configure Pools**: If pool play, create multiple pools
4. **Set Advancement Rules**: Define how units advance between phases
5. **Generate Schedules**: Create placeholder-based schedules for each phase
6. **Assign Courts**: Assign court groups to phases/divisions
7. **Calculate Times**: Generate estimated start times
8. **Preview**: View complete schedule with placeholders
9. **Drawing**: Fill phase 1 slots with actual units
10. **Execute**: As matches complete, winners/losers advance automatically

## Shared Authentication (Funtime-Shared)
This project uses shared authentication from the Funtime-Shared repository:
- **UserId**: All Users.Id values come from the shared auth service (no local IDENTITY)
- **JWT Tokens**: Tokens are issued by shared auth and validated locally with `sites[]` claim
- **Cross-site tracking**: Same UserId across pickleball.college, pickleball.date, pickleball.community, pickleball.jobs, pickleball.casino
- **Site-specific roles**: Each site maintains its own Role (User/Admin)

### Auth Flow:
1. Frontend calls shared auth API for login/register
2. Shared auth returns JWT token with UserId and site claims
3. Frontend calls local `/auth/sync` to create/update local user record
4. Local backend validates token and maintains site-specific data

### Configuration:
- Backend: `appsettings.json` → `SharedAuth:BaseUrl`
- Frontend: `VITE_SHARED_AUTH_URL` environment variable

### Funtime-Shared Integration
Reference: https://github.com/LegalDragon/Funtime-Shared (branch: `claude/debug-prompt-length-yPtFk`)

#### Architecture Components:
- **Backend**: .NET 8 API - centralized authentication, user profiles, site memberships, Stripe payments
- **Frontend**: `@funtime/ui` npm package - API clients, auth hooks, pre-built UI components
- **Database**: MS SQL Server (FuntimeIdentity) - auth, profiles, memberships, payments

#### Authentication Methods:
- Email/password credentials
- Phone-based OTP via Twilio
- Account linking across auth types
- OAuth providers

#### Frontend Integration Steps:
1. Set environment variables for Identity API URL and site key
2. Create init file calling `initFuntimeClient()` with token retrieval and unauthorized handlers
3. Import shared styles and initialize before app renders
4. Use hooks: `useAuth()`, `useSites()`, `usePayments()`
5. Use components: Button, Input, AuthForm, Avatar, SkillBadge, SiteBadge

#### API Endpoints (AuthController):
- Registration and login (public)
- OTP request and verification
- Account linking
- User info retrieval
- Token validation
- All authenticated endpoints require JWT bearer token

#### Security Requirements:
- HTTPS required in production
- JWT signing key minimum 32 characters
- BCrypt password hashing
- Rate limiting: 5 OTP attempts per 15 minutes (configurable)

## Related Repositories
@https://github.com/LegalDragon/Funtime-Shared
@https://github.com/LegalDragon/Casec-project

## Shared Services and Base Classes

### EventControllerBase (`/Backend/API/Controllers/Base/EventControllerBase.cs`)
Abstract base controller providing standardized authorization methods for event-related operations:

```csharp
protected int? GetUserId()                                    // Extract user ID from JWT claims
protected async Task<bool> IsAdminAsync()                     // Check if current user is admin
protected async Task<bool> IsEventOrganizerAsync(int eventId, int userId)  // Check organizer status
protected async Task<bool> CanManageEventAsync(int eventId)   // Combined admin/organizer check
protected async Task<bool> HasStaffPermissionAsync(int eventId, int userId, string permission)
```

**Staff Permissions**: `CanRecordScores`, `CanManageCheckIn`, `CanManageCourts`, `CanManageSchedule`, `CanViewAllData`

**Usage**: New controllers should inherit from `EventControllerBase` instead of duplicating these methods.

### ICourtAssignmentService (`/Backend/API/Services/CourtAssignmentService.cs`)
Centralized service for court assignment operations, used by both `TournamentController` and `DivisionPhasesController`:

```csharp
// Auto-assign courts to encounters
Task<CourtAssignmentResult> AutoAssignDivisionAsync(int divisionId, CourtAssignmentOptions options);
Task<CourtAssignmentResult> AutoAssignPhaseAsync(int phaseId);

// Calculate estimated start times
Task<TimeCalculationResult> CalculatePhaseTimesAsync(int phaseId);

// Clear assignments
Task<int> ClearDivisionAssignmentsAsync(int divisionId);

// Get available courts from court group assignments
Task<List<TournamentCourt>> GetAvailableCourtsForDivisionAsync(int divisionId, int? phaseId = null);
```

**Registration**: Service is registered in `Program.cs` as scoped.

## Court Planning Feature

### Overview
Dedicated court pre-planning page for tournament directors to:
1. Create and manage court groups (e.g., "Courts 1-4", "North Side")
2. Assign court groups to divisions
3. Bulk assign courts to encounters with estimated times
4. View schedule in timeline format

### Components

**Frontend**: `/Frontend/src/pages/CourtPlanning.jsx`
- Route: `/event/:eventId/court-planning`
- 4 tabs: Court Groups, Division Assignment, Schedule, Timeline
- Access: Organizers only (link in TournamentManage.jsx header)

**Backend Endpoints** (in `TournamentController`):
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/tournament/court-planning/{eventId}` | GET | Get complete planning data |
| `/tournament/court-planning/bulk-assign` | POST | Bulk update court/time assignments |
| `/tournament/court-planning/division-courts` | POST | Assign court groups to division |
| `/tournament/court-planning/auto-assign/{divisionId}` | POST | Auto-assign with time calculation |
| `/tournament/court-planning/clear/{divisionId}` | POST | Clear all assignments |

### DTOs (in `TournamentDTOs.cs`)
- `CourtPlanningDto` - Complete planning data response
- `CourtGroupPlanningDto`, `CourtPlanningItemDto` - Court group data
- `DivisionPlanningDto`, `DivisionCourtGroupAssignmentDto` - Division data
- `EncounterPlanningDto` - Encounter data for planning view
- `BulkCourtTimeAssignmentRequest`, `CourtTimeAssignment` - Bulk assignment requests
- `DivisionCourtGroupsRequest`, `AutoAssignRequest` - Division assignment requests

## Score Audit Trail

### Overview
Track all score changes with user, timestamp, and reason for TD/admin/scorekeeper visibility.

### Components

**Backend**:
- `EventGameScoreHistory` entity (existing, Migration 077)
- `GameDayController.UpdateScore` - Logs changes to history
- `EventRunningController.GetGameScoreHistory` - Get history for a game
- `EventRunningController.GetEncounterScoreHistory` - Get history for all games in encounter

**Frontend**:
- `GameScoreModal.jsx` - Expandable score history section
- Props: `showScoreHistory={true}`, `eventId` required for history feature

**Authorization**: Admin, Organizer, or Staff with `CanRecordScores` permission can view history.

## Code Standardization Notes

### DbSet Naming Convention
- **Use `_context.EventEncounters`** (not `_context.EventMatches`)
- `EventMatches` is a backward-compatible alias but new code should use `EventEncounters`
- All controllers have been updated to use `EventEncounters` as of 2026-01-22

### Authorization Pattern
Instead of duplicating organizer checks inline:
```csharp
// OLD (avoid in new code)
var isOrganizer = evt.OrganizedByUserId == userId.Value;
var isAdmin = await IsAdminAsync();
if (!isOrganizer && !isAdmin) return Forbid();

// NEW (preferred)
if (!await CanManageEventAsync(eventId)) return Forbid();
// Or use IsEventOrganizerAsync from base class
```

### Controllers Inheriting EventControllerBase
All event-related controllers now inherit from `EventControllerBase` to use standardized auth methods:

| Controller | Notes |
|------------|-------|
| `TournamentController` | Main tournament management |
| `EventRunningController` | Running event management (TD & Player) |
| `GameDayController` | Casual game day events |
| `EventStaffController` | Staff roles and assignments |
| `CheckInController` | Player check-in and waivers |
| `EventsController` | Event CRUD and registration |
| `CourtGroupsController` | Court group management |

**Not using EventControllerBase** (by design):
- `DivisionPhasesController` - Uses attribute-based auth `[Authorize(Roles = "Admin,Organizer")]`

## Staff Dashboard

### Overview
Role-specific dashboards for event staff based on their permissions.

### Route
`/event/:eventId/staff-dashboard`

### Backend Endpoint
`GET /eventstaff/event/{eventId}/dashboard` - Returns role-specific data based on user permissions

### Staff Permissions (from EventStaffRole)
- `CanRecordScores` - Access scoring section
- `CanCheckInPlayers` - Access check-in section
- `CanManageCourts` - Access court status section
- `CanManageSchedule` - Access schedule section
- `CanManageLineups` - Manage team lineups
- `CanViewAllData` - Access all sections
- `CanFullyManageEvent` - Full event admin access

### DTOs
- `StaffDashboardDto` - Main dashboard response
- `StaffPermissionsDto` - Permission flags
- `EncounterSummaryDto` - Match summary for scoring/schedule
- `CheckInItemDto` - Player check-in item
- `CheckInStatsDto` - Check-in statistics
- `CourtStatusDto` - Court status with active matches
- `DivisionScheduleStatsDto` - Division progress tracking

## Release Notes Checkpoints
Track when release notes were last generated to avoid duplicates.

| Date | Commit | Notes |
|------|--------|-------|
| 2026-01-14 | e2b491f | Initial 24-hour release notes covering: Help Topics system, Social Links, Game Day execution, Admin enhancements, Event management improvements, and numerous bug fixes |
| 2026-01-17 | e3834c5 | 144 commits: Live Drawing system with SignalR, Admin user search & registration, Payment system overhaul (UserPayment), Waiver/Document management (ObjectAssets), Game Day enhancements, Public event view |
| 2026-01-22 | 3fc7176 | Court Planning page, Score audit trail, Code consolidation (EventControllerBase, ICourtAssignmentService), EventMatches→EventEncounters standardization |
