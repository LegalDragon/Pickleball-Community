import { useState } from 'react'
import { Eye, EyeOff, KeyRound, ArrowLeft, CheckCircle, Mail, Phone } from 'lucide-react'

/**
 * Shared Forgot Password Component for Funtime Auth
 * Use across all sites for consistent password recovery experience
 *
 * @param {Object} props
 * @param {string} props.authApiUrl - Base URL for auth API (e.g., https://auth.funtime.com)
 * @param {Function} props.onSuccess - Callback on successful password reset
 * @param {Function} props.onError - Callback with error message on failure
 * @param {Function} props.onBackToLogin - Callback to go back to login
 * @param {string} props.siteName - Name of the site (e.g., "Pickleball Community")
 * @param {string} props.primaryColor - Primary brand color (default: blue)
 */
const SharedForgotPassword = ({
  authApiUrl,
  onSuccess,
  onError,
  onBackToLogin,
  siteName = 'Funtime',
  primaryColor = 'blue'
}) => {
  const [step, setStep] = useState('method') // 'method', 'verify', 'reset', 'success'
  const [resetMethod, setResetMethod] = useState('email') // 'email' or 'phone'
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetToken, setResetToken] = useState('')

  const handleSendResetEmail = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${authApiUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send reset email')
      }

      setStep('verify')
    } catch (err) {
      const message = err.message || 'Failed to send reset email'
      setError(message)
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      setError('Phone number is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${authApiUrl}/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, purpose: 'password-reset' })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send OTP')
      }

      setStep('verify')
    } catch (err) {
      const message = err.message || 'Failed to send OTP'
      setError(message)
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${authApiUrl}/auth/verify-reset-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone,
          code: otp
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Invalid verification code')
      }

      setResetToken(data.resetToken || data.token)
      setStep('reset')
    } catch (err) {
      const message = err.message || 'Verification failed'
      setError(message)
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${authApiUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone,
          code: otp,
          newPassword: newPassword,
          token: resetToken
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password')
      }

      setStep('success')
      onSuccess?.()
    } catch (err) {
      const message = err.message || 'Failed to reset password'
      setError(message)
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }

  const buttonClass = `w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-${primaryColor}-600 hover:bg-${primaryColor}-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${primaryColor}-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200`

  const inputClass = (hasError = false) => `w-full px-3 py-2.5 border rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-${primaryColor}-500 sm:text-sm transition ${
    hasError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500'
  }`

  // Success Step
  if (step === 'success') {
    return (
      <div className="w-full max-w-md mx-auto text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h2>
        <p className="text-gray-600 mb-6">
          Your password has been successfully reset. You can now sign in with your new password.
        </p>
        <button onClick={onBackToLogin} className={buttonClass}>
          Back to Sign In
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className={`w-16 h-16 bg-gradient-to-br from-${primaryColor}-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg mx-auto`}>
          <KeyRound className="w-8 h-8 text-white" />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">
          {step === 'method' && 'Reset your password'}
          {step === 'verify' && 'Verify your identity'}
          {step === 'reset' && 'Create new password'}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {step === 'method' && 'Choose how you want to reset your password'}
          {step === 'verify' && (resetMethod === 'email' ? 'Check your email for a verification code' : 'Enter the code sent to your phone')}
          {step === 'reset' && 'Enter your new password below'}
        </p>
      </div>

      {/* Back Button */}
      {step !== 'method' && (
        <button
          onClick={() => {
            if (step === 'verify') setStep('method')
            else if (step === 'reset') setStep('verify')
            setError('')
          }}
          className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </button>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200 mb-4">
          <div className="text-sm text-red-700 font-medium">{error}</div>
        </div>
      )}

      {/* Method Selection Step */}
      {step === 'method' && (
        <>
          <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => { setResetMethod('email'); setError('') }}
              className={`flex-1 flex items-center justify-center py-2 px-4 rounded-md text-sm font-medium transition-all ${
                resetMethod === 'email'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Mail className="w-4 h-4 mr-2" />
              Email
            </button>
            <button
              type="button"
              onClick={() => { setResetMethod('phone'); setError('') }}
              className={`flex-1 flex items-center justify-center py-2 px-4 rounded-md text-sm font-medium transition-all ${
                resetMethod === 'phone'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Phone className="w-4 h-4 mr-2" />
              Phone
            </button>
          </div>

          {resetMethod === 'email' ? (
            <form onSubmit={handleSendResetEmail} className="space-y-4">
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
                  className={inputClass()}
                  placeholder="you@example.com"
                />
              </div>
              <button type="submit" disabled={loading} className={buttonClass}>
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass()}
                  placeholder="+1234567890"
                />
              </div>
              <button onClick={handleSendOtp} disabled={loading || !phone} className={buttonClass}>
                {loading ? 'Sending...' : 'Send verification code'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Verify Step */}
      {step === 'verify' && resetMethod === 'phone' && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
              Verification code
            </label>
            <input
              id="otp"
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
              required
              className={`${inputClass()} text-center text-lg tracking-widest`}
              placeholder="123456"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={loading}
              className={`text-sm text-${primaryColor}-600 hover:text-${primaryColor}-500 font-medium`}
            >
              Resend code
            </button>
          </div>
          <button type="submit" disabled={loading || !otp} className={buttonClass}>
            {loading ? 'Verifying...' : 'Verify code'}
          </button>
        </form>
      )}

      {step === 'verify' && resetMethod === 'email' && (
        <div className="text-center py-4">
          <p className="text-gray-600 mb-4">
            We've sent a password reset link to <strong>{email}</strong>.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Click the link in the email to reset your password.
          </p>
          <button
            onClick={handleSendResetEmail}
            disabled={loading}
            className={`text-${primaryColor}-600 hover:text-${primaryColor}-500 font-medium text-sm`}
          >
            Didn't receive it? Resend email
          </button>
        </div>
      )}

      {/* Reset Password Step */}
      {step === 'reset' && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
              New password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className={`${inputClass()} pr-10`}
                placeholder="Create a new password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Min 8 characters with uppercase, lowercase, and number
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className={inputClass(newPassword !== confirmPassword && confirmPassword)}
              placeholder="Re-enter your new password"
            />
            {newPassword !== confirmPassword && confirmPassword && (
              <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            className={buttonClass}
          >
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
        </form>
      )}

      {/* Back to Login */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={onBackToLogin}
          className={`text-sm font-medium text-${primaryColor}-600 hover:text-${primaryColor}-500`}
        >
          Back to sign in
        </button>
      </div>
    </div>
  )
}

export default SharedForgotPassword
