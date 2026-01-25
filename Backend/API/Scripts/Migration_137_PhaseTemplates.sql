-- Migration 137: Phase Templates
-- Adds template library for tournament phase structures
-- Enables TDs to select pre-built tournament formats

PRINT 'Starting Migration 137: Phase Templates...'

-- =====================================================
-- 1. Create PhaseTemplates table
-- =====================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PhaseTemplates')
BEGIN
    CREATE TABLE PhaseTemplates (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        Category NVARCHAR(30) NOT NULL DEFAULT 'SingleElimination',
        MinUnits INT NOT NULL DEFAULT 2,
        MaxUnits INT NOT NULL DEFAULT 64,
        DefaultUnits INT NOT NULL DEFAULT 8,
        IsSystemTemplate BIT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        SortOrder INT NOT NULL DEFAULT 100,
        StructureJson NVARCHAR(MAX) NOT NULL DEFAULT '{}',
        DiagramText NVARCHAR(1000) NULL,
        Tags NVARCHAR(200) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CreatedByUserId INT NULL,

        CONSTRAINT FK_PhaseTemplates_Users FOREIGN KEY (CreatedByUserId)
            REFERENCES Users(Id) ON DELETE SET NULL
    );

    CREATE INDEX IX_PhaseTemplates_Category ON PhaseTemplates(Category);
    CREATE INDEX IX_PhaseTemplates_IsActive ON PhaseTemplates(IsActive);
    CREATE INDEX IX_PhaseTemplates_UnitRange ON PhaseTemplates(MinUnits, MaxUnits);

    PRINT 'Created PhaseTemplates table'
END
ELSE
    PRINT 'PhaseTemplates table already exists'

-- =====================================================
-- 2. Add ExitLabel column to PhaseSlots for clarity
-- =====================================================

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('PhaseSlots') AND name = 'ExitLabel')
BEGIN
    ALTER TABLE PhaseSlots ADD ExitLabel NVARCHAR(50) NULL;
    PRINT 'Added ExitLabel column to PhaseSlots'
END

-- =====================================================
-- 3. Stored Procedure: sp_ManuallyAssignExitSlot
-- Allows TD to override any exit/advancing slot assignment
-- =====================================================

CREATE OR ALTER PROCEDURE sp_ManuallyAssignExitSlot
    @PhaseId INT,
    @SlotNumber INT,
    @UnitId INT,
    @UserId INT,
    @Notes NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Validate phase exists
    IF NOT EXISTS (SELECT 1 FROM DivisionPhases WHERE Id = @PhaseId)
    BEGIN
        RAISERROR('Phase not found', 16, 1);
        RETURN;
    END

    -- Find and update the advancing/exiting slot
    UPDATE PhaseSlots
    SET UnitId = @UnitId,
        IsResolved = 1,
        WasManuallyResolved = 1,
        ResolvedByUserId = @UserId,
        ResolvedAt = GETUTCDATE(),
        ResolutionNotes = @Notes,
        UpdatedAt = GETUTCDATE()
    WHERE PhaseId = @PhaseId
      AND SlotType = 'Advancing'
      AND SlotNumber = @SlotNumber;

    IF @@ROWCOUNT = 0
    BEGIN
        RAISERROR('Advancing slot not found for the specified phase and slot number', 16, 1);
        RETURN;
    END

    -- Return the updated slot
    SELECT s.*,
           u.CustomName AS UnitName
    FROM PhaseSlots s
    LEFT JOIN EventUnits u ON s.UnitId = u.Id
    WHERE s.PhaseId = @PhaseId
      AND s.SlotType = 'Advancing'
      AND s.SlotNumber = @SlotNumber;
END
GO

PRINT 'Created sp_ManuallyAssignExitSlot procedure'

-- =====================================================
-- 4. Stored Procedure: sp_ProcessByeEncounters
-- Auto-completes bye encounters and advances winners
-- =====================================================

