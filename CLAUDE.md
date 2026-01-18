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

## Release Notes Checkpoints
Track when release notes were last generated to avoid duplicates.

| Date | Commit | Notes |
|------|--------|-------|
| 2026-01-14 | e2b491f | Initial 24-hour release notes covering: Help Topics system, Social Links, Game Day execution, Admin enhancements, Event management improvements, and numerous bug fixes |
| 2026-01-17 | e3834c5 | 144 commits: Live Drawing system with SignalR, Admin user search & registration, Payment system overhaul (UserPayment), Waiver/Document management (ObjectAssets), Game Day enhancements, Public event view |
