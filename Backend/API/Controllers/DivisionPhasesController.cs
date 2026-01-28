using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Services;

namespace Pickleball.Community.Controllers;

/// <summary>
/// Manages division phases for multi-phase tournament scheduling.
/// Provides CRUD operations, schedule generation, and advancement configuration.
/// </summary>
[ApiController]
[Route("[controller]")]
public class DivisionPhasesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<DivisionPhasesController> _logger;
    private readonly ICourtAssignmentService _courtAssignmentService;

    public DivisionPhasesController(
        ApplicationDbContext context,
        ILogger<DivisionPhasesController> logger,
        ICourtAssignmentService courtAssignmentService)
    {
        _context = context;
        _logger = logger;
        _courtAssignmentService = courtAssignmentService;
    }

    #region Phase CRUD

    /// <summary>
    /// Get all phases for a division
    /// </summary>
    [HttpGet("division/{divisionId}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPhases(int divisionId)
    {
        var phases = await _context.DivisionPhases
            .Where(p => p.DivisionId == divisionId)
            .OrderBy(p => p.PhaseOrder)
            .Select(p => new
            {
                p.Id,
                p.DivisionId,
                p.PhaseOrder,
                p.PhaseType,
                p.Name,
                p.Description,
                p.IncomingSlotCount,
                p.AdvancingSlotCount,
                p.PoolCount,
                p.Status,
                p.StartTime,
                p.EstimatedEndTime,
                p.EstimatedMatchDurationMinutes,
                p.BestOf,
                p.RankingCriteria,
                p.ReseedOption,
                p.Settings,
                p.IsManuallyLocked,
                p.IncludeConsolation,
                p.SeedingStrategy,
                EncounterCount = p.Encounters.Count,
                SlotCount = p.Slots.Count,
                PoolNames = p.Pools.OrderBy(pl => pl.PoolOrder).Select(pl => pl.PoolName).ToList()
            })
            .ToListAsync();

        return Ok(new { success = true, data = phases });
    }

    /// <summary>
    /// Get a single phase with full details
    /// </summary>
    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPhase(int id)
    {
        var phase = await _context.DivisionPhases
            .Include(p => p.Slots)
            .Include(p => p.Pools)
                .ThenInclude(pl => pl.PoolSlots)
            .Include(p => p.IncomingAdvancementRules)
            .Include(p => p.OutgoingAdvancementRules)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (phase == null)
            return NotFound(new { success = false, message = "Phase not found" });

        return Ok(new
        {
            success = true,
            data = new
            {
                phase.Id,
                phase.DivisionId,
                phase.PhaseOrder,
                phase.PhaseType,
                phase.Name,
                phase.Description,
                phase.IncomingSlotCount,
                phase.AdvancingSlotCount,
                phase.PoolCount,
                phase.Status,
                phase.StartTime,
                phase.EstimatedEndTime,
                phase.EstimatedMatchDurationMinutes,
                phase.BestOf,
                phase.RankingCriteria,
                phase.ReseedOption,
                phase.Settings,
                phase.IsManuallyLocked,
                phase.IncludeConsolation,
                phase.SeedingStrategy,
                Slots = phase.Slots.OrderBy(s => s.SlotType).ThenBy(s => s.SlotNumber).Select(s => new
                {
                    s.Id,
                    s.SlotType,
                    s.SlotNumber,
                    s.UnitId,
                    s.SourceType,
                    s.PlaceholderLabel,
                    s.IsResolved
                }),
                Pools = phase.Pools.OrderBy(pl => pl.PoolOrder).Select(pl => new
                {
                    pl.Id,
                    pl.PoolName,
                    pl.PoolOrder,
                    pl.SlotCount,
                    pl.Status,
                    SlotIds = pl.PoolSlots.OrderBy(ps => ps.PoolPosition).Select(ps => ps.SlotId)
                }),
                IncomingRules = phase.IncomingAdvancementRules.OrderBy(r => r.ProcessOrder).Select(r => new
                {
                    r.Id,
                    r.SourcePhaseId,
                    r.SourcePoolId,
                    r.SourceRank,
                    r.TargetSlotNumber,
                    r.Description
                }),
                OutgoingRules = phase.OutgoingAdvancementRules.OrderBy(r => r.ProcessOrder).Select(r => new
                {
                    r.Id,
                    r.TargetPhaseId,
                    r.SourcePoolId,
                    r.SourceRank,
                    r.TargetSlotNumber,
                    r.Description
                })
            }
        });
    }

    /// <summary>
    /// Create a new phase for a division
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin,Organizer")]
    public async Task<IActionResult> CreatePhase([FromBody] CreatePhaseRequest request)
    {
        // Validate division exists
        var division = await _context.EventDivisions.FindAsync(request.DivisionId);
        if (division == null)
            return NotFound(new { success = false, message = "Division not found" });

        // Get next phase order
        var maxOrder = await _context.DivisionPhases
            .Where(p => p.DivisionId == request.DivisionId)
            .MaxAsync(p => (int?)p.PhaseOrder) ?? 0;

        var phase = new DivisionPhase
        {
            DivisionId = request.DivisionId,
            PhaseOrder = request.PhaseOrder ?? (maxOrder + 1),
            PhaseType = request.PhaseType ?? PhaseTypes.RoundRobin,
            Name = request.Name ?? $"Phase {maxOrder + 1}",
            Description = request.Description,
            IncomingSlotCount = request.IncomingSlotCount,
            AdvancingSlotCount = request.AdvancingSlotCount,
            PoolCount = request.PoolCount ?? 1,
            StartTime = request.StartTime,
            EstimatedMatchDurationMinutes = request.EstimatedMatchDurationMinutes,
            BestOf = request.BestOf,
            RankingCriteria = request.RankingCriteria,
            ReseedOption = request.ReseedOption,
            Settings = request.Settings,
            IncludeConsolation = request.IncludeConsolation,
            SeedingStrategy = request.SeedingStrategy ?? SeedingStrategies.Snake
        };

        _context.DivisionPhases.Add(phase);
        await _context.SaveChangesAsync();

        // Create incoming slots
        await CreatePhaseSlots(phase.Id, phase.IncomingSlotCount, SlotTypes.Incoming);

        // Create pools if multi-pool phase
        if (phase.PoolCount > 1)
        {
            await CreatePhasePools(phase.Id, phase.PoolCount, phase.IncomingSlotCount);
        }

        _logger.LogInformation("Created phase {PhaseId} for division {DivisionId}", phase.Id, request.DivisionId);

        return Ok(new { success = true, data = new { phase.Id, phase.Name, phase.PhaseOrder } });
    }

    /// <summary>
    /// Update an existing phase
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Organizer")]
    public async Task<IActionResult> UpdatePhase(int id, [FromBody] UpdatePhaseRequest request)
    {
        var phase = await _context.DivisionPhases.FindAsync(id);
        if (phase == null)
            return NotFound(new { success = false, message = "Phase not found" });

        if (phase.IsManuallyLocked)
            return BadRequest(new { success = false, message = "Phase is locked and cannot be modified" });

        // Update fields
        if (request.PhaseOrder.HasValue) phase.PhaseOrder = request.PhaseOrder.Value;
        if (!string.IsNullOrEmpty(request.PhaseType)) phase.PhaseType = request.PhaseType;
        if (!string.IsNullOrEmpty(request.Name)) phase.Name = request.Name;
        if (request.Description != null) phase.Description = request.Description;
        if (request.IncomingSlotCount.HasValue) phase.IncomingSlotCount = request.IncomingSlotCount.Value;
        if (request.AdvancingSlotCount.HasValue) phase.AdvancingSlotCount = request.AdvancingSlotCount.Value;
        if (request.PoolCount.HasValue) phase.PoolCount = request.PoolCount.Value;
        if (request.StartTime.HasValue) phase.StartTime = request.StartTime.Value;
        if (request.EstimatedMatchDurationMinutes.HasValue) phase.EstimatedMatchDurationMinutes = request.EstimatedMatchDurationMinutes.Value;
        if (request.BestOf.HasValue) phase.BestOf = request.BestOf.Value;
        if (request.RankingCriteria != null) phase.RankingCriteria = request.RankingCriteria;
        if (request.ReseedOption != null) phase.ReseedOption = request.ReseedOption;
        if (request.Settings != null) phase.Settings = request.Settings;
        if (request.IncludeConsolation.HasValue) phase.IncludeConsolation = request.IncludeConsolation.Value;
        if (request.SeedingStrategy != null) phase.SeedingStrategy = request.SeedingStrategy;

        phase.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Phase updated" });
    }

    /// <summary>
    /// Delete a phase
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Organizer")]
    public async Task<IActionResult> DeletePhase(int id)
    {
        var phase = await _context.DivisionPhases
            .Include(p => p.Encounters)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (phase == null)
            return NotFound(new { success = false, message = "Phase not found" });

        if (phase.Status != PhaseStatus.Pending)
            return BadRequest(new { success = false, message = "Cannot delete a phase that has started or completed" });

        _context.DivisionPhases.Remove(phase);
        await _context.SaveChangesAsync();

        // Re-order remaining phases
        var remainingPhases = await _context.DivisionPhases
            .Where(p => p.DivisionId == phase.DivisionId)
            .OrderBy(p => p.PhaseOrder)
            .ToListAsync();

        for (int i = 0; i < remainingPhases.Count; i++)
        {
            remainingPhases[i].PhaseOrder = i + 1;
        }
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Phase deleted" });
    }

    #endregion

    #region Schedule Generation

    /// <summary>
    /// Generate schedule (encounters) for a phase based on its type
    /// </summary>
    [HttpPost("{id}/generate-schedule")]
    [Authorize(Roles = "Admin,Organizer")]
    public async Task<IActionResult> GenerateSchedule(int id)
    {
        var phase = await _context.DivisionPhases
            .Include(p => p.Slots)
            .Include(p => p.Pools)
            .Include(p => p.Division)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (phase == null)
            return NotFound(new { success = false, message = "Phase not found" });

        if (phase.Encounters.Any())
        {
            // Clear existing encounters for regeneration
            var existingEncounters = await _context.EventEncounters
                .Where(e => e.PhaseId == id)
                .ToListAsync();
            _context.EventEncounters.RemoveRange(existingEncounters);
            await _context.SaveChangesAsync();
        }

        int encountersCreated = 0;

        switch (phase.PhaseType)
        {
            case PhaseTypes.RoundRobin:
            case PhaseTypes.Pools:
                encountersCreated = await GenerateRoundRobinSchedule(phase);
                break;

            case PhaseTypes.SingleElimination:
            case PhaseTypes.Bracket:
                encountersCreated = await GenerateSingleEliminationSchedule(phase);
                break;

            case PhaseTypes.DoubleElimination:
                encountersCreated = await GenerateDoubleEliminationSchedule(phase);
                break;

            case PhaseTypes.BracketRound:
                encountersCreated = await GenerateBracketRoundSchedule(phase);
                break;

            default:
                return BadRequest(new { success = false, message = $"Unsupported phase type: {phase.PhaseType}" });
        }

        _logger.LogInformation("Generated {Count} encounters for phase {PhaseId}", encountersCreated, id);

        // Create EncounterMatches based on division's match format configuration
        var matchesCreated = await CreateEncounterMatchesForPhase(phase);
        _logger.LogInformation("Created {Count} encounter matches for phase {PhaseId}", matchesCreated, id);

        // Assign sequential DivisionMatchNumber to all encounters in the division
        await _context.Database.ExecuteSqlRawAsync(
            "EXEC sp_AssignDivisionMatchNumbers @DivisionId = {0}",
            phase.DivisionId);

        return Ok(new { success = true, data = new { encountersCreated, matchesCreated } });
    }

    /// <summary>
    /// Get the schedule (encounters) for a phase with placeholder labels
    /// </summary>
    [HttpGet("{id}/schedule")]
    [AllowAnonymous]
    public async Task<IActionResult> GetSchedule(int id)
    {
        var phase = await _context.DivisionPhases
            .Include(p => p.Division)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (phase == null)
            return NotFound(new { success = false, message = "Phase not found" });

        var encounters = await _context.EventEncounters
            .Where(e => e.PhaseId == id)
            .OrderBy(e => e.PoolId).ThenBy(e => e.RoundNumber).ThenBy(e => e.EncounterNumber)
            .Select(e => new
            {
                e.Id,
                e.EncounterNumber,
                e.DivisionMatchNumber,
                e.EncounterLabel,
                e.RoundType,
                e.RoundNumber,
                e.RoundName,
                e.BracketPosition,
                // Pool info
                PoolId = e.PoolId,
                PoolName = e.Pool != null ? e.Pool.PoolName : null,
                // Unit placeholders or actual units
                Unit1 = new
                {
                    SlotId = e.Unit1SlotId,
                    UnitId = e.Unit1Id,
                    Label = e.Unit1Id != null
                        ? (e.Unit1 != null ? e.Unit1.Name : $"Unit {e.Unit1Id}")
                        : (e.Unit1Slot != null ? e.Unit1Slot.PlaceholderLabel : e.Unit1SeedLabel ?? $"Slot {e.Unit1Number}"),
                    IsResolved = e.Unit1Id != null
                },
                Unit2 = new
                {
                    SlotId = e.Unit2SlotId,
                    UnitId = e.Unit2Id,
                    Label = e.Unit2Id != null
                        ? (e.Unit2 != null ? e.Unit2.Name : $"Unit {e.Unit2Id}")
                        : (e.Unit2Slot != null ? e.Unit2Slot.PlaceholderLabel : e.Unit2SeedLabel ?? $"Slot {e.Unit2Number}"),
                    IsResolved = e.Unit2Id != null
                },
                // Progression
                WinnerNextEncounterId = e.WinnerNextEncounterId,
                LoserNextEncounterId = e.LoserNextEncounterId,
                WinnerSlotPosition = e.WinnerSlotPosition,
                // Court and timing
                CourtId = e.TournamentCourtId,
                CourtLabel = e.TournamentCourt != null ? e.TournamentCourt.CourtLabel : null,
                ScheduledTime = e.ScheduledTime,
                EstimatedStartTime = e.EstimatedStartTime,
                // Status
                e.Status,
                e.WinnerUnitId
            })
            .ToListAsync();

        return Ok(new
        {
            success = true,
            data = new
            {
                phase = new
                {
                    phase.Id,
                    phase.Name,
                    phase.PhaseType,
                    phase.PoolCount,
                    phase.StartTime
                },
                encounters
            }
        });
    }

    #endregion

    #region Advancement Rules

    /// <summary>
    /// Set advancement rules for a phase
    /// </summary>
    [HttpPost("{id}/advancement-rules")]
    [Authorize(Roles = "Admin,Organizer")]
    public async Task<IActionResult> SetAdvancementRules(int id, [FromBody] List<AdvancementRuleRequest> rules)
    {
        var phase = await _context.DivisionPhases.FindAsync(id);
        if (phase == null)
            return NotFound(new { success = false, message = "Phase not found" });

        // Clear existing outgoing rules
        var existingRules = await _context.PhaseAdvancementRules
            .Where(r => r.SourcePhaseId == id)
            .ToListAsync();
        _context.PhaseAdvancementRules.RemoveRange(existingRules);

        // Add new rules
        foreach (var rule in rules)
        {
            var advancementRule = new PhaseAdvancementRule
            {
                SourcePhaseId = id,
                SourcePoolId = rule.SourcePoolId,
                SourceRank = rule.SourceRank,
                TargetPhaseId = rule.TargetPhaseId,
                TargetSlotNumber = rule.TargetSlotNumber,
                Description = rule.Description,
                ProcessOrder = rule.ProcessOrder ?? rules.IndexOf(rule) + 1
            };
            _context.PhaseAdvancementRules.Add(advancementRule);
        }

        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = $"{rules.Count} advancement rules saved" });
    }

    /// <summary>
    /// Auto-generate advancement rules using snake seeding from source phase pools to target phase.
    /// Snake order: 1A, 1B, 2B, 2A, 3A, 3B, 4B, 4A... (standard for fair bracket seeding)
    /// </summary>
    [HttpPost("{id}/auto-advancement-rules")]
    [Authorize(Roles = "Admin,Organizer")]
    public async Task<IActionResult> GenerateSnakeAdvancementRules(int id, [FromBody] AutoAdvancementRequest request)
    {
        var targetPhase = await _context.DivisionPhases.FindAsync(id);
        if (targetPhase == null)
            return NotFound(new { success = false, message = "Target phase not found" });

        var sourcePhase = await _context.DivisionPhases
            .Include(p => p.Pools)
            .FirstOrDefaultAsync(p => p.Id == request.SourcePhaseId);

        if (sourcePhase == null)
            return NotFound(new { success = false, message = "Source phase not found" });

        if (!sourcePhase.Pools.Any())
            return BadRequest(new { success = false, message = "Source phase has no pools" });

        // Clear existing incoming rules for this target phase from this source
        var existingRules = await _context.PhaseAdvancementRules
            .Where(r => r.TargetPhaseId == id && r.SourcePhaseId == request.SourcePhaseId)
            .ToListAsync();
        _context.PhaseAdvancementRules.RemoveRange(existingRules);

        var pools = sourcePhase.Pools.OrderBy(p => p.PoolOrder).ToList();
        int poolCount = pools.Count;
        int advancingPerPool = request.AdvancingPerPool ?? (targetPhase.IncomingSlotCount / poolCount);

        var rules = new List<PhaseAdvancementRule>();
        int targetSlot = 1;
        string seedingStrategy = targetPhase.SeedingStrategy ?? SeedingStrategies.Snake;

        if (seedingStrategy == SeedingStrategies.Snake)
        {
            // Snake draft: 1A, 1B, 2B, 2A, 3A, 3B, 4B, 4A...
            for (int rank = 1; rank <= advancingPerPool; rank++)
            {
                bool forward = (rank % 2 == 1);
                var orderedPools = forward ? pools : pools.AsEnumerable().Reverse();

                foreach (var pool in orderedPools)
                {
                    rules.Add(new PhaseAdvancementRule
                    {
                        SourcePhaseId = sourcePhase.Id,
                        SourcePoolId = pool.Id,
                        SourceRank = rank,
                        TargetPhaseId = id,
                        TargetSlotNumber = targetSlot,
                        Description = $"Pool {pool.PoolName} #{rank} → Seed {targetSlot}",
                        ProcessOrder = targetSlot
                    });
                    targetSlot++;
                }
            }
        }
        else if (seedingStrategy == SeedingStrategies.Sequential)
        {
            // Sequential: 1A, 2A, 3A, 4A, 1B, 2B, 3B, 4B...
            foreach (var pool in pools)
            {
                for (int rank = 1; rank <= advancingPerPool; rank++)
                {
                    rules.Add(new PhaseAdvancementRule
                    {
                        SourcePhaseId = sourcePhase.Id,
                        SourcePoolId = pool.Id,
                        SourceRank = rank,
                        TargetPhaseId = id,
                        TargetSlotNumber = targetSlot,
                        Description = $"Pool {pool.PoolName} #{rank} → Seed {targetSlot}",
                        ProcessOrder = targetSlot
                    });
                    targetSlot++;
                }
            }
        }
        else if (seedingStrategy == SeedingStrategies.CrossPool && poolCount == 2)
        {
            // Cross-pool for 2 pools: 1A vs 2B, 1B vs 2A matchups
            // Seed 1: 1A, Seed 2: 2B, Seed 3: 1B, Seed 4: 2A
            var poolA = pools[0];
            var poolB = pools[1];

            rules.Add(new PhaseAdvancementRule { SourcePhaseId = sourcePhase.Id, SourcePoolId = poolA.Id, SourceRank = 1, TargetPhaseId = id, TargetSlotNumber = 1, Description = $"Pool {poolA.PoolName} #1 → Seed 1", ProcessOrder = 1 });
            rules.Add(new PhaseAdvancementRule { SourcePhaseId = sourcePhase.Id, SourcePoolId = poolB.Id, SourceRank = 2, TargetPhaseId = id, TargetSlotNumber = 2, Description = $"Pool {poolB.PoolName} #2 → Seed 2", ProcessOrder = 2 });
            rules.Add(new PhaseAdvancementRule { SourcePhaseId = sourcePhase.Id, SourcePoolId = poolB.Id, SourceRank = 1, TargetPhaseId = id, TargetSlotNumber = 3, Description = $"Pool {poolB.PoolName} #1 → Seed 3", ProcessOrder = 3 });
            rules.Add(new PhaseAdvancementRule { SourcePhaseId = sourcePhase.Id, SourcePoolId = poolA.Id, SourceRank = 2, TargetPhaseId = id, TargetSlotNumber = 4, Description = $"Pool {poolA.PoolName} #2 → Seed 4", ProcessOrder = 4 });
        }

        _context.PhaseAdvancementRules.AddRange(rules);
        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Generated {Count} advancement rules from phase {SourceId} to {TargetId} using {Strategy} seeding",
            rules.Count, sourcePhase.Id, id, seedingStrategy);

        return Ok(new
        {
            success = true,
            data = new
            {
                rulesCreated = rules.Count,
                seedingStrategy,
                rules = rules.Select(r => new { r.SourcePoolId, r.SourceRank, r.TargetSlotNumber, r.Description })
            }
        });
    }

    #endregion

    #region Court Assignment

    /// <summary>
    /// Assign court groups to a phase
    /// </summary>
    [HttpPost("{id}/court-assignments")]
    [Authorize(Roles = "Admin,Organizer")]
    public async Task<IActionResult> SetCourtAssignments(int id, [FromBody] List<CourtAssignmentRequest> assignments)
    {
        var phase = await _context.DivisionPhases.FindAsync(id);
        if (phase == null)
            return NotFound(new { success = false, message = "Phase not found" });

        // Clear existing assignments for this phase
        var existingAssignments = await _context.DivisionCourtAssignments
            .Where(a => a.PhaseId == id)
            .ToListAsync();
        _context.DivisionCourtAssignments.RemoveRange(existingAssignments);

        // Add new assignments
        foreach (var assignment in assignments)
        {
            var courtAssignment = new DivisionCourtAssignment
            {
                DivisionId = phase.DivisionId,
                PhaseId = id,
                CourtGroupId = assignment.CourtGroupId,
                Priority = assignment.Priority ?? 0,
                ValidFromTime = assignment.ValidFromTime,
                ValidToTime = assignment.ValidToTime
            };
            _context.DivisionCourtAssignments.Add(courtAssignment);
        }

        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = $"{assignments.Count} court assignments saved" });
    }

    /// <summary>
    /// Auto-assign courts to encounters based on court group assignments
    /// </summary>
    [HttpPost("{id}/auto-assign-courts")]
    [Authorize(Roles = "Admin,Organizer")]
    public async Task<IActionResult> AutoAssignCourts(int id)
    {
        var result = await _courtAssignmentService.AutoAssignPhaseAsync(id);

        if (!result.Success)
            return BadRequest(new { success = false, message = result.Message });

        return Ok(new { success = true, data = new { assigned = result.AssignedCount, totalCourts = result.CourtsUsed } });
    }

    /// <summary>
    /// Calculate estimated start times for encounters
    /// </summary>
    [HttpPost("{id}/calculate-times")]
    [Authorize(Roles = "Admin,Organizer")]
    public async Task<IActionResult> CalculateEstimatedTimes(int id)
    {
        var result = await _courtAssignmentService.CalculatePhaseTimesAsync(id);

        if (!result.Success)
            return BadRequest(new { success = false, message = result.Message });

        return Ok(new { success = true, data = new { updated = result.UpdatedCount, estimatedEndTime = result.EstimatedEndTime } });
    }

    #endregion

    #region Private Helpers

    /// <summary>
    /// Create EncounterMatch records for all encounters in a phase based on division's match format configuration
    /// </summary>
    private async Task<int> CreateEncounterMatchesForPhase(DivisionPhase phase)
    {
        // Get encounters for this phase
        var encounters = await _context.EventEncounters
            .Where(e => e.PhaseId == phase.Id)
            .ToListAsync();

        if (!encounters.Any())
            return 0;

        // Get division's match format configuration
        var matchFormats = await _context.EncounterMatchFormats
            .Where(f => f.DivisionId == phase.DivisionId && f.IsActive)
            .OrderBy(f => f.SortOrder)
            .ThenBy(f => f.MatchNumber)
            .ToListAsync();

        // Get division's MatchesPerEncounter setting
        var division = await _context.EventDivisions.FindAsync(phase.DivisionId);
        var matchesPerEncounter = division?.MatchesPerEncounter ?? 1;

        int totalMatchesCreated = 0;

        foreach (var encounter in encounters)
        {
            if (matchesPerEncounter > 1 && matchFormats.Any())
            {
                // Create one EncounterMatch per format
                int matchOrder = 1;
                foreach (var format in matchFormats)
                {
                    var encounterMatch = new EncounterMatch
                    {
                        EncounterId = encounter.Id,
                        FormatId = format.Id,
                        MatchOrder = matchOrder++,
                        Status = "Scheduled"
                    };
                    _context.EncounterMatches.Add(encounterMatch);
                    totalMatchesCreated++;
                }
            }
            else
            {
                // Create a single EncounterMatch for simple tournaments
                var encounterMatch = new EncounterMatch
                {
                    EncounterId = encounter.Id,
                    MatchOrder = 1,
                    Status = "Scheduled"
                };
                _context.EncounterMatches.Add(encounterMatch);
                totalMatchesCreated++;
            }
        }

        await _context.SaveChangesAsync();
        return totalMatchesCreated;
    }

    private async Task CreatePhaseSlots(int phaseId, int count, string slotType)
    {
        for (int i = 1; i <= count; i++)
        {
            var slot = new PhaseSlot
            {
                PhaseId = phaseId,
                SlotType = slotType,
                SlotNumber = i,
                SourceType = slotType == SlotTypes.Incoming ? SlotSourceTypes.Seeded : SlotSourceTypes.RankFromPhase,
                PlaceholderLabel = slotType == SlotTypes.Incoming ? $"Team {i}" : $"#{i}"
            };
            _context.PhaseSlots.Add(slot);
        }
        await _context.SaveChangesAsync();
    }

    private async Task CreatePhasePools(int phaseId, int poolCount, int totalSlots)
    {
        var slotsPerPool = (int)Math.Ceiling((double)totalSlots / poolCount);
        var slots = await _context.PhaseSlots
            .Where(s => s.PhaseId == phaseId && s.SlotType == SlotTypes.Incoming)
            .OrderBy(s => s.SlotNumber)
            .ToListAsync();

        for (int p = 0; p < poolCount; p++)
        {
            var poolName = ((char)('A' + p)).ToString();
            var pool = new PhasePool
            {
                PhaseId = phaseId,
                PoolName = poolName,
                PoolOrder = p + 1,
                SlotCount = Math.Min(slotsPerPool, totalSlots - p * slotsPerPool)
            };
            _context.PhasePools.Add(pool);
            await _context.SaveChangesAsync();

            // Assign slots to pool using snake draft (1-2-3-4, 8-7-6-5, etc.)
            var poolSlots = new List<PhaseSlot>();
            for (int i = 0; i < pool.SlotCount; i++)
            {
                int slotIndex;
                if (p % 2 == 0)
                {
                    slotIndex = p * slotsPerPool + i;
                }
                else
                {
                    slotIndex = (p + 1) * slotsPerPool - 1 - i;
                }

                if (slotIndex < slots.Count)
                {
                    var poolSlot = new PhasePoolSlot
                    {
                        PoolId = pool.Id,
                        SlotId = slots[slotIndex].Id,
                        PoolPosition = i + 1
                    };
                    _context.PhasePoolSlots.Add(poolSlot);
                    // Keep original "Team X" label - pool assignment tracked via PhasePoolSlot
                }
            }
        }
        await _context.SaveChangesAsync();
    }

    private async Task<int> GenerateRoundRobinSchedule(DivisionPhase phase)
    {
        int encountersCreated = 0;
        int globalEncounterNumber = 1;

        if (phase.PoolCount > 1)
        {
            // Multi-pool round robin
            var pools = await _context.PhasePools
                .Where(p => p.PhaseId == phase.Id)
                .Include(p => p.PoolSlots)
                    .ThenInclude(ps => ps.Slot)
                .OrderBy(p => p.PoolOrder)
                .ToListAsync();

            foreach (var pool in pools)
            {
                var slots = pool.PoolSlots.OrderBy(ps => ps.PoolPosition).Select(ps => ps.Slot!).ToList();
                var (created, nextNumber) = await GenerateRoundRobinForSlots(phase, slots, pool.Id, globalEncounterNumber);
                encountersCreated += created;
                globalEncounterNumber = nextNumber;
            }
        }
        else
        {
            // Single pool round robin
            var slots = await _context.PhaseSlots
                .Where(s => s.PhaseId == phase.Id && s.SlotType == SlotTypes.Incoming)
                .OrderBy(s => s.SlotNumber)
                .ToListAsync();

            var (created, _) = await GenerateRoundRobinForSlots(phase, slots, null, globalEncounterNumber);
            encountersCreated = created;
        }

        return encountersCreated;
    }

    private async Task<(int created, int encounterNumber)> GenerateRoundRobinForSlots(DivisionPhase phase, List<PhaseSlot> slots, int? poolId, int encounterNumber)
    {
        int created = 0;
        int n = slots.Count;

        // Circle method for round robin
        // For n teams, we need n-1 rounds (or n rounds if odd)
        int rounds = n % 2 == 0 ? n - 1 : n;

        for (int round = 1; round <= rounds; round++)
        {
            for (int i = 0; i < n / 2; i++)
            {
                int home = (round + i) % (n - 1);
                int away = (n - 1 - i + round) % (n - 1);

                // Last team stays fixed for even numbers
                if (i == 0 && n % 2 == 0)
                {
                    away = n - 1;
                }

                if (home < n && away < n && home != away)
                {
                    var encounter = new EventEncounter
                    {
                        EventId = phase.Division!.EventId,
                        DivisionId = phase.DivisionId,
                        PhaseId = phase.Id,
                        PoolId = poolId,
                        RoundType = "Pool",
                        RoundNumber = round,
                        RoundName = poolId != null ? $"Round {round}" : $"Round {round}",
                        EncounterNumber = encounterNumber++,
                        EncounterLabel = $"M{encounterNumber - 1}",
                        Unit1SlotId = slots[home].Id,
                        Unit2SlotId = slots[away].Id,
                        Unit1SeedLabel = slots[home].PlaceholderLabel,
                        Unit2SeedLabel = slots[away].PlaceholderLabel,
                        BestOf = phase.BestOf ?? 1,
                        Status = "Scheduled"
                    };
                    _context.EventEncounters.Add(encounter);
                    created++;
                }
            }
        }

        await _context.SaveChangesAsync();
        return (created, encounterNumber);
    }

    private async Task<int> GenerateSingleEliminationSchedule(DivisionPhase phase)
    {
        var slots = await _context.PhaseSlots
            .Where(s => s.PhaseId == phase.Id && s.SlotType == SlotTypes.Incoming)
            .OrderBy(s => s.SlotNumber)
            .ToListAsync();

        int n = slots.Count;
        // Calculate bracket size (next power of 2)
        int bracketSize = 1;
        while (bracketSize < n) bracketSize *= 2;

        int totalRounds = (int)Math.Ceiling(Math.Log2(bracketSize));
        var roundEncounters = new Dictionary<int, List<EventEncounter>>();
        int encounterNumber = 1;

        // Generate rounds from first round to final
        for (int round = 1; round <= totalRounds; round++)
        {
            int matchesInRound = bracketSize / (int)Math.Pow(2, round);
            roundEncounters[round] = new List<EventEncounter>();

            string roundName = round == totalRounds ? "Final"
                : round == totalRounds - 1 ? "Semifinal"
                : round == totalRounds - 2 ? "Quarterfinal"
                : $"Round {round}";

            for (int pos = 1; pos <= matchesInRound; pos++)
            {
                var encounter = new EventEncounter
                {
                    EventId = phase.Division!.EventId,
                    DivisionId = phase.DivisionId,
                    PhaseId = phase.Id,
                    RoundType = "Bracket",
                    RoundNumber = round,
                    RoundName = roundName,
                    EncounterNumber = encounterNumber,
                    EncounterLabel = round == totalRounds ? "Final"
                        : round == totalRounds - 1 ? $"SF{pos}"
                        : round == totalRounds - 2 ? $"QF{pos}"
                        : $"R{round}M{pos}",
                    BracketPosition = pos,
                    BestOf = phase.BestOf ?? 1,
                    Status = "Scheduled"
                };

                // First round: assign slots
                if (round == 1)
                {
                    int slot1Index = (pos - 1) * 2;
                    int slot2Index = slot1Index + 1;

                    if (slot1Index < slots.Count)
                    {
                        encounter.Unit1SlotId = slots[slot1Index].Id;
                        encounter.Unit1SeedLabel = slots[slot1Index].PlaceholderLabel;
                    }
                    if (slot2Index < slots.Count)
                    {
                        encounter.Unit2SlotId = slots[slot2Index].Id;
                        encounter.Unit2SeedLabel = slots[slot2Index].PlaceholderLabel;
                    }
                    else
                    {
                        // Bye - slot1 advances automatically
                        encounter.Status = "Bye";
                    }
                }
                else
                {
                    // Later rounds: set placeholder labels
                    var prevRound = roundEncounters[round - 1];
                    int prevMatch1 = (pos - 1) * 2;
                    int prevMatch2 = prevMatch1 + 1;

                    if (prevMatch1 < prevRound.Count)
                    {
                        encounter.Unit1SeedLabel = $"Winner {prevRound[prevMatch1].EncounterLabel}";
                    }
                    if (prevMatch2 < prevRound.Count)
                    {
                        encounter.Unit2SeedLabel = $"Winner {prevRound[prevMatch2].EncounterLabel}";
                    }
                }

                _context.EventEncounters.Add(encounter);
                roundEncounters[round].Add(encounter);
                encounterNumber++;
            }
        }

        await _context.SaveChangesAsync();

        // Link bracket progression
        for (int round = 1; round < totalRounds; round++)
        {
            var currentRound = roundEncounters[round];
            var nextRound = roundEncounters[round + 1];

            for (int i = 0; i < currentRound.Count; i++)
            {
                int nextMatchIndex = i / 2;
                if (nextMatchIndex < nextRound.Count)
                {
                    currentRound[i].WinnerNextEncounterId = nextRound[nextMatchIndex].Id;
                    currentRound[i].WinnerSlotPosition = (i % 2) + 1; // 1 or 2
                }
            }
        }

        await _context.SaveChangesAsync();

        return encounterNumber - 1;
    }

    private async Task<int> GenerateDoubleEliminationSchedule(DivisionPhase phase)
    {
        // For now, use single elimination as base
        // Full double elimination implementation is more complex
        var created = await GenerateSingleEliminationSchedule(phase);

        _logger.LogWarning("Double elimination schedule generated using single elimination logic. Full implementation pending.");

        return created;
    }

    /// <summary>
    /// Generate a single bracket round (e.g., just Semifinal or just Final).
    /// Creates N/2 matches for N incoming teams, plus optional consolation match.
    /// </summary>
    private async Task<int> GenerateBracketRoundSchedule(DivisionPhase phase)
    {
        var slots = await _context.PhaseSlots
            .Where(s => s.PhaseId == phase.Id && s.SlotType == SlotTypes.Incoming)
            .OrderBy(s => s.SlotNumber)
            .ToListAsync();

        int n = slots.Count;
        if (n < 2)
        {
            _logger.LogWarning("BracketRound phase {PhaseId} has fewer than 2 incoming slots", phase.Id);
            return 0;
        }

        int encountersCreated = 0;
        int encounterNumber = 1;
        var bracketMatches = new List<EventEncounter>();

        // Handle odd number of teams: top seed gets bye
        bool hasBye = n % 2 == 1;
        int matchCount = n / 2;

        // Create bracket matches
        for (int i = 0; i < matchCount; i++)
        {
            int slot1Index = i * 2;
            int slot2Index = slot1Index + 1;

            // If odd number and this is the last potential match, skip (top seed has bye)
            if (hasBye && slot2Index >= n)
            {
                break;
            }

            var encounter = new EventEncounter
            {
                EventId = phase.Division!.EventId,
                DivisionId = phase.DivisionId,
                PhaseId = phase.Id,
                RoundType = "Bracket",
                RoundNumber = 1,
                RoundName = phase.Name, // Use phase name directly (e.g., "Semifinal", "Final")
                EncounterNumber = encounterNumber,
                EncounterLabel = matchCount == 1 ? phase.Name : $"{phase.Name} {i + 1}",
                BracketPosition = i + 1,
                Unit1SlotId = slots[slot1Index].Id,
                Unit1SeedLabel = slots[slot1Index].PlaceholderLabel,
                BestOf = phase.BestOf ?? 1,
                Status = "Scheduled"
            };

            if (slot2Index < slots.Count)
            {
                encounter.Unit2SlotId = slots[slot2Index].Id;
                encounter.Unit2SeedLabel = slots[slot2Index].PlaceholderLabel;
            }
            else
            {
                encounter.Status = "Bye";
            }

            _context.EventEncounters.Add(encounter);
            bracketMatches.Add(encounter);
            encounterNumber++;
            encountersCreated++;
        }

        await _context.SaveChangesAsync();

        // Create consolation match if enabled (for 4-team semifinals: losers play for 3rd)
        EventEncounter? consolationMatch = null;
        if (phase.IncludeConsolation && matchCount >= 2)
        {
            consolationMatch = new EventEncounter
            {
                EventId = phase.Division!.EventId,
                DivisionId = phase.DivisionId,
                PhaseId = phase.Id,
                RoundType = "Consolation",
                RoundNumber = 2, // Plays after bracket round
                RoundName = "3rd Place",
                EncounterNumber = encounterNumber,
                EncounterLabel = "3rd Place",
                BracketPosition = 1,
                Unit1SeedLabel = $"Loser {bracketMatches[0].EncounterLabel}",
                Unit2SeedLabel = $"Loser {bracketMatches[1].EncounterLabel}",
                BestOf = phase.BestOf ?? 1,
                Status = "Scheduled"
            };

            _context.EventEncounters.Add(consolationMatch);
            encountersCreated++;

            await _context.SaveChangesAsync();

            // Link semifinal losers to consolation match
            bracketMatches[0].LoserNextEncounterId = consolationMatch.Id;
            bracketMatches[0].LoserSlotPosition = 1;
            bracketMatches[1].LoserNextEncounterId = consolationMatch.Id;
            bracketMatches[1].LoserSlotPosition = 2;
        }

        // If there's a next phase (e.g., Final after Semifinal), link winners
        // This is done via advancement rules, not hardcoded here

        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Generated {Count} encounters for BracketRound phase {PhaseId} ({Name}), consolation: {Consolation}",
            encountersCreated, phase.Id, phase.Name, phase.IncludeConsolation);

        return encountersCreated;
    }

    #endregion
}

