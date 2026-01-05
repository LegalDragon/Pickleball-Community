import { useState } from 'react'
import { Eye, EyeOff, UserPlus, Phone, Mail, CheckCircle } from 'lucide-react'

/**
 * Shared Register Component for Funtime Auth
 * Use across all sites for consistent registration experience
 *
 * @param {Object} props
 * @param {string} props.authApiUrl - Base URL for auth API (e.g., https://auth.funtime.com)
 * @param {Function} props.onSuccess - Callback with { token, user } on successful registration
 * @param {Function} props.onError - Callback with error message on failure
 * @param {Function} props.onSwitchToLogin - Callback to switch to login view
 * @param {string} props.siteName - Name of the site (e.g., "Pickleball Community")
 * @param {string} props.primaryColor - Primary brand color (default: blue)
 * @param {boolean} props.showRoleSelection - Whether to show role selection (default: false)
 * @param {Array} props.roles - Available roles [{value, label, description, icon}]
 * @param {string} props.site - Site code for cross-site auth (e.g., "Community")
 * @param {React.ReactNode} props.logo - Custom logo component to display
 */
const SharedRegister = ({
  authApiUrl,
  onSuccess,
  onError,
  onSwitchToLogin,
  siteName = 'Funtime',
  primaryColor = 'blue',
  showRoleSelection = false,
  roles = [],
  site = '',
  logo = null
}) => {
  const [registerMethod, setRegisterMethod] = useState('email') // 'email' or 'phone'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    otp: '',
    role: roles.length > 0 ? roles[0].value : 'Player',
    terms: false
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setFieldErrors(prev => ({ ...prev, [field]: '' }))
  }

  const validateForm = () => {
    const errors = {}

    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required'
    }
    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required'
    }

    if (registerMethod === 'email') {
      if (!formData.email.trim()) {
        errors.email = 'Email is required'
      } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)) {
        errors.email = 'Please enter a valid email address'
      }

      if (!formData.password) {
        errors.password = 'Password is required'
      } else if (formData.password.length < 8) {
        errors.password = 'Password must be at least 8 characters'
      } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
        errors.password = 'Must contain uppercase, lowercase, and number'
      }

      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match'
      }
    } else {
      if (!formData.phone.trim()) {
        errors.phone = 'Phone number is required'
      }
      if (otpSent && !formData.otp.trim()) {
        errors.otp = 'Verification code is required'
      }
    }

    if (!formData.terms) {
      errors.terms = 'You must accept the terms and conditions'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleEmailRegister = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${authApiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
          site: site || undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed')
      }

      onSuccess?.({
        token: data.token || data.Token,
        user: data.user || data.User
      })
    } catch (err) {
      const message = err.message || 'Registration failed'
      setError(message)
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }

  const handleSendOtp = async () => {
    if (!formData.phone.trim()) {
      setFieldErrors(prev => ({ ...prev, phone: 'Phone number is required' }))
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${authApiUrl}/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: formData.phone })
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

  const handlePhoneRegister = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    setError('')

    try {
      // First verify OTP
      const verifyResponse = await fetch(`${authApiUrl}/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: formData.phone,
          code: formData.otp,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
          site: site || undefined
        })
      })

      const data = await verifyResponse.json()

      if (!verifyResponse.ok) {
        throw new Error(data.message || 'Verification failed')
      }

      onSuccess?.({
        token: data.token || data.Token,
        user: data.user || data.User
      })
    } catch (err) {
      const message = err.message || 'Registration failed'
      setError(message)
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }

  const buttonClass = `w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-${primaryColor}-500 to-purple-600 hover:from-${primaryColor}-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${primaryColor}-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200`

  const inputClass = (fieldName) => `w-full px-3 py-2.5 border rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-${primaryColor}-500 sm:text-sm transition ${
    fieldErrors[fieldName] ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500'
  }`

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        {logo ? (
          <div className="mx-auto mb-4">{logo}</div>
        ) : (
          <div className={`w-16 h-16 bg-gradient-to-br from-${primaryColor}-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg mx-auto`}>
            <UserPlus className="w-8 h-8 text-white" />
          </div>
        )}
        <h2 className="mt-4 text-2xl font-bold text-gray-900">
          Create your account
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Join {siteName} today
        </p>
      </div>

      {/* Register Method Toggle */}
      <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
        <button
          type="button"
          onClick={() => { setRegisterMethod('email'); setOtpSent(false); setError('') }}
          className={`flex-1 flex items-center justify-center py-2 px-4 rounded-md text-sm font-medium transition-all ${
            registerMethod === 'email'
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Mail className="w-4 h-4 mr-2" />
          Email
        </button>
        <button
          type="button"
          onClick={() => { setRegisterMethod('phone'); setError('') }}
          className={`flex-1 flex items-center justify-center py-2 px-4 rounded-md text-sm font-medium transition-all ${
            registerMethod === 'phone'
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

      <form onSubmit={registerMethod === 'email' ? handleEmailRegister : handlePhoneRegister} className="space-y-4">
        {/* Role Selection */}
        {showRoleSelection && roles.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              I want to join as a...
            </label>
            <div className="grid grid-cols-1 gap-2">
              {roles.map((role) => {
                const isSelected = formData.role === role.value
                const Icon = role.icon
                return (
                  <label
                    key={role.value}
                    className={`relative flex cursor-pointer rounded-xl border p-3 transition-all duration-200 ${
                      isSelected
                        ? `bg-${primaryColor}-50 border-2 border-${primaryColor}-500 ring-2 ring-${primaryColor}-200`
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                    onClick={() => updateField('role', role.value)}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={role.value}
                      checked={isSelected}
                      onChange={(e) => updateField('role', e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center">
                        {Icon && <Icon className={`w-5 h-5 mr-2 text-${primaryColor}-600`} />}
                        <div>
                          <span className="font-semibold text-gray-900 text-sm">{role.label}</span>
                          {role.description && (
                            <p className="text-gray-500 text-xs">{role.description}</p>
                          )}
                        </div>
                      </div>
                      {isSelected && <CheckCircle className={`w-5 h-5 text-${primaryColor}-600`} />}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
              First name
            </label>
            <input
              id="firstName"
              type="text"
              value={formData.firstName}
              onChange={(e) => updateField('firstName', e.target.value)}
              className={inputClass('firstName')}
              placeholder="First name"
            />
            {fieldErrors.firstName && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.firstName}</p>
            )}
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              value={formData.lastName}
              onChange={(e) => updateField('lastName', e.target.value)}
              className={inputClass('lastName')}
              placeholder="Last name"
            />
            {fieldErrors.lastName && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.lastName}</p>
            )}
          </div>
        </div>

        {registerMethod === 'email' ? (
          <>
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                className={inputClass('email')}
                placeholder="you@example.com"
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className={`${inputClass('password')} pr-10`}
                  placeholder="Create a secure password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Min 8 characters with uppercase, lowercase, and number
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                className={inputClass('confirmPassword')}
                placeholder="Re-enter your password"
              />
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone number
              </label>
              <div className="flex gap-2">
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  disabled={otpSent}
                  className={`flex-1 ${inputClass('phone')} disabled:bg-gray-100`}
                  placeholder="+1234567890"
                />
                {!otpSent && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading || !formData.phone}
                    className={`px-4 py-2.5 bg-${primaryColor}-600 text-white rounded-lg text-sm font-medium hover:bg-${primaryColor}-700 disabled:opacity-50 disabled:cursor-not-allowed transition`}
                  >
                    {loading ? '...' : 'Send OTP'}
                  </button>
                )}
              </div>
              {fieldErrors.phone && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>
              )}
            </div>

            {otpSent && (
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                  Verification code
                </label>
                <input
                  id="otp"
                  type="text"
                  value={formData.otp}
                  onChange={(e) => updateField('otp', e.target.value)}
                  maxLength={6}
                  className={`${inputClass('otp')} text-center text-lg tracking-widest`}
                  placeholder="123456"
                />
                {fieldErrors.otp && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.otp}</p>
                )}
                <div className="flex justify-between mt-2 text-sm">
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); updateField('otp', '') }}
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
              </div>
            )}
          </>
        )}

        {/* Terms */}
        <div className="flex items-start">
          <input
            id="terms"
            type="checkbox"
            checked={formData.terms}
            onChange={(e) => updateField('terms', e.target.checked)}
            className={`h-4 w-4 text-${primaryColor}-600 focus:ring-${primaryColor}-500 border-gray-300 rounded mt-1`}
          />
          <label htmlFor="terms" className="ml-2 block text-sm text-gray-900">
            I agree to the{' '}
            <a href="#" className={`font-medium text-${primaryColor}-600 hover:text-${primaryColor}-500`}>
              Terms and Conditions
            </a>{' '}
            and{' '}
            <a href="#" className={`font-medium text-${primaryColor}-600 hover:text-${primaryColor}-500`}>
              Privacy Policy
            </a>
          </label>
        </div>
        {fieldErrors.terms && (
          <p className="text-xs text-red-600">{fieldErrors.terms}</p>
        )}

        {/* Submit */}
        {(registerMethod === 'email' || otpSent) && (
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-3"></div>
                Creating account...
              </div>
            ) : (
              'Create account'
            )}
          </button>
        )}
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className={`font-medium text-${primaryColor}-600 hover:text-${primaryColor}-500`}
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}

export default SharedRegister
