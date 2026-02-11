import { useState, useEffect } from 'react';
import {
  Calendar, Clock, MapPin, Users, Trophy, ChevronDown, ChevronRight,
  Filter, Grid3X3, GitBranch, Loader2, RefreshCw, List, Table2, ArrowRight, Award, X
} from 'lucide-react';
import { tournamentApi } from '../../services/api';
import EncounterDetail from './EncounterDetail';

/**
 * SchedulePreview - Displays tournament schedule with placeholder or resolved units
 * Shows matches organized by phase/pool with court assignments and estimated times
 *
 * View modes:
 * - list: Grouped by round with expandable sections
 * - table: Clean tabular format with all info visible
 * - bracket: Visual bracket for elimination tournaments
 */
export default function SchedulePreview({ divisionId, phaseId = null, showFilters = true }) {
  const [phases, setPhases] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [selectedPhase, setSelectedPhase] = useState(phaseId);
  const [phaseDetails, setPhaseDetails] = useState(null); // full phase with advancement rules
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'list', 'table', 'bracket'
  const [filters, setFilters] = useState({
    pool: 'all',
    round: 'all',
    status: 'all'
  });
  const [selectedEncounterId, setSelectedEncounterId] = useState(null);

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
        // Filter out Draw and Award phases (they have no encounters to display)
        // and sort by phaseOrder to ensure correct display order
        const playablePhases = response.data
          .filter(p => p.phaseType !== 'Draw' && p.phaseType !== 'Award')
          .sort((a, b) => 
            (a.phaseOrder || a.sortOrder || 0) - (b.phaseOrder || b.sortOrder || 0)
          );
        setPhases(playablePhases);
        if (!selectedPhase && playablePhases.length > 0) {
          setSelectedPhase(playablePhases[0].id);
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
      const [scheduleRes, phaseRes] = await Promise.all([
        tournamentApi.getPhaseSchedule(phaseId),
        tournamentApi.getPhase(phaseId),
      ]);
      if (scheduleRes.success) {
        setSchedule(scheduleRes.data);
      }
      if (phaseRes.success) {
        setPhaseDetails(phaseRes.data);
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
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-l-lg ${viewMode === 'table' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              title="Table View"
            >
              <Table2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('bracket')}
              className={`p-2 rounded-r-lg ${viewMode === 'bracket' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
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

      {/* Phase Advancement Rules */}
      {!loading && phaseDetails && (
        <PhaseAdvancementInfo phaseDetails={phaseDetails} phases={phases} />
      )}

      {/* Empty State */}
      {!loading && !error && schedule?.encounters?.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No matches scheduled yet</p>
          <p className="text-sm text-gray-500 mt-1">Generate a schedule from the Phase Manager</p>
        </div>
      )}

      {/* Table View */}
      {!loading && !error && schedule?.encounters?.length > 0 && viewMode === 'table' && (
        <TableView
          encounters={getFilteredEncounters()}
          phaseName={schedule?.phase?.name}
          onEncounterClick={(encounterId) => setSelectedEncounterId(encounterId)}
        />
      )}

      {/* Schedule List */}
      {!loading && !error && schedule?.encounters?.length > 0 && viewMode === 'list' && (
        <div className="space-y-6">
          {groupEncountersByRound().map(group => (
            <RoundGroup
              key={`${group.poolName}-${group.roundNumber}`}
              group={group}
              allEncounters={schedule.encounters}
              onEncounterClick={(encounterId) => setSelectedEncounterId(encounterId)}
            />
          ))}
        </div>
      )}

      {/* Bracket View */}
      {!loading && !error && schedule?.encounters?.length > 0 && viewMode === 'bracket' && (
        <BracketView encounters={getFilteredEncounters()} onEncounterClick={(encounterId) => setSelectedEncounterId(encounterId)} />
      )}

      {/* Encounter Detail Modal */}
      {selectedEncounterId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">Encounter Details</h3>
              <button
                onClick={() => setSelectedEncounterId(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">
              <EncounterDetail
                encounterId={selectedEncounterId}
                showHeader={true}
                readOnly={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PhaseAdvancementInfo({ phaseDetails, phases }) {
  const incomingRules = phaseDetails.incomingRules || [];
  const outgoingRules = phaseDetails.outgoingRules || [];

  if (incomingRules.length === 0 && outgoingRules.length === 0) return null;

  // Build phase name lookup
  const phaseNameById = {};
  phases.forEach(p => { phaseNameById[p.id] = p.name; });

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-semibold text-blue-800">Phase Advancement</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Incoming: where units come from */}
        {incomingRules.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1">
              <ArrowRight className="w-3 h-3 rotate-180" />
              Incoming From
            </h4>
            <div className="space-y-1">
              {incomingRules.map((rule, idx) => (
                <div key={rule.id || idx} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  <span>
                    {rule.description || (
                      <>
                        <span className="font-medium">{phaseNameById[rule.sourcePhaseId] || `Phase ${rule.sourcePhaseId}`}</span>
                        {' '}#{rule.sourceRank} → Slot {rule.targetSlotNumber}
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outgoing: where winners/losers go */}
        {outgoingRules.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1">
              <ArrowRight className="w-3 h-3" />
              Advances To
            </h4>
            <div className="space-y-1">
              {outgoingRules.map((rule, idx) => (
                <div key={rule.id || idx} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    rule.description?.toLowerCase().includes('loser') ? 'bg-orange-500' : 'bg-green-500'
                  }`} />
                  <span>
                    {rule.description || (
                      <>
                        #{rule.sourceRank} → <span className="font-medium">{phaseNameById[rule.targetPhaseId] || `Phase ${rule.targetPhaseId}`}</span>
                        {' '}Slot {rule.targetSlotNumber}
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RoundGroup({ group, allEncounters, onEncounterClick }) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Build lookup: encounter DB id → display match number
  const matchNumberById = {};
  if (allEncounters) {
    allEncounters.forEach((enc) => {
      const num = enc.divisionMatchNumber || enc.encounterNumber || enc.encounterLabel;
      if (num) matchNumberById[enc.id] = num;
    });
  }

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
            <EncounterRow key={encounter.id} encounter={encounter} matchNumberById={matchNumberById} onEncounterClick={onEncounterClick} />
          ))}
        </div>
      )}
    </div>
  );
}

