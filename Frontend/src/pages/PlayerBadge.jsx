import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Calendar, MapPin, Users, CheckCircle, XCircle, Loader2, QrCode, Share2, ArrowLeft } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { checkInApi } from '../services/api'

const PlayerBadge = () => {
  const { memberId } = useParams()
  const [badge, setBadge] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadBadge()
  }, [memberId])

  const loadBadge = async () => {
    try {
      setLoading(true)
      const response = await checkInApi.getBadge(memberId)
      if (response.success) {
        setBadge(response.data)
      } else {
        setError(response.message || 'Badge not found')
      }
    } catch (err) {
      console.error('Failed to load badge:', err)
      setError('Failed to load badge')
    } finally {
      setLoading(false)
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${badge?.playerName} - Tournament Badge`,
          text: `My badge for ${badge?.eventName}`,
          url: url
        })
      } catch (err) {
        if (err.name !== 'AbortError') {
          copyToClipboard(url)
        }
      }
    } else {
      copyToClipboard(url)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary-500" />
      </div>
    )
  }

  if (error || !badge) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Badge Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'This badge link is invalid or has expired.'}</p>
          <Link
            to="/events"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Browse Events
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-4 md:p-8">
      <div className="max-w-md mx-auto">
        {/* Badge Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header with Event Poster or Gradient */}
          {badge.posterImageUrl ? (
            <div className="relative h-32">
              <img
                src={badge.posterImageUrl}
                alt={badge.eventName}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <h1 className="absolute bottom-4 left-4 right-4 text-white font-bold text-xl leading-tight">
                {badge.eventName}
              </h1>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-primary-500 to-orange-500 p-6">
              <h1 className="text-white font-bold text-xl">{badge.eventName}</h1>
            </div>
          )}

          {/* Player Info */}
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              {badge.profileImageUrl ? (
                <img
                  src={badge.profileImageUrl}
                  alt={badge.playerName}
                  className="w-20 h-20 rounded-full object-cover border-4 border-primary-100"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-orange-400 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">
                    {badge.playerName.charAt(0)}
                  </span>
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{badge.playerName}</h2>
                <p className="text-primary-600 font-semibold">{badge.divisionName}</p>
                {badge.unitName && badge.teamUnitName !== 'Singles' && (
                  <p className="text-gray-500 text-sm">{badge.unitName}</p>
                )}
              </div>
            </div>

            {/* Event Details */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-gray-600">
                <Calendar className="w-5 h-5 text-primary-500" />
                <span>{formatDate(badge.eventStartDate)}</span>
              </div>
              {badge.venueName && (
                <div className="flex items-center gap-3 text-gray-600">
                  <MapPin className="w-5 h-5 text-primary-500" />
                  <div>
                    <p>{badge.venueName}</p>
                    {badge.venueAddress && (
                      <p className="text-sm text-gray-400">{badge.venueAddress}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Status Indicators */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className={`p-3 rounded-lg ${badge.waiverSigned ? 'bg-green-50' : 'bg-amber-50'}`}>
                <div className="flex items-center gap-2">
                  {badge.waiverSigned ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-amber-500" />
                  )}
                  <span className={`text-sm font-medium ${badge.waiverSigned ? 'text-green-700' : 'text-amber-700'}`}>
                    Waiver
                  </span>
                </div>
              </div>
              <div className={`p-3 rounded-lg ${badge.paymentComplete ? 'bg-green-50' : 'bg-amber-50'}`}>
                <div className="flex items-center gap-2">
                  {badge.paymentComplete ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-amber-500" />
                  )}
                  <span className={`text-sm font-medium ${badge.paymentComplete ? 'text-green-700' : 'text-amber-700'}`}>
                    Payment
                  </span>
                </div>
              </div>
            </div>

            {/* Check-in Status */}
            {badge.isCheckedIn ? (
              <div className="bg-green-100 border border-green-200 rounded-xl p-4 text-center mb-6">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-green-700 font-semibold">Checked In</p>
                {badge.checkedInAt && (
                  <p className="text-green-600 text-sm">
                    {new Date(badge.checkedInAt).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 text-center mb-6">
                <QrCode className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 font-medium">Show this badge at check-in</p>
              </div>
            )}

            {/* QR Code */}
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center">
              <QRCodeSVG
                value={badge.checkInUrl || window.location.href}
                size={180}
                level="H"
                includeMargin={true}
              />
              <p className="text-xs text-gray-400 mt-3">Scan for check-in</p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-gray-100 p-4 flex gap-3">
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-medium transition-colors"
            >
              <Share2 className="w-5 h-5" />
              {copied ? 'Link Copied!' : 'Share Badge'}
            </button>
            <Link
              to={`/event/${badge.eventId}/check-in`}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-500 hover:bg-primary-600 rounded-xl text-white font-medium transition-colors"
            >
              Check In
            </Link>
          </div>
        </div>

        {/* Reference ID */}
        {badge.referenceId && (
          <p className="text-center text-gray-400 text-xs mt-4">
            Ref: {badge.referenceId}
          </p>
        )}
      </div>
    </div>
  )
}

export default PlayerBadge
