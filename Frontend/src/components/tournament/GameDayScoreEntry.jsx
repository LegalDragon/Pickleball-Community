import { useState, useEffect } from 'react';
import {
  ClipboardList, Search, Filter, Loader2, Play, CheckCircle2,
  Clock, ChevronRight, Save, AlertTriangle, MapPin
} from 'lucide-react';
import { tournamentApi, encounterApi, gameDayApi } from '../../services/api';

/**
 * GameDayScoreEntry - Score entry interface for scorekeepers
 */
export default function GameDayScoreEntry({ eventId, event, permissions, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [encounters, setEncounters] = useState([]);
  const [selectedEncounter, setSelectedEncounter] = useState(null);
  const [scores, setScores] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    division: 'all',
    status: 'active' // active = InProgress or Scheduled
  });

  useEffect(() => {
    loadEncounters();
  }, [eventId]);

  const loadEncounters = async () => {
    try {
      setLoading(true);
      setError(null);

      const allEncounters = [];

      for (const division of (event?.divisions || [])) {
        try {
          const phasesRes = await tournamentApi.getDivisionPhases(division.id);
          if (phasesRes.success && phasesRes.data) {
            for (const phase of phasesRes.data) {
              const scheduleRes = await tournamentApi.getPhaseSchedule(phase.id);
              if (scheduleRes.success && scheduleRes.data?.encounters) {
                scheduleRes.data.encounters.forEach(enc => {
                  allEncounters.push({
                    ...enc,
                    divisionId: division.id,
                    divisionName: division.name,
                    phaseName: phase.name,
                    phaseId: phase.id
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
    } catch (err) {
      console.error('Error loading encounters:', err);
      setError('Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  // Filter encounters
  const filteredEncounters = encounters.filter(enc => {
    if (filters.division !== 'all' && enc.divisionId !== parseInt(filters.division)) {
      return false;
    }
    if (filters.status === 'active') {
      return enc.status === 'InProgress' || enc.status === 'Scheduled';
    }
    if (filters.status === 'completed') {
      return enc.status === 'Completed';
    }
    return true;
  });

  // Sort: InProgress first, then Scheduled, then by match number
  const sortedEncounters = [...filteredEncounters].sort((a, b) => {
    const statusOrder = { InProgress: 0, Scheduled: 1, Completed: 2 };
    const statusDiff = (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
    if (statusDiff !== 0) return statusDiff;
    return (a.divisionMatchNumber || 0) - (b.divisionMatchNumber || 0);
  });

  const handleSelectEncounter = async (encounter) => {
    setSelectedEncounter(encounter);
    // Load detailed encounter data with games
    try {
      const detailRes = await encounterApi.getEncounter(encounter.id);
      if (detailRes.success) {
        // Merge loaded data with division/phase info from list
        setSelectedEncounter({
          ...detailRes.data,
          divisionName: encounter.divisionName,
          phaseName: encounter.phaseName
        });
        // Initialize scores from games
        const gameScores = {};
        detailRes.data.matches?.forEach(match => {
          match.games?.forEach(game => {
            gameScores[game.id] = {
              unit1Score: game.unit1Score ?? '',
              unit2Score: game.unit2Score ?? ''
            };
          });
        });
        setScores(gameScores);
      }
    } catch (err) {
      console.error('Error loading encounter detail:', err);
    }
  };

  const handleScoreChange = (gameId, field, value) => {
    setScores(prev => ({
      ...prev,
      [gameId]: {
        ...prev[gameId],
        [field]: value === '' ? '' : parseInt(value) || 0
      }
    }));
  };

  const handleSaveScores = async () => {
    if (!selectedEncounter) return;

    try {
      setSaving(true);
      setError(null);

      // Save each game score using gameDayApi.submitScore
      for (const [gameId, gameScores] of Object.entries(scores)) {
        if (gameScores.unit1Score !== '' && gameScores.unit2Score !== '') {
          await gameDayApi.submitScore(
            parseInt(gameId),
            parseInt(gameScores.unit1Score),
            parseInt(gameScores.unit2Score),
            false // don't finalize yet
          );
        }
      }

      // Refresh encounter detail
      await handleSelectEncounter(selectedEncounter);
      onRefresh?.();
    } catch (err) {
      console.error('Error saving scores:', err);
      setError('Failed to save scores');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteMatch = async (matchId) => {
    try {
      setSaving(true);
      setError(null);

      // Find the match and finalize all its games
      const match = selectedEncounter?.matches?.find(m => m.id === matchId);
      if (!match?.games?.length) {
        setError('No games to complete');
        return;
      }

      // Finalize each game that has scores
      for (const game of match.games) {
        const gameScore = scores[game.id];
        const unit1Score = gameScore?.unit1Score ?? game.unit1Score;
        const unit2Score = gameScore?.unit2Score ?? game.unit2Score;

        if (unit1Score !== '' && unit1Score !== null && unit2Score !== '' && unit2Score !== null) {
          await gameDayApi.submitScore(
            game.id,
            parseInt(unit1Score),
            parseInt(unit2Score),
            true // finalize the game
          );
        }
      }

      await handleSelectEncounter(selectedEncounter);
      onRefresh?.();
    } catch (err) {
      console.error('Error completing match:', err);
      setError('Failed to complete match');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'InProgress':
        return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">LIVE</span>;
      case 'Completed':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Done</span>;
      default:
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">Scheduled</span>;
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Match List */}
      <div className="lg:col-span-1 bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-orange-500" />
            Matches
          </h3>
          <div className="mt-3 flex gap-2">
            <select
              value={filters.division}
              onChange={(e) => setFilters({ ...filters, division: e.target.value })}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
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
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-100">
          {sortedEncounters.map(enc => (
            <button
              key={enc.id}
              onClick={() => handleSelectEncounter(enc)}
              className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                selectedEncounter?.id === enc.id ? 'bg-orange-50 border-l-4 border-orange-500' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      #{enc.divisionMatchNumber || enc.encounterNumber}
                    </span>
                    {getStatusBadge(enc.status)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {enc.unit1?.label || 'TBD'} vs {enc.unit2?.label || 'TBD'}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {enc.divisionName} • {enc.phaseName}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </button>
          ))}

          {sortedEncounters.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No matches found
            </div>
          )}
        </div>
      </div>

      {/* Score Entry Panel */}
      <div className="lg:col-span-2 bg-white rounded-lg shadow-sm">
        {selectedEncounter ? (
          <div>
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Match #{selectedEncounter.divisionMatchNumber || selectedEncounter.encounterNumber}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {selectedEncounter.divisionName} • {selectedEncounter.phaseName}
                  </p>
                </div>
                {getStatusBadge(selectedEncounter.status)}
              </div>

              {/* Teams */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-600 font-medium">Team 1</div>
                  <div className="text-lg font-bold text-gray-900">
                    {selectedEncounter.unit1?.name || selectedEncounter.unit1?.label || 'TBD'}
                  </div>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <div className="text-sm text-red-600 font-medium">Team 2</div>
                  <div className="text-lg font-bold text-gray-900">
                    {selectedEncounter.unit2?.name || selectedEncounter.unit2?.label || 'TBD'}
                  </div>
                </div>
              </div>
            </div>

            {/* Matches & Games */}
            <div className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-5 h-5" />
                  {error}
                </div>
              )}

              {selectedEncounter.matches?.length > 0 ? (
                selectedEncounter.matches.map(match => (
                  <div key={match.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="p-3 bg-gray-50 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">
                          {match.formatCode && <span className="text-orange-600 mr-2">[{match.formatCode}]</span>}
                          {match.name || match.formatName || `Match ${match.matchOrder}`}
                        </span>
                        {getStatusBadge(match.status)}
                      </div>
                      {match.status !== 'Completed' && (
                        <button
                          onClick={() => handleCompleteMatch(match.id)}
                          disabled={saving}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          Complete Match
                        </button>
                      )}
                    </div>

                    {/* Games */}
                    <div className="p-3 space-y-2">
                      {match.games?.map((game, idx) => (
                        <div key={game.id} className="flex items-center gap-4">
                          <span className="w-16 text-sm text-gray-500">Game {idx + 1}</span>
                          <input
                            type="number"
                            min="0"
                            value={scores[game.id]?.unit1Score ?? game.unit1Score ?? ''}
                            onChange={(e) => handleScoreChange(game.id, 'unit1Score', e.target.value)}
                            className="w-20 border border-gray-300 rounded-lg p-2 text-center text-lg font-bold"
                            placeholder="-"
                          />
                          <span className="text-gray-400">vs</span>
                          <input
                            type="number"
                            min="0"
                            value={scores[game.id]?.unit2Score ?? game.unit2Score ?? ''}
                            onChange={(e) => handleScoreChange(game.id, 'unit2Score', e.target.value)}
                            className="w-20 border border-gray-300 rounded-lg p-2 text-center text-lg font-bold"
                            placeholder="-"
                          />
                          {game.courtLabel && (
                            <span className="text-sm text-gray-500 flex items-center gap-1">
                              <MapPin className="w-4 h-4" /> {game.courtLabel}
                            </span>
                          )}
                        </div>
                      ))}

                      {(!match.games || match.games.length === 0) && (
                        <div className="text-center py-4 text-gray-500">
                          No games created yet
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p>No matches configured for this encounter</p>
                  <p className="text-sm mt-1">Generate schedule or create matches first</p>
                </div>
              )}

              {/* Save Button */}
              {selectedEncounter.matches?.length > 0 && (
                <button
                  onClick={handleSaveScores}
                  disabled={saving}
                  className="w-full py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Scores
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Select a Match</h3>
            <p className="text-sm mt-1">Choose a match from the list to enter scores</p>
          </div>
        )}
      </div>
    </div>
  );
}
