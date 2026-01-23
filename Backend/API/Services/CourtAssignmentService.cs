using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Services;

public interface ICourtAssignmentService
{
    /// <summary>
    /// Auto-assign courts to encounters for a division
    /// </summary>
    Task<CourtAssignmentResult> AutoAssignDivisionAsync(int divisionId, CourtAssignmentOptions options);

    /// <summary>
    /// Auto-assign courts to encounters for a phase
    /// </summary>
    Task<CourtAssignmentResult> AutoAssignPhaseAsync(int phaseId);

    /// <summary>
    /// Calculate estimated start times for encounters in a phase
    /// </summary>
    Task<TimeCalculationResult> CalculatePhaseTimesAsync(int phaseId);

    /// <summary>
    /// Clear all court and time assignments for a division
    /// </summary>
    Task<int> ClearDivisionAssignmentsAsync(int divisionId);

    /// <summary>
    /// Get available courts for a division based on court group assignments
    /// </summary>
    Task<List<TournamentCourt>> GetAvailableCourtsForDivisionAsync(int divisionId, int? phaseId = null);
}

public class CourtAssignmentOptions
{
    public DateTime? StartTime { get; set; }
    public int? MatchDurationMinutes { get; set; }
    public bool ClearExisting { get; set; } = true;
}

public class CourtAssignmentResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public int AssignedCount { get; set; }
    public int CourtsUsed { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EstimatedEndTime { get; set; }
}

public class TimeCalculationResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public int UpdatedCount { get; set; }
    public DateTime? EstimatedEndTime { get; set; }
}

