using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Services;

// =====================================================
// DTOs for Scheduling Service
// =====================================================

public class ScheduleRequest
{
    public int EventId { get; set; }
    public int? DivisionId { get; set; }
    public int? PhaseId { get; set; }
    public DateTime? StartTime { get; set; }
    public int? MatchDurationMinutes { get; set; }
    public int? RestTimeMinutes { get; set; }
    public bool ClearExisting { get; set; } = true;
    public bool RespectPlayerOverlap { get; set; } = true;
    public List<int>? EncounterIds { get; set; }
    /// <summary>
    /// Pool scheduling mode: "interleaved" (default) or "block"
    /// - Interleaved: Pool A R1G1, Pool B R1G1, Pool A R1G2, Pool B R1G2... (fair progression)
    /// - Block: Pool A R1 complete, then Pool B R1 complete... (faster per-pool completion)
    /// </summary>
    public string PoolSchedulingMode { get; set; } = "interleaved";
}

public class ScheduleResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public int AssignedCount { get; set; }
    public int CourtsUsed { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EstimatedEndTime { get; set; }
    public List<ScheduleConflict> Conflicts { get; set; } = new();
    public List<ScheduledEncounterInfo> Assignments { get; set; } = new();
}

public class ScheduledEncounterInfo
{
    public int EncounterId { get; set; }
    public int CourtId { get; set; }
    public string CourtLabel { get; set; } = "";
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string? Unit1Name { get; set; }
    public string? Unit2Name { get; set; }
}

public class ScheduleConflict
{
    public string Type { get; set; } = "";
    public string Description { get; set; } = "";
    public int? EncounterId1 { get; set; }
    public int? EncounterId2 { get; set; }
    public int? PlayerId { get; set; }
    public string? PlayerName { get; set; }
}

public class ScheduleValidationResultNew
{
    public bool IsValid { get; set; }
    public List<ScheduleConflict> Conflicts { get; set; } = new();
    public int TotalEncounters { get; set; }
    public int ScheduledEncounters { get; set; }
    public int UnscheduledEncounters { get; set; }
}

// =====================================================
// Auto-Allocation DTOs
// =====================================================

public class AutoAllocateRequest
{
    public int EventId { get; set; }
    public List<ScheduleBlockAllocation> Blocks { get; set; } = new();
    public bool ClearExisting { get; set; } = true;
    public bool RespectPlayerOverlap { get; set; } = true;
}

public class ScheduleBlockAllocation
{
    public int DivisionId { get; set; }
    public int? PhaseId { get; set; }
    public List<int> CourtIds { get; set; } = new();
    public int? CourtGroupId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int? MatchDurationMinutes { get; set; }
    public int? RestTimeMinutes { get; set; }
}

public class AutoAllocateResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public int TotalAssigned { get; set; }
    public int TotalSkipped { get; set; }
    public List<BlockAllocationResult> BlockResults { get; set; } = new();
    public List<ScheduleConflict> Conflicts { get; set; } = new();
}

public class BlockAllocationResult
{
    public int DivisionId { get; set; }
    public string? DivisionName { get; set; }
    public int? PhaseId { get; set; }
    public string? PhaseName { get; set; }
    public int AssignedCount { get; set; }
    public int TotalEncounters { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int CourtsUsed { get; set; }
    public string? Warning { get; set; }
}

public class MoveEncounterRequest
{
    public int CourtId { get; set; }
    public DateTime StartTime { get; set; }
}

public class MoveEncounterResult
{
    public int EncounterId { get; set; }
    public int CourtId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public bool HasConflicts { get; set; }
    public List<ScheduleConflict> Conflicts { get; set; } = new();
}

public class SaveBlocksRequest
{
    public List<BlockAllocationSave> Blocks { get; set; } = new();
}

public class BlockAllocationSave
{
    public int DivisionId { get; set; }
    public int? PhaseId { get; set; }
    public int CourtGroupId { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? Priority { get; set; }
}

// Schedule Grid DTOs
public class ScheduleGridData
{
    public int EventId { get; set; }
    public string EventName { get; set; } = "";
    public DateTime EventDate { get; set; }
    public DateTime GridStartTime { get; set; }
    public DateTime GridEndTime { get; set; }
    public List<ScheduleGridCourt> Courts { get; set; } = new();
    public List<ScheduleGridDivision> Divisions { get; set; } = new();
    public List<ScheduleGridEncounter> Encounters { get; set; } = new();
    public List<ScheduleGridBlock> Blocks { get; set; } = new();
    public int TotalEncounters { get; set; }
    public int ScheduledEncounters { get; set; }
    public int UnscheduledEncounters { get; set; }
}

public class ScheduleGridCourt
{
    public int Id { get; set; }
    public string Label { get; set; } = "";
    public int SortOrder { get; set; }
}

public class ScheduleGridDivision
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int EstimatedMatchDurationMinutes { get; set; }
    public int MinRestTimeMinutes { get; set; }
    public List<ScheduleGridPhase> Phases { get; set; } = new();
}

public class ScheduleGridPhase
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string PhaseType { get; set; } = "";
    public int PhaseOrder { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EstimatedEndTime { get; set; }
}

public class ScheduleGridEncounter
{
    public int Id { get; set; }
    public int DivisionId { get; set; }
    public int? PhaseId { get; set; }
    public string RoundType { get; set; } = "";
    public int RoundNumber { get; set; }
    public string? RoundName { get; set; }
    public int EncounterNumber { get; set; }
    public string? EncounterLabel { get; set; }
    public string? Unit1Name { get; set; }
    public string? Unit2Name { get; set; }
    public int? CourtId { get; set; }
    public string? CourtLabel { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? DurationMinutes { get; set; }
    public string Status { get; set; } = "";
    public string? PhaseName { get; set; }
}

public class ScheduleGridBlock
{
    public int Id { get; set; }
    public int DivisionId { get; set; }
    public string DivisionName { get; set; } = "";
    public int? PhaseId { get; set; }
    public string? PhaseName { get; set; }
    public int CourtGroupId { get; set; }
    public string CourtGroupName { get; set; } = "";
    public List<int> CourtIds { get; set; } = new();
    public string? ValidFromTime { get; set; }
    public string? ValidToTime { get; set; }
}

// =====================================================
// Interface
// =====================================================

public interface ISchedulingService
{
    /// <summary>
    /// Generate a complete schedule for all encounters in a division or phase.
    /// Assigns courts and estimated start times respecting all constraints.
    /// </summary>
    Task<ScheduleResult> GenerateScheduleAsync(ScheduleRequest request);

    /// <summary>
    /// Validate a schedule for conflicts (player overlap, court double-booking, insufficient rest).
    /// </summary>
    Task<ScheduleValidationResultNew> ValidateScheduleAsync(int eventId, int? divisionId = null);

    /// <summary>
    /// Clear all schedule assignments for a division or phase.
    /// </summary>
    Task<int> ClearScheduleAsync(int divisionId, int? phaseId = null);

    /// <summary>
    /// Get available courts for a division/phase based on court group assignments.
    /// </summary>
    Task<List<TournamentCourt>> GetAvailableCourtsAsync(int divisionId, int? phaseId = null);

    /// <summary>
    /// Auto-assign a single encounter to the best available court and time.
    /// Used during game day for on-the-fly scheduling.
    /// </summary>
    Task<ScheduleResult> AssignSingleEncounterAsync(int encounterId);

    /// <summary>
    /// Auto-allocate encounters across time blocks.
    /// Each block specifies division+phase → courts + time window.
    /// The scheduler places matches within those constraints, avoiding player conflicts.
    /// </summary>
    Task<AutoAllocateResult> AutoAllocateAsync(AutoAllocateRequest request);
}

// =====================================================
// Implementation
// =====================================================

public class SchedulingService : ISchedulingService, ICourtAssignmentService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<SchedulingService> _logger;

    public SchedulingService(ApplicationDbContext context, ILogger<SchedulingService> logger)
    {
        _context = context;
        _logger = logger;
    }

    // =====================================================
    // ISchedulingService Implementation
    // =====================================================

