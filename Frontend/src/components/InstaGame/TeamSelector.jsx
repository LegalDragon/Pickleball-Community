import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Check, Users, ArrowRight, Shuffle } from 'lucide-react'
import { getSharedAssetUrl } from '../../services/api'

/**
 * TeamSelector component for manually creating matches
 */
export default function TeamSelector({
  players,
  teamSize,
  onSubmit,
  onClose
}) {
  const { t } = useTranslation()
  const [team1, setTeam1] = useState([])
  const [team2, setTeam2] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const isPlayerSelected = (userId) => {
    return team1.includes(userId) || team2.includes(userId)
  }

  const handlePlayerClick = (userId) => {
    if (team1.includes(userId)) {
      setTeam1(team1.filter(id => id !== userId))
    } else if (team2.includes(userId)) {
      setTeam2(team2.filter(id => id !== userId))
    } else if (team1.length < teamSize) {
      setTeam1([...team1, userId])
    } else if (team2.length < teamSize) {
      setTeam2([...team2, userId])
    }
  }

  const handleMoveToTeam = (userId, targetTeam) => {
    // Remove from current team
    setTeam1(team1.filter(id => id !== userId))
    setTeam2(team2.filter(id => id !== userId))

    // Add to target team
    if (targetTeam === 1 && team1.length < teamSize) {
      setTeam1([...team1.filter(id => id !== userId), userId])
    } else if (targetTeam === 2 && team2.length < teamSize) {
      setTeam2([...team2.filter(id => id !== userId), userId])
    }
  }

  const handleRandomize = () => {
    const shuffled = [...players].sort(() => Math.random() - 0.5)
    setTeam1(shuffled.slice(0, teamSize).map(p => p.userId))
    setTeam2(shuffled.slice(teamSize, teamSize * 2).map(p => p.userId))
  }

  const handleSubmit = async () => {
    if (team1.length !== teamSize || team2.length !== teamSize) return

    try {
      setSubmitting(true)
      await onSubmit(team1, team2)
    } finally {
      setSubmitting(false)
    }
  }

  const getPlayer = (userId) => players.find(p => p.userId === userId)

  const isValid = team1.length === teamSize && team2.length === teamSize

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold">{t('instaGame.selectTeams')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Teams Display */}
          <div className="grid grid-cols-2 gap-4">
            {/* Team 1 */}
            <div className="bg-blue-900/30 rounded-lg p-3">
              <h3 className="text-sm font-medium text-blue-400 mb-2">
                {t('instaGame.team1')} ({team1.length}/{teamSize})
              </h3>
              <div className="space-y-2 min-h-[80px]">
                {team1.map(userId => {
                  const player = getPlayer(userId)
                  return (
                    <div
                      key={userId}
                      className="flex items-center justify-between bg-blue-900/50 rounded-lg p-2"
                    >
                      <div className="flex items-center gap-2">
                        {player?.avatarUrl ? (
                          <img src={getSharedAssetUrl(player.avatarUrl)} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm">
                            {player?.displayName?.[0] || '?'}
                          </div>
                        )}
                        <span className="text-sm">{player?.displayName}</span>
                      </div>
                      <button
                        onClick={() => handleMoveToTeam(userId, 2)}
                        className="p-1 hover:bg-blue-800 rounded"
                      >
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  )
                })}
                {team1.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    {t('instaGame.tapToAdd')}
                  </p>
                )}
              </div>
            </div>

            {/* Team 2 */}
            <div className="bg-red-900/30 rounded-lg p-3">
              <h3 className="text-sm font-medium text-red-400 mb-2">
                {t('instaGame.team2')} ({team2.length}/{teamSize})
              </h3>
              <div className="space-y-2 min-h-[80px]">
                {team2.map(userId => {
                  const player = getPlayer(userId)
                  return (
                    <div
                      key={userId}
                      className="flex items-center justify-between bg-red-900/50 rounded-lg p-2"
                    >
                      <button
                        onClick={() => handleMoveToTeam(userId, 1)}
                        className="p-1 hover:bg-red-800 rounded rotate-180"
                      >
                        <ArrowRight size={16} />
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{player?.displayName}</span>
                        {player?.avatarUrl ? (
                          <img src={getSharedAssetUrl(player.avatarUrl)} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-sm">
                            {player?.displayName?.[0] || '?'}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                {team2.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    {t('instaGame.tapToAdd')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Available Players */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">
                {t('instaGame.availablePlayers')}
              </h3>
              {players.length >= teamSize * 2 && (
                <button
                  onClick={handleRandomize}
                  className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                >
                  <Shuffle size={14} />
                  {t('instaGame.randomize')}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {players.map(player => {
                const inTeam1 = team1.includes(player.userId)
                const inTeam2 = team2.includes(player.userId)
                const selected = inTeam1 || inTeam2

                return (
                  <button
                    key={player.userId}
                    onClick={() => handlePlayerClick(player.userId)}
                    disabled={!selected && team1.length >= teamSize && team2.length >= teamSize}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      inTeam1 ? 'bg-blue-600' :
                      inTeam2 ? 'bg-red-600' :
                      'bg-gray-700 hover:bg-gray-600'
                    } ${
                      !selected && team1.length >= teamSize && team2.length >= teamSize
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                  >
                    {player.avatarUrl ? (
                      <img src={getSharedAssetUrl(player.avatarUrl)} alt="" className="w-6 h-6 rounded-full" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs">
                        {player.displayName?.[0]}
                      </div>
                    )}
                    <span className="text-sm">{player.displayName}</span>
                    {selected && <Check size={14} />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <Users size={20} />
            {submitting ? t('common.loading') : t('instaGame.createMatch')}
          </button>
        </div>
      </div>
    </div>
  )
}
