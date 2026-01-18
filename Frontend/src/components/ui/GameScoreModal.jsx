import { useState } from 'react';
import { X, CheckCircle, Play, User } from 'lucide-react';
import { getSharedAssetUrl } from '../../services/api';

const STATUS_COLORS = {
  Scheduled: 'bg-gray-100 text-gray-600',
  Pending: 'bg-yellow-100 text-yellow-700',
  Queued: 'bg-blue-100 text-blue-700',
  InProgress: 'bg-green-100 text-green-700',
  Playing: 'bg-green-100 text-green-700',
  Completed: 'bg-purple-100 text-purple-700',
  Finished: 'bg-purple-100 text-purple-700'
};

/**
 * Reusable game score editing modal
 * Props:
 * - game: The game object with unit1, unit2, scores, status, etc.
 * - courts: Array of available courts (optional)
 * - onClose: Close handler
 * - onSuccess: Success handler after save
 * - onPlayerClick: Handler when player avatar/name is clicked (receives userId)
 * - onSaveScore: Custom handler for saving score (gameId, unit1Score, unit2Score, finish) => Promise
 * - onAssignCourt: Custom handler for court assignment (gameId, courtId) => Promise
 * - onStatusChange: Custom handler for status change (gameId, status) => Promise
 * - showCourtAssignment: Whether to show court assignment (default true)
 * - showStatusControl: Whether to show status buttons (default true)
 * - readOnly: If true, disable all editing
 */
