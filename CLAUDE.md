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
