import { useTranslation } from 'react-i18next'
import { Clock, Users, ArrowRight } from 'lucide-react'

/**
 * QueueDisplay component for InstaGame
 */
export default function QueueDisplay({
  queue,
  players,
  isOrganizer,
  schedulingMethod
}) {
  const { t } = useTranslation()

  const getPlayerName = (userId) => {
    const player = players.find(p => p.userId === userId)
    return player?.displayName || `Player ${userId}`
  }

  const getSchedulingDescription = () => {
    switch (schedulingMethod) {
      case 'Popcorn':
        return t('instaGame.popcornQueueDesc')
      case 'Gauntlet':
        return t('instaGame.gauntletQueueDesc')
      default:
        return t('instaGame.manualQueueDesc')
    }
  }

  return (
    <div className="space-y-4">
      {/* Scheduling Info */}
      <div className="bg-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={20} className="text-blue-400" />
          <h3 className="font-medium">{t('instaGame.howItWorks')}</h3>
        </div>
        <p className="text-sm text-gray-400">{getSchedulingDescription()}</p>
      </div>

      {/* Queue */}
      {queue.length > 0 ? (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">
            {t('instaGame.upNext')} ({queue.length})
          </h3>
          <div className="space-y-3">
            {queue.map((item, index) => (
              <div
                key={item.id}
                className={`p-3 rounded-lg ${
                  index === 0 ? 'bg-blue-900/50 border border-blue-700' : 'bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${index === 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                    {index === 0 ? t('instaGame.nextUp') : `#${index + 1}`}
                  </span>
                  <span className="text-xs text-gray-500">{item.queueType}</span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Team 1 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.team1.map((player, i) => (
                        <span key={player.userId} className="flex items-center gap-1">
                          {player.avatarUrl ? (
                            <img src={player.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs">
                              {player.displayName?.[0] || '?'}
                            </div>
                          )}
                          <span className="text-sm">{player.displayName}</span>
                          {i < item.team1.length - 1 && <span className="text-gray-500">&</span>}
                        </span>
                      ))}
                    </div>
                  </div>

                  <ArrowRight size={16} className="text-gray-500" />

                  {/* Team 2 */}
                  <div className="flex-1">
                    {item.team2 ? (
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {item.team2.map((player, i) => (
                          <span key={player.userId} className="flex items-center gap-1">
                            {player.avatarUrl ? (
                              <img src={player.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-xs">
                                {player.displayName?.[0] || '?'}
                              </div>
                            )}
                            <span className="text-sm">{player.displayName}</span>
                            {i < item.team2.length - 1 && <span className="text-gray-500">&</span>}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500 text-right block">
                        {t('instaGame.challengerTBD')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <Users size={48} className="mx-auto mb-4 text-gray-500" />
          <p className="text-gray-400">{t('instaGame.emptyQueue')}</p>
          <p className="text-sm text-gray-500 mt-2">
            {schedulingMethod === 'Manual'
              ? t('instaGame.emptyQueueManual')
              : t('instaGame.emptyQueueAuto')}
          </p>
        </div>
      )}

      {/* Waiting Players */}
      {schedulingMethod !== 'Manual' && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">
            {t('instaGame.waitingPlayers')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {players
              .filter(p => p.status === 'Available')
              .sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999))
              .map((player, index) => (
                <div
                  key={player.id}
                  className="flex items-center gap-2 bg-gray-700 rounded-full px-3 py-1.5"
                >
                  {player.queuePosition && (
                    <span className="text-xs text-gray-400">#{player.queuePosition}</span>
                  )}
                  {player.avatarUrl ? (
                    <img src={player.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center text-xs">
                      {player.displayName?.[0]}
                    </div>
                  )}
                  <span className="text-sm">{player.displayName}</span>
                </div>
              ))}
            {players.filter(p => p.status === 'Available').length === 0 && (
              <p className="text-sm text-gray-500">{t('instaGame.noWaitingPlayers')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
