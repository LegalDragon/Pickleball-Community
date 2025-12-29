import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { courseApi, ratingApi, tagApi, getAssetUrl } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  BookOpen, Play, Lock, Check, DollarSign, ArrowLeft,
  User, Clock, Video, ExternalLink, Loader2, Star, Tag,
  ChevronDown, ChevronUp, Plus, X, MessageSquare
} from 'lucide-react'
import StarRating from '../components/StarRating'
import MockPaymentModal from '../components/MockPaymentModal'

// Helper function to get embeddable video URL
const getEmbedUrl = (url) => {
  if (!url) return null

  // YouTube URLs
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`
  }

  // Vimeo URLs
  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/)
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`
  }

  // TikTok - can't embed easily, return null
  if (url.includes('tiktok.com')) {
    return null
  }

  return null
}

// Check if URL is likely a video file
const isVideoUrl = (url) => {
  if (!url) return false
  // Check for common video extensions or API video paths
  return /\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i.test(url) ||
         url.includes('/api/assets/') ||
         url.includes('/videos/')
}

const CourseDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasPurchased, setHasPurchased] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  // Ratings state
  const [ratingSummary, setRatingSummary] = useState(null)
  const [ratings, setRatings] = useState([])
  const [showAllRatings, setShowAllRatings] = useState(false)
  const [myRating, setMyRating] = useState(null)
  const [ratingStars, setRatingStars] = useState(0)
  const [ratingReview, setRatingReview] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)

  // Tags state
  const [tags, setTags] = useState([])
  const [myTags, setMyTags] = useState([])
  const [newTag, setNewTag] = useState('')
  const [submittingTag, setSubmittingTag] = useState(false)

  useEffect(() => {
    loadCourse()
  }, [id, user])

  useEffect(() => {
    if (id) {
      loadRatingsAndTags()
    }
  }, [id, hasPurchased, user])

  const loadCourse = async () => {
    try {
      setLoading(true)
      const data = await courseApi.getCourse(id)
      setCourse(data)

      // Check if purchased
      if (user) {
        try {
          const purchased = await courseApi.hasPurchased(id)
          setHasPurchased(purchased)
        } catch (e) {
          console.error('Error checking purchase status:', e)
        }
      }
    } catch (error) {
      console.error('Failed to load course:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRatingsAndTags = async () => {
    try {
      // Load rating summary
      const summary = await ratingApi.getSummary('Course', id)
      setRatingSummary(summary)

      // Load all ratings
      const allRatings = await ratingApi.getRatings('Course', id)
      setRatings(Array.isArray(allRatings) ? allRatings : [])

      // Load top 10 tags
      const topTags = await tagApi.getCommonTags('Course', id, 10)
      setTags(Array.isArray(topTags) ? topTags : [])

      // If user is logged in, load their rating and tags
      if (user) {
        try {
          const myRatingData = await ratingApi.getMyRating('Course', id)
          setMyRating(myRatingData)
          if (myRatingData) {
            setRatingStars(myRatingData.stars || 0)
            setRatingReview(myRatingData.review || '')
          }
        } catch (e) {
          // No rating yet
        }

        try {
          const allTags = await tagApi.getTags('Course', id)
          // Filter to only user's tags
          const userTags = Array.isArray(allTags)
            ? allTags.filter(t => t.userId === user.id)
            : []
          setMyTags(userTags)
        } catch (e) {
          console.error('Error loading user tags:', e)
        }
      }
    } catch (error) {
      console.error('Failed to load ratings/tags:', error)
    }
  }

  const handleSubmitRating = async () => {
    if (!ratingStars) {
      alert('Please select a rating')
      return
    }
    setSubmittingRating(true)
    try {
      await ratingApi.rate('Course', parseInt(id), ratingStars, ratingReview || null)
      await loadRatingsAndTags()
      alert('Rating submitted successfully!')
    } catch (error) {
      alert('Failed to submit rating: ' + (error.message || 'Unknown error'))
    } finally {
      setSubmittingRating(false)
    }
  }

  const handleAddTag = async () => {
    if (!newTag.trim()) return
    setSubmittingTag(true)
    try {
      await tagApi.addTag('Course', parseInt(id), newTag.trim())
      setNewTag('')
      await loadRatingsAndTags()
    } catch (error) {
      alert('Failed to add tag: ' + (error.message || 'Unknown error'))
    } finally {
      setSubmittingTag(false)
    }
  }

  const handleRemoveTag = async (tagId) => {
    try {
      await tagApi.removeTag('Course', parseInt(id), tagId)
      await loadRatingsAndTags()
    } catch (error) {
      alert('Failed to remove tag: ' + (error.message || 'Unknown error'))
    }
  }

  const handlePurchase = () => {
    if (!user) {
      alert('Please log in to purchase this course')
      return
    }
    setShowPaymentModal(true)
  }

  const handlePaymentSuccess = async () => {
    try {
      await courseApi.purchaseCourse(id)
      setHasPurchased(true)
      await loadCourse() // Reload to get full content
      setShowPaymentModal(false)
    } catch (error) {
      console.error('Purchase failed:', error)
      setShowPaymentModal(false)

      // Check if it's "already purchased" error - that's actually fine
      const errorMsg = typeof error === 'string' ? error : error?.message || ''
      if (errorMsg.toLowerCase().includes('already purchased')) {
        setHasPurchased(true)
        await loadCourse()
      } else {
        alert('Purchase failed: ' + (errorMsg || 'Please try again'))
      }
    }
  }

  const canViewMaterial = (material) => {
    return material.isPreview || hasPurchased || course?.coachId === user?.id
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Course Not Found</h2>
          <button
            onClick={() => navigate('/marketplace')}
            className="text-primary-600 hover:text-primary-700"
          >
            Back to Marketplace
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => navigate('/marketplace')}
            className="flex items-center text-indigo-200 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </button>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Course Thumbnail */}
            <div className="md:w-1/3">
              {course.thumbnailUrl ? (
                <img
                  src={getAssetUrl(course.thumbnailUrl)}
                  alt={course.title}
                  className="w-full rounded-lg shadow-lg"
                />
              ) : (
                <div className="w-full aspect-video bg-indigo-500 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-16 h-16 text-indigo-300" />
                </div>
              )}
            </div>

            {/* Course Info */}
            <div className="md:w-2/3">
              <h1 className="text-3xl font-bold mb-4">{course.title}</h1>
              <p className="text-indigo-100 mb-6">{course.description}</p>

              <div className="flex items-center gap-6 mb-6">
                <div className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  <span>{course.coach?.firstName} {course.coach?.lastName}</span>
                </div>
                <div className="flex items-center">
                  <Video className="w-5 h-5 mr-2" />
                  <span>{course.materialCount || course.materials?.length || 0} lessons</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold">${course.price?.toFixed(2)}</span>

                {hasPurchased ? (
                  <span className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg">
                    <Check className="w-5 h-5 mr-2" />
                    Purchased
                  </span>
                ) : (
                  <button
                    onClick={handlePurchase}
                    disabled={!user}
                    className="flex items-center px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 disabled:bg-gray-200 disabled:text-gray-500 transition-colors"
                  >
                    <DollarSign className="w-5 h-5 mr-2" />
                    {user ? 'Enroll Now' : 'Login to Enroll'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Course Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Materials List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Course Content</h2>

              {course.materials && course.materials.length > 0 ? (
                <div className="space-y-2">
                  {course.materials.map((cm, index) => {
                    const canView = canViewMaterial(cm)
                    return (
                      <button
                        key={cm.id}
                        onClick={() => canView && setSelectedMaterial(cm)}
                        disabled={!canView}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          selectedMaterial?.id === cm.id
                            ? 'bg-indigo-100 border-2 border-indigo-500'
                            : canView
                            ? 'bg-gray-50 hover:bg-gray-100'
                            : 'bg-gray-50 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center mr-3">
                              {index + 1}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">
                                {cm.material?.title}
                              </p>
                              <p className="text-xs text-gray-500 capitalize">
                                {cm.material?.contentType}
                              </p>
                            </div>
                          </div>
                          {cm.isPreview ? (
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                              Preview
                            </span>
                          ) : !canView ? (
                            <Lock className="w-4 h-4 text-gray-400" />
                          ) : (
                            <Play className="w-4 h-4 text-indigo-600" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No materials yet</p>
              )}

              {!hasPurchased && course.materials?.some(m => !m.isPreview) && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <Lock className="w-4 h-4 inline mr-1" />
                    Purchase this course to unlock all {course.materials.filter(m => !m.isPreview).length} locked lessons
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Material Viewer */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              {selectedMaterial ? (
                <div>
                  {/* Check if material is viewable */}
                  {!canViewMaterial(selectedMaterial) ? (
                    <div className="aspect-video bg-gray-100 rounded-t-lg flex items-center justify-center">
                      <div className="text-center p-8">
                        <Lock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Content Locked</h3>
                        <p className="text-gray-500 mb-4">Content available when you purchase this course</p>
                        <button
                          onClick={handlePurchase}
                          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                          Purchase to Unlock
                        </button>
                      </div>
                    </div>
                  ) : selectedMaterial.material?.videoUrl ? (
                    // Check if it's an embeddable URL (YouTube/Vimeo) or direct video
                    getEmbedUrl(selectedMaterial.material.videoUrl) ? (
                      <div className="aspect-video bg-black rounded-t-lg">
                        <iframe
                          src={getEmbedUrl(selectedMaterial.material.videoUrl)}
                          className="w-full h-full rounded-t-lg"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title={selectedMaterial.material?.title}
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-black rounded-t-lg">
                        <video
                          src={getAssetUrl(selectedMaterial.material.videoUrl)}
                          controls
                          className="w-full h-full rounded-t-lg"
                        />
                      </div>
                    )
                  ) : selectedMaterial.material?.externalLink ? (
                    // Check if external link is embeddable video (YouTube/Vimeo)
                    getEmbedUrl(selectedMaterial.material.externalLink) ? (
                      <div className="aspect-video bg-black rounded-t-lg">
                        <iframe
                          src={getEmbedUrl(selectedMaterial.material.externalLink)}
                          className="w-full h-full rounded-t-lg"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title={selectedMaterial.material?.title}
                        />
                      </div>
                    ) : isVideoUrl(selectedMaterial.material.externalLink) ? (
                      // Play as direct video if it looks like a video URL
                      <div className="aspect-video bg-black rounded-t-lg">
                        <video
                          src={getAssetUrl(selectedMaterial.material.externalLink)}
                          controls
                          className="w-full h-full rounded-t-lg"
                        />
                      </div>
                    ) : (
                      // Fallback for non-video external links - try to play as video first
                      <div className="aspect-video bg-black rounded-t-lg relative">
                        <video
                          src={getAssetUrl(selectedMaterial.material.externalLink)}
                          controls
                          className="w-full h-full rounded-t-lg"
                          onError={(e) => {
                            // If video fails to load, show link instead
                            e.target.style.display = 'none'
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                        <div className="hidden bg-gray-100 rounded-t-lg items-center justify-center absolute inset-0">
                          <a
                            href={selectedMaterial.material.externalLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                          >
                            <ExternalLink className="w-5 h-5 mr-2" />
                            Open External Content
                          </a>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="aspect-video bg-gray-100 rounded-t-lg flex items-center justify-center">
                      <Video className="w-16 h-16 text-gray-300" />
                    </div>
                  )}

                  {/* Material Info */}
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {selectedMaterial.material?.title}
                    </h3>
                    <p className="text-gray-600">
                      {selectedMaterial.material?.description}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="aspect-video flex items-center justify-center bg-gray-100 rounded-lg">
                  <div className="text-center text-gray-500">
                    <Play className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>Select a lesson to start learning</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ratings and Tags Section */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Ratings Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Star className="w-5 h-5 mr-2 text-yellow-500" />
                Ratings & Reviews
              </h2>
              {ratingSummary && (
                <div className="text-right">
                  <div className="flex items-center">
                    <span className="text-2xl font-bold text-gray-900 mr-2">
                      {ratingSummary.averageRating?.toFixed(1) || '0.0'}
                    </span>
                    <StarRating rating={ratingSummary.averageRating || 0} size={18} />
                  </div>
                  <p className="text-sm text-gray-500">{ratingSummary.totalRatings || 0} reviews</p>
                </div>
              )}
            </div>

            {/* Rating Editor for Purchased Users */}
            {hasPurchased && user && (
              <div className="mb-6 p-4 bg-indigo-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">
                  {myRating ? 'Update Your Rating' : 'Rate This Course'}
                </h3>
                <div className="mb-3">
                  <div className="flex items-center gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRatingStars(star)}
                        className="focus:outline-none"
                      >
                        <Star
                          className={`w-8 h-8 ${
                            star <= ratingStars
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={ratingReview}
                  onChange={(e) => setRatingReview(e.target.value)}
                  placeholder="Write your review (optional)"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3"
                />
                <button
                  onClick={handleSubmitRating}
                  disabled={submittingRating || !ratingStars}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center"
                >
                  {submittingRating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {myRating ? 'Update Rating' : 'Submit Rating'}
                </button>
              </div>
            )}

            {/* Reviews List */}
            {ratings.length > 0 ? (
              <div className="space-y-4">
                {(showAllRatings ? ratings : ratings.slice(0, 3)).map((rating) => (
                  <div key={rating.id} className="border-b border-gray-100 pb-4 last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-2">
                          <span className="text-sm font-medium text-gray-600">
                            {rating.user?.firstName?.[0]}{rating.user?.lastName?.[0]}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">
                          {rating.user?.firstName} {rating.user?.lastName}
                        </span>
                      </div>
                      <StarRating rating={rating.stars} size={14} />
                    </div>
                    {rating.review && (
                      <p className="text-gray-600 text-sm">{rating.review}</p>
                    )}
                  </div>
                ))}

                {ratings.length > 3 && (
                  <button
                    onClick={() => setShowAllRatings(!showAllRatings)}
                    className="flex items-center text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                  >
                    {showAllRatings ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-1" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-1" />
                        Show All {ratings.length} Reviews
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No reviews yet</p>
                {hasPurchased && <p className="text-sm">Be the first to review this course!</p>}
              </div>
            )}
          </div>

          {/* Tags Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
              <Tag className="w-5 h-5 mr-2 text-indigo-500" />
              Tags
            </h2>

            {/* Tag Editor for Purchased Users */}
            {hasPurchased && user ? (
              <div className="p-4 bg-indigo-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">Your Tags</h3>

                {/* User's tags */}
                {myTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {myTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
                      >
                        {tag.tagName || tag.name}
                        <button
                          onClick={() => handleRemoveTag(tag.tagId || tag.id)}
                          className="ml-2 hover:text-indigo-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add new tag */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Add a tag..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={submittingTag || !newTag.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center"
                  >
                    {submittingTag ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ) : (
              /* Top Tags - only shown to non-purchased users */
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Top Tags from All Users</h3>
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <span
                        key={tag.id || index}
                        className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                      >
                        {tag.name || tag.tagName}
                        {tag.count > 1 && (
                          <span className="ml-1 text-xs text-gray-500">({tag.count})</span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No tags yet. Purchase to add tags.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <MockPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={handlePaymentSuccess}
        itemName={course?.title}
        itemType="course"
        price={course?.price}
        coachName={`${course?.coach?.firstName || ''} ${course?.coach?.lastName || ''}`}
      />
    </div>
  )
}

export default CourseDetail
