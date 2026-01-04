import { X } from 'lucide-react'
import SharedChangeCredential from '../shared-auth/SharedChangeCredential'
import { SHARED_AUTH_URL } from '../../services/api'

/**
 * Modal wrapper for SharedChangeCredential component
 * Handles modal open/close and passes through to shared component
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback to close the modal
 * @param {'email' | 'phone'} props.type - Type of credential to change
 * @param {string} props.currentValue - Current email or phone value
 * @param {Function} props.onSuccess - Callback with new value on successful change
 */
const ChangeCredentialModal = ({
  isOpen,
  onClose,
  type,
  currentValue,
  onSuccess
}) => {
  const authToken = localStorage.getItem('jwtToken')

  const handleSuccess = ({ newValue, token, user }) => {
    // Update the JWT token if a new one was returned
    if (token) {
      localStorage.setItem('jwtToken', token)
    }

    // Call the parent success handler
    onSuccess?.(newValue)
  }

  const handleError = (message) => {
    console.error('Credential change error:', message)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        <div className="relative inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="px-6 py-8">
            <SharedChangeCredential
              authApiUrl={SHARED_AUTH_URL}
              type={type}
              currentValue={currentValue}
              onSuccess={handleSuccess}
              onError={handleError}
              onCancel={onClose}
              siteName="Pickleball Community"
              primaryColor="blue"
              authToken={authToken}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChangeCredentialModal
