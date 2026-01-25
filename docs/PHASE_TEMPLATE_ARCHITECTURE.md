# Phase Template Architecture

## Overview

This document describes the redesigned phase-based tournament scheduling system that treats phases as composable "Lego blocks" with clear input/output slots, enabling tournament directors to easily assemble tournament structures from pre-built templates.

## Core Concepts

### Phases as Composable Units

Each phase has:
- **Incoming Slots**: Units entering this phase (from seeding or previous phase)
- **Exiting Slots**: Units leaving this phase (with final ranking/position)
- **Internal Logic**: How incoming → exiting (bracket, round robin, etc.)

```
Phase {
    IncomingSlots[]   // Units entering this phase
    ExitingSlots[]    // Units leaving (with final ranking/position)
    InternalLogic     // How incoming → exiting (bracket, round robin, etc.)
}
```

### Phase Chaining

Phases can be chained when `Phase A.ExitingSlotCount == Phase B.IncomingSlotCount`:

```
Tournament: 16 teams

Phase 1: "Pool Play 4×4"
  - Incoming: 16 slots (seeded)
  - Exiting: 8 slots (top 2 from each pool)

Phase 2: "Quarterfinals" (Single Elim 8→4)
  - Incoming: 8 slots ← Phase 1 exits 1-8
  - Exiting: 4 slots (semifinalists)

Phase 3: "Semifinals" (Single Elim 4→2)
  - Incoming: 4 slots ← Phase 2 exits 1-4
  - Exiting: 2 slots (finalists)

Phase 4: "Finals" (Single Elim 2→2)
  - Incoming: 2 slots ← Phase 3 exits 1-2
  - Exiting: 2 slots (1st place, 2nd place)
```

### Template Library

Pre-built templates that TDs can select and apply:

| Template | Description | Incoming | Exiting |
|----------|-------------|----------|---------|
| Round Robin 8→8 | All 8 get ranked exits | 8 | 8 |
| Single Elim 8→1 | Champion only | 8 | 1 |
| Single Elim 8→4 | With 3rd place match | 8 | 4 |
| Double Elim 16→1 | Full double elimination | 16 | 1 |
| Pool Play 2×4→4 | Top 2 from each pool | 8 | 4 |
| Pools + Bracket 16 | 4 pools → QF → SF → F | 16 | 4 |

## Data Model

### PhaseTemplate Entity (NEW)

```csharp
public class PhaseTemplate
{
    public int Id { get; set; }
    public string Name { get; set; }           // "8-Team Single Elim"
    public string? Description { get; set; }
    public string Category { get; set; }       // "SingleElim", "DoubleElim", "Pools", "Combined"
    public int MinUnits { get; set; }          // Minimum supported units
    public int MaxUnits { get; set; }          // Maximum supported units
    public int DefaultUnits { get; set; }      // Default unit count for this template
    public bool IsSystemTemplate { get; set; } // Pre-built vs user-created
    public bool IsActive { get; set; }         // Soft delete
    public string StructureJson { get; set; }  // Full structure definition
    public DateTime CreatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
}
```

### StructureJson Schema

