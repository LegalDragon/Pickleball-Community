import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, MapPin, Users, Gamepad2, Search, QrCode } from 'lucide-react'
import instaGameService from '../../services/instaGameService'

/**
 * InstaGame List - Browse and discover active pickup games
 */
export default function InstaGameList() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [joinCode, setJoinCode] = useState('')
  const [joiningByCode, setJoiningByCode] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadGames()
  }, [])

  const loadGames = async () => {
    try {
      setLoading(true)
      const data = await instaGameService.getActive(50)
      setGames(data)
    } catch (err) {
      console.error('Error loading games:', err)
      setError(t('instaGame.errorLoadingGames'))
    } finally {
      setLoading(false)
    }
  }

  const handleJoinByCode = async (e) => {
    e.preventDefault()
    if (!joinCode.trim()) return

    try {
      setJoiningByCode(true)
      setError(null)
      const response = await instaGameService.join(joinCode.trim())
      if (response.success && response.instaGame) {
        navigate(`/instagame/${response.instaGame.id}`)
      } else {
        setError(response.message || t('instaGame.invalidCode'))
      }
    } catch (err) {
      console.error('Error joining by code:', err)
      setError(t('instaGame.invalidCode'))
    } finally {
      setJoiningByCode(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800'
      case 'Lobby': return 'bg-blue-100 text-blue-800'
      case 'Paused': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSchedulingMethodLabel = (method) => {
    switch (method) {
      case 'Popcorn': return t('instaGame.popcorn')
      case 'Gauntlet': return t('instaGame.gauntlet')
      default: return t('instaGame.manual')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">
              {t('instaGame.title')}
            </h1>
            <button
              onClick={() => navigate('/instagame/create')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">{t('instaGame.create')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Join by Code */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <QrCode size={20} className="text-blue-600" />
            {t('instaGame.joinByCode')}
          </h2>
          <form onSubmit={handleJoinByCode} className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder={t('instaGame.enterCode')}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase tracking-wider"
              maxLength={10}
            />
            <button
              type="submit"
              disabled={joiningByCode || !joinCode.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {joiningByCode ? '...' : t('instaGame.join')}
            </button>
          </form>
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* Active Games */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Gamepad2 size={20} className="text-green-600" />
            {t('instaGame.activeGames')}
          </h2>

          {loading ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">{t('common.loading')}</p>
            </div>
          ) : games.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <Gamepad2 size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-4">{t('instaGame.noActiveGames')}</p>
              <button
                onClick={() => navigate('/instagame/create')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={20} />
                {t('instaGame.startFirst')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {games.map((game) => (
                <div
                  key={game.id}
                  onClick={() => navigate(`/instagame/${game.id}`)}
                  className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md cursor-pointer transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{game.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <MapPin size={14} />
                        <span>{game.venueName || game.customLocationName || t('instaGame.unknownLocation')}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(game.status)}`}>
                      {game.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Users size={14} />
                      <span>{game.playerCount} {t('instaGame.players')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Gamepad2 size={14} />
                      <span>{game.gamesPlayed} {t('instaGame.gamesPlayed')}</span>
                    </div>
                    <span className="text-gray-400">|</span>
                    <span>{getSchedulingMethodLabel(game.schedulingMethod)}</span>
                    <span className="text-gray-400">|</span>
                    <span>{game.teamSize === 1 ? t('instaGame.singles') : t('instaGame.doubles')}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {t('instaGame.hostedBy')} {game.creatorName}
                    </span>
                    <span className="text-sm font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {game.joinCode}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
