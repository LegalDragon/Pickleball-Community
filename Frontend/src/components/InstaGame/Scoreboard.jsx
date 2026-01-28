import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Check, Minus, Plus, Trophy, Clock } from 'lucide-react'
import { getSharedAssetUrl } from '../../services/api'

/**
 * Scoreboard component for InstaGame
 */
export default function Scoreboard({
  instaGame,
  currentMatch,
  recentMatches,
  players,
  isOrganizer,
  onStartMatch,
  onUpdateScore,
  onCompleteMatch
}) {
  const { t } = useTranslation()
  const [scores, setScores] = useState({
    team1: currentMatch?.team1Score || 0,
    team2: currentMatch?.team2Score || 0
  })
  const [submitting, setSubmitting] = useState(false)

  const getPlayerName = (userId) => {
    const player = players.find(p => p.userId === userId)
    return player?.displayName || `Player ${userId}`
  }

  const getPlayerAvatar = (userId) => {
    const player = players.find(p => p.userId === userId)
    return player?.avatarUrl
  }

  const handleScoreChange = (team, delta) => {
    setScores(prev => ({
      ...prev,
      [team]: Math.max(0, prev[team] + delta)
    }))

    if (currentMatch && isOrganizer) {
      const newScores = {
        team1: team === 'team1' ? Math.max(0, scores.team1 + delta) : scores.team1,
        team2: team === 'team2' ? Math.max(0, scores.team2 + delta) : scores.team2
      }
      onUpdateScore(currentMatch.id, newScores.team1, newScores.team2)
    }
  }

  const handleStartMatch = async () => {
    if (!currentMatch) return
    try {
      setSubmitting(true)
      await onStartMatch(currentMatch.id)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCompleteMatch = async (winningTeam) => {
    if (!currentMatch) return
    try {
      setSubmitting(true)
      await onCompleteMatch(currentMatch.id, scores.team1, scores.team2, winningTeam)
      setScores({ team1: 0, team2: 0 })
    } finally {
      setSubmitting(false)
    }
  }

  // Update local scores when currentMatch changes
  if (currentMatch && (scores.team1 !== currentMatch.team1Score || scores.team2 !== currentMatch.team2Score)) {
    setScores({
      team1: currentMatch.team1Score,
      team2: currentMatch.team2Score
    })
  }

  return (
    <div className="space-y-6">
      {/* Current Match */}
      {currentMatch ? (
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="text-center mb-4">
            <span className="text-sm text-gray-400">
              {t('instaGame.match')} #{currentMatch.matchNumber}
            </span>
            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
              currentMatch.status === 'InProgress' ? 'bg-green-600' :
              currentMatch.status === 'Ready' ? 'bg-blue-600' :
              'bg-gray-600'
            }`}>
              {currentMatch.status}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            {/* Team 1 */}
            <div className="flex-1 text-center">
              <div className="space-y-2 mb-4">
                {currentMatch.team1.map((player) => (
                  <div key={player.userId} className="flex items-center justify-center gap-2">
                    {player.avatarUrl ? (
                      <img src={getSharedAssetUrl(player.avatarUrl)} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm">
                        {player.displayName?.[0] || '?'}
                      </div>
                    )}
                    <span className="text-sm truncate max-w-[100px]">{player.displayName}</span>
                  </div>
                ))}
              </div>

              {/* Score */}
              <div className="flex items-center justify-center gap-4">
                {isOrganizer && currentMatch.status === 'InProgress' && (
                  <button
                    onClick={() => handleScoreChange('team1', -1)}
                    className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"
                  >
                    <Minus size={20} />
                  </button>
                )}
                <span className="text-5xl font-bold tabular-nums">{scores.team1}</span>
                {isOrganizer && currentMatch.status === 'InProgress' && (
                  <button
                    onClick={() => handleScoreChange('team1', 1)}
                    className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"
                  >
                    <Plus size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* VS */}
            <div className="text-2xl font-bold text-gray-500">VS</div>

            {/* Team 2 */}
            <div className="flex-1 text-center">
              <div className="space-y-2 mb-4">
                {currentMatch.team2.map((player) => (
                  <div key={player.userId} className="flex items-center justify-center gap-2">
                    {player.avatarUrl ? (
                      <img src={getSharedAssetUrl(player.avatarUrl)} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-sm">
                        {player.displayName?.[0] || '?'}
                      </div>
                    )}
                    <span className="text-sm truncate max-w-[100px]">{player.displayName}</span>
                  </div>
                ))}
              </div>

              {/* Score */}
              <div className="flex items-center justify-center gap-4">
                {isOrganizer && currentMatch.status === 'InProgress' && (
                  <button
                    onClick={() => handleScoreChange('team2', -1)}
                    className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"
                  >
                    <Minus size={20} />
                  </button>
                )}
                <span className="text-5xl font-bold tabular-nums">{scores.team2}</span>
                {isOrganizer && currentMatch.status === 'InProgress' && (
                  <button
                    onClick={() => handleScoreChange('team2', 1)}
                    className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"
                  >
                    <Plus size={20} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          {isOrganizer && (
            <div className="mt-6 flex justify-center gap-3">
              {currentMatch.status === 'Ready' && (
                <button
                  onClick={handleStartMatch}
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Play size={20} />
                  {t('instaGame.startGame')}
                </button>
              )}
              {currentMatch.status === 'InProgress' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleCompleteMatch(1)}
                    disabled={submitting}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Trophy size={18} />
                    {t('instaGame.team1Wins')}
                  </button>
                  <button
                    onClick={() => handleCompleteMatch(2)}
                    disabled={submitting}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    <Trophy size={18} />
                    {t('instaGame.team2Wins')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <Clock size={48} className="mx-auto mb-4 text-gray-500" />
          <p className="text-gray-400">{t('instaGame.noCurrentMatch')}</p>
          {instaGame.status === 'Active' && isOrganizer && (
            <p className="text-sm text-gray-500 mt-2">{t('instaGame.useNextMatchButton')}</p>
          )}
        </div>
      )}

      {/* Recent Matches */}
      {recentMatches.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Trophy size={20} className="text-yellow-500" />
            {t('instaGame.recentMatches')}
          </h3>
          <div className="space-y-2">
            {recentMatches.map((match) => (
              <div
                key={match.id}
                className="bg-gray-800 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">#{match.matchNumber}</span>
                  <div className="flex items-center gap-1">
                    {match.team1.map((p, i) => (
                      <span key={p.userId} className={`text-sm ${match.winningTeam === 1 ? 'text-green-400 font-medium' : ''}`}>
                        {i > 0 && ' & '}{p.displayName}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-bold ${match.winningTeam === 1 ? 'text-green-400' : ''}`}>
                    {match.team1Score}
                  </span>
                  <span className="text-gray-500">-</span>
                  <span className={`font-bold ${match.winningTeam === 2 ? 'text-green-400' : ''}`}>
                    {match.team2Score}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {match.team2.map((p, i) => (
                    <span key={p.userId} className={`text-sm ${match.winningTeam === 2 ? 'text-green-400 font-medium' : ''}`}>
                      {i > 0 && ' & '}{p.displayName}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session Stats */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">{t('instaGame.sessionStats')}</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{instaGame.gamesPlayed}</div>
            <div className="text-xs text-gray-400">{t('instaGame.gamesPlayed')}</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{instaGame.playerCount}</div>
            <div className="text-xs text-gray-400">{t('instaGame.players')}</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {instaGame.schedulingMethod === 'Popcorn' ? '🍿' :
               instaGame.schedulingMethod === 'Gauntlet' ? '👑' : '✋'}
            </div>
            <div className="text-xs text-gray-400">{instaGame.schedulingMethod}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