function EncounterRow({ encounter, matchNumberById = {}, onEncounterClick }) {
  const statusColors = {
    Scheduled: 'bg-gray-100 text-gray-700',
    Ready: 'bg-yellow-100 text-yellow-700',
    InProgress: 'bg-blue-100 text-blue-700',
    Completed: 'bg-green-100 text-green-700',
    Bye: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className={`px-4 py-3 hover:bg-blue-50 transition-colors ${onEncounterClick ? 'cursor-pointer' : ''}`} onClick={() => onEncounterClick?.(encounter.id)}>
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
            <span className="mr-4 text-green-600">Winner → Match {matchNumberById[encounter.winnerNextEncounterId] || encounter.winnerNextEncounterId}</span>
          )}
          {encounter.loserNextEncounterId && (
            <span className="text-orange-600">Loser → Match {matchNumberById[encounter.loserNextEncounterId] || encounter.loserNextEncounterId}</span>
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

function BracketView({ encounters, onEncounterClick }) {
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
                <BracketMatch key={encounter.id} encounter={encounter} onEncounterClick={onEncounterClick} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketMatch({ encounter, onEncounterClick }) {
  const statusColors = {
    Completed: 'border-green-500',
    InProgress: 'border-blue-500',
    Ready: 'border-yellow-500',
    default: 'border-gray-300'
  };

  const borderColor = statusColors[encounter.status] || statusColors.default;

  return (
    <div className={`bg-white border-2 ${borderColor} rounded-lg shadow-sm w-56 ${onEncounterClick ? 'cursor-pointer hover:shadow-md hover:border-blue-400 transition-all' : ''}`} onClick={() => onEncounterClick?.(encounter.id)}>
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

/**
 * TableView - Clean tabular format showing all match information
 * Columns: Match #, Round, Unit 1 (Source), Unit 2 (Source), Advances To, Court, Time, Status
 */
function TableView({ encounters, phaseName, onEncounterClick }) {
  const statusColors = {
    Scheduled: 'bg-gray-100 text-gray-700',
    Ready: 'bg-yellow-100 text-yellow-700',
    InProgress: 'bg-blue-100 text-blue-700',
    Completed: 'bg-green-100 text-green-700',
    Bye: 'bg-purple-100 text-purple-700',
  };

  // Build lookup: encounter DB id → display match number
  const matchNumberById = {};
  encounters.forEach((enc) => {
    const num = enc.divisionMatchNumber || enc.encounterNumber || enc.encounterLabel;
    if (num) matchNumberById[enc.id] = num;
  });

  // Format unit source for display
  const formatUnitSource = (unit) => {
    if (!unit) return { name: 'BYE', source: '', isBye: true };
    if (unit.isResolved) {
      return { name: unit.label, source: '', isResolved: true };
    }
    // Parse placeholder label for source info
    const label = unit.label || '';
    if (label.startsWith('Winner ')) {
      return { name: 'TBD', source: label, isWinner: true };
    }
    if (label.startsWith('Loser ')) {
      return { name: 'TBD', source: label, isLoser: true };
    }
    if (label.includes('Seed')) {
      return { name: label, source: '', isSeed: true };
    }
    if (label.startsWith('#')) {
      return { name: 'TBD', source: `Rank ${label} from prev. phase`, isRank: true };
    }
    return { name: label || 'TBD', source: '' };
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
              Match
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Round
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Unit 1
            </th>
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
              vs
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Unit 2
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Advances To
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
              Court
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
              Time
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {encounters.map((encounter, idx) => {
            const unit1 = formatUnitSource(encounter.unit1);
            const unit2 = formatUnitSource(encounter.unit2);
            const isWinner1 = encounter.winnerUnitId && encounter.winnerUnitId === encounter.unit1?.unitId;
            const isWinner2 = encounter.winnerUnitId && encounter.winnerUnitId === encounter.unit2?.unitId;

            return (
              <tr
                key={encounter.id}
                className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${onEncounterClick ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                onClick={() => onEncounterClick?.(encounter.id)}
              >
                {/* Match Number */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="inline-flex items-center justify-center w-10 h-8 bg-blue-100 text-blue-800 font-bold text-sm rounded">
                    {encounter.divisionMatchNumber || encounter.encounterNumber || encounter.encounterLabel}
                  </span>
                </td>

                {/* Round */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">
                      {encounter.roundName || `Round ${encounter.roundNumber}`}
                    </span>
                    {encounter.poolName && (
                      <span className="text-xs text-blue-600">Pool {encounter.poolName}</span>
                    )}
                  </div>
                </td>

                {/* Unit 1 */}
                <td className="px-3 py-3">
                  <UnitCell unit={unit1} isWinner={isWinner1} />
                </td>

                {/* VS */}
                <td className="px-3 py-3 text-center text-gray-400 text-sm">vs</td>

                {/* Unit 2 */}
                <td className="px-3 py-3">
                  <UnitCell unit={unit2} isWinner={isWinner2} />
                </td>

                {/* Advances To */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="flex flex-col gap-1 text-xs">
                    {encounter.winnerNextEncounterId && (
                      <span className="flex items-center gap-1 text-green-600">
                        <ArrowRight className="w-3 h-3" />
                        Winner → Match {matchNumberById[encounter.winnerNextEncounterId] || encounter.winnerNextEncounterId}
                      </span>
                    )}
                    {encounter.loserNextEncounterId && (
                      <span className="flex items-center gap-1 text-orange-600">
                        <ArrowRight className="w-3 h-3" />
                        Loser → Match {matchNumberById[encounter.loserNextEncounterId] || encounter.loserNextEncounterId}
                      </span>
                    )}
                    {!encounter.winnerNextEncounterId && !encounter.loserNextEncounterId && (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                </td>

                {/* Court */}
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                  {encounter.courtLabel || '—'}
                </td>

                {/* Time */}
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                  {encounter.estimatedStartTime
                    ? new Date(encounter.estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </td>

                {/* Status */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[encounter.status] || 'bg-gray-100 text-gray-700'}`}>
                    {encounter.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * UnitCell - Displays unit info with source indicator
 */
function UnitCell({ unit, isWinner }) {
  if (unit.isBye) {
    return <span className="text-purple-600 italic text-sm">BYE</span>;
  }

  return (
    <div className={`flex flex-col ${isWinner ? 'text-green-700' : ''}`}>
      <div className="flex items-center gap-1">
        {isWinner && <Trophy className="w-3 h-3 text-yellow-500" />}
        <span className={`text-sm ${unit.isResolved ? 'font-medium' : 'text-gray-500 italic'}`}>
          {unit.name}
        </span>
      </div>
      {unit.source && (
        <span className={`text-xs ${
          unit.isWinner ? 'text-green-600' :
          unit.isLoser ? 'text-orange-600' :
          unit.isRank ? 'text-purple-600' :
          'text-gray-500'
        }`}>
          {unit.source}
        </span>
      )}
    </div>
  );
}
