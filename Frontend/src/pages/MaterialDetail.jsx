import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { materialApi, ratingApi, tagApi, getAssetUrl } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Video, Image, FileText, Link, ArrowLeft, Star, Tag,
  ChevronDown, ChevronUp, Plus, X, Loader2, MessageSquare,
  Lock, DollarSign, Check, ExternalLink, Music, Download
} from 'lucide-react'
import StarRating from '../components/StarRating'
import MockPaymentModal from '../components/MockPaymentModal'

// Helper function to get embeddable video URL
const getEmbedUrl = (url) => {
  if (!url) return null
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`
  }
  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/)
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`
  }
  return null
}

const MaterialDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [material, setMaterial] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasPurchased, setHasPurchased] = useState(false)
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
    loadMaterial()
  }, [id, user])

  useEffect(() => {
    if (id) {
      loadRatingsAndTags()
    }
  }, [id, hasPurchased, user])

  const loadMaterial = async () => {
    try {
      setLoading(true)
      const data = await materialApi.getMaterial(id)
      if (!data || !data.id) {
        throw new Error('Material not found')
      }
      setMaterial(data)
      setHasPurchased(data.hasPurchased || false)

      // Check if user is the coach (owner)
      if (user && data.coachId === user.id) {
        setHasPurchased(true)
      }
    } catch (error) {
      console.error('Failed to load material:', error)
      alert('Failed to load material: ' + (error.message || 'Unknown error'))
      navigate('/marketplace')
    } finally {
      setLoading(false)
    }
  }

  const loadRatingsAndTags = async () => {
    try {
      // Load rating summary
      const summary = await ratingApi.getSummary('Material', id)
      setRatingSummary(summary)

      // Load all ratings
      const allRatings = await ratingApi.getRatings('Material', id)
      setRatings(Array.isArray(allRatings) ? allRatings : [])

      // Load top 10 tags
      const topTags = await tagApi.getCommonTags('Material', id, 10)
      setTags(Array.isArray(topTags) ? topTags : [])

      // If user is logged in, load their rating and tags
      if (user) {
        try {
          const myRatingData = await ratingApi.getMyRating('Material', id)
          setMyRating(myRatingData)
          if (myRatingData) {
            setRatingStars(myRatingData.stars || 0)
            setRatingReview(myRatingData.review || '')
          }
        } catch (e) {
          // No rating yet
        }

        try {
          const allTags = await tagApi.getTags('Material', id)
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
      await ratingApi.rate('Material', parseInt(id), ratingStars, ratingReview || null)
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
      await tagApi.addTag('Material', parseInt(id), newTag.trim())
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
      await tagApi.removeTag('Material', parseInt(id), tagId)
      await loadRatingsAndTags()
    } catch (error) {
      alert('Failed to remove tag: ' + (error.message || 'Unknown error'))
    }
  }

  const handlePurchase = () => {
    if (!user) {
      alert('Please log in to purchase this material')
      return
    }
    setShowPaymentModal(true)
  }

  const handlePaymentSuccess = async () => {
    try {
      await materialApi.purchaseMaterial(id)
      setHasPurchased(true)
      await loadMaterial()
      setShowPaymentModal(false)
    } catch (error) {
      console.error('Purchase failed:', error)
      setShowPaymentModal(false)
      const errorMsg = typeof error === 'string' ? error : error?.message || ''
      if (errorMsg.toLowerCase().includes('already purchased')) {
        setHasPurchased(true)
        await loadMaterial()
      } else {
        alert('Purchase failed: ' + (errorMsg || 'Please try again'))
      }
    }
  }

  const getContentTypeIcon = (type) => {
    switch (type) {
      case 'Video': return <Video className="w-6 h-6" />
      case 'Image': return <Image className="w-6 h-6" />
      case 'Document': return <FileText className="w-6 h-6" />
      case 'Audio': return <Music className="w-6 h-6" />
      case 'Link': return <Link className="w-6 h-6" />
      default: return <Video className="w-6 h-6" />
    }
  }

  const isOwner = user?.id === material?.coachId

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (!material) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Material Not Found</h2>
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
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => navigate('/marketplace')}
            className="flex items-center text-primary-200 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </button>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Thumbnail */}
            <div className="md:w-1/3">
              {material.thumbnailUrl ? (
                <img
                  src={getAssetUrl(material.thumbnailUrl)}
                  alt={material.title}
                  className="w-full rounded-lg shadow-lg"
                />
              ) : (
                <div className="w-full aspect-video bg-primary-500 rounded-lg flex items-center justify-center">
                  {getContentTypeIcon(material.contentType)}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="md:w-2/3">
              <h1 className="text-3xl font-bold mb-2">{material.title}</h1>
              <div className="flex items-center gap-2 mb-4">
                {getContentTypeIcon(material.contentType)}
                <span className="capitalize">{material.contentType}</span>
              </div>
              <p className="text-primary-100 mb-6">{material.description}</p>

              <div className="flex items-center gap-6 mb-6">
                <div className="flex items-center">
                  <Star className="w-5 h-5 mr-2" />
                  <span>{ratingSummary?.averageRating?.toFixed(1) || '0.0'} ({ratingSummary?.totalRatings || 0} reviews)</span>
                </div>
                {material.coach && (
                  <div className="flex items-center">
                    <span>By {material.coach.firstName} {material.coach.lastName}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold">${material.price?.toFixed(2)}</span>

                {hasPurchased ? (
                  <span className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg">
                    <Check className="w-5 h-5 mr-2" />
                    {isOwner ? 'Your Material' : 'Purchased'}
                  </span>
                ) : (
                  <button
                    onClick={handlePurchase}
                    disabled={!user}
                    className="flex items-center px-6 py-3 bg-white text-primary-600 font-semibold rounded-lg hover:bg-primary-50 disabled:bg-gray-200 disabled:text-gray-500 transition-colors"
                  >
                    <DollarSign className="w-5 h-5 mr-2" />
                    {user ? 'Purchase Now' : 'Login to Purchase'}
                  </button>
                )}

                {isOwner && (
                  <button
                    onClick={() => navigate(`/coach/materials/edit/${material.id}`)}
                    className="px-4 py-2 bg-white text-primary-600 rounded-lg hover:bg-primary-50"
                  >
                    Edit Material
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Content Viewer */}
        <div className="bg-white rounded-lg shadow mb-8">
          {hasPurchased ? (
            <div>
              {/* Content based on type */}
              {material.contentType === 'Video' ? (
                // Video content
                material.videoUrl ? (
                  getEmbedUrl(material.videoUrl) ? (
                    <div className="aspect-video bg-black rounded-t-lg">
                      <iframe
                        src={getEmbedUrl(material.videoUrl)}
                        className="w-full h-full rounded-t-lg"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={material.title}
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-black rounded-t-lg">
                      <video
                        src={getAssetUrl(material.videoUrl)}
                        controls
                        className="w-full h-full rounded-t-lg"
                      />
                    </div>
                  )
                ) : material.externalLink ? (
                  getEmbedUrl(material.externalLink) ? (
                    <div className="aspect-video bg-black rounded-t-lg">
                      <iframe
                        src={getEmbedUrl(material.externalLink)}
                        className="w-full h-full rounded-t-lg"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={material.title}
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-black rounded-t-lg">
                      <video
                        src={getAssetUrl(material.externalLink)}
                        controls
                        className="w-full h-full rounded-t-lg"
                      />
                    </div>
                  )
                ) : (
                  <div className="aspect-video bg-gray-100 rounded-t-lg flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <Video className="w-16 h-16 mx-auto mb-2" />
                      <p className="mt-2">No video content available</p>
                    </div>
                  </div>
                )
              ) : material.contentType === 'Audio' ? (
                // Audio content
                <div className="p-8 bg-gradient-to-br from-purple-50 to-indigo-100 rounded-t-lg">
                  <div className="max-w-xl mx-auto text-center">
                    <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                      <Music className="w-16 h-16 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">{material.title}</h3>
                    {material.externalLink && (
                      <audio
                        src={getAssetUrl(material.externalLink)}
                        controls
                        className="w-full max-w-md mx-auto"
                        preload="metadata"
                      >
                        Your browser does not support the audio element.
                      </audio>
                    )}
                    {!material.externalLink && (
                      <p className="text-gray-500">No audio file available</p>
                    )}
                  </div>
                </div>
              ) : material.contentType === 'Document' ? (
                // Document content
                <div className="p-8 bg-gradient-to-br from-blue-50 to-cyan-100 rounded-t-lg">
                  <div className="max-w-xl mx-auto text-center">
                    <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center shadow-lg">
                      <FileText className="w-16 h-16 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">{material.title}</h3>
                    {material.externalLink && (
                      <div className="space-y-4">
                        {material.externalLink.toLowerCase().endsWith('.pdf') ? (
                          <>
                            <iframe
                              src={getAssetUrl(material.externalLink)}
                              className="w-full h-96 border border-gray-300 rounded-lg"
                              title={material.title}
                            />
                            <a
                              href={getAssetUrl(material.externalLink)}
                              download
                              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <Download className="w-5 h-5 mr-2" />
                              Download PDF
                            </a>
                          </>
                        ) : (
                          <a
                            href={getAssetUrl(material.externalLink)}
                            download
                            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Download className="w-5 h-5 mr-2" />
                            Download Document
                          </a>
                        )}
                      </div>
                    )}
                    {!material.externalLink && (
                      <p className="text-gray-500">No document file available</p>
                    )}
                  </div>
                </div>
              ) : material.contentType === 'Image' ? (
                // Image content
                <div className="p-4 bg-gray-100 rounded-t-lg">
                  {(material.externalLink || material.thumbnailUrl) ? (
                    <img
                      src={getAssetUrl(material.externalLink || material.thumbnailUrl)}
                      alt={material.title}
                      className="max-w-full max-h-[600px] mx-auto rounded-lg shadow-lg"
                    />
                  ) : (
                    <div className="aspect-video flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <Image className="w-16 h-16 mx-auto mb-2" />
                        <p>No image available</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : material.contentType === 'Link' ? (
                // External link content
                <div className="p-8 bg-gradient-to-br from-green-50 to-teal-100 rounded-t-lg">
                  <div className="max-w-xl mx-auto text-center">
                    <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center shadow-lg">
                      <ExternalLink className="w-16 h-16 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">{material.title}</h3>
                    {material.externalLink && (
                      <a
                        href={material.externalLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <ExternalLink className="w-5 h-5 mr-2" />
                        Open External Link
                      </a>
                    )}
                    {!material.externalLink && (
                      <p className="text-gray-500">No link available</p>
                    )}
                  </div>
                </div>
              ) : (
                // Fallback for unknown content types
                <div className="aspect-video bg-gray-100 rounded-t-lg flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    {getContentTypeIcon(material.contentType)}
                    <p className="mt-2">Content type: {material.contentType}</p>
                  </div>
                </div>
              )}
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-600">{material.description}</p>
              </div>
            </div>
          ) : (
            <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center p-8">
                <Lock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Content Locked</h3>
                <p className="text-gray-500 mb-4">Purchase this material to view the content</p>
                <button
                  onClick={handlePurchase}
                  disabled={!user}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300"
                >
                  {user ? 'Purchase to Unlock' : 'Login to Purchase'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Ratings and Tags Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
            {hasPurchased && user && !isOwner && (
              <div className="mb-6 p-4 bg-primary-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">
                  {myRating ? 'Update Your Rating' : 'Rate This Material'}
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
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center"
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
                    className="flex items-center text-primary-600 hover:text-primary-700 text-sm font-medium"
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
                {hasPurchased && !isOwner && <p className="text-sm">Be the first to review this material!</p>}
              </div>
            )}
          </div>

          {/* Tags Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
              <Tag className="w-5 h-5 mr-2 text-primary-500" />
              Tags
            </h2>

            {/* Tag Editor for Purchased Users */}
            {hasPurchased && user ? (
              <div className="p-4 bg-primary-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">Your Tags</h3>

                {myTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {myTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                      >
                        {tag.tagName || tag.name}
                        <button
                          onClick={() => handleRemoveTag(tag.tagId || tag.id)}
                          className="ml-2 hover:text-primary-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

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
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center"
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
        itemName={material?.title}
        itemType="material"
        price={material?.price}
        coachName={`${material?.coach?.firstName || ''} ${material?.coach?.lastName || ''}`}
      />
    </div>
  )
}

export default MaterialDetail