    public async Task<ScheduleResult> GenerateScheduleAsync(ScheduleRequest request)
    {
        var result = new ScheduleResult();

        try
        {
            // 1. Determine scope
            var eventId = request.EventId;
            var evt = await _context.Events.FindAsync(eventId);
            if (evt == null)
                return Fail("Event not found");

            // 2. Get divisions in scope
            var divisionsQuery = _context.EventDivisions
                .Where(d => d.EventId == eventId && d.IsActive);

            if (request.DivisionId.HasValue)
                divisionsQuery = divisionsQuery.Where(d => d.Id == request.DivisionId.Value);

            var divisions = await divisionsQuery.ToListAsync();
            if (!divisions.Any())
                return Fail("No divisions found");

            // 3. Load all encounters in scope
            var encountersQuery = _context.EventEncounters
                .Include(e => e.Unit1).ThenInclude(u => u!.Members)
                .Include(e => e.Unit2).ThenInclude(u => u!.Members)
                .Include(e => e.Division)
                .Include(e => e.Phase)
                .Include(e => e.TournamentCourt)
                .Include(e => e.WinnerSourceEncounters)
                .Include(e => e.LoserSourceEncounters)
                .Where(e => e.EventId == eventId && e.Status != "Bye" && e.Status != "Cancelled");

            if (request.DivisionId.HasValue)
                encountersQuery = encountersQuery.Where(e => e.DivisionId == request.DivisionId.Value);

            if (request.PhaseId.HasValue)
                encountersQuery = encountersQuery.Where(e => e.PhaseId == request.PhaseId.Value);

            var allEncounters = await encountersQuery.ToListAsync();
            if (!allEncounters.Any())
                return Fail("No encounters found to schedule");

            // 4. Filter to specific encounter IDs if provided
            List<EventEncounter> encountersToSchedule;
            if (request.EncounterIds != null && request.EncounterIds.Any())
            {
                var idSet = new HashSet<int>(request.EncounterIds);
                encountersToSchedule = allEncounters.Where(e => idSet.Contains(e.Id)).ToList();
            }
            else if (!request.ClearExisting)
            {
                // Only schedule unassigned encounters
                encountersToSchedule = allEncounters
                    .Where(e => e.TournamentCourtId == null || e.EstimatedStartTime == null)
                    .ToList();
            }
            else
            {
                encountersToSchedule = allEncounters.ToList();
            }

            if (!encountersToSchedule.Any())
                return Fail("No encounters to schedule (all may already be assigned)");

            // 5. Clear existing assignments if requested
            if (request.ClearExisting)
            {
                foreach (var enc in encountersToSchedule)
                {
                    if (enc.Status == "Completed" || enc.Status == "InProgress")
                        continue;
                    enc.TournamentCourtId = null;
                    enc.EstimatedStartTime = null;
                    enc.EstimatedEndTime = null;
                    enc.EstimatedDurationMinutes = null;
                    enc.ScheduledTime = null;
                }
            }

            // 6. Build player-to-unit mapping for cross-division overlap detection
            var playerUnitMap = new Dictionary<int, HashSet<int>>(); // playerId -> set of unitIds
            if (request.RespectPlayerOverlap)
            {
                // Load all units in the event (not just current scope) for cross-division checks
                var allEventUnits = await _context.EventUnits
                    .Include(u => u.Members)
                    .Where(u => u.EventId == eventId)
                    .ToListAsync();

                foreach (var unit in allEventUnits)
                {
                    foreach (var member in unit.Members)
                    {
                        if (!playerUnitMap.ContainsKey(member.UserId))
                            playerUnitMap[member.UserId] = new HashSet<int>();
                        playerUnitMap[member.UserId].Add(unit.Id);
                    }
                }
            }

            // 7. Get available courts per division
            var divisionCourts = new Dictionary<int, List<TournamentCourt>>();
            foreach (var division in divisions)
            {
                var courts = await GetAvailableCourtsAsync(division.Id, request.PhaseId);
                if (!courts.Any())
                {
                    // Fallback to all event courts
                    courts = await _context.TournamentCourts
                        .Where(c => c.EventId == eventId && c.IsActive)
                        .OrderBy(c => c.SortOrder)
                        .ToListAsync();
                }
                divisionCourts[division.Id] = courts;
            }

            // Check we have courts for at least one division
            if (!divisionCourts.Values.Any(c => c.Any()))
                return Fail("No courts available for scheduling");

            // 8. Sort encounters by priority
            var sortedEncounters = SortEncountersByPriority(encountersToSchedule, request.PoolSchedulingMode ?? "interleaved");

            // 9. Determine start time and match settings per division
            // Now phase-aware: different phases can have different encounter durations
            // based on MatchesPerEncounter, BestOf settings, and PhaseMatchSettings
            var divisionSettings = new Dictionary<int, (DateTime startTime, int matchDuration, int restTime)>();
            // Phase-specific encounter durations (divisionId, phaseId) -> encounter duration in minutes
            var phaseEncounterDurations = new Dictionary<(int divisionId, int? phaseId), int>();

            foreach (var division in divisions)
            {
                var startTime = request.StartTime
                    ?? division.Phases?.OrderBy(p => p.PhaseOrder).FirstOrDefault()?.StartTime
                    ?? evt.StartDate.Date.AddHours(8);

                var baseDivisionDuration = request.MatchDurationMinutes
                    ?? division.EstimatedMatchDurationMinutes
                    ?? 20;

                var restTime = request.RestTimeMinutes
                    ?? division.MinRestTimeMinutes
                    ?? 15;

                divisionSettings[division.Id] = (startTime, baseDivisionDuration, restTime);

                // Pre-calculate encounter durations for each phase in this division
                // This accounts for MatchesPerEncounter and per-phase BestOf settings
                if (division.Phases != null)
                {
                    foreach (var phase in division.Phases)
                    {
                        var duration = await CalculateEncounterDurationMinutesAsync(
                            // Use a representative encounter (any from this phase) or create a dummy
                            encountersToSchedule.FirstOrDefault(e => e.PhaseId == phase.Id)
                                ?? new EventEncounter { DivisionId = division.Id, PhaseId = phase.Id },
                            division, phase);
                        phaseEncounterDurations[(division.Id, phase.Id)] = duration;
                    }
                }
                // Also cache the division-level default (for encounters without a phase)
                phaseEncounterDurations[(division.Id, null)] = baseDivisionDuration;
            }

            // 10. Initialize availability trackers
            // Court availability: when each court is next free
            var courtNextAvailable = new Dictionary<int, DateTime>();
            foreach (var courtList in divisionCourts.Values)
            {
                foreach (var court in courtList)
                {
                    if (!courtNextAvailable.ContainsKey(court.Id))
                    {
                        // If not clearing existing, respect existing court usage
                        if (!request.ClearExisting)
                        {
                            var lastOnCourt = allEncounters
                                .Where(e => e.TournamentCourtId == court.Id && e.EstimatedStartTime.HasValue)
                                .MaxBy(e => e.EstimatedStartTime);

                            if (lastOnCourt != null)
                            {
                                var dur = lastOnCourt.EstimatedDurationMinutes
                                    ?? lastOnCourt.Division?.EstimatedMatchDurationMinutes ?? 20;
                                courtNextAvailable[court.Id] = lastOnCourt.EstimatedStartTime!.Value.AddMinutes(dur);
                                continue;
                            }
                        }

                        var divId = divisionCourts.First(kvp => kvp.Value.Any(c => c.Id == court.Id)).Key;
                        courtNextAvailable[court.Id] = divisionSettings.ContainsKey(divId)
                            ? divisionSettings[divId].startTime
                            : evt.StartDate.Date.AddHours(8);
                    }
                }
            }

            // Unit availability: when each unit can play next (includes rest time)
            var unitNextAvailable = new Dictionary<int, DateTime>();

            // Player availability: when each player can play next (cross-division)
            var playerNextAvailable = new Dictionary<int, DateTime>();

            // Track bracket round completion times for round dependency
            // Key: (divisionId, phaseId, roundNumber) -> estimated completion time
            var roundCompletionTimes = new Dictionary<(int divisionId, int? phaseId, int roundNumber), DateTime>();

            // If not clearing, pre-populate from existing scheduled encounters
            if (!request.ClearExisting)
            {
                foreach (var enc in allEncounters.Where(e => e.EstimatedStartTime.HasValue && e.TournamentCourtId.HasValue))
                {
                    var dur = enc.EstimatedDurationMinutes
                        ?? enc.Division?.EstimatedMatchDurationMinutes ?? 20;
                    var restTime = enc.Division?.MinRestTimeMinutes ?? 15;
                    var endTime = enc.EstimatedStartTime!.Value.AddMinutes(dur);
                    var availableAfterRest = endTime.AddMinutes(restTime);

                    // Update unit availability
                    if (enc.Unit1Id.HasValue)
                        unitNextAvailable[enc.Unit1Id.Value] = MaxDateTime(
                            unitNextAvailable.GetValueOrDefault(enc.Unit1Id.Value, DateTime.MinValue),
                            availableAfterRest);
                    if (enc.Unit2Id.HasValue)
                        unitNextAvailable[enc.Unit2Id.Value] = MaxDateTime(
                            unitNextAvailable.GetValueOrDefault(enc.Unit2Id.Value, DateTime.MinValue),
                            availableAfterRest);

                    // Update player availability for cross-division
                    if (request.RespectPlayerOverlap)
                        UpdatePlayerAvailability(enc, playerNextAvailable, availableAfterRest);
                }
            }

            // 11. Greedy assignment
            int assigned = 0;
            var usedCourts = new HashSet<int>();
            
            // Track scheduled times by encounter ID for dependency checking
            // (WinnerSourceEncounters are separate entity instances, need to check by ID)
            var scheduledEndTimes = new Dictionary<int, DateTime>();

            foreach (var encounter in sortedEncounters)
            {
                // Skip completed/in-progress
                if (encounter.Status == "Completed" || encounter.Status == "InProgress")
                    continue;

                // Get courts for this division
                if (!divisionCourts.TryGetValue(encounter.DivisionId, out var courts) || !courts.Any())
                {
                    result.Conflicts.Add(new ScheduleConflict
                    {
                        Type = "NoCourts",
                        Description = $"No courts available for division {encounter.Division?.Name ?? encounter.DivisionId.ToString()}",
                        EncounterId1 = encounter.Id
                    });
                    continue;
                }

                var (divStartTime, baseDuration, restMinutes) = divisionSettings.ContainsKey(encounter.DivisionId)
                    ? divisionSettings[encounter.DivisionId]
                    : (evt.StartDate.Date.AddHours(8), 20, 15);

                // Use phase-aware encounter duration (accounts for matches per encounter + BestOf)
                var encounterDuration = phaseEncounterDurations.TryGetValue(
                    (encounter.DivisionId, encounter.PhaseId), out var cachedDuration)
                    ? cachedDuration
                    : baseDuration;

                // Debug: log court availability for first few encounters
                if (assigned < 5)
                {
                    var courtInfo = string.Join(", ", courts.Select(c => 
                        $"{c.CourtLabel}@{(courtNextAvailable.TryGetValue(c.Id, out var t) ? t.ToString("HH:mm") : divStartTime.ToString("HH:mm"))}"));
                    _logger.LogInformation(
                        "Scheduling {Label} (#{Num}) Round {Round}: Courts available: [{Courts}], minStart would be based on units",
                        encounter.EncounterLabel ?? $"E{encounter.Id}", encounter.EncounterNumber, encounter.RoundNumber, courtInfo);
                }

                // Find earliest available slot
                var bestSlot = FindEarliestSlot(
                    encounter, courts, encounterDuration, restMinutes,
                    courtNextAvailable, unitNextAvailable, playerNextAvailable,
                    playerUnitMap, roundCompletionTimes, scheduledEndTimes,
                    request.RespectPlayerOverlap, divStartTime);

                if (bestSlot == null)
                {
                    result.Conflicts.Add(new ScheduleConflict
                    {
                        Type = "Unschedulable",
                        Description = $"Could not find a valid time slot for encounter {encounter.EncounterLabel ?? $"#{encounter.EncounterNumber}"} in {encounter.Division?.Name}",
                        EncounterId1 = encounter.Id
                    });
                    continue;
                }

                // Assign the encounter
                var (courtId, startTime, endTime) = bestSlot.Value;
                var assignedCourt = courts.FirstOrDefault(c => c.Id == courtId);

                encounter.TournamentCourtId = courtId;
                encounter.EstimatedStartTime = startTime;
                encounter.EstimatedDurationMinutes = encounterDuration;
                encounter.EstimatedEndTime = endTime;
                encounter.UpdatedAt = DateTime.Now;

                // Debug: log assignment
                if (assigned < 5)
                {
                    _logger.LogInformation(
                        "  → Assigned to {Court} at {Time}",
                        assignedCourt?.CourtLabel ?? $"Court#{courtId}", startTime.ToString("HH:mm"));
                }

                // Update trackers
                courtNextAvailable[courtId] = endTime;
                scheduledEndTimes[encounter.Id] = endTime; // Track for dependency checking

                var availableAfterRest = endTime.AddMinutes(restMinutes);

                if (encounter.Unit1Id.HasValue)
                    unitNextAvailable[encounter.Unit1Id.Value] = availableAfterRest;
                if (encounter.Unit2Id.HasValue)
                    unitNextAvailable[encounter.Unit2Id.Value] = availableAfterRest;

                if (request.RespectPlayerOverlap)
                    UpdatePlayerAvailability(encounter, playerNextAvailable, availableAfterRest);

                // Track bracket round completion
                if (encounter.RoundType == "Bracket" || encounter.RoundType == "BracketRound")
                {
                    var roundKey = (encounter.DivisionId, encounter.PhaseId, encounter.RoundNumber);
                    roundCompletionTimes[roundKey] = MaxDateTime(
                        roundCompletionTimes.GetValueOrDefault(roundKey, DateTime.MinValue),
                        endTime);
                }

                // Record assignment info
                var court = courts.First(c => c.Id == courtId);
                result.Assignments.Add(new ScheduledEncounterInfo
                {
                    EncounterId = encounter.Id,
                    CourtId = courtId,
                    CourtLabel = court.CourtLabel,
                    StartTime = startTime,
                    EndTime = endTime,
                    Unit1Name = encounter.Unit1?.Name,
                    Unit2Name = encounter.Unit2?.Name
                });

                usedCourts.Add(courtId);
                assigned++;
            }

            await _context.SaveChangesAsync();

            result.Success = assigned > 0;
            result.AssignedCount = assigned;
            result.CourtsUsed = usedCourts.Count;
            result.Message = $"{assigned} encounters scheduled across {usedCourts.Count} courts";

            if (result.Assignments.Any())
            {
                result.StartTime = result.Assignments.Min(a => a.StartTime);
                result.EstimatedEndTime = result.Assignments.Max(a => a.EndTime);
            }

            if (result.Conflicts.Any())
                result.Message += $" ({result.Conflicts.Count} conflicts/warnings)";

            _logger.LogInformation(
                "Generated schedule for event {EventId}: {Assigned} encounters, {Courts} courts, {Conflicts} conflicts",
                eventId, assigned, usedCourts.Count, result.Conflicts.Count);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating schedule for event {EventId}", request.EventId);
            return Fail($"Error generating schedule: {ex.Message}");
        }
    }