CREATE OR ALTER PROCEDURE sp_ProcessByeEncounters
    @PhaseId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ByesProcessed INT = 0;
    DECLARE @EncounterId INT, @WinnerUnitId INT;

    -- Find encounters where exactly one side is null (bye)
    DECLARE @ByeEncounters TABLE (
        EncounterId INT,
        WinnerUnitId INT
    );

    INSERT INTO @ByeEncounters (EncounterId, WinnerUnitId)
    SELECT e.Id,
           CASE
               WHEN e.Unit1Id IS NULL THEN e.Unit2Id
               ELSE e.Unit1Id
           END AS WinnerUnitId
    FROM EventEncounters e
    WHERE e.PhaseId = @PhaseId
      AND e.Status IN ('Scheduled', 'Ready')
      AND (
          (e.Unit1Id IS NULL AND e.Unit2Id IS NOT NULL) OR
          (e.Unit1Id IS NOT NULL AND e.Unit2Id IS NULL)
      );

    -- Complete each bye encounter
    DECLARE bye_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT EncounterId, WinnerUnitId FROM @ByeEncounters;

    OPEN bye_cursor;
    FETCH NEXT FROM bye_cursor INTO @EncounterId, @WinnerUnitId;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Mark encounter as completed with winner
        UPDATE EventEncounters
        SET Status = 'Completed',
            WinnerUnitId = @WinnerUnitId,
            CompletedAt = GETUTCDATE(),
            UpdatedAt = GETUTCDATE()
        WHERE Id = @EncounterId;

        -- Advance the winner using existing procedure
        EXEC sp_AdvanceWinner @EncounterId = @EncounterId;

        SET @ByesProcessed = @ByesProcessed + 1;

        FETCH NEXT FROM bye_cursor INTO @EncounterId, @WinnerUnitId;
    END

    CLOSE bye_cursor;
    DEALLOCATE bye_cursor;

    -- Return count
    SELECT @ByesProcessed AS ByesProcessed;
END
GO

PRINT 'Created sp_ProcessByeEncounters procedure'

-- =====================================================
-- 5. Stored Procedure: sp_ApplyPhaseTemplate
-- Applies a template to a division, creating all phases
-- =====================================================

CREATE OR ALTER PROCEDURE sp_ApplyPhaseTemplate
    @TemplateId INT,
    @DivisionId INT,
    @UnitCount INT = NULL  -- If null, uses template default
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @StructureJson NVARCHAR(MAX);
    DECLARE @DefaultUnits INT;

    -- Get template
    SELECT @StructureJson = StructureJson,
           @DefaultUnits = DefaultUnits
    FROM PhaseTemplates
    WHERE Id = @TemplateId AND IsActive = 1;

    IF @StructureJson IS NULL
    BEGIN
        RAISERROR('Template not found or inactive', 16, 1);
        RETURN;
    END

    -- Use default if not specified
    IF @UnitCount IS NULL
        SET @UnitCount = @DefaultUnits;

    -- Note: Complex JSON parsing and phase creation will be handled in C# controller
    -- This procedure validates and prepares; actual creation done in application layer

    SELECT @StructureJson AS StructureJson,
           @UnitCount AS UnitCount,
           @DivisionId AS DivisionId;
END
GO

PRINT 'Created sp_ApplyPhaseTemplate procedure'

-- =====================================================
-- 6. Seed System Templates
-- =====================================================

