import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import SharedLogin from './SharedLogin'
import SharedRegister from './SharedRegister'
import SharedForgotPassword from './SharedForgotPassword'

/**
 * Shared Auth Modal Component for Funtime Auth
 * Complete authentication modal with Login, Register, and Forgot Password flows
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback to close the modal
 * @param {string} props.authApiUrl - Base URL for auth API (e.g., https://auth.funtime.com)
 * @param {Function} props.onAuthSuccess - Callback with { token, user } on successful auth
 * @param {Function} props.onSyncUser - Callback to sync user to local database (optional)
 * @param {string} props.initialView - Initial view: 'login', 'register', or 'forgot-password'
 * @param {string} props.siteName - Name of the site (e.g., "Pickleball College")
 * @param {string} props.primaryColor - Primary brand color (default: blue)
 * @param {boolean} props.showRoleSelection - Whether to show role selection in register
 * @param {Array} props.roles - Available roles for registration
 */
const SharedAuthModal = ({
  isOpen,
  onClose,
  authApiUrl,
  onAuthSuccess,
  onSyncUser,
  initialView = 'login',
  siteName = 'Funtime',
  primaryColor = 'blue',
  showRoleSelection = false,
  roles = []
}) => {
  const [currentView, setCurrentView] = useState(initialView)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setCurrentView(initialView)
  }, [initialView])

  useEffect(() => {
    // Prevent body scroll when modal is open
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleAuthSuccess = async ({ token, user }) => {
    setLoading(true)
    try {
      // If onSyncUser is provided, sync to local database
      if (onSyncUser) {
        const syncedUser = await onSyncUser(token)
        onAuthSuccess?.({ token, user: syncedUser || user })
      } else {
        onAuthSuccess?.({ token, user })
      }
      onClose()
    } catch (error) {
      console.error('Auth success handling error:', error)
      // Still close and report success with original user
      onAuthSuccess?.({ token, user })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleError = (message) => {
    console.error('Auth error:', message)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md transform rounded-2xl bg-white p-6 shadow-2xl transition-all">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-2xl z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {/* Content */}
          <div className="mt-4">
            {currentView === 'login' && (
              <SharedLogin
                authApiUrl={authApiUrl}
                onSuccess={handleAuthSuccess}
                onError={handleError}
                onSwitchToRegister={() => setCurrentView('register')}
                onForgotPassword={() => setCurrentView('forgot-password')}
                siteName={siteName}
                primaryColor={primaryColor}
              />
            )}

            {currentView === 'register' && (
              <SharedRegister
                authApiUrl={authApiUrl}
                onSuccess={handleAuthSuccess}
                onError={handleError}
                onSwitchToLogin={() => setCurrentView('login')}
                siteName={siteName}
                primaryColor={primaryColor}
                showRoleSelection={showRoleSelection}
                roles={roles}
              />
            )}

            {currentView === 'forgot-password' && (
              <SharedForgotPassword
                authApiUrl={authApiUrl}
                onSuccess={() => setCurrentView('login')}
                onError={handleError}
                onBackToLogin={() => setCurrentView('login')}
                siteName={siteName}
                primaryColor={primaryColor}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SharedAuthModal
