import { useState, useEffect } from 'react'
import { CheckCircle, Bell, Calendar, MapPin, QrCode, Share2, X, Smartphone, AlertCircle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { usePushNotifications } from '../../hooks/usePushNotifications'

/**
 * Check-in confirmation modal shown after successful check-in
 * Includes badge info and push notification opt-in
 */
export default function CheckInConfirmation({
  isOpen,
  onClose,
  playerName,
  eventName,
  eventId,
  divisionName,
  teamName,
  venueName,
  eventDate,
  memberId,
  checkedInAt
}) {
  const [step, setStep] = useState('confirmed') // 'confirmed', 'push-prompt', 'push-requesting', 'push-success', 'push-denied', 'complete'
  const [copied, setCopied] = useState(false)

  const {
    isSupported,
    permission,
    isSubscribed,
    subscribe,
    loading
  } = usePushNotifications()

  // Reset step when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('confirmed')
    }
  }, [isOpen])

  const handleContinue = () => {
    // If push notifications available and not subscribed, show prompt
    if (isSupported && !isSubscribed && permission !== 'denied') {
      setStep('push-prompt')
    } else {
      setStep('complete')
      setTimeout(() => onClose?.(), 1500)
    }
  }

  const handleEnablePush = async () => {
    setStep('push-requesting')
    try {
      await subscribe()
      setStep('push-success')
      setTimeout(() => {
        setStep('complete')
        setTimeout(() => onClose?.(), 1500)
      }, 2000)
    } catch (err) {
      if (err.message?.includes('denied')) {
        setStep('push-denied')
      } else {
        setStep('complete')
        setTimeout(() => onClose?.(), 1500)
      }
    }
  }

  const handleSkipPush = () => {
    setStep('complete')
    setTimeout(() => onClose?.(), 1500)
  }

  const badgeUrl = memberId ? `https://pickleball.community/badge/${memberId}` : null
  const checkInUrl = eventId ? `https://pickleball.community/event/${eventId}/check-in` : null

  const handleShare = async () => {
    const url = badgeUrl || window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${playerName} - Tournament Badge`,
          text: `My badge for ${eventName}`,
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

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Confirmed Step */}
        {step === 'confirmed' && (
          <>
            {/* Success Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-6 text-white text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12" />
              </div>
              <h2 className="text-2xl font-bold">You're Checked In!</h2>
              <p className="text-white/80 mt-1">{formatTime(checkedInAt)}</p>
            </div>

            {/* Event Details */}
            <div className="p-6">
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h3 className="font-bold text-lg text-gray-900 mb-3">{eventName}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <span className="font-medium">Player:</span>
                    <span>{playerName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <span className="font-medium">Division:</span>
                    <span>{divisionName}</span>
                  </div>
                  {teamName && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="font-medium">Team:</span>
                      <span>{teamName}</span>
                    </div>
                  )}
                  {venueName && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>{venueName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Badge QR Code */}
              {badgeUrl && (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center mb-6">
                  <p className="text-sm text-gray-500 mb-3">Your Tournament Badge</p>
                  <QRCodeSVG
                    value={checkInUrl || badgeUrl}
                    size={140}
                    level="H"
                    includeMargin={true}
                  />
                  <button
                    onClick={handleShare}
                    className="mt-3 flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                  >
                    <Share2 className="w-4 h-4" />
                    {copied ? 'Link Copied!' : 'Share Badge'}
                  </button>
                </div>
              )}

              {/* What's Next */}
              <div className="bg-blue-50 rounded-xl p-4 mb-6">
                <h4 className="font-semibold text-blue-900 mb-2">📢 What's Next</h4>
                <p className="text-sm text-blue-700">
                  You'll receive notifications when your games are scheduled. 
                  Stay nearby and listen for announcements!
                </p>
              </div>

              <button
                onClick={handleContinue}
                className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium transition"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* Push Notification Prompt */}
        {step === 'push-prompt' && (
          <>
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Game Notifications</h2>
                    <p className="text-white/80 text-sm">Never miss your match</p>
                  </div>
                </div>
                <button
                  onClick={handleSkipPush}
                  className="p-2 hover:bg-white/20 rounded-full transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4 mb-6">
                <p className="text-gray-700">
                  Enable notifications to get alerts when:
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Game Ready</span>
                      <p className="text-sm text-gray-600">Your game is assigned to a court</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">On Deck</span>
                      <p className="text-sm text-gray-600">You're next up - get ready!</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Court Changes</span>
                      <p className="text-sm text-gray-600">Updates if your court assignment changes</p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleEnablePush}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <Bell className="w-5 h-5" />
                  Enable Notifications
                </button>
                <button
                  onClick={handleSkipPush}
                  className="w-full py-2 px-4 text-gray-500 hover:text-gray-700 text-sm"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </>
        )}

        {/* Requesting Permission */}
        {step === 'push-requesting' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Smartphone className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Allow Notifications
            </h3>
            <p className="text-gray-600">
              Please click "Allow" in the browser popup.
            </p>
          </div>
        )}

        {/* Push Success */}
        {step === 'push-success' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Notifications Enabled!
            </h3>
            <p className="text-gray-600">
              You'll receive alerts when your games are scheduled.
            </p>
          </div>
        )}

        {/* Push Denied */}
        {step === 'push-denied' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Notifications Blocked
            </h3>
            <p className="text-gray-600 mb-4">
              No worries! You can enable them later in Settings. 
              Listen for court announcements during the event.
            </p>
            <button
              onClick={() => {
                setStep('complete')
                setTimeout(() => onClose?.(), 1500)
              }}
              className="py-2 px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
            >
              Got it
            </button>
          </div>
        )}

        {/* Complete */}
        {step === 'complete' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              You're All Set!
            </h3>
            <p className="text-gray-600">
              Good luck in your games! 🏆
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
