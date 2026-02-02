import { useState, useEffect, useCallback } from 'react';
import {
  Users, Trophy, Clock, MapPin, ChevronDown, ChevronRight,
  ArrowRight, Loader2, RefreshCw, Play, CheckCircle, Circle,
  Award, Hash, Info, Save, X, Edit3, AlertCircle, Shuffle
} from 'lucide-react';
import { encounterApi, tournamentApi } from '../../services/api';

/**
 * EncounterDetail - Shows full hierarchy of Encounter → Match → Game
 *
 * Props:
 * - encounterId: The encounter ID to display
 * - showHeader: Whether to show the encounter header (default: true)
 * - onGameClick: Callback when a game is clicked (for score entry, etc.)
 * - readOnly: Whether to show action buttons (default: false)
 * - eventId: Event ID (needed for loading courts when editing)
 * - divisionId: Division ID (optional, for loading available units)
 */
export default function EncounterDetail({
  encounterId,
  showHeader = true,
  onGameClick,
  readOnly = false,
  eventId,
  divisionId: propDivisionId
}) {
  const [encounter, setEncounter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedMatches, setExpandedMatches] = useState(new Set());

  // Admin edit state
  const [courts, setCourts] = useState([]);
  const [divisionUnits, setDivisionUnits] = useState([]);
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingTeams, setEditingTeams] = useState(false);
  const [editingCourt, setEditingCourt] = useState(false);
  const [pendingStatus, setPendingStatus] = useState('');
  const [pendingUnit1Id, setPendingUnit1Id] = useState(null);
  const [pendingUnit2Id, setPendingUnit2Id] = useState(null);
  const [pendingCourtId, setPendingCourtId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    if (encounterId) {
      fetchEncounterDetail();
    }
  }, [encounterId]);

  // Load courts and units when entering edit mode
  useEffect(() => {
    if (!readOnly && encounter) {
      const eId = eventId || encounter.eventId;
      const dId = propDivisionId || encounter.divisionId;
      if (eId) {
        tournamentApi.getTournamentCourts(eId).then(res => {
          if (res.success || res.data) setCourts(res.data || res);
        }).catch(() => {});
      }
      if (dId) {
        tournamentApi.getDivisionUnits(dId).then(res => {
          if (res.success || res.data) setDivisionUnits(res.data || res);
        }).catch(() => {});
      }
    }
  }, [readOnly, encounter?.id]);

  const fetchEncounterDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await encounterApi.getEncounter(encounterId);
      const raw = response?.data?.data || response?.data || response;
      if (raw) {
        const encounterData = {
          ...raw,
          unit1: raw.unit1Id ? { id: raw.unit1Id, name: raw.unit1Name } : null,
          unit2: raw.unit2Id ? { id: raw.unit2Id, name: raw.unit2Name } : null,
          matches: (raw.matches || []).map(m => ({
            ...m,
            games: m.games || []
          }))
        };
        setEncounter(encounterData);
        if (encounterData.matches?.length > 0) {
          setExpandedMatches(new Set(encounterData.matches.map(m => m.id)));
        }
      }
    } catch (err) {
      console.error('Error fetching encounter detail:', err);
      setError('Failed to load encounter details');
    } finally {
      setLoading(false);
    }
  };

  const toggleMatch = (matchId) => {
    setExpandedMatches(prev => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  };

  const showSaveMsg = (msg, isError = false) => {
    setSaveMessage({ text: msg, isError });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // --- Admin actions ---
  const handleStatusChange = async () => {
    if (!pendingStatus) return;
    try {
      setSaving(true);
      if (pendingStatus === 'InProgress') {
        await encounterApi.startEncounter(encounterId);
      } else if (pendingStatus === 'Completed') {
        await encounterApi.completeEncounter(encounterId);
      } else {
        await encounterApi.updateEncounter(encounterId, { status: pendingStatus });
      }
      showSaveMsg('Status updated');
      setEditingStatus(false);
      await fetchEncounterDetail();
    } catch (err) {
      showSaveMsg('Failed to update status', true);
    } finally {
      setSaving(false);
    }
  };

  const handleTeamChange = async () => {
    try {
      setSaving(true);
      await tournamentApi.updateEncounterUnits(encounterId, pendingUnit1Id, pendingUnit2Id);
      showSaveMsg('Teams updated');
      setEditingTeams(false);
      await fetchEncounterDetail();
    } catch (err) {
      showSaveMsg('Failed to update teams', true);
    } finally {
      setSaving(false);
    }
  };

  const handleCourtChange = async () => {
    try {
      setSaving(true);
      await tournamentApi.preAssignCourt(encounterId, pendingCourtId || null);
      showSaveMsg('Court updated');
      setEditingCourt(false);
      await fetchEncounterDetail();
    } catch (err) {
      showSaveMsg('Failed to update court', true);
    } finally {
      setSaving(false);
    }
  };

  const handleSetWinner = async (winnerUnitId) => {
    try {
      setSaving(true);
      await encounterApi.updateEncounter(encounterId, { winnerUnitId });
      showSaveMsg('Winner set');
      await fetchEncounterDetail();
    } catch (err) {
      showSaveMsg('Failed to set winner', true);
    } finally {
      setSaving(false);
    }
  };

  const statusColors = {
    Scheduled: 'bg-gray-700 text-gray-200 border-gray-600',
    Ready: 'bg-yellow-900/50 text-yellow-200 border-yellow-700',
    InProgress: 'bg-blue-900/50 text-blue-200 border-blue-700',
    Playing: 'bg-blue-900/50 text-blue-200 border-blue-700',
    Completed: 'bg-green-900/50 text-green-200 border-green-700',
    Bye: 'bg-purple-900/50 text-purple-200 border-purple-700',
  };

  const statusOptions = ['Scheduled', 'Ready', 'InProgress', 'Completed', 'Bye'];

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed': return <CheckCircle className="w-4 h-4" />;
      case 'InProgress':
      case 'Playing': return <Play className="w-4 h-4" />;
      default: return <Circle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="ml-2 text-gray-400">Loading encounter...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
        {error}
        <button onClick={fetchEncounterDetail} className="ml-2 text-red-200 underline">
          Retry
        </button>
      </div>
    );
  }

  if (!encounter) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg text-gray-400 text-center">
        No encounter found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Save Message Toast */}
      {saveMessage && (
        <div className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
          saveMessage.isError ? 'bg-red-900/50 text-red-300 border border-red-700' : 'bg-green-900/50 text-green-300 border border-green-700'
        }`}>
          {saveMessage.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {saveMessage.text}
        </div>
      )}

      {/* Encounter Header */}
      {showHeader && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          {/* Top Bar: Encounter # + Division/Phase/Round info */}
          <div className="px-4 py-3 flex items-center gap-4 border-b border-gray-700">
            {/* Big Encounter Number Badge */}
            <div className="flex items-center justify-center w-14 h-14 bg-blue-600 text-white font-bold text-xl rounded-xl shadow-lg flex-shrink-0">
              #{encounter.divisionMatchNumber || encounter.encounterNumber || '?'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {encounter.divisionName && (
                  <span className="px-2 py-0.5 bg-indigo-900/50 text-indigo-300 text-xs font-medium rounded border border-indigo-700">
                    {encounter.divisionName}
                  </span>
                )}
                {encounter.roundName && (
                  <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs font-medium rounded">
                    {encounter.roundName}
                  </span>
                )}
                {encounter.poolName && (
                  <span className="px-2 py-0.5 bg-cyan-900/50 text-cyan-300 text-xs font-medium rounded border border-cyan-700">
                    Pool {encounter.poolName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                {encounter.courtLabel && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {encounter.courtLabel}
                  </span>
                )}
                {encounter.scheduledTime && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(encounter.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Status Badge */}
              <span className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 border ${statusColors[encounter.status] || statusColors.Scheduled}`}>
                {getStatusIcon(encounter.status)}
                {encounter.status}
              </span>
              <button
                onClick={fetchEncounterDetail}
                className="p-2 text-gray-500 hover:text-blue-400 rounded-lg hover:bg-gray-700"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Teams Section */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              {/* Unit 1 */}
              <div className="flex-1">
                <TeamCard
                  unit={encounter.unit1}
                  unitNumber={encounter.unit1Number}
                  roster={encounter.unit1Roster}
                  isWinner={encounter.winnerUnitId === encounter.unit1?.id}
                  side="left"
                />
              </div>

              <div className="text-gray-500 font-bold text-lg px-3">VS</div>

              {/* Unit 2 */}
              <div className="flex-1">
                <TeamCard
                  unit={encounter.unit2}
                  unitNumber={encounter.unit2Number}
                  roster={encounter.unit2Roster}
                  isWinner={encounter.winnerUnitId === encounter.unit2?.id}
                  side="right"
                />
              </div>
            </div>
          </div>

          {/* Admin Controls */}
          {!readOnly && (
            <div className="px-4 py-3 border-t border-gray-700 bg-gray-800/50 space-y-3">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Edit3 className="w-3 h-3" /> Admin Controls
              </div>

              <div className="flex flex-wrap gap-3">
                {/* Status Change */}
                <div className="flex items-center gap-2">
                  {editingStatus ? (
                    <>
                      <select
                        value={pendingStatus}
                        onChange={e => setPendingStatus(e.target.value)}
                        className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
                      >
                        <option value="">Select status...</option>
                        {statusOptions.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button onClick={handleStatusChange} disabled={!pendingStatus || saving}
                        className="p-1 text-green-400 hover:text-green-300 disabled:opacity-50">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingStatus(false)} className="p-1 text-gray-500 hover:text-gray-300">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => { setEditingStatus(true); setPendingStatus(encounter.status); }}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded border border-gray-600">
                      Change Status
                    </button>
                  )}
                </div>

                {/* Court Assignment */}
                <div className="flex items-center gap-2">
                  {editingCourt ? (
                    <>
                      <select
                        value={pendingCourtId || ''}
                        onChange={e => setPendingCourtId(e.target.value ? parseInt(e.target.value) : null)}
                        className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200"
                      >
                        <option value="">No court</option>
                        {courts.map(c => (
                          <option key={c.id} value={c.id}>{c.courtLabel || c.label || `Court ${c.courtNumber}`}</option>
                        ))}
                      </select>
                      <button onClick={handleCourtChange} disabled={saving}
                        className="p-1 text-green-400 hover:text-green-300 disabled:opacity-50">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingCourt(false)} className="p-1 text-gray-500 hover:text-gray-300">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => { setEditingCourt(true); setPendingCourtId(encounter.tournamentCourtId); }}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded border border-gray-600">
                      <MapPin className="w-3 h-3 inline mr-1" /> Assign Court
                    </button>
                  )}
                </div>

                {/* Team Change */}
                <div className="flex items-center gap-2">
                  {editingTeams ? (
                    <>
                      <select
                        value={pendingUnit1Id || ''}
                        onChange={e => setPendingUnit1Id(e.target.value ? parseInt(e.target.value) : null)}
                        className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 max-w-[140px]"
                      >
                        <option value="">Unit 1...</option>
                        {divisionUnits.map(u => (
                          <option key={u.id} value={u.id}>{u.name || `Unit #${u.unitNumber}`}</option>
                        ))}
                      </select>
                      <span className="text-gray-500 text-xs">vs</span>
                      <select
                        value={pendingUnit2Id || ''}
                        onChange={e => setPendingUnit2Id(e.target.value ? parseInt(e.target.value) : null)}
                        className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 max-w-[140px]"
                      >
                        <option value="">Unit 2...</option>
                        {divisionUnits.map(u => (
                          <option key={u.id} value={u.id}>{u.name || `Unit #${u.unitNumber}`}</option>
                        ))}
                      </select>
                      <button onClick={handleTeamChange} disabled={saving}
                        className="p-1 text-green-400 hover:text-green-300 disabled:opacity-50">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingTeams(false)} className="p-1 text-gray-500 hover:text-gray-300">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => {
                      setEditingTeams(true);
                      setPendingUnit1Id(encounter.unit1?.id || null);
                      setPendingUnit2Id(encounter.unit2?.id || null);
                    }}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded border border-gray-600">
                      <Users className="w-3 h-3 inline mr-1" /> Change Teams
                    </button>
                  )}
                </div>

                {/* Winner Selection (only when Completed or close to it) */}
                {(encounter.status === 'Completed' || encounter.status === 'InProgress') && encounter.unit1 && encounter.unit2 && (
                  <div className="flex items-center gap-2 border-l border-gray-600 pl-3">
                    <span className="text-xs text-gray-500">Winner:</span>
                    <button
                      onClick={() => handleSetWinner(encounter.unit1.id)}
                      disabled={saving || encounter.winnerUnitId === encounter.unit1.id}
                      className={`px-2 py-1 text-xs rounded ${
                        encounter.winnerUnitId === encounter.unit1.id
                          ? 'bg-green-800 text-green-200 border border-green-600'
                          : 'bg-gray-700 hover:bg-green-800/50 text-gray-300 border border-gray-600'
                      }`}
                    >
                      <Trophy className="w-3 h-3 inline mr-1" />
                      {encounter.unit1.name || 'Unit 1'}
                    </button>
                    <button
                      onClick={() => handleSetWinner(encounter.unit2.id)}
                      disabled={saving || encounter.winnerUnitId === encounter.unit2.id}
                      className={`px-2 py-1 text-xs rounded ${
                        encounter.winnerUnitId === encounter.unit2.id
                          ? 'bg-green-800 text-green-200 border border-green-600'
                          : 'bg-gray-700 hover:bg-green-800/50 text-gray-300 border border-gray-600'
                      }`}
                    >
                      <Trophy className="w-3 h-3 inline mr-1" />
                      {encounter.unit2.name || 'Unit 2'}
                    </button>
                  </div>
                )}
              </div>

              {saving && (
                <div className="flex items-center gap-2 text-sm text-blue-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                </div>
              )}
            </div>
          )}

          {/* Advancement Info */}
          {(encounter.winnerNextEncounterId || encounter.loserNextEncounterId) && (
            <div className="px-4 py-2 border-t border-gray-700 flex gap-4 text-sm bg-gray-800/30">
              {encounter.winnerNextEncounterId && (
                <span className="flex items-center gap-1 text-green-400">
                  <ArrowRight className="w-4 h-4" />
                  Winner → Match #{encounter.winnerNextEncounterId}
                </span>
              )}
              {encounter.loserNextEncounterId && (
                <span className="flex items-center gap-1 text-orange-400">
                  <ArrowRight className="w-4 h-4" />
                  Loser → Match #{encounter.loserNextEncounterId}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Matches List */}
      {encounter.matches && encounter.matches.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <Hash className="w-4 h-4" />
            Matches ({encounter.matches.length})
          </h4>
          {encounter.matches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              encounter={encounter}
              isExpanded={expandedMatches.has(match.id)}
              onToggle={() => toggleMatch(match.id)}
              onGameClick={onGameClick}
              readOnly={readOnly}
              courts={courts}
              onRefresh={fetchEncounterDetail}
              showSaveMsg={showSaveMsg}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-6 bg-gray-800 rounded-lg text-gray-500 border border-gray-700">
          <Hash className="w-8 h-8 mx-auto mb-2 text-gray-600" />
          <p>No matches configured</p>
          <p className="text-sm text-gray-600">This encounter uses simple scoring without separate matches</p>
        </div>
      )}

      {/* Games List (when no separate matches, games are at encounter level) */}
      {(!encounter.matches || encounter.matches.length === 0) && encounter.games && encounter.games.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <Award className="w-4 h-4" />
            Games ({encounter.games.length})
          </h4>
          <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
            {encounter.games.map(game => (
              <GameRow
                key={game.id}
                game={game}
                unit1={encounter.unit1}
                unit2={encounter.unit2}
                onClick={onGameClick ? () => onGameClick(game) : undefined}
                readOnly={readOnly}
                courts={courts}
                onRefresh={fetchEncounterDetail}
                showSaveMsg={showSaveMsg}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * TeamCard - Displays team info with roster
 */
function TeamCard({ unit, unitNumber, roster, isWinner, side }) {
  const [showRoster, setShowRoster] = useState(false);
  const align = side === 'right' ? 'text-right' : 'text-left';

  if (!unit) {
    return (
      <div className={`p-3 bg-gray-700/50 rounded-lg border border-gray-600 border-dashed ${align}`}>
        <span className="text-gray-500 italic">TBD</span>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-lg border ${isWinner ? 'bg-green-900/30 border-green-700' : 'bg-gray-700/30 border-gray-600'} ${align}`}>
      <div className={`flex items-center gap-2 ${side === 'right' ? 'justify-end' : ''}`}>
        {isWinner && <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
        <span className={`font-semibold ${isWinner ? 'text-green-300' : 'text-gray-200'}`}>
          {unit.name || `Unit ${unit.id}`}
        </span>
        {unitNumber && (
          <span className="px-1.5 py-0.5 bg-gray-600 text-gray-300 text-xs rounded">
            #{unitNumber}
          </span>
        )}
        <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
      </div>

      {/* Roster toggle */}
      {roster && roster.length > 0 && (
        <div className="mt-1">
          <button
            onClick={() => setShowRoster(!showRoster)}
            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
            style={{ justifyContent: side === 'right' ? 'flex-end' : 'flex-start', width: '100%' }}
          >
            {showRoster ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {roster.length} member{roster.length !== 1 ? 's' : ''}
          </button>
          {showRoster && (
            <div className="mt-1 space-y-0.5">
              {roster.map((member, idx) => (
                <div key={member.userId || idx} className={`text-xs text-gray-400 flex items-center gap-1 ${side === 'right' ? 'justify-end' : ''}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${member.isCheckedIn ? 'bg-green-400' : 'bg-gray-500'}`} />
                  {member.name || 'Unknown'}
                  {member.gender && <span className="text-gray-600">({member.gender[0]})</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * MatchCard - Shows an individual match within an encounter with its games
 */
function MatchCard({ match, encounter, isExpanded, onToggle, onGameClick, readOnly, courts, onRefresh, showSaveMsg }) {
  const statusColors = {
    Scheduled: 'bg-gray-800 border-gray-700',
    Ready: 'bg-yellow-900/20 border-yellow-800',
    InProgress: 'bg-blue-900/20 border-blue-800',
    Playing: 'bg-blue-900/20 border-blue-800',
    Completed: 'bg-green-900/20 border-green-800',
  };

  const winsNeeded = Math.ceil((match.bestOf || 1) / 2);
  const unit1Wins = match.games?.filter(g => g.winnerUnitId === encounter.unit1?.id).length || 0;
  const unit2Wins = match.games?.filter(g => g.winnerUnitId === encounter.unit2?.id).length || 0;

  // Build gender info from match player requirements
  const genderInfo = [];
  if (match.maleCount > 0) genderInfo.push(`${match.maleCount}M`);
  if (match.femaleCount > 0) genderInfo.push(`${match.femaleCount}F`);
  if (match.unisexCount > 0) genderInfo.push(`${match.unisexCount}Any`);

  return (
    <div className={`border rounded-lg overflow-hidden ${statusColors[match.status] || statusColors.Scheduled}`}>
      {/* Match Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
          <span className="font-medium text-gray-200">{match.formatName || match.name || `Match ${match.matchNumber}`}</span>
          {genderInfo.length > 0 && (
            <span className="px-2 py-0.5 bg-purple-900/50 text-purple-300 text-xs rounded border border-purple-800">
              {genderInfo.join(' / ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Score Summary */}
          <div className="flex items-center gap-2 text-sm">
            <span className={unit1Wins >= winsNeeded ? 'font-bold text-green-400' : 'text-gray-300'}>
              {unit1Wins}
            </span>
            <span className="text-gray-600">-</span>
            <span className={unit2Wins >= winsNeeded ? 'font-bold text-green-400' : 'text-gray-300'}>
              {unit2Wins}
            </span>
          </div>

          {match.bestOf && (
            <span className="text-xs text-gray-500">Best of {match.bestOf}</span>
          )}

          {/* Court */}
          {match.courtLabel && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {match.courtLabel}
            </span>
          )}

          <span className={`px-2 py-1 rounded text-xs font-medium ${
            match.status === 'Completed' ? 'bg-green-900/50 text-green-300 border border-green-800' :
            match.status === 'InProgress' || match.status === 'Playing' ? 'bg-blue-900/50 text-blue-300 border border-blue-800' :
            'bg-gray-700 text-gray-400 border border-gray-600'
          }`}>
            {match.status}
          </span>
        </div>
      </button>

      {/* Players in Match */}
      {isExpanded && (match.unit1Players?.length > 0 || match.unit2Players?.length > 0) && (
        <div className="px-4 py-2 border-t border-gray-700/50 bg-gray-800/30">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">
              {match.unit1Players?.map(p => p.name).join(', ') || 'No lineup'}
            </div>
            <span className="text-xs text-gray-600 px-2">vs</span>
            <div className="text-xs text-gray-400 text-right">
              {match.unit2Players?.map(p => p.name).join(', ') || 'No lineup'}
            </div>
          </div>
        </div>
      )}

      {/* Games List */}
      {isExpanded && match.games && match.games.length > 0 && (
        <div className="border-t border-gray-700/50">
          <div className="divide-y divide-gray-700/50">
            {match.games.map((game, idx) => (
              <GameRow
                key={game.id}
                game={game}
                gameNumber={idx + 1}
                unit1={encounter.unit1}
                unit2={encounter.unit2}
                onClick={onGameClick ? () => onGameClick(game, match) : undefined}
                readOnly={readOnly}
                courts={courts}
                onRefresh={onRefresh}
                showSaveMsg={showSaveMsg}
              />
            ))}
          </div>
        </div>
      )}

      {isExpanded && (!match.games || match.games.length === 0) && (
        <div className="px-4 py-3 text-sm text-gray-500 text-center border-t border-gray-700/50">
          No games recorded yet
        </div>
      )}
    </div>
  );
}

/**
 * GameRow - Shows an individual game with scores (and inline editing if not readOnly)
 */
function GameRow({ game, gameNumber, unit1, unit2, onClick, readOnly, courts, onRefresh, showSaveMsg }) {
  const isUnit1Winner = game.winnerUnitId === unit1?.id;
  const isUnit2Winner = game.winnerUnitId === unit2?.id;
  const isCompleted = game.status === 'Completed' || game.status === 'Finished';

  const [editing, setEditing] = useState(false);
  const [scoreU1, setScoreU1] = useState(game.unit1Score ?? '');
  const [scoreU2, setScoreU2] = useState(game.unit2Score ?? '');
  const [editingCourt, setEditingCourt] = useState(false);
  const [courtId, setCourtId] = useState(game.tournamentCourtId || '');
  const [saving, setSaving] = useState(false);
  const [showFormatInfo, setShowFormatInfo] = useState(false);

  const handleSaveScore = async () => {
    try {
      setSaving(true);
      await tournamentApi.adminUpdateScore(game.id, parseInt(scoreU1) || 0, parseInt(scoreU2) || 0);
      showSaveMsg?.('Score saved');
      setEditing(false);
      onRefresh?.();
    } catch (err) {
      showSaveMsg?.('Failed to save score', true);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCourt = async () => {
    try {
      setSaving(true);
      await tournamentApi.assignGameToCourt(game.id, courtId ? parseInt(courtId) : null);
      showSaveMsg?.('Court assigned');
      setEditingCourt(false);
      onRefresh?.();
    } catch (err) {
      showSaveMsg?.('Failed to assign court', true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-2 flex items-center justify-between group hover:bg-gray-700/20">
      <div className="flex items-center gap-3">
        {/* Game number badge */}
        <span className="w-8 h-8 flex items-center justify-center bg-gray-700 text-gray-400 text-sm font-medium rounded">
          G{gameNumber || game.gameNumber}
        </span>

        {/* Scores */}
        {editing && !readOnly ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={scoreU1}
              onChange={e => setScoreU1(e.target.value)}
              className="w-12 h-8 text-center bg-gray-700 border border-gray-600 rounded text-gray-200 text-lg font-mono"
              min="0"
            />
            <span className="text-gray-500">:</span>
            <input
              type="number"
              value={scoreU2}
              onChange={e => setScoreU2(e.target.value)}
              className="w-12 h-8 text-center bg-gray-700 border border-gray-600 rounded text-gray-200 text-lg font-mono"
              min="0"
            />
            <button onClick={handleSaveScore} disabled={saving}
              className="p-1 text-green-400 hover:text-green-300 disabled:opacity-50">
              <Save className="w-4 h-4" />
            </button>
            <button onClick={() => setEditing(false)} className="p-1 text-gray-500 hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
            {saving && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
          </div>
        ) : (
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { if (!readOnly) { setEditing(true); setScoreU1(game.unit1Score ?? ''); setScoreU2(game.unit2Score ?? ''); } else if (onClick) { onClick(); } }}>
            <span className={`w-8 text-center text-lg font-mono ${isUnit1Winner ? 'font-bold text-green-400' : 'text-gray-300'}`}>
              {game.unit1Score ?? '-'}
            </span>
            <span className="text-gray-600">:</span>
            <span className={`w-8 text-center text-lg font-mono ${isUnit2Winner ? 'font-bold text-green-400' : 'text-gray-300'}`}>
              {game.unit2Score ?? '-'}
            </span>
          </div>
        )}

        {isCompleted && (isUnit1Winner || isUnit2Winner) && (
          <Trophy className="w-4 h-4 text-yellow-400" />
        )}

        {/* Format Info Icon */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowFormatInfo(!showFormatInfo); }}
            className="p-1 text-gray-600 hover:text-blue-400 rounded"
            title="Game format info"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
          {showFormatInfo && (
            <div className="absolute z-50 left-0 top-full mt-1 w-56 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 text-xs text-gray-300"
              onClick={(e) => e.stopPropagation()}>
              <div className="font-medium text-gray-200 mb-1">Game Format</div>
              {game.scoreFormatId ? (
                <div className="space-y-1">
                  <div>Score Format ID: {game.scoreFormatId}</div>
                </div>
              ) : (
                <div className="text-gray-500">Standard scoring</div>
              )}
              <div className="mt-1.5 pt-1.5 border-t border-gray-700">
                <div>Game #{game.gameNumber || gameNumber}</div>
                <div>Status: {game.status}</div>
                {game.startedAt && <div>Started: {new Date(game.startedAt).toLocaleString()}</div>}
                {game.finishedAt && <div>Finished: {new Date(game.finishedAt).toLocaleString()}</div>}
              </div>
              <button
                onClick={() => setShowFormatInfo(false)}
                className="mt-2 w-full text-center text-gray-500 hover:text-gray-300 text-xs"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Court display/edit */}
        {editingCourt && !readOnly ? (
          <div className="flex items-center gap-1">
            <select
              value={courtId}
              onChange={e => setCourtId(e.target.value)}
              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-200"
            >
              <option value="">No court</option>
              {(courts || []).map(c => (
                <option key={c.id} value={c.id}>{c.courtLabel || c.label || `Court ${c.courtNumber}`}</option>
              ))}
            </select>
            <button onClick={handleSaveCourt} disabled={saving}
              className="p-1 text-green-400 hover:text-green-300 disabled:opacity-50">
              <Save className="w-3 h-3" />
            </button>
            <button onClick={() => setEditingCourt(false)} className="p-1 text-gray-500 hover:text-gray-300">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <span
            className={`text-xs text-gray-500 flex items-center gap-1 ${!readOnly ? 'cursor-pointer hover:text-gray-300' : ''}`}
            onClick={() => { if (!readOnly) { setEditingCourt(true); setCourtId(game.tournamentCourtId || ''); } }}
          >
            <MapPin className="w-3 h-3" />
            {game.courtLabel || (courts || []).find(c => c.id === game.tournamentCourtId)?.courtLabel || 'No court'}
          </span>
        )}

        {/* Status */}
        <span className={`px-2 py-0.5 rounded text-xs ${
          game.status === 'Completed' || game.status === 'Finished' ? 'bg-green-900/50 text-green-300' :
          game.status === 'Playing' || game.status === 'Started' ? 'bg-blue-900/50 text-blue-300' :
          'bg-gray-700 text-gray-400'
        }`}>
          {game.status}
        </span>
      </div>
    </div>
  );
}