    public async Task<ScheduleValidationResultNew> ValidateScheduleAsync(int eventId, int? divisionId = null)
    {
        var result = new ScheduleValidationResultNew { IsValid = true };

        var encountersQuery = _context.EventEncounters
            .Include(e => e.Division)
            .Include(e => e.TournamentCourt)
            .Include(e => e.Unit1).ThenInclude(u => u!.Members).ThenInclude(m => m.User)
            .Include(e => e.Unit2).ThenInclude(u => u!.Members).ThenInclude(m => m.User)
            .Where(e => e.EventId == eventId && e.Status != "Cancelled" && e.Status != "Bye");

        if (divisionId.HasValue)
            encountersQuery = encountersQuery.Where(e => e.DivisionId == divisionId.Value);

        var encounters = await encountersQuery.ToListAsync();

        result.TotalEncounters = encounters.Count;
        result.ScheduledEncounters = encounters.Count(e => e.TournamentCourtId.HasValue && e.EstimatedStartTime.HasValue);
        result.UnscheduledEncounters = result.TotalEncounters - result.ScheduledEncounters;

        var scheduled = encounters
            .Where(e => e.TournamentCourtId.HasValue && e.EstimatedStartTime.HasValue)
            .ToList();

        // 1. Check court double-booking
        var byCourtId = scheduled.GroupBy(e => e.TournamentCourtId!.Value);
        foreach (var courtGroup in byCourtId)
        {
            var courtEncounters = courtGroup.OrderBy(e => e.EstimatedStartTime).ToList();
            for (int i = 0; i < courtEncounters.Count - 1; i++)
            {
                var current = courtEncounters[i];
                var next = courtEncounters[i + 1];
                var duration = current.EstimatedDurationMinutes ?? current.Division?.EstimatedMatchDurationMinutes ?? 20;
                var currentEnd = current.EstimatedEndTime ?? current.EstimatedStartTime!.Value.AddMinutes(duration);

                if (currentEnd > next.EstimatedStartTime)
                {
                    result.IsValid = false;
                    result.Conflicts.Add(new ScheduleConflict
                    {
                        Type = "CourtDoubleBook",
                        Description = $"Court {current.TournamentCourt?.CourtLabel}: {current.Division?.Name} Match #{current.EncounterNumber} ends at {currentEnd:HH:mm} but {next.Division?.Name} Match #{next.EncounterNumber} starts at {next.EstimatedStartTime:HH:mm}",
                        EncounterId1 = current.Id,
                        EncounterId2 = next.Id
                    });
                }
            }
        }

        // 2. Check unit overlap (same unit playing at same time)
        var unitEncounterPairs = scheduled
            .SelectMany(e => new[]
            {
                e.Unit1Id.HasValue ? (UnitId: e.Unit1Id.Value, Encounter: e) : default,
                e.Unit2Id.HasValue ? (UnitId: e.Unit2Id.Value, Encounter: e) : default
            })
            .Where(x => x.UnitId > 0)
            .GroupBy(x => x.UnitId);

        foreach (var unitGroup in unitEncounterPairs)
        {
            var unitMatches = unitGroup.OrderBy(x => x.Encounter.EstimatedStartTime).ToList();
            for (int i = 0; i < unitMatches.Count - 1; i++)
            {
                var current = unitMatches[i].Encounter;
                var next = unitMatches[i + 1].Encounter;
                var duration = current.EstimatedDurationMinutes ?? current.Division?.EstimatedMatchDurationMinutes ?? 20;
                var currentEnd = current.EstimatedEndTime ?? current.EstimatedStartTime!.Value.AddMinutes(duration);

                if (currentEnd > next.EstimatedStartTime)
                {
                    result.IsValid = false;
                    result.Conflicts.Add(new ScheduleConflict
                    {
                        Type = "PlayerOverlap",
                        Description = $"Unit playing overlapping matches: {current.Division?.Name} Match #{current.EncounterNumber} and {next.Division?.Name} Match #{next.EncounterNumber}",
                        EncounterId1 = current.Id,
                        EncounterId2 = next.Id
                    });
                }
            }
        }

        // 3. Check player-level overlap (same player in different units across divisions)
        var playerEncounterMap = new Dictionary<int, List<(EventEncounter encounter, DateTime start, DateTime end)>>();
        foreach (var enc in scheduled)
        {
            var duration = enc.EstimatedDurationMinutes ?? enc.Division?.EstimatedMatchDurationMinutes ?? 20;
            var start = enc.EstimatedStartTime!.Value;
            var end = enc.EstimatedEndTime ?? start.AddMinutes(duration);

            var playerIds = new HashSet<int>();
            if (enc.Unit1?.Members != null)
                foreach (var m in enc.Unit1.Members) playerIds.Add(m.UserId);
            if (enc.Unit2?.Members != null)
                foreach (var m in enc.Unit2.Members) playerIds.Add(m.UserId);

            foreach (var pid in playerIds)
            {
                if (!playerEncounterMap.ContainsKey(pid))
                    playerEncounterMap[pid] = new List<(EventEncounter, DateTime, DateTime)>();
                playerEncounterMap[pid].Add((enc, start, end));
            }
        }

        foreach (var (playerId, playerEncs) in playerEncounterMap)
        {
            if (playerEncs.Count < 2) continue;
            var sorted = playerEncs.OrderBy(x => x.start).ToList();
            for (int i = 0; i < sorted.Count - 1; i++)
            {
                if (sorted[i].end > sorted[i + 1].start)
                {
                    // Only report if different encounters (might already be caught by unit overlap)
                    var enc1 = sorted[i].encounter;
                    var enc2 = sorted[i + 1].encounter;
                    if (enc1.Id == enc2.Id) continue;

                    // Find player name
                    string? playerName = null;
                    var unit = enc1.Unit1?.Members?.FirstOrDefault(m => m.UserId == playerId)
                        ?? enc1.Unit2?.Members?.FirstOrDefault(m => m.UserId == playerId)
                        ?? enc2.Unit1?.Members?.FirstOrDefault(m => m.UserId == playerId)
                        ?? enc2.Unit2?.Members?.FirstOrDefault(m => m.UserId == playerId);
                    if (unit?.User != null)
                        playerName = $"{unit.User.FirstName} {unit.User.LastName}".Trim();

                    result.IsValid = false;
                    result.Conflicts.Add(new ScheduleConflict
                    {
                        Type = "PlayerOverlap",
                        Description = $"Player {playerName ?? $"#{playerId}"} has overlapping matches across divisions",
                        EncounterId1 = enc1.Id,
                        EncounterId2 = enc2.Id,
                        PlayerId = playerId,
                        PlayerName = playerName
                    });
                }
            }
        }

        // 4. Check insufficient rest
        foreach (var unitGroup in unitEncounterPairs)
        {
            var unitMatches = unitGroup.OrderBy(x => x.Encounter.EstimatedStartTime).ToList();
            for (int i = 0; i < unitMatches.Count - 1; i++)
            {
                var current = unitMatches[i].Encounter;
                var next = unitMatches[i + 1].Encounter;
                var duration = current.EstimatedDurationMinutes ?? current.Division?.EstimatedMatchDurationMinutes ?? 20;
                var currentEnd = current.EstimatedEndTime ?? current.EstimatedStartTime!.Value.AddMinutes(duration);
                var restRequired = current.Division?.MinRestTimeMinutes ?? 15;
                var actualRest = (next.EstimatedStartTime!.Value - currentEnd).TotalMinutes;

                // Only flag if not already overlapping and rest is insufficient
                if (currentEnd <= next.EstimatedStartTime && actualRest < restRequired)
                {
                    result.Conflicts.Add(new ScheduleConflict
                    {
                        Type = "InsufficientRest",
                        Description = $"Only {actualRest:F0}min rest between matches (requires {restRequired}min): {current.Division?.Name} Match #{current.EncounterNumber} → {next.Division?.Name} Match #{next.EncounterNumber}",
                        EncounterId1 = current.Id,
                        EncounterId2 = next.Id
                    });
                    // Insufficient rest is a warning, not an invalidity by default
                }
            }
        }

        // 5. Check bracket round dependencies
        var bracketEncounters = scheduled
            .Where(e => e.RoundType == "Bracket" || e.RoundType == "BracketRound")
            .ToList();

        foreach (var enc in bracketEncounters)
        {
            // Check if source encounters (that feed into this one) finish before this starts
            var sources = enc.WinnerSourceEncounters
                .Concat(enc.LoserSourceEncounters)
                .Where(s => s.EstimatedStartTime.HasValue)
                .ToList();

            foreach (var source in sources)
            {
                var srcDuration = source.EstimatedDurationMinutes ?? source.Division?.EstimatedMatchDurationMinutes ?? 20;
                var srcEnd = source.EstimatedEndTime ?? source.EstimatedStartTime!.Value.AddMinutes(srcDuration);

                if (srcEnd > enc.EstimatedStartTime)
                {
                    result.IsValid = false;
                    result.Conflicts.Add(new ScheduleConflict
                    {
                        Type = "RoundDependency",
                        Description = $"Bracket match {enc.EncounterLabel ?? $"#{enc.EncounterNumber}"} starts before feeder match {source.EncounterLabel ?? $"#{source.EncounterNumber}"} ends",
                        EncounterId1 = enc.Id,
                        EncounterId2 = source.Id
                    });
                }
            }
        }

        return result;
    }

