import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Copy, Check, Share2, QrCode } from 'lucide-react'

/**
 * JoinCodeDisplay component for showing join code and sharing options
 */
export default function JoinCodeDisplay({
  joinCode,
  gameName,
  onClose
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const joinUrl = `${window.location.origin}/instagame/join/${joinCode}`

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(joinCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: gameName || t('instaGame.joinGame'),
          text: t('instaGame.shareMessage', { code: joinCode }),
          url: joinUrl
        })
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err)
        }
      }
    } else {
      handleCopyLink()
    }
  }

  // Generate QR code URL using a free QR code API
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}`

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold">{t('instaGame.joinCode')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Join Code Display */}
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-2">
              {t('instaGame.shareCodeInstruction')}
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl font-mono font-bold tracking-wider text-blue-400">
                {joinCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                title={t('common.copy')}
              >
                {copied ? <Check size={20} className="text-green-400" /> : <Copy size={20} />}
              </button>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center">
            <div className="bg-white p-3 rounded-lg">
              <img
                src={qrCodeUrl}
                alt="QR Code"
                className="w-48 h-48"
              />
            </div>
            <p className="text-sm text-gray-400 mt-2 flex items-center gap-1">
              <QrCode size={14} />
              {t('instaGame.scanToJoin')}
            </p>
          </div>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Share2 size={20} />
            {navigator.share ? t('instaGame.shareInvite') : t('instaGame.copyLink')}
          </button>
        </div>
      </div>
    </div>
  )
}
