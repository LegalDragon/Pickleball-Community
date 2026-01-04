import { useState } from 'react'
import { Mail, Phone, ArrowLeft, CheckCircle, X } from 'lucide-react'

/**
 * Shared Change Credential Component for Funtime Auth
 * Use across all sites for consistent email/phone change experience with OTP verification
 *
 * @param {Object} props
 * @param {string} props.authApiUrl - Base URL for auth API (e.g., https://auth.funtime.com/api)
 * @param {'email' | 'phone'} props.type - Type of credential to change
 * @param {string} props.currentValue - Current email or phone value
 * @param {Function} props.onSuccess - Callback with { newValue, token, user } on successful change
 * @param {Function} props.onError - Callback with error message on failure
 * @param {Function} props.onCancel - Callback when user cancels
 * @param {string} props.siteName - Name of the site (e.g., "Pickleball Community")
 * @param {string} props.primaryColor - Primary brand color (default: blue)
 * @param {string} props.authToken - Current JWT token for authenticated requests
 */
const SharedChangeCredential = ({
  authApiUrl,
  type,
  currentValue,
  onSuccess,
  onError,
  onCancel,
  siteName = 'Funtime',
  primaryColor = 'blue',
  authToken
}) => {
  const [step, setStep] = useState('input') // 'input', 'verify', 'success'
  const [newValue, setNewValue] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isEmail = type === 'email'
  const Icon = isEmail ? Mail : Phone
  const label = isEmail ? 'Email' : 'Phone Number'
  const placeholder = isEmail ? 'you@example.com' : '+1234567890'

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  })

  const handleSendOtp = async (e) => {
    e.preventDefault()

    if (!newValue.trim()) {
      setError(`Please enter a new ${label.toLowerCase()}`)
      return
    }

    // Basic validation
    if (isEmail && !newValue.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    if (!isEmail && newValue.length < 10) {
      setError('Please enter a valid phone number')
      return
    }

    setLoading(true)
    setError('')

    try {
      const endpoint = isEmail
        ? `${authApiUrl}/auth/change-email/request`
        : `${authApiUrl}/auth/change-phone/request`

      const body = isEmail
        ? { newEmail: newValue }
        : { newPhoneNumber: newValue }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send verification code')
      }

      setStep('verify')
    } catch (err) {
      const message = err.message || 'Failed to send verification code'
      setError(message)
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()

    if (!otp.trim() || otp.length < 4) {
      setError('Please enter the verification code')
      return
    }

    setLoading(true)
    setError('')

    try {
      const endpoint = isEmail
        ? `${authApiUrl}/auth/change-email/verify`
        : `${authApiUrl}/auth/change-phone/verify`

      const body = isEmail
        ? { newEmail: newValue, code: otp }
        : { newPhoneNumber: newValue, code: otp }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Invalid verification code')
      }

      setStep('success')

      // Call success callback with new value and token
      setTimeout(() => {
        onSuccess?.({
          newValue,
          token: data.token,
          user: data.user
        })
      }, 1500)
    } catch (err) {
      const message = err.message || 'Verification failed'
      setError(message)
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setLoading(true)
    setError('')

    try {
      const endpoint = isEmail
        ? `${authApiUrl}/auth/change-email/request`
        : `${authApiUrl}/auth/change-phone/request`

      const body = isEmail
        ? { newEmail: newValue }
        : { newPhoneNumber: newValue }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to resend code')
      }

      // Clear error on successful resend
      setError('')
    } catch (err) {
      const message = err.message || 'Failed to resend code'
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{label} Updated!</h2>
        <p className="text-gray-600 mb-2">
          Your {label.toLowerCase()} has been successfully changed to:
        </p>
        <p className="font-medium text-gray-900 mb-6">{newValue}</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className={`w-16 h-16 bg-gradient-to-br from-${primaryColor}-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg mx-auto`}>
          <Icon className="w-8 h-8 text-white" />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">
          {step === 'input' && `Change ${label}`}
          {step === 'verify' && 'Verify Your Identity'}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {step === 'input' && `Enter your new ${label.toLowerCase()} to receive a verification code`}
          {step === 'verify' && `Enter the code sent to ${newValue}`}
        </p>
      </div>

      {/* Back Button */}
      {step === 'verify' && (
        <button
          onClick={() => {
            setStep('input')
            setOtp('')
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

      {/* Input Step - Enter new email/phone */}
      {step === 'input' && (
        <form onSubmit={handleSendOtp} className="space-y-4">
          {currentValue && (
            <div className="p-3 bg-gray-50 rounded-lg mb-4">
              <p className="text-sm text-gray-600">
                Current {label.toLowerCase()}: <strong>{currentValue}</strong>
              </p>
            </div>
          )}
          <div>
            <label htmlFor="newValue" className="block text-sm font-medium text-gray-700 mb-1">
              New {label}
            </label>
            <input
              id="newValue"
              type={isEmail ? 'email' : 'tel'}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              required
              className={inputClass()}
              placeholder={placeholder}
            />
          </div>
          <p className="text-xs text-gray-500">
            We'll send a verification code to verify you own this {label.toLowerCase()}.
          </p>
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? 'Sending...' : 'Send Verification Code'}
          </button>
        </form>
      )}

      {/* Verify Step - Enter OTP */}
      {step === 'verify' && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
              Verification Code
            </label>
            <input
              id="otp"
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              required
              className={`${inputClass()} text-center text-lg tracking-widest`}
              placeholder="123456"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={loading}
              className={`text-sm text-${primaryColor}-600 hover:text-${primaryColor}-500 font-medium disabled:opacity-50`}
            >
              Resend code
            </button>
          </div>
          <button type="submit" disabled={loading || otp.length < 4} className={buttonClass}>
            {loading ? 'Verifying...' : 'Verify & Update'}
          </button>
        </form>
      )}

      {/* Cancel Button */}
      {onCancel && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onCancel}
            className={`text-sm font-medium text-gray-500 hover:text-gray-700`}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

export default SharedChangeCredential