    public async Task<int> ClearScheduleAsync(int divisionId, int? phaseId = null)
    {
        var query = _context.EventEncounters
            .Where(e => e.DivisionId == divisionId
                     && e.Status != "Completed"
                     && e.Status != "InProgress");

        if (phaseId.HasValue)
            query = query.Where(e => e.PhaseId == phaseId.Value);

        var encounters = await query.ToListAsync();

        int cleared = 0;
        foreach (var encounter in encounters)
        {
            if (encounter.TournamentCourtId.HasValue || encounter.EstimatedStartTime.HasValue || encounter.ScheduledTime.HasValue)
            {
                encounter.TournamentCourtId = null;
                encounter.EstimatedStartTime = null;
                encounter.EstimatedEndTime = null;
                encounter.EstimatedDurationMinutes = null;
                encounter.ScheduledTime = null;
                encounter.UpdatedAt = DateTime.Now;
                cleared++;
            }
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Cleared {Count} schedule assignments for division {DivisionId}, phase {PhaseId}",
            cleared, divisionId, phaseId);

        return cleared;
    }

    public async Task<List<TournamentCourt>> GetAvailableCourtsAsync(int divisionId, int? phaseId = null)
    {
        var courtAssignments = await _context.DivisionCourtAssignments
            .Where(a => a.DivisionId == divisionId && a.IsActive &&
                       (phaseId == null || a.PhaseId == phaseId || a.PhaseId == null))
            .OrderBy(a => a.Priority)
            .Include(a => a.CourtGroup)
                .ThenInclude(g => g!.CourtGroupCourts)
                    .ThenInclude(cgc => cgc.Court)
            .ToListAsync();

        if (!courtAssignments.Any())
            return new List<TournamentCourt>();

        return courtAssignments
            .SelectMany(a => a.CourtGroup?.CourtGroupCourts?.Select(cgc => cgc.Court!).Where(c => c != null) ?? Enumerable.Empty<TournamentCourt>())
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .DistinctBy(c => c.Id)
            .ToList();
    }

