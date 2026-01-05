import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { userApi, themeApi, sharedAssetApi, getAssetUrl, getSharedAssetUrl, SHARED_AUTH_URL } from '../services/api'
import {
  Users, BookOpen, Calendar, DollarSign, Search, Edit2, Trash2,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Filter, MoreVertical, Eye, X,
  Shield, GraduationCap, User, CheckCircle, XCircle, Save,
  Palette, Upload, RefreshCw, Image, Layers, Check, Award, Tags, UserCog, Video, Building2, HelpCircle, MessageSquare, MapPin, Network
} from 'lucide-react'
import VideoUploadModal from '../components/ui/VideoUploadModal'

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

    // Also fetch presets
    fetchThemePresets()
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
      const response = await sharedAssetApi.upload(file, 'image', 'theme')
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
      const response = await sharedAssetApi.upload(file, 'image', 'theme')
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
      const response = await sharedAssetApi.upload(file, 'image', 'theme')
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

  // Filter users
  const filteredUsers = users.filter(u => {
    const matchesSearch =
      (u.firstName?.toLowerCase() || '').includes(userSearch.toLowerCase()) ||
      (u.lastName?.toLowerCase() || '').includes(userSearch.toLowerCase()) ||
      (u.email?.toLowerCase() || '').includes(userSearch.toLowerCase())
    const matchesRole = userRoleFilter === 'all' || u.role?.toLowerCase() === userRoleFilter.toLowerCase()
    return matchesSearch && matchesRole
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
    setIsUserModalOpen(true)
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
        { id: 'theme', label: 'Theme', icon: Palette }
      ]
    },
    {
      title: 'Content',
      items: [
        { id: 'blog', label: 'Blog', icon: BookOpen },
        { id: 'faq', label: 'FAQ', icon: HelpCircle },
        { id: 'feedback', label: 'Feedback', icon: MessageSquare },
        { id: 'certification', label: 'Certification', icon: Award }
      ]
    },
    {
      title: 'Organization',
      items: [
        { id: 'leagues', label: 'Leagues', icon: Network, href: '/admin/leagues' }
      ]
    },
    {
      title: 'Configuration',
      items: [
        { id: 'eventTypes', label: 'Event Types', icon: Tags },
        { id: 'venueTypes', label: 'Venue Types', icon: Building2 },
        { id: 'clubRoles', label: 'Club Roles', icon: UserCog },
        { id: 'teamUnits', label: 'Team Units', icon: Users },
        { id: 'skillLevels', label: 'Skill Levels', icon: Award }
      ]
    },
    {
      title: 'Coming Soon',
      items: [
        { id: 'events', label: 'Events', icon: Calendar, count: 0, disabled: true },
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
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Filter className="w-5 h-5 text-gray-400" />
                    <select
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Roles</option>
                      <option value="admin">Admin</option>
                      <option value="coach">Coach</option>
                      <option value="student">Student</option>
                    </select>
                  </div>
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
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                          <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {getPaginatedData(filteredUsers).map(u => (
                          <tr key={u.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                                  {u.profileImageUrl ? (
                                    <img
                                      src={getSharedAssetUrl(u.profileImageUrl)}
                                      alt={`${u.firstName} ${u.lastName}`}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white font-medium">
                                      {(u.firstName?.[0] || '') + (u.lastName?.[0] || '')}
                                    </div>
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="font-medium text-gray-900">
                                    {u.firstName || ''} {u.lastName || ''}
                                  </div>
                                  <div className="text-sm text-gray-500">{u.email || 'No email'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(u.role)}`}>
                                {getRoleIcon(u.role)}
                                <span className="ml-1 capitalize">{u.role || 'User'}</span>
                              </span>
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
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleEditUser(u)}
                                className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50"
                              >
                                <Edit2 className="w-4 h-4" />
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
                                src={getAssetUrl(themeSettings.logoUrl)}
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
                                src={getAssetUrl(themeSettings.faviconUrl)}
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
                            src={getAssetUrl(themeSettings.logoUrl)}
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

          {/* Events Tab (Coming Soon) */}
          {activeTab === 'events' && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Events Management</h3>
              <p className="text-gray-500">Coming soon. Manage tournaments, workshops, and events.</p>
            </div>
          )}

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

          {/* Feedback Admin */}
          {activeTab === 'feedback' && <FeedbackAdmin embedded />}

          {/* Certification Admin */}
          {activeTab === 'certification' && <CertificationAdmin embedded />}

          {/* Event Types Admin */}
          {activeTab === 'eventTypes' && <EventTypesAdmin embedded />}

          {/* Venue Types Admin */}
          {activeTab === 'venueTypes' && <VenueTypesAdmin embedded />}

          {/* Club Roles Admin */}
          {activeTab === 'clubRoles' && <ClubMemberRolesAdmin embedded />}

          {/* Team Units Admin */}
          {activeTab === 'teamUnits' && <TeamUnitsAdmin embedded />}

          {/* Skill Levels Admin */}
          {activeTab === 'skillLevels' && <SkillLevelsAdmin embedded />}
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
                        alt={`${selectedUser.firstName} ${selectedUser.lastName}`}
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
                    value={selectedUser.role || 'Student'}
                    onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Student">Student</option>
                    <option value="Coach">Coach</option>
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

      {/* Hero Video Upload Modal */}
      <VideoUploadModal
        isOpen={isHeroVideoModalOpen}
        onClose={() => setIsHeroVideoModalOpen(false)}
        onSave={handleHeroVideoSave}
        currentVideo={themeSettings?.heroVideoUrl}
        objectType="theme"
        title="Hero Video"
        maxSizeMB={100}
      />
    </div>
  )
}

export default AdminDashboard