export default function GameScoreModal({
  game,
  courts = [],
  onClose,
  onSuccess,
  onPlayerClick,
  onSaveScore,
  onAssignCourt,
  onStatusChange,
  showCourtAssignment = true,
  showStatusControl = true,
  readOnly = false
}) {
  const [unit1Score, setUnit1Score] = useState(game.unit1Score || 0);
  const [unit2Score, setUnit2Score] = useState(game.unit2Score || 0);
  const [courtId, setCourtId] = useState(game.courtId || '');
  const [submitting, setSubmitting] = useState(false);

  const availableCourts = courts.filter(c => c.status === 'Available' || c.id === game.courtId);
  const isCompleted = game.status === 'Completed' || game.status === 'Finished';
  const isInProgress = game.status === 'InProgress' || game.status === 'Playing';
  const hasBestOf = game.bestOf > 1;

  // Quick score adjustment
  const adjustScore = (team, delta) => {
    if (team === 1) {
      setUnit1Score(prev => Math.max(0, prev + delta));
    } else {
      setUnit2Score(prev => Math.max(0, prev + delta));
    }
  };

  const handleSaveScore = async (finish = false) => {
    if (!onSaveScore) return;
    setSubmitting(true);
    try {
      await onSaveScore(game.id, unit1Score, unit2Score, finish);
      onSuccess?.();
    } catch (err) {
      console.error('Error updating score:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignCourt = async () => {
    if (!onAssignCourt) return;
    try {
      await onAssignCourt(game.id, courtId ? parseInt(courtId) : null);
      onSuccess?.();
    } catch (err) {
      console.error('Error assigning court:', err);
    }
  };

  const handleStatusChange = async (status) => {
    if (!onStatusChange) return;
    try {
      await onStatusChange(game.id, status);
      onSuccess?.();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleStartGame = async () => {
    if (!onStatusChange) return;
    try {
      await onStatusChange(game.id, 'InProgress');
      onSuccess?.();
    } catch (err) {
      console.error('Error starting game:', err);
    }
  };

  // Render unit display based on member count
  const renderUnit = (unit, isWinner) => {
    if (!unit) return <div className="text-gray-400">TBD</div>;

    const members = unit.members || [];
    const isDoublesTeam = members.length === 2;

    return (
      <div className={`flex-1 p-3 rounded-lg ${isWinner ? 'bg-green-50 ring-2 ring-green-500' : ''}`}>
        {isDoublesTeam ? (
          // Doubles: Show two players stacked vertically
          <div className="space-y-2">
            {members.map((member, idx) => (
              <button
                key={member.userId || idx}
                onClick={() => onPlayerClick?.(member.userId)}
                className="flex items-center gap-2 w-full hover:bg-gray-50 rounded-lg p-1 transition-colors"
              >
                {member.profileImageUrl || member.avatarUrl ? (
                  <img
                    src={getSharedAssetUrl(member.profileImageUrl || member.avatarUrl)}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                )}
                <span className="text-sm font-medium text-gray-900 truncate">
                  {member.firstName || member.name?.split(' ')[0] || 'Player'}
                  {member.lastName ? ` ${member.lastName}` : ''}
                </span>
              </button>
            ))}
          </div>
        ) : (
          // Team or single player: Show team name + avatar row
          <div className="text-center">
            <div className="font-medium text-gray-900 mb-2">{unit.name || 'Team'}</div>
            {members.length > 0 && (
              <div className="flex justify-center -space-x-2">
                {members.slice(0, 6).map((member, idx) => (
                  <button
                    key={member.userId || idx}
                    onClick={() => onPlayerClick?.(member.userId)}
                    className="relative hover:z-10 transition-transform hover:scale-110"
                    title={`${member.firstName || ''} ${member.lastName || ''}`.trim() || member.name}
                  >
                    {member.profileImageUrl || member.avatarUrl ? (
                      <img
                        src={getSharedAssetUrl(member.profileImageUrl || member.avatarUrl)}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border-2 border-white"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center border-2 border-white">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                    )}
                  </button>
                ))}
                {members.length > 6 && (
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600 border-2 border-white">
                    +{members.length - 6}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {isWinner && (
          <div className="text-xs text-green-600 font-medium mt-2 text-center">WINNER</div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edit Game</h2>
            {game.courtLabel && (
              <span className="text-sm text-gray-500">{game.courtLabel}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[game.status] || 'bg-gray-100 text-gray-600'}`}>
              {game.status}
            </span>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Teams with winner highlight */}
        <div className="flex items-stretch justify-between mb-4 gap-4">
          {renderUnit(game.unit1, isCompleted && game.winnerUnitId === game.unit1?.id)}
          <div className="flex items-center px-2 text-gray-400 text-sm">vs</div>
          {renderUnit(game.unit2, isCompleted && game.winnerUnitId === game.unit2?.id)}
        </div>

        {/* Best-of series info */}
        {hasBestOf && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-center text-sm text-gray-600 mb-2">
              Best of {game.bestOf} • Game {game.currentGameNumber || game.gameNumber || 1}
            </div>
            <div className="flex justify-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{game.unit1Wins || 0}</div>
                <div className="text-xs text-gray-500">Games Won</div>
              </div>
              <div className="text-xl text-gray-300 self-center">-</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{game.unit2Wins || 0}</div>
                <div className="text-xs text-gray-500">Games Won</div>
              </div>
            </div>
            {/* Previous game scores */}
            {game.games?.length > 1 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500 mb-1">Previous Games:</div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {game.games.filter(g => g.status === 'Finished' || g.status === 'Completed').map(g => (
                    <span key={g.gameNumber || g.id} className="px-2 py-1 bg-white rounded text-xs">
                      G{g.gameNumber}: {g.unit1Score}-{g.unit2Score}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Score Input with +/- buttons */}
        <div className="mb-6">
          <div className="text-sm font-medium text-gray-700 mb-2 text-center">
            {hasBestOf ? `Game ${game.currentGameNumber || game.gameNumber || 1} Score` : 'Score'}
          </div>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => adjustScore(1, -1)}
                  disabled={readOnly || isCompleted || unit1Score === 0}
                  className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-xl font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={unit1Score}
                  onChange={(e) => setUnit1Score(parseInt(e.target.value) || 0)}
                  disabled={readOnly || isCompleted}
                  className="w-16 h-14 text-3xl font-bold text-center border border-gray-300 rounded-lg disabled:bg-gray-100"
                />
                <button
                  onClick={() => adjustScore(1, 1)}
                  disabled={readOnly || isCompleted}
                  className="w-10 h-10 rounded-lg bg-blue-100 hover:bg-blue-200 disabled:opacity-50 text-xl font-bold text-blue-700"
                >
                  +
                </button>
              </div>
            </div>
            <span className="text-2xl text-gray-400">-</span>
            <div className="text-center">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => adjustScore(2, -1)}
                  disabled={readOnly || isCompleted || unit2Score === 0}
                  className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-xl font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={unit2Score}
                  onChange={(e) => setUnit2Score(parseInt(e.target.value) || 0)}
                  disabled={readOnly || isCompleted}
                  className="w-16 h-14 text-3xl font-bold text-center border border-gray-300 rounded-lg disabled:bg-gray-100"
                />
                <button
                  onClick={() => adjustScore(2, 1)}
                  disabled={readOnly || isCompleted}
                  className="w-10 h-10 rounded-lg bg-blue-100 hover:bg-blue-200 disabled:opacity-50 text-xl font-bold text-blue-700"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Start Button */}
        {onStatusChange && !readOnly && !isInProgress && !isCompleted && game.courtId && (
          <div className="mb-6">
            <button
              onClick={handleStartGame}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-lg font-medium"
            >
              <Play className="w-5 h-5" />
              Start Game
            </button>
          </div>
        )}

        {/* Court Assignment */}
        {showCourtAssignment && courts.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Court</label>
            <div className="flex gap-2">
              <select
                value={courtId}
                onChange={(e) => setCourtId(e.target.value)}
                disabled={readOnly}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
              >
                <option value="">Unassigned</option>
                {availableCourts.map(c => (
                  <option key={c.id} value={c.id}>{c.label || c.courtLabel}</option>
                ))}
              </select>
              {!readOnly && courtId !== (game.courtId || '').toString() && (
                <button
                  onClick={handleAssignCourt}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Update
                </button>
              )}
            </div>
          </div>
        )}

        {/* Status */}
        {showStatusControl && onStatusChange && !readOnly && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <div className="flex flex-wrap gap-2">
              {['Pending', 'Queued', 'InProgress', 'Completed'].map(status => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${
                    game.status === status
                      ? STATUS_COLORS[status] + ' ring-2 ring-offset-1 ring-blue-500'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Close
          </button>
          {onSaveScore && !readOnly && !isCompleted && (
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveScore(false)}
                disabled={submitting}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => handleSaveScore(true)}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Finish Game
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
