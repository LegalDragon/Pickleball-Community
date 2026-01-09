import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

// Shared Auth UI URL from environment
const SHARED_AUTH_UI_URL = import.meta.env.VITE_SHARED_AUTH_UI_URL || 'https://shared.funtimepb.com'

// Global site key for cross-site auth
const SITE_KEY = 'community'

/**
 * Register page - redirects to shared auth UI
 * After registration, user is redirected back to /auth/callback with token
 */
const Register = () => {
  useEffect(() => {
    // Build the return URL for after registration
    const callbackUrl = `${window.location.origin}/auth/callback`

    // Redirect to shared auth UI register page
    const authUrl = `${SHARED_AUTH_UI_URL}/register?site=${SITE_KEY}&returnUrl=${encodeURIComponent(callbackUrl)}`
    window.location.href = authUrl
  }, [])

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
