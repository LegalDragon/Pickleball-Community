import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import i18n from '../i18n'

// Shared Auth UI URL from environment
const SHARED_AUTH_UI_URL = import.meta.env.VITE_SHARED_AUTH_UI_URL || 'https://shared.funtimepb.com'

// Global site key for cross-site auth
const SITE_KEY = 'community'

// Get current language code for shared auth
const getCurrentLang = () => i18n.language?.split('-')[0] || 'en'

/**
 * Register page - redirects to shared auth UI
 * After registration, user is redirected back to /auth/callback with token
 */
const Register = () => {
  const location = useLocation()

  useEffect(() => {
    // Get the return path from navigation state (if any)
    const returnTo = location.state?.from?.pathname || '/'
    const callbackUrl = `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`

    // Redirect to shared auth UI register page with language preference
    const authUrl = `${SHARED_AUTH_UI_URL}/register?site=${SITE_KEY}&returnUrl=${encodeURIComponent(callbackUrl)}&Langcode=${getCurrentLang()}`
    window.location.href = authUrl
  }, [location.state])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col items-center justify-center">
      <div className="text-center bg-white p-8 rounded-2xl shadow-xl max-w-md">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Redirecting to Register</h2>
        <p className="text-gray-600">Taking you to the registration page...</p>
      </div>
    </div>
  )
}

export default Register
