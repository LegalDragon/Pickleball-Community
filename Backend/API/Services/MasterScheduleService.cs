using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Services;

public interface IMasterScheduleService
{
    /// <summary>
    /// Get all schedule blocks for an event
    /// </summary>
    Task<List<EventCourtScheduleBlockDto>> GetScheduleBlocksAsync(int eventId);

    /// <summary>
    /// Get a single schedule block by ID
    /// </summary>
    Task<EventCourtScheduleBlockDto?> GetScheduleBlockAsync(int blockId);

    /// <summary>
    /// Create a new schedule block
    /// </summary>
    Task<EventCourtScheduleBlockDto> CreateScheduleBlockAsync(int eventId, CreateScheduleBlockRequest request, int userId);

    /// <summary>
    /// Update an existing schedule block
    /// </summary>
    Task<EventCourtScheduleBlockDto?> UpdateScheduleBlockAsync(int blockId, UpdateScheduleBlockRequest request, int userId);

    /// <summary>
    /// Delete a schedule block
    /// </summary>
    Task<bool> DeleteScheduleBlockAsync(int blockId);

    /// <summary>
    /// Get timeline view data for master schedule
    /// </summary>
    Task<MasterScheduleTimelineDto> GetTimelineAsync(int eventId);

    /// <summary>
    /// Run auto-scheduler for all blocks in an event
    /// </summary>
    Task<AutoScheduleResult> AutoScheduleEventAsync(int eventId, AutoScheduleRequest request);

    /// <summary>
    /// Get player's personal schedule for an event
    /// </summary>
    Task<PlayerScheduleDto?> GetPlayerScheduleAsync(int eventId, int userId);

    /// <summary>
    /// Validate schedule blocks for conflicts
    /// </summary>
    Task<List<ScheduleBlockConflictDto>> ValidateScheduleBlocksAsync(int eventId);
}

