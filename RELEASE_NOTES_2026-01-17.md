# Release Notes - January 17, 2026

**Coverage**: January 14-17, 2026 (144 commits)
**Previous Checkpoint**: e2b491f | **Current**: e3834c5

---

## Major Features

### Live Drawing System
Real-time tournament bracket drawing with SignalR integration:
- **Drawing Monitor Page**: New `/drawing/:eventId` page for live bracket drawing display
- **Drawing Status**: Added "Drawing" as a valid tournament status with dropdown option
- **Real-time Updates**: SignalR hub broadcasts drawing state changes to all connected clients
- **Admin Controls**: "Live Drawing" and "Manage Drawing" buttons for admins/organizers on event pages
- **Redesigned UI**: Complete layout overhaul of DrawingMonitor with improved usability

### Admin User Search & Registration
Powerful admin tools for managing event registrations:
- **User Search**: Admins can search for any user in the system
- **Add Registrations**: Admins can add registrations to events on behalf of users
- **Credential Management**: Admins can edit user credentials (email/password) via Funtime-Shared integration
- **Public Profile Enhancement**: Admin edit credentials button added to PublicProfileModal
- **SystemRole Extraction**: Proper JWT claim extraction for admin feature visibility

### Payment System Overhaul
Complete restructuring of payment tracking:
- **UserPayment Table**: Renamed from EventPayment to support generic payment tracking
- **Payment History**: New player dashboard section showing all payment history across events
- **Team Payments**: "Apply to Teammates" feature for applying payments to team members
- **Payment Verification Tab**: New tab for event organizers to verify payments
- **Redesigned Payments Tab**: Flat list layout with improved verification workflow
- **One Transaction Per Record**: Refactored to store one UserPayment per transaction for better tracking

### Waiver & Document Management System
Comprehensive digital document handling:
- **ObjectAssets System**: Generalized asset management for all object types (Event, Club, Court, etc.)
- **Digital Waiver Signing**: Drawn signature capture with signature_pad library
- **PDF Generation**: Signed waivers generate PDFs with Self/Guardian selection and Reference ID
- **Document Types**: Support for .md, .html, .htm file uploads with proper rendering
- **Server-side Fetching**: Waiver content fetched server-side to avoid CORS issues
- **Asset Type Management**: Admin UI for managing Object Asset Types
- **Sort Order**: Editable sort order for event documents

### Game Day Enhancements
Tournament execution improvements:
- **Pool Standings Management**: Full CRUD for pool standings with playoff advancement
- **Check-in System**: New endpoints and UI for player check-in at events
- **TD Dashboard**: Cleaned up Tournament Director dashboard
- **Player Dashboard**: Cleaned up player game day experience
- **Court Color-Coding**: Visual court assignments with color indicators
- **Pre-Queue Functionality**: Queue players before matches start
- **Gameday Buttons**: Added dashboard buttons to event detail view

---

## Event Management

### Public Event View
- **Unauthenticated Access**: New public event view page accessible without login
- **HTML-Aware Descriptions**: Event descriptions properly render HTML content
- **Consolidated Display**: Divisions and players shown in unified view
- **Public Profile Endpoint**: Made accessible without authentication

### Court Management
- **Bulk Court Creation**: Create multiple courts at once in TournamentManage
- **Court Editing/Deletion**: Full CRUD for courts in the courts tab
- **Map Links**: Add location links to courts

### Event Creation
- **Step-by-Step Wizard**: Visual indicator showing progress through creation steps
- **Event Type Comparison**: Side-by-side comparison UI for event types
- **Condensed Type Selection**: Streamlined event type picker with help topic
- **DivisionMax/ScheduleType**: New fields for event type configuration

---

## Unit/Team Management

### Admin Capabilities
- **Unit Management UI**: Admin interface for managing units and team composition
- **Join Request Handling**: Accept/reject icons for pending join requests in registration list
- **Break Unit Function**: Changed from cancel to "break unit" - keeps individual registrations
- **Hammer to Trash**: Updated icon from hammer to trash for removing members from units
- **Immediate Refresh**: Admin operations now refresh display immediately

### Player Features
- **Captain Join Requests**: LookingForPartner captains can now request to join other teams
- **Preserved Membership**: Membership records preserved when join requests are rejected
- **Waitlist Registration**: Allow registration to waitlist when division is at max capacity

---

## Authentication & Security

### Funtime-Shared Integration
- **Separate Token Storage**: Shared auth token stored separately for admin API calls
- **Email Sync**: Admin credential updates sync email to local Users table
- **Trailing Slash Fix**: Fixed SharedAuth HttpClient BaseAddress formatting
- **Authorization Headers**: Proper headers for SharedAssetService uploads

### JWT Improvements
- **SystemRole Extraction**: Extract from JWT claims for consistent admin feature access
- **AuthCallback Fix**: Proper systemRole extraction in callback flow
- **Claim Parsing Fix**: Corrected user ID claim parsing in ObjectAssetsController

---

## Bug Fixes

### Critical Fixes
- **Duplicate Key Error**: Fixed when accepting join requests
- **Null Reference Fixes**: Multiple fixes for null Unit1/Unit2, editingRank, standings
- **EF Core Compatibility**: Fixed OPENJSON compatibility with older SQL Server versions
- **Checkbox Linking**: Fixed checkbox association in payment modals using userId

### UI/UX Fixes
- **Toast Method Calls**: Fixed in handleRespondToJoinRequestAdmin
- **React Hooks Order**: Fixed error in AdminPaymentModal
- **Import Errors**: Fixed AdminContext and various missing imports
- **Decimal Handling**: Fixed null coalescing for non-nullable RegistrationFee

### API Fixes
- **Route Prefixes**: Removed /api prefix from playerHistoryApi routes
- **Capacity Check**: Fixed when accepting partner requests
- **Missing Tables**: Graceful handling when EventWaivers table doesn't exist

---

## Database Changes

### New Tables/Columns
- **UserPayment**: Renamed from EventPayment for generic payment support
- **ObjectAssets**: Generalized asset storage with FileUrl increased to 2000 chars
- **ObjectAssetTypes**: Configurable asset type definitions
- **EventWaivers.DocumentType**: New column for waiver categorization
- **Country/State Reference Tables**: For location dropdowns
- **Drawing State Columns**: For live drawing feature

### Migration Scripts
- Payment tracking backfill for existing data
- ObjectAssets migration with proper indexes
- EventWaivers DocumentType column addition

---

## Technical Improvements

### Performance
- **PWA Cache Limit**: Increased workbox cache to 3 MiB for larger bundles
- **Stored Procedures**: Continue preference for complex database operations

### Code Quality
- **DI Fixes**: Use INotificationService interface instead of concrete class
- **Consistent API Naming**: getAssets instead of getForObject
- **Type Safety**: Fixed nullable type mismatches throughout

---

## Summary

This release focuses on three major areas:

1. **Live Tournament Experience**: Real-time drawing with SignalR, improved game day dashboards, and check-in system
2. **Administrative Power Tools**: User search, credential management, and enhanced registration controls
3. **Document & Payment Infrastructure**: Complete waiver signing flow with PDF generation and restructured payment tracking

Total: 144 commits across 3 days of development.