-- Helper to check if template exists
IF NOT EXISTS (SELECT 1 FROM PhaseTemplates WHERE Name = '4-Team Single Elimination' AND IsSystemTemplate = 1)
BEGIN
    INSERT INTO PhaseTemplates (Name, Description, Category, MinUnits, MaxUnits, DefaultUnits, IsSystemTemplate, SortOrder, StructureJson, DiagramText, Tags)
    VALUES (
        '4-Team Single Elimination',
        'Simple 4-team bracket: Semifinals -> Finals with optional 3rd place match',
        'SingleElimination',
        4, 4, 4,
        1,
        10,
        '{
            "phases": [
                {
                    "order": 1,
                    "name": "Semifinals",
                    "type": "BracketRound",
                    "incomingSlots": 4,
                    "exitingSlots": 2,
                    "includeConsolation": true
                },
                {
                    "order": 2,
                    "name": "Finals",
                    "type": "BracketRound",
                    "incomingSlots": 2,
                    "exitingSlots": 2
                }
            ],
            "advancementRules": [
                {"fromPhase": 1, "fromRank": 1, "toPhase": 2, "toSlot": 1},
                {"fromPhase": 1, "fromRank": 2, "toPhase": 2, "toSlot": 2}
            ],
            "exitPositions": [
                {"rank": 1, "label": "Champion", "awardType": "Gold"},
                {"rank": 2, "label": "Runner-up", "awardType": "Silver"},
                {"rank": 3, "label": "3rd Place", "awardType": "Bronze"},
                {"rank": 4, "label": "4th Place"}
            ]
        }',
        'SF -> F (+ 3rd place)',
        'small,quick,beginner'
    );
    PRINT 'Added 4-Team Single Elimination template'
END

IF NOT EXISTS (SELECT 1 FROM PhaseTemplates WHERE Name = '8-Team Single Elimination' AND IsSystemTemplate = 1)
BEGIN
    INSERT INTO PhaseTemplates (Name, Description, Category, MinUnits, MaxUnits, DefaultUnits, IsSystemTemplate, SortOrder, StructureJson, DiagramText, Tags)
    VALUES (
        '8-Team Single Elimination',
        'Standard 8-team bracket: Quarterfinals -> Semifinals -> Finals',
        'SingleElimination',
        8, 8, 8,
        1,
        20,
        '{
            "phases": [
                {
                    "order": 1,
                    "name": "Quarterfinals",
                    "type": "BracketRound",
                    "incomingSlots": 8,
                    "exitingSlots": 4
                },
                {
                    "order": 2,
                    "name": "Semifinals",
                    "type": "BracketRound",
                    "incomingSlots": 4,
                    "exitingSlots": 2,
                    "includeConsolation": true
                },
                {
                    "order": 3,
                    "name": "Finals",
                    "type": "BracketRound",
                    "incomingSlots": 2,
                    "exitingSlots": 2
                }
            ],
            "advancementRules": [
                {"fromPhase": 1, "fromRank": 1, "toPhase": 2, "toSlot": 1},
                {"fromPhase": 1, "fromRank": 2, "toPhase": 2, "toSlot": 2},
                {"fromPhase": 1, "fromRank": 3, "toPhase": 2, "toSlot": 3},
                {"fromPhase": 1, "fromRank": 4, "toPhase": 2, "toSlot": 4},
                {"fromPhase": 2, "fromRank": 1, "toPhase": 3, "toSlot": 1},
                {"fromPhase": 2, "fromRank": 2, "toPhase": 3, "toSlot": 2}
            ],
            "exitPositions": [
                {"rank": 1, "label": "Champion", "awardType": "Gold"},
                {"rank": 2, "label": "Runner-up", "awardType": "Silver"},
                {"rank": 3, "label": "3rd Place", "awardType": "Bronze"},
                {"rank": 4, "label": "4th Place"}
            ]
        }',
        'QF -> SF -> F',
        'standard,popular'
    );
    PRINT 'Added 8-Team Single Elimination template'
END