    public async Task<ScheduleResult> AssignSingleEncounterAsync(int encounterId)
    {
        var encounter = await _context.EventEncounters
            .Include(e => e.Unit1).ThenInclude(u => u!.Members)
            .Include(e => e.Unit2).ThenInclude(u => u!.Members)
            .Include(e => e.Division)
            .Include(e => e.Phase)
            .Include(e => e.WinnerSourceEncounters)
            .Include(e => e.LoserSourceEncounters)
            .FirstOrDefaultAsync(e => e.Id == encounterId);

        if (encounter == null)
            return Fail("Encounter not found");

        if (encounter.Status == "Completed" || encounter.Status == "InProgress")
            return Fail("Cannot schedule a completed or in-progress encounter");

        // Use GenerateScheduleAsync with single encounter
        var request = new ScheduleRequest
        {
            EventId = encounter.EventId,
            DivisionId = encounter.DivisionId,
            PhaseId = encounter.PhaseId,
            ClearExisting = false,
            RespectPlayerOverlap = true,
            EncounterIds = new List<int> { encounterId }
        };

        return await GenerateScheduleAsync(request);
    }

    // =====================================================
    // ICourtAssignmentService Implementation (backward compatibility)
    // =====================================================

    public async Task<CourtAssignmentResult> AutoAssignDivisionAsync(int divisionId, CourtAssignmentOptions options)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return new CourtAssignmentResult { Success = false, Message = "Division not found" };

        var request = new ScheduleRequest
        {
            EventId = division.EventId,
            DivisionId = divisionId,
            StartTime = options.StartTime,
            MatchDurationMinutes = options.MatchDurationMinutes,
            ClearExisting = options.ClearExisting,
            RespectPlayerOverlap = true
        };

        var result = await GenerateScheduleAsync(request);

        return new CourtAssignmentResult
        {
            Success = result.Success,
            Message = result.Message,
            AssignedCount = result.AssignedCount,
            CourtsUsed = result.CourtsUsed,
            StartTime = result.StartTime,
            EstimatedEndTime = result.EstimatedEndTime
        };
    }

    public async Task<CourtAssignmentResult> AutoAssignPhaseAsync(int phaseId)
    {
        var phase = await _context.DivisionPhases
            .Include(p => p.Division)
            .FirstOrDefaultAsync(p => p.Id == phaseId);

        if (phase == null)
            return new CourtAssignmentResult { Success = false, Message = "Phase not found" };

        var request = new ScheduleRequest
        {
            EventId = phase.Division!.EventId,
            DivisionId = phase.DivisionId,
            PhaseId = phaseId,
            StartTime = phase.StartTime,
            ClearExisting = false, // Phase auto-assign only fills unassigned
            RespectPlayerOverlap = true
        };

        var result = await GenerateScheduleAsync(request);

        return new CourtAssignmentResult
        {
            Success = result.Success,
            Message = result.Message,
            AssignedCount = result.AssignedCount,
            CourtsUsed = result.CourtsUsed,
            StartTime = result.StartTime,
            EstimatedEndTime = result.EstimatedEndTime
        };
    }

    public async Task<TimeCalculationResult> CalculatePhaseTimesAsync(int phaseId)
    {
        // Delegate to the existing phase time calculation (court assignments should already exist)
        var phase = await _context.DivisionPhases
            .Include(p => p.Division)
            .FirstOrDefaultAsync(p => p.Id == phaseId);

        if (phase == null)
            return new TimeCalculationResult { Success = false, Message = "Phase not found" };

        if (!phase.StartTime.HasValue)
            return new TimeCalculationResult { Success = false, Message = "Phase start time not set" };

        var restTime = phase.Division?.MinRestTimeMinutes ?? 15;

        var encounters = await _context.EventEncounters
            .Include(e => e.Unit1).ThenInclude(u => u!.Members)
            .Include(e => e.Unit2).ThenInclude(u => u!.Members)
            .Where(e => e.PhaseId == phaseId && e.TournamentCourtId != null)
            .OrderBy(e => e.TournamentCourtId).ThenBy(e => e.RoundNumber).ThenBy(e => e.EncounterNumber)
            .ToListAsync();

        if (!encounters.Any())
            return new TimeCalculationResult { Success = false, Message = "No encounters with courts assigned" };

        // Calculate encounter duration for this phase
        // (accounts for matches per encounter, BestOf per phase, match format BestOf)
        var encounterDuration = await CalculateEncounterDurationMinutesAsync(
            encounters.First(), phase.Division!, phase);

        // Calculate times per court, respecting unit rest times
        var courtTimes = new Dictionary<int, DateTime>();
        var unitNextAvail = new Dictionary<int, DateTime>();
        int updated = 0;

        foreach (var encounter in encounters)
        {
            var courtId = encounter.TournamentCourtId!.Value;

            if (!courtTimes.ContainsKey(courtId))
                courtTimes[courtId] = phase.StartTime.Value;

            var earliestCourtTime = courtTimes[courtId];

            // Respect unit availability
            var earliestUnitTime = earliestCourtTime;
            if (encounter.Unit1Id.HasValue && unitNextAvail.TryGetValue(encounter.Unit1Id.Value, out var u1Avail))
                earliestUnitTime = MaxDateTime(earliestUnitTime, u1Avail);
            if (encounter.Unit2Id.HasValue && unitNextAvail.TryGetValue(encounter.Unit2Id.Value, out var u2Avail))
                earliestUnitTime = MaxDateTime(earliestUnitTime, u2Avail);

            var startTime = MaxDateTime(earliestCourtTime, earliestUnitTime);

            encounter.EstimatedStartTime = startTime;
            encounter.EstimatedDurationMinutes = encounterDuration;
            encounter.EstimatedEndTime = startTime.AddMinutes(encounterDuration);
            encounter.UpdatedAt = DateTime.Now;

            courtTimes[courtId] = startTime.AddMinutes(encounterDuration);

            // Update unit availability with rest
            var afterRest = startTime.AddMinutes(encounterDuration + restTime);
            if (encounter.Unit1Id.HasValue)
                unitNextAvail[encounter.Unit1Id.Value] = afterRest;
            if (encounter.Unit2Id.HasValue)
                unitNextAvail[encounter.Unit2Id.Value] = afterRest;

            updated++;
        }

        await _context.SaveChangesAsync();

        DateTime? estimatedEndTime = null;
        if (courtTimes.Any())
        {
            estimatedEndTime = courtTimes.Values.Max();
            phase.EstimatedEndTime = estimatedEndTime;
            await _context.SaveChangesAsync();
        }

        _logger.LogInformation(
            "Calculated times for {Count} encounters in phase {PhaseId} ({Duration}min/encounter)",
            updated, phaseId, encounterDuration);

        return new TimeCalculationResult
        {
            Success = true,
            UpdatedCount = updated,
            EstimatedEndTime = estimatedEndTime,
            Message = $"Calculated times for {updated} encounters ({encounterDuration}min each)"
        };
    }

    public async Task<int> ClearDivisionAssignmentsAsync(int divisionId)
    {
        return await ClearScheduleAsync(divisionId);
    }

    public async Task<List<TournamentCourt>> GetAvailableCourtsForDivisionAsync(int divisionId, int? phaseId = null)
    {
        return await GetAvailableCourtsAsync(divisionId, phaseId);
    }

