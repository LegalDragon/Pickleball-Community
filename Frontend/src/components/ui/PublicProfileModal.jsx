import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { userApi, friendsApi, messagingApi, getSharedAssetUrl, getAssetUrl } from '../../services/api'
import {
  User, MapPin, Calendar, UserPlus, UserCheck, Clock,
  Award, Target, Zap, Heart, Activity, Play, X, Check, MessageCircle,
  Twitter, Instagram, Facebook, Linkedin, Youtube, Globe, Link as LinkIcon, ExternalLink,
  KeyRound, Mail, Phone, BadgeCheck
} from 'lucide-react'
import AdminEditCredentialsModal from './AdminEditCredentialsModal'

export default function PublicProfileModal({ userId, onClose, onFriendshipChange }) {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [startingChat, setStartingChat] = useState(false)
  const [showAdminModal, setShowAdminModal] = useState(false)

  // Check if current user has SU role on shared auth (required for editing credentials)
  const hasSharedAdminRole = currentUser?.systemRole?.toLowerCase() === 'su'

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

  const handleStartChat = async () => {
    try {
      setStartingChat(true)
      const response = await messagingApi.createDirectConversation(profile.id)
      const conversationId = response?.data?.id || response?.id
      if (conversationId) {
        onClose()
        navigate(`/messages?conversation=${conversationId}`)
      }
    } catch (err) {
      console.error('Error starting chat:', err)
    } finally {
      setStartingChat(false)
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

  // Get icon for social platform
  const getSocialIcon = (platform) => {
    const iconClass = "w-4 h-4"
    switch (platform?.toLowerCase()) {
      case 'twitter':
        return <Twitter className={iconClass} />
      case 'instagram':
        return <Instagram className={iconClass} />
      case 'facebook':
        return <Facebook className={iconClass} />
      case 'linkedin':
        return <Linkedin className={iconClass} />
      case 'youtube':
        return <Youtube className={iconClass} />
      case 'tiktok':
        return <span className={iconClass}>TT</span>
      case 'twitch':
        return <span className={iconClass}>TV</span>
      case 'discord':
        return <span className={iconClass}>DC</span>
      case 'website':
        return <Globe className={iconClass} />
      default:
        return <LinkIcon className={iconClass} />
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1100] overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
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
            {/* Header - Fixed */}
            <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-purple-700 rounded-t-xl p-6 relative">
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
                      <span>Member since {formatDate(profile.createdAt)} ({profile.id})</span>
                    </div>
                  )}

                  {/* Email (shown if user enabled or viewer is admin/self) */}
                  {profile.email && (
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-white mt-2 text-sm">
                      <Mail className="w-4 h-4" />
                      <a href={`mailto:${profile.email}`} className="text-white font-medium hover:underline">{profile.email}</a>
                      {profile.emailVerified && (
                        <BadgeCheck className="w-4 h-4 text-green-300" title="Verified email" />
                      )}
                    </div>
                  )}

                  {/* Phone (shown if user enabled or viewer is admin/self) */}
                  {profile.phone && (
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-white mt-1 text-sm">
                      <Phone className="w-4 h-4" />
                      <a href={`tel:${profile.phone}`} className="text-white font-medium hover:underline">{profile.phone}</a>
                      {profile.phoneVerified && (
                        <BadgeCheck className="w-4 h-4 text-green-300" title="Verified phone" />
                      )}
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
              <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
                {profile.friendshipStatus === 'self' ? (
                  <Link
                    to="/profile"
                    onClick={onClose}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                  >
                    Edit Profile
                  </Link>
                ) : profile.friendshipStatus === 'friends' ? (
                  <>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-medium">
                      <UserCheck className="w-5 h-5" />
                      Friends
                    </div>
                    <button
                      onClick={handleStartChat}
                      disabled={startingChat}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      <MessageCircle className="w-5 h-5" />
                      {startingChat ? 'Starting...' : 'Message'}
                    </button>
                  </>
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
                  <>
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
                  </>
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

                {/* Admin Edit Credentials Button - requires SU role on shared auth */}
                {hasSharedAdminRole && profile.friendshipStatus !== 'self' && (
                  <button
                    onClick={() => setShowAdminModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                  >
                    <KeyRound className="w-5 h-5" />
                    Edit Credentials
                  </button>
                )}
              </div>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
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

              {/* Social Links */}
              {profile.socialLinks && profile.socialLinks.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-blue-600" />
                    Social Links
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {profile.socialLinks.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-gray-700 text-sm"
                        title={link.displayName || link.platform}
                      >
                        <span className="text-gray-600">{getSocialIcon(link.platform)}</span>
                        <span className="font-medium">
                          {link.displayName || link.platform}
                        </span>
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Intro Video */}
              {profile.introVideo && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
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
          </>
        )}
      </div>

      {/* Admin Edit Credentials Modal */}
      {profile && (
        <AdminEditCredentialsModal
          isOpen={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          userId={profile.id}
          currentEmail={profile.email}
          userName={`${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'User'}
        />
      )}
    </div>
  )
}