IF NOT EXISTS (SELECT 1 FROM PhaseTemplates WHERE Name = '16-Team Single Elimination' AND IsSystemTemplate = 1)
BEGIN
    INSERT INTO PhaseTemplates (Name, Description, Category, MinUnits, MaxUnits, DefaultUnits, IsSystemTemplate, SortOrder, StructureJson, DiagramText, Tags)
    VALUES (
        '16-Team Single Elimination',
        'Large bracket: Round of 16 -> Quarterfinals -> Semifinals -> Finals',
        'SingleElimination',
        16, 16, 16,
        1,
        30,
        '{
            "phases": [
                {
                    "order": 1,
                    "name": "Round of 16",
                    "type": "BracketRound",
                    "incomingSlots": 16,
                    "exitingSlots": 8
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
            "advancementRules": "auto",
            "exitPositions": [
                {"rank": 1, "label": "Champion", "awardType": "Gold"},
                {"rank": 2, "label": "Runner-up", "awardType": "Silver"},
                {"rank": 3, "label": "3rd Place", "awardType": "Bronze"},
                {"rank": 4, "label": "4th Place"}
            ]
        }',
        'R16 -> QF -> SF -> F',
        'large'
    );
    PRINT 'Added 16-Team Single Elimination template'
END

IF NOT EXISTS (SELECT 1 FROM PhaseTemplates WHERE Name = 'Round Robin (4 teams)' AND IsSystemTemplate = 1)
BEGIN
    INSERT INTO PhaseTemplates (Name, Description, Category, MinUnits, MaxUnits, DefaultUnits, IsSystemTemplate, SortOrder, StructureJson, DiagramText, Tags)
    VALUES (
        'Round Robin (4 teams)',
        'Everyone plays everyone. All 4 teams ranked at end.',
        'RoundRobin',
        4, 4, 4,
        1,
        40,
        '{
            "phases": [
                {
                    "order": 1,
                    "name": "Round Robin",
                    "type": "RoundRobin",
                    "incomingSlots": 4,
                    "exitingSlots": 4
                }
            ],
            "exitPositions": [
                {"rank": 1, "label": "1st Place", "awardType": "Gold"},
                {"rank": 2, "label": "2nd Place", "awardType": "Silver"},
                {"rank": 3, "label": "3rd Place", "awardType": "Bronze"},
                {"rank": 4, "label": "4th Place"}
            ]
        }',
        'All play all',
        'casual,everyone-plays'
    );
    PRINT 'Added Round Robin (4 teams) template'
END

IF NOT EXISTS (SELECT 1 FROM PhaseTemplates WHERE Name = 'Round Robin (8 teams)' AND IsSystemTemplate = 1)
BEGIN
    INSERT INTO PhaseTemplates (Name, Description, Category, MinUnits, MaxUnits, DefaultUnits, IsSystemTemplate, SortOrder, StructureJson, DiagramText, Tags)
    VALUES (
        'Round Robin (8 teams)',
        'Everyone plays everyone. All 8 teams ranked at end.',
        'RoundRobin',
        8, 8, 8,
        1,
        41,
        '{
            "phases": [
                {
                    "order": 1,
                    "name": "Round Robin",
                    "type": "RoundRobin",
                    "incomingSlots": 8,
                    "exitingSlots": 8
                }
            ],
            "exitPositions": [
                {"rank": 1, "label": "1st Place", "awardType": "Gold"},
                {"rank": 2, "label": "2nd Place", "awardType": "Silver"},
                {"rank": 3, "label": "3rd Place", "awardType": "Bronze"}
            ]
        }',
        'All play all',
        'casual,everyone-plays'
    );
    PRINT 'Added Round Robin (8 teams) template'
END

