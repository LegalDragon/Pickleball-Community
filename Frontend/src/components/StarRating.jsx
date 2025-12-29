import { useState } from 'react'
import { Star } from 'lucide-react'

/**
 * StarRating component for displaying and interacting with star ratings
 *
 * @param {number} rating - Current rating value (1-5)
 * @param {function} onRate - Callback when user clicks a star (optional, if not provided, component is read-only)
 * @param {number} size - Size of stars in pixels (default: 20)
 * @param {boolean} showValue - Whether to show the numeric value next to stars
 * @param {number} totalRatings - Total number of ratings to display
 * @param {boolean} disabled - Whether interaction is disabled
 */
const StarRating = ({
  rating = 0,
  onRate,
  size = 20,
  showValue = false,
  totalRatings,
  disabled = false
}) => {
  const [hoverRating, setHoverRating] = useState(0)
  const isInteractive = !!onRate && !disabled

  const handleClick = (starValue) => {
    if (isInteractive) {
      onRate(starValue)
    }
  }

  const handleMouseEnter = (starValue) => {
    if (isInteractive) {
      setHoverRating(starValue)
    }
  }

  const handleMouseLeave = () => {
    if (isInteractive) {
      setHoverRating(0)
    }
  }

  const displayRating = hoverRating || rating

  return (
    <div className="flex items-center gap-1">
      <div
        className={`flex ${isInteractive ? 'cursor-pointer' : ''}`}
        onMouseLeave={handleMouseLeave}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= displayRating
          const isPartiallyFilled = !isFilled && star - 0.5 <= displayRating

          return (
            <button
              key={star}
              type="button"
              onClick={() => handleClick(star)}
              onMouseEnter={() => handleMouseEnter(star)}
              disabled={!isInteractive}
              className={`p-0.5 transition-transform ${
                isInteractive ? 'hover:scale-110' : ''
              } disabled:cursor-default`}
            >
              <Star
                size={size}
                className={`transition-colors ${
                  isFilled
                    ? 'fill-yellow-400 text-yellow-400'
                    : isPartiallyFilled
                    ? 'fill-yellow-400/50 text-yellow-400'
                    : 'fill-transparent text-gray-300'
                }`}
              />
            </button>
          )
        })}
      </div>

      {showValue && (
        <span className="ml-1 text-sm text-gray-600">
          {rating > 0 ? rating.toFixed(1) : '0.0'}
        </span>
      )}

      {totalRatings !== undefined && (
        <span className="ml-1 text-sm text-gray-500">
          ({totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'})
        </span>
      )}
    </div>
  )
}

/**
 * RatingDisplay component for showing rating summary with breakdown
 */
export const RatingDisplay = ({ summary, size = 24 }) => {
  if (!summary) return null

  const { averageRating, totalRatings, starCounts } = summary

  return (
    <div className="space-y-3">
      {/* Average rating */}
      <div className="flex items-center gap-3">
        <span className="text-3xl font-bold text-gray-900">
          {averageRating.toFixed(1)}
        </span>
        <div>
          <StarRating rating={averageRating} size={size} />
          <p className="text-sm text-gray-500 mt-1">
            {totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'}
          </p>
        </div>
      </div>

      {/* Star breakdown */}
      <div className="space-y-1">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = starCounts[star - 1] || 0
          const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0

          return (
            <div key={star} className="flex items-center gap-2 text-sm">
              <span className="w-3 text-gray-600">{star}</span>
              <Star size={12} className="fill-yellow-400 text-yellow-400" />
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-8 text-gray-500 text-right">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * RatingForm component for submitting a rating with optional review
 */
export const RatingForm = ({
  initialRating = 0,
  initialReview = '',
  onSubmit,
  onCancel,
  submitting = false
}) => {
  const [rating, setRating] = useState(initialRating)
  const [review, setReview] = useState(initialReview)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (rating > 0) {
      onSubmit({ stars: rating, review: review.trim() || null })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Rating
        </label>
        <StarRating rating={rating} onRate={setRating} size={32} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Review (optional)
        </label>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Share your experience..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
        />
        <p className="text-xs text-gray-500 mt-1">{review.length}/1000</p>
      </div>

      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={rating === 0 || submitting}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Submitting...' : initialRating > 0 ? 'Update Rating' : 'Submit Rating'}
        </button>
      </div>
    </form>
  )
}

export default StarRating