```json
{
  "phases": [
    {
      "order": 1,
      "name": "Pool Play",
      "type": "Pools",
      "poolCount": 4,
      "incomingSlots": 16,
      "exitingSlots": 8,
      "settings": {
        "gamesPerMatch": 2,
        "pointsPerWin": 2,
        "pointsPerTie": 1
      }
    },
    {
      "order": 2,
      "name": "Quarterfinals",
      "type": "BracketRound",
      "incomingSlots": 8,
      "exitingSlots": 4
    },
    {
      "order": 3,
      "name": "Semifinals",
      "type": "BracketRound",
      "incomingSlots": 4,
      "exitingSlots": 2,
      "includeConsolation": true
    },
    {
      "order": 4,
      "name": "Finals",
      "type": "BracketRound",
      "incomingSlots": 2,
      "exitingSlots": 2
    }
  ],
  "advancementRules": [
    { "fromPhase": 1, "fromPool": "A", "fromRank": 1, "toPhase": 2, "toSlot": 1 },
    { "fromPhase": 1, "fromPool": "B", "fromRank": 1, "toPhase": 2, "toSlot": 4 },
    { "fromPhase": 1, "fromPool": "A", "fromRank": 2, "toPhase": 2, "toSlot": 5 },
    { "fromPhase": 1, "fromPool": "B", "fromRank": 2, "toPhase": 2, "toSlot": 8 }
  ],
  "seedingStrategy": "Snake",
  "exitPositionRules": {
    "finalPhase": 4,
    "positions": [
      { "rank": 1, "label": "Champion", "awardType": "Gold" },
      { "rank": 2, "label": "Runner-up", "awardType": "Silver" },
      { "rank": 3, "label": "3rd Place", "awardType": "Bronze" },
      { "rank": 4, "label": "4th Place", "awardType": null }
    ]
  }
}
```

### PhaseSlot Updates

```csharp
public class PhaseSlot
{
    public int Id { get; set; }
    public int PhaseId { get; set; }

    // Clarified slot type
    public string SlotType { get; set; }       // "Incoming" or "Exiting"
    public int SlotNumber { get; set; }        // 1-based position within type

    // For incoming slots - source
    public string? SourceType { get; set; }    // "Seeded", "FromPhase", "Bye"
    public int? SourcePhaseId { get; set; }    // If fed from another phase
    public int? SourceExitPosition { get; set; } // Which exit position from source

    // For exiting slots - result
    public int? FinalRank { get; set; }        // 1st, 2nd, 3rd within this phase
    public string? ExitLabel { get; set; }     // "Champion", "Pool A Winner", etc.

    // Resolution tracking
    public int? UnitId { get; set; }
    public bool IsResolved { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public bool WasManuallyResolved { get; set; }
    public int? ResolvedByUserId { get; set; }
    public string? ResolutionNotes { get; set; }
    public string? PlaceholderLabel { get; set; }  // "Seed 1", "Winner of Match 3"

    // Navigation
    public DivisionPhase Phase { get; set; }
    public EventUnit? Unit { get; set; }
}
```

## Design Decisions

### 1. Exit Slot Assignment

| Phase Type | Exit Position Logic |
|------------|---------------------|
| RoundRobin/Pools | `sp_GetPhaseStandings` ranks by Wins → Point Diff → Points For |
| SingleElimination | Winner of final = 1st, Loser = 2nd, Semifinal losers = 3rd/4th |
| DoubleElimination | Champion = 1st, Grand final loser = 2nd, then bracket positions |

**TD Override**: TDs can always manually override exit positions using `sp_ManuallyAssignExitSlot`.

### 2. Consolation/Loser Brackets

Kept **internal** to the phase. For double elimination:
- Winner's bracket and loser's bracket are both inside the same phase
- `LoserNextEncounterId` links losers to loser bracket matches
- Exits are calculated based on final elimination position

### 3. Byes

- Empty opponent slot = automatic bye
- Bye encounters are created but immediately completed
- Winner auto-advances via `sp_AdvanceWinner`
- Provides audit trail of bye assignments

### 4. Backward Compatibility

- Not prioritized (early stage of operation)
- `PhaseAdvancementRule` can coexist or be migrated
- Focus on clean new implementation

## Stored Procedures

### sp_ManuallyAssignExitSlot

Allows TD to override any exit slot assignment:

```sql
CREATE OR ALTER PROCEDURE sp_ManuallyAssignExitSlot
    @PhaseId INT,
    @ExitPosition INT,
    @UnitId INT,
    @UserId INT,
    @Notes NVARCHAR(500) = NULL
AS
BEGIN
    UPDATE PhaseSlots
    SET UnitId = @UnitId,
        IsResolved = 1,
        WasManuallyResolved = 1,
        ResolvedByUserId = @UserId,
        ResolvedAt = GETUTCDATE(),
        ResolutionNotes = @Notes
    WHERE PhaseId = @PhaseId
      AND SlotType = 'Exiting'
      AND SlotNumber = @ExitPosition;

    SELECT @@ROWCOUNT AS RowsAffected;
END
```

