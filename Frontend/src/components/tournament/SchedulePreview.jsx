import { useState, useEffect } from 'react';
import {
  Calendar, Clock, MapPin, Users, Trophy, ChevronDown, ChevronRight,
  Filter, Grid3X3, GitBranch, Loader2, RefreshCw
} from 'lucide-react';
import { tournamentApi } from '../../services/api';

/**
 * SchedulePreview - Displays tournament schedule with placeholder or resolved units
 * Shows matches organized by phase/pool with court assignments and estimated times
 */
export default function SchedulePreview({ divisionId, phaseId = null, showFilters = true }) {
  const [phases, setPhases] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [selectedPhase, setSelectedPhase] = useState(phaseId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'grid', 'bracket'
  const [filters, setFilters] = useState({
    pool: 'all',
    round: 'all',
    status: 'all'
  });

  useEffect(() => {
    if (divisionId) {
      fetchPhases();
    }
  }, [divisionId]);

  useEffect(() => {
    if (selectedPhase) {
      fetchSchedule(selectedPhase);
    }
  }, [selectedPhase]);

  const fetchPhases = async () => {
    try {
      const response = await tournamentApi.getDivisionPhases(divisionId);
      if (response.success && response.data?.length > 0) {
        setPhases(response.data);
        if (!selectedPhase) {
          setSelectedPhase(response.data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
    }
  };

  const fetchSchedule = async (phaseId) => {
    try {
      setLoading(true);
      setError(null);
      const response = await tournamentApi.getPhaseSchedule(phaseId);
      if (response.success) {
        setSchedule(response.data);
      }
    } catch (err) {
      setError('Failed to load schedule');
      console.error('Error fetching schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredEncounters = () => {
    if (!schedule?.encounters) return [];

    return schedule.encounters.filter(e => {
      if (filters.pool !== 'all' && e.poolName !== filters.pool) return false;
      if (filters.round !== 'all' && e.roundNumber !== parseInt(filters.round)) return false;
      if (filters.status !== 'all' && e.status !== filters.status) return false;
      return true;
    });
  };

  const getUniquePools = () => {
    if (!schedule?.encounters) return [];
    const pools = [...new Set(schedule.encounters.map(e => e.poolName).filter(Boolean))];
    return pools.sort();
  };

  const getUniqueRounds = () => {
    if (!schedule?.encounters) return [];
    const rounds = [...new Set(schedule.encounters.map(e => e.roundNumber))];
    return rounds.sort((a, b) => a - b);
  };

  const groupEncountersByRound = () => {
    const filtered = getFilteredEncounters();
    const grouped = {};

    filtered.forEach(encounter => {
      const key = encounter.poolName
        ? `${encounter.poolName}-${encounter.roundNumber}`
        : `Round ${encounter.roundNumber}`;

      if (!grouped[key]) {
        grouped[key] = {
          poolName: encounter.poolName,
          roundNumber: encounter.roundNumber,
          roundName: encounter.roundName,
          encounters: []
        };
      }
      grouped[key].encounters.push(encounter);
    });

    return Object.values(grouped).sort((a, b) => {
      if (a.poolName !== b.poolName) return (a.poolName || '').localeCompare(b.poolName || '');
      return a.roundNumber - b.roundNumber;
    });
  };

  if (!divisionId) {
    return (
      <div className="text-center py-8 text-gray-500">
        No division selected
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Phase Selector */}
      {phases.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {phases.map(phase => (
            <button
              key={phase.id}
              onClick={() => setSelectedPhase(phase.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                selectedPhase === phase.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {phase.name}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      {showFilters && schedule && (
        <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-3 rounded-lg">
          <Filter className="w-4 h-4 text-gray-500" />

          {/* Pool Filter */}
          {getUniquePools().length > 0 && (
            <select
              value={filters.pool}
              onChange={(e) => setFilters({ ...filters, pool: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Pools</option>
              {getUniquePools().map(pool => (
                <option key={pool} value={pool}>Pool {pool}</option>
              ))}
            </select>
          )}

          {/* Round Filter */}
          <select
            value={filters.round}
            onChange={(e) => setFilters({ ...filters, round: e.target.value })}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">All Rounds</option>
            {getUniqueRounds().map(round => (
              <option key={round} value={round}>Round {round}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">All Status</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Ready">Ready</option>
            <option value="InProgress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>

          {/* View Mode */}
          <div className="ml-auto flex items-center gap-1 bg-white rounded-lg border border-gray-300">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-l-lg ${viewMode === 'list' ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}
              title="List View"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('bracket')}
              className={`p-2 rounded-r-lg ${viewMode === 'bracket' ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}
              title="Bracket View"
            >
              <GitBranch className="w-4 h-4" />
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchSchedule(selectedPhase)}
            className="p-2 text-gray-500 hover:text-blue-600"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading schedule...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && schedule?.encounters?.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No matches scheduled yet</p>
          <p className="text-sm text-gray-500 mt-1">Generate a schedule from the Phase Manager</p>
        </div>
      )}

      {/* Schedule List */}
      {!loading && !error && schedule?.encounters?.length > 0 && viewMode === 'list' && (
        <div className="space-y-6">
          {groupEncountersByRound().map(group => (
            <RoundGroup key={`${group.poolName}-${group.roundNumber}`} group={group} />
          ))}
        </div>
      )}

      {/* Bracket View */}
      {!loading && !error && schedule?.encounters?.length > 0 && viewMode === 'bracket' && (
        <BracketView encounters={getFilteredEncounters()} />
      )}
    </div>
  );
}

function RoundGroup({ group }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Group Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          {group.poolName && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
              Pool {group.poolName}
            </span>
          )}
          <span className="font-medium text-gray-900">{group.roundName || `Round ${group.roundNumber}`}</span>
          <span className="text-sm text-gray-500">({group.encounters.length} matches)</span>
        </div>
        {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
      </button>

      {/* Encounters */}
      {isExpanded && (
        <div className="divide-y divide-gray-100">
          {group.encounters.map(encounter => (
            <EncounterRow key={encounter.id} encounter={encounter} />
          ))}
        </div>
      )}
    </div>
  );
}

function EncounterRow({ encounter }) {
  const statusColors = {
    Scheduled: 'bg-gray-100 text-gray-700',
    Ready: 'bg-yellow-100 text-yellow-700',
    InProgress: 'bg-blue-100 text-blue-700',
    Completed: 'bg-green-100 text-green-700',
    Bye: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="px-4 py-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        {/* Match Info */}
        <div className="flex items-center gap-4">
          {/* Match Label */}
          <div className="w-16 text-center">
            <span className="text-sm font-mono text-gray-500">{encounter.encounterLabel}</span>
          </div>

          {/* Units */}
          <div className="flex items-center gap-3">
            <UnitDisplay unit={encounter.unit1} isWinner={encounter.winnerUnitId === encounter.unit1?.unitId} />
            <span className="text-gray-400 text-sm">vs</span>
            <UnitDisplay unit={encounter.unit2} isWinner={encounter.winnerUnitId === encounter.unit2?.unitId} />
          </div>
        </div>

        {/* Meta Info */}
        <div className="flex items-center gap-4">
          {/* Court */}
          {encounter.courtLabel && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              {encounter.courtLabel}
            </div>
          )}

          {/* Time */}
          {encounter.estimatedStartTime && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              {new Date(encounter.estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          {/* Status */}
          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[encounter.status]}`}>
            {encounter.status}
          </span>
        </div>
      </div>

      {/* Progression Info */}
      {(encounter.winnerNextEncounterId || encounter.loserNextEncounterId) && (
        <div className="mt-2 text-xs text-gray-500 pl-20">
          {encounter.winnerNextEncounterId && (
            <span className="mr-4">Winner → Match #{encounter.winnerNextEncounterId}</span>
          )}
          {encounter.loserNextEncounterId && (
            <span>Loser → Match #{encounter.loserNextEncounterId}</span>
          )}
        </div>
      )}
    </div>
  );
}

function UnitDisplay({ unit, isWinner }) {
  if (!unit) return <span className="text-gray-400 italic">TBD</span>;

  return (
    <div className={`flex items-center gap-2 ${isWinner ? 'font-semibold text-green-700' : ''}`}>
      {unit.isResolved ? (
        <>
          <Users className="w-4 h-4 text-gray-400" />
          <span>{unit.label}</span>
          {isWinner && <Trophy className="w-4 h-4 text-yellow-500" />}
        </>
      ) : (
        <span className="text-gray-500 italic">{unit.label}</span>
      )}
    </div>
  );
}

function BracketView({ encounters }) {
  // Group encounters by round for bracket display
  const roundGroups = {};
  encounters.forEach(e => {
    const round = e.roundNumber;
    if (!roundGroups[round]) {
      roundGroups[round] = [];
    }
    roundGroups[round].push(e);
  });

  const rounds = Object.keys(roundGroups).sort((a, b) => parseInt(a) - parseInt(b));

  if (rounds.length === 0) {
    return <div className="text-center py-8 text-gray-500">No bracket matches to display</div>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-8 min-w-max p-4">
        {rounds.map(round => (
          <div key={round} className="flex flex-col gap-4">
            <h4 className="text-sm font-medium text-gray-700 text-center mb-2">
              {roundGroups[round][0]?.roundName || `Round ${round}`}
            </h4>
            <div className="flex flex-col gap-4 justify-around h-full">
              {roundGroups[round].map(encounter => (
                <BracketMatch key={encounter.id} encounter={encounter} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketMatch({ encounter }) {
  const statusColors = {
    Completed: 'border-green-500',
    InProgress: 'border-blue-500',
    Ready: 'border-yellow-500',
    default: 'border-gray-300'
  };

  const borderColor = statusColors[encounter.status] || statusColors.default;

  return (
    <div className={`bg-white border-2 ${borderColor} rounded-lg shadow-sm w-56`}>
      <div className="p-2 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{encounter.encounterLabel}</span>
          {encounter.courtLabel && (
            <span className="text-xs text-gray-400">{encounter.courtLabel}</span>
          )}
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        <BracketMatchSide
          unit={encounter.unit1}
          isWinner={encounter.winnerUnitId === encounter.unit1?.unitId}
        />
        <BracketMatchSide
          unit={encounter.unit2}
          isWinner={encounter.winnerUnitId === encounter.unit2?.unitId}
        />
      </div>
    </div>
  );
}

function BracketMatchSide({ unit, isWinner }) {
  return (
    <div className={`px-3 py-2 flex items-center justify-between ${isWinner ? 'bg-green-50' : ''}`}>
      <span className={`text-sm ${isWinner ? 'font-semibold text-green-700' : 'text-gray-700'} ${!unit?.isResolved ? 'italic text-gray-500' : ''}`}>
        {unit?.label || 'TBD'}
      </span>
      {isWinner && <Trophy className="w-4 h-4 text-yellow-500" />}
    </div>
  );
}