#region Request Models

public class CreatePhaseRequest
{
    public int DivisionId { get; set; }
    public int? PhaseOrder { get; set; }
    public string? PhaseType { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public int IncomingSlotCount { get; set; }
    public int AdvancingSlotCount { get; set; }
    public int? PoolCount { get; set; }
    public DateTime? StartTime { get; set; }
    public int? EstimatedMatchDurationMinutes { get; set; }
    public int? BestOf { get; set; }
    public string? RankingCriteria { get; set; }
    public string? ReseedOption { get; set; }
    public string? Settings { get; set; }
    /// <summary>
    /// Include 3rd place match for semifinal losers (BracketRound phases)
    /// </summary>
    public bool IncludeConsolation { get; set; }
    /// <summary>
    /// Seeding strategy from pools: Snake, Sequential, CrossPool
    /// </summary>
    public string? SeedingStrategy { get; set; }
}

public class UpdatePhaseRequest
{
    public int? PhaseOrder { get; set; }
    public string? PhaseType { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public int? IncomingSlotCount { get; set; }
    public int? AdvancingSlotCount { get; set; }
    public int? PoolCount { get; set; }
    public DateTime? StartTime { get; set; }
    public int? EstimatedMatchDurationMinutes { get; set; }
    public int? BestOf { get; set; }
    public string? RankingCriteria { get; set; }
    public string? ReseedOption { get; set; }
    public string? Settings { get; set; }
    public bool? IncludeConsolation { get; set; }
    public string? SeedingStrategy { get; set; }
}

public class AdvancementRuleRequest
{
    public int? SourcePoolId { get; set; }
    public int SourceRank { get; set; }
    public int TargetPhaseId { get; set; }
    public int TargetSlotNumber { get; set; }
    public string? Description { get; set; }
    public int? ProcessOrder { get; set; }
}

public class CourtAssignmentRequest
{
    public int CourtGroupId { get; set; }
    public int? Priority { get; set; }
    public TimeSpan? ValidFromTime { get; set; }
    public TimeSpan? ValidToTime { get; set; }
}

public class AutoAdvancementRequest
{
    /// <summary>
    /// Source phase ID (pool play phase to advance from)
    /// </summary>
    public int SourcePhaseId { get; set; }
    /// <summary>
    /// Number of teams advancing per pool (optional, defaults to target slots / pool count)
    /// </summary>
    public int? AdvancingPerPool { get; set; }
}

#endregion
