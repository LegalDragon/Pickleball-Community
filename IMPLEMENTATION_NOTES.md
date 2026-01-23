# Implementation Notes: Court Pre-Assignment & Staff Registration

## Overview

This document describes the implementation of two major features:
1. **Court Pre-Assignment UI** - Pre-assign courts by group to scheduled matches
2. **Staff Registration** - Allow staff to register through the player registration flow

---

## Part 1: Court Pre-Assignment System

### Existing Entities Used

| Entity | Purpose |
|--------|---------|
| `CourtGroup` | Logical grouping of courts (e.g., "Courts 1-4", "Championship Court") |
| `TournamentCourt` | Individual courts, can belong to a CourtGroup |
| `DivisionCourtAssignment` | Links court groups to divisions/phases with priority |
| `DivisionPhase` | Tournament phases (Pool Play, Semifinals, Finals) |
| `EncounterMatchFormat` | Match types for team scrimmages (Men's, Women's, Mixed) |
| `EventEncounter` | Scheduled matchups - has `TournamentCourtId`, `ScheduledTime`, `EstimatedStartTime` |

### UI Flow Design

The Court Planning page (`/event/:eventId/court-planning`) has 5 tabs:

#### Tab 1: Schedule
- View all matches by division
- Manually assign courts to individual matches
- Bulk assign courts to selected matches
- Auto-assign courts with calculated times
- Clear all assignments

#### Tab 2: Court Groups
- Create/edit/delete court groups
- Assign physical courts to groups
- Set group priority and location description
- View unassigned courts

#### Tab 3: Division Assignment
- For each division, select which court groups to assign
- Save assignments with priority ordering
- Supports time constraints (ValidFromTime, ValidToTime)

#### Tab 4: Timeline View (Gantt-style)
- Horizontal axis: Time (30-minute slots)
- Vertical axis: Courts
- Colored blocks showing scheduled matches
- Visual representation of court utilization
- Filter by division

#### Tab 5: Publish
- Validate schedule for conflicts
- View validation results:
  - Court time overlaps
  - Team time overlaps
  - Unassigned matches
  - Divisions without court groups
- Publish/Unpublish schedule
- Published status indicator

### Data Model Enhancements

**Event.cs** (new fields):
- `SchedulePublishedAt` (DateTime?) - When schedule was published
- `SchedulePublishedByUserId` (int?) - Who published
- `ScheduleValidatedAt` (DateTime?) - Last validation timestamp
- `ScheduleConflictCount` (int?) - Number of conflicts

**EventDivision.cs** (existing fields confirmed):
- `SchedulePublishedAt` (DateTime?) - When division schedule was published
- `SchedulePublishedByUserId` (int?) - Who published

**DivisionCourtAssignment.cs** (new fields):
- `AssignmentMode` (string) - "Default", "Pool", "MatchType"
- `PoolName` (string?) - For pool-based assignment
- `MatchFormatId` (int?) - For match-type-based assignment (FK to EncounterMatchFormat)

**EventEncounter.cs** (new fields):
- `EstimatedDurationMinutes` (int?) - Duration for this encounter
- `EstimatedEndTime` (DateTime?) - Calculated end time

**EventStaff.cs** (new fields):
- `PreferredRoles` (string?) - JSON array of preferred role IDs
- `ContactPhone` (string?) - Contact phone number

### Backend Endpoints

**TournamentController.cs** - Court Planning Endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/tournament/court-planning/{eventId}` | GET | Get complete planning data |
| `/tournament/court-planning/bulk-assign` | POST | Bulk update court/time assignments |
| `/tournament/court-planning/division-courts` | POST | Assign court groups to division |
| `/tournament/court-planning/division-assignment` | POST | Add/update a court group assignment |
| `/tournament/court-planning/division-assignment/{id}` | DELETE | Delete an assignment |
| `/tournament/court-planning/auto-assign/{divisionId}` | POST | Auto-assign with time calculation |
| `/tournament/court-planning/clear/{divisionId}` | POST | Clear all assignments |
| `/tournament/court-planning/validate/{eventId}` | GET | Validate schedule for conflicts |
| `/tournament/court-planning/publish/{eventId}` | POST | Publish schedule |
| `/tournament/court-planning/unpublish/{eventId}` | POST | Unpublish schedule |
| `/tournament/court-planning/timeline/{eventId}` | GET | Get timeline visualization data |

### Frontend Components

**CourtPlanning.jsx** - Enhanced with 5 tabs:
- `CourtGroupsTab` - Court group management
- `DivisionAssignmentTab` - Division to court group assignment
- `ScheduleTab` - Match-level court assignment
- `TimelineTab` - Gantt-style timeline visualization
- `PublishTab` - Schedule validation and publishing

**api.js** - New tournamentApi methods:
- `validateSchedule(eventId)`
- `publishSchedule(eventId, validateFirst)`
- `unpublishSchedule(eventId)`
- `getTimelineData(eventId)`
- `addDivisionCourtAssignment(data)`
- `deleteDivisionCourtAssignment(assignmentId)`

---

## Part 2: Staff Registration

### Existing Entities Used

| Entity | Purpose |
|--------|---------|
| `EventStaff` | Staff assignment - UserId, RoleId, Status (Pending/Approved/Active) |
| `EventStaffRole` | Role definition with permissions (CanRecordScores, etc.) |

### UI Flow Design

#### Registration Flow Changes

**Step 1: Registration Type Selection** (NEW)
- User chooses between "Player" or "Staff/Volunteer"
- Visual cards with icons for clear distinction

**For Staff Registration:**
1. Select "Staff/Volunteer" at step 1
2. View simplified staff registration form
3. Optionally select preferred role
4. Optionally provide contact phone
5. Optionally add notes/availability info
6. Submit - creates pending registration
7. Confirmation: "Your staff registration is pending admin approval"

**Key Benefits:**
- No waiver required
- No payment required
- Quick registration process
- Admin approval workflow

#### Admin Staff Management

**EventStaffController.cs** - New Endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/eventstaff/event/{eventId}/pending` | GET | Get pending staff registrations |
| `/eventstaff/event/{eventId}/staff/{id}/approve` | POST | Approve with role assignment |
| `/eventstaff/event/{eventId}/staff/{id}/decline` | POST | Decline with reason |
| `/eventstaff/event/{eventId}/available-roles` | GET | Get roles available for self-registration |

