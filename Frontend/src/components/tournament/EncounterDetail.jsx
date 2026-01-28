import { useState, useEffect } from 'react';
import {
  Users, Trophy, Clock, MapPin, ChevronDown, ChevronRight,
  ArrowRight, Loader2, RefreshCw, Play, CheckCircle, Circle,
  Award, Hash
} from 'lucide-react';
import { encounterApi } from '../../services/api';

/**
 * EncounterDetail - Shows full hierarchy of Encounter → Match → Game
 *
 * Data structure (from CLAUDE.md):
 * - EventEncounter: Scheduled matchup between two units/teams
 * - EncounterMatch: Individual matches within the encounter (e.g., Men's Doubles, Women's Doubles)
 * - EventGame: Games within each match (e.g., best-of-3 = up to 3 games)
 *
 * Props:
 * - encounterId: The encounter ID to display
 * - showHeader: Whether to show the encounter header (default: true)
 * - onGameClick: Callback when a game is clicked (for score entry, etc.)
 * - readOnly: Whether to show action buttons (default: false)
 */
export default function EncounterDetail({
  encounterId,
  showHeader = true,
  onGameClick,
  readOnly = false
}) {
  const [encounter, setEncounter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedMatches, setExpandedMatches] = useState(new Set());

  useEffect(() => {
    if (encounterId) {
      fetchEncounterDetail();
    }
  }, [encounterId]);

  const fetchEncounterDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await encounterApi.getEncounter(encounterId);
      // API returns { success, data: encounterDto }
      const raw = response?.data?.data || response?.data || response;
      if (raw) {
        // Transform flat API response to expected structure
        const encounterData = {
          ...raw,
          // Create unit objects from flat properties
          unit1: raw.unit1Id ? { id: raw.unit1Id, name: raw.unit1Name } : null,
          unit2: raw.unit2Id ? { id: raw.unit2Id, name: raw.unit2Name } : null,
          // Map matches with proper game references
          matches: (raw.matches || []).map(m => ({
            ...m,
            // Ensure games array is properly named
            games: m.games || []
          }))
        };
        setEncounter(encounterData);
        // Auto-expand all matches by default
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
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  };

  const statusColors = {
    Scheduled: 'bg-gray-100 text-gray-700 border-gray-300',
    Ready: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    InProgress: 'bg-blue-100 text-blue-700 border-blue-300',
    Playing: 'bg-blue-100 text-blue-700 border-blue-300',
    Completed: 'bg-green-100 text-green-700 border-green-300',
    Bye: 'bg-purple-100 text-purple-700 border-purple-300',
  };

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
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading encounter...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
        <button onClick={fetchEncounterDetail} className="ml-2 text-red-800 underline">
          Retry
        </button>
      </div>
    );
  }

  if (!encounter) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-gray-600 text-center">
        No encounter found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Encounter Header */}
      {showHeader && (
        <div className={`p-4 rounded-lg border-2 ${statusColors[encounter.status] || statusColors.Scheduled}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Match Number */}
              <div className="flex items-center justify-center w-12 h-12 bg-blue-600 text-white font-bold text-lg rounded-lg">
                {encounter.divisionMatchNumber || encounter.encounterNumber || 'M'}
              </div>

              {/* Units */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <UnitName unit={encounter.unit1} isWinner={encounter.winnerUnitId === encounter.unit1?.id} />
                  <span className="text-gray-400 text-sm">vs</span>
                  <UnitName unit={encounter.unit2} isWinner={encounter.winnerUnitId === encounter.unit2?.id} />
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                  {encounter.roundName && <span>{encounter.roundName}</span>}
                  {encounter.poolName && <span className="text-blue-600">Pool {encounter.poolName}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Court & Time */}
              <div className="text-right text-sm">
                {encounter.courtLabel && (
                  <div className="flex items-center gap-1 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    {encounter.courtLabel}
                  </div>
                )}
                {encounter.scheduledTime && (
                  <div className="flex items-center gap-1 text-gray-600">
                    <Clock className="w-4 h-4" />
                    {new Date(encounter.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>

              {/* Status */}
              <span className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 ${statusColors[encounter.status] || statusColors.Scheduled}`}>
                {getStatusIcon(encounter.status)}
                {encounter.status}
              </span>

              {/* Refresh */}
              <button
                onClick={fetchEncounterDetail}
                className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Advancement Info */}
          {(encounter.winnerNextEncounterId || encounter.loserNextEncounterId) && (
            <div className="mt-3 pt-3 border-t border-current border-opacity-20 flex gap-4 text-sm">
              {encounter.winnerNextEncounterId && (
                <span className="flex items-center gap-1 text-green-700">
                  <ArrowRight className="w-4 h-4" />
                  Winner advances to Match #{encounter.winnerNextEncounterId}
                </span>
              )}
              {encounter.loserNextEncounterId && (
                <span className="flex items-center gap-1 text-orange-700">
                  <ArrowRight className="w-4 h-4" />
                  Loser goes to Match #{encounter.loserNextEncounterId}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Matches List */}
      {encounter.matches && encounter.matches.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
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
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-6 bg-gray-50 rounded-lg text-gray-500">
          <Hash className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p>No matches configured</p>
          <p className="text-sm">This encounter uses simple scoring without separate matches</p>
        </div>
      )}

      {/* Games List (when no separate matches, games are at encounter level) */}
      {(!encounter.matches || encounter.matches.length === 0) && encounter.games && encounter.games.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Award className="w-4 h-4" />
            Games ({encounter.games.length})
          </h4>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {encounter.games.map(game => (
              <GameRow
                key={game.id}
                game={game}
                unit1={encounter.unit1}
                unit2={encounter.unit2}
                onClick={onGameClick ? () => onGameClick(game) : undefined}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * UnitName - Displays unit name with winner indicator
 */
function UnitName({ unit, isWinner }) {
  if (!unit) {
    return <span className="text-gray-400 italic">TBD</span>;
  }

  return (
    <span className={`flex items-center gap-1 ${isWinner ? 'font-bold text-green-700' : ''}`}>
      <Users className="w-4 h-4 text-gray-400" />
      {unit.name || unit.label || `Unit ${unit.id}`}
      {isWinner && <Trophy className="w-4 h-4 text-yellow-500" />}
    </span>
  );
}

/**
 * MatchCard - Shows an individual match within an encounter with its games
 */
function MatchCard({ match, encounter, isExpanded, onToggle, onGameClick, readOnly }) {
  const statusColors = {
    Scheduled: 'bg-gray-50 border-gray-200',
    Ready: 'bg-yellow-50 border-yellow-200',
    InProgress: 'bg-blue-50 border-blue-200',
    Playing: 'bg-blue-50 border-blue-200',
    Completed: 'bg-green-50 border-green-200',
  };

  const winsNeeded = Math.ceil((match.bestOf || 1) / 2);
  const unit1Wins = match.games?.filter(g => g.winnerUnitId === encounter.unit1?.id).length || 0;
  const unit2Wins = match.games?.filter(g => g.winnerUnitId === encounter.unit2?.id).length || 0;

  return (
    <div className={`border rounded-lg overflow-hidden ${statusColors[match.status] || statusColors.Scheduled}`}>
      {/* Match Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="font-medium text-gray-900">{match.name || match.formatName || `Match ${match.matchNumber}`}</span>
          {match.genderRequirement && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
              {match.genderRequirement}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Score Summary */}
          <div className="flex items-center gap-2 text-sm">
            <span className={unit1Wins >= winsNeeded ? 'font-bold text-green-700' : ''}>
              {unit1Wins}
            </span>
            <span className="text-gray-400">-</span>
            <span className={unit2Wins >= winsNeeded ? 'font-bold text-green-700' : ''}>
              {unit2Wins}
            </span>
          </div>

          {/* Best of indicator */}
          <span className="text-xs text-gray-500">Best of {match.bestOf || 1}</span>

          {/* Status */}
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            match.status === 'Completed' ? 'bg-green-100 text-green-700' :
            match.status === 'InProgress' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {match.status}
          </span>
        </div>
      </button>

      {/* Games List */}
      {isExpanded && match.games && match.games.length > 0 && (
        <div className="border-t border-current border-opacity-10 bg-white/50">
          <div className="divide-y divide-gray-100">
            {match.games.map((game, idx) => (
              <GameRow
                key={game.id}
                game={game}
                gameNumber={idx + 1}
                unit1={encounter.unit1}
                unit2={encounter.unit2}
                onClick={onGameClick ? () => onGameClick(game, match) : undefined}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      )}

      {/* No games yet */}
      {isExpanded && (!match.games || match.games.length === 0) && (
        <div className="px-4 py-3 text-sm text-gray-500 text-center border-t border-current border-opacity-10">
          No games recorded yet
        </div>
      )}
    </div>
  );
}

/**
 * GameRow - Shows an individual game with scores
 */
function GameRow({ game, gameNumber, unit1, unit2, onClick, readOnly }) {
  const isUnit1Winner = game.winnerUnitId === unit1?.id;
  const isUnit2Winner = game.winnerUnitId === unit2?.id;
  const isCompleted = game.status === 'Completed';

  return (
    <div
      className={`px-4 py-2 flex items-center justify-between ${onClick && !readOnly ? 'cursor-pointer hover:bg-gray-50' : ''}`}
      onClick={!readOnly ? onClick : undefined}
    >
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 text-sm font-medium rounded">
          G{gameNumber || game.gameNumber}
        </span>

        {/* Scores */}
        <div className="flex items-center gap-2">
          <span className={`w-8 text-center text-lg font-mono ${isUnit1Winner ? 'font-bold text-green-700' : ''}`}>
            {game.unit1Score ?? '-'}
          </span>
          <span className="text-gray-400">:</span>
          <span className={`w-8 text-center text-lg font-mono ${isUnit2Winner ? 'font-bold text-green-700' : ''}`}>
            {game.unit2Score ?? '-'}
          </span>
        </div>

        {/* Winner indicator */}
        {isCompleted && (isUnit1Winner || isUnit2Winner) && (
          <Trophy className="w-4 h-4 text-yellow-500" />
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Court */}
        {game.courtLabel && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {game.courtLabel}
          </span>
        )}

        {/* Status */}
        <span className={`px-2 py-0.5 rounded text-xs ${
          game.status === 'Completed' ? 'bg-green-100 text-green-700' :
          game.status === 'Playing' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {game.status}
        </span>
      </div>
    </div>
  );
}
