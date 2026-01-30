import { useState, useEffect } from 'react';
import {
  Trophy, Filter, Search, Clock, MapPin, CheckCircle2,
  Play, Loader2, ChevronDown, ChevronRight, Users
} from 'lucide-react';
import { tournamentApi } from '../../services/api';

/**
 * GameDayScoreboard - Live scoreboard with filters
 * Visible to all users (public view)
 */
export default function GameDayScoreboard({ eventId, event, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [encounters, setEncounters] = useState([]);
  const [phases, setPhases] = useState({});
  const [filters, setFilters] = useState({
    division: 'all',
    phase: 'all',
    status: 'all',
    search: ''
  });
  const [expandedDivisions, setExpandedDivisions] = useState({});

  useEffect(() => {
    loadEncounters();
  }, [eventId]);

  const loadEncounters = async () => {
    try {
      setLoading(true);

      // Load encounters for each division
      const allEncounters = [];
      const allPhases = {};

      for (const division of (event?.divisions || [])) {
        try {
          // Get phases for division
          const phasesRes = await tournamentApi.getDivisionPhases(division.id);
          if (phasesRes.success && phasesRes.data) {
            allPhases[division.id] = phasesRes.data;

            // Get encounters for each phase
            for (const phase of phasesRes.data) {
              const scheduleRes = await tournamentApi.getPhaseSchedule(phase.id);
              if (scheduleRes.success && scheduleRes.data?.encounters) {
                scheduleRes.data.encounters.forEach(enc => {
                  allEncounters.push({
                    ...enc,
                    divisionId: division.id,
                    divisionName: division.name,
                    phaseName: phase.name,
                    phaseType: phase.phaseType
                  });
                });
              }
            }
          }
        } catch (err) {
          console.error(`Error loading division ${division.id}:`, err);
        }
      }

      setEncounters(allEncounters);
      setPhases(allPhases);

      // Auto-expand first division
      if (event?.divisions?.length > 0) {
        setExpandedDivisions({ [event.divisions[0].id]: true });
      }
    } catch (err) {
      console.error('Error loading scoreboard:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter encounters
  const filteredEncounters = encounters.filter(enc => {
    if (filters.division !== 'all' && enc.divisionId !== parseInt(filters.division)) {
      return false;
    }
    if (filters.status !== 'all') {
      if (filters.status === 'live' && enc.status !== 'InProgress') return false;
      if (filters.status === 'completed' && enc.status !== 'Completed') return false;
      if (filters.status === 'upcoming' && enc.status !== 'Scheduled') return false;
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const unit1Label = enc.unit1?.label?.toLowerCase() || '';
      const unit2Label = enc.unit2?.label?.toLowerCase() || '';
      if (!unit1Label.includes(searchLower) && !unit2Label.includes(searchLower)) {
        return false;
      }
    }
    return true;
  });

  // Group by division
  const groupedByDivision = {};
  filteredEncounters.forEach(enc => {
    if (!groupedByDivision[enc.divisionId]) {
      groupedByDivision[enc.divisionId] = {
        name: enc.divisionName,
        encounters: []
      };
    }
    groupedByDivision[enc.divisionId].encounters.push(enc);
  });

  // Stats
  const stats = {
    total: encounters.length,
    live: encounters.filter(e => e.status === 'InProgress').length,
    completed: encounters.filter(e => e.status === 'Completed').length,
    upcoming: encounters.filter(e => e.status === 'Scheduled').length
  };

  const toggleDivision = (divId) => {
    setExpandedDivisions(prev => ({ ...prev, [divId]: !prev[divId] }));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'InProgress':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            <Play className="w-3 h-3" /> LIVE
          </span>
        );
      case 'Completed':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Done
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
            <Clock className="w-3 h-3" /> Upcoming
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar - Mobile Responsive */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Total Matches</div>
        </div>
        <div className={`rounded-xl shadow-sm p-4 ${stats.live > 0 ? 'bg-green-50 border border-green-200' : 'bg-white'}`}>
          <div className={`text-2xl font-bold ${stats.live > 0 ? 'text-green-600' : 'text-gray-400'}`}>
            {stats.live > 0 && <Play className="w-5 h-5 inline mr-1 animate-pulse" />}
            {stats.live}
          </div>
          <div className="text-sm text-gray-500">Live Now</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
          <div className="text-sm text-gray-500">Completed</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-2xl font-bold text-gray-600">{stats.upcoming}</div>
          <div className="text-sm text-gray-500">Upcoming</div>
        </div>
      </div>

      {/* Overall Progress */}
      {stats.total > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm font-bold text-orange-600">
              {Math.round((stats.completed / stats.total) * 100)}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                stats.completed === stats.total ? 'bg-green-500' : 'bg-orange-500'
              }`}
              style={{ width: `${(stats.completed / stats.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>

          <select
            value={filters.division}
            onChange={(e) => setFilters({ ...filters, division: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="all">All Divisions</option>
            {event?.divisions?.map(div => (
              <option key={div.id} value={div.id}>{div.name}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="all">All Status</option>
            <option value="live">Live</option>
            <option value="completed">Completed</option>
            <option value="upcoming">Upcoming</option>
          </select>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search teams..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="space-y-4">
        {Object.entries(groupedByDivision).map(([divId, division]) => (
          <div key={divId} className="bg-white rounded-lg shadow-sm overflow-hidden">
            {/* Division Header */}
            <button
              onClick={() => toggleDivision(divId)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedDivisions[divId] ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
                <Trophy className="w-5 h-5 text-orange-500" />
                <span className="font-semibold text-gray-900">{division.name}</span>
                <span className="text-sm text-gray-500">
                  ({division.encounters.length} matches)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {division.encounters.filter(e => e.status === 'InProgress').length > 0 && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    {division.encounters.filter(e => e.status === 'InProgress').length} LIVE
                  </span>
                )}
              </div>
            </button>

            {/* Matches */}
            {expandedDivisions[divId] && (
              <div className="divide-y divide-gray-100">
                {division.encounters.map(enc => (
                  <div
                    key={enc.id}
                    className={`p-3 md:p-4 ${enc.status === 'InProgress' ? 'bg-green-50' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      {/* Match Info */}
                      <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                        <div className="text-center w-10 md:w-12 flex-shrink-0">
                          <div className="text-base md:text-lg font-bold text-gray-900">
                            #{enc.divisionMatchNumber || enc.encounterNumber}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{enc.phaseName}</div>
                        </div>

                        {/* Teams & Score */}
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className={`flex items-center gap-2 md:gap-3 ${
                            enc.winnerUnitId === enc.unit1?.unitId ? 'font-bold' : ''
                          }`}>
                            <span className="flex-1 truncate text-sm md:text-base">
                              {enc.unit1?.label || 'TBD'}
                            </span>
                            <span className={`text-lg md:text-xl w-8 text-center font-bold ${
                              enc.status === 'Completed' && enc.winnerUnitId === enc.unit1?.unitId
                                ? 'text-green-600'
                                : 'text-gray-900'
                            }`}>
                              {enc.unit1Score ?? '-'}
                            </span>
                          </div>
                          <div className={`flex items-center gap-2 md:gap-3 ${
                            enc.winnerUnitId === enc.unit2?.unitId ? 'font-bold' : ''
                          }`}>
                            <span className="flex-1 truncate text-sm md:text-base">
                              {enc.unit2?.label || 'TBD'}
                            </span>
                            <span className={`text-lg md:text-xl w-8 text-center font-bold ${
                              enc.status === 'Completed' && enc.winnerUnitId === enc.unit2?.unitId
                                ? 'text-green-600'
                                : 'text-gray-900'
                            }`}>
                              {enc.unit2Score ?? '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status & Court */}
                      <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                        {getStatusBadge(enc.status)}
                        {enc.courtLabel && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <MapPin className="w-3 h-3" />
                            {enc.courtLabel}
                          </div>
                        )}
                        {enc.estimatedStartTime && enc.status === 'Scheduled' && (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            {new Date(enc.estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {Object.keys(groupedByDivision).length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No Matches Found</h3>
            <p className="text-sm text-gray-500 mt-1">
              {filters.division !== 'all' || filters.status !== 'all' || filters.search
                ? 'Try adjusting your filters'
                : 'No schedules have been generated yet'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
