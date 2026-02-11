# 🏓 Pickleball.Community — Analysis & TODO
**Last Updated:** 2026-02-03 | **Maintainer:** Synthia

## Current State
- **Scale:** 88K LOC backend (60+ controllers, 70+ entities, 146 migrations), 104K LOC frontend, 5 SignalR hubs
- **Tournament system:** 80% complete — phases, brackets, pools, templates, court planning, live drawing, score audit
- **Rec Play / Dynamic scheduling:** Broken due to config issue
- **InstaGame:** Parallel pickup game system, disconnected from Events

## Architecture Issues
- [ ] **TournamentController.cs is 10,150 lines** — split into TournamentRegistrationController, TournamentBracketController, TournamentPaymentController + services
- [ ] **Events.jsx is 8,189 lines** — split into EventList, EventCreate, EventDetail, EventEdit sub-pages
- [ ] **api.js is monolithic** — split into modules (eventApi, tournamentApi, gameDayApi, etc.)
- [ ] **7 duplicate event gameday routes** — consolidate (EventManage, GameDayManage, TDGameDayDashboard, TournamentGameDay, EventRunningAdmin, AdminEventManage, PlayerGameDay all overlap)
- [ ] **Three competing game systems** — GameDayController + EventManage + InstaGame need unification into one execution engine

## 🔴 Critical — Rec Play / Dynamic Scheduling

**Root Cause:** Migration 094 sets Rec Play to `ScheduleType = 'Manual Only'`, but `GameDayManage.jsx` line 777 gates Popcorn/Gauntlet behind `scheduleType === 'Dynamic'`. The buttons literally never show.

- [ ] **Fix ScheduleType** — `UPDATE EventTypes SET ScheduleType = 'Dynamic' WHERE Name IN ('Rec Play', 'Mini-Match')` (5 min, unblocks everything)
- [ ] **Court auto-release** — When game status → Finished, set court.Status = "Available" in UpdateGameStatus (30 min)
- [ ] **Fairness algorithm** — Track games-since-last-play per player, prioritize sitters, max consecutive games limit (2 hrs)
- [ ] **Cleanup temp units** — GenerateRound creates `IsTemporary` EventUnits that are never cleaned up
- [ ] **Fix gauntlet stale winners** — Out-of-order game completions cause wrong teams to "stay" on court
- [ ] **Port InstaGame player tracking** — Queue positions, Available/Playing/Resting status, win streaks, per-player stats into GameDayController

### Why Three Systems Exist (Context)
| System | Controller | Frontend | Scheduling |
|--------|-----------|----------|------------|
| GameDayController | `/gameday/*` | `GameDayManage.jsx` (1822 lines) | Popcorn/Gauntlet via `GenerateRound` |
| EventManage | `/gameday/*` (same endpoints) | `EventManage.jsx` (851 lines) | Duplicate UI |
| InstaGame | `/instagame/*` | `InstaGameMain.jsx` (397 lines) | Popcorn/Gauntlet/Manual via `InstaGameService` |

**InstaGameService has the best architecture** (player queue, status tracking, win streaks, per-player stats, score confirmation) but is completely disconnected from Events/Divisions/Check-in.

## 🟠 High — Tournament GameDay Completion

- [ ] **"Go Live" button** — TournamentStatus state machine (Setup → Running → Completed) with clear UI transition
- [ ] **Auto-advance on score submit** — Chain `sp_AdvanceWinner` to score submission in TournamentGameDayController
- [ ] **Phase transition UI** — "Finalize Phase 1 → Start Phase 2" buttons in TD dashboard
- [ ] **Score confirmation** — Port dual-submit flow from GameDayController to TournamentGameDayController
- [ ] **Flesh out thin components:**
  - `TournamentProgressTracker` (198 lines → needs real phase completion bars, call sp_GetEventProgressSummary)
  - `GameDayActivityFeed` (152 lines → shell, needs to call sp_GetGameDayActivityFeed)
  - `CourtUtilizationPanel` (206 lines → needs to call sp_GetCourtUtilizationStats)
- [ ] **Enable notifications** — `GameDayNotifications` runs in `debugMode` only, wire up real push

## 🟡 Medium — Dynamic Phase Scheduling

**Concept: "Live Phases"** — TD dynamically adds phases during event execution instead of pre-planning everything.

```
Rec Play Event (Dynamic):
  Phase 1: Open Play (Popcorn rounds 1-4)     ← TD clicks "Start Phase"
  Phase 2: Skill Split                         ← TD clicks "Split by Skill"  
    Group A: Top 50% → Gauntlet
    Group B: Bottom 50% → Popcorn
  Phase 3: Finals (optional)                   ← TD clicks "Add Bracket"
    Single Elim from top 8
```

- [ ] **New endpoints on GameDayController:**
  - `POST /gameday/events/{id}/start-phase` — Create and activate a dynamic phase
  - `POST /gameday/events/{id}/split-by-skill` — Auto-split players by game results
  - `POST /gameday/events/{id}/create-bracket-from-standings` — Top N → bracket phase
  - `POST /gameday/events/{id}/end-phase` — Finalize phase, calculate standings
- [ ] **Phase Panel UI** — Replace simple Popcorn/Gauntlet buttons with: current phase, round #, player standings, "Generate Next Round" / "End Phase" / "Create Bracket" actions
- [ ] **Merge InstaGame into Events** — "Quick Play" → creates Rec Play event with Dynamic scheduling, 1 division, auto-check-in. Join code = event invite code.

## 🟢 Low — Player Experience & Polish

- [ ] **Rec Play player dashboard** — "Am I next?", queue position, personal stats, "Sit out" button
- [ ] **Live Courts spectator view** — Show all active games on all courts (not just bracket view)
- [ ] **DUPR import/sync** — Field exists (Migration 146) but no API integration for skill-based matchmaking
- [ ] **QR code check-in** — Players scan QR to check in (instead of TD manual entry)
- [ ] **Self-service score entry** — Both teams submit scores, auto-confirm if matching
- [ ] **Waiting list** — Events at capacity → waitlist with auto-promotion
- [ ] **SignalR for rec play** — GameDayController doesn't broadcast via ScoreHub, no real-time updates for rec play

## 💬 Feature Requests (from users)

- [ ] **Click-to-approve payment icon** (Weihe Gong, 2026-02-11) — Make gray $ icon in TournamentManage.jsx (line 6012) clickable to directly approve payment. `handleOverridePayment` exists, just wire the click.

## 🔒 Security

- [ ] **Rotate ftsql password** — old one exposed in git history
- [ ] **Rotate JWT signing keys** — old ones exposed in git history
- [ ] **console.log cleanup** — remove debug logging from production frontend