### sp_ProcessByeEncounters

Auto-completes bye encounters and advances winners:

```sql
CREATE OR ALTER PROCEDURE sp_ProcessByeEncounters
    @PhaseId INT
AS
BEGIN
    -- Find encounters where one side is a bye (null unit)
    DECLARE @ByeEncounters TABLE (EncounterId INT, WinnerUnitId INT);

    INSERT INTO @ByeEncounters
    SELECT e.Id,
           CASE WHEN e.Unit1Id IS NULL THEN e.Unit2Id ELSE e.Unit1Id END
    FROM EventEncounters e
    WHERE e.PhaseId = @PhaseId
      AND e.Status = 'Scheduled'
      AND (e.Unit1Id IS NULL OR e.Unit2Id IS NULL)
      AND NOT (e.Unit1Id IS NULL AND e.Unit2Id IS NULL);

    -- Complete bye encounters
    UPDATE e
    SET Status = 'Completed',
        WinnerUnitId = b.WinnerUnitId,
        CompletedAt = GETUTCDATE()
    FROM EventEncounters e
    JOIN @ByeEncounters b ON e.Id = b.EncounterId;

    -- Advance winners
    DECLARE @EncounterId INT, @WinnerUnitId INT;
    DECLARE bye_cursor CURSOR FOR SELECT EncounterId, WinnerUnitId FROM @ByeEncounters;
    OPEN bye_cursor;
    FETCH NEXT FROM bye_cursor INTO @EncounterId, @WinnerUnitId;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC sp_AdvanceWinner @EncounterId = @EncounterId;
        FETCH NEXT FROM bye_cursor INTO @EncounterId, @WinnerUnitId;
    END
    CLOSE bye_cursor;
    DEALLOCATE bye_cursor;

    SELECT COUNT(*) AS ByesProcessed FROM @ByeEncounters;
END
```

## API Endpoints

### PhaseTemplatesController

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/phasetemplates` | List all active templates |
| GET | `/phasetemplates/{id}` | Get template details |
| GET | `/phasetemplates/category/{category}` | Get templates by category |
| GET | `/phasetemplates/for-units/{unitCount}` | Get templates suitable for unit count |
| POST | `/phasetemplates` | Create custom template (admin) |
| PUT | `/phasetemplates/{id}` | Update template (admin) |
| DELETE | `/phasetemplates/{id}` | Soft delete template (admin) |
| POST | `/phasetemplates/{id}/apply/{divisionId}` | Apply template to division |
| POST | `/phasetemplates/preview` | Preview what applying a template would create |

### DivisionPhasesController Updates

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/{phaseId}/manual-exit-assignment` | TD manually assigns exit slot |
| POST | `/{phaseId}/process-byes` | Process all bye encounters in phase |
| GET | `/{phaseId}/exit-slots` | Get current exit slot status |

## Frontend Components

### TemplateSelector.jsx

Template selection UI for tournament setup:

```
┌─────────────────────────────────────────────────────────┐
│  Select Tournament Format (12 registered teams)         │
├─────────────────────────────────────────────────────────┤
│  📋 Recommended Formats                                 │
│  ┌─────────────────┐ ┌─────────────────┐                │
│  │ 12-Team Pools   │ │ 12-Team Single  │                │
│  │ + Bracket       │ │ Elimination     │                │
│  │                 │ │                 │                │
│  │ 3 pools of 4    │ │ 4 byes + QF     │                │
│  │ → QF → SF → F   │ │ → SF → F        │                │
│  └─────────────────┘ └─────────────────┘                │
│                                                         │
│  📦 All Formats                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ▼ Single Elimination                             │   │
│  │   • 8-Team Single Elim                           │   │
│  │   • 16-Team Single Elim                          │   │
│  │   • 32-Team Single Elim                          │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ ▼ Double Elimination                             │   │
│  │   • 8-Team Double Elim                           │   │
│  │   • 16-Team Double Elim                          │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ ▼ Pools + Bracket                                │   │
│  │   • 2 Pools → Semis → Finals (8 teams)           │   │
│  │   • 4 Pools → QF → SF → Finals (16 teams)        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  🔧 Custom Format...                                    │
└─────────────────────────────────────────────────────────┘
```