    /// <inheritdoc />
    public async Task<int> CalculateEncounterDurationMinutesAsync(
        EventEncounter encounter, EventDivision division, DivisionPhase? phase)
    {
        // Base per-game duration: phase override > division override > 15 min default
        var gameDuration = phase?.EstimatedMatchDurationMinutes
            ?? division.EstimatedMatchDurationMinutes
            ?? 15;

        // Changeover time between games (default 2 min)
        var changeoverMinutes = 2;
        
        // Buffer time after match ends (default 5 min)
        var bufferMinutes = 5;

        // Get match formats for this division (defines how many matches per encounter)
        var matchFormats = await _context.EncounterMatchFormats
            .Where(f => f.DivisionId == division.Id && f.IsActive)
            .OrderBy(f => f.SortOrder)
            .ToListAsync();

        // Get phase-specific match settings (BestOf overrides per phase)
        List<PhaseMatchSettings>? phaseSettings = null;
        if (phase != null)
        {
            phaseSettings = await _context.PhaseMatchSettings
                .Where(s => s.PhaseId == phase.Id)
                .ToListAsync();
        }

        int totalDuration;

        if (matchFormats.Count > 0)
        {
            // Multi-match encounter: sum duration of each match format
            totalDuration = 0;
            foreach (var format in matchFormats)
            {
                var bestOf = ResolveEffectiveBestOf(format, phase, phaseSettings, division);
                // Duration = games × gameDuration + changeovers
                var matchDuration = bestOf * gameDuration + (bestOf > 1 ? (bestOf - 1) * changeoverMinutes : 0);
                totalDuration += matchDuration;
            }
            // Add buffer at the end
            totalDuration += bufferMinutes;
        }
        else if (division.MatchesPerEncounter > 1)
        {
            // Division says multiple matches but no explicit formats defined
            var bestOf = phase?.BestOf ?? encounter.BestOf;
            if (bestOf < 1) bestOf = division.GamesPerMatch;
            if (bestOf < 1) bestOf = 1;
            // Duration = games × gameDuration + changeovers + buffer
            var gamesDuration = bestOf * gameDuration + (bestOf > 1 ? (bestOf - 1) * changeoverMinutes : 0);
            totalDuration = division.MatchesPerEncounter * gamesDuration + bufferMinutes;
        }
        else
        {
            // Simple single-match encounter
            // Use encounter's BestOf first (if set), then phase, then division
            var bestOf = encounter.BestOf > 0 ? encounter.BestOf : (phase?.BestOf ?? division.GamesPerMatch);
            if (bestOf < 1) bestOf = 1;
            
            // Duration = games × gameDuration + changeovers + buffer
            // For BO3: 3×15 + 2×2 + 5 = 54 min
            // For BO1: 1×15 + 0 + 5 = 20 min
            totalDuration = bestOf * gameDuration + (bestOf > 1 ? (bestOf - 1) * changeoverMinutes : 0) + bufferMinutes;
        }

        return totalDuration;
    }

    /// <summary>
    /// Resolve the effective BestOf for a specific match format within a phase.
    /// Priority: PhaseMatchSettings(format) > PhaseMatchSettings(null) > Phase.BestOf > Format.BestOf > Division.GamesPerMatch > 1
    /// </summary>
    private static int ResolveEffectiveBestOf(
        EncounterMatchFormat format,
        DivisionPhase? phase,
        List<PhaseMatchSettings>? phaseSettings,
        EventDivision division)
    {
        if (phaseSettings != null && phaseSettings.Count > 0)
        {
            var formatSetting = phaseSettings.FirstOrDefault(s => s.MatchFormatId == format.Id);
            if (formatSetting != null && formatSetting.BestOf > 0)
                return formatSetting.BestOf;

            var phaseSetting = phaseSettings.FirstOrDefault(s => s.MatchFormatId == null);
            if (phaseSetting != null && phaseSetting.BestOf > 0)
                return phaseSetting.BestOf;
        }

        if (phase?.BestOf.HasValue == true && phase.BestOf.Value > 0)
            return phase.BestOf.Value;

        if (format.BestOf > 0)
            return format.BestOf;

        if (division.GamesPerMatch > 0)
            return division.GamesPerMatch;

        return 1;
    }

    // =====================================================
    // Private Helpers
    // =====================================================

    private static ScheduleResult Fail(string message) =>
        new() { Success = false, Message = message };

    private static DateTime MaxDateTime(DateTime a, DateTime b) =>
        a > b ? a : b;

    /// <summary>
    /// Sort encounters by scheduling priority:
    /// - Pool play: round number, then either interleave or block by pool
    /// - Bracket: round number strictly (must complete round N before N+1)
    /// - Mix: pool play first, then brackets
    /// </summary>
    /// <param name="encounters">Encounters to sort</param>
    /// <param name="poolMode">"interleaved" (default) or "block"</param>
    private static List<EventEncounter> SortEncountersByPriority(List<EventEncounter> encounters, string poolMode = "interleaved")
    {
        // Separate pool play and bracket encounters
        var poolEncounters = encounters
            .Where(e => e.RoundType == "Pool" || e.RoundType == "RoundRobin" || e.RoundType == "Pools")
            .ToList();

        var bracketEncounters = encounters
            .Where(e => e.RoundType == "Bracket" || e.RoundType == "BracketRound"
                     || e.RoundType == "SingleElimination" || e.RoundType == "DoubleElimination"
                     || e.RoundType == "Final")
            .ToList();

        var otherEncounters = encounters
            .Except(poolEncounters)
            .Except(bracketEncounters)
            .ToList();

        // Sort pool encounters based on mode
        var sortedPool = new List<EventEncounter>();
        
        if (poolMode == "block")
        {
            // Block mode: complete each pool's round before moving to next pool
            // Order: Pool A R1 all games, Pool B R1 all games, Pool A R2 all games, Pool B R2 all games...
            var poolByRound = poolEncounters
                .GroupBy(e => e.RoundNumber)
                .OrderBy(g => g.Key);

            foreach (var roundGroup in poolByRound)
            {
                var byPool = roundGroup
                    .GroupBy(e => e.PoolId ?? 0)
                    .OrderBy(g => g.Key);

                foreach (var poolGames in byPool)
                {
                    sortedPool.AddRange(poolGames.OrderBy(e => e.EncounterNumber));
                }
            }
        }
        else
        {
            // Interleaved mode (default): Pool A R1G1, Pool B R1G1, Pool A R1G2, Pool B R1G2...
            var poolByRound = poolEncounters
                .GroupBy(e => e.RoundNumber)
                .OrderBy(g => g.Key);

            foreach (var roundGroup in poolByRound)
            {
                var byPool = roundGroup
                    .GroupBy(e => e.PoolId ?? 0)
                    .OrderBy(g => g.Key)
                    .Select(g => g.OrderBy(e => e.EncounterNumber).ToList())
                    .ToList();

                if (byPool.Count <= 1)
                {
                    sortedPool.AddRange(roundGroup.OrderBy(e => e.EncounterNumber));
                }
                else
                {
                    int maxCount = byPool.Max(p => p.Count);
                    for (int i = 0; i < maxCount; i++)
                    {
                        foreach (var pool in byPool)
                        {
                            if (i < pool.Count)
                                sortedPool.Add(pool[i]);
                        }
                    }
                }
            }
        }

        // Sort bracket encounters strictly by round number, then encounter number
        var sortedBracket = bracketEncounters
            .OrderBy(e => e.PhaseId ?? 0)
            .ThenBy(e => e.Phase?.PhaseOrder ?? 0)
            .ThenBy(e => e.RoundNumber)
            .ThenBy(e => e.EncounterNumber)
            .ToList();

        // Other encounters by round/encounter number
        var sortedOther = otherEncounters
            .OrderBy(e => e.RoundNumber)
            .ThenBy(e => e.EncounterNumber)
            .ToList();

        // Pool play first (to determine seedings), then brackets, then other
        return sortedPool
            .Concat(sortedBracket)
            .Concat(sortedOther)
            .ToList();
    }

