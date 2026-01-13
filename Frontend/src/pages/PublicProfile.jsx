import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { userApi, friendsApi, getSharedAssetUrl, getAssetUrl } from '../services/api'
import {
  User, MapPin, Calendar, ArrowLeft, UserPlus, UserCheck, Clock,
  Award, Target, Zap, Heart, Activity, Play, X, Check
} from 'lucide-react'

const PublicProfile = () => {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()

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
        if (response.data?.success) {
          setProfile(response.data.data)
        } else {
          setError(response.data?.message || 'Failed to load profile')
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
    if (profile?.lastName && profile?.firstName) {
      return `${profile.lastName}, ${profile.firstName}`
    }
    return profile?.lastName || profile?.firstName || 'Player'
  }

  const getLocation = () => {
    const parts = [profile?.city, profile?.state, profile?.country].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : null
  }

  // Check if video URL is external (YouTube, TikTok, etc.)
  const isExternalVideoUrl = (url) => {
    if (!url) return false
    const externalPatterns = ['youtube.com', 'youtu.be', 'tiktok.com', 'vimeo.com', 'facebook.com', 'instagram.com']
    return externalPatterns.some(pattern => url.includes(pattern))
  }

  // Convert video URL to embeddable URL
  const getVideoEmbedUrl = (url) => {
    if (!url) return null
    // YouTube
    if (url.includes('youtube.com/watch')) {
      const videoId = new URL(url).searchParams.get('v')
      return `https://www.youtube.com/embed/${videoId}`
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0]
      return `https://www.youtube.com/embed/${videoId}`
    }
    // Vimeo
    if (url.includes('vimeo.com/')) {
      const videoId = url.split('vimeo.com/')[1]?.split('?')[0]
      return `https://player.vimeo.com/video/${videoId}`
    }
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Profile Not Found</h2>
          <p className="text-gray-500 mb-4">{error || 'This user profile could not be found.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative">
              {profile.profileImageUrl ? (
                <img
                  src={getSharedAssetUrl(profile.profileImageUrl)}
                  alt={getFullName()}
                  className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center border-4 border-white shadow-lg">
                  <User className="w-16 h-16 text-white" />
                </div>
              )}
            </div>

            {/* Name and Basic Info */}
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-3xl font-bold text-white">{getFullName()}</h1>

              {getLocation() && (
                <div className="flex items-center justify-center sm:justify-start gap-2 text-white/80 mt-2">
                  <MapPin className="w-4 h-4" />
                  <span>{getLocation()}</span>
                </div>
              )}

              <div className="flex items-center justify-center sm:justify-start gap-2 text-white/70 mt-1 text-sm">
                <Calendar className="w-4 h-4" />
                <span>Member since {formatDate(profile.createdAt)}</span>
              </div>

              {profile.experienceLevel && (
                <span className="inline-block mt-3 px-3 py-1 bg-white/20 text-white rounded-full text-sm font-medium">
                  {profile.experienceLevel}
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex-shrink-0">
              {profile.friendshipStatus === 'self' ? (
                <Link
                  to="/profile"
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
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Bio Section */}
          {profile.bio && (
            <div className="md:col-span-2 bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
              <p className="text-gray-600 whitespace-pre-wrap">{profile.bio}</p>
            </div>
          )}

          {/* Pickleball Info */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Pickleball Info
            </h2>
            <div className="space-y-4">
              {profile.experienceLevel && (
                <div className="flex items-center gap-3">
                  <Award className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Experience Level</p>
                    <p className="font-medium text-gray-900">{profile.experienceLevel}</p>
                  </div>
                </div>
              )}
              {profile.playingStyle && (
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Playing Style</p>
                    <p className="font-medium text-gray-900">{profile.playingStyle}</p>
                  </div>
                </div>
              )}
              {profile.handedness && (
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Handedness</p>
                    <p className="font-medium text-gray-900">{profile.handedness}</p>
                  </div>
                </div>
              )}
              {profile.yearsPlaying && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Years Playing</p>
                    <p className="font-medium text-gray-900">{profile.yearsPlaying} years</p>
                  </div>
                </div>
              )}
              {profile.favoriteShot && (
                <div className="flex items-center gap-3">
                  <Heart className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Favorite Shot</p>
                    <p className="font-medium text-gray-900">{profile.favoriteShot}</p>
                  </div>
                </div>
              )}
              {profile.tournamentLevel && (
                <div className="flex items-center gap-3">
                  <Award className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Tournament Level</p>
                    <p className="font-medium text-gray-900">{profile.tournamentLevel}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Equipment */}
          {(profile.paddleBrand || profile.paddleModel) && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                Equipment
              </h2>
              <div className="space-y-4">
                {profile.paddleBrand && (
                  <div>
                    <p className="text-sm text-gray-500">Paddle Brand</p>
                    <p className="font-medium text-gray-900">{profile.paddleBrand}</p>
                  </div>
                )}
                {profile.paddleModel && (
                  <div>
                    <p className="text-sm text-gray-500">Paddle Model</p>
                    <p className="font-medium text-gray-900">{profile.paddleModel}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Intro Video */}
          {profile.introVideo && (
            <div className="md:col-span-2 bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Play className="w-5 h-5 text-red-600" />
                Intro Video
              </h2>
              <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                {isExternalVideoUrl(profile.introVideo) ? (
                  getVideoEmbedUrl(profile.introVideo) ? (
                    <iframe
                      src={getVideoEmbedUrl(profile.introVideo)}
                      className="w-full h-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <a
                        href={profile.introVideo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-2"
                      >
                        <Play className="w-6 h-6" />
                        Open Video
                      </a>
                    </div>
                  )
                ) : (
                  <video
                    src={getSharedAssetUrl(profile.introVideo)}
                    controls
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PublicProfile
