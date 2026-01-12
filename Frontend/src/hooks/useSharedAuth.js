import { useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { SHARED_AUTH_UI_URL } from '../services/api'

/**
 * Hook for handling shared auth redirects
 * Provides functions to redirect to the shared auth UI for login/register
 */
export const useSharedAuth = () => {
  const location = useLocation()

  /**
   * Redirect to shared auth login page
   * @param {string} returnTo - Optional path to return to after login
   */
  const redirectToLogin = useCallback((returnTo) => {
    if (!SHARED_AUTH_UI_URL) {
      // Fallback to local login page if shared auth not configured
      window.location.href = '/login'
      return
    }

    const currentUrl = window.location.origin
    const redirectUrl = `${currentUrl}/auth/callback`
    const returnPath = returnTo || location.state?.from?.pathname || location.pathname

    window.location.href = `${SHARED_AUTH_UI_URL}/login?redirect=${encodeURIComponent(redirectUrl)}&returnTo=${encodeURIComponent(returnPath)}&site=community`
  }, [location])

  /**
   * Redirect to shared auth register page
   */
  const redirectToRegister = useCallback(() => {
    if (!SHARED_AUTH_UI_URL) {
      // Fallback to local register page if shared auth not configured
      window.location.href = '/register'
      return
    }

    const currentUrl = window.location.origin
    const redirectUrl = `${currentUrl}/auth/callback`

    window.location.href = `${SHARED_AUTH_UI_URL}/register?redirect=${encodeURIComponent(redirectUrl)}&site=community`
  }, [])

  /**
   * Redirect to shared auth forgot password page
   */
  const redirectToForgotPassword = useCallback(() => {
    if (!SHARED_AUTH_UI_URL) {
      // Fallback to local forgot password page if shared auth not configured
      window.location.href = '/forgot-password'
      return
    }

    const currentUrl = window.location.origin
    const redirectUrl = `${currentUrl}/auth/callback`

    window.location.href = `${SHARED_AUTH_UI_URL}/forgot-password?redirect=${encodeURIComponent(redirectUrl)}&site=community`
  }, [])

  /**
   * Get the shared auth login URL (for use in href attributes)
   * @param {string} returnTo - Optional path to return to after login
   */
  const getLoginUrl = useCallback((returnTo) => {
    if (!SHARED_AUTH_UI_URL) return '/login'

    const currentUrl = window.location.origin
    const redirectUrl = `${currentUrl}/auth/callback`
    const returnPath = returnTo || '/'

    return `${SHARED_AUTH_UI_URL}/login?redirect=${encodeURIComponent(redirectUrl)}&returnTo=${encodeURIComponent(returnPath)}&site=community`
  }, [])

  /**
   * Get the shared auth register URL (for use in href attributes)
   */
  const getRegisterUrl = useCallback(() => {
    if (!SHARED_AUTH_UI_URL) return '/register'

    const currentUrl = window.location.origin
    const redirectUrl = `${currentUrl}/auth/callback`

    return `${SHARED_AUTH_UI_URL}/register?redirect=${encodeURIComponent(redirectUrl)}&site=community`
  }, [])

  return {
    redirectToLogin,
    redirectToRegister,
    redirectToForgotPassword,
    getLoginUrl,
    getRegisterUrl,
    isSharedAuthEnabled: !!SHARED_AUTH_UI_URL
  }
}

export default useSharedAuth
