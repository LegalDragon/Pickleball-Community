using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;

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

    public DivisionPhasesController(ApplicationDbContext context, ILogger<DivisionPhasesController> logger)
    {
        _context = context;
        _logger = logger;
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
            Settings = request.Settings
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

            default:
                return BadRequest(new { success = false, message = $"Unsupported phase type: {phase.PhaseType}" });
        }

        _logger.LogInformation("Generated {Count} encounters for phase {PhaseId}", encountersCreated, id);

        return Ok(new { success = true, data = new { encountersCreated } });
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
        var phase = await _context.DivisionPhases
            .Include(p => p.Division)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (phase == null)
            return NotFound(new { success = false, message = "Phase not found" });

        // Get court assignments for this phase (or division-level)
        var courtAssignments = await _context.DivisionCourtAssignments
            .Where(a => a.DivisionId == phase.DivisionId && (a.PhaseId == id || a.PhaseId == null))
            .OrderBy(a => a.Priority)
            .Include(a => a.CourtGroup)
                .ThenInclude(g => g!.Courts)
            .ToListAsync();

        if (!courtAssignments.Any())
            return BadRequest(new { success = false, message = "No court groups assigned to this phase" });

        // Get available courts from assigned groups
        var availableCourts = courtAssignments
            .SelectMany(a => a.CourtGroup?.Courts ?? new List<TournamentCourt>())
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ToList();

        if (!availableCourts.Any())
            return BadRequest(new { success = false, message = "No active courts in assigned groups" });

        // Get encounters without court assignments
        var encounters = await _context.EventEncounters
            .Where(e => e.PhaseId == id && e.TournamentCourtId == null)
            .OrderBy(e => e.PoolId).ThenBy(e => e.RoundNumber).ThenBy(e => e.EncounterNumber)
            .ToListAsync();

        // Simple round-robin court assignment
        int courtIndex = 0;
        int assigned = 0;
        foreach (var encounter in encounters)
        {
            encounter.TournamentCourtId = availableCourts[courtIndex].Id;
            courtIndex = (courtIndex + 1) % availableCourts.Count;
            assigned++;
        }

        await _context.SaveChangesAsync();

        return Ok(new { success = true, data = new { assigned, totalCourts = availableCourts.Count } });
    }

    /// <summary>
    /// Calculate estimated start times for encounters
    /// </summary>
    [HttpPost("{id}/calculate-times")]
    [Authorize(Roles = "Admin,Organizer")]
    public async Task<IActionResult> CalculateEstimatedTimes(int id)
    {
        var phase = await _context.DivisionPhases
            .Include(p => p.Division)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (phase == null)
            return NotFound(new { success = false, message = "Phase not found" });

        if (!phase.StartTime.HasValue)
            return BadRequest(new { success = false, message = "Phase start time not set" });

        var matchDuration = phase.EstimatedMatchDurationMinutes
            ?? phase.Division?.EstimatedMatchDurationMinutes
            ?? 20;

        // Get encounters grouped by court
        var encounters = await _context.EventEncounters
            .Where(e => e.PhaseId == id && e.TournamentCourtId != null)
            .OrderBy(e => e.TournamentCourtId).ThenBy(e => e.RoundNumber).ThenBy(e => e.EncounterNumber)
            .ToListAsync();

        // Calculate times per court
        var courtTimes = new Dictionary<int, DateTime>();
        int updated = 0;

        foreach (var encounter in encounters)
        {
            var courtId = encounter.TournamentCourtId!.Value;

            if (!courtTimes.ContainsKey(courtId))
            {
                courtTimes[courtId] = phase.StartTime.Value;
            }

            encounter.EstimatedStartTime = courtTimes[courtId];
            courtTimes[courtId] = courtTimes[courtId].AddMinutes(matchDuration);
            updated++;
        }

        await _context.SaveChangesAsync();

        // Update phase end time
        if (courtTimes.Any())
        {
            phase.EstimatedEndTime = courtTimes.Values.Max();
            await _context.SaveChangesAsync();
        }

        return Ok(new { success = true, data = new { updated, estimatedEndTime = phase.EstimatedEndTime } });
    }

    #endregion

    #region Private Helpers

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
                PlaceholderLabel = slotType == SlotTypes.Incoming ? $"Seed {i}" : $"#{i}"
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

                    // Update slot label
                    slots[slotIndex].PlaceholderLabel = $"Pool {poolName} Seed {i + 1}";
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

#endregion
