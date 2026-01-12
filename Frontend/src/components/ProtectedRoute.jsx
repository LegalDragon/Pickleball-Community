import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * ProtectedRoute - Ensures user is authenticated and optionally has required role
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - The protected content
 * @param {string} props.role - Single role required (e.g., "Admin")
 * @param {string[]} props.roles - Multiple allowed roles
 * @param {boolean} props.skipProfileCheck - If true, skip the profile completion check
 *                                           (used for /profile and /complete-profile routes)
 */
const ProtectedRoute = ({ children, role, roles, skipProfileCheck = false }) => {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  // Debug logging
  console.log('ProtectedRoute:', {
    path: location.pathname,
    loading,
    isAuthenticated,
    hasUser: !!user,
    userRole: user?.role,
    skipProfileCheck,
    // Also check localStorage directly
    hasStoredUser: !!localStorage.getItem('pickleball_user'),
    hasToken: !!localStorage.getItem('jwtToken')
  })

  if (loading) {
    console.log('ProtectedRoute: Still loading...')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    console.log('ProtectedRoute: Not authenticated, redirecting to /')
    // Redirect to home page - user can sign in from there
    return <Navigate to="/" state={{ from: location }} replace />
  }

  // Handle single role check (backward compatibility)
  if (role && user.role?.toLowerCase() !== role.toLowerCase()) {
    return <Navigate to="/unauthorized" replace />
  }

  // Handle multiple roles check
  if (roles && roles.length > 0) {
    const userRole = user.role?.toLowerCase()
    const allowedRoles = roles.map(r => r.toLowerCase())

    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/unauthorized" replace />
    }
  }

  // Check if user needs to complete their profile
  // A user needs to complete their profile if their name is "New User" (the default)
  if (!skipProfileCheck) {
    const needsProfileCompletion = user.firstName?.toLowerCase() === 'new' &&
                                   user.lastName?.toLowerCase() === 'user'

    if (needsProfileCompletion) {
      console.log('ProtectedRoute: User needs to complete profile, redirecting to /complete-profile')
      return <Navigate to="/complete-profile" state={{ from: location }} replace />
    }
  }

  return children
}

export default ProtectedRoute
