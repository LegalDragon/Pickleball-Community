import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authApi } from '../services/api'
import axios from 'axios'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

/**
 * AuthCallback - Handles the redirect from shared auth UI
 *
 * Expected URL parameters:
 * - token: JWT token from shared auth
 * - returnTo: (optional) path to redirect after auth (default: based on role)
 * - error: (optional) error message if auth failed
 * - siteRole: (optional) user's role for this site from shared auth
 * - isSiteAdmin: (optional) whether user is admin for this site
 */
const AuthCallback = () => {
  const [status, setStatus] = useState('processing') // 'processing', 'success', 'error'
  const [message, setMessage] = useState('Processing authentication...')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { updateUser } = useAuth()

  useEffect(() => {
    handleCallback()
  }, [])

  const handleCallback = async () => {
    try {
      // Log all URL parameters from shared auth
      console.log('AuthCallback URL params:', Object.fromEntries(searchParams.entries()))

      // Check for error from shared auth
      const error = searchParams.get('error')
      if (error) {
        setStatus('error')
        setMessage(decodeURIComponent(error))
        return
      }

      // Get token and site-specific role info from URL
      const token = searchParams.get('token')
      const siteRole = searchParams.get('siteRole')
      const isSiteAdmin = searchParams.get('isSiteAdmin') === 'true'
      console.log('Site role from shared auth:', siteRole, 'isSiteAdmin:', isSiteAdmin)

      if (!token) {
        setStatus('error')
        setMessage('No authentication token received')
        return
      }

      setMessage('Storing credentials...')

      // Store the token
      localStorage.setItem('jwtToken', token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      setMessage('Syncing user data...')

      // Determine role: isSiteAdmin takes precedence, then siteRole, then default
      const effectiveRole = isSiteAdmin ? 'Admin' : (siteRole || 'Student')
      console.log('Effective role for sync:', effectiveRole)

      // Sync user to local database - this returns a NEW local JWT with site-specific role
      let userData = null
      let localToken = token // fallback to shared auth token
      try {
        const syncResponse = await authApi.syncFromSharedAuth(token, effectiveRole)
        userData = syncResponse.User || syncResponse.user

        // Use the new local token if provided (contains site-specific role)
        if (syncResponse.Token || syncResponse.token) {
          localToken = syncResponse.Token || syncResponse.token
          console.log('Using local token with site-specific role')

          // Update stored token with the new local token
          localStorage.setItem('jwtToken', localToken)
          axios.defaults.headers.common['Authorization'] = `Bearer ${localToken}`
        }

        console.log('User synced successfully:', userData)
      } catch (syncError) {
        console.warn('User sync failed, decoding token locally:', syncError.message)

        // Try to decode token locally to get basic user info
        try {
          const payload = JSON.parse(atob(token.split('.')[1]))
          userData = {
            id: payload.sub || payload.nameid || payload.userId,
            email: payload.email,
            firstName: payload.firstName || payload.given_name,
            lastName: payload.lastName || payload.family_name,
            role: effectiveRole  // Use role from shared auth params
          }
        } catch (decodeError) {
          console.error('Failed to decode token:', decodeError)
        }
      }

      if (!userData) {
        setStatus('error')
        setMessage('Failed to retrieve user information')
        return
      }

      // Normalize user data to lowercase property names (backend uses PascalCase)
      const userWithDefaults = {
        id: userData.id || userData.Id,
        email: userData.email || userData.Email,
        firstName: userData.firstName || userData.FirstName,
        lastName: userData.lastName || userData.LastName,
        role: userData.role || userData.Role || effectiveRole,
        profileImageUrl: userData.profileImageUrl || userData.ProfileImageUrl || null
      }
      localStorage.setItem('pickleball_user', JSON.stringify(userWithDefaults))

      // Update auth context
      if (updateUser) {
        updateUser(userWithDefaults)
      }

      setStatus('success')
      setMessage('Authentication successful!')

      // Determine redirect path - all users go to member dashboard
      const returnTo = searchParams.get('returnTo')
      let redirectPath = (!returnTo || returnTo === '/')
        ? '/member/dashboard'
        : decodeURIComponent(returnTo)

      // Redirect after short delay to show success message
      setTimeout(() => {
        navigate(redirectPath, { replace: true })
      }, 1000)

    } catch (error) {
      console.error('Auth callback error:', error)
      setStatus('error')
      setMessage(error.message || 'Authentication failed')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col items-center justify-center">
      <div className="text-center bg-white p-8 rounded-2xl shadow-xl max-w-md">
        {status === 'processing' && (
          <>
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Authenticating</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Success!</h2>
            <p className="text-gray-600">{message}</p>
            <p className="text-sm text-gray-500 mt-2">Redirecting...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Failed</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/login')}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full py-2 px-4 text-gray-600 hover:text-gray-800 font-medium"
              >
                Go to Home
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default AuthCallback
