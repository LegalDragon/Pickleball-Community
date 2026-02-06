import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2, Bell, Home } from 'lucide-react'
import api from '../services/api'

/**
 * Notification Acknowledgment Page
 * Users land here when clicking push notifications that require acknowledgment
 */
export default function NotificationAck() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading, success, already, error
  const [notification, setNotification] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    acknowledgeNotification()
  }, [token])

  const acknowledgeNotification = async () => {
    try {
      setStatus('loading')
      const response = await api.post(`/notifications/ack/${token}`)

      if (response.success) {
        setNotification(response.notification)
        if (response.message === 'Already acknowledged') {
          setStatus('already')
        } else {
          setStatus('success')
        }
      } else {
        setError(response.message || 'Failed to acknowledge')
        setStatus('error')
      }
    } catch (err) {
      console.error('Error acknowledging notification:', err)
      setError(err?.response?.data?.message || 'Failed to acknowledge notification')
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className={`p-6 text-white text-center ${
          status === 'error' ? 'bg-red-500' :
          status === 'already' ? 'bg-blue-500' :
          'bg-green-500'
        }`}>
          {status === 'loading' && (
            <Loader2 className="w-16 h-16 mx-auto animate-spin" />
          )}
          {status === 'success' && (
            <CheckCircle className="w-16 h-16 mx-auto" />
          )}
          {status === 'already' && (
            <Bell className="w-16 h-16 mx-auto" />
          )}
          {status === 'error' && (
            <XCircle className="w-16 h-16 mx-auto" />
          )}
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          {status === 'loading' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Confirming...
              </h2>
              <p className="text-gray-600">
                Please wait while we record your acknowledgment.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Got It! ✓
              </h2>
              {notification && (
                <div className="bg-gray-50 rounded-xl p-4 mb-4 text-left">
                  <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                  {notification.message && (
                    <p className="text-gray-600 text-sm mt-1">{notification.message}</p>
                  )}
                </div>
              )}
              <p className="text-gray-600 mb-6">
                Your acknowledgment has been recorded. Thank you!
              </p>
            </>
          )}

          {status === 'already' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Already Acknowledged
              </h2>
              {notification && (
                <div className="bg-gray-50 rounded-xl p-4 mb-4 text-left">
                  <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                  {notification.message && (
                    <p className="text-gray-600 text-sm mt-1">{notification.message}</p>
                  )}
                </div>
              )}
              <p className="text-gray-600 mb-6">
                You've already confirmed receipt of this notification.
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Something Went Wrong
              </h2>
              <p className="text-gray-600 mb-6">
                {error || 'Unable to acknowledge this notification. It may have expired or been removed.'}
              </p>
            </>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Link
              to="/events"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium transition"
            >
              <Home className="w-5 h-5" />
              Go to Events
            </Link>
            <Link
              to="/notifications"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
            >
              View All Notifications
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
