import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { materialApi, sessionApi, courseApi, videoReviewApi, getAssetUrl } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Users, DollarSign, Video, Calendar, RefreshCw, AlertCircle, Eye, Edit2, BookOpen, Clock, Check, X, MapPin, Link as LinkIcon, Loader2, Play, MessageSquare, FileText } from 'lucide-react'

const CoachDashboard = () => {
  const [materials, setMaterials] = useState([])
  const [courses, setCourses] = useState([])
  const [sessions, setSessions] = useState([])
  const [pendingSessions, setPendingSessions] = useState([])
  const [openVideoRequests, setOpenVideoRequests] = useState([])
  const [myVideoReviews, setMyVideoReviews] = useState([])
  const [stats, setStats] = useState({
    totalMaterials: 0,
    totalCourses: 0,
    totalEarnings: 0,
    upcomingSessions: 0,
    pendingRequests: 0,
    openVideoRequests: 0
  })
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // Session management state
  const [selectedSession, setSelectedSession] = useState(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showSessionProposalModal, setShowSessionProposalModal] = useState(false)

  // Video review proposal state
  const [selectedVideoRequest, setSelectedVideoRequest] = useState(null)
  const [showProposalModal, setShowProposalModal] = useState(false)

  const { user, loading: authLoading } = useAuth() // Get auth loading state
  const navigate = useNavigate()

  useEffect(() => {
    console.log('CoachDashboard - Auth loading:', authLoading)
    console.log('CoachDashboard - User:', user)

    // Wait for auth to finish loading
    if (authLoading) {
      console.log('Auth still loading, waiting...')
      return
    }

    // Check if user exists AFTER auth finishes loading
    if (!user) {
      console.log('No user after auth loaded, redirecting to login')
      //navigate('/login')
      return
    }

    // Check user role
    if (user.role !== 'Coach') {
      console.log(`User role is ${user.role}, redirecting`)
      navigate(user.role === 'Student' ? '/student/dashboard' : '/')
      return
    }

    // Load dashboard data
    if (user.id) {
      console.log('User is coach, loading dashboard data...')
      loadDashboardData()
    } else {
      console.error('User missing id property:', user)
      setError('User data incomplete')
      setLoadingData(false)
    }
  }, [user, authLoading, navigate])

  const loadDashboardData = async () => {
    try {
      setError(null)
      setLoadingData(true)

      console.log('Loading dashboard data for coach ID:', user.id)

      const [materialsData, coursesData, sessionsData, pendingData, openVideoData, myVideoData] = await Promise.all([
        materialApi.getCoachMaterials(user.id),
        courseApi.getCoachCourses(user.id),
        sessionApi.getCoachSessions(user.id),
        sessionApi.getPendingSessions().catch(() => []),
        videoReviewApi.getOpenRequests().catch(() => []),
        videoReviewApi.getCoachRequests().catch(() => [])
      ])

      console.log('Materials data:', materialsData)
      console.log('Courses data:', coursesData)
      console.log('Sessions data:', sessionsData)
      console.log('Pending sessions:', pendingData)
      console.log('Open video requests:', openVideoData)
      console.log('My video reviews:', myVideoData)

      setMaterials(Array.isArray(materialsData) ? materialsData.slice(0, 5) : [])
      setCourses(Array.isArray(coursesData) ? coursesData.slice(0, 5) : [])
      setSessions(Array.isArray(sessionsData) ? sessionsData.filter(s => s.status !== 'Pending').slice(0, 5) : [])
      setPendingSessions(Array.isArray(pendingData) ? pendingData : [])
      setOpenVideoRequests(Array.isArray(openVideoData) ? openVideoData : [])
      setMyVideoReviews(Array.isArray(myVideoData) ? myVideoData.filter(r => r.status === 'Accepted') : [])

      // Calculate stats
      const totalEarnings = Array.isArray(materialsData) ? materialsData.reduce((sum, material) => {
        return sum + ((material.price || 0) * (material.purchases || 10))
      }, 0) : 0

      const upcomingSessions = Array.isArray(sessionsData) ? sessionsData.filter(session => {
        try {
          if (!session?.requestedAt && !session?.scheduledAt) return false
          const sessionDate = new Date(session.requestedAt || session.scheduledAt)
          return sessionDate > new Date() && session.status === 'Confirmed'
        } catch (e) {
          console.error('Error parsing session date:', e)
          return false
        }
      }).length : 0

      setStats({
        totalMaterials: Array.isArray(materialsData) ? materialsData.length : 0,
        totalCourses: Array.isArray(coursesData) ? coursesData.length : 0,
        totalEarnings,
        upcomingSessions,
        pendingRequests: Array.isArray(pendingData) ? pendingData.length : 0,
        openVideoRequests: Array.isArray(openVideoData) ? openVideoData.length : 0
      })

    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      setError(error.message || 'Failed to load dashboard data. Please try again.')
    } finally {
      setLoadingData(false)
      setRefreshing(false)
    }
  }

  const handleConfirmSession = (session) => {
    setSelectedSession(session)
    setShowConfirmModal(true)
  }

  const handleProposeSessionChanges = (session) => {
    setSelectedSession(session)
    setShowSessionProposalModal(true)
  }

  const handleRejectSession = async (sessionId) => {
    if (!confirm('Are you sure you want to reject this session request?')) return
    try {
      await sessionApi.cancelSession(sessionId)
      loadDashboardData()
    } catch (error) {
      alert('Failed to reject session: ' + (error.message || 'Unknown error'))
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    loadDashboardData()
  }

  // Show loading while auth is loading OR dashboard data is loading
  if (authLoading || loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? 'Checking authentication...' : 'Loading dashboard...'}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Coach Dashboard</h1>
          </div>
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Dashboard</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Safety check - should never reach here without user, but just in case
  if (!user) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with refresh button */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Coach Dashboard</h1>
            <p className="mt-2 text-gray-600">
              Welcome back, {user?.firstName || 'Coach'}!
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Video className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Materials</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalMaterials}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Courses</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalCourses}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                <p className="text-2xl font-bold text-gray-900">${stats.totalEarnings.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Upcoming Sessions</p>
                <p className="text-2xl font-bold text-gray-900">{stats.upcomingSessions}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Requests</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingRequests}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Play className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Video Reviews</p>
                <p className="text-2xl font-bold text-gray-900">{stats.openVideoRequests}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Session Requests */}
        {pendingSessions.length > 0 && (
          <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-yellow-200">
              <h2 className="text-lg font-medium text-yellow-800 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Pending Session Requests ({pendingSessions.length})
              </h2>
            </div>
            <div className="divide-y divide-yellow-200">
              {pendingSessions.map((session) => (
                <div key={session.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900">
                        {session.studentName || `${session.student?.firstName || 'Student'} ${session.student?.lastName || ''}`}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        {session.requestedAt ? (
                          <>
                            {new Date(session.requestedAt).toLocaleDateString()} at{' '}
                            {new Date(session.requestedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </>
                        ) : (
                          'Date not specified'
                        )}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {session.durationMinutes} min • {session.sessionType}
                      </p>
                      {session.notes && (
                        <p className="text-sm text-gray-500 mt-2 italic bg-white p-2 rounded">
                          "{session.notes}"
                        </p>
                      )}
                    </div>
                    <div className="ml-4 flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleConfirmSession(session)}
                        className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        Accept
                      </button>
                      <button
                        onClick={() => handleProposeSessionChanges(session)}
                        className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        Propose Changes
                      </button>
                      <button
                        onClick={() => handleRejectSession(session.id)}
                        className="flex items-center gap-1 px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Open Video Review Requests - Marketplace */}
        {openVideoRequests.length > 0 && (
          <div className="mb-8 bg-orange-50 border border-orange-200 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-orange-200">
              <h2 className="text-lg font-medium text-orange-800 flex items-center gap-2">
                <Play className="w-5 h-5" />
                Video Review Marketplace ({openVideoRequests.length} open requests)
              </h2>
              <p className="text-sm text-orange-600 mt-1">
                Students are looking for coaches to review their videos. Make a proposal to get started!
              </p>
            </div>
            <div className="divide-y divide-orange-200">
              {openVideoRequests.slice(0, 5).map((request) => (
                <div key={request.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900">{request.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        by {request.studentName}
                      </p>
                      {request.description && (
                        <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                          {request.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-lg font-bold text-orange-600">
                          ${request.offeredPrice?.toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </span>
                        {(request.videoUrl || request.externalVideoLink) && (
                          <a
                            href={request.externalVideoLink || request.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                          >
                            <Video className="w-3 h-3" /> Watch Video
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedVideoRequest(request)
                        setShowProposalModal(true)
                      }}
                      className="ml-4 flex items-center gap-1 px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Make Proposal
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Materials - Updated with Edit links */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">Recent Materials</h2>
                <Link
                  to="/Coach/Materials/Create"
                  className="flex items-center text-primary-600 hover:text-primary-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Create New
                </Link>
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {materials.length > 0 ? (
                materials.map((material) => (
                  <div key={material.id || material._id} className="px-6 py-4 hover:bg-gray-50 group">
                    <div className="flex items-start">
                      {/* Thumbnail */}
                      <div className="flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-gray-100 mr-4">
                        {material.thumbnailUrl ? (
                          <img
                            src={getAssetUrl(material.thumbnailUrl)}
                            alt={material.title || 'Material thumbnail'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">{material.title || 'Untitled Material'}</h3>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                          {material.description || 'No description'}
                        </p>
                        <div className="flex items-center mt-2 space-x-3">
                          <span className="text-sm font-medium text-gray-900">
                            ${material.price ? material.price.toFixed(2) : '0.00'}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                            {material.contentType || 'Unknown'}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="ml-4 flex items-center space-x-1">
                        <Link
                          to={`/coach/materials/${material.id || material._id}`}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/coach/materials/edit/${material.id || material._id}`}
                          className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-center">
                  <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No materials yet</p>
                  <Link
                    to="/Coach/Materials/Create"
                    className="inline-block mt-2 text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    Create your first material
                  </Link>
                </div>
              )}
            </div>
            {materials.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <Link
                  to="/coach/materials"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  View all materials →
                </Link>
              </div>
            )}
          </div>

          {/* Recent Courses */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">Recent Courses</h2>
                <Link
                  to="/coach/courses/create"
                  className="flex items-center text-primary-600 hover:text-primary-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Create New
                </Link>
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {courses.length > 0 ? (
                courses.map((course) => (
                  <div key={course.id} className="px-6 py-4 hover:bg-gray-50 group">
                    <div className="flex items-start">
                      {/* Thumbnail */}
                      <div className="flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-gray-100 mr-4">
                        {course.thumbnailUrl ? (
                          <img
                            src={getAssetUrl(course.thumbnailUrl)}
                            alt={course.title || 'Course thumbnail'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">{course.title || 'Untitled Course'}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {course.materialCount || 0} materials • {course.previewCount || 0} previews
                        </p>
                        <div className="flex items-center mt-2 space-x-3">
                          <span className="text-sm font-medium text-gray-900">
                            ${course.price ? course.price.toFixed(2) : '0.00'}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            course.isPublished
                              ? 'bg-green-100 text-green-600'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {course.isPublished ? 'Published' : 'Draft'}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="ml-4 flex items-center space-x-1">
                        <Link
                          to={`/coach/courses/edit/${course.id}`}
                          className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-center">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No courses yet</p>
                  <Link
                    to="/coach/courses/create"
                    className="inline-block mt-2 text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    Create your first course
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Blog Management - Full Width Quick Access */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Blog Posts</h2>
              <Link
                to="/coach/blog"
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                Manage All Posts →
              </Link>
            </div>
          </div>
          <div className="px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-gray-900 font-medium">Share your expertise with blog posts</p>
                  <p className="text-sm text-gray-500">Write tips, strategies, and insights for your students</p>
                </div>
              </div>
              <Link
                to="/coach/blog/new"
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Plus className="w-4 h-4" />
                Write New Post
              </Link>
            </div>
          </div>
        </div>

        {/* Upcoming Sessions - Full Width */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Upcoming Sessions</h2>
          </div>
            <div className="divide-y divide-gray-200">
              {sessions.length > 0 ? (
                sessions.map((session) => (
                  <div key={session.id || session._id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">
                          Session with {session.student?.firstName || 'Student'} {session.student?.lastName || ''}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {session.scheduledAt ? (
                            <>
                              {new Date(session.scheduledAt).toLocaleDateString()} at{' '}
                              {new Date(session.scheduledAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </>
                          ) : (
                            'Date not scheduled'
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          ${session.price ? session.price.toFixed(2) : '0.00'}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                          {session.sessionType || 'Session'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-center">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No upcoming sessions</p>
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Session Confirmation Modal */}
      {showConfirmModal && selectedSession && (
        <ConfirmSessionModal
          session={selectedSession}
          onClose={() => {
            setShowConfirmModal(false)
            setSelectedSession(null)
          }}
          onSuccess={() => {
            setShowConfirmModal(false)
            setSelectedSession(null)
            loadDashboardData()
          }}
        />
      )}

      {/* Video Review Proposal Modal */}
      {showProposalModal && selectedVideoRequest && (
        <VideoProposalModal
          request={selectedVideoRequest}
          onClose={() => {
            setShowProposalModal(false)
            setSelectedVideoRequest(null)
          }}
          onSuccess={() => {
            setShowProposalModal(false)
            setSelectedVideoRequest(null)
            loadDashboardData()
          }}
        />
      )}

      {/* Session Proposal Modal */}
      {showSessionProposalModal && selectedSession && (
        <SessionProposalModal
          session={selectedSession}
          onClose={() => {
            setShowSessionProposalModal(false)
            setSelectedSession(null)
          }}
          onSuccess={() => {
            setShowSessionProposalModal(false)
            setSelectedSession(null)
            loadDashboardData()
          }}
        />
      )}
    </div>
  )
}

// Confirm Session Modal Component
const ConfirmSessionModal = ({ session, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    price: session.price || 50,
    meetingLink: '',
    location: ''
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await sessionApi.confirmSession(session.id, {
        price: formData.price,
        meetingLink: session.sessionType === 'Online' ? formData.meetingLink : null,
        location: session.sessionType === 'InPerson' ? formData.location : null
      })
      onSuccess()
    } catch (error) {
      alert('Failed to confirm session: ' + (error.message || 'Unknown error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Confirm Session Request</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-gray-50 border-b">
          <p className="text-sm text-gray-600">
            <strong>Student:</strong> {session.studentName || `${session.student?.firstName} ${session.student?.lastName}`}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            <strong>Requested:</strong> {session.requestedAt ? new Date(session.requestedAt).toLocaleString() : 'Not specified'}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            <strong>Duration:</strong> {session.durationMinutes} minutes • {session.sessionType}
          </p>
          {session.notes && (
            <p className="text-sm text-gray-600 mt-2">
              <strong>Notes:</strong> "{session.notes}"
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session Price ($)
            </label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
              min={0}
              step={5}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          {session.sessionType === 'Online' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <LinkIcon className="w-4 h-4 inline mr-1" />
                Meeting Link
              </label>
              <input
                type="url"
                value={formData.meetingLink}
                onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                placeholder="https://zoom.us/j/... or Google Meet link"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Paste your Zoom, Google Meet, or other video call link
              </p>
            </div>
          )}

          {session.sessionType === 'InPerson' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin className="w-4 h-4 inline mr-1" />
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Central Park Courts, 123 Main St..."
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm Session
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Video Review Proposal Modal Component
const VideoProposalModal = ({ request, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    proposedPrice: request.offeredPrice || 25,
    note: ''
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await videoReviewApi.propose(request.id, {
        proposedPrice: formData.proposedPrice,
        note: formData.note || null
      })
      onSuccess()
    } catch (error) {
      alert('Failed to submit proposal: ' + (error.message || 'Unknown error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Make a Proposal</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-gray-50 border-b">
          <h4 className="font-medium text-gray-900">{request.title}</h4>
          <p className="text-sm text-gray-600 mt-1">
            <strong>Student:</strong> {request.studentName}
          </p>
          {request.description && (
            <p className="text-sm text-gray-600 mt-1">{request.description}</p>
          )}
          <p className="text-sm text-gray-600 mt-2">
            <strong>Student's offer:</strong>{' '}
            <span className="text-orange-600 font-bold">${request.offeredPrice?.toFixed(2)}</span>
          </p>
          {(request.videoUrl || request.externalVideoLink) && (
            <a
              href={request.externalVideoLink || request.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-2"
            >
              <Video className="w-4 h-4" /> Watch Student's Video
            </a>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Proposed Price ($)
            </label>
            <input
              type="number"
              value={formData.proposedPrice}
              onChange={(e) => setFormData({ ...formData, proposedPrice: Number(e.target.value) })}
              min={5}
              step={5}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              You can match the student's offer or propose a different price
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message to Student (optional)
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={3}
              placeholder="Introduce yourself, explain your experience, or ask questions about what they need..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-sm text-orange-800">
              <strong>How it works:</strong> Your proposal will be sent to the student.
              If they accept, you'll be assigned to review their video.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Proposal
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Session Proposal Modal Component (Coach proposes changes to session request)
const SessionProposalModal = ({ session, onClose, onSuccess }) => {
  // Initialize with session's current values
  const [formData, setFormData] = useState({
    proposedScheduledAt: session.requestedAt
      ? new Date(session.requestedAt).toISOString().slice(0, 16)
      : '',
    proposedDurationMinutes: session.durationMinutes || 60,
    proposedPrice: session.price || 50,
    proposedLocation: session.location || '',
    note: ''
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await sessionApi.proposeChanges(session.id, {
        proposedScheduledAt: formData.proposedScheduledAt ? new Date(formData.proposedScheduledAt).toISOString() : null,
        proposedDurationMinutes: formData.proposedDurationMinutes,
        proposedPrice: formData.proposedPrice,
        proposedLocation: session.sessionType === 'InPerson' ? formData.proposedLocation : null,
        note: formData.note || null
      })
      onSuccess()
    } catch (error) {
      alert('Failed to submit proposal: ' + (error.message || 'Unknown error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Propose Session Changes</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-gray-50 border-b">
          <p className="text-sm text-gray-600">
            <strong>Student:</strong> {session.studentName || `${session.student?.firstName} ${session.student?.lastName}`}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            <strong>Original Request:</strong> {session.requestedAt ? new Date(session.requestedAt).toLocaleString() : 'Not specified'}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            <strong>Duration:</strong> {session.durationMinutes} minutes • {session.sessionType}
          </p>
          {session.notes && (
            <p className="text-sm text-gray-600 mt-2">
              <strong>Notes:</strong> "{session.notes}"
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Proposed Date & Time
            </label>
            <input
              type="datetime-local"
              value={formData.proposedScheduledAt}
              onChange={(e) => setFormData({ ...formData, proposedScheduledAt: e.target.value })}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to accept the student's requested time
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock className="w-4 h-4 inline mr-1" />
              Proposed Duration
            </label>
            <select
              value={formData.proposedDurationMinutes}
              onChange={(e) => setFormData({ ...formData, proposedDurationMinutes: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Proposed Price ($)
            </label>
            <input
              type="number"
              value={formData.proposedPrice}
              onChange={(e) => setFormData({ ...formData, proposedPrice: Number(e.target.value) })}
              min={0}
              step={5}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          {session.sessionType === 'InPerson' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin className="w-4 h-4 inline mr-1" />
                Proposed Location
              </label>
              <input
                type="text"
                value={formData.proposedLocation}
                onChange={(e) => setFormData({ ...formData, proposedLocation: e.target.value })}
                placeholder="e.g., Central Park Courts, 123 Main St..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Message to Student (optional)
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={3}
              placeholder="Explain the reason for the proposed changes..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>How it works:</strong> Your proposed changes will be sent to the student.
              They can accept, decline, or request something different.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Proposal
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CoachDashboard