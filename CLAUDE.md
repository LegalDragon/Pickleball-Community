# Pickleball College

## Overview
Full-stack web application for pickleball training, coaching, and player certification.

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

## Commands
- Backend: `dotnet run` in `/Backend/API`
- Frontend: `npm run dev` in `/Frontend`
- Build Frontend: `npm run build` in `/Frontend`

## Key Features
- Coach training materials (Video, Audio, Document, Image, Link)
- Player certification with weighted skill groups
- Course management
- Marketplace for materials
- Rating and tagging system

## Shared Authentication (Funtime-Shared)
This project uses shared authentication from the Funtime-Shared repository:
- **UserId**: All Users.Id values come from the shared auth service (no local IDENTITY)
- **JWT Tokens**: Tokens are issued by shared auth and validated locally with `sites[]` claim
- **Cross-site tracking**: Same UserId across pickleball.college, pickleball.date, pickleball.community, pickleball.jobs, pickleball.casino
- **Site-specific roles**: Each site maintains its own Role (Student/Coach/Admin)

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

#### Payment Processing:
- Stripe integration via `PaymentModal` component
- Supports saved payment methods and new card entry
- Shared API handles payment intents, subscriptions, webhooks

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
