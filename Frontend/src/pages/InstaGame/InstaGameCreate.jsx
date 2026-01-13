import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, MapPin, Users, Shuffle, Crown, Settings } from 'lucide-react'
import instaGameService from '../../services/instaGameService'
import api from '../../services/api'

/**
 * InstaGame Create - Create a new pickup game session
 */
export default function InstaGameCreate() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    name: '',
    schedulingMethod: 'Manual',
    teamSize: 2,
    maxPlayers: null,
    scoreFormatId: null,
    venueId: null,
    customLocationName: '',
    latitude: null,
    longitude: null
  })

  const [venues, setVenues] = useState([])
  const [scoreFormats, setScoreFormats] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [useCustomLocation, setUseCustomLocation] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)

  useEffect(() => {
    loadVenues()
    loadScoreFormats()
  }, [])

  const loadVenues = async () => {
    try {
      const response = await api.get('/venues?limit=100')
      setVenues(response || [])
    } catch (err) {
      console.error('Error loading venues:', err)
    }
  }

  const loadScoreFormats = async () => {
    try {
      const response = await api.get('/scoreformats')
      setScoreFormats(response || [])
    } catch (err) {
      console.error('Error loading score formats:', err)
    }
  }

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError(t('instaGame.locationNotSupported'))
      return
    }

    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }))
        setGettingLocation(false)
      },
      (err) => {
        console.error('Error getting location:', err)
        setError(t('instaGame.locationError'))
        setGettingLocation(false)
      }
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError(t('instaGame.nameRequired'))
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await instaGameService.create({
        ...formData,
        venueId: useCustomLocation ? null : formData.venueId,
        customLocationName: useCustomLocation ? formData.customLocationName : null,
        latitude: useCustomLocation ? formData.latitude : null,
        longitude: useCustomLocation ? formData.longitude : null,
        maxPlayers: formData.maxPlayers || null
      })

      if (response.success && response.instaGame) {
        navigate(`/instagame/${response.instaGame.id}`)
      } else {
        setError(response.message || t('instaGame.createError'))
      }
    } catch (err) {
      console.error('Error creating InstaGame:', err)
      setError(t('instaGame.createError'))
    } finally {
      setLoading(false)
    }
  }

  const schedulingMethods = [
    {
      id: 'Manual',
      icon: Settings,
      title: t('instaGame.manual'),
      description: t('instaGame.manualDesc')
    },
    {
      id: 'Popcorn',
      icon: Shuffle,
      title: t('instaGame.popcorn'),
      description: t('instaGame.popcornDesc')
    },
    {
      id: 'Gauntlet',
      icon: Crown,
      title: t('instaGame.gauntlet'),
      description: t('instaGame.gauntletDesc')
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/instagame')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-gray-900">
              {t('instaGame.createTitle')}
            </h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Game Name */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('instaGame.gameName')} *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder={t('instaGame.gameNamePlaceholder')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={100}
            required
          />
        </div>

        {/* Team Size */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            {t('instaGame.teamSize')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, teamSize: 1 }))}
              className={`p-4 rounded-lg border-2 transition-colors ${
                formData.teamSize === 1
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Users size={24} className="mx-auto mb-2 text-gray-600" />
              <div className="text-sm font-medium">{t('instaGame.singles')}</div>
              <div className="text-xs text-gray-500">1v1</div>
            </button>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, teamSize: 2 }))}
              className={`p-4 rounded-lg border-2 transition-colors ${
                formData.teamSize === 2
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Users size={24} className="mx-auto mb-2 text-gray-600" />
              <div className="text-sm font-medium">{t('instaGame.doubles')}</div>
              <div className="text-xs text-gray-500">2v2</div>
            </button>
          </div>
        </div>

        {/* Scheduling Method */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            {t('instaGame.schedulingMethod')}
          </label>
          <div className="space-y-3">
            {schedulingMethods.map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, schedulingMethod: method.id }))}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  formData.schedulingMethod === method.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <method.icon size={24} className={`mt-0.5 ${
                    formData.schedulingMethod === method.id ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <div>
                    <div className="font-medium">{method.title}</div>
                    <div className="text-sm text-gray-500">{method.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            {t('instaGame.location')}
          </label>

          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setUseCustomLocation(false)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                !useCustomLocation
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t('instaGame.selectVenue')}
            </button>
            <button
              type="button"
              onClick={() => setUseCustomLocation(true)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                useCustomLocation
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t('instaGame.customLocation')}
            </button>
          </div>

          {!useCustomLocation ? (
            <select
              value={formData.venueId || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, venueId: e.target.value ? parseInt(e.target.value) : null }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">{t('instaGame.selectVenuePlaceholder')}</option>
              {venues.map((venue) => (
                <option key={venue.venueId} value={venue.venueId}>
                  {venue.name} - {venue.city}, {venue.state}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                value={formData.customLocationName}
                onChange={(e) => setFormData(prev => ({ ...prev, customLocationName: e.target.value }))}
                placeholder={t('instaGame.locationNamePlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={gettingLocation}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                <MapPin size={16} />
                {gettingLocation ? t('instaGame.gettingLocation') : t('instaGame.useCurrentLocation')}
              </button>
              {formData.latitude && formData.longitude && (
                <p className="text-xs text-gray-500">
                  {t('instaGame.locationSet')}: {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Optional Settings */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            {t('instaGame.optionalSettings')}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                {t('instaGame.maxPlayers')}
              </label>
              <input
                type="number"
                value={formData.maxPlayers || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, maxPlayers: e.target.value ? parseInt(e.target.value) : null }))}
                placeholder={t('instaGame.unlimited')}
                min={4}
                max={100}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                {t('instaGame.scoreFormat')}
              </label>
              <select
                value={formData.scoreFormatId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, scoreFormatId: e.target.value ? parseInt(e.target.value) : null }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">{t('instaGame.defaultScoreFormat')}</option>
                {scoreFormats.map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !formData.name.trim()}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? t('common.loading') : t('instaGame.createGame')}
        </button>
      </form>
    </div>
  )
}