public class MasterScheduleService : IMasterScheduleService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<MasterScheduleService> _logger;
    private readonly ICourtAssignmentService _courtAssignmentService;

    // Division color palette
    private static readonly string[] DivisionColors = new[]
    {
        "#3b82f6", // blue
        "#10b981", // emerald
        "#f97316", // orange
        "#8b5cf6", // violet
        "#ef4444", // red
        "#06b6d4", // cyan
        "#f59e0b", // amber
        "#ec4899", // pink
        "#6366f1", // indigo
        "#84cc16"  // lime
    };

    public MasterScheduleService(
        ApplicationDbContext context,
        ILogger<MasterScheduleService> logger,
        ICourtAssignmentService courtAssignmentService)
    {
        _context = context;
        _logger = logger;
        _courtAssignmentService = courtAssignmentService;
    }

    public async Task<List<EventCourtScheduleBlockDto>> GetScheduleBlocksAsync(int eventId)
    {
        var blocks = await _context.EventCourtScheduleBlocks
            .Where(b => b.EventId == eventId && b.IsActive)
            .Include(b => b.Division)
            .Include(b => b.Phase)
            .Include(b => b.DependsOnBlock)
            .OrderBy(b => b.SortOrder)
            .ThenBy(b => b.StartTime)
            .ToListAsync();

        var courtIds = blocks.SelectMany(b => b.CourtIds).Distinct().ToList();
        var courts = await _context.TournamentCourts
            .Where(c => courtIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.CourtLabel);

        // Get scheduled encounter counts per block
        var encounterCounts = await GetScheduledEncounterCountsAsync(blocks);

        return blocks.Select(b => MapToDto(b, courts, encounterCounts)).ToList();
    }

    public async Task<EventCourtScheduleBlockDto?> GetScheduleBlockAsync(int blockId)
    {
        var block = await _context.EventCourtScheduleBlocks
            .Include(b => b.Division)
            .Include(b => b.Phase)
            .Include(b => b.DependsOnBlock)
            .FirstOrDefaultAsync(b => b.Id == blockId);

        if (block == null) return null;

        var courts = await _context.TournamentCourts
            .Where(c => block.CourtIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.CourtLabel);

        var encounterCounts = await GetScheduledEncounterCountsAsync(new List<EventCourtScheduleBlock> { block });

        return MapToDto(block, courts, encounterCounts);
    }

    public async Task<EventCourtScheduleBlockDto> CreateScheduleBlockAsync(int eventId, CreateScheduleBlockRequest request, int userId)
    {
        // Validate division belongs to event
        var division = await _context.EventDivisions
            .FirstOrDefaultAsync(d => d.Id == request.DivisionId && d.EventId == eventId);
        if (division == null)
            throw new ArgumentException("Division not found or doesn't belong to this event");

        // Validate phase if provided
        if (request.PhaseId.HasValue)
        {
            var phase = await _context.DivisionPhases
                .FirstOrDefaultAsync(p => p.Id == request.PhaseId && p.DivisionId == request.DivisionId);
            if (phase == null)
                throw new ArgumentException("Phase not found or doesn't belong to this division");
        }

        // Validate dependency if provided
        if (request.DependsOnBlockId.HasValue)
        {
            var depBlock = await _context.EventCourtScheduleBlocks
                .FirstOrDefaultAsync(b => b.Id == request.DependsOnBlockId && b.EventId == eventId);
            if (depBlock == null)
                throw new ArgumentException("Dependency block not found or doesn't belong to this event");
        }

        // Count encounters for this division/phase
        var encounterQuery = _context.EventEncounters
            .Where(e => e.DivisionId == request.DivisionId && e.Status != "Bye" && e.Status != "Cancelled");
        if (request.PhaseId.HasValue)
            encounterQuery = encounterQuery.Where(e => e.PhaseId == request.PhaseId);
        var encounterCount = await encounterQuery.CountAsync();

        // Generate block label if not provided
        var blockLabel = request.BlockLabel;
        if (string.IsNullOrEmpty(blockLabel))
        {
            blockLabel = division.Name;
            if (request.PhaseId.HasValue)
            {
                var phase = await _context.DivisionPhases.FindAsync(request.PhaseId.Value);
                if (phase != null)
                    blockLabel += $" - {phase.Name}";
            }
            else if (!string.IsNullOrEmpty(request.PhaseType))
            {
                blockLabel += $" - {request.PhaseType}";
            }
        }

        // Calculate end time if not provided
        var endTime = request.EndTime ?? request.StartTime.AddHours(2);

        var block = new EventCourtScheduleBlock
        {
            EventId = eventId,
            DivisionId = request.DivisionId,
            PhaseId = request.PhaseId,
            PhaseType = request.PhaseType,
            BlockLabel = blockLabel,
            CourtIds = request.CourtIds ?? new List<int>(),
            StartTime = request.StartTime,
            EndTime = endTime,
            DependsOnBlockId = request.DependsOnBlockId,
            DependencyBufferMinutes = request.DependencyBufferMinutes,
            SortOrder = request.SortOrder,
            Notes = request.Notes,
            EstimatedMatchDurationMinutes = request.EstimatedMatchDurationMinutes,
            EncounterCount = encounterCount,
            CreatedByUserId = userId,
            UpdatedByUserId = userId
        };

        _context.EventCourtScheduleBlocks.Add(block);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Created schedule block {BlockId} for event {EventId}", block.Id, eventId);

        return (await GetScheduleBlockAsync(block.Id))!;
    }

    public async Task<EventCourtScheduleBlockDto?> UpdateScheduleBlockAsync(int blockId, UpdateScheduleBlockRequest request, int userId)
    {
        var block = await _context.EventCourtScheduleBlocks.FindAsync(blockId);
        if (block == null) return null;

        if (request.DivisionId.HasValue)
            block.DivisionId = request.DivisionId.Value;
        if (request.PhaseId.HasValue)
            block.PhaseId = request.PhaseId.Value;
        if (request.PhaseType != null)
            block.PhaseType = request.PhaseType;
        if (request.BlockLabel != null)
            block.BlockLabel = request.BlockLabel;
        if (request.CourtIds != null)
            block.CourtIds = request.CourtIds;
        if (request.StartTime.HasValue)
            block.StartTime = request.StartTime.Value;
        if (request.EndTime.HasValue)
            block.EndTime = request.EndTime.Value;
        if (request.DependsOnBlockId.HasValue)
            block.DependsOnBlockId = request.DependsOnBlockId.Value == 0 ? null : request.DependsOnBlockId;
        if (request.DependencyBufferMinutes.HasValue)
            block.DependencyBufferMinutes = request.DependencyBufferMinutes.Value;
        if (request.SortOrder.HasValue)
            block.SortOrder = request.SortOrder.Value;
        if (request.Notes != null)
            block.Notes = request.Notes;
        if (request.IsActive.HasValue)
            block.IsActive = request.IsActive.Value;
        if (request.EstimatedMatchDurationMinutes.HasValue)
            block.EstimatedMatchDurationMinutes = request.EstimatedMatchDurationMinutes.Value;

        block.UpdatedByUserId = userId;
        block.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Updated schedule block {BlockId}", blockId);

        return await GetScheduleBlockAsync(blockId);
    }

    public async Task<bool> DeleteScheduleBlockAsync(int blockId)
    {
        var block = await _context.EventCourtScheduleBlocks.FindAsync(blockId);
        if (block == null) return false;

        // Check for dependent blocks
        var dependentBlocks = await _context.EventCourtScheduleBlocks
            .Where(b => b.DependsOnBlockId == blockId)
            .ToListAsync();

        // Clear dependency references
        foreach (var dep in dependentBlocks)
        {
            dep.DependsOnBlockId = null;
        }

        _context.EventCourtScheduleBlocks.Remove(block);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Deleted schedule block {BlockId}", blockId);

        return true;
    }

    public async Task<MasterScheduleTimelineDto> GetTimelineAsync(int eventId)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            throw new ArgumentException("Event not found");

        var blocks = await GetScheduleBlocksAsync(eventId);

        // Get all courts for the event
        var courts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive)
            .OrderBy(c => c.SortOrder)
            .Select(c => new TimelineCourtBlocksDto
            {
                Id = c.Id,
                CourtLabel = c.CourtLabel,
                SortOrder = c.SortOrder,
                TimeSlots = new List<CourtBlockTimeSlotDto>()
            })
            .ToListAsync();

        // Build court time slots from blocks
        foreach (var court in courts)
        {
            var courtBlocks = blocks.Where(b => b.CourtIds.Contains(court.Id)).ToList();
            court.TimeSlots = courtBlocks.Select(b => new CourtBlockTimeSlotDto
            {
                BlockId = b.Id,
                DivisionId = b.DivisionId,
                DivisionName = b.DivisionName,
                DivisionColor = b.DivisionColor,
                PhaseType = b.PhaseType,
                BlockLabel = b.BlockLabel,
                StartTime = b.StartTime,
                EndTime = b.EndTime,
                HasConflict = false
            }).OrderBy(s => s.StartTime).ToList();
        }

        // Get division summary
        var divisions = await _context.EventDivisions
            .Where(d => d.EventId == eventId && d.IsActive)
            .OrderBy(d => d.SortOrder)
            .Select(d => new TimelineDivisionSummaryDto
            {
                Id = d.Id,
                Name = d.Name,
                BlockCount = 0,
                EncounterCount = d.Encounters.Count
            })
            .ToListAsync();

        // Assign colors and calculate block counts
        for (int i = 0; i < divisions.Count; i++)
        {
            divisions[i].Color = GetDivisionColor(divisions[i].Id);
            var divBlocks = blocks.Where(b => b.DivisionId == divisions[i].Id).ToList();
            divisions[i].BlockCount = divBlocks.Count;
            divisions[i].FirstBlockStart = divBlocks.Min(b => (DateTime?)b.StartTime);
            divisions[i].LastBlockEnd = divBlocks.Max(b => (DateTime?)b.EndTime);
        }

        // Validate for conflicts
        var conflicts = await ValidateScheduleBlocksAsync(eventId);

        // Mark conflicts on court time slots
        foreach (var conflict in conflicts.Where(c => c.ConflictType == "CourtOverlap" && c.CourtId.HasValue))
        {
            var court = courts.FirstOrDefault(c => c.Id == conflict.CourtId);
            if (court != null)
            {
                var slot1 = court.TimeSlots.FirstOrDefault(s => s.BlockId == conflict.Block1Id);
                var slot2 = court.TimeSlots.FirstOrDefault(s => s.BlockId == conflict.Block2Id);
                if (slot1 != null) slot1.HasConflict = true;
                if (slot2 != null) slot2.HasConflict = true;
            }
        }

        return new MasterScheduleTimelineDto
        {
            EventId = eventId,
            EventName = evt.Name,
            EventStartDate = evt.StartDate,
            EventEndDate = evt.EndDate,
            IsSchedulePublished = evt.SchedulePublishedAt.HasValue,
            SchedulePublishedAt = evt.SchedulePublishedAt,
            Blocks = blocks,
            Courts = courts,
            Divisions = divisions,
            Conflicts = conflicts
        };
    }

    public async Task<AutoScheduleResult> AutoScheduleEventAsync(int eventId, AutoScheduleRequest request)
    {
        var result = new AutoScheduleResult { Success = true };

        // Get blocks to process
        var blocksQuery = _context.EventCourtScheduleBlocks
            .Include(b => b.Division)
            .Include(b => b.Phase)
            .Where(b => b.EventId == eventId && b.IsActive);

        if (request.BlockIds?.Any() == true)
        {
            blocksQuery = blocksQuery.Where(b => request.BlockIds.Contains(b.Id));
        }

        var blocks = await blocksQuery
            .OrderBy(b => b.SortOrder)
            .ThenBy(b => b.StartTime)
            .ToListAsync();

        if (!blocks.Any())
        {
            result.Success = false;
            result.Message = "No schedule blocks found to process";
            return result;
        }

        // Process blocks in dependency order
        var processedBlockIds = new HashSet<int>();
        var blockEndTimes = new Dictionary<int, DateTime>();

        // First pass: recalculate start times based on dependencies
        if (request.RecalculateDependencies)
        {
            foreach (var block in blocks.Where(b => b.DependsOnBlockId.HasValue))
            {
                if (block.DependsOnBlockId.HasValue && blockEndTimes.TryGetValue(block.DependsOnBlockId.Value, out var depEndTime))
                {
                    block.StartTime = depEndTime.AddMinutes(block.DependencyBufferMinutes);
                }
            }
        }

        foreach (var block in blocks)
        {
            var blockResult = new BlockScheduleResult
            {
                BlockId = block.Id,
                BlockLabel = block.BlockLabel
            };

            try
            {
                // Get courts for this block
                var courtIds = block.CourtIds;
                if (!courtIds.Any())
                {
                    blockResult.Success = false;
                    blockResult.Message = "No courts assigned to this block";
                    result.BlockResults.Add(blockResult);
                    continue;
                }

                var courts = await _context.TournamentCourts
                    .Where(c => courtIds.Contains(c.Id) && c.IsActive)
                    .OrderBy(c => c.SortOrder)
                    .ToListAsync();

                if (!courts.Any())
                {
                    blockResult.Success = false;
                    blockResult.Message = "No valid courts found";
                    result.BlockResults.Add(blockResult);
                    continue;
                }

                // Get encounters to schedule
                var encounterQuery = _context.EventEncounters
                    .Include(e => e.Phase)
                    .Where(e => e.DivisionId == block.DivisionId && e.Status != "Bye" && e.Status != "Cancelled");

                if (block.PhaseId.HasValue)
                {
                    encounterQuery = encounterQuery.Where(e => e.PhaseId == block.PhaseId);
                }

                if (request.ClearExisting)
                {
                    // Clear existing assignments for encounters in this block
                    var encountersToUpdate = await encounterQuery.ToListAsync();
                    foreach (var enc in encountersToUpdate)
                    {
                        enc.TournamentCourtId = null;
                        enc.EstimatedStartTime = null;
                        enc.EstimatedEndTime = null;
                        enc.UpdatedAt = DateTime.Now;
                    }
                    await _context.SaveChangesAsync();
                }
                else
                {
                    encounterQuery = encounterQuery.Where(e => e.TournamentCourtId == null);
                }

                var encounters = await encounterQuery
                    .OrderBy(e => e.PoolId)
                    .ThenBy(e => e.RoundNumber)
                    .ThenBy(e => e.EncounterNumber)
                    .ToListAsync();

                if (!encounters.Any())
                {
                    blockResult.Success = true;
                    blockResult.Message = "No encounters to schedule";
                    blockResult.EncountersScheduled = 0;
                    result.BlockResults.Add(blockResult);
                    continue;
                }

                // Calculate effective start time (from dependency or block start)
                var effectiveStartTime = block.StartTime;
                if (block.DependsOnBlockId.HasValue && blockEndTimes.TryGetValue(block.DependsOnBlockId.Value, out var depEnd))
                {
                    effectiveStartTime = depEnd.AddMinutes(block.DependencyBufferMinutes);
                }

                // Get match duration
                var matchDuration = block.EstimatedMatchDurationMinutes
                    ?? block.Division?.EstimatedMatchDurationMinutes
                    ?? 20;

                // Schedule encounters using round-robin court assignment
                var courtNextAvailable = courts.ToDictionary(c => c.Id, c => effectiveStartTime);
                int scheduled = 0;

                foreach (var encounter in encounters)
                {
                    // Find the court available soonest (within block's courts)
                    var bestCourt = courts
                        .OrderBy(c => courtNextAvailable[c.Id])
                        .ThenBy(c => c.SortOrder)
                        .First();

                    var startTime = courtNextAvailable[bestCourt.Id];
                    
                    // Calculate encounter duration (may vary by phase)
                    int encounterDuration = matchDuration;
                    if (encounter.Phase != null && block.Division != null)
                    {
                        encounterDuration = await _courtAssignmentService.CalculateEncounterDurationMinutesAsync(
                            encounter, block.Division, encounter.Phase);
                    }

                    encounter.TournamentCourtId = bestCourt.Id;
                    encounter.EstimatedStartTime = startTime;
                    encounter.EstimatedDurationMinutes = encounterDuration;
                    encounter.EstimatedEndTime = startTime.AddMinutes(encounterDuration);
                    encounter.UpdatedAt = DateTime.Now;

                    courtNextAvailable[bestCourt.Id] = encounter.EstimatedEndTime.Value;
                    scheduled++;
                }

                // Calculate block end time
                var blockEndTime = courtNextAvailable.Values.Max();
                block.EndTime = blockEndTime;
                block.LastScheduledAt = DateTime.Now;
                blockEndTimes[block.Id] = blockEndTime;

                blockResult.Success = true;
                blockResult.EncountersScheduled = scheduled;
                blockResult.CalculatedStartTime = effectiveStartTime;
                blockResult.CalculatedEndTime = blockEndTime;
                blockResult.Message = $"Scheduled {scheduled} encounters";

                result.EncountersScheduled += scheduled;
                processedBlockIds.Add(block.Id);
            }
            catch (Exception ex)
            {
                blockResult.Success = false;
                blockResult.Message = ex.Message;
                _logger.LogError(ex, "Error scheduling block {BlockId}", block.Id);
            }

            result.BlockResults.Add(blockResult);
        }

        await _context.SaveChangesAsync();

        result.BlocksProcessed = processedBlockIds.Count;
        result.Message = $"Processed {result.BlocksProcessed} blocks, scheduled {result.EncountersScheduled} encounters";

        // Validate for conflicts after scheduling
        result.Conflicts = await ValidateScheduleBlocksAsync(eventId);
        result.ConflictsFound = result.Conflicts.Count;

        _logger.LogInformation("Auto-scheduled event {EventId}: {BlocksProcessed} blocks, {EncountersScheduled} encounters",
            eventId, result.BlocksProcessed, result.EncountersScheduled);

        return result;
    }

    public async Task<PlayerScheduleDto?> GetPlayerScheduleAsync(int eventId, int userId)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null) return null;

        var user = await _context.Users.FindAsync(userId);
        if (user == null) return null;

        // Find all units the player is a member of in this event
        var playerUnitIds = await _context.EventUnitMembers
            .Where(m => m.UserId == userId && m.Unit!.EventId == eventId && m.InviteStatus == "Accepted")
            .Select(m => m.UnitId)
            .ToListAsync();

        if (!playerUnitIds.Any())
        {
            return new PlayerScheduleDto
            {
                EventId = eventId,
                EventName = evt.Name,
                PlayerId = userId,
                PlayerName = $"{user.FirstName} {user.LastName}".Trim()
            };
        }

        // Get all encounters for these units
        var encounters = await _context.EventEncounters
            .Include(e => e.Division)
            .Include(e => e.Phase)
            .Include(e => e.Unit1)
            .Include(e => e.Unit2)
            .Include(e => e.TournamentCourt)
            .Where(e => e.EventId == eventId &&
                       (playerUnitIds.Contains(e.Unit1Id ?? 0) || playerUnitIds.Contains(e.Unit2Id ?? 0)))
            .OrderBy(e => e.EstimatedStartTime ?? e.ScheduledTime ?? DateTime.MaxValue)
            .ToListAsync();

        var now = DateTime.Now;
        var matches = encounters.Select(e =>
        {
            var isUnit1 = playerUnitIds.Contains(e.Unit1Id ?? 0);
            var myUnit = isUnit1 ? e.Unit1 : e.Unit2;
            var opponentUnit = isUnit1 ? e.Unit2 : e.Unit1;
            var matchTime = e.EstimatedStartTime ?? e.ScheduledTime ?? DateTime.MaxValue;

            string? timeUntil = null;
            if (matchTime > now && e.Status != "Completed" && e.Status != "Cancelled")
            {
                var diff = matchTime - now;
                if (diff.TotalMinutes < 60)
                    timeUntil = $"in {(int)diff.TotalMinutes} min";
                else if (diff.TotalHours < 24)
                    timeUntil = $"in {(int)diff.TotalHours}h {diff.Minutes}m";
                else
                    timeUntil = $"in {(int)diff.TotalDays}d {diff.Hours}h";
            }

            return new PlayerScheduleItemDto
            {
                EncounterId = e.Id,
                MatchTime = matchTime,
                EstimatedEndTime = e.EstimatedEndTime,
                CourtId = e.TournamentCourtId,
                CourtLabel = e.TournamentCourt?.CourtLabel,
                DivisionId = e.DivisionId,
                DivisionName = e.Division?.Name ?? "",
                PhaseId = e.PhaseId,
                PhaseName = e.Phase?.Name,
                PhaseType = e.Phase?.PhaseType,
                RoundName = e.RoundName,
                EncounterLabel = e.EncounterLabel,
                OpponentName = opponentUnit?.Name ?? e.Unit2SeedLabel ?? "TBD",
                OpponentUnitId = opponentUnit?.Id,
                MyTeamName = myUnit?.Name,
                MyUnitId = myUnit?.Id,
                Status = e.Status,
                TimeUntilMatch = timeUntil,
                IsBye = e.Status == "Bye" || (opponentUnit == null && !string.IsNullOrEmpty(e.Unit1SeedLabel) && e.Unit1SeedLabel == "BYE")
            };
        }).ToList();

        var completedCount = matches.Count(m => m.Status == "Completed");
        var nextMatch = matches.FirstOrDefault(m => m.Status != "Completed" && m.Status != "Cancelled" && !m.IsBye);
        var playerName = $"{user.FirstName} {user.LastName}".Trim();

        var totalMatchCount = matches.Count;
        
        return new PlayerScheduleDto
        {
            EventId = eventId,
            EventName = evt.Name,
            PlayerId = userId,
            PlayerName = string.IsNullOrEmpty(playerName) ? "Unknown" : playerName,
            Matches = matches,
            NextMatch = nextMatch,
            TotalMatches = totalMatchCount,
            CompletedMatches = completedCount,
            RemainingMatches = totalMatchCount - completedCount
        };
    }

    public async Task<List<ScheduleBlockConflictDto>> ValidateScheduleBlocksAsync(int eventId)
    {
        var conflicts = new List<ScheduleBlockConflictDto>();

        var blocks = await _context.EventCourtScheduleBlocks
            .Where(b => b.EventId == eventId && b.IsActive)
            .OrderBy(b => b.SortOrder)
            .ThenBy(b => b.StartTime)
            .ToListAsync();

        var courts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive)
            .ToDictionaryAsync(c => c.Id, c => c.CourtLabel);

        // Check for court overlaps
        var courtBlocks = new Dictionary<int, List<EventCourtScheduleBlock>>();
        foreach (var block in blocks)
        {
            foreach (var courtId in block.CourtIds)
            {
                if (!courtBlocks.ContainsKey(courtId))
                    courtBlocks[courtId] = new List<EventCourtScheduleBlock>();
                courtBlocks[courtId].Add(block);
            }
        }

        foreach (var kvp in courtBlocks)
        {
            var courtId = kvp.Key;
            var courtLabel = courts.GetValueOrDefault(courtId, $"Court {courtId}");
            var blockList = kvp.Value.OrderBy(b => b.StartTime).ToList();

            for (int i = 0; i < blockList.Count - 1; i++)
            {
                var current = blockList[i];
                var next = blockList[i + 1];

                if (current.EndTime > next.StartTime)
                {
                    conflicts.Add(new ScheduleBlockConflictDto
                    {
                        ConflictType = "CourtOverlap",
                        CourtId = courtId,
                        CourtLabel = courtLabel,
                        Block1Id = current.Id,
                        Block2Id = next.Id,
                        Block1Label = current.BlockLabel,
                        Block2Label = next.BlockLabel,
                        Message = $"Blocks overlap on {courtLabel}: '{current.BlockLabel}' ends at {current.EndTime:HH:mm} but '{next.BlockLabel}' starts at {next.StartTime:HH:mm}"
                    });
                }
            }
        }

        // Check for dependency violations
        foreach (var block in blocks.Where(b => b.DependsOnBlockId.HasValue))
        {
            var depBlock = blocks.FirstOrDefault(b => b.Id == block.DependsOnBlockId);
            if (depBlock != null)
            {
                var expectedStart = depBlock.EndTime.AddMinutes(block.DependencyBufferMinutes);
                if (block.StartTime < expectedStart)
                {
                    conflicts.Add(new ScheduleBlockConflictDto
                    {
                        ConflictType = "DependencyViolation",
                        Block1Id = depBlock.Id,
                        Block2Id = block.Id,
                        Block1Label = depBlock.BlockLabel,
                        Block2Label = block.BlockLabel,
                        Message = $"'{block.BlockLabel}' starts at {block.StartTime:HH:mm} but depends on '{depBlock.BlockLabel}' which ends at {depBlock.EndTime:HH:mm}"
                    });
                }
            }
        }

        return conflicts;
    }

    // ============================================
    // Helper Methods
    // ============================================

    private async Task<Dictionary<int, int>> GetScheduledEncounterCountsAsync(List<EventCourtScheduleBlock> blocks)
    {
        var result = new Dictionary<int, int>();

        foreach (var block in blocks)
        {
            var query = _context.EventEncounters
                .Where(e => e.DivisionId == block.DivisionId &&
                           e.TournamentCourtId != null &&
                           e.EstimatedStartTime != null);

            if (block.PhaseId.HasValue)
                query = query.Where(e => e.PhaseId == block.PhaseId);

            result[block.Id] = await query.CountAsync();
        }

        return result;
    }

    private EventCourtScheduleBlockDto MapToDto(
        EventCourtScheduleBlock block,
        Dictionary<int, string> courts,
        Dictionary<int, int> scheduledCounts)
    {
        return new EventCourtScheduleBlockDto
        {
            Id = block.Id,
            EventId = block.EventId,
            DivisionId = block.DivisionId,
            DivisionName = block.Division?.Name,
            DivisionColor = GetDivisionColor(block.DivisionId),
            PhaseId = block.PhaseId,
            PhaseName = block.Phase?.Name,
            PhaseType = block.PhaseType ?? block.Phase?.PhaseType,
            BlockLabel = block.BlockLabel,
            CourtIds = block.CourtIds,
            Courts = block.CourtIds.Select(id => new CourtSummaryDto
            {
                Id = id,
                CourtLabel = courts.GetValueOrDefault(id, $"Court {id}")
            }).ToList(),
            StartTime = block.StartTime,
            EndTime = block.EndTime,
            DependsOnBlockId = block.DependsOnBlockId,
            DependsOnBlockLabel = block.DependsOnBlock?.BlockLabel,
            DependencyBufferMinutes = block.DependencyBufferMinutes,
            SortOrder = block.SortOrder,
            Notes = block.Notes,
            IsActive = block.IsActive,
            EstimatedMatchDurationMinutes = block.EstimatedMatchDurationMinutes,
            EncounterCount = block.EncounterCount,
            ScheduledEncounterCount = scheduledCounts.GetValueOrDefault(block.Id, 0),
            LastScheduledAt = block.LastScheduledAt,
            CreatedAt = block.CreatedAt
        };
    }

    private static string GetDivisionColor(int divisionId)
    {
        return DivisionColors[divisionId % DivisionColors.Length];
    }
}
