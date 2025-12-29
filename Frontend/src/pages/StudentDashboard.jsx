import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Search, Filter, Star, Calendar, Video, BookOpen, Users,
  Clock, DollarSign, Upload, X, ChevronDown, Tag, Loader2,
  ShoppingBag, MessageSquare, CheckCircle, AlertCircle, ExternalLink,
  Award
} from 'lucide-react'
import {
  courseApi, materialApi, sessionApi, ratingApi, tagApi,
  videoReviewApi, coachApi, assetApi, getAssetUrl
} from '../services/api'
import StarRating from '../components/StarRating'
import TagSelector, { TagDisplay } from '../components/TagSelector'

const StudentDashboard = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('browse')
  const [loading, setLoading] = useState(true)

  // Browse tab state
  const [searchQuery, setSearchQuery] = useState('')
  const [browseType, setBrowseType] = useState('courses') // courses, materials, coaches
  const [courses, setCourses] = useState([])
  const [materials, setMaterials] = useState([])
  const [coaches, setCoaches] = useState([])
  const [ratingSummaries, setRatingSummaries] = useState({})
  const [minRating, setMinRating] = useState(0)
  const [tagFilter, setTagFilter] = useState('')

  // Sessions tab state
  const [sessions, setSessions] = useState([])

  // Video reviews tab state
  const [videoRequests, setVideoRequests] = useState([])
  const [showVideoUploadModal, setShowVideoUploadModal] = useState(false)

  // Session request modal state
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [selectedCoach, setSelectedCoach] = useState(null)

  useEffect(() => {
    loadData()
  }, [activeTab, browseType])

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'browse') {
        await loadBrowseData()
      } else if (activeTab === 'sessions') {
        await loadSessions()
      } else if (activeTab === 'reviews') {
        await loadVideoReviews()
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadBrowseData = async () => {
    if (browseType === 'courses') {
      const data = await courseApi.getCourses()
      setCourses(data || [])
      if (data?.length > 0) {
        const summaries = await ratingApi.getSummaries('Course', data.map(c => c.id))
        setRatingSummaries(summaries || {})
      }
    } else if (browseType === 'materials') {
      const data = await materialApi.getMaterials()
      setMaterials(data || [])
      if (data?.length > 0) {
        const summaries = await ratingApi.getSummaries('Material', data.map(m => m.id))
        setRatingSummaries(summaries || {})
      }
    } else if (browseType === 'coaches') {
      const data = await coachApi.getCoaches()
      setCoaches(data || [])
      if (data?.length > 0) {
        const summaries = await ratingApi.getSummaries('Coach', data.map(c => c.id))
        setRatingSummaries(summaries || {})
      }
    }
  }

  const loadSessions = async () => {
    const data = await sessionApi.getStudentSessions()
    setSessions(data || [])
  }

  const loadVideoReviews = async () => {
    const data = await videoReviewApi.getMyRequests()
    setVideoRequests(data || [])
  }

  // Filter items based on search and rating
  const filterItems = (items, nameField = 'title') => {
    return items.filter(item => {
      const matchesSearch = !searchQuery ||
        item[nameField]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())

      const rating = ratingSummaries[item.id]?.averageRating || 0
      const matchesRating = rating >= minRating

      return matchesSearch && matchesRating
    })
  }

  const filteredCourses = filterItems(courses, 'title')
  const filteredMaterials = filterItems(materials, 'title')
  const filteredCoaches = filterItems(coaches, 'firstName')

  const handlePurchaseCourse = async (courseId) => {
    try {
      await courseApi.purchaseCourse(courseId)
      alert('Course purchased successfully!')
      loadBrowseData()
    } catch (error) {
      alert('Failed to purchase course: ' + (error.message || 'Unknown error'))
    }
  }

  const handlePurchaseMaterial = async (materialId) => {
    try {
      await materialApi.purchaseMaterial(materialId)
      alert('Material purchased successfully!')
      loadBrowseData()
    } catch (error) {
      alert('Failed to purchase material: ' + (error.message || 'Unknown error'))
    }
  }

  const handleRequestSession = (coach) => {
    setSelectedCoach(coach)
    setShowSessionModal(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
          <p className="mt-2 text-gray-600">Welcome back, {user?.firstName}!</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {[
                { id: 'browse', label: 'Browse', icon: Search },
                { id: 'sessions', label: 'My Sessions', icon: Calendar },
                { id: 'reviews', label: 'Video Reviews', icon: Video }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
              <Link
                to="/my-certificate"
                className="flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
              >
                <Award className="w-4 h-4" />
                My Certificate
              </Link>
            </nav>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              </div>
            ) : (
              <>
                {/* Browse Tab */}
                {activeTab === 'browse' && (
                  <BrowseTab
                    browseType={browseType}
                    setBrowseType={setBrowseType}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    minRating={minRating}
                    setMinRating={setMinRating}
                    courses={filteredCourses}
                    materials={filteredMaterials}
                    coaches={filteredCoaches}
                    ratingSummaries={ratingSummaries}
                    onPurchaseCourse={handlePurchaseCourse}
                    onPurchaseMaterial={handlePurchaseMaterial}
                    onRequestSession={handleRequestSession}
                  />
                )}

                {/* Sessions Tab */}
                {activeTab === 'sessions' && (
                  <SessionsTab sessions={sessions} onRefresh={loadSessions} />
                )}

                {/* Video Reviews Tab */}
                {activeTab === 'reviews' && (
                  <VideoReviewsTab
                    requests={videoRequests}
                    coaches={coaches}
                    onRefresh={loadVideoReviews}
                    showUploadModal={showVideoUploadModal}
                    setShowUploadModal={setShowVideoUploadModal}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Session Request Modal */}
      {showSessionModal && selectedCoach && (
        <SessionRequestModal
          coach={selectedCoach}
          onClose={() => {
            setShowSessionModal(false)
            setSelectedCoach(null)
          }}
          onSuccess={() => {
            setShowSessionModal(false)
            setSelectedCoach(null)
            setActiveTab('sessions')
            loadSessions()
          }}
        />
      )}
    </div>
  )
}

// Browse Tab Component
const BrowseTab = ({
  browseType, setBrowseType, searchQuery, setSearchQuery,
  minRating, setMinRating, courses, materials, coaches,
  ratingSummaries, onPurchaseCourse, onPurchaseMaterial, onRequestSession
}) => {
  return (
    <div className="space-y-6">
      {/* Type Selection and Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex gap-2">
          {['courses', 'materials', 'coaches'].map(type => (
            <button
              key={type}
              onClick={() => setBrowseType(type)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                browseType === type
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${browseType}...`}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
          >
            <option value={0}>All Ratings</option>
            <option value={4}>4+ Stars</option>
            <option value={3}>3+ Stars</option>
            <option value={2}>2+ Stars</option>
          </select>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {browseType === 'courses' && courses.map(course => (
          <CourseCard
            key={course.id}
            course={course}
            rating={ratingSummaries[course.id]}
            onPurchase={() => onPurchaseCourse(course.id)}
          />
        ))}

        {browseType === 'materials' && materials.map(material => (
          <MaterialCard
            key={material.id}
            material={material}
            rating={ratingSummaries[material.id]}
            onPurchase={() => onPurchaseMaterial(material.id)}
          />
        ))}

        {browseType === 'coaches' && coaches.map(coach => (
          <CoachCard
            key={coach.id}
            coach={coach}
            rating={ratingSummaries[coach.id]}
            onRequestSession={() => onRequestSession(coach)}
          />
        ))}

        {((browseType === 'courses' && courses.length === 0) ||
          (browseType === 'materials' && materials.length === 0) ||
          (browseType === 'coaches' && coaches.length === 0)) && (
          <div className="col-span-full text-center py-12 text-gray-500">
            No {browseType} found matching your criteria
          </div>
        )}
      </div>
    </div>
  )
}

// Course Card
const CourseCard = ({ course, rating, onPurchase }) => (
  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
    {course.thumbnailUrl ? (
      <div className="relative">
        <img
          src={getAssetUrl(course.thumbnailUrl)}
          alt={course.title}
          className="w-full h-40 object-cover"
        />
        {course.hasPurchased && (
          <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Purchased
          </div>
        )}
      </div>
    ) : course.hasPurchased && (
      <div className="bg-green-50 px-3 py-2 flex items-center gap-1 text-green-700 text-xs font-medium">
        <CheckCircle className="w-3 h-3" />
        Purchased
      </div>
    )}
    <div className="p-4">
      <h3 className="font-semibold text-gray-900 mb-2">{course.title}</h3>
      <p className="text-sm text-gray-600 line-clamp-2 mb-3">{course.description}</p>

      <div className="flex items-center gap-2 mb-3">
        <StarRating rating={rating?.averageRating || 0} size={14} />
        <span className="text-sm text-gray-500">
          ({rating?.totalRatings || 0} reviews)
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-primary-600">
          ${course.price?.toFixed(2)}
        </span>
        {course.hasPurchased ? (
          <Link
            to={`/courses/${course.id}`}
            className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors"
          >
            View Course
          </Link>
        ) : (
          <button
            onClick={onPurchase}
            className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 transition-colors"
          >
            Purchase
          </button>
        )}
      </div>
    </div>
  </div>
)

// Material Card - Detailed view matching MaterialDetail page
const MaterialCard = ({ material, rating, onPurchase }) => {
  const [showContent, setShowContent] = useState(false)

  const hasVideo = material.videoUrl
  const hasExternalLink = material.externalLink

  const getContentTypeIcon = (type) => {
    switch (type) {
      case 'Video': return <Video className="w-5 h-5" />
      case 'Image': return <BookOpen className="w-5 h-5" />
      case 'Document': return <BookOpen className="w-5 h-5" />
      case 'Link': return <ExternalLink className="w-5 h-5" />
      default: return <Video className="w-5 h-5" />
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-lg">{material.title}</h3>
            <div className="flex items-center mt-1 text-sm text-gray-500">
              {getContentTypeIcon(material.contentType)}
              <span className="ml-2 capitalize">
                {material.contentType || 'Unknown'}
              </span>
              <span className="mx-2">•</span>
              <span className="font-semibold text-primary-600">
                ${(material.price ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
          {material.hasPurchased && (
            <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              <CheckCircle className="w-3 h-3" />
              Purchased
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Description */}
        <div className="mb-4">
          <p className="text-sm text-gray-600 line-clamp-3">{material.description || 'No description'}</p>
        </div>

        {/* Coach Info */}
        {material.coach && (
          <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
            {material.coach.profileImageUrl ? (
              <img
                src={getAssetUrl(material.coach.profileImageUrl)}
                alt={`${material.coach.firstName} ${material.coach.lastName}`}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                <Users className="w-3 h-3 text-primary-600" />
              </div>
            )}
            <span>By {material.coach.firstName} {material.coach.lastName}</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-gray-50 p-2 rounded-lg">
            <p className="text-xs text-gray-500">Rating</p>
            <div className="flex items-center">
              <StarRating rating={rating?.averageRating || 0} size={12} />
              <span className="ml-1 text-sm font-medium text-gray-900">
                {rating?.averageRating?.toFixed(1) || '0.0'}
              </span>
            </div>
          </div>
          <div className="bg-gray-50 p-2 rounded-lg">
            <p className="text-xs text-gray-500">Reviews</p>
            <p className="text-sm font-medium text-gray-900">{rating?.totalRatings || 0}</p>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-3 border-t border-gray-100">
          {material.hasPurchased ? (
            <button
              onClick={() => setShowContent(true)}
              className="w-full px-4 py-2.5 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
            >
              <Video className="w-4 h-4" />
              View Content
            </button>
          ) : (
            <button
              onClick={onPurchase}
              className="w-full px-4 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              Purchase for ${(material.price ?? 0).toFixed(2)}
            </button>
          )}
        </div>
      </div>

      {/* Content Viewer Modal for owned materials */}
      {showContent && material.hasPurchased && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{material.title}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {getContentTypeIcon(material.contentType)}
                  <span className="ml-1 capitalize">{material.contentType}</span>
                </p>
              </div>
              <button
                onClick={() => setShowContent(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
              {hasVideo && (
                <div className="mb-4">
                  <video
                    controls
                    className="w-full rounded-lg bg-black"
                    src={getAssetUrl(material.videoUrl)}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}

              {hasExternalLink && (
                <div className="mb-4">
                  <a
                    href={material.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <ExternalLink className="w-5 h-5" />
                    <span>Open External Content</span>
                  </a>
                </div>
              )}

              {!hasVideo && !hasExternalLink && (
                <div className="text-center py-8 text-gray-500">
                  <Video className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No video or content available for this material.</p>
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                <p className="text-gray-600 whitespace-pre-wrap">{material.description}</p>
              </div>

              {/* Stats in modal */}
              <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Price</p>
                  <p className="text-lg font-bold text-primary-600">${(material.price ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Rating</p>
                  <div className="flex items-center">
                    <StarRating rating={rating?.averageRating || 0} size={14} />
                    <span className="ml-1 text-sm font-medium">{rating?.averageRating?.toFixed(1) || '0.0'}</span>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Reviews</p>
                  <p className="text-lg font-bold text-gray-900">{rating?.totalRatings || 0}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Type</p>
                  <p className="text-sm font-medium text-gray-900 capitalize">{material.contentType}</p>
                </div>
              </div>

              {material.coach && (
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                  <span>Coach: {material.coach.firstName} {material.coach.lastName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Coach Card
const CoachCard = ({ coach, rating, onRequestSession }) => (
  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
    <div className="p-4">
      <div className="flex items-center gap-4 mb-4">
        {coach.profileImageUrl ? (
          <img
            src={getAssetUrl(coach.profileImageUrl)}
            alt={`${coach.firstName} ${coach.lastName}`}
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
            <Users className="w-8 h-8 text-primary-600" />
          </div>
        )}
        <div>
          <h3 className="font-semibold text-gray-900">
            {coach.firstName} {coach.lastName}
          </h3>
          {coach.coachProfile?.certificationLevel && (
            <p className="text-sm text-gray-500">{coach.coachProfile.certificationLevel}</p>
          )}
        </div>
      </div>

      {coach.bio && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{coach.bio}</p>
      )}

      <div className="flex items-center gap-2 mb-3">
        <StarRating rating={rating?.averageRating || 0} size={14} />
        <span className="text-sm text-gray-500">
          ({rating?.totalRatings || 0} reviews)
        </span>
      </div>

      <div className="flex items-center justify-between">
        {coach.coachProfile?.hourlyRate ? (
          <span className="text-lg font-bold text-primary-600">
            ${coach.coachProfile.hourlyRate}/hr
          </span>
        ) : (
          <span className="text-sm text-gray-500">Rate not set</span>
        )}
        <button
          onClick={onRequestSession}
          className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 transition-colors"
        >
          Request Session
        </button>
      </div>
    </div>
  </div>
)

// Sessions Tab Component
const SessionsTab = ({ sessions, onRefresh }) => {
  const [actionLoading, setActionLoading] = useState(null)

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800'
      case 'PendingStudentApproval': return 'bg-orange-100 text-orange-800'
      case 'Confirmed': return 'bg-green-100 text-green-800'
      case 'Completed': return 'bg-blue-100 text-blue-800'
      case 'Cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'Pending': return 'Pending Coach Response'
      case 'PendingStudentApproval': return 'Coach Proposed Changes'
      case 'Confirmed': return 'Confirmed'
      case 'Completed': return 'Completed'
      case 'Cancelled': return 'Cancelled'
      default: return status
    }
  }

  const handleAcceptProposal = async (sessionId) => {
    if (!confirm('Accept the coach\'s proposed changes?')) return
    setActionLoading(sessionId)
    try {
      await sessionApi.acceptProposal(sessionId)
      onRefresh()
    } catch (error) {
      alert('Failed to accept: ' + (error.message || 'Unknown error'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeclineProposal = async (sessionId) => {
    if (!confirm('Decline this proposal? Your original request will be sent back to the coach.')) return
    setActionLoading(sessionId)
    try {
      await sessionApi.declineProposal(sessionId)
      onRefresh()
    } catch (error) {
      alert('Failed to decline: ' + (error.message || 'Unknown error'))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Your Sessions</h3>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No sessions yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Browse coaches and request a session to get started
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map(session => (
            <div key={session.id} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">
                    Session with {session.coachName || `${session.coach?.firstName || ''} ${session.coach?.lastName || ''}`}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    {new Date(session.requestedAt || session.scheduledAt).toLocaleDateString()} at{' '}
                    {new Date(session.requestedAt || session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    {session.durationMinutes} minutes - {session.sessionType}
                  </p>
                  {session.location && (
                    <p className="text-sm text-gray-500 mt-1">
                      📍 {session.location}
                    </p>
                  )}
                  {session.notes && (
                    <p className="text-sm text-gray-500 mt-2 italic">"{session.notes}"</p>
                  )}
                </div>
                <div className="text-right">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                    {getStatusLabel(session.status)}
                  </span>
                  {session.price > 0 && (
                    <p className="text-lg font-bold text-gray-900 mt-2">
                      ${session.price?.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              {/* Coach Proposal Section */}
              {session.status === 'PendingStudentApproval' && session.proposedAt && (
                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="font-medium text-orange-800 mb-2">Coach Proposed Changes:</p>
                  <div className="space-y-1 text-sm text-orange-700">
                    {session.proposedScheduledAt && (
                      <p>
                        <Calendar className="w-4 h-4 inline mr-1" />
                        <strong>New Time:</strong> {new Date(session.proposedScheduledAt).toLocaleString()}
                      </p>
                    )}
                    {session.proposedDurationMinutes && (
                      <p>
                        <Clock className="w-4 h-4 inline mr-1" />
                        <strong>Duration:</strong> {session.proposedDurationMinutes} minutes
                      </p>
                    )}
                    {session.proposedPrice !== null && session.proposedPrice !== undefined && (
                      <p>
                        <DollarSign className="w-4 h-4 inline mr-1" />
                        <strong>Price:</strong> ${session.proposedPrice?.toFixed(2)}
                      </p>
                    )}
                    {session.proposedLocation && (
                      <p>
                        📍 <strong>Location:</strong> {session.proposedLocation}
                      </p>
                    )}
                    {session.proposalNote && (
                      <p className="mt-2 italic">
                        <MessageSquare className="w-4 h-4 inline mr-1" />
                        "{session.proposalNote}"
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleDeclineProposal(session.id)}
                      disabled={actionLoading === session.id}
                      className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleAcceptProposal(session.id)}
                      disabled={actionLoading === session.id}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {actionLoading === session.id && <Loader2 className="w-3 h-3 animate-spin" />}
                      Accept Changes
                    </button>
                  </div>
                </div>
              )}

              {session.status === 'Confirmed' && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  {session.meetingLink && (
                    <a
                      href={session.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600"
                    >
                      Join Meeting
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Video Reviews Tab Component
const VideoReviewsTab = ({ requests, coaches, onRefresh, showUploadModal, setShowUploadModal }) => {
  const [editRequest, setEditRequest] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Open': return <Clock className="w-4 h-4 text-yellow-500" />
      case 'PendingStudentApproval': return <AlertCircle className="w-4 h-4 text-orange-500" />
      case 'Accepted': return <CheckCircle className="w-4 h-4 text-blue-500" />
      case 'Completed': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'Cancelled': return <X className="w-4 h-4 text-red-500" />
      default: return null
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'Open': return 'Open'
      case 'PendingStudentApproval': return 'Proposal Received'
      case 'Accepted': return 'In Progress'
      case 'Completed': return 'Completed'
      case 'Cancelled': return 'Cancelled'
      default: return status
    }
  }

  const handleAcceptProposal = async (requestId) => {
    if (!confirm('Accept this coach\'s proposal?')) return
    setActionLoading(requestId)
    try {
      await videoReviewApi.acceptProposal(requestId)
      onRefresh()
    } catch (error) {
      alert('Failed to accept: ' + (error.message || 'Unknown error'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeclineProposal = async (requestId) => {
    if (!confirm('Decline this proposal? The request will be reopened to other coaches.')) return
    setActionLoading(requestId)
    try {
      await videoReviewApi.declineProposal(requestId)
      onRefresh()
    } catch (error) {
      alert('Failed to decline: ' + (error.message || 'Unknown error'))
    } finally {
      setActionLoading(null)
    }
  }

  const canEdit = (status) => status === 'Open' || status === 'PendingStudentApproval'

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Video Review Requests</h3>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Request Review
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12">
          <Video className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No video review requests yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Upload a video to get feedback from coaches
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(request => (
            <div key={request.id} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(request.status)}
                    <h4 className="font-medium text-gray-900">{request.title}</h4>
                    <span className="text-xs px-2 py-0.5 bg-gray-200 rounded-full text-gray-600">
                      {getStatusLabel(request.status)}
                    </span>
                  </div>
                  {request.description && (
                    <p className="text-sm text-gray-600 mt-1">{request.description}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-2">
                    {request.coachName ? `For: ${request.coachName}` : 'Open to all coaches'}
                  </p>
                  {request.acceptedByCoachName && (
                    <p className="text-sm text-green-600 mt-1">
                      Working with: {request.acceptedByCoachName}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary-600">
                    ${request.offeredPrice?.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </p>
                  {canEdit(request.status) && (
                    <button
                      onClick={() => setEditRequest(request)}
                      className="text-xs text-primary-600 hover:text-primary-700 mt-2"
                    >
                      Edit Request
                    </button>
                  )}
                </div>
              </div>

              {/* Coach Proposal Section */}
              {request.status === 'PendingStudentApproval' && request.proposedByCoachName && (
                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-orange-800">
                        Proposal from {request.proposedByCoachName}
                      </p>
                      <p className="text-lg font-bold text-orange-700 mt-1">
                        ${request.proposedPrice?.toFixed(2)}
                      </p>
                      {request.proposalNote && (
                        <p className="text-sm text-orange-700 mt-2 italic">
                          "{request.proposalNote}"
                        </p>
                      )}
                      <p className="text-xs text-orange-600 mt-2">
                        Proposed {new Date(request.proposedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDeclineProposal(request.id)}
                        disabled={actionLoading === request.id}
                        className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleAcceptProposal(request.id)}
                        disabled={actionLoading === request.id}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {actionLoading === request.id && <Loader2 className="w-3 h-3 animate-spin" />}
                        Accept
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Completed Review Feedback */}
              {request.status === 'Completed' && request.reviewNotes && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-sm font-medium text-green-800">Coach Feedback:</p>
                  <p className="text-sm text-green-700 mt-1">{request.reviewNotes}</p>
                  {request.reviewVideoUrl && (
                    <a
                      href={request.reviewVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 mt-2"
                    >
                      <Video className="w-4 h-4" /> Watch Review Video
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload/Edit Modal */}
      {(showUploadModal || editRequest) && (
        <VideoUploadModal
          coaches={coaches}
          editRequest={editRequest}
          onClose={() => {
            setShowUploadModal(false)
            setEditRequest(null)
          }}
          onSuccess={() => {
            setShowUploadModal(false)
            setEditRequest(null)
            onRefresh()
          }}
        />
      )}
    </div>
  )
}

// Session Request Modal
const SessionRequestModal = ({ coach, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    sessionType: 'Online',
    requestedAt: '',
    durationMinutes: 60,
    notes: '',
    preferredLocation: ''
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await sessionApi.requestSession({
        coachId: coach.id,
        sessionType: formData.sessionType,
        requestedAt: new Date(formData.requestedAt).toISOString(),
        durationMinutes: formData.durationMinutes,
        notes: formData.sessionType === 'InPerson' && formData.preferredLocation
          ? `Preferred location: ${formData.preferredLocation}${formData.notes ? '. ' + formData.notes : ''}`
          : formData.notes
      })
      onSuccess()
    } catch (error) {
      alert('Failed to request session: ' + (error.message || 'Unknown error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Request Session with {coach.firstName}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session Type</label>
            <select
              value={formData.sessionType}
              onChange={(e) => setFormData({ ...formData, sessionType: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="Online">Online (Video Call)</option>
              <option value="InPerson">In Person</option>
            </select>
          </div>

          {formData.sessionType === 'InPerson' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Location</label>
              <input
                type="text"
                value={formData.preferredLocation}
                onChange={(e) => setFormData({ ...formData, preferredLocation: e.target.value })}
                placeholder="e.g., Local pickleball courts, your address..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Coach will confirm or suggest an alternative location
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Date & Time</label>
            <input
              type="datetime-local"
              value={formData.requestedAt}
              onChange={(e) => setFormData({ ...formData, requestedAt: e.target.value })}
              required
              min={new Date().toISOString().slice(0, 16)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
            <select
              value={formData.durationMinutes}
              onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Any specific topics you want to work on..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          {coach.coachProfile?.hourlyRate && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Estimated cost: <strong className="text-primary-600">${(coach.coachProfile.hourlyRate * formData.durationMinutes / 60).toFixed(2)}</strong>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Final price will be confirmed by the coach
              </p>
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
              className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Request Session
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Video Upload Modal - supports create and edit modes
const VideoUploadModal = ({ coaches, onClose, onSuccess, editRequest = null }) => {
  const isEdit = !!editRequest
  const [videoMode, setVideoMode] = useState(editRequest?.externalVideoLink ? 'link' : 'upload')
  const [formData, setFormData] = useState({
    coachId: editRequest?.coachId || '',
    title: editRequest?.title || '',
    description: editRequest?.description || '',
    videoUrl: editRequest?.videoUrl || '',
    externalVideoLink: editRequest?.externalVideoLink || '',
    offeredPrice: editRequest?.offeredPrice || 25
  })
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const response = await assetApi.upload(file, 'videos')
      if (response.success && response.data?.url) {
        setFormData({ ...formData, videoUrl: response.data.url, externalVideoLink: '' })
      }
    } catch (error) {
      alert('Failed to upload video: ' + (error.message || 'Unknown error'))
    } finally {
      setUploading(false)
    }
  }

  const hasVideo = formData.videoUrl || formData.externalVideoLink

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!hasVideo) {
      alert('Please provide a video (upload or link)')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        videoUrl: formData.videoUrl || null,
        externalVideoLink: formData.externalVideoLink || null,
        offeredPrice: formData.offeredPrice
      }

      if (isEdit) {
        await videoReviewApi.updateRequest(editRequest.id, payload)
      } else {
        await videoReviewApi.createRequest({
          ...payload,
          coachId: formData.coachId ? Number(formData.coachId) : null
        })
      }
      onSuccess()
    } catch (error) {
      alert(`Failed to ${isEdit ? 'update' : 'create'} request: ` + (error.message || 'Unknown error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{isEdit ? 'Edit Video Review Request' : 'Request Video Review'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="e.g., My serve technique"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="What would you like feedback on?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Video *</label>

            {/* Video mode toggle */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setVideoMode('upload')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                  videoMode === 'upload'
                    ? 'bg-primary-100 border-primary-500 text-primary-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Upload className="w-4 h-4 inline mr-1" /> Upload
              </button>
              <button
                type="button"
                onClick={() => setVideoMode('link')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                  videoMode === 'link'
                    ? 'bg-primary-100 border-primary-500 text-primary-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <ExternalLink className="w-4 h-4 inline mr-1" /> YouTube/Link
              </button>
            </div>

            {videoMode === 'upload' ? (
              formData.videoUrl ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-green-700">Video uploaded</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, videoUrl: '' })}
                    className="ml-auto text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="video-upload"
                    disabled={uploading}
                  />
                  <label htmlFor="video-upload" className="cursor-pointer">
                    {uploading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
                    ) : (
                      <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                    )}
                    <p className="mt-2 text-sm text-gray-600">
                      {uploading ? 'Uploading...' : 'Click to upload video'}
                    </p>
                  </label>
                </div>
              )
            ) : (
              <div>
                <input
                  type="url"
                  value={formData.externalVideoLink}
                  onChange={(e) => setFormData({ ...formData, externalVideoLink: e.target.value, videoUrl: '' })}
                  placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Paste a YouTube, Vimeo, or TikTok link
                </p>
              </div>
            )}
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Send To</label>
              <select
                value={formData.coachId}
                onChange={(e) => setFormData({ ...formData, coachId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Open to all coaches (marketplace)</option>
                {coaches.map(coach => (
                  <option key={coach.id} value={coach.id}>
                    {coach.firstName} {coach.lastName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Offered Price ($)</label>
            <input
              type="number"
              value={formData.offeredPrice}
              onChange={(e) => setFormData({ ...formData, offeredPrice: Number(e.target.value) })}
              min={5}
              step={5}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              {isEdit ? 'Update your offer price' : 'Higher offers are more likely to get accepted quickly'}
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
              disabled={submitting || !hasVideo}
              className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StudentDashboard
