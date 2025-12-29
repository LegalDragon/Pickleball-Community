import { useState } from 'react'
import { Eye, EyeOff, LogIn, Phone, Mail } from 'lucide-react'

/**
 * Shared Login Component for Funtime Auth
 * Use across all sites for consistent login experience
 *
 * @param {Object} props
 * @param {string} props.authApiUrl - Base URL for auth API (e.g., https://auth.funtime.com)
 * @param {Function} props.onSuccess - Callback with { token, user } on successful login
 * @param {Function} props.onError - Callback with error message on failure
 * @param {Function} props.onSwitchToRegister - Callback to switch to register view
 * @param {Function} props.onForgotPassword - Callback to switch to forgot password view
 * @param {string} props.siteName - Name of the site (e.g., "Pickleball College")
 * @param {string} props.primaryColor - Primary brand color (default: blue-600)
 * @param {string} props.site - Site code for cross-site auth (e.g., "college")
 * @param {React.ReactNode} props.logo - Custom logo component to display
 */
const SharedLogin = ({
  authApiUrl,
  onSuccess,
  onError,
  onSwitchToRegister,
  onForgotPassword,
  siteName = 'Funtime',
  primaryColor = 'blue',
  site = '',
  logo = null
}) => {
  const [loginMethod, setLoginMethod] = useState('email') // 'email' or 'phone'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [error, setError] = useState('')

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${authApiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, site: site || undefined })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Login failed')
      }

      onSuccess?.({
        token: data.token || data.Token,
        user: data.user || data.User
      })
    } catch (err) {
      const message = err.message || 'Login failed'
      setError(message)
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }

  const handleSendOtp = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${authApiUrl}/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send OTP')
      }

      setOtpSent(true)
    } catch (err) {
      const message = err.message || 'Failed to send OTP'
      setError(message)
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }

  const handlePhoneLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${authApiUrl}/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, code: otp, site: site || undefined })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Verification failed')
      }

      onSuccess?.({
        token: data.token || data.Token,
        user: data.user || data.User
      })
    } catch (err) {
      const message = err.message || 'Verification failed'
      setError(message)
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }

  const buttonClass = `w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-${primaryColor}-600 hover:bg-${primaryColor}-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${primaryColor}-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200`

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        {logo ? (
          <div className="mx-auto mb-4">{logo}</div>
        ) : (
          <div className={`w-16 h-16 bg-gradient-to-br from-${primaryColor}-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg mx-auto`}>
            <LogIn className="w-8 h-8 text-white" />
          </div>
        )}
        <h2 className="mt-4 text-2xl font-bold text-gray-900">
          Sign in to {siteName}
        </h2>
      </div>

      {/* Login Method Toggle */}
      <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
        <button
          type="button"
          onClick={() => { setLoginMethod('email'); setOtpSent(false); setError('') }}
          className={`flex-1 flex items-center justify-center py-2 px-4 rounded-md text-sm font-medium transition-all ${
            loginMethod === 'email'
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Mail className="w-4 h-4 mr-2" />
          Email
        </button>
        <button
          type="button"
          onClick={() => { setLoginMethod('phone'); setError('') }}
          className={`flex-1 flex items-center justify-center py-2 px-4 rounded-md text-sm font-medium transition-all ${
            loginMethod === 'phone'
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Phone className="w-4 h-4 mr-2" />
          Phone
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200 mb-4">
          <div className="text-sm text-red-700 font-medium">{error}</div>
        </div>
      )}

      {loginMethod === 'email' ? (
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onForgotPassword}
              className={`text-sm font-medium text-${primaryColor}-600 hover:text-${primaryColor}-500`}
            >
              Forgot your password?
            </button>
          </div>

          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-3"></div>
                Signing in...
              </div>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handlePhoneLogin} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone number
            </label>
            <div className="flex gap-2">
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={otpSent}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition disabled:bg-gray-100"
                placeholder="+1234567890"
              />
              {!otpSent && (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading || !phone}
                  className={`px-4 py-2.5 bg-${primaryColor}-600 text-white rounded-lg text-sm font-medium hover:bg-${primaryColor}-700 disabled:opacity-50 disabled:cursor-not-allowed transition`}
                >
                  {loading ? '...' : 'Send OTP'}
                </button>
              )}
            </div>
          </div>

          {otpSent && (
            <>
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                  Verification code
                </label>
                <input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  maxLength={6}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition text-center text-lg tracking-widest"
                  placeholder="123456"
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtp('') }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Change number
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className={`text-${primaryColor}-600 hover:text-${primaryColor}-500 font-medium`}
                >
                  Resend code
                </button>
              </div>

              <button type="submit" disabled={loading} className={buttonClass}>
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-3"></div>
                    Verifying...
                  </div>
                ) : (
                  'Verify & Sign in'
                )}
              </button>
            </>
          )}
        </form>
      )}

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className={`font-medium text-${primaryColor}-600 hover:text-${primaryColor}-500`}
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  )
}

export default SharedLogin
