import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { userApi, themeApi, notificationTemplateApi, getAssetUrl, sharedAssetApi, getSharedAssetUrl, SHARED_AUTH_URL, notificationsApi, API_BASE_URL, pushApi } from '../services/api'
import {
  Users, BookOpen, Calendar, DollarSign, Search, Edit2, Trash2,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Filter, MoreVertical, Eye, X,
  Shield, GraduationCap, User, CheckCircle, XCircle, Save,
  Palette, Upload, RefreshCw, Image, Layers, Check, Award, Tags, UserCog, Video,
  Building2, HelpCircle, MessageSquare, MapPin, Network, Plus, Play, ArrowUp, ArrowDown,
  Bell, Send, Megaphone, Mail, RotateCcw, ToggleLeft, ToggleRight, Copy, AlertCircle, AlertTriangle, Settings, LifeBuoy, FileText
} from 'lucide-react'
import VideoUploadModal from '../components/ui/VideoUploadModal'
import PublicProfileModal from '../components/ui/PublicProfileModal'
import OnlineStatusDot from '../components/ui/OnlineStatusDot'

// Import admin components for inline rendering
import BlogAdmin from './BlogAdmin'
import FaqAdmin from './FaqAdmin'
import FeedbackAdmin from './FeedbackAdmin'
import CertificationAdmin from './CertificationAdmin'
import EventTypesAdmin from './EventTypesAdmin'
import VenueTypesAdmin from './VenueTypesAdmin'
import ClubMemberRolesAdmin from './ClubMemberRolesAdmin'
import TeamUnitsAdmin from './TeamUnitsAdmin'
import SkillLevelsAdmin from './SkillLevelsAdmin'
import LeagueAdmin from './LeagueAdmin'
import LeagueRolesAdmin from './LeagueRolesAdmin'
import ReleaseNotesAdmin from './ReleaseNotesAdmin'
import GameFormatsAdmin from './GameFormatsAdmin'
import ScoreMethodsAdmin from './ScoreMethodsAdmin'
import HelpTopicsAdmin from './HelpTopicsAdmin'
import ObjectAssetTypesAdmin from './ObjectAssetTypesAdmin'
import EventsAdmin from './EventsAdmin'
import StaffRolesAdmin from './StaffRolesAdmin'
import PhaseTemplatesAdmin from './PhaseTemplatesAdmin'