public class CourtAssignmentService : ICourtAssignmentService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<CourtAssignmentService> _logger;

    public CourtAssignmentService(ApplicationDbContext context, ILogger<CourtAssignmentService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<CourtAssignmentResult> AutoAssignDivisionAsync(int divisionId, CourtAssignmentOptions options)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
        {
            return new CourtAssignmentResult { Success = false, Message = "Division not found" };
        }

        // Get available courts
        var availableCourts = await GetAvailableCourtsForDivisionAsync(divisionId);
        if (!availableCourts.Any())
        {
            // Fallback to all event courts if no groups assigned
            availableCourts = await _context.TournamentCourts
                .Where(c => c.EventId == division.EventId && c.IsActive)
                .OrderBy(c => c.SortOrder)
                .ToListAsync();
        }

        if (!availableCourts.Any())
        {
            return new CourtAssignmentResult { Success = false, Message = "No courts available" };
        }

        // Get encounters to assign
        var encounterQuery = _context.EventEncounters
            .Where(e => e.DivisionId == divisionId && e.Status != "Bye" && e.Status != "Completed");

        if (!options.ClearExisting)
        {
            encounterQuery = encounterQuery.Where(e => e.TournamentCourtId == null);
        }

        var encounters = await encounterQuery
            .OrderBy(e => e.RoundNumber)
            .ThenBy(e => e.EncounterNumber)
            .ToListAsync();

        if (!encounters.Any())
        {
            return new CourtAssignmentResult { Success = false, Message = "No encounters to assign" };
        }

        // Settings
        var startTime = options.StartTime ?? division.Event?.StartDate.Date.AddHours(8) ?? DateTime.Today.AddHours(8);
        var matchDuration = options.MatchDurationMinutes ?? division.EstimatedMatchDurationMinutes ?? 20;

        // Track court availability
        var courtNextAvailable = availableCourts.ToDictionary(c => c.Id, c => startTime);

        // Assign courts and times
        int assigned = 0;
        foreach (var encounter in encounters)
        {
            // Find the court available soonest
            var bestCourt = availableCourts
                .OrderBy(c => courtNextAvailable[c.Id])
                .ThenBy(c => c.SortOrder)
                .First();

            encounter.TournamentCourtId = bestCourt.Id;
            encounter.EstimatedStartTime = courtNextAvailable[bestCourt.Id];
            encounter.UpdatedAt = DateTime.Now;

            // Update court availability
            courtNextAvailable[bestCourt.Id] = courtNextAvailable[bestCourt.Id].AddMinutes(matchDuration);
            assigned++;
        }

        await _context.SaveChangesAsync();

        var estimatedEndTime = courtNextAvailable.Values.Max();

        _logger.LogInformation("Auto-assigned {Count} encounters for division {DivisionId}", assigned, divisionId);

        return new CourtAssignmentResult
        {
            Success = true,
            AssignedCount = assigned,
            CourtsUsed = availableCourts.Count,
            StartTime = startTime,
            EstimatedEndTime = estimatedEndTime,
            Message = $"{assigned} encounters assigned to {availableCourts.Count} courts"
        };
    }

    public async Task<CourtAssignmentResult> AutoAssignPhaseAsync(int phaseId)
    {
        var phase = await _context.DivisionPhases
            .Include(p => p.Division)
            .FirstOrDefaultAsync(p => p.Id == phaseId);

        if (phase == null)
        {
            return new CourtAssignmentResult { Success = false, Message = "Phase not found" };
        }

        // Get court assignments for this phase (or division-level)
        var availableCourts = await GetAvailableCourtsForDivisionAsync(phase.DivisionId, phaseId);

        if (!availableCourts.Any())
        {
            return new CourtAssignmentResult { Success = false, Message = "No court groups assigned to this phase" };
        }

        // Get encounters without court assignments
        var encounters = await _context.EventEncounters
            .Where(e => e.PhaseId == phaseId && e.TournamentCourtId == null)
            .OrderBy(e => e.PoolId).ThenBy(e => e.RoundNumber).ThenBy(e => e.EncounterNumber)
            .ToListAsync();

        if (!encounters.Any())
        {
            return new CourtAssignmentResult { Success = true, AssignedCount = 0, Message = "No encounters to assign" };
        }

        // Simple round-robin court assignment
        int courtIndex = 0;
        int assigned = 0;
        foreach (var encounter in encounters)
        {
            encounter.TournamentCourtId = availableCourts[courtIndex].Id;
            encounter.UpdatedAt = DateTime.Now;
            courtIndex = (courtIndex + 1) % availableCourts.Count;
            assigned++;
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Auto-assigned {Count} encounters for phase {PhaseId}", assigned, phaseId);

        return new CourtAssignmentResult
        {
            Success = true,
            AssignedCount = assigned,
            CourtsUsed = availableCourts.Count,
            Message = $"{assigned} encounters assigned"
        };
    }

    public async Task<TimeCalculationResult> CalculatePhaseTimesAsync(int phaseId)
    {
        var phase = await _context.DivisionPhases
            .Include(p => p.Division)
            .FirstOrDefaultAsync(p => p.Id == phaseId);

        if (phase == null)
        {
            return new TimeCalculationResult { Success = false, Message = "Phase not found" };
        }

        if (!phase.StartTime.HasValue)
        {
            return new TimeCalculationResult { Success = false, Message = "Phase start time not set" };
        }

        var matchDuration = phase.EstimatedMatchDurationMinutes
            ?? phase.Division?.EstimatedMatchDurationMinutes
            ?? 20;

        // Get encounters grouped by court
        var encounters = await _context.EventEncounters
            .Where(e => e.PhaseId == phaseId && e.TournamentCourtId != null)
            .OrderBy(e => e.TournamentCourtId).ThenBy(e => e.RoundNumber).ThenBy(e => e.EncounterNumber)
            .ToListAsync();

        if (!encounters.Any())
        {
            return new TimeCalculationResult { Success = false, Message = "No encounters with courts assigned" };
        }

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
            encounter.UpdatedAt = DateTime.Now;
            courtTimes[courtId] = courtTimes[courtId].AddMinutes(matchDuration);
            updated++;
        }

        await _context.SaveChangesAsync();

        // Update phase end time
        DateTime? estimatedEndTime = null;
        if (courtTimes.Any())
        {
            estimatedEndTime = courtTimes.Values.Max();
            phase.EstimatedEndTime = estimatedEndTime;
            await _context.SaveChangesAsync();
        }

        _logger.LogInformation("Calculated times for {Count} encounters in phase {PhaseId}", updated, phaseId);

        return new TimeCalculationResult
        {
            Success = true,
            UpdatedCount = updated,
            EstimatedEndTime = estimatedEndTime,
            Message = $"Calculated times for {updated} encounters"
        };
    }

    public async Task<int> ClearDivisionAssignmentsAsync(int divisionId)
    {
        var encounters = await _context.EventEncounters
            .Where(e => e.DivisionId == divisionId && e.Status != "Completed" && e.Status != "InProgress")
            .ToListAsync();

        int cleared = 0;
        foreach (var encounter in encounters)
        {
            if (encounter.TournamentCourtId.HasValue || encounter.EstimatedStartTime.HasValue || encounter.ScheduledTime.HasValue)
            {
                encounter.TournamentCourtId = null;
                encounter.EstimatedStartTime = null;
                encounter.ScheduledTime = null;
                encounter.UpdatedAt = DateTime.Now;
                cleared++;
            }
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Cleared {Count} court assignments for division {DivisionId}", cleared, divisionId);

        return cleared;
    }

    public async Task<List<TournamentCourt>> GetAvailableCourtsForDivisionAsync(int divisionId, int? phaseId = null)
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
        {
            return new List<TournamentCourt>();
        }

        return courtAssignments
            .SelectMany(a => a.CourtGroup?.CourtGroupCourts?.Select(cgc => cgc.Court!).Where(c => c != null) ?? Enumerable.Empty<TournamentCourt>())
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .Distinct()
            .ToList();
    }
}