    /// <summary>
    /// Find the earliest time slot where:
    /// - A court is available
    /// - Neither unit is playing
    /// - Both units have had sufficient rest
    /// - Bracket round dependencies are satisfied
    /// </summary>
    private (int courtId, DateTime startTime, DateTime endTime)? FindEarliestSlot(
        EventEncounter encounter,
        List<TournamentCourt> courts,
        int matchDuration,
        int restMinutes,
        Dictionary<int, DateTime> courtNextAvailable,
        Dictionary<int, DateTime> unitNextAvailable,
        Dictionary<int, DateTime> playerNextAvailable,
        Dictionary<int, HashSet<int>> playerUnitMap,
        Dictionary<(int divisionId, int? phaseId, int roundNumber), DateTime> roundCompletionTimes,
        Dictionary<int, DateTime> scheduledEndTimes,
        bool respectPlayerOverlap,
        DateTime divisionStartTime)
    {
        // Determine minimum start time from constraints

        // a) Unit availability (with rest time already baked in)
        var minStart = divisionStartTime;

        if (encounter.Unit1Id.HasValue && unitNextAvailable.TryGetValue(encounter.Unit1Id.Value, out var u1Avail))
            minStart = MaxDateTime(minStart, u1Avail);
        if (encounter.Unit2Id.HasValue && unitNextAvailable.TryGetValue(encounter.Unit2Id.Value, out var u2Avail))
            minStart = MaxDateTime(minStart, u2Avail);

        // b) Player-level availability (cross-division)
        if (respectPlayerOverlap)
        {
            var playerIds = GetPlayerIdsForEncounter(encounter);
            foreach (var pid in playerIds)
            {
                if (playerNextAvailable.TryGetValue(pid, out var pAvail))
                    minStart = MaxDateTime(minStart, pAvail);
            }
        }

        // c) Bracket round dependency: source encounters must be finished
        if (encounter.RoundType == "Bracket" || encounter.RoundType == "BracketRound"
            || encounter.RoundType == "SingleElimination" || encounter.RoundType == "DoubleElimination"
            || encounter.RoundType == "Final")
        {
            // Check if there's a previous round that must complete first
            if (encounter.RoundNumber > 1)
            {
                var prevRoundKey = (encounter.DivisionId, encounter.PhaseId, encounter.RoundNumber - 1);
                if (roundCompletionTimes.TryGetValue(prevRoundKey, out var prevRoundEnd))
                    minStart = MaxDateTime(minStart, prevRoundEnd);
            }

            // Also check WinnerSourceEncounters (encounters whose winner feeds into this one)
            if (encounter.WinnerSourceEncounters?.Any() == true)
            {
                foreach (var src in encounter.WinnerSourceEncounters)
                {
                    // First check if this source was just scheduled in this run (by ID)
                    if (scheduledEndTimes.TryGetValue(src.Id, out var scheduledEnd))
                    {
                        minStart = MaxDateTime(minStart, scheduledEnd);
                    }
                    else if (src.EstimatedEndTime.HasValue)
                    {
                        minStart = MaxDateTime(minStart, src.EstimatedEndTime.Value);
                    }
                    else if (src.EstimatedStartTime.HasValue)
                    {
                        var srcDuration = src.EstimatedDurationMinutes ?? 20;
                        minStart = MaxDateTime(minStart, src.EstimatedStartTime.Value.AddMinutes(srcDuration));
                    }
                }
            }

            // Also check LoserSourceEncounters (encounters whose loser feeds into this one, e.g., Bronze match)
            if (encounter.LoserSourceEncounters?.Any() == true)
            {
                foreach (var src in encounter.LoserSourceEncounters)
                {
                    // First check if this source was just scheduled in this run (by ID)
                    if (scheduledEndTimes.TryGetValue(src.Id, out var scheduledEnd))
                    {
                        minStart = MaxDateTime(minStart, scheduledEnd);
                    }
                    else if (src.EstimatedEndTime.HasValue)
                    {
                        minStart = MaxDateTime(minStart, src.EstimatedEndTime.Value);
                    }
                    else if (src.EstimatedStartTime.HasValue)
                    {
                        var srcDuration = src.EstimatedDurationMinutes ?? 20;
                        minStart = MaxDateTime(minStart, src.EstimatedStartTime.Value.AddMinutes(srcDuration));
                    }
                }
            }
        }

        // d) Find the court available earliest that satisfies minStart
        TournamentCourt? bestCourt = null;
        DateTime bestStart = DateTime.MaxValue;

        foreach (var court in courts)
        {
            if (!courtNextAvailable.TryGetValue(court.Id, out var courtAvail))
                courtAvail = divisionStartTime;

            var candidateStart = MaxDateTime(minStart, courtAvail);

            if (candidateStart < bestStart)
            {
                bestStart = candidateStart;
                bestCourt = court;
            }
        }

        if (bestCourt == null)
            return null;

        var endTime = bestStart.AddMinutes(matchDuration);
        return (bestCourt.Id, bestStart, endTime);
    }

    private static HashSet<int> GetPlayerIdsForEncounter(EventEncounter encounter)
    {
        var playerIds = new HashSet<int>();
        if (encounter.Unit1?.Members != null)
            foreach (var m in encounter.Unit1.Members) playerIds.Add(m.UserId);
        if (encounter.Unit2?.Members != null)
            foreach (var m in encounter.Unit2.Members) playerIds.Add(m.UserId);
        return playerIds;
    }

    private static void UpdatePlayerAvailability(EventEncounter encounter, Dictionary<int, DateTime> playerNextAvailable, DateTime availableAfterRest)
    {
        var playerIds = GetPlayerIdsForEncounter(encounter);
        foreach (var pid in playerIds)
        {
            playerNextAvailable[pid] = MaxDateTime(
                playerNextAvailable.GetValueOrDefault(pid, DateTime.MinValue),
                availableAfterRest);
        }
    }

    // =====================================================
    // Auto-Allocation Implementation
    // =====================================================

    public async Task<AutoAllocateResult> AutoAllocateAsync(AutoAllocateRequest request)
    {
        var result = new AutoAllocateResult();

        try
        {
            var evt = await _context.Events.FindAsync(request.EventId);
            if (evt == null)
                return new AutoAllocateResult { Success = false, Message = "Event not found" };

            if (!request.Blocks.Any())
                return new AutoAllocateResult { Success = false, Message = "No time blocks specified" };

            // Global trackers for cross-block conflict detection
            var playerNextAvailable = new Dictionary<int, DateTime>();
            var unitNextAvailable = new Dictionary<int, DateTime>();
            var courtNextAvailable = new Dictionary<int, DateTime>();

            // Load all event units for player mapping
            var allEventUnits = await _context.EventUnits
                .Include(u => u.Members)
                .Where(u => u.EventId == request.EventId)
                .ToListAsync();

            var playerUnitMap = new Dictionary<int, HashSet<int>>();
            foreach (var unit in allEventUnits)
            {
                foreach (var member in unit.Members)
                {
                    if (!playerUnitMap.ContainsKey(member.UserId))
                        playerUnitMap[member.UserId] = new HashSet<int>();
                    playerUnitMap[member.UserId].Add(unit.Id);
                }
            }

            // Process each block allocation
            foreach (var block in request.Blocks.OrderBy(b => b.StartTime))
            {
                var blockResult = new BlockAllocationResult
                {
                    DivisionId = block.DivisionId,
                    PhaseId = block.PhaseId,
                    StartTime = block.StartTime,
                    EndTime = block.EndTime
                };

                // Load division info
                var division = await _context.EventDivisions
                    .Include(d => d.Phases)
                    .FirstOrDefaultAsync(d => d.Id == block.DivisionId);

                if (division == null)
                {
                    blockResult.Warning = "Division not found";
                    result.BlockResults.Add(blockResult);
                    continue;
                }

                blockResult.DivisionName = division.Name;

                if (block.PhaseId.HasValue)
                {
                    var phase = division.Phases?.FirstOrDefault(p => p.Id == block.PhaseId.Value);
                    blockResult.PhaseName = phase?.Name;
                }

                // Resolve courts for this block
                List<TournamentCourt> blockCourts;
                if (block.CourtIds.Any())
                {
                    blockCourts = await _context.TournamentCourts
                        .Where(c => block.CourtIds.Contains(c.Id) && c.IsActive)
                        .OrderBy(c => c.SortOrder)
                        .ToListAsync();
                }
                else if (block.CourtGroupId.HasValue)
                {
                    var group = await _context.CourtGroups
                        .Include(g => g.CourtGroupCourts)
                            .ThenInclude(cgc => cgc.Court)
                        .FirstOrDefaultAsync(g => g.Id == block.CourtGroupId.Value);

                    blockCourts = group?.CourtGroupCourts?
                        .Select(cgc => cgc.Court!)
                        .Where(c => c != null && c.IsActive)
                        .OrderBy(c => c.SortOrder)
                        .ToList() ?? new List<TournamentCourt>();
                }
                else
                {
                    // Fallback to division's assigned courts
                    blockCourts = await GetAvailableCourtsAsync(block.DivisionId, block.PhaseId);
                }

                if (!blockCourts.Any())
                {
                    blockResult.Warning = "No courts available for this block";
                    result.BlockResults.Add(blockResult);
                    continue;
                }

                blockResult.CourtsUsed = blockCourts.Count;

                // Initialize court availability for this block
                foreach (var court in blockCourts)
                {
                    if (!courtNextAvailable.ContainsKey(court.Id))
                        courtNextAvailable[court.Id] = block.StartTime;
                    else
                        courtNextAvailable[court.Id] = MaxDateTime(courtNextAvailable[court.Id], block.StartTime);
                }

                // Load encounters for this block's division+phase
                var encountersQuery = _context.EventEncounters
                    .Include(e => e.Unit1).ThenInclude(u => u!.Members)
                    .Include(e => e.Unit2).ThenInclude(u => u!.Members)
                    .Include(e => e.Division)
                    .Include(e => e.Phase)
                    .Include(e => e.WinnerSourceEncounters)
                    .Include(e => e.LoserSourceEncounters)
                    .Where(e => e.DivisionId == block.DivisionId
                             && e.Status != "Bye" && e.Status != "Cancelled"
                             && e.Status != "Completed" && e.Status != "InProgress");

                if (block.PhaseId.HasValue)
                    encountersQuery = encountersQuery.Where(e => e.PhaseId == block.PhaseId.Value);

                var encounters = await encountersQuery.ToListAsync();

                // Filter to unassigned encounters if not clearing
                if (!request.ClearExisting)
                    encounters = encounters.Where(e => !e.TournamentCourtId.HasValue || !e.EstimatedStartTime.HasValue).ToList();

                if (request.ClearExisting)
                {
                    foreach (var enc in encounters)
                    {
                        enc.TournamentCourtId = null;
                        enc.EstimatedStartTime = null;
                        enc.EstimatedEndTime = null;
                        enc.EstimatedDurationMinutes = null;
                        enc.ScheduledTime = null;
                    }
                }

                blockResult.TotalEncounters = encounters.Count;

                if (!encounters.Any())
                {
                    blockResult.Warning = "No encounters to schedule";
                    result.BlockResults.Add(blockResult);
                    continue;
                }

                // Sort encounters by priority
                var sortedEncounters = SortEncountersByPriority(encounters);

                // Settings for this block
                var matchDuration = block.MatchDurationMinutes
                    ?? division.EstimatedMatchDurationMinutes
                    ?? 20;
                var restMinutes = block.RestTimeMinutes
                    ?? division.MinRestTimeMinutes
                    ?? 15;

                // Bracket round completion tracking
                var roundCompletionTimes = new Dictionary<(int divisionId, int? phaseId, int roundNumber), DateTime>();

                int assigned = 0;
                foreach (var encounter in sortedEncounters)
                {
                    // Find best slot within the block's time window
                    var slot = FindSlotWithinBlock(
                        encounter, blockCourts, matchDuration, restMinutes,
                        block.StartTime, block.EndTime,
                        courtNextAvailable, unitNextAvailable, playerNextAvailable,
                        playerUnitMap, roundCompletionTimes,
                        request.RespectPlayerOverlap);

                    if (slot == null)
                    {
                        result.Conflicts.Add(new ScheduleConflict
                        {
                            Type = "BlockOverflow",
                            Description = $"Cannot fit {encounter.EncounterLabel ?? $"Match #{encounter.EncounterNumber}"} ({division.Name}) within time block {block.StartTime:h:mm tt}-{block.EndTime:h:mm tt}",
                            EncounterId1 = encounter.Id
                        });
                        result.TotalSkipped++;
                        continue;
                    }

                    var (courtId, startTime, endTime) = slot.Value;

                    encounter.TournamentCourtId = courtId;
                    encounter.EstimatedStartTime = startTime;
                    encounter.EstimatedDurationMinutes = matchDuration;
                    encounter.EstimatedEndTime = endTime;
                    encounter.UpdatedAt = DateTime.Now;

                    // Update trackers
                    courtNextAvailable[courtId] = endTime;
                    var availableAfterRest = endTime.AddMinutes(restMinutes);

                    if (encounter.Unit1Id.HasValue)
                        unitNextAvailable[encounter.Unit1Id.Value] = availableAfterRest;
                    if (encounter.Unit2Id.HasValue)
                        unitNextAvailable[encounter.Unit2Id.Value] = availableAfterRest;

                    if (request.RespectPlayerOverlap)
                        UpdatePlayerAvailability(encounter, playerNextAvailable, availableAfterRest);

                    // Track bracket round completion
                    if (encounter.RoundType == "Bracket" || encounter.RoundType == "BracketRound")
                    {
                        var roundKey = (encounter.DivisionId, encounter.PhaseId, encounter.RoundNumber);
                        roundCompletionTimes[roundKey] = MaxDateTime(
                            roundCompletionTimes.GetValueOrDefault(roundKey, DateTime.MinValue),
                            endTime);
                    }

                    assigned++;
                }

                blockResult.AssignedCount = assigned;

                if (assigned > 0)
                {
                    blockResult.StartTime = block.StartTime;
                    blockResult.EndTime = block.EndTime;
                }

                result.BlockResults.Add(blockResult);
                result.TotalAssigned += assigned;
            }

            await _context.SaveChangesAsync();

            result.Success = result.TotalAssigned > 0;
            result.Message = $"Auto-allocated {result.TotalAssigned} encounters across {request.Blocks.Count} block(s)";
            if (result.TotalSkipped > 0)
                result.Message += $" ({result.TotalSkipped} could not be scheduled)";
            if (result.Conflicts.Any())
                result.Message += $" ({result.Conflicts.Count} conflict(s))";

            _logger.LogInformation(
                "Auto-allocated {Assigned} encounters for event {EventId} across {Blocks} blocks, {Skipped} skipped",
                result.TotalAssigned, request.EventId, request.Blocks.Count, result.TotalSkipped);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error auto-allocating schedule for event {EventId}", request.EventId);
            return new AutoAllocateResult { Success = false, Message = $"Error: {ex.Message}" };
        }
    }