IF NOT EXISTS (SELECT 1 FROM PhaseTemplates WHERE Name = '2 Pools + Semifinals + Finals (8 teams)' AND IsSystemTemplate = 1)
BEGIN
    INSERT INTO PhaseTemplates (Name, Description, Category, MinUnits, MaxUnits, DefaultUnits, IsSystemTemplate, SortOrder, StructureJson, DiagramText, Tags)
    VALUES (
        '2 Pools + Semifinals + Finals (8 teams)',
        'Two pools of 4, top 2 from each advance to semifinals, then finals. Good balance of games.',
        'Combined',
        8, 8, 8,
        1,
        50,
        '{
            "phases": [
                {
                    "order": 1,
                    "name": "Pool Play",
                    "type": "Pools",
                    "poolCount": 2,
                    "incomingSlots": 8,
                    "exitingSlots": 4
                },
                {
                    "order": 2,
                    "name": "Semifinals",
                    "type": "BracketRound",
                    "incomingSlots": 4,
                    "exitingSlots": 2,
                    "includeConsolation": true
                },
                {
                    "order": 3,
                    "name": "Finals",
                    "type": "BracketRound",
                    "incomingSlots": 2,
                    "exitingSlots": 2
                }
            ],
            "advancementRules": [
                {"fromPhase": 1, "fromPool": "A", "fromRank": 1, "toPhase": 2, "toSlot": 1},
                {"fromPhase": 1, "fromPool": "B", "fromRank": 1, "toPhase": 2, "toSlot": 2},
                {"fromPhase": 1, "fromPool": "A", "fromRank": 2, "toPhase": 2, "toSlot": 4},
                {"fromPhase": 1, "fromPool": "B", "fromRank": 2, "toPhase": 2, "toSlot": 3}
            ],
            "seedingStrategy": "CrossPool",
            "exitPositions": [
                {"rank": 1, "label": "Champion", "awardType": "Gold"},
                {"rank": 2, "label": "Runner-up", "awardType": "Silver"},
                {"rank": 3, "label": "3rd Place", "awardType": "Bronze"},
                {"rank": 4, "label": "4th Place"}
            ]
        }',
        'Pool A/B (4 each) -> SF -> F',
        'balanced,popular'
    );
    PRINT 'Added 2 Pools + Semifinals + Finals (8 teams) template'
END

IF NOT EXISTS (SELECT 1 FROM PhaseTemplates WHERE Name = '4 Pools + Bracket (16 teams)' AND IsSystemTemplate = 1)
BEGIN
    INSERT INTO PhaseTemplates (Name, Description, Category, MinUnits, MaxUnits, DefaultUnits, IsSystemTemplate, SortOrder, StructureJson, DiagramText, Tags)
    VALUES (
        '4 Pools + Bracket (16 teams)',
        'Four pools of 4, top 2 from each advance to quarterfinals, then bracket play.',
        'Combined',
        16, 16, 16,
        1,
        51,
        '{
            "phases": [
                {
                    "order": 1,
                    "name": "Pool Play",
                    "type": "Pools",
                    "poolCount": 4,
                    "incomingSlots": 16,
                    "exitingSlots": 8
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
                {"fromPhase": 1, "fromPool": "A", "fromRank": 1, "toPhase": 2, "toSlot": 1},
                {"fromPhase": 1, "fromPool": "B", "fromRank": 1, "toPhase": 2, "toSlot": 4},
                {"fromPhase": 1, "fromPool": "C", "fromRank": 1, "toPhase": 2, "toSlot": 2},
                {"fromPhase": 1, "fromPool": "D", "fromRank": 1, "toPhase": 2, "toSlot": 3},
                {"fromPhase": 1, "fromPool": "A", "fromRank": 2, "toPhase": 2, "toSlot": 8},
                {"fromPhase": 1, "fromPool": "B", "fromRank": 2, "toPhase": 2, "toSlot": 5},
                {"fromPhase": 1, "fromPool": "C", "fromRank": 2, "toPhase": 2, "toSlot": 7},
                {"fromPhase": 1, "fromPool": "D", "fromRank": 2, "toPhase": 2, "toSlot": 6}
            ],
            "seedingStrategy": "Snake",
            "exitPositions": [
                {"rank": 1, "label": "Champion", "awardType": "Gold"},
                {"rank": 2, "label": "Runner-up", "awardType": "Silver"},
                {"rank": 3, "label": "3rd Place", "awardType": "Bronze"},
                {"rank": 4, "label": "4th Place"}
            ]
        }',
        'Pool A/B/C/D (4 each) -> QF -> SF -> F',
        'large,balanced'
    );
    PRINT 'Added 4 Pools + Bracket (16 teams) template'
