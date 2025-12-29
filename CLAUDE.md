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
- **JWT Tokens**: Tokens are issued by shared auth and validated locally
- **Cross-site tracking**: Same UserId across pickleball.college, pickleball.date, etc.
- **Site-specific roles**: Each site maintains its own Role (Student/Coach/Admin)

### Auth Flow:
1. Frontend calls shared auth API for login/register
2. Shared auth returns JWT token with UserId
3. Frontend calls local `/auth/sync` to create/update local user record
4. Local backend validates token and maintains site-specific data

### Configuration:
- Backend: `appsettings.json` → `SharedAuth:BaseUrl`
- Frontend: `VITE_SHARED_AUTH_URL` environment variable

## Related Repositories
@https://github.com/LegalDragon/Funtime-Shared
@https://github.com/LegalDragon/Casec-project
