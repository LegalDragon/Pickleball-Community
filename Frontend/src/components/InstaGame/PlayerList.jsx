import { useTranslation } from 'react-i18next'
import { Crown, CheckCircle, Coffee, LogOut, Trophy } from 'lucide-react'

/**
 * PlayerList component for InstaGame
 */
export default function PlayerList({
  players,
  myPlayerInfo,
  isOrganizer,
  schedulingMethod,
  onToggleStatus,
  onLeave
}) {
  const { t } = useTranslation()

  const sortedPlayers = [...players].sort((a, b) => {
    // Organizers first, then by games won, then by name
    if (a.isOrganizer !== b.isOrganizer) return b.isOrganizer ? 1 : -1
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon
    return (a.displayName || '').localeCompare(b.displayName || '')
  })

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Available': return <CheckCircle size={16} className="text-green-500" />
      case 'Playing': return <Trophy size={16} className="text-yellow-500" />
      case 'Resting': return <Coffee size={16} className="text-orange-500" />
      default: return null
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'Available': return t('instaGame.available')
      case 'Playing': return t('instaGame.playing')
      case 'Resting': return t('instaGame.resting')
      default: return status
    }
  }

  return (
    <div className="space-y-4">
      {/* My Status */}
      {myPlayerInfo && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">{t('instaGame.yourStatus')}</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {myPlayerInfo.avatarUrl ? (
                <img src={myPlayerInfo.avatarUrl} alt="" className="w-12 h-12 rounded-full" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-lg font-bold">
                  {myPlayerInfo.displayName?.[0] || '?'}
                </div>
              )}
              <div>
                <div className="font-medium flex items-center gap-2">
                  {myPlayerInfo.displayName}
                  {myPlayerInfo.isOrganizer && (
                    <Crown size={14} className="text-yellow-500" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-sm">
                  {getStatusIcon(myPlayerInfo.status)}
                  <span className="text-gray-400">{getStatusLabel(myPlayerInfo.status)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {myPlayerInfo.status !== 'Playing' && (
                <button
                  onClick={onToggleStatus}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    myPlayerInfo.status === 'Available'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {myPlayerInfo.status === 'Available'
                    ? t('instaGame.takeBreak')
                    : t('instaGame.imReady')}
                </button>
              )}
              <button
                onClick={onLeave}
                className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition-colors"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

          {/* My Stats */}
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            <div className="bg-gray-700 rounded-lg p-2">
              <div className="text-lg font-bold">{myPlayerInfo.gamesPlayed}</div>
              <div className="text-xs text-gray-400">{t('instaGame.played')}</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-2">
              <div className="text-lg font-bold text-green-400">{myPlayerInfo.gamesWon}</div>
              <div className="text-xs text-gray-400">{t('instaGame.won')}</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-2">
              <div className="text-lg font-bold">{myPlayerInfo.winRate.toFixed(0)}%</div>
              <div className="text-xs text-gray-400">{t('instaGame.winRate')}</div>
            </div>
            {schedulingMethod === 'Gauntlet' && (
              <div className="bg-gray-700 rounded-lg p-2">
                <div className="text-lg font-bold text-yellow-400">{myPlayerInfo.currentWinStreak}</div>
                <div className="text-xs text-gray-400">{t('instaGame.streak')}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* All Players */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">
          {t('instaGame.allPlayers')} ({players.length})
        </h3>
        <div className="space-y-2">
          {sortedPlayers.map((player) => (
            <div
              key={player.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                player.userId === myPlayerInfo?.userId ? 'bg-blue-900/30' : 'bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                {player.avatarUrl ? (
                  <img src={player.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
                    {player.displayName?.[0] || '?'}
                  </div>
                )}
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {player.displayName}
                    {player.isOrganizer && (
                      <Crown size={14} className="text-yellow-500" title={t('instaGame.organizer')} />
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    {getStatusIcon(player.status)}
                    <span className="text-gray-400">{getStatusLabel(player.status)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="text-center">
                  <div className="font-bold">{player.gamesWon}/{player.gamesPlayed}</div>
                  <div className="text-xs text-gray-400">{t('instaGame.record')}</div>
                </div>
                {schedulingMethod === 'Gauntlet' && player.currentWinStreak > 0 && (
                  <div className="text-center">
                    <div className="font-bold text-yellow-400">🔥 {player.currentWinStreak}</div>
                    <div className="text-xs text-gray-400">{t('instaGame.streak')}</div>
                  </div>
                )}
                {player.pointsDifferential !== 0 && (
                  <div className={`text-center ${player.pointsDifferential > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    <div className="font-bold">
                      {player.pointsDifferential > 0 ? '+' : ''}{player.pointsDifferential}
                    </div>
                    <div className="text-xs text-gray-400">+/-</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
