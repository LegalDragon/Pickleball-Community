import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { userApi, materialApi, themeApi, getAssetUrl } from '../services/api'
import {
  Users, BookOpen, Calendar, DollarSign, Search, Edit2, Trash2,
  ChevronLeft, ChevronRight, Filter, MoreVertical, Eye, X,
  Shield, GraduationCap, User, CheckCircle, XCircle, Save,
  Palette, Upload, RefreshCw, Image, Layers, Check, Award
} from 'lucide-react'
import { Link } from 'react-router-dom'

const AdminDashboard = () => {
  const { user } = useAuth()
  const { theme: currentTheme, refreshTheme } = useTheme()
  const [activeTab, setActiveTab] = useState('users')
  const [loading, setLoading] = useState(false)

  // Users state
  const [users, setUsers] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [savingUser, setSavingUser] = useState(false)

  // Materials state
  const [materials, setMaterials] = useState([])
  const [materialSearch, setMaterialSearch] = useState('')

  // Theme state
  const [themeSettings, setThemeSettings] = useState(null)
  const [themePresets, setThemePresets] = useState([])
  const [loadingPresets, setLoadingPresets] = useState(false)
  const [savingTheme, setSavingTheme] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const logoInputRef = useRef(null)
  const faviconInputRef = useRef(null)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers()
    } else if (activeTab === 'materials') {
      fetchMaterials()
    } else if (activeTab === 'theme') {
      fetchTheme()
    }
  }, [activeTab])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await userApi.getAllUsers()
      if (response.success && response.data) {
        setUsers(response.data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMaterials = async () => {
    setLoading(true)
    try {
      const response = await materialApi.getMaterials()
      if (response.success && response.data) {
        setMaterials(response.data)
      } else if (Array.isArray(response)) {
        setMaterials(response)
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
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
    organizationName: 'Pickleball College',
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

  // Handle logo upload
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    try {
      const response = await themeApi.uploadLogo(file)
      if (response.success && response.data) {
        setThemeSettings(prev => ({ ...prev, logoUrl: response.data.url }))
        await refreshTheme()
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
      const response = await themeApi.uploadFavicon(file)
      if (response.success && response.data) {
        setThemeSettings(prev => ({ ...prev, faviconUrl: response.data.url }))
        await refreshTheme()
      }
    } catch (error) {
      console.error('Error uploading favicon:', error)
      alert('Failed to upload favicon')
    } finally {
      setUploadingFavicon(false)
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

  // Filter materials
  const filteredMaterials = materials.filter(m => {
    return (m.title?.toLowerCase() || '').includes(materialSearch.toLowerCase()) ||
           (m.description?.toLowerCase() || '').includes(materialSearch.toLowerCase())
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

  // Sidebar navigation items
  const navItems = [
    { id: 'users', label: 'Users', icon: Users, count: users.length },
    { id: 'materials', label: 'Materials', icon: BookOpen, count: materials.length },
    { id: 'theme', label: 'Theme', icon: Palette },
    { id: 'certification', label: 'Certification', icon: Award, link: '/admin/certification' },
    { id: 'events', label: 'Events', icon: Calendar, count: 0, disabled: true },
    { id: 'transactions', label: 'Transactions', icon: DollarSign, count: 0, disabled: true }
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
            {navItems.map(item => (
              item.link ? (
                <Link
                  key={item.id}
                  to={item.link}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition text-gray-600 hover:bg-gray-50"
                >
                  <div className="flex items-center">
                    <item.icon className="w-5 h-5 mr-3" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                </Link>
              ) : (
                <button
                  key={item.id}
                  onClick={() => !item.disabled && setActiveTab(item.id)}
                  disabled={item.disabled}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition ${
                    activeTab === item.id
                      ? 'bg-blue-50 text-blue-700'
                      : item.disabled
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    <item.icon className="w-5 h-5 mr-3" />
                    <span className="font-medium">{item.label}</span>
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
              )
            ))}
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
                                      src={getAssetUrl(u.profileImageUrl)}
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
                                    {u.firstName} {u.lastName}
                                  </div>
                                  <div className="text-sm text-gray-500">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(u.role)}`}>
                                {getRoleIcon(u.role)}
                                <span className="ml-1 capitalize">{u.role}</span>
                              </span>
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
                              {new Date(u.createdAt).toLocaleDateString()}
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

                    {filteredUsers.length === 0 && (
                      <div className="p-12 text-center">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No users found</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Materials Tab */}
          {activeTab === 'materials' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Materials Management</h2>
              </div>

              {/* Search */}
              <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search materials..."
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Materials Grid */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {loading ? (
                  <div className="p-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-500">Loading materials...</p>
                  </div>
                ) : (
                  <>
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coach</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                          <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {getPaginatedData(filteredMaterials).map(m => (
                          <tr key={m.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="w-16 h-12 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                                  {m.thumbnailUrl ? (
                                    <img
                                      src={getAssetUrl(m.thumbnailUrl)}
                                      alt={m.title}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                      <BookOpen className="w-6 h-6 text-gray-400" />
                                    </div>
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="font-medium text-gray-900">{m.title}</div>
                                  <div className="text-sm text-gray-500 truncate max-w-xs">
                                    {m.description?.substring(0, 50)}...
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {m.contentType}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {m.coachName || 'Unknown'}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              ${m.price?.toFixed(2) || '0.00'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50">
                                <Eye className="w-4 h-4" />
                              </button>
                              <button className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 ml-2">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {filteredMaterials.length === 0 && (
                      <div className="p-12 text-center">
                        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No materials found</p>
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
                        src={getAssetUrl(selectedUser.profileImageUrl)}
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
    </div>
  )
}

export default AdminDashboard
