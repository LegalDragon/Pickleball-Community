import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'
import { userApi, assetApi, sharedUserApi, getAssetUrl, getSharedAssetUrl, SHARED_AUTH_URL } from '../services/api'
import VideoUploadModal from '../components/ui/VideoUploadModal'
import {
  User, Camera, Video, MapPin, Phone, Calendar,
  Edit2, Save, Upload, X, Play, Award, Target,
  Zap, Heart, Activity, TrendingUp, ChevronRight,
  MessageCircle, Shield, Eye
} from 'lucide-react'

const Profile = () => {
  const { user, updateUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef(null)

  // Separate editing states for each section
  const [isEditingBasicInfo, setIsEditingBasicInfo] = useState(false)
  const [isEditingPickleballInfo, setIsEditingPickleballInfo] = useState(false)
  const [savingBasicInfo, setSavingBasicInfo] = useState(false)
  const [savingPickleballInfo, setSavingPickleballInfo] = useState(false)

  // Bio modal state
  const [isBioModalOpen, setIsBioModalOpen] = useState(false)
  const [tempBio, setTempBio] = useState('')
  const [savingBio, setSavingBio] = useState(false)

  // Video modal state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)

  // Messaging settings state
  const [allowDirectMessages, setAllowDirectMessages] = useState(true)
  const [allowClubMessages, setAllowClubMessages] = useState(true)
  const [savingMessagingSettings, setSavingMessagingSettings] = useState(false)

  // Separate forms for each section
  const basicInfoForm = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      gender: '',
      dateOfBirth: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    }
  })

  const pickleballForm = useForm({
    defaultValues: {
      experienceLevel: '',
      playingStyle: '',
      paddleBrand: '',
      paddleModel: '',
      yearsPlaying: '',
      tournamentLevel: '',
      favoriteShot: ''
    }
  })

  // Local state for handedness
  const [handedness, setHandedness] = useState('')

  // Fetch profile data from API on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setProfileLoading(true)
        const response = await userApi.getProfile()
        if (response.success && response.data) {
          // Update auth context with fresh profile data
          updateUser(response.data)
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
      } finally {
        setProfileLoading(false)
      }
    }
    fetchProfile()
  }, [])

  // Load user data into forms
  useEffect(() => {
    if (user) {
      setProfileLoading(false)
      // Format dateOfBirth for input type="date" (YYYY-MM-DD)
      let formattedDob = ''
      if (user.dateOfBirth) {
        const date = new Date(user.dateOfBirth)
        if (!isNaN(date.getTime())) {
          formattedDob = date.toISOString().split('T')[0]
        }
      }

      basicInfoForm.reset({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        gender: user.gender || '',
        dateOfBirth: formattedDob,
        phone: user.phone || '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        zipCode: user.zipCode || '',
        country: user.country || ''
      })

      pickleballForm.reset({
        experienceLevel: user.experienceLevel || '',
        playingStyle: user.playingStyle || '',
        paddleBrand: user.paddleBrand || '',
        paddleModel: user.paddleModel || '',
        yearsPlaying: user.yearsPlaying || '',
        tournamentLevel: user.tournamentLevel || '',
        favoriteShot: user.favoriteShot || ''
      })

      setHandedness(user.handedness || '')
      setTempBio(user.bio || '')

      // Set messaging settings
      setAllowDirectMessages(user.allowDirectMessages !== false) // default true
      setAllowClubMessages(user.allowClubMessages !== false) // default true

      // Set avatar preview from either avatar or profileImageUrl (from Funtime-Shared)
      const avatarUrl = user.avatar || user.profileImageUrl
      if (avatarUrl) {
        setAvatarPreview(getSharedAssetUrl(avatarUrl))
      }
      if (user.introVideo) {
        // Check if it's an external URL or uploaded file
        const externalPatterns = ['youtube.com', 'youtu.be', 'tiktok.com', 'vimeo.com', 'facebook.com', 'instagram.com']
        const isExternal = externalPatterns.some(pattern => user.introVideo.includes(pattern))
        setVideoPreview(isExternal ? user.introVideo : getSharedAssetUrl(user.introVideo))
      }
    }
  }, [user])

  // Handle avatar upload directly (no edit mode needed)
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB')
        return
      }

      // Show preview immediately
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result)
      }
      reader.readAsDataURL(file)

      // Upload to Funtime-Shared service
      setAvatarUploading(true)
      try {
        const response = await sharedUserApi.uploadAvatar(file)
        console.log('Avatar upload response:', response)
        console.log('Avatar upload response type:', typeof response)
        console.log('Avatar upload response keys:', response ? Object.keys(response) : 'null')

        // Handle Funtime-Shared response format
        // Response: { data: { success: true, url: "/asset/11", ... } }
        // Use response.data.url directly - it already contains the relative path
        let assetPath = null

        if (response?.data?.url) {
          assetPath = response.data.url
        } else if (response?.url) {
          assetPath = response.url
        }

        if (assetPath) {
          console.log('New avatar path:', assetPath)
          // Update local user with new avatar path
          updateUser({ ...user, avatar: assetPath, profileImageUrl: assetPath })
          // Display using full URL
          setAvatarPreview(`${SHARED_AUTH_URL}${assetPath}`)

          // Save relative path to local backend
          await userApi.updateProfile({ profileImageUrl: assetPath })
        } else {
          console.error('Could not find asset URL in response:', JSON.stringify(response, null, 2))
          throw new Error('Upload failed - no asset URL returned. Check console for response format.')
        }
      } catch (error) {
        console.error('Avatar upload error:', error)
        alert('Failed to upload avatar: ' + (error.response?.data?.message || error.message || 'Unknown error'))
        // Revert preview on error
        setAvatarPreview(getSharedAssetUrl(user?.avatar || user?.profileImageUrl) || null)
      } finally {
        setAvatarUploading(false)
      }
    }
  }

  // Handle handedness selection
  const handleHandednessChange = async (value) => {
    setHandedness(value)
    try {
      await userApi.updateProfile({ handedness: value })
      updateUser({ ...user, handedness: value })
    } catch (error) {
      console.error('Handedness update error:', error)
      setHandedness(user?.handedness || '')
    }
  }

  // Handle bio save from modal
  const handleBioSave = async () => {
    setSavingBio(true)
    try {
      await userApi.updateProfile({ bio: tempBio })
      updateUser({ ...user, bio: tempBio })
      setIsBioModalOpen(false)
    } catch (error) {
      console.error('Bio update error:', error)
      alert('Failed to update bio')
    } finally {
      setSavingBio(false)
    }
  }

  // Handle video save from modal
  const handleVideoSave = async ({ url, type }) => {
    try {
      // Update user profile with new video URL
      await userApi.updateProfile({ introVideo: url })
      updateUser({ ...user, introVideo: url })

      // Update preview based on type
      if (type === 'url') {
        setVideoPreview(url) // External URL
      } else {
        setVideoPreview(getSharedAssetUrl(url)) // Uploaded file
      }
    } catch (error) {
      console.error('Video save error:', error)
      alert('Failed to save video: ' + (error.message || 'Unknown error'))
    }
  }

  // Check if video URL is external (YouTube, TikTok, etc.)
  const isExternalVideoUrl = (url) => {
    if (!url) return false
    const externalPatterns = ['youtube.com', 'youtu.be', 'tiktok.com', 'vimeo.com', 'facebook.com', 'instagram.com']
    return externalPatterns.some(pattern => url.includes(pattern))
  }

  // Get YouTube embed URL
  const getVideoEmbedUrl = (url) => {
    if (!url) return null
    if (url.includes('youtube.com/watch')) {
      const videoId = new URL(url).searchParams.get('v')
      return `https://www.youtube.com/embed/${videoId}`
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0]
      return `https://www.youtube.com/embed/${videoId}`
    }
    return null
  }

  const removeVideo = async () => {
    const oldVideoUrl = user?.introVideo
    setVideoPreview(null)
    try {
      // Delete video file from server (only if it's a local file, not external URL)
      if (oldVideoUrl && !isExternalVideoUrl(oldVideoUrl)) {
        await assetApi.delete(oldVideoUrl)
      }
      // Update user profile
      await userApi.updateProfile({ introVideo: null })
      updateUser({ ...user, introVideo: null })
    } catch (error) {
      console.error('Error removing video:', error)
    }
  }

  // Handle messaging setting toggle
  const handleMessagingSettingChange = async (setting, value) => {
    setSavingMessagingSettings(true)
    try {
      const updateData = { [setting]: value }
      await userApi.updateProfile(updateData)
      updateUser({ ...user, ...updateData })

      if (setting === 'allowDirectMessages') {
        setAllowDirectMessages(value)
      } else if (setting === 'allowClubMessages') {
        setAllowClubMessages(value)
      }
    } catch (error) {
      console.error('Error updating messaging settings:', error)
      alert('Failed to update setting')
      // Revert the toggle on error
      if (setting === 'allowDirectMessages') {
        setAllowDirectMessages(!value)
      } else if (setting === 'allowClubMessages') {
        setAllowClubMessages(!value)
      }
    } finally {
      setSavingMessagingSettings(false)
    }
  }

  // Save Basic Info
  const handleSaveBasicInfo = async (data) => {
    setSavingBasicInfo(true)
    try {
      // Handle optional dateOfBirth - convert empty string to null
      const profileData = {
        ...data,
        dateOfBirth: data.dateOfBirth || null
      }
      await userApi.updateProfile(profileData)
      updateUser({ ...user, ...profileData })
      setIsEditingBasicInfo(false)
    } catch (error) {
      console.error('Basic info update error:', error)
      alert('Failed to update basic information')
    } finally {
      setSavingBasicInfo(false)
    }
  }

  // Save Pickleball Info
  const handleSavePickleballInfo = async (data) => {
    setSavingPickleballInfo(true)
    try {
      // Handle yearsPlaying - convert empty string to null, string to number
      const profileData = {
        ...data,
        yearsPlaying: data.yearsPlaying ? parseInt(data.yearsPlaying, 10) : null
      }
      await userApi.updateProfile(profileData)
      updateUser({ ...user, ...profileData })
      setIsEditingPickleballInfo(false)
    } catch (error) {
      console.error('Pickleball info update error:', error)
      alert('Failed to update pickleball information')
    } finally {
      setSavingPickleballInfo(false)
    }
  }

  const experienceLevels = [
    'Beginner (0-1 years)',
    'Intermediate (1-3 years)',
    'Advanced (3-5 years)',
    'Competitive (5+ years)',
    'Professional'
  ]

  const playingStyles = [
    'Aggressive/Banger',
    'Defensive/Soft Game',
    'All-rounder',
    'Strategic/Placement',
    'Power Player',
    'Finesse Player'
  ]

  const tournamentLevels = [
    'Recreational',
    'Local/Club',
    'Regional',
    'National',
    'Professional'
  ]

  const favoriteShots = [
    'Third-shot drop',
    'Drive',
    'Dink',
    'Lob',
    'Overhead smash',
    'ATP (Around the post)',
    'Erne',
    'Reset'
  ]

  // Truncate bio for preview
  const getBioPreview = () => {
    const bio = user?.bio || ''
    if (bio.length > 50) {
      return bio.substring(0, 50) + '...'
    }
    return bio || 'No bio added yet...'
  }

  // Show loading state while fetching profile
  if (profileLoading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-t-2xl px-6 py-8">
            <h1 className="text-3xl font-bold text-white">My Profile</h1>
            <p className="text-blue-100 mt-2">Loading your profile...</p>
          </div>
          <div className="bg-white rounded-b-2xl shadow-xl p-12">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-t-2xl px-6 py-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">My Profile</h1>
              <p className="text-blue-100 mt-2">
                Complete your profile to enhance your pickleball experience
              </p>
            </div>
            {user?.id && (
              <Link
                to={`/users/${user.id}`}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <Eye className="w-4 h-4" />
                Preview public profile
              </Link>
            )}
          </div>
          <div className="mt-4 p-3 bg-white/10 rounded-lg">
            <p className="text-white/90 text-sm">
              This is your shared profile across all Funtime Pickleball sites including pickleball.community, pickleball.date, pickleball.college, and more.
              Each site may have additional profile fields specific to its features, but your basic information stays consistent everywhere.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-b-2xl shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6">
            {/* LEFT SIDE - Avatar, Handedness, Bio, Video */}
            <div className="lg:col-span-1 space-y-6">
              {/* Avatar Section with Camera Icon */}
              <div className="text-center">
                <div className="relative inline-block">
                  <div className="w-40 h-40 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-16 h-16 text-gray-400" />
                      </div>
                    )}
                    {avatarUploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                      </div>
                    )}
                  </div>

                  {/* Camera Icon Overlay */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                    className="hidden"
                    id="avatar-upload"
                  />
                  <label
                    htmlFor="avatar-upload"
                    className="absolute bottom-2 right-2 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition shadow-lg"
                  >
                    <Camera className="w-5 h-5 text-white" />
                  </label>
                </div>
                <p className="text-sm text-gray-500 mt-2">Click camera to change photo</p>
              </div>

              {/* Handedness Selection - Just Left/Right */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 text-center">Dominant Hand</h3>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => handleHandednessChange('left')}
                    className={`flex flex-col items-center px-6 py-3 rounded-lg border-2 transition ${
                      handedness === 'left'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400 text-gray-600'
                    }`}
                  >
                    <span className="text-2xl mb-1">L</span>
                    <span className="text-xs font-medium">Left</span>
                  </button>
                  <button
                    onClick={() => handleHandednessChange('right')}
                    className={`flex flex-col items-center px-6 py-3 rounded-lg border-2 transition ${
                      handedness === 'right'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400 text-gray-600'
                    }`}
                  >
                    <span className="text-2xl mb-1">R</span>
                    <span className="text-xs font-medium">Right</span>
                  </button>
                </div>
              </div>

              {/* Bio Preview Block */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">Bio</h3>
                  <span className="text-xs text-gray-500">Optional</span>
                </div>
                <button
                  onClick={() => {
                    setTempBio(user?.bio || '')
                    setIsBioModalOpen(true)
                  }}
                  className="w-full text-left p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition group"
                >
                  <p className="text-sm text-gray-600 group-hover:text-gray-800">
                    {getBioPreview()}
                  </p>
                  <div className="flex items-center justify-end mt-2 text-blue-600 text-xs">
                    <span>Edit bio</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              </div>

              {/* Intro Video Section */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Intro Video</h3>
                  <span className="text-xs text-gray-500">Optional</span>
                </div>

                {videoPreview || user?.introVideo ? (
                  <div className="relative">
                    {/* Check if it's an external URL (YouTube, etc.) */}
                    {isExternalVideoUrl(videoPreview || user?.introVideo) ? (
                      getVideoEmbedUrl(videoPreview || user?.introVideo) ? (
                        <iframe
                          src={getVideoEmbedUrl(videoPreview || user?.introVideo)}
                          className="w-full h-40 rounded-lg"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      ) : (
                        <div className="w-full h-40 rounded-lg bg-gray-200 flex items-center justify-center">
                          <a
                            href={videoPreview || user?.introVideo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center"
                          >
                            <Play className="w-5 h-5 mr-2" />
                            Open Video
                          </a>
                        </div>
                      )
                    ) : (
                      <video
                        src={videoPreview || getSharedAssetUrl(user?.introVideo)}
                        controls
                        className="w-full h-40 rounded-lg object-cover bg-black"
                      />
                    )}
                    <div className="absolute top-2 right-2 flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setIsVideoModalOpen(true)}
                        className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
                        title="Change video"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={removeVideo}
                        className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition"
                        title="Remove video"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsVideoModalOpen(true)}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition"
                  >
                    <Video className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-xs text-gray-500 mb-3">
                      Add a video from YouTube, TikTok, or upload a file
                    </p>
                    <span className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
                      <Upload className="w-4 h-4 mr-2" />
                      Add Video
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT SIDE - Basic Info and Pickleball Info Sections */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information Section */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-b">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <User className="w-5 h-5 mr-2 text-blue-500" />
                    Basic Information
                  </h3>
                  {!isEditingBasicInfo ? (
                    <button
                      onClick={() => setIsEditingBasicInfo(true)}
                      className="flex items-center space-x-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                  ) : (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setIsEditingBasicInfo(false)
                          basicInfoForm.reset()
                        }}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={basicInfoForm.handleSubmit(handleSaveBasicInfo)}
                        disabled={savingBasicInfo}
                        className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        {savingBasicInfo ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Save</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                      <input
                        {...basicInfoForm.register('firstName', { required: 'First name is required' })}
                        type="text"
                        disabled={!isEditingBasicInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                      <input
                        {...basicInfoForm.register('lastName', { required: 'Last name is required' })}
                        type="text"
                        disabled={!isEditingBasicInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        {...basicInfoForm.register('email')}
                        type="email"
                        disabled={!isEditingBasicInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        {...basicInfoForm.register('phone')}
                        type="tel"
                        disabled={!isEditingBasicInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                        placeholder="(123) 456-7890"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                      <select
                        {...basicInfoForm.register('gender')}
                        disabled={!isEditingBasicInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                      >
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer-not-to-say">Prefer not to say</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <input
                        {...basicInfoForm.register('dateOfBirth')}
                        type="date"
                        disabled={!isEditingBasicInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                      <input
                        {...basicInfoForm.register('address')}
                        type="text"
                        disabled={!isEditingBasicInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                        placeholder="123 Main St"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        {...basicInfoForm.register('city')}
                        type="text"
                        disabled={!isEditingBasicInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State/Province</label>
                      <input
                        {...basicInfoForm.register('state')}
                        type="text"
                        disabled={!isEditingBasicInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ZIP/Postal Code</label>
                      <input
                        {...basicInfoForm.register('zipCode')}
                        type="text"
                        disabled={!isEditingBasicInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                      <input
                        {...basicInfoForm.register('country')}
                        type="text"
                        disabled={!isEditingBasicInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Pickleball Information Section */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-b">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-purple-500" />
                    Pickleball Information
                  </h3>
                  {!isEditingPickleballInfo ? (
                    <button
                      onClick={() => setIsEditingPickleballInfo(true)}
                      className="flex items-center space-x-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                  ) : (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setIsEditingPickleballInfo(false)
                          pickleballForm.reset()
                        }}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={pickleballForm.handleSubmit(handleSavePickleballInfo)}
                        disabled={savingPickleballInfo}
                        className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        {savingPickleballInfo ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Save</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Experience Level</label>
                      <select
                        {...pickleballForm.register('experienceLevel')}
                        disabled={!isEditingPickleballInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                      >
                        <option value="">Select your level</option>
                        {experienceLevels.map(level => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Years Playing</label>
                      <input
                        {...pickleballForm.register('yearsPlaying')}
                        type="number"
                        min="0"
                        max="50"
                        disabled={!isEditingPickleballInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                        placeholder="e.g., 3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Playing Style</label>
                      <select
                        {...pickleballForm.register('playingStyle')}
                        disabled={!isEditingPickleballInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                      >
                        <option value="">Select playing style</option>
                        {playingStyles.map(style => (
                          <option key={style} value={style}>{style}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tournament Level</label>
                      <select
                        {...pickleballForm.register('tournamentLevel')}
                        disabled={!isEditingPickleballInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                      >
                        <option value="">Select tournament level</option>
                        {tournamentLevels.map(level => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Favorite Shot</label>
                      <select
                        {...pickleballForm.register('favoriteShot')}
                        disabled={!isEditingPickleballInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                      >
                        <option value="">Select favorite shot</option>
                        {favoriteShots.map(shot => (
                          <option key={shot} value={shot}>{shot}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Paddle Brand</label>
                      <input
                        {...pickleballForm.register('paddleBrand')}
                        type="text"
                        disabled={!isEditingPickleballInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                        placeholder="e.g., Selkirk, Joola, Paddletek"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Paddle Model</label>
                      <input
                        {...pickleballForm.register('paddleModel')}
                        type="text"
                        disabled={!isEditingPickleballInfo}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-600"
                        placeholder="e.g., Vanguard Power Air"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Privacy & Messaging Settings Section */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-green-500" />
                    Privacy & Messaging
                  </h3>
                </div>

                <div className="p-6 space-y-4">
                  {/* Allow Direct Messages */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-blue-500" />
                        <span className="font-medium text-gray-900">Direct Messages from Friends</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1 ml-7">
                        Allow your friends to send you direct messages
                      </p>
                    </div>
                    <button
                      onClick={() => handleMessagingSettingChange('allowDirectMessages', !allowDirectMessages)}
                      disabled={savingMessagingSettings}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                        allowDirectMessages ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          allowDirectMessages ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Allow Club Messages */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-purple-500" />
                        <span className="font-medium text-gray-900">Club Chat Auto-Join</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1 ml-7">
                        Automatically join club chat when you join a club
                      </p>
                    </div>
                    <button
                      onClick={() => handleMessagingSettingChange('allowClubMessages', !allowClubMessages)}
                      disabled={savingMessagingSettings}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                        allowClubMessages ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          allowClubMessages ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {savingMessagingSettings && (
                    <div className="flex items-center justify-center text-sm text-gray-500 pt-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Saving...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bio Edit Modal */}
      {isBioModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setIsBioModalOpen(false)}
            ></div>

            <div className="relative inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Heart className="w-5 h-5 mr-2 text-purple-500" />
                    Edit Bio
                  </h3>
                  <button
                    onClick={() => setIsBioModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <textarea
                  value={tempBio}
                  onChange={(e) => setTempBio(e.target.value)}
                  rows="6"
                  maxLength={1000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Tell us about yourself, your pickleball journey, and what you're looking for..."
                />
                <p className="text-xs text-gray-500 mt-2 text-right">
                  {tempBio.length}/1000 characters
                </p>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <button
                  onClick={handleBioSave}
                  disabled={savingBio}
                  className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {savingBio ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Bio
                    </>
                  )}
                </button>
                <button
                  onClick={() => setIsBioModalOpen(false)}
                  className="mt-3 sm:mt-0 w-full sm:w-auto inline-flex justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Upload Modal */}
      <VideoUploadModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        onSave={handleVideoSave}
        currentVideo={user?.introVideo}
        objectType="UserIntro"
        objectId={user?.id}
        title="Add Intro Video"
        maxSizeMB={100}
      />
    </div>
  )
}

export default Profile
