import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

// Shared Auth UI URL from environment
const SHARED_AUTH_UI_URL = import.meta.env.VITE_SHARED_AUTH_UI_URL || 'https://shared.funtimepb.com'

// Global site key for cross-site auth
const SITE_KEY = 'community'

/**
 * ResetPassword page - redirects to shared auth UI
 * Password reset is handled by the shared auth service
 */
const ResetPassword = () => {
  const [searchParams] = useSearchParams()

  useEffect(() => {
    // Forward any token to shared auth UI
    const token = searchParams.get('token')
    const callbackUrl = `${window.location.origin}/auth/callback`

    // Build redirect URL with token if present
    let authUrl = `${SHARED_AUTH_UI_URL}/reset-password?site=${SITE_KEY}&returnUrl=${encodeURIComponent(callbackUrl)}`
    if (token) {
      authUrl += `&token=${encodeURIComponent(token)}`
    }

    window.location.href = authUrl
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col items-center justify-center">
      <div className="text-center bg-white p-8 rounded-2xl shadow-xl max-w-md">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Redirecting</h2>
        <p className="text-gray-600">Taking you to password reset...</p>
      </div>
    </div>
  )
}

export default ResetPassword
