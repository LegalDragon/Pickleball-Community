import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authApi } from '../services/api'
import { SharedRegister, SiteLogoOverlay } from '../components/shared-auth'
import { GraduationCap, Users } from 'lucide-react'

// Shared Auth API URL from environment
const SHARED_AUTH_URL = import.meta.env.VITE_SHARED_AUTH_URL || ''

// Global site key for cross-site auth
const SITE_KEY = 'college'

const Register = () => {
  const navigate = useNavigate()
  const { updateUser } = useAuth()
  const [syncError, setSyncError] = useState('')
  const [mainLogoUrl, setMainLogoUrl] = useState(null)
  const [siteLogoUrl, setSiteLogoUrl] = useState(null)

  // Fetch logos from shared auth on mount
  useEffect(() => {
    const fetchLogos = async () => {
      try {
        // Use the new logo-overlay endpoint for simpler fetching
        const res = await fetch(`${SHARED_AUTH_URL}/settings/logo-overlay?site=${SITE_KEY}`)
        if (res.ok) {
          const data = await res.json()
          if (data.mainLogoUrl) {
            setMainLogoUrl(data.mainLogoUrl.startsWith('http') ? data.mainLogoUrl : `${SHARED_AUTH_URL}${data.mainLogoUrl}`)
          }
          if (data.siteLogoUrl) {
            setSiteLogoUrl(data.siteLogoUrl.startsWith('http') ? data.siteLogoUrl : `${SHARED_AUTH_URL}${data.siteLogoUrl}`)
          }
        }
      } catch (err) {
        console.warn('Failed to fetch logos:', err)
      }
    }

    if (SHARED_AUTH_URL) {
      fetchLogos()
    }
  }, [])

  // Roles available for registration
  const roles = [
    {
      value: 'Student',
      label: 'Student',
      description: 'Learn pickleball from certified coaches',
      icon: GraduationCap
    },
    {
      value: 'Coach',
      label: 'Coach',
      description: 'Teach and share your pickleball expertise',
      icon: Users
    }
  ]

  // Handle successful registration from shared auth
  const handleRegisterSuccess = async ({ token, user }) => {
    console.log('Registration success, token received:', token?.substring(0, 20) + '...')

    try {
      // Store the token
      localStorage.setItem('jwtToken', token)

      // Sync user to local database
      let localUser = user
      try {
        console.log('Syncing user to local database...')
        const syncResponse = await authApi.syncFromSharedAuth(token)
        if (syncResponse.success && syncResponse.data) {
          localUser = syncResponse.data
          console.log('User synced successfully:', localUser)
        }
      } catch (syncErr) {
        console.warn('User sync failed, using shared auth user data:', syncErr)
        // If sync fails, decode token to get user info (FuntimePickleball JWT format)
        try {
          const payload = JSON.parse(atob(token.split('.')[1]))
          // FuntimePickleball uses 'nameid' for user ID, phone uses full URI
          const phoneClaimKey = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone'
          localUser = {
            id: parseInt(payload.nameid || payload.sub || payload.userId),
            email: payload.email,
            phone: payload[phoneClaimKey] || payload.phone,
            firstName: payload.firstName || payload.given_name || user?.firstName,
            lastName: payload.lastName || payload.family_name || user?.lastName,
            role: payload.role || user?.role || 'Student',
            sites: payload.sites ? JSON.parse(payload.sites) : [],
            ...user
          }
        } catch (decodeErr) {
          console.error('Failed to decode token:', decodeErr)
        }
      }

      // Ensure we have required fields
      const userWithDefaults = {
        ...localUser,
        role: localUser.role || 'Student',
        firstName: localUser.firstName || '',
        lastName: localUser.lastName || ''
      }

      // Store user data
      localStorage.setItem('pickleball_user', JSON.stringify(userWithDefaults))

      // Update auth context
      updateUser(userWithDefaults)

      // Navigate based on role
      const role = userWithDefaults.role?.toLowerCase()
      if (role === 'coach') {
        navigate('/coach', { replace: true })
      } else if (role === 'admin') {
        navigate('/admin', { replace: true })
      } else {
        navigate('/student', { replace: true })
      }
    } catch (error) {
      console.error('Registration processing error:', error)
      setSyncError('Registration succeeded but failed to sync user data. Please try again.')
    }
  }

  const handleRegisterError = (error) => {
    console.error('Registration error:', error)
    setSyncError(error)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {syncError && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 border border-red-200">
            <div className="text-sm text-red-700 font-medium">{syncError}</div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <SharedRegister
            authApiUrl={SHARED_AUTH_URL}
            onSuccess={handleRegisterSuccess}
            onError={handleRegisterError}
            onSwitchToLogin={() => navigate('/login')}
            siteName="Pickleball College"
            primaryColor="blue"
            showRoleSelection={true}
            roles={roles}
            site={SITE_KEY}
            logo={
              <SiteLogoOverlay
                mainLogoUrl={mainLogoUrl}
                siteLogoUrl={siteLogoUrl}
                siteName="Pickleball College"
                size="lg"
              />
            }
          />
        </div>
      </div>
    </div>
  )
}

export default Register
