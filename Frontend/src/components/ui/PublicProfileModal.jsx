import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { userApi, friendsApi, getSharedAssetUrl, getAssetUrl } from '../../services/api'
import {
  User, MapPin, Calendar, UserPlus, UserCheck, Clock,
  Award, Target, Zap, Heart, Activity, Play, X, Check
} from 'lucide-react'

export default function PublicProfileModal({ userId, onClose, onFriendshipChange }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await userApi.getPublicProfile(userId)
        if (response.success) {
          setProfile(response.data)
        } else if (response.data?.success) {
          setProfile(response.data.data)
        } else {
          setError(response.message || 'Failed to load profile')
        }
      } catch (err) {
        console.error('Error fetching public profile:', err)
        setError('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchProfile()
    }
  }, [userId])

  const handleSendFriendRequest = async () => {
    try {
      setActionLoading(true)
      await friendsApi.sendRequest(profile.id)
      setProfile(prev => ({ ...prev, friendshipStatus: 'pending_sent' }))
      onFriendshipChange?.()
    } catch (err) {
      console.error('Error sending friend request:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelRequest = async () => {
    try {
      setActionLoading(true)
      await friendsApi.cancelRequest(profile.friendRequestId)
      setProfile(prev => ({ ...prev, friendshipStatus: 'none', friendRequestId: null }))
      onFriendshipChange?.()
    } catch (err) {
      console.error('Error cancelling request:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleAcceptRequest = async () => {
    try {
      setActionLoading(true)
      await friendsApi.acceptRequest(profile.friendRequestId)
      setProfile(prev => ({ ...prev, friendshipStatus: 'friends', friendRequestId: null }))
      onFriendshipChange?.()
    } catch (err) {
      console.error('Error accepting request:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectRequest = async () => {
    try {
      setActionLoading(true)
      await friendsApi.rejectRequest(profile.friendRequestId)
      setProfile(prev => ({ ...prev, friendshipStatus: 'none', friendRequestId: null }))
      onFriendshipChange?.()
    } catch (err) {
      console.error('Error rejecting request:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    })
  }

  const getFullName = () => {
    if (profile?.firstName && profile?.lastName) {
      return `${profile.firstName} ${profile.lastName}`
    }
    return profile?.firstName || 'Player'
  }

  const getLocation = () => {
    const parts = [profile?.city, profile?.state, profile?.country].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : null
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : error || !profile ? (
          <div className="p-8 text-center">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Profile Not Found</h2>
            <p className="text-gray-500 mb-4">{error || 'This user profile could not be found.'}</p>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-700 rounded-t-xl p-6 relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                {/* Avatar */}
                <div className="relative">
                  {profile.profileImageUrl ? (
                    <img
                      src={getSharedAssetUrl(profile.profileImageUrl)}
                      alt={getFullName()}
                      className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center border-4 border-white shadow-lg">
                      <User className="w-12 h-12 text-white" />
                    </div>
                  )}
                </div>

                {/* Name and Basic Info */}
                <div className="text-center sm:text-left flex-1">
                  <h1 className="text-2xl font-bold text-white">{getFullName()}</h1>

                  {getLocation() && (
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-white/80 mt-1">
                      <MapPin className="w-4 h-4" />
                      <span>{getLocation()}</span>
                    </div>
                  )}

                  {profile.createdAt && (
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-white/70 mt-1 text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>Member since {formatDate(profile.createdAt)}</span>
                    </div>
                  )}

                  {profile.experienceLevel && (
                    <span className="inline-block mt-2 px-3 py-1 bg-white/20 text-white rounded-full text-sm font-medium">
                      {profile.experienceLevel}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex justify-center sm:justify-start">
                {profile.friendshipStatus === 'self' ? (
                  <Link
                    to="/profile"
                    onClick={onClose}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                  >
                    Edit Profile
                  </Link>
                ) : profile.friendshipStatus === 'friends' ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-medium">
                    <UserCheck className="w-5 h-5" />
                    Friends
                  </div>
                ) : profile.friendshipStatus === 'pending_sent' ? (
                  <button
                    onClick={handleCancelRequest}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-colors disabled:opacity-50"
                  >
                    <Clock className="w-5 h-5" />
                    Request Sent
                  </button>
                ) : profile.friendshipStatus === 'pending_received' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleAcceptRequest}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-5 h-5" />
                      Accept
                    </button>
                    <button
                      onClick={handleRejectRequest}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-colors disabled:opacity-50"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleSendFriendRequest}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    <UserPlus className="w-5 h-5" />
                    Add Friend
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Bio Section */}
              {profile.bio && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">About</h2>
                  <p className="text-gray-600 whitespace-pre-wrap">{profile.bio}</p>
                </div>
              )}

              <div className="grid gap-6 sm:grid-cols-2">
                {/* Pickleball Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    Pickleball Info
                  </h2>
                  <div className="space-y-3 text-sm">
                    {profile.experienceLevel && (
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-500">Level:</span>
                        <span className="font-medium text-gray-900">{profile.experienceLevel}</span>
                      </div>
                    )}
                    {profile.playingStyle && (
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-500">Style:</span>
                        <span className="font-medium text-gray-900">{profile.playingStyle}</span>
                      </div>
                    )}
                    {profile.handedness && (
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-500">Hand:</span>
                        <span className="font-medium text-gray-900">{profile.handedness}</span>
                      </div>
                    )}
                    {profile.yearsPlaying && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-500">Years:</span>
                        <span className="font-medium text-gray-900">{profile.yearsPlaying}</span>
                      </div>
                    )}
                    {profile.favoriteShot && (
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-500">Fav Shot:</span>
                        <span className="font-medium text-gray-900">{profile.favoriteShot}</span>
                      </div>
                    )}
                    {!profile.experienceLevel && !profile.playingStyle && !profile.handedness && !profile.yearsPlaying && !profile.favoriteShot && (
                      <p className="text-gray-400 italic">No info available</p>
                    )}
                  </div>
                </div>

                {/* Equipment */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-600" />
                    Equipment
                  </h2>
                  <div className="space-y-3 text-sm">
                    {profile.paddleBrand && (
                      <div>
                        <span className="text-gray-500">Paddle Brand:</span>
                        <span className="ml-2 font-medium text-gray-900">{profile.paddleBrand}</span>
                      </div>
                    )}
                    {profile.paddleModel && (
                      <div>
                        <span className="text-gray-500">Paddle Model:</span>
                        <span className="ml-2 font-medium text-gray-900">{profile.paddleModel}</span>
                      </div>
                    )}
                    {!profile.paddleBrand && !profile.paddleModel && (
                      <p className="text-gray-400 italic">No equipment info</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Intro Video */}
              {profile.introVideo && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Play className="w-5 h-5 text-red-600" />
                    Intro Video
                  </h2>
                  <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                    <video
                      src={getAssetUrl(profile.introVideo)}
                      controls
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