const AdminDashboard = () => {
  const { user } = useAuth()
  const { theme: currentTheme, refreshTheme } = useTheme()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('users')
  const [loading, setLoading] = useState(false)

  // Users state
  const [users, setUsers] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [savingUser, setSavingUser] = useState(false)
  const [usersError, setUsersError] = useState(null)
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(null)
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false)
  const [resyncingUserId, setResyncingUserId] = useState(null)
  const [editingEmail, setEditingEmail] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [editingPassword, setEditingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [sendingTestEmail, setSendingTestEmail] = useState(false)
  const [userOnlineFilter, setUserOnlineFilter] = useState('all') // 'all' | 'online' | 'offline'
  // Delete user state
  const [deleteUserModal, setDeleteUserModal] = useState({ open: false, user: null })
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingUser, setDeletingUser] = useState(false)
  const [pushModalOpen, setPushModalOpen] = useState(false)
  const [pushTargetUsers, setPushTargetUsers] = useState([]) // user IDs for push
  const [pushTargetMode, setPushTargetMode] = useState('selected') // 'selected' | 'online'
  const [pushTitle, setPushTitle] = useState('')
  const [pushBody, setPushBody] = useState('')
  const [pushUrl, setPushUrl] = useState('')
  const [pushIcon, setPushIcon] = useState('')
  const [sendingPush, setSendingPush] = useState(false)
  const [pushResult, setPushResult] = useState(null)
  const [editingPhone, setEditingPhone] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)
  const [sendingTestSms, setSendingTestSms] = useState(false)

  // Theme state
  const [themeSettings, setThemeSettings] = useState(null)
  const [themePresets, setThemePresets] = useState([])
  const [loadingPresets, setLoadingPresets] = useState(false)
  const [savingTheme, setSavingTheme] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false)
  const [isHeroVideoModalOpen, setIsHeroVideoModalOpen] = useState(false)
  const logoInputRef = useRef(null)
  const faviconInputRef = useRef(null)
  const heroImageInputRef = useRef(null)

  // Hero Videos state (multiple videos)
  const [heroVideos, setHeroVideos] = useState([])
  const [loadingHeroVideos, setLoadingHeroVideos] = useState(false)
  const [isAddVideoModalOpen, setIsAddVideoModalOpen] = useState(false)
  const [editingVideo, setEditingVideo] = useState(null)

  // Notification testing state
  const [notifTestUserId, setNotifTestUserId] = useState('')
  const [notifTestTitle, setNotifTestTitle] = useState('Test Notification')
  const [notifTestMessage, setNotifTestMessage] = useState('This is a test notification from the admin dashboard.')
  const [notifTestType, setNotifTestType] = useState('System')
  const [notifGroupType, setNotifGroupType] = useState('user') // user, game, event, club, broadcast
  const [notifGroupId, setNotifGroupId] = useState('')
  const [sendingNotification, setSendingNotification] = useState(false)
  const [notifTestResult, setNotifTestResult] = useState(null)

  // Notification Templates state
  const [templates, setTemplates] = useState([])
  const [templateCategories, setTemplateCategories] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('all')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [previewContent, setPreviewContent] = useState({ subject: '', body: '' })
  const [isNewTemplate, setIsNewTemplate] = useState(false)

  // API Key test state
  const [apiKeyTestResult, setApiKeyTestResult] = useState(null)
  const [testingApiKey, setTestingApiKey] = useState(false)
  const [apiKeyTestError, setApiKeyTestError] = useState(null)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Collapsed groups state (all expanded by default)
  const [collapsedGroups, setCollapsedGroups] = useState({})

  const toggleGroup = (groupTitle) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupTitle]: !prev[groupTitle]
    }))
  }

  // Extract YouTube video ID and get thumbnail URL
  const getYouTubeThumbnail = (url) => {
    if (!url) return null
    // Match youtube.com/watch?v=VIDEO_ID or youtu.be/VIDEO_ID
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ]
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) {
        return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`
      }
    }
    return null
  }

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers()
    } else if (activeTab === 'theme') {
      fetchTheme()
    } else if (activeTab === 'notifications') {
      fetchTemplates()
    }
  }, [activeTab])

  const fetchUsers = async () => {
    setLoading(true)
    setUsersError(null)
    try {
      const response = await userApi.getAllUsers()
      console.log('fetchUsers response:', response)
      // Handle both camelCase and PascalCase property names
      const success = response?.success ?? response?.Success
      const data = response?.data ?? response?.Data
      const message = response?.message ?? response?.Message

      if (success && data) {
        setUsers(data)
      } else if (success === false) {
        setUsersError(message || 'Failed to load users')
      } else if (Array.isArray(response)) {
        // Handle case where API returns array directly
        setUsers(response)
      } else {
        console.error('Unexpected response format:', response)
        setUsersError('Unexpected response format from server')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      const errorMessage = typeof error === 'string' ? error :
        error?.message || 'Failed to fetch users. Please check your permissions.'
      setUsersError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Fetch theme settings
  const fetchTheme = async () => {
    setLoading(true)
    try {
      const response = await themeApi.getCurrent()
      if (response.success && response.data) {
        setThemeSettings(response.data)
      } else if (response && !response.success) {
        // If no theme exists, use defaults
        setThemeSettings(getDefaultTheme())
      }
    } catch (error) {
      console.error('Error fetching theme:', error)
      setThemeSettings(getDefaultTheme())
    } finally {
      setLoading(false)
    }

    // Also fetch presets and hero videos
    fetchThemePresets()
    fetchHeroVideos()
  }

  // Fetch theme presets
  const fetchThemePresets = async () => {
    setLoadingPresets(true)
    try {
      const response = await themeApi.getPresets()
      if (response.success && response.data) {
        setThemePresets(response.data)
      } else if (Array.isArray(response)) {
        setThemePresets(response)
      }
    } catch (error) {
      console.error('Error fetching theme presets:', error)
      setThemePresets([])
    } finally {
      setLoadingPresets(false)
    }
  }

  // Fetch hero videos
  const fetchHeroVideos = async () => {
    setLoadingHeroVideos(true)
    try {
      const response = await themeApi.getHeroVideos()
      if (response.success && response.data) {
        setHeroVideos(response.data)
      } else if (Array.isArray(response)) {
        setHeroVideos(response)
      }
    } catch (error) {
      console.error('Error fetching hero videos:', error)
      setHeroVideos([])
    } finally {
      setLoadingHeroVideos(false)
    }
  }

  // Apply preset to theme settings
  const handleApplyPreset = (preset) => {
    setThemeSettings(prev => ({
      ...prev,
      primaryColor: preset.primaryColor,
      primaryDarkColor: preset.primaryDarkColor,
      primaryLightColor: preset.primaryLightColor,
      accentColor: preset.accentColor,
      accentDarkColor: preset.accentDarkColor,
      accentLightColor: preset.accentLightColor
    }))
  }

  // Default theme values
  const getDefaultTheme = () => ({
    organizationName: 'Pickleball Community',
    primaryColor: '#047857',
    primaryDarkColor: '#065f46',
    primaryLightColor: '#d1fae5',
    accentColor: '#f59e0b',
    accentDarkColor: '#d97706',
    accentLightColor: '#fef3c7',
    successColor: '#10b981',
    errorColor: '#ef4444',
    warningColor: '#f59e0b',
    infoColor: '#3b82f6',
    textPrimaryColor: '#111827',
    textSecondaryColor: '#6b7280',
    backgroundColor: '#ffffff',
    backgroundSecondaryColor: '#f3f4f6',
    fontFamily: 'Inter, system-ui, sans-serif',
    logoUrl: '',
    faviconUrl: ''
  })

  // Handle theme field change
  const handleThemeChange = (field, value) => {
    setThemeSettings(prev => ({ ...prev, [field]: value }))
  }

  // Save theme settings
  const handleSaveTheme = async () => {
    setSavingTheme(true)
    try {
      const response = await themeApi.update(themeSettings)
      if (response.success) {
        await refreshTheme()
        alert('Theme saved successfully!')
      } else {
        throw new Error(response.message || 'Failed to save theme')
      }
    } catch (error) {
      console.error('Error saving theme:', error)
      alert('Failed to save theme: ' + (error.message || 'Unknown error'))
    } finally {
      setSavingTheme(false)
    }
  }

  // Helper to get relative asset path from response (for saving to DB)
  // Response: { data: { success: true, url: "/asset/11", ... } }
  // Use response.data.url directly - it already contains the relative path
  const getAssetPathFromResponse = (response) => {
    if (response?.data?.url) {
      return response.data.url
    }
    if (response?.url) {
      return response.url
    }
    return null
  }

  // Handle logo upload
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    try {
      // Upload to Funtime-Shared asset service
      const response = await sharedAssetApi.uploadViaProxy(file, 'image', 'theme')
      // Save only relative path to DB
      const logoUrl = getAssetPathFromResponse(response)
      if (logoUrl) {
        setThemeSettings(prev => ({ ...prev, logoUrl }))
        await themeApi.update({ ...themeSettings, logoUrl })
        await refreshTheme()
      } else {
        throw new Error('Failed to get asset path')
      }
    } catch (error) {
      console.error('Error uploading logo:', error)
      alert('Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  // Handle favicon upload
  const handleFaviconUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingFavicon(true)
    try {
      // Upload to Funtime-Shared asset service
      const response = await sharedAssetApi.uploadViaProxy(file, 'image', 'theme')
      // Save only relative path to DB
      const faviconUrl = getAssetPathFromResponse(response)
      if (faviconUrl) {
        setThemeSettings(prev => ({ ...prev, faviconUrl }))
        await themeApi.update({ ...themeSettings, faviconUrl })
        await refreshTheme()
      } else {
        throw new Error('Failed to get asset path')
      }
    } catch (error) {
      console.error('Error uploading favicon:', error)
      alert('Failed to upload favicon')
    } finally {
      setUploadingFavicon(false)
    }
  }

  // Fetch notification templates
  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const [templatesResponse, categoriesResponse] = await Promise.all([
        notificationTemplateApi.getTemplates(),
        notificationTemplateApi.getCategories()
      ])

      if (templatesResponse.success && templatesResponse.data) {
        setTemplates(templatesResponse.data)
      }
      if (categoriesResponse.success && categoriesResponse.data) {
        setTemplateCategories(categoriesResponse.data)
      }
    } catch (error) {
      console.error('Error fetching notification templates:', error)
    } finally {
      setLoading(false)
    }
  }

  // Test API key connection to Funtime-Shared
  // Uses only the API key from backend appsettings, no JWT auth required
  const testApiKey = async () => {
    setTestingApiKey(true)
    setApiKeyTestError(null)
    setApiKeyTestResult(null)
    try {
      const response = await fetch(`${API_BASE_URL}/auth/test-apikey`)
      const data = await response.json()
      if (response.ok) {
        setApiKeyTestResult(data)
      } else {
        setApiKeyTestError(data.message || data.details || 'API key test failed')
      }
    } catch (error) {
      console.error('Error testing API key:', error)
      setApiKeyTestError(error.message || 'Failed to test API key')
    } finally {
      setTestingApiKey(false)
    }
  }

  // Handle edit template
  const handleEditTemplate = (template) => {
    setSelectedTemplate({ ...template })
    setIsNewTemplate(false)
    setIsTemplateModalOpen(true)
  }

  // Handle new template
  const handleNewTemplate = () => {
    setSelectedTemplate({
      templateKey: '',
      name: '',
      description: '',
      category: 'General',
      subject: '',
      body: '',
      placeholders: [],
      isActive: true
    })
    setIsNewTemplate(true)
    setIsTemplateModalOpen(true)
  }

  // Handle save template
  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return
    setSavingTemplate(true)
    try {
      let response
      if (isNewTemplate) {
        response = await notificationTemplateApi.createTemplate(selectedTemplate)
      } else {
        response = await notificationTemplateApi.updateTemplate(selectedTemplate.id, selectedTemplate)
      }

      if (response.success) {
        await fetchTemplates()
        setIsTemplateModalOpen(false)
        setSelectedTemplate(null)
        alert(isNewTemplate ? 'Template created successfully!' : 'Template updated successfully!')
      } else {
        throw new Error(response.message || 'Failed to save template')
      }
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template: ' + (error.message || 'Unknown error'))
    } finally {
      setSavingTemplate(false)
    }
  }

  // Handle toggle template active
  const handleToggleTemplateActive = async (template) => {
    try {
      const response = await notificationTemplateApi.toggleActive(template.id)
      if (response.success) {
        await fetchTemplates()
      }
    } catch (error) {
      console.error('Error toggling template:', error)
      alert('Failed to toggle template status')
    }
  }

  // Handle reset template
  const handleResetTemplate = async (template) => {
    if (!template.isSystem) {
      alert('Only system templates can be reset to defaults')
      return
    }
    if (!confirm('Are you sure you want to reset this template to its default content?')) {
      return
    }
    try {
      const response = await notificationTemplateApi.resetTemplate(template.id)
      if (response.success) {
        await fetchTemplates()
        alert('Template reset to default!')
      }
    } catch (error) {
      console.error('Error resetting template:', error)
      alert('Failed to reset template')
    }
  }

  // Handle delete template
  const handleDeleteTemplate = async (template) => {
    if (template.isSystem) {
      alert('System templates cannot be deleted')
      return
    }
    if (!confirm('Are you sure you want to delete this template?')) {
      return
    }
    try {
      const response = await notificationTemplateApi.deleteTemplate(template.id)
      if (response.success) {
        await fetchTemplates()
        alert('Template deleted!')
      }
    } catch (error) {
      console.error('Error deleting template:', error)
      alert('Failed to delete template')
    }
  }

  // Handle preview template
  const handlePreviewTemplate = async () => {
    if (!selectedTemplate) return
    try {
      // Create sample data from placeholders
      const sampleData = {}
      selectedTemplate.placeholders?.forEach(p => {
        sampleData[p] = `[${p}]`
      })
      // Add common sample values
      sampleData['OrganizationName'] = 'Pickleball College'
      sampleData['FirstName'] = 'John'
      sampleData['LastName'] = 'Doe'
      sampleData['Email'] = 'john.doe@example.com'

      const response = await notificationTemplateApi.previewTemplate(
        selectedTemplate.subject,
        selectedTemplate.body,
        sampleData
      )

      if (response.success && response.data) {
        setPreviewContent({
          subject: response.data.renderedSubject,
          body: response.data.renderedBody
        })
        setIsPreviewModalOpen(true)
      }
    } catch (error) {
      console.error('Error previewing template:', error)
      alert('Failed to preview template')
    }
  }

  // Handle placeholder input
  const handlePlaceholderChange = (value) => {
    const placeholders = value.split(',').map(p => p.trim()).filter(p => p)
    setSelectedTemplate(prev => ({ ...prev, placeholders }))
  }

  // Handle hero video save from modal (supports both URL and file upload)
  const handleHeroVideoSave = async ({ url, type }) => {
    try {
      // url is either an external URL or a relative asset path from file upload
      const heroVideoUrl = url
      setThemeSettings(prev => ({ ...prev, heroVideoUrl }))
      await themeApi.update({ ...themeSettings, heroVideoUrl })
      await refreshTheme()
    } catch (error) {
      console.error('Error saving hero video:', error)
      alert('Failed to save hero video')
    }
  }

  // Handle hero image upload
  const handleHeroImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingHeroImage(true)
    try {
      // Upload to Funtime-Shared asset service
      const response = await sharedAssetApi.uploadViaProxy(file, 'image', 'theme')
      // Save only relative path to DB
      const heroImageUrl = getAssetPathFromResponse(response)
      if (heroImageUrl) {
        setThemeSettings(prev => ({ ...prev, heroImageUrl }))
        await themeApi.update({ ...themeSettings, heroImageUrl })
        await refreshTheme()
      } else {
        throw new Error('Failed to get asset path')
      }
    } catch (error) {
      console.error('Error uploading hero image:', error)
      alert('Failed to upload hero image')
    } finally {
      setUploadingHeroImage(false)
    }
  }

  // Delete hero video
  const handleDeleteHeroVideo = async () => {
    if (!confirm('Are you sure you want to delete the hero video?')) return
    try {
      // Update theme settings to remove video URL
      const updatedSettings = { ...themeSettings, heroVideoUrl: null }
      await themeApi.update(updatedSettings)
      setThemeSettings(prev => ({ ...prev, heroVideoUrl: null }))
      await refreshTheme()
    } catch (error) {
      console.error('Error deleting hero video:', error)
    }
  }

  // Delete hero image
  const handleDeleteHeroImage = async () => {
    if (!confirm('Are you sure you want to delete the hero image?')) return
    try {
      // Update theme settings to remove image URL
      const updatedSettings = { ...themeSettings, heroImageUrl: null }
      await themeApi.update(updatedSettings)
      setThemeSettings(prev => ({ ...prev, heroImageUrl: null }))
      await refreshTheme()
    } catch (error) {
      console.error('Error deleting hero image:', error)
    }
  }

  // Hero Video CRUD operations
  const handleAddHeroVideo = async ({ url, type }) => {
    try {
      if (!url) {
        alert('No video URL provided')
        return
      }

      // Determine video type based on URL content
      let videoType = 'upload'
      if (type === 'url' || url.startsWith('http')) {
        // Check if it's a YouTube URL
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          videoType = 'youtube'
        } else {
          videoType = 'external'
        }
      }

      await themeApi.createHeroVideo({
        videoUrl: url,
        videoType,
        title: '',
        description: ''
      })
      await fetchHeroVideos()
      setIsAddVideoModalOpen(false)
    } catch (error) {
      console.error('Error adding hero video:', error)
      alert('Failed to add hero video: ' + (error?.message || 'Unknown error'))
    }
  }

  const handleToggleVideoActive = async (video) => {
    try {
      if (video.isActive) {
        await themeApi.deactivateHeroVideo(video.id)
      } else {
        await themeApi.activateHeroVideo(video.id)
      }
      await fetchHeroVideos()
    } catch (error) {
      console.error('Error toggling video active state:', error)
      alert('Failed to update video')
    }
  }

  const handleDeleteHeroVideoItem = async (videoId) => {
    if (!confirm('Are you sure you want to delete this video?')) return
    try {
      await themeApi.deleteHeroVideo(videoId)
      await fetchHeroVideos()
    } catch (error) {
      console.error('Error deleting hero video:', error)
      alert('Failed to delete video')
    }
  }

  const handleMoveVideoUp = async (index) => {
    if (index <= 0) return
    const newOrder = [...heroVideos]
    ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    // Optimistic update - show change immediately
    setHeroVideos(newOrder)
    const videoIds = newOrder.map(v => v.id)
    try {
      await themeApi.reorderHeroVideos(videoIds)
    } catch (error) {
      console.error('Error reordering videos:', error)
      // Revert on error
      await fetchHeroVideos()
    }
  }

  const handleMoveVideoDown = async (index) => {
    if (index >= heroVideos.length - 1) return
    const newOrder = [...heroVideos]
    ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    // Optimistic update - show change immediately
    setHeroVideos(newOrder)
    const videoIds = newOrder.map(v => v.id)
    try {
      await themeApi.reorderHeroVideos(videoIds)
    } catch (error) {
      console.error('Error reordering videos:', error)
      // Revert on error
      await fetchHeroVideos()
    }
  }

  // Filter and sort users (newest first by ID)
  const filteredUsers = users
    .filter(u => {
      const matchesSearch =
        (u.firstName?.toLowerCase() || '').includes(userSearch.toLowerCase()) ||
        (u.lastName?.toLowerCase() || '').includes(userSearch.toLowerCase()) ||
        (u.email?.toLowerCase() || '').includes(userSearch.toLowerCase())
      const matchesRole = userRoleFilter === 'all' || u.role?.toLowerCase() === userRoleFilter.toLowerCase()
      const matchesOnline = userOnlineFilter === 'all' ||
        (userOnlineFilter === 'online' && u.isOnline) ||
        (userOnlineFilter === 'offline' && !u.isOnline) ||
        (userOnlineFilter === 'push' && u.hasPushSubscription) ||
        (userOnlineFilter === 'nopush' && !u.hasPushSubscription)
      return matchesSearch && matchesRole && matchesOnline
    })
    .sort((a, b) => b.id - a.id)

  const onlineUserCount = users.filter(u => u.isOnline).length

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const matchesSearch =
      (t.name?.toLowerCase() || '').includes(templateSearch.toLowerCase()) ||
      (t.templateKey?.toLowerCase() || '').includes(templateSearch.toLowerCase()) ||
      (t.subject?.toLowerCase() || '').includes(templateSearch.toLowerCase())
    const matchesCategory = templateCategoryFilter === 'all' || t.category === templateCategoryFilter
    return matchesSearch && matchesCategory
  })

  // Pagination logic
  const getPaginatedData = (data) => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return data.slice(startIndex, startIndex + itemsPerPage)
  }

  const totalPages = (data) => Math.ceil(data.length / itemsPerPage)

  // Handle user edit
  const handleEditUser = (userData) => {
    setSelectedUser({ ...userData })
    setEditingEmail(false)
    setNewEmail('')
    setEditingPassword(false)
    setNewPassword('')
    setConfirmPassword('')
    setEditingPhone(false)
    setNewPhone('')
    setIsUserModalOpen(true)
  }

  // Handle resync user from shared auth
  const handleResyncUser = async (userId) => {
    if (!window.confirm('Re-sync this user from Funtime-Shared? This will update their email, name, and phone with data from the shared auth service.')) {
      return
    }
    setResyncingUserId(userId)
    try {
      const response = await userApi.adminResyncUser(userId)
      if (response.success || response.Success) {
        const message = response.message || response.Message
        alert(message || 'User re-synced successfully!')
        // Refresh users list
        fetchUsers()
      } else {
        alert(response.message || response.Message || 'Failed to re-sync user')
      }
    } catch (error) {
      console.error('Error re-syncing user:', error)
      alert(error.message || 'Failed to re-sync user')
    } finally {
      setResyncingUserId(null)
    }
  }

  // Handle delete user
  const handleDeleteUser = async () => {
    if (!deleteUserModal.user) return
    const user = deleteUserModal.user
    
    // Verify confirmation text matches email
    if (deleteConfirmText !== user.email) {
      alert('Email does not match. Please type the exact email to confirm deletion.')
      return
    }
    
    setDeletingUser(true)
    try {
      // First do a dry run to show what will be deleted
      const dryRunResponse = await userApi.adminDeleteUser(user.id, true)
      if (!dryRunResponse.success && !dryRunResponse.Success) {
        alert(dryRunResponse.message || dryRunResponse.Message || 'Failed to preview deletion')
        setDeletingUser(false)
        return
      }
      
      // Actually delete
      const response = await userApi.adminDeleteUser(user.id, false)
      if (response.success || response.Success) {
        alert(`User "${user.firstName} ${user.lastName}" (${user.email}) has been permanently deleted.`)
        setDeleteUserModal({ open: false, user: null })
        setDeleteConfirmText('')
        // Refresh users list
        fetchUsers()
      } else {
        alert(response.message || response.Message || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert(error.message || 'Failed to delete user')
    } finally {
      setDeletingUser(false)
    }
  }

  // Handle save user
  const handleSaveUser = async () => {
    if (!selectedUser) return
    setSavingUser(true)
    try {
      await userApi.updateUser(selectedUser.id, {
        firstName: selectedUser.firstName,
        lastName: selectedUser.lastName,
        role: selectedUser.role,
        isActive: selectedUser.isActive
      })
      // Update local state
      setUsers(users.map(u => u.id === selectedUser.id ? selectedUser : u))
      setIsUserModalOpen(false)
      setSelectedUser(null)
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Failed to update user')
    } finally {
      setSavingUser(false)
    }
  }

  // Handle admin send password reset
  const handleSendPasswordReset = async () => {
    if (!selectedUser) return
    if (!confirm(`Send password reset email to ${selectedUser.email}?`)) return

    setSendingPasswordReset(true)
    try {
      const response = await userApi.adminSendPasswordReset(selectedUser.id)
      alert(response?.message || 'Password reset email sent successfully')
    } catch (error) {
      console.error('Error sending password reset:', error)
      alert(error?.message || 'Failed to send password reset email')
    } finally {
      setSendingPasswordReset(false)
    }
  }

  // Handle admin update email
  const handleUpdateEmail = async () => {
    if (!selectedUser || !newEmail.trim()) return
    if (!confirm(`Update email from ${selectedUser.email} to ${newEmail}?`)) return

    setSavingEmail(true)
    try {
      const response = await userApi.adminUpdateEmail(selectedUser.id, newEmail.trim())
      // Update local state
      const updatedUser = { ...selectedUser, email: newEmail.trim() }
      setSelectedUser(updatedUser)
      setUsers(users.map(u => u.id === selectedUser.id ? updatedUser : u))
      setEditingEmail(false)
      setNewEmail('')
      alert(response?.message || 'Email updated successfully')
    } catch (error) {
      console.error('Error updating email:', error)
      alert(error?.message || 'Failed to update email')
    } finally {
      setSavingEmail(false)
    }
  }

  // Handle admin set password
  const handleSetPassword = async () => {
    if (!selectedUser) return
    if (!newPassword.trim()) {
      alert('Please enter a new password')
      return
    }
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match')
      return
    }
    if (!confirm(`Set new password for ${selectedUser.email}?`)) return

    setSavingPassword(true)
    try {
      const response = await userApi.adminSetPassword(selectedUser.id, newPassword.trim())
      setEditingPassword(false)
      setNewPassword('')
      setConfirmPassword('')
      alert(response?.message || 'Password updated successfully')
    } catch (error) {
      console.error('Error setting password:', error)
      alert(error?.message || 'Failed to set password')
    } finally {
      setSavingPassword(false)
    }
  }

  // Send test email to user
  const handleSendTestEmail = async () => {
    if (!selectedUser) return
    if (!confirm(`Send a test email to ${selectedUser.email}?`)) return

    setSendingTestEmail(true)
    try {
      const response = await userApi.adminSendTestEmail(selectedUser.id)
      alert(response?.message || 'Test email sent successfully')
    } catch (error) {
      console.error('Error sending test email:', error)
      alert(error?.message || 'Failed to send test email')
    } finally {
      setSendingTestEmail(false)
    }
  }

  const handleUpdatePhone = async () => {
    if (!selectedUser) return
    setSavingPhone(true)
    try {
      const response = await userApi.adminUpdatePhone(selectedUser.id, newPhone || null)
      alert(response?.message || 'Phone updated successfully')
      setSelectedUser({ ...selectedUser, phone: newPhone || null })
      setUsers(users.map(u => u.id === selectedUser.id ? { ...u, phone: newPhone || null } : u))
      setEditingPhone(false)
      setNewPhone('')
    } catch (error) {
      console.error('Error updating phone:', error)
      alert(error?.message || 'Failed to update phone')
    } finally {
      setSavingPhone(false)
    }
  }

  const handleSendTestSms = async () => {
    if (!selectedUser) return
    if (!selectedUser.phone) {
      alert('User does not have a phone number')
      return
    }
    if (!confirm(`Send a test SMS to ${selectedUser.phone}?`)) return

    setSendingTestSms(true)
    try {
      const response = await userApi.adminSendTestSms(selectedUser.id)
      alert(response?.message || 'Test SMS sent successfully')
    } catch (error) {
      console.error('Error sending test SMS:', error)
      alert(error?.message || 'Failed to send test SMS')
    } finally {
      setSendingTestSms(false)
    }
  }

  // Get role icon
  const getRoleIcon = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin': return <Shield className="w-4 h-4 text-purple-500" />
      case 'coach': return <GraduationCap className="w-4 h-4 text-blue-500" />
      default: return <User className="w-4 h-4 text-gray-500" />
    }
  }

  // Get role badge color
  const getRoleBadgeColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin': return 'bg-purple-100 text-purple-800'
      case 'coach': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Sidebar navigation items - all render inline now
  const navGroups = [
    {
      title: 'Core',
      items: [
        { id: 'users', label: 'Users', icon: Users, count: users.length },
        { id: 'theme', label: 'Theme', icon: Palette },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'system', label: 'System', icon: Settings }
      ]
    },
    {
      title: 'Content',
      items: [
        { id: 'blog', label: 'Blog', icon: BookOpen },
        { id: 'faq', label: 'FAQ', icon: HelpCircle },
        { id: 'helpTopics', label: 'Help Topics', icon: LifeBuoy },
        { id: 'feedback', label: 'Feedback', icon: MessageSquare },
        { id: 'certification', label: 'Certification', icon: Award },
        { id: 'releaseNotes', label: 'Release Notes', icon: Megaphone }
      ]
    },
    {
      title: 'Organization',
      items: [
        { id: 'events', label: 'Events', icon: Calendar },
        { id: 'leagues', label: 'Leagues', icon: Network },
        { id: 'leagueRoles', label: 'League Roles', icon: Shield }
      ]
    },
    {
      title: 'Configuration',
      items: [
        { id: 'eventTypes', label: 'Event Types', icon: Tags },
        { id: 'venueTypes', label: 'Venue Types', icon: Building2 },
        { id: 'assetTypes', label: 'Asset Types', icon: FileText },
        { id: 'clubRoles', label: 'Club Roles', icon: UserCog },
        { id: 'staffRoles', label: 'Staff Roles', icon: Shield },
        { id: 'teamUnits', label: 'Team Units', icon: Users },
        { id: 'skillLevels', label: 'Skill Levels', icon: Award },
        { id: 'scoreMethods', label: 'Score Methods', icon: Play },
        { id: 'gameFormats', label: 'Game Formats', icon: Settings },
        { id: 'phaseTemplates', label: 'Phase Templates', icon: Layers }
      ]
    },
    {
      title: 'Coming Soon',
      items: [
        { id: 'transactions', label: 'Transactions', icon: DollarSign, count: 0, disabled: true }
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-lg min-h-screen">
          <div className="p-6 border-b">
            <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500 mt-1">System Management</p>
          </div>
          <nav className="p-4 space-y-2">
            {navGroups.map(group => {
              const isCollapsed = collapsedGroups[group.title]
              return (
                <div key={group.title}>
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 rounded-lg transition"
                  >
                    <span>{group.title}</span>
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-1 mt-1">
                      {group.items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (item.disabled) return
                            if (item.href) {
                              navigate(item.href)
                            } else {
                              setActiveTab(item.id)
                            }
                          }}
                          disabled={item.disabled}
                          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition ${
                            activeTab === item.id
                              ? 'bg-blue-50 text-blue-700'
                              : item.disabled
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center">
                            <item.icon className="w-5 h-5 mr-3" />
                            <span className="font-medium text-sm">{item.label}</span>
                          </div>
                          {item.count > 0 && (
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              activeTab === item.id ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {item.count}
                            </span>
                          )}
                          {item.disabled && (
                            <span className="text-xs text-gray-400">Soon</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          {/* Users Tab */}
          {activeTab === 'users' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
              </div>

              {/* Search and Filters */}
              <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={userSearch}
                      onChange={(e) => { setUserSearch(e.target.value); setCurrentPage(1); }}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Filter className="w-5 h-5 text-gray-400" />
                    <select
                      value={userRoleFilter}
                      onChange={(e) => { setUserRoleFilter(e.target.value); setCurrentPage(1); }}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Roles</option>
                      <option value="admin">Admin</option>
                      <option value="coach">Coach</option>
                      <option value="student">Student</option>
                    </select>
                    <select
                      value={userOnlineFilter}
                      onChange={(e) => { setUserOnlineFilter(e.target.value); setCurrentPage(1); }}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Status</option>
                      <option value="online">🟢 Online ({onlineUserCount})</option>
                      <option value="offline">⚪ Offline</option>
                      <option value="push">🔔 Has Push ({users.filter(u => u.hasPushSubscription).length})</option>
                      <option value="nopush">🔕 No Push</option>
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      setPushTargetMode('online')
                      setPushTargetUsers([])
                      setPushTitle('')
                      setPushBody('')
                      setPushUrl('')
                      setPushIcon('')
                      setPushResult(null)
                      setPushModalOpen(true)
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap"
                    title="Send push notification to online users"
                  >
                    <Megaphone className="w-4 h-4" />
                    Push Online ({onlineUserCount})
                  </button>
                </div>
              </div>

              {/* Users Table */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {loading ? (
                  <div className="p-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-500">Loading users...</p>
                  </div>
                ) : (
                  <>
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                          <th className="px-4 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                          <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {getPaginatedData(filteredUsers).map(u => (
                          <tr key={u.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 text-sm font-mono text-gray-600">{u.id}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <button
                                  onClick={() => setSelectedProfileUserId(u.id)}
                                  className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer"
                                  title="View profile"
                                >
                                  {u.profileImageUrl ? (
                                    <img
                                      src={getSharedAssetUrl(u.profileImageUrl)}
                                      alt={`${u.lastName}, ${u.firstName}`}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white font-medium">
                                      {(u.firstName?.[0] || '') + (u.lastName?.[0] || '')}
                                    </div>
                                  )}
                                </button>
                                <div className="ml-4">
                                  <button
                                    onClick={() => setSelectedProfileUserId(u.id)}
                                    className="font-medium text-gray-900 hover:text-blue-600 text-left"
                                  >
                                    {u.firstName || ''} {u.lastName || ''}
                                  </button>
                                  <div className="text-sm text-gray-500">{u.email || 'No email'}</div>
                                  {u.phone && <div className="text-xs text-gray-400">{u.phone}</div>}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(u.role)}`}>
                                {getRoleIcon(u.role)}
                                <span className="ml-1 capitalize">{u.role || 'User'}</span>
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <OnlineStatusDot
                                  isOnline={u.isOnline}
                                  lastActiveAt={u.lastActiveAt}
                                  size="md"
                                  showLabel={true}
                                />
                                {u.hasPushSubscription ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-orange-600" title={`${u.pushSubscriptionCount} push subscription${u.pushSubscriptionCount !== 1 ? 's' : ''}`}>
                                    🔔 {u.pushSubscriptionCount}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-300" title="No push subscriptions">🔕</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {(u.city || u.state) ? (
                                <span className="inline-flex items-center">
                                  <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                                  {[u.city, u.state].filter(Boolean).join(', ')}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {u.isActive ? (
                                <span className="inline-flex items-center text-green-600">
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-red-600">
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setPushTargetMode('selected')
                                  setPushTargetUsers([u.id])
                                  setPushTitle('')
                                  setPushBody('')
                                  setPushUrl('')
                                  setPushIcon('')
                                  setPushResult(null)
                                  setPushModalOpen(true)
                                }}
                                className="text-orange-600 hover:text-orange-800 p-2 rounded-lg hover:bg-orange-50"
                                title="Send push notification"
                              >
                                <Megaphone className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setNotifTestUserId(u.id.toString())
                                  setNotifGroupType('user')
                                  setActiveTab('notifications')
                                }}
                                className="text-amber-600 hover:text-amber-800 p-2 rounded-lg hover:bg-amber-50"
                                title="Send test notification"
                              >
                                <Bell className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleResyncUser(u.id)}
                                disabled={resyncingUserId === u.id}
                                className="text-green-600 hover:text-green-800 p-2 rounded-lg hover:bg-green-50 disabled:opacity-50"
                                title="Re-sync from shared auth"
                              >
                                {resyncingUserId === u.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600" />
                                ) : (
                                  <RefreshCw className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleEditUser(u)}
                                className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50"
                                title="Edit user"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteUserModal({ open: true, user: u })
                                  setDeleteConfirmText('')
                                }}
                                className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50"
                                title="Delete user"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {filteredUsers.length > itemsPerPage && (
                      <div className="px-6 py-4 border-t flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} users
                        </p>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="px-3 py-1 text-sm">
                            Page {currentPage} of {totalPages(filteredUsers)}
                          </span>
                          <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages(filteredUsers), p + 1))}
                            disabled={currentPage === totalPages(filteredUsers)}
                            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {filteredUsers.length === 0 && !usersError && (
                      <div className="p-12 text-center">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No users found</p>
                      </div>
                    )}

                    {usersError && (
                      <div className="p-12 text-center">
                        <XCircle className="w-12 h-12 text-red-300 mx-auto mb-4" />
                        <p className="text-red-600 font-medium mb-2">Error loading users</p>
                        <p className="text-gray-500 mb-4">{usersError}</p>
                        <button
                          onClick={fetchUsers}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Retry
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Theme Tab */}
          {activeTab === 'theme' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Theme Management</h2>
                <button
                  onClick={handleSaveTheme}
                  disabled={savingTheme || !themeSettings}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {savingTheme ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Theme
                    </>
                  )}
                </button>
              </div>

              {loading ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-500">Loading theme settings...</p>
                </div>
              ) : themeSettings ? (
                <div className="space-y-6">
                  {/* Branding Section */}
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Image className="w-5 h-5 mr-2 text-blue-500" />
                      Branding
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Organization Name
                        </label>
                        <input
                          type="text"
                          value={themeSettings.organizationName || ''}
                          onChange={(e) => handleThemeChange('organizationName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Your Organization Name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Font Family
                        </label>
                        <select
                          value={themeSettings.fontFamily || 'Inter, system-ui, sans-serif'}
                          onChange={(e) => handleThemeChange('fontFamily', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="Inter, system-ui, sans-serif">Inter (Default)</option>
                          <option value="Roboto, system-ui, sans-serif">Roboto</option>
                          <option value="Open Sans, system-ui, sans-serif">Open Sans</option>
                          <option value="Poppins, system-ui, sans-serif">Poppins</option>
                          <option value="Montserrat, system-ui, sans-serif">Montserrat</option>
                        </select>
                      </div>
                    </div>

                    {/* Logo and Favicon */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
                        <div className="flex items-center space-x-4">
                          <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
                            {themeSettings.logoUrl ? (
                              <img
                                src={getSharedAssetUrl(themeSettings.logoUrl)}
                                alt="Logo"
                                className="max-w-full max-h-full object-contain"
                              />
                            ) : (
                              <Image className="w-8 h-8 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <input
                              type="file"
                              ref={logoInputRef}
                              onChange={handleLogoUpload}
                              accept="image/*"
                              className="hidden"
                            />
                            <button
                              onClick={() => logoInputRef.current?.click()}
                              disabled={uploadingLogo}
                              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center disabled:opacity-50"
                            >
                              {uploadingLogo ? (
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Upload className="w-4 h-4 mr-2" />
                              )}
                              {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                            </button>
                            <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 2MB</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Favicon</label>
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
                            {themeSettings.faviconUrl ? (
                              <img
                                src={getSharedAssetUrl(themeSettings.faviconUrl)}
                                alt="Favicon"
                                className="max-w-full max-h-full object-contain"
                              />
                            ) : (
                              <Image className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <input
                              type="file"
                              ref={faviconInputRef}
                              onChange={handleFaviconUpload}
                              accept="image/*,.ico"
                              className="hidden"
                            />
                            <button
                              onClick={() => faviconInputRef.current?.click()}
                              disabled={uploadingFavicon}
                              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center disabled:opacity-50"
                            >
                              {uploadingFavicon ? (
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Upload className="w-4 h-4 mr-2" />
                              )}
                              {uploadingFavicon ? 'Uploading...' : 'Upload Favicon'}
                            </button>
                            <p className="text-xs text-gray-500 mt-1">ICO, PNG 32x32 or 64x64</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Hero Section */}
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Video className="w-5 h-5 mr-2 text-pink-500" />
                      Hero Section
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                      Customize the hero section on the landing page. Video takes priority over image.
                    </p>

                    {/* Hero Video and Image */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Hero Video</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                          {themeSettings.heroVideoUrl ? (
                            <div className="space-y-3">
                              {/* Check if it's an external URL (YouTube, etc.) or uploaded file */}
                              {themeSettings.heroVideoUrl.includes('youtube.com') || themeSettings.heroVideoUrl.includes('youtu.be') ? (
                                <div className="relative w-full h-32 bg-gray-900 rounded-lg overflow-hidden">
                                  {getYouTubeThumbnail(themeSettings.heroVideoUrl) ? (
                                    <img
                                      src={getYouTubeThumbnail(themeSettings.heroVideoUrl)}
                                      alt="YouTube video thumbnail"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Video className="w-8 h-8 text-white" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <div className="bg-red-600 rounded-lg px-2 py-1 flex items-center">
                                      <Video className="w-4 h-4 text-white" />
                                      <span className="text-white ml-1 text-xs font-medium">YouTube</span>
                                    </div>
                                  </div>
                                </div>
                              ) : themeSettings.heroVideoUrl.startsWith('http') ? (
                                <div className="w-full h-32 bg-gray-900 rounded-lg flex items-center justify-center">
                                  <Video className="w-8 h-8 text-white" />
                                  <span className="text-white ml-2 text-sm">External Video</span>
                                </div>
                              ) : (
                                <video
                                  src={getSharedAssetUrl(themeSettings.heroVideoUrl)}
                                  className="w-full h-32 object-cover rounded-lg"
                                  muted
                                  loop
                                  autoPlay
                                  playsInline
                                />
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 truncate flex-1">
                                  {themeSettings.heroVideoUrl.length > 40
                                    ? themeSettings.heroVideoUrl.substring(0, 40) + '...'
                                    : themeSettings.heroVideoUrl}
                                </span>
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => setIsHeroVideoModalOpen(true)}
                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={handleDeleteHeroVideo}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <Video className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                              <p className="text-sm text-gray-500 mb-3">No video set</p>
                              <button
                                onClick={() => setIsHeroVideoModalOpen(true)}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center mx-auto"
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                Add Video
                              </button>
                              <p className="text-xs text-gray-400 mt-2">Upload or paste external URL</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Hero Image (Fallback)</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                          {themeSettings.heroImageUrl ? (
                            <div className="space-y-3">
                              <img
                                src={getSharedAssetUrl(themeSettings.heroImageUrl)}
                                alt="Hero background"
                                className="w-full h-32 object-cover rounded-lg"
                              />
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 truncate flex-1">
                                  {themeSettings.heroImageUrl.split('/').pop()}
                                </span>
                                <button
                                  onClick={handleDeleteHeroImage}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <Image className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                              <p className="text-sm text-gray-500 mb-3">No image uploaded</p>
                              <input
                                type="file"
                                ref={heroImageInputRef}
                                onChange={handleHeroImageUpload}
                                accept="image/*"
                                className="hidden"
                              />
                              <button
                                onClick={() => heroImageInputRef.current?.click()}
                                disabled={uploadingHeroImage}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center mx-auto disabled:opacity-50"
                              >
                                {uploadingHeroImage ? (
                                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Upload className="w-4 h-4 mr-2" />
                                )}
                                {uploadingHeroImage ? 'Uploading...' : 'Upload Image'}
                              </button>
                              <p className="text-xs text-gray-400 mt-2">PNG, JPG up to 5MB</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Hero Text Content */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Hero Title</label>
                        <input
                          type="text"
                          value={themeSettings.heroTitle || ''}
                          onChange={(e) => handleThemeChange('heroTitle', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Your Pickleball Community Awaits"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Hero Subtitle</label>
                        <textarea
                          value={themeSettings.heroSubtitle || ''}
                          onChange={(e) => handleThemeChange('heroSubtitle', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          rows={2}
                          placeholder="Connect with players, find courts, join clubs, and get certified."
                        />
                      </div>
                    </div>

                    {/* CTA Buttons */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700">Primary CTA Button</h4>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Button Text</label>
                          <input
                            type="text"
                            value={themeSettings.heroCtaText || ''}
                            onChange={(e) => handleThemeChange('heroCtaText', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Find Courts"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Button Link</label>
                          <input
                            type="text"
                            value={themeSettings.heroCtaLink || ''}
                            onChange={(e) => handleThemeChange('heroCtaLink', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="/courts"
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700">Secondary CTA Button</h4>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Button Text</label>
                          <input
                            type="text"
                            value={themeSettings.heroSecondaryCtaText || ''}
                            onChange={(e) => handleThemeChange('heroSecondaryCtaText', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Join a Club"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Button Link</label>
                          <input
                            type="text"
                            value={themeSettings.heroSecondaryCtaLink || ''}
                            onChange={(e) => handleThemeChange('heroSecondaryCtaLink', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="/clubs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Hero Videos Section (Multiple Videos) */}
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <Play className="w-5 h-5 mr-2 text-purple-500" />
                        Hero Videos
                      </h3>
                      <button
                        onClick={() => setIsAddVideoModalOpen(true)}
                        className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center text-sm"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Video
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mb-6">
                      Manage multiple hero videos. Active videos will be displayed in the hero section. Only one video plays at a time (first active video by sort order).
                    </p>

                    {loadingHeroVideos ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                        <span className="ml-2 text-gray-500">Loading videos...</span>
                      </div>
                    ) : heroVideos.length > 0 ? (
                      <div className="space-y-3">
                        {heroVideos.map((video, index) => (
                          <div
                            key={video.id}
                            className={`flex items-center p-4 rounded-lg border-2 transition-all ${
                              video.isActive
                                ? 'border-purple-200 bg-purple-50'
                                : 'border-gray-200 bg-gray-50 opacity-60'
                            }`}
                          >
                            {/* Video Preview */}
                            <div className="w-24 h-16 rounded-lg overflow-hidden bg-gray-900 flex-shrink-0 mr-4">
                              {video.videoType === 'youtube' || video.videoUrl?.includes('youtube.com') || video.videoUrl?.includes('youtu.be') ? (
                                getYouTubeThumbnail(video.videoUrl) ? (
                                  <img
                                    src={getYouTubeThumbnail(video.videoUrl)}
                                    alt="Video thumbnail"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Video className="w-6 h-6 text-white" />
                                  </div>
                                )
                              ) : video.thumbnailUrl ? (
                                <img
                                  src={getSharedAssetUrl(video.thumbnailUrl)}
                                  alt="Video thumbnail"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Video className="w-6 h-6 text-white" />
                                </div>
                              )}
                            </div>

                            {/* Video Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  video.videoType === 'youtube' ? 'bg-red-100 text-red-700' :
                                  video.videoType === 'external' ? 'bg-blue-100 text-blue-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {video.videoType === 'youtube' ? 'YouTube' :
                                   video.videoType === 'external' ? 'External' : 'Uploaded'}
                                </span>
                                {video.isActive ? (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                                    Active
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-600 rounded-full">
                                    Inactive
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 truncate">
                                {video.title || video.videoUrl}
                              </p>
                              <p className="text-xs text-gray-400">
                                Order: {video.sortOrder + 1}
                              </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 ml-4">
                              {/* Move Up */}
                              <button
                                onClick={() => handleMoveVideoUp(index)}
                                disabled={index === 0}
                                className="p-1.5 text-gray-500 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move up"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>
                              {/* Move Down */}
                              <button
                                onClick={() => handleMoveVideoDown(index)}
                                disabled={index === heroVideos.length - 1}
                                className="p-1.5 text-gray-500 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move down"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </button>
                              {/* Toggle Active */}
                              <button
                                onClick={() => handleToggleVideoActive(video)}
                                className={`p-1.5 rounded ${
                                  video.isActive
                                    ? 'text-purple-600 hover:bg-purple-100'
                                    : 'text-gray-400 hover:bg-gray-200'
                                }`}
                                title={video.isActive ? 'Deactivate' : 'Activate'}
                              >
                                {video.isActive ? (
                                  <CheckCircle className="w-4 h-4" />
                                ) : (
                                  <XCircle className="w-4 h-4" />
                                )}
                              </button>
                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteHeroVideoItem(video.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                        <Video className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500 mb-3">No hero videos configured</p>
                        <button
                          onClick={() => setIsAddVideoModalOpen(true)}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center mx-auto"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Your First Video
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Marquee Settings Section */}
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Users className="w-5 h-5 mr-2 text-emerald-500" />
                      Marquee Settings
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                      Configure the scrolling marquee on the home page that shows recently joined players and clubs.
                    </p>

                    {/* Show/Hide Toggles */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Show Players</label>
                          <p className="text-xs text-gray-500">Display recently joined players in marquee</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleThemeChange('marqueeShowPlayers', !themeSettings.marqueeShowPlayers)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                            themeSettings.marqueeShowPlayers ? 'bg-emerald-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              themeSettings.marqueeShowPlayers ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Show Clubs</label>
                          <p className="text-xs text-gray-500">Display recently created clubs in marquee</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleThemeChange('marqueeShowClubs', !themeSettings.marqueeShowClubs)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                            themeSettings.marqueeShowClubs ? 'bg-amber-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              themeSettings.marqueeShowClubs ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Count and Days Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Recent Days
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={themeSettings.marqueeRecentDays || 30}
                          onChange={(e) => handleThemeChange('marqueeRecentDays', parseInt(e.target.value) || 30)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">How many days back to show (1-365)</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Max Players
                        </label>
                        <input
                          type="number"
                          min="5"
                          max="50"
                          value={themeSettings.marqueePlayerCount || 20}
                          onChange={(e) => handleThemeChange('marqueePlayerCount', parseInt(e.target.value) || 20)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Maximum players to display (5-50)</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Max Clubs
                        </label>
                        <input
                          type="number"
                          min="5"
                          max="50"
                          value={themeSettings.marqueeClubCount || 15}
                          onChange={(e) => handleThemeChange('marqueeClubCount', parseInt(e.target.value) || 15)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Maximum clubs to display (5-50)</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Scroll Speed
                        </label>
                        <input
                          type="number"
                          min="10"
                          max="120"
                          value={themeSettings.marqueeSpeed || 40}
                          onChange={(e) => handleThemeChange('marqueeSpeed', parseInt(e.target.value) || 40)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Seconds for full scroll (10-120, higher = slower)</p>
                      </div>
                    </div>
                  </div>

                  {/* Theme Presets Section */}
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Layers className="w-5 h-5 mr-2 text-indigo-500" />
                      Theme Presets
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Choose a preset to quickly apply a color scheme, then customize as needed.
                    </p>

                    {loadingPresets ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                        <span className="ml-2 text-gray-500">Loading presets...</span>
                      </div>
                    ) : themePresets.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {themePresets.map(preset => {
                          const isActive =
                            themeSettings?.primaryColor?.toLowerCase() === preset.primaryColor?.toLowerCase() &&
                            themeSettings?.accentColor?.toLowerCase() === preset.accentColor?.toLowerCase()

                          return (
                            <button
                              key={preset.presetId}
                              onClick={() => handleApplyPreset(preset)}
                              className={`relative p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                                isActive
                                  ? 'border-indigo-500 ring-2 ring-indigo-200'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              {isActive && (
                                <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}

                              {/* Color Preview */}
                              <div className="flex space-x-1 mb-3">
                                <div
                                  className="w-8 h-8 rounded-lg shadow-sm"
                                  style={{ backgroundColor: preset.primaryColor }}
                                  title="Primary"
                                />
                                <div
                                  className="w-8 h-8 rounded-lg shadow-sm"
                                  style={{ backgroundColor: preset.primaryDarkColor }}
                                  title="Primary Dark"
                                />
                                <div
                                  className="w-8 h-8 rounded-lg shadow-sm"
                                  style={{ backgroundColor: preset.accentColor }}
                                  title="Accent"
                                />
                              </div>

                              <div className="text-left">
                                <p className="font-medium text-gray-900 text-sm">{preset.presetName}</p>
                                {preset.description && (
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{preset.description}</p>
                                )}
                              </div>

                              {preset.isDefault && (
                                <span className="absolute bottom-2 right-2 text-xs text-indigo-600 font-medium">
                                  Default
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Layers className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <p>No theme presets available</p>
                      </div>
                    )}
                  </div>

                  {/* Colors Section */}
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Palette className="w-5 h-5 mr-2 text-purple-500" />
                      Color Scheme
                    </h3>

                    {/* Primary Colors */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Primary Colors</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Primary</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.primaryColor || '#047857'}
                              onChange={(e) => handleThemeChange('primaryColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.primaryColor || '#047857'}
                              onChange={(e) => handleThemeChange('primaryColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Primary Dark</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.primaryDarkColor || '#065f46'}
                              onChange={(e) => handleThemeChange('primaryDarkColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.primaryDarkColor || '#065f46'}
                              onChange={(e) => handleThemeChange('primaryDarkColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Primary Light</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.primaryLightColor || '#d1fae5'}
                              onChange={(e) => handleThemeChange('primaryLightColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.primaryLightColor || '#d1fae5'}
                              onChange={(e) => handleThemeChange('primaryLightColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Accent Colors */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Accent Colors</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Accent</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.accentColor || '#f59e0b'}
                              onChange={(e) => handleThemeChange('accentColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.accentColor || '#f59e0b'}
                              onChange={(e) => handleThemeChange('accentColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Accent Dark</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.accentDarkColor || '#d97706'}
                              onChange={(e) => handleThemeChange('accentDarkColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.accentDarkColor || '#d97706'}
                              onChange={(e) => handleThemeChange('accentDarkColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Accent Light</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.accentLightColor || '#fef3c7'}
                              onChange={(e) => handleThemeChange('accentLightColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.accentLightColor || '#fef3c7'}
                              onChange={(e) => handleThemeChange('accentLightColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status Colors */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Status Colors</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Success</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.successColor || '#10b981'}
                              onChange={(e) => handleThemeChange('successColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.successColor || '#10b981'}
                              onChange={(e) => handleThemeChange('successColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Error</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.errorColor || '#ef4444'}
                              onChange={(e) => handleThemeChange('errorColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.errorColor || '#ef4444'}
                              onChange={(e) => handleThemeChange('errorColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Warning</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.warningColor || '#f59e0b'}
                              onChange={(e) => handleThemeChange('warningColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.warningColor || '#f59e0b'}
                              onChange={(e) => handleThemeChange('warningColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Info</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.infoColor || '#3b82f6'}
                              onChange={(e) => handleThemeChange('infoColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.infoColor || '#3b82f6'}
                              onChange={(e) => handleThemeChange('infoColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Background & Text Colors */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Background & Text</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Background</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.backgroundColor || '#ffffff'}
                              onChange={(e) => handleThemeChange('backgroundColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.backgroundColor || '#ffffff'}
                              onChange={(e) => handleThemeChange('backgroundColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Background Secondary</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.backgroundSecondaryColor || '#f3f4f6'}
                              onChange={(e) => handleThemeChange('backgroundSecondaryColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.backgroundSecondaryColor || '#f3f4f6'}
                              onChange={(e) => handleThemeChange('backgroundSecondaryColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Text Primary</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.textPrimaryColor || '#111827'}
                              onChange={(e) => handleThemeChange('textPrimaryColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.textPrimaryColor || '#111827'}
                              onChange={(e) => handleThemeChange('textPrimaryColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Text Secondary</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.textSecondaryColor || '#6b7280'}
                              onChange={(e) => handleThemeChange('textSecondaryColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.textSecondaryColor || '#6b7280'}
                              onChange={(e) => handleThemeChange('textSecondaryColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Preview Section */}
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
                    <div
                      className="p-6 rounded-lg border"
                      style={{ backgroundColor: themeSettings.backgroundColor }}
                    >
                      <div className="flex items-center mb-4">
                        {themeSettings.logoUrl && (
                          <img
                            src={getSharedAssetUrl(themeSettings.logoUrl)}
                            alt="Logo Preview"
                            className="h-10 mr-4"
                          />
                        )}
                        <h4
                          className="text-xl font-bold"
                          style={{ color: themeSettings.textPrimaryColor }}
                        >
                          {themeSettings.organizationName || 'Organization Name'}
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <button
                          className="px-4 py-2 rounded-lg text-white"
                          style={{ backgroundColor: themeSettings.primaryColor }}
                        >
                          Primary Button
                        </button>
                        <button
                          className="px-4 py-2 rounded-lg text-white"
                          style={{ backgroundColor: themeSettings.accentColor }}
                        >
                          Accent Button
                        </button>
                        <button
                          className="px-4 py-2 rounded-lg text-white"
                          style={{ backgroundColor: themeSettings.successColor }}
                        >
                          Success
                        </button>
                        <button
                          className="px-4 py-2 rounded-lg text-white"
                          style={{ backgroundColor: themeSettings.errorColor }}
                        >
                          Error
                        </button>
                      </div>
                      <p style={{ color: themeSettings.textSecondaryColor }}>
                        This is how your theme colors will appear throughout the application.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                  <Palette className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Failed to load theme settings</p>
                </div>
              )}
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Notification Templates</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate('/admin/notification-system')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    Unified System
                  </button>
                  <button
                    onClick={handleNewTemplate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Template
                  </button>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search templates..."
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Filter className="w-5 h-5 text-gray-400" />
                    <select
                      value={templateCategoryFilter}
                      onChange={(e) => setTemplateCategoryFilter(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Categories</option>
                      {templateCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Templates Table */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {loading ? (
                  <div className="p-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-500">Loading templates...</p>
                  </div>
                ) : (
                  <>
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Template</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {getPaginatedData(filteredTemplates).map(template => (
                          <tr key={template.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                  <Mail className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="ml-4">
                                  <div className="font-medium text-gray-900">{template.name}</div>
                                  <div className="text-sm text-gray-500">{template.templateKey}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {template.category}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {template.isActive ? (
                                <span className="inline-flex items-center text-green-600">
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-gray-500">
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {template.isSystem ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                  <Shield className="w-3 h-3 mr-1" />
                                  System
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                  Custom
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end space-x-1">
                                <button
                                  onClick={() => handleEditTemplate(template)}
                                  className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleTemplateActive(template)}
                                  className={`p-2 rounded-lg ${template.isActive ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
                                  title={template.isActive ? 'Deactivate' : 'Activate'}
                                >
                                  {template.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                </button>
                                {template.isSystem && (
                                  <button
                                    onClick={() => handleResetTemplate(template)}
                                    className="text-purple-600 hover:text-purple-800 p-2 rounded-lg hover:bg-purple-50"
                                    title="Reset to default"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                )}
                                {!template.isSystem && (
                                  <button
                                    onClick={() => handleDeleteTemplate(template)}
                                    className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {filteredTemplates.length > itemsPerPage && (
                      <div className="px-6 py-4 border-t flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTemplates.length)} of {filteredTemplates.length} templates
                        </p>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="px-3 py-1 text-sm">
                            Page {currentPage} of {totalPages(filteredTemplates)}
                          </span>
                          <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages(filteredTemplates), p + 1))}
                            disabled={currentPage === totalPages(filteredTemplates)}
                            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {filteredTemplates.length === 0 && (
                      <div className="p-12 text-center">
                        <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No templates found</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Events Admin */}
          {activeTab === 'events' && <EventsAdmin embedded />}

          {/* Transactions Tab (Coming Soon) */}
          {activeTab === 'transactions' && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Transactions Management</h3>
              <p className="text-gray-500">Coming soon. View and manage all payment transactions.</p>
            </div>
          )}

          {/* Blog Admin */}
          {activeTab === 'blog' && <BlogAdmin embedded />}

          {/* FAQ Admin */}
          {activeTab === 'faq' && <FaqAdmin embedded />}

          {/* Help Topics Admin */}
          {activeTab === 'helpTopics' && <HelpTopicsAdmin embedded />}

          {/* Feedback Admin */}
          {activeTab === 'feedback' && <FeedbackAdmin embedded />}

          {/* Certification Admin */}
          {activeTab === 'certification' && <CertificationAdmin embedded />}

          {/* Event Types Admin */}
          {activeTab === 'eventTypes' && <EventTypesAdmin embedded />}

          {/* Venue Types Admin */}
          {activeTab === 'venueTypes' && <VenueTypesAdmin embedded />}

          {/* Asset Types Admin */}
          {activeTab === 'assetTypes' && <ObjectAssetTypesAdmin />}

          {/* Club Roles Admin */}
          {activeTab === 'clubRoles' && <ClubMemberRolesAdmin embedded />}

          {/* Staff Roles Admin */}
          {activeTab === 'staffRoles' && <StaffRolesAdmin embedded />}

          {/* Team Units Admin */}
          {activeTab === 'teamUnits' && <TeamUnitsAdmin embedded />}

          {/* Skill Levels Admin */}
          {activeTab === 'skillLevels' && <SkillLevelsAdmin embedded />}

          {/* Score Methods Admin */}
          {activeTab === 'scoreMethods' && <ScoreMethodsAdmin embedded />}

          {/* Game Formats Admin */}
          {activeTab === 'gameFormats' && <GameFormatsAdmin embedded />}

          {/* Phase Templates Admin */}
          {activeTab === 'phaseTemplates' && <PhaseTemplatesAdmin embedded />}

          {/* League Admin */}
          {activeTab === 'leagues' && <LeagueAdmin embedded />}

          {/* League Roles Admin */}
          {activeTab === 'leagueRoles' && <LeagueRolesAdmin embedded />}

          {activeTab === 'releaseNotes' && <ReleaseNotesAdmin embedded />}

          {/* System Tab - API Key Testing */}
          {activeTab === 'system' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
              </div>

              {/* API Key Test Section */}
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Funtime-Shared API Key</h3>
                    <p className="text-sm text-gray-500">Test your API key connection to the shared authentication service</p>
                  </div>
                  <button
                    onClick={testApiKey}
                    disabled={testingApiKey}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {testingApiKey ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Test API Key
                      </>
                    )}
                  </button>
                </div>

                {/* Error Display */}
                {apiKeyTestError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center">
                      <XCircle className="w-5 h-5 text-red-500 mr-2" />
                      <span className="text-red-700 font-medium">Test Failed</span>
                    </div>
                    <p className="text-red-600 mt-1">{apiKeyTestError}</p>
                  </div>
                )}

                {/* Success Display */}
                {apiKeyTestResult && apiKeyTestResult.success && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                      <span className="text-green-700 font-medium">{apiKeyTestResult.message}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Partner Key:</span>
                        <span className="ml-2 font-mono text-gray-900">{apiKeyTestResult.partnerKey}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Partner Name:</span>
                        <span className="ml-2 text-gray-900">{apiKeyTestResult.partnerName}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Rate Limit:</span>
                        <span className="ml-2 text-gray-900">{apiKeyTestResult.rateLimitPerMinute} req/min</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${apiKeyTestResult.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {apiKeyTestResult.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Scopes:</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {apiKeyTestResult.scopes?.map((scope, index) => (
                            <span key={index} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              {scope}
                            </span>
                          ))}
                        </div>
                      </div>
                      {apiKeyTestResult.clientIp && (
                        <div>
                          <span className="text-gray-500">Client IP:</span>
                          <span className="ml-2 font-mono text-gray-900">{apiKeyTestResult.clientIp}</span>
                        </div>
                      )}
                      {apiKeyTestResult.lastUsedAt && (
                        <div>
                          <span className="text-gray-500">Last Used:</span>
                          <span className="ml-2 text-gray-900">{new Date(apiKeyTestResult.lastUsedAt).toLocaleString()}</span>
                        </div>
                      )}
                      {apiKeyTestResult.expiresAt && (
                        <div>
                          <span className="text-gray-500">Expires:</span>
                          <span className="ml-2 text-gray-900">{new Date(apiKeyTestResult.expiresAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Initial State */}
                {!apiKeyTestResult && !apiKeyTestError && !testingApiKey && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <Settings className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Click "Test API Key" to verify your connection to Funtime-Shared</p>
                  </div>
                )}
              </div>

              {/* Configuration Info */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Shared Auth URL</span>
                    <span className="font-mono text-gray-900">{SHARED_AUTH_URL}</span>
                  </div>
                  <p className="text-gray-500 text-xs mt-2">
                    API key is stored securely in backend configuration and is not exposed to the frontend.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Notification Testing */}
          {activeTab === 'notifications' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Notification Testing</h2>
              <p className="text-gray-600 mb-6">
                Send test notifications to individual users or groups. Use this to verify SignalR real-time notifications are working.
              </p>

              <div className="max-w-2xl space-y-6">
                {/* Notification Target Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Type
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { id: 'user', label: 'User', icon: User },
                      { id: 'game', label: 'Game', icon: Award },
                      { id: 'event', label: 'Event', icon: Calendar },
                      { id: 'club', label: 'Club', icon: Building2 },
                      { id: 'broadcast', label: 'Broadcast', icon: Send }
                    ].map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => {
                          setNotifGroupType(id)
                          setNotifGroupId('')
                          if (id !== 'user') setNotifTestUserId('')
                        }}
                        className={`flex flex-col items-center p-3 rounded-lg border-2 transition-colors ${
                          notifGroupType === id
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        <Icon className="w-5 h-5 mb-1" />
                        <span className="text-xs font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Selection */}
                {notifGroupType === 'user' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target User
                    </label>
                    <select
                      value={notifTestUserId}
                      onChange={(e) => setNotifTestUserId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a user...</option>
                      <option value={user?.id}>Myself ({user?.email})</option>
                      {users.filter(u => u.id !== user?.id).map(u => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName} ({u.email})
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Tip: Click the bell icon next to any user in the Users tab to quickly select them.
                    </p>
                  </div>
                )}

                {(notifGroupType === 'game' || notifGroupType === 'event' || notifGroupType === 'club') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {notifGroupType.charAt(0).toUpperCase() + notifGroupType.slice(1)} ID
                    </label>
                    <input
                      type="number"
                      value={notifGroupId}
                      onChange={(e) => setNotifGroupId(e.target.value)}
                      placeholder={`Enter ${notifGroupType} ID...`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Users must be subscribed to this {notifGroupType} group via SignalR to receive notifications.
                    </p>
                  </div>
                )}

                {notifGroupType === 'broadcast' && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>Warning:</strong> Broadcast will send to ALL connected users. Use with caution.
                    </p>
                  </div>
                )}

                {/* Notification Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notification Type
                  </label>
                  <select
                    value={notifTestType}
                    onChange={(e) => setNotifTestType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="System">System</option>
                    <option value="Announcement">Announcement</option>
                    <option value="Message">Message</option>
                    <option value="GameScore">Game Score</option>
                    <option value="Event">Event</option>
                    <option value="Club">Club</option>
                    <option value="Certification">Certification</option>
                  </select>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={notifTestTitle}
                    onChange={(e) => setNotifTestTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Notification title"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message (optional)
                  </label>
                  <textarea
                    value={notifTestMessage}
                    onChange={(e) => setNotifTestMessage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Notification message"
                  />
                </div>

                {/* Send Button */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={async () => {
                      // Validate based on target type
                      if (notifGroupType === 'user' && !notifTestUserId) {
                        setNotifTestResult({ success: false, message: 'Please select a user' })
                        return
                      }
                      if ((notifGroupType === 'game' || notifGroupType === 'event' || notifGroupType === 'club') && !notifGroupId) {
                        setNotifTestResult({ success: false, message: `Please enter a ${notifGroupType} ID` })
                        return
                      }
                      if (!notifTestTitle.trim()) {
                        setNotifTestResult({ success: false, message: 'Please enter a title' })
                        return
                      }

                      setSendingNotification(true)
                      setNotifTestResult(null)

                      try {
                        const payload = {
                          type: notifTestType,
                          title: notifTestTitle,
                          message: notifTestMessage || null,
                          targetType: notifGroupType,
                          targetId: notifGroupType === 'user' ? parseInt(notifTestUserId) : (notifGroupId ? parseInt(notifGroupId) : null)
                        }

                        const response = await notificationsApi.create(payload)
                        if (response?.success) {
                          setNotifTestResult({ success: true, message: 'Notification sent successfully!' })
                        } else {
                          setNotifTestResult({ success: false, message: response?.message || 'Failed to send notification' })
                        }
                      } catch (error) {
                        console.error('Error sending notification:', error)
                        setNotifTestResult({ success: false, message: error.message || 'Failed to send notification' })
                      } finally {
                        setSendingNotification(false)
                      }
                    }}
                    disabled={sendingNotification}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingNotification ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Notification
                      </>
                    )}
                  </button>

                  {notifTestResult && (
                    <div className={`flex items-center gap-2 ${notifTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                      {notifTestResult.success ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <XCircle className="w-5 h-5" />
                      )}
                      <span className="text-sm">{notifTestResult.message}</span>
                    </div>
                  )}
                </div>

                {/* Info Box */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">How Notifications Work</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• <strong>User:</strong> Sends to a specific user (saved to DB + real-time push)</li>
                    <li>• <strong>Game:</strong> Real-time score updates only - NOT saved to DB (for live game displays)</li>
                    <li>• <strong>Event:</strong> Sends to all registered event participants (saved to DB + real-time)</li>
                    <li>• <strong>Club:</strong> Sends to all club members (saved to DB + real-time)</li>
                    <li>• <strong>Broadcast:</strong> Sends to ALL active users (saved to DB + real-time)</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Edit Modal */}
      {isUserModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setIsUserModalOpen(false)}
            />

            <div className="relative inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="flex justify-between items-center px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
                <button
                  onClick={() => setIsUserModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden">
                    {selectedUser.profileImageUrl ? (
                      <img
                        src={getSharedAssetUrl(selectedUser.profileImageUrl)}
                        alt={`${selectedUser.lastName}, ${selectedUser.firstName}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl font-medium">
                        {(selectedUser.firstName?.[0] || '') + (selectedUser.lastName?.[0] || '')}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedUser.email}</p>
                    <p className="text-sm text-gray-500">ID: {selectedUser.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={selectedUser.firstName || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={selectedUser.lastName || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={selectedUser.role || 'Player'}
                    onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Player">Player</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Account Status</label>
                  <button
                    type="button"
                    onClick={() => setSelectedUser({ ...selectedUser, isActive: !selectedUser.isActive })}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      selectedUser.isActive ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        selectedUser.isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Credential Management Section */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Credential Management</h4>

                  {/* Email Update */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    {editingEmail ? (
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="New email address"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <button
                          onClick={handleUpdateEmail}
                          disabled={savingEmail || !newEmail.trim()}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                        >
                          {savingEmail ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => { setEditingEmail(false); setNewEmail(''); }}
                          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{selectedUser.email}</span>
                        <button
                          onClick={() => { setEditingEmail(true); setNewEmail(selectedUser.email || ''); }}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Change Email
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Password Management */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    {editingPassword ? (
                      <div className="space-y-2">
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New password (min 6 characters)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm password"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSetPassword}
                            disabled={savingPassword || !newPassword.trim() || newPassword !== confirmPassword}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                          >
                            {savingPassword ? 'Saving...' : 'Set Password'}
                          </button>
                          <button
                            onClick={() => { setEditingPassword(false); setNewPassword(''); setConfirmPassword(''); }}
                            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Set a new password directly</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingPassword(true)}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Set Password
                          </button>
                          <button
                            onClick={handleSendPasswordReset}
                            disabled={sendingPasswordReset}
                            className="text-sm text-orange-600 hover:text-orange-800 disabled:opacity-50"
                          >
                            {sendingPasswordReset ? 'Sending...' : 'Send Reset Email'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Test Email */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Test Email</label>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Send a test email to verify notifications work</span>
                      <button
                        onClick={handleSendTestEmail}
                        disabled={sendingTestEmail || !selectedUser.email}
                        className="text-sm text-green-600 hover:text-green-800 disabled:opacity-50"
                      >
                        {sendingTestEmail ? 'Sending...' : 'Send Test Email'}
                      </button>
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    {editingPhone ? (
                      <div className="flex gap-2">
                        <input
                          type="tel"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          placeholder="Phone number (e.g., +1234567890)"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <button
                          onClick={handleUpdatePhone}
                          disabled={savingPhone}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                        >
                          {savingPhone ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => { setEditingPhone(false); setNewPhone(''); }}
                          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{selectedUser.phone || '(not set)'}</span>
                        <button
                          onClick={() => { setEditingPhone(true); setNewPhone(selectedUser.phone || ''); }}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          {selectedUser.phone ? 'Change Phone' : 'Add Phone'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Test SMS */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Test SMS</label>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        {selectedUser.phone ? 'Send a test SMS to verify SMS notifications work' : 'Add a phone number to enable SMS testing'}
                      </span>
                      <button
                        onClick={handleSendTestSms}
                        disabled={sendingTestSms || !selectedUser.phone}
                        className="text-sm text-green-600 hover:text-green-800 disabled:opacity-50"
                      >
                        {sendingTestSms ? 'Sending...' : 'Send Test SMS'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                <button
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUser}
                  disabled={savingUser}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {savingUser ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Edit Modal */}
      {isTemplateModalOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setIsTemplateModalOpen(false)}
            />

            <div className="relative inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center px-6 py-4 border-b sticky top-0 bg-white z-10">
                <h3 className="text-lg font-semibold text-gray-900">
                  {isNewTemplate ? 'Create New Template' : 'Edit Template'}
                </h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePreviewTemplate}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 flex items-center text-sm"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </button>
                  <button
                    onClick={() => setIsTemplateModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-4 space-y-4">
                {/* Template Key (only for new templates) */}
                {isNewTemplate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Template Key <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={selectedTemplate.templateKey || ''}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, templateKey: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., custom_notification"
                    />
                    <p className="text-xs text-gray-500 mt-1">Unique identifier for this template (lowercase, underscores)</p>
                  </div>
                )}

                {/* Template Key display (for existing templates) */}
                {!isNewTemplate && (
                  <div className="flex items-center space-x-2 text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                    <span className="font-medium">Key:</span>
                    <code className="bg-gray-200 px-2 py-0.5 rounded">{selectedTemplate.templateKey}</code>
                    {selectedTemplate.isSystem && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 ml-2">
                        <Shield className="w-3 h-3 mr-1" />
                        System Template
                      </span>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={selectedTemplate.name || ''}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Template display name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={selectedTemplate.category || 'General'}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="General">General</option>
                      <option value="Account">Account</option>
                      <option value="Sessions">Sessions</option>
                      <option value="Purchases">Purchases</option>
                      <option value="Video Reviews">Video Reviews</option>
                      <option value="Certification">Certification</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={selectedTemplate.description || ''}
                    onChange={(e) => setSelectedTemplate({ ...selectedTemplate, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="When is this template used?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={selectedTemplate.subject || ''}
                    onChange={(e) => setSelectedTemplate({ ...selectedTemplate, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Email subject line (supports {{placeholders}})"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Body <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={selectedTemplate.body || ''}
                    onChange={(e) => setSelectedTemplate({ ...selectedTemplate, body: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows={12}
                    placeholder="Email body content (supports {{placeholders}} and {{#if Condition}}...{{/if}})"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Available Placeholders
                  </label>
                  <input
                    type="text"
                    value={selectedTemplate.placeholders?.join(', ') || ''}
                    onChange={(e) => handlePlaceholderChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="FirstName, LastName, Email (comma-separated)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    List of placeholder names available in this template. Use {'{{PlaceholderName}}'} in subject/body.
                  </p>
                </div>

                {/* Placeholder Tags Display */}
                {selectedTemplate.placeholders?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.placeholders.map(p => (
                      <span
                        key={p}
                        className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-mono cursor-pointer hover:bg-blue-100"
                        onClick={() => {
                          navigator.clipboard.writeText(`{{${p}}}`)
                        }}
                        title="Click to copy"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        {`{{${p}}}`}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between py-2">
                  <label className="text-sm font-medium text-gray-700">Active Status</label>
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate({ ...selectedTemplate, isActive: !selectedTemplate.isActive })}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      selectedTemplate.isActive ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        selectedTemplate.isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Help Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Template Syntax Help
                  </h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li><strong>Placeholders:</strong> Use {'{{PlaceholderName}}'} to insert dynamic values</li>
                    <li><strong>Conditionals:</strong> Use {'{{#if Condition}}content{{/if}}'} to show content only when the condition has a value</li>
                    <li><strong>Common placeholders:</strong> OrganizationName, FirstName, LastName, Email</li>
                  </ul>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 sticky bottom-0">
                <button
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate || !selectedTemplate.name || !selectedTemplate.subject || !selectedTemplate.body || (isNewTemplate && !selectedTemplate.templateKey)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {savingTemplate ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {isNewTemplate ? 'Create Template' : 'Save Changes'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setIsPreviewModalOpen(false)}
            />

            <div className="relative inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="flex justify-between items-center px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Template Preview</h3>
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-4">
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Subject</label>
                  <div className="p-3 bg-gray-50 rounded-lg text-gray-900 font-medium">
                    {previewContent.subject}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Body</label>
                  <div className="p-4 bg-gray-50 rounded-lg text-gray-700 whitespace-pre-wrap font-mono text-sm max-h-96 overflow-y-auto">
                    {previewContent.body}
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-4">
                  Note: Placeholders are shown as [PlaceholderName] in this preview. They will be replaced with actual values when the notification is sent.
                </p>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end">
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Video Upload Modal (Legacy single video) */}
      <VideoUploadModal
        isOpen={isHeroVideoModalOpen}
        onClose={() => setIsHeroVideoModalOpen(false)}
        onSave={handleHeroVideoSave}
        currentVideo={themeSettings?.heroVideoUrl}
        objectType="theme"
        title="Hero Video"
        maxSizeMB={100}
      />

      {/* Add New Hero Video Modal (Multiple videos) */}
      <VideoUploadModal
        isOpen={isAddVideoModalOpen}
        onClose={() => setIsAddVideoModalOpen(false)}
        onSave={handleAddHeroVideo}
        objectType="theme"
        title="Add Hero Video"
        maxSizeMB={100}
      />

      {/* Push Notification Modal */}
      {pushModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1100]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-orange-600" />
                Send Push Notification
              </h3>
              <button
                onClick={() => setPushModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-3 text-sm text-gray-600">
              {pushTargetMode === 'online' ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full">
                  🟢 Sending to all online users ({onlineUserCount})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                  👤 Sending to {pushTargetUsers.length} selected user{pushTargetUsers.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                  placeholder="Notification title..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body *</label>
                <textarea
                  value={pushBody}
                  onChange={(e) => setPushBody(e.target.value)}
                  placeholder="Notification message..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL (optional)</label>
                <input
                  type="text"
                  value={pushUrl}
                  onChange={(e) => setPushUrl(e.target.value)}
                  placeholder="/notifications or https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon (optional)</label>
                <input
                  type="text"
                  value={pushIcon}
                  onChange={(e) => setPushIcon(e.target.value)}
                  placeholder="/logo-192.png (default)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <p className="mt-1 text-xs text-gray-400">Path or URL to a square image (192×192 recommended)</p>
              </div>
            </div>

            {pushResult && (
              <div className={`mt-3 p-3 rounded-lg text-sm ${pushResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {pushResult.message}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setPushModalOpen(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!pushTitle.trim() || !pushBody.trim()) {
                    setPushResult({ success: false, message: 'Title and body are required' })
                    return
                  }
                  setSendingPush(true)
                  setPushResult(null)
                  try {
                    let response
                    if (pushTargetMode === 'online') {
                      response = await pushApi.adminSendOnline(pushTitle, pushBody, pushUrl || null, pushIcon || null)
                    } else {
                      response = await pushApi.adminSend(pushTargetUsers, pushTitle, pushBody, pushUrl || null, pushIcon || null)
                    }
                    const data = response?.data || response
                    const sentTo = data?.sentTo ?? 0
                    const targetCount = pushTargetMode === 'online' ? (data?.onlineUsers ?? 0) : pushTargetUsers.length
                    setPushResult({
                      success: true,
                      message: `Push sent to ${sentTo} subscription${sentTo !== 1 ? 's' : ''} across ${targetCount} user${targetCount !== 1 ? 's' : ''}`
                    })
                  } catch (err) {
                    console.error('Error sending push:', err)
                    setPushResult({ success: false, message: err?.response?.data?.message || 'Failed to send push notification' })
                  } finally {
                    setSendingPush(false)
                  }
                }}
                disabled={sendingPush || !pushTitle.trim() || !pushBody.trim()}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {sendingPush ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Push
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Public Profile Modal */}
      {selectedProfileUserId && (
        <PublicProfileModal
          userId={selectedProfileUserId}
          onClose={() => setSelectedProfileUserId(null)}
        />
      )}

      {/* Delete User Confirmation Modal */}
      {deleteUserModal.open && deleteUserModal.user && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-red-600 px-6 py-4 rounded-t-xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Delete User Permanently
              </h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 mb-2">
                  You are about to <strong className="text-red-600">permanently delete</strong> this user:
                </p>
                <div className="bg-gray-100 rounded-lg p-3 mb-4">
                  <p className="font-medium text-gray-900">{deleteUserModal.user.firstName} {deleteUserModal.user.lastName}</p>
                  <p className="text-sm text-gray-600">{deleteUserModal.user.email}</p>
                  <p className="text-xs text-gray-500">ID: {deleteUserModal.user.id}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-800 font-medium mb-1">⚠️ This action cannot be undone!</p>
                  <p className="text-xs text-red-700">
                    This will permanently delete the user from both PickleballCommunity and the shared auth service (FTPBAuth), 
                    including all their data, external logins, and associated records.
                  </p>
                </div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To confirm, type the user's email address:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={deleteUserModal.user.email}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  autoComplete="off"
                />
                {deleteConfirmText && deleteConfirmText !== deleteUserModal.user.email && (
                  <p className="text-xs text-red-600 mt-1">Email does not match</p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setDeleteUserModal({ open: false, user: null })
                    setDeleteConfirmText('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                  disabled={deletingUser}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={deletingUser || deleteConfirmText !== deleteUserModal.user.email}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deletingUser ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Permanently
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