    /// <summary>
    /// Find the earliest time slot within a specific time block where:
    /// - A court from the block's court list is available
    /// - Neither unit is playing
    /// - Both units have had sufficient rest
    /// - The match fits within the block's time window
    /// </summary>
    private (int courtId, DateTime startTime, DateTime endTime)? FindSlotWithinBlock(
        EventEncounter encounter,
        List<TournamentCourt> courts,
        int matchDuration,
        int restMinutes,
        DateTime blockStart,
        DateTime blockEnd,
        Dictionary<int, DateTime> courtNextAvailable,
        Dictionary<int, DateTime> unitNextAvailable,
        Dictionary<int, DateTime> playerNextAvailable,
        Dictionary<int, HashSet<int>> playerUnitMap,
        Dictionary<(int divisionId, int? phaseId, int roundNumber), DateTime> roundCompletionTimes,
        bool respectPlayerOverlap)
    {
        // Determine minimum start time from constraints
        var minStart = blockStart;

        // Unit availability
        if (encounter.Unit1Id.HasValue && unitNextAvailable.TryGetValue(encounter.Unit1Id.Value, out var u1Avail))
            minStart = MaxDateTime(minStart, u1Avail);
        if (encounter.Unit2Id.HasValue && unitNextAvailable.TryGetValue(encounter.Unit2Id.Value, out var u2Avail))
            minStart = MaxDateTime(minStart, u2Avail);

        // Player-level availability
        if (respectPlayerOverlap)
        {
            var playerIds = GetPlayerIdsForEncounter(encounter);
            foreach (var pid in playerIds)
            {
                if (playerNextAvailable.TryGetValue(pid, out var pAvail))
                    minStart = MaxDateTime(minStart, pAvail);
            }
        }

        // Bracket round dependency
        if (encounter.RoundType == "Bracket" || encounter.RoundType == "BracketRound"
            || encounter.RoundType == "SingleElimination" || encounter.RoundType == "DoubleElimination"
            || encounter.RoundType == "Final")
        {
            if (encounter.RoundNumber > 1)
            {
                var prevRoundKey = (encounter.DivisionId, encounter.PhaseId, encounter.RoundNumber - 1);
                if (roundCompletionTimes.TryGetValue(prevRoundKey, out var prevRoundEnd))
                    minStart = MaxDateTime(minStart, prevRoundEnd);
            }

            if (encounter.WinnerSourceEncounters?.Any() == true)
            {
                foreach (var src in encounter.WinnerSourceEncounters)
                {
                    if (src.EstimatedEndTime.HasValue)
                        minStart = MaxDateTime(minStart, src.EstimatedEndTime.Value);
                    else if (src.EstimatedStartTime.HasValue)
                        minStart = MaxDateTime(minStart, src.EstimatedStartTime.Value.AddMinutes(src.EstimatedDurationMinutes ?? 20));
                }
            }

            if (encounter.LoserSourceEncounters?.Any() == true)
            {
                foreach (var src in encounter.LoserSourceEncounters)
                {
                    if (src.EstimatedEndTime.HasValue)
                        minStart = MaxDateTime(minStart, src.EstimatedEndTime.Value);
                    else if (src.EstimatedStartTime.HasValue)
                        minStart = MaxDateTime(minStart, src.EstimatedStartTime.Value.AddMinutes(src.EstimatedDurationMinutes ?? 20));
                }
            }
        }

        // Find best court within block
        TournamentCourt? bestCourt = null;
        DateTime bestStart = DateTime.MaxValue;

        foreach (var court in courts)
        {
            if (!courtNextAvailable.TryGetValue(court.Id, out var courtAvail))
                courtAvail = blockStart;

            var candidateStart = MaxDateTime(minStart, courtAvail);
            var candidateEnd = candidateStart.AddMinutes(matchDuration);

            // Must fit within the block's time window
            if (candidateEnd > blockEnd)
                continue;

            if (candidateStart < bestStart)
            {
                bestStart = candidateStart;
                bestCourt = court;
            }
        }

        if (bestCourt == null)
            return null;

        var endTime = bestStart.AddMinutes(matchDuration);
        return (bestCourt.Id, bestStart, endTime);
    }
}