### Frontend Components

**EventRegistration.jsx** - Enhanced with:
- Registration type selection (Player/Staff)
- Staff registration form with:
  - Role dropdown (loads available roles)
  - Contact phone input
  - Notes/availability textarea
  - Submit button with loading state

**api.js** - New eventStaffApi methods:
- `getAvailableRoles(eventId)`
- `getPendingStaff(eventId)`
- `approveStaff(eventId, staffId, data)`
- `declineStaff(eventId, staffId, reason)`

---

## Files Modified/Created

### Backend

**New/Modified Entity Files:**
- `Event.cs` - Added schedule publish and validation fields
- `EventEncounter.cs` - Added EstimatedDurationMinutes, EstimatedEndTime
- `DivisionCourtAssignment.cs` - Added AssignmentMode, PoolName, MatchFormatId
- `EventStaff.cs` - Added PreferredRoles, ContactPhone

**New/Modified Controllers:**
- `TournamentController.cs` - Added validation, publish, timeline endpoints
- `EventStaffController.cs` - Added pending, approve, decline, available-roles endpoints

**New/Modified DTOs (TournamentDTOs.cs):**
- `CourtPlanningDto` - Added SchedulePublishedAt, ScheduleConflictCount, ScheduleValidatedAt
- `DivisionPlanningDto` - Added MatchesPerEncounter, SchedulePublishedAt, Phases
- `DivisionPhasePlanningDto` - New DTO for phase planning info
- `DivisionCourtGroupAssignmentDto` - Added AssignmentMode, PoolName, MatchFormatId
- `EncounterPlanningDto` - Added PhaseId, PhaseName, EstimatedEndTime, EstimatedDurationMinutes
- `SchedulePublishRequest` - New DTO
- `ScheduleValidationResult` - New DTO for validation results
- `ScheduleConflictDto` - New DTO for conflict details
- `TimelineDataDto` - New DTO for timeline visualization
- `TimelineCourtDto`, `TimelineBlockDto`, `TimelineDivisionDto` - Timeline components
- `DivisionCourtAssignmentRequest` - New DTO for assignment operations

**New/Modified DTOs (EventDTOs.cs):**
- `EventStaffDto` - Added PreferredRoles, ContactPhone
- `CreateEventStaffSelfRegistrationDto` - Added PreferredRoles, ContactPhone
- `ApproveStaffRequest` - New DTO
- `DeclineStaffRequest` - New DTO

**Migration:**
- `Migration_122_CourtSchedulingEnhancements.sql` - All database schema changes

### Frontend

**Modified Files:**
- `CourtPlanning.jsx` - Added PublishTab component, validation/publish handlers
- `EventRegistration.jsx` - Added registration type selection and staff registration form
- `api.js` - Added new tournament and staff API methods

---

## Summary of Changes

### Court Planning Feature
1. **Schedule Validation** - Detect court overlaps and team time conflicts
2. **Schedule Publishing** - Control when players can see the schedule
3. **Timeline Visualization** - Gantt-style view of court utilization
4. **Assignment Modes** - Support for pool-based and match-type-based court assignment
5. **Enhanced DTOs** - Rich data for phase-aware court planning

### Staff Registration Feature
1. **Registration Type Selection** - Players can choose to register as staff
2. **Simplified Staff Flow** - No waiver or payment required
3. **Admin Approval** - Staff registrations require organizer approval
4. **Role Selection** - Staff can indicate preferred roles
5. **Contact Info** - Optional phone number for coordination

---

## Usage Guide

### Court Planning

1. **Create Court Groups**: Go to Court Groups tab, create groups like "Courts 1-4"
2. **Assign Courts to Groups**: Use dropdown on unassigned courts
3. **Assign Groups to Divisions**: Go to Division Assignment tab, check groups for each division
4. **Auto-Assign Schedule**: Go to Schedule tab, select division, click "Auto-Assign Courts"
5. **Review Timeline**: Check Timeline tab for visual overview
6. **Validate**: Go to Publish tab, click "Validate Schedule"
7. **Publish**: If valid, click "Publish Schedule"

### Staff Registration

1. **As a User**: Go to event registration, select "Staff/Volunteer"
2. **Fill Form**: Optionally select role, add contact info and notes
3. **Submit**: Click "Submit Staff Registration"
4. **As Admin**: Go to TournamentManage → Staff tab
5. **Review Pending**: See pending registrations
6. **Approve/Decline**: Assign role and approve, or decline with reason
