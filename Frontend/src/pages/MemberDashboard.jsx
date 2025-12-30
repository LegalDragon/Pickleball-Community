import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Award, User, Settings, Loader2, Users
} from 'lucide-react'
import { userApi, getAssetUrl } from '../services/api'

const MemberDashboard = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setLoading(true)
    try {
      const response = await userApi.getProfile()
      setProfile(response.data || response)
    } catch (error) {
      console.error('Failed to load profile:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">Welcome back, {user?.firstName || 'Member'}!</p>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex items-center gap-6">
            {profile?.profileImageUrl ? (
              <img
                src={getAssetUrl(profile.profileImageUrl)}
                alt={`${profile.firstName} ${profile.lastName}`}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center">
                <User className="w-10 h-10 text-primary-600" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {profile?.firstName} {profile?.lastName}
              </h2>
              <p className="text-gray-600">{profile?.email}</p>
              {profile?.experienceLevel && (
                <p className="text-sm text-gray-500 mt-1">
                  Experience: {profile.experienceLevel}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* My Certificate */}
          <Link
            to="/my-certificate"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <Award className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">My Certificate</h3>
                <p className="text-sm text-gray-600">View your skill ratings from peer reviews</p>
              </div>
            </div>
          </Link>

          {/* Friends */}
          <Link
            to="/friends"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Friends</h3>
                <p className="text-sm text-gray-600">Connect with other pickleball players</p>
              </div>
            </div>
          </Link>

          {/* Edit Profile */}
          <Link
            to="/profile"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Settings className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Edit Profile</h3>
                <p className="text-sm text-gray-600">Update your information and preferences</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Player Info */}
        {(profile?.playingStyle || profile?.paddleBrand || profile?.yearsPlaying) && (
          <div className="bg-white rounded-lg shadow mt-6 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Player Info</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {profile?.playingStyle && (
                <div>
                  <p className="text-xs text-gray-500">Playing Style</p>
                  <p className="font-medium text-gray-900">{profile.playingStyle}</p>
                </div>
              )}
              {profile?.paddleBrand && (
                <div>
                  <p className="text-xs text-gray-500">Paddle</p>
                  <p className="font-medium text-gray-900">
                    {profile.paddleBrand} {profile.paddleModel && `- ${profile.paddleModel}`}
                  </p>
                </div>
              )}
              {profile?.yearsPlaying && (
                <div>
                  <p className="text-xs text-gray-500">Years Playing</p>
                  <p className="font-medium text-gray-900">{profile.yearsPlaying}</p>
                </div>
              )}
              {profile?.handedness && (
                <div>
                  <p className="text-xs text-gray-500">Handedness</p>
                  <p className="font-medium text-gray-900">{profile.handedness}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MemberDashboard