### TemplatePreview.jsx

Visual preview of what template creates:

```
┌─────────────────────────────────────────────────────────┐
│  Preview: 4 Pools + Bracket (16 teams)                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Phase 1: Pool Play          Phase 2: Quarterfinals     │
│  ┌─────┐ ┌─────┐            ┌────────────────────┐      │
│  │ A   │ │ B   │            │ Pool A #1          │      │
│  │ 1-4 │ │ 1-4 │ ────────►  │     vs             │      │
│  └─────┘ └─────┘            │ Pool B #2          │      │
│  ┌─────┐ ┌─────┐            └────────────────────┘      │
│  │ C   │ │ D   │                    │                   │
│  │ 1-4 │ │ 1-4 │                    ▼                   │
│  └─────┘ └─────┘            Phase 3: Semifinals         │
│                              ┌──────────────────┐       │
│  16 incoming                 │ QF Winners       │       │
│  8 exiting (top 2/pool)      └──────────────────┘       │
│                                      │                  │
│                                      ▼                  │
│                              Phase 4: Finals            │
│                              ┌──────────────────┐       │
│                              │ 🏆 Championship  │       │
│                              └──────────────────┘       │
│                                                         │
│  [ Cancel ]                          [ Apply Template ] │
└─────────────────────────────────────────────────────────┘
```

## System Templates (Seed Data)

### Single Elimination Templates

1. **4-Team Single Elim**: SF → F (4→2)
2. **8-Team Single Elim**: QF → SF → F (8→4)
3. **16-Team Single Elim**: R1 → QF → SF → F (16→4)
4. **32-Team Single Elim**: R1 → R2 → QF → SF → F (32→4)

### Double Elimination Templates

1. **8-Team Double Elim**: Full WB + LB + GF (8→4)
2. **16-Team Double Elim**: Full WB + LB + GF (16→4)

### Pools Templates

1. **Round Robin 4**: Everyone plays everyone (4→4)
2. **Round Robin 8**: Everyone plays everyone (8→8)
3. **2 Pools of 4**: Pool play only (8→4)
4. **4 Pools of 4**: Pool play only (16→8)

### Combined Templates

1. **8-Team Pools + Finals**: 2 pools → Finals (8→2)
2. **8-Team Pools + Semis + Finals**: 2 pools → SF → F (8→4)
3. **16-Team Pools + Bracket**: 4 pools → QF → SF → F (16→4)
4. **32-Team Pools + Bracket**: 8 pools → R16 → QF → SF → F (32→4)

## Implementation Order

1. **Migration 137**: Create PhaseTemplate table, update PhaseSlots
2. **sp_ManuallyAssignExitSlot**: TD override capability
3. **sp_ProcessByeEncounters**: Bye handling
4. **PhaseTemplatesController**: CRUD + apply endpoints
5. **Seed system templates**: Initial template library
6. **TemplateSelector.jsx**: Frontend selection UI
7. **TemplatePreview.jsx**: Visual preview component
8. **Update PhaseManager.jsx**: Integrate template selection

## Migration Path

The new template system can coexist with the existing manual phase creation:

1. **Existing tournaments**: Continue working as-is
2. **New tournaments**: Can use template selection OR manual creation
3. **PhaseAdvancementRule**: Remains for backward compatibility, templates generate these automatically
4. **Gradual adoption**: TDs learn templates, manual mode always available
