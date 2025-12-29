import { useState, useEffect } from 'react';
import { certificationApi } from '../services/api';
import { getAssetUrl } from '../services/api';
import {
  User, Star, Copy, Check, Plus, Link as LinkIcon,
  Eye, EyeOff, Calendar, MessageSquare, ChevronDown, ChevronUp,
  Award, TrendingUp
} from 'lucide-react';

export default function MyCertificate() {
  const [certificate, setCertificate] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(null);
  const [expandedReview, setExpandedReview] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [certData, reqData] = await Promise.all([
        certificationApi.getMyCertificate(),
        certificationApi.getMyRequests()
      ]);
      setCertificate(certData);
      setRequests(reqData);
    } catch (err) {
      console.error('Error loading certificate data:', err);
      setError('Failed to load certificate data');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(url);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-600 bg-green-100';
    if (score >= 6) return 'text-yellow-600 bg-yellow-100';
    if (score >= 4) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Award className="w-12 h-12" />
            <div>
              <h1 className="text-3xl font-bold">My Player Certificate</h1>
              <p className="text-primary-100 mt-1">
                View your skill ratings and share review links
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overall Summary */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Skill Summary</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {certificate?.totalReviews || 0} reviews
                  </span>
                </div>
              </div>

              {certificate?.totalReviews > 0 ? (
                <>
                  {/* Overall Score */}
                  <div className="flex items-center gap-4 p-4 bg-primary-50 rounded-lg mb-6">
                    <div className="flex-shrink-0">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${getScoreColor(certificate.overallAverageScore)}`}>
                        {certificate.overallAverageScore.toFixed(1)}
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-900">Overall Rating</div>
                      <div className="text-sm text-gray-600">
                        Based on {certificate.totalReviews} review{certificate.totalReviews !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Skill Breakdown */}
                  <div className="space-y-3">
                    {certificate.skillAverages?.map(skill => (
                      <div key={skill.skillAreaId} className="flex items-center gap-4">
                        <div className="w-40 flex-shrink-0">
                          <span className="text-sm text-gray-700">{skill.skillAreaName}</span>
                        </div>
                        <div className="flex-1">
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 rounded-full transition-all"
                              style={{ width: `${(skill.averageScore / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-12 text-right">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${getScoreColor(skill.averageScore)}`}>
                            {skill.averageScore.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No reviews yet.</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Share your review link to get feedback on your skills.
                  </p>
                </div>
              )}
            </div>

            {/* Individual Reviews */}
            {certificate?.reviews?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Review Details</h2>
                <div className="space-y-4">
                  {certificate.reviews.map(review => (
                    <div key={review.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedReview(expandedReview === review.id ? null : review.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                            {review.reviewerDisplayName === 'Anonymous' ? (
                              <EyeOff className="w-5 h-5 text-gray-400" />
                            ) : (
                              <User className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="text-left">
                            <div className="font-medium text-gray-900">{review.reviewerDisplayName}</div>
                            <div className="text-sm text-gray-500">{review.knowledgeLevelName}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-500">{formatDate(review.createdAt)}</span>
                          {expandedReview === review.id ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {expandedReview === review.id && (
                        <div className="border-t border-gray-200 p-4 bg-gray-50">
                          {/* Scores */}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                            {review.scores.map(score => (
                              <div key={score.id} className="flex items-center justify-between bg-white rounded p-2">
                                <span className="text-sm text-gray-600">{score.skillAreaName}</span>
                                <span className={`px-2 py-1 rounded text-sm font-medium ${getScoreColor(score.score)}`}>
                                  {score.score}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Comments */}
                          {review.comments && (
                            <div className="flex items-start gap-2 mt-3">
                              <MessageSquare className="w-4 h-4 text-gray-400 mt-1" />
                              <p className="text-gray-600 text-sm">{review.comments}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Review Links */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Review Links</h2>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
                >
                  <Plus className="w-4 h-4" />
                  New Link
                </button>
              </div>

              {requests.length > 0 ? (
                <div className="space-y-3">
                  {requests.map(req => (
                    <div
                      key={req.id}
                      className={`p-3 border rounded-lg ${req.isActive ? 'border-gray-200' : 'border-gray-100 bg-gray-50'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <LinkIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">
                            {req.reviewCount} review{req.reviewCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {req.isActive ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Active</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">Inactive</span>
                        )}
                      </div>

                      {req.isActive && (
                        <button
                          onClick={() => copyLink(`${window.location.origin}/review/${req.token}`)}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                        >
                          {copiedLink === `${window.location.origin}/review/${req.token}` ? (
                            <>
                              <Check className="w-4 h-4 text-green-500" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy Link
                            </>
                          )}
                        </button>
                      )}

                      <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Created {formatDate(req.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <LinkIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No review links yet</p>
                  <p className="text-gray-400 text-xs mt-1">Create a link to share with others</p>
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-3">How it works</h3>
              <ol className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-medium">1</span>
                  Create a review link
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-medium">2</span>
                  Share it with people who've seen you play
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-medium">3</span>
                  They rate your skills (1-10)
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-medium">4</span>
                  View aggregated results here
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Create Link Modal */}
      {showCreateModal && (
        <CreateLinkModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function CreateLinkModal({ onClose, onCreated }) {
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      setError(null);
      await certificationApi.createRequest({ message: message || null });
      onCreated();
    } catch (err) {
      console.error('Error creating link:', err);
      setError(err.message || 'Failed to create link');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Review Link</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
        )}

        <form onSubmit={handleCreate}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom Message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Add a personal message for reviewers..."
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
