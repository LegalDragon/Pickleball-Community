import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ProtectedRoute = ({ children, role, roles }) => {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  // Debug logging
  console.log('ProtectedRoute:', {
    path: location.pathname,
    loading,
    isAuthenticated,
    hasUser: !!user,
    userRole: user?.role
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

  return children
}

export default ProtectedRoute
