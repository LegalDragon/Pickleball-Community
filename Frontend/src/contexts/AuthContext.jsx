import { createContext, useContext, useState, useEffect } from 'react'
import { authApi, SHARED_AUTH_URL } from '../services/api'
import axios from 'axios' // Import axios to set default headers

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Check for stored user and token
    const storedUser = localStorage.getItem('pickleball_user')
    const token = localStorage.getItem('jwtToken')

    if (storedUser && token) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
        setIsAuthenticated(true)

        // Set Authorization header for all future requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      } catch (error) {
        console.error('Error parsing stored user:', error)
        clearAuthData()
      }
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    try {
      setLoading(true)

      let token, userData

      // Try shared auth first if configured
      if (SHARED_AUTH_URL) {
        console.log('Using shared auth:', SHARED_AUTH_URL)
        try {
          // Step 1: Login via shared auth service
          const sharedResponse = await authApi.sharedLogin(email, password)
          const sharedData = sharedResponse.data

          token = sharedData.token || sharedData.Token
          const sharedUser = sharedData.user || sharedData.User

          if (token) {
            // Step 2: Sync user to local database
            localStorage.setItem('jwtToken', token)
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

            const syncResponse = await authApi.syncFromSharedAuth(token)
            userData = syncResponse.User || syncResponse.user || sharedUser
          }
        } catch (sharedError) {
          console.log('Shared auth failed, falling back to local auth:', sharedError.message)
          // Fall back to local auth
          const response = await authApi.login(email, password)
          token = response.Token || response.token
          userData = response.User || response.user
        }
      } else {
        // Use local auth
        const response = await authApi.login(email, password)
        token = response.Token || response.token
        userData = response.User || response.user
      }

      // Store the JWT token
      if (token) {
        localStorage.setItem('jwtToken', token)
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      }

      // Store user data (including profileImageUrl)
      if (userData) {
        const userWithAvatar = {
          ...userData,
          profileImageUrl: userData.profileImageUrl || userData.ProfileImageUrl || null
        }
        setUser(userWithAvatar)
        setIsAuthenticated(true)
        localStorage.setItem('pickleball_user', JSON.stringify(userWithAvatar))
      }

      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Login failed'
      }
    } finally {
      setLoading(false)
    }
  }
  const register = async (userData) => {
    try {
      setLoading(true)
      console.log('AuthContext: Registering user with data:', userData)

      let response

      // Try shared auth first if configured
      if (SHARED_AUTH_URL) {
        console.log('Using shared auth for registration:', SHARED_AUTH_URL)
        try {
          const sharedResponse = await authApi.sharedRegister(userData)
          const sharedData = sharedResponse.data

          const token = sharedData.token || sharedData.Token

          if (token) {
            localStorage.setItem('jwtToken', token)
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

            // Sync to local database
            response = await authApi.syncFromSharedAuth(token)
          } else {
            response = sharedData
          }
        } catch (sharedError) {
          console.log('Shared auth registration failed, falling back to local:', sharedError.message)
          response = await authApi.register(userData)
        }
      } else {
        response = await authApi.register(userData)
      }

      console.log('AuthContext: Full registration response:', response)

      if (!response) {
        throw new Error('No response from server')
      }

      // Check if registration was successful
      if (response.success === false) {
        // Check for "user already exists" type errors
        const errorMsg = response.message || response.error || ''
        const lowerError = errorMsg.toLowerCase()

        if (lowerError.includes('already exists') ||
          lowerError.includes('already registered') ||
          lowerError.includes('user exists') ||
          lowerError.includes('email taken') ||
          lowerError.includes('duplicate')) {
          throw new Error('USER_EXISTS')
        }
        throw new Error(errorMsg || 'Registration failed')
      }

      // Handle successful registration
      const token = response.token || response.Token || response.access_token || response.accessToken
      const userDataFromResponse = response.user || response.User || response.data || response

      console.log('AuthContext: Extracted token:', token ? 'Token exists' : 'No token')
      console.log('AuthContext: Extracted user data:', userDataFromResponse)

      if (token) {
        localStorage.setItem('jwtToken', token)

        if (axios.defaults.headers) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
        }
      }

      if (userDataFromResponse) {
        const user = {
          ...userDataFromResponse,
          email: userDataFromResponse.email || userData.email,
          firstName: userDataFromResponse.firstName || userDataFromResponse.first_name || userData.firstName,
          lastName: userDataFromResponse.lastName || userDataFromResponse.last_name || userData.lastName,
          role: userDataFromResponse.role || userData.role || 'Student',
          profileImageUrl: userDataFromResponse.profileImageUrl || userDataFromResponse.ProfileImageUrl || null
        }

        setUser(user)
        setIsAuthenticated(true)
        localStorage.setItem('pickleball_user', JSON.stringify(user))
      }

      return { success: true }

    } catch (error) {
      console.error('AuthContext: Registration error:', error)


      // Check for user existence errors in the error message
      const errorMessage = error.message || error.response?.data?.message ||
        error.response?.data?.error || 'Registration failed. Please try again.'

      const lowerErrorMessage = (typeof errorMessage === 'string' ? errorMessage : String(errorMessage)).toLowerCase()

      if (lowerErrorMessage.includes('already exists') ||
        lowerErrorMessage.includes('already registered') ||
        lowerErrorMessage.includes('user exists') ||
        lowerErrorMessage.includes('email taken') ||
        lowerErrorMessage.includes('duplicate')) {

        console.error('AuthContext: Registration error: USER_EXISTS')
        // Password1234
        return {
          success: false,
          error: 'USER_EXISTS',
          message: 'An account with this email already exists.'
        }
      }


      // // Check if error is USER_EXISTS
      // if (error.message === 'USER_EXISTS') {
      //   return {
      //     success: false,
      //     error: 'USER_EXISTS',
      //     message: 'An account with this email already exists.'
      //   }
      // }

      // Handle other API errors
      return {
        success: false,
        error: errorMessage
      }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    clearAuthData()
    setUser(null)
    setIsAuthenticated(false)

    // Remove Authorization header
    delete axios.defaults.headers.common['Authorization']

    // Optional: Call logout API endpoint if you have one
    // authApi.logout().catch(err => console.error('Logout API error:', err))
  }

  const clearAuthData = () => {
    localStorage.removeItem('jwtToken')
    localStorage.removeItem('pickleball_user')
    localStorage.removeItem('authToken') // Clear old if exists
    localStorage.removeItem('refreshToken') // Clear old if exists
  }

  // Optional: Add token refresh function if your backend supports it
  const refreshToken = async () => {
    try {
      const response = await authApi.refreshToken()
      if (response.Token) {
        localStorage.setItem('jwtToken', response.Token)
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.Token}`
        return true
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      logout()
      return false
    }
  }

  // Update user function - also sets isAuthenticated when user data is provided
  const updateUser = (updatedUserData) => {
    if (updatedUserData) {
      setUser(prev => {
        const newUser = prev ? { ...prev, ...updatedUserData } : updatedUserData
        localStorage.setItem('pickleball_user', JSON.stringify(newUser))
        return newUser
      })
      // Also set isAuthenticated when updating user from auth callback
      setIsAuthenticated(true)
    }
  }


  // Add these methods inside the AuthProvider component, after the register function:

  const forgotPassword = async (email) => {
    try {
      setLoading(true)
      // Call your API endpoint
      const response = await authApi.forgotPassword(email)

      return {
        success: true,
        message: response.message || 'Password reset email sent successfully'
      }
    } catch (error) {
      console.error('Forgot password error:', error)
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to send reset email'
      }
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (token, newPassword) => {
    try {
      setLoading(true)
      // Call your API endpoint
      const response = await authApi.resetPassword(token, newPassword)

      return {
        success: true,
        message: response.message || 'Password reset successfully'
      }
    } catch (error) {
      console.error('Reset password error:', error)
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to reset password'
      }
    } finally {
      setLoading(false)
    }
  }

  const verifyResetToken = async (token) => {
    try {
      // Call your API endpoint
      const response = await authApi.verifyResetToken(token)

      return {
        success: true,
        valid: true,
        email: response.email
      }
    } catch (error) {
      console.error('Verify token error:', error)
      return {
        success: false,
        valid: false,
        error: error.response?.data?.message || error.message || 'Invalid or expired token'
      }
    }
  }

  const value = {
    user,
    login,
    logout,
    register,
    loading,
    isAuthenticated,
    refreshToken, // Optional
    updateUser,   // Optional
    forgotPassword,    // Add this
    resetPassword,     // Add this
    verifyResetToken   // Add this
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}