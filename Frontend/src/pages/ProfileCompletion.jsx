import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { userApi } from '../services/api'
import { User, Save, AlertCircle } from 'lucide-react'

const ProfileCompletion = () => {
  const { user, updateUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [firstName, setFirstName] = useState(user?.firstName?.toLowerCase() === 'new' ? '' : (user?.firstName || ''))
  const [lastName, setLastName] = useState(user?.lastName?.toLowerCase() === 'user' ? '' : (user?.lastName || ''))
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  // Get the intended destination from location state, or default to member dashboard
  const from = location.state?.from?.pathname || '/member/dashboard'

  const validate = () => {
    const newErrors = {}

    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required'
    } else if (firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters'
    }

    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    } else if (lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters'
    }

    // Prevent users from keeping "New User" as their name
    if (firstName.trim().toLowerCase() === 'new' && lastName.trim().toLowerCase() === 'user') {
      newErrors.firstName = 'Please enter your real name'
      newErrors.lastName = 'Please enter your real name'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setSaving(true)
    try {
      const profileData = {
        firstName: firstName.trim(),
        lastName: lastName.trim()
      }

      await userApi.updateProfile(profileData)
      updateUser({ ...user, ...profileData })

      toast.success('Profile updated successfully! Welcome to Pickleball Community.')

      // Navigate to the originally intended destination
      navigate(from, { replace: true })
    } catch (error) {
      console.error('Profile update error:', error)
      toast.error('Failed to update profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-8 text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Complete Your Profile</h1>
            <p className="text-blue-100 mt-2">
              Please update your name to continue
            </p>
          </div>

          {/* Form */}
          <div className="p-6">
            {/* Info Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-800">
                  <strong>Welcome!</strong> We noticed your profile still has the default name.
                  Please enter your real name so other players can recognize you.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value)
                    if (errors.firstName) {
                      setErrors(prev => ({ ...prev, firstName: null }))
                    }
                  }}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                    errors.firstName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter your first name"
                  autoFocus
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value)
                    if (errors.lastName) {
                      setErrors(prev => ({ ...prev, lastName: null }))
                    }
                  }}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                    errors.lastName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter your last name"
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>Save & Continue</span>
                  </>
                )}
              </button>
            </form>

            <p className="text-xs text-gray-500 text-center mt-4">
              You can update more profile details later from your Profile page.
            </p>
          </div>
        </div>

        {/* Footer text */}
        <p className="text-center text-sm text-gray-500 mt-4">
          This name will be visible to other players in the community.
        </p>
      </div>
    </div>
  )
}

export default ProfileCompletion
