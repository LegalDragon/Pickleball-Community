import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Calendar, Clock, MapPin, Video } from 'lucide-react'

const SessionScheduler = () => {
  const [scheduling, setScheduling] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: {
      coachId: '',
      sessionType: 'Online',
      scheduledAt: '',
      durationMinutes: 60,
      price: 50,
      meetingLink: '',
      location: ''
    }
  })

  const sessionType = watch('sessionType')

  const onSubmit = async (data) => {
    if (!user) {
      alert('Please log in to schedule sessions')
      return
    }

    setScheduling(true)
    try {
      // Mock scheduling for now
      console.log('Scheduling session:', data)
      alert('Session scheduled successfully! (Mock)')
      navigate('/student/dashboard')
    } catch (error) {
      alert('Failed to schedule session: ' + error.message)
    } finally {
      setScheduling(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Schedule Training Session</h1>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Coach Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Coach *
              </label>
              <select
                {...register('coachId', { required: 'Please select a coach' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select a coach</option>
                <option value="1">John Smith - Certified Pro</option>
                <option value="2">Sarah Johnson - Advanced Coach</option>
                <option value="3">Mike Davis - Beginner Specialist</option>
              </select>
              {errors.coachId && (
                <p className="mt-1 text-sm text-red-600">{errors.coachId.message}</p>
              )}
            </div>

            {/* Session Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Type *
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="relative flex cursor-pointer rounded-lg border border-gray-300 p-4 focus:outline-none has-checked:border-primary-500 has-checked:ring-2 has-checked:ring-primary-500">
                  <input
                    {...register('sessionType')}
                    type="radio"
                    value="Online"
                    className="sr-only"
                  />
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center">
                      <Video className="w-5 h-5 mr-2 text-blue-600" />
                      <span className="font-medium text-gray-900">Online</span>
                    </div>
                  </div>
                </label>

                <label className="relative flex cursor-pointer rounded-lg border border-gray-300 p-4 focus:outline-none has-checked:border-primary-500 has-checked:ring-2 has-checked:ring-primary-500">
                  <input
                    {...register('sessionType')}
                    type="radio"
                    value="Offline"
                    className="sr-only"
                  />
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center">
                      <MapPin className="w-5 h-5 mr-2 text-green-600" />
                      <span className="font-medium text-gray-900">In-Person</span>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date & Time *
                </label>
                <input
                  {...register('scheduledAt', { required: 'Date and time are required' })}
                  type="datetime-local"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {errors.scheduledAt && (
                  <p className="mt-1 text-sm text-red-600">{errors.scheduledAt.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Duration (minutes) *
                </label>
                <select
                  {...register('durationMinutes', { required: 'Duration is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="30">30 minutes</option>
                  <option value="60">60 minutes</option>
                  <option value="90">90 minutes</option>
                  <option value="120">120 minutes</option>
                </select>
              </div>
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('price', { 
                  required: 'Price is required',
                  min: { value: 0, message: 'Price must be positive' }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="50.00"
              />
              {errors.price && (
                <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>
              )}
            </div>

            {/* Location Details */}
            {sessionType === 'Online' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meeting Link
                </label>
                <input
                  {...register('meetingLink')}
                  type="url"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location *
                </label>
                <input
                  {...register('location', { 
                    required: sessionType === 'Offline' ? 'Location is required for in-person sessions' : false 
                  })}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter court location or address"
                />
                {errors.location && (
                  <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={scheduling}
                className="bg-primary-500 text-white px-6 py-3 rounded-md hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {scheduling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Scheduling...
                  </>
                ) : (
                  'Schedule Session'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default SessionScheduler