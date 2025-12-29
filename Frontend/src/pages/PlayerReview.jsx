import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { certificationApi } from '../services/api';
import { getAssetUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { User, Star, CheckCircle, AlertCircle } from 'lucide-react';

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
    comments: '',
    scores: {}
  });

  // Prefill user info when component mounts
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        reviewerName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
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

    if (!formData.reviewerName.trim()) {
      alert('Please enter your name');
      return;
    }

    if (!formData.knowledgeLevelId) {
      alert('Please select how well you know this player');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const submitData = {
        reviewerName: formData.reviewerName,
        reviewerEmail: formData.reviewerEmail || null,
        knowledgeLevelId: parseInt(formData.knowledgeLevelId),
        isAnonymous: formData.isAnonymous,
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

  // Group skill areas by category
  const skillsByCategory = pageInfo.skillAreas?.reduce((acc, skill) => {
    const category = skill.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(skill);
    return acc;
  }, {}) || {};

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4">
            {pageInfo.playerProfileImageUrl ? (
              <img
                src={getAssetUrl(pageInfo.playerProfileImageUrl)}
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
                Rate {pageInfo.playerName}'s Skills
              </h1>
              <p className="text-gray-600">
                Help {pageInfo.playerName.split(' ')[0]} get certified by providing your honest assessment.
              </p>
            </div>
          </div>
          {pageInfo.message && (
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Reviewer Info */}
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

          {/* Knowledge Level */}
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

          {/* Skill Ratings */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Rate Skills (1-10)
            </h2>
            <div className="space-y-6">
              {Object.entries(skillsByCategory).map(([category, skills]) => (
                <div key={category}>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                    {category}
                  </h3>
                  <div className="space-y-4">
                    {skills.map(skill => (
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
