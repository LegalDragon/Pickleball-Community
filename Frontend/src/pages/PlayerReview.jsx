import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { certificationApi, SHARED_AUTH_URL, getSharedAssetUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { User, Star, CheckCircle, AlertCircle, Award, GraduationCap, RefreshCw, Info } from 'lucide-react';

export default function PlayerReview() {
  const { token } = useParams();
  const { user } = useAuth();
  const [pageInfo, setPageInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  // Prefill name and email from logged-in user if available
  const [formData, setFormData] = useState({
    reviewerName: '',
    reviewerEmail: '',
    knowledgeLevelId: '',
    isAnonymous: false,
    isSelfReview: false,
    comments: '',
    scores: {}
  });

  // Check if this is a self-review (logged-in user is the player being reviewed)
  const isSelfReview = user && pageInfo?.playerId && user.id === pageInfo.playerId;

  // Prefill user info when component mounts
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        reviewerName: user.lastName && user.firstName ? `${user.lastName}, ${user.firstName}` : (user.lastName || user.firstName || ''),
        reviewerEmail: user.email || ''
      }));
    }
  }, [user]);

  useEffect(() => {
    loadPageInfo();
  }, [token]);

  const loadPageInfo = async () => {
    try {
      setLoading(true);
      const data = await certificationApi.getReviewPage(token);
      setPageInfo(data);

      // Initialize scores with empty values
      if (data.skillAreas) {
        const initialScores = {};
        data.skillAreas.forEach(skill => {
          initialScores[skill.id] = 5; // Default to middle score
        });
        setFormData(prev => ({ ...prev, scores: initialScores }));
      }
    } catch (err) {
      console.error('Error loading review page:', err);
      setError('Failed to load review page');
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (skillId, score) => {
    setFormData(prev => ({
      ...prev,
      scores: { ...prev.scores, [skillId]: score }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isSelfReview && !formData.reviewerName.trim()) {
      alert('Please enter your name');
      return;
    }

    if (!isSelfReview && !formData.knowledgeLevelId) {
      alert('Please select how well you know this player');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const submitData = {
        reviewerName: isSelfReview ? 'Self Review' : formData.reviewerName,
        reviewerEmail: formData.reviewerEmail || null,
        knowledgeLevelId: isSelfReview ? null : parseInt(formData.knowledgeLevelId),
        isAnonymous: formData.isAnonymous,
        isSelfReview: isSelfReview,
        comments: formData.comments || null,
        scores: Object.entries(formData.scores).map(([skillAreaId, score]) => ({
          skillAreaId: parseInt(skillAreaId),
          score: parseInt(score)
        }))
      };

      await certificationApi.submitReview(token, submitData);
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting review:', err);
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!pageInfo?.isValid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-600">{pageInfo?.errorMessage || 'This review link is not valid.'}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600">Your review has been submitted successfully.</p>
          <p className="text-gray-500 mt-4 text-sm">
            {pageInfo.playerName} will be able to see your feedback.
          </p>
        </div>
      </div>
    );
  }

  // Group skill areas by SkillGroup (using skillGroupId and skillGroupName)
  const skillsByGroup = pageInfo.skillAreas?.reduce((acc, skill) => {
    const groupKey = skill.skillGroupId || 0;
    const groupName = skill.skillGroupName || 'Other Skills';
    if (!acc[groupKey]) {
      acc[groupKey] = {
        name: groupName,
        skills: []
      };
    }
    acc[groupKey].skills.push(skill);
    return acc;
  }, {}) || {};

  // Sort groups by their ID (which should match sortOrder from backend)
  const sortedGroups = Object.entries(skillsByGroup).sort(([a], [b]) => {
    if (a === '0') return 1; // 'Other Skills' goes last
    if (b === '0') return -1;
    return parseInt(a) - parseInt(b);
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className={`rounded-xl shadow-lg p-6 mb-6 ${isSelfReview ? 'bg-gradient-to-r from-purple-50 to-indigo-50' : 'bg-white'}`}>
          {isSelfReview && (
            <div className="mb-4 inline-flex items-center px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-medium">
              Self Assessment Mode
            </div>
          )}
          <div className="flex items-center gap-4">
            {pageInfo.playerProfileImageUrl ? (
              <img
                src={getSharedAssetUrl(pageInfo.playerProfileImageUrl)}
                alt={pageInfo.playerName}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center">
                <User className="w-10 h-10 text-primary-600" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isSelfReview ? 'Rate Your Own Skills' : `Rate ${pageInfo.playerName}'s Skills`}
              </h1>
              <p className="text-gray-600">
                {isSelfReview
                  ? 'Provide an honest self-assessment of your skills. This will be compared with peer reviews.'
                  : `Help ${pageInfo.playerName.split(' ')[0]} get certified by providing your honest assessment.`}
              </p>
            </div>
          </div>
          {pageInfo.message && !isSelfReview && (
            <div className="mt-4 p-4 bg-primary-50 rounded-lg">
              <p className="text-primary-800">{pageInfo.message}</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Certified Reviewer Encouragement - Hidden for self-review */}
        {!isSelfReview && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-start gap-4">
              {/* College Logo */}
              <div className="flex-shrink-0 relative">
                <div className="w-16 h-16 bg-white rounded-xl shadow-md flex items-center justify-center p-2">
                  <img
                    src={`${SHARED_AUTH_URL}/sites/College/logo`}
                    alt="Pickleball College"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="hidden w-full h-full items-center justify-center">
                    <GraduationCap className="w-8 h-8 text-indigo-600" />
                  </div>
                </div>
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-amber-400 text-amber-900 text-xs font-bold rounded-full">
                  Soon
                </span>
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Become a Certified Reviewer</h3>
                </div>
                <p className="text-gray-700 text-sm mb-3">
                  Your accurate and consistent reviews matter! We track reviewer accuracy over time.
                  Reviewers who provide thoughtful, consistent ratings will earn the
                  <span className="font-semibold text-indigo-700"> "Certified Reviewer" </span>
                  badge.
                </p>
                <div className="bg-white/60 rounded-lg p-3 border border-indigo-100">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-indigo-700">Coming Soon on Pickleball.College:</span> Certified Reviewers
                    will be able to provide official skill certifications that players can showcase on their profiles
                    and use for tournament seeding.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Review Update Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1 flex items-center gap-1">
              <RefreshCw className="w-4 h-4" />
              Review Update Policy
            </p>
            <p>
              If you've reviewed this player before, submitting a new review within <span className="font-semibold">1 month</span> will
              update your previous scores. After 1 month, a new review entry is created to track skill progression over time.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Reviewer Info - Hidden for self-review */}
          {!isSelfReview && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    value={formData.reviewerName}
                    onChange={(e) => setFormData(prev => ({ ...prev, reviewerName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter your name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email (optional)
                  </label>
                  <input
                    type="email"
                    value={formData.reviewerEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, reviewerEmail: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="your@email.com"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isAnonymous}
                    onChange={(e) => setFormData(prev => ({ ...prev, isAnonymous: e.target.checked }))}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <span className="text-gray-700">Keep my name hidden from the player</span>
                </label>
              </div>
            </div>
          )}

          {/* Knowledge Level - Hidden for self-review */}
          {!isSelfReview && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <label className="block text-lg font-semibold text-gray-900 mb-2">
                How well do you know this player? *
              </label>
              <select
                value={formData.knowledgeLevelId}
                onChange={(e) => setFormData(prev => ({ ...prev, knowledgeLevelId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="">Select an option...</option>
                {pageInfo.knowledgeLevels?.map(level => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Skill Ratings */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Rate Skills (1-10)
            </h2>
            <div className="space-y-6">
              {sortedGroups.map(([groupId, group]) => (
                <div key={groupId} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                  <h3 className="text-sm font-semibold text-primary-700 uppercase tracking-wide mb-4">
                    {group.name}
                  </h3>
                  <div className="space-y-4">
                    {group.skills.map(skill => (
                      <div key={skill.id} className="flex items-center gap-4">
                        <div className="w-40 flex-shrink-0">
                          <span className="text-gray-700">{skill.name}</span>
                        </div>
                        <div className="flex-1">
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={formData.scores[skill.id] || 5}
                            onChange={(e) => handleScoreChange(skill.id, e.target.value)}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                          />
                        </div>
                        <div className="w-12 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-semibold">
                            {formData.scores[skill.id] || 5}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Additional Comments (optional)
            </h2>
            <textarea
              value={formData.comments}
              onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
              rows={4}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Any additional feedback or observations..."
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
