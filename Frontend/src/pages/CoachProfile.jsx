import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { coachApi, ratingApi, tagApi, sessionApi, courseApi, materialApi, getAssetUrl } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Users, ArrowLeft, Star, Tag, ChevronDown, ChevronUp, Plus, X,
  Loader2, MessageSquare, Clock, Award, Calendar, DollarSign
} from 'lucide-react'
import StarRating from '../components/StarRating'

const CoachProfile = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [coach, setCoach] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasHadSession, setHasHadSession] = useState(false)
  const [hasPurchasedFromCoach, setHasPurchasedFromCoach] = useState(false)

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

  // Session request modal
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [sessionForm, setSessionForm] = useState({
    sessionType: 'Online',
    requestedAt: '',
    durationMinutes: 60,
    notes: '',
    preferredLocation: ''
  })
  const [submittingSession, setSubmittingSession] = useState(false)

  useEffect(() => {
    loadCoach()
  }, [id])

  useEffect(() => {
    if (id) {
      loadRatingsAndTags()
    }
  }, [id, user])

  const loadCoach = async () => {
    try {
      setLoading(true)
      const data = await coachApi.getCoach(id)
      if (!data || !data.id) {
        throw new Error('Coach not found')
      }
      setCoach(data)

      // Check if user has had a session with this coach or purchased from them
      if (user) {
        // Check sessions
        try {
          const sessionsResponse = await sessionApi.getStudentSessions()
          const sessions = Array.isArray(sessionsResponse) ? sessionsResponse : (sessionsResponse?.data || [])
          const hadSession = sessions.some(s =>
            s.coachId === parseInt(id) &&
            (s.status === 'Completed' || s.status === 'Confirmed')
          )
          setHasHadSession(hadSession)
        } catch (e) {
          console.error('Error checking sessions:', e)
        }

        // Check if purchased any courses or materials from this coach
        try {
          let hasPurchased = false

          // Check courses from this coach
          const coachCourses = await courseApi.getCoachCourses(id)
          const courses = Array.isArray(coachCourses) ? coachCourses : (coachCourses?.data || [])
          for (const course of courses) {
            try {
              const purchased = await courseApi.hasPurchased(course.id)
              if (purchased?.hasPurchased || purchased === true) {
                hasPurchased = true
                break
              }
            } catch (e) {
              // Course not purchased or error
            }
          }

          // Check materials from this coach if no course purchased yet
          // Use getMaterials which returns hasPurchased flag for each material
          if (!hasPurchased) {
            const allMaterials = await materialApi.getMaterials()
            const materialsArray = Array.isArray(allMaterials) ? allMaterials : (allMaterials?.data || [])
            // Filter materials by this coach and check if any are purchased
            const coachMaterials = materialsArray.filter(m => m.coachId === parseInt(id) || m.coach?.id === parseInt(id))
            hasPurchased = coachMaterials.some(m => m.hasPurchased === true)
          }

          setHasPurchasedFromCoach(hasPurchased)
        } catch (e) {
          console.error('Error checking purchases:', e)
        }
      }
    } catch (error) {
      console.error('Failed to load coach:', error)
      navigate('/marketplace')
    } finally {
      setLoading(false)
    }
  }

  const loadRatingsAndTags = async () => {
    try {
      // Load rating summary
      const summary = await ratingApi.getSummary('Coach', id)
      setRatingSummary(summary)

      // Load all ratings
      const allRatings = await ratingApi.getRatings('Coach', id)
      setRatings(Array.isArray(allRatings) ? allRatings : [])

      // Load top 10 tags
      const topTags = await tagApi.getCommonTags('Coach', id, 10)
      setTags(Array.isArray(topTags) ? topTags : [])

      // If user is logged in, load their rating and tags
      if (user) {
        try {
          const myRatingData = await ratingApi.getMyRating('Coach', id)
          setMyRating(myRatingData)
          if (myRatingData) {
            setRatingStars(myRatingData.stars || 0)
            setRatingReview(myRatingData.review || '')
          }
        } catch (e) {
          // No rating yet
        }

        try {
          const allTags = await tagApi.getTags('Coach', id)
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
      await ratingApi.rate('Coach', parseInt(id), ratingStars, ratingReview || null)
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
      await tagApi.addTag('Coach', parseInt(id), newTag.trim())
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
      await tagApi.removeTag('Coach', parseInt(id), tagId)
      await loadRatingsAndTags()
    } catch (error) {
      alert('Failed to remove tag: ' + (error.message || 'Unknown error'))
    }
  }

  const handleRequestSession = async (e) => {
    e.preventDefault()
    setSubmittingSession(true)
    try {
      await sessionApi.requestSession({
        coachId: parseInt(id),
        sessionType: sessionForm.sessionType,
        requestedAt: new Date(sessionForm.requestedAt).toISOString(),
        durationMinutes: sessionForm.durationMinutes,
        notes: sessionForm.sessionType === 'InPerson' && sessionForm.preferredLocation
          ? `Preferred location: ${sessionForm.preferredLocation}${sessionForm.notes ? '. ' + sessionForm.notes : ''}`
          : sessionForm.notes
      })
      setShowSessionModal(false)
      alert('Session request sent! Check your dashboard to track its status.')
    } catch (error) {
      alert('Failed to request session: ' + (error.message || 'Unknown error'))
    } finally {
      setSubmittingSession(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (!coach) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Coach Not Found</h2>
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

  const canRateAndTag = (hasHadSession || hasPurchasedFromCoach) && user && user.id !== coach.id

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => navigate('/marketplace')}
            className="flex items-center text-green-200 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </button>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Profile Image */}
            <div className="md:w-1/4">
              {coach.profileImageUrl ? (
                <img
                  src={getAssetUrl(coach.profileImageUrl)}
                  alt={`${coach.firstName} ${coach.lastName}`}
                  className="w-48 h-48 rounded-full object-cover shadow-lg mx-auto"
                />
              ) : (
                <div className="w-48 h-48 rounded-full bg-green-500 flex items-center justify-center mx-auto shadow-lg">
                  <Users className="w-24 h-24 text-green-200" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="md:w-3/4">
              <h1 className="text-3xl font-bold mb-2">
                {coach.firstName} {coach.lastName}
              </h1>

              {coach.coachProfile?.certificationLevel && (
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5" />
                  <span>{coach.coachProfile.certificationLevel}</span>
                </div>
              )}

              {coach.bio && (
                <p className="text-green-100 mb-6">{coach.bio}</p>
              )}

              <div className="flex flex-wrap items-center gap-6 mb-6">
                <div className="flex items-center">
                  <Star className="w-5 h-5 mr-2" />
                  <span>{ratingSummary?.averageRating?.toFixed(1) || '0.0'} ({ratingSummary?.totalRatings || 0} reviews)</span>
                </div>

                {coach.coachProfile?.yearsExperience && (
                  <div className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    <span>{coach.coachProfile.yearsExperience} years experience</span>
                  </div>
                )}

                {coach.coachProfile?.hourlyRate && (
                  <div className="flex items-center">
                    <DollarSign className="w-5 h-5 mr-2" />
                    <span>${coach.coachProfile.hourlyRate}/hour</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => user ? setShowSessionModal(true) : alert('Please log in to request a session')}
                className="flex items-center px-6 py-3 bg-white text-green-600 font-semibold rounded-lg hover:bg-green-50 transition-colors"
              >
                <Clock className="w-5 h-5 mr-2" />
                Request Session
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Coach Details */}
        {coach.coachProfile && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">About This Coach</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {coach.coachProfile.specialties && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Specialties</h3>
                  <p className="text-gray-900">{coach.coachProfile.specialties}</p>
                </div>
              )}
              {coach.coachProfile.certificationLevel && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Certification</h3>
                  <p className="text-gray-900">{coach.coachProfile.certificationLevel}</p>
                </div>
              )}
              {coach.coachProfile.availability && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Availability</h3>
                  <p className="text-gray-900">{coach.coachProfile.availability}</p>
                </div>
              )}
            </div>
          </div>
        )}

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

            {/* Rating Editor for Users who had sessions */}
            {canRateAndTag && (
              <div className="mb-6 p-4 bg-green-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">
                  {myRating ? 'Update Your Rating' : 'Rate This Coach'}
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
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
                >
                  {submittingRating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {myRating ? 'Update Rating' : 'Submit Rating'}
                </button>
              </div>
            )}

            {/* Info for users who haven't had a session or purchased */}
            {user && !canRateAndTag && user.id !== coach.id && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                Complete a session or purchase a course/material from this coach to leave a rating.
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
                    className="flex items-center text-green-600 hover:text-green-700 text-sm font-medium"
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
              </div>
            )}
          </div>

          {/* Tags Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
              <Tag className="w-5 h-5 mr-2 text-green-500" />
              Tags
            </h2>

            {/* Tag Editor for Users who had sessions */}
            {canRateAndTag ? (
              <div className="p-4 bg-green-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">Your Tags</h3>

                {myTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {myTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                      >
                        {tag.tagName || tag.name}
                        <button
                          onClick={() => handleRemoveTag(tag.tagId || tag.id)}
                          className="ml-2 hover:text-green-900"
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
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
                  >
                    {submittingTag ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ) : (
              /* Top Tags - only shown to users who haven't had sessions */
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Top Tags from Students</h3>
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
                  <p className="text-gray-500 text-sm">No tags yet.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Session Request Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Request Session with {coach.firstName}</h3>
              <button onClick={() => setShowSessionModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRequestSession} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Session Type</label>
                <select
                  value={sessionForm.sessionType}
                  onChange={(e) => setSessionForm({ ...sessionForm, sessionType: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="Online">Online (Video Call)</option>
                  <option value="InPerson">In Person</option>
                </select>
              </div>

              {sessionForm.sessionType === 'InPerson' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Location</label>
                  <input
                    type="text"
                    value={sessionForm.preferredLocation}
                    onChange={(e) => setSessionForm({ ...sessionForm, preferredLocation: e.target.value })}
                    placeholder="e.g., Local pickleball courts..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Date & Time</label>
                <input
                  type="datetime-local"
                  value={sessionForm.requestedAt}
                  onChange={(e) => setSessionForm({ ...sessionForm, requestedAt: e.target.value })}
                  required
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                <select
                  value={sessionForm.durationMinutes}
                  onChange={(e) => setSessionForm({ ...sessionForm, durationMinutes: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={sessionForm.notes}
                  onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Any specific topics you'd like to focus on?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              {coach.coachProfile?.hourlyRate && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Estimated cost: <span className="font-bold text-green-600">
                      ${(coach.coachProfile.hourlyRate * sessionForm.durationMinutes / 60).toFixed(2)}
                    </span>
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSession}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
                >
                  {submittingSession && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Send Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CoachProfile