END

IF NOT EXISTS (SELECT 1 FROM PhaseTemplates WHERE Name = '8-Team Double Elimination' AND IsSystemTemplate = 1)
BEGIN
    INSERT INTO PhaseTemplates (Name, Description, Category, MinUnits, MaxUnits, DefaultUnits, IsSystemTemplate, SortOrder, StructureJson, DiagramText, Tags)
    VALUES (
        '8-Team Double Elimination',
        'Double elimination: Winner''s bracket and Loser''s bracket, must lose twice to be eliminated.',
        'DoubleElimination',
        8, 8, 8,
        1,
        60,
        '{
            "phases": [
                {
                    "order": 1,
                    "name": "Double Elimination Bracket",
                    "type": "DoubleElimination",
                    "incomingSlots": 8,
                    "exitingSlots": 4,
                    "settings": {
                        "grandFinalReset": true
                    }
                }
            ],
            "exitPositions": [
                {"rank": 1, "label": "Champion", "awardType": "Gold"},
                {"rank": 2, "label": "Runner-up", "awardType": "Silver"},
                {"rank": 3, "label": "3rd Place", "awardType": "Bronze"},
                {"rank": 4, "label": "4th Place"}
            ]
        }',
        'WB + LB -> Grand Final',
        'competitive,fair'
    );
    PRINT 'Added 8-Team Double Elimination template'
END

-- Flexible templates that work with ranges
IF NOT EXISTS (SELECT 1 FROM PhaseTemplates WHERE Name = 'Single Elimination (Flexible)' AND IsSystemTemplate = 1)
BEGIN
    INSERT INTO PhaseTemplates (Name, Description, Category, MinUnits, MaxUnits, DefaultUnits, IsSystemTemplate, SortOrder, StructureJson, DiagramText, Tags)
    VALUES (
        'Single Elimination (Flexible)',
        'Adapts to any team count (4-32). Automatically calculates bracket size and byes.',
        'SingleElimination',
        4, 32, 8,
        1,
        5,
        '{
            "isFlexible": true,
            "generateBracket": {
                "type": "SingleElimination",
                "consolation": true,
                "calculateByes": true
            },
            "exitPositions": [
                {"rank": 1, "label": "Champion", "awardType": "Gold"},
                {"rank": 2, "label": "Runner-up", "awardType": "Silver"},
                {"rank": 3, "label": "3rd Place", "awardType": "Bronze"},
                {"rank": 4, "label": "4th Place"}
            ]
        }',
        'Auto-sizes bracket with byes',
        'flexible,recommended'
    );
    PRINT 'Added Single Elimination (Flexible) template'
END

IF NOT EXISTS (SELECT 1 FROM PhaseTemplates WHERE Name = 'Pools + Bracket (Flexible)' AND IsSystemTemplate = 1)
BEGIN
    INSERT INTO PhaseTemplates (Name, Description, Category, MinUnits, MaxUnits, DefaultUnits, IsSystemTemplate, SortOrder, StructureJson, DiagramText, Tags)
    VALUES (
        'Pools + Bracket (Flexible)',
        'Auto-configures pools based on team count, then bracket play for top finishers.',
        'Combined',
        6, 32, 12,
        1,
        6,
        '{
            "isFlexible": true,
            "generateFormat": {
                "poolSize": 4,
                "advancePerPool": 2,
                "bracketType": "SingleElimination",
                "consolation": true
            },
            "exitPositions": [
                {"rank": 1, "label": "Champion", "awardType": "Gold"},
                {"rank": 2, "label": "Runner-up", "awardType": "Silver"},
                {"rank": 3, "label": "3rd Place", "awardType": "Bronze"},
                {"rank": 4, "label": "4th Place"}
            ]
        }',
        'Auto-pools -> bracket',
        'flexible,recommended'
    );
    PRINT 'Added Pools + Bracket (Flexible) template'
END

PRINT 'Migration 137 completed successfully'
